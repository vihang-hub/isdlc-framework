#!/usr/bin/env node
'use strict';
/**
 * iSDLC Post-Write/Edit Dispatcher - PostToolUse[Write] AND PostToolUse[Edit] Hook
 * ==================================================================================
 * Consolidates 3 PostToolUse[Write] / 2 PostToolUse[Edit] hooks into 1 process.
 * Registered for both Write and Edit events.
 * REQ-0010 Tier 1: Hook Dispatcher Consolidation
 *
 * All hooks run (no short-circuit -- PostToolUse is observational).
 *
 * Execution order:
 *   1. state-write-validator          - reads file from disk, stderr only
 *   2. output-format-validator        - reads file from disk, stderr only (Write only, skipped for Edit)
 *   3. workflow-completion-enforcer   - reads FRESH state from disk, remediates, prunes (MUST be last)
 *
 * SPECIAL CASE: workflow-completion-enforcer needs the freshly-written state.json
 * (the tool just wrote it), not the dispatcher's cached state. This hook does its
 * own readState() and writeState() internally. The dispatcher passes ctx but this
 * hook ignores ctx.state and reads fresh. It returns stateModified: false so we
 * do not overwrite its corrections.
 *
 * Because hooks 1 and 2 read directly from disk and never modify state, and hook 3
 * manages its own I/O, the dispatcher does NOT call writeState() at all.
 *
 * Hooks with activation guards are skipped when their conditions
 * aren't met (REQ-0010 T3-B).
 *
 * Version: 1.1.0
 */

const {
    readStdin,
    readState,
    loadManifest,
    loadIterationRequirements,
    loadWorkflowDefinitions,
    debugLog
} = require('../lib/common.cjs');

// Import hook check functions
const { check: stateWriteValidatorCheck } = require('../state-write-validator.cjs');
const { check: outputFormatValidatorCheck } = require('../output-format-validator.cjs');
const { check: workflowCompletionEnforcerCheck } = require('../workflow-completion-enforcer.cjs');

async function main() {
    try {
        // 1. Read stdin once
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

        // 2. Read state once (for ctx -- hooks 1 and 2 may reference it;
        //    hook 3 reads fresh from disk and ignores this copy)
        const state = readState();

        // 3. Load configs once
        const manifest = loadManifest();
        const requirements = loadIterationRequirements();
        const workflows = loadWorkflowDefinitions();

        // 4. Build ctx
        const ctx = { input, state, manifest, requirements, workflows };

        // 5. Determine tool name for conditional hook execution
        const toolName = input.tool_name;
        const hasActiveWorkflow = !!state?.active_workflow;

        // 6. Call hooks in order (all run, no short-circuit)
        const allStderr = [];

        // Hook 1: state-write-validator (always runs for both Write and Edit)
        try {
            const result = stateWriteValidatorCheck(ctx);
            if (result.stderr) allStderr.push(result.stderr);
        } catch (e) {
            debugLog('post-write-edit-dispatcher: state-write-validator threw:', e.message);
        }

        // Hook 2: output-format-validator (Write only, skipped for Edit; requires active workflow)
        if (toolName === 'Write' && hasActiveWorkflow) {
            try {
                const result = outputFormatValidatorCheck(ctx);
                if (result.stderr) allStderr.push(result.stderr);
            } catch (e) {
                debugLog('post-write-edit-dispatcher: output-format-validator threw:', e.message);
            }
        }

        // Hook 3: workflow-completion-enforcer (only when workflow just completed: active_workflow is null)
        if (!hasActiveWorkflow) {
            try {
                const result = workflowCompletionEnforcerCheck(ctx);
                // This hook outputs its own stderr via outputSelfHealNotification()
                // and writes state directly. We do not touch its stateModified flag.
                if (result.stderr) allStderr.push(result.stderr);
            } catch (e) {
                debugLog('post-write-edit-dispatcher: workflow-completion-enforcer threw:', e.message);
            }
        }

        // 7. Output accumulated stderr (no state write -- hooks manage their own)
        if (allStderr.length > 0) {
            console.error(allStderr.join('\n'));
        }

        // No stdout output from this dispatcher (none of the hooks produce stdout)
        process.exit(0);
    } catch (e) {
        debugLog('post-write-edit-dispatcher error:', e.message);
        process.exit(0);
    }
}

main();
