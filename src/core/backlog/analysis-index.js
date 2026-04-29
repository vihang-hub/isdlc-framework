/**
 * Analysis Index Management
 * ==========================
 * Maintains .isdlc/analysis-index.json — a lightweight index of all analysis
 * items so the dashboard can show progress even when no build workflow is active.
 *
 * BUG-GH-277: Dashboard shows "No Active Workflow" during analysis.
 * Traces: FR-001
 *
 * Design principles:
 * - Fail-open on all I/O errors (Article X)
 * - Synchronous file operations (matches existing backlog module patterns)
 * - No external dependencies
 *
 * @module src/core/backlog/analysis-index
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

/** Analysis phases (ordered) — mirrors item-state.js ANALYSIS_PHASES */
const ANALYSIS_PHASES = [
  '00-quick-scan',
  '01-requirements',
  '02-impact-analysis',
  '03-architecture',
  '04-design'
];

const INDEX_FILENAME = 'analysis-index.json';
const INDEX_VERSION = '1.0.0';

/**
 * Returns the default (empty) index structure.
 * @returns {{ version: string, updated_at: null, items: Array }}
 */
function defaultIndex() {
  return { version: INDEX_VERSION, updated_at: null, items: [] };
}

/**
 * Derives analysis status from phases_completed array.
 * Mirrors deriveAnalysisStatus in item-state.js but simplified (no sizing decision).
 * @param {string[]} phasesCompleted
 * @returns {'raw'|'partial'|'analyzed'}
 */
function deriveStatus(phasesCompleted) {
  if (!Array.isArray(phasesCompleted)) return 'raw';
  const count = phasesCompleted.filter(p => ANALYSIS_PHASES.includes(p)).length;
  if (count === 0) return 'raw';
  if (count < ANALYSIS_PHASES.length) return 'partial';
  return 'analyzed';
}

/**
 * Resolves the path to analysis-index.json within a project root.
 * @param {string} projectRoot
 * @returns {string}
 */
function indexPath(projectRoot) {
  return join(projectRoot, '.isdlc', INDEX_FILENAME);
}

/**
 * Reads .isdlc/analysis-index.json from the project root.
 * Fail-open: returns default index on missing or corrupt file.
 *
 * @param {string} projectRoot - Absolute path to the project root
 * @returns {{ version: string, updated_at: string|null, items: Array }}
 */
export function readAnalysisIndex(projectRoot) {
  const filePath = indexPath(projectRoot);
  if (!existsSync(filePath)) return defaultIndex();

  try {
    const raw = readFileSync(filePath, 'utf8');
    if (!raw.trim()) return defaultIndex();
    const parsed = JSON.parse(raw);
    // Ensure items is always an array
    if (!Array.isArray(parsed.items)) {
      parsed.items = [];
    }
    return parsed;
  } catch {
    return defaultIndex();
  }
}

/**
 * Upserts an item in the analysis index.
 * Creates the file and .isdlc/ directory if they don't exist.
 * Fail-open: logs warning but does not throw on write failure.
 *
 * @param {string} projectRoot - Absolute path to the project root
 * @param {string} slug - The slug identifier (basename of the slug directory)
 * @param {object} meta - The meta.json data for the item
 */
export function updateAnalysisIndex(projectRoot, slug, meta) {
  try {
    // Ensure .isdlc/ directory exists
    const isdlcDir = join(projectRoot, '.isdlc');
    if (!existsSync(isdlcDir)) {
      mkdirSync(isdlcDir, { recursive: true });
    }

    // Read current index (fail-open returns default on corrupt)
    const index = readAnalysisIndex(projectRoot);
    const now = new Date().toISOString();

    // Build the item entry from meta
    const item = {
      slug,
      source_id: meta.source_id || '',
      item_type: meta.item_type || '',
      analysis_status: deriveStatus(meta.phases_completed),
      phases_completed: Array.isArray(meta.phases_completed) ? meta.phases_completed : [],
      created_at: meta.created_at || now,
      last_activity_at: now
    };

    // Upsert: find existing by slug, update or append
    const existingIdx = index.items.findIndex(i => i.slug === slug);
    if (existingIdx >= 0) {
      // Preserve original created_at
      item.created_at = index.items[existingIdx].created_at || item.created_at;
      index.items[existingIdx] = item;
    } else {
      index.items.push(item);
    }

    // Update top-level fields
    index.version = INDEX_VERSION;
    index.updated_at = now;

    // Write back
    writeFileSync(indexPath(projectRoot), JSON.stringify(index, null, 2));
  } catch (_err) {
    // Fail-open per Article X: do not throw
  }
}

/**
 * Rebuilds the analysis index from scratch by scanning all meta.json files
 * in docs/requirements/. Used for cold-start repair.
 *
 * @param {string} projectRoot - Absolute path to the project root
 */
export function rebuildAnalysisIndex(projectRoot) {
  const reqDir = join(projectRoot, 'docs', 'requirements');
  const items = [];

  if (existsSync(reqDir)) {
    let entries;
    try {
      entries = readdirSync(reqDir);
    } catch {
      entries = [];
    }

    for (const entry of entries) {
      const entryPath = join(reqDir, entry);
      // Skip non-directories
      try {
        if (!statSync(entryPath).isDirectory()) continue;
      } catch {
        continue;
      }

      const metaPath = join(entryPath, 'meta.json');
      if (!existsSync(metaPath)) continue;

      try {
        const raw = JSON.parse(readFileSync(metaPath, 'utf8'));
        items.push({
          slug: entry,
          source_id: raw.source_id || '',
          item_type: raw.item_type || '',
          analysis_status: deriveStatus(raw.phases_completed),
          phases_completed: Array.isArray(raw.phases_completed) ? raw.phases_completed : [],
          created_at: raw.created_at || new Date().toISOString(),
          last_activity_at: new Date().toISOString()
        });
      } catch {
        // Skip corrupt meta.json — fail-open
        continue;
      }
    }
  }

  // Ensure .isdlc/ directory exists
  const isdlcDir = join(projectRoot, '.isdlc');
  if (!existsSync(isdlcDir)) {
    mkdirSync(isdlcDir, { recursive: true });
  }

  const index = {
    version: INDEX_VERSION,
    updated_at: new Date().toISOString(),
    items
  };

  writeFileSync(indexPath(projectRoot), JSON.stringify(index, null, 2));
}
