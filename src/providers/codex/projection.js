/**
 * Codex Adapter — Projection
 * ============================
 * Codex instruction projection management (REQ-0114, REQ-0116).
 *
 * Manages provider configuration, instruction directory paths, and
 * the instruction projection service that assembles core models into
 * a Codex-compatible markdown instruction bundle.
 *
 * @module src/providers/codex/projection
 */

import { getTeamSpec, listTeamTypes } from '../../core/teams/registry.js';
import { getTeamInstancesByPhase } from '../../core/teams/instance-registry.js';
import { getAgentClassification } from '../../core/content/agent-classification.js';
import { computeInjectionPlan } from '../../core/skills/injection-planner.js';

// ---------------------------------------------------------------------------
// FR-001: Codex Provider Config (REQ-0114)
// ---------------------------------------------------------------------------

/**
 * Get the Codex provider configuration.
 * Returns identity, framework directory, and instruction format.
 *
 * @returns {{ provider: string, frameworkDir: string, instructionFormat: string }}
 */
export function getCodexConfig() {
  return Object.freeze({
    provider: 'codex',
    frameworkDir: '.codex',
    instructionFormat: 'markdown-instructions'
  });
}

// ---------------------------------------------------------------------------
// FR-002: Codex Projection Paths (REQ-0114)
// ---------------------------------------------------------------------------

/**
 * Get the projection paths for the .codex/ directory structure.
 * All paths are relative to the project root.
 *
 * @returns {{ instructions: string, teamSpec: string, contentModel: string, skillManifest: string, providerConfig: string }}
 */
export function getProjectionPaths() {
  return Object.freeze({
    instructions: '.codex/AGENTS.md',
    teamSpec: '.codex/team-spec.md',
    contentModel: '.codex/content-model.md',
    skillManifest: '.codex/skills.md',
    providerConfig: '.codex/config.json'
  });
}

// ---------------------------------------------------------------------------
// FR-001 (REQ-0116): Instruction Projection Service
// ---------------------------------------------------------------------------

/**
 * Assemble a markdown instruction bundle from loaded context.
 * Section order: Team Context, Agent Role, Phase Instructions, Skills, Constraints.
 * Missing sections are omitted (fail-open).
 *
 * @param {Object} context
 * @returns {string} Markdown content
 */
function assembleMarkdown({ teamSpec, teamInstances, agentClassification, injectionPlan, phase, agent }) {
  const sections = [];

  // Team context
  if (teamSpec) {
    sections.push(`# Team: ${teamSpec.name || teamSpec.team_type || 'Unknown'}\n\n${teamSpec.description || ''}`);
  }

  // Agent role — extract role_spec sections from classification
  if (agentClassification) {
    const roleSpecSections = agentClassification
      .filter(s => s.type === 'role_spec')
      .map(s => s.name)
      .join(', ');
    sections.push(`## Agent: ${agent}\n\nRole sections: ${roleSpecSections}`);
  }

  // Phase instructions from team instances
  if (teamInstances && teamInstances.length > 0) {
    const instanceDescs = teamInstances
      .map(inst => `- **${inst.id || 'instance'}** (${inst.team_type || 'unknown'}): ${inst.description || 'No description'}`)
      .join('\n');
    sections.push(`## Phase: ${phase}\n\n${instanceDescs}`);
  }

  // Skills
  if (injectionPlan && injectionPlan.merged && injectionPlan.merged.length > 0) {
    const skillSections = injectionPlan.merged
      .map(s => `### Skill: ${s.skillId || s.name}\n\nDelivery: ${s.deliveryType || 'reference'}`)
      .join('\n\n');
    sections.push(`## Skills\n\n${skillSections}`);
  }

  if (sections.length === 0) {
    return `# Codex Instructions\n\nPhase: ${phase}\nAgent: ${agent}\n\nNo additional context available.`;
  }

  return sections.join('\n\n---\n\n');
}

/**
 * Generate a Codex instruction bundle by consuming core models.
 *
 * Fail-open: if any core model is unavailable, produces a minimal
 * instruction with whatever context is available. Missing models
 * are reported in metadata.warnings.
 *
 * @param {string} phase - Phase key (e.g. '06-implementation')
 * @param {string} agent - Agent name (e.g. '05-software-developer')
 * @param {Object} [options={}] - Options (projectRoot, workflow)
 * @returns {{ content: string, metadata: { phase: string, agent: string, skills_injected: string[], team_type: string, warnings?: string[] } }}
 */
export function projectInstructions(phase, agent, options = {}) {
  const warnings = [];
  const workflow = options.workflow || 'feature';

  // 1. Load team instances for the phase
  let teamInstances;
  try {
    teamInstances = getTeamInstancesByPhase(phase);
    if (!teamInstances || teamInstances.length === 0) {
      warnings.push(`No team instances found for phase: ${phase}`);
      teamInstances = [];
    }
  } catch (err) {
    warnings.push(`Team instances load failed for phase ${phase}: ${err.message}`);
    teamInstances = [];
  }

  // 2. Load agent classification (role_spec sections only)
  let agentClassification;
  try {
    agentClassification = getAgentClassification(agent);
  } catch (err) {
    warnings.push(`Agent classification not found: ${agent}`);
    agentClassification = null;
  }

  // 3. Compute injection plan for built-in + external skills
  let injectionPlan;
  try {
    injectionPlan = computeInjectionPlan(workflow, phase, agent, {
      projectRoot: options.projectRoot
    });
  } catch (err) {
    warnings.push(`Injection plan computation failed for ${agent}/${phase}: ${err.message}`);
    injectionPlan = { builtIn: [], external: [], merged: [] };
  }

  // 4. Load team spec (use first available team type from instances)
  let teamSpec = null;
  if (teamInstances.length > 0 && teamInstances[0]?.team_type) {
    try {
      teamSpec = getTeamSpec(teamInstances[0].team_type);
    } catch (err) {
      warnings.push(`Team spec not found: ${err.message}`);
    }
  } else {
    // Try to get any available team spec
    try {
      const types = listTeamTypes();
      if (types.length > 0) {
        teamSpec = getTeamSpec(types[0]);
      }
    } catch (err) {
      warnings.push(`Team spec not found: ${err.message}`);
    }
  }

  // 5. Assemble markdown
  const content = assembleMarkdown({
    teamSpec,
    teamInstances,
    agentClassification,
    injectionPlan,
    phase,
    agent
  });

  return {
    content,
    metadata: {
      phase,
      agent,
      skills_injected: (injectionPlan.merged || []).map(s => s.skillId || s.name),
      team_type: teamSpec?.team_type ?? 'unknown',
      ...(warnings.length > 0 && { warnings })
    }
  };
}
