/**
 * Item Resolution
 * ================
 * Resolves user input to backlog items using the ADR-0015 priority chain.
 *
 * Extracted from three-verb-utils.cjs (REQ-0083).
 * Traces: FR-002, FR-003, ADR-0015
 *
 * @module src/core/backlog/item-resolution
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { readMetaJson } from './item-state.js';
import { parseBacklogLine } from './backlog-ops.js';

/**
 * Resolves a user input to a backlog item.
 * @param {string} input
 * @param {string} requirementsDir
 * @param {string} backlogPath
 * @returns {object|null}
 */
export function resolveItem(input, requirementsDir, backlogPath) {
  if (!input || typeof input !== 'string') return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  // Strategy 1: Exact slug match
  const slugDir = join(requirementsDir, trimmed);
  if (existsSync(join(slugDir, 'meta.json'))) {
    return { slug: trimmed, dir: slugDir, meta: readMetaJson(slugDir) };
  }

  // Strategy 2: Partial slug match
  if (existsSync(requirementsDir)) {
    try {
      const dirs = readdirSync(requirementsDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

      for (const dir of dirs) {
        if (dir.endsWith('-' + trimmed)) {
          const dirPath = join(requirementsDir, dir);
          if (existsSync(join(dirPath, 'meta.json'))) {
            return { slug: dir, dir: dirPath, meta: readMetaJson(dirPath) };
          }
        }
      }
    } catch { /* silent */ }
  }

  // Strategy 3: Item number match
  if (/^\d+\.\d+$/.test(trimmed)) {
    const item = findBacklogItemByNumber(backlogPath, trimmed, requirementsDir);
    if (item) return item;
  }

  // Strategy 4: External reference
  if (/^#\d+$/.test(trimmed) || /^[A-Z]+-\d+$/i.test(trimmed)) {
    const item = findByExternalRef(trimmed, requirementsDir);
    if (item) return item;
  }

  // Strategy 5: Fuzzy description match
  const matches = searchBacklogTitles(backlogPath, trimmed, requirementsDir);
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) return { multiple: true, matches };

  return null;
}

/**
 * Finds a backlog item by N.N number.
 */
export function findBacklogItemByNumber(backlogPath, itemNumber, requirementsDir) {
  if (!existsSync(backlogPath)) return null;

  const content = readFileSync(backlogPath, 'utf8');
  const lines = content.split('\n');

  for (const line of lines) {
    const parsed = parseBacklogLine(line);
    if (parsed && parsed.itemNumber === itemNumber) {
      const slug = parsed.description.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const dir = findDirForDescription(requirementsDir, parsed.description);
      return {
        slug: dir ? basename(dir) : slug,
        dir: dir || null,
        meta: dir ? readMetaJson(dir) : null,
        backlogLine: line,
        itemNumber: parsed.itemNumber
      };
    }
  }

  return null;
}

/**
 * Finds a backlog item by external reference in meta.json files.
 */
export function findByExternalRef(ref, requirementsDir) {
  if (!existsSync(requirementsDir)) return null;

  const normalizedRef = ref.startsWith('#') ? `GH-${ref.substring(1)}` : ref;

  try {
    const dirs = readdirSync(requirementsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const dir of dirs) {
      const dirPath = join(requirementsDir, dir);
      const meta = readMetaJson(dirPath);
      if (meta && meta.source_id) {
        if (meta.source_id === normalizedRef ||
            meta.source_id === ref ||
            meta.source_id.toLowerCase() === ref.toLowerCase()) {
          return { slug: dir, dir: dirPath, meta };
        }
      }
    }
  } catch { /* silent */ }

  return null;
}

/**
 * Searches BACKLOG.md titles for fuzzy substring matches.
 */
export function searchBacklogTitles(backlogPath, query, requirementsDir) {
  if (!existsSync(backlogPath)) return [];

  const content = readFileSync(backlogPath, 'utf8');
  const lines = content.split('\n');
  const matches = [];
  const queryLower = query.toLowerCase();

  for (const line of lines) {
    const parsed = parseBacklogLine(line);
    if (parsed && parsed.description.toLowerCase().includes(queryLower)) {
      const dir = findDirForDescription(requirementsDir, parsed.description);
      matches.push({
        slug: dir ? basename(dir) : parsed.description.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        dir: dir || null,
        meta: dir ? readMetaJson(dir) : null,
        backlogLine: line,
        itemNumber: parsed.itemNumber,
        title: parsed.description
      });
    }
  }

  return matches;
}

/**
 * Tries to find a requirements directory matching a description.
 */
export function findDirForDescription(requirementsDir, description) {
  if (!existsSync(requirementsDir)) return null;

  const descSlug = description.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  try {
    const dirs = readdirSync(requirementsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    if (dirs.includes(descSlug)) {
      return join(requirementsDir, descSlug);
    }

    for (const dir of dirs) {
      if (dir.endsWith('-' + descSlug) || dir.includes(descSlug)) {
        return join(requirementsDir, dir);
      }
    }
  } catch { /* silent */ }

  return null;
}
