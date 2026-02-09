#!/usr/bin/env node
/**
 * iSDLC Constitutional Iteration Validator - PreToolUse[Skill] Hook
 * ==================================================================
 * Before gate advancement, verifies that constitutional_validation
 * was actually performed for the current phase.
 *
 * Performance budget: < 100ms
 * Fail-open: any error results in silent exit (exit 0, no output)
 *
 * Traces to: FR-02, AC-02a through AC-02h
 * Version: 1.0.0
 */

const {
    readStdin,
    readState,
    outputBlockResponse,
    debugLog,
    logHookEvent
} = require('./lib/common.cjs');

/**
 * Patterns that indicate a gate-related skill invocation.
 */
const GATE_PATTERNS = [
    /gate[-_]?check/i,
    /\badvance\b/i,
    /gate[-_]?validation/i,
    /phase[-_]?transition/i
];

/**
 * Check if a skill invocation is gate-related.
 * @param {object} input - Parsed stdin JSON
 * @returns {boolean}
 */
function isGateInvocation(input) {
    // Check skill name
    const skillName = (input.tool_input && input.tool_input.skill) || '';
    if (/^\/isdlc$/i.test(skillName) || /^isdlc$/i.test(skillName) || /^\/sdlc$/i.test(skillName)) {
        // Check args for gate-related keywords
        const args = (input.tool_input && input.tool_input.args) || '';
        for (const pattern of GATE_PATTERNS) {
            if (pattern.test(args)) {
                return true;
            }
        }
    }

    // Check the task/prompt content for gate keywords
    const prompt = (input.tool_input && input.tool_input.prompt) ||
                   (input.tool_input && input.tool_input.description) || '';
    for (const pattern of GATE_PATTERNS) {
        if (pattern.test(prompt)) {
            return true;
        }
    }

    return false;
}

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

        // Only check Skill invocations
        if (input.tool_name !== 'Skill') {
            process.exit(0);
        }

        // Only check gate-related invocations
        if (!isGateInvocation(input)) {
            debugLog('Not a gate invocation, allowing');
            process.exit(0);
        }

        debugLog('Gate invocation detected, checking constitutional validation');

        // Read state
        const state = readState();
        if (!state) {
            debugLog('No state.json, allowing (fail-open)');
            process.exit(0);
        }

        if (!state.active_workflow) {
            debugLog('No active workflow, allowing');
            process.exit(0);
        }

        const currentPhase = state.active_workflow.current_phase;
        if (!currentPhase) {
            debugLog('No current phase, allowing');
            process.exit(0);
        }

        // Check constitutional validation for current phase
        const phaseData = state.phases && state.phases[currentPhase];
        if (!phaseData) {
            debugLog('No phase data for', currentPhase, ', allowing (fail-open)');
            logHookEvent('constitutional-iteration-validator', 'skip', {
                phase: currentPhase,
                reason: 'No phase data found'
            });
            process.exit(0);
        }

        const cv = phaseData.constitutional_validation;
        if (!cv) {
            debugLog('No constitutional_validation section, allowing (fail-open)');
            logHookEvent('constitutional-iteration-validator', 'skip', {
                phase: currentPhase,
                reason: 'No constitutional_validation section'
            });
            process.exit(0);
        }

        // Validate fields
        const issues = [];

        if (cv.completed !== true) {
            issues.push(`completed is ${cv.completed}, expected true`);
        }

        if (!cv.iterations_used || cv.iterations_used < 1) {
            issues.push(`iterations_used is ${cv.iterations_used || 0}, expected >= 1`);
        }

        if (cv.status !== 'compliant' && cv.status !== 'escalated') {
            issues.push(`status is '${cv.status}', expected 'compliant' or 'escalated'`);
        }

        if (!cv.articles_checked || !Array.isArray(cv.articles_checked) || cv.articles_checked.length === 0) {
            issues.push('articles_checked is empty or missing');
        }

        if (issues.length > 0) {
            const reason = `Constitutional validation incomplete for phase '${currentPhase}': ${issues.join('; ')}`;
            logHookEvent('constitutional-iteration-validator', 'block', {
                phase: currentPhase,
                reason
            });
            outputBlockResponse(
                `CONSTITUTIONAL VALIDATION INCOMPLETE: ${reason}.\n\n` +
                `Complete constitutional validation before gate advancement.\n` +
                `Required: completed=true, iterations_used>=1, status=compliant|escalated, articles_checked non-empty.`
            );
            process.exit(0);
        }

        // All checks pass
        debugLog('Constitutional validation complete for', currentPhase);
        logHookEvent('constitutional-iteration-validator', 'allow', {
            phase: currentPhase,
            reason: 'Validation complete'
        });
        process.exit(0);

    } catch (error) {
        debugLog('Error in constitutional-iteration-validator:', error.message);
        process.exit(0);
    }
}

main();
