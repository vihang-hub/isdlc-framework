# Dashboard shows no active workflows during analysis

**Source**: GitHub Issue #277
**Type**: Bug
**Labels**: bug

## Problem

The REQ-0068 dashboard server (`src/dashboard/server.js`) only reads `state.json` for `active_workflow`, which is only set during the build phase (via `workflow-init.cjs`). During the analysis/roundtable stage, there is no `active_workflow` — the dashboard shows "no active workflows" even though analysis is actively running in another session.

## Root Cause

The dashboard was designed around `active_workflow` in `state.json` as its sole data source. Analysis is a separate lifecycle that writes to `meta.json` in `docs/requirements/{slug}/` — the dashboard has no knowledge of this.

## Expected Behavior

The dashboard should show analysis progress when an analysis is running, using `meta.json` as a secondary data source. This requires:
1. A pointer in `state.json` to know which item is being analyzed (e.g., `active_analysis` field)
2. The dashboard server reading the referenced `meta.json` for analysis state
3. The dashboard UI rendering analysis progress (current persona, confirmation stage, etc.)

## Acceptance Criteria

- Dashboard shows analysis is in progress when a roundtable is active
- Dashboard shows which item is being analyzed
- Dashboard shows analysis phase progression (persona stages)
- Build workflow visibility (existing behavior) is unaffected
