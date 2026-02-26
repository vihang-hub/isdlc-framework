# Design Summary: REQ-0041 TOON Full Spec Session Cache Reduction

| Field | Value |
|-------|-------|
| **Status** | Complete |
| **Confidence** | High |
| **Last Updated** | 2026-02-26 |
| **Coverage** | Executive summary of all design artifacts |

---

## Overview

REQ-0041 upgrades the TOON encoder from tabular-only encoding (REQ-0040) to full TOON specification compliance, enabling encoding of all four JSON sections in the iSDLC session cache. This reduces cache context window consumption by approximately 9.4% (from ~177K to ~161K characters), recovering ~16,700 characters for developer conversation.

## Key Design Decisions

1. **Additive API** (ADR-0041-01): New `encodeValue()` and `decodeValue()` functions are added alongside the existing `encode()` and `decode()`. Zero backward compatibility risk.

2. **Per-section fail-open** (ADR-0041-02): Each JSON section independently attempts TOON encoding with JSON fallback. One section's failure does not affect others.

3. **Test-only decoder** (ADR-0041-03): `decodeValue()` exists solely for round-trip test validation. The LLM is the only production consumer of TOON output.

4. **Key stripping in encoder** (ADR-0041-04): `stripKeys` option removes `_comment` fields during encoding, reducing token waste from documentation keys.

## Change Scope

| Component | Change | Risk |
|-----------|--------|------|
| `toon-encoder.cjs` | Add `encodeValue()`, `decodeValue()`, `isPrimitiveArray()` | Medium (new code) |
| `common.cjs` | Expand TOON encoding from 1 section to 4 sections | Low (contained) |
| `toon-encoder.test.cjs` | Add ~200-300 lines of new tests | Low (additive) |

## TOON Features Used

| Feature | Applied To | Token Savings Source |
|---------|-----------|---------------------|
| Nested objects (indentation) | All 4 JSON sections | Eliminates `{` `}` braces and key quoting |
| Key-value pairs (bare) | All object properties | Eliminates `"key":` quoting overhead |
| Inline primitive arrays | `articles`, `phases`, `skills`, `paths` arrays | Eliminates `[` `]` brackets and per-element quoting |
| Tabular arrays | Uniform object arrays within sections | Existing REQ-0040 optimization preserved |
| List-form arrays | Mixed/object arrays | Eliminates `[` `]` and per-item `{` `}` |

## Expected Outcomes

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| JSON sections total | 51,176 chars | ~34,503 chars | -33% |
| Full cache size | 177,704 chars | ~161,000 chars | -9.4% |
| Context window consumption | ~44% | ~39-40% | -4-5 percentage points |

## Artifacts Produced

| Artifact | Owner | Status |
|----------|-------|--------|
| `quick-scan.md` | Lead | Complete |
| `requirements-spec.md` | Maya | Complete |
| `impact-analysis.md` | Alex | Complete |
| `architecture-overview.md` | Alex | Complete |
| `module-design.md` | Jordan | Complete |
| `interface-spec.md` | Jordan | Complete |
| `error-taxonomy.md` | Jordan | Complete |
| `design-summary.md` | Jordan | Complete |

## Implementation Order

1. Core encoder: nested objects, key-value pairs, inline primitive arrays
2. Complete encoder: mixed arrays, tabular delegation, key stripping
3. Decoder and round-trip tests
4. Cache builder integration and end-to-end validation
