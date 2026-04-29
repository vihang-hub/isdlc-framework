#!/usr/bin/env node
/**
 * iSDLC Deferral Detector - PreToolUse Hook
 * ==========================================
 * Blocks Write/Edit calls containing deferral language in production code.
 * Inline enforcement of Article IV (Explicit Over Implicit).
 * Fails open on all internal errors (Article X).
 *
 * Traces to: REQ-GH-261, FR-002, AC-002-01 through AC-002-06
 * Version: 1.0.0
 */

const path = require('path');
const {
    debugLog,
    parseDeferralPatterns,
    outputBlockResponse,
    readStdin
} = require('./lib/common.cjs');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * File path patterns exempt from deferral scanning.
 * Traces to: AC-002-03
 */
const EXEMPT_PATH_PATTERNS = [
    /[/\\]tests?[/\\]/i,
    /[/\\]__tests__[/\\]/i,
    /\.test\.[a-z]+$/i,
    /\.spec\.[a-z]+$/i,
    /[/\\]ADR[s]?[/\\]/i,
    /[/\\]adr[s]?[/\\]/i,
    /BACKLOG\.md$/i,
    /tasks\.md$/i,
    /[/\\]docs[/\\]isdlc[/\\]/i,
    /[/\\]docs[/\\]requirements[/\\]/i,
    /\.test\.cjs$/i,
    /\.test\.js$/i
];

/**
 * Content marker that exempts a file from deferral scanning.
 * Traces to: AC-002-03
 */
const EXEMPT_MARKER = 'deferral-exempt';

// ---------------------------------------------------------------------------
// isExemptPath(filePath)
// ---------------------------------------------------------------------------

/**
 * Check if a file path is exempt from deferral scanning.
 *
 * @param {string} filePath - File path from tool input
 * @returns {boolean}
 */
function isExemptPath(filePath) {
    if (!filePath || typeof filePath !== 'string') return false;
    return EXEMPT_PATH_PATTERNS.some(pat => pat.test(filePath));
}

// ---------------------------------------------------------------------------
// formatBlockMessage(deferrals, filePath)
// ---------------------------------------------------------------------------

/**
 * Format a block message listing each deferral with line number and options.
 * Traces to: AC-002-04
 *
 * @param {Array<{ line: number, text: string, pattern: string }>} deferrals
 * @param {string} filePath - File being written/edited
 * @returns {string}
 */
function formatBlockMessage(deferrals, filePath) {
    const header = `DEFERRAL LANGUAGE DETECTED in ${filePath}:\n`;

    const lines = deferrals.map(d =>
        `  Line ${d.line}: "${d.text}" (pattern: ${d.pattern})`
    ).join('\n');

    const guidance =
        '\n\nTo resolve, choose one of:\n' +
        '  1. Implement the deferred functionality now (remove the deferral)\n' +
        '  2. Document in an ADR why this work is explicitly deferred\n' +
        '  3. Mark as out-of-scope in requirements-spec.md\n' +
        '  4. Add a "deferral-exempt" marker comment if this is a false positive';

    return header + lines + guidance;
}

// ---------------------------------------------------------------------------
// check(ctx) -- Dispatcher-compatible entry point
// ---------------------------------------------------------------------------

/**
 * Dispatcher-compatible check function.
 * Inspects Write/Edit content for deferral language.
 *
 * @param {object} ctx - Dispatcher context
 * @param {object} ctx.input - Parsed stdin JSON (tool call)
 * @returns {{ decision: 'allow'|'block', stopReason?: string, stateModified: boolean }}
 *
 * Traces to: AC-002-01, AC-002-02, AC-002-05
 */
function check(ctx) {
    try {
        // Fail-open: validate context
        if (!ctx || !ctx.input) {
            return { decision: 'allow', stateModified: false };
        }

        const input = ctx.input;

        // Only process Write and Edit tools (AC-002-01)
        const toolName = input.tool_name || '';
        if (toolName !== 'Write' && toolName !== 'Edit') {
            return { decision: 'allow', stateModified: false };
        }

        const toolInput = input.tool_input || {};

        // Get file path
        const filePath = toolInput.file_path || '';

        // Check path exemptions (AC-002-03)
        if (isExemptPath(filePath)) {
            debugLog('deferral-detector: exempt path:', filePath);
            return { decision: 'allow', stateModified: false };
        }

        // Get content to scan
        let content = '';
        if (toolName === 'Write') {
            content = toolInput.content || '';
        } else if (toolName === 'Edit') {
            content = toolInput.new_string || '';
        }

        if (!content || typeof content !== 'string') {
            return { decision: 'allow', stateModified: false };
        }

        // Check for exempt marker (AC-002-03)
        if (content.includes(EXEMPT_MARKER)) {
            debugLog('deferral-detector: exempt marker found');
            return { decision: 'allow', stateModified: false };
        }

        // Scan for deferral patterns (AC-002-02)
        const deferrals = parseDeferralPatterns(content);

        if (deferrals.length === 0) {
            return { decision: 'allow', stateModified: false };
        }

        // Block with detailed message (AC-002-04)
        const stopReason = formatBlockMessage(deferrals, filePath);
        debugLog('deferral-detector: blocking', deferrals.length, 'deferrals in', filePath);

        return {
            decision: 'block',
            stopReason,
            stateModified: false
        };
    } catch (error) {
        // Top-level fail-open (Article X)
        debugLog('deferral-detector: unexpected error:', error.message);
        return { decision: 'allow', stateModified: false };
    }
}

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

module.exports = {
    check,
    // Exported for unit testing:
    isExemptPath,
    formatBlockMessage,
    EXEMPT_PATH_PATTERNS,
    EXEMPT_MARKER
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

            const ctx = { input };
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
