/**
 * Phase ID Constants
 * ==================
 * Canonical phase identifiers and aliases for the iSDLC framework.
 *
 * REQ-0125: Move gate profiles, schemas, and phase IDs to src/core/config/
 * Traces: REQ-0082 (phase constants extraction)
 *
 * @module src/core/config/phase-ids
 */

/**
 * All known phase keys in canonical order.
 * @type {ReadonlyArray<string>}
 */
export const KNOWN_PHASE_KEYS = Object.freeze([
  '00-quick-scan',
  '01-requirements',
  '02-impact-analysis',
  '02-tracing',
  '03-architecture',
  '04-design',
  '05-test-strategy',
  '06-implementation',
  '07-testing',
  '08-code-review',
  '09-validation',
  '10-cicd',
  '11-local-testing',
  '12-remote-build',
  '12-test-deploy',
  '13-production',
  '14-operations',
  '15-upgrade-plan',
  '15-upgrade-execute',
  '15-upgrade',
  '16-quality-loop'
]);

/**
 * Phase key alias map. Legacy workflow keys map to canonical
 * iteration-requirements.json keys.
 * @type {Readonly<Record<string, string>>}
 */
export const PHASE_KEY_ALIASES = Object.freeze({
  '13-test-deploy': '12-test-deploy',
  '14-production': '13-production',
  '15-operations': '14-operations',
  '16-upgrade-plan': '15-upgrade-plan',
  '16-upgrade-execute': '15-upgrade-execute'
});

/**
 * Analysis phase keys (ordered).
 * @type {ReadonlyArray<string>}
 */
export const ANALYSIS_PHASES = Object.freeze([
  '00-quick-scan',
  '01-requirements',
  '02-impact-analysis',
  '03-architecture',
  '04-design'
]);

/**
 * Implementation phase keys (ordered).
 * @type {ReadonlyArray<string>}
 */
export const IMPLEMENTATION_PHASES = Object.freeze([
  '05-test-strategy',
  '06-implementation',
  '16-quality-loop',
  '08-code-review'
]);

/**
 * Phase display name mapping.
 * @type {Readonly<Record<string, string>>}
 */
export const PHASE_NAME_MAP = Object.freeze({
  '00-quick-scan': 'Quick Scan',
  '01-requirements': 'Requirements',
  '02-impact-analysis': 'Impact Analysis',
  '02-tracing': 'Tracing',
  '03-architecture': 'Architecture',
  '04-design': 'Design',
  '05-test-strategy': 'Test Strategy',
  '06-implementation': 'Implementation',
  '07-testing': 'Testing',
  '08-code-review': 'Code Review',
  '16-quality-loop': 'Quality Loop'
});

/**
 * Normalize a phase key using the alias map.
 * Returns the canonical key if an alias exists, otherwise returns the input unchanged.
 * @param {string} key - Phase key
 * @returns {string} Canonical phase key
 */
export function normalizePhaseKey(key) {
  if (!key || typeof key !== 'string') return key;
  return PHASE_KEY_ALIASES[key] || key;
}
