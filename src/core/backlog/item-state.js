/**
 * Item State Management
 * ======================
 * Read/write meta.json and derive analysis status/markers.
 *
 * Extracted from three-verb-utils.cjs (REQ-0083).
 * Traces: FR-009, FR-007, ADR-0013, ADR-0014
 *
 * @module src/core/backlog/item-state
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename, dirname, resolve } from 'node:path';
import { updateAnalysisIndex } from './analysis-index.js';

/**
 * Analysis phases (ordered).
 */
const ANALYSIS_PHASES = [
  '00-quick-scan',
  '01-requirements',
  '02-impact-analysis',
  '03-architecture',
  '04-design'
];

/**
 * Reads and normalizes meta.json from a slug directory.
 * @param {string} slugDir - Absolute path to the slug directory
 * @returns {object|null} Parsed meta or null
 */
export function readMetaJson(slugDir) {
  const metaPath = join(slugDir, 'meta.json');
  if (!existsSync(metaPath)) return null;

  let raw;
  try {
    raw = JSON.parse(readFileSync(metaPath, 'utf8'));
  } catch {
    return null;
  }

  // Legacy migration
  if ('phase_a_completed' in raw && !('analysis_status' in raw)) {
    if (raw.phase_a_completed === true) {
      raw.analysis_status = 'analyzed';
      raw.phases_completed = ['00-quick-scan', '01-requirements', '02-impact-analysis', '03-architecture', '04-design'];
    } else {
      raw.analysis_status = 'raw';
      raw.phases_completed = [];
    }
  }

  if (!raw.analysis_status) raw.analysis_status = 'raw';
  if (!Array.isArray(raw.phases_completed)) raw.phases_completed = [];
  if (!raw.source) raw.source = 'manual';
  if (!raw.created_at) raw.created_at = new Date().toISOString();
  if (!Array.isArray(raw.steps_completed)) raw.steps_completed = [];
  if (typeof raw.depth_overrides !== 'object' || raw.depth_overrides === null || Array.isArray(raw.depth_overrides)) {
    raw.depth_overrides = {};
  }
  if (!Array.isArray(raw.elaborations)) raw.elaborations = [];
  if (typeof raw.elaboration_config !== 'object' || raw.elaboration_config === null || Array.isArray(raw.elaboration_config)) {
    raw.elaboration_config = {};
  }

  return raw;
}

/**
 * Writes meta.json to a slug directory.
 * @param {string} slugDir - Absolute path to the slug directory
 * @param {object} meta - The meta object to write
 */
export function writeMetaJson(slugDir, meta) {
  const metaPath = join(slugDir, 'meta.json');
  delete meta.phase_a_completed;
  meta.analysis_status = deriveAnalysisStatus(meta.phases_completed, meta.sizing_decision);
  writeFileSync(metaPath, JSON.stringify(meta, null, 2));

  // BUG-GH-277: Update the analysis index after writing meta.json.
  // Derive projectRoot by walking up from slugDir (docs/requirements/{slug}/).
  // Fail-open: if updateAnalysisIndex fails, meta.json is still written.
  try {
    const slug = basename(slugDir);
    const projectRoot = deriveProjectRoot(slugDir);
    if (projectRoot) {
      updateAnalysisIndex(projectRoot, slug, meta);
    }
  } catch (_e) {
    // Fail-open per Article X
  }
}

/**
 * Derives the project root from a slug directory path by walking up
 * to find the directory containing .isdlc/.
 * @param {string} slugDir - e.g. /path/to/project/docs/requirements/BUG-GH-277-fix
 * @returns {string|null} Project root path or null if not found
 */
function deriveProjectRoot(slugDir) {
  let dir = resolve(slugDir);
  const root = dirname(dir).substring(0, 1) === '/' ? '/' : dirname(dir).substring(0, 3); // handle unix and windows
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, '.isdlc'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null; // reached filesystem root
    dir = parent;
  }
  return null;
}

/**
 * Derives analysis status from completed phases.
 * @param {string[]} phasesCompleted
 * @param {object} [sizingDecision]
 * @returns {'raw'|'partial'|'analyzed'}
 */
export function deriveAnalysisStatus(phasesCompleted, sizingDecision) {
  if (!Array.isArray(phasesCompleted)) return 'raw';

  const completedCount = phasesCompleted.filter(p => ANALYSIS_PHASES.includes(p)).length;
  if (completedCount === 0) return 'raw';

  if (sizingDecision
    && sizingDecision.effective_intensity === 'light'
    && Array.isArray(sizingDecision.light_skip_phases)) {
    const skipSet = new Set(sizingDecision.light_skip_phases);
    const required = ANALYSIS_PHASES.filter(p => !skipSet.has(p));
    if (required.every(p => phasesCompleted.includes(p))) return 'analyzed';
  }

  if (completedCount < ANALYSIS_PHASES.length) return 'partial';
  return 'analyzed';
}

/**
 * Maps analysis status to a BACKLOG.md marker character.
 * @param {string} analysisStatus
 * @returns {string} Marker character: ' ', '~', or 'A'
 */
export function deriveBacklogMarker(analysisStatus) {
  switch (analysisStatus) {
    case 'raw':      return ' ';
    case 'partial':  return '~';
    case 'analyzed': return 'A';
    default:         return ' ';
  }
}
