# Design Specification: Analyze Finalization Path

**Item**: REQ-0112 | **GitHub**: #176 | **CODEX**: CODEX-043

---

## 1. Module: `src/core/analyze/finalization-chain.js` (~50 lines)

### Exports

#### `finalizationChain` (frozen array of 6 steps)

Steps 1-3 are synchronous. Steps 4-6 are asynchronous.

```js
Object.freeze([
  Object.freeze({
    id: 'meta_status_update',
    order: 1,
    action: 'Update meta.json analysis_status to analyzed',
    depends_on: [],
    provider_specific: false,
    fail_open: false,
    async: false
  }),
  Object.freeze({
    id: 'backlog_marker_update',
    order: 2,
    action: 'Update BACKLOG.md status marker for the item',
    depends_on: ['meta_status_update'],
    provider_specific: false,
    fail_open: false,
    async: false
  }),
  Object.freeze({
    id: 'github_sync',
    order: 3,
    action: 'Sync labels and comments to GitHub issue',
    depends_on: ['meta_status_update'],
    provider_specific: true,
    fail_open: true,
    async: false
  }),
  Object.freeze({
    id: 'sizing_computation',
    order: 4,
    action: 'Compute sizing estimate from requirements',
    depends_on: ['meta_status_update'],
    provider_specific: false,
    fail_open: true,
    async: true
  }),
  Object.freeze({
    id: 'memory_writeback',
    order: 5,
    action: 'Write session record to roundtable memory',
    depends_on: ['meta_status_update'],
    provider_specific: false,
    fail_open: true,
    async: true
  }),
  Object.freeze({
    id: 'async_enrichment',
    order: 6,
    action: 'Trigger embedding and vector index update',
    depends_on: ['memory_writeback'],
    provider_specific: false,
    fail_open: true,
    async: true
  })
])
```

### Registry Functions

- `getFinalizationChain()` — returns `finalizationChain`
- `getProviderNeutralSteps()` — returns `finalizationChain.filter(s => !s.provider_specific)`
- `getAsyncSteps()` — returns `finalizationChain.filter(s => s.async)`

---

## 2. Open Questions

None — the chain is a direct extraction from the existing `analyze-finalize.cjs` step sequence.
