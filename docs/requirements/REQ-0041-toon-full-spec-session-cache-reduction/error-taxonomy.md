# Error Taxonomy: REQ-0041 TOON Full Spec Session Cache Reduction

| Field | Value |
|-------|-------|
| **Status** | Complete |
| **Confidence** | High |
| **Last Updated** | 2026-02-26 |
| **Coverage** | Encoder errors, decoder errors, cache builder errors, recovery strategies |

---

## 1. Encoder Errors (encodeValue)

### E-ENC-001: Circular Reference

| Field | Value |
|-------|-------|
| **Trigger** | Object graph contains a circular reference |
| **Error Type** | `TypeError` (from JSON.stringify fallback or stack overflow) |
| **Likelihood** | Very Low -- cache source files are static JSON |
| **Recovery** | Caught by per-section try/catch in cache builder; falls back to JSON.stringify which also throws; section is skipped with `SKIPPED` marker |
| **Prevention** | None needed -- static JSON files cannot have circular references |

### E-ENC-002: Unsupported Value Type

| Field | Value |
|-------|-------|
| **Trigger** | Value is a Function, Symbol, BigInt, or other non-serializable type |
| **Error Type** | Silent -- `serializeValue()` returns `"null"` for non-serializable types |
| **Likelihood** | Very Low -- cache source files contain only JSON-compatible types |
| **Recovery** | Automatic -- non-serializable values become `null` in output |
| **Prevention** | Type checking in `encodeValue()` dispatches known types; unknown types go through `serializeValue()` |

### E-ENC-003: Deeply Nested Structure

| Field | Value |
|-------|-------|
| **Trigger** | Object nesting exceeds reasonable depth (>20 levels) |
| **Error Type** | `RangeError` (stack overflow from recursion) |
| **Likelihood** | Very Low -- deepest known structure is 7 levels |
| **Recovery** | Caught by per-section try/catch; falls back to JSON |
| **Prevention** | Optional max-depth guard in `encodeValue()` (configurable, default 20) |

### E-ENC-004: Special Characters in Key Names

| Field | Value |
|-------|-------|
| **Trigger** | Object key contains `:`, newline, or other characters that conflict with TOON key format |
| **Error Type** | Silent -- produces ambiguous output |
| **Likelihood** | Low -- JSON config keys use alphanumeric + hyphen + underscore |
| **Recovery** | Round-trip test would catch this; in production, JSON fallback |
| **Prevention** | Keys are emitted bare; if a key contains `: ` it would be misinterpreted by the decoder. Not a production concern (LLM consumer handles context). Test suite validates with representative data. |

## 2. Decoder Errors (decodeValue)

### E-DEC-001: Ambiguous Indentation

| Field | Value |
|-------|-------|
| **Trigger** | Input uses inconsistent indentation (mix of tabs and spaces, or non-2-space increments) |
| **Error Type** | `SyntaxError` or incorrect parse result |
| **Likelihood** | Very Low -- encoder always produces 2-space indentation |
| **Recovery** | Falls back to JSON.parse() |
| **Prevention** | Decoder assumes 2-space indentation; non-conforming input falls through to JSON.parse() |

### E-DEC-002: Malformed Inline Array

| Field | Value |
|-------|-------|
| **Trigger** | Inline array header `key[N]:` has mismatched count vs actual comma-separated values |
| **Error Type** | Silent mismatch or `SyntaxError` |
| **Likelihood** | Very Low -- encoder produces correct counts |
| **Recovery** | Decoder can either trust the count or count actual elements; test-only concern |
| **Prevention** | Round-trip tests validate count correctness |

### E-DEC-003: Invalid TOON Input

| Field | Value |
|-------|-------|
| **Trigger** | Input is neither valid TOON nor valid JSON |
| **Error Type** | `SyntaxError` with message "Failed to decode: input is neither valid TOON nor valid JSON" |
| **Likelihood** | Low -- decoder is only called in tests with known input |
| **Recovery** | Error propagates to test assertion |
| **Prevention** | N/A -- this is the expected error for bad input |

## 3. Cache Builder Errors

### E-CACHE-001: Source File Missing

| Field | Value |
|-------|-------|
| **Trigger** | A JSON source file (e.g., `skills-manifest.json`) does not exist at the expected path |
| **Error Type** | `Error` (ENOENT from fs.readFileSync) |
| **Likelihood** | Low -- files are part of the installed framework |
| **Recovery** | Caught by existing `buildSection()` try/catch; section emitted with `SKIPPED: {error.message}` marker |
| **Prevention** | Existing behavior; no change from REQ-0041 |

### E-CACHE-002: Source File Invalid JSON

| Field | Value |
|-------|-------|
| **Trigger** | A JSON source file contains malformed JSON |
| **Error Type** | `SyntaxError` from `JSON.parse()` |
| **Likelihood** | Very Low -- files are committed and tested |
| **Recovery** | Caught by `buildSection()` try/catch; section skipped |
| **Prevention** | Existing behavior; no change from REQ-0041 |

### E-CACHE-003: TOON Encoding Failure

| Field | Value |
|-------|-------|
| **Trigger** | `encodeValue()` throws an unexpected error for valid JSON data |
| **Error Type** | Any (caught generically) |
| **Likelihood** | Low -- but possible for edge cases in early implementation |
| **Recovery** | Caught by inner try/catch around `encodeValue()` call; falls back to `JSON.stringify(data, null, 2)` |
| **Prevention** | Comprehensive test suite with real cache section data |

### E-CACHE-004: TOON Output Empty or Invalid

| Field | Value |
|-------|-------|
| **Trigger** | `encodeValue()` returns empty string or whitespace-only string |
| **Error Type** | None (logical check) |
| **Likelihood** | Very Low |
| **Recovery** | Guard check `if (toonContent && toonContent.trim().length > 0)` before using TOON output; falls back to JSON |
| **Prevention** | `encodeValue()` always produces non-empty output for non-empty input |

## 4. Error Handling Strategy Summary

| Layer | Strategy | Behavior on Error |
|-------|----------|-------------------|
| `encodeValue()` | Throw on truly invalid input; handle edge cases gracefully | Caller catches and falls back |
| `decodeValue()` | Attempt TOON parse; fall back to `JSON.parse()`; throw `SyntaxError` if both fail | Consistent with existing `decode()` pattern |
| `rebuildSessionCache()` per-section | Inner try/catch around `encodeValue()` call | Falls back to JSON.stringify for that section |
| `rebuildSessionCache()` `buildSection()` | Outer try/catch per section | Section skipped with marker |
| `inject-session-cache.cjs` | Top-level try/catch | No output, no error, exit 0 |

The error handling forms a three-layer defense:
1. Encoder-level: graceful handling of edge cases
2. Section-level: JSON fallback if TOON encoding fails
3. Cache-level: section skipping if everything fails

No error in the TOON encoding path can cause a cache rebuild failure or a session start failure.

## Pending Sections

None -- all sections complete.
