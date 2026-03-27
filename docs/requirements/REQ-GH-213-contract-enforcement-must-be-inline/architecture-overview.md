# Architecture Overview: Inline Contract Enforcement

**REQ-GH-213** | Status: Accepted

---

## 1. Architecture Options

### Option A: Stateless check functions using existing data loaders (Selected)

Pure stateless check functions in `src/core/validators/contract-checks.js`. No class, no caching layer, no new loading mechanism. Each function takes already-loaded data (from SessionStart cache for Claude, from `loadContractEntry()` for Codex) and validates a single decision point. Throws on violation.

| Aspect | Assessment |
|--------|-----------|
| **Pros** | Zero new infrastructure; reuses SessionStart cache (Claude) and runtime loader (Codex); pure functions = trivially testable; no file I/O per check; no state management |
| **Cons** | Callers must pass contract data to each function (no implicit context) |
| **Pattern alignment** | Consistent with existing stateless validators in `src/core/validators/` |
| **Verdict** | **Selected** |

### Option B: Stateful guard class with own loading

Create a `ContractGuard` class that loads contract files, caches them, and exposes check methods.

| Aspect | Assessment |
|--------|-----------|
| **Pros** | Self-contained; callers don't need to manage data passing |
| **Cons** | Duplicates SessionStart cache loading; adds another caching layer; Codex has no SessionStart cache so wiring diverges; class state adds complexity |
| **Pattern alignment** | Over-engineering for 6 stateless checks |
| **Verdict** | **Eliminated** — duplicates existing loading infrastructure. SessionStart cache already loads contracts, roundtable config, and skills manifest at session start. |

### Option C: Event-driven contract bus

Create an event emitter that fires at decision points. Contract observers subscribe and throw on violations.

| Aspect | Assessment |
|--------|-----------|
| **Pros** | Fully decoupled; new checks addable without touching callers |
| **Cons** | Over-engineered for 6 decision points; harder to debug; event ordering is implicit; Codex has no event bus |
| **Pattern alignment** | No existing event patterns in the codebase |
| **Verdict** | **Eliminated** — violates Article V (Simplicity First). |

## 2. Selected Architecture

### ADR-001: Stateless Check Functions on Pre-Loaded Data

**Status**: Accepted
**Context**: The batch `evaluateContract()` runs post-phase, catching violations too late. We need per-decision-point checks with zero overhead. The SessionStart cache (Claude) and `loadContractEntry()` (Codex) already load contract data into memory.
**Decision**: Create `src/core/validators/contract-checks.js` with pure stateless functions. Each function receives the contract data, template data, and decision-point-specific inputs as arguments. No class, no caching, no file I/O. Functions throw `ContractViolationError` on violation.
**Rationale**: Leverages existing loading mechanisms — no duplication. Pure functions are trivially testable. Both providers call the same functions with their own already-loaded data.
**Consequences**: Claude's analyze handler extracts contract data from session cache and passes it to check functions. Codex's runtime.js loads via `loadContractEntry()` and passes it. The check functions are provider-agnostic.

### ADR-002: Presentation Templates as Declarative Config

**Status**: Accepted
**Context**: Output format varies unpredictably between analysis runs. Need a spec to validate against.
**Decision**: Templates are JSON files in `src/claude/hooks/config/templates/` (shipped) and `.isdlc/config/templates/` (user overrides). Override resolution follows the same pattern as contract files (ADR-007 from REQ-0141): user override fully replaces shipped default. Templates are loaded into the SessionStart cache (Claude) alongside contracts. For Codex, templates are loaded by runtime.js alongside contracts.
**Rationale**: Consistent with existing config override pattern. Declarative = inspectable and diffable. No new loading infrastructure needed.
**Consequences**: Template schema must be defined. `rebuild-cache.js` updated to include templates in the session cache. `generate-contracts.js` updated to generate template files.

### ADR-003: Error-Based Enforcement (Throw, Not Return)

**Status**: Accepted
**Context**: The batch evaluator returns violations as data. Callers can ignore the return value. The user wants enforcement that cannot be bypassed.
**Decision**: Check functions throw a `ContractViolationError` on failure. Callers must catch and self-correct. Fail-open wrapping is the caller's responsibility at the outermost boundary only.
**Rationale**: Throwing forces handling. The caller (roundtable protocol, phase-loop) catches, corrects, and retries the operation. This keeps enforcement logic clean and roles separated.
**Consequences**: Callers need try/catch blocks at each check site. The outermost caller (analyze handler, phase-loop controller) wraps everything in fail-open for Article X compliance.

## 3. Technology Decisions

| Technology | Version | Rationale | Alternatives Considered |
|-----------|---------|-----------|------------------------|
| No new dependencies | N/A | All functionality built with Node.js built-ins | N/A |
| JSON for templates | N/A | Consistent with contract files; parseable without YAML dependency | YAML (adds dependency for template parsing in core module) |

## 4. Integration Architecture

### Integration Points

| ID | Source | Target | Interface | Data Format | Error Handling |
|----|--------|--------|-----------|-------------|---------------|
| I-01 | Analyze handler (`isdlc.md`) | `checkDomainTransition(contractData, domain)` | Function call | Contract JSON + String | Throws `ContractViolationError` |
| I-02 | Analyze handler (`isdlc.md`) | `checkBatchWrite(contractData, artifactPaths)` | Function call | Contract JSON + String[] | Throws `ContractViolationError` |
| I-03 | Analyze handler (`isdlc.md`) | `checkPersonaFormat(templateData, output)` | Function call | Template JSON + String | Throws `ContractViolationError` |
| I-04 | Analyze handler (`isdlc.md`) | `checkPersonaContribution(roundtableConfig, contributedPersonas)` | Function call | Config + String[] | Throws `ContractViolationError` |
| I-05 | Phase-loop controller (`isdlc.md`) | `checkDelegation(contractData, phaseKey, agentName)` | Function call | Contract JSON + Strings | Throws `ContractViolationError` |
| I-06 | Phase-loop controller (`isdlc.md`) | `checkArtifacts(contractData, phaseKey, artifactFolder, projectRoot)` | Function call | Contract JSON + Strings | Throws `ContractViolationError` |
| I-07 | Codex runtime (`runtime.js`) | Same functions as I-01 through I-06 | Same | Same | Same |
| I-08 | Discover orchestrator | `checkDelegation()`, `checkArtifacts()` | Same | Same | Same |
| I-09 | SessionStart cache (`rebuild-cache.js`) | Template + contract loading | Build-time | JSON files → cache sections | Fail-open |
| I-10 | Codex runtime (`runtime.js`) | `loadContractEntry()` + template loader | Runtime | JSON files → in-memory | Fail-open |

### Data Flow

```
CLAUDE CODE PATH:
  SessionStart cache (already exists)
    └→ Loads contracts from .claude/hooks/config/contracts/ (existing)
    └→ Loads templates from .claude/hooks/config/templates/ (new)
    └→ Loads roundtable.yaml (existing)
    └→ All injected into <!-- SECTION: ... --> blocks

  Decision Point (e.g., domain transition in analyze handler)
    └→ Extract contract data from session cache (already in context)
    └→ checkDomainTransition(contractData, "architecture")
         └→ Pure function, zero I/O
         └→ Pass: returns void
         └→ Fail: throws ContractViolationError { decision_point, expected, actual }

  Caller (analyze handler)
    └→ try { checkDomainTransition(...) } catch (e) { self-correct; retry }

CODEX PATH:
  runtime.js (already exists)
    └→ loadContractEntry(executionUnit, context) (existing)
    └→ loadTemplates(templateDir) (new, same pattern as loadContractEntry)
    └→ readRoundtableConfig(configPath) (new, reads .isdlc/roundtable.yaml)

  Decision Point (e.g., delegation in codex exec pipeline)
    └→ checkDelegation(contractData, phaseKey, agentName)
         └→ Same pure function as Claude path
         └→ Same error behavior
```

### Synchronization

No concurrency concerns — check functions are stateless and side-effect-free. No shared state across calls.

## 5. Summary

| Metric | Value |
|--------|-------|
| New files | 1 core module (`contract-checks.js`), 3 template configs |
| Modified files | ~10 (contract-evaluator.js cleanup, isdlc.md analyze handler, isdlc.md phase-loop, roundtable-analyst.md, rebuild-cache.js, governance.js, runtime.js, generate-contracts.js, tests) |
| Deleted code | `evaluateContract()` batch function, `STEP 3e-contract` in phase-loop, `formatViolationBanner()` |
| Config files | 4 new templates (requirements.template.json, architecture.template.json, design.template.json, tasks.template.json) |
| Risk level | Medium — touches analyze handler and phase-loop controller, both critical paths |

**Key decisions**:
- Stateless pure functions, not a guard class — reuse existing loading infrastructure
- SessionStart cache for Claude, loadContractEntry for Codex — no new loading layer
- Throw on violation, not return (enforcement)
- JSON templates with override resolution (consistency)
- Same core functions for both Claude and Codex (parity)
