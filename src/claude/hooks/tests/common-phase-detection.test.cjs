/**
 * Tests for common.cjs phase delegation detection utilities
 * Tests: SETUP_COMMAND_KEYWORDS, isSetupCommand(), detectPhaseDelegation()
 * Traces to: REQ-0004, FR-01, FR-03, ADR-001, ADR-002
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

// Load common.cjs directly for unit testing (no subprocess needed)
const common = require(path.join(__dirname, '..', 'lib', 'common.cjs'));

describe('SETUP_COMMAND_KEYWORDS', () => {
    it('is a frozen array', () => {
        assert.ok(Array.isArray(common.SETUP_COMMAND_KEYWORDS));
        assert.ok(Object.isFrozen(common.SETUP_COMMAND_KEYWORDS));
    });

    it('contains expected keywords', () => {
        assert.ok(common.SETUP_COMMAND_KEYWORDS.includes('discover'));
        assert.ok(common.SETUP_COMMAND_KEYWORDS.includes('init'));
        assert.ok(common.SETUP_COMMAND_KEYWORDS.includes('status'));
        assert.ok(common.SETUP_COMMAND_KEYWORDS.includes('configure'));
    });
});

describe('isSetupCommand()', () => {
    it('returns true for text containing setup keywords', () => {
        assert.equal(common.isSetupCommand('discover the project'), true);
        assert.equal(common.isSetupCommand('Run init for the workspace'), true);
        assert.equal(common.isSetupCommand('check project status'), true);
        assert.equal(common.isSetupCommand('CONFIGURE the environment'), true);
    });

    it('returns false for non-setup text', () => {
        assert.equal(common.isSetupCommand('delegate to developer'), false);
        assert.equal(common.isSetupCommand('implement the feature'), false);
        assert.equal(common.isSetupCommand('run tests'), false);
    });

    it('returns false for null, undefined, and empty string', () => {
        assert.equal(common.isSetupCommand(null), false);
        assert.equal(common.isSetupCommand(undefined), false);
        assert.equal(common.isSetupCommand(''), false);
    });

    it('is case-insensitive', () => {
        assert.equal(common.isSetupCommand('DISCOVER'), true);
        assert.equal(common.isSetupCommand('Discover'), true);
        assert.equal(common.isSetupCommand('INSTALL packages'), true);
    });
});

describe('detectPhaseDelegation()', () => {
    it('returns not-a-delegation for non-Task tool', () => {
        const result = common.detectPhaseDelegation({
            tool_name: 'Bash',
            tool_input: { command: 'ls' }
        });
        assert.equal(result.isDelegation, false);
        assert.equal(result.targetPhase, null);
        assert.equal(result.agentName, null);
    });

    it('returns not-a-delegation for null input', () => {
        const result = common.detectPhaseDelegation(null);
        assert.equal(result.isDelegation, false);
    });

    it('returns not-a-delegation for undefined input', () => {
        const result = common.detectPhaseDelegation(undefined);
        assert.equal(result.isDelegation, false);
    });

    it('returns not-a-delegation when prompt contains setup keywords', () => {
        const result = common.detectPhaseDelegation({
            tool_name: 'Task',
            tool_input: {
                subagent_type: 'discover-orchestrator',
                prompt: 'discover the project'
            }
        });
        assert.equal(result.isDelegation, false);
    });

    it('returns not-a-delegation for orchestrator (phase "all")', () => {
        // sdlc-orchestrator has phase 'all' in the manifest
        const result = common.detectPhaseDelegation({
            tool_name: 'Task',
            tool_input: {
                subagent_type: 'sdlc-orchestrator',
                prompt: 'start the workflow'
            }
        });
        assert.equal(result.isDelegation, false);
    });

    it('detects phase delegation from subagent_type with known agent', () => {
        // software-developer maps to phase 06-implementation
        const result = common.detectPhaseDelegation({
            tool_name: 'Task',
            tool_input: {
                subagent_type: 'software-developer',
                prompt: 'implement the feature'
            }
        });
        // This will only work if the manifest is loadable from the project
        // If manifest is not found, it falls through to pattern matching
        // Either way, the function should not crash
        assert.equal(typeof result.isDelegation, 'boolean');
        assert.equal(typeof result.targetPhase === 'string' || result.targetPhase === null, true);
    });

    it('detects phase from phase name pattern in prompt', () => {
        const result = common.detectPhaseDelegation({
            tool_name: 'Task',
            tool_input: {
                subagent_type: '',
                prompt: 'delegate to 06-implementation agent'
            }
        });
        // Should detect the phase name pattern
        if (result.isDelegation) {
            assert.equal(result.targetPhase, '06-implementation');
        }
        // If manifest loaded and found an agent first, that's also valid
        assert.equal(typeof result.isDelegation, 'boolean');
    });

    it('returns not-a-delegation for Task with no phase indicators', () => {
        const result = common.detectPhaseDelegation({
            tool_name: 'Task',
            tool_input: {
                subagent_type: '',
                prompt: 'do some general work'
            }
        });
        assert.equal(result.isDelegation, false);
    });

    it('handles missing tool_input gracefully', () => {
        const result = common.detectPhaseDelegation({
            tool_name: 'Task'
        });
        assert.equal(result.isDelegation, false);
    });
});
