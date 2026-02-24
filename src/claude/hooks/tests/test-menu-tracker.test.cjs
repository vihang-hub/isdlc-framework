'use strict';

/**
 * iSDLC Menu Tracker - Test Suite (CJS)
 * ======================================
 * Unit tests for src/claude/hooks/menu-tracker.js (PostToolUse hook)
 *
 * The menu-tracker monitors tool results for A/R/C menu patterns during
 * Phase 01 requirements elicitation. It detects:
 * - Menu presentations (need >= 2 pattern matches)
 * - User selections (A/R/C/S/X)
 * - Step completions
 *
 * Run: node --test src/claude/hooks/tests/test-menu-tracker.test.cjs
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const {
    setupTestEnv,
    cleanupTestEnv,
    writeState,
    readState,
    prepareHook,
    runHook
} = require('./hook-test-utils.cjs');

/** Absolute path to the original hook source */
const hookSrcPath = path.resolve(__dirname, '..', 'menu-tracker.cjs');

// =============================================================================
// Test Suite: menu-tracker.js
// =============================================================================

describe('menu-tracker.js (PostToolUse)', () => {

    /** Path to the CJS-prepared hook in the temp dir (set in beforeEach) */
    let hookPath;

    beforeEach(() => {
        setupTestEnv({
            current_phase: '01-requirements',
            iteration_enforcement: { enabled: true },
            active_workflow: { type: 'feature', current_phase: '01-requirements' }
        });
        hookPath = prepareHook(hookSrcPath);
    });

    afterEach(() => {
        cleanupTestEnv();
    });

    // -------------------------------------------------------------------------
    // 1. Non-Phase-01 state passes through
    // -------------------------------------------------------------------------
    it('passes through when current_phase is not 01-requirements', async () => {
        writeState({
            skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
            current_phase: '06-implementation',
            skill_usage_log: [],
            iteration_enforcement: { enabled: true },
            active_workflow: { type: 'feature', current_phase: '06-implementation' },
            phases: {}
        });

        const result = await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: { prompt: 'test' },
            tool_result: '[A] Adjust [R] Refine [C] Continue Your choice:'
        });

        assert.equal(result.stdout, '', 'Should produce no output for non-Phase-01');
        assert.equal(result.code, 0);
    });

    // -------------------------------------------------------------------------
    // 2. Enforcement disabled passes through
    // -------------------------------------------------------------------------
    it('passes through when iteration_enforcement is disabled', async () => {
        writeState({
            skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
            current_phase: '01-requirements',
            skill_usage_log: [],
            iteration_enforcement: { enabled: false },
            active_workflow: { type: 'feature', current_phase: '01-requirements' },
            phases: {}
        });

        const result = await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: { prompt: 'test' },
            tool_result: '[A] Adjust [R] Refine [C] Continue Your choice:'
        });

        assert.equal(result.stdout, '', 'Should produce no output when enforcement disabled');
        assert.equal(result.code, 0);
    });

    // -------------------------------------------------------------------------
    // 3. Phase 01 with 2+ menu patterns detected
    // -------------------------------------------------------------------------
    it('detects menu presentation when tool_result contains 2+ menu patterns', async () => {
        const result = await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: { prompt: 'some prompt' },
            tool_result: '[A] Adjust your requirements\n[C] Continue to next step\nYour choice:'
        });

        assert.equal(result.code, 0);

        const state = readState();
        const elicit = state.phases?.['01-requirements']?.iteration_requirements?.interactive_elicitation;
        assert.ok(elicit, 'Should have interactive_elicitation state');
        assert.equal(elicit.menu_interactions, 1, 'Should record 1 menu interaction');
        assert.ok(elicit.last_menu_at, 'Should have last_menu_at timestamp');
    });

    // -------------------------------------------------------------------------
    // 4. Single menu pattern does NOT trigger detection
    // -------------------------------------------------------------------------
    it('does not detect menu when only 1 pattern matches (need >= 2)', async () => {
        const result = await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: { prompt: 'some prompt' },
            tool_result: 'Here is some text with [A] Adjust but nothing else relevant.'
        });

        assert.equal(result.stdout, '', 'Should produce no output');
        assert.equal(result.code, 0);

        const state = readState();
        const elicit = state.phases?.['01-requirements']?.iteration_requirements?.interactive_elicitation;
        assert.equal(elicit, undefined, 'Should not create elicitation state for single pattern');
    });

    // -------------------------------------------------------------------------
    // 5. Selection "C" (continue) detected in tool_result
    // -------------------------------------------------------------------------
    it('detects "continue" selection and updates state', async () => {
        const result = await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: { prompt: 'some prompt' },
            tool_result: 'User selected: [C] Continue. Proceeding to next step.'
        });

        assert.equal(result.code, 0);

        const state = readState();
        const elicit = state.phases?.['01-requirements']?.iteration_requirements?.interactive_elicitation;
        assert.ok(elicit, 'Should have interactive_elicitation state');
        assert.equal(elicit.last_selection, 'continue', 'Should record continue selection');
        assert.ok(elicit.selections.length > 0, 'Should have selection entries');
        assert.equal(elicit.selections[0].selection, 'continue');
    });

    // -------------------------------------------------------------------------
    // 6. Selection "S" (save) marks elicitation completed
    // -------------------------------------------------------------------------
    it('marks elicitation completed when "save" selection detected', async () => {
        const result = await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: { prompt: 'some prompt' },
            tool_result: 'User selected: [S] Save. Requirements finalized.'
        });

        assert.equal(result.code, 0);
        assert.ok(result.stdout.includes('INTERACTIVE ELICITATION COMPLETED') ||
                  result.stdout.includes('SATISFIED'),
                  'Should output completion message');

        const state = readState();
        const elicit = state.phases?.['01-requirements']?.iteration_requirements?.interactive_elicitation;
        assert.ok(elicit, 'Should have interactive_elicitation state');
        assert.equal(elicit.completed, true, 'Should mark completed');
        assert.equal(elicit.final_selection, 'save', 'Should record final_selection as save');
        assert.ok(elicit.completed_at, 'Should have completed_at timestamp');
    });

    // -------------------------------------------------------------------------
    // 7. Step completion detected and tracked
    // -------------------------------------------------------------------------
    it('detects step completion and tracks it in state', async () => {
        const result = await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: { prompt: 'some prompt' },
            tool_result: 'Step 1 is now complete. Moving on to user personas.'
        });

        assert.equal(result.code, 0);

        const state = readState();
        const elicit = state.phases?.['01-requirements']?.iteration_requirements?.interactive_elicitation;
        assert.ok(elicit, 'Should have interactive_elicitation state');
        assert.ok(elicit.steps_completed, 'Should have steps_completed array');
        assert.ok(elicit.steps_completed.includes('project_discovery'),
            'Should include project_discovery step');
        assert.deepEqual(elicit.last_step_completed, { step: 1, name: 'project_discovery' });
    });

    // -------------------------------------------------------------------------
    // 8. Multiple interactions accumulate the menu_interactions counter
    // -------------------------------------------------------------------------
    it('accumulates menu_interactions counter across multiple hook invocations', async () => {
        // First interaction
        await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: { prompt: 'first' },
            tool_result: '[A] Adjust [R] Refine [C] Continue Your choice:'
        });

        let state = readState();
        let elicit = state.phases?.['01-requirements']?.iteration_requirements?.interactive_elicitation;
        assert.equal(elicit.menu_interactions, 1, 'Should be 1 after first interaction');

        // Second interaction
        await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: { prompt: 'second' },
            tool_result: '[A] Adjust scope [R] Refine details Select an option:'
        });

        state = readState();
        elicit = state.phases?.['01-requirements']?.iteration_requirements?.interactive_elicitation;
        assert.equal(elicit.menu_interactions, 2, 'Should be 2 after second interaction');

        // Third interaction
        await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: { prompt: 'third' },
            tool_result: '[S] Save final version [X] Exit Enter selection:'
        });

        state = readState();
        elicit = state.phases?.['01-requirements']?.iteration_requirements?.interactive_elicitation;
        assert.equal(elicit.menu_interactions, 3, 'Should be 3 after third interaction');
    });

    // -------------------------------------------------------------------------
    // 9. No menu patterns in output - passes through with no state changes
    // -------------------------------------------------------------------------
    it('passes through with no state changes when no patterns match', async () => {
        const stateBefore = readState();

        const result = await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: { prompt: 'some prompt' },
            tool_result: 'This is a normal response with no menu patterns at all.'
        });

        assert.equal(result.stdout, '', 'Should produce no output');
        assert.equal(result.code, 0);

        const stateAfter = readState();
        assert.deepEqual(stateAfter.phases, stateBefore.phases,
            'State phases should be unchanged');
    });

    // -------------------------------------------------------------------------
    // 10. Missing iteration_enforcement - fail-open, passes through
    // -------------------------------------------------------------------------
    it('tracks menu activity when iteration_enforcement key is absent (not explicitly false)', async () => {
        writeState({
            skill_enforcement: { enabled: true, mode: 'observe', fail_behavior: 'allow', manifest_version: '4.0.0' },
            current_phase: '01-requirements',
            skill_usage_log: [],
            active_workflow: { type: 'feature', current_phase: '01-requirements' },
            // No iteration_enforcement key at all
            phases: {}
        });

        const result = await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: { prompt: 'test' },
            tool_result: '[A] Adjust [R] Refine [C] Continue Your choice:'
        });

        // Hook checks: state.iteration_enforcement?.enabled === false
        // When iteration_enforcement is undefined, this is NOT false, so enforcement is active.
        assert.equal(result.code, 0);

        const state = readState();
        const elicit = state.phases?.['01-requirements']?.iteration_requirements?.interactive_elicitation;
        assert.ok(elicit, 'Should track menu activity even without explicit iteration_enforcement');
    });

    // -------------------------------------------------------------------------
    // 11. Exit selection marks completed with exit
    // -------------------------------------------------------------------------
    it('marks elicitation completed when "exit" selection detected', async () => {
        const result = await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: { prompt: 'user wants to exit' },
            tool_result: 'User selected: [X] Exit. Stopping elicitation.'
        });

        assert.equal(result.code, 0);
        assert.ok(result.stdout.includes('EXITED') || result.stdout.includes('exit'),
            'Should output exit message');

        const state = readState();
        const elicit = state.phases?.['01-requirements']?.iteration_requirements?.interactive_elicitation;
        assert.ok(elicit, 'Should have interactive_elicitation state');
        assert.equal(elicit.completed, true, 'Should mark completed');
        assert.equal(elicit.final_selection, 'exit', 'Should record final_selection as exit');
    });

    // -------------------------------------------------------------------------
    // 12. Empty tool_result passes through
    // -------------------------------------------------------------------------
    it('passes through gracefully when tool_result is empty or missing', async () => {
        const result = await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: { prompt: 'test' },
            tool_result: ''
        });

        assert.equal(result.stdout, '', 'Should produce no output');
        assert.equal(result.code, 0);
    });

    // -------------------------------------------------------------------------
    // 13. Alternative step completion patterns (named steps)
    // -------------------------------------------------------------------------
    it('detects named step completion pattern (e.g., "persona identification complete")', async () => {
        const result = await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: { prompt: 'some prompt' },
            tool_result: 'Persona identification is now complete.'
        });

        assert.equal(result.code, 0);

        const state = readState();
        const elicit = state.phases?.['01-requirements']?.iteration_requirements?.interactive_elicitation;
        assert.ok(elicit, 'Should have interactive_elicitation state');
        assert.ok(elicit.steps_completed.includes('user_personas'),
            'Should detect user_personas via "persona identification complete"');
    });

    // -------------------------------------------------------------------------
    // 14. Duplicate step completions are not recorded twice
    // -------------------------------------------------------------------------
    it('does not duplicate step completion entries', async () => {
        // First detection
        await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: { prompt: 'first' },
            tool_result: 'Step 1 is complete.'
        });

        // Second detection of same step
        await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: { prompt: 'second' },
            tool_result: 'Project discovery complete.'
        });

        const state = readState();
        const elicit = state.phases?.['01-requirements']?.iteration_requirements?.interactive_elicitation;
        assert.ok(elicit, 'Should have interactive_elicitation state');
        const count = elicit.steps_completed.filter(s => s === 'project_discovery').length;
        assert.equal(count, 1, 'project_discovery should appear exactly once in steps_completed');
    });

    // -------------------------------------------------------------------------
    // 15. Selection detected via alternative pattern (e.g., "saving artifacts")
    // -------------------------------------------------------------------------
    it('detects save selection via "saving artifacts" pattern', async () => {
        const result = await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: { prompt: 'save now' },
            tool_result: 'Saving artifacts to disk...'
        });

        assert.equal(result.code, 0);

        const state = readState();
        const elicit = state.phases?.['01-requirements']?.iteration_requirements?.interactive_elicitation;
        assert.ok(elicit, 'Should have interactive_elicitation state');
        assert.equal(elicit.last_selection, 'save', 'Should detect save via "saving artifacts" pattern');
        assert.equal(elicit.completed, true, 'Save selection should mark completed');
    });

    // -------------------------------------------------------------------------
    // 16. Menu patterns in prompt (tool_input) are also checked
    // -------------------------------------------------------------------------
    it('detects menu patterns from tool_input.prompt as well as tool_result', async () => {
        const result = await runHook(hookPath, {
            tool_name: 'Task',
            tool_input: { prompt: '[A] Adjust the scope [C] Continue to validation' },
            tool_result: 'Some generic response'
        });

        assert.equal(result.code, 0);

        const state = readState();
        const elicit = state.phases?.['01-requirements']?.iteration_requirements?.interactive_elicitation;
        assert.ok(elicit, 'Should have interactive_elicitation state');
        assert.equal(elicit.menu_interactions, 1,
            'Should detect menu from combined tool_result + prompt text');
    });
});
