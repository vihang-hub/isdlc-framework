/**
 * CJS Bridge for src/core/analyze/index.js
 *
 * Allows CJS consumers (hooks, antigravity scripts) to use the ESM
 * analyze module via dynamic import(). Bridge-first-with-fallback
 * pattern per ADR-CODEX-006.
 *
 * Requirements: REQ-0108..0113 (CJS bridge)
 */

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
      getArtifactReadiness:        () => null,
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
      getDepthGuidance:            () => null,
      getCoverageGuardrails:       () => Object.freeze({}),
      getDepthAdjustmentSignals:   () => Object.freeze([]),
      analyzeRegistry:             Object.freeze({})
    };
  }
  return _cache;
}

module.exports = { loadAnalyze };
