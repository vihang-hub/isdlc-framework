# Requirements Specification: Execution Contract System

**Slug**: REQ-0141-phase-work-guard-hook
**Source**: GitHub Issue #118
**Type**: Enhancement
**Version**: 1.0.0

---

## 1. Business Context

The iSDLC framework lacks a unified mechanism to ensure predictable, deterministic execution across all contexts — workflows, analyze, discover, add. Each context involves a set of expected behaviors (agents engaged, skills used, artifacts produced, state updated, cleanup performed) but none of this is consistently observed or enforced. The framework has ~28 hooks that each check one narrow concern in isolation, with no unified contract declaring "for context X, these things MUST happen."

**Problem Statement**: Whatever the user has configured (custom skills for discover, specific personas for analyze, workflow definitions for build) should be faithfully executed — and the framework should be able to prove it did. Today, configuration declares intent but execution is on the honor system.

**Stakeholders**:
- **Framework developers**: Need deterministic execution to debug failures and verify behavior
- **Framework users**: Need confidence that their configurations are honored
- **Orchestrator (runtime)**: Needs structured violation reports to drive remediation

**Success Metrics**:
- Every workflow phase and non-workflow context has a pre-defined contract
- Contract violations are detected, reported to the orchestrator, and remediated
- Works identically across Claude and Codex providers

**Driving Factors**:
- Root cause discovered 2026-03-10 when #102 build session skipped orchestrator engagement entirely
- Conversational-compliance hook (REQ-0140) was the first behavioral enforcement attempt but is scoped to roundtable format only
- Codex provider has documented enforcement gaps in `governance.js` — contract system closes them

---

## 2. Stakeholders and Personas

### Framework Developer
- **Role**: Builds and maintains the iSDLC harness
- **Goals**: Deterministic execution, debuggable violations, cross-provider parity
- **Pain Points**: Hooks enforce fragments, no unified view of what should happen vs what did happen

### Framework User
- **Role**: Configures and uses iSDLC in their projects
- **Goals**: Custom skills, personas, and workflows execute as configured
- **Pain Points**: No feedback when configuration is silently ignored

---

## 3. User Journeys

### Journey 1: Workflow Execution with Contract Enforcement
- **Entry**: User starts a feature workflow via `/isdlc build`
- **Flow**: Phase-loop controller reads pre-generated contract for each phase → phase agent executes → contract evaluator checks actual vs expected → violations reported to orchestrator → orchestrator remediates (re-invoke, escalate)
- **Exit**: All phases complete with contract compliance verified

### Journey 2: Analyze with Custom Personas
- **Entry**: User configures custom personas in `roundtable.yaml` and runs `/isdlc analyze`
- **Flow**: Contract reflects configured personas → roundtable executes → evaluator checks all configured personas contributed → violation if a persona was silent
- **Exit**: Analysis complete with persona participation verified

### Journey 3: Config Change Triggers Contract Regeneration
- **Entry**: User adds a new external skill via `/isdlc skill add`
- **Flow**: Config change detected → framework regenerates affected contracts → new skill appears in discover/workflow contracts
- **Exit**: Next execution enforces the new skill

---

## 4. Technical Context

### Existing Infrastructure
- `PHASE_AGENT_MAP` in `.claude/hooks/lib/common.cjs:2503` — 20 phase-to-agent mappings
- `skill_usage_log` — append-only delegation audit trail
- `pending_escalations` — hook → orchestrator feedback channel (cap: 20, dedup, FIFO)
- `gate-logic.cjs` — 5 gate checks at phase exit
- `artifact-paths.json` — required artifacts per phase (single authority)
- `iteration-requirements.json` — per-phase gate requirements
- `skills-manifest.json` — skill-to-agent ownership mapping
- `external-skills-manifest.json` — user-added skills with phase bindings
- `roundtable.yaml` — persona and topic configuration
- `governance.js` (Codex) — documents 3 enforceable checkpoints and 5 gaps
- `validate-phase.js` (core) — Codex checkpoint validation surface

### Constraints
- Must work across Claude (hook-based) and Codex (checkpoint-based) providers
- Contract evaluation must not add more than 2 seconds to phase transitions
- Must follow fail-open principle (Article X) — evaluation errors must not block execution
- Contracts follow existing config override pattern: `.claude/hooks/config/` (shipped) + `.isdlc/config/` (user override)

### Integration Points
- Phase-loop controller (`isdlc.md` STEP 3e) — Claude enforcement point
- `validatePhaseGate()` / `validate-phase.js` — Codex enforcement point
- `projectInstructions()` in `projection.js` — Codex instruction injection
- `common.cjs` — state helpers, `PHASE_AGENT_MAP` (must be exported as stable API)
- `lib/installer.js` — initial state schema (`contract_violations: []`)

---

## 5. Quality Attributes and Risks

| Quality Attribute | Priority | Threshold |
|---|---|---|
| Cross-provider parity | Critical | Same contract schema, same violation reporting for Claude and Codex |
| Evaluation performance | High | < 2 seconds per phase transition |
| Fail-open safety | Critical | Evaluation errors never block execution (Article X) |
| Configuration honoring | High | 100% of user-configured skills/personas appear in generated contracts |
| Determinism | Critical | Same config always produces same contract (no runtime variance) |

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `hooks_must_fire` unverifiable without instrumentation | High | Medium | Deferred — not included in v1 schema. Add when hook audit records exist |
| Contract staleness after config change | Medium | Medium | Hash-based detection at load time (declared input files only) |
| `PHASE_AGENT_MAP` not exported as stable API | Low | High | Explicitly export before generator depends on it |
| Artifact authority drift between `artifact-paths.json` and `iteration-requirements.json` | Medium | Medium | Contract reads from `artifact-paths.json` only — single authority |
| Evaluation overhead on Codex (no hook parallelism) | Low | Medium | Evaluator is pure function — < 50ms for path resolution + state assertions |

---

## 6. Functional Requirements

### FR-001: Execution Contract Schema
**Confidence**: High

A JSON schema defining the expected execution for every context (workflow phase, analyze, discover, add). Each entry declares: agent expected, skills required, artifacts produced, state assertions, cleanup activities, and violation response.

- **AC-001-01**: Given a contract file, When parsed, Then each entry has fields: `execution_unit`, `context`, `expectations`, `violation_response`
- **AC-001-02**: Given an `expectations` block, When validated, Then it contains: `agent` (string), `skills_required` ($ref), `artifacts_produced` ($ref), `state_assertions` (array of `{path, equals}`), `cleanup` (array of strings)
- **AC-001-03**: Given a `violation_response` block, When validated, Then each key maps to one of: `"block"`, `"warn"`, `"report"`
- **AC-001-04**: Given a non-workflow context (analyze, discover, add), When its contract is loaded, Then the `execution_unit` field reads naturally (e.g., `"roundtable"`, `"discover"`, `"add-item"`)
- **AC-001-05**: Given a `$ref` in expectations, When resolved, Then the evaluator uses a single `resolveRef(ref, configs)` function — no ad-hoc token parsing

### FR-002: Contract Generation
**Confidence**: High

Pre-generated contracts compiled from existing config surfaces. Generated once on config change, not at runtime. Built-in workflow contracts ship with the framework.

- **AC-002-01**: Given a CLI command `node bin/generate-contracts.js`, When run, Then contracts are generated for all built-in workflow/context combinations and written to `.claude/hooks/config/contracts/`
- **AC-002-02**: Given a user config change (external-skills-manifest, roundtable.yaml, custom workflow), When the user runs contract generation, Then contracts in `.isdlc/config/contracts/` reflect the user's configuration
- **AC-002-03**: Given the same configuration inputs, When generation runs twice, Then the output is byte-identical (deterministic)
- **AC-002-04**: Given a generated contract file, When inspected, Then it contains `_generation_metadata` with `generated_at`, `input_files: [{ path, hash }]`, `generator_version`
- **AC-002-05**: Given the generator, When it reads agent-to-phase mappings, Then it imports `PHASE_AGENT_MAP` from `.claude/hooks/lib/common.cjs` (exported as stable API)
- **AC-002-06**: Given the generator, When it reads artifact expectations, Then `artifact-paths.json` is the single authority — `iteration-requirements.json` artifact data is ignored

### FR-003: Contract Evaluation
**Confidence**: High

A runtime evaluator that reads the pre-generated contract and checks actual execution against it. Runs post-phase for workflows and post-completion for non-workflow contexts.

- **AC-003-01**: Given a completed phase in a Claude workflow, When STEP 3e post-phase update runs, Then the contract evaluator checks actual execution against the contract for that `execution_unit` + `context`
- **AC-003-02**: Given a completed phase in a Codex workflow, When `validatePhaseGate()` runs, Then the same contract evaluator logic checks the same contract
- **AC-003-03**: Given the evaluator, When it checks `agent` expectation, Then it reads `skill_usage_log` for a delegation matching the expected agent in the current phase
- **AC-003-04**: Given the evaluator, When it checks `skills_required`, Then it resolves the `$ref` and checks `skill_usage_log` for matching skill entries
- **AC-003-05**: Given the evaluator, When it checks `artifacts_produced`, Then it resolves the `$ref` to file paths and checks disk for existence
- **AC-003-06**: Given the evaluator, When it checks `state_assertions`, Then it reads each `{path, equals}` from state.json using a generic JSON path resolver
- **AC-003-07**: Given the evaluator, When evaluation errors occur (malformed contract, missing config), Then it returns empty violations and logs a warning (fail-open, Article X)
- **AC-003-08**: Given the evaluator, When it runs, Then total evaluation time is under 2 seconds

### FR-004: Violation Reporting
**Confidence**: High

Structured violation reporting to the orchestrator via `contract_violations[]` in state.json.

- **AC-004-01**: Given a violation detected, When `writeContractViolation(state, entry)` is called, Then the entry is appended to `state.contract_violations[]` with dedup and FIFO cap of 20
- **AC-004-02**: Given a violation entry, When written, Then it contains: `contract_id`, `execution_unit`, `expected`, `actual`, `severity`, `configured_response`
- **AC-004-03**: Given `writeContractViolation`, When implemented, Then it is a pure in-memory mutator (caller persists) — consistent with newer helper pattern
- **AC-004-04**: Given `readContractViolations(state)` and `clearContractViolations(state)`, When implemented, Then they follow the same in-memory mutator pattern
- **AC-004-05**: Given the initial state schema in `lib/installer.js`, When a new project is installed, Then `contract_violations: []` is included in the initial state

### FR-005: Orchestrator Remediation
**Confidence**: High

The orchestrator reads violation reports and invokes appropriate remediation based on the contract's configured response.

- **AC-005-01**: Given `contract_violations[]` is non-empty after a phase, When the phase-loop controller reads it (STEP 3e), Then it dispatches remediation based on `configured_response`
- **AC-005-02**: Given `configured_response: "block"`, When the orchestrator processes it, Then it re-invokes the same agent with guidance about what was missed, or escalates to user after retry limit
- **AC-005-03**: Given `configured_response: "warn"`, When the orchestrator processes it, Then it displays a visible notification and continues to the next phase
- **AC-005-04**: Given `configured_response: "report"`, When the orchestrator processes it, Then it logs the violation and the orchestrator decides (may continue, may re-invoke)
- **AC-005-05**: Given remediation completes, When violations are resolved, Then `clearContractViolations(state)` is called

### FR-006: Config Change Detection
**Confidence**: High

Stale contract detection via generation-time hashes of declared input files.

- **AC-006-01**: Given a contract loaded at runtime, When the evaluator starts, Then it re-hashes only the files listed in `_generation_metadata.input_files[]`
- **AC-006-02**: Given a hash mismatch, When detected, Then a warning is emitted: "Contract stale — config changed since generation. Run `node bin/generate-contracts.js` to update."
- **AC-006-03**: Given a stale contract, When enforcement continues, Then execution is NOT blocked (fail-open, Article X)
- **AC-006-04**: Given the hash check, When it runs, Then it completes in under 100ms (hashing a small set of declared files)

### FR-007: Non-Workflow Coverage
**Confidence**: High

Contracts for add, analyze, discover, upgrade, test-generate — not just workflow phases.

- **AC-007-01**: Given an `/isdlc add` command, When a contract exists for `execution_unit: "add-item"`, Then the evaluator checks: folder created, draft.md written, meta.json written, BACKLOG.md updated
- **AC-007-02**: Given an `/isdlc analyze` command, When a contract exists for `execution_unit: "roundtable"`, Then the evaluator checks: all configured personas contributed, all topics covered, artifacts written
- **AC-007-03**: Given a `/discover` command, When a contract exists for `execution_unit: "discover"`, Then the evaluator checks: all bound external skills were injected
- **AC-007-04**: Given analyze contracts, When the user changes `roundtable.yaml` personas, Then regenerated contracts reflect the new persona set

### FR-008: Configurable Violation Response
**Confidence**: High

Violation response (block/warn/report) is configurable per contract entry.

- **AC-008-01**: Given a contract entry, When `violation_response` is defined, Then each expectation type has its own response level
- **AC-008-02**: Given default contracts, When shipped, Then defaults are: `agent_not_engaged: "block"`, `artifacts_missing: "block"`, `skills_missing: "report"`, `state_incomplete: "report"`, `cleanup_skipped: "warn"`
- **AC-008-03**: Given a user override contract in `.isdlc/config/contracts/`, When loaded, Then it overrides the shipped default for the same `execution_unit` + `context`

### FR-009: UX and Presentation Contract
**Confidence**: High

The execution contract captures not just what executes but how execution is presented to the user — confirmation formats, violation banners, progress indicators, and output structure. These are part of the deterministic experience.

- **AC-009-01**: Given an `expectations` block, When it includes a `presentation` section, Then the evaluator checks that the expected UX elements were produced (e.g., bulleted format, domain-grouped confirmations, sequential Accept/Amend prompts)
- **AC-009-02**: Given a roundtable contract, When the `presentation` section declares `confirmation_sequence: ["requirements", "architecture", "design"]`, Then the evaluator verifies all three domains were presented sequentially with explicit user acceptance
- **AC-009-03**: Given a violation detected, When reported to the user, Then it follows a standard banner format consistent across all contexts:
  ```
  CONTRACT VIOLATION: {execution_unit}
    Expected: {expectation description}
    Actual: {what happened}
    Response: {block|warn|report}
  ```
- **AC-009-04**: Given a phase completion in a workflow, When the contract includes `presentation.progress_format`, Then the evaluator checks that progress was displayed in the expected format (e.g., task list with sequential numbering, strikethrough on completion)
- **AC-009-05**: Given the analyze context, When the contract declares `presentation.persona_format: "bulleted"`, Then the evaluator checks that persona output followed the bulleted template (domain label, 2-4 bullets, single question)
- **AC-009-06**: Given a non-workflow context (add, discover), When the contract includes `presentation.completion_summary`, Then the evaluator checks that a structured completion message was produced

---

## 7. Out of Scope

| Item | Reason | Dependency |
|---|---|---|
| `hooks_must_fire` contract field | No hook audit record infrastructure — needs instrumentation support | #123 event-sourced state or hook-event-log |
| Migrating existing hooks to contract entries | Additive layer first — migration is a separate effort | This feature (contracts must be stable first) |
| Artifact overlap cleanup in `iteration-requirements.json` | Separate tech debt — contract uses `artifact-paths.json` as single authority | None |
| Real-time mid-phase enforcement for Codex | Codex has no PreToolUse/PostToolUse surface — checkpoint-based only | Codex platform changes |
| `cleanup` structured schema | Currently string descriptions — codify when cleanup activities are formalized | None |

---

## 8. MoSCoW Prioritization

| FR | Title | Priority | Rationale |
|---|---|---|---|
| FR-001 | Execution Contract Schema | Must Have | Foundation — everything else depends on the schema |
| FR-002 | Contract Generation | Must Have | Without generation, no contracts exist to evaluate |
| FR-003 | Contract Evaluation | Must Have | Core enforcement — the evaluator is the product |
| FR-004 | Violation Reporting | Must Have | Without reporting, violations are invisible |
| FR-005 | Orchestrator Remediation | Must Have | Closed-loop — violations must drive action |
| FR-006 | Config Change Detection | Should Have | Safety net — prevents running against stale contracts |
| FR-007 | Non-Workflow Coverage | Must Have | User's explicit requirement — not just workflow phases |
| FR-008 | Configurable Violation Response | Should Have | Flexibility — but sensible defaults cover most cases |
| FR-009 | UX and Presentation Contract | Must Have | Determinism includes how things are presented, not just what executes |

---

## Pending Sections

*(none — all sections written)*
