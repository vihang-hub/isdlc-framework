# Architecture Overview: Inference Tracking and Depth Sensing

**Item**: REQ-0113 | **GitHub**: #177 | **CODEX**: CODEX-044

---

## 1. Architecture Options

| Option | Summary | Pros | Cons | Verdict |
|--------|---------|------|------|---------|
| A: Single frozen-config module | Confidence enum, depth guidance, guardrails, signals in one file | Simple, co-located, ~60 lines | Larger if topic list grows | **Selected** |
| B: Per-topic config files | Each topic has its own depth config file | Fine-grained, topic-aligned | File proliferation, harder to test holistically | Eliminated |

## 2. Selected Architecture

### ADR-CODEX-019: Inference Depth as Frozen Config

- **Status**: Accepted
- **Context**: Depth sensing rules are implicit in roundtable analyst behavior. Per-topic depth files would mirror the existing topic skill files but add maintenance burden.
- **Decision**: Create `src/core/analyze/inference-depth.js` (~60 lines) exporting frozen confidence levels, per-topic depth guidance, coverage guardrails, and depth adjustment signals.
- **Rationale**: A single module allows holistic testing of the depth model. Topic IDs reference the existing roundtable topic files without duplicating their content.
- **Consequences**: New topics require adding an entry to the depth guidance config. This makes depth decisions explicit.

## 3. Technology Decisions

| Technology | Rationale |
|-----------|----------|
| ES modules (`.js`) | Consistent with `src/core/` convention |
| `Object.freeze()` | Immutable depth definitions |
| No external dependencies | Pure data module |

## 4. Integration Architecture

### File Location

```
src/core/analyze/
  inference-depth.js   (NEW — this item)
```

### Integration Points

| Source | Target | Interface | Data Format |
|--------|--------|-----------|-------------|
| inference-depth.js | roundtable-analyst.md | Import via bridge | Frozen config |
| inference-depth.js | test suite | Direct import | Frozen config |
| inference-depth.js | index.js barrel | Re-export | Named exports |

## 5. Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Module location | `src/core/analyze/inference-depth.js` | Co-located with analyze modules |
| Config style | Frozen objects (enum, per-topic guidance, guardrails, signals) | Immutable, testable |
| Size estimate | ~60 lines | Confidence enum + depth guidance + guardrails + signals |
