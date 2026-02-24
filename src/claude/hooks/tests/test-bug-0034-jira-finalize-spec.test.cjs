'use strict';

/**
 * BUG-0034: Jira updateStatus at Finalize Not Implemented - Test Suite
 * =====================================================================
 * Tests validate that:
 * 1. 00-sdlc-orchestrator.md has concrete MCP procedure for Jira transition (not conceptual updateStatus)
 * 2. isdlc.md STEP 4 has concrete MCP tool calls (not conceptual updateStatus)
 * 3. Field name alignment: external_id (not jira_ticket_id) with source check
 * 4. Transition name matching logic (Done > Complete > Resolved > Closed)
 * 5. CloudId resolution via getAccessibleAtlassianResources
 * 6. Non-blocking error handling at each step
 * 7. jira_sync_status recording
 * 8. Finalize mode summary includes Jira sync
 *
 * Run:  node --test src/claude/hooks/tests/test-bug-0034-jira-finalize-spec.test.cjs
 *
 * BUG-0034-GH-13: Jira updateStatus at finalize not implemented
 * Traces: FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007
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
 * Extracts the orchestrator finalize merge-and-sync section.
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
        /^3\.\s+/m  // Next top-level numbered step
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

describe('BUG-0034: Specification Validation', () => {

    // Setup: read both spec files
    it('setup: spec files are readable', () => {
        orchestratorContent = readOrchestratorSpec();
        assert.ok(orchestratorContent.length > 0, '00-sdlc-orchestrator.md should not be empty');

        isdlcContent = readIsdlcSpec();
        assert.ok(isdlcContent.length > 0, 'isdlc.md should not be empty');
    });

    // --- FR-001: Resolve Jira Transition ID at Finalize ---

    describe('FR-001: Resolve Jira Transition ID', () => {

        it('[P0] SV-01: Orchestrator calls getTransitionsForJiraIssue for transition discovery (FR-001, AC-001-01)', () => {
            assert.ok(orchestratorContent, 'spec must be loaded');

            const jiraSyncBlock = extractJiraSyncBlock(orchestratorContent);
            assert.ok(jiraSyncBlock.length > 0, 'Jira sync block must exist');

            const hasGetTransitions = /getTransitionsForJiraIssue/i.test(jiraSyncBlock);
            assert.ok(hasGetTransitions,
                'Orchestrator Jira sync must call getTransitionsForJiraIssue to discover available transitions');
        });

        it('[P0] SV-02: Orchestrator specifies transition name matching logic - Done > Complete > Resolved > Closed (FR-001, AC-001-02/AC-001-03)', () => {
            assert.ok(orchestratorContent, 'spec must be loaded');

            const jiraSyncBlock = extractJiraSyncBlock(orchestratorContent);

            // Must mention "Done" as the primary match
            const hasDone = /["']?Done["']?/i.test(jiraSyncBlock);
            assert.ok(hasDone, 'Jira sync must specify "Done" as primary transition match');

            // Must mention fallback transitions (Complete, Resolved, Closed)
            const hasComplete = /Complete/i.test(jiraSyncBlock);
            const hasResolved = /Resolved/i.test(jiraSyncBlock);
            const hasClosed = /Closed/i.test(jiraSyncBlock);
            assert.ok(hasComplete || hasResolved || hasClosed,
                'Jira sync must specify fallback transitions (Complete, Resolved, or Closed)');
        });

        it('[P0] SV-03: Orchestrator handles no terminal transition found (FR-001, AC-001-04)', () => {
            assert.ok(orchestratorContent, 'spec must be loaded');

            const jiraSyncBlock = extractJiraSyncBlock(orchestratorContent);

            // Must mention handling when no Done transition is available
            const hasNoTransitionHandling = /no.*transition|no.*Done.*transition|WARNING.*no.*Done/i.test(jiraSyncBlock);
            assert.ok(hasNoTransitionHandling,
                'Orchestrator Jira sync must handle the case where no terminal transition is available');
        });
    });

    // --- FR-002: Execute Jira Ticket Transition ---

    describe('FR-002: Execute Jira Ticket Transition', () => {

        it('[P0] SV-04: Orchestrator calls transitionJiraIssue to execute transition (FR-002, AC-002-01)', () => {
            assert.ok(orchestratorContent, 'spec must be loaded');

            const jiraSyncBlock = extractJiraSyncBlock(orchestratorContent);

            const hasTransition = /transitionJiraIssue/i.test(jiraSyncBlock);
            assert.ok(hasTransition,
                'Orchestrator Jira sync must call transitionJiraIssue to execute the transition');
        });

        it('[P0] SV-05: Orchestrator records success and failure outcomes (FR-002, AC-002-02/AC-002-03)', () => {
            assert.ok(orchestratorContent, 'spec must be loaded');

            const jiraSyncBlock = extractJiraSyncBlock(orchestratorContent);

            // Must mention recording synced on success
            const hasSynced = /synced/i.test(jiraSyncBlock);
            assert.ok(hasSynced, 'Jira sync must record "synced" on successful transition');

            // Must mention recording failed on failure
            const hasFailed = /failed/i.test(jiraSyncBlock);
            assert.ok(hasFailed, 'Jira sync must record "failed" on transition failure');
        });
    });

    // --- FR-003: CloudId Resolution ---

    describe('FR-003: CloudId Resolution for Finalize', () => {

        it('[P0] SV-06: Orchestrator calls getAccessibleAtlassianResources for cloudId (FR-003, AC-003-01)', () => {
            assert.ok(orchestratorContent, 'spec must be loaded');

            const jiraSyncBlock = extractJiraSyncBlock(orchestratorContent);

            const hasCloudIdResolution = /getAccessibleAtlassianResources/i.test(jiraSyncBlock);
            assert.ok(hasCloudIdResolution,
                'Orchestrator Jira sync must call getAccessibleAtlassianResources to resolve cloudId');
        });

        it('[P0] SV-07: Orchestrator handles MCP unavailable gracefully (FR-003, AC-003-02)', () => {
            assert.ok(orchestratorContent, 'spec must be loaded');

            const jiraSyncBlock = extractJiraSyncBlock(orchestratorContent);

            // Must mention handling MCP unavailable
            const hasMcpUnavailable = /MCP.*unavailable|MCP.*not available|MCP.*fail/i.test(jiraSyncBlock);
            assert.ok(hasMcpUnavailable,
                'Orchestrator Jira sync must handle Atlassian MCP being unavailable');
        });
    });

    // --- FR-006: No conceptual updateStatus() in executable instructions ---

    describe('FR-006: Concrete MCP Instructions (no conceptual updateStatus)', () => {

        it('[P0] SV-08: Orchestrator does NOT use conceptual updateStatus() in Jira sync (FR-006, AC-006-01)', () => {
            assert.ok(orchestratorContent, 'spec must be loaded');

            const jiraSyncBlock = extractJiraSyncBlock(orchestratorContent);

            // updateStatus() is the conceptual adapter -- must NOT appear in executable instructions
            const hasUpdateStatus = /updateStatus\s*\(/i.test(jiraSyncBlock);
            assert.ok(!hasUpdateStatus,
                'Orchestrator Jira sync must NOT reference the conceptual updateStatus() method. ' +
                'It must use concrete MCP tool names: getTransitionsForJiraIssue and transitionJiraIssue');
        });

        it('[P0] SV-09: isdlc.md STEP 4 does NOT use conceptual updateStatus() (FR-006, AC-006-02)', () => {
            assert.ok(isdlcContent, 'spec must be loaded');

            const jiraSection = extractIsdlcJiraSyncSection(isdlcContent);
            assert.ok(jiraSection.length > 0, 'Jira sync section must exist in isdlc.md');

            const hasUpdateStatus = /updateStatus\s*\(/i.test(jiraSection);
            assert.ok(!hasUpdateStatus,
                'isdlc.md Jira sync must NOT reference the conceptual updateStatus() method. ' +
                'It must use concrete MCP tool names');
        });

        it('[P0] SV-10: isdlc.md STEP 4 Jira sync mentions getTransitionsForJiraIssue (FR-006, AC-006-02)', () => {
            assert.ok(isdlcContent, 'spec must be loaded');

            const jiraSection = extractIsdlcJiraSyncSection(isdlcContent);

            const hasGetTransitions = /getTransitionsForJiraIssue/i.test(jiraSection);
            assert.ok(hasGetTransitions,
                'isdlc.md Jira sync must reference getTransitionsForJiraIssue MCP tool');
        });

        it('[P0] SV-11: isdlc.md STEP 4 Jira sync mentions transitionJiraIssue (FR-006, AC-006-02)', () => {
            assert.ok(isdlcContent, 'spec must be loaded');

            const jiraSection = extractIsdlcJiraSyncSection(isdlcContent);

            const hasTransition = /transitionJiraIssue/i.test(jiraSection);
            assert.ok(hasTransition,
                'isdlc.md Jira sync must reference transitionJiraIssue MCP tool');
        });
    });

    // --- FR-007: Field name alignment (external_id, not jira_ticket_id) ---

    describe('FR-007: Field Name Alignment', () => {

        it('[P0] SV-12: Orchestrator Jira sync reads external_id (not jira_ticket_id) (FR-007)', () => {
            assert.ok(orchestratorContent, 'spec must be loaded');

            const jiraSyncBlock = extractJiraSyncBlock(orchestratorContent);

            // Must read external_id (the field that actually exists in active_workflow)
            const hasExternalId = /external_id/i.test(jiraSyncBlock);
            assert.ok(hasExternalId,
                'Orchestrator Jira sync must read active_workflow.external_id (the field populated during init)');

            // Must NOT reference jira_ticket_id as the primary field to read
            // (jira_ticket_id was never populated -- it's the bug we're fixing)
            // We allow jira_ticket_id to appear as documentation or alias, but the
            // primary read instruction must use external_id.
            const jiraSyncFirstRead = jiraSyncBlock.match(/^\s*[a-z]\)\s+Read\s+.*$/m);
            if (jiraSyncFirstRead) {
                const hasExternalIdInRead = /external_id/i.test(jiraSyncFirstRead[0]);
                assert.ok(hasExternalIdInRead,
                    'The primary read instruction in Jira sync must reference external_id. ' +
                    `Found: "${jiraSyncFirstRead[0].trim()}"`);
            }
        });

        it('[P0] SV-13: isdlc.md STEP 4 Jira sync uses external_id (not jira_ticket_id) (FR-007)', () => {
            assert.ok(isdlcContent, 'spec must be loaded');

            const jiraSection = extractIsdlcJiraSyncSection(isdlcContent);

            // The conditional check must reference external_id or source, not jira_ticket_id
            const hasExternalIdOrSource = /external_id|source\s*===?\s*["']jira["']/i.test(jiraSection);
            assert.ok(hasExternalIdOrSource,
                'isdlc.md Jira sync conditional must reference external_id or source === "jira" ' +
                '(not the non-existent jira_ticket_id field)');
        });

        it('[P0] SV-14: isdlc.md STEP 4 Jira sync mentions getAccessibleAtlassianResources (FR-003)', () => {
            assert.ok(isdlcContent, 'spec must be loaded');

            const jiraSection = extractIsdlcJiraSyncSection(isdlcContent);

            const hasCloudId = /getAccessibleAtlassianResources|cloudId/i.test(jiraSection);
            assert.ok(hasCloudId,
                'isdlc.md Jira sync must reference cloudId resolution via getAccessibleAtlassianResources');
        });
    });
});

// ===========================================================================
// SPECIFICATION STRUCTURE TESTS (SS) — Expected to FAIL pre-fix
// ===========================================================================

describe('BUG-0034: Specification Structure', () => {

    it('[P1] SS-01: Orchestrator finalize mode summary includes Jira sync in execution sequence (FR-006)', () => {
        const spec = orchestratorContent || readOrchestratorSpec();

        const modeBehavior = extractSection(
            spec,
            /###\s+Mode Behavior/,
            /##\s+4\.\s+Workflow Phase Advancement/
        );
        assert.ok(modeBehavior.length > 0, 'Mode Behavior section must exist');

        // Find the finalize line (item 3)
        const finalizeLine = modeBehavior.match(/3\.\s+\*\*finalize\*\*:.*$/m);
        assert.ok(finalizeLine, 'Finalize mode behavior line must exist');

        // The finalize summary must include Jira sync
        const hasJiraSync = /Jira/i.test(finalizeLine[0]);
        assert.ok(hasJiraSync,
            'Finalize mode summary must include Jira sync in the execution sequence. ' +
            `Current line: "${finalizeLine[0].substring(0, 150)}..."`);
    });

    it('[P1] SS-02: Step ordering is preserved: merge -> Jira -> GitHub -> BACKLOG -> prune (CON-003)', () => {
        const spec = orchestratorContent || readOrchestratorSpec();

        const finalizeSteps = extractOrchestratorFinalizeSteps(spec);
        assert.ok(finalizeSteps.length > 0, 'Finalize steps must exist');

        // Verify ordering: merge (step 2) before Jira (step 2.5) before BACKLOG (step 3)
        const mergeIdx = finalizeSteps.search(/git checkout main.*git merge|merge.*no-ff/i);
        const jiraIdx = finalizeSteps.search(/JIRA STATUS SYNC/i);
        const backlogIdx = finalizeSteps.search(/BACKLOG\.md COMPLETION/i);

        assert.ok(mergeIdx >= 0, 'Merge step must exist');
        assert.ok(jiraIdx >= 0, 'Jira sync step must exist');
        assert.ok(backlogIdx >= 0, 'BACKLOG.md completion step must exist');

        assert.ok(mergeIdx < jiraIdx, 'Merge must come before Jira sync');
        assert.ok(jiraIdx < backlogIdx, 'Jira sync must come before BACKLOG.md completion');
    });

    it('[P1] SS-03: Both spec files reference the same MCP procedure (consistency check)', () => {
        const orch = orchestratorContent || readOrchestratorSpec();
        const isdlc = isdlcContent || readIsdlcSpec();

        const orchJira = extractJiraSyncBlock(orch);
        const isdlcJira = extractIsdlcJiraSyncSection(isdlc);

        // Both must mention the same 3 MCP tools
        const orchHasGet = /getAccessibleAtlassianResources/i.test(orchJira);
        const orchHasTransitions = /getTransitionsForJiraIssue/i.test(orchJira);
        const orchHasTransition = /transitionJiraIssue/i.test(orchJira);

        const isdlcHasGet = /getAccessibleAtlassianResources/i.test(isdlcJira);
        const isdlcHasTransitions = /getTransitionsForJiraIssue/i.test(isdlcJira);
        const isdlcHasTransition = /transitionJiraIssue/i.test(isdlcJira);

        assert.ok(orchHasGet && isdlcHasGet,
            'Both files must reference getAccessibleAtlassianResources');
        assert.ok(orchHasTransitions && isdlcHasTransitions,
            'Both files must reference getTransitionsForJiraIssue');
        assert.ok(orchHasTransition && isdlcHasTransition,
            'Both files must reference transitionJiraIssue');
    });

    it('[P1] SS-04: Orchestrator Jira sync checks source type before attempting transition (FR-004, AC-004-02)', () => {
        const spec = orchestratorContent || readOrchestratorSpec();

        const jiraSyncBlock = extractJiraSyncBlock(spec);

        // Must check source === "jira" or check that external_id is a Jira ticket
        const hasSourceCheck = /source.*jira|source.*not.*jira|not.*jira.*SKIP/i.test(jiraSyncBlock);
        assert.ok(hasSourceCheck,
            'Orchestrator Jira sync must check that the workflow source is "jira" before attempting transition');
    });

    it('[P1] SS-05: Orchestrator Jira sync mentions status category "done" as fallback (FR-001, AC-001-03)', () => {
        const spec = orchestratorContent || readOrchestratorSpec();

        const jiraSyncBlock = extractJiraSyncBlock(spec);

        // Must mention status category "done" as a fallback matching mechanism
        const hasStatusCategory = /status.*category.*done|category.*done/i.test(jiraSyncBlock);
        assert.ok(hasStatusCategory,
            'Orchestrator Jira sync must mention status category "done" as a fallback transition matching mechanism');
    });
});

// ===========================================================================
// REGRESSION TESTS (RT) — Expected to PASS (existing behavior)
// ===========================================================================

describe('BUG-0034: Regression Tests', () => {

    describe('Orchestrator finalize existing behavior (CON-003)', () => {

        it('[P0] RT-01: BACKLOG.md completion step still exists and is not disturbed', () => {
            const spec = orchestratorContent || readOrchestratorSpec();

            const finalizeSteps = extractOrchestratorFinalizeSteps(spec);

            const hasBacklogStep = /BACKLOG\.md COMPLETION/i.test(finalizeSteps);
            assert.ok(hasBacklogStep,
                'Orchestrator must still contain the BACKLOG.md COMPLETION step');

            // Verify it still has the key matching strategies
            const hasArtifactFolder = /artifact_folder/i.test(finalizeSteps);
            assert.ok(hasArtifactFolder,
                'BACKLOG.md step must still match by artifact_folder');
        });

        it('[P0] RT-02: GitHub sync still exists in isdlc.md STEP 4', () => {
            const spec = isdlcContent || readIsdlcSpec();

            const step4 = extractStep4Section(spec);
            assert.ok(step4.length > 0, 'STEP 4 must exist');

            const hasGitHubSync = /\*\*GitHub sync\*\*/i.test(step4);
            assert.ok(hasGitHubSync,
                'isdlc.md STEP 4 must still contain **GitHub sync** section');

            // Verify gh issue close is still there
            const hasGhIssueClose = /gh issue close/i.test(step4);
            assert.ok(hasGhIssueClose,
                'isdlc.md STEP 4 must still reference gh issue close command');
        });

        it('[P0] RT-03: Finalize still includes merge, prune, workflow_history, clear', () => {
            const spec = orchestratorContent || readOrchestratorSpec();

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

        it('[P0] RT-04: detectSource still correctly identifies Jira sources', () => {
            const { detectSource } = require('../lib/three-verb-utils.cjs');

            const result = detectSource('PROJ-123');
            assert.equal(result.source, 'jira', 'PROJECT-N pattern must be detected as jira');
            assert.equal(result.source_id, 'PROJ-123', 'source_id must be the Jira ticket ID');
        });

        it('[P0] RT-05: Non-Jira workflows still skip Jira sync (by checking spec language)', () => {
            const spec = orchestratorContent || readOrchestratorSpec();

            const jiraSyncBlock = extractJiraSyncBlock(spec);

            // Must still have skip condition for non-Jira workflows
            const hasSkipCondition = /SKIP|absent.*null|not.*jira/i.test(jiraSyncBlock);
            assert.ok(hasSkipCondition,
                'Orchestrator Jira sync must still have a skip condition for non-Jira workflows');
        });

        it('[P0] RT-06: Orchestrator init still writes external_id for fix workflows', () => {
            const spec = orchestratorContent || readOrchestratorSpec();

            // The fix workflow init schema must still include external_id
            const initSection = extractSection(
                spec,
                /\*\*fix workflow:\*\*/,
                /\*\*test-run workflow:\*\*/
            );
            assert.ok(initSection.length > 0, 'Fix workflow init section must exist');

            const hasExternalId = /external_id/i.test(initSection);
            assert.ok(hasExternalId,
                'Fix workflow init must still write external_id to active_workflow');
        });

        it('[P0] RT-07: BACKLOG.md sync section in isdlc.md still exists', () => {
            const spec = isdlcContent || readIsdlcSpec();

            const step4 = extractStep4Section(spec);

            const hasBacklogSync = /\*\*BACKLOG\.md sync\*\*/i.test(step4);
            assert.ok(hasBacklogSync,
                'isdlc.md STEP 4 must still contain **BACKLOG.md sync** section');
        });
    });
});
