#!/usr/bin/env node
/**
 * iSDLC Workflow Completion Enforcer - PostToolUse[Write,Edit] Hook
 * =================================================================
 * Ensures workflow_history entries have phase_snapshots and metrics
 * after workflow completion. Auto-remediates if missing.
 *
 * Trigger: state.json write where active_workflow is null and a recent
 * workflow_history entry lacks phase_snapshots or metrics.
 *
 * SELF-HEALING: reconstructs temporary active_workflow from the entry's
 * phases array (or state.phases keys as fallback), calls collectPhaseSnapshots(),
 * then applies all 4 pruning functions.
 *
 * NEVER produces stdout output (hook protocol).
 * Fail-open: any error results in silent exit (exit 0, no output).
 *
 * Performance budget: < 200ms
 *
 * Traces to: REQ-0005
 * Version: 1.0.0
 */

const {
    readStdin,
    readState,
    writeState,
    debugLog,
    logHookEvent,
    outputSelfHealNotification,
    collectPhaseSnapshots,
    pruneSkillUsageLog,
    pruneCompletedPhases,
    pruneHistory,
    pruneWorkflowHistory
} = require('./lib/common.cjs');

/**
 * Regex to match state.json paths (single-project and monorepo, cross-platform).
 */
const STATE_JSON_PATTERN = /\.isdlc[/\\](?:projects[/\\][^/\\]+[/\\])?state\.json$/;

/**
 * Maximum age (ms) of a workflow_history entry to consider for remediation.
 * Entries older than this are considered stale and skipped.
 */
const STALENESS_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

async function main() {
    try {
        const inputStr = await readStdin();
        if (!inputStr || !inputStr.trim()) {
            process.exit(0);
        }

        let input;
        try {
            input = JSON.parse(inputStr);
        } catch (e) {
            process.exit(0);
        }

        // Guard: only process Write and Edit tool results
        if (input.tool_name !== 'Write' && input.tool_name !== 'Edit') {
            process.exit(0);
        }

        const toolInput = input.tool_input || {};
        const filePath = toolInput.file_path || toolInput.filePath || '';

        // Guard: only process state.json writes
        if (!STATE_JSON_PATTERN.test(filePath)) {
            process.exit(0);
        }

        debugLog('workflow-completion-enforcer: state.json write detected:', filePath);

        // Read current state from disk
        let state;
        try {
            state = readState();
        } catch (e) {
            debugLog('workflow-completion-enforcer: could not read state:', e.message);
            process.exit(0);
        }

        // Guard: if active_workflow is still present, no transition happened
        if (state.active_workflow) {
            process.exit(0);
        }

        // Guard: need workflow_history with at least one entry
        if (!state.workflow_history || !Array.isArray(state.workflow_history) || state.workflow_history.length === 0) {
            process.exit(0);
        }

        // Get last workflow_history entry
        const lastEntry = state.workflow_history[state.workflow_history.length - 1];
        if (!lastEntry) {
            process.exit(0);
        }

        // Guard: check staleness — only remediate recent entries
        const entryTimestamp = lastEntry.completed_at || lastEntry.cancelled_at;
        if (entryTimestamp) {
            const entryTime = new Date(entryTimestamp).getTime();
            const now = Date.now();
            if (isNaN(entryTime) || (now - entryTime) > STALENESS_THRESHOLD_MS) {
                debugLog('workflow-completion-enforcer: entry is stale, skipping');
                process.exit(0);
            }
        }

        // Guard: if already has both phase_snapshots AND metrics, nothing to do
        if (
            Array.isArray(lastEntry.phase_snapshots) &&
            lastEntry.metrics && typeof lastEntry.metrics === 'object' &&
            Object.keys(lastEntry.metrics).length > 0
        ) {
            process.exit(0);
        }

        debugLog('workflow-completion-enforcer: auto-remediating missing snapshots/metrics');

        // Reconstruct temporary active_workflow for collectPhaseSnapshots()
        // Priority: entry.phases > Object.keys(state.phases) > empty
        let phasesArray = [];
        if (Array.isArray(lastEntry.phases) && lastEntry.phases.length > 0) {
            phasesArray = lastEntry.phases;
        } else if (state.phases && typeof state.phases === 'object') {
            phasesArray = Object.keys(state.phases);
        }

        // Temporarily set active_workflow so collectPhaseSnapshots can read it
        state.active_workflow = {
            phases: phasesArray,
            started_at: lastEntry.started_at || null,
            completed_at: lastEntry.completed_at || lastEntry.cancelled_at || null
        };

        // Collect snapshots
        const { phase_snapshots, metrics } = collectPhaseSnapshots(state);

        // Restore active_workflow to null
        state.active_workflow = null;

        // Patch last entry
        lastEntry.phase_snapshots = phase_snapshots;
        lastEntry.metrics = metrics;

        // Apply pruning (BUG-0004)
        pruneSkillUsageLog(state, 20);
        pruneCompletedPhases(state, []);
        pruneHistory(state, 50, 200);
        pruneWorkflowHistory(state, 50, 200);

        // Write back
        writeState(state);

        // Log and notify
        logHookEvent('workflow-completion-enforcer', 'self-heal', {
            action: 'remediated_missing_snapshots',
            phases_count: phase_snapshots.length,
            metrics_summary: `${metrics.phases_completed}/${metrics.total_phases} phases completed`
        });

        outputSelfHealNotification(
            'workflow-completion-enforcer',
            `Added ${phase_snapshots.length} phase snapshots and metrics to workflow_history entry`
        );

        // NEVER produce stdout output
        process.exit(0);

    } catch (error) {
        debugLog('workflow-completion-enforcer: error:', error.message);
        process.exit(0);
    }
}

main();
