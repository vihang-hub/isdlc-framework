# Architecture Overview: Analyze Finalization Path

**Item**: REQ-0112 | **GitHub**: #176 | **CODEX**: CODEX-043

---

## 1. Architecture Options

| Option | Summary | Pros | Cons | Verdict |
|--------|---------|------|------|---------|
| A: Frozen chain module | 6-step chain as frozen array of step objects | Simple, introspectable, testable | Does not replace runtime logic | **Selected** |
| B: Chain-of-responsibility pattern | Runtime chain with pluggable handlers | Could replace analyze-finalize.cjs | Over-engineered for a data extraction task | Eliminated |

## 2. Selected Architecture

### ADR-CODEX-018: Finalization Chain as Frozen Data

- **Status**: Accepted
- **Context**: The finalization logic in `analyze-finalize.cjs` (229 lines) executes 6 steps in order. This item extracts the chain shape as data, not behavior.
- **Decision**: Create `src/core/analyze/finalization-chain.js` (~50 lines) exporting the frozen 6-step chain with dependency, provider, and async metadata.
- **Rationale**: Data-as-config enables introspection ("which steps are provider-specific?") and testing ("is the dependency graph valid?") without coupling to runtime execution.
- **Consequences**: The runtime `analyze-finalize.cjs` remains authoritative for execution. This module is the schema/metadata complement.

## 3. Technology Decisions

| Technology | Rationale |
|-----------|----------|
| ES modules (`.js`) | Consistent with `src/core/` convention |
| `Object.freeze()` | Immutable chain definition |
| No external dependencies | Pure data module |

## 4. Integration Architecture

### File Location

```
src/core/analyze/
  finalization-chain.js   (NEW — this item)

Existing (NOT modified):
  src/antigravity/analyze-finalize.cjs
```

### Integration Points

| Source | Target | Interface | Data Format |
|--------|--------|-----------|-------------|
| finalization-chain.js | analyze-finalize.cjs | Could import for validation | Frozen step array |
| finalization-chain.js | test suite | Direct import | Frozen step array |
| finalization-chain.js | index.js barrel | Re-export | Named exports |

## 5. Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Module location | `src/core/analyze/finalization-chain.js` | Co-located with analyze modules |
| Data style | Frozen array of step objects | Introspectable, testable |
| Size estimate | ~50 lines | 6 steps with metadata |
