# Requirements Specification: Inline Contract Enforcement

**REQ-GH-213** | Source: GitHub Issue #213 | Status: Accepted

---

## 1. Business Context

The execution contract system (REQ-0141) checks contract compliance after a phase completes — post-hoc. Violations (skipped roundtable domains, ignored tool preferences, wrong format, missing persona contributions) are only reported after the damage is done, forcing expensive full-phase retries. Agents consistently deviate from protocol instructions in CLAUDE.md and agent markdown files despite explicit documentation.

**Problem**: Post-phase evaluation cannot prevent violations, only report them. Instructions in CLAUDE.md, AGENTS.md, and memory are not followed consistently. Format varies between runs (numbered vs table, assumptions grouped vs inline). Personas don't always contribute. Artifacts get written before confirmation.

**Success metric**: Zero protocol deviations in roundtable analysis and discover workflows — the contract catches and errors on every deviation at the decision point where it occurs.

## 2. Stakeholders and Personas

**Primary user**: Framework developer (dogfooding) who has repeatedly corrected the same behavioral deviations across multiple sessions.

**Pain points**:
- Assumptions not surfaced at confirmation gates despite being required
- MCP tools skipped in favor of Grep/Glob/Read despite explicit instructions
- Artifacts written before user confirmation, then rewritten after
- Persona participation inconsistent — Alex and Jordan don't always contribute
- Presentation format changes between analysis runs (numbered vs table, assumptions batched vs inline)

## 3. User Journeys

**Happy path**: User runs `/isdlc analyze`. Contract loads into memory at session start. At each decision point (domain transition, batch write, persona output), the guard checks the contract. If a deviation is detected, the guard errors and the agent/orchestrator self-corrects immediately. User sees consistent, compliant output every time.

**Error path**: Contract file is missing or malformed. Guard fails open (Article X) — analysis proceeds without enforcement. Error is logged internally.

## 4. Technical Context

**Existing system**: REQ-0141 built `contract-evaluator.js` (batch evaluator), `contract-loader.js`, `contract-schema.js`, `contract-ref-resolver.js` in `src/core/validators/`. Contracts are JSON files in `src/claude/hooks/config/contracts/` (shipped) and `.isdlc/config/contracts/` (user overrides). The analyze contract (`analyze.contract.json`) already declares `confirmation_sequence`, `persona_format`, and `completion_summary`.

**Codex path**: `governance.js` documents the execution-contract checkpoint as enforceable via `core-contract-evaluator`. `runtime.js:validatePhaseGate()` calls `evaluateContract()` directly.

**Constraints**:
- Hooks are CJS (`src/claude/hooks/`), core modules are ESM (`src/core/`)
- Codex has no PreToolUse hooks — enforcement is in the codex exec pipeline
- Roundtable config is in `.isdlc/roundtable.yaml` (personas are user-configurable, not static)

## 5. Quality Attributes and Risks

| Attribute | Priority | Threshold |
|-----------|----------|-----------|
| Performance | Must Have | <50ms per inline check (in-memory, no file I/O per check) |
| Reliability | Must Have | Fail-open on all errors (Article X) |
| Consistency | Must Have | Same format and behavior across all analysis runs |
| Extensibility | Should Have | New decision points addable without schema changes |

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| In-memory cache becomes stale mid-session | Low | Medium | Contract files rarely change mid-session; reload on explicit trigger only |
| Inline checks slow conversation flow | Medium | High | <50ms budget enforced; all checks operate on in-memory objects |
| Agent ignores error and continues anyway | Medium | High | Error is thrown, not returned — caller must handle or propagate |
| Codex pipeline wiring diverges from Claude | Medium | Medium | Shared core module; provider-specific wiring tested with parity tests |

## 6. Functional Requirements

### FR-001: In-Memory Contract Guard
**Confidence**: High

Load the contract into memory once at session/phase start. All point-query checks run against the in-memory representation — no file I/O per check.

- **AC-001-01**: Given a valid contract file exists, when a session or phase starts, then the contract is loaded into memory and cached for the duration of the session
- **AC-001-02**: Given the contract is cached in memory, when a point-query check is called, then no file I/O occurs — the check operates on the cached object
- **AC-001-03**: Given the contract file is missing or malformed, when loading is attempted, then the guard returns a no-op (fail-open, Article X) and logs a warning
- **AC-001-04**: Given the contract is cached, when a decision point is checked, then the guard returns pass or throws an error — no warnings-only mode

*Assumption: The contract loader already reads from disk. We add a caching layer that holds the parsed contract in memory. The query function operates on the cached object.*

### FR-002: Roundtable Enforcement Points
**Confidence**: High

Wire inline contract checks at 4 roundtable decision points. Persona checks read from the active roundtable configuration (`.isdlc/roundtable.yaml`), not a hardcoded list.

- **AC-002-01**: Given the roundtable is transitioning between confirmation domains, when the next domain is about to be presented, then the guard checks that the expected domain matches the contract's `confirmation_sequence` and errors if not
- **AC-002-02**: Given the roundtable is about to execute a batch write, when the write set is assembled, then the guard checks that all expected artifacts are present in the write set and errors if any are missing
- **AC-002-03**: Given a persona is producing output, when the output is being composed, then the guard checks that the format matches the active presentation template and errors if it deviates
- **AC-002-04**: Given the roundtable is about to advance past a topic, when coverage is being evaluated, then the guard checks that all configured personas (from `roundtable.yaml`) have contributed and errors if any are silent
- **AC-002-05**: Given the user has customized `roundtable.yaml` with different personas, when the guard checks persona contribution, then it uses the configured persona list — not a hardcoded set

*Assumption: These checks run inside the roundtable conversation loop in `isdlc.md` (analyze handler) and the discover orchestrator, not as external hooks.*

### FR-003: Phase-Loop Enforcement Points
**Confidence**: High

Wire inline contract checks at 2 phase-loop decision points.

- **AC-003-01**: Given a phase agent is about to be delegated to, when the delegation prompt is being constructed, then the guard checks that the correct agent is mapped for this phase and errors if not
- **AC-003-02**: Given a phase is about to signal completion, when the phase agent returns, then the guard checks that all required artifacts exist on disk and errors if any are missing

*Assumption: The existing delegation-gate and gate-blocker hooks partially cover these. FR-003 replaces their contract-related logic with inline checks, but those hooks remain for their non-contract duties.*

### FR-004: Presentation Templates
**Confidence**: High

Define configurable templates for each confirmation domain specifying format rules. Ship defaults, allow user overrides.

- **AC-004-01**: Given a default template exists for each confirmation domain (requirements, architecture, design, tasks), when no user override is present, then the default template is used for format validation
- **AC-004-02**: Given a user has placed a template override in `.isdlc/config/templates/`, when the guard loads templates, then the user override takes precedence over the shipped default
- **AC-004-03**: Given a template specifies section order, format type (bullets/table/numbered), and assumption placement (inline per-FR or batched), when persona output is validated, then all template rules are checked
- **AC-004-04**: Given a template is missing or malformed, when loading is attempted, then the guard falls back to the shipped default (fail-open)

- **AC-004-05**: Given a tasks template exists, when the task list is presented for confirmation, then it must include all required task categories (test design, implementation setup, core implementation, unit tests, wiring per provider, cleanup, quality loop, code review) as defined by the template
- **AC-004-06**: Given a tasks template specifies required task metadata, when each task is validated, then it must include traces (FR/AC references), files (with CREATE/MODIFY), and dependency annotations (blocked_by/blocks)

*Assumption: Templates are declarative (JSON/YAML), not executable. The contract checks output structure against template, not content quality.*

### FR-005: Remove Post-Phase Evaluator
**Confidence**: High

Delete the `STEP 3e-contract` call in the phase-loop controller and the batch `evaluateContract()` function. Inline enforcement is the sole mechanism.

- **AC-005-01**: Given the inline enforcement is wired at all decision points, when a phase completes, then no post-phase contract evaluation occurs
- **AC-005-02**: Given the `evaluateContract()` batch function exists, when this feature ships, then the function is removed from `contract-evaluator.js`
- **AC-005-03**: Given the Codex `validatePhaseGate()` calls `evaluateContract()`, when this feature ships, then the Codex path is updated to use the inline guard instead
- **AC-005-04**: Given existing tests reference `evaluateContract()`, when this feature ships, then tests are updated to test the inline guard API

*Assumption: The contract-evaluator.js module is refactored (query API replaces batch), not deleted entirely. The module name may stay but the export surface changes.*

### FR-006: Discover Phase Coverage
**Confidence**: High

Extend contract enforcement to the discover workflow.

- **AC-006-01**: Given a discover workflow is active, when sub-agents are delegated to, then the inline guard checks the contract for correct agent mapping
- **AC-006-02**: Given a discover workflow is active, when artifact production is expected, then the inline guard checks that required artifacts exist before advancing
- **AC-006-03**: Given a discover contract exists (`discover.contract.json`), when the discover orchestrator starts, then the contract is loaded into memory

*Assumption: Discover contracts already exist. This wires inline checks into the discover orchestrator, same pattern as FR-002/FR-003.*

### FR-007: Dual-Provider Support
**Confidence**: High

Inline enforcement must work for both Claude Code and Codex.

- **AC-007-01**: Given the inline guard is a core module in `src/core/`, when Claude Code invokes it, then it works via the analyze handler and phase-loop controller
- **AC-007-02**: Given the inline guard is a core module in `src/core/`, when Codex invokes it, then it works via `runtime.js` and the codex exec pipeline
- **AC-007-03**: Given `governance.js` documents the execution-contract checkpoint, when the inline guard replaces the batch evaluator, then `governance.js` is updated to reference the new API
- **AC-007-04**: Given both providers share the same core guard module, when a contract check is performed, then the result is identical regardless of provider

*Assumption: Codex enforcement uses the same contract schema and query API. The wiring differs (Codex has no PreToolUse hooks — enforcement is in the codex exec pipeline).*

## 7. Out of Scope

| Item | Reason | Dependency |
|------|--------|------------|
| Tool-usage enforcement (Grep/Glob → MCP) | Split to #214 as separate PreToolUse hook | None |
| Content quality validation | Checks format/structure, not content quality | N/A |
| Runtime skill usage tracking | Already handled by skill-validator hook | N/A |
| New contract schema fields | Existing schema is sufficient for inline checks | N/A |

## 8. MoSCoW Prioritization

| FR | Title | Priority | Rationale |
|----|-------|----------|-----------|
| FR-001 | In-Memory Contract Guard | Must Have | Foundation — all other FRs depend on the query API |
| FR-002 | Roundtable Enforcement Points | Must Have | Primary pain point — roundtable violations are most frequent |
| FR-003 | Phase-Loop Enforcement Points | Must Have | Phase-loop consistency |
| FR-004 | Presentation Templates | Must Have | Required by FR-002c — format checking needs a template to check against |
| FR-005 | Remove Post-Phase Evaluator | Must Have | Cleanup — post-phase evaluator creates confusion alongside inline |
| FR-006 | Discover Phase Coverage | Must Have | Discover runs same patterns as analyze |
| FR-007 | Dual-Provider Support | Must Have | Both Claude Code and Codex must have working inline enforcement |
