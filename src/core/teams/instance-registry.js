/**
 * Team Instance Registry — lookup and enumeration for all team instance configs
 *
 * Loads all instance configs at module load and provides:
 * - getTeamInstance(instanceId): O(1) Map lookup, throws ERR-INSTANCE-001 on unknown
 * - listTeamInstances(): returns all registered instance ID strings
 * - getTeamInstancesByPhase(phase): returns instances matching a phase key
 *
 * Requirements: REQ-0095, REQ-0096, REQ-0097, REQ-0098 (shared registry)
 * @module src/core/teams/instance-registry
 */

import { impactAnalysisInstance } from './instances/impact-analysis.js';
import { tracingInstance } from './instances/tracing.js';
import { qualityLoopInstance } from './instances/quality-loop.js';
import { debateRequirementsInstance } from './instances/debate-requirements.js';
import { debateArchitectureInstance } from './instances/debate-architecture.js';
import { debateDesignInstance } from './instances/debate-design.js';
import { debateTestStrategyInstance } from './instances/debate-test-strategy.js';

/** @type {Map<string, Object>} */
const registry = new Map([
  ['impact_analysis', impactAnalysisInstance],
  ['tracing', tracingInstance],
  ['quality_loop', qualityLoopInstance],
  ['debate_requirements', debateRequirementsInstance],
  ['debate_architecture', debateArchitectureInstance],
  ['debate_design', debateDesignInstance],
  ['debate_test_strategy', debateTestStrategyInstance]
]);

/**
 * Phase-to-instances mapping for getTeamInstancesByPhase().
 * Maps phase keys to instance IDs via input_dependency and/or phase field.
 * @type {Map<string, string[]>}
 */
const phaseIndex = new Map();

// Build phase index from instance configs
for (const [id, instance] of registry) {
  // Index by input_dependency (which phase this instance consumes)
  const dep = instance.input_dependency;
  if (dep) {
    if (!phaseIndex.has(dep)) {
      phaseIndex.set(dep, []);
    }
    phaseIndex.get(dep).push(id);
  }
  // Index by phase field (which phase this instance belongs to)
  const phase = instance.phase;
  if (phase) {
    if (!phaseIndex.has(phase)) {
      phaseIndex.set(phase, []);
    }
    phaseIndex.get(phase).push(id);
  }
}

/**
 * Get the team instance config for a given instance ID.
 *
 * @param {string} instanceId - One of the registered instance IDs
 * @returns {Object} Frozen team instance config
 * @throws {Error} ERR-INSTANCE-001 if instanceId is not registered
 */
export function getTeamInstance(instanceId) {
  const instance = registry.get(instanceId);
  if (!instance) {
    const available = [...registry.keys()].join(', ');
    throw new Error(
      `Unknown instance ID: "${instanceId}". Available instances: ${available}`
    );
  }
  return instance;
}

/**
 * List all registered team instance ID strings.
 *
 * @returns {string[]} Array of instance ID identifiers
 */
export function listTeamInstances() {
  return [...registry.keys()];
}

/**
 * Get all team instances that depend on a given phase as input.
 *
 * @param {string} phase - Phase key (e.g., '01-requirements', '06-implementation')
 * @returns {Object[]} Array of frozen instance config objects
 */
export function getTeamInstancesByPhase(phase) {
  const ids = phaseIndex.get(phase);
  if (!ids) return [];
  return ids.map(id => registry.get(id));
}
