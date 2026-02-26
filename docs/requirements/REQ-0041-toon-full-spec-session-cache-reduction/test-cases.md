# Test Cases: REQ-0041 TOON Full Spec Session Cache Reduction

| Field | Value |
|-------|-------|
| **Status** | Complete |
| **Phase** | 05 - Test Strategy |
| **Last Updated** | 2026-02-26 |
| **Total Test Cases** | 100 |
| **Test Types** | Unit (78), Integration (13), Performance (3), Backward Compat (6) |

---

## 1. isPrimitiveArray() Tests

### TC-IPA-01: Returns true for array of strings
- **Requirement**: FR-003 (AC-003-01)
- **Type**: positive
- **Input**: `["a", "b", "c"]`
- **Expected**: `true`

### TC-IPA-02: Returns true for array of numbers
- **Requirement**: FR-003 (AC-003-02)
- **Type**: positive
- **Input**: `[1, 2, 3]`
- **Expected**: `true`

### TC-IPA-03: Returns true for array of mixed primitives
- **Requirement**: FR-003 (AC-003-03)
- **Type**: positive
- **Input**: `["a", 1, true, null]`
- **Expected**: `true`

### TC-IPA-04: Returns false for array containing objects
- **Requirement**: FR-004 (AC-004-01)
- **Type**: negative
- **Input**: `[{a: 1}, {b: 2}]`
- **Expected**: `false`

### TC-IPA-05: Returns false for array containing nested arrays
- **Requirement**: FR-004 (AC-004-02)
- **Type**: negative
- **Input**: `[[1, 2], [3, 4]]`
- **Expected**: `false`

### TC-IPA-06: Returns false for non-array inputs
- **Requirement**: FR-003
- **Type**: negative
- **Input**: `null`, `42`, `"string"`, `{}`
- **Expected**: `false` for each

---

## 2. encodeValue() -- Type Dispatch Tests

### TC-EV-01: Encodes null as "null"
- **Requirement**: FR-001 (AC-001-03)
- **Type**: positive
- **Input**: `null`
- **Expected**: `"null"`

### TC-EV-02: Encodes undefined as "null"
- **Requirement**: FR-001 (AC-001-03)
- **Type**: positive
- **Input**: `undefined`
- **Expected**: `"null"`

### TC-EV-03: Encodes boolean true as "true"
- **Requirement**: FR-001 (AC-001-03)
- **Type**: positive
- **Input**: `true`
- **Expected**: `"true"`

### TC-EV-04: Encodes boolean false as "false"
- **Requirement**: FR-001 (AC-001-03)
- **Type**: positive
- **Input**: `false`
- **Expected**: `"false"`

### TC-EV-05: Encodes integer as numeric string
- **Requirement**: FR-001 (AC-001-03)
- **Type**: positive
- **Input**: `42`
- **Expected**: `"42"`

### TC-EV-06: Encodes float as numeric string
- **Requirement**: FR-001 (AC-001-03)
- **Type**: positive
- **Input**: `3.14`
- **Expected**: `"3.14"`

### TC-EV-07: Encodes simple string bare
- **Requirement**: FR-002 (AC-002-02)
- **Type**: positive
- **Input**: `"hello"`
- **Expected**: `"hello"`

### TC-EV-08: Encodes string with special chars quoted
- **Requirement**: FR-002 (AC-002-03)
- **Type**: positive
- **Input**: `"a,b"`
- **Expected**: `"\"a,b\""`

---

## 3. encodeValue() -- Nested Object Tests

### TC-EV-09: Encodes flat object without braces
- **Requirement**: FR-001 (AC-001-01)
- **Type**: positive
- **Input**: `{a: 1, b: "hello"}`
- **Expected**: `"a: 1\nb: hello"`

### TC-EV-10: Encodes nested object with indentation
- **Requirement**: FR-001 (AC-001-02)
- **Type**: positive
- **Input**: `{a: {b: {c: 1}}}`
- **Expected**: `"a:\n  b:\n    c: 1"`

### TC-EV-11: Encodes object with mixed value types
- **Requirement**: FR-001 (AC-001-03)
- **Type**: positive
- **Input**: `{str: "hello", num: 42, bool: true, nil: null}`
- **Expected**: `"str: hello\nnum: 42\nbool: true\nnil: null"`

### TC-EV-12: Encodes deeply nested object (7 levels)
- **Requirement**: FR-001 (AC-001-04)
- **Type**: positive
- **Input**: 7-level nested object (matching iteration-requirements depth)
- **Expected**: Each level indented by 2 additional spaces

### TC-EV-13: Encodes empty object
- **Requirement**: FR-001
- **Type**: boundary
- **Input**: `{}`
- **Expected**: `""` (empty string)

### TC-EV-14: Encodes object with single key
- **Requirement**: FR-001
- **Type**: boundary
- **Input**: `{name: "test"}`
- **Expected**: `"name: test"`

### TC-EV-15: Encodes object with many keys
- **Requirement**: FR-001
- **Type**: positive
- **Input**: Object with 20 keys
- **Expected**: 20 lines, each `key: value`

### TC-EV-16: Encodes object with mixed nested and primitive values
- **Requirement**: FR-001 (AC-001-04)
- **Type**: positive
- **Input**: `{name: "test", config: {enabled: true}, count: 5}`
- **Expected**: `"name: test\nconfig:\n  enabled: true\ncount: 5"`

---

## 4. encodeValue() -- Key-Value Pair Tests

### TC-EV-17: Keys are emitted without quotes
- **Requirement**: FR-002 (AC-002-01)
- **Type**: positive
- **Input**: `{my_key: "value"}`
- **Expected**: Output starts with `my_key:` not `"my_key":`

### TC-EV-18: Simple string values are bare
- **Requirement**: FR-002 (AC-002-02)
- **Type**: positive
- **Input**: `{name: "hello"}`
- **Expected**: `"name: hello"` (no quotes around hello)

### TC-EV-19: String values with comma are quoted
- **Requirement**: FR-002 (AC-002-03)
- **Type**: positive
- **Input**: `{desc: "a,b"}`
- **Expected**: `"desc: \"a,b\""`

### TC-EV-20: String values with newline are quoted and escaped
- **Requirement**: FR-002 (AC-002-03)
- **Type**: positive
- **Input**: `{text: "line1\nline2"}`
- **Expected**: `"text: \"line1\\nline2\""`

### TC-EV-21: String values with backslash are quoted and escaped
- **Requirement**: FR-002 (AC-002-03)
- **Type**: positive
- **Input**: `{path: "a\\b"}`
- **Expected**: `"path: \"a\\\\b\""`

### TC-EV-22: Empty string values are quoted
- **Requirement**: FR-002 (AC-002-03)
- **Type**: boundary
- **Input**: `{empty: ""}`
- **Expected**: `"empty: \"\""`

---

## 5. encodeValue() -- Inline Primitive Array Tests

### TC-EV-23: Encodes string array inline
- **Requirement**: FR-003 (AC-003-01)
- **Type**: positive
- **Input**: `{tags: ["a", "b", "c"]}`
- **Expected**: `"tags[3]: a,b,c"`

### TC-EV-24: Encodes number array inline
- **Requirement**: FR-003 (AC-003-02)
- **Type**: positive
- **Input**: `{ids: [1, 2, 3]}`
- **Expected**: `"ids[3]: 1,2,3"`

### TC-EV-25: Encodes mixed primitive array inline
- **Requirement**: FR-003 (AC-003-03)
- **Type**: positive
- **Input**: `{mix: ["a", 1, true, null]}`
- **Expected**: `"mix[4]: a,1,true,null"`

### TC-EV-26: Encodes empty array inline
- **Requirement**: FR-003 (AC-003-04)
- **Type**: boundary
- **Input**: `{items: []}`
- **Expected**: `"items[0]:"` (empty inline array)

### TC-EV-27: Encodes single-element primitive array
- **Requirement**: FR-003
- **Type**: boundary
- **Input**: `{solo: ["only"]}`
- **Expected**: `"solo[1]: only"`

### TC-EV-28: Quotes inline array elements containing commas
- **Requirement**: FR-003 (AC-003-05)
- **Type**: positive
- **Input**: `{vals: ["a,b", "c"]}`
- **Expected**: `"vals[2]: \"a,b\",c"`

### TC-EV-29: Encodes boolean array inline
- **Requirement**: FR-003 (AC-003-03)
- **Type**: positive
- **Input**: `{flags: [true, false, true]}`
- **Expected**: `"flags[3]: true,false,true"`

---

## 6. encodeValue() -- Mixed/List Array Tests

### TC-EV-30: Encodes array of non-uniform objects in list form
- **Requirement**: FR-004 (AC-004-01)
- **Type**: positive
- **Input**: `{items: [{a: 1}, {b: 2}]}`
- **Expected**: Contains `- a: 1` and `- b: 2` with indentation

### TC-EV-31: Encodes array of mixed types in list form
- **Requirement**: FR-004 (AC-004-02)
- **Type**: positive
- **Input**: `{items: [{a: 1}, "text", 42]}`
- **Expected**: Each element has `- ` prefix; primitives on `- ` line, objects nested

### TC-EV-32: Encodes nested objects within list items
- **Requirement**: FR-004 (AC-004-03)
- **Type**: positive
- **Input**: `{items: [{name: "a", config: {x: 1}}, {name: "b", config: {x: 2}}]}`
- **Expected**: First key-value on `- ` line, `config` nested deeper

### TC-EV-33: Encodes array of arrays in list form
- **Requirement**: FR-004
- **Type**: positive
- **Input**: `{matrix: [[1, 2], [3, 4]]}`
- **Expected**: Nested arrays encoded recursively within list items

### TC-EV-34: Encodes empty list-form array
- **Requirement**: FR-004
- **Type**: boundary
- **Input**: `{items: []}`
- **Expected**: `"items[0]:"` (empty arrays use inline form regardless)

---

## 7. encodeValue() -- Tabular Delegation Tests

### TC-EV-35: Delegates uniform array to encode()
- **Requirement**: FR-005 (AC-005-01)
- **Type**: positive
- **Input**: `[{id: 1, name: "A"}, {id: 2, name: "B"}]` (top-level uniform array)
- **Expected**: Output matches `encode()` output: `"[2]{id,name}:\n  1,A\n  2,B"`

### TC-EV-36: isUniformArray check before list form
- **Requirement**: FR-005 (AC-005-02)
- **Type**: positive
- **Input**: Object containing uniform array as value: `{users: [{id: 1, name: "A"}, {id: 2, name: "B"}]}`
- **Expected**: The `users` value is encoded in tabular form `[2]{id,name}:`

### TC-EV-37: Non-uniform array does NOT use tabular form
- **Requirement**: FR-005
- **Type**: negative
- **Input**: `{items: [{a: 1}, {b: 2}]}`
- **Expected**: Uses list form (`- ` prefix), not tabular form

---

## 8. encodeValue() -- Key Stripping Tests

### TC-EV-38: Strips _comment keys at top level
- **Requirement**: FR-006 (AC-006-01)
- **Type**: positive
- **Input**: `{_comment: "doc", name: "keep"}` with `stripKeys: ['_comment']`
- **Expected**: `"name: keep"` (no _comment in output)

### TC-EV-39: Strips _comment keys recursively
- **Requirement**: FR-006 (AC-006-02)
- **Type**: positive
- **Input**: `{phase: "01", config: {_comment: "nested", enabled: true}}` with `stripKeys: ['_comment']`
- **Expected**: `"phase: 01\nconfig:\n  enabled: true"` (no _comment at any level)

### TC-EV-40: No stripping when stripKeys is empty
- **Requirement**: FR-006 (AC-006-03)
- **Type**: positive
- **Input**: `{_comment: "doc", name: "keep"}` with `stripKeys: []`
- **Expected**: Both `_comment` and `name` appear in output

### TC-EV-41: No stripping when stripKeys is not provided
- **Requirement**: FR-006 (AC-006-03)
- **Type**: positive
- **Input**: `{_comment: "doc", name: "keep"}` with no options
- **Expected**: Both `_comment` and `name` appear in output

---

## 9. encodeValue() -- Options Tests

### TC-EV-42: Indent option adds leading spaces
- **Requirement**: FR-001
- **Type**: positive
- **Input**: `{a: 1}` with `{indent: 2}`
- **Expected**: `"    a: 1"` (4 spaces = 2 levels of indentation)

### TC-EV-43: Default options produce zero indentation
- **Requirement**: FR-001
- **Type**: positive
- **Input**: `{a: 1}` with no options
- **Expected**: `"a: 1"` (no leading spaces)

### TC-EV-44: Combined indent and stripKeys options
- **Requirement**: FR-001, FR-006
- **Type**: positive
- **Input**: `{_comment: "x", a: 1}` with `{indent: 1, stripKeys: ['_comment']}`
- **Expected**: `"  a: 1"` (2 spaces, no _comment)

---

## 10. decodeValue() -- Primitive Tests

### TC-DV-01: Decodes "null" to null
- **Requirement**: FR-008 (AC-008-04)
- **Type**: positive
- **Input**: `"null"`
- **Expected**: `null`

### TC-DV-02: Decodes "true" to true
- **Requirement**: FR-008 (AC-008-04)
- **Type**: positive
- **Input**: `"true"`
- **Expected**: `true`

### TC-DV-03: Decodes "false" to false
- **Requirement**: FR-008 (AC-008-04)
- **Type**: positive
- **Input**: `"false"`
- **Expected**: `false`

### TC-DV-04: Decodes numeric string to number
- **Requirement**: FR-008 (AC-008-04)
- **Type**: positive
- **Input**: `"42"`
- **Expected**: `42`

### TC-DV-05: Decodes bare string as string
- **Requirement**: FR-008 (AC-008-04)
- **Type**: positive
- **Input**: `"hello"`
- **Expected**: `"hello"`

---

## 11. decodeValue() -- Object Tests

### TC-DV-06: Decodes flat key-value pairs to object
- **Requirement**: FR-008 (AC-008-01)
- **Type**: positive
- **Input**: `"a: 1\nb: hello"`
- **Expected**: `{a: 1, b: "hello"}`

### TC-DV-07: Decodes nested indented object
- **Requirement**: FR-008 (AC-008-01)
- **Type**: positive
- **Input**: `"a:\n  b:\n    c: 1"`
- **Expected**: `{a: {b: {c: 1}}}`

### TC-DV-08: Decodes object with mixed value types
- **Requirement**: FR-008 (AC-008-01)
- **Type**: positive
- **Input**: `"str: hello\nnum: 42\nbool: true\nnil: null"`
- **Expected**: `{str: "hello", num: 42, bool: true, nil: null}`

### TC-DV-09: Decodes object with quoted string values
- **Requirement**: FR-008 (AC-008-04)
- **Type**: positive
- **Input**: `"desc: \"a,b\"\npath: \"a\\\\b\""`
- **Expected**: `{desc: "a,b", path: "a\\b"}`

### TC-DV-10: Decodes object with empty string value
- **Requirement**: FR-008 (AC-008-04)
- **Type**: boundary
- **Input**: `"empty: \"\""`
- **Expected**: `{empty: ""}`

---

## 12. decodeValue() -- Inline Array Tests

### TC-DV-11: Decodes inline string array
- **Requirement**: FR-008 (AC-008-02)
- **Type**: positive
- **Input**: `"tags[3]: a,b,c"`
- **Expected**: `{tags: ["a", "b", "c"]}`

### TC-DV-12: Decodes inline number array
- **Requirement**: FR-008 (AC-008-02)
- **Type**: positive
- **Input**: `"ids[3]: 1,2,3"`
- **Expected**: `{ids: [1, 2, 3]}`

### TC-DV-13: Decodes empty inline array
- **Requirement**: FR-008 (AC-008-02)
- **Type**: boundary
- **Input**: `"items[0]:"`
- **Expected**: `{items: []}`

### TC-DV-14: Decodes inline array with quoted elements
- **Requirement**: FR-008 (AC-008-02)
- **Type**: positive
- **Input**: `"vals[2]: \"a,b\",c"`
- **Expected**: `{vals: ["a,b", "c"]}`

---

## 13. decodeValue() -- List Array Tests

### TC-DV-15: Decodes simple list array
- **Requirement**: FR-008 (AC-008-03)
- **Type**: positive
- **Input**: `"- a\n- b\n- c"`
- **Expected**: `["a", "b", "c"]`

### TC-DV-16: Decodes list array of objects
- **Requirement**: FR-008 (AC-008-03)
- **Type**: positive
- **Input**: `"- a: 1\n- b: 2"`
- **Expected**: `[{a: 1}, {b: 2}]`

### TC-DV-17: Decodes list array with nested objects
- **Requirement**: FR-008 (AC-008-03)
- **Type**: positive
- **Input**: List items with multi-key objects (indented below `- ` line)
- **Expected**: Array of objects with correct nesting

### TC-DV-18: Decodes tabular format via existing decode()
- **Requirement**: FR-008
- **Type**: positive
- **Input**: `"[2]{x}:\n  1\n  2"`
- **Expected**: `[{x: 1}, {x: 2}]`

---

## 14. decodeValue() -- Error Handling Tests

### TC-DV-19: Falls back to JSON.parse for valid JSON input
- **Requirement**: FR-008
- **Type**: positive
- **Input**: `'{"a":1}'` (valid JSON)
- **Expected**: `{a: 1}` (parsed via JSON.parse fallback)

### TC-DV-20: Throws SyntaxError for invalid TOON and invalid JSON
- **Requirement**: FR-008
- **Type**: negative
- **Input**: `"completely invalid garbage!!!"`
- **Expected**: throws `SyntaxError`

### TC-DV-21: Handles empty string input
- **Requirement**: FR-008
- **Type**: boundary
- **Input**: `""`
- **Expected**: Either empty string or throws SyntaxError (implementation-defined)

### TC-DV-22: Handles whitespace-only input
- **Requirement**: FR-008
- **Type**: boundary
- **Input**: `"   \n   "`
- **Expected**: Graceful handling (empty object or SyntaxError)

---

## 15. Round-Trip encodeValue/decodeValue Tests

### TC-EVRT-01: Round-trips flat object
- **Requirement**: FR-008 (AC-008-05)
- **Type**: positive
- **Input**: `{name: "test", count: 42, active: true}`
- **Expected**: `decodeValue(encodeValue(input))` deep-equals `input`

### TC-EVRT-02: Round-trips nested object
- **Requirement**: FR-008 (AC-008-05)
- **Type**: positive
- **Input**: `{a: {b: {c: 1}}, d: "hello"}`
- **Expected**: Round-trip preserves structure

### TC-EVRT-03: Round-trips object with inline arrays
- **Requirement**: FR-008 (AC-008-05)
- **Type**: positive
- **Input**: `{name: "test", tags: ["a", "b", "c"], ids: [1, 2, 3]}`
- **Expected**: Round-trip preserves arrays

### TC-EVRT-04: Round-trips object with special characters
- **Requirement**: FR-008 (AC-008-05)
- **Type**: positive
- **Input**: `{desc: "a,b", path: "a\\b", text: "line1\nline2"}`
- **Expected**: Round-trip preserves escaped values

### TC-EVRT-05: Round-trips representative skills-manifest structure
- **Requirement**: FR-008 (AC-008-05)
- **Type**: positive
- **Input**: Extracted subset of `skills-manifest.json`
- **Expected**: Round-trip preserves structure (modulo `_comment` if stripped)

### TC-EVRT-06: Round-trips representative iteration-requirements structure
- **Requirement**: FR-008 (AC-008-05)
- **Type**: positive
- **Input**: Extracted subset of `iteration-requirements.json` (7 levels deep)
- **Expected**: Round-trip preserves structure (modulo `_comment`)

### TC-EVRT-07: Round-trips representative workflows structure
- **Requirement**: FR-008 (AC-008-05)
- **Type**: positive
- **Input**: Extracted subset of `workflows.json`
- **Expected**: Round-trip preserves structure

### TC-EVRT-08: Round-trips representative artifact-paths structure
- **Requirement**: FR-008 (AC-008-05)
- **Type**: positive
- **Input**: Extracted subset of `artifact-paths.json`
- **Expected**: Round-trip preserves structure

---

## 16. Module Exports Tests

### TC-MOD-01: All existing exports still present
- **Requirement**: FR-009 (AC-009-02)
- **Type**: positive
- **Input**: `require('./toon-encoder.cjs')`
- **Expected**: Module has `encode`, `decode`, `isUniformArray`, `serializeValue`, `deserializeValue`, `splitRow`, `MAX_ROWS`

### TC-MOD-02: New exports are present
- **Requirement**: FR-009 (AC-009-02)
- **Type**: positive
- **Input**: `require('./toon-encoder.cjs')`
- **Expected**: Module also has `encodeValue`, `decodeValue`, `isPrimitiveArray`

---

## 17. Backward Compatibility Tests

### TC-BC-01: All 47 existing tests pass unchanged
- **Requirement**: FR-009 (AC-009-01)
- **Type**: positive
- **Verification**: Run existing test suites (`isUniformArray()`, `encode()`, `decode()`, round-trip) -- all 47 pass without modification

### TC-BC-02: encode() still throws TypeError for non-uniform array
- **Requirement**: FR-009 (AC-009-01)
- **Type**: negative
- **Input**: `[{a:1}, {b:2}]`
- **Expected**: `TypeError` (existing behavior preserved)

### TC-BC-03: encode() still throws TypeError for non-array
- **Requirement**: FR-009 (AC-009-01)
- **Type**: negative
- **Input**: `"string"`, `null`, `42`
- **Expected**: `TypeError` (existing behavior preserved)

### TC-BC-04: decode() still falls back to JSON.parse
- **Requirement**: FR-009 (AC-009-01)
- **Type**: positive
- **Input**: `'[{"a":1}]'`
- **Expected**: `[{a: 1}]` (existing behavior preserved)

---

## 18. Cache Builder Integration Tests

### TC-CI-01: SKILLS_MANIFEST section is TOON-encoded
- **Requirement**: FR-007 (AC-007-01)
- **Type**: positive
- **Method**: Call `rebuildSessionCache()`, read output, verify SKILLS_MANIFEST section contains `[TOON]` marker
- **Expected**: Section starts with `[TOON]`, content is not JSON

### TC-CI-02: ITERATION_REQUIREMENTS section is TOON-encoded
- **Requirement**: FR-007 (AC-007-01)
- **Type**: positive
- **Method**: Call `rebuildSessionCache()`, verify section content
- **Expected**: Section starts with `[TOON]`, content uses indentation-based format

### TC-CI-03: WORKFLOW_CONFIG section is TOON-encoded
- **Requirement**: FR-007 (AC-007-01)
- **Type**: positive
- **Method**: Call `rebuildSessionCache()`, verify section content
- **Expected**: Section starts with `[TOON]`, content uses TOON format

### TC-CI-04: ARTIFACT_PATHS section is TOON-encoded
- **Requirement**: FR-007 (AC-007-01)
- **Type**: positive
- **Method**: Call `rebuildSessionCache()`, verify section content
- **Expected**: Section starts with `[TOON]`

### TC-CI-05: TOON marker is present in encoded sections
- **Requirement**: FR-007 (AC-007-02)
- **Type**: positive
- **Method**: Verify `[TOON]` prefix in each encoded section
- **Expected**: All 4 JSON sections have `[TOON]` prefix

### TC-CI-06: Fail-open JSON fallback on encodeValue error
- **Requirement**: FR-007 (AC-007-03)
- **Type**: negative
- **Method**: Stub `encodeValue()` to throw, run `rebuildSessionCache()`, verify section uses JSON
- **Expected**: Section content is valid JSON (no `[TOON]` marker), no exception propagated

### TC-CI-07: Fail-open JSON fallback on empty encodeValue output
- **Requirement**: FR-007 (AC-007-03)
- **Type**: negative
- **Method**: Stub `encodeValue()` to return `""`, verify fallback
- **Expected**: Section content is valid JSON

### TC-CI-08: Verbose mode logs encoding statistics
- **Requirement**: FR-007 (AC-007-04), FR-010 (AC-010-01)
- **Type**: positive
- **Method**: Call `rebuildSessionCache({verbose: true})`, capture stderr
- **Expected**: stderr contains per-section lines with section name, JSON chars, TOON chars, reduction %

### TC-CI-09: Verbose summary line reports total reduction
- **Requirement**: FR-010 (AC-010-02)
- **Type**: positive
- **Method**: Call `rebuildSessionCache({verbose: true})`, capture stderr
- **Expected**: stderr contains a summary line with total reduction

### TC-CI-10: _comment keys are stripped from all sections
- **Requirement**: FR-007 (AC-007-05)
- **Type**: positive
- **Method**: Verify TOON output does not contain `_comment` keys from iteration-requirements
- **Expected**: No `_comment:` or `_comment[` patterns in TOON sections

### TC-CI-11: Non-JSON sections are unchanged
- **Requirement**: FR-007
- **Type**: positive
- **Method**: Verify CONSTITUTION, SKILL_INDEX, EXTERNAL_SKILLS sections are not TOON-encoded
- **Expected**: These sections contain their original content (markdown), no `[TOON]` marker

### TC-CI-12: Cache file is written successfully
- **Requirement**: FR-007
- **Type**: positive
- **Method**: Verify `.isdlc/session-cache.md` exists and has content after rebuild
- **Expected**: File exists, non-empty, contains section delimiters

### TC-CI-13: Cache character reduction meets target
- **Requirement**: FR-007
- **Type**: positive
- **Method**: Compare total JSON section size before/after TOON encoding
- **Expected**: Combined reduction >= 25% across the 4 JSON sections

---

## 19. Performance Tests

### TC-PERF-01: Cache rebuild time within threshold
- **Requirement**: QA-003
- **Type**: positive
- **Method**: Time `rebuildSessionCache()` with TOON encoding, compare to JSON-only baseline
- **Expected**: Additional time < 100ms

### TC-PERF-02: encodeValue throughput per section
- **Requirement**: QA-003
- **Type**: positive
- **Method**: Time 100 iterations of `encodeValue()` for each source file
- **Expected**: Average < 10ms per section

### TC-PERF-03: Character reduction percentage
- **Requirement**: QA-003
- **Type**: positive
- **Method**: Measure JSON chars vs TOON chars for all 4 sections
- **Expected**: Combined reduction >= 25%

---

## Test Count Summary

| Suite | Positive | Negative | Boundary | Total |
|-------|----------|----------|----------|-------|
| isPrimitiveArray | 3 | 2 | 1 | 6 |
| encodeValue type dispatch | 7 | 0 | 1 | 8 |
| encodeValue nested objects | 5 | 0 | 3 | 8 |
| encodeValue key-value pairs | 4 | 0 | 2 | 6 |
| encodeValue inline arrays | 5 | 0 | 2 | 7 |
| encodeValue mixed/list arrays | 4 | 0 | 1 | 5 |
| encodeValue tabular delegation | 2 | 1 | 0 | 3 |
| encodeValue key stripping | 4 | 0 | 0 | 4 |
| encodeValue options | 3 | 0 | 0 | 3 |
| decodeValue primitives | 5 | 0 | 0 | 5 |
| decodeValue objects | 4 | 0 | 1 | 5 |
| decodeValue inline arrays | 3 | 0 | 1 | 4 |
| decodeValue list arrays | 3 | 0 | 0 | 3 |
| decodeValue tabular | 1 | 0 | 0 | 1 |
| decodeValue errors | 1 | 1 | 2 | 4 |
| Round-trip | 8 | 0 | 0 | 8 |
| Module exports | 2 | 0 | 0 | 2 |
| Backward compat | 2 | 2 | 0 | 4 |
| Cache integration | 9 | 2 | 0 | 11 |
| Performance | 3 | 0 | 0 | 3 |
| **Total** | **73** | **8** | **14** | **100** |

Negative + Boundary ratio: 22/100 = 22%.

Note: The 47 existing tests (TC-BC-01) are not counted individually in this matrix as they are verified by running the existing unchanged test suites. The total new test cases designed here is 100.
