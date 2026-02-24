'use strict';

/**
 * iSDLC Step File Validator Tests (CJS / node:test)
 * ===================================================
 * Unit tests for step file YAML frontmatter validation and
 * inventory validation for the roundtable analysis agent.
 *
 * Run:  node --test src/claude/hooks/tests/test-step-file-validator.test.cjs
 *
 * REQ-0027: Roundtable analysis agent with named personas
 * Traces: FR-004, FR-012, VR-STEP-001..015, CON-005
 *
 * Version: 1.0.0
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ---------------------------------------------------------------------------
// Step file validation helper (replicates roundtable agent parsing logic)
// Traces: FR-012 AC-012-01, VR-STEP-001..010
// ---------------------------------------------------------------------------

const VALID_PERSONAS = ['business-analyst', 'solutions-architect', 'system-designer'];
const VALID_DEPTHS = ['brief', 'standard', 'deep'];
const STEP_ID_REGEX = /^[0-9]{2}-[0-9]{2}$/;

/**
 * Parse and validate YAML frontmatter from step file content.
 * Returns { valid: true, frontmatter, body, bodySections } on success,
 * or { valid: false, error } on failure.
 *
 * @param {string} content - Full step file content
 * @param {object} [options] - Optional validation context
 * @param {string} [options.expectedPhase] - Expected phase prefix for cross-validation (VR-STEP-008)
 * @returns {object} Parse result
 */
function parseStepFrontmatter(content, options) {
    options = options || {};

    // Check for YAML delimiters
    if (typeof content !== 'string') {
        return { valid: false, error: 'Content is not a string' };
    }

    const lines = content.split('\n');
    if (lines[0].trim() !== '---') {
        return { valid: false, error: 'Missing opening YAML delimiter (---)' };
    }

    // Find closing delimiter
    let closingIndex = -1;
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '---') {
            closingIndex = i;
            break;
        }
    }

    if (closingIndex === -1) {
        return { valid: false, error: 'Missing closing YAML delimiter (---)' };
    }

    // Parse YAML frontmatter (simple key-value parsing for step files)
    const yamlLines = lines.slice(1, closingIndex);
    let frontmatter;
    try {
        frontmatter = parseSimpleYaml(yamlLines);
    } catch (e) {
        return { valid: false, error: 'YAML parse error: ' + e.message };
    }

    // Validate required fields
    const errors = [];

    // VR-STEP-001: step_id
    if (!frontmatter.step_id || typeof frontmatter.step_id !== 'string') {
        errors.push('Missing or invalid step_id (required, string)');
    } else if (frontmatter.step_id === '') {
        errors.push('step_id must not be empty');
    } else if (!STEP_ID_REGEX.test(frontmatter.step_id)) {
        errors.push('step_id format invalid: must match PP-NN (e.g., "01-03")');
    }

    // VR-STEP-002: title
    if (!frontmatter.title || typeof frontmatter.title !== 'string' || frontmatter.title.trim() === '') {
        errors.push('Missing or empty title (required, non-empty string)');
    } else if (frontmatter.title.length > 60) {
        errors.push('title exceeds 60 characters');
    }

    // VR-STEP-003: persona
    if (!frontmatter.persona || typeof frontmatter.persona !== 'string') {
        errors.push('Missing or invalid persona (required, string)');
    } else if (!VALID_PERSONAS.includes(frontmatter.persona)) {
        errors.push('Invalid persona value: "' + frontmatter.persona + '". Must be one of: ' + VALID_PERSONAS.join(', '));
    }

    // VR-STEP-004: depth
    if (!frontmatter.depth || typeof frontmatter.depth !== 'string') {
        errors.push('Missing or invalid depth (required, string)');
    } else if (!VALID_DEPTHS.includes(frontmatter.depth)) {
        errors.push('Invalid depth value: "' + frontmatter.depth + '". Must be one of: ' + VALID_DEPTHS.join(', '));
    }

    // VR-STEP-005: outputs
    if (!Array.isArray(frontmatter.outputs)) {
        errors.push('outputs must be a non-empty array');
    } else if (frontmatter.outputs.length === 0) {
        errors.push('outputs array must not be empty');
    }

    // VR-STEP-006: depends_on (optional, default to [])
    if (frontmatter.depends_on !== undefined) {
        if (!Array.isArray(frontmatter.depends_on)) {
            frontmatter.depends_on = [];
        }
    } else {
        frontmatter.depends_on = [];
    }

    // VR-STEP-007: skip_if (optional, default to "")
    if (frontmatter.skip_if !== undefined) {
        if (typeof frontmatter.skip_if !== 'string') {
            frontmatter.skip_if = '';
        }
    } else {
        frontmatter.skip_if = '';
    }

    if (errors.length > 0) {
        return { valid: false, error: errors.join('; '), frontmatter };
    }

    // VR-STEP-008: Cross-validate step_id with expected phase
    if (options.expectedPhase && frontmatter.step_id) {
        const phasePrefix = frontmatter.step_id.split('-')[0];
        if (phasePrefix !== options.expectedPhase) {
            errors.push('step_id prefix "' + phasePrefix + '" does not match expected phase "' + options.expectedPhase + '"');
        }
    }

    if (errors.length > 0) {
        return { valid: false, error: errors.join('; '), frontmatter };
    }

    // Parse body sections
    const bodyContent = lines.slice(closingIndex + 1).join('\n').trim();
    const bodySections = parseBodySections(bodyContent);

    return { valid: true, frontmatter, body: bodyContent, bodySections };
}

/**
 * Simple YAML parser for step file frontmatter.
 * Handles: string values (quoted/unquoted), arrays (inline YAML), empty values.
 *
 * @param {string[]} yamlLines - Lines between --- delimiters
 * @returns {object} Parsed key-value pairs
 */
function parseSimpleYaml(yamlLines) {
    const result = {};
    let currentKey = null;
    let inArray = false;
    let arrayValues = [];

    for (let i = 0; i < yamlLines.length; i++) {
        const line = yamlLines[i];
        const trimmed = line.trim();

        if (trimmed === '' || trimmed.startsWith('#')) continue;

        // Check for array continuation (indented - item)
        if (inArray && /^\s+-\s+/.test(line)) {
            const val = trimmed.replace(/^-\s+/, '').replace(/^["']|["']$/g, '');
            arrayValues.push(val);
            continue;
        } else if (inArray) {
            // End of array
            result[currentKey] = arrayValues;
            inArray = false;
            arrayValues = [];
            currentKey = null;
        }

        // Match key: value
        const kvMatch = trimmed.match(/^(\w[\w_-]*)\s*:\s*(.*)/);
        if (!kvMatch) {
            // Could be a malformed line -- check for unclosed quotes
            if (trimmed.includes('"') && (trimmed.match(/"/g) || []).length % 2 !== 0) {
                throw new Error('Unclosed quote in YAML');
            }
            continue;
        }

        const key = kvMatch[1];
        let value = kvMatch[2].trim();

        // Inline array: [item1, item2]
        if (value.startsWith('[')) {
            const arrayMatch = value.match(/^\[(.*)\]$/);
            if (arrayMatch) {
                const items = arrayMatch[1].split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
                result[key] = items.filter(s => s !== '');
            } else {
                throw new Error('Unclosed array bracket for key: ' + key);
            }
        }
        // Block array (value is empty, array items follow)
        else if (value === '') {
            // Check if next lines are array items
            if (i + 1 < yamlLines.length && /^\s+-\s+/.test(yamlLines[i + 1])) {
                currentKey = key;
                inArray = true;
                arrayValues = [];
            } else {
                result[key] = '';
            }
        }
        // Quoted string
        else if ((value.startsWith('"') && value.endsWith('"')) ||
                 (value.startsWith("'") && value.endsWith("'"))) {
            result[key] = value.slice(1, -1);
        }
        // Check for unclosed quotes
        else if ((value.startsWith('"') && !value.endsWith('"')) ||
                 (value.startsWith("'") && !value.endsWith("'"))) {
            throw new Error('Unclosed quote for key: ' + key);
        }
        // Null literal
        else if (value === 'null') {
            result[key] = null;
        }
        // Number
        else if (/^\d+$/.test(value)) {
            result[key] = parseInt(value, 10);
        }
        // Boolean
        else if (value === 'true') {
            result[key] = true;
        } else if (value === 'false') {
            result[key] = false;
        }
        // Plain string
        else {
            result[key] = value;
        }
    }

    // Flush any pending array
    if (inArray && currentKey) {
        result[currentKey] = arrayValues;
    }

    return result;
}

/**
 * Parse body sections from step file markdown content.
 * Extracts ## Brief Mode, ## Standard Mode, ## Deep Mode, ## Validation, ## Artifacts.
 *
 * @param {string} bodyContent - Markdown body after frontmatter
 * @returns {object} Keyed sections { brief, standard, deep, validation, artifacts }
 */
function parseBodySections(bodyContent) {
    const sections = {
        brief: null,
        standard: null,
        deep: null,
        validation: null,
        artifacts: null
    };

    const sectionMap = {
        '## brief mode': 'brief',
        '## standard mode': 'standard',
        '## deep mode': 'deep',
        '## validation': 'validation',
        '## artifacts': 'artifacts'
    };

    const lines = bodyContent.split('\n');
    let currentSection = null;
    let currentContent = [];

    for (const line of lines) {
        const lower = line.trim().toLowerCase();
        if (sectionMap[lower] !== undefined) {
            // Save previous section
            if (currentSection !== null) {
                sections[currentSection] = currentContent.join('\n').trim();
            }
            currentSection = sectionMap[lower];
            currentContent = [];
        } else if (currentSection !== null) {
            currentContent.push(line);
        }
    }

    // Save last section
    if (currentSection !== null) {
        sections[currentSection] = currentContent.join('\n').trim();
    }

    return sections;
}

// Export for potential reuse
// (Not currently exported from a separate module; defined in-test per test strategy design)

// ---------------------------------------------------------------------------
// Project paths
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const STEPS_BASE = path.join(PROJECT_ROOT, 'src', 'claude', 'skills', 'analysis-steps');

// Phase directory definitions
const PHASE_DIRS = {
    '00': { name: '00-quick-scan', expectedCount: 3 },
    '01': { name: '01-requirements', expectedCount: 8 },
    '02': { name: '02-impact-analysis', expectedCount: 4 },
    '03': { name: '03-architecture', expectedCount: 4 },
    '04': { name: '04-design', expectedCount: 5 }
};

const EXPECTED_FILES = {
    '00-quick-scan': [
        '01-scope-estimation.md',
        '02-keyword-search.md',
        '03-file-count.md'
    ],
    '01-requirements': [
        '01-business-context.md',
        '02-user-needs.md',
        '03-ux-journey.md',
        '04-technical-context.md',
        '05-quality-risk.md',
        '06-feature-definition.md',
        '07-user-stories.md',
        '08-prioritization.md'
    ],
    '02-impact-analysis': [
        '01-blast-radius.md',
        '02-entry-points.md',
        '03-risk-zones.md',
        '04-impact-summary.md'
    ],
    '03-architecture': [
        '01-architecture-options.md',
        '02-technology-decisions.md',
        '03-integration-design.md',
        '04-architecture-review.md'
    ],
    '04-design': [
        '01-module-design.md',
        '02-interface-contracts.md',
        '03-data-flow.md',
        '04-error-handling.md',
        '05-design-review.md'
    ]
};

// ---------------------------------------------------------------------------
// Suite B: Step File Validation (frontmatter parsing)
// Traces: FR-004, FR-012, VR-STEP-001..015
// ---------------------------------------------------------------------------

describe('Step File Validator: frontmatter validation (GH-20)', () => {
    let testDir;

    beforeEach(() => {
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'isdlc-step-val-'));
    });

    afterEach(() => {
        if (testDir && fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    // Helper to build step file content
    function makeStepFile(frontmatter, body) {
        const fm = Object.entries(frontmatter)
            .map(([k, v]) => {
                if (Array.isArray(v)) {
                    return k + ':\n' + v.map(i => '  - "' + i + '"').join('\n');
                }
                if (typeof v === 'string') return k + ': "' + v + '"';
                if (v === null) return k + ': null';
                return k + ': ' + v;
            }).join('\n');
        return '---\n' + fm + '\n---\n' + (body || '## Standard Mode\nQuestions here.');
    }

    function validFrontmatter() {
        return {
            step_id: '01-03',
            title: 'User Experience & Journeys',
            persona: 'business-analyst',
            depth: 'standard',
            outputs: ['requirements-spec.md']
        };
    }

    // --- TC-B01 ---
    it('TC-B01: Valid step file parses successfully with all required fields', () => {
        const content = makeStepFile(validFrontmatter(),
            '## Brief Mode\nDraft.\n## Standard Mode\nQuestions.\n## Deep Mode\nExtended.\n## Validation\nCriteria.\n## Artifacts\nInstructions.');
        const result = parseStepFrontmatter(content);
        assert.equal(result.valid, true, 'Should parse successfully: ' + (result.error || ''));
        assert.equal(result.frontmatter.step_id, '01-03');
        assert.equal(result.frontmatter.title, 'User Experience & Journeys');
        assert.equal(result.frontmatter.persona, 'business-analyst');
        assert.equal(result.frontmatter.depth, 'standard');
        assert.deepStrictEqual(result.frontmatter.outputs, ['requirements-spec.md']);
    });

    // --- TC-B02 ---
    it('TC-B02: step_id matching PP-NN format is accepted', () => {
        for (const id of ['00-01', '01-08', '04-05', '99-99']) {
            const content = makeStepFile({ ...validFrontmatter(), step_id: id });
            const result = parseStepFrontmatter(content);
            assert.equal(result.valid, true, 'step_id "' + id + '" should be valid: ' + (result.error || ''));
        }
    });

    // --- TC-B03 ---
    it('TC-B03: step_id with invalid format is rejected', () => {
        for (const id of ['abc', '0-01', '001-01', '00_01', '00-1', '00-001']) {
            const content = makeStepFile({ ...validFrontmatter(), step_id: id });
            const result = parseStepFrontmatter(content);
            assert.equal(result.valid, false, 'step_id "' + id + '" should be rejected');
        }
    });

    // --- TC-B04 ---
    it('TC-B04: Empty step_id is rejected', () => {
        const content = makeStepFile({ ...validFrontmatter(), step_id: '' });
        const result = parseStepFrontmatter(content);
        assert.equal(result.valid, false);
    });

    // --- TC-B05 ---
    it('TC-B05: Missing step_id field is rejected', () => {
        const fm = validFrontmatter();
        delete fm.step_id;
        const content = makeStepFile(fm);
        const result = parseStepFrontmatter(content);
        assert.equal(result.valid, false);
    });

    // --- TC-B06 ---
    it('TC-B06: title exceeding 60 characters is rejected', () => {
        // 61 chars
        const longTitle = 'A'.repeat(61);
        const content = makeStepFile({ ...validFrontmatter(), title: longTitle });
        const result = parseStepFrontmatter(content);
        assert.equal(result.valid, false, '61-char title should be rejected');

        // Exactly 60 chars should pass
        const okTitle = 'B'.repeat(60);
        const content2 = makeStepFile({ ...validFrontmatter(), title: okTitle });
        const result2 = parseStepFrontmatter(content2);
        assert.equal(result2.valid, true, '60-char title should be accepted: ' + (result2.error || ''));
    });

    // --- TC-B07 ---
    it('TC-B07: Empty title is rejected', () => {
        const content = makeStepFile({ ...validFrontmatter(), title: '' });
        const result = parseStepFrontmatter(content);
        assert.equal(result.valid, false);
    });

    // --- TC-B08 ---
    it('TC-B08: persona "business-analyst" is accepted', () => {
        const content = makeStepFile({ ...validFrontmatter(), persona: 'business-analyst' });
        const result = parseStepFrontmatter(content);
        assert.equal(result.valid, true, result.error || '');
    });

    // --- TC-B09 ---
    it('TC-B09: persona "solutions-architect" is accepted', () => {
        const content = makeStepFile({ ...validFrontmatter(), persona: 'solutions-architect' });
        const result = parseStepFrontmatter(content);
        assert.equal(result.valid, true, result.error || '');
    });

    // --- TC-B10 ---
    it('TC-B10: persona "system-designer" is accepted', () => {
        const content = makeStepFile({ ...validFrontmatter(), persona: 'system-designer' });
        const result = parseStepFrontmatter(content);
        assert.equal(result.valid, true, result.error || '');
    });

    // --- TC-B11 ---
    it('TC-B11: persona with invalid value is rejected', () => {
        for (const p of ['product-manager', 'BA', '']) {
            const content = makeStepFile({ ...validFrontmatter(), persona: p });
            const result = parseStepFrontmatter(content);
            assert.equal(result.valid, false, 'persona "' + p + '" should be rejected');
        }
    });

    // --- TC-B12 ---
    it('TC-B12: depth "brief" is accepted', () => {
        const content = makeStepFile({ ...validFrontmatter(), depth: 'brief' });
        const result = parseStepFrontmatter(content);
        assert.equal(result.valid, true, result.error || '');
    });

    // --- TC-B13 ---
    it('TC-B13: depth "standard" is accepted', () => {
        const content = makeStepFile({ ...validFrontmatter(), depth: 'standard' });
        const result = parseStepFrontmatter(content);
        assert.equal(result.valid, true, result.error || '');
    });

    // --- TC-B14 ---
    it('TC-B14: depth "deep" is accepted', () => {
        const content = makeStepFile({ ...validFrontmatter(), depth: 'deep' });
        const result = parseStepFrontmatter(content);
        assert.equal(result.valid, true, result.error || '');
    });

    // --- TC-B15 ---
    it('TC-B15: depth with invalid value is rejected', () => {
        for (const d of ['thorough', 'shallow', '']) {
            const content = makeStepFile({ ...validFrontmatter(), depth: d });
            const result = parseStepFrontmatter(content);
            assert.equal(result.valid, false, 'depth "' + d + '" should be rejected');
        }
    });

    // --- TC-B16 ---
    it('TC-B16: outputs with non-empty array is accepted', () => {
        const content1 = makeStepFile({ ...validFrontmatter(), outputs: ['requirements-spec.md'] });
        assert.equal(parseStepFrontmatter(content1).valid, true);

        const content2 = makeStepFile({ ...validFrontmatter(), outputs: ['a.md', 'b.md'] });
        assert.equal(parseStepFrontmatter(content2).valid, true);
    });

    // --- TC-B17 ---
    it('TC-B17: outputs with empty array is rejected', () => {
        const content = makeStepFile({ ...validFrontmatter(), outputs: [] });
        const result = parseStepFrontmatter(content);
        assert.equal(result.valid, false);
    });

    // --- TC-B18 ---
    it('TC-B18: outputs that is not an array is rejected', () => {
        // Test with string outputs - need to manually create since makeStepFile won't produce this
        const content = '---\nstep_id: "01-03"\ntitle: "Test"\npersona: "business-analyst"\ndepth: "standard"\noutputs: "requirements-spec.md"\n---\n## Standard Mode\nContent.';
        const result = parseStepFrontmatter(content);
        assert.equal(result.valid, false, 'string outputs should be rejected');
    });

    // --- TC-B19 ---
    it('TC-B19: depends_on as valid array is preserved', () => {
        const content = makeStepFile({
            ...validFrontmatter(),
            depends_on: ['01-01', '01-02']
        });
        const result = parseStepFrontmatter(content);
        assert.equal(result.valid, true, result.error || '');
        assert.deepStrictEqual(result.frontmatter.depends_on, ['01-01', '01-02']);
    });

    // --- TC-B20 ---
    it('TC-B20: depends_on with invalid type defaults to []', () => {
        // depends_on as a string (manual content construction)
        const content = '---\nstep_id: "01-03"\ntitle: "Test"\npersona: "business-analyst"\ndepth: "standard"\noutputs:\n  - "spec.md"\ndepends_on: "01-01"\n---\n## Standard Mode\nContent.';
        const result = parseStepFrontmatter(content);
        assert.equal(result.valid, true, result.error || '');
        assert.deepStrictEqual(result.frontmatter.depends_on, []);
    });

    // --- TC-B21 ---
    it('TC-B21: skip_if as string is preserved', () => {
        const content = '---\nstep_id: "01-03"\ntitle: "Test"\npersona: "business-analyst"\ndepth: "standard"\noutputs:\n  - "spec.md"\nskip_if: "scope === \'small\'"\n---\n## Standard Mode\nContent.';
        const result = parseStepFrontmatter(content);
        assert.equal(result.valid, true, result.error || '');
        assert.ok(typeof result.frontmatter.skip_if === 'string');
    });

    // --- TC-B22 ---
    it('TC-B22: skip_if with non-string type defaults to ""', () => {
        const content = '---\nstep_id: "01-03"\ntitle: "Test"\npersona: "business-analyst"\ndepth: "standard"\noutputs:\n  - "spec.md"\nskip_if: 42\n---\n## Standard Mode\nContent.';
        const result = parseStepFrontmatter(content);
        assert.equal(result.valid, true, result.error || '');
        assert.equal(result.frontmatter.skip_if, '');
    });

    // --- TC-B23 ---
    it('TC-B23: Step body contains ## Standard Mode section', () => {
        const content = makeStepFile(validFrontmatter(), '## Standard Mode\nSome questions here.');
        const result = parseStepFrontmatter(content);
        assert.equal(result.valid, true, result.error || '');
        assert.ok(result.bodySections.standard !== null, 'Should extract Standard Mode section');
        assert.ok(result.bodySections.standard.includes('Some questions here'));
    });

    // --- TC-B24 ---
    it('TC-B24: Step body missing ## Standard Mode falls back to raw body', () => {
        const content = '---\nstep_id: "01-03"\ntitle: "Test"\npersona: "business-analyst"\ndepth: "standard"\noutputs:\n  - "spec.md"\n---\nSome raw body content without sections.';
        const result = parseStepFrontmatter(content);
        assert.equal(result.valid, true, result.error || '');
        assert.equal(result.bodySections.standard, null, 'Standard section should be null');
        // Raw body is still available
        assert.ok(result.body.includes('Some raw body content'));
    });

    // --- TC-B25 ---
    it('TC-B25: Malformed YAML frontmatter returns parse error', () => {
        const content = '---\nstep_id: "unclosed string\n---';
        const result = parseStepFrontmatter(content);
        assert.equal(result.valid, false);
        assert.ok(result.error.includes('Unclosed') || result.error.includes('parse'), 'Error should mention parse issue: ' + result.error);
    });

    // --- TC-B26 ---
    it('TC-B26: Missing YAML delimiters returns parse error', () => {
        const content = 'No frontmatter here, just markdown content.';
        const result = parseStepFrontmatter(content);
        assert.equal(result.valid, false);
        assert.ok(result.error.includes('delimiter'), 'Error should mention missing delimiter');
    });

    // --- TC-B27 ---
    it('TC-B27: step_id matches parent directory phase number (VR-STEP-008)', () => {
        const content = makeStepFile({ ...validFrontmatter(), step_id: '01-03' });
        const result = parseStepFrontmatter(content, { expectedPhase: '01' });
        assert.equal(result.valid, true, result.error || '');

        // Mismatch: file is in directory 02 but step_id starts with 01
        const result2 = parseStepFrontmatter(content, { expectedPhase: '02' });
        assert.equal(result2.valid, false, 'Mismatched phase prefix should fail');
    });

    // --- TC-B28 ---
    it('TC-B28: Duplicate step_id across files is detected', () => {
        // Simulate checking two files with same step_id
        const seenIds = new Set();
        const duplicates = [];

        const files = [
            { name: 'file1.md', content: makeStepFile({ ...validFrontmatter(), step_id: '01-01' }) },
            { name: 'file2.md', content: makeStepFile({ ...validFrontmatter(), step_id: '01-01' }) }
        ];

        for (const f of files) {
            const result = parseStepFrontmatter(f.content);
            if (result.valid) {
                if (seenIds.has(result.frontmatter.step_id)) {
                    duplicates.push(result.frontmatter.step_id);
                }
                seenIds.add(result.frontmatter.step_id);
            }
        }

        assert.equal(duplicates.length, 1, 'Should detect 1 duplicate');
        assert.equal(duplicates[0], '01-01');
    });
});

// ---------------------------------------------------------------------------
// Suite C: Step File Inventory Validation
// Traces: FR-004 AC-004-01, FR-012, CON-005
// ---------------------------------------------------------------------------

describe('Step File Inventory Validation (GH-20)', () => {

    // --- TC-C01 ---
    it('TC-C01: All 3 Phase 00 step files exist', () => {
        const dir = path.join(STEPS_BASE, '00-quick-scan');
        for (const file of EXPECTED_FILES['00-quick-scan']) {
            const filePath = path.join(dir, file);
            assert.ok(fs.existsSync(filePath), 'Missing: ' + filePath);
        }
    });

    // --- TC-C02 ---
    it('TC-C02: All 8 Phase 01 step files exist', () => {
        const dir = path.join(STEPS_BASE, '01-requirements');
        for (const file of EXPECTED_FILES['01-requirements']) {
            const filePath = path.join(dir, file);
            assert.ok(fs.existsSync(filePath), 'Missing: ' + filePath);
        }
    });

    // --- TC-C03 ---
    it('TC-C03: All 4 Phase 02 step files exist', () => {
        const dir = path.join(STEPS_BASE, '02-impact-analysis');
        for (const file of EXPECTED_FILES['02-impact-analysis']) {
            const filePath = path.join(dir, file);
            assert.ok(fs.existsSync(filePath), 'Missing: ' + filePath);
        }
    });

    // --- TC-C04 ---
    it('TC-C04: All 4 Phase 03 step files exist', () => {
        const dir = path.join(STEPS_BASE, '03-architecture');
        for (const file of EXPECTED_FILES['03-architecture']) {
            const filePath = path.join(dir, file);
            assert.ok(fs.existsSync(filePath), 'Missing: ' + filePath);
        }
    });

    // --- TC-C05 ---
    it('TC-C05: All 5 Phase 04 step files exist', () => {
        const dir = path.join(STEPS_BASE, '04-design');
        for (const file of EXPECTED_FILES['04-design']) {
            const filePath = path.join(dir, file);
            assert.ok(fs.existsSync(filePath), 'Missing: ' + filePath);
        }
    });

    // --- TC-C06 ---
    it('TC-C06: Every step file has valid YAML frontmatter', () => {
        for (const [phaseName, files] of Object.entries(EXPECTED_FILES)) {
            const dir = path.join(STEPS_BASE, phaseName);
            for (const file of files) {
                const filePath = path.join(dir, file);
                if (!fs.existsSync(filePath)) {
                    assert.fail('File missing (cannot validate frontmatter): ' + filePath);
                }
                const content = fs.readFileSync(filePath, 'utf8');
                const phaseNum = phaseName.split('-')[0];
                const result = parseStepFrontmatter(content, { expectedPhase: phaseNum });
                assert.equal(result.valid, true, 'Invalid frontmatter in ' + filePath + ': ' + (result.error || ''));
            }
        }
    });

    // --- TC-C07 ---
    it('TC-C07: All step_ids match their file location (VR-STEP-008)', () => {
        for (const [phaseName, files] of Object.entries(EXPECTED_FILES)) {
            const dir = path.join(STEPS_BASE, phaseName);
            const phaseNum = phaseName.split('-')[0];
            for (const file of files) {
                const filePath = path.join(dir, file);
                if (!fs.existsSync(filePath)) continue;
                const content = fs.readFileSync(filePath, 'utf8');
                const result = parseStepFrontmatter(content);
                if (!result.valid) continue;

                const stepNum = file.split('-')[0];
                const expectedStepId = phaseNum + '-' + stepNum;
                assert.equal(result.frontmatter.step_id, expectedStepId,
                    'step_id mismatch in ' + filePath + ': expected ' + expectedStepId + ', got ' + result.frontmatter.step_id);
            }
        }
    });

    // --- TC-C08 ---
    it('TC-C08: No duplicate step_ids across all 24 files', () => {
        const allIds = new Set();
        const duplicates = [];

        for (const [phaseName, files] of Object.entries(EXPECTED_FILES)) {
            const dir = path.join(STEPS_BASE, phaseName);
            for (const file of files) {
                const filePath = path.join(dir, file);
                if (!fs.existsSync(filePath)) continue;
                const content = fs.readFileSync(filePath, 'utf8');
                const result = parseStepFrontmatter(content);
                if (result.valid) {
                    if (allIds.has(result.frontmatter.step_id)) {
                        duplicates.push(result.frontmatter.step_id + ' in ' + filePath);
                    }
                    allIds.add(result.frontmatter.step_id);
                }
            }
        }

        assert.equal(duplicates.length, 0, 'Duplicate step_ids found: ' + duplicates.join(', '));
        assert.equal(allIds.size, 24, 'Expected 24 unique step_ids, got ' + allIds.size);
    });

    // --- TC-C09 ---
    it('TC-C09: All step files follow NN-name.md naming convention', () => {
        const nameRegex = /^\d{2}-[\w-]+\.md$/;
        for (const [phaseName, files] of Object.entries(EXPECTED_FILES)) {
            for (const file of files) {
                assert.ok(nameRegex.test(file), 'Filename "' + file + '" does not match NN-name.md convention');
            }
        }
    });

    // --- TC-C10 ---
    it('TC-C10: Every step file body contains ## Standard Mode section', () => {
        for (const [phaseName, files] of Object.entries(EXPECTED_FILES)) {
            const dir = path.join(STEPS_BASE, phaseName);
            for (const file of files) {
                const filePath = path.join(dir, file);
                if (!fs.existsSync(filePath)) continue;
                const content = fs.readFileSync(filePath, 'utf8');
                const result = parseStepFrontmatter(content);
                if (!result.valid) continue;
                assert.ok(result.bodySections.standard !== null,
                    'Missing ## Standard Mode in ' + filePath);
            }
        }
    });
});
