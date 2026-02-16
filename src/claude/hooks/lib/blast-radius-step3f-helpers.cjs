'use strict';

/**
 * iSDLC Blast Radius STEP 3f Helpers (CJS)
 * ==========================================
 * Helper functions for the phase-loop controller (isdlc.md STEP 3f) to handle
 * blast-radius-validator blocks specifically: parse block messages, cross-reference
 * tasks.md, validate deferrals from requirements-spec.md, and manage retry counters.
 *
 * These functions are exported for unit testing and are referenced by the
 * isdlc.md STEP 3f instructions for LLM-assisted orchestration.
 *
 * Traces to: BUG-0019 (FR-01 through FR-05)
 * Version: 1.0.0
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of blast-radius re-implementation retries before escalation */
const MAX_BLAST_RADIUS_RETRIES = 3;

/** Pattern that identifies a blast-radius-validator block message */
const BLAST_RADIUS_HEADER_PATTERN = /BLAST RADIUS COVERAGE INCOMPLETE/i;

/** Pattern to extract individual unaddressed file entries from block message */
const UNADDRESSED_FILE_PATTERN = /^\s*-\s+(\S+)\s+\(expected:\s+(\w+)\)/gm;

/** Pattern to extract task entries from tasks.md content */
const TASK_ENTRY_PATTERN = /^-\s+\[([ Xx])\]\s+(T\d{4}[a-z]?)\s+(?:--|--)\s+(.+)/gm;

/** Pattern to find Deferred Files table rows in requirements-spec.md */
const DEFERRED_FILE_PATTERN = /\|\s*`([^`]+)`\s*\|/g;

// ---------------------------------------------------------------------------
// isBlastRadiusBlock
// ---------------------------------------------------------------------------

/**
 * Detect whether a block message is from the blast-radius-validator hook.
 *
 * @param {string} blockMessage - The stop reason / block message from the hook
 * @returns {boolean} True if this is a blast-radius-validator block
 *
 * Traces to: FR-05 AC-05.1
 */
function isBlastRadiusBlock(blockMessage) {
    if (!blockMessage || typeof blockMessage !== 'string') return false;
    return BLAST_RADIUS_HEADER_PATTERN.test(blockMessage);
}

// ---------------------------------------------------------------------------
// parseBlockMessageFiles
// ---------------------------------------------------------------------------

/**
 * Extract unaddressed file paths and their expected change types from a
 * blast-radius-validator block message.
 *
 * The block message format (from formatBlockMessage) is:
 *   BLAST RADIUS COVERAGE INCOMPLETE: N of M affected files are unaddressed.
 *
 *     - path/to/file1.js (expected: MODIFY)
 *     - path/to/file2.ts (expected: CREATE)
 *   ...
 *
 * @param {string} blockMessage - The block message from blast-radius-validator
 * @returns {Array<{filePath: string, changeType: string}>} Parsed file entries
 *
 * Traces to: FR-01 AC-01.4, FR-05 AC-05.2
 */
function parseBlockMessageFiles(blockMessage) {
    if (!blockMessage || typeof blockMessage !== 'string') return [];
    if (!BLAST_RADIUS_HEADER_PATTERN.test(blockMessage)) return [];

    const results = [];
    // Reset regex state for global match
    const regex = new RegExp(UNADDRESSED_FILE_PATTERN.source, 'gm');
    let match;
    while ((match = regex.exec(blockMessage)) !== null) {
        results.push({
            filePath: match[1],
            changeType: match[2]
        });
    }
    return results;
}

// ---------------------------------------------------------------------------
// matchFilesToTasks
// ---------------------------------------------------------------------------

/**
 * Cross-reference unaddressed files against tasks.md to identify which tasks
 * correspond to the unaddressed files.
 *
 * @param {Array<{filePath: string, changeType: string}>} unaddressedFiles - Files from parseBlockMessageFiles
 * @param {string|null} tasksMdContent - Content of docs/isdlc/tasks.md (null if file doesn't exist)
 * @returns {Array<{filePath: string, changeType: string, taskId: string|null, taskDescription: string|null, status: string, discrepancy: boolean}>}
 *
 * Traces to: FR-02 AC-02.1, AC-02.2, AC-02.3, AC-02.4
 */
function matchFilesToTasks(unaddressedFiles, tasksMdContent) {
    if (!unaddressedFiles || !Array.isArray(unaddressedFiles)) return [];

    // Parse tasks from tasks.md content
    const tasks = [];
    if (tasksMdContent && typeof tasksMdContent === 'string' && tasksMdContent.trim() !== '') {
        const regex = new RegExp(TASK_ENTRY_PATTERN.source, 'gm');
        let match;
        while ((match = regex.exec(tasksMdContent)) !== null) {
            const checkMark = match[1];
            const taskId = match[2];
            const description = match[3].trim();
            tasks.push({
                taskId,
                description,
                status: (checkMark === 'X' || checkMark === 'x') ? 'completed' : 'pending'
            });
        }
    }

    // For each unaddressed file, find matching task(s)
    return unaddressedFiles.map(file => {
        // Look through tasks for one that mentions this file path
        // Check task description and also look for files: sub-line
        let matchedTask = null;

        for (const task of tasks) {
            if (task.description.includes(file.filePath)) {
                matchedTask = task;
                break;
            }
        }

        // Also check for files: sub-lines in the raw content
        if (!matchedTask && tasksMdContent) {
            // Look for a task followed by a files: line containing our path
            const filesLinePattern = new RegExp(
                `-\\s+\\[[ Xx]\\]\\s+(T\\d{4}[a-z]?)\\s+(?:--|--)\\s+(.+?)\\n\\s+files:\\s*${escapeRegex(file.filePath)}`,
                'gm'
            );
            const filesMatch = filesLinePattern.exec(tasksMdContent);
            if (filesMatch) {
                const taskId = filesMatch[1];
                const description = filesMatch[2].trim();
                // Determine status from the checkbox
                const checkboxMatch = tasksMdContent.match(
                    new RegExp(`-\\s+\\[([ Xx])\\]\\s+${escapeRegex(taskId)}`)
                );
                const status = (checkboxMatch && (checkboxMatch[1] === 'X' || checkboxMatch[1] === 'x'))
                    ? 'completed' : 'pending';
                matchedTask = { taskId, description, status };
            }
        }

        if (matchedTask) {
            return {
                filePath: file.filePath,
                changeType: file.changeType,
                taskId: matchedTask.taskId,
                taskDescription: matchedTask.description,
                status: matchedTask.status,
                discrepancy: matchedTask.status === 'completed'
            };
        }

        return {
            filePath: file.filePath,
            changeType: file.changeType,
            taskId: null,
            taskDescription: null,
            status: 'unknown',
            discrepancy: false
        };
    });
}

/**
 * Escape special regex characters in a string.
 * @param {string} str
 * @returns {string}
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// isValidDeferral
// ---------------------------------------------------------------------------

/**
 * Check if a file has a valid deferral in the requirements-spec.md Deferred Files section.
 * Only files explicitly listed in the ## Deferred Files table with justification are valid.
 * Auto-generated deferrals (not in requirements-spec.md) are rejected.
 *
 * @param {string} filePath - The file path to check
 * @param {string|null} requirementsSpecContent - Content of requirements-spec.md
 * @returns {boolean} True if the file has a valid deferral
 *
 * Traces to: FR-04 AC-04.1, AC-04.2, AC-04.3
 */
function isValidDeferral(filePath, requirementsSpecContent) {
    if (!filePath || !requirementsSpecContent || typeof requirementsSpecContent !== 'string') {
        return false;
    }

    // Find the Deferred Files section
    const deferredSectionMatch = requirementsSpecContent.match(
        /## Deferred Files\s*\n([\s\S]*?)(?=\n##\s|\n#\s|$)/i
    );
    if (!deferredSectionMatch) return false;

    const deferredSection = deferredSectionMatch[1];

    // Check if the section contains a table with the file path
    // Table format: | `file/path` | Justification |
    const regex = new RegExp(DEFERRED_FILE_PATTERN.source, 'g');
    let match;
    while ((match = regex.exec(deferredSection)) !== null) {
        if (match[1].trim() === filePath.trim()) {
            return true;
        }
    }

    return false;
}

// ---------------------------------------------------------------------------
// Retry counter management
// ---------------------------------------------------------------------------

/**
 * Increment the blast radius retry counter in state.
 *
 * @param {object} state - The state.json object (mutated in place)
 * @returns {number} The new retry count
 *
 * Traces to: FR-03 AC-03.4
 */
function incrementBlastRadiusRetry(state) {
    if (!state) return 0;
    if (typeof state.blast_radius_retries !== 'number') {
        state.blast_radius_retries = 0;
    }
    state.blast_radius_retries += 1;
    return state.blast_radius_retries;
}

/**
 * Check if the blast radius retry limit has been exceeded.
 *
 * @param {object} state - The state.json object
 * @returns {boolean} True if retries >= MAX_BLAST_RADIUS_RETRIES
 *
 * Traces to: FR-03 AC-03.2, AC-03.3
 */
function isBlastRadiusRetryExceeded(state) {
    if (!state) return false;
    return (state.blast_radius_retries || 0) >= MAX_BLAST_RADIUS_RETRIES;
}

/**
 * Log a blast radius retry iteration in state.json.
 *
 * @param {object} state - The state.json object (mutated in place)
 * @param {{ iteration: number, unaddressed_count: number, matched_tasks: number }} entry - Retry details
 *
 * Traces to: FR-03 AC-03.4, NFR-03
 */
function logBlastRadiusRetry(state, entry) {
    if (!state) return;
    if (!Array.isArray(state.blast_radius_retry_log)) {
        state.blast_radius_retry_log = [];
    }
    state.blast_radius_retry_log.push({
        ...entry,
        timestamp: new Date().toISOString()
    });
}

// ---------------------------------------------------------------------------
// buildBlastRadiusRedelegationContext
// ---------------------------------------------------------------------------

/**
 * Build the complete re-delegation context for a blast-radius block.
 * Orchestrates: parsing block message, cross-referencing tasks, validating deferrals,
 * and managing retry counter.
 *
 * @param {string} blockMessage - The blast-radius-validator block message
 * @param {string|null} tasksMdContent - Content of docs/isdlc/tasks.md
 * @param {string|null} requirementsSpecContent - Content of requirements-spec.md
 * @param {object} state - The state.json object (mutated for retry tracking)
 * @returns {{ escalate?: boolean, reason?: string, remainingFiles?: Array, reDelegationNeeded: boolean, unaddressedFiles: Array, matchedTasks: Array, validDeferrals: Array, retryIteration: number, prohibitions: string[] }}
 *
 * Traces to: FR-01, FR-02, FR-03, FR-04, FR-05
 */
function buildBlastRadiusRedelegationContext(blockMessage, tasksMdContent, requirementsSpecContent, state) {
    // Check retry limit first
    if (isBlastRadiusRetryExceeded(state)) {
        const allFiles = parseBlockMessageFiles(blockMessage);
        return {
            escalate: true,
            reason: `Blast radius retry limit (${MAX_BLAST_RADIUS_RETRIES}) exceeded`,
            remainingFiles: allFiles,
            reDelegationNeeded: false,
            unaddressedFiles: allFiles,
            matchedTasks: [],
            validDeferrals: [],
            retryIteration: state.blast_radius_retries || MAX_BLAST_RADIUS_RETRIES,
            prohibitions: []
        };
    }

    // Increment retry counter
    const retryIteration = incrementBlastRadiusRetry(state);

    // Parse unaddressed files from block message
    const allUnaddressedFiles = parseBlockMessageFiles(blockMessage);

    // Separate valid deferrals from truly unaddressed files
    const validDeferrals = [];
    const unaddressedFiles = [];

    for (const file of allUnaddressedFiles) {
        if (isValidDeferral(file.filePath, requirementsSpecContent)) {
            validDeferrals.push(file);
        } else {
            unaddressedFiles.push(file);
        }
    }

    // Cross-reference remaining unaddressed files with tasks.md
    const matchedTasks = matchFilesToTasks(unaddressedFiles, tasksMdContent);

    // Log retry
    logBlastRadiusRetry(state, {
        iteration: retryIteration,
        unaddressed_count: unaddressedFiles.length,
        matched_tasks: matchedTasks.filter(t => t.taskId !== null).length
    });

    // Build prohibitions list
    const prohibitions = [
        'DO NOT modify impact-analysis.md',
        'DO NOT add deferral entries to blast-radius-coverage.md',
        'DO NOT modify state.json blast radius metadata to circumvent validation',
        'MUST NOT auto-generate deferrals -- only requirements-spec.md Deferred Files are valid'
    ];

    return {
        reDelegationNeeded: unaddressedFiles.length > 0,
        unaddressedFiles,
        matchedTasks,
        validDeferrals,
        retryIteration,
        prohibitions
    };
}

// ---------------------------------------------------------------------------
// formatRedelegationPrompt
// ---------------------------------------------------------------------------

/**
 * Format the re-delegation prompt string for sending the implementation agent
 * back to address unaddressed files.
 *
 * @param {{ unaddressedFiles: Array, matchedTasks: Array, retryIteration: number, prohibitions: string[] }} context
 * @returns {string} The formatted re-delegation prompt
 *
 * Traces to: FR-01 AC-01.1, AC-01.4, FR-02 AC-02.3
 */
function formatRedelegationPrompt(context) {
    const lines = [];

    lines.push('## BLAST RADIUS RE-IMPLEMENTATION (Retry ' + context.retryIteration + ' of ' + MAX_BLAST_RADIUS_RETRIES + ')');
    lines.push('');
    lines.push('The blast-radius-validator has blocked advancement because the following files');
    lines.push('from impact-analysis.md have not been addressed:');
    lines.push('');

    // Unaddressed files
    for (const file of context.unaddressedFiles) {
        lines.push('  - ' + file.filePath + ' (' + file.changeType + ')');
    }
    lines.push('');

    // Matched tasks
    if (context.matchedTasks && context.matchedTasks.length > 0) {
        lines.push('### Corresponding Tasks from tasks.md');
        lines.push('');
        for (const task of context.matchedTasks) {
            if (task.taskId) {
                const statusIcon = task.discrepancy ? ' [DISCREPANCY: marked done but file unaddressed]' : '';
                lines.push('  - ' + task.taskId + ': ' + task.taskDescription + statusIcon);
            } else {
                lines.push('  - ' + task.filePath + ': No matching task found in tasks.md');
            }
        }
        lines.push('');
    }

    // Prohibitions
    lines.push('### PROHIBITIONS (CRITICAL)');
    lines.push('');
    for (const p of context.prohibitions) {
        lines.push('  - ' + p);
    }
    lines.push('');

    lines.push('Implement the changes for each unaddressed file listed above. After completion,');
    lines.push('the gate check will be re-run automatically to verify coverage.');

    return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

module.exports = {
    // Constants
    MAX_BLAST_RADIUS_RETRIES,
    BLAST_RADIUS_HEADER_PATTERN,

    // Functions
    isBlastRadiusBlock,
    parseBlockMessageFiles,
    matchFilesToTasks,
    isValidDeferral,
    incrementBlastRadiusRetry,
    isBlastRadiusRetryExceeded,
    logBlastRadiusRetry,
    buildBlastRadiusRedelegationContext,
    formatRedelegationPrompt
};
