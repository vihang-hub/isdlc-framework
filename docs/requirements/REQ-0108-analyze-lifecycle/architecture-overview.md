# Architecture Overview: Analyze Lifecycle Implementation

**Item**: REQ-0108 | **GitHub**: #172 | **CODEX**: CODEX-039

---

## 1. Architecture Options

| Option | Summary | Pros | Cons | Verdict |
|--------|---------|------|------|---------|
| A: Single frozen-config module | One file exporting frozen objects and getter functions | Simple, testable, single import | Larger file if model grows | **Selected** |
| B: Split per-concern files | Separate files for routing, prefetch, classification | Fine-grained imports | Over-engineered for ~80 lines of config | Eliminated |

## 2. Selected Architecture

### ADR-CODEX-014: Analyze Lifecycle Model

- **Status**: Accepted
- **Context**: The analyze entry path (routing, prefetch, classification) is procedural logic in `isdlc.md`. Extracting the frozen configuration into a data module enables introspection and testing.
- **Decision**: Create `src/core/analyze/lifecycle.js` (~80 lines) exporting frozen configuration objects and registry getter functions.
- **Rationale**: A single module keeps all analyze-entry config co-located. Frozen objects prevent runtime mutation. Getter functions provide a stable API surface.
- **Consequences**: `isdlc.md` can reference these configs by import rather than embedding them inline. Test suites can validate routing rules declaratively.

## 3. Technology Decisions

| Technology | Rationale |
|-----------|----------|
| ES modules (`.js`) | Consistent with `src/core/` convention |
| `Object.freeze()` / `Object.freeze` on arrays | Immutability without runtime deps |
| No external dependencies | Pure data module |

## 4. Integration Architecture

### File Location

```
src/core/analyze/
  lifecycle.js       (NEW — this item)
  index.js           (NEW — REQ-0108 also covers the barrel)
```

### Integration Points

| Source | Target | Interface | Data Format |
|--------|--------|-----------|-------------|
| lifecycle.js | isdlc.md (analyze handler) | Import via bridge | Frozen config objects |
| lifecycle.js | test suite | Direct import | Frozen config objects |
| lifecycle.js | index.js barrel | Re-export | Named exports |

## 5. Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Module location | `src/core/analyze/lifecycle.js` | Co-located with other analyze modules |
| Config style | Frozen objects + getter functions | Immutable, introspectable, testable |
| Size estimate | ~80 lines | Routing model + prefetch graph + classification signals |
