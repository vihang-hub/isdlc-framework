/**
 * iSDLC Shared Test Utilities
 *
 * Provides temp directory management, project scaffolding, and console capture
 * for use across all ESM test files. Uses only Node built-in modules.
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mock } from 'node:test';

/**
 * Create a temporary directory with the isdlc- prefix.
 * @returns {string} Absolute path to the new temp directory
 */
export function createTempDir() {
  return mkdtempSync(join(tmpdir(), 'isdlc-'));
}

/**
 * Remove a temporary directory and all its contents.
 * Silently ignores missing directories.
 * @param {string} dir - Absolute path to remove
 */
export function cleanupTempDir(dir) {
  if (dir && existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Create a realistic project directory with configurable marker files.
 *
 * @param {object} options
 * @param {string}  [options.name]           - Subdirectory name (default: 'test-project')
 * @param {object}  [options.packageJson]    - Contents for package.json (written as JSON)
 * @param {boolean|string} [options.goMod]   - true writes a minimal go.mod; string writes custom content
 * @param {boolean|string} [options.cargoToml] - true writes a minimal Cargo.toml; string writes custom content
 * @param {boolean|object} [options.pyprojectToml] - true writes minimal pyproject.toml; string writes custom content
 * @param {boolean} [options.srcDir]         - true creates a src/ subdirectory
 * @param {object}  [options.files]          - Map of relative path -> content for arbitrary files
 * @returns {string} Absolute path to the created project directory
 */
export function createProjectDir(options = {}) {
  const {
    name = 'test-project',
    packageJson,
    goMod,
    cargoToml,
    pyprojectToml,
    srcDir,
    files,
  } = options;

  const base = createTempDir();
  const projectDir = join(base, name);
  mkdirSync(projectDir, { recursive: true });

  if (packageJson) {
    writeFileSync(join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2), 'utf-8');
  }

  if (goMod) {
    const content = typeof goMod === 'string' ? goMod : 'module example.com/test\n\ngo 1.21\n';
    writeFileSync(join(projectDir, 'go.mod'), content, 'utf-8');
  }

  if (cargoToml) {
    const content =
      typeof cargoToml === 'string'
        ? cargoToml
        : '[package]\nname = "test"\nversion = "0.1.0"\nedition = "2021"\n';
    writeFileSync(join(projectDir, 'Cargo.toml'), content, 'utf-8');
  }

  if (pyprojectToml) {
    const content =
      typeof pyprojectToml === 'string'
        ? pyprojectToml
        : '[project]\nname = "test"\nversion = "0.1.0"\n';
    writeFileSync(join(projectDir, 'pyproject.toml'), content, 'utf-8');
  }

  if (srcDir) {
    mkdirSync(join(projectDir, 'src'), { recursive: true });
  }

  if (files && typeof files === 'object') {
    for (const [relativePath, content] of Object.entries(files)) {
      const fullPath = join(projectDir, relativePath);
      const parentDir = join(fullPath, '..');
      mkdirSync(parentDir, { recursive: true });
      writeFileSync(fullPath, content, 'utf-8');
    }
  }

  return projectDir;
}

/**
 * Capture console.log calls using node:test mock infrastructure.
 *
 * Usage:
 *   const capture = captureConsole();
 *   // ... code that calls console.log ...
 *   console.log(capture.calls);  // array of argument arrays
 *   capture.restore();
 *
 * @returns {{ calls: Array<any[]>, restore: () => void }}
 */
export function captureConsole() {
  mock.method(console, 'log');

  return {
    /**
     * All captured call argument arrays.
     * Each entry is the array of arguments passed to a single console.log() call.
     */
    get calls() {
      return console.log.mock.calls.map((c) => c.arguments);
    },

    /**
     * Restore the original console.log implementation.
     */
    restore() {
      console.log.mock.restore();
    },
  };
}
