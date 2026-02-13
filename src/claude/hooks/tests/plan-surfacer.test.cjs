/**
 * Tests for plan-surfacer.cjs hook
 * Traces to: FR-02, AC-02, AC-02a-c, NFR-01
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const HOOK_PATH = path.join(__dirname, '..', 'plan-surfacer.cjs');

function setupTestEnv() {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-surfacer-test-'));
    const isdlcDir = path.join(tmpDir, '.isdlc');
    fs.mkdirSync(isdlcDir, { recursive: true });
    return tmpDir;
}

function writeState(tmpDir, state) {
    fs.writeFileSync(
        path.join(tmpDir, '.isdlc', 'state.json'),
        JSON.stringify(state, null, 2)
    );
}

function createTasksPlan(tmpDir) {
    const docsDir = path.join(tmpDir, 'docs', 'isdlc');
    fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(path.join(docsDir, 'tasks.md'), '# Task Plan\n\n## Phase 01');
}

function runHook(tmpDir, stdinJson) {
    const stdinStr = typeof stdinJson === 'string'
        ? stdinJson
        : JSON.stringify(stdinJson);
    try {
        const result = execSync(
            `echo '${stdinStr.replace(/'/g, "\\'")}' | node "${HOOK_PATH}" 2>/tmp/_plan_surfacer_stderr.txt`,
            {
                cwd: tmpDir,
                env: {
                    ...process.env,
                    CLAUDE_PROJECT_DIR: tmpDir,
                    SKILL_VALIDATOR_DEBUG: '0'
                },
                encoding: 'utf8',
                timeout: 5000
            }
        );
        let stderr = '';
        try { stderr = fs.readFileSync('/tmp/_plan_surfacer_stderr.txt', 'utf8').trim(); } catch (_) {}
        return { stdout: result.trim(), stderr, exitCode: 0 };
    } catch (e) {
        let stderr = (e.stderr || '').trim();
        try {
            const captured = fs.readFileSync('/tmp/_plan_surfacer_stderr.txt', 'utf8').trim();
            if (captured) stderr = captured;
        } catch (_) {}
        return {
            stdout: (e.stdout || '').trim(),
            stderr,
            exitCode: e.status || 1
        };
    }
}

function makeTaskStdin(subagentType, prompt) {
    return {
        tool_name: 'Task',
        tool_input: { subagent_type: subagentType, prompt: prompt || '' }
    };
}

describe('plan-surfacer hook', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = setupTestEnv();
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // T1: Blocks when impl phase and no tasks.md
    it('blocks when impl phase and no tasks.md', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '06-implementation' }
        });
        const result = runHook(tmpDir, makeTaskStdin('sdlc-orchestrator', 'delegate'));
        assert.equal(result.exitCode, 0);
        assert.ok(result.stdout.length > 0, 'Should produce block output');
        const parsed = JSON.parse(result.stdout);
        assert.equal(parsed.continue, false);
        assert.ok(parsed.stopReason.includes('TASK PLAN NOT GENERATED'));
    });

    // T2: Allows when impl phase and tasks.md exists
    it('allows when impl phase and tasks.md exists', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '06-implementation' }
        });
        createTasksPlan(tmpDir);
        const result = runHook(tmpDir, makeTaskStdin('sdlc-orchestrator', 'delegate'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T3: Allows early phase (01-requirements)
    it('allows early phase without tasks.md', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '01-requirements' }
        });
        const result = runHook(tmpDir, makeTaskStdin('sdlc-orchestrator', 'delegate'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T4: Allows early phase (04-design)
    it('allows early phase 04-design without tasks.md', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '04-design' }
        });
        const result = runHook(tmpDir, makeTaskStdin('sdlc-orchestrator', 'delegate'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T5: Allows non-Task tool calls
    it('allows non-Task tool calls', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '06-implementation' }
        });
        const result = runHook(tmpDir, {
            tool_name: 'Bash',
            tool_input: { command: 'ls' }
        });
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T6: Allows when no active_workflow
    it('allows when no active_workflow', () => {
        writeState(tmpDir, {});
        const result = runHook(tmpDir, makeTaskStdin('sdlc-orchestrator', 'delegate'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T7: Fail-open on missing state.json
    it('fail-open on missing state.json', () => {
        fs.rmSync(path.join(tmpDir, '.isdlc', 'state.json'), { force: true });
        const result = runHook(tmpDir, makeTaskStdin('sdlc-orchestrator', 'delegate'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
    });

    // T8: Fail-open on empty stdin
    it('fail-open on empty stdin', () => {
        const result = runHook(tmpDir, '');
        assert.equal(result.exitCode, 0);
    });

    // T9: Fail-open on invalid JSON
    it('fail-open on invalid JSON', () => {
        const result = runHook(tmpDir, 'not json');
        assert.equal(result.exitCode, 0);
    });

    // T10: Block message includes phase name and path
    it('block message includes phase name and path', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '07-qa' }
        });
        const result = runHook(tmpDir, makeTaskStdin('sdlc-orchestrator', 'delegate'));
        const parsed = JSON.parse(result.stdout);
        assert.ok(parsed.stopReason.includes('07-qa'));
        assert.ok(parsed.stopReason.includes('tasks.md'));
    });
});

// =========================================================================
// v2.0 Format Validation Tests (TC-PS-11 through TC-PS-17)
// Traces: FR-08, AC-08a, AC-08b, AC-08c, NFR-02
// =========================================================================

/**
 * Create a v2.0 format tasks.md with configurable annotations.
 * @param {string} tmpDir - Temp directory root
 * @param {object} [options] - Configuration options
 * @param {boolean} [options.includeFiles=true] - Include files: sub-lines
 * @param {boolean} [options.includeTraces=true] - Include | traces: annotations
 * @param {boolean} [options.withCycle=false] - Create circular dependency
 * @param {boolean} [options.withBlocked=false] - Include BLOCKED tasks
 * @param {boolean} [options.malformed=false] - Create malformed content
 */
function createV2TasksPlan(tmpDir, options = {}) {
    const {
        includeFiles = true,
        includeTraces = true,
        withCycle = false,
        withBlocked = false,
        malformed = false
    } = options;

    const docsDir = path.join(tmpDir, 'docs', 'isdlc');
    fs.mkdirSync(docsDir, { recursive: true });

    if (malformed) {
        // Write content that will trigger parse errors inside validation
        fs.writeFileSync(path.join(docsDir, 'tasks.md'),
            'Format: v2.0\n\n## Phase 06: Implementation -- PENDING\n\x00\x01\x02');
        return;
    }

    let content = '# Task Plan: feature test\n\n';
    content += 'Generated: 2026-02-11T10:00:00Z\n';
    content += 'Workflow: feature\n';
    content += 'Format: v2.0\n';
    content += 'Phases: 2\n\n';
    content += '---\n\n';
    content += '## Phase 01: Requirements Capture -- COMPLETE\n';
    content += '- [X] T0001 Capture requirements\n\n';
    content += '## Phase 06: Implementation -- PENDING\n';

    const traces = includeTraces ? ' | traces: FR-01, AC-01a' : '';
    const files = includeFiles ? '\n  files: src/foo/bar.js (MODIFY)' : '';

    if (withCycle) {
        content += `- [ ] T0010 Task A${traces}${files}\n`;
        content += '  blocked_by: [T0011]\n';
        content += `- [ ] T0011 Task B${traces}${files}\n`;
        content += '  blocked_by: [T0010]\n';
    } else if (withBlocked) {
        content += `- [BLOCKED] T0010 Blocked task${traces}${files}\n`;
        content += '  reason: Dependency T0009 failed\n';
        content += `- [ ] T0011 Normal task${traces}${files}\n`;
    } else {
        content += `- [ ] T0010 Implement feature A${traces}${files}\n`;
        content += `- [ ] T0011 Implement feature B${traces}${files}\n`;
        if (includeFiles) {
            content += '  blocked_by: [T0010]\n';
        }
    }

    content += '\n## Dependency Graph\n\n';
    content += '### Critical Path\nT0010 -> T0011\n\n';
    content += '## Traceability Matrix\n\n';
    content += '| Requirement | Tasks | Coverage |\n';
    content += '|-------------|-------|----------|\n';
    content += '| FR-01 | T0010, T0011 | 100% |\n\n';
    content += '## Progress Summary\n\n';
    content += '| Phase | Tasks | Complete |\n';
    content += '|-------|-------|----------|\n';
    content += '| 01 | 1 | 1 |\n';
    content += '| 06 | 2 | 0 |\n';

    fs.writeFileSync(path.join(docsDir, 'tasks.md'), content);
}

describe('plan-surfacer v2 format validation', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = setupTestEnv();
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // TC-PS-11: v2.0 format with file-level tasks -- no warnings
    it('TC-PS-11: v2.0 with file-level tasks emits no warnings', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '06-implementation' }
        });
        createV2TasksPlan(tmpDir, { includeFiles: true, includeTraces: true });
        const result = runHook(tmpDir, makeTaskStdin('sdlc-orchestrator', 'delegate'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'Should not block');
        // No stderr warnings for a well-formed v2.0 file
        assert.equal(result.stderr || '', '', 'Should have no stderr warnings');
    });

    // TC-PS-12: v2.0 format without file-level tasks -- warning
    it('TC-PS-12: v2.0 without file annotations emits warning', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '06-implementation' }
        });
        createV2TasksPlan(tmpDir, { includeFiles: false, includeTraces: true });
        const result = runHook(tmpDir, makeTaskStdin('sdlc-orchestrator', 'delegate'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'Should NOT block (warning only)');
        // Should emit stderr warning about missing file annotations
        assert.ok(
            (result.stderr || '').includes('file-level annotations') ||
            (result.stderr || '').includes('files:') ||
            (result.stderr || '').includes('Format warnings'),
            'Should warn about missing file annotations in stderr'
        );
    });

    // TC-PS-13: v2.0 format without traceability -- warning
    it('TC-PS-13: v2.0 without traceability annotations emits warning', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '06-implementation' }
        });
        createV2TasksPlan(tmpDir, { includeFiles: true, includeTraces: false });
        const result = runHook(tmpDir, makeTaskStdin('sdlc-orchestrator', 'delegate'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'Should NOT block');
        // Should emit stderr warning about missing traceability
        assert.ok(
            (result.stderr || '').includes('traceability') ||
            (result.stderr || '').includes('traces') ||
            (result.stderr || '').includes('Format warnings'),
            'Should warn about missing traceability in stderr'
        );
    });

    // TC-PS-14: v1.0 format (no Format header) -- no validation (backward compat)
    it('TC-PS-14: v1.0 format skips validation entirely', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '06-implementation' }
        });
        // Use existing createTasksPlan which creates a v1.0 file (no Format: v2.0 header)
        createTasksPlan(tmpDir);
        const result = runHook(tmpDir, makeTaskStdin('sdlc-orchestrator', 'delegate'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'Should not block');
        assert.equal(result.stderr || '', '', 'Should have no warnings for v1.0 format');
    });

    // TC-PS-15: Dependency cycle detected -- warning
    it('TC-PS-15: detects dependency cycle and emits warning', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '06-implementation' }
        });
        createV2TasksPlan(tmpDir, { withCycle: true });
        const result = runHook(tmpDir, makeTaskStdin('sdlc-orchestrator', 'delegate'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'Should NOT block (warning only)');
        // Should emit stderr warning about cycle
        assert.ok(
            (result.stderr || '').includes('cycle') ||
            (result.stderr || '').includes('Cycle') ||
            (result.stderr || '').includes('circular'),
            'Should warn about dependency cycle in stderr'
        );
    });

    // TC-PS-16: Validation during non-implementation phase -- skipped
    it('TC-PS-16: skips format validation for non-implementation phase', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '07-testing' }
        });
        // v2.0 file exists but phase is not 06-implementation
        createV2TasksPlan(tmpDir, { includeFiles: false, includeTraces: false });
        const result = runHook(tmpDir, makeTaskStdin('sdlc-orchestrator', 'delegate'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'Should not block');
        assert.equal(result.stderr || '', '', 'Should have no warnings for non-impl phase');
    });

    // TC-PS-17: Malformed content -- fail-open, no warnings
    it('TC-PS-17: fail-open on malformed tasks.md content', () => {
        writeState(tmpDir, {
            active_workflow: { current_phase: '06-implementation' }
        });
        createV2TasksPlan(tmpDir, { malformed: true });
        const result = runHook(tmpDir, makeTaskStdin('sdlc-orchestrator', 'delegate'));
        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'Should not block');
        // Fail-open: errors caught, no warnings emitted
        // The validation should catch the error and return no warnings
    });
});
