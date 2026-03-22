/**
 * Analyze Lifecycle — entry routing model, prefetch graph, bug classification
 *
 * Frozen configuration data extracted from the analyze command entry path.
 * Pure data — no runtime logic.
 *
 * Requirements: REQ-0108 FR-001 (AC-001-01..04), FR-002 (AC-002-01..03),
 *               FR-003 (AC-003-01..03), FR-004 (AC-004-01..03)
 * @module src/core/analyze/lifecycle
 */

// ---------------------------------------------------------------------------
// FR-001: Entry Routing Model (AC-001-01..04)
// ---------------------------------------------------------------------------

const entryRoutingModel = Object.freeze({
  flags: Object.freeze({
    recognized: Object.freeze(['--folder', '--interrupt', '--resume', '--provider']),
    types: Object.freeze({ '--folder': 'string', '--interrupt': 'boolean', '--resume': 'boolean', '--provider': 'string' }),
    defaults: Object.freeze({ '--interrupt': false, '--resume': false })
  }),
  staleness_check: Object.freeze({
    enabled: true,
    threshold_field: 'codebase_hash',
    action_on_stale: 'warn_and_continue'
  }),
  sizing_precheck: Object.freeze({
    enabled: true,
    trivial_threshold: 'trivial',
    tiers: Object.freeze(['trivial', 'light', 'standard'])
  }),
  classification_gate: 'bug_vs_feature',
  routing: Object.freeze({
    bug: 'fix_handler',
    feature: 'analyze_handler',
    ambiguous: 'prompt_user'
  })
});

// ---------------------------------------------------------------------------
// FR-002: Prefetch Dependency Graph (AC-002-01..03)
// ---------------------------------------------------------------------------

const prefetchGraph = Object.freeze([
  Object.freeze({ id: 'issue_tracker',       source: 'github_api',                            fallback: null,       fail_open: true, parallel: true }),
  Object.freeze({ id: 'requirements_folder', source: 'docs/requirements/{slug}',              fallback: '{}',       fail_open: true, parallel: true }),
  Object.freeze({ id: 'memory',              source: 'lib/memory.js',                         fallback: '[]',       fail_open: true, parallel: true }),
  Object.freeze({ id: 'personas',            source: 'src/claude/agents/roundtable-*.md',     fallback: 'defaults', fail_open: true, parallel: true }),
  Object.freeze({ id: 'topics',              source: 'src/claude/skills/roundtable/topics/',   fallback: '[]',       fail_open: true, parallel: true }),
  Object.freeze({ id: 'discovery',           source: '.isdlc/discovery.json',                  fallback: '{}',       fail_open: true, parallel: true })
]);

// ---------------------------------------------------------------------------
// FR-003: Bug Classification Signals (AC-003-01..03)
// ---------------------------------------------------------------------------

const bugClassificationSignals = Object.freeze({
  bug_signals:     Object.freeze(['broken', 'fix', 'bug', 'crash', 'error', 'wrong', 'failing', 'not working', '500']),
  feature_signals: Object.freeze(['add', 'build', 'create', 'implement', 'design', 'refactor', 'upgrade', 'migrate'])
});

// ---------------------------------------------------------------------------
// FR-004: Registry Functions (AC-004-01..03)
// ---------------------------------------------------------------------------

/**
 * Get the full entry routing model.
 * @returns {Readonly<Object>} Frozen routing config
 */
export function getEntryRoutingModel() {
  return entryRoutingModel;
}

/**
 * Get the 6-group prefetch dependency graph.
 * @returns {Readonly<Array>} Frozen array of prefetch groups
 */
export function getPrefetchGraph() {
  return prefetchGraph;
}

/**
 * Get bug and feature classification signal lists.
 * @returns {Readonly<{bug_signals: string[], feature_signals: string[]}>}
 */
export function getBugClassificationSignals() {
  return bugClassificationSignals;
}
