/**
 * CJS Bridge for Task Reader
 *
 * Provides an async CJS-callable interface to the ESM task-reader module.
 * CJS consumers (hooks, legacy scripts) await this bridge, which lazily
 * imports the ESM module via dynamic import() and caches it between calls.
 *
 * Fail-safe: All error paths return null (Article X).
 *   - ESM import failure       → null
 *   - readTaskPlan throws      → null
 *   - readTaskPlan returns null/undefined → null
 *   - readTaskPlan returns { error, reason } → null
 *
 * REQ-GH-232 (Task Completion Gate Hook)
 * Traces: ADR-002
 * @module src/core/bridge/tasks
 * @version 1.0.0
 */

'use strict';

let _taskReaderModule = null;

/**
 * Lazily load and cache the ESM task-reader module.
 * @returns {Promise<object|null>} The imported module, or null on import failure.
 */
async function getTaskReader() {
  if (_taskReaderModule) return _taskReaderModule;
  try {
    _taskReaderModule = await import('../tasks/task-reader.js');
    return _taskReaderModule;
  } catch {
    return null;
  }
}

/**
 * Read and parse a tasks.md file, bridging to the ESM task-reader.
 *
 * @param {string} absolutePath - Absolute path to tasks.md
 * @returns {Promise<import('../tasks/types').TaskPlan|null>}
 *   - TaskPlan on success
 *   - null if file not found, module import fails, parsing throws, or
 *     task-reader returns an error object
 */
async function readTaskPlan(absolutePath) {
  const mod = await getTaskReader();
  if (!mod || typeof mod.readTaskPlan !== 'function') return null;
  try {
    const result = mod.readTaskPlan(absolutePath);
    // Normalize: null, undefined, or { error, reason } all become null
    if (!result) return null;
    if (typeof result === 'object' && 'error' in result) return null;
    return result;
  } catch {
    return null;
  }
}

module.exports = { readTaskPlan };
