# Implementation Notes: REQ-0098 — Debate Team Orchestration Pattern

## Summary

Added 4 debate team instance configs to the team instance registry, following the same frozen-config pattern as REQ-0095/0096/0097.

## Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `src/core/teams/instances/debate-requirements.js` | 23 | debate_requirements instance (phase 01) |
| `src/core/teams/instances/debate-architecture.js` | 23 | debate_architecture instance (phase 03) |
| `src/core/teams/instances/debate-design.js` | 23 | debate_design instance (phase 04) |
| `src/core/teams/instances/debate-test-strategy.js` | 23 | debate_test_strategy instance (phase 05) |
| `tests/core/teams/debate-instances.test.js` | 148 | 21 unit tests for debate instances |

## Files Modified

| File | Changes |
|------|---------|
| `src/core/teams/instance-registry.js` | Added 4 imports, 4 Map entries, updated phaseIndex to also index by `phase` field |
| `tests/core/teams/instance-registry.test.js` | Updated IR-07 (3->7 count), IR-08 (added debate_requirements), added IR-12..IR-19 |

## Key Decision: Phase Index Update

The existing phaseIndex only indexed by `input_dependency`. Debate instances have a `phase` field indicating which phase they belong to. The `getTeamInstancesByPhase()` function needed to return debate_requirements for phase `01-requirements` (AC-004-03), but debate_requirements has `input_dependency: null`.

**Solution**: Updated the phaseIndex builder to index by both `input_dependency` and `phase` fields. This is backward-compatible -- existing instances without a `phase` field are unaffected.

## Test Results

- 566/566 core tests pass (0 failures)
- 29 new tests added (21 in debate-instances.test.js, 8 in instance-registry.test.js)
- TDD: all tests green in iteration 1 (no fixes needed)
- 3 pre-existing failures in `lib/` tests are unrelated to this change

## Total New Lines

~90 lines production code + ~148 lines test code = ~238 lines total.
