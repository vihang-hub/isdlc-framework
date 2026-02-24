# Error Taxonomy: Roundtable Analysis Agent

**Feature ID**: REQ-ROUNDTABLE-ANALYST (GH-20)
**Phase**: 04-design
**Date**: 2026-02-19
**Traces**: FR-004, FR-005, FR-009, FR-012

---

## 1. Overview

This document catalogs all error conditions that can occur during roundtable analysis agent operation. Each error is assigned a unique code, severity level, user-visible message, and recovery strategy.

### Severity Levels

| Level | Meaning | Impact |
|-------|---------|--------|
| **FATAL** | Cannot proceed; analysis session terminates | Session ends, user must restart |
| **ERROR** | Significant problem; specific operation fails but session continues | Current step or phase may be incomplete |
| **WARNING** | Non-critical issue; operation degrades but continues | Minor quality reduction, fully recoverable |
| **INFO** | Notable condition; no negative impact | Logged for observability |

---

## 2. Agent Discovery Errors

### ERR-RT-001: Roundtable Agent File Not Found

| Property | Value |
|----------|-------|
| **Code** | ERR-RT-001 |
| **Severity** | INFO |
| **Condition** | `src/claude/agents/roundtable-analyst.md` does not exist when isdlc.md step 7 checks |
| **Message** | (No user-visible message -- silent fallback) |
| **Recovery** | Automatic: isdlc.md falls back to standard phase agent delegation. Existing behavior preserved. |
| **Traces** | FR-009 AC-009-04, NFR-005 AC-NFR-005-01 |

### ERR-RT-002: Roundtable Agent File Corrupt

| Property | Value |
|----------|-------|
| **Code** | ERR-RT-002 |
| **Severity** | ERROR |
| **Condition** | `roundtable-analyst.md` exists but has invalid YAML frontmatter (missing `name` field, malformed YAML) |
| **Message** | "Warning: Roundtable agent file has invalid format. Falling back to standard analysis agents." |
| **Recovery** | Automatic: isdlc.md falls back to standard phase agent delegation. The existence check succeeds but the Task tool delegation may fail, triggering fallback. |
| **Traces** | FR-009 AC-009-04 |

---

## 3. Step File Errors

### ERR-STEP-001: Step Directory Not Found

| Property | Value |
|----------|-------|
| **Code** | ERR-STEP-001 |
| **Severity** | INFO |
| **Condition** | `src/claude/skills/analysis-steps/{phase_key}/` directory does not exist |
| **Message** | "No step files found for phase {phase_key}. Completing phase without interactive steps." |
| **Recovery** | Automatic: phase treated as complete with no steps. Roundtable agent returns to isdlc.md. Phase is added to phases_completed by isdlc.md. |
| **Traces** | Component-interactions Section 7.2 |

### ERR-STEP-002: Step Directory Empty

| Property | Value |
|----------|-------|
| **Code** | ERR-STEP-002 |
| **Severity** | INFO |
| **Condition** | `src/claude/skills/analysis-steps/{phase_key}/` exists but contains no `.md` files |
| **Message** | "No step files found for phase {phase_key}. Completing phase without interactive steps." |
| **Recovery** | Same as ERR-STEP-001. |
| **Traces** | Component-interactions Section 7.2 |

### ERR-STEP-003: Step File Unreadable

| Property | Value |
|----------|-------|
| **Code** | ERR-STEP-003 |
| **Severity** | WARNING |
| **Condition** | A step file exists but cannot be read (permissions, encoding error) |
| **Message** | "Warning: Step file {filename} could not be read. Skipping." |
| **Recovery** | Automatic: skip this step. Do NOT add step_id to steps_completed. Continue to next step. The skipped step will be retried on next session. |
| **Traces** | Component-interactions Section 7.1 |

### ERR-STEP-004: Invalid YAML Frontmatter

| Property | Value |
|----------|-------|
| **Code** | ERR-STEP-004 |
| **Severity** | WARNING |
| **Condition** | Step file has malformed YAML between `---` delimiters (syntax error, missing delimiters) |
| **Message** | "Warning: Step file {filename} has invalid frontmatter. Skipping." |
| **Recovery** | Automatic: skip this step. Do NOT add step_id to steps_completed. Continue to next step. The skipped step will be retried on next session (if the file is fixed). |
| **Traces** | Component-interactions Section 7.1, FR-012 |

### ERR-STEP-005: Missing Required Frontmatter Field

| Property | Value |
|----------|-------|
| **Code** | ERR-STEP-005 |
| **Severity** | WARNING |
| **Condition** | Step file YAML frontmatter is parseable but is missing a required field (`step_id`, `title`, `persona`, `depth`, or `outputs`) |
| **Message** | "Warning: Step file {filename} is missing required field '{field_name}'. Skipping." |
| **Recovery** | Same as ERR-STEP-004. |
| **Traces** | FR-012 AC-012-01 |

### ERR-STEP-006: Invalid Frontmatter Field Value

| Property | Value |
|----------|-------|
| **Code** | ERR-STEP-006 |
| **Severity** | WARNING |
| **Condition** | A frontmatter field has an invalid value: `persona` not in allowed set, `depth` not in allowed set, `outputs` is empty or not an array |
| **Message** | "Warning: Step file {filename} has invalid value for '{field_name}': '{value}'. Skipping." |
| **Recovery** | Same as ERR-STEP-004. |
| **Traces** | FR-012 AC-012-01 |

### ERR-STEP-007: Missing Body Section for Active Depth

| Property | Value |
|----------|-------|
| **Code** | ERR-STEP-007 |
| **Severity** | INFO |
| **Condition** | The selected depth section (e.g., `## Brief Mode`) is missing from the step file body |
| **Message** | (No user-visible message -- silent fallback to ## Standard Mode) |
| **Recovery** | Automatic: fall back to `## Standard Mode`. If that is also missing, use entire body content. |
| **Traces** | Module-design-step-files Section 3.6 |

### ERR-STEP-008: Unresolved Step Dependency

| Property | Value |
|----------|-------|
| **Code** | ERR-STEP-008 |
| **Severity** | WARNING |
| **Condition** | Step has `depends_on` containing a step_id not in `steps_completed` |
| **Message** | "Warning: Step {step_id} depends on {dep_id} which is not complete. Skipping for now." |
| **Recovery** | Automatic: skip this step. Do NOT add to steps_completed. On next session, if the dependency is satisfied, the step will execute. |
| **Traces** | FR-012 AC-012-02, module-design-step-files Section 7 |

### ERR-STEP-009: skip_if Evaluation Error

| Property | Value |
|----------|-------|
| **Code** | ERR-STEP-009 |
| **Severity** | WARNING |
| **Condition** | The `skip_if` expression cannot be evaluated (syntax error, undefined variable) |
| **Message** | "Warning: Step {step_id} has an invalid skip_if condition: '{expression}'. Executing step normally." |
| **Recovery** | Automatic: treat as non-skippable (execute the step). The expression is re-evaluated on next session -- if fixed, it will work. |
| **Traces** | FR-012 AC-012-02 |

---

## 4. Meta.json Errors

### ERR-META-001: Meta.json Not Found

| Property | Value |
|----------|-------|
| **Code** | ERR-META-001 |
| **Severity** | INFO |
| **Condition** | `readMetaJson(slugDir)` returns null because meta.json does not exist in the artifact folder |
| **Message** | (No user-visible message from roundtable agent -- isdlc.md handles this in step 4 by creating a default meta.json) |
| **Recovery** | Handled by isdlc.md: create default meta.json with `analysis_status: "raw"`, `phases_completed: []`, `steps_completed: []`, `depth_overrides: {}`. |
| **Traces** | isdlc.md step 4 |

### ERR-META-002: Meta.json Corrupt

| Property | Value |
|----------|-------|
| **Code** | ERR-META-002 |
| **Severity** | ERROR |
| **Condition** | `readMetaJson(slugDir)` returns null because meta.json contains invalid JSON |
| **Message** | "Warning: meta.json is corrupt. Starting analysis from the beginning." |
| **Recovery** | Handled by isdlc.md: create fresh default meta.json. All previous progress is lost. Artifacts on disk are still present but not tracked. |
| **Traces** | three-verb-utils.cjs line 210, architecture-overview Section 14 |

### ERR-META-003: Meta.json Write Failure

| Property | Value |
|----------|-------|
| **Code** | ERR-META-003 |
| **Severity** | ERROR |
| **Condition** | `writeMetaJson(slugDir, meta)` throws an error (disk full, permissions, path invalid) |
| **Message** | "Warning: Failed to save progress to meta.json. Your artifacts were updated, but the session may not resume correctly from this point." |
| **Recovery** | Log error. Continue to next step (do not abort session). Artifact files may have been written successfully. On next session resume, the step that failed to persist will re-execute (this is safe because artifact updates are idempotent). |
| **Traces** | Component-interactions Section 7.3, NFR-003 AC-NFR-003-02 |

### ERR-META-004: Invalid steps_completed Type

| Property | Value |
|----------|-------|
| **Code** | ERR-META-004 |
| **Severity** | INFO |
| **Condition** | meta.json contains `steps_completed` that is not an array (e.g., string, number, null) |
| **Message** | (No user-visible message -- silent correction) |
| **Recovery** | Automatic: `readMetaJson()` defaults to `[]`. Previous step progress is lost but analysis can continue from step 1. |
| **Traces** | three-verb-utils.cjs readMetaJson(), test case 5 |

### ERR-META-005: Invalid depth_overrides Type

| Property | Value |
|----------|-------|
| **Code** | ERR-META-005 |
| **Severity** | INFO |
| **Condition** | meta.json contains `depth_overrides` that is not a plain object (e.g., array, null, string) |
| **Message** | (No user-visible message -- silent correction) |
| **Recovery** | Automatic: `readMetaJson()` defaults to `{}`. Depth will be re-determined from quick-scan data. |
| **Traces** | three-verb-utils.cjs readMetaJson(), test cases 6-7 |

---

## 5. Artifact Errors

### ERR-ART-001: Artifact Folder Missing

| Property | Value |
|----------|-------|
| **Code** | ERR-ART-001 |
| **Severity** | WARNING |
| **Condition** | Roundtable agent attempts to write an artifact but the artifact folder (`docs/requirements/{slug}/`) does not exist |
| **Message** | (No user-visible message -- silent creation) |
| **Recovery** | Automatic: create the folder (mkdir -p equivalent) before writing the artifact. This should not normally occur because isdlc.md creates the folder during the add verb. |
| **Traces** | Component-interactions Section 7.4 |

### ERR-ART-002: Artifact Write Failure

| Property | Value |
|----------|-------|
| **Code** | ERR-ART-002 |
| **Severity** | ERROR |
| **Condition** | Write tool fails to write an artifact file (disk full, permissions) |
| **Message** | "Warning: Failed to write {artifact_name}. The analysis will continue, but this artifact may be incomplete." |
| **Recovery** | Log error. Continue step execution. The artifact may need manual creation or re-running of the step. |
| **Traces** | FR-010 |

### ERR-ART-003: Artifact Read Failure During Update

| Property | Value |
|----------|-------|
| **Code** | ERR-ART-003 |
| **Severity** | WARNING |
| **Condition** | Roundtable agent attempts to read an existing artifact for incremental update but the file is unreadable |
| **Message** | "Warning: Could not read existing {artifact_name}. Creating a fresh version." |
| **Recovery** | Automatic: create the artifact from scratch instead of updating. Some prior content may be lost, but the step produces a complete artifact section. |
| **Traces** | FR-010 |

---

## 6. Persona Errors

### ERR-PERSONA-001: Unknown Phase Key

| Property | Value |
|----------|-------|
| **Code** | ERR-PERSONA-001 |
| **Severity** | WARNING |
| **Condition** | The `phase_key` from the Task delegation prompt does not match any entry in the Phase-to-Persona Mapping table |
| **Message** | "Note: Unknown phase key '{phase_key}'. I'll lead this phase as Maya Chen (Business Analyst)." |
| **Recovery** | Automatic: fall back to Business Analyst persona (Maya Chen). Analysis continues with the fallback persona. |
| **Traces** | FR-003 AC-003-06 |

### ERR-PERSONA-002: Step File Persona Mismatch

| Property | Value |
|----------|-------|
| **Code** | ERR-PERSONA-002 |
| **Severity** | INFO |
| **Condition** | A step file's `persona` frontmatter field does not match the active persona for the current phase (e.g., a step in `01-requirements/` has `persona: "solutions-architect"`) |
| **Message** | (No user-visible message -- the step executes with the persona specified in the step file) |
| **Recovery** | The step file's persona takes precedence over the phase mapping. This allows for cross-persona steps within a phase (future extensibility). The agent switches communication style for this step and switches back for the next step. |
| **Traces** | NFR-004 (extensibility) |

---

## 7. Adaptive Depth Errors

### ERR-DEPTH-001: Quick-Scan Data Unavailable

| Property | Value |
|----------|-------|
| **Code** | ERR-DEPTH-001 |
| **Severity** | INFO |
| **Condition** | DEPTH CONTEXT in Task prompt has `quick_scan_scope: "unknown"` (Phase 00 not yet completed or quick-scan.md not parseable) |
| **Message** | (No user-visible message -- silent default) |
| **Recovery** | Automatic: default to "standard" depth. |
| **Traces** | FR-006 AC-006-07 |

### ERR-DEPTH-002: Invalid Depth Override Value

| Property | Value |
|----------|-------|
| **Code** | ERR-DEPTH-002 |
| **Severity** | INFO |
| **Condition** | `depth_overrides[phase_key]` contains a value other than "brief", "standard", or "deep" |
| **Message** | (No user-visible message -- silent correction) |
| **Recovery** | Automatic: ignore the invalid override, fall through to quick-scan mapping or default. |
| **Traces** | FR-006 |

---

## 8. Integration Errors

### ERR-INT-001: Task Tool Delegation Failure

| Property | Value |
|----------|-------|
| **Code** | ERR-INT-001 |
| **Severity** | FATAL |
| **Condition** | The Task tool invocation for the roundtable agent fails (agent not loadable, context limit exceeded, runtime error) |
| **Message** | "Analysis could not proceed: the roundtable agent encountered an error. Falling back to standard analysis." |
| **Recovery** | isdlc.md retries with the standard phase agent for the current phase. If the standard agent also fails, the phase is skipped with a user warning. |
| **Traces** | FR-009 AC-009-04 |

### ERR-INT-002: Phase Boundary Inconsistency

| Property | Value |
|----------|-------|
| **Code** | ERR-INT-002 |
| **Severity** | WARNING |
| **Condition** | After the roundtable agent returns, meta.json `steps_completed` contains step_ids that do not belong to the current phase (e.g., phase 02 step_ids in a Phase 01 delegation) |
| **Message** | (No user-visible message -- extra step_ids are harmless) |
| **Recovery** | Automatic: no action. Extra step_ids in `steps_completed` do not break anything. They may indicate a logic error in the agent but have no functional impact. |
| **Traces** | NFR-005 |

---

## 9. Error Code Summary

| Code | Severity | Category | Short Description |
|------|----------|----------|-------------------|
| ERR-RT-001 | INFO | Agent Discovery | Roundtable agent file not found |
| ERR-RT-002 | ERROR | Agent Discovery | Roundtable agent file corrupt |
| ERR-STEP-001 | INFO | Step Files | Step directory not found |
| ERR-STEP-002 | INFO | Step Files | Step directory empty |
| ERR-STEP-003 | WARNING | Step Files | Step file unreadable |
| ERR-STEP-004 | WARNING | Step Files | Invalid YAML frontmatter |
| ERR-STEP-005 | WARNING | Step Files | Missing required frontmatter field |
| ERR-STEP-006 | WARNING | Step Files | Invalid frontmatter field value |
| ERR-STEP-007 | INFO | Step Files | Missing body section for active depth |
| ERR-STEP-008 | WARNING | Step Files | Unresolved step dependency |
| ERR-STEP-009 | WARNING | Step Files | skip_if evaluation error |
| ERR-META-001 | INFO | Meta.json | Meta.json not found |
| ERR-META-002 | ERROR | Meta.json | Meta.json corrupt |
| ERR-META-003 | ERROR | Meta.json | Meta.json write failure |
| ERR-META-004 | INFO | Meta.json | Invalid steps_completed type |
| ERR-META-005 | INFO | Meta.json | Invalid depth_overrides type |
| ERR-ART-001 | WARNING | Artifacts | Artifact folder missing |
| ERR-ART-002 | ERROR | Artifacts | Artifact write failure |
| ERR-ART-003 | WARNING | Artifacts | Artifact read failure during update |
| ERR-PERSONA-001 | WARNING | Persona | Unknown phase key |
| ERR-PERSONA-002 | INFO | Persona | Step file persona mismatch |
| ERR-DEPTH-001 | INFO | Adaptive Depth | Quick-scan data unavailable |
| ERR-DEPTH-002 | INFO | Adaptive Depth | Invalid depth override value |
| ERR-INT-001 | FATAL | Integration | Task tool delegation failure |
| ERR-INT-002 | WARNING | Integration | Phase boundary inconsistency |

---

## 10. Error Handling Principles

1. **Fail gracefully, not fatally**: Only ERR-INT-001 (Task tool failure) is FATAL. All other errors have automatic recovery strategies that allow the session to continue.

2. **Skip and retry over abort**: When a step file has errors (ERR-STEP-003 through ERR-STEP-009), the step is skipped rather than aborting the entire phase. Skipped steps are not added to `steps_completed`, so they are retried on the next session.

3. **Persist before interacting**: Artifact writes and meta.json updates happen before the step menu is presented. This ensures that interruptions after step completion do not lose work (NFR-003).

4. **Default to standard**: When depth, persona, or other configuration is ambiguous or invalid, the system defaults to the "standard" or most common option rather than failing.

5. **Transparent warnings**: User-visible messages are informational, not alarming. They explain what happened and what the system is doing about it, without requiring user action.

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-19 | System Designer (Phase 04) | Initial error taxonomy |
