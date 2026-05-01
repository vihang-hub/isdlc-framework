#!/usr/bin/env node
'use strict';

/** REQ-0022 FR-008: High-resolution timer with Date.now() fallback (ADR-0004) */
const _now = (typeof performance !== 'undefined' && typeof performance.now === 'function')
    ? () => performance.now()
    : () => Date.now();

/**
 * iSDLC Post-Skill Dispatcher - PostToolUse[Skill] Hook
 * ======================================================
 * Logs Skill tool invocations to skill_usage_log in state.json.
 * REQ-GH-278 FR-001: Populate skill_usage_log from PostToolUse[Skill] events.
 *
 * Single hook: log-skill-invocation
 * - Extracts skill name from tool_input.skill
 * - Appends entry with source:"tool_call" to skill_usage_log
 * - Writes state once
 *
 * PostToolUse hooks are observational — no short-circuit, fail-open.
 *
 * Version: 1.0.0
 */

const {
    readStdin,
    readState,
    writeState,
    getTimestamp,
    addSkillLogEntry,
    debugLog
} = require('../lib/common.cjs');

const DISPATCHER_NAME = 'post-skill-dispatcher';

async function main() {
    const _dispatcherStart = _now();
    try {
        // 1. Read stdin once
        const inputStr = await readStdin();
        if (!inputStr || !inputStr.trim()) {
            _emitTiming(_dispatcherStart, 0);
            process.exit(0);
        }

        let input;
        try {
            input = JSON.parse(inputStr);
        } catch (_e) {
            _emitTiming(_dispatcherStart, 0);
            process.exit(0);
        }

        // 2. Only process Skill tool calls
        if (!input || input.tool_name !== 'Skill') {
            _emitTiming(_dispatcherStart, 0);
            process.exit(0);
        }

        // 3. Extract skill name from tool_input.skill
        const toolInput = input.tool_input;
        if (!toolInput || !toolInput.skill) {
            _emitTiming(_dispatcherStart, 0);
            process.exit(0);
        }

        const skillName = toolInput.skill;

        // 4. Read state
        const state = readState();
        if (!state) {
            debugLog('post-skill-dispatcher: No state.json, skipping');
            _emitTiming(_dispatcherStart, 0);
            process.exit(0);
        }

        // 5. Check if enforcement is enabled
        const enforcement = state.skill_enforcement || {};
        if (enforcement.enabled === false) {
            debugLog('post-skill-dispatcher: Enforcement disabled, skipping');
            _emitTiming(_dispatcherStart, 0);
            process.exit(0);
        }

        // 6. Determine agent and phase from state
        const activeWorkflow = state.active_workflow;
        let agent = 'unknown';
        let phase = 'unknown';

        if (activeWorkflow) {
            phase = activeWorkflow.current_phase || state.current_phase || 'unknown';
            // Extract agent from sub_agent_log (last entry)
            const subAgentLog = activeWorkflow.sub_agent_log;
            if (Array.isArray(subAgentLog) && subAgentLog.length > 0) {
                agent = subAgentLog[subAgentLog.length - 1].agent || 'unknown';
            }
        } else {
            // Fallback to top-level current_phase
            phase = state.current_phase || 'unknown';
        }

        // 7. Build log entry
        const logEntry = {
            skill_name: skillName,
            agent: agent,
            phase: phase,
            timestamp: getTimestamp(),
            source: 'tool_call'
        };

        // Include args if present
        if (toolInput.args) {
            logEntry.args = toolInput.args;
        }

        // 8. Append to skill_usage_log and write state
        if (addSkillLogEntry(state, logEntry)) {
            writeState(state);
            debugLog(`post-skill-dispatcher: Logged skill usage: ${skillName} (tool_call)`);
        }

        _emitTiming(_dispatcherStart, 1);
        process.exit(0);
    } catch (e) {
        debugLog('post-skill-dispatcher error:', e.message);
        _emitTiming(_dispatcherStart, 0);
        process.exit(0); // Fail-open
    }
}

/** REQ-0022 FR-008: Dispatcher timing instrumentation */
function _emitTiming(start, hooksRan) {
    try {
        const _elapsed = _now() - start;
        console.error(`DISPATCHER_TIMING: ${DISPATCHER_NAME} completed in ${_elapsed.toFixed(1)}ms (${hooksRan} hooks)`);
    } catch (_te) { /* fail-open */ }
}

main();
