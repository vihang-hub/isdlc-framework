# Implementation Notes: Multi-agent Test Strategy Team (REQ-0016)

**Phase**: 06-implementation
**Created**: 2026-02-15
**Traces**: FR-01 through FR-07, NFR-01 through NFR-04, C-01 through C-04, ADR-0005 through ADR-0007

---

## Summary

Implemented the Creator/Critic/Refiner debate loop for Phase 05 (Test Strategy & Design). This adds adversarial review to test strategy artifacts, catching coverage gaps, missing negative tests, flaky test risks, and other defects before they reach implementation.

## Files Created

| File | Type | Description | Traces |
|------|------|-------------|--------|
| `src/claude/agents/04-test-strategy-critic.md` | CREATE | Critic agent with 8 mandatory checks TC-01..TC-08 | FR-01, FR-02 |
| `src/claude/agents/04-test-strategy-refiner.md` | CREATE | Refiner agent with fix strategies for each TC check | FR-03 |
| `src/claude/hooks/tests/test-strategy-debate-team.test.cjs` | CREATE | 88 test cases across 10 groups | FR-07 |

## Files Modified

| File | Type | Description | Traces |
|------|------|-------------|--------|
| `src/claude/agents/04-test-design-engineer.md` | MODIFY | Added DEBATE_CONTEXT mode detection and debate behavior sections | FR-05 |
| `src/claude/agents/00-sdlc-orchestrator.md` | MODIFY | Added 05-test-strategy row to DEBATE_ROUTING table; updated Phases line | FR-04 |
| `src/claude/commands/isdlc.md` | MODIFY | Updated debate-enabled phases documentation to include Phase 05 | Documentation |
| `src/claude/hooks/config/skills-manifest.json` | MODIFY | Added test-strategy-critic and test-strategy-refiner agent entries | FR-06 |

## Key Implementation Decisions

### 1. Agent File Prefix: `04-` (ADR-0005)
Both new agents use the `04-` prefix to match the Creator agent (test-design-engineer), following the established convention where debate team members share the same numeric prefix as their phase's primary agent.

### 2. No New Skill IDs (ADR-0006)
The Critic and Refiner agents reuse existing TEST-* skill IDs from the test-design-engineer. The Critic has a 3-skill subset (TEST-002, TEST-004, TEST-005) while the Refiner has a 5-skill superset (TEST-001 through TEST-005). The total_skills count in the manifest remains at 242.

### 3. Manifest Agents Only (ADR-0007)
Only the Phase 05 critic/refiner agents were added to the skills-manifest.json. Existing critic/refiner agents from Phases 01, 03, 04 were not retroactively added (deferred to a separate backlog item for consistency).

### 4. Creator Awareness: Additive Insert
The DEBATE_CONTEXT sections were inserted into `04-test-design-engineer.md` between the Monorepo Mode paragraph and the PHASE OVERVIEW heading. No existing content was modified. Single-agent mode (no DEBATE_CONTEXT) preserves exact current behavior.

### 5. Manifest Structure
The skills-manifest.json uses `ownership` (not `agents`) as the key for agent entries, `skill_lookup` (not `skill_owners`) for the skill-to-agent mapping, and `total_skills` at the top level (not nested under `meta`). Tests were written to match this actual structure.

## Test Results

- **Total tests**: 88 (all passing)
- **Test groups**: 10
- **Duration**: ~46ms
- **Regressions**: 0 (full suite: 1368 tests pass)

### Test Group Breakdown

| Group | Name | Tests | Status |
|-------|------|-------|--------|
| 1 | Critic Agent File Validation | 13 | PASS |
| 2 | Refiner Agent File Validation | 12 | PASS |
| 3 | DEBATE_ROUTING Table Validation | 10 | PASS |
| 4 | Creator Awareness Validation | 8 | PASS |
| 5 | Skills Manifest Agent Entries | 10 | PASS |
| 6 | Manifest Invariants and Constraints | 8 | PASS |
| 7 | Cross-Module Consistency | 8 | PASS |
| 8 | Pattern Compliance | 5 | PASS |
| 9 | Regression Guards | 4 | PASS |
| 10 | Edge Cases and Boundary Tests | 10 | PASS |

## Sync Status

The `.claude/` runtime directory uses symlinks to `src/claude/`, so all changes are automatically reflected at runtime. No manual sync was required.

## Iteration History

| Iteration | Action | Result | Fix Applied |
|-----------|--------|--------|-------------|
| 1 | Initial implementation + tests | 26 failures | Manifest key names wrong (`agents` vs `ownership`, `skill_owners` vs `skill_lookup`, `meta.total_skills` vs `total_skills`) |
| 2 | Fixed manifest key references + TC-087 scanner | 88 pass, 0 fail | All fixed |
