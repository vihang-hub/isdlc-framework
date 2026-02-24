# Requirements Specification: Gate Requirements Pre-Injection

**REQ ID:** REQ-0024
**Artifact Folder:** REQ-0024-gate-requirements-pre-injection
**Status:** Draft
**Created:** 2026-02-18
**Workflow:** Feature

---

## 1. Project Overview

### 1.1 Problem Statement

When the phase-loop controller (isdlc.md STEP 3d) delegates to a phase agent, it injects artifact folder, phase key, workflow modifiers, discovery context, and skill index into the delegation prompt -- but NOT the gate pass criteria. Phase agents discover what they need to pass only when hooks block them (gate-blocker, iteration-corridor, constitution-validator, test-watcher). This reactive discovery causes retries, wastes iterations against the circuit-breaker threshold, and degrades overall workflow efficiency.

### 1.2 Proposed Solution

At delegation time, the phase-loop controller reads existing configuration files and injects a structured GATE REQUIREMENTS block into the agent's delegation prompt. This block tells the agent upfront:

- Which iteration requirements are enabled (test_iteration, constitutional_validation, artifact_validation, etc.)
- Max iterations and circuit-breaker thresholds
- Coverage thresholds and success criteria
- Required constitutional articles (resolved from IDs to human-readable titles)
- Required artifact paths (with template variables resolved)
- Workflow-specific overrides (merged from workflows.json)

### 1.3 Goals and Success Metrics

| Metric | Target |
|--------|--------|
| First-pass gate success rate | Increase (agents have upfront visibility) |
| Retry iterations per phase | Decrease (agents plan to meet criteria on first attempt) |
| Hook enforcement regressions | Zero (hooks remain as safety nets, unchanged) |
| Existing workflow compatibility | 100% (injection is additive, never breaking) |

### 1.4 Business Context

- **Why now:** The framework is being actively dogfooded. Every wasted retry iteration counts against the circuit-breaker threshold (default: 3 consecutive failures). Agents that exhaust their iteration budget without producing useful work degrade developer experience.
- **Impact:** Framework-internal enhancement. No end-user-facing changes. Improves agent efficiency and developer experience during SDLC workflows.

---

## 2. Stakeholders and Consumers

This feature has no human end-users. All consumers are framework components:

| Consumer | Role | How They Use It |
|----------|------|-----------------|
| Phase agents (18 agents) | Primary | Read the GATE REQUIREMENTS block from their delegation prompt to plan work that satisfies all gate criteria on the first attempt |
| Phase-loop controller (isdlc.md STEP 3d) | Integration point | Calls the utility function and appends the resulting block to the delegation prompt |
| Framework developers | Indirect beneficiary | Experience fewer retries, faster workflow completion, and more predictable agent behavior |

---

## 3. Functional Requirements

### FR-01: Configuration Reading Utility

**ID:** REQ-0024-FR-01
**Priority:** Must Have

The system SHALL provide a utility function that reads gate requirements configuration for a given phase key and workflow type from the following data sources:

1. `src/claude/hooks/config/iteration-requirements.json` -- per-phase iteration, constitutional, artifact, and ATDD validation configs
2. `src/claude/hooks/config/artifact-paths.json` -- required artifact file paths per phase
3. `docs/isdlc/constitution.md` -- constitutional article headers (for ID-to-title mapping)

**Input parameters:**
- `phaseKey` (string, required) -- e.g., `"06-implementation"`, `"01-requirements"`
- `artifactFolder` (string, required) -- e.g., `"REQ-0024-gate-requirements-pre-injection"`
- `workflowType` (string, optional) -- e.g., `"feature"`, `"fix"`. Used for workflow-specific overrides.
- `projectRoot` (string, optional) -- defaults to CWD. The root directory containing `.isdlc/` and `docs/`.

**Acceptance Criteria:**

- AC-01-01: Given a valid phase key that exists in iteration-requirements.json, when the utility is called, then it returns an object containing the phase's iteration requirements configuration.
- AC-01-02: Given a valid phase key that exists in artifact-paths.json, when the utility is called, then it returns the required artifact paths for that phase.
- AC-01-03: Given a phase key with constitutional_validation enabled and articles listed, when the utility is called, then it reads constitution.md and maps each article ID (e.g., "I", "IV") to its title (e.g., "Specification Primacy", "Explicit Over Implicit").
- AC-01-04: Given a phase key that does NOT exist in iteration-requirements.json, when the utility is called, then it returns an empty/default configuration (fail-open, no error thrown).
- AC-01-05: Given iteration-requirements.json is missing or unreadable, when the utility is called, then it returns an empty string (fail-open, no error thrown).
- AC-01-06: Given artifact-paths.json is missing or unreadable, when the utility is called, then it proceeds without artifact path data (fail-open).
- AC-01-07: Given constitution.md is missing or unreadable, when the utility is called, then it uses raw article IDs instead of titles (graceful degradation).

---

### FR-02: Template Variable Resolution

**ID:** REQ-0024-FR-02
**Priority:** Must Have

The utility SHALL resolve template variables in artifact paths before including them in the output block.

**Supported template variables:**

| Variable | Resolved To | Source |
|----------|-------------|--------|
| `{artifact_folder}` | The artifact folder name | `artifactFolder` input parameter |

**Acceptance Criteria:**

- AC-02-01: Given an artifact path `"docs/requirements/{artifact_folder}/requirements-spec.md"` and artifact folder `"REQ-0024-gate-requirements-pre-injection"`, when the utility resolves templates, then the path becomes `"docs/requirements/REQ-0024-gate-requirements-pre-injection/requirements-spec.md"`.
- AC-02-02: Given an artifact path with no template variables, when the utility resolves templates, then the path is returned unchanged.
- AC-02-03: Given an artifact path with an unrecognized template variable (e.g., `{unknown}`), when the utility resolves templates, then the unrecognized variable is left as-is (not removed, not erroring).

---

### FR-03: Constitutional Article ID to Title Mapping

**ID:** REQ-0024-FR-03
**Priority:** Must Have

The utility SHALL read `docs/isdlc/constitution.md` and extract article headers to map Roman numeral IDs to human-readable titles.

**Mapping source:** Lines matching the pattern `### Article {ID}: {Title}` in constitution.md.

**Expected mappings (current constitution v1.2.0):**

| ID | Title |
|----|-------|
| I | Specification Primacy |
| II | Test-First Development |
| III | Security by Design |
| IV | Explicit Over Implicit |
| V | Simplicity First |
| VI | Code Review Required |
| VII | Artifact Traceability |
| VIII | Documentation Currency |
| IX | Quality Gate Integrity |
| X | Fail-Safe Defaults |
| XI | Integration Testing Integrity |
| XII | Cross-Platform Compatibility |
| XIII | Module System Consistency |
| XIV | State Management Integrity |

**Acceptance Criteria:**

- AC-03-01: Given constitution.md contains `### Article VII: Artifact Traceability`, when the utility maps article ID "VII", then it returns "Article VII: Artifact Traceability".
- AC-03-02: Given a phase requires articles ["I", "IV", "VII", "IX", "XII"], when the utility maps all IDs, then it returns all five titles in order.
- AC-03-03: Given an article ID that does not exist in constitution.md (e.g., "XV"), when the utility maps it, then it returns the raw ID with a fallback format (e.g., "Article XV (unknown)").
- AC-03-04: Given constitution.md is missing, when the utility attempts to map articles, then it returns raw IDs for all articles (e.g., "Article I", "Article IV") without throwing an error.

---

### FR-04: Workflow-Specific Override Merging

**ID:** REQ-0024-FR-04
**Priority:** Should Have

The utility SHALL read `.isdlc/config/workflows.json` and merge workflow-specific overrides for the current phase when a `workflowType` is provided.

**Merge behavior:** Workflow-specific `agent_modifiers[phase_key]` are included as supplementary context in the output block. They do NOT override the base iteration-requirements configuration -- they provide additional workflow context (e.g., `scope`, `artifact_prefix`, ATDD mode flags).

**Acceptance Criteria:**

- AC-04-01: Given workflow type "feature" and phase key "01-requirements", when the utility reads workflows.json, then it includes the agent_modifiers `{"scope": "feature", "artifact_prefix": "REQ", "read_quick_scan": true}` in the output.
- AC-04-02: Given workflow type "feature" and phase key "06-implementation" with `_when_atdd_mode` modifiers, when the utility reads workflows.json, then it includes the ATDD modifiers as conditional context.
- AC-04-03: Given workflows.json is missing or unreadable, when the utility attempts to read overrides, then it proceeds without overrides (fail-open).
- AC-04-04: Given a workflow type that does not exist in workflows.json, when the utility attempts to read overrides, then it proceeds without overrides (fail-open).
- AC-04-05: Given a phase key with no agent_modifiers entry in the workflow definition, when the utility reads overrides, then it proceeds without phase-specific overrides.

---

### FR-05: Formatted GATE REQUIREMENTS Text Block Output

**ID:** REQ-0024-FR-05
**Priority:** Must Have

The utility SHALL produce a formatted text block suitable for injection into a phase agent's delegation prompt.

**Output format:**

```
GATE REQUIREMENTS (Phase: {phase_key}):
  Iteration Requirements:
    - test_iteration: {enabled|disabled}
      {if enabled: max_iterations: N, circuit_breaker: N, coverage: N%}
    - constitutional_validation: {enabled|disabled}
      {if enabled: max_iterations: N, articles: [list with titles]}
    - artifact_validation: {enabled|disabled}
      {if enabled: required paths: [resolved list]}
    - interactive_elicitation: {enabled|disabled}
      {if enabled: min_menu_interactions: N}
    - atdd_validation: {enabled|disabled}
      {if enabled: requires: [list]}
  Required Artifacts:
    - {resolved path 1}
    - {resolved path 2}
  Constitutional Articles:
    - Article {ID}: {Title}
    - Article {ID}: {Title}
  Workflow Overrides:
    {JSON or key-value of agent_modifiers if present}
```

**Acceptance Criteria:**

- AC-05-01: Given phase "06-implementation" with test_iteration enabled (max_iterations: 10, circuit_breaker: 3, coverage: 80%), when the utility formats the block, then the output includes `test_iteration: enabled` with all sub-parameters listed.
- AC-05-02: Given phase "01-requirements" with test_iteration disabled, when the utility formats the block, then the output includes `test_iteration: disabled` with no sub-parameters.
- AC-05-03: Given phase "01-requirements" with constitutional articles ["I", "IV", "VII", "IX", "XII"], when the utility formats the block, then the Constitutional Articles section lists all five articles with resolved titles.
- AC-05-04: Given phase "03-architecture" with artifact path `"docs/requirements/{artifact_folder}/architecture-overview.md"` and artifact folder `"REQ-0024-gate-requirements-pre-injection"`, when the utility formats the block, then Required Artifacts shows the fully resolved path.
- AC-05-05: Given a phase with no iteration requirements enabled, when the utility formats the block, then it still produces a valid block with all sections showing "disabled" or empty lists.
- AC-05-06: Given the utility returns an empty string (due to fail-open), when the caller receives the result, then the result is a zero-length string (not null, not undefined).

---

### FR-06: Integration into STEP 3d of isdlc.md

**ID:** REQ-0024-FR-06
**Priority:** Must Have

The phase-loop controller in `src/claude/commands/isdlc.md` STEP 3d SHALL call the utility function and append the resulting GATE REQUIREMENTS block to the delegation prompt.

**Integration point:** After the existing injection blocks (workflow modifiers, discovery context, skill index, external skill injection) and before the final `Validate GATE-{NN} on completion.` line.

**Acceptance Criteria:**

- AC-06-01: Given STEP 3d constructs a delegation prompt for phase "06-implementation" with artifact folder "REQ-0024-gate-requirements-pre-injection", when the controller calls the utility, then the GATE REQUIREMENTS block is appended to the prompt after existing blocks.
- AC-06-02: Given the utility returns an empty string (fail-open scenario), when the controller appends the result, then the delegation prompt is unchanged from its current format (no empty block, no extra whitespace).
- AC-06-03: Given the GATE REQUIREMENTS block is present in the delegation prompt, when a phase agent reads the prompt, then the agent can parse and use the gate criteria to plan its work.
- AC-06-04: The integration SHALL NOT modify any existing prompt content -- it only appends the new block.
- AC-06-05: The integration instruction in isdlc.md SHALL follow the same pattern as existing injection blocks (fail-open, documented inline, uses utility function).

---

## 4. Non-Functional Requirements

### NFR-01: Fail-Open on Any Error

**ID:** REQ-0024-NFR-01
**Category:** Reliability
**Priority:** Must Have
**Metric:** The utility MUST return an empty string ("") on any error -- missing files, parse errors, malformed JSON, missing fields, file permission errors. It MUST NOT throw exceptions that propagate to the caller.
**Measurement:** Unit tests verify empty string return for every error scenario (missing file, invalid JSON, empty file, missing phase key, missing fields).

### NFR-02: Performance

**ID:** REQ-0024-NFR-02
**Category:** Performance
**Priority:** Should Have
**Metric:** Block generation MUST complete in under 100ms for any phase configuration. The utility uses synchronous file reads (fs.readFileSync) consistent with the CJS hooks pattern.
**Measurement:** Timing assertions in unit tests measuring execution duration.

### NFR-03: Single Source of Truth

**ID:** REQ-0024-NFR-03
**Category:** Maintainability
**Priority:** Must Have
**Metric:** The utility MUST read from the exact same configuration files that hooks read at enforcement time: `iteration-requirements.json` (v2.1.0+), `artifact-paths.json` (v1.0.0+), and `constitution.md`. No duplicate or derived config files.
**Measurement:** Code review confirms file paths match those used by gate-blocker.cjs, iteration-corridor.cjs, and constitution-validator.cjs.

### NFR-04: Backward Compatibility

**ID:** REQ-0024-NFR-04
**Category:** Compatibility
**Priority:** Must Have
**Metric:** Existing delegation prompts MUST remain unchanged when the utility is not available or returns empty. The GATE REQUIREMENTS block is appended additively -- it never replaces or modifies existing prompt content (workflow modifiers, discovery context, skill index, external skills).
**Measurement:** Integration tests verify prompt structure with and without the GATE REQUIREMENTS block.

### NFR-05: Module System Consistency

**ID:** REQ-0024-NFR-05
**Category:** Maintainability
**Priority:** Must Have
**Metric:** The utility MUST be a CommonJS module (.cjs extension) placed in `src/claude/hooks/lib/` to match the existing hooks library convention. It MUST use `module.exports` and `require()`, not ESM `import`/`export`.
**Measurement:** File extension check and static analysis of module syntax.

---

## 5. Constraints

| ID | Constraint | Rationale |
|----|-----------|-----------|
| CON-001 | Utility must be CJS (.cjs) in `src/claude/hooks/lib/` | Matches existing hooks library convention (Article XIII: Module System Consistency) |
| CON-002 | Must use synchronous file I/O (fs.readFileSync) | Hooks/lib modules are synchronous CJS; async would break the call pattern |
| CON-003 | No new configuration file formats | Data sources already exist; this feature reads them, does not create new ones |
| CON-004 | Hooks remain the enforcement mechanism | Injection is informational only; hooks still block on failures |
| CON-005 | Template variables limited to `{artifact_folder}` initially | Other variables ({phase_key}, etc.) can be added in future iterations |

---

## 6. Assumptions

| ID | Assumption | Impact if Wrong |
|----|-----------|-----------------|
| ASM-001 | `iteration-requirements.json` schema remains stable (v2.1.0) | Utility may return incomplete data; fail-open prevents breakage |
| ASM-002 | `artifact-paths.json` schema remains stable (v1.0.0) | Utility may miss required artifact paths; fail-open prevents breakage |
| ASM-003 | Constitution article headers follow `### Article {ID}: {Title}` format | Article ID-to-title mapping may fail; falls back to raw IDs |
| ASM-004 | Phase agents can parse the GATE REQUIREMENTS block from their prompt | If agents ignore the block, behavior reverts to status quo (no regression) |
| ASM-005 | `workflows.json` path is `.isdlc/config/workflows.json` | Override merging would skip; fail-open prevents breakage |

---

## 7. Out of Scope

| Item | Rationale |
|------|-----------|
| Changes to hook enforcement behavior | Hooks remain as safety nets -- they still block if agents fail to meet criteria |
| New configuration file formats | All data sources already exist |
| UI or user-facing changes | Framework-internal enhancement only |
| Agent-side parsing logic | Agents are expected to read and understand the block via natural language; no structured parsing API needed |
| Monorepo-specific path resolution | Can be added in a follow-up; initial implementation uses single-project paths |
| ATDD-specific injection details | ATDD validation is included in the block when enabled, but no special ATDD-only formatting is added |

---

## 8. Data Sources Reference

| Source File | Schema Version | What It Provides |
|-------------|---------------|------------------|
| `src/claude/hooks/config/iteration-requirements.json` | 2.1.0 | Per-phase requirements: test_iteration, constitutional_validation, artifact_validation, interactive_elicitation, atdd_validation, agent_delegation_validation |
| `src/claude/hooks/config/artifact-paths.json` | 1.0.0 | Required artifact file paths per phase, with `{artifact_folder}` template variables |
| `docs/isdlc/constitution.md` | 1.2.0 | 14 constitutional articles with Roman numeral IDs and titles |
| `.isdlc/config/workflows.json` | 1.0.0 | Workflow definitions with `agent_modifiers` per phase |

---

## 9. Glossary

| Term | Definition |
|------|-----------|
| Gate | A quality checkpoint between SDLC phases. Enforced by hooks (gate-blocker, iteration-corridor, constitution-validator, test-watcher). |
| Phase agent | A specialized Claude agent that executes work for a single SDLC phase (e.g., requirements-analyst, software-developer). |
| Phase-loop controller | The logic in isdlc.md (STEP 3a-3e) that iterates through workflow phases and delegates to agents. |
| Delegation prompt | The text passed to a phase agent via the Task tool, containing context, instructions, and (now) gate requirements. |
| Fail-open | Error handling strategy where failures result in graceful degradation (empty output) rather than blocking the workflow. |
| Circuit-breaker threshold | Maximum consecutive failures before the iteration-corridor hook permanently blocks a phase (default: 3). |
| Template variable | A placeholder in a string (e.g., `{artifact_folder}`) that is resolved to a concrete value at runtime. |
| Iteration requirements | The set of validation checks (test, constitutional, artifact, etc.) that a phase agent must satisfy before passing its gate. |

---

## 10. Traceability

| Requirement | User Story | Priority |
|-------------|-----------|----------|
| REQ-0024-FR-01 | US-001 | Must Have |
| REQ-0024-FR-02 | US-001, US-002 | Must Have |
| REQ-0024-FR-03 | US-001, US-003 | Must Have |
| REQ-0024-FR-04 | US-004 | Should Have |
| REQ-0024-FR-05 | US-001, US-002, US-003 | Must Have |
| REQ-0024-FR-06 | US-005 | Must Have |
| REQ-0024-NFR-01 | US-001 (cross-cutting) | Must Have |
| REQ-0024-NFR-02 | US-001 (cross-cutting) | Should Have |
| REQ-0024-NFR-03 | US-001 (cross-cutting) | Must Have |
| REQ-0024-NFR-04 | US-005 (cross-cutting) | Must Have |
| REQ-0024-NFR-05 | US-001 (cross-cutting) | Must Have |
