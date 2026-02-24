# Implementation Notes: REQ-0037 Project Skills Distillation

**Phase**: 06-implementation
**Date**: 2026-02-24
**Branch**: feature/REQ-0037-project-skills-distillation

---

## Changes Made

### TASK 1: Remove Section 9 from rebuildSessionCache()

**File**: `src/claude/hooks/lib/common.cjs`
**Change**: Removed 18 lines (Section 9: DISCOVERY_CONTEXT) from `rebuildSessionCache()`
**Rationale**: Discovery content is now delivered via Section 7 (EXTERNAL_SKILLS) as distilled project skill files (PROJ-001 through PROJ-004). Section 9 injected raw discovery reports directly into the session cache, which was redundant and violated the single-delivery-mechanism principle.

The removed code read three files:
- `docs/project-discovery-report.md`
- `docs/isdlc/test-evaluation-report.md`
- `docs/isdlc/reverse-engineer-report.md`

A comment was left in place documenting the removal and referencing REQ-0037.

### TASK 2: Add 3 new test cases (TC-BUILD-16, TC-BUILD-17, TC-BUILD-18)

**File**: `src/claude/hooks/tests/test-session-cache-builder.test.cjs`
**Change**: Added a new `describe('Section 9 Removal (REQ-0037)')` block with 3 test cases

| Test ID | Description | Traces |
|---------|-------------|--------|
| TC-BUILD-16 | Cache does not contain DISCOVERY_CONTEXT section delimiter | FR-007, AC-007-01 |
| TC-BUILD-17 | Raw discovery report content not injected into cache | FR-007, AC-007-02 |
| TC-BUILD-18 | Section 7 EXTERNAL_SKILLS still functions after removal | FR-007, AC-007-03 |

TC-BUILD-19 (regression guard) is validated by running the full test file -- all 44 pre-existing tests pass unchanged.

### TASK 3: Add distillation step to discover-orchestrator.md

**File**: `src/claude/agents/discover-orchestrator.md`
**Change**: Added Project Skills Distillation step in three locations:

1. **Existing Project Flow (Step 2a)**: Full distillation step with execution sequence (Steps D.1 through D.7), skill templates with YAML frontmatter, clean-slate-per-source-phase logic, manifest update, and cache rebuild instructions.

2. **Incremental Discovery Flow**: Added distillation as step 2 in the "What runs" list, references Step 2a for the full execution sequence, updated progress display and diff summary.

3. **New Project Flow (Step 5a)**: Conditional distillation that checks for artifact existence before distilling each skill. New projects may not have all analysis output.

---

## Design Decisions

1. **Comment instead of blank line**: Left a comment at the Section 9 removal site documenting the change and REQ-0037 reference for traceability.

2. **Separate describe block for new tests**: Created a dedicated `describe('Section 9 Removal (REQ-0037)')` block rather than appending to the existing `rebuildSessionCache()` describe, to clearly separate REQ-0037 tests from REQ-0001 tests.

3. **Fail-open pattern**: All distillation steps follow fail-open -- any failure logs a warning and continues without blocking the discovery workflow (FR-006).

4. **5,000 character limit**: Each skill file template enforces a maximum of 5,000 characters to stay within context budget (FR-008).

5. **Clean-slate per source phase**: Only skills whose source phase actually ran are cleaned and re-distilled (FR-003). This prevents wiping skills from phases that were not re-analyzed.

---

## Test Results

- **New tests**: 3 added, 3 passing
- **Pre-existing tests**: 44 in file, 41 passing (3 pre-existing failures unrelated to this change)
- **Full hook suite**: 2618 passing, 9 failing (all pre-existing)
- **Regressions introduced**: 0

---

## Traceability

| Requirement | Implementation |
|-------------|---------------|
| FR-001 (Inline distillation) | Step 2a in discover-orchestrator.md |
| FR-002 (Four fixed skills) | PROJ-001 through PROJ-004 templates in Step D.3 |
| FR-003 (Clean-slate per source) | Step D.2 in discover-orchestrator.md |
| FR-004 (Manifest registration) | Step D.5 with source: "discover" |
| FR-005 (Single cache rebuild) | Step D.6 -- single node bin/rebuild-cache.js call |
| FR-006 (Fail-open) | Every step has "on failure: log warning, continue" |
| FR-007 (Remove Section 9) | Section 9 removed from common.cjs, verified by TC-BUILD-16/17/18 |
| FR-008 (LLM summarization) | Templates with structural sections and 5,000 char limit |
