/**
 * Tests for BUG-0006: Phase-Loop State Ordering Fix
 *
 * Verifies that isdlc.md contains correct pre-delegation state write
 * instructions (STEP 3a-prime) and that redundant next-phase activation
 * has been removed from STEP 3e step 6.
 *
 * Traces to: FR-01 (AC-01a through AC-01g), FR-02 (AC-02a through AC-02f),
 *            FR-03 (AC-03a, AC-03b, AC-03c), FR-04 (AC-04a)
 *
 * Test type: Prompt Content Verification (Layer 1)
 * Framework: node:test + node:assert/strict (CJS)
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// File paths
const SRC_ISDLC = path.resolve(__dirname, '..', '..', 'commands', 'isdlc.md');
const RUNTIME_ISDLC = path.resolve(__dirname, '..', '..', '..', '..', '.claude', 'commands', 'isdlc.md');

// Read the source file once
const srcContent = fs.readFileSync(SRC_ISDLC, 'utf8');

// --- Section extraction helpers ---

/**
 * Extract the pre-delegation state write section (STEP 3a-prime or equivalent).
 * Looks for a section between STEP 3c (escalation handling) and STEP 3d (delegation).
 */
function extractPreDelegationSection() {
    // Find the boundary markers
    const step3cMatch = srcContent.match(/\*\*3c\.\*\*/);
    const step3dMatch = srcContent.match(/\*\*3d\.\*\*/);

    if (!step3cMatch || !step3dMatch) {
        return null;
    }

    const step3cEnd = srcContent.indexOf(step3cMatch[0]) + step3cMatch[0].length;
    const step3dStart = srcContent.indexOf(step3dMatch[0]);

    if (step3dStart <= step3cEnd) {
        return null;
    }

    return srcContent.substring(step3cEnd, step3dStart);
}

/**
 * Extract STEP 3e section.
 */
function extractStep3eSection() {
    const step3eMatch = srcContent.match(/\*\*3e\.\*\*/);
    if (!step3eMatch) return null;

    const step3eStart = srcContent.indexOf(step3eMatch[0]);
    // 3e ends at the next step marker (3e-refine or 3f or end of STEP 3 section)
    const nextStepMatch = srcContent.substring(step3eStart + 10).match(/\*\*3[ef][-.].*?\*\*/);
    const step3eEnd = nextStepMatch
        ? step3eStart + 10 + srcContent.substring(step3eStart + 10).indexOf(nextStepMatch[0])
        : step3eStart + 500; // fallback

    return srcContent.substring(step3eStart, step3eEnd);
}

/**
 * Extract STEP 3e step 6 sub-section ("If more phases remain:" block).
 */
function extractStep3eStep6() {
    const step3e = extractStep3eSection();
    if (!step3e) return null;

    // Find the "If more phases remain" or step 6 marker
    const step6Match = step3e.match(/6\.\s*If more phases remain/i);
    if (!step6Match) return null;

    const step6Start = step3e.indexOf(step6Match[0]);
    // Step 6 ends at step 7 marker
    const step7Match = step3e.substring(step6Start).match(/7\.\s/);
    const step6End = step7Match
        ? step6Start + step3e.substring(step6Start).indexOf(step7Match[0])
        : step3e.length;

    return step3e.substring(step6Start, step6End);
}

// --- Tests ---

describe('BUG-0006: STEP 3 ordering — Pre-delegation state write', () => {

    // TC-01-EXIST: STEP 3a-prime exists between 3c and 3d
    // Traces to: FR-01, AC-01g
    it('TC-01-EXIST: pre-delegation state write section exists between STEP 3c and STEP 3d', () => {
        const section = extractPreDelegationSection();
        assert.ok(section, 'A section must exist between STEP 3c and STEP 3d');

        // Must contain a pre-delegation state write instruction
        const hasPreDelegation = /PRE[-\s]?DELEGATION\s+STATE/i.test(section)
            || /state\.json.*before.*delegat/i.test(section)
            || /3a[-']?prime/i.test(section);
        assert.ok(hasPreDelegation,
            'The section between 3c and 3d must contain a pre-delegation state write instruction');
    });

    // TC-01a: phases[key].status set to "in_progress"
    // Traces to: AC-01a
    it('TC-01a: pre-delegation section sets phases[key].status to "in_progress"', () => {
        const section = extractPreDelegationSection();
        assert.ok(section, 'Pre-delegation section must exist');

        const hasPhaseStatus = /phases\[.*\]\.status.*[=:].*["']?in_progress["']?/i.test(section)
            || /phases.*phase_key.*status.*in_progress/i.test(section)
            || /`phases\[phase_key\]\.status`.*`"in_progress"`/i.test(section);
        assert.ok(hasPhaseStatus,
            'Pre-delegation section must set phases[phase_key].status to "in_progress"');
    });

    // TC-01b: phases[key].started set conditionally
    // Traces to: AC-01b
    it('TC-01b: pre-delegation section sets phases[key].started timestamp (if null)', () => {
        const section = extractPreDelegationSection();
        assert.ok(section, 'Pre-delegation section must exist');

        const hasStarted = /phases\[.*\]\.started/i.test(section)
            || /started.*timestamp/i.test(section)
            || /started.*ISO/i.test(section);
        assert.ok(hasStarted,
            'Pre-delegation section must set phases[phase_key].started timestamp');

        // Must have conditional guard (only if null / not already set)
        const hasConditional = /if.*null/i.test(section)
            || /only if.*not.*set/i.test(section)
            || /preserve.*existing/i.test(section)
            || /if not already/i.test(section);
        assert.ok(hasConditional,
            'Started timestamp must have a conditional guard (only if null)');
    });

    // TC-01c: active_workflow.current_phase set
    // Traces to: AC-01c
    it('TC-01c: pre-delegation section sets active_workflow.current_phase', () => {
        const section = extractPreDelegationSection();
        assert.ok(section, 'Pre-delegation section must exist');

        const hasCurrentPhase = /active_workflow.*current_phase.*[=:].*phase/i.test(section)
            || /`active_workflow\.current_phase`.*phase_key/i.test(section);
        assert.ok(hasCurrentPhase,
            'Pre-delegation section must set active_workflow.current_phase to phase_key');
    });

    // TC-01d: active_workflow.phase_status[key] set
    // Traces to: AC-01d
    it('TC-01d: pre-delegation section sets active_workflow.phase_status[key] to "in_progress"', () => {
        const section = extractPreDelegationSection();
        assert.ok(section, 'Pre-delegation section must exist');

        const hasPhaseStatusMap = /phase_status\[.*\].*[=:].*["']?in_progress["']?/i.test(section)
            || /`active_workflow\.phase_status\[phase_key\]`.*`"in_progress"`/i.test(section);
        assert.ok(hasPhaseStatusMap,
            'Pre-delegation section must set active_workflow.phase_status[phase_key] to "in_progress"');
    });

    // TC-01e: top-level current_phase set
    // Traces to: AC-01e
    it('TC-01e: pre-delegation section sets top-level current_phase', () => {
        const section = extractPreDelegationSection();
        assert.ok(section, 'Pre-delegation section must exist');

        const hasTopLevelPhase = /top[-\s]?level.*current_phase/i.test(section)
            || /current_phase.*=.*phase_key/i.test(section)
            || /`current_phase`.*phase_key/i.test(section);
        assert.ok(hasTopLevelPhase,
            'Pre-delegation section must set top-level current_phase to phase_key');
    });

    // TC-01f: top-level active_agent set from PHASE_AGENT_MAP
    // Traces to: AC-01f
    it('TC-01f: pre-delegation section sets top-level active_agent from PHASE_AGENT_MAP', () => {
        const section = extractPreDelegationSection();
        assert.ok(section, 'Pre-delegation section must exist');

        const hasActiveAgent = /active_agent.*[=:].*agent/i.test(section)
            || /`active_agent`.*agent.*name/i.test(section)
            || /active_agent.*PHASE_AGENT_MAP/i.test(section);
        assert.ok(hasActiveAgent,
            'Pre-delegation section must set top-level active_agent from PHASE_AGENT_MAP');
    });

    // TC-01g: state.json write before Task delegation
    // Traces to: AC-01g
    it('TC-01g: pre-delegation section writes state.json BEFORE Task delegation', () => {
        const section = extractPreDelegationSection();
        assert.ok(section, 'Pre-delegation section must exist');

        // Check that there's a write instruction in the pre-delegation section
        const hasWrite = /[Ww]rite.*state\.json/i.test(section)
            || /state\.json.*write/i.test(section)
            || /Write `.isdlc\/state.json`/i.test(section);
        assert.ok(hasWrite,
            'Pre-delegation section must contain a "Write state.json" instruction');

        // Verify ordering: pre-delegation write comes before STEP 3d's Task delegation
        const preDelegIdx = srcContent.indexOf(section);
        const step3dIdx = srcContent.search(/\*\*3d\.\*\*/);
        assert.ok(preDelegIdx < step3dIdx,
            'Pre-delegation write must appear before STEP 3d Task delegation');
    });
});

describe('BUG-0006: STEP 3e cleanup — Remove redundant next-phase activation', () => {

    // TC-02a: STEP 3e step 6 does NOT set phases[new_phase].status to "in_progress"
    // Traces to: AC-02a
    it('TC-02a: STEP 3e step 6 does NOT set phases[new_phase].status to "in_progress"', () => {
        const step6 = extractStep3eStep6();
        assert.ok(step6, 'STEP 3e step 6 must exist');

        const hasNextPhaseStatus = /phases\[.*new.*\]\.status.*in_progress/i.test(step6)
            || /phases\[new_phase\].*status.*in_progress/i.test(step6)
            || /Set `phases\[new_phase\]\.status`.*`"in_progress"`/i.test(step6);
        assert.ok(!hasNextPhaseStatus,
            'STEP 3e step 6 must NOT set phases[new_phase].status to "in_progress"');
    });

    // TC-02b: STEP 3e step 6 does NOT set active_workflow.phase_status[new_phase] to "in_progress"
    // Traces to: AC-02b
    it('TC-02b: STEP 3e step 6 does NOT set phase_status[new_phase] to "in_progress"', () => {
        const step6 = extractStep3eStep6();
        assert.ok(step6, 'STEP 3e step 6 must exist');

        const hasNextPhaseStatusMap = /phase_status\[new.*\].*in_progress/i.test(step6)
            || /phase_status\[new_phase\].*in_progress/i.test(step6);
        assert.ok(!hasNextPhaseStatusMap,
            'STEP 3e step 6 must NOT set phase_status[new_phase] to "in_progress"');
    });

    // TC-02c: STEP 3e step 6 does NOT set active_workflow.current_phase to new phase
    // Traces to: AC-02c
    it('TC-02c: STEP 3e step 6 does NOT set current_phase to new phase', () => {
        const step6 = extractStep3eStep6();
        assert.ok(step6, 'STEP 3e step 6 must exist');

        // Should NOT contain current_phase assignment (except index increment)
        const hasCurrentPhaseAssign = /current_phase.*=.*phases\[new_index\]/i.test(step6)
            || /`active_workflow\.current_phase`.*new/i.test(step6)
            || /Set `active_workflow\.current_phase`/i.test(step6);
        assert.ok(!hasCurrentPhaseAssign,
            'STEP 3e step 6 must NOT set active_workflow.current_phase to new phase');
    });

    // TC-02d: STEP 3e step 6 does NOT set top-level current_phase or active_agent
    // Traces to: AC-02d
    it('TC-02d: STEP 3e step 6 does NOT set top-level current_phase or active_agent', () => {
        const step6 = extractStep3eStep6();
        assert.ok(step6, 'STEP 3e step 6 must exist');

        const hasTopLevelPhase = /top[-\s]?level.*current_phase.*new/i.test(step6)
            || /Set top-level `current_phase`/i.test(step6);
        assert.ok(!hasTopLevelPhase,
            'STEP 3e step 6 must NOT set top-level current_phase to new phase');

        const hasTopLevelAgent = /top[-\s]?level.*active_agent.*new/i.test(step6)
            || /Set top-level `active_agent`/i.test(step6);
        assert.ok(!hasTopLevelAgent,
            'STEP 3e step 6 must NOT set top-level active_agent to new phase agent');
    });

    // TC-02e: STEP 3e STILL increments current_phase_index
    // Traces to: AC-02e
    it('TC-02e: STEP 3e STILL increments current_phase_index', () => {
        const step3e = extractStep3eSection();
        assert.ok(step3e, 'STEP 3e section must exist');

        const hasIndexIncrement = /current_phase_index.*\+.*1/i.test(step3e)
            || /current_phase_index.*increment/i.test(step3e)
            || /`active_workflow\.current_phase_index`.*\+=.*1/i.test(step3e);
        assert.ok(hasIndexIncrement,
            'STEP 3e must still increment current_phase_index');
    });

    // TC-02f: STEP 3e steps 1-5 and 7-8 remain unchanged
    // Traces to: AC-02f
    it('TC-02f: STEP 3e retains completed phase marking, state write, and tasks.md update', () => {
        const step3e = extractStep3eSection();
        assert.ok(step3e, 'STEP 3e section must exist');

        // Step 1: Read state.json
        assert.ok(/Read.*state\.json/i.test(step3e),
            'STEP 3e must still read state.json (step 1)');

        // Step 2: Set phases[key].status = "completed"
        assert.ok(/phases\[.*\]\.status.*completed/i.test(step3e),
            'STEP 3e must still set phases[key].status to "completed" (step 2)');

        // Step 3: Set summary
        assert.ok(/summary/i.test(step3e),
            'STEP 3e must still set summary (step 3)');

        // Step 5: Set phase_status[key] = "completed"
        assert.ok(/phase_status\[.*\].*completed/i.test(step3e),
            'STEP 3e must still set phase_status[key] to "completed" (step 5)');

        // Step 7: Write state.json
        assert.ok(/[Ww]rite.*state\.json/i.test(step3e),
            'STEP 3e must still write state.json (step 7)');

        // Step 8: Update tasks.md
        assert.ok(/tasks\.md/i.test(step3e),
            'STEP 3e must still update tasks.md (step 8)');
    });
});

describe('BUG-0006: State consistency — Pre-delegation activates, post-phase deactivates', () => {

    // TC-03a: Pre-delegation write activates the phase
    // Traces to: AC-03a
    it('TC-03a: pre-delegation sets all three activation fields', () => {
        const section = extractPreDelegationSection();
        assert.ok(section, 'Pre-delegation section must exist');

        // phases[key].status = "in_progress"
        assert.ok(/phases.*status.*in_progress/i.test(section),
            'Must set phases[key].status = "in_progress"');

        // active_workflow.phase_status[key] = "in_progress"
        assert.ok(/phase_status.*in_progress/i.test(section),
            'Must set active_workflow.phase_status[key] = "in_progress"');

        // active_workflow.current_phase = key
        assert.ok(/active_workflow.*current_phase/i.test(section),
            'Must set active_workflow.current_phase = phase_key');
    });

    // TC-03b: Post-phase write deactivates the phase
    // Traces to: AC-03b
    it('TC-03b: STEP 3e sets completed status and increments index', () => {
        const step3e = extractStep3eSection();
        assert.ok(step3e, 'STEP 3e section must exist');

        // phases[key].status = "completed"
        assert.ok(/phases.*status.*completed/i.test(step3e),
            'STEP 3e must set phases[key].status = "completed"');

        // phase_status[key] = "completed"
        assert.ok(/phase_status.*completed/i.test(step3e),
            'STEP 3e must set phase_status[key] = "completed"');

        // current_phase_index incremented
        assert.ok(/current_phase_index.*\+/i.test(step3e),
            'STEP 3e must increment current_phase_index');
    });

    // TC-03c: No field written in both for SAME key with same value
    // Traces to: AC-03c
    it('TC-03c: STEP 3e step 6 does not duplicate next-phase activation from pre-delegation', () => {
        const step6 = extractStep3eStep6();
        assert.ok(step6, 'STEP 3e step 6 must exist');

        // The overlap concern was STEP 3e setting next phase to "in_progress"
        // which would conflict with the NEXT iteration's pre-delegation write.
        // Verify it is gone:
        const hasInProgress = /in_progress/i.test(step6);
        assert.ok(!hasInProgress,
            'STEP 3e step 6 must not contain "in_progress" (next-phase activation removed)');
    });
});

describe('BUG-0006: Runtime copy sync', () => {

    // TC-04a: Runtime copy matches source
    // Traces to: FR-04, AC-04a
    it('TC-04a: .claude/commands/isdlc.md matches src/claude/commands/isdlc.md', () => {
        assert.ok(fs.existsSync(SRC_ISDLC), 'Source file must exist');
        assert.ok(fs.existsSync(RUNTIME_ISDLC), 'Runtime copy must exist');

        const src = fs.readFileSync(SRC_ISDLC, 'utf8');
        const runtime = fs.readFileSync(RUNTIME_ISDLC, 'utf8');

        assert.equal(src, runtime,
            'Runtime copy (.claude/commands/isdlc.md) must be identical to source (src/claude/commands/isdlc.md)');
    });
});
