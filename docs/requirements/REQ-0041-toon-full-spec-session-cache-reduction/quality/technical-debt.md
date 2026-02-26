# Technical Debt Report: REQ-0041 TOON Full Spec Session Cache Reduction

| Field | Value |
|-------|-------|
| **Phase** | 08-code-review |
| **Date** | 2026-02-26 |
| **Status** | Low risk |

---

## New Technical Debt Introduced

### TD-001: _encodeListArray complexity

| Attribute | Value |
|-----------|-------|
| Severity | Low |
| File | `src/claude/hooks/lib/toon-encoder.cjs` |
| Lines | 494-581 |
| Category | Complexity |

**Description**: `_encodeListArray()` handles multiple sub-cases: primitive items, nested arrays, object items with first-key-on-dash-line optimization, and remaining keys at deeper indent. At 88 lines, the function is approaching extraction threshold but remains readable with clear comments.

**Remediation**: Consider extracting object-in-list encoding into a separate `_encodeObjectListItem()` helper if this function grows further. Not blocking.

---

### TD-002: decodeValue parser test coverage

| Attribute | Value |
|-----------|-------|
| Severity | Low |
| File | `src/claude/hooks/lib/toon-encoder.cjs` |
| Lines | 600-970 |
| Category | Test debt |

**Description**: The `decodeValue()` parser has ~275 lines of parsing logic with several branch paths. The test suite covers 22 decode tests and 8 round-trip tests, which cover the primary paths and edge cases. However, `decodeValue()` is a test-only function (per FR-008) and a more exhaustive fuzzing approach could surface obscure corner cases in the parser.

**Remediation**: Add property-based testing with random data generation if decode reliability becomes a concern. Not blocking since this function is never called in production.

---

### TD-003: TOON format specification documentation

| Attribute | Value |
|-----------|-------|
| Severity | Low |
| File | N/A (missing artifact) |
| Category | Documentation |

**Description**: The TOON format specification is informally documented across JSDoc comments in `toon-encoder.cjs`. A formal specification document (`docs/isdlc/toon-format-spec.md`) would aid future maintainers in understanding the format grammar, escaping rules, and structural conventions.

**Remediation**: Create a formal TOON format specification as a separate documentation task. Not blocking.

---

## Pre-Existing Technical Debt (Not Introduced by REQ-0041)

| ID | Description | Owner |
|----|-------------|-------|
| PRE-001 | `common.cjs` is 4,428 lines -- monolith concern | Framework maintenance |
| PRE-002 | TC-REG-01/02 failures indicate settings.json schema drift | Hook registration |
| PRE-003 | 9 pre-existing test failures across hook test suite | Various |

## Summary

| Category | New | Pre-existing |
|----------|-----|-------------|
| Critical | 0 | 0 |
| High | 0 | 0 |
| Medium | 0 | 1 (PRE-001) |
| Low | 3 | 2 (PRE-002, PRE-003) |

No new high or critical technical debt introduced by REQ-0041.
