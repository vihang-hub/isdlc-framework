/**
 * iSDLC File System Helpers
 *
 * Cross-platform file operations using fs-extra.
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

/**
 * Get the framework directory (where the npm package is installed)
 * The framework sources are in src/ (claude/ and isdlc/ subdirectories)
 * @returns {string} Framework directory path
 */
export function getFrameworkDir() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, '..', '..', 'src');
}

/**
 * Get the package root directory
 * @returns {string} Package root directory path
 */
export function getPackageRoot() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, '..', '..');
}

/**
 * Check if a path exists
 * @param {string} targetPath - Path to check
 * @returns {Promise<boolean>} True if exists
 */
export async function exists(targetPath) {
  return fs.pathExists(targetPath);
}

/**
 * Check if a path exists (sync)
 * @param {string} targetPath - Path to check
 * @returns {boolean} True if exists
 */
export function existsSync(targetPath) {
  return fs.pathExistsSync(targetPath);
}

/**
 * Ensure a directory exists, creating it if necessary
 * @param {string} dirPath - Directory path
 */
export async function ensureDir(dirPath) {
  await fs.ensureDir(dirPath);
}

/**
 * Copy a file or directory
 * @param {string} src - Source path
 * @param {string} dest - Destination path
 * @param {object} options - Copy options
 */
export async function copy(src, dest, options = {}) {
  await fs.copy(src, dest, options);
}

/**
 * Copy a directory recursively
 * @param {string} src - Source directory
 * @param {string} dest - Destination directory
 * @param {object} options - Copy options
 */
export async function copyDir(src, dest, options = {}) {
  await fs.copy(src, dest, {
    overwrite: true,
    ...options,
  });
}

/**
 * Read a JSON file
 * @param {string} filePath - Path to JSON file
 * @returns {Promise<any>} Parsed JSON content
 */
export async function readJson(filePath) {
  return fs.readJson(filePath);
}

/**
 * Write a JSON file
 * @param {string} filePath - Path to JSON file
 * @param {any} data - Data to write
 * @param {object} options - Write options
 */
export async function writeJson(filePath, data, options = {}) {
  await fs.writeJson(filePath, data, {
    spaces: 2,
    ...options,
  });
}

/**
 * Read a file as text
 * @param {string} filePath - Path to file
 * @returns {Promise<string>} File content
 */
export async function readFile(filePath) {
  return fs.readFile(filePath, 'utf-8');
}

/**
 * Write text to a file
 * @param {string} filePath - Path to file
 * @param {string} content - Content to write
 */
export async function writeFile(filePath, content) {
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Remove a file or directory
 * @param {string} targetPath - Path to remove
 */
export async function remove(targetPath) {
  await fs.remove(targetPath);
}

/**
 * List directory contents
 * @param {string} dirPath - Directory path
 * @returns {Promise<string[]>} Array of file/directory names
 */
export async function readdir(dirPath) {
  return fs.readdir(dirPath);
}

/**
 * Get file/directory stats
 * @param {string} targetPath - Path to stat
 * @returns {Promise<fs.Stats>} Stats object
 */
export async function stat(targetPath) {
  return fs.stat(targetPath);
}

/**
 * Check if path is a directory
 * @param {string} targetPath - Path to check
 * @returns {Promise<boolean>} True if directory
 */
export async function isDirectory(targetPath) {
  try {
    const stats = await fs.stat(targetPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Check if path is a file
 * @param {string} targetPath - Path to check
 * @returns {Promise<boolean>} True if file
 */
export async function isFile(targetPath) {
  try {
    const stats = await fs.stat(targetPath);
    return stats.isFile();
  } catch {
    return false;
  }
}

/**
 * Find files matching a pattern in a directory
 * @param {string} dirPath - Directory to search
 * @param {RegExp|function} filter - Filter function or regex
 * @returns {Promise<string[]>} Matching file paths
 */
export async function findFiles(dirPath, filter) {
  const results = [];

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const matches =
          typeof filter === 'function' ? filter(fullPath, entry.name) : filter.test(entry.name);

        if (matches) {
          results.push(fullPath);
        }
      }
    }
  }

  if (await exists(dirPath)) {
    await walk(dirPath);
  }

  return results;
}

/**
 * Merge two JSON objects (deep merge)
 * @param {object} target - Target object
 * @param {object} source - Source object
 * @returns {object} Merged object
 */
export function deepMerge(target, source) {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

/**
 * Convert a YAML file to JSON using yq or python3 (same fallback chain as install.sh).
 * Returns true on success, false if no converter is available.
 * @param {string} yamlPath - Path to source YAML file
 * @param {string} jsonPath - Path to write JSON output
 * @returns {boolean} True if conversion succeeded
 */
export function convertYamlToJson(yamlPath, jsonPath) {
  try {
    execSync(`yq -o=json "${yamlPath}" > "${jsonPath}"`, { stdio: 'pipe' });
    return true;
  } catch { /* yq not available */ }

  try {
    const pyCmd = `python3 -c "import yaml,json;f=open('${yamlPath}');d=yaml.safe_load(f);f.close();o=open('${jsonPath}','w');json.dump(d,o,indent=2);o.close()"`;
    execSync(pyCmd, { stdio: 'pipe' });
    return true;
  } catch { /* python3+PyYAML not available */ }

  return false;
}

export default {
  getFrameworkDir,
  getPackageRoot,
  exists,
  existsSync,
  ensureDir,
  copy,
  copyDir,
  readJson,
  writeJson,
  readFile,
  writeFile,
  remove,
  readdir,
  stat,
  isDirectory,
  isFile,
  findFiles,
  deepMerge,
  convertYamlToJson,
};
