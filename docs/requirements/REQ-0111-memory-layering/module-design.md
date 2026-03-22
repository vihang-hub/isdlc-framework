# Design Specification: Memory Layering — User/Project/Session

**Item**: REQ-0111 | **GitHub**: #175 | **CODEX**: CODEX-042

---

## 1. Module: `src/core/analyze/memory-model.js` (~50 lines)

### Exports

#### `layerSchema` (frozen object)
```js
Object.freeze({
  user: Object.freeze({
    paths: Object.freeze(['profile.json', 'sessions/']),
    format: 'json_file_and_directory',
    fail_open: true,
    description: 'User-level preferences and session history'
  }),
  project: Object.freeze({
    paths: Object.freeze(['roundtable-memory.json']),
    format: 'json_file',
    fail_open: true,
    description: 'Project-level roundtable memory and history'
  }),
  session: Object.freeze({
    paths: Object.freeze([]),  // in-memory only
    format: 'in_memory',
    fail_open: true,
    description: 'Current session record, not persisted until enrichment'
  })
})
```

#### `mergeRules` (frozen object)
```js
Object.freeze({
  priority: Object.freeze(['user', 'project', 'session']),  // highest to lowest
  conflict_threshold: 0.5,   // weight at or above triggers user-preference override
  strategy: 'user_overrides_project'
})
```

#### `searchConfig` (frozen object)
```js
Object.freeze({
  prefer: 'hybrid',          // vector-based search
  fallback: 'legacy',        // merge-based search
  fail_open_on_missing_index: true
})
```

#### `enrichmentPipeline` (frozen array)
```js
Object.freeze([
  Object.freeze({ id: 'writeSessionRecord', order: 1, async: false }),
  Object.freeze({ id: 'embedSession',       order: 2, async: true  }),
  Object.freeze({ id: 'vectorStore',        order: 3, async: true  }),
  Object.freeze({ id: 'searchIndex',        order: 4, async: true  })
])
```

### Registry Functions

- `getMemoryLayerSchema()` — returns `layerSchema`
- `getMergeRules()` — returns `mergeRules`
- `getSearchStrategyConfig()` — returns `searchConfig`
- `getEnrichmentPipeline()` — returns `enrichmentPipeline`

---

## 2. Open Questions

None — this is a metadata-only extraction. The runtime in `lib/memory*.js` remains authoritative for execution behavior.
