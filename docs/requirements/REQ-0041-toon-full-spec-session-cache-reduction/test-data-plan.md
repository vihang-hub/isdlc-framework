# Test Data Plan: REQ-0041 TOON Full Spec Session Cache Reduction

| Field | Value |
|-------|-------|
| **Status** | Complete |
| **Phase** | 05 - Test Strategy |
| **Last Updated** | 2026-02-26 |
| **Coverage** | Synthetic data, real cache fixtures, boundary values, invalid inputs, maximum-size inputs |

---

## 1. Synthetic Test Data

### 1.1 Primitive Values

| Category | Values | Purpose |
|----------|--------|---------|
| Null | `null`, `undefined` | Type dispatch to "null" |
| Boolean | `true`, `false` | Type dispatch to boolean literals |
| Number (integer) | `0`, `1`, `-1`, `42`, `999999` | Numeric literal encoding |
| Number (float) | `3.14`, `-0.5`, `1e10` | Float precision preservation |
| String (simple) | `"hello"`, `"world"`, `"test-value"`, `"snake_case"` | Bare string encoding |
| String (empty) | `""` | Quoted empty string |
| String (with comma) | `"a,b"`, `"one,two,three"` | Quoting trigger |
| String (with quote) | `'say "hi"'`, `'"quoted"'` | Quote escaping |
| String (with newline) | `"line1\nline2"` | Newline escaping |
| String (with backslash) | `"path\\to\\file"` | Backslash escaping |
| String (with mixed specials) | `'"a,b\\c\n"'` | Multiple escape rules |

### 1.2 Object Values

| Category | Value | Purpose |
|----------|-------|---------|
| Empty object | `{}` | Boundary: zero keys |
| Single-key object | `{name: "test"}` | Boundary: minimal object |
| Flat object | `{a: 1, b: "hello", c: true, d: null}` | Mixed primitive values |
| Nested 2 levels | `{a: {b: 1}}` | Basic nesting |
| Nested 3 levels | `{a: {b: {c: 1}}}` | Medium nesting |
| Nested 7 levels | See Section 3 | Maximum real depth |
| Object with arrays | `{name: "test", tags: ["a", "b"]}` | Mixed object+array values |
| Object with _comment | `{_comment: "doc", name: "test"}` | Key stripping target |
| Object with special keys | `{"my-key": 1, "under_score": 2}` | Hyphen/underscore in keys |
| Large object (20 keys) | `{k1: "v1", ..., k20: "v20"}` | Scale testing |

### 1.3 Array Values

| Category | Value | Purpose |
|----------|-------|---------|
| Empty array | `[]` | Boundary: zero elements |
| Single string | `["only"]` | Boundary: minimal array |
| Primitive strings | `["a", "b", "c"]` | Inline encoding |
| Primitive numbers | `[1, 2, 3]` | Inline encoding |
| Primitive booleans | `[true, false, true]` | Inline encoding |
| Mixed primitives | `["a", 1, true, null]` | Mixed inline encoding |
| Primitives with commas | `["a,b", "c"]` | Inline quoting |
| Uniform objects | `[{id: 1, name: "A"}, {id: 2, name: "B"}]` | Tabular delegation |
| Non-uniform objects | `[{a: 1}, {b: 2}]` | List form encoding |
| Mixed types | `[{a: 1}, "text", 42]` | List form encoding |
| Nested arrays | `[[1, 2], [3, 4]]` | Recursive encoding |
| Objects with nesting | `[{name: "a", config: {x: 1}}]` | List form with nesting |

---

## 2. Boundary Values

### 2.1 Empty/Minimal Inputs

| Input | Expected Output | Test Case |
|-------|----------------|-----------|
| `null` | `"null"` | TC-EV-01 |
| `undefined` | `"null"` | TC-EV-02 |
| `""` (empty string) | `"\"\""` | TC-EV-08 context |
| `{}` (empty object) | `""` (empty string) | TC-EV-13 |
| `[]` (empty array) | `"key[0]:"` as value | TC-EV-26 |
| `{a: ""}` (empty value) | `"a: \"\""` | TC-EV-22 |

### 2.2 Single-Element Inputs

| Input | Expected Output | Test Case |
|-------|----------------|-----------|
| `{name: "test"}` | `"name: test"` | TC-EV-14 |
| `["only"]` | `"key[1]: only"` as value | TC-EV-27 |
| `[{id: 1}]` | Tabular `"[1]{id}:\n  1"` | TC-EV-35 context |

### 2.3 Maximum Nesting Depth

| Depth | Input Structure | Test Case |
|-------|----------------|-----------|
| 1 | `{a: 1}` | TC-EV-14 |
| 2 | `{a: {b: 1}}` | TC-EV-10 |
| 3 | `{a: {b: {c: 1}}}` | TC-EV-10 |
| 7 | See Section 3 (real iteration-requirements depth) | TC-EV-12 |

### 2.4 Indentation Levels

| Indent | Input | Expected Prefix | Test Case |
|--------|-------|----------------|-----------|
| 0 | `{a: 1}` | No prefix | TC-EV-43 |
| 1 | `{a: 1}` | 2 spaces | TC-EV-42 context |
| 2 | `{a: 1}` | 4 spaces | TC-EV-42 |
| 5 | `{a: 1}` | 10 spaces | Edge case (not explicitly tested but covered by recursion) |

### 2.5 Array Length Boundaries

| Length | Input | Format | Test Case |
|--------|-------|--------|-----------|
| 0 | `[]` | `key[0]:` | TC-EV-26 |
| 1 | `["a"]` | `key[1]: a` | TC-EV-27 |
| 10 | `["a"..."j"]` | `key[10]: a,b,...,j` | Covered by real data fixtures |
| 100+ | Large primitive array | `key[N]: ...` | TC-PERF-02 context |

---

## 3. Maximum-Size Inputs

### 3.1 Seven-Level Nested Object

Matches the maximum nesting depth found in `iteration-requirements.json`:

```javascript
const sevenLevelObject = {
  level1: {
    level2: {
      level3: {
        level4: {
          level5: {
            level6: {
              level7: "deep_value"
            }
          }
        }
      }
    }
  }
};
```

**Expected TOON output**:
```
level1:
  level2:
    level3:
      level4:
        level5:
          level6:
            level7: deep_value
```

### 3.2 Large Flat Object (20+ Keys)

```javascript
const largeObject = {};
for (let i = 1; i <= 20; i++) {
  largeObject[`key_${i}`] = `value_${i}`;
}
```

**Purpose**: Verify encoding scales linearly with key count.

### 3.3 Large Primitive Array (100 Elements)

```javascript
const largeArray = Array.from({length: 100}, (_, i) => `item-${i}`);
```

**Purpose**: Verify inline encoding handles long comma-separated lists.

### 3.4 Object with Many Nested Arrays

```javascript
const complexObject = {
  section1: { tags: ["a", "b", "c"], ids: [1, 2, 3] },
  section2: { flags: [true, false], names: ["x", "y", "z"] },
  section3: { mixed: ["a", 1, true, null] }
};
```

**Purpose**: Verify multiple inline arrays within a nested structure.

---

## 4. Invalid Inputs

### 4.1 encodeValue() Invalid Inputs

| Input | Expected Behavior | Test Case |
|-------|-------------------|-----------|
| `undefined` (explicit) | Returns `"null"` | TC-EV-02 |
| `Symbol('test')` | Returns `"null"` via serializeValue fallback | Not explicitly tested (very low likelihood) |
| `function() {}` | Returns `"null"` via serializeValue fallback | Not explicitly tested (very low likelihood) |
| Circular reference | Throws (stack overflow) -- caught by cache builder | E-ENC-001 in error taxonomy |

Note: `encodeValue()` is designed to handle all JS types gracefully. Truly invalid inputs (circular refs) are caught by the cache builder's try/catch.

### 4.2 decodeValue() Invalid Inputs

| Input | Expected Behavior | Test Case |
|-------|-------------------|-----------|
| `""` (empty string) | Throws SyntaxError or returns empty | TC-DV-21 |
| `"   \n   "` (whitespace) | Returns empty object or throws | TC-DV-22 |
| `"completely invalid garbage!!!"` | Throws SyntaxError | TC-DV-20 |
| `"key: value\n  broken indent"` | Attempts TOON parse, may produce unexpected result, falls back to JSON | Covered by error handling tests |
| `null` (non-string) | Throws TypeError | Not explicitly tested (type contract violation) |
| Valid JSON string | Falls back to JSON.parse | TC-DV-19 |

### 4.3 Cache Builder Invalid Inputs

| Scenario | Expected Behavior | Test Case |
|----------|-------------------|-----------|
| `encodeValue()` throws | Falls back to JSON.stringify | TC-CI-06 |
| `encodeValue()` returns empty | Falls back to JSON.stringify | TC-CI-07 |
| Source JSON file missing | Section skipped with error marker | Existing behavior (not new) |
| Source JSON file malformed | Section skipped with error marker | Existing behavior (not new) |

---

## 5. Real Cache Data Fixtures

These fixtures are extracted from actual source files to ensure the encoder handles real-world data patterns.

### 5.1 skills-manifest.json Subset

```javascript
const skillsManifestFixture = {
  version: "5.0.0",
  ownership: {
    "requirements-analyst": {
      phase: "01-requirements",
      skills: ["REQ-001", "REQ-002", "REQ-003"]
    },
    "software-developer": {
      phase: "06-implementation",
      skills: ["DEV-001", "DEV-002"]
    }
  },
  skill_lookup: {
    "REQ-001": { category: "requirements", path: "requirements/elicitation/SKILL.md" },
    "REQ-002": { category: "requirements", path: "requirements/prioritization/SKILL.md" }
  }
};
```

### 5.2 iteration-requirements.json Subset

```javascript
const iterReqFixture = {
  _comment: "Top-level doc",
  version: "2.0.0",
  phases: {
    "01-requirements": {
      _comment: "Phase 1 settings",
      gate: "GATE-01",
      iteration: {
        max_iterations: 5,
        circuit_breaker_threshold: 3,
        completion_criteria: {
          _comment: "Criteria doc",
          artifacts: ["requirements-spec.md"],
          constitutional_articles: ["I", "IV", "VII"]
        }
      }
    }
  }
};
```

### 5.3 workflows.json Subset

```javascript
const workflowsFixture = {
  feature: {
    phases: ["01-requirements", "03-design", "05-test-strategy", "06-implementation"],
    options: {
      skip_elicitation: false,
      require_roundtable: true
    },
    sizing: {
      small: { max_phases: 4 },
      large: { max_phases: 8 }
    }
  }
};
```

### 5.4 artifact-paths.json Subset

```javascript
const artifactPathsFixture = {
  "01-requirements": {
    output: ["requirements-spec.md", "quick-scan.md"],
    validation: ["gate-01-requirements.json"]
  },
  "03-design": {
    output: ["module-design.md", "interface-spec.md"],
    validation: ["gate-03-design.json"]
  }
};
```

---

## 6. Test Data Generation Strategy

### Approach

All test data is constructed as JavaScript literals directly in the test file. No external test data files are required for unit tests. This ensures:

1. **Determinism**: Test data is version-controlled with the test code
2. **Isolation**: No dependency on filesystem state or config file locations
3. **Readability**: Each test case shows its input inline

### Integration Test Data

Integration tests (`TC-CI-*`) require a temporary project structure with actual JSON files. The test setup:

1. Creates a temp directory via `os.tmpdir()` + `mkdtempSync()`
2. Copies source files (`toon-encoder.cjs`, `common.cjs`) to temp
3. Creates minimal JSON fixture files in the expected directory structure
4. Runs `rebuildSessionCache()` against the temp project root
5. Validates output content
6. Cleans up temp directory in `after()` hook

### Round-Trip Test Data

Round-trip tests use the real cache fixtures from Section 5. For each fixture:

1. `const encoded = encodeValue(fixture, { stripKeys: ['_comment'] })`
2. `const decoded = decodeValue(encoded)`
3. `const expected = removeKeys(fixture, ['_comment'])` (strip keys from original for comparison)
4. `assert.deepStrictEqual(decoded, expected)`

---

## 7. Data Coverage Matrix

| Data Category | FR-001 | FR-002 | FR-003 | FR-004 | FR-005 | FR-006 | FR-007 | FR-008 |
|--------------|--------|--------|--------|--------|--------|--------|--------|--------|
| Primitives | X | X | X | | | | | X |
| Empty values | X | X | X | X | | | | X |
| Simple objects | X | X | | | | | | X |
| Nested objects | X | X | | | | | X | X |
| Deep nesting (7) | X | | | | | | X | X |
| Primitive arrays | | | X | | | | | X |
| Object arrays | | | | X | X | | | X |
| Mixed arrays | | | | X | | | | X |
| _comment keys | | | | | | X | X | X |
| Special chars | | X | X | | | | | X |
| Real cache data | X | X | X | X | X | X | X | X |
