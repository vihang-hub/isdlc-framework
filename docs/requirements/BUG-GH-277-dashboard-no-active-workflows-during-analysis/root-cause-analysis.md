# Root Cause Analysis: BUG-GH-277

## Primary Hypothesis (Confirmed)

The dashboard has a single data source (`state.json → active_workflow`) that is only populated during build workflows. The analysis lifecycle is invisible to the dashboard.

**Confidence**: Confirmed — verified by code inspection.

## Affected Code Paths

1. `src/dashboard/server.js:buildStateResponse()` (line 75-84) — reads `state.active_workflow`, returns null during analysis
2. `src/dashboard/index.html:renderDAG()` (line 296-298) — `!wf` branch renders "No Active Workflow" empty state
3. `src/core/backlog/item-state.js:writeMetaJson()` — writes to individual `docs/requirements/{slug}/meta.json` only, no index propagation
4. Analyze handler (isdlc.md) — runs inline, does NOT write to state.json (NFR-002 constraint)

## Blast Radius

**Direct changes:**
- `src/core/backlog/analysis-index.js` (CREATE) — new module for analysis index CRUD
- `src/core/backlog/item-state.js` (MODIFY) — wire `updateAnalysisIndex()` into `writeMetaJson()`
- `src/core/backlog/index.js` (MODIFY) — re-export new functions
- `src/dashboard/server.js` (MODIFY) — read analysis index, add to API response
- `src/dashboard/index.html` (MODIFY) — analysis view with radio toggle

**Indirect / supporting:**
- `.gitignore` (MODIFY) — add `.isdlc/analysis-index.json`
- `tests/core/backlog/analysis-index.test.js` (CREATE)
- `tests/core/dashboard/server.test.js` (MODIFY)

## Evidence

- `server.js:75-84`: `buildStateResponse()` returns `{ active_workflow, phases, topology }` — no analysis field
- `.isdlc/` directory listing: no analysis index file exists
- `state.json`: `active_workflow` is null during analysis (confirmed by `curl /api/state`)
- `item-state.js:writeMetaJson()`: writes to disk only, no side effects
