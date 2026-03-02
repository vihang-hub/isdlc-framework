/**
 * iSDLC Antigravity Bridge
 * =========================
 * Provides compatibility layer for running iSDLC on Antigravity.
 * Version: 1.0.0
 */

const fs = require('fs');
const path = require('path');
const { getProjectRoot, isAntigravity, getFrameworkDir } = require('../claude/hooks/lib/common.cjs');

/**
 * Validates the current state and gate requirements before an action.
 * This is the Antigravity equivalent of a PreToolUse hook.
 * @param {string} phase - Optional phase to validate
 * @returns {object} { allowed: boolean, reason?: string }
 */
function validateContext(phase = null) {
    // In a Skill, we can use this to perform deterministic checks
    const projectRoot = getProjectRoot();
    const statePath = path.join(projectRoot, '.isdlc', 'state.json');

    if (!fs.existsSync(statePath)) {
        return { allowed: true }; // Fail-open if no state
    }

    try {
        const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        const currentPhase = phase || state.active_workflow?.current_phase || state.current_phase;

        // Here we would normally call the gate-blocker logic.
        // For the bridge, we'll provide a way forSkills to invoke this check.
        return { allowed: true, state, currentPhase };
    } catch (e) {
        return { allowed: false, reason: `Error reading state: ${e.message}` };
    }
}

/**
 * Wraps a result for Antigravity's task/skill protocol.
 */
function formatResult(success, message, data = {}) {
    return {
        success,
        message,
        ...data,
        timestamp: new Date().toISOString()
    };
}

module.exports = {
    validateContext,
    formatResult,
    isAntigravity,
    getFrameworkDir
};
