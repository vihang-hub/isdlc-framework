/**
 * CJS Bridge for src/core/teams/implementation-loop.js
 *
 * Allows CJS consumers (hooks, legacy scripts) to use the ESM
 * ImplementationLoop via dynamic import(). The factory method returns
 * a Promise that resolves to an ImplementationLoop instance.
 *
 * Part of the shared core extracted by REQ-0076 (Vertical Spike).
 * Per ADR-CODEX-006: Core in ESM with CJS bridge.
 *
 * Requirements: FR-001 (AC-001-02)
 */

let _module;

async function load() {
  if (!_module) _module = await import('../teams/implementation-loop.js');
  return _module;
}

module.exports = {
  async createImplementationLoop(teamSpec, loopState) {
    const m = await load();
    return new m.ImplementationLoop(teamSpec, loopState);
  }
};
