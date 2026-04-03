/**
 * iSDLC Core - Finalize Checklist Runner
 * =======================================
 * Config-driven runner that reads finalize-steps.md, executes steps
 * sequentially respecting dependencies, tracks per-step results,
 * and retries failures. Reuses task-reader.js parsing and the
 * retry pattern from task-dispatcher.js (#220).
 *
 * Traces to: FR-002 (REQ-GH-219), NFR-004
 */

import { readFileSync, existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { readTaskPlan, getTasksForPhase } from '../tasks/task-reader.js';
import { assignTiers } from '../tasks/task-reader.js';
import {
  mergeBranch,
  moveWorkflowToHistory,
  clearTransientFields,
  syncExternalStatus,
  rebuildSessionCache,
  regenerateContracts,
  rebuildMemoryEmbeddings,
  refreshCodeEmbeddings
} from './finalize-utils.js';

/**
 * Registry mapping step IDs to internal functions.
 * Each function receives (context) and returns { success, message?, error? }
 */
const INTERNAL_REGISTRY = {
  F0001: (ctx) => mergeBranch(ctx.branch, ctx.projectRoot),
  F0002: (ctx) => syncExternalStatus(ctx.workflowInfo, ctx.projectRoot),
  F0003: (ctx) => {
    const state = ctx.readState();
    moveWorkflowToHistory(state);
    clearTransientFields(state);
    ctx.writeState(state);
    return { success: true, message: 'Workflow moved to history, state cleared' };
  },
  F0005: (ctx) => rebuildSessionCache(ctx.projectRoot),
  F0006: (ctx) => regenerateContracts(ctx.projectRoot),
  F0008: (ctx) => rebuildMemoryEmbeddings(ctx.projectRoot),
  F0009: (ctx) => refreshCodeEmbeddings(ctx.projectRoot)
};

/**
 * Execute a single finalize step.
 * @param {object} step - Parsed task from task-reader
 * @param {object} context - Execution context
 * @returns {{ success: boolean, message?: string, error?: string, skipped?: boolean }}
 */
function executeStep(step, context) {
  const type = step.metadata?.type || 'internal';
  const stepId = step.id;

  switch (type) {
    case 'internal': {
      const handler = INTERNAL_REGISTRY[stepId];
      if (!handler) {
        return { success: false, error: `No internal handler for step ${stepId}` };
      }
      return handler(context);
    }

    case 'shell': {
      // For shell type, use the internal registry if mapped, otherwise skip
      const handler = INTERNAL_REGISTRY[stepId];
      if (handler) return handler(context);
      return { success: true, skipped: true, message: `Shell step ${stepId} — no command configured` };
    }

    case 'mcp':
      // MCP steps are handled by the Phase-Loop Controller, not the runner
      return { success: true, skipped: true, message: 'MCP steps handled by controller' };

    case 'provider':
      // Provider-specific steps skipped by the core runner
      return { success: true, skipped: true, message: 'Provider step — handled by provider adapter' };

    default:
      return { success: false, error: `Unknown step type: ${type}` };
  }
}

/**
 * Check if a step should be retried.
 * @param {object} step - Parsed task
 * @param {number} attempt - Current attempt (0-indexed)
 * @returns {boolean}
 */
function shouldRetry(step, attempt) {
  const maxRetries = step.metadata?.max_retries ?? 1;
  return attempt < maxRetries;
}

/**
 * Run the finalize checklist.
 * @param {string} projectRoot - Absolute path to project root
 * @param {object} options
 * @param {string} [options.configPath] - Override config path
 * @param {string} [options.defaultPath] - Fallback default template path
 * @param {string} [options.provider] - Current provider name
 * @param {object} [options.context] - Workflow context (branch, workflowInfo, readState, writeState)
 * @param {function} [options.onStepComplete] - Callback (step, result) for progress display
 * @returns {{ steps: Array<{id, name, status, retries, error?}>, summary: {total, passed, failed, skipped} }}
 */
export function runFinalizeChecklist(projectRoot, options = {}) {
  const configPath = options.configPath || join(projectRoot, '.isdlc', 'config', 'finalize-steps.md');
  const defaultPath = options.defaultPath || join(dirname(new URL(import.meta.url).pathname), 'finalize-steps.default.md');

  // AC-002-01: Read config, fall back to default, copy default if missing (AC-004-03)
  if (!existsSync(configPath) && existsSync(defaultPath)) {
    try {
      const dir = dirname(configPath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      copyFileSync(defaultPath, configPath);
    } catch (_) {
      // If copy fails, read from default directly
    }
  }

  const effectivePath = existsSync(configPath) ? configPath : defaultPath;
  const plan = readTaskPlan(effectivePath);

  if (!plan || plan.error) {
    return {
      steps: [],
      summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
      error: plan?.error || 'Could not parse finalize steps'
    };
  }

  // Get tasks from the FN phase (finalize)
  let tasks = getTasksForPhase(plan, 'FN');
  if (tasks.length === 0) {
    // Fallback: try first phase
    const firstKey = Object.keys(plan.phases)[0];
    if (firstKey) tasks = plan.phases[firstKey].tasks;
  }

  // Compute tiers for dependency-ordered execution
  const assigned = new Map();
  assignTiers(tasks, assigned);

  const maxTier = Math.max(0, ...Array.from(assigned.values()));
  const context = {
    projectRoot,
    branch: options.context?.branch,
    workflowInfo: options.context?.workflowInfo || {},
    readState: options.context?.readState,
    writeState: options.context?.writeState,
    provider: options.provider
  };

  const results = [];
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  // Execute tier by tier, sequentially within each tier
  for (let tier = 0; tier <= maxTier; tier++) {
    const tierTasks = tasks.filter(t => assigned.get(t.id) === tier && !t.complete);

    for (const task of tierTasks) {
      let attempt = 0;
      let result;

      // AC-002-02: Each step executed individually
      // AC-002-03: Retry on failure up to max_retries
      do {
        try {
          result = executeStep(task, context);
        } catch (err) {
          result = { success: false, error: err.message };
        }

        if (result.success) break;
        attempt++;
      } while (shouldRetry(task, attempt));

      const stepResult = {
        id: task.id,
        name: task.description,
        status: result.skipped ? 'skipped' : (result.success ? 'passed' : 'failed'),
        retries: attempt,
        ...(result.error && { error: result.error }),
        ...(result.message && { message: result.message })
      };

      results.push(stepResult);

      if (result.skipped) {
        skipped++;
      } else if (result.success) {
        passed++;
      } else {
        failed++;
        const isCritical = task.metadata?.critical === true;
        const failOpen = task.metadata?.fail_open !== false;

        // AC-002-04: Critical + not fail_open → halt
        if (isCritical && !failOpen) {
          stepResult.escalated = true;
          // Report progress before halting
          if (options.onStepComplete) options.onStepComplete(task, stepResult);
          return {
            steps: results,
            summary: { total: tasks.length, passed, failed, skipped },
            halted_at: task.id,
            halt_reason: `Critical step ${task.id} failed: ${result.error || 'unknown'}`
          };
        }
        // AC-002-05: Non-critical or fail_open → warn and continue
      }

      // Progress callback
      if (options.onStepComplete) options.onStepComplete(task, stepResult);
    }
  }

  return {
    steps: results,
    summary: { total: tasks.length, passed, failed, skipped }
  };
}
