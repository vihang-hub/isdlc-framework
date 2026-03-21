/**
 * CJS Bridge for src/core/backlog/ modules
 *
 * REQ-0083: Extract BacklogService + ItemStateService
 * Per ADR-CODEX-006: Core in ESM with CJS bridge.
 */

'use strict';

let _slugModule;
let _sourceModule;
let _itemStateModule;
let _backlogOpsModule;
let _itemResolutionModule;
let _githubModule;

async function loadSlug() {
  if (!_slugModule) _slugModule = await import('../backlog/slug.js');
  return _slugModule;
}
async function loadSource() {
  if (!_sourceModule) _sourceModule = await import('../backlog/source-detection.js');
  return _sourceModule;
}
async function loadItemState() {
  if (!_itemStateModule) _itemStateModule = await import('../backlog/item-state.js');
  return _itemStateModule;
}
async function loadBacklogOps() {
  if (!_backlogOpsModule) _backlogOpsModule = await import('../backlog/backlog-ops.js');
  return _backlogOpsModule;
}
async function loadItemResolution() {
  if (!_itemResolutionModule) _itemResolutionModule = await import('../backlog/item-resolution.js');
  return _itemResolutionModule;
}
async function loadGithub() {
  if (!_githubModule) _githubModule = await import('../backlog/github.js');
  return _githubModule;
}

let _syncSlug = null;
let _syncSource = null;
let _syncItemState = null;
let _syncBacklogOps = null;
let _syncItemResolution = null;
let _syncGithub = null;

// =========================================================================
// Slug
// =========================================================================

function generateSlug(description) {
  if (_syncSlug) return _syncSlug.generateSlug(description);
  return _generateSlugSync(description);
}

function _generateSlugSync(description) {
  if (!description || typeof description !== 'string') return 'untitled-item';
  let slug = description.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 50);
  return slug || 'untitled-item';
}

// =========================================================================
// Source Detection
// =========================================================================

function detectSource(input, options) {
  if (_syncSource) return _syncSource.detectSource(input, options);
  return _detectSourceSync(input, options);
}

function _detectSourceSync(input, options) {
  if (!input || typeof input !== 'string') return { source: 'manual', source_id: null, description: '' };
  const trimmed = input.trim();
  const ghMatch = trimmed.match(/^#(\d+)$/);
  if (ghMatch) return { source: 'github', source_id: `GH-${ghMatch[1]}`, description: trimmed };
  const jiraMatch = trimmed.match(/^([A-Z]+-\d+)$/);
  if (jiraMatch) return { source: 'jira', source_id: jiraMatch[1], description: trimmed };
  if (options && typeof options === 'object' && /^\d+$/.test(trimmed)) {
    if (options.issueTracker === 'jira' && options.jiraProjectKey) return { source: 'jira', source_id: `${options.jiraProjectKey}-${trimmed}`, description: `${options.jiraProjectKey}-${trimmed}` };
    if (options.issueTracker === 'github') return { source: 'github', source_id: `GH-${trimmed}`, description: `#${trimmed}` };
  }
  return { source: 'manual', source_id: null, description: trimmed };
}

// =========================================================================
// Item State
// =========================================================================

function readMetaJson(slugDir) {
  if (_syncItemState) return _syncItemState.readMetaJson(slugDir);
  return null; // Requires ESM preload for full functionality
}

function writeMetaJson(slugDir, meta) {
  if (_syncItemState) return _syncItemState.writeMetaJson(slugDir, meta);
}

function deriveAnalysisStatus(phasesCompleted, sizingDecision) {
  if (_syncItemState) return _syncItemState.deriveAnalysisStatus(phasesCompleted, sizingDecision);
  return _deriveAnalysisStatusSync(phasesCompleted, sizingDecision);
}

function _deriveAnalysisStatusSync(phasesCompleted, sizingDecision) {
  const ANALYSIS = ['00-quick-scan', '01-requirements', '02-impact-analysis', '03-architecture', '04-design'];
  if (!Array.isArray(phasesCompleted)) return 'raw';
  const count = phasesCompleted.filter(p => ANALYSIS.includes(p)).length;
  if (count === 0) return 'raw';
  if (sizingDecision && sizingDecision.effective_intensity === 'light' && Array.isArray(sizingDecision.light_skip_phases)) {
    const skipSet = new Set(sizingDecision.light_skip_phases);
    const required = ANALYSIS.filter(p => !skipSet.has(p));
    if (required.every(p => phasesCompleted.includes(p))) return 'analyzed';
  }
  if (count < ANALYSIS.length) return 'partial';
  return 'analyzed';
}

function deriveBacklogMarker(analysisStatus) {
  if (_syncItemState) return _syncItemState.deriveBacklogMarker(analysisStatus);
  switch (analysisStatus) {
    case 'raw': return ' ';
    case 'partial': return '~';
    case 'analyzed': return 'A';
    default: return ' ';
  }
}

// =========================================================================
// Backlog Operations
// =========================================================================

function parseBacklogLine(line) {
  if (_syncBacklogOps) return _syncBacklogOps.parseBacklogLine(line);
  const match = line.match(/^(\s*-\s+)(\d+\.\d+)\s+\[([ ~Ax])\]\s+(.+)$/);
  if (!match) return null;
  return { prefix: match[1], itemNumber: match[2], marker: match[3], description: match[4] };
}

function updateBacklogMarker(backlogPath, slug, newMarker) {
  if (_syncBacklogOps) return _syncBacklogOps.updateBacklogMarker(backlogPath, slug, newMarker);
  return false;
}

function appendToBacklog(backlogPath, itemNumber, description, marker) {
  if (_syncBacklogOps) return _syncBacklogOps.appendToBacklog(backlogPath, itemNumber, description, marker);
}

// =========================================================================
// Item Resolution
// =========================================================================

function resolveItem(input, requirementsDir, backlogPath) {
  if (_syncItemResolution) return _syncItemResolution.resolveItem(input, requirementsDir, backlogPath);
  return null;
}

function findBacklogItemByNumber(backlogPath, itemNumber, requirementsDir) {
  if (_syncItemResolution) return _syncItemResolution.findBacklogItemByNumber(backlogPath, itemNumber, requirementsDir);
  return null;
}

function findByExternalRef(ref, requirementsDir) {
  if (_syncItemResolution) return _syncItemResolution.findByExternalRef(ref, requirementsDir);
  return null;
}

function searchBacklogTitles(backlogPath, query, requirementsDir) {
  if (_syncItemResolution) return _syncItemResolution.searchBacklogTitles(backlogPath, query, requirementsDir);
  return [];
}

function findDirForDescription(requirementsDir, description) {
  if (_syncItemResolution) return _syncItemResolution.findDirForDescription(requirementsDir, description);
  return null;
}

// =========================================================================
// GitHub
// =========================================================================

function checkGhAvailability() {
  if (_syncGithub) return _syncGithub.checkGhAvailability();
  return { available: false, reason: 'bridge_not_loaded' };
}

function searchGitHubIssues(query, options) {
  if (_syncGithub) return _syncGithub.searchGitHubIssues(query, options);
  return { matches: [], error: 'bridge_not_loaded' };
}

function createGitHubIssue(title, body) {
  if (_syncGithub) return _syncGithub.createGitHubIssue(title, body);
  return null;
}

// =========================================================================
// Preload
// =========================================================================

async function preload() {
  const [s, src, is, bo, ir, gh] = await Promise.all([
    loadSlug(), loadSource(), loadItemState(), loadBacklogOps(), loadItemResolution(), loadGithub()
  ]);
  _syncSlug = s;
  _syncSource = src;
  _syncItemState = is;
  _syncBacklogOps = bo;
  _syncItemResolution = ir;
  _syncGithub = gh;
}

module.exports = {
  generateSlug,
  detectSource,
  readMetaJson,
  writeMetaJson,
  deriveAnalysisStatus,
  deriveBacklogMarker,
  parseBacklogLine,
  updateBacklogMarker,
  appendToBacklog,
  resolveItem,
  findBacklogItemByNumber,
  findByExternalRef,
  searchBacklogTitles,
  findDirForDescription,
  checkGhAvailability,
  searchGitHubIssues,
  createGitHubIssue,
  preload
};
