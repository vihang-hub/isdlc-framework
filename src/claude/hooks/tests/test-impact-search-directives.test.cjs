'use strict';

/**
 * Impact Analysis Search Directives Tests (CJS)
 * ===============================================
 * BUG-0030-GH-24: Validates that impact analysis sub-agent prompts contain
 * explicit independent search directives using Glob/Grep tools, and that
 * M4 has an independent completeness verification step.
 *
 * These tests read the REAL agent prompt files from
 * src/claude/agents/impact-analysis/ to validate that the required
 * instructional content exists.
 *
 * Run: node --test src/claude/hooks/tests/test-impact-search-directives.test.cjs
 *
 * Requirements: FR-001, FR-002
 * Acceptance Criteria: AC-001 through AC-005
 *
 * TDD: These tests are designed to FAIL against the unfixed files.
 *      Phase 06 (Implementation) modifies the .md files to make them pass.
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Paths -- read source agent prompt files directly
// ---------------------------------------------------------------------------
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const AGENTS_DIR = path.join(PROJECT_ROOT, 'src', 'claude', 'agents', 'impact-analysis');

const M1_PATH = path.join(AGENTS_DIR, 'impact-analyzer.md');
const M2_PATH = path.join(AGENTS_DIR, 'entry-point-finder.md');
const M3_PATH = path.join(AGENTS_DIR, 'risk-assessor.md');
const M4_PATH = path.join(AGENTS_DIR, 'cross-validation-verifier.md');

// ---------------------------------------------------------------------------
// File content -- loaded once per suite
// ---------------------------------------------------------------------------
let m1Content, m2Content, m3Content, m4Content;

before(() => {
    m1Content = fs.readFileSync(M1_PATH, 'utf8');
    m2Content = fs.readFileSync(M2_PATH, 'utf8');
    m3Content = fs.readFileSync(M3_PATH, 'utf8');
    m4Content = fs.readFileSync(M4_PATH, 'utf8');
});

// ===========================================================================
// Section 1: M1 Impact Analyzer -- Independent Search Directive (AC-001)
// ===========================================================================
describe('Section 1: M1 Impact Analyzer -- search directives (BUG-0030)', () => {

    // TC-01: FR-001, AC-001 | positive | P0
    it('TC-01: M1 prompt contains independent search instruction', () => {
        // The prompt must instruct M1 to perform independent search using Glob/Grep
        assert.match(m1Content, /MUST\s+perform\s+independent/i,
            'M1 prompt must contain "MUST perform independent" search instruction');
    });

    // TC-02: FR-001, AC-001 | positive | P0
    it('TC-02: M1 prompt references Glob tool explicitly', () => {
        // Must reference "Glob" (capital G, the tool name) in the search context
        assert.match(m1Content, /Glob/,
            'M1 prompt must reference the Glob tool by name');
    });

    // TC-03: FR-001, AC-001 | positive | P0
    it('TC-03: M1 prompt references Grep tool explicitly', () => {
        // Must reference "Grep" (capital G, the tool name) in the search context
        assert.match(m1Content, /Grep/,
            'M1 prompt must reference the Grep tool by name');
    });

    // TC-04: AC-005 | positive | P1
    it('TC-04: M1 prompt labels quick scan as supplementary', () => {
        assert.match(m1Content, /supplementary/i,
            'M1 prompt must label quick scan output as supplementary');
    });
});

// ===========================================================================
// Section 2: M2 Entry Point Finder -- Independent Search Directive (AC-002)
// ===========================================================================
describe('Section 2: M2 Entry Point Finder -- search directives (BUG-0030)', () => {

    // TC-05: FR-001, AC-002 | positive | P0
    it('TC-05: M2 prompt contains independent search instruction', () => {
        assert.match(m2Content, /MUST\s+perform\s+independent/i,
            'M2 prompt must contain "MUST perform independent" search instruction');
    });

    // TC-06: FR-001, AC-002 | positive | P0
    it('TC-06: M2 prompt references Glob tool explicitly', () => {
        assert.match(m2Content, /Glob/,
            'M2 prompt must reference the Glob tool by name');
    });

    // TC-07: FR-001, AC-002 | positive | P0
    it('TC-07: M2 prompt references Grep tool explicitly', () => {
        assert.match(m2Content, /Grep/,
            'M2 prompt must reference the Grep tool by name');
    });

    // TC-08: AC-005 | positive | P1
    it('TC-08: M2 prompt labels quick scan as supplementary', () => {
        assert.match(m2Content, /supplementary/i,
            'M2 prompt must label quick scan output as supplementary');
    });
});

// ===========================================================================
// Section 3: M3 Risk Assessor -- Independent Search Directive (AC-003)
// ===========================================================================
describe('Section 3: M3 Risk Assessor -- search directives (BUG-0030)', () => {

    // TC-09: FR-001, AC-003 | positive | P0
    it('TC-09: M3 prompt contains independent search instruction', () => {
        assert.match(m3Content, /MUST\s+perform\s+independent/i,
            'M3 prompt must contain "MUST perform independent" search instruction');
    });

    // TC-10: FR-001, AC-003 | positive | P0
    it('TC-10: M3 prompt references Glob tool explicitly', () => {
        assert.match(m3Content, /Glob/,
            'M3 prompt must reference the Glob tool by name');
    });

    // TC-11: FR-001, AC-003 | positive | P0
    it('TC-11: M3 prompt references Grep tool explicitly', () => {
        assert.match(m3Content, /Grep/,
            'M3 prompt must reference the Grep tool by name');
    });

    // TC-12: AC-005 | positive | P1
    it('TC-12: M3 prompt labels quick scan as supplementary', () => {
        assert.match(m3Content, /supplementary/i,
            'M3 prompt must label quick scan output as supplementary');
    });
});

// ===========================================================================
// Section 4: M4 Cross-Validation Verifier -- Completeness Verification (AC-004)
// ===========================================================================
describe('Section 4: M4 Cross-Validation Verifier -- completeness verification (BUG-0030)', () => {

    // TC-13: FR-002, AC-004 | positive | P0
    it('TC-13: M4 prompt contains independent completeness verification step', () => {
        // M4 must have instructions to independently verify file list completeness
        assert.match(m4Content, /independen(t|tly)/i,
            'M4 prompt must contain "independent" or "independently" for completeness verification');
    });

    // TC-14: FR-002, AC-004 | positive | P0
    it('TC-14: M4 prompt references Glob or Grep for independent search', () => {
        // M4 must reference at least one search tool for independent verification
        assert.match(m4Content, /(?:Glob|Grep)/,
            'M4 prompt must reference Glob or Grep tools for independent codebase search');
    });

    // TC-15: FR-002, AC-004 | positive | P1
    it('TC-15: M4 prompt defines completeness_gap finding category', () => {
        assert.match(m4Content, /completeness_gap/,
            'M4 prompt must define completeness_gap as a finding category');
    });
});

// ===========================================================================
// Section 5: Negative / Guard Tests
// ===========================================================================
describe('Section 5: Negative and guard tests (BUG-0030)', () => {

    // TC-16: AC-005 (inverse) | negative | P1
    it('TC-16: no agent prompt treats quick scan as authoritative without negation', () => {
        // Guard test: if "authoritative" appears, it must be in a negating context
        const agents = [
            { name: 'M1', content: m1Content },
            { name: 'M2', content: m2Content },
            { name: 'M3', content: m3Content },
            { name: 'M4', content: m4Content },
        ];

        for (const agent of agents) {
            // If "authoritative" appears, check it is preceded by "NOT" or "not"
            const matches = agent.content.match(/authoritative/gi);
            if (matches) {
                // Every occurrence must be in a negating context
                const lines = agent.content.split('\n');
                for (const line of lines) {
                    if (/authoritative/i.test(line)) {
                        assert.match(line, /not\s+authoritative/i,
                            `${agent.name}: "authoritative" must appear with "NOT" (found: "${line.trim()}")`);
                    }
                }
            }
            // If "authoritative" does not appear at all, that is also acceptable
        }
    });

    // TC-17: FR-002, AC-004 (inverse) | negative | P1
    it('TC-17: M4 prompt contains at least one step for independent codebase action', () => {
        // M4 must not ONLY cross-reference agent outputs -- it must also search independently
        assert.match(m4Content, /independen(t|tly)/i,
            'M4 prompt must contain instructions for independent action beyond cross-referencing');
    });
});
