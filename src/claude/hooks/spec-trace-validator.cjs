#!/usr/bin/env node
/**
 * iSDLC Spec Trace Validator - Notification Hook
 * ================================================
 * Verifies file-to-AC traceability at phase gate.
 * Flags untraced file modifications and unimplemented ACs.
 * Fires on phase 06 completion.
 * Fails open on all internal errors (Article X).
 *
 * Traces to: REQ-GH-261, FR-004, AC-004-01 through AC-004-07
 * Version: 1.0.0
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
    debugLog,
    getProjectRoot,
    extractACsFromSpec,
    outputBlockResponse,
    readStdin,
    readState
} = require('./lib/common.cjs');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Phases this hook activates on. Traces to: AC-004-01 */
const ACTIVE_PHASES = ['06-implementation'];

/** File patterns exempt from traceability checks */
const EXEMPT_FILE_PATTERNS = [
    /^\.isdlc\//,
    /^\.claude\//,
    /^\.github\//,
    /^\.gitignore$/,
    /package\.json$/,
    /package-lock\.json$/,
    /\.eslintrc/,
    /tsconfig/,
    /\.prettierrc/,
    /^docs\/isdlc\//,
    /^docs\/requirements\//,
    /\.test\.[a-z]+$/i,
    /\.spec\.[a-z]+$/i,
    /\.test\.cjs$/i,
    /[/\\]tests?[/\\]/,
    /^tests\//,
    /^node_modules\//
];

// ---------------------------------------------------------------------------
// getModifiedFiles(projectRoot)
// ---------------------------------------------------------------------------

/**
 * Get files modified on the current branch vs main.
 * Traces to: AC-004-02
 *
 * @param {string} projectRoot - Absolute path to project root
 * @returns {string[]|null} Array of relative file paths, or null on error
 */
function getModifiedFiles(projectRoot) {
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
            .filter(line => line.length > 0);
    } catch (error) {
        debugLog('spec-trace-validator: git diff failed:', error.message);
        return null;
    }
}

// ---------------------------------------------------------------------------
// parseTasksFileMap(tasksPath)
// ---------------------------------------------------------------------------

/**
 * Parse tasks.md to build a map of file paths to AC traces.
 * Traces to: AC-004-03
 *
 * @param {string} tasksPath - Path to tasks.md
 * @returns {{ fileToACs: Map<string, string[]>, acToFiles: Map<string, string[]> }|null}
 */
function parseTasksFileMap(tasksPath) {
    try {
        if (!fs.existsSync(tasksPath)) return null;
        const content = fs.readFileSync(tasksPath, 'utf8');
        const lines = content.split('\n');

        const fileToACs = new Map();
        const acToFiles = new Map();

        let currentTraces = [];
        let inPhase06 = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Detect Phase 06 section
            if (/^##\s+Phase\s+06/i.test(line)) {
                inPhase06 = true;
                continue;
            }
            if (/^##\s+Phase\s+(?!06)/i.test(line)) {
                inPhase06 = false;
                continue;
            }

            if (!inPhase06) continue;

            // Extract traces from task lines: | traces: FR-002, AC-001-01, AC-001-02
            const traceMatch = line.match(/\|\s*traces:\s*(.*)/);
            if (traceMatch) {
                const traceStr = traceMatch[1];
                const acMatches = traceStr.match(/AC-\d{3}-\d{2}/g) || [];
                currentTraces = acMatches;
                continue;
            }

            // Extract files from sub-lines: files: path/to/file (CREATE)
            const fileMatch = line.match(/^\s{2}files:\s*(.*)/);
            if (fileMatch) {
                const filesStr = fileMatch[1];
                // Split on comma for multiple files
                const fileParts = filesStr.split(',').map(f => f.trim());
                for (const part of fileParts) {
                    // Extract path, stripping (CREATE)/(MODIFY) suffix
                    const pathMatch = part.match(/^([^\s(]+)/);
                    if (pathMatch) {
                        const filePath = pathMatch[1].trim();
                        if (!fileToACs.has(filePath)) {
                            fileToACs.set(filePath, []);
                        }
                        for (const ac of currentTraces) {
                            if (!fileToACs.get(filePath).includes(ac)) {
                                fileToACs.get(filePath).push(ac);
                            }
                            if (!acToFiles.has(ac)) {
                                acToFiles.set(ac, []);
                            }
                            if (!acToFiles.get(ac).includes(filePath)) {
                                acToFiles.get(ac).push(filePath);
                            }
                        }
                    }
                }
                continue;
            }

            // Reset traces when encountering a new task line
            if (/^-\s*\[/.test(line)) {
                currentTraces = [];
            }
        }

        return { fileToACs, acToFiles };
    } catch (error) {
        debugLog('spec-trace-validator: error parsing tasks.md:', error.message);
        return null;
    }
}

// ---------------------------------------------------------------------------
// isExemptFile(filePath)
// ---------------------------------------------------------------------------

/**
 * Check if a file path is exempt from traceability checks.
 *
 * @param {string} filePath - Relative file path
 * @returns {boolean}
 */
function isExemptFile(filePath) {
    if (!filePath || typeof filePath !== 'string') return true;
    return EXEMPT_FILE_PATTERNS.some(pat => pat.test(filePath));
}

// ---------------------------------------------------------------------------
// check(ctx) -- Dispatcher-compatible entry point
// ---------------------------------------------------------------------------

/**
 * Dispatcher-compatible check function.
 * Validates spec traceability at phase gate.
 *
 * @param {object} ctx - Dispatcher context
 * @param {object} ctx.state - Parsed state.json
 * @returns {{ decision: 'allow'|'block', stopReason?: string, stateModified: boolean }}
 *
 * Traces to: AC-004-01 through AC-004-07
 */
function check(ctx) {
    try {
        // Fail-open: validate context
        if (!ctx || !ctx.state) {
            return { decision: 'allow', stateModified: false };
        }

        // Check active phase (AC-004-01)
        const currentPhase = (ctx.state.active_workflow || {}).current_phase || '';
        if (!ACTIVE_PHASES.includes(currentPhase)) {
            return { decision: 'allow', stateModified: false };
        }

        const projectRoot = getProjectRoot();
        const artifactFolder = (ctx.state.active_workflow || {}).artifact_folder || '';

        // Get modified files (AC-004-02)
        const modifiedFiles = getModifiedFiles(projectRoot);
        if (modifiedFiles === null) {
            debugLog('spec-trace-validator: git diff failed, skipping (fail-open)');
            return { decision: 'allow', stateModified: false };
        }

        // Parse tasks.md (AC-004-03)
        const tasksPath = path.join(projectRoot, 'docs', 'isdlc', 'tasks.md');
        const taskMap = parseTasksFileMap(tasksPath);
        if (taskMap === null) {
            debugLog('spec-trace-validator: cannot parse tasks.md, skipping (fail-open)');
            return { decision: 'allow', stateModified: false };
        }

        // Read spec for AC list
        const specPath = path.join(projectRoot, 'docs', 'requirements', artifactFolder, 'requirements-spec.md');
        let allACs = [];
        if (fs.existsSync(specPath)) {
            try {
                const specContent = fs.readFileSync(specPath, 'utf8');
                allACs = extractACsFromSpec(specContent);
            } catch (e) {
                debugLog('spec-trace-validator: cannot read spec:', e.message);
            }
        }

        const issues = [];

        // Check for untraced modifications (AC-004-04)
        const untracedFiles = [];
        for (const file of modifiedFiles) {
            if (isExemptFile(file)) continue;
            if (!taskMap.fileToACs.has(file)) {
                untracedFiles.push(file);
            }
        }

        if (untracedFiles.length > 0) {
            for (const f of untracedFiles) {
                issues.push(`Untraced file: ${f} — not mapped to any AC in tasks.md`);
            }
        }

        // Check for unimplemented ACs (AC-004-05)
        if (allACs.length > 0) {
            const implementedACs = new Set();
            for (const file of modifiedFiles) {
                const acs = taskMap.fileToACs.get(file);
                if (acs) {
                    for (const ac of acs) {
                        implementedACs.add(ac);
                    }
                }
            }

            for (const ac of allACs) {
                if (!implementedACs.has(ac.id) && taskMap.acToFiles.has(ac.id)) {
                    // AC is in tasks.md but no file modification found
                    const expectedFiles = taskMap.acToFiles.get(ac.id);
                    const desc = ac.description ? ' — ' + ac.description.substring(0, 60) : '';
                    issues.push(`Unimplemented AC: ${ac.id}${desc} (expected files: ${expectedFiles.join(', ')})`);
                }
            }
        }

        if (issues.length === 0) {
            return { decision: 'allow', stateModified: false };
        }

        // Build block message (AC-004-06, AC-004-07)
        const header = `SPEC TRACE INCOMPLETE: ${issues.length} traceability issue(s) found.\n\n`;
        const issueList = issues.map(i => `  - ${i}`).join('\n');
        const guidance = '\n\nTo resolve:\n' +
            '  - Add untraced files to the appropriate task in tasks.md\n' +
            '  - Implement code changes for unimplemented ACs\n' +
            '  - Or remove unneeded file modifications';

        const stopReason = header + issueList + guidance;

        return {
            decision: 'block',
            stopReason,
            stateModified: false
        };
    } catch (error) {
        // Top-level fail-open (Article X)
        debugLog('spec-trace-validator: unexpected error:', error.message);
        return { decision: 'allow', stateModified: false };
    }
}

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

module.exports = {
    check,
    // Exported for unit testing:
    getModifiedFiles,
    parseTasksFileMap,
    isExemptFile,
    ACTIVE_PHASES,
    EXEMPT_FILE_PATTERNS
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
