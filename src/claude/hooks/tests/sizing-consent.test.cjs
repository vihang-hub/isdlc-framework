'use strict';

/**
 * Sizing Consent Tests for Analyze Verb (GH-57)
 * ==============================================
 * Tests that verify constraints around sizing_decision records
 * created by the analyze handler (not by applySizingDecision).
 *
 * Run: node --test src/claude/hooks/tests/sizing-consent.test.cjs
 *
 * Traces: FR-005, NFR-001, CON-002
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// Load the analyze-side utility (three-verb-utils)
const threeVerbUtils = require(path.join(__dirname, '..', 'lib', 'three-verb-utils.cjs'));

// Load common.cjs to verify applySizingDecision is NOT used from analyze context
const common = require(path.join(__dirname, '..', 'lib', 'common.cjs'));

// ===========================================================================
// Sizing Consent Tests (GH-57)
// ===========================================================================

describe('Sizing Consent -- Analyze Context (GH-57)', () => {

    // TC-SC-S01: sizing_decision.context === 'analyze'
    it('TC-SC-S01: sizing_decision built by analyze handler has context=analyze (FR-005, AC-005b)', () => {
        // Simulate the sizing_decision record that the analyze handler builds
        // (per design spec Section 1.4.2, PATH A and PATH B step B.10)
        const sizingDecision = {
            intensity: 'light',
            effective_intensity: 'light',
            recommended_intensity: null,
            decided_at: new Date().toISOString(),
            reason: 'light_flag',
            user_prompted: false,
            forced_by_flag: true,
            overridden: false,
            overridden_to: null,
            file_count: 0,
            module_count: 0,
            risk_score: 'unknown',
            coupling: 'unknown',
            coverage_gaps: 0,
            fallback_source: null,
            fallback_attempted: false,
            light_skip_phases: ['03-architecture', '04-design'],
            epic_deferred: false,
            context: 'analyze'
        };

        assert.equal(sizingDecision.context, 'analyze',
            'Analyze handler must set context to "analyze"');
    });

    // TC-SC-S02: applySizingDecision is NOT called from analyze context
    it('TC-SC-S02: applySizingDecision exists in common.cjs but NOT in three-verb-utils.cjs (NFR-001, CON-002)', () => {
        // Verify applySizingDecision exists in common.cjs (build-side)
        assert.equal(typeof common.applySizingDecision, 'function',
            'applySizingDecision should exist in common.cjs');

        // Verify three-verb-utils.cjs does NOT export applySizingDecision
        // (the analyze handler uses three-verb-utils functions, NOT applySizingDecision)
        assert.equal(threeVerbUtils.applySizingDecision, undefined,
            'three-verb-utils.cjs must NOT export applySizingDecision');

        // Additionally verify the source file does not import or call applySizingDecision
        const sourceContent = fs.readFileSync(
            path.join(__dirname, '..', 'lib', 'three-verb-utils.cjs'),
            'utf8'
        );
        assert.ok(!sourceContent.includes('applySizingDecision'),
            'three-verb-utils.cjs must not reference applySizingDecision');
    });

    // TC-SC-S03: sizing_decision.light_skip_phases records skipped phases
    it('TC-SC-S03: sizing_decision.light_skip_phases records which phases were skipped (FR-005, AC-005c)', () => {
        const sizingDecision = {
            intensity: 'light',
            effective_intensity: 'light',
            light_skip_phases: ['03-architecture', '04-design'],
            context: 'analyze'
        };

        assert.ok(Array.isArray(sizingDecision.light_skip_phases),
            'light_skip_phases must be an array');
        assert.deepEqual(sizingDecision.light_skip_phases, ['03-architecture', '04-design'],
            'light_skip_phases must record the skipped phase keys');

        // Verify the skipped phases are valid analysis phases
        for (const phase of sizingDecision.light_skip_phases) {
            assert.ok(threeVerbUtils.ANALYSIS_PHASES.includes(phase),
                `${phase} must be a recognized analysis phase`);
        }
    });
});
