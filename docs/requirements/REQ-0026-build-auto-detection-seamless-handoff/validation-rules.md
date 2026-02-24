# Validation Rules: Build Auto-Detection and Seamless Phase 05+ Handoff

**Phase**: 04-design
**Feature ID**: REQ-BUILD-AUTODETECT
**Based On**: requirements-spec.md (FR-001 through FR-008, NFR-004), architecture.md (Sections 3.1-3.3)

---

## 1. Overview

This document defines all input validation rules for the build auto-detection feature. Each rule specifies what is validated, the validation logic, and the behavior when validation fails. All validation follows the graceful-degradation principle: invalid input produces safe defaults, never crashes or blocks the workflow.

---

## 2. Utility Function Validation Rules

### VR-VALIDATE-001: phasesCompleted Input Type

| Attribute | Value |
|-----------|-------|
| **Rule ID** | VR-VALIDATE-001 |
| **Function** | `validatePhasesCompleted(phasesCompleted, fullSequence)` |
| **Field** | `phasesCompleted` |
| **Constraint** | Must be an array |
| **Valid examples** | `[]`, `["00-quick-scan"]`, `["00-quick-scan", "01-requirements"]` |
| **Invalid examples** | `null`, `undefined`, `42`, `"string"`, `{}` |
| **On invalid** | Return `{ valid: [], warnings: ["phases_completed is not an array"] }` |
| **FR Trace** | NFR-004 (AC-NFR-004-03) |

### VR-VALIDATE-002: Phase Key Recognition

| Attribute | Value |
|-----------|-------|
| **Rule ID** | VR-VALIDATE-002 |
| **Function** | `validatePhasesCompleted(phasesCompleted, fullSequence)` |
| **Field** | Each element of `phasesCompleted` |
| **Constraint** | Must be a string present in `ANALYSIS_PHASES` |
| **Valid examples** | `"00-quick-scan"`, `"01-requirements"`, `"04-design"` |
| **Invalid examples** | `"99-future"`, `"unknown"`, `""`, `42`, `null` |
| **On invalid** | Silently filtered out (not included in recognized set). No warning. |
| **FR Trace** | NFR-004 (AC-NFR-004-03) |

### VR-VALIDATE-003: Phase Contiguity

| Attribute | Value |
|-----------|-------|
| **Rule ID** | VR-VALIDATE-003 |
| **Function** | `validatePhasesCompleted(phasesCompleted, fullSequence)` |
| **Field** | Sequence of recognized phases |
| **Constraint** | Recognized phases must form a contiguous prefix of `ANALYSIS_PHASES` |
| **Valid examples** | `["00-quick-scan"]`, `["00-quick-scan", "01-requirements"]`, all 5 in order |
| **Invalid examples** | `["00-quick-scan", "02-impact-analysis"]` (gap at 01), `["01-requirements"]` (missing 00) |
| **On invalid** | Use only the contiguous prefix. Add warning: "Non-contiguous phases detected..." |
| **FR Trace** | FR-003 (AC-003-06) |

### VR-VALIDATE-004: meta Parameter for computeStartPhase

| Attribute | Value |
|-----------|-------|
| **Rule ID** | VR-VALIDATE-004 |
| **Function** | `computeStartPhase(meta, workflowPhases)` |
| **Field** | `meta` |
| **Constraint** | Must be a non-null object or null |
| **Valid examples** | `null`, `{ phases_completed: [...], analysis_status: "partial" }` |
| **Invalid examples** | `42`, `"string"`, `true` |
| **On invalid** | Treat as null (return status `'raw'`, startPhase `null`) |
| **FR Trace** | FR-001 (AC-001-04) |

### VR-VALIDATE-005: workflowPhases Parameter

| Attribute | Value |
|-----------|-------|
| **Rule ID** | VR-VALIDATE-005 |
| **Function** | `computeStartPhase(meta, workflowPhases)` |
| **Field** | `workflowPhases` |
| **Constraint** | Must be a non-empty array of strings |
| **Valid examples** | `["00-quick-scan", "01-requirements", ..., "08-code-review"]` |
| **Invalid examples** | `[]`, `null`, `undefined` |
| **On invalid** | Return status `'raw'`, startPhase `null`, remainingPhases `[]` |
| **FR Trace** | FR-006 |
| **Note** | This is a framework-controlled input (from `workflows.json`). Invalid values indicate a framework bug, not user error. |

### VR-VALIDATE-006: meta Parameter for checkStaleness

| Attribute | Value |
|-----------|-------|
| **Rule ID** | VR-VALIDATE-006 |
| **Function** | `checkStaleness(meta, currentHash)` |
| **Field** | `meta` |
| **Constraint** | Must be a non-null object with optional `codebase_hash` string field, or null |
| **Valid examples** | `null`, `{}`, `{ codebase_hash: "abc1234" }` |
| **Invalid examples** | `42`, `"string"` |
| **On invalid** | Treat as null (return `{ stale: false, originalHash: null }`) |
| **FR Trace** | FR-004 (AC-004-07) |

### VR-VALIDATE-007: currentHash Parameter

| Attribute | Value |
|-----------|-------|
| **Rule ID** | VR-VALIDATE-007 |
| **Function** | `checkStaleness(meta, currentHash)` |
| **Field** | `currentHash` |
| **Constraint** | Must be a string (7-char hex hash expected, but not enforced) |
| **Valid examples** | `"abc1234"`, `"9e304d4"`, `""` |
| **Invalid examples** | `null`, `undefined`, `42` |
| **On invalid** | Treat empty/falsy currentHash as a mismatch if meta has codebase_hash. If both are falsy, return not stale. |
| **FR Trace** | FR-004 |

---

## 3. Orchestrator Validation Rules

### VR-ORCH-001: START_PHASE Value

| Attribute | Value |
|-----------|-------|
| **Rule ID** | VR-ORCH-001 |
| **Function** | Orchestrator `init-and-phase-01` mode |
| **Field** | `START_PHASE` parameter |
| **Constraint** | Must be a phase key present in the workflow's `phases` array from `workflows.json` |
| **Valid examples** | `"05-test-strategy"`, `"02-impact-analysis"`, `"00-quick-scan"` |
| **Invalid examples** | `"99-nonexistent"`, `""`, `"phase05"`, `null` |
| **On invalid** | Log `ERR-ORCH-INVALID-START-PHASE`, fall back to full workflow |
| **FR Trace** | FR-006 (AC-006-03) |

### VR-ORCH-002: ARTIFACT_FOLDER Value

| Attribute | Value |
|-----------|-------|
| **Rule ID** | VR-ORCH-002 |
| **Function** | Orchestrator `init-and-phase-01` mode |
| **Field** | `ARTIFACT_FOLDER` parameter |
| **Constraint** | Must be a non-empty string if present. Should correspond to an existing directory under `docs/requirements/`. |
| **Valid examples** | `"build-auto-detection-seamless-handoff"`, `"REQ-0022-performance-budget-guardrails"` |
| **Invalid examples** | `""`, `null` |
| **On invalid** | Treat as absent (create new folder using standard REQ-NNNN-slug logic) |
| **FR Trace** | FR-007 (AC-007-01 through AC-007-03) |

### VR-ORCH-003: ARTIFACT_FOLDER Directory Existence

| Attribute | Value |
|-----------|-------|
| **Rule ID** | VR-ORCH-003 |
| **Function** | Orchestrator `init-and-phase-01` mode |
| **Field** | Resolved directory path from `ARTIFACT_FOLDER` |
| **Constraint** | Directory should exist at `docs/requirements/{ARTIFACT_FOLDER}/` |
| **On missing** | Create the directory (same as standard new-item behavior) |
| **FR Trace** | FR-007 |
| **Note** | Non-blocking. Missing directory is not an error -- it is created automatically. |

---

## 4. Build Verb Handler Validation Rules

### VR-BUILD-001: Git Availability

| Attribute | Value |
|-----------|-------|
| **Rule ID** | VR-BUILD-001 |
| **Scope** | Build verb handler step 4b |
| **Constraint** | `git rev-parse --short HEAD` must succeed |
| **On failure** | Skip staleness check entirely. Log warning (ERR-BUILD-004). |
| **FR Trace** | FR-004 (AC-004-07), NFR-004 (AC-NFR-004-02) |

### VR-BUILD-002: Git Rev-List Availability

| Attribute | Value |
|-----------|-------|
| **Rule ID** | VR-BUILD-002 |
| **Scope** | Build verb handler step 4b (after staleness detected) |
| **Constraint** | `git rev-list --count {hash}..HEAD` must succeed |
| **On failure** | Show staleness warning without commit count. Set `commitsBehind = null`. |
| **FR Trace** | FR-004 |

### VR-BUILD-003: User Menu Response

| Attribute | Value |
|-----------|-------|
| **Rule ID** | VR-BUILD-003 |
| **Scope** | Build verb handler steps 4c (staleness) and 4d (partial analysis) |
| **Constraint** | User must select a valid menu option |
| **Valid responses** | Staleness: P, Q, A. Partial: R, S, F. |
| **On invalid** | Re-prompt the user. If interaction fails entirely, use fail-safe default (staleness: [P] Proceed, partial: [R] Resume). |
| **FR Trace** | FR-003, FR-004 |

### VR-BUILD-004: Build Confirmation Response

| Attribute | Value |
|-----------|-------|
| **Rule ID** | VR-BUILD-004 |
| **Scope** | Build verb handler step 4e (BUILD SUMMARY confirmation) |
| **Constraint** | User must confirm with Y (or Enter for default) |
| **On decline** | Abort build gracefully. Display: "Build cancelled." |
| **FR Trace** | FR-005 |

---

## 5. Meta.json Schema Validation (Additive Fields)

### VR-META-001: build_started_at Field

| Attribute | Value |
|-----------|-------|
| **Rule ID** | VR-META-001 |
| **Location** | `meta.json` |
| **Field** | `build_started_at` |
| **Type** | string (ISO-8601 timestamp) |
| **Required** | No (additive, written by orchestrator) |
| **Default** | Absent (not present until build starts) |
| **FR Trace** | FR-008 (AC-008-01) |

### VR-META-002: workflow_type Field

| Attribute | Value |
|-----------|-------|
| **Rule ID** | VR-META-002 |
| **Location** | `meta.json` |
| **Field** | `workflow_type` |
| **Type** | string (`"feature"` or `"fix"`) |
| **Required** | No (additive, written by orchestrator) |
| **Default** | Absent (not present until build starts) |
| **FR Trace** | FR-008 (AC-008-01) |

### VR-META-003: build_completed_at Field

| Attribute | Value |
|-----------|-------|
| **Rule ID** | VR-META-003 |
| **Location** | `meta.json` |
| **Field** | `build_completed_at` |
| **Type** | string (ISO-8601 timestamp) |
| **Required** | No (additive, written by orchestrator on finalize) |
| **Default** | Absent (not present until build completes) |
| **FR Trace** | FR-008 (AC-008-02) |

---

## 6. Validation Summary Matrix

| Rule ID | Function/Scope | Field | Fail Behavior | Severity |
|---------|---------------|-------|---------------|----------|
| VR-VALIDATE-001 | validatePhasesCompleted | phasesCompleted type | Return empty valid + warning | Safe default |
| VR-VALIDATE-002 | validatePhasesCompleted | Phase key values | Filter unknown silently | Safe default |
| VR-VALIDATE-003 | validatePhasesCompleted | Phase contiguity | Use prefix + warning | Safe default |
| VR-VALIDATE-004 | computeStartPhase | meta type | Return raw | Safe default |
| VR-VALIDATE-005 | computeStartPhase | workflowPhases | Return raw | Safe default |
| VR-VALIDATE-006 | checkStaleness | meta type | Return not stale | Safe default |
| VR-VALIDATE-007 | checkStaleness | currentHash type | Compare as-is | Safe default |
| VR-ORCH-001 | Orchestrator | START_PHASE | Fall back to full workflow | Error + fallback |
| VR-ORCH-002 | Orchestrator | ARTIFACT_FOLDER | Treat as absent | Safe default |
| VR-ORCH-003 | Orchestrator | ARTIFACT_FOLDER dir | Create directory | Non-blocking |
| VR-BUILD-001 | Build handler | Git availability | Skip staleness | Warning |
| VR-BUILD-002 | Build handler | Git rev-list | Omit count | Warning |
| VR-BUILD-003 | Build handler | Menu response | Re-prompt or default | Safe default |
| VR-BUILD-004 | Build handler | Confirmation | Abort build | User action |
| VR-META-001 | meta.json | build_started_at | -- | Additive field |
| VR-META-002 | meta.json | workflow_type | -- | Additive field |
| VR-META-003 | meta.json | build_completed_at | -- | Additive field |
