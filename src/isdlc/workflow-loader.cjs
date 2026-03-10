'use strict';

const fs = require('fs');
const path = require('path');

let yaml;
try {
  yaml = require('js-yaml');
} catch (e) {
  // js-yaml not available -- custom workflows will not be loadable
  yaml = null;
}

/**
 * Resolve diff-based extension against a base workflow.
 * Operations applied in fixed order: remove → add → reorder.
 *
 * @param {string[]} basePhases - Base workflow phase array
 * @param {Object} diffSpec - { remove_phases, add_phases, reorder }
 * @returns {{ phases: string[], phase_agents: Object }}
 * @throws {Error} If any operation references a non-existent phase or result is empty
 */
function resolveExtension(basePhases, diffSpec) {
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
        // No insertion point — append to end
        phases.push(phaseName);
      }

      // Record agent mapping for custom phases
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

  // Validate non-empty result
  if (phases.length === 0) {
    throw new Error('Diff operations produced an empty phase list');
  }

  return { phases, phase_agents: phaseAgents };
}

/**
 * Validate resolved phase ordering against canonical ordering.
 * Only checks pairs of shipped phases — custom phases are skipped.
 *
 * @param {string[]} phases - Resolved phase array
 * @param {Object} canonicalOrder - Phase-to-rank mapping
 * @returns {string[]} Array of warning messages (empty if ordering is valid)
 */
function validatePhaseOrdering(phases, canonicalOrder) {
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
 * @param {string} filePath - Source file path (for error messages)
 * @param {Object} shippedWorkflows - Shipped workflow registry (for name collision + extension checks)
 * @param {string} projectRoot - For resolving agent file paths
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateWorkflow(workflow, filePath, shippedWorkflows, projectRoot) {
  const errors = [];
  const warnings = [];

  // Required: name
  if (!workflow.name || typeof workflow.name !== 'string') {
    errors.push(`${filePath}: Missing required field 'name'`);
    return { valid: false, errors, warnings };
  }

  // Name collision check
  const nameKey = workflow.name.toLowerCase().replace(/\s+/g, '-');
  if (shippedWorkflows[nameKey] || shippedWorkflows[workflow.name]) {
    errors.push(`${filePath}: Name '${workflow.name}' collides with shipped workflow`);
    return { valid: false, errors, warnings };
  }

  // Must have phases or extends (not both required, but at least one)
  if (!workflow.phases && !workflow.extends) {
    errors.push(`${filePath}: Must have either 'phases' or 'extends'`);
    return { valid: false, errors, warnings };
  }

  // Validate extends target
  if (workflow.extends) {
    const baseName = workflow.extends;
    if (!shippedWorkflows[baseName]) {
      errors.push(`${filePath}: extends '${baseName}' — base workflow not found`);
      return { valid: false, errors, warnings };
    }
  }

  // Validate phases (standalone workflow)
  if (workflow.phases && Array.isArray(workflow.phases)) {
    const phaseOrdering = loadPhaseOrdering();
    const shippedPhaseNames = Object.keys(phaseOrdering);

    for (const phase of workflow.phases) {
      const phaseName = typeof phase === 'string' ? phase : phase.phase;
      if (!phaseName) continue;

      // Check if phase is a shipped phase or has an agent field
      if (!shippedPhaseNames.includes(phaseName)) {
        const entry = typeof phase === 'object' ? phase : null;
        if (!entry || !entry.agent) {
          errors.push(`${filePath}: Unknown phase '${phaseName}' — not a shipped phase and no 'agent' field provided`);
        } else {
          // Validate agent file exists
          const agentPath = path.resolve(projectRoot, entry.agent);
          if (!fs.existsSync(agentPath)) {
            errors.push(`${filePath}: Custom phase '${phaseName}' agent file not found: ${entry.agent}`);
          }
        }
      }
    }
  }

  // Validate custom phases in add_phases (extending workflow)
  if (workflow.add_phases && Array.isArray(workflow.add_phases)) {
    for (const entry of workflow.add_phases) {
      if (typeof entry === 'object' && entry.agent) {
        const agentPath = path.resolve(projectRoot, entry.agent);
        if (!fs.existsSync(agentPath)) {
          errors.push(`${filePath}: Custom phase '${entry.phase}' agent file not found: ${entry.agent}`);
        }
      }
    }
  }

  // Intent field — warn if empty
  if (workflow.intent !== undefined && (!workflow.intent || typeof workflow.intent !== 'string')) {
    warnings.push(`${filePath}: 'intent' field is empty — workflow may not be discoverable via natural conversation`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Load canonical phase ordering from config.
 * @returns {Object} Phase-to-rank mapping
 */
function loadPhaseOrdering() {
  try {
    const orderingPath = path.join(__dirname, 'config', 'phase-ordering.json');
    const data = JSON.parse(fs.readFileSync(orderingPath, 'utf8'));
    return data.ranks || data;
  } catch (e) {
    // Fallback — return empty ordering (no validation)
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
function buildShippedEntry(name, def) {
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
 * @param {Object} shippedWorkflows - Shipped registry (for resolving extends)
 * @returns {Object} Registry entry
 */
function buildCustomEntry(workflow, filePath, shippedWorkflows) {
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
    // Standalone custom workflow — resolve phases from the array
    resolvedPhases = workflow.phases.map(p => typeof p === 'string' ? p : p.phase);
    for (const p of workflow.phases) {
      if (typeof p === 'object' && p.agent) {
        phaseAgents[p.phase] = p.agent;
      }
    }
  }

  const nameKey = workflow.name.toLowerCase().replace(/\s+/g, '-');

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
 * Discover, parse, validate, and merge shipped + user-defined workflows
 * into a single registry.
 *
 * @param {string} projectRoot - Absolute path to project root
 * @returns {{ shipped: Object, custom: Object, merged: Object, warnings: string[], errors: string[] }}
 */
function loadWorkflows(projectRoot) {
  const warnings = [];
  const errors = [];
  const shipped = {};
  const custom = {};

  // Load shipped workflows from config
  try {
    const workflowsPath = path.join(__dirname, 'config', 'workflows.json');
    const data = JSON.parse(fs.readFileSync(workflowsPath, 'utf8'));
    const workflowDefs = data.workflows || {};

    for (const [name, def] of Object.entries(workflowDefs)) {
      shipped[name] = buildShippedEntry(name, def);
    }
  } catch (e) {
    errors.push(`Failed to load shipped workflows: ${e.message}`);
    return { shipped, custom, merged: { ...shipped }, warnings, errors };
  }

  // Discover user workflow YAML files
  const workflowsDir = path.join(projectRoot, '.isdlc', 'workflows');
  if (!fs.existsSync(workflowsDir)) {
    return { shipped, custom, merged: { ...shipped }, warnings, errors };
  }

  if (!yaml) {
    warnings.push('js-yaml not available — custom workflow files will not be loaded');
    return { shipped, custom, merged: { ...shipped }, warnings, errors };
  }

  let files;
  try {
    files = fs.readdirSync(workflowsDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  } catch (e) {
    errors.push(`Failed to read workflows directory: ${e.message}`);
    return { shipped, custom, merged: { ...shipped }, warnings, errors };
  }

  const canonicalOrder = loadPhaseOrdering();

  for (const file of files) {
    const filePath = path.join(workflowsDir, file);
    let parsed;

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      parsed = yaml.load(content);
    } catch (e) {
      errors.push(`YAML_PARSE_ERROR: ${filePath}: ${e.message}`);
      continue;
    }

    if (!parsed || typeof parsed !== 'object') {
      errors.push(`${filePath}: YAML file did not produce a valid object`);
      continue;
    }

    // Validate
    const validation = validateWorkflow(parsed, filePath, shipped, projectRoot);
    errors.push(...validation.errors);
    warnings.push(...validation.warnings);

    if (!validation.valid) continue;

    // Build entry
    try {
      const entry = buildCustomEntry(parsed, filePath, shipped);
      const nameKey = parsed.name.toLowerCase().replace(/\s+/g, '-');
      custom[nameKey] = entry;

      // Validate phase ordering
      const orderWarnings = validatePhaseOrdering(entry.phases, canonicalOrder);
      warnings.push(...orderWarnings);
    } catch (e) {
      errors.push(`${filePath}: ${e.message}`);
    }
  }

  // Merge: shipped + custom (custom cannot override shipped — already validated)
  const merged = { ...shipped, ...custom };

  return { shipped, custom, merged, warnings, errors };
}

module.exports = {
  loadWorkflows,
  resolveExtension,
  validatePhaseOrdering,
  validateWorkflow,
  // Exported for testing
  buildShippedEntry,
  buildCustomEntry,
  loadPhaseOrdering
};
