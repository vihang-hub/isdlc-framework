/**
 * Memory Layering Model — layer schema, merge rules, search config, pipeline
 *
 * Frozen metadata about the existing memory subsystem (lib/memory*.js).
 * This module describes the schema — it does NOT replace the runtime.
 *
 * Requirements: REQ-0111 FR-001 (AC-001-01..02), FR-002 (AC-002-01..03),
 *               FR-003 (AC-003-01..03), FR-004 (AC-004-01..02),
 *               FR-005 (AC-005-01..04)
 * @module src/core/analyze/memory-model
 */

// ---------------------------------------------------------------------------
// FR-001: Memory Layer Schema (AC-001-01..02)
// ---------------------------------------------------------------------------

const layerSchema = Object.freeze({
  user: Object.freeze({
    paths: Object.freeze(['profile.json', 'sessions/']),
    format: 'json_file_and_directory',
    fail_open: true,
    description: 'User-level preferences and session history'
  }),
  project: Object.freeze({
    paths: Object.freeze(['roundtable-memory.json']),
    format: 'json_file',
    fail_open: true,
    description: 'Project-level roundtable memory and history'
  }),
  session: Object.freeze({
    paths: Object.freeze([]),
    format: 'in_memory',
    fail_open: true,
    description: 'Current session record, not persisted until enrichment'
  })
});

// ---------------------------------------------------------------------------
// FR-002: Merge Rules (AC-002-01..03)
// ---------------------------------------------------------------------------

const mergeRules = Object.freeze({
  priority: Object.freeze(['user', 'project', 'session']),
  conflict_threshold: 0.5,
  strategy: 'user_overrides_project'
});

// ---------------------------------------------------------------------------
// FR-003: Search Strategy Config (AC-003-01..03)
// ---------------------------------------------------------------------------

const searchConfig = Object.freeze({
  prefer: 'hybrid',
  fallback: 'legacy',
  fail_open_on_missing_index: true
});

// ---------------------------------------------------------------------------
// FR-004: Enrichment Pipeline (AC-004-01..02)
// ---------------------------------------------------------------------------

const enrichmentPipeline = Object.freeze([
  Object.freeze({ id: 'writeSessionRecord', order: 1, async: false }),
  Object.freeze({ id: 'embedSession',       order: 2, async: true  }),
  Object.freeze({ id: 'vectorStore',        order: 3, async: true  }),
  Object.freeze({ id: 'searchIndex',        order: 4, async: true  })
]);

// ---------------------------------------------------------------------------
// FR-005: Registry Functions (AC-005-01..04)
// ---------------------------------------------------------------------------

/**
 * Get the 3-layer memory schema.
 * @returns {Readonly<Object>} Frozen layer schema
 */
export function getMemoryLayerSchema() {
  return layerSchema;
}

/**
 * Get the merge rules configuration.
 * @returns {Readonly<Object>} Frozen merge rules
 */
export function getMergeRules() {
  return mergeRules;
}

/**
 * Get the search strategy configuration.
 * @returns {Readonly<Object>} Frozen search config
 */
export function getSearchStrategyConfig() {
  return searchConfig;
}

/**
 * Get the enrichment pipeline steps.
 * @returns {Readonly<Array>} Frozen pipeline steps
 */
export function getEnrichmentPipeline() {
  return enrichmentPipeline;
}
