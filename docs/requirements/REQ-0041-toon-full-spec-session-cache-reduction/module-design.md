# Module Design: REQ-0041 TOON Full Spec Session Cache Reduction

| Field | Value |
|-------|-------|
| **Status** | Complete |
| **Confidence** | High |
| **Last Updated** | 2026-02-26 |
| **Coverage** | Module structure, data flow, encoding rules, decoder spec |

---

## 1. Module: toon-encoder.cjs

### Responsibility

Encode arbitrary JavaScript values into TOON (Token-Oriented Object Notation) format and decode TOON strings back to JavaScript values. Provides both the original tabular encoding (REQ-0040) and the new general-purpose encoding (REQ-0041).

### Public API (After REQ-0041)

| Export | Signature | Status |
|--------|-----------|--------|
| `encode(data)` | `(Array<Object>) => string` | Existing -- unchanged |
| `decode(toonString)` | `(string) => Array<Object>` | Existing -- unchanged |
| `isUniformArray(data)` | `(*) => boolean` | Existing -- unchanged |
| `serializeValue(value)` | `(*) => string` | Existing -- unchanged |
| `deserializeValue(raw)` | `(string) => *` | Existing -- unchanged |
| `splitRow(line)` | `(string) => string[]` | Existing -- unchanged |
| `MAX_ROWS` | `number (10000)` | Existing -- unchanged |
| **`encodeValue(data, options)`** | `(*, EncodeOptions?) => string` | **NEW** |
| **`decodeValue(toonString)`** | `(string) => *` | **NEW** |

### EncodeOptions Type

```javascript
/**
 * @typedef {object} EncodeOptions
 * @property {number} [indent=0] - Starting indentation level (two spaces per level)
 * @property {string[]} [stripKeys=[]] - Keys to omit from output at all nesting levels
 */
```

## 2. encodeValue() Encoding Rules

### 2.1 Type Dispatch

`encodeValue(data, options)` inspects the type of `data` and dispatches to the appropriate encoding strategy:

| Input Type | Detection | Encoding Strategy |
|-----------|-----------|-------------------|
| `null` or `undefined` | `data == null` | Emit `null` |
| `boolean` | `typeof data === 'boolean'` | Emit `true` or `false` |
| `number` | `typeof data === 'number'` | Emit numeric literal via `String(data)` |
| `string` | `typeof data === 'string'` | Emit via `serializeValue(data)` |
| Uniform array of objects | `isUniformArray(data)` | Delegate to `encode(data)` |
| Primitive array | Array where every element is string, number, boolean, or null | Emit inline `[N]: v1,v2,...` |
| Mixed/object array | Array not matching above | Emit list form with `- ` prefix |
| Plain object | `typeof data === 'object' && !Array.isArray(data)` | Emit indented key-value block |

### 2.2 Plain Object Encoding

For a plain object at indentation level `L`:

```
{indent}key1: value1
{indent}key2: value2
{indent}key3:
{indent}  nested_key: nested_value
```

Rules:
- Each key is emitted bare (no quotes) followed by `: `
- If the value is a primitive, it follows on the same line
- If the value is an object or array, a newline follows and the value is encoded at `L+1`
- Keys listed in `stripKeys` are omitted entirely
- Indentation is `'  '.repeat(L)` (two spaces per level)

### 2.3 Inline Primitive Array Encoding

For an array where every element is a primitive (string, number, boolean, null):

```
{indent}key[N]: v1,v2,v3
```

Rules:
- `N` is the array length
- Each element is serialized via `serializeValue()` (handles quoting for special chars)
- Elements are joined with `,` (no spaces)
- Empty arrays produce `key[0]:`

### 2.4 List-Form Array Encoding

For arrays containing objects or mixed complex types:

```
{indent}key:
{indent}  - element1_content
{indent}  - element2_key: element2_value
{indent}    element2_key2: element2_value2
```

Rules:
- Each element is prefixed with `- ` at indentation level `L+1`
- If the element is a primitive, it follows on the `- ` line
- If the element is an object, its first key-value pair follows on the `- ` line and subsequent pairs are indented at `L+2`
- If the element is an array, it is encoded recursively

### 2.5 Uniform Array Tabular Encoding

When `isUniformArray(data)` returns true:

```
[N]{field1,field2,...}:
  value1,value2,...
  value1,value2,...
```

This delegates directly to the existing `encode()` function. The `stripKeys` option is applied to each object in the array before delegation.

### 2.6 Top-Level Invocation

When called at the top level (indent=0), `encodeValue()` does NOT emit a key prefix. It emits only the value content. The caller (cache builder) is responsible for any section headers or markers.

## 3. decodeValue() Parsing Rules

### 3.1 Parser Architecture

`decodeValue()` implements a line-by-line recursive descent parser:

1. Split input into lines
2. Track current line index and indentation stack
3. At each line, determine the content type:
   - `key[N]: values` -- inline primitive array
   - `key:` (with content on next line at deeper indent) -- nested object or array
   - `key: value` -- key-value pair
   - `- content` -- list item
   - `[N]{fields}:` -- tabular array header (delegate to existing `decode()`)

### 3.2 Indentation Tracking

- Each indentation level is two spaces
- A line's level is `countLeadingSpaces(line) / 2`
- When level increases, we're entering a nested structure
- When level decreases or equals current, we're closing the current structure

### 3.3 Type Reconstruction

| TOON Pattern | Reconstructed JS Type |
|-------------|----------------------|
| `null` | `null` |
| `true` / `false` | `boolean` |
| Numeric literal | `number` |
| Bare string | `string` |
| Quoted string | `string` (unescaped) |
| `key[N]: v1,v2,...` | `string[]` or `number[]` etc. (elements deserialized individually) |
| Indented key-value block | `object` |
| `- ` prefixed items | `array` |
| `[N]{fields}:` header | delegate to `decode()` |

## 4. Cache Builder Integration

### Modified Section Builder Pattern

Within `rebuildSessionCache()`, a helper function encapsulates the TOON encoding attempt:

```javascript
function buildJsonSection(name, sourcePath, options) {
    const raw = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    const jsonContent = JSON.stringify(raw, null, 2);

    try {
        const toonContent = toonEncoder.encodeValue(raw, {
            stripKeys: ['_comment']
        });
        if (toonContent && toonContent.trim().length > 0) {
            if (verbose) {
                const reduction = ((1 - toonContent.length / jsonContent.length) * 100).toFixed(1);
                process.stderr.write(
                    `TOON ${name}: ${jsonContent.length} -> ${toonContent.length} chars (${reduction}% reduction)\n`
                );
            }
            return '[TOON]\n' + toonContent;
        }
    } catch (_) {
        // Fail-open: fall through to JSON
    }

    return jsonContent;
}
```

### Section Application

| Section | Current Code | New Code |
|---------|-------------|----------|
| SKILLS_MANIFEST | Custom TOON attempt with `isUniformArray()` check | `buildJsonSection('SKILLS_MANIFEST', manifestPath)` |
| ITERATION_REQUIREMENTS | `fs.readFileSync(path, 'utf8')` (raw JSON text) | `buildJsonSection('ITERATION_REQUIREMENTS', irPath)` |
| WORKFLOW_CONFIG | `fs.readFileSync(path, 'utf8')` (raw JSON text) | `buildJsonSection('WORKFLOW_CONFIG', wfPath)` |
| ARTIFACT_PATHS | `fs.readFileSync(path, 'utf8')` (raw JSON text) | `buildJsonSection('ARTIFACT_PATHS', apPath)` |

## 5. Data Flow

```
Cache Rebuild Trigger (session start or manual)
  │
  ▼
rebuildSessionCache()
  │
  ├── Section: CONSTITUTION ──────────> fs.readFileSync() ──> raw markdown (unchanged)
  ├── Section: WORKFLOW_CONFIG ───────> JSON.parse() ──> encodeValue() ──> TOON or JSON fallback
  ├── Section: ITERATION_REQUIREMENTS > JSON.parse() ──> encodeValue() ──> TOON or JSON fallback
  ├── Section: ARTIFACT_PATHS ────────> JSON.parse() ──> encodeValue() ──> TOON or JSON fallback
  ├── Section: SKILLS_MANIFEST ───────> JSON.parse() ──> encodeValue() ──> TOON or JSON fallback
  ├── Section: SKILL_INDEX ───────────> formatSkillIndexBlock() ──> markdown (unchanged)
  ├── Section: EXTERNAL_SKILLS ───────> markdown (unchanged)
  ├── Section: ROUNDTABLE_CONTEXT ────> markdown (unchanged)
  └── Section: DISCOVERY_CONTEXT ─────> markdown (unchanged)
  │
  ▼
Assemble header + sections ──> write .isdlc/session-cache.md
  │
  ▼
inject-session-cache.cjs ──> fs.readFileSync() ──> stdout ──> LLM context window
```

## Pending Sections

None -- all sections complete.
