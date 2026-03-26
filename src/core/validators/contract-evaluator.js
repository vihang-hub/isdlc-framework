/**
 * Contract Evaluator
 * ===================
 * REQ-0141: Execution Contract System (FR-003, FR-009)
 * AC-003-01 through AC-003-08, AC-009-01 through AC-009-06
 *
 * Evaluates actual execution against a contract entry.
 * Pure function -- takes inputs, returns structured result.
 * No state mutation, no I/O beyond reference resolution.
 * Fail-open on all errors (Article X).
 *
 * @module src/core/validators/contract-evaluator
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { resolveRef } from './contract-ref-resolver.js';
import { validateContractEntry } from './contract-schema.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Traverse a state object using dot-notation path.
 * @param {Object} obj - State object
 * @param {string} path - Dot-notation path (e.g., "phases.06-implementation.status")
 * @returns {{ found: boolean, value: * }}
 */
function getByPath(obj, path) {
  if (!obj || typeof obj !== 'object' || !path || typeof path !== 'string') {
    return { found: false, value: undefined };
  }
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return { found: false, value: undefined };
    }
    if (!(part in current)) {
      return { found: false, value: undefined };
    }
    current = current[part];
  }
  return { found: true, value: current };
}

/**
 * Create a violation object with the standard shape.
 * @param {Object} params
 * @returns {Object} Violation object
 */
function createViolation({ contractId, executionUnit, expectationType, expected, actual, severity, configuredResponse }) {
  return {
    contract_id: contractId,
    execution_unit: executionUnit,
    expectation_type: expectationType,
    expected,
    actual,
    severity: configuredResponse || severity || 'report',
    configured_response: configuredResponse || severity || 'report'
  };
}

/**
 * Format a violation as a standard banner string.
 * AC-009-03: Standard banner format.
 *
 * @param {Object} violation
 * @returns {string}
 */
export function formatViolationBanner(violation) {
  return [
    `CONTRACT VIOLATION: ${violation.execution_unit}`,
    `  Expected: ${violation.expected}`,
    `  Actual: ${violation.actual}`,
    `  Response: ${violation.configured_response}`
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluate a completed execution unit against its contract.
 *
 * @param {Object} params
 * @param {Object} params.state - Current state.json content
 * @param {Object} params.contractEntry - Loaded contract entry
 * @param {string} params.projectRoot - Project root for artifact checks
 * @param {string} [params.artifactFolder] - Artifact folder name for path substitution
 * @returns {{ violations: Object[], warnings: string[], stale_contract: boolean }}
 */
export function evaluateContract(params) {
  try {
    const { state, contractEntry, projectRoot, artifactFolder } = params || {};

    // Validate contract entry shape
    if (!contractEntry || typeof contractEntry !== 'object') {
      return { violations: [], warnings: ['Contract entry is null or not an object'], stale_contract: false };
    }

    const validation = validateContractEntry(contractEntry);
    if (!validation.valid) {
      return {
        violations: [],
        warnings: [`Contract entry malformed: ${validation.errors.join('; ')}`],
        stale_contract: false
      };
    }

    const violations = [];
    const warnings = [];
    const expectations = contractEntry.expectations || {};
    const violationResponse = contractEntry.violation_response || {};
    const contractId = `${contractEntry.execution_unit}:${contractEntry.context}`;
    const executionUnit = contractEntry.execution_unit;
    const cache = new Map();

    // 1. Agent engagement check
    if (expectations.agent !== null && expectations.agent !== undefined) {
      const engaged = checkAgentEngagement(state, expectations.agent, executionUnit);
      if (!engaged) {
        violations.push(createViolation({
          contractId,
          executionUnit,
          expectationType: 'agent_not_engaged',
          expected: `Agent "${expectations.agent}" engaged for ${executionUnit}`,
          actual: 'No matching delegation found in skill_usage_log',
          configuredResponse: violationResponse.agent_not_engaged || 'block'
        }));
      }
    }

    // 2. Skills required check
    if (expectations.skills_required !== null && expectations.skills_required !== undefined) {
      const resolvedSkills = resolveRef(expectations.skills_required, {
        projectRoot: projectRoot || '.',
        cache,
        artifactFolder
      });
      if (resolvedSkills.length > 0) {
        const missingSkills = checkSkillsUsed(state, resolvedSkills);
        for (const skillId of missingSkills) {
          violations.push(createViolation({
            contractId,
            executionUnit,
            expectationType: 'skills_missing',
            expected: `Skill "${skillId}" used during ${executionUnit}`,
            actual: `Skill "${skillId}" not found in skill_usage_log`,
            configuredResponse: violationResponse.skills_missing || 'report'
          }));
        }
      } else if (expectations.skills_required && expectations.skills_required['$ref']) {
        warnings.push(`Could not resolve skills $ref for ${executionUnit} -- skipping skills check`);
      }
    }

    // 3. Artifacts produced check
    if (expectations.artifacts_produced !== null && expectations.artifacts_produced !== undefined) {
      const resolvedPaths = resolveRef(expectations.artifacts_produced, {
        projectRoot: projectRoot || '.',
        cache,
        artifactFolder
      });
      if (resolvedPaths.length > 0) {
        const missingArtifacts = checkArtifactsExist(resolvedPaths, projectRoot || '.');
        for (const artPath of missingArtifacts) {
          violations.push(createViolation({
            contractId,
            executionUnit,
            expectationType: 'artifacts_missing',
            expected: `Artifact "${artPath}" exists on disk`,
            actual: `Artifact "${artPath}" not found`,
            configuredResponse: violationResponse.artifacts_missing || 'block'
          }));
        }
      } else if (expectations.artifacts_produced && expectations.artifacts_produced['$ref']) {
        warnings.push(`Could not resolve artifacts $ref for ${executionUnit} -- skipping artifacts check`);
      }
    }

    // 4. State assertions check
    if (Array.isArray(expectations.state_assertions)) {
      for (const assertion of expectations.state_assertions) {
        if (!assertion || !assertion.path) continue;
        const result = getByPath(state, assertion.path);
        if (!result.found) {
          warnings.push(`State path "${assertion.path}" not found -- skipping assertion`);
          continue;
        }
        // Deep equality via JSON comparison for objects/arrays, strict for primitives
        const matches = typeof assertion.equals === 'object'
          ? JSON.stringify(result.value) === JSON.stringify(assertion.equals)
          : result.value === assertion.equals;
        if (!matches) {
          violations.push(createViolation({
            contractId,
            executionUnit,
            expectationType: 'state_incomplete',
            expected: `state.${assertion.path} === ${JSON.stringify(assertion.equals)}`,
            actual: `state.${assertion.path} === ${JSON.stringify(result.value)}`,
            configuredResponse: violationResponse.state_incomplete || 'report'
          }));
        }
      }
    }

    // 5. Presentation check
    if (expectations.presentation !== null && expectations.presentation !== undefined && typeof expectations.presentation === 'object') {
      const presViolations = checkPresentation(state, expectations.presentation, contractId, executionUnit, violationResponse);
      violations.push(...presViolations.violations);
      warnings.push(...presViolations.warnings);
    }

    // 6. Cleanup check (string-described, limited enforcement)
    if (Array.isArray(expectations.cleanup)) {
      for (const cleanupItem of expectations.cleanup) {
        // For now, cleanup items are warnings only -- uncheckable items produce warnings
        if (typeof cleanupItem === 'string' && cleanupItem.length > 0) {
          warnings.push(`Cleanup item not verified: "${cleanupItem}"`);
        }
      }
    }

    return { violations, warnings, stale_contract: false };
  } catch (err) {
    // Fail-open (Article X): any thrown exception -> empty violations with warning
    return {
      violations: [],
      warnings: [`Contract evaluation error: ${err.message || String(err)}`],
      stale_contract: false
    };
  }
}

// ---------------------------------------------------------------------------
// Check functions
// ---------------------------------------------------------------------------

/**
 * Check if an agent was engaged by looking at skill_usage_log.
 * @param {Object} state
 * @param {string} expectedAgent
 * @param {string} executionUnit
 * @returns {boolean}
 */
function checkAgentEngagement(state, expectedAgent, executionUnit) {
  if (!state || !Array.isArray(state.skill_usage_log)) return false;
  return state.skill_usage_log.some(entry =>
    entry && (entry.agent === expectedAgent || entry.delegated_to === expectedAgent)
  );
}

/**
 * Check which required skills are missing from skill_usage_log.
 * @param {Object} state
 * @param {string[]} requiredSkills
 * @returns {string[]} Missing skill IDs
 */
function checkSkillsUsed(state, requiredSkills) {
  if (!state || !Array.isArray(state.skill_usage_log)) return requiredSkills;
  const usedSkills = new Set();
  for (const entry of state.skill_usage_log) {
    if (entry && entry.skill_id) usedSkills.add(entry.skill_id);
    if (entry && entry.skill) usedSkills.add(entry.skill);
  }
  return requiredSkills.filter(id => !usedSkills.has(id));
}

/**
 * Check which artifact paths are missing from disk.
 * @param {string[]} paths - Resolved artifact paths
 * @param {string} projectRoot
 * @returns {string[]} Missing paths
 */
function checkArtifactsExist(paths, projectRoot) {
  const missing = [];
  for (const p of paths) {
    const fullPath = join(projectRoot, p);
    if (!existsSync(fullPath)) {
      missing.push(p);
    }
  }
  return missing;
}

/**
 * Check presentation expectations.
 * @param {Object} state
 * @param {Object} presentation
 * @param {string} contractId
 * @param {string} executionUnit
 * @param {Object} violationResponse
 * @returns {{ violations: Object[], warnings: string[] }}
 */
function checkPresentation(state, presentation, contractId, executionUnit, violationResponse) {
  const violations = [];
  const warnings = [];
  const configuredResponse = violationResponse.presentation_violated || 'warn';

  // Check confirmation_sequence
  if (Array.isArray(presentation.confirmation_sequence) && presentation.confirmation_sequence.length > 0) {
    const phaseState = state?.phases?.[executionUnit];
    const actualSequence = phaseState?.confirmation_domains || state?.confirmation_domains;
    if (!actualSequence || !Array.isArray(actualSequence)) {
      violations.push(createViolation({
        contractId,
        executionUnit,
        expectationType: 'presentation_violated',
        expected: `Confirmation sequence: ${presentation.confirmation_sequence.join(' -> ')}`,
        actual: 'No confirmation_domains recorded in state',
        configuredResponse
      }));
    } else {
      const matches = presentation.confirmation_sequence.every((domain, i) =>
        actualSequence[i] === domain
      );
      if (!matches) {
        violations.push(createViolation({
          contractId,
          executionUnit,
          expectationType: 'presentation_violated',
          expected: `Confirmation sequence: ${presentation.confirmation_sequence.join(' -> ')}`,
          actual: `Actual sequence: ${actualSequence.join(' -> ')}`,
          configuredResponse
        }));
      }
    }
  }

  // Check persona_format
  if (presentation.persona_format) {
    const complianceRecords = state?.conversational_compliance;
    if (complianceRecords && typeof complianceRecords === 'object') {
      if (complianceRecords.format_violations && complianceRecords.format_violations > 0) {
        violations.push(createViolation({
          contractId,
          executionUnit,
          expectationType: 'presentation_violated',
          expected: `Persona format: ${presentation.persona_format}`,
          actual: `${complianceRecords.format_violations} format violation(s) detected`,
          configuredResponse
        }));
      }
    }
    // If no compliance records, add a warning
    if (!complianceRecords) {
      warnings.push(`No conversational_compliance records in state -- cannot verify persona_format`);
    }
  }

  // Check completion_summary
  if (presentation.completion_summary === true) {
    const phaseState = state?.phases?.[executionUnit];
    const hasSummary = phaseState?.summary || phaseState?.completion_summary;
    if (!hasSummary) {
      violations.push(createViolation({
        contractId,
        executionUnit,
        expectationType: 'presentation_violated',
        expected: 'Completion summary produced',
        actual: 'No completion summary found in state',
        configuredResponse
      }));
    }
  }

  // Check progress_format
  if (presentation.progress_format) {
    // Advisory check -- presence of progress tracking in state
    const phaseState = state?.phases?.[executionUnit];
    if (!phaseState || !phaseState.timing) {
      warnings.push(`Cannot verify progress_format "${presentation.progress_format}" -- no phase timing data`);
    }
  }

  return { violations, warnings };
}
