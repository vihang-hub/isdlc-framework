/**
 * WorkflowRegistry — Core workflow management
 * =============================================
 * Discovers, validates, and merges shipped + user-defined workflows.
 *
 * Extracted from src/isdlc/workflow-loader.cjs (REQ-0082).
 *
 * @module src/core/workflow/registry
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let yaml;
try {
  const jsYaml = await import('js-yaml');
  yaml = jsYaml.default || jsYaml;
} catch {
  yaml = null;
}

/**
 * Resolve diff-based extension against a base workflow.
 * Operations applied in fixed order: remove -> add -> reorder.
 *
 * @param {string[]} basePhases - Base workflow phase array
 * @param {Object} diffSpec - { remove_phases, add_phases, reorder }
 * @returns {{ phases: string[], phase_agents: Object }}
 * @throws {Error} If any operation references a non-existent phase or result is empty
 */
export function resolveExtension(basePhases, diffSpec) {
  let phases = [...basePhases];
  const phaseAgents = {};

  // Step 1: remove_phases
  if (diffSpec.remove_phases && Array.isArray(diffSpec.remove_phases)) {
    for (const phase of diffSpec.remove_phases) {
      const idx = phases.indexOf(phase);
      if (idx === -1) {
        throw new Error(`remove_phases: phase '${phase}' not found in base workflow`);
      }
      phases.splice(idx, 1);
    }
  }

  // Step 2: add_phases
  if (diffSpec.add_phases && Array.isArray(diffSpec.add_phases)) {
    for (const entry of diffSpec.add_phases) {
      const phaseName = typeof entry === 'string' ? entry : entry.phase;
      if (!phaseName) continue;

      if (entry.after) {
        const idx = phases.indexOf(entry.after);
        if (idx === -1) {
          throw new Error(`add_phases: insertion point '${entry.after}' (after) not found`);
        }
        phases.splice(idx + 1, 0, phaseName);
      } else if (entry.before) {
        const idx = phases.indexOf(entry.before);
        if (idx === -1) {
          throw new Error(`add_phases: insertion point '${entry.before}' (before) not found`);
        }
        phases.splice(idx, 0, phaseName);
      } else {
        phases.push(phaseName);
      }

      if (entry.agent) {
        phaseAgents[phaseName] = entry.agent;
      }
    }
  }

  // Step 3: reorder
  if (diffSpec.reorder && Array.isArray(diffSpec.reorder)) {
    for (const entry of diffSpec.reorder) {
      const moveIdx = phases.indexOf(entry.move);
      if (moveIdx === -1) {
        throw new Error(`reorder: phase '${entry.move}' not found`);
      }
      phases.splice(moveIdx, 1);

      if (entry.after) {
        const targetIdx = phases.indexOf(entry.after);
        if (targetIdx === -1) {
          throw new Error(`reorder: target '${entry.after}' (after) not found`);
        }
        phases.splice(targetIdx + 1, 0, entry.move);
      } else if (entry.before) {
        const targetIdx = phases.indexOf(entry.before);
        if (targetIdx === -1) {
          throw new Error(`reorder: target '${entry.before}' (before) not found`);
        }
        phases.splice(targetIdx, 0, entry.move);
      }
    }
  }

  if (phases.length === 0) {
    throw new Error('Diff operations produced an empty phase list');
  }

  return { phases, phase_agents: phaseAgents };
}

/**
 * Validate resolved phase ordering against canonical ordering.
 *
 * @param {string[]} phases - Resolved phase array
 * @param {Object} canonicalOrder - Phase-to-rank mapping
 * @returns {string[]} Array of warning messages (empty if valid)
 */
export function validatePhaseOrdering(phases, canonicalOrder) {
  const warnings = [];
  const shippedPhases = phases.filter(p => canonicalOrder[p] !== undefined);

  for (let i = 0; i < shippedPhases.length - 1; i++) {
    const a = shippedPhases[i];
    const b = shippedPhases[i + 1];
    if (canonicalOrder[a] > canonicalOrder[b]) {
      warnings.push(
        `Phase ordering warning: '${a}' (rank ${canonicalOrder[a]}) appears before '${b}' (rank ${canonicalOrder[b]})`
      );
    }
  }

  return warnings;
}

/**
 * Validate a single user workflow YAML object.
 *
 * @param {Object} workflow - Parsed YAML object
 * @param {string} filePath - Source file path
 * @param {Object} shippedWorkflows - Shipped workflow registry
 * @param {string} projectRoot - For resolving agent file paths
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateWorkflow(workflow, filePath, shippedWorkflows, projectRoot) {
  const errors = [];
  const warnings = [];

  if (!workflow.name || typeof workflow.name !== 'string') {
    errors.push(`${filePath}: Missing required field 'name'`);
    return { valid: false, errors, warnings };
  }

  const nameKey = workflow.name.toLowerCase().replace(/\s+/g, '-');
  if (shippedWorkflows[nameKey] || shippedWorkflows[workflow.name]) {
    errors.push(`${filePath}: Name '${workflow.name}' collides with shipped workflow`);
    return { valid: false, errors, warnings };
  }

  if (!workflow.phases && !workflow.extends) {
    errors.push(`${filePath}: Must have either 'phases' or 'extends'`);
    return { valid: false, errors, warnings };
  }

  if (workflow.extends) {
    const baseName = workflow.extends;
    if (!shippedWorkflows[baseName]) {
      errors.push(`${filePath}: extends '${baseName}' -- base workflow not found`);
      return { valid: false, errors, warnings };
    }
  }

  if (workflow.phases && Array.isArray(workflow.phases)) {
    const phaseOrdering = loadPhaseOrdering();
    const shippedPhaseNames = Object.keys(phaseOrdering);

    for (const phase of workflow.phases) {
      const phaseName = typeof phase === 'string' ? phase : phase.phase;
      if (!phaseName) continue;

      if (!shippedPhaseNames.includes(phaseName)) {
        const entry = typeof phase === 'object' ? phase : null;
        if (!entry || !entry.agent) {
          errors.push(`${filePath}: Unknown phase '${phaseName}' -- not a shipped phase and no 'agent' field provided`);
        } else {
          const agentPath = resolve(projectRoot, entry.agent);
          if (!existsSync(agentPath)) {
            errors.push(`${filePath}: Custom phase '${phaseName}' agent file not found: ${entry.agent}`);
          }
        }
      }
    }
  }

  if (workflow.add_phases && Array.isArray(workflow.add_phases)) {
    for (const entry of workflow.add_phases) {
      if (typeof entry === 'object' && entry.agent) {
        const agentPath = resolve(projectRoot, entry.agent);
        if (!existsSync(agentPath)) {
          errors.push(`${filePath}: Custom phase '${entry.phase}' agent file not found: ${entry.agent}`);
        }
      }
    }
  }

  if (workflow.intent !== undefined && (!workflow.intent || typeof workflow.intent !== 'string')) {
    warnings.push(`${filePath}: 'intent' field is empty -- workflow may not be discoverable via natural conversation`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Load canonical phase ordering from config.
 * @returns {Object} Phase-to-rank mapping
 */
export function loadPhaseOrdering() {
  try {
    // Try src/isdlc/config/ first (canonical location)
    const orderingPath = resolve(__dirname, '..', '..', 'isdlc', 'config', 'phase-ordering.json');
    const data = JSON.parse(readFileSync(orderingPath, 'utf8'));
    return data.ranks || data;
  } catch {
    return {};
  }
}

/**
 * Build a workflow registry entry from a shipped workflow definition.
 *
 * @param {string} name - Workflow key
 * @param {Object} def - Workflow definition from workflows.json
 * @returns {Object} Registry entry
 */
export function buildShippedEntry(name, def) {
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

/**
 * Build a workflow registry entry from a custom workflow YAML.
 *
 * @param {Object} workflow - Parsed YAML object
 * @param {string} filePath - Source file path
 * @param {Object} shippedWorkflows - Shipped registry
 * @returns {Object} Registry entry
 */
export function buildCustomEntry(workflow, filePath, shippedWorkflows) {
  let resolvedPhases = [];
  let phaseAgents = {};

  if (workflow.extends) {
    const base = shippedWorkflows[workflow.extends];
    if (base) {
      const result = resolveExtension(base.phases, {
        remove_phases: workflow.remove_phases,
        add_phases: workflow.add_phases,
        reorder: workflow.reorder
      });
      resolvedPhases = result.phases;
      phaseAgents = result.phase_agents;
    }
  } else if (workflow.phases) {
    resolvedPhases = workflow.phases.map(p => typeof p === 'string' ? p : p.phase);
    for (const p of workflow.phases) {
      if (typeof p === 'object' && p.agent) {
        phaseAgents[p.phase] = p.agent;
      }
    }
  }

  return {
    name: workflow.name,
    description: workflow.description || '',
    intent: workflow.intent || '',
    examples: workflow.examples || [],
    phases: resolvedPhases,
    gate_mode: workflow.gate_mode || 'strict',
    requires_branch: workflow.requires_branch !== undefined ? workflow.requires_branch : false,
    source: 'custom',
    extends: workflow.extends || null,
    phase_agents: phaseAgents,
    agent_modifiers: workflow.agent_modifiers || {},
    options: workflow.options || {},
    file_path: filePath
  };
}

/**
 * Discover, parse, validate, and merge shipped + user-defined workflows.
 *
 * @param {string} projectRoot - Absolute path to project root
 * @returns {{ shipped: Object, custom: Object, merged: Object, warnings: string[], errors: string[] }}
 */
export function loadWorkflows(projectRoot) {
  const warnings = [];
  const errors = [];
  const shipped = {};
  const custom = {};

  // Load shipped workflows from config
  try {
    const workflowsPath = resolve(__dirname, '..', '..', 'isdlc', 'config', 'workflows.json');
    const data = JSON.parse(readFileSync(workflowsPath, 'utf8'));
    const workflowDefs = data.workflows || {};

    for (const [name, def] of Object.entries(workflowDefs)) {
      shipped[name] = buildShippedEntry(name, def);
    }
  } catch (e) {
    errors.push(`Failed to load shipped workflows: ${e.message}`);
    return { shipped, custom, merged: { ...shipped }, warnings, errors };
  }

  // Discover user workflow YAML files
  const workflowsDir = join(projectRoot, '.isdlc', 'workflows');
  if (!existsSync(workflowsDir)) {
    return { shipped, custom, merged: { ...shipped }, warnings, errors };
  }

  if (!yaml) {
    warnings.push('js-yaml not available -- custom workflow files will not be loaded');
    return { shipped, custom, merged: { ...shipped }, warnings, errors };
  }

  let files;
  try {
    files = readdirSync(workflowsDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  } catch (e) {
    errors.push(`Failed to read workflows directory: ${e.message}`);
    return { shipped, custom, merged: { ...shipped }, warnings, errors };
  }

  const canonicalOrder = loadPhaseOrdering();

  for (const file of files) {
    const filePath = join(workflowsDir, file);
    let parsed;

    try {
      const content = readFileSync(filePath, 'utf8');
      parsed = yaml.load(content);
    } catch (e) {
      errors.push(`YAML_PARSE_ERROR: ${filePath}: ${e.message}`);
      continue;
    }

    if (!parsed || typeof parsed !== 'object') {
      errors.push(`${filePath}: YAML file did not produce a valid object`);
      continue;
    }

    const validation = validateWorkflow(parsed, filePath, shipped, projectRoot);
    errors.push(...validation.errors);
    warnings.push(...validation.warnings);

    if (!validation.valid) continue;

    try {
      const entry = buildCustomEntry(parsed, filePath, shipped);
      const nameKey = parsed.name.toLowerCase().replace(/\s+/g, '-');
      custom[nameKey] = entry;

      const orderWarnings = validatePhaseOrdering(entry.phases, canonicalOrder);
      warnings.push(...orderWarnings);
    } catch (e) {
      errors.push(`${filePath}: ${e.message}`);
    }
  }

  const merged = { ...shipped, ...custom };
  return { shipped, custom, merged, warnings, errors };
}
