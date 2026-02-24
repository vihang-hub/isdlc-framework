# Bug Report: BUG-0018 — Backlog Picker Pattern Mismatch

**ID**: BUG-0018
**External**: [GitHub #2](https://github.com/vihang-hub/isdlc-framework/issues/2)
**Severity**: Medium
**Origin**: REQ-0019 Preparation Pipeline (Phase 02 Impact Analysis, RISK-2)
**Created**: 2026-02-16
**Status**: Open

---

## Summary

The backlog picker in `00-sdlc-orchestrator.md` scans BACKLOG.md for items matching `- N.N [ ] <text>` patterns. REQ-0019 restructured BACKLOG.md from ~650-line inline spec format to a ~100-line lightweight index format where items include a `-> [requirements](...)` suffix linking to detailed requirement docs. The picker does not handle this suffix, causing it to either include the link text in displayed item titles or fail to parse items entirely.

## Reproduction Steps

1. Ensure BACKLOG.md contains items in the new index format:
   ```
   - 3.1 [ ] Parallel workflow support -> [requirements](docs/requirements/3.1-parallel-workflow-support/)
   ```
2. Invoke `/isdlc feature` with no description (triggers backlog picker)
3. Observe the picker menu

**Expected**: Items display with clean titles (e.g., `Parallel workflow support`)
**Actual**: Items display with `-> [requirements](...)` suffix in the title, or fail to parse

## Root Cause

The orchestrator's BACKLOG PICKER section (line ~294 of `00-sdlc-orchestrator.md`) defines the scan pattern as `- N.N [ ] <text>` where `<text>` captures everything after the checkbox. The new index format appends ` -> [requirements](docs/requirements/{id}/)` to each item line, and this suffix is captured as part of the item text.

## Affected Components

| # | Component | File | Priority | Description |
|---|-----------|------|----------|-------------|
| 1 | Orchestrator backlog picker pattern | `src/claude/agents/00-sdlc-orchestrator.md` | MEDIUM | Update BACKLOG PICKER section to strip `-> [requirements](...)` suffix |
| 2 | `workflows.json` `start` action entry | `.isdlc/config/workflows.json` | LOW | Determine whether `start` needs its own workflow definition |
| 3 | Backlog test file verification | `src/claude/hooks/tests/backlog-*.test.cjs` | LOW | Verify 5 test files still provide meaningful coverage with new format |

## Functional Requirements

### FR-1: Strip Link Suffix from Picker Display
The backlog picker MUST strip ` -> [requirements](...)` and ` -> [design](...)` suffixes from item titles when presenting options to users.

**Acceptance Criteria**:
- AC-1.1: Items with `-> [requirements](path)` suffix display without the suffix
- AC-1.2: Items with `-> [design](path)` suffix display without the suffix
- AC-1.3: Items without any `->` suffix continue to display correctly
- AC-1.4: The stripped text is used as the workflow description when selected

### FR-2: Parse All New Index Format Variants
The backlog picker MUST correctly parse items in all variants of the new BACKLOG.md index format.

**Acceptance Criteria**:
- AC-2.1: Items with number prefix `N.N` (e.g., `3.1`) parse correctly
- AC-2.2: Items with checked `[x]` boxes are excluded from the picker
- AC-2.3: Items with unchecked `[ ]` boxes are included in the picker
- AC-2.4: Items with strikethrough `~~text~~` formatting are excluded
- AC-2.5: Section headers (e.g., `### 3. Parallel Workflows`) are not parsed as items
- AC-2.6: Sub-bullets (indented metadata lines) are not parsed as separate items

### FR-3: Preserve Jira Metadata Parsing
The picker MUST continue to extract Jira ticket IDs from metadata sub-bullets.

**Acceptance Criteria**:
- AC-3.1: `**Jira:**` sub-bullets are still parsed for ticket IDs
- AC-3.2: Jira-backed items display `[Jira: TICKET-ID]` suffix in picker
- AC-3.3: Items without Jira metadata display without any suffix

### FR-4: Verify Test Coverage
Existing backlog test files MUST be verified for meaningful coverage with the new format.

**Acceptance Criteria**:
- AC-4.1: All 5 backlog test files are reviewed for pattern compatibility
- AC-4.2: Tests that validate against the old format are updated or supplemented
- AC-4.3: New test cases cover the `-> [requirements](...)` suffix stripping
- AC-4.4: All tests pass after changes

### FR-5: Evaluate `start` Action Workflow Entry
Determine whether the `start` action needs a workflow entry in `workflows.json`.

**Acceptance Criteria**:
- AC-5.1: Document whether `start` reuses `feature` workflow or needs its own
- AC-5.2: If new entry needed, add it to `workflows.json`
- AC-5.3: If reuse, document the mechanism in a code comment or ADR

## Non-Functional Requirements

### NFR-1: Backward Compatibility
The picker MUST continue to work with the old format (`- [ ] <text>` in CLAUDE.md) when BACKLOG.md does not exist.

### NFR-2: No Regression
All existing tests (ESM + CJS) MUST continue to pass without modification to unrelated test files.

### NFR-3: Performance
Pattern matching changes MUST NOT add measurable latency to picker display.

## Out of Scope

- Changing the BACKLOG.md format itself (that is owned by REQ-0019)
- Adding new workflow types beyond evaluating `start`
- Modifying the Phase 01 requirements analyst behavior
