#!/usr/bin/env node
/**
 * iSDLC Review Depth Validator - Notification Hook
 * ==================================================
 * Validates that code review output is substantive — references specific files,
 * contains findings, and is not generic rubber-stamp approval.
 * Fires on phase 08 completion.
 * Fails open on all internal errors (Article X).
 *
 * Traces to: REQ-GH-261, FR-006, AC-006-01 through AC-006-05
 * Version: 1.0.0
 */

const {
    debugLog,
    outputBlockResponse,
    readStdin,
    readState
} = require('./lib/common.cjs');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Phases this hook activates on. Traces to: AC-006-01 */
const ACTIVE_PHASES = ['08-code-review'];

/** Minimum unique file references for a substantive review */
const MIN_FILE_REFERENCES = 3;

/** Generic approval patterns. Traces to: AC-006-03 */
const GENERIC_APPROVAL_PATTERNS = [
    /\bLGTM\b/i,
    /\blooks?\s+good\b/i,
    /\bno\s+issues?\s+found\b/i,
    /\bapproved?\b/i,
    /\ball\s+(?:looks?|seems?)\s+(?:good|fine|ok|correct)\b/i,
    /\bship\s+it\b/i,
    /\bnothing\s+to\s+(?:report|flag|note)\b/i
];

/** Pattern to extract file path references from review output */
const FILE_PATH_PATTERN = /(?:^|\s|[`'"(])([a-zA-Z0-9_./\\-]+\.[a-zA-Z]{1,6})(?:\s|[`'")\]:,]|$|:\d+)/g;

/** Minimum file extensions to consider as code files */
const CODE_EXTENSIONS = new Set([
    'js', 'cjs', 'mjs', 'ts', 'tsx', 'jsx', 'py', 'go', 'rs',
    'java', 'rb', 'php', 'cs', 'cpp', 'c', 'h', 'md', 'json', 'yaml', 'yml'
]);

// ---------------------------------------------------------------------------
// countUniqueFileReferences(content)
// ---------------------------------------------------------------------------

/**
 * Count unique file path references in review output.
 * Traces to: AC-006-02
 *
 * @param {string} content - Review output text
 * @returns {string[]} Array of unique file paths found
 */
function countUniqueFileReferences(content) {
    if (!content || typeof content !== 'string') return [];
    const files = new Set();

    let match;
    const regex = new RegExp(FILE_PATH_PATTERN.source, 'g');
    while ((match = regex.exec(content)) !== null) {
        const filePath = match[1];
        // Verify it has a recognized extension
        const ext = filePath.split('.').pop().toLowerCase();
        if (CODE_EXTENSIONS.has(ext)) {
            // Normalize: remove leading ./ if present
            const normalized = filePath.replace(/^\.\//, '');
            files.add(normalized);
        }
    }

    return [...files];
}

// ---------------------------------------------------------------------------
// hasGenericApproval(content)
// ---------------------------------------------------------------------------

/**
 * Check if review output contains generic approval language.
 * Traces to: AC-006-03
 *
 * @param {string} content - Review output text
 * @returns {boolean}
 */
function hasGenericApproval(content) {
    if (!content || typeof content !== 'string') return false;
    return GENERIC_APPROVAL_PATTERNS.some(pat => pat.test(content));
}

// ---------------------------------------------------------------------------
// countFindings(content)
// ---------------------------------------------------------------------------

/**
 * Count the number of substantive findings in review output.
 * Looks for issue/concern indicators, bullet points with specifics, etc.
 *
 * @param {string} content - Review output text
 * @returns {number}
 */
function countFindings(content) {
    if (!content || typeof content !== 'string') return 0;
    const findingPatterns = [
        /^\s*[-*]\s+(?:issue|concern|bug|error|problem|suggestion|improvement|consider|recommend)/im,
        /^\s*[-*]\s+(?:Line\s+\d+|at\s+\w+\.\w+)/im,
        /^\s*\d+\.\s+(?:issue|concern|bug|error|problem|suggestion)/im
    ];
    const lines = content.split('\n');
    let count = 0;
    for (const line of lines) {
        for (const pat of findingPatterns) {
            if (pat.test(line)) {
                count++;
                break;
            }
        }
    }
    return count;
}

// ---------------------------------------------------------------------------
// check(ctx) -- Dispatcher-compatible entry point
// ---------------------------------------------------------------------------

/**
 * Dispatcher-compatible check function.
 * Validates review depth at phase gate.
 *
 * @param {object} ctx - Dispatcher context
 * @param {object} ctx.state - Parsed state.json
 * @param {string} [ctx.agentOutput] - Review agent's output
 * @returns {{ decision: 'allow'|'block', stopReason?: string, stateModified: boolean }}
 *
 * Traces to: AC-006-01 through AC-006-05
 */
function check(ctx) {
    try {
        // Fail-open: validate context
        if (!ctx || !ctx.state) {
            return { decision: 'allow', stateModified: false };
        }

        // Check active phase (AC-006-01)
        const currentPhase = (ctx.state.active_workflow || {}).current_phase || '';
        if (!ACTIVE_PHASES.includes(currentPhase)) {
            return { decision: 'allow', stateModified: false };
        }

        const agentOutput = ctx.agentOutput || '';
        if (!agentOutput || typeof agentOutput !== 'string') {
            debugLog('review-depth-validator: no agent output to evaluate, skipping (fail-open)');
            return { decision: 'allow', stateModified: false };
        }

        const issues = [];

        // Count file references (AC-006-02)
        const fileRefs = countUniqueFileReferences(agentOutput);
        const fileRefCount = fileRefs.length;

        // Check for generic approval with insufficient file references (AC-006-03)
        const isGeneric = hasGenericApproval(agentOutput);
        if (isGeneric && fileRefCount < MIN_FILE_REFERENCES) {
            issues.push(
                `Generic approval detected with only ${fileRefCount} file reference(s) ` +
                `(minimum ${MIN_FILE_REFERENCES} required). Specific file-level findings are needed.`
            );
        }

        // Check finding density — flag if review has zero findings on substantial content (AC-006-03 extended)
        const findings = countFindings(agentOutput);
        const outputLines = agentOutput.split('\n').length;
        if (findings === 0 && outputLines > 10) {
            issues.push(
                `Review has zero substantive findings across ${outputLines} lines of output. ` +
                `A thorough review should identify at least some observations or improvements.`
            );
        }

        if (issues.length === 0) {
            return { decision: 'allow', stateModified: false };
        }

        // Build block message (AC-006-04, AC-006-05)
        const header = `REVIEW DEPTH INCOMPLETE: ${issues.length} issue(s) found.\n\n`;
        const issueList = issues.map(i => `  - ${i}`).join('\n');
        const guidance = '\n\nTo resolve:\n' +
            '  - Re-review the code with file-level findings (reference specific files)\n' +
            '  - Include at least 3 unique file references in review output\n' +
            '  - Identify specific issues, suggestions, or observations per file';

        const stopReason = header + issueList + guidance;

        return {
            decision: 'block',
            stopReason,
            stateModified: false
        };
    } catch (error) {
        // Top-level fail-open (Article X)
        debugLog('review-depth-validator: unexpected error:', error.message);
        return { decision: 'allow', stateModified: false };
    }
}

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

module.exports = {
    check,
    // Exported for unit testing:
    countUniqueFileReferences,
    hasGenericApproval,
    countFindings,
    ACTIVE_PHASES,
    MIN_FILE_REFERENCES,
    GENERIC_APPROVAL_PATTERNS
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
            const ctx = { input, state, agentOutput: '' };

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
