/**
 * FileHashManifest — filesystem walk + SHA-256 per file for incremental diff.
 *
 * Computes {relative-path: sha256-hex} manifest over a directory tree.
 * Produces diff between two manifests (changed, added, deleted sets).
 *
 * REQ-GH-227 / FR-004 / AC-004-01, AC-004-02, AC-004-03
 * @module lib/embedding/incremental/file-hash
 */

import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, sep, posix } from 'node:path';

const DEFAULT_EXCLUDES = [
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  '.isdlc',
  '.claude',
  'dist',
  'build',
  'coverage',
  '.embeddings'
];

/**
 * Compute SHA-256 hex of a file's raw bytes.
 * @param {string} filePath - Absolute path
 * @returns {Promise<string|null>} Hex digest, or null on error
 */
export async function computeFileHash(filePath) {
  try {
    const buf = await readFile(filePath);
    return createHash('sha256').update(buf).digest('hex');
  } catch {
    return null;
  }
}

/**
 * Recursively walk a directory, computing SHA-256 for each file.
 *
 * @param {string} rootPath - Absolute root path to walk
 * @param {{ exclude?: string[], includeExtensions?: string[] }} [options]
 * @returns {Promise<Object>} { [relativePath]: sha256Hex }
 */
export async function computeManifest(rootPath, options = {}) {
  const exclude = options.exclude || DEFAULT_EXCLUDES;
  const includeExts = options.includeExtensions || null;
  const manifest = {};

  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      // Skip excluded directories/files by name
      if (exclude.includes(entry.name)) continue;
      // Skip hidden dotfiles except when explicitly not excluded
      if (entry.name.startsWith('.') && entry.name !== '.') continue;

      const full = join(dir, entry.name);

      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        // Extension filter
        if (includeExts) {
          const lowerName = entry.name.toLowerCase();
          const matches = includeExts.some(ext => lowerName.endsWith(ext.toLowerCase()));
          if (!matches) continue;
        }

        const hash = await computeFileHash(full);
        if (hash) {
          const rel = relative(rootPath, full).split(sep).join(posix.sep);
          manifest[rel] = hash;
        }
      }
    }
  }

  try {
    const s = await stat(rootPath);
    if (!s.isDirectory()) return {};
  } catch {
    return {};
  }

  await walk(rootPath);
  return manifest;
}

/**
 * Compute the diff between two manifests.
 *
 * @param {Object|null} prior - Prior manifest (hash map)
 * @param {Object|null} current - Current manifest
 * @returns {{ changed: string[], added: string[], deleted: string[] }}
 */
export function diffManifests(prior, current) {
  const p = prior || {};
  const c = current || {};

  const changed = [];
  const added = [];
  const deleted = [];

  for (const path of Object.keys(c)) {
    if (!(path in p)) {
      added.push(path);
    } else if (p[path] !== c[path]) {
      changed.push(path);
    }
  }

  for (const path of Object.keys(p)) {
    if (!(path in c)) {
      deleted.push(path);
    }
  }

  changed.sort();
  added.sort();
  deleted.sort();

  return { changed, added, deleted };
}
