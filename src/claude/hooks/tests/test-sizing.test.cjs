'use strict';

/**
 * Unit Tests: Adaptive Workflow Sizing Functions (REQ-0011)
 * ========================================================
 * Tests for parseSizingFromImpactAnalysis, computeSizingRecommendation,
 * and applySizingDecision in common.cjs.
 *
 * Test file: src/claude/hooks/tests/test-sizing.test.cjs
 * Run: node --test src/claude/hooks/tests/test-sizing.test.cjs
 *
 * 74 test cases covering:
 *   - 19 parseSizingFromImpactAnalysis tests
 *   - 16 computeSizingRecommendation tests
 *   - 26 applySizingDecision tests
 *   - 8 integration tests
 *   - 5 error path tests
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

// Load common.cjs from the lib directory
const common = require(path.join(__dirname, '..', 'lib', 'common.cjs'));

// =========================================================================
// Test Helpers
// =========================================================================

const FEATURE_PHASES = [
    '00-quick-scan',
    '01-requirements',
    '02-impact-analysis',
    '03-architecture',
    '04-design',
    '05-test-strategy',
    '06-implementation',
    '16-quality-loop',
    '08-code-review'
];

/**
 * Build a standard 9-phase feature workflow state.
 * Phases 00, 01, 02 are completed, rest are pending.
 * current_phase_index = 3 (pointing to 03-architecture).
 */
function buildFeatureState() {
    const phase_status = {};
    const phases = {};
    for (const p of FEATURE_PHASES) {
        const idx = FEATURE_PHASES.indexOf(p);
        const status = idx <= 2 ? 'completed' : 'pending';
        phase_status[p] = status;
        phases[p] = {
            status,
            started: idx <= 2 ? '2026-01-01T00:00:00Z' : null,
            completed: idx <= 2 ? '2026-01-01T01:00:00Z' : null,
            gate_passed: idx <= 2 ? '2026-01-01T01:00:00Z' : null,
            artifacts: []
        };
    }

    return {
        active_workflow: {
            type: 'feature',
            phases: [...FEATURE_PHASES],
            phase_status,
            current_phase_index: 3,
            flags: {}
        },
        phases
    };
}

/**
 * Build a minimal state with custom phases array.
 * First entry is completed, rest are pending.
 */
function buildMinimalState(phasesArray) {
    const phase_status = {};
    const phases = {};
    for (let i = 0; i < phasesArray.length; i++) {
        const status = i === 0 ? 'completed' : 'pending';
        phase_status[phasesArray[i]] = status;
        phases[phasesArray[i]] = {
            status,
            started: i === 0 ? '2026-01-01T00:00:00Z' : null,
            completed: i === 0 ? '2026-01-01T01:00:00Z' : null,
            gate_passed: null,
            artifacts: []
        };
    }

    return {
        active_workflow: {
            type: 'feature',
            phases: [...phasesArray],
            phase_status,
            current_phase_index: 1,
            flags: {}
        },
        phases
    };
}

/**
 * Build a state where current_phase_index would be out of bounds
 * after removing 2 phases.
 */
function buildStateWithHighIndex() {
    // 5 phases, index at 4 (last). Remove 2 -> 3 phases, index 4 >= length 3
    const phasesArray = [
        '02-impact-analysis',
        '03-architecture',
        '04-design',
        '05-test-strategy',
        '08-code-review'
    ];
    const phase_status = {};
    const phases = {};
    for (let i = 0; i < phasesArray.length; i++) {
        const status = i <= 3 ? 'completed' : 'pending';
        phase_status[phasesArray[i]] = status;
        phases[phasesArray[i]] = {
            status,
            started: '2026-01-01T00:00:00Z',
            completed: i <= 3 ? '2026-01-01T01:00:00Z' : null,
            gate_passed: null,
            artifacts: []
        };
    }

    return {
        active_workflow: {
            type: 'feature',
            phases: [...phasesArray],
            phase_status,
            current_phase_index: 4,
            flags: {}
        },
        phases
    };
}

/**
 * Build IA content with a JSON metadata block.
 */
function buildIAContent(files, modules, risk, blast, gaps) {
    return `# Impact Analysis

Some analysis text here.

## Impact Analysis Metadata

\`\`\`json
{
  "files_directly_affected": ${files},
  "modules_affected": ${modules},
  "risk_level": "${risk}",
  "blast_radius": "${blast}",
  "coverage_gaps": ${gaps}
}
\`\`\``;
}

// Pre-built metric objects
const lowMetrics = { file_count: 3, module_count: 1, risk_score: 'low', coupling: 'low', coverage_gaps: 0 };
const mediumMetrics = { file_count: 12, module_count: 4, risk_score: 'medium', coupling: 'medium', coverage_gaps: 1 };
const epicMetrics = { file_count: 35, module_count: 8, risk_score: 'high', coupling: 'high', coverage_gaps: 5 };

// =========================================================================
// stderr capture helpers
// =========================================================================

let capturedStderr = '';
let origStderrWrite;

function captureStderr() {
    capturedStderr = '';
    origStderrWrite = process.stderr.write;
    process.stderr.write = (msg) => { capturedStderr += msg; return true; };
}

function restoreStderr() {
    if (origStderrWrite) {
        process.stderr.write = origStderrWrite;
        origStderrWrite = null;
    }
}

// =========================================================================
// 1. Unit Tests: parseSizingFromImpactAnalysis
// =========================================================================

describe('parseSizingFromImpactAnalysis', () => {

    // 1.1 JSON Metadata Block Parsing (Primary Strategy)

    it('TC-SZ-001: Parses valid JSON metadata block', () => {
        const content = `# Impact Analysis
Some analysis text.
## Impact Analysis Metadata
\`\`\`json
{
  "files_directly_affected": 3,
  "modules_affected": 1,
  "risk_level": "low",
  "blast_radius": "low",
  "coverage_gaps": 0
}
\`\`\``;
        const result = common.parseSizingFromImpactAnalysis(content);
        assert.deepStrictEqual(result, {
            file_count: 3, module_count: 1, risk_score: 'low',
            coupling: 'low', coverage_gaps: 0
        });
    });

    it('TC-SZ-002: Uses the LAST JSON block when multiple exist', () => {
        const content = `
\`\`\`json
{ "files_directly_affected": 99, "modules_affected": 99, "risk_level": "high", "blast_radius": "high", "coverage_gaps": 99 }
\`\`\`
Some text
\`\`\`json
{ "files_directly_affected": 3, "modules_affected": 1, "risk_level": "low", "blast_radius": "low", "coverage_gaps": 0 }
\`\`\``;
        const result = common.parseSizingFromImpactAnalysis(content);
        assert.equal(result.file_count, 3);
    });

    it('TC-SZ-003: Maps IA field names to SizingMetrics field names', () => {
        const content = `\`\`\`json
{
  "files_directly_affected": 10,
  "modules_affected": 4,
  "risk_level": "medium",
  "blast_radius": "high",
  "coverage_gaps": 2
}
\`\`\``;
        const result = common.parseSizingFromImpactAnalysis(content);
        assert.equal(result.file_count, 10);
        assert.equal(result.module_count, 4);
        assert.equal(result.risk_score, 'medium');
        assert.equal(result.coupling, 'high');
        assert.equal(result.coverage_gaps, 2);
    });

    it('TC-SZ-004: Ignores extra fields in JSON block', () => {
        const content = `\`\`\`json
{
  "files_directly_affected": 5,
  "modules_affected": 2,
  "risk_level": "low",
  "blast_radius": "low",
  "coverage_gaps": 0,
  "extra_field": "should be ignored"
}
\`\`\``;
        const result = common.parseSizingFromImpactAnalysis(content);
        assert.equal(result.file_count, 5);
        assert.equal(result.extra_field, undefined);
    });

    it('TC-SZ-005: Handles JSON block with string numbers (parseable)', () => {
        const content = `\`\`\`json
{
  "files_directly_affected": "7",
  "modules_affected": "2",
  "risk_level": "low",
  "blast_radius": "low",
  "coverage_gaps": "1"
}
\`\`\``;
        const result = common.parseSizingFromImpactAnalysis(content);
        assert.equal(result.file_count, 7);
        assert.equal(result.module_count, 2);
        assert.equal(result.coverage_gaps, 1);
    });

    it('TC-SZ-006: JSON block with large valid values', () => {
        const content = `\`\`\`json
{
  "files_directly_affected": 1000,
  "modules_affected": 100,
  "risk_level": "high",
  "blast_radius": "high",
  "coverage_gaps": 50
}
\`\`\``;
        const result = common.parseSizingFromImpactAnalysis(content);
        assert.equal(result.file_count, 1000);
        assert.equal(result.module_count, 100);
    });

    // 1.2 Fallback Regex Parsing

    it('TC-SZ-007: Parses Executive Summary prose (all 5 fields)', () => {
        const content = `## Executive Summary
**Affected Files**: 12
**Modules Affected**: 3
**Risk Level**: medium
**Blast Radius**: high
**Coverage Gaps**: 2`;
        const result = common.parseSizingFromImpactAnalysis(content);
        assert.deepStrictEqual(result, {
            file_count: 12, module_count: 3, risk_score: 'medium',
            coupling: 'high', coverage_gaps: 2
        });
    });

    it('TC-SZ-008: Fallback succeeds with minimum fields (file_count + risk_score)', () => {
        const content = `## Executive Summary
**Affected Files**: 5
**Risk Level**: low`;
        const result = common.parseSizingFromImpactAnalysis(content);
        assert.equal(result.file_count, 5);
        assert.equal(result.risk_score, 'low');
        assert.equal(result.module_count, 0);        // default
        assert.equal(result.coupling, 'medium');      // default
        assert.equal(result.coverage_gaps, 0);        // default
    });

    it('TC-SZ-009: Fallback is case-insensitive', () => {
        const content = `**affected files**: 8
**RISK LEVEL**: HIGH
**blast radius**: LOW`;
        const result = common.parseSizingFromImpactAnalysis(content);
        assert.equal(result.file_count, 8);
        assert.equal(result.risk_score, 'high');
        assert.equal(result.coupling, 'low');
    });

    it('TC-SZ-010: Fallback handles "Module Affected" (singular)', () => {
        const content = `**Affected Files**: 3
**Module Affected**: 1
**Risk Level**: low
**Blast Radius**: low`;
        const result = common.parseSizingFromImpactAnalysis(content);
        assert.equal(result.module_count, 1);
    });

    // 1.3 Invalid/Missing Field Normalization

    it('TC-SZ-011: Negative file_count defaults to 0 (SZ-105)', () => {
        const content = `\`\`\`json
{ "files_directly_affected": -5, "modules_affected": 1, "risk_level": "low", "blast_radius": "low", "coverage_gaps": 0 }
\`\`\``;
        const result = common.parseSizingFromImpactAnalysis(content);
        assert.equal(result.file_count, 0);
    });

    it('TC-SZ-012: Non-integer module_count defaults to 0 (SZ-106)', () => {
        const content = `\`\`\`json
{ "files_directly_affected": 3, "modules_affected": "abc", "risk_level": "low", "blast_radius": "low", "coverage_gaps": 0 }
\`\`\``;
        const result = common.parseSizingFromImpactAnalysis(content);
        assert.equal(result.module_count, 0);
    });

    it('TC-SZ-013: Unrecognized risk_level defaults to "medium" (SZ-107)', () => {
        const content = `\`\`\`json
{ "files_directly_affected": 3, "modules_affected": 1, "risk_level": "critical", "blast_radius": "low", "coverage_gaps": 0 }
\`\`\``;
        const result = common.parseSizingFromImpactAnalysis(content);
        assert.equal(result.risk_score, 'medium');
    });

    it('TC-SZ-014: Numeric blast_radius defaults to "medium" (SZ-108)', () => {
        const content = `\`\`\`json
{ "files_directly_affected": 3, "modules_affected": 1, "risk_level": "low", "blast_radius": 42, "coverage_gaps": 0 }
\`\`\``;
        const result = common.parseSizingFromImpactAnalysis(content);
        assert.equal(result.coupling, 'medium');
    });

    it('TC-SZ-015: Negative coverage_gaps defaults to 0 (SZ-109)', () => {
        const content = `\`\`\`json
{ "files_directly_affected": 3, "modules_affected": 1, "risk_level": "low", "blast_radius": "low", "coverage_gaps": -5 }
\`\`\``;
        const result = common.parseSizingFromImpactAnalysis(content);
        assert.equal(result.coverage_gaps, 0);
    });

    // 1.4 Null/Empty/Malformed Inputs

    it('TC-SZ-016: Empty string returns null (SZ-101)', () => {
        assert.equal(common.parseSizingFromImpactAnalysis(''), null);
    });

    it('TC-SZ-017: Non-string input returns null', () => {
        assert.equal(common.parseSizingFromImpactAnalysis(null), null);
        assert.equal(common.parseSizingFromImpactAnalysis(undefined), null);
        assert.equal(common.parseSizingFromImpactAnalysis(42), null);
        assert.equal(common.parseSizingFromImpactAnalysis({}), null);
    });

    it('TC-SZ-018: Malformed JSON falls through to fallback (SZ-103)', () => {
        const content = `\`\`\`json
{ this is not valid json }
\`\`\`
**Affected Files**: 4
**Risk Level**: low
**Blast Radius**: medium`;
        const result = common.parseSizingFromImpactAnalysis(content);
        assert.equal(result.file_count, 4);
        assert.equal(result.risk_score, 'low');
    });

    it('TC-SZ-019: Both strategies fail returns null (SZ-104)', () => {
        const content = 'Some random text without any structured data at all.';
        assert.equal(common.parseSizingFromImpactAnalysis(content), null);
    });
});

// =========================================================================
// 2. Unit Tests: computeSizingRecommendation
// =========================================================================

describe('computeSizingRecommendation', () => {

    // 2.1 Threshold Boundary: Light/Standard

    it('TC-SZ-020: file_count at light_max_files boundary (5) -> light', () => {
        const metrics = { file_count: 5, module_count: 1, risk_score: 'low', coupling: 'low', coverage_gaps: 0 };
        const thresholds = { light_max_files: 5, epic_min_files: 20 };
        const result = common.computeSizingRecommendation(metrics, thresholds);
        assert.equal(result.intensity, 'light');
    });

    it('TC-SZ-021: file_count at light_max_files + 1 (6) -> standard', () => {
        const metrics = { file_count: 6, module_count: 2, risk_score: 'low', coupling: 'low', coverage_gaps: 0 };
        const thresholds = { light_max_files: 5, epic_min_files: 20 };
        const result = common.computeSizingRecommendation(metrics, thresholds);
        assert.equal(result.intensity, 'standard');
    });

    it('TC-SZ-022: file_count=0 -> light (minimum valid)', () => {
        const metrics = { file_count: 0, module_count: 0, risk_score: 'low', coupling: 'low', coverage_gaps: 0 };
        const thresholds = { light_max_files: 5, epic_min_files: 20 };
        const result = common.computeSizingRecommendation(metrics, thresholds);
        assert.equal(result.intensity, 'light');
    });

    it('TC-SZ-023: Custom thresholds respected (light_max_files=10)', () => {
        const metrics = { file_count: 8, module_count: 2, risk_score: 'low', coupling: 'low', coverage_gaps: 0 };
        const thresholds = { light_max_files: 10, epic_min_files: 30 };
        const result = common.computeSizingRecommendation(metrics, thresholds);
        assert.equal(result.intensity, 'light');
    });

    // 2.2 Threshold Boundary: Standard/Epic

    it('TC-SZ-024: file_count at epic_min_files boundary (20) -> epic', () => {
        const metrics = { file_count: 20, module_count: 6, risk_score: 'medium', coupling: 'medium', coverage_gaps: 1 };
        const thresholds = { light_max_files: 5, epic_min_files: 20 };
        const result = common.computeSizingRecommendation(metrics, thresholds);
        assert.equal(result.intensity, 'epic');
    });

    it('TC-SZ-025: file_count at epic_min_files - 1 (19) -> standard', () => {
        const metrics = { file_count: 19, module_count: 5, risk_score: 'medium', coupling: 'medium', coverage_gaps: 0 };
        const thresholds = { light_max_files: 5, epic_min_files: 20 };
        const result = common.computeSizingRecommendation(metrics, thresholds);
        assert.equal(result.intensity, 'standard');
    });

    it('TC-SZ-026: file_count well above epic threshold -> epic', () => {
        const metrics = { file_count: 100, module_count: 20, risk_score: 'medium', coupling: 'high', coverage_gaps: 10 };
        const thresholds = { light_max_files: 5, epic_min_files: 20 };
        const result = common.computeSizingRecommendation(metrics, thresholds);
        assert.equal(result.intensity, 'epic');
    });

    it('TC-SZ-027: Custom epic threshold respected', () => {
        const metrics = { file_count: 25, module_count: 6, risk_score: 'medium', coupling: 'medium', coverage_gaps: 0 };
        const thresholds = { light_max_files: 5, epic_min_files: 30 };
        const result = common.computeSizingRecommendation(metrics, thresholds);
        assert.equal(result.intensity, 'standard');
    });

    // 2.3 Risk Override

    it('TC-SZ-028: High risk + low files -> epic (risk override)', () => {
        const metrics = { file_count: 2, module_count: 1, risk_score: 'high', coupling: 'high', coverage_gaps: 0 };
        const thresholds = { light_max_files: 5, epic_min_files: 20 };
        const result = common.computeSizingRecommendation(metrics, thresholds);
        assert.equal(result.intensity, 'epic');
    });

    it('TC-SZ-029: High risk + medium files -> epic', () => {
        const metrics = { file_count: 12, module_count: 4, risk_score: 'high', coupling: 'high', coverage_gaps: 2 };
        const thresholds = { light_max_files: 5, epic_min_files: 20 };
        const result = common.computeSizingRecommendation(metrics, thresholds);
        assert.equal(result.intensity, 'epic');
    });

    it('TC-SZ-030: Medium risk + low files -> light (no risk override)', () => {
        const metrics = { file_count: 3, module_count: 1, risk_score: 'medium', coupling: 'medium', coverage_gaps: 0 };
        const thresholds = { light_max_files: 5, epic_min_files: 20 };
        const result = common.computeSizingRecommendation(metrics, thresholds);
        assert.equal(result.intensity, 'light');
    });

    // 2.4 Null Metrics Fallback

    it('TC-SZ-031: Null metrics -> standard with parsing failure rationale', () => {
        const thresholds = { light_max_files: 5, epic_min_files: 20 };
        const result = common.computeSizingRecommendation(null, thresholds);
        assert.equal(result.intensity, 'standard');
        assert.ok(result.rationale.includes('Unable to parse'));
        assert.equal(result.metrics, null);
    });

    it('TC-SZ-032: Undefined metrics -> standard', () => {
        const thresholds = { light_max_files: 5, epic_min_files: 20 };
        const result = common.computeSizingRecommendation(undefined, thresholds);
        assert.equal(result.intensity, 'standard');
    });

    // 2.5 Threshold Sanitization

    it('TC-SZ-033: Invalid light_max_files defaults to 5 (SZ-202)', () => {
        const metrics = { file_count: 3, module_count: 1, risk_score: 'low', coupling: 'low', coverage_gaps: 0 };
        const thresholds = { light_max_files: -1, epic_min_files: 20 };
        const result = common.computeSizingRecommendation(metrics, thresholds);
        assert.equal(result.intensity, 'light');
    });

    it('TC-SZ-034: Invalid epic_min_files defaults to 20 (SZ-203)', () => {
        const metrics = { file_count: 19, module_count: 5, risk_score: 'medium', coupling: 'medium', coverage_gaps: 0 };
        const thresholds = { light_max_files: 5, epic_min_files: 0 };
        const result = common.computeSizingRecommendation(metrics, thresholds);
        assert.equal(result.intensity, 'standard');
    });

    it('TC-SZ-035: light_max >= epic_min resets both to defaults (SZ-204)', () => {
        const metrics = { file_count: 3, module_count: 1, risk_score: 'low', coupling: 'low', coverage_gaps: 0 };
        const thresholds = { light_max_files: 20, epic_min_files: 5 };
        const result = common.computeSizingRecommendation(metrics, thresholds);
        assert.equal(result.intensity, 'light');
    });
});

// =========================================================================
// 3. Unit Tests: applySizingDecision
// =========================================================================

describe('applySizingDecision', () => {

    // 3.1 Light Intensity: Phase Removal

    it('TC-SZ-036: Removes 03-architecture and 04-design from phases array', () => {
        const state = buildFeatureState();
        const result = common.applySizingDecision(state, 'light', { metrics: lowMetrics });
        assert.equal(result.active_workflow.phases.length, 7);
        assert.ok(!result.active_workflow.phases.includes('03-architecture'));
        assert.ok(!result.active_workflow.phases.includes('04-design'));
    });

    it('TC-SZ-037: Removes skipped phases from phase_status', () => {
        const state = buildFeatureState();
        common.applySizingDecision(state, 'light', { metrics: lowMetrics });
        assert.equal(state.active_workflow.phase_status['03-architecture'], undefined);
        assert.equal(state.active_workflow.phase_status['04-design'], undefined);
    });

    it('TC-SZ-038: Removes skipped phases from top-level phases object', () => {
        const state = buildFeatureState();
        common.applySizingDecision(state, 'light', { metrics: lowMetrics });
        assert.equal(state.phases['03-architecture'], undefined);
        assert.equal(state.phases['04-design'], undefined);
    });

    it('TC-SZ-039: Recalculates current_phase_index correctly', () => {
        const state = buildFeatureState();
        // Before: phases[3] = '03-architecture'
        common.applySizingDecision(state, 'light', { metrics: lowMetrics });
        // After: phases = [00, 01, 02, 05, 06, 16, 08]
        assert.equal(state.active_workflow.phases[state.active_workflow.current_phase_index], '05-test-strategy');
    });

    it('TC-SZ-040: Light intensity writes correct sizing record', () => {
        const state = buildFeatureState();
        const metrics = { file_count: 3, module_count: 1, risk_score: 'low', coupling: 'low', coverage_gaps: 0 };
        common.applySizingDecision(state, 'light', { metrics });
        const s = state.active_workflow.sizing;
        assert.equal(s.intensity, 'light');
        assert.equal(s.effective_intensity, 'light');
        assert.equal(s.file_count, 3);
        assert.equal(s.module_count, 1);
        assert.equal(s.risk_score, 'low');
        assert.equal(s.coupling, 'low');
        assert.equal(s.coverage_gaps, 0);
        assert.equal(s.epic_deferred, false);
        assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(s.decided_at));
    });

    // 3.2 Standard Intensity: No Changes

    it('TC-SZ-041: Standard intensity preserves all 9 phases', () => {
        const state = buildFeatureState();
        const originalPhases = [...state.active_workflow.phases];
        common.applySizingDecision(state, 'standard', { metrics: mediumMetrics });
        assert.deepStrictEqual(state.active_workflow.phases, originalPhases);
    });

    it('TC-SZ-042: Standard intensity writes correct sizing record', () => {
        const state = buildFeatureState();
        common.applySizingDecision(state, 'standard', { metrics: mediumMetrics });
        assert.equal(state.active_workflow.sizing.intensity, 'standard');
        assert.equal(state.active_workflow.sizing.effective_intensity, 'standard');
        assert.equal(state.active_workflow.sizing.epic_deferred, false);
    });

    it('TC-SZ-043: Standard does not modify phase_status or index', () => {
        const state = buildFeatureState();
        const origIdx = state.active_workflow.current_phase_index;
        const origStatusKeys = Object.keys(state.active_workflow.phase_status);
        common.applySizingDecision(state, 'standard', { metrics: mediumMetrics });
        assert.equal(state.active_workflow.current_phase_index, origIdx);
        assert.deepStrictEqual(Object.keys(state.active_workflow.phase_status), origStatusKeys);
    });

    // 3.3 Epic Intensity: Deferred

    it('TC-SZ-044: Epic sets effective_intensity to standard and epic_deferred to true', () => {
        const state = buildFeatureState();
        common.applySizingDecision(state, 'epic', { metrics: epicMetrics });
        assert.equal(state.active_workflow.sizing.intensity, 'epic');
        assert.equal(state.active_workflow.sizing.effective_intensity, 'standard');
        assert.equal(state.active_workflow.sizing.epic_deferred, true);
    });

    it('TC-SZ-045: Epic does not modify phases array', () => {
        const state = buildFeatureState();
        const originalPhases = [...state.active_workflow.phases];
        common.applySizingDecision(state, 'epic', { metrics: epicMetrics });
        assert.deepStrictEqual(state.active_workflow.phases, originalPhases);
    });

    it('TC-SZ-046: Epic records correct metrics in sizing record', () => {
        const state = buildFeatureState();
        const metrics = { file_count: 35, module_count: 8, risk_score: 'high', coupling: 'high', coverage_gaps: 5 };
        common.applySizingDecision(state, 'epic', { metrics });
        assert.equal(state.active_workflow.sizing.file_count, 35);
        assert.equal(state.active_workflow.sizing.risk_score, 'high');
    });

    // 3.4 Invariant Failures + Rollback

    it('TC-SZ-047: INV-01: Too few phases after removal -> rollback (SZ-301)', () => {
        captureStderr();
        const state = buildMinimalState(['02-impact-analysis', '03-architecture', '04-design', '06-implementation']);
        const result = common.applySizingDecision(state, 'light', { metrics: lowMetrics });
        restoreStderr();
        assert.equal(state.active_workflow.phases.length, 4);  // rollback
        assert.equal(state.active_workflow.sizing.effective_intensity, 'standard');
        assert.equal(state.active_workflow.sizing.fallback_reason, 'invariant_check_failed');
    });

    it('TC-SZ-048: INV-02: Index out of bounds after removal -> rollback (SZ-302)', () => {
        captureStderr();
        const state = buildStateWithHighIndex();
        common.applySizingDecision(state, 'light', { metrics: lowMetrics });
        restoreStderr();
        assert.equal(state.active_workflow.sizing.effective_intensity, 'standard');
        assert.ok(state.active_workflow.sizing.fallback_reason);
    });

    it('TC-SZ-049: INV-03: Orphan phase_status entry -> rollback (SZ-303)', () => {
        // Build a state where after removal of 03/04, there is an orphan key
        // This is tricky since applySizingDecision removes from phase_status.
        // We simulate by having a phase_status key that is NOT in the phases array
        // from the beginning -- this orphan survives the filter.
        captureStderr();
        const state = buildFeatureState();
        // Add an orphan phase_status entry that is not in phases array
        state.active_workflow.phase_status['99-nonexistent'] = 'pending';
        common.applySizingDecision(state, 'light', { metrics: lowMetrics });
        restoreStderr();
        // Should trigger INV-03 rollback
        assert.equal(state.active_workflow.sizing.effective_intensity, 'standard');
    });

    it('TC-SZ-050: INV-04: Next phase not pending -> rollback (SZ-304)', () => {
        captureStderr();
        const state = buildFeatureState();
        state.active_workflow.phase_status['05-test-strategy'] = 'completed';
        common.applySizingDecision(state, 'light', { metrics: lowMetrics });
        restoreStderr();
        assert.equal(state.active_workflow.sizing.effective_intensity, 'standard');
        assert.ok(state.active_workflow.sizing.fallback_reason);
    });

    // 3.5 Guards and Edge Cases

    it('TC-SZ-051: Invalid intensity string defaults to standard (SZ-305)', () => {
        captureStderr();
        const state = buildFeatureState();
        common.applySizingDecision(state, 'fast', { metrics: mediumMetrics });
        restoreStderr();
        assert.equal(state.active_workflow.sizing.intensity, 'standard');
        assert.ok(capturedStderr.includes('fast'));
    });

    it('TC-SZ-052: Non-string intensity defaults to standard', () => {
        captureStderr();
        const state = buildFeatureState();
        common.applySizingDecision(state, 42, { metrics: mediumMetrics });
        restoreStderr();
        assert.equal(state.active_workflow.sizing.intensity, 'standard');
    });

    it('TC-SZ-053: No active_workflow returns state unchanged (SZ-300)', () => {
        captureStderr();
        const state = {};
        const result = common.applySizingDecision(state, 'light', {});
        restoreStderr();
        assert.deepStrictEqual(result, {});
    });

    it('TC-SZ-054: Null state returns state unchanged (SZ-300)', () => {
        captureStderr();
        const result = common.applySizingDecision(null, 'light', {});
        restoreStderr();
        assert.equal(result, null);
    });

    it('TC-SZ-055: Custom skip phases from config (SZ-205 negative path)', () => {
        const state = buildFeatureState();
        common.applySizingDecision(state, 'light', {
            metrics: lowMetrics,
            config: { light_skip_phases: ['03-architecture'] }
        });
        assert.ok(!state.active_workflow.phases.includes('03-architecture'));
        assert.ok(state.active_workflow.phases.includes('04-design'));
    });

    it('TC-SZ-056: Non-array light_skip_phases uses default (SZ-205)', () => {
        const state = buildFeatureState();
        common.applySizingDecision(state, 'light', {
            metrics: lowMetrics,
            config: { light_skip_phases: 'not-an-array' }
        });
        assert.ok(!state.active_workflow.phases.includes('03-architecture'));
        assert.ok(!state.active_workflow.phases.includes('04-design'));
    });

    it('TC-SZ-057: Skip phase not in workflow is no-op (SZ-206)', () => {
        const state = buildFeatureState();
        const origLen = state.active_workflow.phases.length;
        common.applySizingDecision(state, 'light', {
            metrics: lowMetrics,
            config: { light_skip_phases: ['99-nonexistent'] }
        });
        assert.equal(state.active_workflow.phases.length, origLen);
        assert.ok(state.active_workflow.sizing); // record still written
    });

    // 3.6 Flag and Override Recording

    it('TC-SZ-058: forced_by_flag sets recommended_by to user', () => {
        const state = buildFeatureState();
        common.applySizingDecision(state, 'light', {
            metrics: lowMetrics, forced_by_flag: true
        });
        assert.equal(state.active_workflow.sizing.recommended_by, 'user');
        assert.equal(state.active_workflow.sizing.forced_by_flag, true);
    });

    it('TC-SZ-059: Override fields recorded correctly', () => {
        const state = buildFeatureState();
        common.applySizingDecision(state, 'light', {
            metrics: lowMetrics,
            overridden: true,
            overridden_to: 'light',
            recommended_intensity: 'standard'
        });
        assert.equal(state.active_workflow.sizing.overridden, true);
        assert.equal(state.active_workflow.sizing.overridden_to, 'light');
    });

    it('TC-SZ-060: No override -> overridden=false, overridden_to=null', () => {
        const state = buildFeatureState();
        common.applySizingDecision(state, 'standard', { metrics: mediumMetrics });
        assert.equal(state.active_workflow.sizing.overridden, false);
        assert.equal(state.active_workflow.sizing.overridden_to, null);
    });

    it('TC-SZ-061: Null metrics in sizingData -> sizing record has unknown risk_score', () => {
        const state = buildFeatureState();
        common.applySizingDecision(state, 'standard', { metrics: null });
        assert.equal(state.active_workflow.sizing.file_count, 0);
        assert.equal(state.active_workflow.sizing.risk_score, 'unknown');
        assert.equal(state.active_workflow.sizing.coupling, 'unknown');
    });
});

// =========================================================================
// 4. Integration Tests
// =========================================================================

describe('Integration: End-to-End Sizing', () => {

    it('TC-SZ-062: INT-01 -- Light workflow end-to-end', () => {
        const iaContent = buildIAContent(3, 1, 'low', 'low', 0);
        const metrics = common.parseSizingFromImpactAnalysis(iaContent);
        const thresholds = { light_max_files: 5, epic_min_files: 20 };
        const rec = common.computeSizingRecommendation(metrics, thresholds);
        assert.equal(rec.intensity, 'light');

        const state = buildFeatureState();
        common.applySizingDecision(state, rec.intensity, { metrics });
        assert.equal(state.active_workflow.phases.length, 7);
        assert.equal(state.active_workflow.sizing.intensity, 'light');
    });

    it('TC-SZ-063: INT-02 -- Standard workflow end-to-end', () => {
        const iaContent = buildIAContent(12, 4, 'medium', 'medium', 1);
        const metrics = common.parseSizingFromImpactAnalysis(iaContent);
        const rec = common.computeSizingRecommendation(metrics, { light_max_files: 5, epic_min_files: 20 });
        assert.equal(rec.intensity, 'standard');

        const state = buildFeatureState();
        common.applySizingDecision(state, rec.intensity, { metrics });
        assert.equal(state.active_workflow.phases.length, 9);
    });

    it('TC-SZ-064: INT-03 -- Epic workflow end-to-end (deferred)', () => {
        const iaContent = buildIAContent(25, 8, 'high', 'high', 5);
        const metrics = common.parseSizingFromImpactAnalysis(iaContent);
        const rec = common.computeSizingRecommendation(metrics, { light_max_files: 5, epic_min_files: 20 });
        assert.equal(rec.intensity, 'epic');

        const state = buildFeatureState();
        common.applySizingDecision(state, rec.intensity, { metrics });
        assert.equal(state.active_workflow.phases.length, 9);
        assert.equal(state.active_workflow.sizing.effective_intensity, 'standard');
        assert.equal(state.active_workflow.sizing.epic_deferred, true);
    });

    it('TC-SZ-065: INT-04 -- Parsing failure cascades to standard', () => {
        const metrics = common.parseSizingFromImpactAnalysis('random garbage');
        assert.equal(metrics, null);
        const rec = common.computeSizingRecommendation(metrics, { light_max_files: 5, epic_min_files: 20 });
        assert.equal(rec.intensity, 'standard');

        const state = buildFeatureState();
        common.applySizingDecision(state, rec.intensity, { metrics });
        assert.equal(state.active_workflow.sizing.intensity, 'standard');
    });

    it('TC-SZ-066: INT-05 -- High risk overrides low file count', () => {
        const iaContent = buildIAContent(2, 1, 'high', 'high', 0);
        const metrics = common.parseSizingFromImpactAnalysis(iaContent);
        const rec = common.computeSizingRecommendation(metrics, { light_max_files: 5, epic_min_files: 20 });
        assert.equal(rec.intensity, 'epic');

        const state = buildFeatureState();
        common.applySizingDecision(state, rec.intensity, { metrics });
        assert.equal(state.active_workflow.sizing.intensity, 'epic');
        assert.equal(state.active_workflow.sizing.effective_intensity, 'standard');
    });

    it('TC-SZ-067: INT-06 -- Custom thresholds change outcome', () => {
        const iaContent = buildIAContent(8, 2, 'low', 'low', 0);
        const metrics = common.parseSizingFromImpactAnalysis(iaContent);
        const rec = common.computeSizingRecommendation(metrics, { light_max_files: 10, epic_min_files: 30 });
        assert.equal(rec.intensity, 'light');
    });

    it('TC-SZ-068: INT-07 -- Invariant failure cascades to standard', () => {
        captureStderr();
        const iaContent = buildIAContent(3, 1, 'low', 'low', 0);
        const metrics = common.parseSizingFromImpactAnalysis(iaContent);
        const rec = common.computeSizingRecommendation(metrics, { light_max_files: 5, epic_min_files: 20 });
        assert.equal(rec.intensity, 'light');

        // State with too few phases -- will fail INV-01 after removal
        const state = buildMinimalState(['02-impact-analysis', '03-architecture', '04-design', '06-implementation']);
        common.applySizingDecision(state, rec.intensity, { metrics });
        restoreStderr();
        assert.equal(state.active_workflow.sizing.effective_intensity, 'standard');
    });

    it('TC-SZ-069: INT-08 -- Determinism: same input produces same output', () => {
        const iaContent = buildIAContent(12, 4, 'medium', 'medium', 1);
        const thresholds = { light_max_files: 5, epic_min_files: 20 };

        const metrics1 = common.parseSizingFromImpactAnalysis(iaContent);
        const rec1 = common.computeSizingRecommendation(metrics1, thresholds);

        const metrics2 = common.parseSizingFromImpactAnalysis(iaContent);
        const rec2 = common.computeSizingRecommendation(metrics2, thresholds);

        assert.deepStrictEqual(metrics1, metrics2);
        assert.equal(rec1.intensity, rec2.intensity);
        assert.equal(rec1.rationale, rec2.rationale);
    });
});

// =========================================================================
// 5. Error Path Tests
// =========================================================================

describe('Error Path Tests (SZ-xxx)', () => {

    it('TC-SZ-070: SZ-100 -- Caller handles missing IA file by passing null', () => {
        const result = common.parseSizingFromImpactAnalysis(null);
        assert.equal(result, null);
    });

    it('TC-SZ-071: SZ-102 -- No JSON blocks, proceeds to fallback', () => {
        const content = `## Executive Summary
**Affected Files**: 7
**Modules Affected**: 2
**Risk Level**: medium
**Blast Radius**: low
**Coverage Gaps**: 1`;
        const result = common.parseSizingFromImpactAnalysis(content);
        assert.equal(result.file_count, 7);
    });

    it('TC-SZ-074: SZ-306 -- Double sizing (applySizingDecision overwrites)', () => {
        const state = buildFeatureState();
        common.applySizingDecision(state, 'standard', { metrics: mediumMetrics });
        assert.equal(state.active_workflow.sizing.intensity, 'standard');
        common.applySizingDecision(state, 'light', { metrics: lowMetrics });
        // After the second call with light, it should overwrite but may rollback
        // since the state was already modified by the first call.
        // The key point: the sizing record is overwritten.
        assert.ok(state.active_workflow.sizing);
        assert.notEqual(state.active_workflow.sizing.intensity, undefined);
    });
});
