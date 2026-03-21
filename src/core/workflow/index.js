/**
 * Workflow Module — Re-exports
 *
 * REQ-0082: Extract WorkflowRegistry from workflow-loader.cjs
 *
 * @module src/core/workflow
 */

export {
  loadWorkflows,
  resolveExtension,
  validatePhaseOrdering,
  validateWorkflow,
  loadPhaseOrdering,
  buildShippedEntry,
  buildCustomEntry
} from './registry.js';

export {
  KNOWN_PHASE_KEYS,
  PHASE_KEY_ALIASES,
  ANALYSIS_PHASES,
  IMPLEMENTATION_PHASES,
  PHASE_NAME_MAP,
  normalizePhaseKey
} from './constants.js';
