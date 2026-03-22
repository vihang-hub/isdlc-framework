# Architecture Overview: Memory Layering — User/Project/Session

**Item**: REQ-0111 | **GitHub**: #175 | **CODEX**: CODEX-042

---

## 1. Architecture Options

| Option | Summary | Pros | Cons | Verdict |
|--------|---------|------|------|---------|
| A: Metadata-only module alongside existing runtime | New `memory-model.js` with frozen schemas, no changes to `lib/memory*.js` | Zero-risk to existing memory system, testable in isolation | Two places to understand memory config | **Selected** |
| B: Embed metadata in existing lib/memory.js | Add frozen exports to the runtime module | Single source of truth | Risks touching 693-line production code, couples metadata to runtime | Eliminated |

## 2. Selected Architecture

### ADR-CODEX-017: Memory Model as Separate Metadata Module

- **Status**: Accepted
- **Context**: The memory runtime (`lib/memory.js`, `lib/memory-search.js`, `lib/memory-embedder.js`) is stable and complex (1,888 lines combined). Adding metadata exports risks regressions.
- **Decision**: Create `src/core/analyze/memory-model.js` (~50 lines) exporting frozen schema/config metadata. The runtime code remains untouched.
- **Rationale**: Separation of concerns — metadata for introspection and testing lives in `src/core/`, runtime lives in `lib/`. The bridge at `src/core/bridge/memory.cjs` already exists for runtime access.
- **Consequences**: Consumers needing both metadata and runtime import from different paths. This is acceptable because the use cases are distinct (analysis vs execution).

## 3. Technology Decisions

| Technology | Rationale |
|-----------|----------|
| ES modules (`.js`) | Consistent with `src/core/` convention |
| `Object.freeze()` | Immutable schema definitions |
| No external dependencies | Pure data module |

## 4. Integration Architecture

### File Location

```
src/core/analyze/
  memory-model.js   (NEW — this item)

Existing (NOT modified):
  lib/memory.js
  lib/memory-search.js
  lib/memory-embedder.js
  src/core/bridge/memory.cjs
```

### Integration Points

| Source | Target | Interface | Data Format |
|--------|--------|-----------|-------------|
| memory-model.js | roundtable-analyst.md | Import via bridge | Frozen config |
| memory-model.js | test suite | Direct import | Frozen config |
| memory-model.js | index.js barrel | Re-export | Named exports |

## 5. Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Module location | `src/core/analyze/memory-model.js` | Metadata separate from runtime |
| Runtime impact | None | `lib/memory*.js` untouched |
| Size estimate | ~50 lines | Layer schema + merge rules + search config + pipeline |
