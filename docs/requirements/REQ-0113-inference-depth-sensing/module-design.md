# Design Specification: Inference Tracking and Depth Sensing

**Item**: REQ-0113 | **GitHub**: #177 | **CODEX**: CODEX-044

---

## 1. Module: `src/core/analyze/inference-depth.js` (~60 lines)

### Exports

#### `CONFIDENCE` (frozen enum)
```js
Object.freeze({
  HIGH:   Object.freeze({ value: 'high',   weight: 1.0, description: 'User-confirmed requirement' }),
  MEDIUM: Object.freeze({ value: 'medium', weight: 0.6, description: 'Inferred from codebase analysis' }),
  LOW:    Object.freeze({ value: 'low',    weight: 0.3, description: 'Extrapolated with assumptions' })
})
```

#### `depthGuidance` (frozen object, keyed by topic ID)

Topic IDs match roundtable topic files in `src/claude/skills/roundtable/topics/`.

```js
Object.freeze({
  'problem-discovery': Object.freeze({
    brief:    Object.freeze({ behavior: 'summarize', acceptance: 'problem statement exists',           inference_policy: 'infer_from_issue' }),
    standard: Object.freeze({ behavior: 'full',      acceptance: 'problem + impact + stakeholders',    inference_policy: 'confirm_inferences' }),
    deep:     Object.freeze({ behavior: 'extended',   acceptance: 'problem + root cause + alternatives', inference_policy: 'no_inference' })
  }),
  'requirements-definition': Object.freeze({
    brief:    Object.freeze({ behavior: 'summarize', acceptance: 'FRs listed',                         inference_policy: 'infer_from_codebase' }),
    standard: Object.freeze({ behavior: 'full',      acceptance: 'FRs with ACs',                       inference_policy: 'confirm_inferences' }),
    deep:     Object.freeze({ behavior: 'extended',   acceptance: 'FRs + ACs + edge cases + NFRs',      inference_policy: 'no_inference' })
  }),
  'architecture': Object.freeze({
    brief:    Object.freeze({ behavior: 'skip',      acceptance: 'N/A',                                inference_policy: 'infer_from_codebase' }),
    standard: Object.freeze({ behavior: 'full',      acceptance: 'ADR + integration points',            inference_policy: 'confirm_inferences' }),
    deep:     Object.freeze({ behavior: 'extended',   acceptance: 'ADR + alternatives + trade-offs',     inference_policy: 'no_inference' })
  }),
  'specification': Object.freeze({
    brief:    Object.freeze({ behavior: 'skip',      acceptance: 'N/A',                                inference_policy: 'infer_from_codebase' }),
    standard: Object.freeze({ behavior: 'full',      acceptance: 'module design with exports',          inference_policy: 'confirm_inferences' }),
    deep:     Object.freeze({ behavior: 'extended',   acceptance: 'module design + error handling + perf', inference_policy: 'no_inference' })
  })
})
```

#### `coverageGuardrails` (frozen object)
```js
Object.freeze({
  brief:    Object.freeze({ min_topics: 2, required: Object.freeze(['problem-discovery']) }),
  standard: Object.freeze({ min_topics: 4, required: Object.freeze(['problem-discovery', 'requirements-definition', 'architecture', 'specification']) }),
  deep:     Object.freeze({ min_topics: 4, required: Object.freeze(['problem-discovery', 'requirements-definition', 'architecture', 'specification']) })
})
```

#### `depthAdjustmentSignals` (frozen array)
```js
Object.freeze([
  Object.freeze({ signal: 'keep it simple',       direction: 'shallower' }),
  Object.freeze({ signal: 'just the basics',       direction: 'shallower' }),
  Object.freeze({ signal: 'quick analysis',        direction: 'shallower' }),
  Object.freeze({ signal: 'skip the details',      direction: 'shallower' }),
  Object.freeze({ signal: 'tell me more',          direction: 'deeper' }),
  Object.freeze({ signal: 'what about edge cases', direction: 'deeper' }),
  Object.freeze({ signal: 'dig deeper',            direction: 'deeper' }),
  Object.freeze({ signal: 'let\'s be thorough',    direction: 'deeper' })
])
```

### Registry Functions

- `getConfidenceLevels()` — returns `CONFIDENCE`
- `getDepthGuidance(topicId)` — returns `depthGuidance[topicId]` or `null`
- `getCoverageGuardrails()` — returns `coverageGuardrails`
- `getDepthAdjustmentSignals()` — returns `depthAdjustmentSignals`

---

## 2. Open Questions

None — confidence levels and depth rules are extracted from the existing roundtable analyst behavior and topic file conventions.
