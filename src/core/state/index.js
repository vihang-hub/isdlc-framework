/**
 * Minimal StateStore — read/write .isdlc/state.json with atomic writes
 *
 * Part of the shared core extracted by REQ-0076 (Vertical Spike).
 * Provides project root discovery, state reading, and atomic state writing.
 *
 * Requirements: FR-001 (AC-001-01), FR-003 (AC-003-01, AC-003-02)
 *
 * @module src/core/state
 */

import { readFile, writeFile, rename, mkdtemp, rm } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Read and parse .isdlc/state.json from the given project root.
 *
 * @param {string} projectRoot - Absolute path to the project root directory
 * @returns {Promise<object>} Parsed state object
 * @throws {Error} If state.json does not exist or contains invalid JSON
 */
export async function readState(projectRoot) {
  const statePath = join(projectRoot, '.isdlc', 'state.json');
  const raw = await readFile(statePath, 'utf-8');
  return JSON.parse(raw);
}

/**
 * Atomically write state to .isdlc/state.json.
 *
 * Uses a write-to-temp-then-rename strategy to prevent partial writes.
 * Creates the .isdlc/ directory if it does not exist.
 *
 * @param {string} projectRoot - Absolute path to the project root directory
 * @param {object} state - State object to serialize
 * @returns {Promise<void>}
 * @throws {TypeError} If state cannot be serialized (e.g., circular references)
 */
export async function writeState(projectRoot, state) {
  const isdlcDir = join(projectRoot, '.isdlc');
  const statePath = join(isdlcDir, 'state.json');

  // Ensure .isdlc/ directory exists (FR-003, AC-003-01; ST-11)
  if (!existsSync(isdlcDir)) {
    mkdirSync(isdlcDir, { recursive: true });
  }

  // Serialize first — if this throws (e.g., circular ref), no file is touched (ST-06)
  const serialized = JSON.stringify(state, null, 2);

  // Atomic write: temp file in same directory, then rename (FR-003, AC-003-02)
  const tempPath = join(isdlcDir, `.state-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
  try {
    await writeFile(tempPath, serialized, 'utf-8');
    await rename(tempPath, statePath);
  } catch (err) {
    // Clean up temp file if rename failed
    try { await rm(tempPath, { force: true }); } catch { /* ignore cleanup errors */ }
    throw err;
  }
}

/**
 * Find the project root by walking up from startDir looking for .isdlc/.
 *
 * Looks for either .isdlc/state.json or .isdlc/monorepo.json to identify
 * the project root directory.
 *
 * @param {string} [startDir=process.cwd()] - Directory to start searching from
 * @returns {string} Absolute path to the project root
 * @throws {Error} If no .isdlc/ directory is found in any parent
 */
export function getProjectRoot(startDir = process.cwd()) {
  let current = resolve(startDir);
  const root = dirname(current) === current ? current : '/';

  while (true) {
    const isdlcDir = join(current, '.isdlc');
    if (
      existsSync(join(isdlcDir, 'state.json')) ||
      existsSync(join(isdlcDir, 'monorepo.json'))
    ) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      // Reached filesystem root without finding .isdlc/
      throw new Error(
        `Could not find .isdlc/ directory in "${startDir}" or any parent directory. ` +
        'Is this an iSDLC project? Run "isdlc discover" to initialize.'
      );
    }
    current = parent;
  }
}
