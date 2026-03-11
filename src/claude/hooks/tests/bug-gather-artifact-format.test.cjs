'use strict';

/**
 * Bug-Gather Artifact Format Validation Tests (CJS)
 * ===================================================
 * REQ-0061: Bug-Aware Analyze Flow
 *
 * Validates that artifacts produced by the bug-gather agent are compatible
 * with downstream consumers: the tracing orchestrator (Phase 02) and
 * computeStartPhase (REQ-0026).
 *
 * These tests validate artifact FORMAT, not agent behavior. They use sample
 * artifact content from the test data plan (test-data-plan.md sections 4.1-4.5).
 *
 * Run: node --test src/claude/hooks/tests/bug-gather-artifact-format.test.cjs
 *
 * Traces: FR-003 (Artifact Production), FR-004 (Fix Handoff)
 * Test Cases: TC-011, TC-012, TC-013, TC-014, TC-026, TC-027
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ---------------------------------------------------------------------------
// computeStartPhase import for integration tests
// ---------------------------------------------------------------------------

const threeVerbUtils = require(path.resolve(
    __dirname, '..', 'lib', 'three-verb-utils.cjs'
));
const { computeStartPhase } = threeVerbUtils;

// ---------------------------------------------------------------------------
// Fix workflow phases (from workflows.json)
// ---------------------------------------------------------------------------

const FIX_PHASES = [
    '01-requirements',
    '02-tracing',
    '05-test-strategy',
    '06-implementation',
    '16-quality-loop',
    '08-code-review'
];

// ---------------------------------------------------------------------------
// Test data: Valid bug-report.md (from test-data-plan.md section 4.1)
// REQ-0061, FR-003, AC-003-01
// ---------------------------------------------------------------------------

const VALID_BUG_REPORT = `# Bug Report: ENOENT crash on spaced paths

**Source**: github GH-42
**Severity**: high
**Generated**: 2026-03-11

## Expected Behavior
The fix workflow should start normally regardless of spaces in artifact folder paths.

## Actual Behavior
The command crashes with ENOENT error at path.resolve() in three-verb-utils.cjs.

## Symptoms
- Crash on \`/isdlc fix\` when paths have spaces
- Error message references truncated path

## Error Messages
\`\`\`
Error: ENOENT: no such file or directory, open 'docs/requirements/REQ'
\`\`\`

## Reproduction Steps
1. Create a requirement with spaces in the slug
2. Run \`/isdlc fix "the slug with spaces"\`
3. Observe ENOENT crash

## Affected Area
- **Files**: src/claude/hooks/lib/three-verb-utils.cjs (line 142)
- **Modules**: Path resolution in workflow utilities

## Additional Context
Only occurs when artifact folder name contains spaces.
`;

// ---------------------------------------------------------------------------
// Test data: Valid requirements-spec.md (from test-data-plan.md section 4.2)
// REQ-0061, FR-003, AC-003-02
// ---------------------------------------------------------------------------

const VALID_REQUIREMENTS_SPEC = `# Requirements Specification: Fix ENOENT on spaced paths

**Status**: Complete (bug analysis)
**Source**: GH-42
**Last Updated**: 2026-03-11

---

## 1. Business Context

### Problem Statement
The fix workflow crashes with ENOENT when the artifact folder path contains spaces.

---

## 6. Functional Requirements

### FR-001: Handle spaces in artifact folder paths

**Confidence**: High

When the fix workflow resolves the artifact folder path, it must handle spaces correctly.

- **AC-001-01**: Given an artifact folder with spaces in its name, when the fix workflow resolves the path, then path.resolve() handles the spaces correctly
- **AC-001-02**: Given a spaced path, when the workflow starts, then all subsequent phases can read/write artifacts at the correct path
`;

// ---------------------------------------------------------------------------
// Test data: Invalid bug-report.md (from test-data-plan.md section 4.3)
// REQ-0061, FR-003, AC-003-04 (negative case)
// ---------------------------------------------------------------------------

const INVALID_BUG_REPORT = `# Bug Report: Some bug

**Source**: github GH-42

## Symptoms
- Something is broken
`;

// ---------------------------------------------------------------------------
// Test data: meta.json variants (from test-data-plan.md sections 4.4, 4.5)
// REQ-0061, FR-004, AC-004-04
// ---------------------------------------------------------------------------

const VALID_META_WITH_PHASE01 = {
    slug: 'BUG-0042-enoent-spaced-paths',
    source: 'github',
    source_id: 'GH-42',
    phases_completed: ['01-requirements'],
    analysis_status: 'partial',
    bug_classification: {
        classification: 'bug',
        reasoning: 'Description contains crash, error message, stack trace',
        confirmed_by_user: true
    }
};

const INVALID_META_NO_PHASES = {
    slug: 'BUG-0042-enoent-spaced-paths',
    source: 'github',
    source_id: 'GH-42'
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let testDir;

/**
 * Parse a markdown file and extract section headers (## level).
 * Returns a Set of section names (lowercased, trimmed).
 */
function extractSections(markdownContent) {
    const sections = new Set();
    const lines = markdownContent.split('\n');
    for (const line of lines) {
        const match = line.match(/^## (.+)$/);
        if (match) {
            sections.add(match[1].trim());
        }
    }
    return sections;
}

/**
 * Check if a section in the markdown file is non-empty.
 * A section is non-empty if it has at least one non-blank line after
 * its header and before the next section header.
 */
function isSectionNonEmpty(markdownContent, sectionName) {
    const lines = markdownContent.split('\n');
    let inSection = false;
    let hasContent = false;

    for (const line of lines) {
        if (line.startsWith('## ')) {
            if (inSection) break; // Reached next section
            if (line.trim() === `## ${sectionName}`) {
                inSection = true;
                continue;
            }
        }
        if (inSection && line.trim().length > 0) {
            hasContent = true;
        }
    }
    return hasContent;
}

/**
 * Count occurrences of a pattern in text.
 */
function countOccurrences(text, pattern) {
    const regex = new RegExp(pattern, 'g');
    const matches = text.match(regex);
    return matches ? matches.length : 0;
}

// =============================================================================
// Test Suite: bug-report.md Format Validation
// REQ-0061, FR-003, AC-003-01, AC-003-04
// =============================================================================

describe('Bug-report.md format validation (REQ-0061, FR-003)', () => {

    // TC-011: bug-report.md produced with required sections
    // Traces: FR-003, AC-003-01
    it('TC-011: valid bug-report.md has all required sections', () => {
        const sections = extractSections(VALID_BUG_REPORT);

        // Required sections per tracing orchestrator expectations
        assert.ok(sections.has('Expected Behavior'),
            'bug-report.md must have "Expected Behavior" section');
        assert.ok(sections.has('Actual Behavior'),
            'bug-report.md must have "Actual Behavior" section');
        assert.ok(sections.has('Symptoms'),
            'bug-report.md must have "Symptoms" section');
        assert.ok(sections.has('Affected Area'),
            'bug-report.md must have "Affected Area" section');
    });

    // TC-014: Artifacts satisfy tracing orchestrator pre-phase check
    // Traces: FR-003, AC-003-04
    it('TC-014: bug-report.md required sections are non-empty', () => {
        assert.ok(isSectionNonEmpty(VALID_BUG_REPORT, 'Expected Behavior'),
            '"Expected Behavior" section must not be empty');
        assert.ok(isSectionNonEmpty(VALID_BUG_REPORT, 'Actual Behavior'),
            '"Actual Behavior" section must not be empty');
    });

    // TC-026: Tracing orchestrator rejects artifacts with missing sections
    // Traces: FR-003, AC-003-04 (negative case -- ERR-BGA-006)
    it('TC-026: invalid bug-report.md missing required sections is detected', () => {
        const sections = extractSections(INVALID_BUG_REPORT);

        assert.ok(!sections.has('Expected Behavior'),
            'Invalid report should be missing "Expected Behavior"');
        assert.ok(!sections.has('Actual Behavior'),
            'Invalid report should be missing "Actual Behavior"');
    });
});

// =============================================================================
// Test Suite: requirements-spec.md Format Validation
// REQ-0061, FR-003, AC-003-02
// =============================================================================

describe('Requirements-spec.md format validation (REQ-0061, FR-003)', () => {

    // TC-012: requirements-spec.md produced with FR/AC structure
    // Traces: FR-003, AC-003-02
    it('TC-012: valid requirements-spec.md has FR and AC structure', () => {
        const frCount = countOccurrences(VALID_REQUIREMENTS_SPEC, 'FR-\\d+');
        const acCount = countOccurrences(VALID_REQUIREMENTS_SPEC, 'AC-\\d+');

        assert.ok(frCount >= 1,
            `requirements-spec.md must have at least 1 FR reference (found ${frCount})`);
        assert.ok(acCount >= 1,
            `requirements-spec.md must have at least 1 AC reference (found ${acCount})`);
    });

    // TC-012 continued: Problem Statement section exists
    // Traces: FR-003, AC-003-02
    it('TC-012b: valid requirements-spec.md has Problem Statement', () => {
        assert.ok(VALID_REQUIREMENTS_SPEC.includes('### Problem Statement'),
            'requirements-spec.md must have a "Problem Statement" section');
        assert.ok(VALID_REQUIREMENTS_SPEC.includes('## 6. Functional Requirements'),
            'requirements-spec.md must have a "Functional Requirements" section');
    });

    // TC-013: Artifacts written to correct folder (validated by path logic)
    // Traces: FR-003, AC-003-03
    it('TC-013: artifact folder path structure is valid', () => {
        // Validate that artifact folder path follows expected pattern
        const artifactFolder = 'docs/requirements/BUG-0042-enoent-spaced-paths/';
        const bugReportPath = path.join(artifactFolder, 'bug-report.md');
        const reqSpecPath = path.join(artifactFolder, 'requirements-spec.md');

        // Path must be within docs/requirements/
        assert.ok(bugReportPath.startsWith('docs/requirements/'),
            'bug-report.md must be in docs/requirements/{slug}/');
        assert.ok(reqSpecPath.startsWith('docs/requirements/'),
            'requirements-spec.md must be in docs/requirements/{slug}/');

        // Path must contain a slug directory
        const slugMatch = artifactFolder.match(/docs\/requirements\/([^/]+)\//);
        assert.ok(slugMatch, 'Artifact folder must contain a slug directory');
        assert.ok(slugMatch[1].length > 0, 'Slug must be non-empty');
    });
});

// =============================================================================
// Test Suite: meta.json and computeStartPhase Compatibility
// REQ-0061, FR-004, AC-004-04
// =============================================================================

describe('meta.json and computeStartPhase compatibility (REQ-0061, FR-004)', () => {

    // TC-016/TC-027 positive: Verify computeStartPhase behavior with bug-gather meta
    // computeStartPhase validates against ANALYSIS_PHASES (contiguous from 00-quick-scan).
    // Since bug-gather only adds "01-requirements" (without 00-quick-scan), the contiguous
    // prefix is empty and computeStartPhase returns "raw". This is expected behavior --
    // the analyze handler step 6.5f explicitly passes START_PHASE: "02-tracing" to the
    // orchestrator, bypassing computeStartPhase for the fix handoff.
    // Traces: FR-004, AC-004-04
    it('TC-016/TC-027: computeStartPhase returns raw for non-contiguous bug-gather phases', () => {
        const result = computeStartPhase(VALID_META_WITH_PHASE01, FIX_PHASES);

        // validatePhasesCompleted requires contiguous prefix from ANALYSIS_PHASES[0] = '00-quick-scan'
        // Since '01-requirements' is not at the start, the valid prefix is empty -> raw
        assert.equal(result.status, 'raw',
            'computeStartPhase returns "raw" because 01-requirements is not contiguous from 00-quick-scan');

        // This confirms the analyze handler MUST explicitly pass START_PHASE: "02-tracing"
        // to the orchestrator rather than relying on computeStartPhase detection
        assert.equal(result.startPhase, null,
            'startPhase should be null for raw status');
        assert.deepStrictEqual(result.remainingPhases, FIX_PHASES,
            'All fix phases should remain');
    });

    // TC-027 negative: meta.json without phases_completed
    // computeStartPhase should return raw status
    // Traces: FR-004, AC-004-04 (negative -- ERR-BGA-007)
    it('TC-027: computeStartPhase returns raw when no phases_completed', () => {
        const result = computeStartPhase(INVALID_META_NO_PHASES, FIX_PHASES);

        assert.equal(result.status, 'raw',
            'Status should be "raw" when phases_completed is absent');
        assert.equal(result.startPhase, null,
            'startPhase should be null for raw status');
        assert.deepStrictEqual(result.completedPhases, [],
            'completedPhases should be empty');
        assert.deepStrictEqual(result.remainingPhases, FIX_PHASES,
            'remainingPhases should be all fix phases');
    });
});

// =============================================================================
// Test Suite: Artifact File I/O Integration
// REQ-0061, FR-003, AC-003-03
// =============================================================================

describe('Artifact file I/O integration (REQ-0061, FR-003)', () => {

    before(() => {
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bug-gather-test-'));
        const slugDir = path.join(testDir, 'docs', 'requirements', 'BUG-0042-enoent-spaced-paths');
        fs.mkdirSync(slugDir, { recursive: true });

        // Write test artifacts
        fs.writeFileSync(path.join(slugDir, 'bug-report.md'), VALID_BUG_REPORT);
        fs.writeFileSync(path.join(slugDir, 'requirements-spec.md'), VALID_REQUIREMENTS_SPEC);
        fs.writeFileSync(
            path.join(slugDir, 'meta.json'),
            JSON.stringify(VALID_META_WITH_PHASE01, null, 2)
        );
    });

    after(() => {
        if (testDir) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    // TC-013 integration: Both artifacts can be written and read back
    // Traces: FR-003, AC-003-03
    it('TC-013: both artifacts exist at correct paths after write', () => {
        const slugDir = path.join(testDir, 'docs', 'requirements', 'BUG-0042-enoent-spaced-paths');

        assert.ok(fs.existsSync(path.join(slugDir, 'bug-report.md')),
            'bug-report.md should exist in artifact folder');
        assert.ok(fs.existsSync(path.join(slugDir, 'requirements-spec.md')),
            'requirements-spec.md should exist in artifact folder');
    });

    // TC-014 integration: Written bug-report.md passes format validation
    // Traces: FR-003, AC-003-04
    it('TC-014: written bug-report.md passes format validation', () => {
        const slugDir = path.join(testDir, 'docs', 'requirements', 'BUG-0042-enoent-spaced-paths');
        const content = fs.readFileSync(path.join(slugDir, 'bug-report.md'), 'utf8');

        const sections = extractSections(content);
        assert.ok(sections.has('Expected Behavior'), 'Must have Expected Behavior');
        assert.ok(sections.has('Actual Behavior'), 'Must have Actual Behavior');
        assert.ok(isSectionNonEmpty(content, 'Expected Behavior'), 'Expected Behavior must be non-empty');
        assert.ok(isSectionNonEmpty(content, 'Actual Behavior'), 'Actual Behavior must be non-empty');
    });

    // meta.json integration: Written meta.json has correct phases_completed structure
    // computeStartPhase returns raw (expected -- see TC-016/TC-027 above), but the
    // meta.json structure is valid and contains the Phase 01 indicator.
    // The analyze handler passes START_PHASE: "02-tracing" explicitly.
    // Traces: FR-004, AC-004-04
    it('meta.json written by bug-gather has valid phases_completed structure', () => {
        const slugDir = path.join(testDir, 'docs', 'requirements', 'BUG-0042-enoent-spaced-paths');
        const meta = JSON.parse(fs.readFileSync(path.join(slugDir, 'meta.json'), 'utf8'));

        assert.ok(Array.isArray(meta.phases_completed),
            'meta.phases_completed must be an array');
        assert.ok(meta.phases_completed.includes('01-requirements'),
            'meta.phases_completed must include "01-requirements"');

        // Verify computeStartPhase can process it without throwing
        const result = computeStartPhase(meta, FIX_PHASES);
        assert.ok(result !== null && result !== undefined,
            'computeStartPhase should return a valid result object');
        assert.ok('status' in result, 'Result must have status field');
        assert.ok('remainingPhases' in result, 'Result must have remainingPhases field');
    });
});

// =============================================================================
// Test Suite: Agent File Existence
// REQ-0061, FR-002
// =============================================================================

describe('Bug-gather agent file existence (REQ-0061, FR-002)', () => {

    const AGENT_FILE = path.resolve(__dirname, '..', '..', 'agents', 'bug-gather-analyst.md');
    const ISDLC_CMD = path.resolve(__dirname, '..', '..', 'commands', 'isdlc.md');

    it('bug-gather-analyst.md agent file exists', () => {
        assert.ok(fs.existsSync(AGENT_FILE),
            `Agent file must exist at ${AGENT_FILE}`);
    });

    it('bug-gather-analyst.md has required frontmatter', () => {
        const content = fs.readFileSync(AGENT_FILE, 'utf8');

        assert.ok(content.includes('name: bug-gather-analyst'),
            'Agent file must have name: bug-gather-analyst in frontmatter');
        assert.ok(content.includes('model: opus'),
            'Agent file must specify model: opus');
    });

    it('bug-gather-analyst.md documents required artifact sections', () => {
        const content = fs.readFileSync(AGENT_FILE, 'utf8');

        // Agent must document the expected artifact format
        assert.ok(content.includes('Expected Behavior'),
            'Agent must document Expected Behavior section');
        assert.ok(content.includes('Actual Behavior'),
            'Agent must document Actual Behavior section');
        assert.ok(content.includes('bug-report.md'),
            'Agent must reference bug-report.md artifact');
        assert.ok(content.includes('requirements-spec.md'),
            'Agent must reference requirements-spec.md artifact');
    });

    it('bug-gather-analyst.md documents BUG_GATHER_COMPLETE signal', () => {
        const content = fs.readFileSync(AGENT_FILE, 'utf8');

        assert.ok(content.includes('BUG_GATHER_COMPLETE'),
            'Agent must document BUG_GATHER_COMPLETE completion signal');
    });

    it('isdlc.md analyze handler references bug classification gate', () => {
        const content = fs.readFileSync(ISDLC_CMD, 'utf8');

        assert.ok(content.includes('Bug Classification Gate'),
            'isdlc.md must contain Bug Classification Gate step');
        assert.ok(content.includes('REQ-0061'),
            'isdlc.md must reference REQ-0061');
        assert.ok(content.includes('bug-gather-analyst'),
            'isdlc.md must reference bug-gather-analyst agent');
    });

    it('isdlc.md analyze handler has fix handoff gate', () => {
        const content = fs.readFileSync(ISDLC_CMD, 'utf8');

        assert.ok(content.includes('Fix Handoff Gate'),
            'isdlc.md must contain Fix Handoff Gate step');
        assert.ok(content.includes('Should I fix it?'),
            'isdlc.md must contain "Should I fix it?" prompt');
    });
});
