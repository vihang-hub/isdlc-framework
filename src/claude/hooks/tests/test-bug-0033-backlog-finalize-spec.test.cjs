'use strict';

/**
 * BUG-0033: BACKLOG.md Completion Marking Not Wired Into Finalize - Test Suite
 * =============================================================================
 * Tests validate that:
 * 1. 00-sdlc-orchestrator.md has a top-level BACKLOG.md completion step in finalize
 *    (not nested under Jira sync)
 * 2. isdlc.md STEP 4 has a BACKLOG.md sync section parallel to Jira/GitHub sync
 * 3. Existing Jira sync, GitHub sync, and trivial tier behaviors are preserved
 *
 * Run:  node --test src/claude/hooks/tests/test-bug-0033-backlog-finalize-spec.test.cjs
 *
 * BUG-0033-GH-11: Wire BACKLOG.md completion into standard workflow finalize
 * Traces: FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, CON-002, CON-003
 *
 * TDD RED PHASE: SV-* and SS-* tests are expected to FAIL before Phase 06 fix.
 *                RT-* tests are expected to PASS (regression guards).
 *
 * Version: 1.0.0
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const projectRoot = path.resolve(__dirname, '..', '..', '..', '..');

/**
 * Reads 00-sdlc-orchestrator.md and caches for all spec validation tests.
 */
function readOrchestratorSpec() {
    const specPath = path.join(projectRoot, 'src', 'claude', 'agents', '00-sdlc-orchestrator.md');
    return fs.readFileSync(specPath, 'utf8');
}

/**
 * Reads isdlc.md and caches for all spec validation tests.
 */
function readIsdlcSpec() {
    const specPath = path.join(projectRoot, 'src', 'claude', 'commands', 'isdlc.md');
    return fs.readFileSync(specPath, 'utf8');
}

/**
 * Extracts a section of text between two patterns.
 * Returns the text from startPattern match to endPattern match (exclusive).
 * If endPattern is null/undefined, returns from startPattern to end of content.
 */
function extractSection(content, startPattern, endPattern) {
    const startMatch = content.match(startPattern);
    if (!startMatch) return '';
    const startIdx = startMatch.index;
    if (endPattern) {
        const afterStart = content.substring(startIdx + startMatch[0].length);
        const endMatch = afterStart.match(endPattern);
        if (endMatch) {
            return content.substring(startIdx, startIdx + startMatch[0].length + endMatch.index);
        }
    }
    return content.substring(startIdx);
}

/**
 * Extracts the orchestrator finalize merge-and-sync section (steps 1-5 area,
 * lines 585-610 range). This is the section containing merge, Jira sync,
 * and post-merge steps.
 */
function extractOrchestratorFinalizeSteps(content) {
    return extractSection(
        content,
        /^1\.\s+Pre-merge:/m,
        /^###\s+Branch on Cancellation/m
    );
}

/**
 * Extracts the Jira sync sub-section from the orchestrator finalize steps.
 */
function extractJiraSyncBlock(content) {
    return extractSection(
        content,
        /2\.5\.\s+\*\*JIRA STATUS SYNC/,
        /^\d+\.\s+/m  // Next top-level numbered step
    );
}

/**
 * Extracts the isdlc.md STEP 4 finalize section.
 */
function extractStep4Section(content) {
    return extractSection(
        content,
        /####\s+STEP 4:\s+FINALIZE/i,
        /####\s+Flow Summary/i
    );
}

/**
 * Extracts the Jira sync sub-section from isdlc.md STEP 4.
 */
function extractIsdlcJiraSyncSection(content) {
    const step4 = extractStep4Section(content);
    return extractSection(
        step4,
        /\*\*Jira sync\*\*/,
        /\*\*GitHub sync\*\*/
    );
}

// Cache spec content (read once, use in all tests)
let orchestratorContent;
let isdlcContent;

// ===========================================================================
// SPECIFICATION VALIDATION TESTS (SV) — Expected to FAIL pre-fix (TDD red)
// ===========================================================================

describe('BUG-0033: Specification Validation', () => {

    // Setup: read both spec files
    it('setup: spec files are readable', () => {
        orchestratorContent = readOrchestratorSpec();
        assert.ok(orchestratorContent.length > 0, '00-sdlc-orchestrator.md should not be empty');

        isdlcContent = readIsdlcSpec();
        assert.ok(isdlcContent.length > 0, 'isdlc.md should not be empty');
    });

    // --- Orchestrator Spec Validation ---

    describe('FR-006 / AC-008: Orchestrator finalize BACKLOG.md step', () => {

        it('[P0] SV-01: Orchestrator has top-level BACKLOG.md completion step in finalize (FR-006, AC-008)', () => {
            assert.ok(orchestratorContent, 'spec must be loaded');

            const finalizeSteps = extractOrchestratorFinalizeSteps(orchestratorContent);
            assert.ok(finalizeSteps.length > 0, 'Finalize steps section must exist');

            // The BACKLOG.md update must exist as its own top-level step,
            // NOT nested under the Jira sync block (step 2.5).
            // Look for a BACKLOG.md heading/step that is at the same level as step 2.5
            // (i.e., a numbered step like 2.6 or a bold heading at indentation level 0).
            //
            // Current bug: step 2.5d is nested under 2.5 (JIRA STATUS SYNC).
            // Fix expectation: a new step (e.g., 2.6) or a separately headed block
            // for BACKLOG.md that is NOT a sub-step of 2.5.

            // Strategy: find a BACKLOG.md-related heading/step that appears OUTSIDE
            // the Jira sync block. First, locate the Jira sync block boundaries.
            const jiraSyncBlock = extractJiraSyncBlock(orchestratorContent);

            // The BACKLOG.md completion step must exist somewhere in finalize steps
            const hasBacklogStep = /BACKLOG\.md/i.test(finalizeSteps);
            assert.ok(hasBacklogStep,
                'Orchestrator finalize must contain a BACKLOG.md update step');

            // And it must NOT be exclusively within the Jira sync block.
            // Count BACKLOG references in full finalize vs. inside Jira sync.
            const backlogInFinalize = (finalizeSteps.match(/BACKLOG\.md/gi) || []).length;
            const backlogInJiraSync = (jiraSyncBlock.match(/BACKLOG\.md/gi) || []).length;

            // After fix: there should be BACKLOG.md references OUTSIDE the Jira block
            assert.ok(backlogInFinalize > backlogInJiraSync,
                'BACKLOG.md step must exist outside the Jira sync block (not nested under step 2.5). ' +
                `Found ${backlogInFinalize} in finalize, ${backlogInJiraSync} in Jira sync block`);
        });

        it('[P0] SV-02: Orchestrator finalize mode summary includes BACKLOG.md (FR-006, AC-008)', () => {
            assert.ok(orchestratorContent, 'spec must be loaded');

            // The finalize mode behavior summary (item 3 in Mode Behavior section)
            // currently reads: "finalize: Human Review -> merge -> collectPhaseSnapshots -> prune -> workflow_history -> clear"
            // After fix, it must include BACKLOG somewhere in this pipeline.
            const modeBehaviorSection = extractSection(
                orchestratorContent,
                /###\s+Mode Behavior/,
                /##\s+4\.\s+Workflow Phase Advancement/
            );
            assert.ok(modeBehaviorSection.length > 0, 'Mode Behavior section must exist');

            // Find the finalize line (item 3)
            const finalizeLine = modeBehaviorSection.match(/3\.\s+\*\*finalize\*\*:.*$/m);
            assert.ok(finalizeLine, 'Finalize mode behavior line must exist');

            const hasBacklogInSummary = /BACKLOG/i.test(finalizeLine[0]);
            assert.ok(hasBacklogInSummary,
                'Finalize mode summary must include BACKLOG.md in the execution sequence. ' +
                `Current line: "${finalizeLine[0].substring(0, 120)}..."`);
        });
    });

    describe('FR-001: BACKLOG.md matching strategy', () => {

        it('[P0] SV-03: Orchestrator BACKLOG.md step matches by artifact_folder (FR-001, AC-001)', () => {
            assert.ok(orchestratorContent, 'spec must be loaded');

            const finalizeSteps = extractOrchestratorFinalizeSteps(orchestratorContent);

            // The BACKLOG.md step must reference artifact_folder as the primary match key
            const hasArtifactFolderMatch = /artifact_folder/i.test(finalizeSteps);
            assert.ok(hasArtifactFolderMatch,
                'Orchestrator BACKLOG.md step must specify matching by artifact_folder from active_workflow');
        });

        it('[P0] SV-04: Orchestrator BACKLOG.md step matches by external_id (FR-001, AC-002)', () => {
            assert.ok(orchestratorContent, 'spec must be loaded');

            const finalizeSteps = extractOrchestratorFinalizeSteps(orchestratorContent);

            // The BACKLOG.md step must reference external_id or source_id as a fallback
            const hasExternalIdMatch = /external_id|source_id/i.test(finalizeSteps);
            assert.ok(hasExternalIdMatch,
                'Orchestrator BACKLOG.md step must specify matching by external_id or source_id as fallback');
        });
    });

    describe('FR-002: Mark checkbox [x]', () => {

        it('[P0] SV-05: Orchestrator BACKLOG.md step marks item checkbox [x] (FR-002, AC-001)', () => {
            assert.ok(orchestratorContent, 'spec must be loaded');

            // Find the BACKLOG.md completion section (outside Jira sync)
            // and verify it mentions changing [ ] to [x]
            const finalizeSteps = extractOrchestratorFinalizeSteps(orchestratorContent);

            // Look for [x] marking instruction in BACKLOG context
            // Must be in a BACKLOG-related step, not just the old 2.5d nested one
            const hasCheckboxMark = /\[x\]|\[ \].*\[x\]|checkbox.*\[x\]|mark.*\[x\]|change.*\[ \].*\[x\]/i.test(finalizeSteps);
            assert.ok(hasCheckboxMark,
                'Orchestrator BACKLOG.md step must specify changing checkbox from [ ] to [x]');
        });
    });

    describe('FR-003: Completed date sub-bullet', () => {

        it('[P1] SV-06: Orchestrator BACKLOG.md step adds Completed date sub-bullet (FR-003, AC-001)', () => {
            assert.ok(orchestratorContent, 'spec must be loaded');

            const finalizeSteps = extractOrchestratorFinalizeSteps(orchestratorContent);

            // Must specify adding a **Completed:** date sub-bullet
            const hasCompletedDate = /\*\*Completed\*\*|Completed.*date|Completed.*YYYY|Completed.*sub-bullet/i.test(finalizeSteps);
            assert.ok(hasCompletedDate,
                'Orchestrator BACKLOG.md step must specify adding a **Completed:** date sub-bullet');
        });
    });

    describe('FR-004: Move to ## Completed section', () => {

        it('[P1] SV-07: Orchestrator BACKLOG.md step moves item block to ## Completed (FR-004, AC-001)', () => {
            assert.ok(orchestratorContent, 'spec must be loaded');

            const finalizeSteps = extractOrchestratorFinalizeSteps(orchestratorContent);

            // Must specify moving the item block from ## Open to ## Completed
            const hasMoveInstruction = /move.*##\s*Completed|##\s*Completed.*section|transfer.*Completed/i.test(finalizeSteps);
            assert.ok(hasMoveInstruction,
                'Orchestrator BACKLOG.md step must specify moving item block to ## Completed section');
        });

        it('[P1] SV-09: Orchestrator BACKLOG.md step creates ## Completed if missing (FR-004, AC-006)', () => {
            assert.ok(orchestratorContent, 'spec must be loaded');

            const finalizeSteps = extractOrchestratorFinalizeSteps(orchestratorContent);

            // Must specify creating ## Completed section if it does not exist
            const hasCreateCompleted = /create.*##\s*Completed|##\s*Completed.*not exist|##\s*Completed.*missing|auto-create|append.*##\s*Completed/i.test(finalizeSteps);
            assert.ok(hasCreateCompleted,
                'Orchestrator BACKLOG.md step must specify creating ## Completed section if missing');
        });

        it('[P1] SV-10: Orchestrator BACKLOG.md step preserves sub-bullets on move (FR-004, AC-007)', () => {
            assert.ok(orchestratorContent, 'spec must be loaded');

            const finalizeSteps = extractOrchestratorFinalizeSteps(orchestratorContent);

            // Must specify that sub-bullets (indented lines) move together with the parent
            const hasBlockPreservation = /sub-bullet|item block|indent.*move|entire.*block|block.*move|all.*sub/i.test(finalizeSteps);
            assert.ok(hasBlockPreservation,
                'Orchestrator BACKLOG.md step must specify that sub-bullets move together with the parent item');
        });
    });

    describe('FR-005: Non-blocking execution', () => {

        it('[P0] SV-08: Orchestrator BACKLOG.md step is non-blocking (FR-005, AC-003/AC-004/AC-005)', () => {
            assert.ok(orchestratorContent, 'spec must be loaded');

            const finalizeSteps = extractOrchestratorFinalizeSteps(orchestratorContent);

            // Must specify non-blocking behavior: warning on failure, skip if no file,
            // no corruption on malformed input. Look for the BACKLOG completion step's
            // non-blocking clause -- it should be OUTSIDE the Jira sync block.

            // First, confirm there is a BACKLOG step outside Jira sync
            const jiraSyncBlock = extractJiraSyncBlock(orchestratorContent);
            const afterJiraSync = finalizeSteps.substring(
                finalizeSteps.indexOf(jiraSyncBlock) + jiraSyncBlock.length
            );

            // The non-blocking language for BACKLOG.md should appear outside Jira sync
            const hasNonBlocking = /non-blocking|warning|do NOT block|does not block|skip.*silent|graceful/i.test(afterJiraSync)
                || /BACKLOG[\s\S]*?non-blocking|BACKLOG[\s\S]*?warning/i.test(finalizeSteps);
            assert.ok(hasNonBlocking,
                'Orchestrator BACKLOG.md step must specify non-blocking behavior (warning on failure, ' +
                'silent skip if no file, no corruption on malformed input)');
        });
    });

    // --- isdlc.md Spec Validation ---

    describe('FR-006 / AC-008: isdlc.md STEP 4 BACKLOG.md sync', () => {

        it('[P0] SV-11: isdlc.md STEP 4 has BACKLOG.md sync section parallel to Jira sync (FR-006, AC-008)', () => {
            assert.ok(isdlcContent, 'spec must be loaded');

            const step4 = extractStep4Section(isdlcContent);
            assert.ok(step4.length > 0, 'STEP 4 section must exist');

            // Must have a BACKLOG.md sync section at the same level as "Jira sync" and "GitHub sync"
            // These appear as bold headings: **Jira sync**, **GitHub sync**
            // After fix, there should be a **BACKLOG.md sync** or **BACKLOG.md completion** heading
            const hasBacklogSyncSection = /\*\*BACKLOG\.md[^*]*\*\*/i.test(step4);
            assert.ok(hasBacklogSyncSection,
                'isdlc.md STEP 4 must have a **BACKLOG.md sync** (or similar) bold section heading ' +
                'at the same level as **Jira sync** and **GitHub sync**');
        });

        it('[P0] SV-12: isdlc.md BACKLOG.md sync is NOT nested under Jira sync (FR-006, AC-008)', () => {
            assert.ok(isdlcContent, 'spec must be loaded');

            // Extract the Jira sync section specifically (from **Jira sync** to **GitHub sync**)
            const jiraSection = extractIsdlcJiraSyncSection(isdlcContent);
            assert.ok(jiraSection.length > 0, 'Jira sync section must exist');

            // The Jira sync section should NOT contain BACKLOG.md marking language
            // Currently line 2245 reads: "Updates BACKLOG.md: marks item [x], moves to ## Completed section"
            // After fix, this should be removed from Jira sync and placed in its own section
            const hasBacklogInJira = /BACKLOG\.md.*marks.*\[x\]|Updates.*BACKLOG\.md/i.test(jiraSection);
            assert.ok(!hasBacklogInJira,
                'BACKLOG.md update must NOT be a sub-bullet under Jira sync in isdlc.md STEP 4. ' +
                'It should be its own independent section. Current Jira section still contains BACKLOG reference.');
        });

        it('[P1] SV-13: isdlc.md BACKLOG.md sync describes matching strategy (FR-001, AC-001/AC-002)', () => {
            assert.ok(isdlcContent, 'spec must be loaded');

            const step4 = extractStep4Section(isdlcContent);

            // The BACKLOG.md sync section should describe the matching strategy
            const hasMatchingStrategy = /artifact_folder|external_id|source_id|matching/i.test(step4)
                && /BACKLOG/i.test(step4);
            assert.ok(hasMatchingStrategy,
                'isdlc.md BACKLOG.md sync section must describe the matching strategy ' +
                '(artifact_folder, external_id, or similar)');
        });

        it('[P1] SV-14: isdlc.md BACKLOG.md sync describes non-blocking behavior (FR-005)', () => {
            assert.ok(isdlcContent, 'spec must be loaded');

            const step4 = extractStep4Section(isdlcContent);

            // Find the BACKLOG.md section and check for non-blocking language
            // The section should mention that failures do not block workflow completion
            const backlogSection = extractSection(
                step4,
                /\*\*BACKLOG\.md[^*]*\*\*/i,
                /\*\*(?:CRITICAL|After)/i
            );

            const hasNonBlocking = /non-blocking|warning|does not block|do not block/i.test(backlogSection);
            assert.ok(hasNonBlocking,
                'isdlc.md BACKLOG.md sync section must specify non-blocking behavior');
        });
    });
});

// ===========================================================================
// REGRESSION TESTS (RT) — Expected to PASS (existing behavior)
// ===========================================================================

describe('BUG-0033: Regression Tests', () => {

    describe('Orchestrator finalize existing behavior (CON-002)', () => {

        it('[P0] RT-01: Orchestrator still has Jira sync block with MCP transition', () => {
            const spec = orchestratorContent || readOrchestratorSpec();

            // The JIRA STATUS SYNC heading must still exist
            const hasJiraSyncHeading = /JIRA STATUS SYNC/i.test(spec);
            assert.ok(hasJiraSyncHeading,
                'Orchestrator must still contain the JIRA STATUS SYNC heading');

            // Must still reference MCP Jira transition
            const hasMcpTransition = /updateStatus.*Done|transition.*Jira/i.test(spec);
            assert.ok(hasMcpTransition,
                'Orchestrator Jira sync must still reference MCP status transition');
        });

        it('[P0] RT-02: Orchestrator Jira sync still skips for non-Jira workflows', () => {
            const spec = orchestratorContent || readOrchestratorSpec();

            // The conditional skip must still exist (BUG-0034 changed field from jira_ticket_id to external_id + source check)
            const hasSkipConditional = /external_id.*absent.*null.*SKIP|not.*jira.*SKIP|source.*not.*jira.*SKIP/i.test(spec);
            assert.ok(hasSkipConditional,
                'Orchestrator Jira sync must still skip when not a Jira-backed workflow (external_id absent or source not jira)');
        });

        it('[P0] RT-03: Orchestrator finalize still includes merge, prune, workflow_history', () => {
            const spec = orchestratorContent || readOrchestratorSpec();

            // Finalize mode summary must still have the core steps
            const modeBehavior = extractSection(
                spec,
                /###\s+Mode Behavior/,
                /##\s+4\.\s+Workflow Phase Advancement/
            );

            const hasMerge = /merge/i.test(modeBehavior);
            const hasPrune = /prune/i.test(modeBehavior);
            const hasWorkflowHistory = /workflow_history/i.test(modeBehavior);
            const hasClearWorkflow = /clear.*active_workflow/i.test(modeBehavior);

            assert.ok(hasMerge, 'Finalize must still include merge step');
            assert.ok(hasPrune, 'Finalize must still include prune step');
            assert.ok(hasWorkflowHistory, 'Finalize must still include workflow_history step');
            assert.ok(hasClearWorkflow, 'Finalize must still include clear active_workflow step');
        });
    });

    describe('isdlc.md STEP 4 existing sections (CON-002)', () => {

        it('[P0] RT-04: isdlc.md STEP 4 still has Jira sync section', () => {
            const spec = isdlcContent || readIsdlcSpec();

            const step4 = extractStep4Section(spec);
            assert.ok(step4.length > 0, 'STEP 4 section must exist');

            const hasJiraSync = /\*\*Jira sync\*\*/i.test(step4);
            assert.ok(hasJiraSync,
                'isdlc.md STEP 4 must still contain **Jira sync** section');
        });

        it('[P0] RT-05: isdlc.md STEP 4 still has GitHub sync section', () => {
            const spec = isdlcContent || readIsdlcSpec();

            const step4 = extractStep4Section(spec);
            assert.ok(step4.length > 0, 'STEP 4 section must exist');

            const hasGitHubSync = /\*\*GitHub sync\*\*/i.test(step4);
            assert.ok(hasGitHubSync,
                'isdlc.md STEP 4 must still contain **GitHub sync** section');
        });

        it('[P1] RT-06: Trivial tier (T8) still calls updateBacklogMarker with "x"', () => {
            const spec = isdlcContent || readIsdlcSpec();

            // T8 step must still reference updateBacklogMarker
            const hasT8 = /T8\..*BACKLOG|T8\..*updateBacklogMarker/i.test(spec);
            assert.ok(hasT8,
                'isdlc.md trivial tier step T8 must still reference BACKLOG.md marker update');

            const hasUpdateCall = /updateBacklogMarker.*"x"/i.test(spec);
            assert.ok(hasUpdateCall,
                'isdlc.md T8 must still call updateBacklogMarker with "x" marker');
        });
    });

    describe('three-verb-utils API preservation (CON-003)', () => {

        it('[P1] RT-07: updateBacklogMarker is still exported from three-verb-utils', () => {
            const utils = require('../lib/three-verb-utils.cjs');
            assert.equal(typeof utils.updateBacklogMarker, 'function',
                'updateBacklogMarker must still be a function export from three-verb-utils.cjs');
        });

        it('[P1] RT-08: appendToBacklog is still exported from three-verb-utils', () => {
            const utils = require('../lib/three-verb-utils.cjs');
            assert.equal(typeof utils.appendToBacklog, 'function',
                'appendToBacklog must still be a function export from three-verb-utils.cjs');
        });
    });
});

// ===========================================================================
// SPECIFICATION STRUCTURE TESTS (SS) — Expected to FAIL pre-fix
// ===========================================================================

describe('BUG-0033: Specification Structure', () => {

    it('[P1] SS-01: isdlc.md STEP 4 has all three sync sections (Jira, GitHub, BACKLOG.md)', () => {
        const spec = isdlcContent || readIsdlcSpec();

        const step4 = extractStep4Section(spec);
        assert.ok(step4.length > 0, 'STEP 4 section must exist');

        // Count distinct bold sync section headings
        const hasJiraSync = /\*\*Jira sync\*\*/i.test(step4);
        const hasGitHubSync = /\*\*GitHub sync\*\*/i.test(step4);
        const hasBacklogSync = /\*\*BACKLOG\.md[^*]*\*\*/i.test(step4);

        assert.ok(hasJiraSync, 'STEP 4 must contain **Jira sync** section');
        assert.ok(hasGitHubSync, 'STEP 4 must contain **GitHub sync** section');
        assert.ok(hasBacklogSync,
            'STEP 4 must contain **BACKLOG.md sync** (or similar) section as a third sync peer');
    });

    it('[P1] SS-02: Orchestrator finalize mode summary mentions BACKLOG.md alongside merge and prune', () => {
        const spec = orchestratorContent || readOrchestratorSpec();

        const modeBehavior = extractSection(
            spec,
            /###\s+Mode Behavior/,
            /##\s+4\.\s+Workflow Phase Advancement/
        );

        // The finalize mode line must reference BACKLOG alongside the existing steps
        const finalizeLine = modeBehavior.match(/3\.\s+\*\*finalize\*\*:.*$/m);
        assert.ok(finalizeLine, 'Finalize mode behavior line must exist');

        const line = finalizeLine[0];
        const hasMerge = /merge/i.test(line);
        const hasPrune = /prune/i.test(line);
        const hasBacklog = /BACKLOG/i.test(line);

        assert.ok(hasMerge && hasPrune && hasBacklog,
            'Finalize mode summary must mention BACKLOG.md alongside merge and prune. ' +
            `Current: "${line.substring(0, 150)}..."`);
    });

    it('[P1] SS-03: BACKLOG.md sync section in isdlc.md mentions non-blocking (matching Jira/GitHub pattern)', () => {
        const spec = isdlcContent || readIsdlcSpec();

        const step4 = extractStep4Section(spec);

        // Extract the BACKLOG.md sync section
        const backlogSection = extractSection(
            step4,
            /\*\*BACKLOG\.md[^*]*\*\*/i,
            /\*\*(?:CRITICAL|After)/i
        );

        // It must mention non-blocking behavior, consistent with how Jira sync
        // says "does not block workflow completion" and GitHub sync says
        // "never block workflow completion"
        const hasNonBlocking = /non-blocking|does not block|do not block|never block|warning.*continu/i.test(backlogSection);
        assert.ok(hasNonBlocking,
            'BACKLOG.md sync section must describe non-blocking behavior, ' +
            'matching the pattern used by Jira sync and GitHub sync sections');
    });

    it('[P2] SS-04: Orchestrator finalize step numbering is consistent (no orphaned 2.5d)', () => {
        const spec = orchestratorContent || readOrchestratorSpec();

        const finalizeSteps = extractOrchestratorFinalizeSteps(spec);

        // After fix: step 2.5d should either be removed from Jira sync
        // or the BACKLOG.md update should exist as a new independent step.
        //
        // Check that if 2.5d still exists under Jira sync, there is also
        // a top-level BACKLOG step. Or check that 2.5d has been replaced
        // by a properly numbered step.
        //
        // The simplest check: the text "2.5d" referencing BACKLOG should
        // not appear as the ONLY BACKLOG reference in finalize.
        const has25d = /2\.5d\)?\s/i.test(finalizeSteps);
        const jiraSyncBlock = extractJiraSyncBlock(spec);
        const backlogOutsideJira = finalizeSteps.replace(jiraSyncBlock, '');
        const hasBacklogOutsideJira = /BACKLOG\.md/i.test(backlogOutsideJira);

        // Either 2.5d is gone, OR there is a BACKLOG reference outside Jira sync
        assert.ok(!has25d || hasBacklogOutsideJira,
            'Step 2.5d (BACKLOG.md nested under Jira) should be un-nested or ' +
            'supplemented by a top-level BACKLOG.md step. ' +
            'Step numbering must be consistent and not leave orphaned Jira-conditional sub-steps.');
    });
});
