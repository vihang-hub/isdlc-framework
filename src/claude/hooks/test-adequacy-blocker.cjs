#!/usr/bin/env node
/**
 * iSDLC Test Adequacy Blocker - PreToolUse[Task] Hook
 * =====================================================
 * Hard-blocks Phase 14 (upgrade) delegation when test coverage
 * is inadequate. Upgrades require a regression baseline.
 *
 * Performance budget: < 100ms
 * Fail-open: any error results in silent exit (exit 0, no output)
 *
 * Traces to: FR-07, AC-07a through AC-07f
 * Version: 1.0.0
 */

const {
    readStdin,
    readState,
    outputBlockResponse,
    debugLog,
    logHookEvent,
    detectPhaseDelegation
} = require('./lib/common.cjs');

/**
 * Default minimum unit test percentage if no constitution threshold.
 */
const DEFAULT_MIN_COVERAGE = 50;

/**
 * Check if a delegation targets the upgrade-engineer agent.
 * @param {object} delegation - Result from detectPhaseDelegation
 * @returns {boolean}
 */
function isUpgradeDelegation(delegation) {
    if (!delegation || !delegation.isDelegation) return false;
    const phase = delegation.targetPhase || '';
    const agent = (delegation.agentName || '').toLowerCase();
    return phase.startsWith('16-') ||
           phase.startsWith('14-upgrade') ||
           agent.includes('upgrade');
}

/**
 * Check if the raw Task prompt text indicates an upgrade delegation.
 * Fallback when detectPhaseDelegation cannot identify the agent
 * (e.g., no manifest file available).
 * @param {object} input - Parsed stdin
 * @returns {boolean}
 */
function isUpgradeFromPromptText(input) {
    const toolInput = input.tool_input || {};
    const combined = ((toolInput.prompt || '') + ' ' + (toolInput.description || '')).toLowerCase();
    return combined.includes('upgrade-engineer') ||
           combined.includes('upgrade engineer') ||
           (combined.includes('upgrade') && combined.includes('phase 14'));
}

/**
 * Check if the active workflow phase indicates an upgrade.
 * @param {object} state - Parsed state.json
 * @returns {boolean}
 */
function isUpgradePhaseActive(state) {
    const phase = (state.active_workflow && state.active_workflow.current_phase) || '';
    return phase.startsWith('16-') || phase.startsWith('14-upgrade');
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

        if (input.tool_name !== 'Task') {
            process.exit(0);
        }

        // Detect if this is a phase delegation targeting upgrade-engineer.
        // Primary path: use detectPhaseDelegation + isUpgradeDelegation.
        // Fallback: scan raw prompt text for upgrade keywords.
        const delegation = detectPhaseDelegation(input);
        let isUpgrade = isUpgradeDelegation(delegation);

        if (!isUpgrade) {
            // Fallback: check raw prompt text for upgrade-engineer references
            isUpgrade = isUpgradeFromPromptText(input);
        }

        if (!isUpgrade) {
            process.exit(0);
        }

        debugLog('Upgrade delegation detected, checking test adequacy');

        // Read state
        const state = readState();
        if (!state) {
            debugLog('No state.json, allowing (fail-open)');
            process.exit(0);
        }

        // Check coverage data from discovery context
        const coverage = state.discovery_context && state.discovery_context.coverage_summary;
        if (!coverage) {
            debugLog('No coverage data, allowing (fail-open) with warning');
            logHookEvent('test-adequacy-blocker', 'skip', {
                reason: 'No coverage data in discovery_context'
            });
            process.exit(0);
        }

        const totalTests = coverage.total_tests || 0;
        const unitPct = coverage.unit_test_pct || 0;
        const minCoverage = DEFAULT_MIN_COVERAGE;

        const issues = [];

        if (totalTests === 0) {
            issues.push(`total_tests is 0 (no tests exist)`);
        }

        if (unitPct < minCoverage) {
            issues.push(`unit_test_pct is ${unitPct}% (minimum: ${minCoverage}%)`);
        }

        if (issues.length === 0) {
            debugLog('Test adequacy check passed:', totalTests, 'tests,', unitPct + '% coverage');
            logHookEvent('test-adequacy-blocker', 'allow', {
                reason: `Adequate: ${totalTests} tests, ${unitPct}% coverage`
            });
            process.exit(0);
        }

        // Block: inadequate test coverage
        const targetPhase = (delegation && delegation.targetPhase) ||
            (state.active_workflow && state.active_workflow.current_phase) ||
            'upgrade';
        const reason = `Test adequacy insufficient: ${issues.join('; ')}`;
        logHookEvent('test-adequacy-blocker', 'block', {
            phase: targetPhase,
            reason
        });

        outputBlockResponse(
            `TEST ADEQUACY REQUIRED: The upgrade workflow requires adequate test ` +
            `coverage before proceeding. Upgrades need a regression baseline to ` +
            `validate against.\n\n` +
            `Issues:\n${issues.map(i => `  - ${i}`).join('\n')}\n\n` +
            `Current: ${totalTests} tests, ${unitPct}% unit coverage\n` +
            `Required: > 0 tests, >= ${minCoverage}% unit coverage\n\n` +
            `Run /isdlc test generate first to establish a regression baseline.`
        );
        process.exit(0);

    } catch (error) {
        debugLog('Error in test-adequacy-blocker:', error.message);
        process.exit(0);
    }
}

main();
