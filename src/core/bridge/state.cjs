/**
 * CJS Bridge for src/core/state/index.js
 *
 * Allows CJS consumers (hooks, legacy scripts) to use the ESM StateStore
 * via dynamic import(). All methods return Promises.
 *
 * Part of the shared core extracted by REQ-0076 (Vertical Spike).
 * Per ADR-CODEX-006: Core in ESM with CJS bridge.
 *
 * Requirements: FR-001 (AC-001-02)
 */

let _module;

async function load() {
  if (!_module) _module = await import('../state/index.js');
  return _module;
}

module.exports = {
  async readState(projectRoot) {
    const m = await load();
    return m.readState(projectRoot);
  },

  async writeState(projectRoot, state) {
    const m = await load();
    return m.writeState(projectRoot, state);
  },

  async getProjectRoot(startDir) {
    const m = await load();
    return m.getProjectRoot(startDir);
  }
};
