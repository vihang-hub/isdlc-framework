/**
 * Tests that constitution.md contains the strengthened article language (GH-261).
 * Traces to: FR-001, AC-001-01 through AC-001-05
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// Read the constitution from the project root
const projectRoot = path.resolve(__dirname, '..', '..', '..', '..');
const constitutionPath = path.join(projectRoot, 'docs', 'isdlc', 'constitution.md');
let constitution = '';
try {
    constitution = fs.readFileSync(constitutionPath, 'utf8');
} catch (e) {
    // Will fail tests below if not found
}

describe('constitution quality articles (GH-261)', () => {
    // CON-01 — AC-001-01
    it('Article I contains "Every modified file MUST trace to at least one AC"', () => {
        assert.ok(constitution.includes('Every modified file MUST trace to at least one AC'),
            'Article I should contain untraced modification language');
    });

    // CON-02 — AC-001-01
    it('Article I contains "Untraced modifications are blocked"', () => {
        assert.ok(constitution.includes('Untraced modifications are blocked'),
            'Article I should mention blocking untraced modifications');
    });

    // CON-03 — AC-001-02
    it('Article II contains "Each AC MUST have at least one test"', () => {
        assert.ok(constitution.includes('Each AC MUST have at least one test'),
            'Article II should require AC test coverage');
    });

    // CON-04 — AC-001-02
    it('Article II contains "Tests MUST contain at least one assertion per test block"', () => {
        assert.ok(constitution.includes('Tests MUST contain at least one assertion per test block'),
            'Article II should require assertions per test block');
    });

    // CON-05 — AC-001-02
    it('Article II contains "Error paths...MUST have corresponding negative tests"', () => {
        assert.ok(constitution.includes('MUST have corresponding negative tests'),
            'Article II should require negative tests for error paths');
    });

    // CON-06 — AC-001-03
    it('Article III contains "Functions processing external input MUST have input validation"', () => {
        assert.ok(constitution.includes('Functions processing external input MUST have input validation'),
            'Article III should require input validation');
    });

    // CON-07 — AC-001-03
    it('Article III contains "reference specific code locations"', () => {
        assert.ok(constitution.includes('reference specific code locations'),
            'Article III should require specific code location references');
    });

    // CON-08 — AC-001-04
    it('Article IV contains "Deferral language...blocked at write time"', () => {
        assert.ok(constitution.includes('blocked at write time'),
            'Article IV should block deferral language at write time');
    });

    // CON-09 — AC-001-05
    it('Article VI contains "Review output MUST reference specific files"', () => {
        assert.ok(constitution.includes('Review output MUST reference specific files'),
            'Article VI should require file references in review output');
    });

    // CON-10 — AC-001-05
    it('Article VI contains "Generic approval without file references is blocked"', () => {
        assert.ok(constitution.includes('Generic approval without file references is blocked'),
            'Article VI should block generic approval');
    });
});
