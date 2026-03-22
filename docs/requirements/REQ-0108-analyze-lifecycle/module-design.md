# Design Specification: Analyze Lifecycle Implementation

**Item**: REQ-0108 | **GitHub**: #172 | **CODEX**: CODEX-039

---

## 1. Module: `src/core/analyze/lifecycle.js` (~80 lines)

### Exports

#### `entryRoutingModel` (frozen object)
```js
{
  flags: {
    recognized: [ '--folder', '--interrupt', '--resume', '--provider' ],
    types: { '--folder': 'string', '--interrupt': 'boolean', '--resume': 'boolean', '--provider': 'string' },
    defaults: { '--interrupt': false, '--resume': false }
  },
  staleness_check: {
    enabled: true,
    threshold_field: 'codebase_hash',
    action_on_stale: 'warn_and_continue'
  },
  sizing_precheck: {
    enabled: true,
    trivial_threshold: 'trivial',
    tiers: ['trivial', 'light', 'standard']
  },
  classification_gate: 'bug_vs_feature',
  routing: {
    bug: 'fix_handler',
    feature: 'analyze_handler',
    ambiguous: 'prompt_user'
  }
}
```

#### `prefetchGraph` (frozen array of 6 groups)
```js
[
  { id: 'issue_tracker',      source: 'github_api',               fallback: null,  fail_open: true,  parallel: true },
  { id: 'requirements_folder', source: 'docs/requirements/{slug}', fallback: '{}',  fail_open: true,  parallel: true },
  { id: 'memory',             source: 'lib/memory.js',             fallback: '[]',  fail_open: true,  parallel: true },
  { id: 'personas',           source: 'src/claude/agents/roundtable-*.md', fallback: 'defaults', fail_open: true, parallel: true },
  { id: 'topics',             source: 'src/claude/skills/roundtable/topics/', fallback: '[]', fail_open: true, parallel: true },
  { id: 'discovery',          source: '.isdlc/discovery.json',     fallback: '{}',  fail_open: true,  parallel: true }
]
```

#### `bugClassificationSignals` (frozen object)
```js
{
  bug_signals:     Object.freeze(['broken', 'fix', 'bug', 'crash', 'error', 'wrong', 'failing', 'not working', '500']),
  feature_signals: Object.freeze(['add', 'build', 'create', 'implement', 'design', 'refactor', 'upgrade', 'migrate'])
}
```

#### Registry functions
- `getEntryRoutingModel()` — returns `entryRoutingModel`
- `getPrefetchGraph()` — returns `prefetchGraph`
- `getBugClassificationSignals()` — returns `bugClassificationSignals`

---

## 2. Module: `src/core/analyze/index.js` (~30 lines)

Barrel re-export for all 6 analyze sub-modules plus a top-level registry object.

### Exports

```js
// Re-exports from each sub-module
export * from './lifecycle.js';           // REQ-0108
export * from './state-machine.js';       // REQ-0109
export * from './artifact-readiness.js';  // REQ-0110
export * from './memory-model.js';        // REQ-0111
export * from './finalization-chain.js';  // REQ-0112
export * from './inference-depth.js';     // REQ-0113

// Top-level registry convenience
export const analyzeRegistry = Object.freeze({
  lifecycle:         () => import('./lifecycle.js'),
  stateMachine:      () => import('./state-machine.js'),
  artifactReadiness: () => import('./artifact-readiness.js'),
  memoryModel:       () => import('./memory-model.js'),
  finalizationChain: () => import('./finalization-chain.js'),
  inferenceDepth:    () => import('./inference-depth.js')
});
```

---

## 3. Module: `src/core/bridge/analyze.cjs` (~40 lines)

CJS bridge-first-with-fallback pattern matching existing bridges (e.g., `memory.cjs`).

### Pattern

```js
// Bridge: CJS wrapper for src/core/analyze/index.js
// Uses dynamic import() with synchronous cache fallback

let _cache = null;

async function loadAnalyze() {
  if (_cache) return _cache;
  try {
    _cache = await import('../analyze/index.js');
  } catch (err) {
    // Fallback: return stub with empty frozen objects
    _cache = {
      getEntryRoutingModel:        () => Object.freeze({}),
      getPrefetchGraph:            () => Object.freeze([]),
      getBugClassificationSignals: () => Object.freeze({ bug_signals: [], feature_signals: [] }),
      getStateMachine:             () => Object.freeze({}),
      getTransition:               () => null,
      getTierPath:                 () => Object.freeze([]),
      getArtifactReadiness:        () => Object.freeze({}),
      getTopicDependencies:        () => Object.freeze([]),
      getWriteStrategyConfig:      () => Object.freeze({}),
      getMemoryLayerSchema:        () => Object.freeze({}),
      getMergeRules:               () => Object.freeze({}),
      getSearchStrategyConfig:     () => Object.freeze({}),
      getEnrichmentPipeline:       () => Object.freeze([]),
      getFinalizationChain:        () => Object.freeze([]),
      getProviderNeutralSteps:     () => Object.freeze([]),
      getAsyncSteps:               () => Object.freeze([]),
      getConfidenceLevels:         () => Object.freeze({}),
      getDepthGuidance:            () => Object.freeze({}),
      getCoverageGuardrails:       () => Object.freeze({}),
      getDepthAdjustmentSignals:   () => Object.freeze([])
    };
  }
  return _cache;
}

module.exports = { loadAnalyze };
```

### Usage from antigravity scripts
```js
const { loadAnalyze } = require('../bridge/analyze.cjs');
const analyze = await loadAnalyze();
const chain = analyze.getFinalizationChain();
```

---

## 4. Open Questions

None — all decisions are frozen config extraction with no behavioral changes.
