# Fix Strategy: BUG-GH-277

## Approaches Evaluated

### Approach 1: Analysis Index File (Recommended)

Create `.isdlc/analysis-index.json` as a lightweight registry of all analysis items. Updated by `writeMetaJson()` after every meta.json write. Dashboard reads this single file per poll cycle.

**Pros:**
- Single file read per poll (O(1) not O(N))
- Clean separation — new module, minimal changes to existing code
- Cold-start rebuild from meta.json files as repair path
- Respects NFR-002 (no state.json writes from analyze handler)

**Cons:**
- New file to maintain (.isdlc/analysis-index.json)
- writeMetaJson() gains a side effect (index update)

**Files affected:** 5 modified, 2 created
**Regression risk:** Low — additive changes only

### Approach 2: Scan meta.json on Poll

Dashboard server globs `docs/requirements/*/meta.json` every 2 seconds, reads all, filters for active.

**Pros:**
- No analyze handler changes needed
- Always consistent (reads source of truth directly)

**Cons:**
- O(N) filesystem reads per poll — doesn't scale with backlog growth
- 2-second poll × N files = unnecessary I/O
- No caching without complexity

**Files affected:** 2 modified
**Regression risk:** Low but performance concern

## Recommended Approach

**Approach 1: Analysis Index File**

Rationale: Single file read per poll is the right trade-off. The index is a cache of meta.json data with a rebuild path for consistency. The `writeMetaJson()` hook point is natural — every analysis progress event flows through it.

## Regression Risk Assessment

- **Dashboard build view**: Untouched — analysis view is a separate code path activated when `active_workflow` is null
- **writeMetaJson()**: Single function call added — if index write fails, meta.json write still succeeds (fail-open)
- **state.json**: Not modified — NFR-002 preserved
- **Existing tests**: `tests/core/dashboard/server.test.js` exists, will be extended

## Test Gaps

| Gap | Mitigation |
|---|---|
| No unit tests for analysis-index module | T007: Create `tests/core/backlog/analysis-index.test.js` |
| No dashboard API tests for analysis data | T008: Extend `tests/core/dashboard/server.test.js` |
| No automated UI tests for dashboard | Manual testing — dashboard is vanilla JS/HTML |
