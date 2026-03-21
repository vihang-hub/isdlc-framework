/**
 * Gate Requirements Injector
 * ==========================
 * Builds formatted text blocks summarizing gate requirements for a given phase.
 *
 * Extracted from src/claude/hooks/lib/gate-requirements-injector.cjs (REQ-0081).
 *
 * @module src/core/validators/gate-requirements
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PHASE_NAME_MAP } from '../config/phase-ids.js';

/**
 * Default coverage threshold resolver (fallback if common.cjs unavailable).
 * @param {*} minCov
 * @returns {number|null}
 */
function defaultResolveCoverageThreshold(minCov) {
  if (minCov == null) return null;
  if (typeof minCov === 'number') return minCov;
  if (typeof minCov === 'object' && !Array.isArray(minCov)) {
    return minCov['standard'] ?? 80;
  }
  return 80;
}

/**
 * Reads a JSON config file from dual paths.
 */
function loadConfigFile(projectRoot, filename) {
  try {
    const srcPath = join(projectRoot, 'src', 'claude', 'hooks', 'config', filename);
    if (existsSync(srcPath)) {
      return JSON.parse(readFileSync(srcPath, 'utf8'));
    }
  } catch { /* Fall through */ }
  try {
    const fallbackPath = join(projectRoot, '.claude', 'hooks', 'config', filename);
    if (existsSync(fallbackPath)) {
      return JSON.parse(readFileSync(fallbackPath, 'utf8'));
    }
  } catch { /* Return null */ }
  return null;
}

export function loadIterationRequirements(projectRoot) {
  try {
    return loadConfigFile(projectRoot, 'iteration-requirements.json');
  } catch { return null; }
}

export function loadArtifactPaths(projectRoot) {
  try {
    return loadConfigFile(projectRoot, 'artifact-paths.json');
  } catch { return null; }
}

export function parseConstitutionArticles(projectRoot) {
  try {
    const constitutionPath = join(projectRoot, 'docs', 'isdlc', 'constitution.md');
    if (!existsSync(constitutionPath)) return {};
    const content = readFileSync(constitutionPath, 'utf8');
    const regex = /^### Article ([IVXLC]+):\s*(.+)$/gm;
    const articles = {};
    let match;
    while ((match = regex.exec(content)) !== null) {
      articles[match[1]] = match[2].trim();
    }
    return articles;
  } catch { return {}; }
}

export function loadWorkflowModifiers(projectRoot, workflowType, phaseKey) {
  try {
    if (!workflowType || !phaseKey) return null;
    const workflowsPath = join(projectRoot, '.isdlc', 'config', 'workflows.json');
    if (!existsSync(workflowsPath)) return null;
    const data = JSON.parse(readFileSync(workflowsPath, 'utf8'));
    const workflow = data && data.workflows && data.workflows[workflowType];
    if (!workflow || !workflow.agent_modifiers) return null;
    return workflow.agent_modifiers[phaseKey] || null;
  } catch { return null; }
}

export function resolveTemplateVars(pathStr, vars) {
  try {
    if (!vars || typeof vars !== 'object') return pathStr;
    let result = pathStr;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    return result;
  } catch { return pathStr; }
}

export function deepMerge(base, overrides) {
  try {
    const result = Object.assign({}, base);
    for (const key of Object.keys(overrides)) {
      const baseVal = base[key];
      const overVal = overrides[key];
      if (Array.isArray(baseVal) && Array.isArray(overVal)) {
        result[key] = [...baseVal, ...overVal];
      } else if (
        baseVal !== null && typeof baseVal === 'object' && !Array.isArray(baseVal) &&
        overVal !== null && typeof overVal === 'object' && !Array.isArray(overVal)
      ) {
        result[key] = deepMerge(baseVal, overVal);
      } else {
        result[key] = overVal;
      }
    }
    return result;
  } catch { return base || {}; }
}

export function buildCriticalConstraints(phaseKey, phaseReq, workflowModifiers, isIntermediatePhase, state, resolveCoverage) {
  try {
    const constraints = [];
    const _resolveCoverage = resolveCoverage || defaultResolveCoverageThreshold;

    if (isIntermediatePhase) {
      constraints.push('Do NOT run git commit -- the orchestrator manages all commits.');
    }

    const testIter = phaseReq.test_iteration || {};
    if (testIter.enabled) {
      const rawCoverage = (testIter.success_criteria && testIter.success_criteria.min_coverage_percent);
      const covType = phaseKey === '07-testing' ? 'integration' : 'unit';
      const coverage = _resolveCoverage(rawCoverage, state, covType) || 80;
      constraints.push(`Do NOT advance the gate until all tests pass with >= ${coverage}% coverage.`);
    }

    const constVal = phaseReq.constitutional_validation || {};
    if (constVal.enabled) {
      constraints.push('Constitutional validation MUST complete before gate advancement.');
    }

    const artVal = phaseReq.artifact_validation || {};
    if (artVal.enabled && artVal.paths && artVal.paths.length > 0) {
      constraints.push('Required artifacts MUST exist before gate advancement.');
    }

    if (workflowModifiers && typeof workflowModifiers === 'object') {
      if (workflowModifiers.require_failing_test_first) {
        constraints.push('You MUST write a failing test before implementing the fix.');
      }
    }

    return constraints;
  } catch { return []; }
}

export function buildConstraintReminder(constraints) {
  try {
    if (!Array.isArray(constraints) || constraints.length === 0) return '';
    return 'REMINDER: ' + constraints.join(' ');
  } catch { return ''; }
}

export function formatBlock(phaseKey, phaseReq, resolvedPaths, articleMap, workflowModifiers, isIntermediatePhase, state, resolveCoverage) {
  try {
    const phaseNum = phaseKey.split('-')[0];
    const phaseName = PHASE_NAME_MAP[phaseKey] || 'Unknown';
    const lines = [];
    const _resolveCoverage = resolveCoverage || defaultResolveCoverageThreshold;

    const isIntermediate = (isIntermediatePhase !== undefined) ? isIntermediatePhase : true;
    const constraints = buildCriticalConstraints(phaseKey, phaseReq, workflowModifiers, isIntermediate, state, _resolveCoverage);

    if (constraints.length > 0) {
      lines.push('========================================');
      lines.push(`CRITICAL CONSTRAINTS FOR PHASE ${phaseNum} (${phaseName}):`);
      for (const c of constraints) { lines.push(`- ${c}`); }
      lines.push('========================================');
      lines.push('');
    }

    lines.push(`GATE REQUIREMENTS FOR PHASE ${phaseNum} (${phaseName}):`);
    lines.push('');
    lines.push('Iteration Requirements:');

    const testIter = phaseReq.test_iteration || {};
    if (testIter.enabled) {
      const maxIter = testIter.max_iterations || 'N/A';
      const rawCoverage = (testIter.success_criteria && testIter.success_criteria.min_coverage_percent);
      const covType = phaseKey === '07-testing' ? 'integration' : 'unit';
      const coverage = _resolveCoverage(rawCoverage, state, covType) || 'N/A';
      lines.push(`  - test_iteration: enabled (max ${maxIter} iterations, coverage >= ${coverage}%)`);
    } else {
      lines.push('  - test_iteration: disabled');
    }

    const constVal = phaseReq.constitutional_validation || {};
    if (constVal.enabled) {
      const articles = (constVal.articles || []).join(', ');
      const maxIter = constVal.max_iterations || 'N/A';
      lines.push(`  - constitutional_validation: enabled (Articles: ${articles}, max ${maxIter} iterations)`);
    } else {
      lines.push('  - constitutional_validation: disabled');
    }

    const interElicit = phaseReq.interactive_elicitation || {};
    lines.push(`  - interactive_elicitation: ${interElicit.enabled ? 'enabled' : 'disabled'}`);
    const agentDel = phaseReq.agent_delegation_validation || {};
    lines.push(`  - agent_delegation: ${agentDel.enabled ? 'enabled' : 'disabled'}`);
    const artVal = phaseReq.artifact_validation || {};
    lines.push(`  - artifact_validation: ${artVal.enabled ? 'enabled' : 'disabled'}`);

    if (resolvedPaths && resolvedPaths.length > 0) {
      lines.push('');
      lines.push('Required Artifacts:');
      for (const p of resolvedPaths) { lines.push(`  - ${p}`); }
    }

    if (constVal.enabled && constVal.articles && constVal.articles.length > 0 && articleMap && Object.keys(articleMap).length > 0) {
      lines.push('');
      lines.push('Constitutional Articles to Validate:');
      for (const artId of constVal.articles) {
        const title = articleMap[artId] || 'Unknown';
        lines.push(`  - Article ${artId}: ${title}`);
      }
    }

    if (workflowModifiers && typeof workflowModifiers === 'object' && Object.keys(workflowModifiers).length > 0) {
      lines.push('');
      lines.push('Workflow Modifiers:');
      lines.push(`  ${JSON.stringify(workflowModifiers)}`);
    }

    lines.push('');
    if (constraints.length > 0) {
      lines.push(buildConstraintReminder(constraints));
    }
    lines.push('DO NOT attempt to advance the gate until ALL enabled requirements are satisfied.');

    return lines.join('\n');
  } catch { return ''; }
}

export function buildGateRequirementsBlock(phaseKey, artifactFolder, workflowType, projectRoot, phases, state, resolveCoverage) {
  try {
    const root = projectRoot || process.cwd();
    if (!phaseKey || typeof phaseKey !== 'string') return '';

    const iterReq = loadIterationRequirements(root);
    if (!iterReq || !iterReq.phase_requirements) return '';

    const phaseReq = iterReq.phase_requirements[phaseKey];
    if (!phaseReq) return '';

    const artifactPathsConfig = loadArtifactPaths(root);
    let resolvedPaths = [];
    if (artifactPathsConfig && artifactPathsConfig.phases && artifactPathsConfig.phases[phaseKey]) {
      const rawPaths = artifactPathsConfig.phases[phaseKey].paths || [];
      const vars = { artifact_folder: artifactFolder || '' };
      resolvedPaths = rawPaths.map(p => resolveTemplateVars(p, vars));
    }

    if (phaseReq.artifact_validation && phaseReq.artifact_validation.enabled && phaseReq.artifact_validation.paths) {
      const vars = { artifact_folder: artifactFolder || '' };
      const iterPaths = phaseReq.artifact_validation.paths.map(p => resolveTemplateVars(p, vars));
      for (const ip of iterPaths) {
        if (!resolvedPaths.includes(ip)) resolvedPaths.push(ip);
      }
    }

    const articleMap = parseConstitutionArticles(root);
    const workflowMods = loadWorkflowModifiers(root, workflowType, phaseKey);

    let isIntermediatePhase = true;
    if (Array.isArray(phases) && phases.length > 0) {
      isIntermediatePhase = (phaseKey !== phases[phases.length - 1]);
    }

    return formatBlock(phaseKey, phaseReq, resolvedPaths, articleMap, workflowMods, isIntermediatePhase, state, resolveCoverage);
  } catch { return ''; }
}
