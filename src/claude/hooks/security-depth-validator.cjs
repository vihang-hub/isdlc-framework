#!/usr/bin/env node
/**
 * iSDLC Security Depth Validator - Notification Hook
 * ===================================================
 * Validates that external input handling has proper validation,
 * and flags generic security claims without specific file references.
 * Fires on phase 06 completion.
 * Fails open on all internal errors (Article X).
 *
 * Traces to: REQ-GH-261, FR-005, AC-005-01 through AC-005-06
 * Version: 1.0.0
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
    debugLog,
    getProjectRoot,
    detectExternalInputs,
    checkValidationProximity,
    outputBlockResponse,
    readStdin,
    readState
} = require('./lib/common.cjs');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Phases this hook activates on. Traces to: AC-005-01 */
const ACTIVE_PHASES = ['06-implementation'];

/** Patterns indicating generic security claims without specifics */
const GENERIC_CLAIM_PATTERNS = [
    /\bsecurity\s+(?:is|has\s+been)\s+(?:handled|addressed|implemented|covered)\b/i,
    /\ball\s+(?:inputs?|data)\s+(?:are|is)\s+(?:validated|sanitized|checked)\b/i,
    /\b(?:properly|fully)\s+secured?\b/i,
    /\bno\s+security\s+(?:issues?|concerns?|vulnerabilities?)\b/i
];

/** Pattern for specific file:line references */
const FILE_LINE_REFERENCE = /\b[\w./\\-]+\.[a-z]{1,4}(?::\d+|\s+line\s+\d+)/i;

// ---------------------------------------------------------------------------
// getModifiedSourceFiles(projectRoot)
// ---------------------------------------------------------------------------

/**
 * Get source files modified on the current branch vs main.
 * Excludes test files, config files, and documentation.
 * Traces to: AC-005-01
 *
 * @param {string} projectRoot
 * @returns {string[]|null}
 */
function getModifiedSourceFiles(projectRoot) {
    try {
        const result = execSync('git diff --name-only main...HEAD', {
            cwd: projectRoot,
            encoding: 'utf8',
            timeout: 5000,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        return result
            .trim()
            .split('\n')
            .map(line => line.trim())
            .filter(line => {
                if (!line) return false;
                if (/\.test\.|\.spec\.|[/\\]tests?[/\\]/i.test(line)) return false;
                if (/\.(md|json|yml|yaml|txt|html|css)$/i.test(line)) return false;
                if (/^docs[/\\]/.test(line)) return false;
                if (/^\.isdlc[/\\]/.test(line)) return false;
                return /\.(js|cjs|ts|mjs|jsx|tsx)$/.test(line);
            });
    } catch (error) {
        debugLog('security-depth-validator: git diff failed:', error.message);
        return null;
    }
}

// ---------------------------------------------------------------------------
// checkGenericClaims(agentOutput)
// ---------------------------------------------------------------------------

/**
 * Check agent output for generic security claims without file references.
 * Traces to: AC-005-05
 *
 * @param {string} agentOutput - Agent's phase completion output
 * @returns {string[]} Array of generic claim strings found
 */
function checkGenericClaims(agentOutput) {
    if (!agentOutput || typeof agentOutput !== 'string') return [];
    const claims = [];
    const lines = agentOutput.split('\n');

    for (const line of lines) {
        for (const pattern of GENERIC_CLAIM_PATTERNS) {
            if (pattern.test(line)) {
                // Check if the same line or nearby lines have file:line references
                if (!FILE_LINE_REFERENCE.test(line)) {
                    claims.push(line.trim());
                }
                break;
            }
        }
    }

    return claims;
}

// ---------------------------------------------------------------------------
// check(ctx) -- Dispatcher-compatible entry point
// ---------------------------------------------------------------------------

/**
 * Dispatcher-compatible check function.
 * Validates security depth at phase gate.
 *
 * @param {object} ctx - Dispatcher context
 * @param {object} ctx.state - Parsed state.json
 * @param {object} [ctx.agentOutput] - Agent's phase completion output (for generic claim check)
 * @returns {{ decision: 'allow'|'block', stopReason?: string, stateModified: boolean }}
 *
 * Traces to: AC-005-01 through AC-005-06
 */
function check(ctx) {
    try {
        // Fail-open: validate context
        if (!ctx || !ctx.state) {
            return { decision: 'allow', stateModified: false };
        }

        // Check active phase (AC-005-01)
        const currentPhase = (ctx.state.active_workflow || {}).current_phase || '';
        if (!ACTIVE_PHASES.includes(currentPhase)) {
            return { decision: 'allow', stateModified: false };
        }

        const projectRoot = getProjectRoot();

        // Get modified source files
        const modifiedFiles = getModifiedSourceFiles(projectRoot);
        if (modifiedFiles === null) {
            return { decision: 'allow', stateModified: false };
        }

        const issues = [];

        // Scan modified files for external inputs without validation (AC-005-02, AC-005-03)
        for (const relFile of modifiedFiles) {
            const absPath = path.join(projectRoot, relFile);
            if (!fs.existsSync(absPath)) continue;

            let content;
            try {
                content = fs.readFileSync(absPath, 'utf8');
            } catch (e) {
                continue;
            }

            const inputs = detectExternalInputs(content);
            for (const input of inputs) {
                const hasValidation = checkValidationProximity(content, input.line, 15);
                if (!hasValidation) {
                    issues.push(
                        `Unvalidated input: ${relFile}:${input.line} — ` +
                        `${input.pattern} (${input.type}) without validation within 15 lines`
                    );
                }
            }
        }

        // Check for generic security claims (AC-005-05)
        const agentOutput = ctx.agentOutput || '';
        const genericClaims = checkGenericClaims(agentOutput);
        for (const claim of genericClaims) {
            issues.push(`Generic security claim without file references: "${claim.substring(0, 100)}"`);
        }

        if (issues.length === 0) {
            return { decision: 'allow', stateModified: false };
        }

        // Build block message (AC-005-04, AC-005-06)
        const header = `SECURITY DEPTH INCOMPLETE: ${issues.length} issue(s) found.\n\n`;
        const issueList = issues.map(i => `  - ${i}`).join('\n');
        const guidance = '\n\nTo resolve:\n' +
            '  - Add input validation (typeof, schema.validate, null checks) near external inputs\n' +
            '  - Replace generic security claims with specific file:line references\n' +
            '  - Validation must appear within 15 lines of the external input usage';

        const stopReason = header + issueList + guidance;

        return {
            decision: 'block',
            stopReason,
            stateModified: false
        };
    } catch (error) {
        // Top-level fail-open (Article X)
        debugLog('security-depth-validator: unexpected error:', error.message);
        return { decision: 'allow', stateModified: false };
    }
}

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

module.exports = {
    check,
    // Exported for unit testing:
    getModifiedSourceFiles,
    checkGenericClaims,
    ACTIVE_PHASES,
    GENERIC_CLAIM_PATTERNS,
    FILE_LINE_REFERENCE
};

// ---------------------------------------------------------------------------
// Standalone execution
// ---------------------------------------------------------------------------

if (require.main === module) {
    (async () => {
        try {
            const inputStr = await readStdin();
            if (!inputStr || !inputStr.trim()) {
                process.exit(0);
            }
            let input;
            try { input = JSON.parse(inputStr); } catch (e) { process.exit(0); }

            const state = readState();
            const ctx = { input, state };

            const result = check(ctx);

            if (result.decision === 'block' && result.stopReason) {
                outputBlockResponse(result.stopReason);
            }
            process.exit(0);
        } catch (e) {
            process.exit(0);
        }
    })();
}
