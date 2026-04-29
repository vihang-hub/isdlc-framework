/**
 * Tests for quality enforcement utilities in common.cjs
 * Traces to: FR-003, FR-005, FR-002 — AC-003-02, AC-003-03, AC-003-05, AC-003-06,
 *            AC-005-02, AC-005-03, AC-002-02
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const commonPath = path.join(__dirname, '..', 'lib', 'common.cjs');
const {
    extractACsFromSpec,
    scanTestTraces,
    countAssertions,
    detectErrorPaths,
    detectExternalInputs,
    checkValidationProximity,
    parseDeferralPatterns
} = require(commonPath);

// =========================================================================
// extractACsFromSpec — traces: AC-003-02
// =========================================================================

describe('extractACsFromSpec', () => {
    // CQU-01
    it('extracts AC-NNN-NN identifiers from standard format', () => {
        const spec = '- AC-001-01: Given Article I, then it is updated\n- AC-001-02: Given Article II, then updated';
        const result = extractACsFromSpec(spec);
        assert.equal(result.length, 2);
        assert.equal(result[0].id, 'AC-001-01');
        assert.equal(result[1].id, 'AC-001-02');
    });

    // CQU-02
    it('extracts AC IDs from multi-FR spec', () => {
        const lines = [];
        for (let fr = 1; fr <= 7; fr++) {
            for (let ac = 1; ac <= 4; ac++) {
                lines.push(`- AC-${String(fr).padStart(3, '0')}-${String(ac).padStart(2, '0')}: desc ${fr}-${ac}`);
            }
        }
        const result = extractACsFromSpec(lines.join('\n'));
        assert.equal(result.length, 28);
    });

    // CQU-03
    it('returns empty array for spec with no ACs', () => {
        const result = extractACsFromSpec('# Requirements\n\nThis is a spec with no AC patterns.');
        assert.deepEqual(result, []);
    });

    // CQU-04
    it('handles AC IDs at start/end of line', () => {
        const spec = 'AC-001-01: first line description\nsome text AC-001-02: last item';
        const result = extractACsFromSpec(spec);
        assert.equal(result.length, 2);
    });

    // CQU-05
    it('does not extract malformed AC IDs', () => {
        const spec = 'AC-1-1 invalid, AC1-01 also invalid, AC-001 incomplete';
        const result = extractACsFromSpec(spec);
        assert.deepEqual(result, []);
    });

    // CQU-06
    it('captures description text after AC ID', () => {
        const spec = '- AC-001-01: Given X, then Y happens';
        const result = extractACsFromSpec(spec);
        assert.equal(result.length, 1);
        assert.ok(result[0].description.includes('Given X'));
    });

    it('returns empty array for null/undefined input', () => {
        assert.deepEqual(extractACsFromSpec(null), []);
        assert.deepEqual(extractACsFromSpec(undefined), []);
        assert.deepEqual(extractACsFromSpec(''), []);
    });

    it('deduplicates AC IDs', () => {
        const spec = 'AC-001-01: first\nAC-001-01: duplicate';
        const result = extractACsFromSpec(spec);
        assert.equal(result.length, 1);
    });
});

// =========================================================================
// scanTestTraces — traces: AC-003-03
// =========================================================================

describe('scanTestTraces', () => {
    // CQU-07
    it('finds trace annotations in test descriptions', () => {
        const testContent = "it('AC-001-01: should do something', () => {});";
        const result = scanTestTraces(testContent, ['AC-001-01']);
        assert.deepEqual(result.covered, ['AC-001-01']);
        assert.deepEqual(result.uncovered, []);
    });

    // CQU-08
    it('finds trace annotations in comments', () => {
        const testContent = '// traces: AC-001-01, AC-001-02\nit("test", () => {});';
        const result = scanTestTraces(testContent, ['AC-001-01', 'AC-001-02']);
        assert.deepEqual(result.covered, ['AC-001-01', 'AC-001-02']);
    });

    // CQU-09
    it('detects uncovered ACs', () => {
        const testContent = "it('AC-001-01: test', () => {});";
        const result = scanTestTraces(testContent, ['AC-001-01', 'AC-001-02']);
        assert.deepEqual(result.covered, ['AC-001-01']);
        assert.deepEqual(result.uncovered, ['AC-001-02']);
    });

    // CQU-10
    it('handles mixed trace formats', () => {
        const testContent = "// traces: AC-001-01\nit('AC-001-02: test', () => {});";
        const result = scanTestTraces(testContent, ['AC-001-01', 'AC-001-02']);
        assert.deepEqual(result.covered, ['AC-001-01', 'AC-001-02']);
    });

    // CQU-11
    it('returns all uncovered for empty test content', () => {
        const result = scanTestTraces('', ['AC-001-01']);
        assert.deepEqual(result.uncovered, ['AC-001-01']);
    });

    // CQU-12
    it('returns empty arrays for empty AC ID list', () => {
        const result = scanTestTraces('some content', []);
        assert.deepEqual(result, { covered: [], uncovered: [] });
    });
});

// =========================================================================
// countAssertions — traces: AC-003-05
// =========================================================================

describe('countAssertions', () => {
    // CQU-13
    it('counts assert.* calls', () => {
        const content = "it('test', () => {\n  assert.equal(a, b);\n  assert.ok(c);\n});";
        const result = countAssertions(content);
        assert.equal(result.length, 1);
        assert.ok(result[0].count >= 2, `Expected >= 2 assertions, got ${result[0].count}`);
    });

    // CQU-14
    it('counts assert/strict patterns', () => {
        const content = "it('test', () => {\n  assert.strictEqual(a, b);\n  assert.deepStrictEqual(c, d);\n});";
        const result = countAssertions(content);
        assert.equal(result.length, 1);
        assert.ok(result[0].count >= 2);
    });

    // CQU-15
    it('counts expect() patterns', () => {
        const content = "it('test', () => {\n  expect(x).toBe(y);\n});";
        const result = countAssertions(content);
        assert.equal(result.length, 1);
        assert.ok(result[0].count >= 1);
    });

    // CQU-16
    it('flags test block with zero assertions', () => {
        const content = "it('test', () => {\n  const x = 1;\n});";
        const result = countAssertions(content);
        assert.equal(result.length, 1);
        assert.equal(result[0].count, 0);
        assert.equal(result[0].testName, 'test');
    });

    // CQU-17
    it('counts assertions per describe/it block', () => {
        const content = "it('test1', () => {\n  assert.ok(true);\n});\nit('test2', () => {\n  assert.ok(a);\n  assert.ok(b);\n});";
        const result = countAssertions(content);
        assert.equal(result.length, 2);
    });

    // CQU-18
    it('counts .should assertions', () => {
        const content = "it('test', () => {\n  x.should.equal(1);\n});";
        const result = countAssertions(content);
        assert.equal(result.length, 1);
        assert.ok(result[0].count >= 1);
    });

    // CQU-19
    it('does not count assertions in comments', () => {
        const content = "it('test', () => {\n  // assert.ok(true);\n  /* assert.ok(false); */\n});";
        const result = countAssertions(content);
        assert.equal(result.length, 1);
        assert.equal(result[0].count, 0);
    });

    it('returns empty for null/undefined', () => {
        assert.deepEqual(countAssertions(null), []);
        assert.deepEqual(countAssertions(''), []);
    });
});

// =========================================================================
// detectErrorPaths — traces: AC-003-06
// =========================================================================

describe('detectErrorPaths', () => {
    // CQU-20
    it('detects try/catch blocks', () => {
        const content = 'try {\n  doSomething();\n} catch (e) {\n  handleError(e);\n}';
        const result = detectErrorPaths(content);
        assert.ok(result.length >= 1);
        assert.ok(result.some(r => r.pattern === 'try/catch'));
    });

    // CQU-21
    it('detects throw statements', () => {
        const content = "throw new Error('x');";
        const result = detectErrorPaths(content);
        assert.ok(result.some(r => r.pattern === 'throw'));
    });

    // CQU-22
    it('detects Promise .catch handlers', () => {
        const content = 'promise.catch(err => console.error(err));';
        const result = detectErrorPaths(content);
        assert.ok(result.some(r => r.pattern === '.catch'));
    });

    // CQU-23
    it('returns empty for code without error paths', () => {
        const content = 'const x = 1 + 2;\nconst y = "hello";';
        const result = detectErrorPaths(content);
        assert.deepEqual(result, []);
    });

    // CQU-24
    it('detects reject callbacks', () => {
        const content = "reject(new Error('failed'));";
        const result = detectErrorPaths(content);
        assert.ok(result.some(r => r.pattern === 'reject'));
    });

    it('returns empty for null input', () => {
        assert.deepEqual(detectErrorPaths(null), []);
    });
});

// =========================================================================
// detectExternalInputs — traces: AC-005-02
// =========================================================================

describe('detectExternalInputs', () => {
    // CQU-25
    it('detects req.body', () => {
        const content = 'const data = req.body;';
        const result = detectExternalInputs(content);
        assert.ok(result.some(r => r.pattern === 'req.body' && r.type === 'http'));
    });

    // CQU-26
    it('detects req.params', () => {
        const content = 'const id = req.params.id;';
        const result = detectExternalInputs(content);
        assert.ok(result.some(r => r.pattern === 'req.params' && r.type === 'http'));
    });

    // CQU-27
    it('detects req.query', () => {
        const content = 'const q = req.query.search;';
        const result = detectExternalInputs(content);
        assert.ok(result.some(r => r.pattern === 'req.query' && r.type === 'http'));
    });

    // CQU-28
    it('detects process.argv', () => {
        const content = 'const arg = process.argv[2];';
        const result = detectExternalInputs(content);
        assert.ok(result.some(r => r.pattern === 'process.argv' && r.type === 'cli'));
    });

    // CQU-29
    it('detects JSON.parse', () => {
        const content = 'const obj = JSON.parse(externalData);';
        const result = detectExternalInputs(content);
        assert.ok(result.some(r => r.pattern === 'JSON.parse' && r.type === 'parse'));
    });

    // CQU-30
    it('detects process.env', () => {
        const content = 'const secret = process.env.SECRET;';
        const result = detectExternalInputs(content);
        assert.ok(result.some(r => r.pattern === 'process.env' && r.type === 'env'));
    });

    // CQU-31
    it('detects fs.readFileSync with user path', () => {
        const content = 'const data = fs.readFileSync(userPath);';
        const result = detectExternalInputs(content);
        assert.ok(result.some(r => r.pattern === 'fs.readFileSync' && r.type === 'filesystem'));
    });

    // CQU-32
    it('returns empty for internal-only code', () => {
        const content = 'const x = { a: 1 };\nconst s = JSON.stringify(x);';
        const result = detectExternalInputs(content);
        assert.deepEqual(result, []);
    });

    it('skips commented-out inputs', () => {
        const content = '// const data = req.body;';
        const result = detectExternalInputs(content);
        assert.deepEqual(result, []);
    });
});

// =========================================================================
// checkValidationProximity — traces: AC-005-03
// =========================================================================

describe('checkValidationProximity', () => {
    // CQU-33
    it('finds validation within 15 lines (default radius)', () => {
        const lines = ['const data = req.body;'];
        for (let i = 0; i < 9; i++) lines.push('// filler');
        lines.push('if (typeof data === "string") {}');
        const result = checkValidationProximity(lines.join('\n'), 1, 15);
        assert.equal(result, true);
    });

    // CQU-34
    it('returns false when no validation within radius', () => {
        const lines = ['const data = req.body;'];
        for (let i = 0; i < 20; i++) lines.push('// filler');
        lines.push('if (typeof data === "string") {}');
        const result = checkValidationProximity(lines.join('\n'), 1, 15);
        assert.equal(result, false);
    });

    // CQU-35
    it('detects typeof check', () => {
        const content = 'const x = input;\nif (typeof x === "string") {}';
        assert.equal(checkValidationProximity(content, 1, 15), true);
    });

    // CQU-36
    it('detects schema validation', () => {
        const content = 'const data = input;\nschema.validate(data);';
        assert.equal(checkValidationProximity(content, 1, 15), true);
    });

    // CQU-37
    it('detects assertion-style validation', () => {
        const content = "const data = input;\nassert(data, 'required');";
        assert.equal(checkValidationProximity(content, 1, 15), true);
    });

    // CQU-38
    it('detects null/undefined checks', () => {
        const content = 'const data = input;\nif (data == null) throw new Error();';
        assert.equal(checkValidationProximity(content, 1, 15), true);
    });

    // CQU-39
    it('custom radius parameter', () => {
        const lines = ['const data = req.body;'];
        for (let i = 0; i < 5; i++) lines.push('// filler');
        lines.push('if (typeof data === "string") {}');
        const result = checkValidationProximity(lines.join('\n'), 1, 5);
        assert.equal(result, false);
    });

    // CQU-40
    it('validation at exactly radius boundary', () => {
        const lines = ['const data = req.body;'];
        for (let i = 0; i < 14; i++) lines.push('// filler');
        lines.push('if (typeof data === "string") {}');
        const result = checkValidationProximity(lines.join('\n'), 1, 15);
        assert.equal(result, true);
    });

    it('returns false for null input', () => {
        assert.equal(checkValidationProximity(null, 1, 15), false);
    });
});

// =========================================================================
// parseDeferralPatterns — traces: AC-002-02
// =========================================================================

describe('parseDeferralPatterns', () => {
    // CQU-41
    it('detects "TODO later"', () => {
        const content = '// TODO later: add rate limiting';
        const result = parseDeferralPatterns(content);
        assert.equal(result.length, 1);
        assert.equal(result[0].line, 1);
        assert.ok(result[0].pattern.includes('TODO later'));
    });

    // CQU-42
    it('detects "FIXME next"', () => {
        const content = '// FIXME next iteration';
        const result = parseDeferralPatterns(content);
        assert.equal(result.length, 1);
    });

    // CQU-43
    it('detects "will handle later"', () => {
        const content = '// will handle later';
        const result = parseDeferralPatterns(content);
        assert.equal(result.length, 1);
    });

    // CQU-44
    it('detects "add later"', () => {
        const content = '// add later';
        const result = parseDeferralPatterns(content);
        assert.equal(result.length, 1);
    });

    // CQU-45
    it('detects "implement later"', () => {
        const content = '// implement later';
        const result = parseDeferralPatterns(content);
        assert.equal(result.length, 1);
    });

    // CQU-46
    it('detects "future work"', () => {
        const content = '// future work: refactor this';
        const result = parseDeferralPatterns(content);
        assert.equal(result.length, 1);
    });

    // CQU-47
    it('does not flag bare TODO', () => {
        const content = '// TODO: implement validation';
        const result = parseDeferralPatterns(content);
        assert.deepEqual(result, []);
    });

    // CQU-48
    it('does not flag bare FIXME', () => {
        const content = '// FIXME: broken regex';
        const result = parseDeferralPatterns(content);
        assert.deepEqual(result, []);
    });

    // CQU-49
    it('case insensitive matching', () => {
        const content = '// todo LATER';
        const result = parseDeferralPatterns(content);
        assert.equal(result.length, 1);
    });

    // CQU-50
    it('multiple deferrals in one file', () => {
        const content = '// TODO later: thing 1\n// will handle later\n// future work: thing 3';
        const result = parseDeferralPatterns(content);
        assert.equal(result.length, 3);
    });

    it('returns empty for null input', () => {
        assert.deepEqual(parseDeferralPatterns(null), []);
        assert.deepEqual(parseDeferralPatterns(''), []);
    });

    it('detects "TODO: something later"', () => {
        const content = '// TODO: add rate limiting later';
        const result = parseDeferralPatterns(content);
        assert.equal(result.length, 1);
    });

    it('detects "FIXME: next sprint"', () => {
        const content = '// FIXME: fix this next sprint';
        const result = parseDeferralPatterns(content);
        assert.equal(result.length, 1);
    });

    it('detects "deferred to next"', () => {
        const content = '// deferred to next release';
        const result = parseDeferralPatterns(content);
        assert.equal(result.length, 1);
    });
});
