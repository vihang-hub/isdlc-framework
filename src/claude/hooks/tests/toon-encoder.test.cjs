'use strict';

/**
 * Unit Tests: TOON Encoder/Decoder (REQ-0040)
 * ============================================
 * Tests for isUniformArray(), encode(), decode(), and round-trip correctness.
 *
 * Framework: node:test + node:assert/strict (CJS stream)
 * Run: node --test src/claude/hooks/tests/toon-encoder.test.cjs
 *
 * Traces to: REQ-0040 FR-001 (encode), FR-002 (decode), ADR-0040-01 (native CJS)
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ---------------------------------------------------------------------------
// Module loading — copy source to temp dir per hook test conventions
// ---------------------------------------------------------------------------

const TOON_SRC = path.resolve(__dirname, '..', 'lib', 'toon-encoder.cjs');

let toon;
let tmpDir;

function loadModule() {
    // Copy to temp directory for test isolation (standard hook test pattern)
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'isdlc-toon-test-'));
    const libDir = path.join(tmpDir, 'lib');
    fs.mkdirSync(libDir, { recursive: true });
    const dest = path.join(libDir, 'toon-encoder.cjs');
    fs.copyFileSync(TOON_SRC, dest);
    // Clear require cache and load from temp
    delete require.cache[require.resolve(dest)];
    toon = require(dest);
}

function cleanupModule() {
    if (tmpDir && fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    tmpDir = null;
}

// =============================================================================
// isUniformArray() tests (7 tests)
// =============================================================================

describe('isUniformArray()', () => {
    before(() => loadModule());
    after(() => cleanupModule());

    // TC-UNI-01
    it('TC-UNI-01: returns true for array of objects with identical keys', () => {
        const data = [
            { name: 'Alice', age: 30 },
            { name: 'Bob', age: 25 }
        ];
        assert.equal(toon.isUniformArray(data), true);
    });

    // TC-UNI-02
    it('TC-UNI-02: returns false for empty array', () => {
        assert.equal(toon.isUniformArray([]), false);
    });

    // TC-UNI-03
    it('TC-UNI-03: returns false for non-array inputs', () => {
        assert.equal(toon.isUniformArray(null), false);
        assert.equal(toon.isUniformArray(undefined), false);
        assert.equal(toon.isUniformArray('string'), false);
        assert.equal(toon.isUniformArray(42), false);
        assert.equal(toon.isUniformArray({}), false);
    });

    // TC-UNI-04
    it('TC-UNI-04: returns false for array of primitives', () => {
        assert.equal(toon.isUniformArray([1, 2, 3]), false);
        assert.equal(toon.isUniformArray(['a', 'b']), false);
    });

    // TC-UNI-05
    it('TC-UNI-05: returns false for mixed-key objects', () => {
        const data = [
            { name: 'Alice', age: 30 },
            { name: 'Bob', score: 100 }
        ];
        assert.equal(toon.isUniformArray(data), false);
    });

    // TC-UNI-06
    it('TC-UNI-06: returns false for array containing null or nested arrays', () => {
        assert.equal(toon.isUniformArray([null, { a: 1 }]), false);
        assert.equal(toon.isUniformArray([[1, 2], [3, 4]]), false);
    });

    // TC-UNI-07
    it('TC-UNI-07: returns true for single-element array', () => {
        assert.equal(toon.isUniformArray([{ id: 1 }]), true);
    });
});

// =============================================================================
// encode() tests (21 tests)
// =============================================================================

describe('encode()', () => {
    before(() => loadModule());
    after(() => cleanupModule());

    // TC-ENC-01
    it('TC-ENC-01: encodes simple string values bare/unquoted', () => {
        const data = [{ name: 'hello', type: 'world' }];
        const result = toon.encode(data);
        assert.ok(result.includes('hello,world'));
        assert.ok(!result.includes('"hello"'));
    });

    // TC-ENC-02
    it('TC-ENC-02: encodes header with correct row count and field names', () => {
        const data = [
            { id: 1, name: 'A' },
            { id: 2, name: 'B' },
            { id: 3, name: 'C' }
        ];
        const result = toon.encode(data);
        const firstLine = result.split('\n')[0];
        assert.equal(firstLine, '[3]{id,name}:');
    });

    // TC-ENC-03
    it('TC-ENC-03: encodes data rows with two-space indentation', () => {
        const data = [{ x: 1 }];
        const result = toon.encode(data);
        const lines = result.split('\n');
        assert.equal(lines[1], '  1');
    });

    // TC-ENC-04
    it('TC-ENC-04: encodes numbers as numeric literals', () => {
        const data = [{ val: 42 }, { val: 3.14 }, { val: -7 }];
        const result = toon.encode(data);
        assert.ok(result.includes('42'));
        assert.ok(result.includes('3.14'));
        assert.ok(result.includes('-7'));
    });

    // TC-ENC-05
    it('TC-ENC-05: encodes booleans as true/false', () => {
        const data = [{ active: true }, { active: false }];
        const result = toon.encode(data);
        const lines = result.split('\n');
        assert.equal(lines[1].trim(), 'true');
        assert.equal(lines[2].trim(), 'false');
    });

    // TC-ENC-06
    it('TC-ENC-06: encodes null as null literal', () => {
        const data = [{ val: null }];
        const result = toon.encode(data);
        assert.ok(result.includes('  null'));
    });

    // TC-ENC-07
    it('TC-ENC-07: encodes undefined as null literal', () => {
        const data = [{ val: undefined }];
        const result = toon.encode(data);
        assert.ok(result.includes('  null'));
    });

    // TC-ENC-08
    it('TC-ENC-08: quotes strings containing commas', () => {
        const data = [{ val: 'a,b' }];
        const result = toon.encode(data);
        assert.ok(result.includes('"a,b"'));
    });

    // TC-ENC-09
    it('TC-ENC-09: quotes and escapes strings containing double quotes', () => {
        const data = [{ val: 'say "hi"' }];
        const result = toon.encode(data);
        assert.ok(result.includes('"say \\"hi\\""'));
    });

    // TC-ENC-10
    it('TC-ENC-10: quotes and escapes strings containing newlines', () => {
        const data = [{ val: 'line1\nline2' }];
        const result = toon.encode(data);
        assert.ok(result.includes('"line1\\nline2"'));
    });

    // TC-ENC-11
    it('TC-ENC-11: quotes and escapes strings containing backslashes', () => {
        const data = [{ val: 'path\\to\\file' }];
        const result = toon.encode(data);
        assert.ok(result.includes('"path\\\\to\\\\file"'));
    });

    // TC-ENC-12
    it('TC-ENC-12: encodes empty strings as quoted empty string', () => {
        const data = [{ val: '' }];
        const result = toon.encode(data);
        assert.ok(result.includes('  ""'));
    });

    // TC-ENC-13
    it('TC-ENC-13: encodes nested objects via JSON.stringify', () => {
        const data = [{ meta: { a: 1 } }];
        const result = toon.encode(data);
        assert.ok(result.includes('{"a":1}'));
    });

    // TC-ENC-14
    it('TC-ENC-14: encodes nested arrays via JSON.stringify', () => {
        const data = [{ items: [1, 2, 3] }];
        const result = toon.encode(data);
        assert.ok(result.includes('[1,2,3]'));
    });

    // TC-ENC-15
    it('TC-ENC-15: throws TypeError for non-uniform array', () => {
        assert.throws(
            () => toon.encode([{ a: 1 }, { b: 2 }]),
            { name: 'TypeError' }
        );
    });

    // TC-ENC-16
    it('TC-ENC-16: throws TypeError for non-array input', () => {
        assert.throws(() => toon.encode('not an array'), { name: 'TypeError' });
        assert.throws(() => toon.encode(42), { name: 'TypeError' });
        assert.throws(() => toon.encode(null), { name: 'TypeError' });
    });

    // TC-ENC-17
    it('TC-ENC-17: throws TypeError for empty array', () => {
        assert.throws(() => toon.encode([]), { name: 'TypeError' });
    });

    // TC-ENC-18
    it('TC-ENC-18: throws RangeError for arrays exceeding MAX_ROWS', () => {
        // Create an array with MAX_ROWS + 1 items
        const bigArray = Array.from({ length: toon.MAX_ROWS + 1 }, (_, i) => ({ id: i }));
        assert.throws(
            () => toon.encode(bigArray),
            { name: 'RangeError' }
        );
    });

    // TC-ENC-19
    it('TC-ENC-19: handles multiple fields correctly', () => {
        const data = [
            { id: 1, name: 'Alice', active: true, score: null },
            { id: 2, name: 'Bob', active: false, score: 99 }
        ];
        const result = toon.encode(data);
        const lines = result.split('\n');
        assert.equal(lines[0], '[2]{id,name,active,score}:');
        assert.equal(lines[1], '  1,Alice,true,null');
        assert.equal(lines[2], '  2,Bob,false,99');
    });

    // TC-ENC-20
    it('TC-ENC-20: field order follows Object.keys(data[0])', () => {
        const data = [{ z: 1, a: 2, m: 3 }];
        const result = toon.encode(data);
        assert.ok(result.startsWith('[1]{z,a,m}:'));
    });

    // TC-ENC-21
    it('TC-ENC-21: encodes large dataset within MAX_ROWS', () => {
        const data = Array.from({ length: 1000 }, (_, i) => ({ id: i, val: `item-${i}` }));
        const result = toon.encode(data);
        assert.ok(result.startsWith('[1000]{id,val}:'));
        const lines = result.split('\n');
        assert.equal(lines.length, 1001); // 1 header + 1000 data rows
    });
});

// =============================================================================
// decode() tests (11 tests)
// =============================================================================

describe('decode()', () => {
    before(() => loadModule());
    after(() => cleanupModule());

    // TC-DEC-01
    it('TC-DEC-01: decodes simple TOON with string and number values', () => {
        const input = '[2]{name,age}:\n  Alice,30\n  Bob,25';
        const result = toon.decode(input);
        assert.deepStrictEqual(result, [
            { name: 'Alice', age: 30 },
            { name: 'Bob', age: 25 }
        ]);
    });

    // TC-DEC-02
    it('TC-DEC-02: decodes booleans and null', () => {
        const input = '[2]{active,val}:\n  true,null\n  false,42';
        const result = toon.decode(input);
        assert.deepStrictEqual(result, [
            { active: true, val: null },
            { active: false, val: 42 }
        ]);
    });

    // TC-DEC-03
    it('TC-DEC-03: decodes quoted strings with escaped characters', () => {
        const input = '[1]{val}:\n  "a,b"';
        const result = toon.decode(input);
        assert.deepStrictEqual(result, [{ val: 'a,b' }]);
    });

    // TC-DEC-04
    it('TC-DEC-04: decodes strings with escaped newlines', () => {
        const input = '[1]{val}:\n  "line1\\nline2"';
        const result = toon.decode(input);
        assert.deepStrictEqual(result, [{ val: 'line1\nline2' }]);
    });

    // TC-DEC-05
    it('TC-DEC-05: decodes strings with escaped quotes', () => {
        const input = '[1]{val}:\n  "say \\"hi\\""';
        const result = toon.decode(input);
        assert.deepStrictEqual(result, [{ val: 'say "hi"' }]);
    });

    // TC-DEC-06
    it('TC-DEC-06: decodes empty quoted strings', () => {
        const input = '[1]{val}:\n  ""';
        const result = toon.decode(input);
        assert.deepStrictEqual(result, [{ val: '' }]);
    });

    // TC-DEC-07
    it('TC-DEC-07: falls back to JSON.parse on invalid TOON header', () => {
        const jsonInput = JSON.stringify([{ a: 1 }]);
        const result = toon.decode(jsonInput);
        assert.deepStrictEqual(result, [{ a: 1 }]);
    });

    // TC-DEC-08
    it('TC-DEC-08: falls back to JSON.parse on row count mismatch', () => {
        // Header says 3 rows but only 1 provided; not valid JSON either
        // So this should throw SyntaxError
        const input = '[3]{a}:\n  1';
        assert.throws(
            () => toon.decode(input),
            { name: 'SyntaxError' }
        );
    });

    // TC-DEC-09
    it('TC-DEC-09: falls back to JSON.parse on field count mismatch per row', () => {
        // Row has wrong number of fields; not valid JSON either
        const input = '[1]{a,b}:\n  1';
        assert.throws(
            () => toon.decode(input),
            { name: 'SyntaxError' }
        );
    });

    // TC-DEC-10
    it('TC-DEC-10: throws SyntaxError for invalid input that is neither TOON nor JSON', () => {
        assert.throws(
            () => toon.decode('completely invalid garbage!!!'),
            { name: 'SyntaxError' }
        );
    });

    // TC-DEC-11
    it('TC-DEC-11: decodes embedded JSON objects in values', () => {
        const input = '[1]{name,meta}:\n  test,{"a":1}';
        const result = toon.decode(input);
        assert.equal(result[0].name, 'test');
        assert.deepStrictEqual(result[0].meta, { a: 1 });
    });
});

// =============================================================================
// Round-trip tests (5 tests)
// =============================================================================

describe('Round-trip encode/decode', () => {
    before(() => loadModule());
    after(() => cleanupModule());

    // TC-RT-01
    it('TC-RT-01: round-trips simple data', () => {
        const original = [
            { id: 1, name: 'Alice', active: true },
            { id: 2, name: 'Bob', active: false }
        ];
        const encoded = toon.encode(original);
        const decoded = toon.decode(encoded);
        assert.deepStrictEqual(decoded, original);
    });

    // TC-RT-02
    it('TC-RT-02: round-trips data with null and special characters', () => {
        const original = [
            { val: null, text: 'hello, world' },
            { val: null, text: 'line1\nline2' }
        ];
        const encoded = toon.encode(original);
        const decoded = toon.decode(encoded);
        assert.deepStrictEqual(decoded, original);
    });

    // TC-RT-03
    it('TC-RT-03: round-trips data with nested objects', () => {
        const original = [
            { name: 'test', config: { enabled: true } }
        ];
        const encoded = toon.encode(original);
        const decoded = toon.decode(encoded);
        assert.deepStrictEqual(decoded, original);
    });

    // TC-RT-04
    it('TC-RT-04: round-trips single-field objects', () => {
        const original = [{ x: 1 }, { x: 2 }, { x: 3 }];
        const encoded = toon.encode(original);
        const decoded = toon.decode(encoded);
        assert.deepStrictEqual(decoded, original);
    });

    // TC-RT-05
    it('TC-RT-05: round-trips data with empty strings and quotes', () => {
        const original = [
            { a: '', b: 'say "hi"' },
            { a: 'normal', b: 'path\\to\\file' }
        ];
        const encoded = toon.encode(original);
        const decoded = toon.decode(encoded);
        assert.deepStrictEqual(decoded, original);
    });
});
