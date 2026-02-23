# Test Strategy: BUG-0033 BACKLOG.md Completion Marking Not Wired Into Finalize

**Bug ID:** BUG-0033-GH-11
**Phase:** 05-test-strategy
**Created:** 2026-02-23
**Workflow Type:** fix

---

## Existing Infrastructure (from test evaluation)

- **Framework**: Node.js built-in `node:test` + `node:assert/strict` (Node 18+)
- **CJS Test Pattern**: `src/claude/hooks/tests/*.test.cjs` (run via `node --test`)
- **Reference Test File**: `test-bug-0032-jira-spec.test.cjs` (spec validation pattern)
- **Existing Utilities**: `updateBacklogMarker()`, `appendToBacklog()`, `parseBacklogLine()` in `three-verb-utils.cjs`
- **BACKLOG.md Utilities**: Already tested in `test-three-verb-utils.test.cjs`

## Nature of the Fix

This is a **specification-only fix** modifying three files:
1. `src/claude/agents/00-sdlc-orchestrator.md` -- un-nest BACKLOG.md step from Jira sync, add to finalize summary
2. `src/claude/commands/isdlc.md` -- add BACKLOG.md sync section parallel to Jira/GitHub sync in STEP 4
3. `src/claude/hooks/lib/three-verb-utils.cjs` -- may need enhancement for `completeBacklogItem()` or enhanced `updateBacklogMarker()`

### Testing Implications

Because the primary fix is a specification change:
- **Specification validation tests (SV)** verify that the orchestrator and isdlc.md contain the correct BACKLOG.md update instructions after the fix
- **Regression tests (RT)** confirm existing Jira sync, GitHub sync, and trivial tier behaviors are preserved
- **Structural parity tests (SS)** verify BACKLOG.md sync is structured parallel to Jira sync and GitHub sync

## Test Pyramid

### Level 1: Specification Validation Tests (Primary -- TDD Red Phase)

Programmatic tests that read `00-sdlc-orchestrator.md` and `isdlc.md` and assert the presence of required specification patterns. These tests will FAIL before the fix is applied (TDD red phase).

| Test ID | Description | What It Validates | Target File |
|---------|-------------|-------------------|-------------|
| SV-01 | Orchestrator finalize has a top-level BACKLOG.md step (not nested under Jira sync) | FR-006, AC-008 | 00-sdlc-orchestrator.md |
| SV-02 | Orchestrator finalize mode summary (line 655 area) includes BACKLOG.md | FR-006, AC-008 | 00-sdlc-orchestrator.md |
| SV-03 | Orchestrator BACKLOG.md step matches by artifact_folder | FR-001, AC-001 | 00-sdlc-orchestrator.md |
| SV-04 | Orchestrator BACKLOG.md step matches by external_id (GH-N, PROJ-N) | FR-001, AC-002 | 00-sdlc-orchestrator.md |
| SV-05 | Orchestrator BACKLOG.md step marks checkbox [x] | FR-002, AC-001 | 00-sdlc-orchestrator.md |
| SV-06 | Orchestrator BACKLOG.md step adds Completed date sub-bullet | FR-003, AC-001 | 00-sdlc-orchestrator.md |
| SV-07 | Orchestrator BACKLOG.md step moves item block to ## Completed | FR-004, AC-001 | 00-sdlc-orchestrator.md |
| SV-08 | Orchestrator BACKLOG.md step is non-blocking (warning on failure) | FR-005, AC-003, AC-004, AC-005 | 00-sdlc-orchestrator.md |
| SV-09 | Orchestrator BACKLOG.md step creates ## Completed section if missing | FR-004, AC-006 | 00-sdlc-orchestrator.md |
| SV-10 | Orchestrator BACKLOG.md step preserves sub-bullets on move | FR-004, AC-007 | 00-sdlc-orchestrator.md |
| SV-11 | isdlc.md STEP 4 has BACKLOG.md sync section at same level as Jira sync | FR-006, AC-008 | isdlc.md |
| SV-12 | isdlc.md BACKLOG.md sync is NOT nested under Jira sync | FR-006, AC-008 | isdlc.md |
| SV-13 | isdlc.md BACKLOG.md sync describes matching strategy | FR-001, AC-001, AC-002 | isdlc.md |
| SV-14 | isdlc.md BACKLOG.md sync describes non-blocking behavior | FR-005 | isdlc.md |

### Level 2: Regression Tests (Secondary -- Must PASS)

Tests confirming that existing finalize behavior is preserved after the fix.

| Test ID | Description | What It Validates |
|---------|-------------|-------------------|
| RT-01 | Orchestrator still has Jira sync block (step 2.5) with MCP transition | CON-002, existing Jira behavior |
| RT-02 | Orchestrator Jira sync still skips when jira_ticket_id absent | CON-002, non-Jira workflow path |
| RT-03 | Orchestrator finalize still includes merge, prune, workflow_history steps | CON-002, finalize sequence |
| RT-04 | isdlc.md STEP 4 still has Jira sync section | CON-002, existing controller docs |
| RT-05 | isdlc.md STEP 4 still has GitHub sync section | CON-002, existing controller docs |
| RT-06 | Trivial tier (T8) still calls updateBacklogMarker with "x" | CON-002, trivial tier path |
| RT-07 | updateBacklogMarker function still exported from three-verb-utils | CON-003, API preservation |
| RT-08 | appendToBacklog function still exported from three-verb-utils | CON-003, API preservation |

### Level 3: Specification Structure Tests (Tertiary)

Tests verifying structural consistency between the three external sync sections.

| Test ID | Description | What It Validates |
|---------|-------------|-------------------|
| SS-01 | isdlc.md STEP 4 has all three sync sections: Jira, GitHub, BACKLOG.md | Structural completeness |
| SS-02 | Orchestrator finalize sequence mentions BACKLOG.md alongside merge and prune | Structural parity |
| SS-03 | BACKLOG.md sync section mentions non-blocking (matching Jira/GitHub pattern) | Behavioral parity |
| SS-04 | Orchestrator step numbering is consistent (no orphaned sub-steps) | Structural integrity |

## Flaky Test Mitigation

All tests in this strategy are deterministic:
- **Specification validation tests** read static files (`00-sdlc-orchestrator.md`, `isdlc.md`) and check for string/regex patterns. No network, no timing, no randomness.
- **Regression tests** read static files and check for preserved patterns. No I/O side effects.
- **No mocking required**: Tests do not call external services.

Flaky test risk: **NONE** (all tests are pure file-read-only).

## Performance Test Plan

Performance testing is **not applicable** for this bug fix because:
1. The fix adds specification text to markdown files -- there is no runtime code path to benchmark.
2. `updateBacklogMarker()` and `appendToBacklog()` are file-read-write operations already tested for correctness.
3. BACKLOG.md is a small file (< 500 lines typically) -- no performance concerns.

## Coverage Targets

| Test Type | Count | Coverage Target |
|-----------|-------|-----------------|
| Specification Validation (SV) | 14 | 100% of requirements (FR-001 through FR-006, AC-001 through AC-008) |
| Regression Tests (RT) | 8 | 100% of existing finalize behavior preservation |
| Specification Structure (SS) | 4 | Structural parity between all sync sections |
| **Total** | **26** | **100% requirement coverage** |

## TDD Red Phase Expectations

| Category | Expected Pre-Fix Status | Reason |
|----------|------------------------|--------|
| SV-01 through SV-14 | **FAILING** | Spec patterns do not yet exist in target files |
| RT-01 through RT-08 | **PASSING** | Validating existing behavior that must be preserved |
| SS-01 through SS-04 | **FAILING** | Structural parity not yet established |

## Test Commands (existing infrastructure)

- **Run BUG-0033 spec tests**: `node --test src/claude/hooks/tests/test-bug-0033-backlog-finalize-spec.test.cjs`
- **Run all hook tests**: `npm run test:hooks`
- **Run all tests**: `npm run test:all`

## Critical Paths

1. **Orchestrator finalize BACKLOG.md path**: Finalize runs -> reads BACKLOG.md -> matches by artifact_folder/external_id -> marks [x] -> adds Completed date -> moves to ## Completed -> writes file
2. **Graceful degradation paths**: No BACKLOG.md file -> skip silently; No matching entry -> log warning, continue; Malformed file -> log warning, preserve original content
3. **Non-interference path**: Jira sync and GitHub sync continue to work independently of BACKLOG.md sync
4. **Trivial tier path**: T8 step still calls updateBacklogMarker directly (separate from finalize path)
