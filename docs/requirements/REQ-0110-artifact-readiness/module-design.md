# Design Specification: Artifact Readiness and Write Strategy

**Item**: REQ-0110 | **GitHub**: #174 | **CODEX**: CODEX-041

---

## 1. Module: `src/core/analyze/artifact-readiness.js` (~70 lines)

### Exports

#### `readinessRules` (frozen object)

Maps artifact filenames to their required topic IDs.

```js
Object.freeze({
  'requirements-spec.md': Object.freeze(['problem-discovery', 'requirements-definition']),
  'architecture-overview.md': Object.freeze(['problem-discovery', 'requirements-definition', 'architecture']),
  'module-design.md': Object.freeze(['problem-discovery', 'requirements-definition', 'architecture', 'specification']),
  'meta.json': Object.freeze(['problem-discovery'])  // minimal — written progressively
})
```

#### `topicDependencies` (frozen array of DAG edges)

Each edge is `[predecessor, successor]` — predecessor must complete before successor.

```js
Object.freeze([
  Object.freeze(['problem-discovery', 'requirements-definition']),
  Object.freeze(['requirements-definition', 'architecture']),
  Object.freeze(['architecture', 'specification'])
])
```

#### `writeStrategyConfig` (frozen object)

```js
Object.freeze({
  progressive_meta_only: true,       // only meta.json updates during conversation
  final_batch_write: true,           // all artifacts written in one batch after final Accept
  pre_write_consistency_check: true  // validate cross-artifact consistency before batch write
})
```

### Registry Functions

- `getArtifactReadiness(artifact)` — returns `readinessRules[artifact]` or `null`
- `getTopicDependencies()` — returns `topicDependencies`
- `getWriteStrategyConfig()` — returns `writeStrategyConfig`

---

## 2. Open Questions

None — readiness rules are a direct extraction from the roundtable analyst's existing implicit logic.
