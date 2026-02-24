'use strict';

/**
 * iSDLC Backlog Command Surface Verification - Test Suite (CJS)
 * ==============================================================
 * Verifies that the three-verb command model (add/analyze/build) is correctly
 * implemented across orchestrator and isdlc.md, replacing the former
 * BACKLOG PICKER section.
 *
 * Originally: BUG-0018-GH-2 (Backlog picker pattern mismatch)
 * Updated for: REQ-0023 (Three-verb backlog model)
 *
 * Traces: AC-001 (add), AC-002 (analyze), AC-003 (build), AC-008 (hooks)
 *
 * Run: node --test src/claude/hooks/tests/test-backlog-picker-content.test.cjs
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// File paths
// ---------------------------------------------------------------------------

const ORCHESTRATOR_PATH = path.resolve(
    __dirname, '..', '..', 'agents', '00-sdlc-orchestrator.md'
);

const ISDLC_CMD_PATH = path.resolve(
    __dirname, '..', '..', 'commands', 'isdlc.md'
);

const WORKFLOWS_JSON_PATH = path.resolve(
    __dirname, '..', '..', '..', '..', '.isdlc', 'config', 'workflows.json'
);

// ---------------------------------------------------------------------------
// Helper: read file
// ---------------------------------------------------------------------------

function readFile(filePath) {
    assert.ok(fs.existsSync(filePath), `File must exist: ${filePath}`);
    return fs.readFileSync(filePath, 'utf8');
}

// =============================================================================
// TC-ARCH: Architecture Change -- BACKLOG PICKER Removed (REQ-0023)
// =============================================================================

describe('TC-ARCH: BACKLOG PICKER replaced by three-verb model (REQ-0023)', () => {
    it('TC-ARCH-01: BACKLOG PICKER section no longer exists in orchestrator', () => {
        const content = readFile(ORCHESTRATOR_PATH);

        // The BACKLOG PICKER section was replaced by three-verb commands
        const hasOldSection = content.match(/^# BACKLOG PICKER/m);

        assert.ok(
            !hasOldSection,
            'Orchestrator must NOT contain # BACKLOG PICKER section (replaced by three-verb model)'
        );
    });

    it('TC-ARCH-02: Three-verb commands documented in orchestrator COMMANDS section', () => {
        const content = readFile(ORCHESTRATOR_PATH);

        assert.ok(
            content.includes('/isdlc add'),
            'Orchestrator must document /isdlc add command'
        );
        assert.ok(
            content.includes('/isdlc analyze'),
            'Orchestrator must document /isdlc analyze command'
        );
        assert.ok(
            content.includes('/isdlc build'),
            'Orchestrator must document /isdlc build command'
        );
    });

    it('TC-ARCH-03: SCENARIO 3 menu includes Add, Analyze, Build options', () => {
        const content = readFile(ORCHESTRATOR_PATH);

        // SCENARIO 3 should have the three-verb menu options
        const hasAddOption = content.match(/\[1\].*Add to Backlog/i);
        const hasAnalyzeOption = content.match(/\[2\].*Analyze/i);
        const hasBuildOption = content.match(/\[3\].*Build/i);

        assert.ok(hasAddOption, 'SCENARIO 3 must include [1] Add to Backlog option');
        assert.ok(hasAnalyzeOption, 'SCENARIO 3 must include [2] Analyze option');
        assert.ok(hasBuildOption, 'SCENARIO 3 must include [3] Build option');
    });
});

// =============================================================================
// TC-ADD: Add Command in isdlc.md (AC-001)
// =============================================================================

describe('TC-ADD: Add command surface in isdlc.md (AC-001)', () => {
    it('TC-ADD-01: Add action definition exists', () => {
        const content = readFile(ISDLC_CMD_PATH);

        const hasAddAction = content.match(/\*\*add\*\*.*Add.*item.*backlog/is)
            || content.match(/\/isdlc add/);

        assert.ok(
            hasAddAction,
            'isdlc.md must contain add action definition'
        );
    });

    it('TC-ADD-02: Add command examples include multiple source types', () => {
        const content = readFile(ISDLC_CMD_PATH);

        // Add must support manual text, GitHub #N, and Jira PROJECT-N
        assert.ok(
            content.includes('/isdlc add "Add payment processing"'),
            'Must include manual description example'
        );
        assert.ok(
            content.includes('/isdlc add "#42"'),
            'Must include GitHub issue reference example'
        );
        assert.ok(
            content.includes('/isdlc add "JIRA-1250"'),
            'Must include Jira ticket reference example'
        );
    });

    it('TC-ADD-03: Add command source detection documented', () => {
        const content = readFile(ISDLC_CMD_PATH);

        // Must document detectSource logic for #N -> github, PROJECT-N -> jira
        const hasSourceDetect = content.match(
            /#N.*github|github.*#N|PROJECT-N.*jira|jira.*PROJECT-N/is
        );

        assert.ok(
            hasSourceDetect,
            'Add action must document source detection (#N -> github, PROJECT-N -> jira)'
        );
    });

    it('TC-ADD-04: Add is inline -- no workflow required', () => {
        const content = readFile(ISDLC_CMD_PATH);

        // Add must be described as inline/no-workflow
        const hasInline = content.match(
            /add.*inline|add.*no workflow|add.*no.*state/is
        );

        assert.ok(
            hasInline,
            'Add action must be documented as inline (no workflow, no state.json)'
        );
    });
});

// =============================================================================
// TC-ANALYZE: Analyze Command in isdlc.md (AC-002)
// =============================================================================

describe('TC-ANALYZE: Analyze command surface in isdlc.md (AC-002)', () => {
    it('TC-ANALYZE-01: Analyze action definition exists', () => {
        const content = readFile(ISDLC_CMD_PATH);

        const hasAnalyze = content.match(/\*\*analyze\*\*.*requirements|\/isdlc analyze/is);

        assert.ok(
            hasAnalyze,
            'isdlc.md must contain analyze action definition'
        );
    });

    it('TC-ANALYZE-02: Analyze command examples documented', () => {
        const content = readFile(ISDLC_CMD_PATH);

        assert.ok(
            content.includes('/isdlc analyze "payment-processing"'),
            'Must include slug-based analyze example'
        );
        assert.ok(
            content.includes('/isdlc analyze "3.2"'),
            'Must include item-number-based analyze example'
        );
    });

    it('TC-ANALYZE-03: Analyze is inline -- no workflow required', () => {
        const content = readFile(ISDLC_CMD_PATH);

        const hasInline = content.match(
            /analyze.*inline|analyze.*no workflow|analyze.*no.*state/is
        );

        assert.ok(
            hasInline,
            'Analyze action must be documented as inline (no workflow, no state.json)'
        );
    });
});

// =============================================================================
// TC-BUILD: Build Command in isdlc.md (AC-003)
// =============================================================================

describe('TC-BUILD: Build command surface in isdlc.md (AC-003)', () => {
    it('TC-BUILD-01: Build action definition exists', () => {
        const content = readFile(ISDLC_CMD_PATH);

        const hasBuild = content.match(/\*\*build\*\*.*feature|\/isdlc build/is);

        assert.ok(
            hasBuild,
            'isdlc.md must contain build action definition'
        );
    });

    it('TC-BUILD-02: Build command examples documented', () => {
        const content = readFile(ISDLC_CMD_PATH);

        assert.ok(
            content.includes('/isdlc build "payment-processing"'),
            'Must include slug-based build example'
        );
        assert.ok(
            content.includes('/isdlc build "Feature description"'),
            'Must include description-based build example'
        );
    });

    it('TC-BUILD-03: Build uses Phase-Loop Controller', () => {
        const content = readFile(ISDLC_CMD_PATH);

        // Build must route through Phase-Loop Controller, not inline
        const hasPhaseLoop = content.match(
            /build.*Phase-Loop Controller|build.*workflow/is
        );

        assert.ok(
            hasPhaseLoop,
            'Build action must use Phase-Loop Controller (orchestrated workflow)'
        );
    });

    it('TC-BUILD-04: Build supports --supervised and --debate flags', () => {
        const content = readFile(ISDLC_CMD_PATH);

        assert.ok(
            content.includes('/isdlc build') && content.includes('--supervised'),
            'Build must support --supervised flag'
        );
        assert.ok(
            content.includes('/isdlc build') && content.includes('--debate'),
            'Build must support --debate flag'
        );
    });

    it('TC-BUILD-05: Feature is alias for build', () => {
        const content = readFile(ISDLC_CMD_PATH);

        // Feature should be documented as an alias for build
        const hasAlias = content.match(
            /feature.*alias.*build|feature.*same.*build|feature.*maps.*build/is
        );

        assert.ok(
            hasAlias,
            'Feature action must be documented as alias for build'
        );
    });
});

// =============================================================================
// TC-FR5: Start Action (preserved from original test suite)
// =============================================================================

describe('TC-FR5: Start Action Workflow Entry', () => {
    it('TC-FR5-01: Start action documented as feature reuse (AC-5.1)', () => {
        const content = readFile(ISDLC_CMD_PATH);

        // The start action section must describe reusing feature workflow
        const hasReuse = content.match(
            /start.*(?:reuse|feature.*workflow|Phase B|phases.*from.*02|skip.*Phase 0[01])/is
        );

        assert.ok(
            hasReuse,
            'isdlc.md start action must describe reusing feature workflow (Phase B from Phase 02)'
        );
    });

    it('TC-FR5-02: workflows.json has no start entry -- by design (AC-5.2)', () => {
        const content = readFile(WORKFLOWS_JSON_PATH);
        const workflows = JSON.parse(content);

        // No "start" key should exist at top level
        assert.ok(
            !workflows.workflows.start,
            'workflows.json must NOT contain a "start" workflow entry (by design -- reuses feature)'
        );
    });

    it('TC-FR5-03: Reuse mechanism documented in code comment (AC-5.3)', () => {
        const content = readFile(ISDLC_CMD_PATH);

        // The start section or nearby text should explain WHY it reuses feature workflow
        const hasExplanation = content.match(
            /start.*(?:reuse|same.*phases|feature.*workflow|skip.*Phase 0[01].*already completed)/is
        );

        assert.ok(
            hasExplanation,
            'isdlc.md must explain the start action reuse design decision'
        );
    });
});

// =============================================================================
// TC-WORKFLOW: Workflow Table Consistency
// =============================================================================

describe('TC-WORKFLOW: Workflow table includes three-verb entries', () => {
    it('TC-WORKFLOW-01: isdlc.md workflow table has add entry', () => {
        const content = readFile(ISDLC_CMD_PATH);

        const hasAddRow = content.match(/isdlc add.*inline|add.*no workflow/is);

        assert.ok(
            hasAddRow,
            'Workflow table must include add entry (inline, no workflow)'
        );
    });

    it('TC-WORKFLOW-02: isdlc.md workflow table has analyze entry', () => {
        const content = readFile(ISDLC_CMD_PATH);

        const hasAnalyzeRow = content.match(/isdlc analyze.*inline|analyze.*no workflow/is);

        assert.ok(
            hasAnalyzeRow,
            'Workflow table must include analyze entry (inline, no workflow)'
        );
    });

    it('TC-WORKFLOW-03: isdlc.md workflow table has build entry', () => {
        const content = readFile(ISDLC_CMD_PATH);

        const hasBuildRow = content.match(/isdlc build.*feature/is);

        assert.ok(
            hasBuildRow,
            'Workflow table must include build entry (feature workflow)'
        );
    });

    it('TC-WORKFLOW-04: Flow summary includes three-verb routing', () => {
        const content = readFile(ISDLC_CMD_PATH);

        assert.ok(
            content.includes('/isdlc add ...'),
            'Flow summary must include /isdlc add routing'
        );
        assert.ok(
            content.includes('/isdlc analyze ...'),
            'Flow summary must include /isdlc analyze routing'
        );
        assert.ok(
            content.includes('/isdlc build ...'),
            'Flow summary must include /isdlc build routing'
        );
    });
});

// =============================================================================
// TC-SHARED: Shared Utilities Documentation
// =============================================================================

describe('TC-SHARED: Shared utilities reference in isdlc.md', () => {
    it('TC-SHARED-01: three-verb-utils.cjs referenced in isdlc.md', () => {
        const content = readFile(ISDLC_CMD_PATH);

        assert.ok(
            content.includes('three-verb-utils.cjs'),
            'isdlc.md must reference three-verb-utils.cjs shared utilities'
        );
    });

    it('TC-SHARED-02: Key utility functions documented', () => {
        const content = readFile(ISDLC_CMD_PATH);

        // Must reference the key utility functions from the module
        assert.ok(
            content.includes('generateSlug') || content.includes('detectSource'),
            'isdlc.md must reference key utility functions (generateSlug, detectSource)'
        );
    });
});

// =============================================================================
// TC-NFR2: No Regression (structural checks)
// =============================================================================

describe('TC-NFR2: No Regression', () => {
    it('TC-NFR2-01: Orchestrator file is valid markdown (NFR-2)', () => {
        const content = readFile(ORCHESTRATOR_PATH);

        // Basic structural check -- file has frontmatter and key sections
        assert.ok(content.startsWith('---'), 'Must start with YAML frontmatter');
        assert.ok(
            content.includes('# COMMANDS YOU SUPPORT'),
            'Must contain COMMANDS YOU SUPPORT section'
        );
        assert.ok(
            content.includes('# CORE MISSION'),
            'Must contain CORE MISSION section'
        );
    });

    it('TC-NFR2-02: isdlc.md command file is valid (NFR-2)', () => {
        const content = readFile(ISDLC_CMD_PATH);

        // Basic structural check
        assert.ok(content.includes('## SDLC Orchestrator Command'), 'Must contain command header');
        assert.ok(content.includes('feature'), 'Must contain feature action');
        assert.ok(content.includes('fix'), 'Must contain fix action');
        assert.ok(content.includes('build'), 'Must contain build action');
        assert.ok(content.includes('add'), 'Must contain add action');
        assert.ok(content.includes('analyze'), 'Must contain analyze action');
    });
});

// =============================================================================
// TC-CROSS: Cross-Reference Consistency
// =============================================================================

describe('TC-CROSS: Cross-Reference Consistency', () => {
    it('TC-CROSS-01: Orchestrator three-verb commands match isdlc.md actions', () => {
        const orchestratorContent = readFile(ORCHESTRATOR_PATH);
        const isdlcContent = readFile(ISDLC_CMD_PATH);

        // Both files must reference the same three commands
        for (const verb of ['add', 'analyze', 'build']) {
            const orchRef = orchestratorContent.includes(`/isdlc ${verb}`);
            const cmdRef = isdlcContent.includes(`/isdlc ${verb}`);

            assert.ok(
                orchRef,
                `Orchestrator must reference /isdlc ${verb}`
            );
            assert.ok(
                cmdRef,
                `isdlc.md must reference /isdlc ${verb}`
            );
        }
    });

    it('TC-CROSS-02: Build workflow entry consistent between orchestrator and isdlc.md', () => {
        const orchestratorContent = readFile(ORCHESTRATOR_PATH);
        const isdlcContent = readFile(ISDLC_CMD_PATH);

        // Both must reference build as a feature workflow
        const orchBuild = orchestratorContent.match(/build.*feature/is);
        const cmdBuild = isdlcContent.match(/build.*feature/is);

        assert.ok(orchBuild, 'Orchestrator must describe build as feature workflow');
        assert.ok(cmdBuild, 'isdlc.md must describe build as feature workflow');
    });
});
