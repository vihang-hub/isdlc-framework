#!/usr/bin/env node
/**
 * iSDLC State Write Validator - PostToolUse[Write,Edit] Hook
 * ============================================================
 * Validates state.json writes for structural integrity.
 * Detects impossible state combinations that indicate fabricated data.
 *
 * OBSERVATIONAL ONLY: outputs warnings to stderr, never blocks.
 * NEVER produces stdout output (would inject into conversation).
 *
 * Performance budget: < 100ms
 * Fail-open: any error results in silent exit (exit 0, no output)
 *
 * Traces to: FR-05, AC-05, AC-05a, AC-05b, AC-05c, AC-05d, AC-05e
 * V8 traces to: BUG-0011 FR-01 thru FR-05 (phase orchestration field protection)
 * Version: 1.2.0
 */

const {
    debugLog,
    logHookEvent
} = require('./lib/common.cjs');

const fs = require('fs');

/**
 * Regex to match state.json paths (single-project and monorepo, cross-platform).
 */
const STATE_JSON_PATTERN = /\.isdlc[/\\](?:projects[/\\][^/\\]+[/\\])?state\.json$/;

/**
 * Validate a single phase's state data for suspicious patterns.
 * @param {string} phaseName - Phase identifier (e.g., '01-requirements')
 * @param {object} phaseData - The phase's state object
 * @param {string} filePath - Path to the state.json file
 * @returns {string[]} Array of warning messages (empty if valid)
 */
function validatePhase(phaseName, phaseData, filePath) {
    const warnings = [];

    // Rule V1: constitutional_validation
    const constVal = phaseData.constitutional_validation;
    if (constVal && constVal.completed === true) {
        const iters = constVal.iterations_used;
        if (iters === undefined || iters === null || iters < 1) {
            warnings.push(
                `[state-write-validator] WARNING: Suspicious state.json write detected.\n` +
                `  Phase: ${phaseName}\n` +
                `  Issue: constitutional_validation.completed is true but iterations_used is ${iters}\n` +
                `  Rule: A completed constitutional validation must have at least 1 iteration\n` +
                `  Path: ${filePath}`
            );
        }
    }

    // Rule V2: interactive_elicitation
    const elicit = phaseData.iteration_requirements &&
                   phaseData.iteration_requirements.interactive_elicitation;
    if (elicit && elicit.completed === true) {
        const menuCount = elicit.menu_interactions;
        if (menuCount === undefined || menuCount === null || menuCount < 1) {
            warnings.push(
                `[state-write-validator] WARNING: Suspicious state.json write detected.\n` +
                `  Phase: ${phaseName}\n` +
                `  Issue: interactive_elicitation.completed is true but menu_interactions is ${menuCount}\n` +
                `  Rule: A completed elicitation must have at least 1 menu interaction\n` +
                `  Path: ${filePath}`
            );
        }
    }

    // Rule V3: test_iteration
    const testIter = phaseData.iteration_requirements &&
                     phaseData.iteration_requirements.test_iteration;
    if (testIter && testIter.completed === true) {
        const iterCount = testIter.current_iteration;
        if (iterCount === undefined || iterCount === null || iterCount < 1) {
            warnings.push(
                `[state-write-validator] WARNING: Suspicious state.json write detected.\n` +
                `  Phase: ${phaseName}\n` +
                `  Issue: test_iteration.completed is true but current_iteration is ${iterCount}\n` +
                `  Rule: A completed test iteration must have at least 1 test run\n` +
                `  Path: ${filePath}`
            );
        }
    }

    return warnings;
}

/**
 * Rule V7: Optimistic locking version check (BUG-0009).
 *
 * For Write events: compares the incoming state_version (from tool_input.content)
 * against the current disk state_version. Blocks if incoming < disk.
 * For Edit events: skipped (Edit modifies in-place, version is managed by writeState).
 *
 * Backward-compatible: allows if either version is missing/null.
 * Fail-open: allows on any read/parse error.
 *
 * @param {string} filePath - Path to the state.json file
 * @param {object} toolInput - The tool_input from the hook event
 * @param {string} toolName - 'Write' or 'Edit'
 * @returns {{ decision: string, stopReason?: string, stderr?: string } | null}
 *   Returns a block/allow result if V7 applies, or null to continue to other rules.
 */
function checkVersionLock(filePath, toolInput, toolName) {
    // V7 only applies to Write events (Edit reads from disk post-write)
    if (toolName !== 'Write') {
        return null;
    }

    try {
        // Parse incoming content to get incoming state_version
        const incomingContent = toolInput.content;
        if (!incomingContent || typeof incomingContent !== 'string') {
            return null; // No content to check — allow
        }

        let incomingState;
        try {
            incomingState = JSON.parse(incomingContent);
        } catch (e) {
            // Fail-open: incoming content is not valid JSON
            return null;
        }

        // BUG-0007 fix (0.3): Explicit type guard after JSON.parse for incoming content.
        // JSON.parse can return null, numbers, booleans, strings -- all valid JSON but
        // not valid state objects. Guard before property access to avoid silent TypeError.
        if (!incomingState || typeof incomingState !== 'object') {
            debugLog('V7 version check skipped: incoming content parsed to', typeof incomingState, '— not an object');
            return null; // fail-open
        }

        const incomingVersion = incomingState.state_version;

        // Read current disk state_version BEFORE checking incoming version
        // BUG-0017: Must read disk first to detect unversioned writes against versioned disk
        let diskVersion;
        try {
            if (!fs.existsSync(filePath)) {
                return null; // No disk file — allow (first write)
            }
            const diskContent = fs.readFileSync(filePath, 'utf8');
            const diskState = JSON.parse(diskContent);
            // BUG-0007 fix (0.3): Explicit type guard after JSON.parse for disk content.
            if (!diskState || typeof diskState !== 'object') {
                debugLog('V7 version check skipped: disk state parsed to', typeof diskState, '— not an object');
                return null; // fail-open
            }
            diskVersion = diskState.state_version;
        } catch (e) {
            // Fail-open: error reading disk file
            return null;
        }

        // BUG-0017: If incoming has no state_version, check disk before allowing
        if (incomingVersion === undefined || incomingVersion === null) {
            // If disk also has no version, allow (legacy compat / both unversioned)
            if (diskVersion === undefined || diskVersion === null) {
                return null;
            }
            // Disk has version but incoming does not — BLOCK with actionable message
            const reason = `Unversioned write rejected: disk state has state_version ${diskVersion} but incoming write has no state_version. Include state_version in your write. Re-read .isdlc/state.json before writing.`;
            console.error(`[state-write-validator] V7 BLOCK: ${reason}`);
            logHookEvent('state-write-validator', 'block', {
                reason: `V7: incoming has no state_version, disk has ${diskVersion}`
            });
            return {
                decision: 'block',
                stopReason: reason
            };
        }

        // Migration case: disk has no state_version
        if (diskVersion === undefined || diskVersion === null) {
            return null;
        }

        // Version check: incoming must be >= disk
        if (incomingVersion < diskVersion) {
            const reason = `Version mismatch: expected state_version >= ${diskVersion}, got ${incomingVersion}. Re-read .isdlc/state.json before writing.`;
            console.error(`[state-write-validator] V7 BLOCK: ${reason}`);
            logHookEvent('state-write-validator', 'block', {
                reason: `V7: state_version ${incomingVersion} < disk ${diskVersion}`
            });
            return {
                decision: 'block',
                stopReason: reason
            };
        }

        // Version OK
        return null;
    } catch (e) {
        // Fail-open: any error in V7 allows the write
        debugLog('V7 version check error:', e.message);
        return null;
    }
}

/**
 * Phase status ordinal map for regression detection.
 * Higher ordinal = more advanced status.
 * Unknown statuses return -1 (fail-open: cannot compare).
 */
const PHASE_STATUS_ORDINAL = {
    'pending': 0,
    'in_progress': 1,
    'completed': 2
};

/**
 * Rule V8: Phase Orchestration Field Protection (BUG-0011).
 *
 * For Write events: compares incoming active_workflow orchestration fields
 * against disk values. Blocks if:
 *   - current_phase_index in incoming < disk (phase index regression)
 *   - Any phase_status entry regresses (e.g., completed -> pending)
 *
 * For Edit events: skipped (Edit has no incoming content to compare).
 * Backward-compatible: allows if fields are missing in either incoming or disk.
 * Fail-open: allows on any error.
 *
 * Traces to: FR-01, FR-02, FR-03, FR-04, FR-05
 *
 * @param {string} filePath - Path to the state.json file
 * @param {object} toolInput - The tool_input from the hook event
 * @param {string} toolName - 'Write' or 'Edit'
 * @returns {{ decision: string, stopReason?: string } | null}
 *   Returns a block result if V8 detects regression, or null to continue.
 */
function checkPhaseFieldProtection(filePath, toolInput, toolName) {
    // V8 only applies to Write events (AC-04a, AC-04b)
    if (toolName !== 'Write') {
        return null;
    }

    try {
        // Parse incoming content
        const incomingContent = toolInput.content;
        if (!incomingContent || typeof incomingContent !== 'string') {
            return null; // No content to check -- allow
        }

        let incomingState;
        try {
            incomingState = JSON.parse(incomingContent);
        } catch (e) {
            // AC-03a: Fail-open on parse error
            return null;
        }

        // AC-01c, AC-03c: If incoming has no active_workflow, nothing to check
        const incomingAW = incomingState && incomingState.active_workflow;
        if (!incomingAW || typeof incomingAW !== 'object') {
            return null;
        }

        // Read current disk state
        let diskState;
        try {
            if (!fs.existsSync(filePath)) {
                return null; // AC-03b: Fail-open when disk file missing
            }
            const diskContent = fs.readFileSync(filePath, 'utf8');
            diskState = JSON.parse(diskContent);
        } catch (e) {
            // AC-03b: Fail-open on disk read error
            return null;
        }

        // AC-01d, AC-03c: If disk has no active_workflow, allow (workflow init)
        const diskAW = diskState && diskState.active_workflow;
        if (!diskAW || typeof diskAW !== 'object') {
            return null;
        }

        // --- Check 1: current_phase_index regression (FR-01) ---
        const incomingIndex = incomingAW.current_phase_index;
        const diskIndex = diskAW.current_phase_index;

        // NFR-02: Backward compat -- skip if either is missing/undefined
        if (
            incomingIndex !== undefined && incomingIndex !== null &&
            diskIndex !== undefined && diskIndex !== null
        ) {
            if (typeof incomingIndex === 'number' && typeof diskIndex === 'number') {
                if (incomingIndex < diskIndex) {
                    // AC-01a, AC-01e: Block with debug info
                    const reason = `Phase index regression: incoming current_phase_index (${incomingIndex}) < disk (${diskIndex}). Subagents must not regress phase orchestration fields. Re-read state.json.`;
                    console.error(`[state-write-validator] V8 BLOCK: ${reason}`);
                    logHookEvent('state-write-validator', 'block', {
                        reason: `V8: phase_index ${incomingIndex} < disk ${diskIndex}`
                    });
                    return {
                        decision: 'block',
                        stopReason: reason
                    };
                }
            }
        }

        // --- Check 2: phase_status regression (FR-02) ---
        const incomingPS = incomingAW.phase_status;
        const diskPS = diskAW.phase_status;

        // AC-03d: Skip if either has no phase_status
        if (incomingPS && typeof incomingPS === 'object' &&
            diskPS && typeof diskPS === 'object') {

            for (const [phase, incomingStatus] of Object.entries(incomingPS)) {
                const diskStatus = diskPS[phase];
                // AC-02f: New entries not on disk are allowed
                if (diskStatus === undefined || diskStatus === null) {
                    continue;
                }

                const incomingOrd = PHASE_STATUS_ORDINAL[incomingStatus];
                const diskOrd = PHASE_STATUS_ORDINAL[diskStatus];

                // AC-03e, T59: Unknown statuses fail-open (ordinal is undefined)
                if (incomingOrd === undefined || diskOrd === undefined) {
                    continue;
                }

                // AC-02a, AC-02b, AC-02c: Block if regression
                if (incomingOrd < diskOrd) {
                    const reason = `Phase status regression: phase '${phase}' changed from '${diskStatus}' to '${incomingStatus}'. Subagents must not regress phase_status. Re-read state.json.`;
                    console.error(`[state-write-validator] V8 BLOCK: ${reason}`);
                    logHookEvent('state-write-validator', 'block', {
                        reason: `V8: phase_status '${phase}' ${diskStatus} -> ${incomingStatus}`
                    });
                    return {
                        decision: 'block',
                        stopReason: reason
                    };
                }
            }
        }

        // V8 passes -- no regression detected
        return null;
    } catch (e) {
        // AC-03e: Fail-open on any error
        debugLog('V8 phase field protection error:', e.message);
        return null;
    }
}

/**
 * Dispatcher-compatible check function.
 * NOTE: For V1-V3, reads the just-written state.json file from disk.
 * For V7 (BUG-0009), compares incoming content version against disk version.
 * For V8 (BUG-0011), compares incoming phase orchestration fields against disk.
 * @param {object} ctx - { input, state, manifest, requirements, workflows }
 * @returns {{ decision: 'allow'|'block', stopReason?: string, stderr?: string }}
 */
function check(ctx) {
    try {
        const input = ctx.input;
        if (!input) {
            return { decision: 'allow' };
        }

        // Only process Write and Edit tool results
        if (input.tool_name !== 'Write' && input.tool_name !== 'Edit') {
            return { decision: 'allow' };
        }

        const toolInput = input.tool_input || {};
        const filePath = toolInput.file_path || toolInput.filePath || '';

        // Check if the file is a state.json
        if (!STATE_JSON_PATTERN.test(filePath)) {
            return { decision: 'allow' };
        }

        debugLog('State.json write detected:', filePath);

        // Rule V7: Version check (BUG-0009) — runs BEFORE content validation
        const v7Result = checkVersionLock(filePath, toolInput, input.tool_name);
        if (v7Result && v7Result.decision === 'block') {
            return v7Result;
        }

        // Rule V8: Phase field protection (BUG-0011) — runs after V7, before V1-V3
        const v8Result = checkPhaseFieldProtection(filePath, toolInput, input.tool_name);
        if (v8Result && v8Result.decision === 'block') {
            return v8Result;
        }

        // Read the file from disk (it was just written)
        let stateData;
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            stateData = JSON.parse(content);
        } catch (e) {
            debugLog('Could not read/parse state.json:', e.message);
            return { decision: 'allow' };
        }

        // Validate each phase
        const phases = stateData.phases;
        if (!phases || typeof phases !== 'object') {
            return { decision: 'allow' };
        }

        const allWarnings = [];
        for (const [phaseName, phaseData] of Object.entries(phases)) {
            if (!phaseData || typeof phaseData !== 'object') continue;

            const warnings = validatePhase(phaseName, phaseData, filePath);
            for (const warning of warnings) {
                allWarnings.push(warning);
                logHookEvent('state-write-validator', 'warn', {
                    phase: phaseName,
                    reason: warning.split('\n')[0].replace('[state-write-validator] WARNING: ', '')
                });
            }
        }

        if (allWarnings.length > 0) {
            return { decision: 'allow', stderr: allWarnings.join('\n') };
        }

        // NEVER produce stdout output for non-block cases
        return { decision: 'allow' };

    } catch (error) {
        debugLog('Error in state-write-validator:', error.message);
        return { decision: 'allow' };
    }
}

// Export check for dispatcher use
module.exports = { check };

// Standalone execution
if (require.main === module) {
    const { readStdin, readState, loadManifest, loadIterationRequirements, loadWorkflowDefinitions } = require('./lib/common.cjs');

    (async () => {
        try {
            const inputStr = await readStdin();
            if (!inputStr || !inputStr.trim()) {
                process.exit(0);
            }
            let input;
            try { input = JSON.parse(inputStr); } catch (e) { process.exit(0); }

            const state = readState();
            const manifest = loadManifest();
            const requirements = loadIterationRequirements();
            const workflows = loadWorkflowDefinitions();
            const ctx = { input, state, manifest, requirements, workflows };

            const result = check(ctx);

            if (result.stderr) {
                console.error(result.stderr);
            }
            if (result.stdout) {
                console.log(result.stdout);
            }
            if (result.decision === 'block' && result.stopReason) {
                const { outputBlockResponse } = require('./lib/common.cjs');
                outputBlockResponse(result.stopReason);
            }
            process.exit(0);
        } catch (e) {
            process.exit(0);
        }
    })();
}
