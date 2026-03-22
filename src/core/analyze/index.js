/**
 * Analyze Module — re-exports + top-level registry
 *
 * Aggregates all analyze sub-modules and provides a lazy-load registry.
 *
 * Requirements: REQ-0108..0113
 * @module src/core/analyze/index
 */

// Re-export all sub-modules
export { getEntryRoutingModel, getPrefetchGraph, getBugClassificationSignals } from './lifecycle.js';
export { getStateMachine, getTransition, getTierPath } from './state-machine.js';
export { getArtifactReadiness, getTopicDependencies, getWriteStrategyConfig } from './artifact-readiness.js';
export { getMemoryLayerSchema, getMergeRules, getSearchStrategyConfig, getEnrichmentPipeline } from './memory-model.js';
export { getFinalizationChain, getProviderNeutralSteps, getAsyncSteps } from './finalization-chain.js';
export { getConfidenceLevels, getDepthGuidance, getCoverageGuardrails, getDepthAdjustmentSignals } from './inference-depth.js';

// ---------------------------------------------------------------------------
// Top-level registry convenience (lazy-load)
// ---------------------------------------------------------------------------

export const analyzeRegistry = Object.freeze({
  lifecycle:         () => import('./lifecycle.js'),
  stateMachine:      () => import('./state-machine.js'),
  artifactReadiness: () => import('./artifact-readiness.js'),
  memoryModel:       () => import('./memory-model.js'),
  finalizationChain: () => import('./finalization-chain.js'),
  inferenceDepth:    () => import('./inference-depth.js')
});
