/**
 * CJS Bridge for src/core/workflow/ modules
 *
 * REQ-0082: Extract WorkflowRegistry
 * Per ADR-CODEX-006: Core in ESM with CJS bridge.
 */

'use strict';

let _registryModule;
let _constantsModule;

async function loadRegistry() {
  if (!_registryModule) _registryModule = await import('../workflow/registry.js');
  return _registryModule;
}

async function loadConstants() {
  if (!_constantsModule) _constantsModule = await import('../workflow/constants.js');
  return _constantsModule;
}

let _syncRegistry = null;
let _syncConstants = null;

// =========================================================================
// Registry functions
// =========================================================================

function loadWorkflows(projectRoot) {
  if (_syncRegistry) return _syncRegistry.loadWorkflows(projectRoot);
  return _loadWorkflowsSync(projectRoot);
}

function resolveExtension(basePhases, diffSpec) {
  if (_syncRegistry) return _syncRegistry.resolveExtension(basePhases, diffSpec);
  return _resolveExtensionSync(basePhases, diffSpec);
}

function validatePhaseOrdering(phases, canonicalOrder) {
  if (_syncRegistry) return _syncRegistry.validatePhaseOrdering(phases, canonicalOrder);
  return _validatePhaseOrderingSync(phases, canonicalOrder);
}

function validateWorkflow(workflow, filePath, shippedWorkflows, projectRoot) {
  if (_syncRegistry) return _syncRegistry.validateWorkflow(workflow, filePath, shippedWorkflows, projectRoot);
  return { valid: false, errors: ['bridge_not_loaded'], warnings: [] };
}

function loadPhaseOrdering() {
  if (_syncRegistry) return _syncRegistry.loadPhaseOrdering();
  return _loadPhaseOrderingSync();
}

function buildShippedEntry(name, def) {
  if (_syncRegistry) return _syncRegistry.buildShippedEntry(name, def);
  return _buildShippedEntrySync(name, def);
}

function buildCustomEntry(workflow, filePath, shippedWorkflows) {
  if (_syncRegistry) return _syncRegistry.buildCustomEntry(workflow, filePath, shippedWorkflows);
  return { name: workflow.name, phases: [], source: 'custom' };
}

// =========================================================================
// Constants
// =========================================================================

function normalizePhaseKey(key) {
  if (_syncConstants) return _syncConstants.normalizePhaseKey(key);
  return _normalizePhaseKeySync(key);
}

// =========================================================================
// Inline sync fallbacks
// =========================================================================

const fs = require('fs');
const path = require('path');

const _PHASE_KEY_ALIASES = Object.freeze({
  '13-test-deploy': '12-test-deploy',
  '14-production': '13-production',
  '15-operations': '14-operations',
  '16-upgrade-plan': '15-upgrade-plan',
  '16-upgrade-execute': '15-upgrade-execute'
});

function _normalizePhaseKeySync(key) {
  if (!key || typeof key !== 'string') return key;
  return _PHASE_KEY_ALIASES[key] || key;
}

function _loadPhaseOrderingSync() {
  try {
    const orderingPath = path.resolve(__dirname, '..', '..', 'isdlc', 'config', 'phase-ordering.json');
    const data = JSON.parse(fs.readFileSync(orderingPath, 'utf8'));
    return data.ranks || data;
  } catch { return {}; }
}

function _buildShippedEntrySync(name, def) {
  return {
    name: def.label || name,
    description: def.description || '',
    intent: def.intent || '',
    examples: def.examples || [],
    phases: def.phases || [],
    gate_mode: def.gate_mode || 'strict',
    requires_branch: def.requires_branch !== false,
    source: 'shipped',
    extends: null,
    phase_agents: {},
    agent_modifiers: def.agent_modifiers || {},
    options: def.options || {},
    file_path: null
  };
}

function _resolveExtensionSync(basePhases, diffSpec) {
  let phases = [...basePhases];
  const phaseAgents = {};

  if (diffSpec.remove_phases && Array.isArray(diffSpec.remove_phases)) {
    for (const phase of diffSpec.remove_phases) {
      const idx = phases.indexOf(phase);
      if (idx === -1) throw new Error(`remove_phases: phase '${phase}' not found in base workflow`);
      phases.splice(idx, 1);
    }
  }

  if (diffSpec.add_phases && Array.isArray(diffSpec.add_phases)) {
    for (const entry of diffSpec.add_phases) {
      const phaseName = typeof entry === 'string' ? entry : entry.phase;
      if (!phaseName) continue;
      if (entry.after) {
        const idx = phases.indexOf(entry.after);
        if (idx === -1) throw new Error(`add_phases: insertion point '${entry.after}' (after) not found`);
        phases.splice(idx + 1, 0, phaseName);
      } else if (entry.before) {
        const idx = phases.indexOf(entry.before);
        if (idx === -1) throw new Error(`add_phases: insertion point '${entry.before}' (before) not found`);
        phases.splice(idx, 0, phaseName);
      } else {
        phases.push(phaseName);
      }
      if (entry.agent) phaseAgents[phaseName] = entry.agent;
    }
  }

  if (diffSpec.reorder && Array.isArray(diffSpec.reorder)) {
    for (const entry of diffSpec.reorder) {
      const moveIdx = phases.indexOf(entry.move);
      if (moveIdx === -1) throw new Error(`reorder: phase '${entry.move}' not found`);
      phases.splice(moveIdx, 1);
      if (entry.after) {
        const targetIdx = phases.indexOf(entry.after);
        if (targetIdx === -1) throw new Error(`reorder: target '${entry.after}' (after) not found`);
        phases.splice(targetIdx + 1, 0, entry.move);
      } else if (entry.before) {
        const targetIdx = phases.indexOf(entry.before);
        if (targetIdx === -1) throw new Error(`reorder: target '${entry.before}' (before) not found`);
        phases.splice(targetIdx, 0, entry.move);
      }
    }
  }

  if (phases.length === 0) throw new Error('Diff operations produced an empty phase list');
  return { phases, phase_agents: phaseAgents };
}

function _validatePhaseOrderingSync(phases, canonicalOrder) {
  const warnings = [];
  const shippedPhases = phases.filter(p => canonicalOrder[p] !== undefined);
  for (let i = 0; i < shippedPhases.length - 1; i++) {
    const a = shippedPhases[i];
    const b = shippedPhases[i + 1];
    if (canonicalOrder[a] > canonicalOrder[b]) {
      warnings.push(`Phase ordering warning: '${a}' (rank ${canonicalOrder[a]}) appears before '${b}' (rank ${canonicalOrder[b]})`);
    }
  }
  return warnings;
}

function _loadWorkflowsSync(projectRoot) {
  const warnings = [];
  const errors = [];
  const shipped = {};

  try {
    const workflowsPath = path.resolve(__dirname, '..', '..', 'isdlc', 'config', 'workflows.json');
    const data = JSON.parse(fs.readFileSync(workflowsPath, 'utf8'));
    const workflowDefs = data.workflows || {};
    for (const [name, def] of Object.entries(workflowDefs)) {
      shipped[name] = _buildShippedEntrySync(name, def);
    }
  } catch (e) {
    errors.push(`Failed to load shipped workflows: ${e.message}`);
    return { shipped, custom: {}, merged: { ...shipped }, warnings, errors };
  }

  return { shipped, custom: {}, merged: { ...shipped }, warnings, errors };
}

// =========================================================================
// Preload
// =========================================================================

async function preload() {
  const [r, c] = await Promise.all([loadRegistry(), loadConstants()]);
  _syncRegistry = r;
  _syncConstants = c;
}

module.exports = {
  loadWorkflows,
  resolveExtension,
  validatePhaseOrdering,
  validateWorkflow,
  loadPhaseOrdering,
  buildShippedEntry,
  buildCustomEntry,
  normalizePhaseKey,
  preload
};
