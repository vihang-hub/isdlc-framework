/**
 * Workflow Constants
 * ==================
 * Phase ID constants, canonical phase ordering, and normalizePhaseKey.
 *
 * REQ-0082: Extract WorkflowRegistry from workflow-loader.cjs
 * Re-exports from src/core/config/phase-ids.js for backward compatibility.
 *
 * @module src/core/workflow/constants
 */

export {
  KNOWN_PHASE_KEYS,
  PHASE_KEY_ALIASES,
  ANALYSIS_PHASES,
  IMPLEMENTATION_PHASES,
  PHASE_NAME_MAP,
  normalizePhaseKey
} from '../config/phase-ids.js';
