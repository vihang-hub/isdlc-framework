#!/usr/bin/env node
/**
 * iSDLC Test Quality Validator - Notification Hook
 * ==================================================
 * Validates test quality at phase gate: AC coverage, assertions per test block,
 * error path negative tests. Fires on phase 06 and 16 completion.
 * Fails open on all internal errors (Article X).
 *
 * Traces to: REQ-GH-261, FR-003, AC-003-01 through AC-003-08
 * Version: 1.0.0
 */

const fs = require('fs');
const path = require('path');
const {
    debugLog,
    getProjectRoot,
    extractACsFromSpec,
    scanTestTraces,
    countAssertions,
    detectErrorPaths,
    outputBlockResponse,
    readStdin,
    readState,
    loadManifest,
    loadIterationRequirements
} = require('./lib/common.cjs');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Phases this hook activates on. Traces to: AC-003-01 */
const ACTIVE_PHASES = ['06-implementation', '16-quality-loop'];

/** Test file patterns to scan */
const TEST_FILE_PATTERNS = [/\.test\.[a-z]+$/i, /\.spec\.[a-z]+$/i, /\.test\.cjs$/i];

// ---------------------------------------------------------------------------
// findTestFiles(baseDir)
// ---------------------------------------------------------------------------

/**
 * Recursively find test files under a directory.
 * @param {string} baseDir - Directory to search
 * @returns {string[]} Array of absolute file paths
 */
function findTestFiles(baseDir) {
    const results = [];
    if (!fs.existsSync(baseDir)) return results;

    function walk(dir) {
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (entry.name !== 'node_modules' && entry.name !== '.git') {
                        walk(fullPath);
                    }
                } else if (TEST_FILE_PATTERNS.some(p => p.test(entry.name))) {
                    results.push(fullPath);
                }
            }
        } catch (e) {
            debugLog('test-quality-validator: error walking', dir, e.message);
        }
    }

    walk(baseDir);
    return results;
}

// ---------------------------------------------------------------------------
// findSourceFiles(baseDir)
// ---------------------------------------------------------------------------

/**
 * Find source files (non-test .js/.cjs/.ts files) under a directory.
 * @param {string} baseDir - Directory to search
 * @returns {string[]} Array of absolute file paths
 */
function findSourceFiles(baseDir) {
    const results = [];
    if (!fs.existsSync(baseDir)) return results;

    function walk(dir) {
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'tests') {
                        walk(fullPath);
                    }
                } else if (/\.(js|cjs|ts|mjs)$/.test(entry.name) && !TEST_FILE_PATTERNS.some(p => p.test(entry.name))) {
                    results.push(fullPath);
                }
            }
        } catch (e) {
            debugLog('test-quality-validator: error walking', dir, e.message);
        }
    }

    walk(baseDir);
    return results;
}

// ---------------------------------------------------------------------------
// check(ctx) -- Dispatcher-compatible entry point
// ---------------------------------------------------------------------------

/**
 * Dispatcher-compatible check function.
 * Validates test quality at phase gate.
 *
 * @param {object} ctx - Dispatcher context
 * @param {object} ctx.input - Parsed stdin JSON
 * @param {object} ctx.state - Parsed state.json
 * @returns {{ decision: 'allow'|'block', stopReason?: string, stateModified: boolean }}
 *
 * Traces to: AC-003-01 through AC-003-08
 */
function check(ctx) {
    try {
        // Fail-open: validate context
        if (!ctx || !ctx.state) {
            return { decision: 'allow', stateModified: false };
        }

        // Check if we're in an active phase (AC-003-01)
        const currentPhase = (ctx.state.active_workflow || {}).current_phase || '';
        if (!ACTIVE_PHASES.includes(currentPhase)) {
            return { decision: 'allow', stateModified: false };
        }

        const projectRoot = getProjectRoot();
        const artifactFolder = (ctx.state.active_workflow || {}).artifact_folder || '';

        // Read requirements-spec.md to extract ACs (AC-003-02)
        const specPath = path.join(projectRoot, 'docs', 'requirements', artifactFolder, 'requirements-spec.md');
        if (!fs.existsSync(specPath)) {
            debugLog('test-quality-validator: no requirements-spec.md, skipping (fail-open)');
            return { decision: 'allow', stateModified: false };
        }

        let specContent;
        try {
            specContent = fs.readFileSync(specPath, 'utf8');
        } catch (e) {
            debugLog('test-quality-validator: cannot read spec:', e.message);
            return { decision: 'allow', stateModified: false };
        }

        const acs = extractACsFromSpec(specContent);
        if (acs.length === 0) {
            debugLog('test-quality-validator: no ACs found in spec, skipping');
            return { decision: 'allow', stateModified: false };
        }

        const acIds = acs.map(a => a.id);

        // Collect test content (AC-003-03)
        const testDirs = [
            path.join(projectRoot, 'src', 'claude', 'hooks', 'tests'),
            path.join(projectRoot, 'tests')
        ];

        let allTestContent = '';
        const testFiles = [];
        for (const dir of testDirs) {
            const files = findTestFiles(dir);
            for (const f of files) {
                try {
                    const content = fs.readFileSync(f, 'utf8');
                    allTestContent += content + '\n';
                    testFiles.push({ path: f, content });
                } catch (e) {
                    debugLog('test-quality-validator: cannot read test file:', f);
                }
            }
        }

        const issues = [];

        // Check AC coverage (AC-003-03, AC-003-04)
        const traceResult = scanTestTraces(allTestContent, acIds);
        if (traceResult.uncovered.length > 0) {
            for (const uncoveredId of traceResult.uncovered) {
                const ac = acs.find(a => a.id === uncoveredId);
                const desc = ac ? ac.description : '';
                issues.push(`Untested AC: ${uncoveredId}${desc ? ' — ' + desc.substring(0, 80) : ''}`);
            }
        }

        // Check assertion counts (AC-003-05)
        for (const tf of testFiles) {
            const assertionResults = countAssertions(tf.content);
            const zeroAssertionBlocks = assertionResults.filter(r => r.count === 0);
            for (const zab of zeroAssertionBlocks) {
                const relPath = path.relative(projectRoot, tf.path);
                issues.push(`Zero assertions: ${relPath}:${zab.line} — test "${zab.testName}"`);
            }
        }

        // Check error paths have negative tests (AC-003-06)
        const srcDir = path.join(projectRoot, 'src');
        if (fs.existsSync(srcDir)) {
            const sourceFiles = findSourceFiles(srcDir);
            for (const sf of sourceFiles) {
                try {
                    const srcContent = fs.readFileSync(sf, 'utf8');
                    const errorPaths = detectErrorPaths(srcContent);
                    if (errorPaths.length > 0) {
                        // Check if any test file references error/fail/invalid keywords
                        // for this source file
                        const relSrcPath = path.relative(projectRoot, sf);
                        const baseName = path.basename(sf, path.extname(sf));
                        const hasNegativeTest = testFiles.some(tf => {
                            const content = tf.content;
                            const refersToFile = content.includes(baseName);
                            const hasNegativeKeywords = /\b(error|fail|invalid|reject|throw|catch|negative)\b/i.test(content);
                            return refersToFile && hasNegativeKeywords;
                        });

                        if (!hasNegativeTest) {
                            issues.push(`Missing negative tests: ${relSrcPath} has ${errorPaths.length} error paths but no negative tests found`);
                        }
                    }
                } catch (e) {
                    // Fail-open: skip unreadable source files
                }
            }
        }

        if (issues.length === 0) {
            return { decision: 'allow', stateModified: false };
        }

        // Build block message (AC-003-07, AC-003-08)
        const header = `TEST QUALITY INCOMPLETE: ${issues.length} issue(s) found.\n\n`;
        const issueList = issues.map(i => `  - ${i}`).join('\n');
        const guidance = '\n\nTo resolve:\n' +
            '  - Write tests for untested ACs (include AC ID in test description or traces comment)\n' +
            '  - Add assertions to zero-assertion test blocks\n' +
            '  - Add negative/error-path tests for modules with error handling';

        const stopReason = header + issueList + guidance;

        return {
            decision: 'block',
            stopReason,
            stateModified: false
        };
    } catch (error) {
        // Top-level fail-open (Article X)
        debugLog('test-quality-validator: unexpected error:', error.message);
        return { decision: 'allow', stateModified: false };
    }
}

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

module.exports = {
    check,
    // Exported for unit testing:
    findTestFiles,
    findSourceFiles,
    ACTIVE_PHASES
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
