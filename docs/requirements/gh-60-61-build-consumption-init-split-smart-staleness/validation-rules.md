# Validation Rules: Build Consumption -- Init Split & Smart Staleness

**Feature**: GH-60 + GH-61 (Feature B: Build Consumption)
**Artifact Folder**: gh-60-61-build-consumption-init-split-smart-staleness
**Phase**: 04-design
**Status**: Draft
**Created**: 2026-02-20

**Traces**: FR-001 through FR-007, NFR-003, NFR-004

---

## 1. Overview

This document defines input validation rules, business logic constraints, and
data integrity checks for both GH-60 (init-only mode) and GH-61 (smart staleness).

---

## 2. Input Validation: extractFilesFromImpactAnalysis(mdContent)

### VR-EF-001: mdContent Type Guard

| Rule | Detail |
|------|--------|
| ID | VR-EF-001 |
| Input | `mdContent` parameter |
| Validation | Must be a string. null, undefined, empty string, and non-string types (number, object, array, boolean) are accepted gracefully. |
| Action on invalid | Return `[]` (empty array). No throw, no log. |
| FR Trace | FR-005 (AC-005-03) |

### VR-EF-002: Section Header Detection

| Rule | Detail |
|------|--------|
| ID | VR-EF-002 |
| Input | Lines within `mdContent` |
| Validation | At least one line must match `/^#{2,3}\s+.*Directly Affected Files/i` |
| Action on invalid | Return `[]`. The content has no Directly Affected Files section. |
| FR Trace | FR-005 (AC-005-02) |

### VR-EF-003: Table Row Pattern

| Rule | Detail |
|------|--------|
| ID | VR-EF-003 |
| Input | Lines within the Directly Affected Files section |
| Validation | Each line is tested against `/^\|\s*` `` `([^`]+)` `` `\s*\|/`. Only matching lines contribute file paths. |
| Action on non-match | Skip line silently. Table headers, separators, and non-table lines are ignored. |
| FR Trace | FR-005 (AC-005-01) |

### VR-EF-004: Path Normalization

| Rule | Detail |
|------|--------|
| ID | VR-EF-004 |
| Input | Raw file path extracted from table row |
| Validation | Path must not start with `./` or `/` after normalization. |
| Action | Strip leading `./` or `/`. Trim whitespace. |
| FR Trace | FR-005 (AC-005-04) |

### VR-EF-005: Deduplication

| Rule | Detail |
|------|--------|
| ID | VR-EF-005 |
| Input | Accumulated file paths |
| Validation | No duplicate entries in the output array. |
| Action | Use `Set` for collection, convert to array on return. |
| FR Trace | FR-005 (AC-005-04) |

---

## 3. Input Validation: checkBlastRadiusStaleness(meta, currentHash, impactAnalysisContent, changedFiles)

### VR-BR-001: meta Type Guard

| Rule | Detail |
|------|--------|
| ID | VR-BR-001 |
| Input | `meta` parameter |
| Validation | Must be a non-null, non-array object. null, undefined, arrays, and primitives are treated as "no meta". |
| Action on invalid | Return `{ stale: false, severity: 'none', ... }`. No throw. |
| FR Trace | FR-004 (implicit -- same behavior as checkStaleness) |

### VR-BR-002: meta.codebase_hash Presence

| Rule | Detail |
|------|--------|
| ID | VR-BR-002 |
| Input | `meta.codebase_hash` |
| Validation | Must be a truthy string. Falsy values (null, undefined, empty string, 0) mean "no hash to compare". |
| Action on invalid | Return `{ stale: false, severity: 'none', ... }`. |
| FR Trace | FR-004 (implicit -- same behavior as checkStaleness) |

### VR-BR-003: currentHash Type

| Rule | Detail |
|------|--------|
| ID | VR-BR-003 |
| Input | `currentHash` parameter |
| Validation | Expected to be a non-empty string. The function does not validate format (hex, length). |
| Action on invalid | Comparison with `meta.codebase_hash` will produce correct stale=true result. No explicit guard needed. |
| FR Trace | FR-004 (AC-004-01) |

### VR-BR-004: impactAnalysisContent Null/Empty

| Rule | Detail |
|------|--------|
| ID | VR-BR-004 |
| Input | `impactAnalysisContent` parameter |
| Validation | null, undefined, or empty string triggers fallback. Non-string types also trigger fallback (delegated to extractFilesFromImpactAnalysis). |
| Action on invalid | Return `{ severity: 'fallback', fallbackReason: 'no-impact-analysis' }`. |
| FR Trace | FR-004 (AC-004-05), NFR-003 (AC-NFR-003-01) |

### VR-BR-005: changedFiles Type

| Rule | Detail |
|------|--------|
| ID | VR-BR-005 |
| Input | `changedFiles` parameter |
| Validation | Must be either null (triggers git diff) or an Array of strings (testability path). |
| Action on invalid | If not null and not an Array, treat as null (run git diff). |
| FR Trace | NFR-004 (AC-NFR-004-02) |

### VR-BR-006: Overlap Count Thresholds

| Rule | Detail |
|------|--------|
| ID | VR-BR-006 |
| Input | `overlapping.length` (computed internally) |
| Validation | Tier determination: 0 = 'none', 1-3 = 'info', 4+ = 'warning' |
| Boundary values | 0 -> none, 1 -> info, 3 -> info, 4 -> warning |
| FR Trace | FR-004 (AC-004-02, AC-004-03, AC-004-04) |

### VR-BR-007: Git Diff Timeout

| Rule | Detail |
|------|--------|
| ID | VR-BR-007 |
| Input | `execSync` timeout parameter |
| Validation | Timeout set to 5000ms. If exceeded, treated as git failure. |
| Action on timeout | Catch error, return `{ severity: 'fallback', fallbackReason: 'git-diff-failed' }`. |
| FR Trace | NFR-002 (AC-NFR-002-01) |

---

## 4. Input Validation: Orchestrator MODE: init-only

### VR-IO-001: MODE Parameter Value

| Rule | Detail |
|------|--------|
| ID | VR-IO-001 |
| Input | `MODE` in Task prompt |
| Validation | Must be one of: `init-only`, `init-and-phase-01`, `single-phase`, `finalize`, or absent |
| Action on invalid | Orchestrator treats unrecognized MODE as full-workflow mode (backward compatible) |
| FR Trace | FR-001 |

### VR-IO-002: ACTION Parameter Required

| Rule | Detail |
|------|--------|
| ID | VR-IO-002 |
| Input | `ACTION` in Task prompt (for init-only mode) |
| Validation | Must be one of: `feature`, `fix`, `test-run`, `test-generate`, `upgrade` |
| Action on invalid | Error: ERR-INIT-004 |
| FR Trace | FR-001 (AC-001-01) |

### VR-IO-003: DESCRIPTION Parameter Required

| Rule | Detail |
|------|--------|
| ID | VR-IO-003 |
| Input | `DESCRIPTION` in Task prompt (for init-only mode) |
| Validation | Must be a non-empty string |
| Action on invalid | Error: use a default description or prompt user |
| FR Trace | FR-001 (AC-001-01) |

### VR-IO-004: START_PHASE Must Be Valid Phase Key

| Rule | Detail |
|------|--------|
| ID | VR-IO-004 |
| Input | `START_PHASE` in Task prompt (optional) |
| Validation | If provided, must exist in the workflow's phases array |
| Action on invalid | Error: ERR-INIT-005 |
| FR Trace | FR-001 (AC-001-02) |

### VR-IO-005: ARTIFACT_FOLDER Format

| Rule | Detail |
|------|--------|
| ID | VR-IO-005 |
| Input | `ARTIFACT_FOLDER` in Task prompt (optional) |
| Validation | If provided, must be a non-empty string matching existing directory pattern. No counter increment when provided. |
| Action on invalid | Ignore and auto-generate folder (with counter increment) |
| FR Trace | FR-001 (AC-001-02) |

### VR-IO-006: No Active Workflow

| Rule | Detail |
|------|--------|
| ID | VR-IO-006 |
| Input | `state.json` active_workflow |
| Validation | Must be null/absent when init-only runs |
| Action on invalid | Error: ERR-INIT-002 |
| FR Trace | FR-001 (prerequisite) |

### VR-IO-007: Return Format Completeness

| Rule | Detail |
|------|--------|
| ID | VR-IO-007 |
| Input | init-only return JSON |
| Validation | Must contain all 5 fields: `status`, `phases`, `artifact_folder`, `workflow_type`, `next_phase_index` |
| `status` value | Must be `"init_complete"` |
| `next_phase_index` value | Must be `0` |
| `phases` value | Must be a non-empty array of phase keys |
| FR Trace | FR-007 (AC-007-01, AC-007-02, AC-007-03) |

---

## 5. Business Logic Constraints

### BL-001: Phase-Loop Controller Starts at Index 0

| Rule | Detail |
|------|--------|
| ID | BL-001 |
| Constraint | After init-only, the Phase-Loop Controller MUST start from `phases[next_phase_index]` which is `phases[0]` |
| Verification | `next_phase_index === 0` in the init-only return |
| Violation behavior | If next_phase_index > 0, the Phase-Loop would skip phases -- this is only valid for init-and-phase-01 |
| FR Trace | FR-002 (AC-002-01), FR-007 (AC-007-02) |

### BL-002: No Phase Pre-Mark in STEP 2

| Rule | Detail |
|------|--------|
| ID | BL-002 |
| Constraint | STEP 2 MUST NOT mark any phase task as completed before the Phase-Loop Controller runs it |
| Verification | All TaskCreate calls in STEP 2 produce tasks with status "pending" |
| Violation behavior | If Phase 01 is pre-marked as completed, it will never be executed |
| FR Trace | FR-002 (AC-002-04) |

### BL-003: Staleness Severity Determines UX Tier

| Rule | Detail |
|------|--------|
| ID | BL-003 |
| Constraint | isdlc.md Step 4c MUST branch on `severity` field, not on `stale` boolean alone |
| Mapping | 'none' -> silent, 'info' -> note, 'warning' -> menu, 'fallback' -> legacy menu |
| Violation behavior | If only `stale` is checked, all stale results get the same menu (regression) |
| FR Trace | FR-006 (AC-006-01 through AC-006-04) |

### BL-004: Fallback Preserves Existing Behavior

| Rule | Detail |
|------|--------|
| ID | BL-004 |
| Constraint | When severity is 'fallback', Step 4c MUST display the same menu as the current Step 4c (hash-based warning) |
| Verification | Menu options [P]/[Q]/[A] and their handlers are identical to current behavior |
| Violation behavior | Changed menu options or handlers would break backward compatibility |
| FR Trace | FR-006 (AC-006-04), NFR-001, NFR-003 |

### BL-005: init-and-phase-01 Unchanged Behavior

| Rule | Detail |
|------|--------|
| ID | BL-005 |
| Constraint | MODE init-and-phase-01 MUST produce identical behavior to pre-change (plus deprecation notice) |
| Verification | Same return format, same phase execution, same gate validation, same plan generation |
| Violation behavior | Any behavioral change breaks NFR-001 and CON-001 |
| FR Trace | FR-003 (AC-003-01), NFR-001, CON-001 |

### BL-006: init-only Omissions

| Rule | Detail |
|------|--------|
| ID | BL-006 |
| Constraint | MODE init-only MUST NOT perform: phase agent delegation, gate validation, plan generation |
| Verification | No Task tool calls to phase agents. No GATE-* validation. No ORCH-012 invocation. |
| Violation behavior | Executing any of these violates FR-001 AC-001-05 |
| FR Trace | FR-001 (AC-001-05) |

---

## 6. Data Integrity Constraints

### DI-001: state.json Phase Status Consistency

| Rule | Detail |
|------|--------|
| ID | DI-001 |
| Constraint | After init-only, all phase statuses in `active_workflow.phases` MUST be "pending" |
| Current behavior | init-and-phase-01 sets the first phase to "in_progress" then "completed" |
| New behavior | init-only sets all phases to "pending". The Phase-Loop Controller sets "in_progress". |
| FR Trace | FR-001 (AC-001-01), FR-002 (AC-002-04) |

### DI-002: Overlap Array Subset

| Rule | Detail |
|------|--------|
| ID | DI-002 |
| Constraint | `overlappingFiles` MUST be a subset of both `changedFiles` and `blastRadiusFiles` |
| Verification | `overlappingFiles.every(f => changedFiles.includes(f) && blastRadiusFiles.includes(f))` |
| FR Trace | FR-004 (implicit -- intersection definition) |

### DI-003: Severity-Stale Consistency

| Rule | Detail |
|------|--------|
| ID | DI-003 |
| Constraint | `stale` and `severity` must be consistent |
| Rules | severity 'none' -> stale must be false. severity 'info'/'warning'/'fallback' -> stale must be true. |
| Exception | When meta is null or hash is same: stale=false AND severity='none' (early exit) |
| FR Trace | FR-004 |

### DI-004: Counts Match Arrays

| Rule | Detail |
|------|--------|
| ID | DI-004 |
| Constraint | `changedFileCount` must equal the length of the changedFiles array used. `blastRadiusFileCount` must equal the length of the blastRadiusFiles array. |
| FR Trace | FR-004 (data integrity) |

---

## 7. Validation Test Matrix

| Rule ID | Test Case | Expected |
|---------|-----------|----------|
| VR-EF-001 | `extractFilesFromImpactAnalysis(null)` | `[]` |
| VR-EF-001 | `extractFilesFromImpactAnalysis(42)` | `[]` |
| VR-EF-002 | Content with no "Directly Affected" heading | `[]` |
| VR-EF-003 | Table row `\| not-backtick \| MODIFY \|` | Skipped |
| VR-EF-004 | Path `./src/foo.js` | `src/foo.js` |
| VR-EF-005 | Two rows with same path | Single entry in output |
| VR-BR-001 | `checkBlastRadiusStaleness(null, 'abc', content, [])` | `{ stale: false }` |
| VR-BR-002 | `meta = { codebase_hash: '' }` | `{ stale: false }` |
| VR-BR-004 | `impactAnalysisContent = null` | `{ severity: 'fallback' }` |
| VR-BR-005 | `changedFiles = 'not-an-array'` | Treated as null (run git) |
| VR-BR-006 | 3 overlapping files | `severity: 'info'` |
| VR-BR-006 | 4 overlapping files | `severity: 'warning'` |
| VR-IO-007 | init-only return | All 5 fields present, status='init_complete', next_phase_index=0 |
| BL-001 | Phase-Loop after init-only | Loop starts at index 0 |
| BL-002 | STEP 2 task statuses | All pending |
| BL-003 | Step 4c with severity='info' | Display note, no menu |
| DI-003 | severity='none' | stale=false |
| DI-003 | severity='info' | stale=true |

---

## 8. Traceability

| Validation Rule | FR/NFR Trace |
|-----------------|-------------|
| VR-EF-001..005 | FR-005 |
| VR-BR-001..007 | FR-004, NFR-002, NFR-003, NFR-004 |
| VR-IO-001..007 | FR-001, FR-007 |
| BL-001..006 | FR-001, FR-002, FR-003, FR-006, NFR-001 |
| DI-001..004 | FR-001, FR-002, FR-004 |
