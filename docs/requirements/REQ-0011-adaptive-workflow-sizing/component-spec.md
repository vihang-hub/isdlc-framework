# Component Specifications -- REQ-0011: Adaptive Workflow Sizing

**Version**: 1.0.0
**Phase**: 04-design
**Traces to**: FR-01 through FR-07, NFR-01 through NFR-04

---

## 1. Component Overview

The Adaptive Workflow Sizing feature consists of five components that work together across three layers: utility (common.cjs), configuration (workflows.json), and orchestration (isdlc.md).

```
+-----------------------------------------------------------------+
|                      Component Map                               |
+-----------------------------------------------------------------+
|                                                                   |
|  Orchestration Layer (isdlc.md)                                  |
|    C1: STEP 3e-sizing Block                                      |
|    C2: Feature Command Flag Parser                               |
|                                                                   |
|  Utility Layer (common.cjs)                                      |
|    C3: Sizing Functions Module                                    |
|       - parseSizingFromImpactAnalysis                            |
|       - computeSizingRecommendation                              |
|       - applySizingDecision                                      |
|       - _validateAndNormalizeSizingMetrics (private)             |
|       - _safeNonNegInt (private)                                 |
|       - _checkSizingInvariants (private)                         |
|                                                                   |
|  Configuration Layer (workflows.json)                            |
|    C4: Sizing Configuration Schema                               |
|                                                                   |
|  Compatibility Layer (hooks)                                     |
|    C5: Hook Compatibility Guards                                 |
|       - gate-blocker.cjs (rule rename)                           |
|       - state-write-validator.cjs (field allowlist)              |
|       - workflow-completion-enforcer.cjs (variable phases)       |
|                                                                   |
+-----------------------------------------------------------------+
```

---

## 2. Component C1: STEP 3e-sizing Block

### 2.1 Responsibility
Orchestrates the complete sizing flow within the Phase-Loop Controller. Reads state and configuration, invokes utility functions, presents UX, and writes state.

### 2.2 Dependencies
| Dependency | Type | Direction |
|-----------|------|-----------|
| C3 (Sizing Functions) | Runtime | C1 calls C3 functions |
| C4 (Sizing Config) | Configuration | C1 reads workflows.json |
| state.json | Data store | C1 reads/writes |
| impact-analysis.md | Input artifact | C1 reads |
| TaskList/TaskUpdate | Claude Code API | C1 manages task list |
| AskUserQuestion | Claude Code API | C1 presents menus |

### 2.3 Interface
- **Trigger**: Phase key `02-impact-analysis` completed AND workflow type `feature`
- **Guards**: Sizing not already set, sizing.enabled is true
- **Inputs**: state.json, impact-analysis.md, workflows.json
- **Outputs**: Updated state.json (with sizing record and optionally modified phases)
- **Side Effects**: TaskList updates (skipped phase marking), UX banners to user

### 2.4 Configuration
None -- all configuration is read from C4 (workflows.json).

### 2.5 Reusability
Not reusable -- this is a single-purpose orchestration step embedded in the Phase-Loop Controller markdown specification.

---

## 3. Component C2: Feature Command Flag Parser

### 3.1 Responsibility
Parses the `-light` flag from feature command arguments and propagates it through the orchestrator to `active_workflow.flags`.

### 3.2 Dependencies
| Dependency | Type | Direction |
|-----------|------|-----------|
| Orchestrator | Runtime | C2 passes flags to orchestrator |
| state.json | Data store | Orchestrator writes flags |

### 3.3 Interface
- **Input**: Command arguments string (e.g., `-light "Add helper function"`)
- **Output**: `flags.light: boolean` passed to orchestrator
- **Parse Logic**: Scan args for `-light` token, extract and remove from description

### 3.4 Reusability
The flag parsing pattern can be extended for future flags (e.g., `-epic` if FR-06 is implemented).

---

## 4. Component C3: Sizing Functions Module

### 4.1 Responsibility
Three pure utility functions that encapsulate the deterministic logic for sizing: metric extraction, recommendation computation, and state mutation.

### 4.2 Interface Summary

| Function | Input | Output | Pure | I/O |
|----------|-------|--------|------|-----|
| `parseSizingFromImpactAnalysis(content)` | string | SizingMetrics or null | Yes | No |
| `computeSizingRecommendation(metrics, thresholds)` | SizingMetrics + Thresholds | SizingRecommendation | Yes | No |
| `applySizingDecision(state, intensity, sizingData)` | state + string + object | state (mutated) | No (state mutation) | stderr only |

### 4.3 Dependencies
| Dependency | Type | Direction |
|-----------|------|-----------|
| None (Node.js built-ins only) | Runtime | N/A |
| process.stderr | Diagnostic output | Write-only |

### 4.4 Testability
All three functions are independently testable:
- `parseSizingFromImpactAnalysis`: Input is a string, output is an object or null. Test with fixture strings.
- `computeSizingRecommendation`: Pure function. Exhaustive decision table testing with boundary values.
- `applySizingDecision`: Input is an in-memory state object. Verify mutations. Snapshot rollback testable.

### 4.5 Configuration
None -- thresholds and config are passed as parameters, not read from disk. The caller (C1) is responsible for loading configuration.

### 4.6 Error Handling Strategy
- Never throws exceptions
- Returns safe defaults on invalid input
- Logs diagnostic messages to process.stderr with `[sizing]` prefix
- Performs rollback on invariant failure (applySizingDecision)

---

## 5. Component C4: Sizing Configuration Schema

### 5.1 Responsibility
Stores sizing thresholds, skip-phase lists, and feature options in the workflow configuration file.

### 5.2 Schema

```json
{
  "feature": {
    "sizing": {
      "enabled": true,
      "thresholds": {
        "light_max_files": 5,
        "epic_min_files": 20
      },
      "light_skip_phases": ["03-architecture", "04-design"],
      "risk_override": {
        "high_risk_forces_standard_minimum": true
      }
    },
    "options": {
      "light": {
        "description": "Force lightweight workflow",
        "default": false,
        "flag": "-light"
      }
    }
  }
}
```

### 5.3 Extension Points
- Add new thresholds for future intensity levels
- Add `epic_extra_phases` for future epic decomposition (FR-06)
- Add per-project overrides in monorepo mode

### 5.4 Migration
No migration needed. The schema changes are additive. Missing `sizing` block causes graceful fallback to standard.

---

## 6. Component C5: Hook Compatibility Guards

### 6.1 Responsibility
Ensure existing hooks (gate-blocker, state-write-validator, workflow-completion-enforcer) work correctly with modified phase arrays and new state fields.

### 6.2 Changes Per Hook

#### gate-blocker.cjs
- Rename rule reference: `no_phase_skipping` -> `no_agent_phase_skipping`
- No behavioral change -- continues to validate against `active_workflow.phases`

#### state-write-validator.cjs
- Add `sizing` to known fields for `active_workflow` (if allowlist exists)
- Accept shorter phases arrays (7 instead of 9 for light feature workflows)

#### workflow-completion-enforcer.cjs
- Use `state.active_workflow.phases` as source of truth (not workflow definition)
- Handle variable-length phase arrays in snapshot comparison

### 6.3 Testing Impact
- Existing gate-blocker tests: update rule name in test fixtures
- Add new test cases for light-workflow scenarios (shorter phases arrays)
- Add new test cases for sizing field in state validation

---

## 7. Data Contract: IA Agent -> Sizing Functions

### 7.1 Contract Definition

The Impact Analysis agent (impact-analysis-orchestrator.md) must produce a JSON metadata block at the bottom of impact-analysis.md that satisfies this contract:

```json
{
  "files_directly_affected": "<integer, >= 0>",
  "modules_affected": "<integer, >= 0>",
  "risk_level": "<low | medium | high>",
  "blast_radius": "<low | medium | high>",
  "coverage_gaps": "<integer, >= 0, optional, default 0>"
}
```

### 7.2 Contract Enforcement
- The IA agent specification is updated to make this block required
- `parseSizingFromImpactAnalysis` validates all fields defensively
- Fallback regex parsing provides resilience if the JSON block format changes

### 7.3 Versioning
No versioning mechanism. The contract is backward-compatible:
- Adding new fields to the JSON block does not break parsing (extra fields ignored)
- Removing the JSON block triggers fallback parsing
- Removing all structured data triggers null return -> standard default

---

## 8. Cross-Component Interaction Diagram

```
User
  |
  v
isdlc.md (C2: Flag Parser)
  | flags.light = true/false
  v
Orchestrator
  | stores flags in state.active_workflow.flags
  v
Phase Loop (Phases 00, 01, 02 execute)
  |
  v
isdlc.md (C1: STEP 3e-sizing)
  | reads state.json, impact-analysis.md, workflows.json (C4)
  | calls C3.parseSizingFromImpactAnalysis(content)
  | calls C3.computeSizingRecommendation(metrics, thresholds)
  | presents UX menu (AskUserQuestion)
  | calls C3.applySizingDecision(state, intensity, data)
  | writes state.json
  | updates TaskList
  v
Phase Loop continues (C5: hooks validate against modified state)
  | gate-blocker validates against modified phases array
  | state-write-validator accepts sizing field
  | workflow-completion-enforcer handles shorter phases
  v
Phases 05 (or 03) through 08 execute
```

---

## 9. Traceability Matrix

| Component | Requirement | AC | ADR |
|-----------|-------------|-----|-----|
| C1 (STEP 3e-sizing) | FR-01, FR-03 | AC-01, AC-02, AC-08, AC-09, AC-10, AC-11 | ADR-0001 |
| C2 (Flag Parser) | FR-04 | AC-12, AC-13, AC-14 | ADR-0001 |
| C3 (Sizing Functions) | FR-01, FR-02, FR-05, FR-07 | AC-01, AC-03, AC-04, AC-05, AC-07, AC-15-18, AC-24 | ADR-0002, ADR-0003 |
| C4 (Sizing Config) | FR-02, FR-04 | AC-07, AC-12 | ADR-0004 |
| C5 (Hook Guards) | FR-05, NFR-02 | AC-15 (derived) | ADR-0004 |
