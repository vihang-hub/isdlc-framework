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

// =============================================================================
// REQ-0041: isPrimitiveArray() tests (6 tests)
// =============================================================================

describe('isPrimitiveArray()', () => {
    before(() => loadModule());
    after(() => cleanupModule());

    // TC-IPA-01
    it('TC-IPA-01: returns true for array of strings', () => {
        assert.equal(toon.isPrimitiveArray(['a', 'b', 'c']), true);
    });

    // TC-IPA-02
    it('TC-IPA-02: returns true for array of numbers', () => {
        assert.equal(toon.isPrimitiveArray([1, 2, 3]), true);
    });

    // TC-IPA-03
    it('TC-IPA-03: returns true for array of mixed primitives', () => {
        assert.equal(toon.isPrimitiveArray(['a', 1, true, null]), true);
    });

    // TC-IPA-04
    it('TC-IPA-04: returns false for array containing objects', () => {
        assert.equal(toon.isPrimitiveArray([{ a: 1 }, { b: 2 }]), false);
    });

    // TC-IPA-05
    it('TC-IPA-05: returns false for array containing nested arrays', () => {
        assert.equal(toon.isPrimitiveArray([[1, 2], [3, 4]]), false);
    });

    // TC-IPA-06
    it('TC-IPA-06: returns false for non-array inputs', () => {
        assert.equal(toon.isPrimitiveArray(null), false);
        assert.equal(toon.isPrimitiveArray(42), false);
        assert.equal(toon.isPrimitiveArray('string'), false);
        assert.equal(toon.isPrimitiveArray({}), false);
    });
});

// =============================================================================
// REQ-0041: encodeValue() — Type Dispatch tests (8 tests)
// =============================================================================

describe('encodeValue() type dispatch', () => {
    before(() => loadModule());
    after(() => cleanupModule());

    // TC-EV-01
    it('TC-EV-01: encodes null as "null"', () => {
        assert.equal(toon.encodeValue(null), 'null');
    });

    // TC-EV-02
    it('TC-EV-02: encodes undefined as "null"', () => {
        assert.equal(toon.encodeValue(undefined), 'null');
    });

    // TC-EV-03
    it('TC-EV-03: encodes boolean true as "true"', () => {
        assert.equal(toon.encodeValue(true), 'true');
    });

    // TC-EV-04
    it('TC-EV-04: encodes boolean false as "false"', () => {
        assert.equal(toon.encodeValue(false), 'false');
    });

    // TC-EV-05
    it('TC-EV-05: encodes integer as numeric string', () => {
        assert.equal(toon.encodeValue(42), '42');
    });

    // TC-EV-06
    it('TC-EV-06: encodes float as numeric string', () => {
        assert.equal(toon.encodeValue(3.14), '3.14');
    });

    // TC-EV-07
    it('TC-EV-07: encodes simple string bare', () => {
        assert.equal(toon.encodeValue('hello'), 'hello');
    });

    // TC-EV-08
    it('TC-EV-08: encodes string with special chars quoted', () => {
        assert.equal(toon.encodeValue('a,b'), '"a,b"');
    });
});

// =============================================================================
// REQ-0041: encodeValue() — Nested Object tests (8 tests)
// =============================================================================

describe('encodeValue() nested objects', () => {
    before(() => loadModule());
    after(() => cleanupModule());

    // TC-EV-09
    it('TC-EV-09: encodes flat object without braces', () => {
        const result = toon.encodeValue({ a: 1, b: 'hello' });
        assert.equal(result, 'a: 1\nb: hello');
    });

    // TC-EV-10
    it('TC-EV-10: encodes nested object with indentation', () => {
        const result = toon.encodeValue({ a: { b: { c: 1 } } });
        assert.equal(result, 'a:\n  b:\n    c: 1');
    });

    // TC-EV-11
    it('TC-EV-11: encodes object with mixed value types', () => {
        const result = toon.encodeValue({ str: 'hello', num: 42, bool: true, nil: null });
        assert.equal(result, 'str: hello\nnum: 42\nbool: true\nnil: null');
    });

    // TC-EV-12
    it('TC-EV-12: encodes deeply nested object (7 levels)', () => {
        const data = { l1: { l2: { l3: { l4: { l5: { l6: { l7: 'deep' } } } } } } };
        const result = toon.encodeValue(data);
        // Each level adds 2 spaces
        assert.ok(result.includes('            l7: deep')); // 12 spaces = 6 levels deep
    });

    // TC-EV-13
    it('TC-EV-13: encodes empty object', () => {
        const result = toon.encodeValue({});
        assert.equal(result, '');
    });

    // TC-EV-14
    it('TC-EV-14: encodes object with single key', () => {
        const result = toon.encodeValue({ name: 'test' });
        assert.equal(result, 'name: test');
    });

    // TC-EV-15
    it('TC-EV-15: encodes object with many keys', () => {
        const data = {};
        for (let i = 0; i < 20; i++) data['key' + i] = i;
        const result = toon.encodeValue(data);
        const lines = result.split('\n');
        assert.equal(lines.length, 20);
    });

    // TC-EV-16
    it('TC-EV-16: encodes object with mixed nested and primitive values', () => {
        const result = toon.encodeValue({ name: 'test', config: { enabled: true }, count: 5 });
        assert.equal(result, 'name: test\nconfig:\n  enabled: true\ncount: 5');
    });
});

// =============================================================================
// REQ-0041: encodeValue() — Key-Value Pair tests (6 tests)
// =============================================================================

describe('encodeValue() key-value pairs', () => {
    before(() => loadModule());
    after(() => cleanupModule());

    // TC-EV-17
    it('TC-EV-17: keys are emitted without quotes', () => {
        const result = toon.encodeValue({ my_key: 'value' });
        assert.ok(result.startsWith('my_key:'));
        assert.ok(!result.includes('"my_key"'));
    });

    // TC-EV-18
    it('TC-EV-18: simple string values are bare', () => {
        const result = toon.encodeValue({ name: 'hello' });
        assert.equal(result, 'name: hello');
    });

    // TC-EV-19
    it('TC-EV-19: string values with comma are quoted', () => {
        const result = toon.encodeValue({ desc: 'a,b' });
        assert.equal(result, 'desc: "a,b"');
    });

    // TC-EV-20
    it('TC-EV-20: string values with newline are quoted and escaped', () => {
        const result = toon.encodeValue({ text: 'line1\nline2' });
        assert.equal(result, 'text: "line1\\nline2"');
    });

    // TC-EV-21
    it('TC-EV-21: string values with backslash are quoted and escaped', () => {
        const result = toon.encodeValue({ path: 'a\\b' });
        assert.equal(result, 'path: "a\\\\b"');
    });

    // TC-EV-22
    it('TC-EV-22: empty string values are quoted', () => {
        const result = toon.encodeValue({ empty: '' });
        assert.equal(result, 'empty: ""');
    });
});

// =============================================================================
// REQ-0041: encodeValue() — Inline Primitive Array tests (7 tests)
// =============================================================================

describe('encodeValue() inline primitive arrays', () => {
    before(() => loadModule());
    after(() => cleanupModule());

    // TC-EV-23
    it('TC-EV-23: encodes string array inline', () => {
        const result = toon.encodeValue({ tags: ['a', 'b', 'c'] });
        assert.equal(result, 'tags[3]: a,b,c');
    });

    // TC-EV-24
    it('TC-EV-24: encodes number array inline', () => {
        const result = toon.encodeValue({ ids: [1, 2, 3] });
        assert.equal(result, 'ids[3]: 1,2,3');
    });

    // TC-EV-25
    it('TC-EV-25: encodes mixed primitive array inline', () => {
        const result = toon.encodeValue({ mix: ['a', 1, true, null] });
        assert.equal(result, 'mix[4]: a,1,true,null');
    });

    // TC-EV-26
    it('TC-EV-26: encodes empty array inline', () => {
        const result = toon.encodeValue({ items: [] });
        assert.equal(result, 'items[0]:');
    });

    // TC-EV-27
    it('TC-EV-27: encodes single-element primitive array', () => {
        const result = toon.encodeValue({ solo: ['only'] });
        assert.equal(result, 'solo[1]: only');
    });

    // TC-EV-28
    it('TC-EV-28: quotes inline array elements containing commas', () => {
        const result = toon.encodeValue({ vals: ['a,b', 'c'] });
        assert.equal(result, 'vals[2]: "a,b",c');
    });

    // TC-EV-29
    it('TC-EV-29: encodes boolean array inline', () => {
        const result = toon.encodeValue({ flags: [true, false, true] });
        assert.equal(result, 'flags[3]: true,false,true');
    });
});

// =============================================================================
// REQ-0041: encodeValue() — Mixed/List Array tests (5 tests)
// =============================================================================

describe('encodeValue() mixed/list arrays', () => {
    before(() => loadModule());
    after(() => cleanupModule());

    // TC-EV-30
    it('TC-EV-30: encodes array of non-uniform objects in list form', () => {
        const result = toon.encodeValue({ items: [{ a: 1 }, { b: 2 }] });
        assert.ok(result.includes('- a: 1'));
        assert.ok(result.includes('- b: 2'));
    });

    // TC-EV-31
    it('TC-EV-31: encodes array of mixed types in list form', () => {
        const result = toon.encodeValue({ items: [{ a: 1 }, 'text', 42] });
        assert.ok(result.includes('- a: 1'));
        assert.ok(result.includes('- text'));
        assert.ok(result.includes('- 42'));
    });

    // TC-EV-32
    it('TC-EV-32: encodes nested objects within list items', () => {
        // Use truly non-uniform objects to trigger list form
        const result = toon.encodeValue({
            items: [
                { name: 'a', config: { x: 1 } },
                { label: 'b', settings: { y: 2 } }
            ]
        });
        // Non-uniform objects use list form with `- ` prefix
        assert.ok(result.includes('- name: a'));
        assert.ok(result.includes('- label: b'));
        // Nested objects should appear deeper
        assert.ok(result.includes('x: 1'));
        assert.ok(result.includes('y: 2'));
    });

    // TC-EV-33
    it('TC-EV-33: encodes array of arrays in list form', () => {
        const result = toon.encodeValue({ matrix: [[1, 2], [3, 4]] });
        // Nested arrays should be in list form
        assert.ok(result.includes('matrix:'));
    });

    // TC-EV-34
    it('TC-EV-34: empty arrays use inline form', () => {
        const result = toon.encodeValue({ items: [] });
        assert.equal(result, 'items[0]:');
    });
});

// =============================================================================
// REQ-0041: encodeValue() — Tabular Delegation tests (3 tests)
// =============================================================================

describe('encodeValue() tabular delegation', () => {
    before(() => loadModule());
    after(() => cleanupModule());

    // TC-EV-35
    it('TC-EV-35: delegates uniform array to encode()', () => {
        const data = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }];
        const fromEncodeValue = toon.encodeValue(data);
        const fromEncode = toon.encode(data);
        assert.equal(fromEncodeValue, fromEncode);
    });

    // TC-EV-36
    it('TC-EV-36: uniform array as object value uses tabular form', () => {
        const result = toon.encodeValue({
            users: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }]
        });
        assert.ok(result.includes('[2]{id,name}:'));
    });

    // TC-EV-37
    it('TC-EV-37: non-uniform array does NOT use tabular form', () => {
        const result = toon.encodeValue({ items: [{ a: 1 }, { b: 2 }] });
        assert.ok(!result.includes('{a}:'));
        assert.ok(!result.includes('{b}:'));
        assert.ok(result.includes('- '));
    });
});

// =============================================================================
// REQ-0041: encodeValue() — Key Stripping tests (4 tests)
// =============================================================================

describe('encodeValue() key stripping', () => {
    before(() => loadModule());
    after(() => cleanupModule());

    // TC-EV-38
    it('TC-EV-38: strips _comment keys at top level', () => {
        const result = toon.encodeValue(
            { _comment: 'doc', name: 'keep' },
            { stripKeys: ['_comment'] }
        );
        assert.equal(result, 'name: keep');
        assert.ok(!result.includes('_comment'));
    });

    // TC-EV-39
    it('TC-EV-39: strips _comment keys recursively', () => {
        const result = toon.encodeValue(
            { phase: '01', config: { _comment: 'nested', enabled: true } },
            { stripKeys: ['_comment'] }
        );
        assert.equal(result, 'phase: 01\nconfig:\n  enabled: true');
    });

    // TC-EV-40
    it('TC-EV-40: no stripping when stripKeys is empty', () => {
        const result = toon.encodeValue(
            { _comment: 'doc', name: 'keep' },
            { stripKeys: [] }
        );
        assert.ok(result.includes('_comment'));
        assert.ok(result.includes('name'));
    });

    // TC-EV-41
    it('TC-EV-41: no stripping when stripKeys is not provided', () => {
        const result = toon.encodeValue({ _comment: 'doc', name: 'keep' });
        assert.ok(result.includes('_comment'));
        assert.ok(result.includes('name'));
    });
});

// =============================================================================
// REQ-0041: encodeValue() — Options tests (3 tests)
// =============================================================================

describe('encodeValue() options', () => {
    before(() => loadModule());
    after(() => cleanupModule());

    // TC-EV-42
    it('TC-EV-42: indent option adds leading spaces', () => {
        const result = toon.encodeValue({ a: 1 }, { indent: 2 });
        assert.equal(result, '    a: 1');
    });

    // TC-EV-43
    it('TC-EV-43: default options produce zero indentation', () => {
        const result = toon.encodeValue({ a: 1 });
        assert.equal(result, 'a: 1');
    });

    // TC-EV-44
    it('TC-EV-44: combined indent and stripKeys options', () => {
        const result = toon.encodeValue(
            { _comment: 'x', a: 1 },
            { indent: 1, stripKeys: ['_comment'] }
        );
        assert.equal(result, '  a: 1');
    });
});

// =============================================================================
// REQ-0041: decodeValue() — Primitive tests (5 tests)
// =============================================================================

describe('decodeValue() primitives', () => {
    before(() => loadModule());
    after(() => cleanupModule());

    // TC-DV-01
    it('TC-DV-01: decodes "null" to null', () => {
        assert.equal(toon.decodeValue('null'), null);
    });

    // TC-DV-02
    it('TC-DV-02: decodes "true" to true', () => {
        assert.equal(toon.decodeValue('true'), true);
    });

    // TC-DV-03
    it('TC-DV-03: decodes "false" to false', () => {
        assert.equal(toon.decodeValue('false'), false);
    });

    // TC-DV-04
    it('TC-DV-04: decodes numeric string to number', () => {
        assert.equal(toon.decodeValue('42'), 42);
    });

    // TC-DV-05
    it('TC-DV-05: decodes bare string as string', () => {
        assert.equal(toon.decodeValue('hello'), 'hello');
    });
});

// =============================================================================
// REQ-0041: decodeValue() — Object tests (5 tests)
// =============================================================================

describe('decodeValue() objects', () => {
    before(() => loadModule());
    after(() => cleanupModule());

    // TC-DV-06
    it('TC-DV-06: decodes flat key-value pairs to object', () => {
        const result = toon.decodeValue('a: 1\nb: hello');
        assert.deepStrictEqual(result, { a: 1, b: 'hello' });
    });

    // TC-DV-07
    it('TC-DV-07: decodes nested indented object', () => {
        const result = toon.decodeValue('a:\n  b:\n    c: 1');
        assert.deepStrictEqual(result, { a: { b: { c: 1 } } });
    });

    // TC-DV-08
    it('TC-DV-08: decodes object with mixed value types', () => {
        const result = toon.decodeValue('str: hello\nnum: 42\nbool: true\nnil: null');
        assert.deepStrictEqual(result, { str: 'hello', num: 42, bool: true, nil: null });
    });

    // TC-DV-09
    it('TC-DV-09: decodes object with quoted string values', () => {
        const result = toon.decodeValue('desc: "a,b"\npath: "a\\\\b"');
        assert.deepStrictEqual(result, { desc: 'a,b', path: 'a\\b' });
    });

    // TC-DV-10
    it('TC-DV-10: decodes object with empty string value', () => {
        const result = toon.decodeValue('empty: ""');
        assert.deepStrictEqual(result, { empty: '' });
    });
});

// =============================================================================
// REQ-0041: decodeValue() — Inline Array tests (4 tests)
// =============================================================================

describe('decodeValue() inline arrays', () => {
    before(() => loadModule());
    after(() => cleanupModule());

    // TC-DV-11
    it('TC-DV-11: decodes inline string array', () => {
        const result = toon.decodeValue('tags[3]: a,b,c');
        assert.deepStrictEqual(result, { tags: ['a', 'b', 'c'] });
    });

    // TC-DV-12
    it('TC-DV-12: decodes inline number array', () => {
        const result = toon.decodeValue('ids[3]: 1,2,3');
        assert.deepStrictEqual(result, { ids: [1, 2, 3] });
    });

    // TC-DV-13
    it('TC-DV-13: decodes empty inline array', () => {
        const result = toon.decodeValue('items[0]:');
        assert.deepStrictEqual(result, { items: [] });
    });

    // TC-DV-14
    it('TC-DV-14: decodes inline array with quoted elements', () => {
        const result = toon.decodeValue('vals[2]: "a,b",c');
        assert.deepStrictEqual(result, { vals: ['a,b', 'c'] });
    });
});

// =============================================================================
// REQ-0041: decodeValue() — List Array tests (4 tests)
// =============================================================================

describe('decodeValue() list arrays', () => {
    before(() => loadModule());
    after(() => cleanupModule());

    // TC-DV-15
    it('TC-DV-15: decodes simple list array', () => {
        const result = toon.decodeValue('- a\n- b\n- c');
        assert.deepStrictEqual(result, ['a', 'b', 'c']);
    });

    // TC-DV-16
    it('TC-DV-16: decodes list array of objects', () => {
        const result = toon.decodeValue('- a: 1\n- b: 2');
        assert.deepStrictEqual(result, [{ a: 1 }, { b: 2 }]);
    });

    // TC-DV-17
    it('TC-DV-17: decodes list array with nested objects', () => {
        const input = '- name: a\n  score: 10\n- name: b\n  score: 20';
        const result = toon.decodeValue(input);
        assert.deepStrictEqual(result, [
            { name: 'a', score: 10 },
            { name: 'b', score: 20 }
        ]);
    });

    // TC-DV-18
    it('TC-DV-18: decodes tabular format via existing decode()', () => {
        const result = toon.decodeValue('[2]{x}:\n  1\n  2');
        assert.deepStrictEqual(result, [{ x: 1 }, { x: 2 }]);
    });
});

// =============================================================================
// REQ-0041: decodeValue() — Error Handling tests (4 tests)
// =============================================================================

describe('decodeValue() error handling', () => {
    before(() => loadModule());
    after(() => cleanupModule());

    // TC-DV-19
    it('TC-DV-19: falls back to JSON.parse for valid JSON input', () => {
        const result = toon.decodeValue('{"a":1}');
        assert.deepStrictEqual(result, { a: 1 });
    });

    // TC-DV-20
    it('TC-DV-20: throws SyntaxError for multi-line input without TOON structure', () => {
        // Multi-line input with no key-value, list, or tabular structure
        assert.throws(
            () => toon.decodeValue('garbage line one\ngarbage line two\nno structure here'),
            (err) => err instanceof SyntaxError
        );
    });

    // TC-DV-21
    it('TC-DV-21: handles empty string input', () => {
        assert.throws(
            () => toon.decodeValue(''),
            (err) => err instanceof SyntaxError
        );
    });

    // TC-DV-22
    it('TC-DV-22: handles whitespace-only input', () => {
        assert.throws(
            () => toon.decodeValue('   \n   '),
            (err) => err instanceof SyntaxError
        );
    });
});

// =============================================================================
// REQ-0041: Round-trip encodeValue/decodeValue tests (8 tests)
// =============================================================================

describe('Round-trip encodeValue/decodeValue', () => {
    before(() => loadModule());
    after(() => cleanupModule());

    // TC-EVRT-01
    it('TC-EVRT-01: round-trips flat object', () => {
        const input = { name: 'test', count: 42, active: true };
        const encoded = toon.encodeValue(input);
        const decoded = toon.decodeValue(encoded);
        assert.deepStrictEqual(decoded, input);
    });

    // TC-EVRT-02
    it('TC-EVRT-02: round-trips nested object', () => {
        const input = { a: { b: { c: 1 } }, d: 'hello' };
        const encoded = toon.encodeValue(input);
        const decoded = toon.decodeValue(encoded);
        assert.deepStrictEqual(decoded, input);
    });

    // TC-EVRT-03
    it('TC-EVRT-03: round-trips object with inline arrays', () => {
        const input = { name: 'test', tags: ['a', 'b', 'c'], ids: [1, 2, 3] };
        const encoded = toon.encodeValue(input);
        const decoded = toon.decodeValue(encoded);
        assert.deepStrictEqual(decoded, input);
    });

    // TC-EVRT-04
    it('TC-EVRT-04: round-trips object with special characters', () => {
        const input = { desc: 'a,b', path: 'a\\b', text: 'line1\nline2' };
        const encoded = toon.encodeValue(input);
        const decoded = toon.decodeValue(encoded);
        assert.deepStrictEqual(decoded, input);
    });

    // TC-EVRT-05
    it('TC-EVRT-05: round-trips representative skills-manifest structure', () => {
        const input = {
            version: '5.0.0',
            ownership: {
                'requirements-analyst': {
                    phase: '01-requirements',
                    skills: ['requirements-elicitation', 'user-story-writing']
                }
            },
            skill_lookup: {
                'requirements-elicitation': '01-requirements',
                'user-story-writing': '01-requirements'
            }
        };
        const encoded = toon.encodeValue(input);
        const decoded = toon.decodeValue(encoded);
        assert.deepStrictEqual(decoded, input);
    });

    // TC-EVRT-06
    it('TC-EVRT-06: round-trips representative iteration-requirements structure', () => {
        const input = {
            version: '2.0.0',
            phases: {
                '01-requirements': {
                    max_iterations: 5,
                    articles: ['I', 'VII'],
                    validation: {
                        required_artifacts: ['requirements-spec.md']
                    }
                }
            }
        };
        const encoded = toon.encodeValue(input);
        const decoded = toon.decodeValue(encoded);
        assert.deepStrictEqual(decoded, input);
    });

    // TC-EVRT-07
    it('TC-EVRT-07: round-trips representative workflows structure', () => {
        const input = {
            feature: {
                phases: ['01-requirements', '02-analysis', '03-architecture'],
                options: {
                    skip_phases: [],
                    auto_advance: true
                }
            }
        };
        const encoded = toon.encodeValue(input);
        const decoded = toon.decodeValue(encoded);
        assert.deepStrictEqual(decoded, input);
    });

    // TC-EVRT-08
    it('TC-EVRT-08: round-trips representative artifact-paths structure', () => {
        const input = {
            '01-requirements': {
                paths: ['docs/requirements/'],
                required: ['requirements-spec.md']
            }
        };
        const encoded = toon.encodeValue(input);
        const decoded = toon.decodeValue(encoded);
        assert.deepStrictEqual(decoded, input);
    });
});

// =============================================================================
// REQ-0041: Module Exports tests (2 tests)
// =============================================================================

describe('Module exports (REQ-0041)', () => {
    before(() => loadModule());
    after(() => cleanupModule());

    // TC-MOD-01
    it('TC-MOD-01: all existing exports still present', () => {
        assert.equal(typeof toon.encode, 'function');
        assert.equal(typeof toon.decode, 'function');
        assert.equal(typeof toon.isUniformArray, 'function');
        assert.equal(typeof toon.serializeValue, 'function');
        assert.equal(typeof toon.deserializeValue, 'function');
        assert.equal(typeof toon.splitRow, 'function');
        assert.equal(typeof toon.MAX_ROWS, 'number');
    });

    // TC-MOD-02
    it('TC-MOD-02: new exports are present', () => {
        assert.equal(typeof toon.encodeValue, 'function');
        assert.equal(typeof toon.decodeValue, 'function');
        assert.equal(typeof toon.isPrimitiveArray, 'function');
    });
});

// =============================================================================
// REQ-0041: Backward Compatibility tests (4 tests)
// =============================================================================

describe('Backward compatibility (REQ-0041)', () => {
    before(() => loadModule());
    after(() => cleanupModule());

    // TC-BC-01 is covered by running existing 44 tests above without modification

    // TC-BC-02
    it('TC-BC-02: encode() still throws TypeError for non-uniform array', () => {
        assert.throws(
            () => toon.encode([{ a: 1 }, { b: 2 }]),
            { name: 'TypeError' }
        );
    });

    // TC-BC-03
    it('TC-BC-03: encode() still throws TypeError for non-array', () => {
        assert.throws(() => toon.encode('string'), { name: 'TypeError' });
        assert.throws(() => toon.encode(null), { name: 'TypeError' });
        assert.throws(() => toon.encode(42), { name: 'TypeError' });
    });

    // TC-BC-04
    it('TC-BC-04: decode() still falls back to JSON.parse', () => {
        const result = toon.decode('[{"a":1}]');
        assert.deepStrictEqual(result, [{ a: 1 }]);
    });
});
