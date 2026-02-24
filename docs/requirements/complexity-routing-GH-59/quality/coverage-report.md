# Coverage Report -- Complexity-Based Routing (GH-59)

| Field | Value |
|-------|-------|
| Date | 2026-02-20 |
| Test File | `src/claude/hooks/tests/test-three-verb-utils.test.cjs` |
| Total Test Cases | 262 (full file), 54 tier-specific |

---

## Coverage by New Function

### computeRecommendedTier() -- 41 test cases

| Category | Tests | Status |
|----------|-------|--------|
| Base tier from file count (AC-002a) | 8 | PASS |
| Risk-based promotion (AC-002b) | 12 | PASS |
| Invalid estimatedFiles (AC-002c) | 9 | PASS |
| Unrecognized riskLevel (AC-002d) | 4 | PASS |
| Custom thresholds (CON-002) | 8 | PASS |

**Boundary values covered:**
- trivial_max_files boundary: 0, 1, 2 (at), 3 (above)
- light_max_files boundary: 7, 8 (at), 9 (above)
- standard_max_files boundary: 19, 20 (at), 21 (above)
- epic: 100, 1000
- Edge: 0 files, very large numbers

**Invalid input coverage:**
- null, undefined, NaN, Infinity, -Infinity
- Negative numbers, objects, arrays, strings, booleans

**Risk promotion coverage:**
- low risk: no promotion (all tiers)
- medium risk: +1 tier promotion (all base tiers)
- high risk: +1 tier promotion (all base tiers)
- epic ceiling: medium/high risk at epic stays epic

### getTierDescription() -- 10 test cases

| Category | Tests | Status |
|----------|-------|--------|
| Valid tiers (AC-009a) | 4 | PASS |
| Invalid/unknown tiers (AC-009b) | 5 | PASS |
| Mutation safety | 1 | PASS |

### TIER_ORDER -- 1 test case

| Category | Tests | Status |
|----------|-------|--------|
| Correct order and count (AC-002b) | 1 | PASS |

### Tier Constants -- 2 test cases

| Category | Tests | Status |
|----------|-------|--------|
| TIER_DESCRIPTIONS keys match TIER_ORDER | 1 | PASS |
| DEFAULT_TIER_THRESHOLDS has required fields (CON-002) | 1 | PASS |

---

## Coverage Metrics

| Metric | Value |
|--------|-------|
| New functions | 2 (computeRecommendedTier, getTierDescription) |
| New constants | 3 (TIER_ORDER, DEFAULT_TIER_THRESHOLDS, TIER_DESCRIPTIONS) |
| New test cases | 54 |
| Branch coverage (estimated) | 100% of new code paths |
| Line coverage (estimated) | 100% of new lines |
| Note | No built-in coverage tool (c8/istanbul) configured; coverage estimated from test case analysis |
