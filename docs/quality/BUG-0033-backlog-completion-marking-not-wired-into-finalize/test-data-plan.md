# Test Data Plan: BUG-0033 BACKLOG.md Completion Marking Not Wired Into Finalize

**Bug ID:** BUG-0033-GH-11
**Phase:** 05-test-strategy
**Created:** 2026-02-23

---

## Overview

This bug fix modifies markdown specification files (`00-sdlc-orchestrator.md`, `isdlc.md`) and potentially a utility file (`three-verb-utils.cjs`). Test data consists of:
1. **String patterns** checked against the specification file content
2. **Section extraction patterns** for isolating specific file regions
3. **Function exports** verified for API preservation

No database fixtures, API mocks, or runtime test data are needed.

---

## Boundary Values

### Specification File Boundaries

| Input | Expected | Boundary Type | Test |
|-------|----------|---------------|------|
| Orchestrator finalize section (lines 585-610) | Contains BACKLOG.md step | Section boundary | SV-01 |
| Orchestrator mode summary (line 655 area) | Includes BACKLOG reference | Single-line match | SV-02 |
| isdlc.md STEP 4 section (lines 2231-2260) | Contains 3 sync sections | Multi-section match | SS-01 |
| isdlc.md Jira sync sub-bullets (lines 2243-2247) | No BACKLOG.md reference | Absence validation | SV-12 |

### Matching Strategy Boundaries

| Pattern | What It Matches | Boundary Type | Test |
|---------|----------------|---------------|------|
| `artifact_folder` in BACKLOG.md step | Slug-based matching (primary) | Happy path | SV-03 |
| `external_id` / `source_id` | Reference-based matching (fallback) | External ref | SV-04 |
| No match found | Warning logged, workflow continues | No-match boundary | SV-08 |
| No BACKLOG.md file | Silent skip, workflow continues | Missing file boundary | SV-08 |
| Malformed BACKLOG.md | Warning, no corruption | Malformed input boundary | SV-08 |

---

## Invalid Inputs

### Specification Validation Invalid States (Pre-Fix)

The specification validation tests check for the **absence** of required patterns before the fix is applied. These represent the "invalid state" of the specification:

| Pattern | Valid State (post-fix) | Invalid State (pre-fix) | Test |
|---------|----------------------|------------------------|------|
| Top-level BACKLOG.md step in orchestrator finalize | Independent step (2.6 or similar) | Nested as step 2.5d under Jira sync | SV-01 |
| BACKLOG in finalize mode summary | Present in summary text | Absent from summary | SV-02 |
| artifact_folder matching in BACKLOG step | Present in step instructions | Not specified | SV-03 |
| external_id matching in BACKLOG step | Present as fallback | Not specified | SV-04 |
| Completed date sub-bullet instruction | Present in step | Not specified | SV-06 |
| Move to ## Completed instruction | Present in step | Not specified | SV-07 |
| BACKLOG.md sync section in isdlc.md | Peer section to Jira/GitHub | Sub-bullet of Jira sync | SV-11, SV-12 |

### Regression Preservation States

| Feature | Valid State (preserved) | Invalid State (broken) | Test |
|---------|----------------------|------------------------|------|
| Jira sync block | Still has "JIRA STATUS SYNC" heading | Accidentally removed | RT-01 |
| Jira skip conditional | "absent or null: SKIP" still present | Guard removed | RT-02 |
| Finalize sequence steps | merge, prune, workflow_history present | Any step missing | RT-03 |
| isdlc.md Jira sync | "Jira sync" heading in STEP 4 | Accidentally removed | RT-04 |
| isdlc.md GitHub sync | "GitHub sync" heading in STEP 4 | Accidentally removed | RT-05 |
| Trivial tier T8 | updateBacklogMarker with "x" | T8 step broken | RT-06 |

---

## Maximum-Size Inputs

### Specification File Size

| File | Approximate Size | Read Strategy | Performance Impact |
|------|-----------------|---------------|-------------------|
| `00-sdlc-orchestrator.md` | ~1600 lines | Read once, cache | Negligible (< 1ms regex) |
| `isdlc.md` | ~2400 lines | Read once, cache | Negligible (< 1ms regex) |
| `three-verb-utils.cjs` | ~1400 lines | `require()` module | Negligible |

All files are read once at the start of the test suite and cached in module-level variables. Regex operations on these file sizes complete in sub-millisecond time.

---

## Specification Pattern Data

These are the exact regex patterns used in the specification validation tests.

### Required Patterns (must be present after fix)

| Pattern ID | Regex | Where It Must Appear |
|-----------|-------|---------------------|
| PAT-01 | `/BACKLOG/i` in a non-Jira-nested step | Orchestrator finalize section |
| PAT-02 | `/BACKLOG/i` in finalize mode summary | Orchestrator mode behavior section |
| PAT-03 | `/artifact_folder/i` in BACKLOG step | Orchestrator BACKLOG.md update instructions |
| PAT-04 | `/external_id\|source_id/i` in BACKLOG step | Orchestrator BACKLOG.md update instructions |
| PAT-05 | `/\[x\]/i` or `/checkbox/i` in BACKLOG step | Orchestrator BACKLOG.md update instructions |
| PAT-06 | `/Completed.*date\|Completed.*YYYY/i` in BACKLOG step | Orchestrator BACKLOG.md update instructions |
| PAT-07 | `/## Completed/i` move instruction | Orchestrator BACKLOG.md update instructions |
| PAT-08 | `/non-blocking\|warning\|do NOT block/i` in BACKLOG step | Orchestrator BACKLOG.md update instructions |
| PAT-09 | `/BACKLOG.*sync/i` or bold heading | isdlc.md STEP 4 section |
| PAT-10 | `/sub-bullet\|block\|indent/i` in BACKLOG step | Orchestrator BACKLOG.md update instructions |

### Preserved Patterns (must remain after fix)

| Pattern ID | Regex | Purpose |
|-----------|-------|---------|
| PRES-01 | `/JIRA STATUS SYNC/i` | Jira sync heading not removed |
| PRES-02 | `/jira_ticket_id.*absent.*null.*SKIP/i` | Jira skip conditional preserved |
| PRES-03 | `/merge.*prune\|workflow_history\|clear.*active_workflow/i` | Finalize core steps preserved |
| PRES-04 | `/Jira sync/` in isdlc.md STEP 4 | Jira sync section preserved |
| PRES-05 | `/GitHub sync/` in isdlc.md STEP 4 | GitHub sync section preserved |
| PRES-06 | `/updateBacklogMarker/` in T8 | Trivial tier behavior preserved |

---

## Test Data Generation Strategy

All test data is **static and inline** -- no generation or external fixtures required.

- **Specification patterns**: Hard-coded regex in the test file
- **Section extraction**: `extractSection()` helper using heading patterns
- **Module exports**: Direct `require()` and `typeof` checks

No database, API, or file system fixtures are needed because:
1. Specification tests read static files and check for patterns
2. Regression tests check preserved patterns in the same static files
3. API preservation tests use `require()` on the existing utility module
