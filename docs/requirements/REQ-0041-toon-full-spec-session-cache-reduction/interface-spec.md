# Interface Specification: REQ-0041 TOON Full Spec Session Cache Reduction

| Field | Value |
|-------|-------|
| **Status** | Complete |
| **Confidence** | High |
| **Last Updated** | 2026-02-26 |
| **Coverage** | Function signatures, type contracts, encoding format specification |

---

## 1. encodeValue()

### Signature

```javascript
/**
 * Encodes any JavaScript value into TOON (Token-Oriented Object Notation) format.
 *
 * Handles nested objects, primitive arrays, mixed arrays, and delegates to
 * encode() for uniform arrays of objects. Produces indentation-based output
 * optimized for LLM context consumption.
 *
 * @param {*} data - Any JavaScript value (object, array, string, number, boolean, null)
 * @param {object} [options={}]
 * @param {number} [options.indent=0] - Starting indentation level (2 spaces per level)
 * @param {string[]} [options.stripKeys=[]] - Keys to omit from output at all nesting levels
 * @returns {string} TOON-encoded string
 * @throws {TypeError} If data is undefined and no fallback is possible
 *
 * @example
 * // Nested object
 * encodeValue({ a: 1, b: { c: true } })
 * // => "a: 1\nb:\n  c: true"
 *
 * @example
 * // Object with inline arrays
 * encodeValue({ name: "test", tags: ["a", "b", "c"] })
 * // => "name: test\ntags[3]: a,b,c"
 *
 * @example
 * // With key stripping
 * encodeValue({ _comment: "ignore", name: "keep" }, { stripKeys: ['_comment'] })
 * // => "name: keep"
 */
function encodeValue(data, options = {})
```

### Return Value Contract

| Input | Output |
|-------|--------|
| `null` | `"null"` |
| `undefined` | `"null"` |
| `true` | `"true"` |
| `false` | `"false"` |
| `42` | `"42"` |
| `3.14` | `"3.14"` |
| `"hello"` | `"hello"` |
| `"a,b"` | `"\"a,b\""` |
| `""` | `"\"\""` |
| `{ a: 1 }` | `"a: 1"` |
| `{ a: { b: 1 } }` | `"a:\n  b: 1"` |
| `["a", "b"]` (as value of key) | inline form via caller: `"key[2]: a,b"` |
| `[{ a: 1 }, { a: 2 }]` (uniform) | tabular: `"[2]{a}:\n  1\n  2"` |
| `[{ a: 1 }, { b: 2 }]` (non-uniform) | list form: `"- a: 1\n- b: 2"` |

### Indentation Behavior

When `options.indent > 0`, all output lines are prefixed with `'  '.repeat(options.indent)`:

```javascript
encodeValue({ a: 1 }, { indent: 2 })
// => "    a: 1"  (4 spaces = 2 levels)
```

### stripKeys Behavior

Keys matching any entry in `stripKeys` are silently omitted at all nesting levels:

```javascript
encodeValue({
    _comment: "documentation",
    phase: "01",
    config: {
        _comment: "nested doc",
        enabled: true
    }
}, { stripKeys: ['_comment'] })
// => "phase: 01\nconfig:\n  enabled: true"
```

---

## 2. decodeValue()

### Signature

```javascript
/**
 * Decodes a TOON-encoded string back to a JavaScript value.
 * Handles indentation-based objects, inline arrays, list-form arrays,
 * and tabular format. Intended for test-round-trip verification.
 *
 * Falls back to JSON.parse() if the input does not appear to be TOON format.
 *
 * @param {string} toonString - TOON-encoded string
 * @returns {*} Decoded JavaScript value
 * @throws {SyntaxError} If input is neither valid TOON nor valid JSON
 *
 * @example
 * decodeValue("a: 1\nb: hello")
 * // => { a: 1, b: "hello" }
 *
 * @example
 * decodeValue("tags[3]: a,b,c")
 * // => (within parent object context) tags: ["a", "b", "c"]
 */
function decodeValue(toonString)
```

### Return Value Contract

| Input | Output |
|-------|--------|
| `"null"` | `null` |
| `"true"` | `true` |
| `"42"` | `42` |
| `"hello"` | `"hello"` |
| `"a: 1\nb: hello"` | `{ a: 1, b: "hello" }` |
| `"key[3]: a,b,c"` | `{ key: ["a", "b", "c"] }` |
| `"- a\n- b\n- c"` | `["a", "b", "c"]` |
| `"[2]{x}:\n  1\n  2"` | `[{ x: 1 }, { x: 2 }]` |
| Valid JSON string | `JSON.parse(input)` |
| Invalid TOON and invalid JSON | throws `SyntaxError` |

---

## 3. TOON Output Format Specification

### 3.1 Nested Object

```
key1: value1
key2: value2
key3:
  nested_key1: nested_value1
  nested_key2:
    deep_key: deep_value
```

- No braces `{` `}`
- No quotes on keys
- No quotes on simple string values
- Two-space indentation per nesting level
- Colon-space separator between key and value
- Object-valued keys end with `:` and a newline; content follows at next indent level

### 3.2 Key-Value Pair

```
key: value
```

- Key is always bare (no quotes)
- Value follows `serializeValue()` rules:
  - Simple strings: bare
  - Strings with special chars (`,`, `"`, `\n`, `\`): double-quoted and escaped
  - Empty strings: `""`
  - Numbers: numeric literal
  - Booleans: `true` / `false`
  - Null: `null`

### 3.3 Inline Primitive Array

```
key[N]: v1,v2,v3
```

- `N` = array length (always present, even for length 1)
- Elements serialized individually via `serializeValue()`
- Comma-separated, no spaces between elements
- Empty array: `key[0]:`

### 3.4 List-Form Array

```
key:
  - primitive_value
  - object_key1: object_value1
    object_key2: object_value2
  - another_primitive
```

- Each element prefixed with `- ` at one indentation level deeper than the key
- Primitive elements follow on the `- ` line
- Object elements: first key-value on the `- ` line, remaining keys at two levels deeper than the key
- Nested arrays within list items are encoded recursively

### 3.5 Tabular Array (Existing)

```
[N]{field1,field2,...}:
  v1,v2,...
  v1,v2,...
```

- Produced only for uniform arrays of objects (all objects have identical keys)
- Header: `[count]{comma-separated-fields}:`
- Data rows: two-space indent, comma-separated values

### 3.6 Section Marker

When TOON encoding is used in a cache section, the content is prefixed with `[TOON]`:

```
<!-- SECTION: SECTION_NAME -->
[TOON]
key1: value1
key2:
  nested: value
<!-- /SECTION: SECTION_NAME -->
```

---

## 4. Internal Helper Functions

### isPrimitiveArray(data)

```javascript
/**
 * Checks whether the input is an array containing only primitive values
 * (string, number, boolean, null).
 *
 * @param {*} data - The value to check
 * @returns {boolean} true if data is an array of only primitives
 */
function isPrimitiveArray(data)
```

### encodeObject(obj, indent, stripKeys)

```javascript
/**
 * Encodes a plain object as indented key-value pairs.
 * Internal helper called by encodeValue().
 *
 * @param {object} obj - Plain object to encode
 * @param {number} indent - Current indentation level
 * @param {string[]} stripKeys - Keys to omit
 * @returns {string} Encoded lines joined by newlines
 */
function encodeObject(obj, indent, stripKeys)
```

### encodeArray(arr, key, indent, stripKeys)

```javascript
/**
 * Encodes an array value, choosing between inline, tabular, or list form.
 * Internal helper called by encodeObject() when processing array-valued keys.
 *
 * @param {Array} arr - Array to encode
 * @param {string} key - The parent key name (needed for inline format)
 * @param {number} indent - Current indentation level
 * @param {string[]} stripKeys - Keys to omit from object elements
 * @returns {string} Encoded array content
 */
function encodeArray(arr, key, indent, stripKeys)
```

---

## 5. Module Exports (Complete)

```javascript
module.exports = {
    // Existing (REQ-0040) -- unchanged
    encode,
    decode,
    isUniformArray,
    serializeValue,
    deserializeValue,
    splitRow,
    MAX_ROWS,
    // New (REQ-0041)
    encodeValue,
    decodeValue,
    // Exposed for testing
    isPrimitiveArray
};
```

## Pending Sections

None -- all sections complete.
