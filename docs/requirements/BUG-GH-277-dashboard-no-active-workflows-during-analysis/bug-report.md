# Bug Report: Dashboard shows no active workflows during analysis

**ID**: BUG-GH-277
**Severity**: Medium
**Status**: Confirmed

## Reproduction Steps

1. Run `node src/dashboard/server.js` from the project root
2. Open `http://127.0.0.1:3456` in a browser
3. Start `/isdlc analyze` in a separate Claude Code session
4. Observe dashboard shows "No Active Workflow" throughout analysis

## Symptoms

- Dashboard renders empty state ("No Active Workflow") during active analysis
- No indication that analysis is running in another session
- The dashboard only becomes useful once a build workflow starts

## Affected Area

- `src/dashboard/server.js` — `buildStateResponse()` (line 75-84) only reads `active_workflow` from state.json
- `src/dashboard/index.html` — `renderDAG()` (line 296-298) shows empty state when `!wf || !wf.phases`
- Analyze handler — writes to `docs/requirements/{slug}/meta.json` but not state.json (by design, NFR-002)

## Root Cause

The dashboard was designed (REQ-0068) with `state.json → active_workflow` as its sole data source. The analyze handler explicitly does not write to state.json (NFR-002 constraint). Analysis progress lives in individual `meta.json` files under `docs/requirements/{slug}/`, which the dashboard has no knowledge of. No aggregate index of analysis items exists.

## Affected Users

Any developer monitoring workflow progress via the browser dashboard. The dashboard is blind to the longest interactive part of the workflow (analysis/roundtable).
