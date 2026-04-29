/**
 * Tests for review-depth-validator.cjs hook
 * Traces to: FR-006, AC-006-01 through AC-006-05
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const hookPath = path.join(__dirname, '..', 'review-depth-validator.cjs');
const {
    check,
    countUniqueFileReferences,
    hasGenericApproval,
    countFindings,
    ACTIVE_PHASES,
    MIN_FILE_REFERENCES
} = require(hookPath);

// =========================================================================
// Helpers
// =========================================================================

function makeState(phase) {
    return {
        active_workflow: {
            current_phase: phase,
            artifact_folder: 'REQ-GH-261-test'
        }
    };
}

function makeCtx(phase, agentOutput) {
    return {
        state: makeState(phase),
        agentOutput
    };
}

// =========================================================================
// File Reference Counting — AC-006-02
// =========================================================================

describe('review-depth-validator: file references', () => {
    // RDV-01
    it('allows review with 3+ file references', () => {
        const output = 'Reviewed src/auth.js, src/handler.cjs, and src/utils.ts for correctness.\n' +
            '- Issue: src/auth.js:42 missing null check\n' +
            '- Suggestion: src/handler.cjs could use validation\n' +
            '- Note: src/utils.ts looks good';
        const ctx = makeCtx('08-code-review', output);
        const result = check(ctx);
        assert.equal(result.decision, 'allow');
    });

    // RDV-02
    it('blocks review with fewer than 3 file references', () => {
        const output = 'LGTM, reviewed src/auth.js briefly.';
        const ctx = makeCtx('08-code-review', output);
        const result = check(ctx);
        assert.equal(result.decision, 'block');
    });

    // RDV-03
    it('counts unique file paths (no duplicates)', () => {
        const refs = countUniqueFileReferences('src/auth.js mentioned twice: src/auth.js again, and src/other.js');
        assert.equal(refs.length, 2);
    });

    // RDV-04
    it('recognizes various path formats', () => {
        const refs = countUniqueFileReferences('Found issues in src/foo.js, ./src/bar.ts, and lib/util.cjs');
        assert.ok(refs.length >= 3);
    });

    it('returns empty for null input', () => {
        const refs = countUniqueFileReferences(null);
        assert.deepEqual(refs, []);
    });
});

// =========================================================================
// Generic Approval Detection — AC-006-03
// =========================================================================

describe('review-depth-validator: generic approval', () => {
    // RDV-05
    it('flags "LGTM" with no file references', () => {
        const ctx = makeCtx('08-code-review', 'LGTM');
        const result = check(ctx);
        assert.equal(result.decision, 'block');
    });

    // RDV-06
    it('flags "looks good" with insufficient file references', () => {
        const ctx = makeCtx('08-code-review', 'Everything looks good to me.');
        const result = check(ctx);
        assert.equal(result.decision, 'block');
    });

    // RDV-07
    it('flags "no issues found" with no specifics', () => {
        const ctx = makeCtx('08-code-review', 'No issues found in this codebase.');
        const result = check(ctx);
        assert.equal(result.decision, 'block');
    });

    // RDV-08
    it('allows detailed review with findings', () => {
        const output = 'Review of the authentication module:\n' +
            '- Issue: src/auth.js:15 — missing input validation for email parameter\n' +
            '- Suggestion: src/handler.cjs:42 — consider using schema validation\n' +
            '- Note: src/utils.ts:8 — error handling looks correct\n' +
            '- Improvement: src/routes.js:22 — add rate limiting middleware';
        const ctx = makeCtx('08-code-review', output);
        const result = check(ctx);
        assert.equal(result.decision, 'allow');
    });

    it('hasGenericApproval detects approval patterns', () => {
        assert.ok(hasGenericApproval('LGTM'));
        assert.ok(hasGenericApproval('Looks good to me'));
        assert.ok(hasGenericApproval('Approved'));
        assert.ok(hasGenericApproval('Ship it'));
        assert.ok(!hasGenericApproval('Found 3 issues to fix'));
    });
});

// =========================================================================
// Finding Density — AC-006-03 extended
// =========================================================================

describe('review-depth-validator: finding density', () => {
    // RDV-09
    it('flags review of large output with zero findings', () => {
        const lines = [];
        for (let i = 0; i < 20; i++) {
            lines.push(`Line ${i}: reviewed this code section with great care.`);
        }
        const ctx = makeCtx('08-code-review', lines.join('\n'));
        const result = check(ctx);
        assert.equal(result.decision, 'block');
    });

    // RDV-10
    it('allows review proportional to diff size', () => {
        const output = '- Issue: src/auth.js:15 — missing validation\n' +
            '- Suggestion: src/handler.cjs:42 — improve error handling\n' +
            '- Concern: src/utils.ts:8 — potential null reference\n' +
            '- Recommendation: src/routes.js — add logging';
        const ctx = makeCtx('08-code-review', output);
        const result = check(ctx);
        assert.equal(result.decision, 'allow');
    });

    it('countFindings counts finding patterns', () => {
        const output = '- Issue: missing validation\n- Suggestion: add logging\n- Concern: null check needed';
        assert.ok(countFindings(output) >= 2);
    });

    it('countFindings returns 0 for no findings', () => {
        assert.equal(countFindings('This is just regular text without any findings.'), 0);
    });
});

// =========================================================================
// Block Message and 3f — AC-006-04, AC-006-05
// =========================================================================

describe('review-depth-validator: block message', () => {
    // RDV-11
    it('block message instructs re-review', () => {
        const ctx = makeCtx('08-code-review', 'LGTM');
        const result = check(ctx);
        assert.equal(result.decision, 'block');
        assert.ok(result.stopReason.includes('re-review') || result.stopReason.includes('Re-review'));
    });

    // RDV-12
    it('block message contains "REVIEW DEPTH INCOMPLETE"', () => {
        const ctx = makeCtx('08-code-review', 'LGTM');
        const result = check(ctx);
        assert.ok(result.stopReason.includes('REVIEW DEPTH INCOMPLETE'));
    });
});

// =========================================================================
// Fail-Open
// =========================================================================

describe('review-depth-validator: fail-open', () => {
    // RDV-13
    it('returns allow on null input', () => {
        const result = check(null);
        assert.equal(result.decision, 'allow');
    });

    // RDV-14
    it('returns allow on missing agentOutput', () => {
        const ctx = { state: makeState('08-code-review') };
        const result = check(ctx);
        assert.equal(result.decision, 'allow');
    });

    // RDV-15
    it('returns allow on non-phase-08', () => {
        const ctx = makeCtx('06-implementation', 'LGTM');
        const result = check(ctx);
        assert.equal(result.decision, 'allow');
    });

    it('returns allow on null state', () => {
        const result = check({ state: null });
        assert.equal(result.decision, 'allow');
    });
});

// =========================================================================
// Constants
// =========================================================================

describe('review-depth-validator: constants', () => {
    it('ACTIVE_PHASES includes 08-code-review', () => {
        assert.ok(ACTIVE_PHASES.includes('08-code-review'));
    });

    it('MIN_FILE_REFERENCES is 3', () => {
        assert.equal(MIN_FILE_REFERENCES, 3);
    });
});
