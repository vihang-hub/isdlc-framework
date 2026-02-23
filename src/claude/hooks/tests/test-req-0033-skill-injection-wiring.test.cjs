/**
 * RED-state tests for REQ-0033: Wire Skill Index Block Injection & Unify Skill Injection
 *
 * These tests validate the STEP 3d rewrite in src/claude/commands/isdlc.md.
 * They scan the specification file with regex to verify that:
 *   - Imperative SKILL INJECTION STEP A/B/C instructions replace curly-brace blocks
 *   - getAgentSkillIndex() and formatSkillIndexBlock() are referenced as executable instructions
 *   - External skills manifest path and delivery types are specified
 *   - Fail-open semantics are encoded at every step
 *   - Monorepo path resolution is addressed
 *   - Unchanged blocks (GATE REQUIREMENTS, BUDGET DEGRADATION) remain intact
 *
 * Traces to: FR-001 through FR-006, AC-001 through AC-006, NFR-001 through NFR-006
 *
 * Test runner: node:test (Article II)
 * Module: CJS (hooks convention)
 * TDD state: RED -- tests FAIL until Phase 06 implements the spec rewrite
 *
 * Pattern: Spec-validation (same as BUG-0032, BUG-0033, BUG-0034)
 *   - File reads are cached per test suite run
 *   - No MCP calls, no network, no mocking, no temp directories
 *   - Deterministic string matching on static source files
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// =============================================================================
// Constants and Cached File Reads
// =============================================================================

const PROJECT_ROOT = path.join(__dirname, '..', '..', '..', '..');
const ISDLC_MD_PATH = path.join(PROJECT_ROOT, 'src', 'claude', 'commands', 'isdlc.md');
const SKILL_INJECTION_TEST_PATH = path.join(PROJECT_ROOT, 'src', 'claude', 'hooks', 'tests', 'skill-injection.test.cjs');

/** Cached file contents -- read once, reuse across all tests */
let isdlcContent = null;
let skillTestContent = null;

function getIsdlcContent() {
    if (isdlcContent === null) {
        isdlcContent = fs.readFileSync(ISDLC_MD_PATH, 'utf8');
    }
    return isdlcContent;
}

function getSkillTestContent() {
    if (skillTestContent === null) {
        skillTestContent = fs.readFileSync(SKILL_INJECTION_TEST_PATH, 'utf8');
    }
    return skillTestContent;
}

// =============================================================================
// TC-R33-01: SKILL INJECTION STEP A — Built-In Skill Index Wiring
// Traces to: FR-001, AC-001-01, AC-001-02, AC-001-03, FR-004, AC-004-01, AC-004-04
// =============================================================================

describe('TC-R33-01: STEP A — Built-in skill index instructions present [FR-001]', () => {

    it('[P0] TC-R33-01.1: isdlc.md contains SKILL INJECTION STEP A header', () => {
        const content = getIsdlcContent();
        assert.ok(
            content.includes('SKILL INJECTION STEP A'),
            'isdlc.md must contain "SKILL INJECTION STEP A" header for built-in skill index injection'
        );
    });

    it('[P0] TC-R33-01.2: STEP A references getAgentSkillIndex function', () => {
        const content = getIsdlcContent();
        assert.ok(
            content.includes('getAgentSkillIndex'),
            'STEP A instructions must reference getAgentSkillIndex() function call'
        );
    });

    it('[P0] TC-R33-01.3: STEP A references formatSkillIndexBlock function', () => {
        const content = getIsdlcContent();
        assert.ok(
            content.includes('formatSkillIndexBlock'),
            'STEP A instructions must reference formatSkillIndexBlock() function call'
        );
    });

    it('[P0] TC-R33-01.4: STEP A contains node -e Bash command for skill lookup', () => {
        const content = getIsdlcContent();
        // The design specifies a single-line node -e command (CON-004)
        assert.ok(
            content.includes('node -e') && content.includes('getAgentSkillIndex'),
            'STEP A must contain a node -e Bash command that invokes getAgentSkillIndex (AC-004-04)'
        );
    });
});

// =============================================================================
// TC-R33-02: SKILL INJECTION STEP B — External Skill Injection Wiring
// Traces to: FR-002, AC-002-01 through AC-002-07
// =============================================================================

describe('TC-R33-02: STEP B — External skill injection instructions present [FR-002]', () => {

    it('[P0] TC-R33-02.1: isdlc.md contains SKILL INJECTION STEP B header', () => {
        const content = getIsdlcContent();
        assert.ok(
            content.includes('SKILL INJECTION STEP B'),
            'isdlc.md must contain "SKILL INJECTION STEP B" header for external skill injection'
        );
    });

    it('[P0] TC-R33-02.2: STEP B references external-skills-manifest.json', () => {
        const content = getIsdlcContent();
        // The STEP B instructions must tell the LLM to read the external manifest
        const stepBStart = content.indexOf('SKILL INJECTION STEP B');
        assert.ok(stepBStart > -1, 'STEP B header must exist');

        const stepBSection = content.substring(stepBStart, stepBStart + 3000);
        assert.ok(
            stepBSection.includes('external-skills-manifest.json'),
            'STEP B must reference external-skills-manifest.json path (AC-002-01)'
        );
    });

    it('[P1] TC-R33-02.3: STEP B specifies delivery type formatting rules', () => {
        const content = getIsdlcContent();
        const stepBStart = content.indexOf('SKILL INJECTION STEP B');
        assert.ok(stepBStart > -1, 'STEP B header must exist');

        const stepBSection = content.substring(stepBStart, stepBStart + 3000);
        // Must reference all three delivery types per AC-002-05, AC-002-06, AC-002-07
        assert.ok(
            stepBSection.includes('context') &&
            stepBSection.includes('instruction') &&
            stepBSection.includes('reference'),
            'STEP B must specify context, instruction, and reference delivery types'
        );
    });

    it('[P1] TC-R33-02.4: STEP B specifies 10000-char truncation rule', () => {
        const content = getIsdlcContent();
        const stepBStart = content.indexOf('SKILL INJECTION STEP B');
        assert.ok(stepBStart > -1, 'STEP B header must exist');

        const stepBSection = content.substring(stepBStart, stepBStart + 3000);
        assert.ok(
            stepBSection.includes('10000') || stepBSection.includes('10,000'),
            'STEP B must specify 10000-char truncation threshold (AC-002-04, NFR-006)'
        );
    });
});

// =============================================================================
// TC-R33-03: SKILL INJECTION STEP C — Unified Assembly Instructions
// Traces to: FR-003, AC-003-01 through AC-003-05
// =============================================================================

describe('TC-R33-03: STEP C — Unified assembly instructions present [FR-003]', () => {

    it('[P0] TC-R33-03.1: isdlc.md contains SKILL INJECTION STEP C header', () => {
        const content = getIsdlcContent();
        assert.ok(
            content.includes('SKILL INJECTION STEP C'),
            'isdlc.md must contain "SKILL INJECTION STEP C" header for prompt assembly'
        );
    });

    it('[P0] TC-R33-03.2: STEP C references built_in_skills_block variable', () => {
        const content = getIsdlcContent();
        const stepCStart = content.indexOf('SKILL INJECTION STEP C');
        assert.ok(stepCStart > -1, 'STEP C header must exist');

        const stepCSection = content.substring(stepCStart, stepCStart + 1500);
        assert.ok(
            stepCSection.includes('built_in_skills_block'),
            'STEP C must reference built_in_skills_block variable for assembly (AC-003-02)'
        );
    });

    it('[P0] TC-R33-03.3: STEP C references external_skills_blocks variable', () => {
        const content = getIsdlcContent();
        const stepCStart = content.indexOf('SKILL INJECTION STEP C');
        assert.ok(stepCStart > -1, 'STEP C header must exist');

        const stepCSection = content.substring(stepCStart, stepCStart + 1500);
        assert.ok(
            stepCSection.includes('external_skills_blocks'),
            'STEP C must reference external_skills_blocks variable for assembly (AC-003-02)'
        );
    });
});

// =============================================================================
// TC-R33-04: Curly-Brace Block Replacement — Imperative Format
// Traces to: FR-004, AC-004-01, AC-004-02, AC-004-03
// =============================================================================

describe('TC-R33-04: Curly-brace blocks replaced with imperative instructions [FR-004]', () => {

    it('[P0] TC-R33-04.1: SKILL INJECTION STEP A appears as imperative instruction before template', () => {
        const content = getIsdlcContent();
        // STEP A must appear BEFORE the template literal that starts with "Use Task tool"
        const stepAPos = content.indexOf('SKILL INJECTION STEP A');
        const templatePos = content.indexOf('Use Task tool');

        assert.ok(stepAPos > -1, 'SKILL INJECTION STEP A must exist');
        assert.ok(templatePos > -1, 'Use Task tool template must exist');
        assert.ok(
            stepAPos < templatePos,
            'SKILL INJECTION STEP A must appear BEFORE the "Use Task tool" template literal (AC-004-01). ' +
            `STEP A at position ${stepAPos}, template at position ${templatePos}`
        );
    });

    it('[P0] TC-R33-04.2: SKILL INJECTION STEP B appears as imperative instruction before template', () => {
        const content = getIsdlcContent();
        const stepBPos = content.indexOf('SKILL INJECTION STEP B');
        const templatePos = content.indexOf('Use Task tool');

        assert.ok(stepBPos > -1, 'SKILL INJECTION STEP B must exist');
        assert.ok(templatePos > -1, 'Use Task tool template must exist');
        assert.ok(
            stepBPos < templatePos,
            'SKILL INJECTION STEP B must appear BEFORE the "Use Task tool" template literal (AC-004-02). ' +
            `STEP B at position ${stepBPos}, template at position ${templatePos}`
        );
    });

    it('[P0] TC-R33-04.3: Template contains short reference placeholders instead of long curly-brace blocks', () => {
        const content = getIsdlcContent();
        // After implementation, the template should have short references like:
        //   {built_in_skills_block -- from SKILL INJECTION STEP A above, omit if empty}
        // NOT the old 21-line curly-brace EXTERNAL SKILL INJECTION block

        // The old curly-brace block contains this unique multi-line pattern:
        // "EXTERNAL SKILL INJECTION (REQ-0022)" followed by numbered steps inside braces
        const oldBlockPattern = '{EXTERNAL SKILL INJECTION (REQ-0022)';
        const hasOldBlock = content.includes(oldBlockPattern);

        // The new reference should exist
        const hasNewBuiltInRef = content.includes('built_in_skills_block');
        const hasNewExternalRef = content.includes('external_skills_blocks');

        assert.ok(
            !hasOldBlock && hasNewBuiltInRef && hasNewExternalRef,
            'Template must replace old curly-brace EXTERNAL SKILL INJECTION block with short references. ' +
            `Old block present: ${hasOldBlock}, built_in ref: ${hasNewBuiltInRef}, external ref: ${hasNewExternalRef}`
        );
    });
});

// =============================================================================
// TC-R33-05: Ordering and Position Verification
// Traces to: FR-003 (AC-003-02), FR-004
// =============================================================================

describe('TC-R33-05: Injection step ordering and positioning [FR-003, FR-004]', () => {

    it('[P0] TC-R33-05.1: STEP A appears before STEP B', () => {
        const content = getIsdlcContent();
        const stepAPos = content.indexOf('SKILL INJECTION STEP A');
        const stepBPos = content.indexOf('SKILL INJECTION STEP B');

        assert.ok(stepAPos > -1, 'STEP A must exist');
        assert.ok(stepBPos > -1, 'STEP B must exist');
        assert.ok(
            stepAPos < stepBPos,
            'STEP A (built-in skills) must appear before STEP B (external skills)'
        );
    });

    it('[P0] TC-R33-05.2: STEP B appears before STEP C', () => {
        const content = getIsdlcContent();
        const stepBPos = content.indexOf('SKILL INJECTION STEP B');
        const stepCPos = content.indexOf('SKILL INJECTION STEP C');

        assert.ok(stepBPos > -1, 'STEP B must exist');
        assert.ok(stepCPos > -1, 'STEP C must exist');
        assert.ok(
            stepBPos < stepCPos,
            'STEP B (external skills) must appear before STEP C (assembly)'
        );
    });

    it('[P1] TC-R33-05.3: All skill injection steps appear after WORKFLOW MODIFIERS', () => {
        const content = getIsdlcContent();
        const modifiersPos = content.indexOf('WORKFLOW MODIFIERS');
        const stepAPos = content.indexOf('SKILL INJECTION STEP A');

        assert.ok(modifiersPos > -1, 'WORKFLOW MODIFIERS must exist');
        assert.ok(stepAPos > -1, 'STEP A must exist');
        assert.ok(
            stepAPos > modifiersPos,
            'Skill injection instructions must appear after WORKFLOW MODIFIERS section'
        );
    });

    it('[P1] TC-R33-05.4: Skill injection appears after discovery context', () => {
        const content = getIsdlcContent();
        const discoveryPos = content.indexOf('Discovery context');
        const stepAPos = content.indexOf('SKILL INJECTION STEP A');

        assert.ok(discoveryPos > -1, 'Discovery context section must exist');
        assert.ok(stepAPos > -1, 'STEP A must exist');
        assert.ok(
            stepAPos > discoveryPos,
            'Skill injection instructions must appear after Discovery context section'
        );
    });

    it('[P1] TC-R33-05.5: GATE REQUIREMENTS INJECTION appears after skill references in template', () => {
        const content = getIsdlcContent();
        // Inside the template, the skill references should appear before GATE REQUIREMENTS
        const gatePos = content.indexOf('GATE REQUIREMENTS INJECTION');
        const externalRefPos = content.indexOf('external_skills_blocks');

        assert.ok(gatePos > -1, 'GATE REQUIREMENTS INJECTION must exist in template');
        assert.ok(externalRefPos > -1, 'external_skills_blocks reference must exist');
        assert.ok(
            externalRefPos < gatePos,
            'Skill block references must appear before GATE REQUIREMENTS INJECTION in template'
        );
    });
});

// =============================================================================
// TC-R33-06: Fail-Open Semantics Verification
// Traces to: FR-006, AC-006-01 through AC-006-04
// =============================================================================

describe('TC-R33-06: Fail-open semantics encoded in spec [FR-006]', () => {

    it('[P0] TC-R33-06.1: STEP A includes fail-open handling for Bash failure', () => {
        const content = getIsdlcContent();
        const stepAStart = content.indexOf('SKILL INJECTION STEP A');
        assert.ok(stepAStart > -1, 'STEP A must exist');

        // Check that STEP A section (up to STEP B) includes failure handling language
        const stepBStart = content.indexOf('SKILL INJECTION STEP B');
        const stepASection = content.substring(stepAStart, stepBStart > -1 ? stepBStart : stepAStart + 2000);

        assert.ok(
            stepASection.includes('fails') || stepASection.includes('empty'),
            'STEP A must include language about handling Bash tool failure or empty output (AC-006-01, AC-006-04)'
        );
    });

    it('[P0] TC-R33-06.2: STEP B header declares fail-open semantics', () => {
        const content = getIsdlcContent();
        // The design specifies: "**SKILL INJECTION STEP B -- External Skills** (fail-open ...)"
        const stepBStart = content.indexOf('SKILL INJECTION STEP B');
        assert.ok(stepBStart > -1, 'STEP B must exist');

        // Check that the header line or nearby text includes "fail-open"
        const headerArea = content.substring(stepBStart, stepBStart + 200);
        assert.ok(
            headerArea.includes('fail-open'),
            'STEP B header must declare fail-open semantics (FR-006)'
        );
    });

    it('[P0] TC-R33-06.3: STEP B includes file-not-found handling for individual skills', () => {
        const content = getIsdlcContent();
        const stepBStart = content.indexOf('SKILL INJECTION STEP B');
        assert.ok(stepBStart > -1, 'STEP B must exist');

        const stepCStart = content.indexOf('SKILL INJECTION STEP C');
        const stepBSection = content.substring(stepBStart, stepCStart > -1 ? stepCStart : stepBStart + 3000);

        // Must handle individual skill file read failure (AC-006-03)
        assert.ok(
            stepBSection.includes('skip') || stepBSection.includes('SKIP'),
            'STEP B must include skip/SKIP language for handling individual skill file failures (AC-006-03)'
        );
    });
});

// =============================================================================
// TC-R33-07: Monorepo Path Resolution in STEP B
// Traces to: FR-005, AC-005-01, AC-005-02, AC-005-03
// =============================================================================

describe('TC-R33-07: Monorepo path resolution in STEP B [FR-005]', () => {

    it('[P1] TC-R33-07.1: STEP B specifies monorepo manifest path', () => {
        const content = getIsdlcContent();
        const stepBStart = content.indexOf('SKILL INJECTION STEP B');
        assert.ok(stepBStart > -1, 'STEP B must exist');

        const stepCStart = content.indexOf('SKILL INJECTION STEP C');
        const stepBSection = content.substring(stepBStart, stepCStart > -1 ? stepCStart : stepBStart + 3000);

        // Must reference monorepo project-scoped path
        assert.ok(
            stepBSection.includes('projects/') || stepBSection.includes('MONOREPO'),
            'STEP B must include monorepo path resolution (projects/ or MONOREPO reference) (AC-005-02)'
        );
    });

    it('[P1] TC-R33-07.2: STEP B specifies single-project manifest path', () => {
        const content = getIsdlcContent();
        const stepBStart = content.indexOf('SKILL INJECTION STEP B');
        assert.ok(stepBStart > -1, 'STEP B must exist');

        const stepCStart = content.indexOf('SKILL INJECTION STEP C');
        const stepBSection = content.substring(stepBStart, stepCStart > -1 ? stepCStart : stepBStart + 3000);

        // Must reference single-project default path
        assert.ok(
            stepBSection.includes('docs/isdlc/external-skills-manifest.json'),
            'STEP B must reference docs/isdlc/external-skills-manifest.json for single-project mode (AC-005-01)'
        );
    });
});

// =============================================================================
// TC-R33-08: Regression Guards — Unchanged Blocks
// Traces to: CON-006 (GATE REQUIREMENTS and BUDGET DEGRADATION blocks must not be modified)
// =============================================================================

describe('TC-R33-08: Regression guards for unchanged blocks [CON-006]', () => {

    it('[P0] TC-R33-08.1: GATE REQUIREMENTS INJECTION block still present and intact', () => {
        const content = getIsdlcContent();
        assert.ok(
            content.includes('GATE REQUIREMENTS INJECTION (REQ-0024)'),
            'GATE REQUIREMENTS INJECTION block must remain intact (CON-006)'
        );
        assert.ok(
            content.includes('iteration-requirements.json'),
            'GATE REQUIREMENTS block must still reference iteration-requirements.json'
        );
    });

    it('[P0] TC-R33-08.2: BUDGET DEGRADATION INJECTION block still present and intact', () => {
        const content = getIsdlcContent();
        assert.ok(
            content.includes('BUDGET DEGRADATION INJECTION (REQ-0022)'),
            'BUDGET DEGRADATION INJECTION block must remain intact (CON-006)'
        );
        assert.ok(
            content.includes('budget_status'),
            'BUDGET DEGRADATION block must still reference budget_status'
        );
    });

    it('[P1] TC-R33-08.3: Validate GATE instruction still present at end of template', () => {
        const content = getIsdlcContent();
        assert.ok(
            content.includes('Validate GATE'),
            'Template must still end with "Validate GATE" instruction'
        );
    });
});

// =============================================================================
// TC-R33-09: TC-09 Test Updates Verification
// Traces to: FR-004 (design Section 10 specifies TC-09 assertion updates)
// These tests verify that skill-injection.test.cjs has been updated to match
// the new spec keywords. RED STATE before Phase 06 updates the test file.
// =============================================================================

describe('TC-R33-09: TC-09 test assertions updated in skill-injection.test.cjs [FR-004]', () => {

    it('[P0] TC-R33-09.1: TC-09.1 asserts SKILL INJECTION STEP A (not old SKILL INDEX BLOCK)', () => {
        const content = getSkillTestContent();
        // After Phase 06, TC-09.1 should assert on 'SKILL INJECTION STEP A' and function names
        // instead of the old 'SKILL INDEX BLOCK' pattern.

        // Find the TC-09.1 test block
        const tc091Match = content.includes("TC-09.1");
        assert.ok(tc091Match, 'skill-injection.test.cjs must contain TC-09.1 test');

        // The updated assertion should reference new keywords
        assert.ok(
            content.includes("'SKILL INJECTION STEP A'") ||
            content.includes('"SKILL INJECTION STEP A"'),
            'TC-09.1 must assert on "SKILL INJECTION STEP A" keyword (per design Section 10.2)'
        );
    });

    it('[P0] TC-R33-09.2: TC-09.4 test exists for external skill injection', () => {
        const content = getSkillTestContent();
        assert.ok(
            content.includes('TC-09.4'),
            'skill-injection.test.cjs must contain TC-09.4 test for external skill injection (per design Section 10.3)'
        );
    });

    it('[P1] TC-R33-09.3: TC-09.5 test exists for fail-open language', () => {
        const content = getSkillTestContent();
        assert.ok(
            content.includes('TC-09.5'),
            'skill-injection.test.cjs must contain TC-09.5 test for fail-open language (per design Section 10.3)'
        );
    });

    it('[P1] TC-R33-09.4: TC-09.6 test exists for assembly step', () => {
        const content = getSkillTestContent();
        assert.ok(
            content.includes('TC-09.6'),
            'skill-injection.test.cjs must contain TC-09.6 test for STEP C assembly (per design Section 10.3)'
        );
    });
});

// =============================================================================
// TC-R33-10: Non-Functional Requirements — Structural Verification
// Traces to: NFR-001 through NFR-006
// =============================================================================

describe('TC-R33-10: Non-functional requirements structural verification [NFR]', () => {

    it('[P2] TC-R33-10.1: STEP A uses process.stdout.write (not console.log) for clean output', () => {
        const content = getIsdlcContent();
        const stepAStart = content.indexOf('SKILL INJECTION STEP A');
        assert.ok(stepAStart > -1, 'STEP A must exist');

        const stepBStart = content.indexOf('SKILL INJECTION STEP B');
        const stepASection = content.substring(stepAStart, stepBStart > -1 ? stepBStart : stepAStart + 2000);

        assert.ok(
            stepASection.includes('process.stdout.write'),
            'STEP A Bash command must use process.stdout.write (not console.log) per design Section 12.4 (NFR-001)'
        );
    });

    it('[P2] TC-R33-10.2: STEP A references common.cjs path correctly', () => {
        const content = getIsdlcContent();
        const stepAStart = content.indexOf('SKILL INJECTION STEP A');
        assert.ok(stepAStart > -1, 'STEP A must exist');

        const stepBStart = content.indexOf('SKILL INJECTION STEP B');
        const stepASection = content.substring(stepAStart, stepBStart > -1 ? stepBStart : stepAStart + 2000);

        assert.ok(
            stepASection.includes('common.cjs'),
            'STEP A must reference common.cjs for the skill index functions'
        );
    });

    it('[P2] TC-R33-10.3: STEP B specifies binding filter criteria', () => {
        const content = getIsdlcContent();
        const stepBStart = content.indexOf('SKILL INJECTION STEP B');
        assert.ok(stepBStart > -1, 'STEP B must exist');

        const stepCStart = content.indexOf('SKILL INJECTION STEP C');
        const stepBSection = content.substring(stepBStart, stepCStart > -1 ? stepCStart : stepBStart + 3000);

        // Must reference the binding filter fields
        assert.ok(
            stepBSection.includes('injection_mode') && stepBSection.includes('always'),
            'STEP B must specify injection_mode "always" filter criterion (NFR-004)'
        );
    });
});
