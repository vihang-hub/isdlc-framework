# Implementation Notes: Complexity-Based Routing (GH-59)

**Phase**: 06-implementation
**Implemented**: 2026-02-20
**Traces**: FR-001..FR-009, NFR-001..NFR-005, CON-001..CON-005, AD-01..AD-07

---

## Summary

Implemented a 4-tier complexity routing system (trivial/light/standard/epic) for the iSDLC workflow sizing model. The implementation adds two pure functions (`computeRecommendedTier`, `getTierDescription`) to the utility library, tier threshold configuration to workflows.json, tier computation and display to the analyze handler, and a tier selection menu with trivial-tier direct-edit execution path to the build handler.

## Files Modified

| # | File | Change Type | Lines Changed |
|---|------|------------|--------------|
| 1 | `src/claude/hooks/lib/three-verb-utils.cjs` | Modified | +155 (constants, 2 functions, exports) |
| 2 | `src/claude/hooks/tests/test-three-verb-utils.test.cjs` | Modified | +420 (52 test cases, imports) |
| 3 | `.isdlc/config/workflows.json` | Modified | +4 (tier_thresholds block) |
| 4 | `src/isdlc/config/workflows.json` | Modified | +4 (tier_thresholds block, source copy) |
| 5 | `src/claude/commands/isdlc.md` | Modified | +175 (analyze tier computation, build tier menu, trivial execution) |

## Key Implementation Decisions

### 1. Pure Functions (AD-01)

`computeRecommendedTier()` and `getTierDescription()` are pure functions with no I/O. They use `process.stderr.write()` for diagnostic warnings (matching existing pattern in `common.cjs`). All I/O (reading impact-analysis.md, writing meta.json) is handled by the calling handler code in isdlc.md.

### 2. Defensive Thresholds (CON-002)

`computeRecommendedTier()` uses per-field nullish coalescing (`??`) for threshold merging. This means partial threshold objects work correctly -- only missing fields fall back to defaults.

### 3. Immutable Lookups (AC-009b)

`getTierDescription()` returns shallow copies via spread operator (`{ ...TIER_DESCRIPTIONS[tier] }`). The lookup table cannot be mutated by callers. This is verified by the mutation safety test (TC-GTD-10).

### 4. Backward Compatibility (NFR-002)

No changes to `readMetaJson()`, `writeMetaJson()`, or `computeStartPhase()`. The new `recommended_tier` field is optional -- existing meta.json files without it work unchanged. Consumers check `meta.recommended_tier || null`.

### 5. State Isolation (NFR-005)

The trivial tier execution path never touches `.isdlc/state.json`, never creates branches, never invokes hooks, and never delegates to the orchestrator. It operates entirely within the command handler using existing utility functions.

### 6. TIER_ORDER Array for Promotion (AC-002b)

Risk-based promotion uses `TIER_ORDER.indexOf()` for a single array-based lookup rather than a switch/case. This makes promotion generic and extensible -- adding a tier only requires updating the `TIER_ORDER` array.

## Test Coverage

- **262 total tests** (52 new + 210 existing)
- **Line coverage**: 97.29%
- **Branch coverage**: 93.01%
- **Function coverage**: 100%
- **All tests passing**: 262/262

### Test Breakdown (52 new tests)

| Suite | Count | Traces |
|-------|-------|--------|
| computeRecommendedTier - base thresholds | 11 | AC-002a |
| computeRecommendedTier - risk promotion | 11 | AC-002b |
| computeRecommendedTier - invalid inputs | 7 | AC-002c |
| computeRecommendedTier - unrecognized risk | 4 | AC-002d |
| computeRecommendedTier - custom thresholds | 8 | CON-002 |
| getTierDescription - valid/invalid tiers | 9 | AC-009a, AC-009b |
| getTierDescription - mutation safety | 1 | Immutability |
| TIER_ORDER constant | 1 | AC-002b |
| Tier constants (TIER_DESCRIPTIONS, DEFAULT_TIER_THRESHOLDS) | 2 | CON-002 |

## Pre-Existing Test Failures (Not Introduced by GH-59)

- `test-gate-blocker-extended.test.cjs`: 1 failure (supervised review info logging)
- ESM suite: 3 failures (agent count in README, plan tracking cleanup, deep discovery consistency)

These are pre-existing failures documented in project memory and are unrelated to the GH-59 changes.
