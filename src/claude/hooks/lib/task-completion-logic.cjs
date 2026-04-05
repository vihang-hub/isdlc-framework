/**
 * iSDLC Task Completion Logic - Shared Validation
 * =================================================
 * Pure logic for task-completion-gate hook. No I/O — all testable.
 *
 * Exported functions:
 *   check(ctx)                              → { decision, stderr?, stopReason?, phaseKey?, unfinishedTasks? }
 *   detectPhaseCompletionTransition(o, n)   → { phaseKey, isTransition } | null
 *   countUnfinishedTopLevelTasks(plan, key) → Array<{ id, description }>
 *   formatBlockMessage(key, tasks)          → string
 *
 * Error codes: TCG-001..TCG-009 (see module-design.md §4)
 * All fail-open per Article X.
 *
 * Traces: FR-001, FR-002, AC-001-01, AC-001-02, AC-002-01..06
 * REQ-GH-232 (Task Completion Gate Hook)
 * @module src/claude/hooks/lib/task-completion-logic
 * @version 1.0.0
 */

'use strict';

// ---------------------------------------------------------------------------
// Internal helpers (not exported)
// ---------------------------------------------------------------------------

/**
 * Parse proposed new state from tool_input.
 * Tries new_string (Edit) then content (Write).
 * @param {object} toolInput
 * @returns {object|null} Parsed JSON or null on any error (TCG-002)
 */
function parseNewStateFromInput(toolInput) {
  if (!toolInput || typeof toolInput !== 'object') return null;
  const raw = toolInput.new_string || toolInput.content;
  if (!raw || typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Check if an active build workflow exists.
 * @param {object} state - Current on-disk state.json
 * @returns {boolean} (TCG-004)
 */
function isBuildWorkflowActive(state) {
  if (!state || typeof state !== 'object') return false;
  const aw = state.active_workflow;
  if (!aw || typeof aw !== 'object') return false;
  return aw.type === 'build';
}

/**
 * Check if the task plan has a section matching the phase key.
 * Handles both exact match ("06") and prefix match ("06-implementation" startsWith "06").
 * @param {object} taskPlan - Parsed TaskPlan from task-reader
 * @param {string} phaseKey - Full phase key (e.g., "06-implementation")
 * @returns {boolean} (TCG-007)
 */
function hasMatchingPhaseSection(taskPlan, phaseKey) {
  if (!taskPlan || !taskPlan.phases || typeof taskPlan.phases !== 'object') return false;
  // Exact match first
  if (phaseKey in taskPlan.phases) return true;
  // Prefix match: "06-implementation" → try "06"
  const prefix = phaseKey.split('-')[0];
  if (prefix && prefix in taskPlan.phases) return true;
  return false;
}

/**
 * Resolve the actual phase key used in the task plan.
 * @param {object} taskPlan
 * @param {string} phaseKey
 * @returns {string|null}
 */
function resolvePhaseKey(taskPlan, phaseKey) {
  if (!taskPlan || !taskPlan.phases) return null;
  if (phaseKey in taskPlan.phases) return phaseKey;
  const prefix = phaseKey.split('-')[0];
  if (prefix && prefix in taskPlan.phases) return prefix;
  return null;
}

// ---------------------------------------------------------------------------
// Exported: detectPhaseCompletionTransition
// ---------------------------------------------------------------------------

/**
 * Detect if any phase transitions from non-"completed" to "completed".
 *
 * @param {object|null} oldState - Current on-disk state.json
 * @param {object|null} newState - Proposed new state from tool_input
 * @returns {{ phaseKey: string, isTransition: true }|null}
 *   First phase transitioning to "completed", or null if none.
 */
function detectPhaseCompletionTransition(oldState, newState) {
  if (!newState || typeof newState !== 'object') return null;
  const newPhases = newState.phases;
  if (!newPhases || typeof newPhases !== 'object') return null;

  const oldPhases = (oldState && typeof oldState === 'object' && oldState.phases) || {};

  for (const key of Object.keys(newPhases)) {
    const newPhase = newPhases[key];
    if (!newPhase || typeof newPhase !== 'object') continue;
    if (newPhase.status !== 'completed') continue;

    const oldPhase = oldPhases[key];
    const oldStatus = (oldPhase && typeof oldPhase === 'object') ? oldPhase.status : null;
    if (oldStatus !== 'completed') {
      return { phaseKey: key, isTransition: true };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Exported: countUnfinishedTopLevelTasks
// ---------------------------------------------------------------------------

/**
 * Count unfinished top-level tasks in the given phase.
 *
 * @param {object|null} taskPlan - Parsed TaskPlan from task-reader bridge
 * @param {string} phaseKey - Full phase key (e.g., "06-implementation")
 * @returns {Array<{ id: string, description: string }>}
 *   Empty array on any null/undefined/malformed input.
 */
function countUnfinishedTopLevelTasks(taskPlan, phaseKey) {
  if (!taskPlan || !phaseKey) return [];

  const resolved = resolvePhaseKey(taskPlan, phaseKey);
  if (!resolved) return [];

  const phase = taskPlan.phases[resolved];
  if (!phase || !Array.isArray(phase.tasks)) return [];

  const unfinished = [];
  for (const task of phase.tasks) {
    if (!task || typeof task !== 'object') continue;
    // Top-level only: parentId is null or undefined
    if (task.parentId != null) continue;
    // Unfinished: complete is false (or falsy)
    if (task.complete) continue;
    unfinished.push({
      id: task.id || 'unknown',
      description: task.description || '(no description)'
    });
  }
  return unfinished;
}

// ---------------------------------------------------------------------------
// Exported: formatBlockMessage
// ---------------------------------------------------------------------------

/**
 * Format the TASKS INCOMPLETE block message per AC-001-02.
 *
 * @param {string} phaseKey
 * @param {Array<{ id: string, description: string }>} unfinishedTasks
 * @returns {string}
 */
function formatBlockMessage(phaseKey, unfinishedTasks) {
  const count = Array.isArray(unfinishedTasks) ? unfinishedTasks.length : 0;
  const lines = [
    `TASKS INCOMPLETE: Phase ${phaseKey || 'unknown'} has ${count} unfinished top-level tasks.`,
    '',
    'Unfinished tasks (docs/isdlc/tasks.md):'
  ];

  if (Array.isArray(unfinishedTasks)) {
    for (const t of unfinishedTasks) {
      const id = (t && t.id) || 'unknown';
      const desc = (t && t.description) || '(no description)';
      lines.push(`  - [ ] ${id}: ${desc}`);
    }
  }

  lines.push('');
  lines.push('Article I.5: User-confirmed task plans are binding specifications.');
  lines.push('Complete remaining tasks, then retry phase completion.');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Exported: check (main entrypoint)
// ---------------------------------------------------------------------------

/**
 * Main validation logic. Pure function — no I/O.
 *
 * @param {{ input: object, state: object|null, taskPlan: object|null }} ctx
 * @returns {{ decision: 'block'|'allow', stderr?: string, stopReason?: string, phaseKey?: string, unfinishedTasks?: Array }}
 */
function check(ctx) {
  try {
    const { input, state, taskPlan } = ctx || {};

    // TCG-004: Not a build workflow → allow
    if (!isBuildWorkflowActive(state)) {
      return { decision: 'allow' };
    }

    // TCG-002: Parse new state from tool_input
    const toolInput = input && input.tool_input;
    const newState = parseNewStateFromInput(toolInput);
    if (!newState) {
      return { decision: 'allow' };
    }

    // TCG-005: Detect phase completion transition
    const transition = detectPhaseCompletionTransition(state, newState);
    if (!transition) {
      return { decision: 'allow' };
    }

    const { phaseKey } = transition;

    // TCG-006: No task plan available → allow with warning intent
    if (!taskPlan) {
      return { decision: 'allow', phaseKey };
    }

    // TCG-007: No matching phase section → allow
    if (!hasMatchingPhaseSection(taskPlan, phaseKey)) {
      return { decision: 'allow', phaseKey };
    }

    // Count unfinished top-level tasks
    const unfinished = countUnfinishedTopLevelTasks(taskPlan, phaseKey);

    if (unfinished.length === 0) {
      // All tasks done → allow
      return { decision: 'allow', phaseKey };
    }

    // TCG-008: Block — unfinished tasks detected
    const stderr = formatBlockMessage(phaseKey, unfinished);
    return {
      decision: 'block',
      stderr,
      stopReason: stderr,
      phaseKey,
      unfinishedTasks: unfinished
    };

  } catch {
    // TCG-009: Any unexpected exception → fail-open
    return { decision: 'allow' };
  }
}

module.exports = {
  check,
  detectPhaseCompletionTransition,
  countUnfinishedTopLevelTasks,
  formatBlockMessage
};
