'use strict';

/**
 * iSDLC Blast Radius STEP 3f Handling - Test Suite (CJS)
 * =======================================================
 * Tests for blast-radius-specific block handling in the phase-loop controller
 * (isdlc.md STEP 3f). Validates helper functions, markdown instruction content,
 * integration flows, and regression safety.
 *
 * Run: node --test src/claude/hooks/tests/test-blast-radius-step3f.test.cjs
 *
 * Traces to: BUG-0019 (FR-01 through FR-05, NFR-01, NFR-02, NFR-03)
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Source imports
// ---------------------------------------------------------------------------

const helpersPath = path.resolve(__dirname, '..', 'lib', 'blast-radius-step3f-helpers.cjs');
const {
    MAX_BLAST_RADIUS_RETRIES,
    isBlastRadiusBlock,
    parseBlockMessageFiles,
    matchFilesToTasks,
    isValidDeferral,
    incrementBlastRadiusRetry,
    isBlastRadiusRetryExceeded,
    logBlastRadiusRetry,
    buildBlastRadiusRedelegationContext,
    formatRedelegationPrompt
} = require(helpersPath);

// Import formatBlockMessage from the original validator for fixture generation
const validatorPath = path.resolve(__dirname, '..', 'blast-radius-validator.cjs');
const { formatBlockMessage } = require(validatorPath);

// ---------------------------------------------------------------------------
// Source file paths for markdown validation tests
// ---------------------------------------------------------------------------

const ISDLC_MD_PATH = path.resolve(__dirname, '..', '..', 'commands', 'isdlc.md');
const ORCHESTRATOR_MD_PATH = path.resolve(__dirname, '..', '..', 'agents', '00-sdlc-orchestrator.md');

// ---------------------------------------------------------------------------
// Test Fixtures - Block Messages
// ---------------------------------------------------------------------------

const BLOCK_MSG_SINGLE_FILE = formatBlockMessage({
    total: 3,
    covered: [{ filePath: 'src/a.cjs' }, { filePath: 'src/b.cjs' }],
    deferred: [],
    unaddressed: [{ filePath: 'src/hooks/missing.cjs', changeType: 'MODIFY' }]
});

const BLOCK_MSG_MULTI_FILE = formatBlockMessage({
    total: 5,
    covered: [{ filePath: 'src/a.cjs' }, { filePath: 'src/b.cjs' }],
    deferred: [],
    unaddressed: [
        { filePath: 'src/hooks/a.cjs', changeType: 'MODIFY' },
        { filePath: 'src/agents/b.md', changeType: 'CREATE' },
        { filePath: 'src/commands/c.md', changeType: 'DELETE' }
    ]
});

const BLOCK_MSG_WITH_DEFERRALS = formatBlockMessage({
    total: 5,
    covered: [{ filePath: 'src/a.cjs' }],
    deferred: [{ filePath: 'src/d.cjs', notes: 'Deferred: reason' }],
    unaddressed: [
        { filePath: 'src/hooks/x.cjs', changeType: 'MODIFY' },
        { filePath: 'src/agents/y.md', changeType: 'CREATE' },
        { filePath: 'src/commands/z.md', changeType: 'MODIFY' }
    ]
});

const NON_BLAST_RADIUS_BLOCK = 'GATE BLOCKED: Phase 06 gate check failed. ' +
    'Required artifacts missing: test-strategy.md, traceability-matrix.csv';

// ---------------------------------------------------------------------------
// Test Fixtures - tasks.md Content
// ---------------------------------------------------------------------------

const TASKS_MD_MATCHING = `## Tasks

- [ ] T0004a -- Phase 06: Implementation -- Modify src/hooks/a.cjs for blast radius parsing
  files: src/hooks/a.cjs
- [ ] T0004b -- Phase 06: Implementation -- Create src/agents/b.md agent definition
  files: src/agents/b.md
- [ ] T0004c -- Phase 06: Implementation -- Update src/commands/c.md for new STEP
  files: src/commands/c.md
- [X] T0004d -- Phase 06: Implementation -- Update README.md
  files: README.md
`;

const TASKS_MD_PARTIAL_MATCH = `## Tasks

- [ ] T0004a -- Phase 06: Implementation -- Modify src/hooks/a.cjs for blast radius parsing
  files: src/hooks/a.cjs
- [ ] T0004b -- Phase 06: Implementation -- General cleanup tasks
`;

const TASKS_MD_COMPLETED_DISCREPANCY = `## Tasks

- [X] T0004a -- Phase 06: Implementation -- Modify src/hooks/a.cjs for blast radius parsing
  files: src/hooks/a.cjs
`;

const TASKS_MD_EMPTY = '';

// ---------------------------------------------------------------------------
// Test Fixtures - requirements-spec.md Content
// ---------------------------------------------------------------------------

const REQ_SPEC_WITH_DEFERRALS = `# Requirements Specification

## Functional Requirements

### FR-01: Some feature
...

## Deferred Files

| File | Justification |
|------|---------------|
| \`src/agents/b.md\` | Not needed for MVP; will address in REQ-0012 |
| \`src/commands/z.md\` | Blocked by upstream dependency |
`;

const REQ_SPEC_NO_DEFERRALS = `# Requirements Specification

## Functional Requirements

### FR-01: Some feature
...

## Out of Scope

- UI changes
`;

const REQ_SPEC_MALFORMED_DEFERRALS = `# Requirements Specification

## Deferred Files

This section has text but no table format.
Some files might be listed but not in a parseable table.
`;

// ---------------------------------------------------------------------------
// Test Fixtures - State factory
// ---------------------------------------------------------------------------

function featurePhase06State(overrides = {}) {
    return {
        active_workflow: {
            type: 'feature',
            id: 'REQ-0010',
            current_phase: '06-implementation',
            artifact_folder: 'REQ-0010-test-feature',
            ...(overrides.active_workflow || {})
        },
        blast_radius_retries: 0,
        blast_radius_retry_log: [],
        ...overrides
    };
}

function stateRetriesAtLimit() {
    return featurePhase06State({
        blast_radius_retries: 3,
        blast_radius_retry_log: [
            { iteration: 1, unaddressed_count: 5, matched_tasks: 3, timestamp: '2026-02-16T10:00:00Z' },
            { iteration: 2, unaddressed_count: 3, matched_tasks: 2, timestamp: '2026-02-16T10:05:00Z' },
            { iteration: 3, unaddressed_count: 2, matched_tasks: 1, timestamp: '2026-02-16T10:10:00Z' }
        ]
    });
}

// ===========================================================================
// Category 1: Block Message Parsing Tests (TC-PARSE)
// ===========================================================================

describe('Block Message Parsing (parseBlockMessageFiles)', () => {

    // TC-PARSE-01: Extract file paths from single unaddressed file
    it('TC-PARSE-01: extracts single unaddressed file from block message', () => {
        const result = parseBlockMessageFiles(BLOCK_MSG_SINGLE_FILE);
        assert.equal(result.length, 1);
        assert.equal(result[0].filePath, 'src/hooks/missing.cjs');
        assert.equal(result[0].changeType, 'MODIFY');
    });

    // TC-PARSE-02: Extract file paths from multiple unaddressed files
    it('TC-PARSE-02: extracts multiple unaddressed files from block message', () => {
        const result = parseBlockMessageFiles(BLOCK_MSG_MULTI_FILE);
        assert.equal(result.length, 3);
        assert.equal(result[0].filePath, 'src/hooks/a.cjs');
        assert.equal(result[1].filePath, 'src/agents/b.md');
        assert.equal(result[2].filePath, 'src/commands/c.md');
    });

    // TC-PARSE-03: Extract change types (MODIFY, CREATE, DELETE)
    it('TC-PARSE-03: extracts correct change types from block message', () => {
        const result = parseBlockMessageFiles(BLOCK_MSG_MULTI_FILE);
        assert.equal(result[0].changeType, 'MODIFY');
        assert.equal(result[1].changeType, 'CREATE');
        assert.equal(result[2].changeType, 'DELETE');
    });

    // TC-PARSE-04: Handle empty block message
    it('TC-PARSE-04: returns empty array for empty block message', () => {
        const result = parseBlockMessageFiles('');
        assert.deepEqual(result, []);
    });

    // TC-PARSE-05: Handle malformed / non-blast-radius block message
    it('TC-PARSE-05: returns empty array for non-blast-radius block message', () => {
        const result = parseBlockMessageFiles(NON_BLAST_RADIUS_BLOCK);
        assert.deepEqual(result, []);
    });

    // Additional edge cases
    it('returns empty array for null input', () => {
        assert.deepEqual(parseBlockMessageFiles(null), []);
    });

    it('returns empty array for undefined input', () => {
        assert.deepEqual(parseBlockMessageFiles(undefined), []);
    });

    it('returns empty array for non-string input', () => {
        assert.deepEqual(parseBlockMessageFiles(42), []);
    });
});

// ===========================================================================
// Category 2: Task Plan Cross-Reference Tests (TC-TASK)
// ===========================================================================

describe('Task Plan Cross-Reference (matchFilesToTasks)', () => {

    // TC-TASK-01: Match single unaddressed file to task entry
    it('TC-TASK-01: matches single unaddressed file to task entry', () => {
        const files = [{ filePath: 'src/hooks/a.cjs', changeType: 'MODIFY' }];
        const result = matchFilesToTasks(files, TASKS_MD_MATCHING);
        assert.equal(result.length, 1);
        assert.equal(result[0].taskId, 'T0004a');
        assert.equal(result[0].filePath, 'src/hooks/a.cjs');
        assert.equal(result[0].status, 'pending');
        assert.equal(result[0].discrepancy, false);
    });

    // TC-TASK-02: Match multiple unaddressed files to task entries
    it('TC-TASK-02: matches multiple unaddressed files to task entries', () => {
        const files = [
            { filePath: 'src/hooks/a.cjs', changeType: 'MODIFY' },
            { filePath: 'src/agents/b.md', changeType: 'CREATE' },
            { filePath: 'src/commands/c.md', changeType: 'DELETE' }
        ];
        const result = matchFilesToTasks(files, TASKS_MD_MATCHING);
        assert.equal(result.length, 3);
        assert.equal(result[0].taskId, 'T0004a');
        assert.equal(result[1].taskId, 'T0004b');
        assert.equal(result[2].taskId, 'T0004c');
    });

    // TC-TASK-03: Detect unaddressed file with no matching task
    it('TC-TASK-03: returns null taskId for file with no matching task', () => {
        const files = [
            { filePath: 'src/hooks/a.cjs', changeType: 'MODIFY' },
            { filePath: 'src/agents/b.md', changeType: 'CREATE' }
        ];
        const result = matchFilesToTasks(files, TASKS_MD_PARTIAL_MATCH);
        assert.equal(result[0].taskId, 'T0004a');
        assert.equal(result[1].taskId, null);
        assert.equal(result[1].status, 'unknown');
    });

    // TC-TASK-04: Detect task marked [X] but file unaddressed (discrepancy)
    it('TC-TASK-04: flags discrepancy for completed task with unaddressed file', () => {
        const files = [{ filePath: 'src/hooks/a.cjs', changeType: 'MODIFY' }];
        const result = matchFilesToTasks(files, TASKS_MD_COMPLETED_DISCREPANCY);
        assert.equal(result[0].taskId, 'T0004a');
        assert.equal(result[0].status, 'completed');
        assert.equal(result[0].discrepancy, true);
    });

    // TC-TASK-05: Handle missing tasks.md gracefully
    it('TC-TASK-05: handles null tasks.md content gracefully', () => {
        const files = [{ filePath: 'src/hooks/a.cjs', changeType: 'MODIFY' }];
        const result = matchFilesToTasks(files, null);
        assert.equal(result.length, 1);
        assert.equal(result[0].taskId, null);
    });

    // TC-TASK-06: Handle empty tasks.md content
    it('TC-TASK-06: handles empty tasks.md content gracefully', () => {
        const files = [{ filePath: 'src/hooks/a.cjs', changeType: 'MODIFY' }];
        const result = matchFilesToTasks(files, TASKS_MD_EMPTY);
        assert.equal(result.length, 1);
        assert.equal(result[0].taskId, null);
    });

    // Edge cases
    it('returns empty array for null unaddressedFiles', () => {
        assert.deepEqual(matchFilesToTasks(null, TASKS_MD_MATCHING), []);
    });

    it('returns empty array for non-array unaddressedFiles', () => {
        assert.deepEqual(matchFilesToTasks('not-an-array', TASKS_MD_MATCHING), []);
    });
});

// ===========================================================================
// Category 3: Deferral Validation Tests (TC-DEF)
// ===========================================================================

describe('Deferral Validation (isValidDeferral)', () => {

    // TC-DEF-01: Accept deferral from requirements-spec.md
    it('TC-DEF-01: accepts deferral for file listed in Deferred Files section', () => {
        assert.equal(isValidDeferral('src/agents/b.md', REQ_SPEC_WITH_DEFERRALS), true);
    });

    // TC-DEF-02: Reject deferral not in requirements-spec.md
    it('TC-DEF-02: rejects deferral for file NOT in Deferred Files section', () => {
        assert.equal(isValidDeferral('src/hooks/unlisted.cjs', REQ_SPEC_WITH_DEFERRALS), false);
    });

    // TC-DEF-03: No Deferred Files section means no valid deferrals
    it('TC-DEF-03: returns false when no Deferred Files section exists', () => {
        assert.equal(isValidDeferral('src/any/file.cjs', REQ_SPEC_NO_DEFERRALS), false);
    });

    // TC-DEF-04: Malformed Deferred Files section
    it('TC-DEF-04: returns false for malformed Deferred Files section', () => {
        assert.equal(isValidDeferral('src/agents/b.md', REQ_SPEC_MALFORMED_DEFERRALS), false);
    });

    // Edge cases
    it('returns false for null filePath', () => {
        assert.equal(isValidDeferral(null, REQ_SPEC_WITH_DEFERRALS), false);
    });

    it('returns false for null requirements spec content', () => {
        assert.equal(isValidDeferral('src/any/file.cjs', null), false);
    });

    it('accepts second file in deferred list', () => {
        assert.equal(isValidDeferral('src/commands/z.md', REQ_SPEC_WITH_DEFERRALS), true);
    });
});

// ===========================================================================
// Category 4: Retry Counter Tests (TC-RETRY)
// ===========================================================================

describe('Retry Counter Management', () => {

    // TC-RETRY-01: Initialize retry counter on first blast radius block
    it('TC-RETRY-01: initializes retry counter on first blast radius block', () => {
        const state = featurePhase06State();
        delete state.blast_radius_retries;
        const count = incrementBlastRadiusRetry(state);
        assert.equal(count, 1);
        assert.equal(state.blast_radius_retries, 1);
    });

    // TC-RETRY-02: Increment retry counter on subsequent blocks
    it('TC-RETRY-02: increments retry counter on subsequent blocks', () => {
        const state = featurePhase06State({ blast_radius_retries: 1 });
        const count = incrementBlastRadiusRetry(state);
        assert.equal(count, 2);
        assert.equal(state.blast_radius_retries, 2);
    });

    // TC-RETRY-03: Detect max retries exceeded (3 iterations)
    it('TC-RETRY-03: detects max retries exceeded at 3', () => {
        const state = featurePhase06State({ blast_radius_retries: 3 });
        assert.equal(isBlastRadiusRetryExceeded(state), true);
    });

    // TC-RETRY-04: Allow retry when under limit
    it('TC-RETRY-04: allows retry when under limit', () => {
        const state = featurePhase06State({ blast_radius_retries: 2 });
        assert.equal(isBlastRadiusRetryExceeded(state), false);
    });

    // TC-RETRY-05: State logging includes unaddressed file count
    it('TC-RETRY-05: logs retry with unaddressed count and matched tasks', () => {
        const state = featurePhase06State();
        logBlastRadiusRetry(state, { iteration: 1, unaddressed_count: 3, matched_tasks: 2 });
        assert.equal(state.blast_radius_retry_log.length, 1);
        const entry = state.blast_radius_retry_log[0];
        assert.equal(entry.iteration, 1);
        assert.equal(entry.unaddressed_count, 3);
        assert.equal(entry.matched_tasks, 2);
        assert.ok(entry.timestamp, 'timestamp should be present');
    });

    // Edge cases
    it('incrementBlastRadiusRetry handles null state', () => {
        assert.equal(incrementBlastRadiusRetry(null), 0);
    });

    it('isBlastRadiusRetryExceeded handles null state', () => {
        assert.equal(isBlastRadiusRetryExceeded(null), false);
    });

    it('logBlastRadiusRetry handles null state without error', () => {
        assert.doesNotThrow(() => logBlastRadiusRetry(null, { iteration: 1 }));
    });

    it('logBlastRadiusRetry initializes log array if missing', () => {
        const state = {};
        logBlastRadiusRetry(state, { iteration: 1, unaddressed_count: 1, matched_tasks: 0 });
        assert.ok(Array.isArray(state.blast_radius_retry_log));
        assert.equal(state.blast_radius_retry_log.length, 1);
    });

    it('MAX_BLAST_RADIUS_RETRIES is 3', () => {
        assert.equal(MAX_BLAST_RADIUS_RETRIES, 3);
    });
});

// ===========================================================================
// Category 5: isBlastRadiusBlock Tests
// ===========================================================================

describe('Blast Radius Block Detection (isBlastRadiusBlock)', () => {

    it('returns true for blast-radius-validator block message', () => {
        assert.equal(isBlastRadiusBlock(BLOCK_MSG_SINGLE_FILE), true);
    });

    it('returns true for multi-file blast-radius block', () => {
        assert.equal(isBlastRadiusBlock(BLOCK_MSG_MULTI_FILE), true);
    });

    // TC-INT-09: Non-blast-radius block does not trigger specialized handling
    it('TC-INT-09: returns false for non-blast-radius block message', () => {
        assert.equal(isBlastRadiusBlock(NON_BLAST_RADIUS_BLOCK), false);
    });

    it('returns false for empty string', () => {
        assert.equal(isBlastRadiusBlock(''), false);
    });

    it('returns false for null', () => {
        assert.equal(isBlastRadiusBlock(null), false);
    });

    it('returns false for non-string input', () => {
        assert.equal(isBlastRadiusBlock(123), false);
    });
});

// ===========================================================================
// Category 6: Integration Tests - buildBlastRadiusRedelegationContext
// ===========================================================================

describe('Integration: buildBlastRadiusRedelegationContext', () => {

    let state;

    beforeEach(() => {
        state = featurePhase06State();
    });

    // TC-INT-01: Complete block handling flow
    it('TC-INT-01: full flow -- parse, match, build context', () => {
        const context = buildBlastRadiusRedelegationContext(
            BLOCK_MSG_MULTI_FILE,
            TASKS_MD_MATCHING,
            REQ_SPEC_NO_DEFERRALS,
            state
        );
        assert.equal(context.reDelegationNeeded, true);
        assert.equal(context.unaddressedFiles.length, 3);
        assert.equal(context.matchedTasks.length, 3);
        assert.equal(context.retryIteration, 1);
        assert.ok(context.prohibitions.length > 0);
    });

    // TC-INT-05: Retry counter incremented and logged
    it('TC-INT-05: increments retry counter and logs to state', () => {
        buildBlastRadiusRedelegationContext(
            BLOCK_MSG_MULTI_FILE,
            TASKS_MD_MATCHING,
            REQ_SPEC_NO_DEFERRALS,
            state
        );
        assert.equal(state.blast_radius_retries, 1);
        assert.equal(state.blast_radius_retry_log.length, 1);
        assert.equal(state.blast_radius_retry_log[0].iteration, 1);
        assert.ok(state.blast_radius_retry_log[0].timestamp);
    });

    // TC-INT-06: Escalation triggered after 3 retries
    it('TC-INT-06: escalates after 3 retries', () => {
        const limitState = stateRetriesAtLimit();
        const context = buildBlastRadiusRedelegationContext(
            BLOCK_MSG_MULTI_FILE,
            TASKS_MD_MATCHING,
            REQ_SPEC_NO_DEFERRALS,
            limitState
        );
        assert.equal(context.escalate, true);
        assert.match(context.reason, /retry limit.*3.*exceeded/i);
        assert.ok(context.remainingFiles.length > 0);
        assert.equal(context.reDelegationNeeded, false);
    });

    // TC-INT-07: Deferral accepted from requirements-spec.md reduces unaddressed count
    it('TC-INT-07: valid deferral reduces unaddressed file count', () => {
        // BLOCK_MSG_MULTI_FILE has 3 files: src/hooks/a.cjs, src/agents/b.md, src/commands/c.md
        // REQ_SPEC_WITH_DEFERRALS defers src/agents/b.md
        const context = buildBlastRadiusRedelegationContext(
            BLOCK_MSG_MULTI_FILE,
            TASKS_MD_MATCHING,
            REQ_SPEC_WITH_DEFERRALS,
            state
        );
        assert.equal(context.unaddressedFiles.length, 2);
        assert.equal(context.validDeferrals.length, 1);
        assert.equal(context.validDeferrals[0].filePath, 'src/agents/b.md');
    });

    // TC-INT-08: Auto-generated deferral rejected
    it('TC-INT-08: auto-generated deferral not honored', () => {
        // REQ_SPEC_NO_DEFERRALS has no Deferred Files section
        const context = buildBlastRadiusRedelegationContext(
            BLOCK_MSG_MULTI_FILE,
            TASKS_MD_MATCHING,
            REQ_SPEC_NO_DEFERRALS,
            state
        );
        // All 3 files remain unaddressed
        assert.equal(context.unaddressedFiles.length, 3);
        assert.equal(context.validDeferrals.length, 0);
    });

    // TC-INT-10: All unaddressed files have valid deferrals
    it('TC-INT-10: all files deferred means no re-delegation needed', () => {
        // Create a block message where all files are in the deferred list
        const blockMsg = formatBlockMessage({
            total: 3,
            covered: [{ filePath: 'src/a.cjs' }],
            deferred: [],
            unaddressed: [
                { filePath: 'src/agents/b.md', changeType: 'CREATE' },
                { filePath: 'src/commands/z.md', changeType: 'MODIFY' }
            ]
        });
        const context = buildBlastRadiusRedelegationContext(
            blockMsg,
            TASKS_MD_MATCHING,
            REQ_SPEC_WITH_DEFERRALS,
            state
        );
        assert.equal(context.unaddressedFiles.length, 0);
        assert.equal(context.reDelegationNeeded, false);
        assert.equal(context.validDeferrals.length, 2);
    });

    // TC-INT-11: tasks.md not found during cross-reference
    it('TC-INT-11: handles missing tasks.md during cross-reference', () => {
        const context = buildBlastRadiusRedelegationContext(
            BLOCK_MSG_MULTI_FILE,
            null,
            REQ_SPEC_NO_DEFERRALS,
            state
        );
        assert.equal(context.unaddressedFiles.length, 3);
        assert.equal(context.matchedTasks.filter(t => t.taskId !== null).length, 0);
        assert.equal(context.reDelegationNeeded, true);
    });
});

// ===========================================================================
// Category 7: Integration Tests - formatRedelegationPrompt
// ===========================================================================

describe('Integration: formatRedelegationPrompt', () => {

    // TC-INT-02: Re-delegation prompt includes unaddressed file paths
    it('TC-INT-02: prompt includes unaddressed file paths', () => {
        const context = {
            unaddressedFiles: [
                { filePath: 'src/hooks/a.cjs', changeType: 'MODIFY' },
                { filePath: 'src/agents/b.md', changeType: 'CREATE' }
            ],
            matchedTasks: [
                { filePath: 'src/hooks/a.cjs', taskId: 'T0004a', taskDescription: 'Modify src/hooks/a.cjs', discrepancy: false },
                { filePath: 'src/agents/b.md', taskId: 'T0004b', taskDescription: 'Create src/agents/b.md', discrepancy: false }
            ],
            retryIteration: 1,
            prohibitions: ['DO NOT modify impact-analysis.md']
        };
        const prompt = formatRedelegationPrompt(context);
        assert.ok(prompt.includes('src/hooks/a.cjs'), 'Should include first file path');
        assert.ok(prompt.includes('MODIFY'), 'Should include MODIFY change type');
        assert.ok(prompt.includes('src/agents/b.md'), 'Should include second file path');
        assert.ok(prompt.includes('CREATE'), 'Should include CREATE change type');
    });

    // TC-INT-03: Re-delegation prompt includes matched tasks
    it('TC-INT-03: prompt includes matched task IDs and descriptions', () => {
        const context = {
            unaddressedFiles: [
                { filePath: 'src/hooks/a.cjs', changeType: 'MODIFY' }
            ],
            matchedTasks: [
                { filePath: 'src/hooks/a.cjs', taskId: 'T0004a', taskDescription: 'Modify src/hooks/a.cjs', discrepancy: false }
            ],
            retryIteration: 1,
            prohibitions: ['DO NOT modify impact-analysis.md']
        };
        const prompt = formatRedelegationPrompt(context);
        assert.ok(prompt.includes('T0004a'), 'Should include task ID');
        assert.ok(prompt.includes('Modify src/hooks/a.cjs'), 'Should include task description');
    });

    // TC-INT-04: Re-delegation prompt includes modification prohibition
    it('TC-INT-04: prompt includes prohibitions against impact-analysis.md modification', () => {
        const context = {
            unaddressedFiles: [
                { filePath: 'src/hooks/a.cjs', changeType: 'MODIFY' }
            ],
            matchedTasks: [],
            retryIteration: 1,
            prohibitions: [
                'DO NOT modify impact-analysis.md',
                'DO NOT add deferral entries to blast-radius-coverage.md'
            ]
        };
        const prompt = formatRedelegationPrompt(context);
        assert.ok(prompt.includes('DO NOT modify impact-analysis.md'), 'Should include impact-analysis prohibition');
        assert.ok(prompt.includes('DO NOT add deferral entries'), 'Should include deferral prohibition');
    });

    it('prompt includes retry iteration number', () => {
        const context = {
            unaddressedFiles: [{ filePath: 'src/x.cjs', changeType: 'MODIFY' }],
            matchedTasks: [],
            retryIteration: 2,
            prohibitions: []
        };
        const prompt = formatRedelegationPrompt(context);
        assert.ok(prompt.includes('Retry 2'), 'Should include retry iteration');
    });

    it('prompt indicates discrepancy for completed task with unaddressed file', () => {
        const context = {
            unaddressedFiles: [{ filePath: 'src/hooks/a.cjs', changeType: 'MODIFY' }],
            matchedTasks: [
                { filePath: 'src/hooks/a.cjs', taskId: 'T0004a', taskDescription: 'Modify src/hooks/a.cjs', discrepancy: true }
            ],
            retryIteration: 1,
            prohibitions: []
        };
        const prompt = formatRedelegationPrompt(context);
        assert.ok(prompt.includes('DISCREPANCY'), 'Should flag discrepancy');
    });

    it('prompt handles files with no matching task', () => {
        const context = {
            unaddressedFiles: [{ filePath: 'src/hooks/orphan.cjs', changeType: 'MODIFY' }],
            matchedTasks: [
                { filePath: 'src/hooks/orphan.cjs', taskId: null, taskDescription: null, discrepancy: false }
            ],
            retryIteration: 1,
            prohibitions: []
        };
        const prompt = formatRedelegationPrompt(context);
        assert.ok(prompt.includes('No matching task'), 'Should indicate no matching task');
    });
});

// ===========================================================================
// Category 8: Markdown Validation Tests (TC-MD)
// ===========================================================================

describe('Markdown Validation: isdlc.md STEP 3f', () => {

    let isdlcContent;
    let step3fContent;

    beforeEach(() => {
        isdlcContent = fs.readFileSync(ISDLC_MD_PATH, 'utf8');
        // Extract STEP 3f section: from "**3f.**" to the next "####" or "**3g" or "#### STEP 4"
        const step3fMatch = isdlcContent.match(
            /\*\*3f\.\*\*[\s\S]*?(?=####\s|$)/
        );
        step3fContent = step3fMatch ? step3fMatch[0] : '';
    });

    // TC-MD-01: STEP 3f contains blast-radius-validator detection
    it('TC-MD-01: STEP 3f contains blast-radius-validator detection branch', () => {
        assert.match(step3fContent, /blast.radius.validator/i,
            'STEP 3f must reference blast-radius-validator specifically');
    });

    // TC-MD-02: STEP 3f contains unaddressed file extraction instructions
    it('TC-MD-02: STEP 3f contains unaddressed file extraction instructions', () => {
        assert.match(step3fContent, /unaddressed.*(file|path)/i,
            'STEP 3f must instruct extraction of unaddressed file paths');
    });

    // TC-MD-03: STEP 3f contains tasks.md cross-reference instructions
    it('TC-MD-03: STEP 3f contains tasks.md cross-reference instructions', () => {
        assert.match(step3fContent, /tasks\.md/i,
            'STEP 3f must reference tasks.md for cross-referencing');
    });

    // TC-MD-04: STEP 3f contains re-delegation to implementation instructions
    it('TC-MD-04: STEP 3f contains re-delegation to implementation instructions', () => {
        assert.ok(
            /re.?delegat/i.test(step3fContent) || /Phase.06/i.test(step3fContent) || /software.developer/i.test(step3fContent),
            'STEP 3f must contain re-delegation to implementation phase instructions'
        );
    });

    // TC-MD-05: STEP 3f contains retry loop with max 3 iterations
    it('TC-MD-05: STEP 3f contains retry loop with max 3 iterations', () => {
        assert.ok(
            /max.*3/i.test(step3fContent) || /3.*retr/i.test(step3fContent),
            'STEP 3f must specify maximum 3 blast radius retry iterations'
        );
    });

    // TC-MD-06: STEP 3f contains escalation on retry limit exceeded
    it('TC-MD-06: STEP 3f contains escalation instructions for retry limit', () => {
        assert.match(step3fContent, /escalat/i,
            'STEP 3f must contain escalation instructions when retry limit is exceeded');
    });

    // TC-MD-07: STEP 3f contains prohibition against modifying impact-analysis.md
    it('TC-MD-07: STEP 3f contains prohibition against modifying impact-analysis.md', () => {
        assert.ok(
            /MUST NOT.*modify.*impact.analysis/i.test(step3fContent) ||
            /DO NOT.*modify.*impact.analysis/i.test(step3fContent) ||
            /impact.analysis.*read.only/i.test(step3fContent) ||
            /NEVER.*modify.*impact.analysis/i.test(step3fContent),
            'STEP 3f must prohibit modification of impact-analysis.md'
        );
    });

    // TC-MD-08: STEP 3f contains deferral validation from requirements-spec.md
    it('TC-MD-08: STEP 3f contains deferral validation from requirements-spec.md', () => {
        assert.ok(
            /requirements.spec.*defer/i.test(step3fContent) || /Deferred Files/i.test(step3fContent),
            'STEP 3f must reference requirements-spec.md as authority for valid deferrals'
        );
    });

    // TC-MD-09: STEP 3f preserves existing non-blast-radius block handling
    it('TC-MD-09: preserves existing generic Retry/Skip/Cancel handling', () => {
        assert.ok(
            /Retry.*Skip.*Cancel/i.test(step3fContent) || /Retry\/Skip\/Cancel/i.test(step3fContent),
            'STEP 3f must preserve generic Retry/Skip/Cancel for non-blast-radius hooks'
        );
    });
});

describe('Markdown Validation: 00-sdlc-orchestrator.md', () => {

    let orchestratorContent;

    beforeEach(() => {
        orchestratorContent = fs.readFileSync(ORCHESTRATOR_MD_PATH, 'utf8');
    });

    // TC-MD-10: Orchestrator contains blast radius relaxation prevention
    it('TC-MD-10: orchestrator contains blast radius relaxation prevention guidance', () => {
        assert.match(orchestratorContent, /blast.radius/i,
            'Orchestrator must contain blast radius handling guidance');
    });

    // TC-MD-11: Orchestrator contains impact-analysis.md read-only constraint
    it('TC-MD-11: orchestrator contains impact-analysis.md read-only constraint', () => {
        assert.ok(
            /impact.analysis.*read.only/i.test(orchestratorContent) ||
            /impact.analysis.*immutable/i.test(orchestratorContent) ||
            /impact.analysis.*MUST NOT.*modif/i.test(orchestratorContent) ||
            /DO NOT.*modify.*impact.analysis/i.test(orchestratorContent) ||
            /NEVER.*modify.*impact.analysis/i.test(orchestratorContent),
            'Orchestrator must state impact-analysis.md is read-only after Phase 02'
        );
    });
});

// ===========================================================================
// Category 9: Regression Tests (TC-REG)
// ===========================================================================

describe('Regression Tests', () => {

    // TC-REG-01: Non-blast-radius hook blocks still use generic Retry/Skip/Cancel
    it('TC-REG-01: non-blast-radius block handling unchanged', () => {
        const isdlcContent = fs.readFileSync(ISDLC_MD_PATH, 'utf8');
        const step3fMatch = isdlcContent.match(/\*\*3f\.\*\*[\s\S]*?(?=####\s|$)/);
        const step3fContent = step3fMatch ? step3fMatch[0] : '';
        // The generic blocked_by_hook path must still mention AskUserQuestion or Retry/Skip/Cancel
        assert.ok(
            /blocked_by_hook/i.test(step3fContent),
            'STEP 3f must still handle generic blocked_by_hook status'
        );
    });

    // TC-REG-02: blast-radius-validator.cjs produces same output format
    it('TC-REG-02: formatBlockMessage produces expected format', () => {
        const report = {
            total: 3,
            covered: [{ filePath: 'src/a.cjs' }],
            deferred: [],
            unaddressed: [{ filePath: 'src/b.cjs', changeType: 'MODIFY' }]
        };
        const msg = formatBlockMessage(report);
        assert.ok(msg.includes('BLAST RADIUS COVERAGE INCOMPLETE'));
        assert.ok(msg.includes('src/b.cjs (expected: MODIFY)'));
        assert.ok(msg.includes('Coverage: 1 covered, 0 deferred, 1 unaddressed'));
    });

    // TC-REG-03: Existing blast-radius-validator tests can still run (structural check)
    it('TC-REG-03: blast-radius-validator exports are unchanged', () => {
        const validator = require(validatorPath);
        assert.ok(typeof validator.check === 'function', 'check function must exist');
        assert.ok(typeof validator.parseImpactAnalysis === 'function', 'parseImpactAnalysis must exist');
        assert.ok(typeof validator.parseBlastRadiusCoverage === 'function', 'parseBlastRadiusCoverage must exist');
        assert.ok(typeof validator.getModifiedFiles === 'function', 'getModifiedFiles must exist');
        assert.ok(typeof validator.buildCoverageReport === 'function', 'buildCoverageReport must exist');
        assert.ok(typeof validator.formatBlockMessage === 'function', 'formatBlockMessage must exist');
    });
});
