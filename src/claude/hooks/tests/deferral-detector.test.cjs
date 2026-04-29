/**
 * Tests for deferral-detector.cjs hook
 * Traces to: FR-002, AC-002-01 through AC-002-06
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const hookPath = path.join(__dirname, '..', 'deferral-detector.cjs');
const { check, isExemptPath, formatBlockMessage, EXEMPT_MARKER } = require(hookPath);

// Helper to create Write context
function makeWriteCtx(filePath, content) {
    return {
        input: {
            tool_name: 'Write',
            tool_input: { file_path: filePath, content }
        }
    };
}

// Helper to create Edit context
function makeEditCtx(filePath, newString) {
    return {
        input: {
            tool_name: 'Edit',
            tool_input: { file_path: filePath, new_string: newString }
        }
    };
}

// =========================================================================
// Pattern Matching — AC-002-01, AC-002-02
// =========================================================================

describe('deferral-detector: pattern matching', () => {
    // DD-01
    it('blocks Write with "TODO later" in content', () => {
        const ctx = makeWriteCtx('/src/app.js', '// TODO later: add rate limiting');
        const result = check(ctx);
        assert.equal(result.decision, 'block');
    });

    // DD-02
    it('blocks Edit with "FIXME next iteration" in new_string', () => {
        const ctx = makeEditCtx('/src/app.js', '// FIXME next iteration');
        const result = check(ctx);
        assert.equal(result.decision, 'block');
    });

    // DD-03
    it('blocks "will handle later" in production code', () => {
        const ctx = makeWriteCtx('/src/handler.js', '// will handle later');
        const result = check(ctx);
        assert.equal(result.decision, 'block');
    });

    // DD-04
    it('blocks "add later" pattern', () => {
        const ctx = makeWriteCtx('/src/module.js', '// add later');
        const result = check(ctx);
        assert.equal(result.decision, 'block');
    });

    // DD-05
    it('blocks "implement later" pattern', () => {
        const ctx = makeWriteCtx('/src/feature.js', '// implement later');
        const result = check(ctx);
        assert.equal(result.decision, 'block');
    });

    // DD-06
    it('blocks "future work" pattern', () => {
        const ctx = makeWriteCtx('/src/main.js', '// future work: refactor this');
        const result = check(ctx);
        assert.equal(result.decision, 'block');
    });

    // DD-07
    it('allows bare "TODO:" without "later"', () => {
        const ctx = makeWriteCtx('/src/app.js', '// TODO: implement validation');
        const result = check(ctx);
        assert.equal(result.decision, 'allow');
    });

    // DD-08
    it('allows bare "FIXME:" without "next"', () => {
        const ctx = makeWriteCtx('/src/app.js', '// FIXME: broken regex');
        const result = check(ctx);
        assert.equal(result.decision, 'allow');
    });

    // DD-09
    it('allows clean production code', () => {
        const ctx = makeWriteCtx('/src/app.js', 'const x = 1;\nfunction doWork() { return x; }');
        const result = check(ctx);
        assert.equal(result.decision, 'allow');
    });

    // DD-10
    it('case insensitive deferral detection', () => {
        const ctx = makeWriteCtx('/src/app.js', '// todo LATER');
        const result = check(ctx);
        assert.equal(result.decision, 'block');
    });
});

// =========================================================================
// Exemptions — AC-002-03
// =========================================================================

describe('deferral-detector: exemptions', () => {
    // DD-11
    it('allows deferral in test file (tests/ path)', () => {
        const ctx = makeWriteCtx('/project/tests/unit/app.test.js', '// TODO later: add test');
        const result = check(ctx);
        assert.equal(result.decision, 'allow');
    });

    // DD-12
    it('allows deferral in ADR document', () => {
        const ctx = makeWriteCtx('/docs/ADRs/adr-001.md', '// TODO later');
        const result = check(ctx);
        assert.equal(result.decision, 'allow');
    });

    // DD-13
    it('allows deferral with deferral-exempt marker', () => {
        const ctx = makeWriteCtx('/src/app.js', '// deferral-exempt\n// TODO later: intentional');
        const result = check(ctx);
        assert.equal(result.decision, 'allow');
    });

    // DD-14
    it('allows deferral in BACKLOG.md', () => {
        const ctx = makeWriteCtx('/BACKLOG.md', '// TODO later');
        const result = check(ctx);
        assert.equal(result.decision, 'allow');
    });

    // DD-15
    it('allows deferral in tasks.md', () => {
        const ctx = makeWriteCtx('/docs/isdlc/tasks.md', '// TODO later');
        const result = check(ctx);
        assert.equal(result.decision, 'allow');
    });

    // DD-16
    it('blocks deferral in src/ path (not exempt)', () => {
        const ctx = makeWriteCtx('/src/service.cjs', '// TODO later: implement');
        const result = check(ctx);
        assert.equal(result.decision, 'block');
    });

    it('allows deferral in .test.cjs file', () => {
        const ctx = makeWriteCtx('/src/hooks/tests/hook.test.cjs', '// TODO later');
        const result = check(ctx);
        assert.equal(result.decision, 'allow');
    });
});

// =========================================================================
// Block Message Quality — AC-002-04
// =========================================================================

describe('deferral-detector: block message quality', () => {
    // DD-17
    it('block message includes line numbers', () => {
        const ctx = makeWriteCtx('/src/app.js', '// TODO later: add feature');
        const result = check(ctx);
        assert.equal(result.decision, 'block');
        assert.ok(result.stopReason.includes('Line'), 'Should include line reference');
    });

    // DD-18
    it('block message includes deferral text', () => {
        const ctx = makeWriteCtx('/src/app.js', '// TODO later: add rate limiting');
        const result = check(ctx);
        assert.ok(result.stopReason.includes('TODO later'), 'Should include the matched pattern');
    });

    // DD-19
    it('block message includes remediation options', () => {
        const ctx = makeWriteCtx('/src/app.js', '// TODO later: add feature');
        const result = check(ctx);
        assert.ok(result.stopReason.includes('ADR') || result.stopReason.includes('out-of-scope') || result.stopReason.includes('Implement'));
    });
});

// =========================================================================
// Fail-Open Behavior
// =========================================================================

describe('deferral-detector: fail-open', () => {
    // DD-20
    it('returns allow on null input', () => {
        const result = check(null);
        assert.equal(result.decision, 'allow');
    });

    // DD-21
    it('returns allow on non-Write/Edit tool', () => {
        const ctx = { input: { tool_name: 'Read', tool_input: { file_path: '/src/x.js' } } };
        const result = check(ctx);
        assert.equal(result.decision, 'allow');
    });

    // DD-22
    it('returns allow on malformed input', () => {
        const ctx = { input: { tool_name: 'Write' } };
        const result = check(ctx);
        assert.equal(result.decision, 'allow');
    });

    it('returns allow on empty content', () => {
        const ctx = makeWriteCtx('/src/app.js', '');
        const result = check(ctx);
        assert.equal(result.decision, 'allow');
    });
});

// =========================================================================
// Performance — NFR
// =========================================================================

describe('deferral-detector: performance', () => {
    // DD-23
    it('processes 1000-line file in under 50ms', () => {
        const lines = [];
        for (let i = 0; i < 1000; i++) {
            lines.push(`const variable${i} = ${i}; // line ${i}`);
        }
        lines[500] = '// TODO later: something deferred';
        const content = lines.join('\n');
        const ctx = makeWriteCtx('/src/large.js', content);

        const start = performance.now();
        const result = check(ctx);
        const elapsed = performance.now() - start;

        assert.equal(result.decision, 'block');
        assert.ok(elapsed < 50, `Should complete in <50ms, took ${elapsed.toFixed(2)}ms`);
    });
});

// =========================================================================
// No Retry Counter — AC-002-06
// =========================================================================

describe('deferral-detector: no retry counter', () => {
    // DD-24
    it('does not mutate state', () => {
        const ctx = makeWriteCtx('/src/app.js', '// TODO later');
        const result = check(ctx);
        assert.equal(result.stateModified, false);
    });

    // DD-25
    it('does not read iteration state', () => {
        const ctx = makeWriteCtx('/src/app.js', 'clean code');
        // No state property needed
        const result = check(ctx);
        assert.equal(result.decision, 'allow');
    });
});

// =========================================================================
// isExemptPath unit tests
// =========================================================================

describe('isExemptPath', () => {
    it('returns false for null', () => {
        assert.equal(isExemptPath(null), false);
    });

    it('detects test directories', () => {
        assert.equal(isExemptPath('/project/tests/unit/app.js'), true);
        assert.equal(isExemptPath('/project/__tests__/app.js'), true);
    });

    it('detects requirements docs', () => {
        assert.equal(isExemptPath('/docs/requirements/REQ-001/spec.md'), true);
    });

    it('does not exempt src files', () => {
        assert.equal(isExemptPath('/src/app.js'), false);
    });
});
