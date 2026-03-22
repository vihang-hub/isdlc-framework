/**
 * Codex Adapter — Entry Point
 * =============================
 * Codex adapter boundary for iSDLC (REQ-0114).
 *
 * Exports the Codex-specific adapter interface:
 * - getCodexConfig() — Provider identity and framework directory
 * - getProjectionPaths() — .codex/ directory projection paths
 * - projectInstructions() — Instruction projection service (REQ-0116)
 * - installCodex/updateCodex/uninstallCodex/doctorCodex — Installer (REQ-0115)
 * - getGovernanceModel/validateCheckpoint — Governance (REQ-0117)
 *
 * @module src/providers/codex
 */

// Config + projection paths + instruction projection (REQ-0114, REQ-0116)
export { getCodexConfig, getProjectionPaths, projectInstructions } from './projection.js';

// Installer (REQ-0115)
export { installCodex, updateCodex, uninstallCodex, doctorCodex } from './installer.js';

// Governance (REQ-0117)
export { getGovernanceModel, validateCheckpoint } from './governance.js';
