/**
 * Inference Depth Sensing — confidence levels, depth guidance, guardrails, signals
 *
 * Frozen configuration for roundtable analyst depth adjustment and
 * inference tracking. Pure data — no runtime inference scoring.
 *
 * Requirements: REQ-0113 FR-001 (AC-001-01..02), FR-002 (AC-002-01..03),
 *               FR-003 (AC-003-01..02), FR-004 (AC-004-01..02),
 *               FR-005 (AC-005-01..04)
 * @module src/core/analyze/inference-depth
 */

// ---------------------------------------------------------------------------
// FR-001: Confidence Levels (AC-001-01..02)
// ---------------------------------------------------------------------------

const CONFIDENCE = Object.freeze({
  HIGH:   Object.freeze({ value: 'high',   weight: 1.0, description: 'User-confirmed requirement' }),
  MEDIUM: Object.freeze({ value: 'medium', weight: 0.6, description: 'Inferred from codebase analysis' }),
  LOW:    Object.freeze({ value: 'low',    weight: 0.3, description: 'Extrapolated with assumptions' })
});

// ---------------------------------------------------------------------------
// FR-002: Depth Guidance (AC-002-01..03)
// ---------------------------------------------------------------------------

const depthGuidance = Object.freeze({
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
});

// ---------------------------------------------------------------------------
// FR-003: Coverage Guardrails (AC-003-01..02)
// ---------------------------------------------------------------------------

const coverageGuardrails = Object.freeze({
  brief:    Object.freeze({ min_topics: 2, required: Object.freeze(['problem-discovery']) }),
  standard: Object.freeze({ min_topics: 4, required: Object.freeze(['problem-discovery', 'requirements-definition', 'architecture', 'specification']) }),
  deep:     Object.freeze({ min_topics: 4, required: Object.freeze(['problem-discovery', 'requirements-definition', 'architecture', 'specification']) })
});

// ---------------------------------------------------------------------------
// FR-004: Depth Adjustment Signals (AC-004-01..02)
// ---------------------------------------------------------------------------

const depthAdjustmentSignals = Object.freeze([
  Object.freeze({ signal: 'keep it simple',       direction: 'shallower' }),
  Object.freeze({ signal: 'just the basics',       direction: 'shallower' }),
  Object.freeze({ signal: 'quick analysis',        direction: 'shallower' }),
  Object.freeze({ signal: 'skip the details',      direction: 'shallower' }),
  Object.freeze({ signal: 'tell me more',          direction: 'deeper' }),
  Object.freeze({ signal: 'what about edge cases', direction: 'deeper' }),
  Object.freeze({ signal: 'dig deeper',            direction: 'deeper' }),
  Object.freeze({ signal: "let's be thorough",     direction: 'deeper' })
]);

// ---------------------------------------------------------------------------
// FR-005: Registry Functions (AC-005-01..04)
// ---------------------------------------------------------------------------

/**
 * Get the confidence level enum.
 * @returns {Readonly<Object>} Frozen confidence levels
 */
export function getConfidenceLevels() {
  return CONFIDENCE;
}

/**
 * Get depth guidance for a specific topic.
 * @param {string} topicId - Topic ID (e.g., 'problem-discovery')
 * @returns {Readonly<Object>|null} Depth guidance, or null if unknown topic
 */
export function getDepthGuidance(topicId) {
  return depthGuidance[topicId] || null;
}

/**
 * Get coverage guardrails per depth level.
 * @returns {Readonly<Object>} Frozen guardrails
 */
export function getCoverageGuardrails() {
  return coverageGuardrails;
}

/**
 * Get the depth adjustment signal-to-direction mappings.
 * @returns {Readonly<Array>} Frozen array of signal objects
 */
export function getDepthAdjustmentSignals() {
  return depthAdjustmentSignals;
}
