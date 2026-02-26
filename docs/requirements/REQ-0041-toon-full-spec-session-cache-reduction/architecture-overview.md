# Architecture Overview: REQ-0041 TOON Full Spec Session Cache Reduction

| Field | Value |
|-------|-------|
| **Status** | Complete |
| **Confidence** | High |
| **Last Updated** | 2026-02-26 |
| **Coverage** | Architecture decisions, integration strategy, technology assessment |

---

## 1. Architecture Context

### Current State

```
Source Files (JSON)                    Session Cache
  skills-manifest.json ──┐
  iteration-requirements.json ──┤
  workflows.json ──────────────┼──> rebuildSessionCache() ──> .isdlc/session-cache.md ──> inject hook ──> LLM
  artifact-paths.json ─────────┘        │
                                        ├── TOON attempt (SKILLS_MANIFEST only)
                                        │     └── isUniformArray() → false → JSON fallback
                                        └── JSON.stringify for all other sections
```

### Target State

```
Source Files (JSON)                    Session Cache
  skills-manifest.json ──┐
  iteration-requirements.json ──┤
  workflows.json ──────────────┼──> rebuildSessionCache() ──> .isdlc/session-cache.md ──> inject hook ──> LLM
  artifact-paths.json ─────────┘        │
                                        ├── encodeValue(data, {stripKeys: ['_comment']})
                                        │     ├── Nested objects → indentation
                                        │     ├── Key-value pairs → bare key: value
                                        │     ├── Primitive arrays → inline key[N]: v1,v2
                                        │     ├── Uniform arrays → tabular [N]{fields}:
                                        │     └── Mixed arrays → list form (- prefix)
                                        └── JSON fallback per section on failure
```

## 2. Architecture Decisions

### ADR-0041-01: Additive API Extension

**Status**: Accepted

**Context**: The TOON encoder currently exports `encode()` for tabular arrays and `decode()` for tabular decoding. We need to handle arbitrary JavaScript values (nested objects, mixed arrays, primitives).

**Options**:

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A: Extend `encode()` to detect input type | Overload `encode()` to handle objects, arrays, and primitives in addition to uniform arrays | Single entry point; simpler API | Breaks existing contract (TypeError for non-uniform arrays); risk of subtle behavioral changes |
| B: New `encodeValue()` function alongside existing `encode()` | Add `encodeValue()` for general-purpose encoding; `encode()` unchanged | Zero backward compatibility risk; clear separation of concerns; `encodeValue()` delegates to `encode()` for uniform arrays | Two encoding entry points; caller must choose |
| C: Replace entire module | Rewrite encoder from scratch with unified API | Clean slate; no legacy constraints | High risk; 47 tests need rewriting; no incremental rollback |

**Decision**: Option B -- new `encodeValue()` alongside existing `encode()`.

**Rationale**: Zero risk to existing functionality. The 47 existing tests serve as a regression gate. `encodeValue()` can delegate to `encode()` for uniform arrays (FR-005), reusing proven code. Callers that already use `encode()` (currently none in production, but the API contract exists) are unaffected.

### ADR-0041-02: Per-Section Fail-Open with JSON Fallback

**Status**: Accepted

**Context**: The cache builder assembles multiple sections. If TOON encoding fails for one section, the entire cache rebuild should not fail.

**Options**:

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A: All-or-nothing TOON encoding | If any section fails TOON encoding, fall back to JSON for all sections | Simple logic; consistent output format | One bad section degrades all savings |
| B: Per-section fail-open | Each section independently attempts TOON encoding; failure falls back to JSON for that section only | Maximum savings; one failure doesn't affect others; aligns with REQ-0040 ADR-0040-03 | Mixed format in cache (some TOON, some JSON) |
| C: Pre-validation pass | Validate all data against TOON encodability before encoding any section | Consistent format guarantee | Extra processing; still need fallback for edge cases |

**Decision**: Option B -- per-section fail-open.

**Rationale**: Continues the pattern established by REQ-0040 (ADR-0040-03). The existing `buildSection()` helper already wraps each section in a try/catch, so per-section fallback is the natural integration pattern. The LLM handles mixed formats (TOON sections + JSON sections + markdown sections) without issue since each section is delimited by `<!-- SECTION: NAME -->` markers.

### ADR-0041-03: Decoder Scope -- Test-Only

**Status**: Accepted

**Context**: The session cache has a single consumer (LLM context injection via `inject-session-cache.cjs`), which is a raw pipe with no parsing. A decoder is needed only for round-trip test verification.

**Options**:

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A: Full production-grade decoder | Optimize for performance, error recovery, streaming | Future-proof if programmatic consumers appear | Over-engineering; no current consumer; adds maintenance burden |
| B: Test-only decoder | Functional correctness for round-trip validation; no performance optimization | Right-sized; validates encoding correctness; minimal maintenance | Must be updated when encoder features change |
| C: No decoder | Rely on manual inspection and LLM behavioral testing | Least code; simplest | No automated round-trip validation; harder to catch encoding bugs |

**Decision**: Option B -- test-only decoder.

**Rationale**: Round-trip testing (`decodeValue(encodeValue(data))` deep-equals original) is the most reliable way to validate encoding correctness. Without it, subtle encoding bugs (wrong indentation, missing values, type coercion) would only surface through LLM behavioral testing, which is non-deterministic. The decoder doesn't need to be fast -- it runs only in tests.

### ADR-0041-04: `_comment` Key Stripping via Encoder Option

**Status**: Accepted

**Context**: JSON config files contain `_comment` keys for human documentation. These are never read programmatically and waste tokens in the cache.

**Options**:

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A: Strip in encoder via `stripKeys` option | Encoder accepts list of keys to omit during encoding | Reusable; caller controls which keys; single responsibility | Encoder does filtering + encoding |
| B: Strip in cache builder before encoding | Pre-process JSON data to remove `_comment` keys, then encode | Clean separation; encoder stays pure | Deep-clone + recursive delete for every section; more code in common.cjs |
| C: Strip in source files | Remove `_comment` from the JSON files themselves | Simplest encoding path | Loses documentation in source files; out of scope per requirements |

**Decision**: Option A -- strip in encoder via `stripKeys` option.

**Rationale**: The `stripKeys` option is a single array parameter that the encoder checks during object traversal. It's more efficient than pre-processing (no deep clone needed) and keeps the logic in one place. The caller (cache builder) simply passes `{ stripKeys: ['_comment'] }`.

## 3. Integration Strategy

### Cache Builder Changes

The `rebuildSessionCache()` function currently has TOON integration in one place (SKILLS_MANIFEST section, lines 4147-4172). The target state expands this to all four JSON sections using a consistent pattern:

```
For each JSON section:
  1. Read and parse source JSON file
  2. Attempt: toonEncoder.encodeValue(parsed, { stripKeys: ['_comment'] })
  3. If success: prefix with [TOON] marker, use TOON content
  4. If failure: fall back to JSON.stringify(parsed, null, 2)
  5. If verbose: log encoding statistics to stderr
```

This pattern is encapsulated in a helper within `rebuildSessionCache()` to avoid duplicating the try/catch/fallback logic four times.

### Module Boundary

```
toon-encoder.cjs (modified)
  ├── encode(data)           [existing, unchanged]
  ├── decode(toonString)     [existing, unchanged]
  ├── isUniformArray(data)   [existing, unchanged]
  ├── serializeValue(value)  [existing, unchanged -- reused by encodeValue]
  ├── deserializeValue(raw)  [existing, unchanged -- reused by decodeValue]
  ├── splitRow(line)         [existing, unchanged -- reused by decodeValue]
  ├── encodeValue(data, options)  [NEW: general-purpose encoder]
  ├── decodeValue(toonString)     [NEW: general-purpose decoder, test-only]
  └── MAX_ROWS               [existing, unchanged]

common.cjs (modified)
  └── rebuildSessionCache()
        ├── Section SKILLS_MANIFEST:      encodeValue() with stripKeys
        ├── Section ITERATION_REQUIREMENTS: encodeValue() with stripKeys
        ├── Section WORKFLOW_CONFIG:       encodeValue() with stripKeys
        └── Section ARTIFACT_PATHS:        encodeValue() with stripKeys
```

## 4. Technology Assessment

### New Dependencies

None. The TOON encoder remains a zero-dependency CJS module. The `encodeValue()` and `decodeValue()` functions use only built-in JavaScript features (string manipulation, recursion, type checking).

### Compatibility

- **Node.js**: >= 20.0.0 (unchanged from project requirement)
- **Module format**: CJS (`.cjs` extension, consistent with all hooks)
- **Testing**: `node:test` + `node:assert/strict` (CJS test stream)

## 5. Performance Considerations

### Encoding Time

The four JSON sections total ~51K characters of input. TOON encoding involves:
- Object graph traversal (recursive, depth <= 7)
- String serialization (reuses existing `serializeValue()`)
- String concatenation for output assembly

Expected additional time: < 50ms for all four sections combined. Cache rebuild is not latency-sensitive (runs on session start or manual trigger).

### Output Size

| Section | JSON (current) | TOON (target) | Savings |
|---------|---------------|---------------|---------|
| SKILLS_MANIFEST | 20,796 chars | ~14,224 chars | 32% |
| ITERATION_REQUIREMENTS | 18,545 chars | ~11,544 chars | 38% |
| WORKFLOW_CONFIG | 11,043 chars | ~8,140 chars | 26% |
| ARTIFACT_PATHS | 792 chars | ~595 chars | 25% |
| **Total** | **51,176 chars** | **~34,503 chars** | **33%** |

Net cache reduction: ~16,700 characters (9.4% of 177K total cache).

## Pending Sections

None -- all sections complete.
