#!/usr/bin/env node
/**
 * iSDLC Antigravity - Change Summary Generator
 * ==============================================
 * Post-implementation summary: generates structured diff reports after phase 06.
 * Dual output: change-summary.md (human-readable) + change-summary.json (machine-readable).
 *
 * Usage:
 *   node src/antigravity/change-summary-generator.cjs --folder "docs/requirements/REQ-0054-..."
 *
 * Output (JSON to stdout):
 *   { "result": "OK", "files_changed": N, ... }
 *   { "result": "ERROR", "message": "..." }
 *
 * Exit codes:
 *   0 = Success (full or degraded)
 *   2 = Hard error (missing --folder)
 *
 * Traces to: REQ-0054 (FR-001 through FR-008, NFR-001 through NFR-011)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { getProjectRoot, readState } = require('../claude/hooks/lib/common.cjs');

// --- Constants ---

/** Timeout for individual git commands (ms). Traces to: NFR-001 */
const GIT_TIMEOUT_MS = 5000;

/** Maximum file size (bytes) for code comment scanning. Traces to: NFR-003 */
const MAX_CODE_SCAN_SIZE = 102400; // 100 KB

/** Regex for extracting FR-NNN and AC-NNN-NN identifiers. Traces to: FR-003 */
const REQ_PATTERN = /(?:FR-\d{3}|AC-\d{3}-\d{2})/g;

/** JSON schema version for change-summary.json. Traces to: NFR-005 */
const SCHEMA_VERSION = '1.0';

// --- Helpers ---

/**
 * Filter requirement IDs against the valid set.
 * If validReqs is empty, accept all IDs (graceful degradation).
 * @param {string[]} ids
 * @param {Set<string>} validReqs
 * @returns {string[]}
 */
function filterByValidSet(ids, validReqs) {
    const unique = [...new Set(ids)];
    if (validReqs.size === 0) return unique;
    return unique.filter(id => validReqs.has(id));
}

/**
 * Check if a string slice contains null bytes (binary file indicator).
 * @param {string} slice
 * @returns {boolean}
 */
function containsNullBytes(slice) {
    return slice.includes('\0');
}

/**
 * Parse a single line from `git diff --name-status` output.
 * @param {string} line
 * @returns {{ status: string, path: string, oldPath: string|null }|null}
 */
function parseDiffLine(line) {
    const parts = line.split('\t');
    if (parts.length < 2) return null;
    const statusCode = parts[0].trim();
    if (statusCode.startsWith('R')) {
        return { status: 'R', oldPath: parts[1], path: parts[2] || parts[1] };
    }
    return { status: statusCode.charAt(0), path: parts[1], oldPath: null };
}

// --- Pipeline Functions ---

/**
 * Parse CLI arguments from process.argv.
 * @returns {{ folder: string|null }}
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const result = { folder: null };
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--folder' && args[i + 1]) {
            result.folder = args[i + 1];
            i++;
        }
    }
    return result;
}

/**
 * Load project root, state.json, and resolve paths.
 * @param {string} folderArg
 * @returns {Object} context
 * @throws {Error} If folder does not exist
 */
function loadProjectContext(folderArg) {
    const projectRoot = getProjectRoot();
    const folderAbsolute = path.isAbsolute(folderArg)
        ? folderArg
        : path.join(projectRoot, folderArg);

    if (!fs.existsSync(folderAbsolute)) {
        throw new Error(`Folder not found: ${folderArg}`);
    }

    const state = readState();
    const baseBranch = state?.active_workflow?.base_branch || 'main';
    const workflowSlug = state?.active_workflow?.slug || path.basename(folderAbsolute);
    const artifactFolder = state?.active_workflow?.artifact_folder || path.basename(folderAbsolute);
    const folderRelative = path.relative(projectRoot, folderAbsolute);

    return {
        projectRoot,
        state,
        folderAbsolute,
        folderRelative,
        baseBranch,
        workflowSlug,
        artifactFolder,
        reqSpecPath: path.join(folderAbsolute, 'requirements-spec.md'),
        tasksPath: path.join(projectRoot, 'docs', 'isdlc', 'tasks.md')
    };
}

/**
 * Collect changed files by diffing HEAD against the merge-base.
 * @param {string} projectRoot
 * @param {string} baseBranch
 * @returns {{ mergeBase: string, head: string, entries: Array }|null}
 */
function collectGitDiff(projectRoot, baseBranch) {
    const opts = { cwd: projectRoot, encoding: 'utf8', timeout: GIT_TIMEOUT_MS, stdio: ['pipe', 'pipe', 'pipe'] };
    try {
        const mergeBase = execSync(`git merge-base HEAD ${baseBranch}`, opts).trim();
        const head = execSync('git rev-parse HEAD', opts).trim();
        const diffOutput = execSync(`git diff --name-status ${mergeBase}..HEAD`, opts);
        const entries = diffOutput
            .split('\n')
            .filter(line => line.trim())
            .map(parseDiffLine)
            .filter(Boolean);
        return { mergeBase, head, entries };
    } catch (_) {
        return null;
    }
}

/**
 * Classify each changed file with human-readable change type and rationale.
 * @param {Array} entries - DiffEntry[]
 * @param {string} projectRoot
 * @returns {Array} ClassifiedFile[]
 */
function classifyFiles(entries, projectRoot) {
    const statusMap = { M: 'modified', A: 'added', D: 'deleted', R: 'renamed' };
    const defaultRationale = { added: 'New file', modified: 'Modified', deleted: 'Removed' };
    const opts = { cwd: projectRoot, encoding: 'utf8', timeout: GIT_TIMEOUT_MS, stdio: ['pipe', 'pipe', 'pipe'] };

    return entries.map(entry => {
        const changeType = statusMap[entry.status] || 'modified';
        let rationale = defaultRationale[changeType] || 'Changed';

        if (changeType === 'renamed') {
            rationale = `Renamed from ${entry.oldPath}`;
        }

        try {
            const log = execSync(`git log --format="%s" -- "${entry.path}"`, opts).trim();
            const firstLine = log.split('\n')[0];
            if (firstLine) {
                rationale = firstLine.length > 120 ? firstLine.slice(0, 120) : firstLine;
            }
        } catch (_) {
            // Keep default rationale
        }

        return {
            path: entry.path,
            changeType,
            oldPath: entry.oldPath || null,
            rationale
        };
    });
}

/**
 * Parse requirements-spec.md to extract valid FR-NNN and AC-NNN-NN identifiers.
 * @param {string} reqSpecPath
 * @returns {Set<string>}
 */
function extractValidRequirements(reqSpecPath) {
    try {
        if (!fs.existsSync(reqSpecPath)) return new Set();
        const content = fs.readFileSync(reqSpecPath, 'utf8');
        const matches = content.match(REQ_PATTERN);
        return matches ? new Set(matches) : new Set();
    } catch (_) {
        return new Set();
    }
}

/**
 * Map each changed file to FR/AC identifiers using a 4-level fallback chain.
 * @param {Array} classifiedFiles
 * @param {string} tasksPath
 * @param {string} reqSpecPath
 * @param {string} projectRoot
 * @returns {Array} TracedFile[]
 */
function traceRequirements(classifiedFiles, tasksPath, reqSpecPath, projectRoot) {
    const validReqs = extractValidRequirements(reqSpecPath);
    const tracedMap = new Map();
    const opts = { cwd: projectRoot, encoding: 'utf8', timeout: GIT_TIMEOUT_MS, stdio: ['pipe', 'pipe', 'pipe'] };

    // Level 1: tasks.md trace annotations
    if (fs.existsSync(tasksPath)) {
        try {
            const taskLines = fs.readFileSync(tasksPath, 'utf8').split('\n');
            for (const line of taskLines) {
                const traceMatch = line.match(/\|\s*traces:\s*(.+)/);
                if (!traceMatch) continue;
                const traceIds = traceMatch[1].match(REQ_PATTERN);
                if (!traceIds || traceIds.length === 0) continue;

                for (const file of classifiedFiles) {
                    if (tracedMap.has(file.path)) continue;
                    if (line.includes(file.path) || line.includes(path.basename(file.path))) {
                        tracedMap.set(file.path, {
                            tracedRequirements: filterByValidSet(traceIds, validReqs),
                            tracingSource: 'tasks.md'
                        });
                    }
                }
            }
        } catch (_) {
            // Level 1 failed; continue to Level 2
        }
    }

    // Level 2: commit messages
    for (const file of classifiedFiles) {
        if (tracedMap.has(file.path)) continue;
        try {
            const log = execSync(`git log --format="%s" -- "${file.path}"`, opts).trim();
            const matches = log.match(REQ_PATTERN);
            if (matches && matches.length > 0) {
                tracedMap.set(file.path, {
                    tracedRequirements: filterByValidSet(matches, validReqs),
                    tracingSource: 'commit'
                });
            }
        } catch (_) {
            // Continue to next file
        }
    }

    // Level 3: code comments
    for (const file of classifiedFiles) {
        if (tracedMap.has(file.path)) continue;
        if (file.changeType === 'deleted') continue;
        const filePath = path.join(projectRoot, file.path);
        try {
            if (!fs.existsSync(filePath)) continue;
            const stat = fs.statSync(filePath);
            if (stat.size > MAX_CODE_SCAN_SIZE) continue;
            const content = fs.readFileSync(filePath, 'utf8');
            if (containsNullBytes(content.slice(0, 8192))) continue;
            const matches = content.match(REQ_PATTERN);
            if (matches && matches.length > 0) {
                tracedMap.set(file.path, {
                    tracedRequirements: filterByValidSet(matches, validReqs),
                    tracingSource: 'code-comment'
                });
            }
        } catch (_) {
            // Continue to next file
        }
    }

    // Level 4: mark remaining as untraced
    for (const file of classifiedFiles) {
        if (!tracedMap.has(file.path)) {
            tracedMap.set(file.path, {
                tracedRequirements: [],
                tracingSource: 'untraced'
            });
        }
    }

    // Merge tracing data into classified files
    return classifiedFiles.map(f => ({
        ...f,
        tracedRequirements: tracedMap.get(f.path)?.tracedRequirements || [],
        tracingSource: tracedMap.get(f.path)?.tracingSource || 'untraced'
    }));
}

/**
 * Extract test results from state.json phase 06 data.
 * @param {Object|null} state
 * @returns {{ total: number, passing: number, failing: number, coveragePercent: number|null }|null}
 */
function extractTestResults(state) {
    if (!state) return null;
    try {
        const phase = state.phases?.['06-implementation'];
        if (!phase) return null;
        const testIter = phase.iteration_requirements?.test_iteration;
        if (!testIter) return null;

        const coveragePercent = typeof testIter.coverage_percent === 'number'
            ? testIter.coverage_percent
            : null;

        // Try to extract counts from summary string
        let passing = 0;
        let failing = 0;
        if (phase.summary) {
            const passMatch = phase.summary.match(/(\d+)\s+(?:tests?\s+)?pass/i);
            if (passMatch) passing = parseInt(passMatch[1], 10);
            const failMatch = phase.summary.match(/(\d+)\s+(?:tests?\s+)?fail/i);
            if (failMatch) failing = parseInt(failMatch[1], 10);
        }

        // If no counts from summary, infer from boolean
        if (passing === 0 && failing === 0) {
            if (testIter.tests_passing === true) {
                passing = 1; // At least 1 passing if boolean is true
            }
        }

        return {
            total: passing + failing,
            passing,
            failing,
            coveragePercent
        };
    } catch (_) {
        return null;
    }
}

/**
 * Assemble all collected data into the unified SummaryData structure.
 * @param {{ mergeBase: string, head: string, entries: Array }|null} diffResult
 * @param {Array} tracedFiles
 * @param {{ total: number, passing: number, failing: number, coveragePercent: number|null }|null} testResults
 * @param {Object} context
 * @param {string[]} warnings
 * @returns {Object} SummaryData
 */
function buildSummaryData(diffResult, tracedFiles, testResults, context, warnings) {
    const filesModified = tracedFiles.filter(f => f.changeType === 'modified').length;
    const filesAdded = tracedFiles.filter(f => f.changeType === 'added').length;
    const filesDeleted = tracedFiles.filter(f => f.changeType === 'deleted').length;
    const filesRenamed = tracedFiles.filter(f => f.changeType === 'renamed').length;
    const requirementsTraced = tracedFiles.filter(f => f.tracingSource !== 'untraced').length;
    const requirementsUntraced = tracedFiles.filter(f => f.tracingSource === 'untraced').length;

    return {
        schemaVersion: SCHEMA_VERSION,
        generatedAt: new Date().toISOString(),
        workflowSlug: context.workflowSlug,
        baseBranch: context.baseBranch,
        baseCommit: diffResult?.mergeBase || null,
        headCommit: diffResult?.head || null,
        summary: {
            filesModified,
            filesAdded,
            filesDeleted,
            filesRenamed,
            totalFilesChanged: tracedFiles.length,
            requirementsTraced,
            requirementsUntraced,
            testsPassing: testResults ? (testResults.failing === 0) : null,
            testCount: testResults?.total || null,
            coveragePercent: testResults?.coveragePercent || null
        },
        files: tracedFiles,
        testResults,
        warnings
    };
}

/**
 * Render SummaryData as human-readable markdown.
 * @param {Object} summaryData
 * @param {string} outputPath
 * @returns {string|null} Path written, or null on failure
 */
function renderMarkdown(summaryData, outputPath) {
    try {
        const s = summaryData.summary;
        const lines = [];

        lines.push('# Change Summary');
        lines.push('');
        lines.push(`**Generated:** ${summaryData.generatedAt}`);
        lines.push(`**Workflow:** ${summaryData.workflowSlug}`);
        lines.push(`**Branch:** ${summaryData.baseBranch} <- HEAD`);
        lines.push(`**Base commit:** ${summaryData.baseCommit || 'N/A'}`);
        lines.push(`**Head commit:** ${summaryData.headCommit || 'N/A'}`);
        lines.push('');
        lines.push('---');
        lines.push('');

        // Metrics
        lines.push('## Metrics');
        lines.push('');
        lines.push('| Metric | Count |');
        lines.push('|--------|-------|');
        lines.push(`| Files modified | ${s.filesModified} |`);
        lines.push(`| Files added | ${s.filesAdded} |`);
        lines.push(`| Files deleted | ${s.filesDeleted} |`);
        lines.push(`| Files renamed | ${s.filesRenamed} |`);
        lines.push(`| **Total changed** | **${s.totalFilesChanged}** |`);
        lines.push(`| Requirements traced | ${s.requirementsTraced} |`);
        lines.push(`| Requirements untraced | ${s.requirementsUntraced} |`);
        lines.push('');
        lines.push('---');
        lines.push('');

        // Changed Files
        lines.push('## Changed Files');
        lines.push('');
        lines.push('| File | Type | Rationale | Traced Requirements | Source |');
        lines.push('|------|------|-----------|-------------------|--------|');
        for (const f of summaryData.files) {
            const reqs = f.tracedRequirements.length > 0
                ? f.tracedRequirements.join(', ')
                : 'N/A';
            lines.push(`| \`${f.path}\` | ${f.changeType} | ${f.rationale} | ${reqs} | ${f.tracingSource} |`);
        }

        // Test Results
        if (summaryData.testResults) {
            const t = summaryData.testResults;
            lines.push('');
            lines.push('---');
            lines.push('');
            lines.push('## Test Results');
            lines.push('');
            lines.push('| Metric | Value |');
            lines.push('|--------|-------|');
            lines.push(`| Total tests | ${t.total} |`);
            lines.push(`| Passing | ${t.passing} |`);
            lines.push(`| Failing | ${t.failing} |`);
            lines.push(`| Coverage | ${t.coveragePercent !== null ? t.coveragePercent + '%' : 'N/A'} |`);
        }

        // Warnings
        if (summaryData.warnings.length > 0) {
            lines.push('');
            lines.push('---');
            lines.push('');
            lines.push('## Warnings');
            lines.push('');
            for (const w of summaryData.warnings) {
                lines.push(`- ${w}`);
            }
        }

        lines.push('');
        fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
        return outputPath;
    } catch (_) {
        return null;
    }
}

/**
 * Render SummaryData as machine-readable JSON (schema v1.0).
 * @param {Object} summaryData
 * @param {string} outputPath
 * @returns {string|null} Path written, or null on failure
 */
function renderJson(summaryData, outputPath) {
    try {
        const jsonData = {
            schema_version: SCHEMA_VERSION,
            generated_at: summaryData.generatedAt,
            workflow_slug: summaryData.workflowSlug,
            base_branch: summaryData.baseBranch,
            base_commit: summaryData.baseCommit,
            head_commit: summaryData.headCommit,
            summary: {
                files_modified: summaryData.summary.filesModified,
                files_added: summaryData.summary.filesAdded,
                files_deleted: summaryData.summary.filesDeleted,
                files_renamed: summaryData.summary.filesRenamed,
                total_files_changed: summaryData.summary.totalFilesChanged,
                requirements_traced: summaryData.summary.requirementsTraced,
                requirements_untraced: summaryData.summary.requirementsUntraced,
                tests_passing: summaryData.summary.testsPassing,
                test_count: summaryData.summary.testCount,
                coverage_percent: summaryData.summary.coveragePercent
            },
            files: summaryData.files.map(f => ({
                path: f.path,
                change_type: f.changeType,
                old_path: f.oldPath || null,
                rationale: f.rationale,
                traced_requirements: f.tracedRequirements,
                tracing_source: f.tracingSource
            })),
            test_results: summaryData.testResults ? {
                total: summaryData.testResults.total,
                passing: summaryData.testResults.passing,
                failing: summaryData.testResults.failing,
                coverage_percent: summaryData.testResults.coveragePercent
            } : null,
            warnings: summaryData.warnings
        };

        fs.writeFileSync(outputPath, JSON.stringify(jsonData, null, 2) + '\n', 'utf8');
        return outputPath;
    } catch (_) {
        return null;
    }
}

/**
 * Write both output artifacts independently.
 * @param {Object} summaryData
 * @param {string} folderAbsolute
 * @param {string} projectRoot
 * @returns {{ mdPath: string|null, jsonPath: string|null }}
 */
function writeOutputs(summaryData, folderAbsolute, projectRoot) {
    const mdPath = path.join(folderAbsolute, 'change-summary.md');
    const jsonPath = path.join(projectRoot, '.isdlc', 'change-summary.json');

    let mdResult = null;
    let jsonResult = null;

    try {
        mdResult = renderMarkdown(summaryData, mdPath);
    } catch (_) {
        // Section-independent degradation
    }

    try {
        jsonResult = renderJson(summaryData, jsonPath);
    } catch (_) {
        // Section-independent degradation
    }

    return { mdPath: mdResult, jsonPath: jsonResult };
}

/**
 * No-op. Phase-loop controller handles display.
 * @param {Object} _summaryData
 */
function displayInlineBrief(_summaryData) {
    // Intentional no-op (ADR-0006: phase-loop handles display)
}

/**
 * Entry point. Orchestrates the pipeline with section-independent degradation.
 */
function main() {
    try {
        // Step 1: Parse args
        const args = parseArgs();
        if (!args.folder) {
            console.log(JSON.stringify({ result: 'ERROR', message: 'Missing --folder argument' }));
            process.exit(2);
        }

        const warnings = [];

        // Step 2: Load project context
        const context = loadProjectContext(args.folder);

        // Step 3: Collect git diff
        let diffResult = null;
        try {
            diffResult = collectGitDiff(context.projectRoot, context.baseBranch);
            if (!diffResult) {
                warnings.push('git diff unavailable -- no file data collected');
            }
        } catch (e) {
            diffResult = null;
            warnings.push(`git diff failed: ${e.message}`);
        }

        // Step 4: Classify files
        let classifiedFiles = [];
        try {
            if (diffResult && diffResult.entries.length > 0) {
                classifiedFiles = classifyFiles(diffResult.entries, context.projectRoot);
            }
        } catch (e) {
            classifiedFiles = [];
            warnings.push(`file classification failed: ${e.message}`);
        }

        // Step 5: Trace requirements
        let tracedFiles = classifiedFiles.map(f => ({
            ...f,
            tracedRequirements: [],
            tracingSource: 'untraced'
        }));
        try {
            if (classifiedFiles.length > 0) {
                tracedFiles = traceRequirements(
                    classifiedFiles,
                    context.tasksPath,
                    context.reqSpecPath,
                    context.projectRoot
                );
            }
        } catch (e) {
            warnings.push(`requirement tracing failed: ${e.message}`);
        }

        // Step 6: Extract test results
        let testResults = null;
        try {
            testResults = extractTestResults(context.state);
            if (!testResults) {
                warnings.push('test results unavailable from state.json');
            }
        } catch (e) {
            testResults = null;
            warnings.push(`test results extraction failed: ${e.message}`);
        }

        // Step 7: Build summary data
        const summaryData = buildSummaryData(
            diffResult, tracedFiles, testResults, context, warnings
        );

        // Step 8: Write outputs
        const outputs = writeOutputs(
            summaryData, context.folderAbsolute, context.projectRoot
        );
        if (!outputs.mdPath) {
            summaryData.warnings.push('change-summary.md write failed');
        }
        if (!outputs.jsonPath) {
            summaryData.warnings.push('change-summary.json write failed');
        }

        // Step 9: Display inline brief (no-op)
        displayInlineBrief(summaryData);

        // Stdout result
        const result = {
            result: 'OK',
            files_changed: summaryData.summary.totalFilesChanged,
            files_traced: summaryData.summary.requirementsTraced,
            files_untraced: summaryData.summary.requirementsUntraced,
            md_path: outputs.mdPath
                ? path.relative(context.projectRoot, outputs.mdPath)
                : null,
            json_path: outputs.jsonPath
                ? path.relative(context.projectRoot, outputs.jsonPath)
                : null,
            warnings: summaryData.warnings
        };

        console.log(JSON.stringify(result, null, 2));
        process.exit(0);

    } catch (error) {
        console.log(JSON.stringify({
            result: 'ERROR',
            message: error.message
        }, null, 2));
        process.exit(2);
    }
}

// Export for testing
module.exports = {
    parseArgs,
    loadProjectContext,
    collectGitDiff,
    classifyFiles,
    extractValidRequirements,
    traceRequirements,
    extractTestResults,
    buildSummaryData,
    renderMarkdown,
    renderJson,
    writeOutputs,
    displayInlineBrief,
    parseDiffLine,
    filterByValidSet,
    containsNullBytes,
    GIT_TIMEOUT_MS,
    MAX_CODE_SCAN_SIZE,
    REQ_PATTERN,
    SCHEMA_VERSION
};

if (require.main === module) {
    main();
}
