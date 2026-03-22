/**
 * Artifact Readiness — readiness rules, topic dependencies, write strategy
 *
 * Frozen configuration defining when artifacts are ready to write based
 * on topic coverage. Pure data — no runtime evaluation.
 *
 * Requirements: REQ-0110 FR-001 (AC-001-01..03), FR-002 (AC-002-01..03),
 *               FR-003 (AC-003-01..03), FR-004 (AC-004-01..03)
 * @module src/core/analyze/artifact-readiness
 */

// ---------------------------------------------------------------------------
// FR-001: Readiness Rules (AC-001-01..03)
// ---------------------------------------------------------------------------

const readinessRules = Object.freeze({
  'requirements-spec.md':    Object.freeze(['problem-discovery', 'requirements-definition']),
  'architecture-overview.md': Object.freeze(['problem-discovery', 'requirements-definition', 'architecture']),
  'module-design.md':        Object.freeze(['problem-discovery', 'requirements-definition', 'architecture', 'specification']),
  'meta.json':               Object.freeze(['problem-discovery'])
});

// ---------------------------------------------------------------------------
// FR-002: Topic Dependencies DAG (AC-002-01..03)
// ---------------------------------------------------------------------------

const topicDependencies = Object.freeze([
  Object.freeze(['problem-discovery', 'requirements-definition']),
  Object.freeze(['requirements-definition', 'architecture']),
  Object.freeze(['architecture', 'specification'])
]);

// ---------------------------------------------------------------------------
// FR-003: Write Strategy Config (AC-003-01..03)
// ---------------------------------------------------------------------------

const writeStrategyConfig = Object.freeze({
  progressive_meta_only: true,
  final_batch_write: true,
  pre_write_consistency_check: true
});

// ---------------------------------------------------------------------------
// FR-004: Registry Functions (AC-004-01..03)
// ---------------------------------------------------------------------------

/**
 * Get the required topics for an artifact.
 * @param {string} artifact - Artifact filename (e.g., 'requirements-spec.md')
 * @returns {Readonly<string[]>|null} Required topics, or null if unknown artifact
 */
export function getArtifactReadiness(artifact) {
  return readinessRules[artifact] || null;
}

/**
 * Get the topic dependency DAG edges.
 * @returns {Readonly<Array<[string, string]>>} Array of [predecessor, successor] pairs
 */
export function getTopicDependencies() {
  return topicDependencies;
}

/**
 * Get the write strategy configuration.
 * @returns {Readonly<Object>} Write strategy config
 */
export function getWriteStrategyConfig() {
  return writeStrategyConfig;
}
