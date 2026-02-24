# Module Design: Phase 16 Fan-Out Integration

**REQ ID**: REQ-0017
**Phase**: 04-design
**Created**: 2026-02-15
**Author**: System Designer (Agent 04)
**Traces**: FR-005, ADR-0001, ADR-0003, ADR-0004

---

## 1. Module Overview

| Field | Value |
|-------|-------|
| Module | Phase 16 Fan-Out Integration |
| File | `src/claude/agents/16-quality-loop-engineer.md` |
| Responsibility | Integrate fan-out engine protocol into Track A test execution |
| Dependencies | Fan-out engine (QL-012 SKILL.md), state.json, Task tool |
| Consumers | Phase Loop Controller (isdlc.md), gate-blocker.cjs |

### Design Principle

Fan-out is integrated as an **alternative execution path** within Track A. The existing single-agent path remains unchanged for below-threshold workloads (NFR-003). The Phase 16 agent uses the fan-out decision tree to determine which path to take.

Per ADR-0003, when fan-out is active, it **replaces** the existing A1/A2/A3 grouping strategy. Each chunk agent runs the full Track A pipeline (build + lint + type-check + tests + coverage) for its subset.

---

## 2. Current Architecture (Before)

```
Phase Loop Controller
  |
  v
quality-loop-engineer
  |
  +-> [Track A Task] -----> Single sub-agent runs:
  |                           A1: build + lint + type-check
  |                           A2: test + coverage
  |                           A3: mutation (if configured)
  |                           Returns single Track A result
  |
  +-> [Track B Task] -----> QA sub-agent (unchanged)
  |
  +-> Consolidate Track A + Track B
  +-> Iteration loop if failures
  +-> GATE-16
```

## 3. Target Architecture (After)

```
Phase Loop Controller
  |
  v
quality-loop-engineer
  |
  +-> Read state.json (fan_out config, flags)
  |
  +-> [Track A Task] -----> Track A sub-agent:
  |                           |
  |                           +-> Count test files (T)
  |                           |
  |                           +-> Resolve fan-out config
  |                           |
  |                           +-> IF T < threshold OR fan-out disabled:
  |                           |     Run as single agent (EXISTING BEHAVIOR)
  |                           |     Use A1/A2/A3 grouping (unchanged)
  |                           |
  |                           +-> IF T >= threshold AND fan-out enabled:
  |                           |     1. Chunk Splitter: round-robin into N chunks
  |                           |     2. Parallel Spawner: N Task calls
  |                           |     3. Wait for all N results
  |                           |     4. Result Merger: aggregate into unified result
  |                           |     5. Return merged result (same schema)
  |                           |
  |                           +-> Return Track A result
  |
  +-> [Track B Task] -----> QA sub-agent (NO CHANGES)
  |
  +-> Consolidate Track A + Track B (unchanged -- merged format is identical)
  +-> Add Parallelism Summary (if fan-out was used)
  +-> Iteration loop if failures (unchanged)
  +-> GATE-16 (unchanged)
```

---

## 4. Modification Points in 16-quality-loop-engineer.md

### 4.1 New Section: Fan-Out Protocol (insert after "Parallel Execution Protocol")

A new top-level section to be added to the agent markdown:

```markdown
## Fan-Out Protocol (Track A)

When the test suite is large enough, Track A uses the fan-out engine (QL-012) to
split tests across multiple parallel chunk agents for faster execution.

### Activation

The Track A sub-agent decides whether to fan out:

1. Read fan_out config from state.json (see Configuration Resolution below)
2. IF fan-out is disabled (any reason): use single-agent path (existing behavior)
3. Count test files: T = number of test files discovered by framework detection
4. IF T < min_tests_threshold (default 250): use single-agent path
5. COMPUTE N = min(ceil(T / tests_per_agent), max_agents)
6. IF N <= 1: use single-agent path
7. OTHERWISE: use fan-out path with N chunks

### Configuration Resolution

Read from state.json with this precedence (highest to lowest):
1. active_workflow.flags.no_fan_out (CLI flag -- overrides all)
2. fan_out.phase_overrides["16-quality-loop"].enabled (per-phase)
3. fan_out.enabled (global)
4. Default: true

Phase-specific defaults:
- tests_per_agent: 250
- min_tests_threshold: 250
- max_agents: 8
- strategy: round-robin
- timeout_per_chunk_ms: 600000

### Chunk Splitting

Use the round-robin strategy from the fan-out engine:
1. Discover all test files using framework detection
2. Sort test file paths alphabetically
3. Split into N chunks using round-robin distribution
4. Each chunk receives approximately T/N test files

### Chunk Agent Prompt

Each chunk agent receives this prompt:

---BEGIN CHUNK AGENT PROMPT---
You are a fan-out chunk test runner for Phase 16 Quality Loop, Track A.

## Context
- Phase: 16-quality-loop, Track A
- Chunk: {chunk_index} of {chunk_count}
- Strategy: round-robin
- Test files in this chunk: {item_count}
- Total test files across all chunks: {total_items}

## Test Files
{numbered list of test file paths}

## Instructions
Run the FULL Track A pipeline for ONLY the test files listed above:
1. Build verification (clean build)
2. Lint check (run linter on project)
3. Type check (if applicable)
4. Execute ONLY the listed test files
5. Measure coverage for the executed tests

Report results in the specified format below.

## CRITICAL CONSTRAINTS
1. Do NOT write to .isdlc/state.json
2. Do NOT run git add, git commit, git push, or any git write operations
3. Do NOT modify source files
4. Do NOT spawn sub-agents
5. Run ONLY the test files listed above -- do not run the full test suite
6. Include chunk_index: {chunk_index} in your response

## Return Format
Structure your response as a report with these fields:
- chunk_index: {chunk_index}
- status: "completed" or "failed"
- checks: { build: PASS/FAIL, lint: PASS/FAIL, type_check: PASS/FAIL/SKIP,
             tests: PASS/FAIL, coverage: PASS/FAIL/SKIP }
- test_results: { pass_count, fail_count, skip_count, total, failures: [...],
                  coverage: { lines_covered, lines_total, covered_files: {...} } }
- elapsed_ms: (approximate execution time)
---END CHUNK AGENT PROMPT---

### Result Merging

After all N chunk agents return:
1. Parse each chunk result
2. If a chunk failed to return structured results, mark it as status: "failed"
3. Use the test result merge algorithm (Section 5.2 of interface-spec.md):
   - Aggregate pass/fail/skip counts
   - Union coverage at line level
   - Collect all failures with source_chunk annotation
   - Merge check results (any FAIL = overall FAIL)
4. Return merged result in the same schema as single-agent Track A result

### Partial Failure Handling

If K of N chunks fail (status != "completed"):
- Merge results from the N-K successful chunks
- Mark merged result as degraded: true
- Include failed chunk details in fan_out_summary.failures
- The overall Track A result reflects partial data
- The iteration loop will retry the full phase (all N chunks) on failure

### Interaction with Existing Dual-Track Model

Fan-out operates WITHIN Track A only. The dual-track model is unchanged:
- Track A (fan-out enabled): Split tests -> N parallel chunks -> merge
- Track B (no fan-out): Single QA sub-agent (unchanged)
- Consolidation: Merge Track A + Track B results (unchanged)

The quality-loop-engineer spawns Track A + Track B as 2 parallel Tasks (existing).
Track A internally spawns N chunk Tasks (new). These are nested, not at the same level.
```

### 4.2 Modification to Existing "Grouping Strategy" Section

The existing Grouping Strategy section needs a conditional header:

```markdown
### Grouping Strategy for Internal Parallelism

**NOTE**: When fan-out is active (test count >= threshold), the A1/A2/A3 grouping
below is NOT used. Fan-out replaces it with N chunk agents, each running the full
Track A pipeline. The grouping below applies ONLY when fan-out is inactive
(test count below threshold or fan-out disabled).

[... existing A1/A2/A3/B1/B2 table unchanged ...]
```

### 4.3 Modification to "Parallel Execution State Tracking" Section

Extend the existing `test_results.parallel_execution` schema:

```json
{
  "test_results": {
    "parallel_execution": {
      "enabled": true,
      "framework": "node:test",
      "flag": "--test-concurrency=7",
      "workers": 7,
      "fallback_triggered": false,
      "flaky_tests": [],
      "track_timing": {
        "track_a": { "elapsed_ms": 45000, "groups": ["chunk-0", "chunk-1", "chunk-2", "chunk-3", "chunk-4"] },
        "track_b": { "elapsed_ms": 32000, "groups": ["B1", "B2"] }
      },
      "group_composition": {
        "chunk-0": ["QL-002", "QL-004", "QL-005", "QL-006", "QL-007"],
        "chunk-1": ["QL-002", "QL-004", "QL-005", "QL-006", "QL-007"],
        "B1": ["QL-008", "QL-009"],
        "B2": ["QL-010"]
      },
      "fan_out": {
        "used": true,
        "total_items": 1050,
        "chunk_count": 5,
        "strategy": "round-robin",
        "chunks": [
          { "index": 0, "item_count": 210, "elapsed_ms": 42000, "status": "completed" }
        ],
        "merge_elapsed_ms": 500,
        "total_elapsed_ms": 42500,
        "degraded": false,
        "failures": []
      }
    }
  }
}
```

### 4.4 Modification to "Consolidated Result Merging" Section

Add a note about fan-out result merging:

```markdown
When fan-out was used in Track A, the Track A result is already a merged result
from N chunk agents. The consolidation step treats it identically to a single-agent
Track A result because the schema is the same (ADR-0004).

The quality-report.md MUST include a Parallelism Summary section when fan-out was used:
- Number of chunk agents
- Strategy used
- Items per chunk
- Per-chunk timing
- Duplicates removed (0 for tests -- chunks are disjoint)
- Degraded status
```

### 4.5 Modification to Agent Frontmatter

Add QL-012 to owned_skills:

```yaml
owned_skills:
  - QL-001  # parallel-track-orchestration
  - QL-002  # local-test-execution
  - QL-003  # mutation-testing
  - QL-004  # coverage-analysis
  - QL-005  # lint-check
  - QL-006  # type-check
  - QL-007  # build-verification
  - QL-008  # security-scan-sast
  - QL-009  # dependency-audit
  - QL-010  # automated-code-review
  - QL-011  # quality-report-generation
  - QL-012  # fan-out-orchestration
```

---

## 5. Sequence Diagram: Fan-Out Active

```
quality-loop-engineer           Track A Sub-Agent           Chunk Agents (N=4)
        |                              |                          |
        |-- Task: Track A ------------>|                          |
        |-- Task: Track B ------------>| (parallel)               |
        |                              |                          |
        |                              |-- Count tests (T=1000) --|
        |                              |-- Resolve config --------|
        |                              |-- T >= 250: fan out -----|
        |                              |                          |
        |                              |-- Chunk split (round-robin, N=4)
        |                              |                          |
        |                              |-- Task: chunk 0 -------->| (250 tests)
        |                              |-- Task: chunk 1 -------->| (250 tests)
        |                              |-- Task: chunk 2 -------->| (250 tests)
        |                              |-- Task: chunk 3 -------->| (250 tests)
        |                              |                          |
        |                              |<-- result chunk 0 -------|
        |                              |<-- result chunk 2 -------| (any order)
        |                              |<-- result chunk 1 -------|
        |                              |<-- result chunk 3 -------|
        |                              |                          |
        |                              |-- Merge results ---------|
        |                              |-- Return merged Track A --|
        |                              |                          |
        |<-- Track A result -----------|                          |
        |<-- Track B result ---------- (from parallel Track B)    |
        |                              |                          |
        |-- Consolidate A + B ---------|                          |
        |-- Parallelism Summary -------|                          |
        |-- GATE-16 -------------------|                          |
```

---

## 6. Sequence Diagram: Fan-Out Inactive (Below Threshold)

```
quality-loop-engineer           Track A Sub-Agent
        |                              |
        |-- Task: Track A ------------>|
        |-- Task: Track B ------------>| (parallel)
        |                              |
        |                              |-- Count tests (T=100)
        |                              |-- T < 250: skip fan-out
        |                              |-- Run single-agent A1/A2/A3 (existing behavior)
        |                              |-- Return Track A result
        |                              |
        |<-- Track A result -----------|
        |<-- Track B result -----------|
        |                              |
        |-- Consolidate A + B ---------|
        |-- GATE-16 -------------------|
```

---

## 7. Nesting Depth Analysis

| Path | Depth | Description |
|------|-------|-------------|
| Phase Loop -> quality-loop-engineer | 1 | Orchestrator delegates to phase agent |
| quality-loop-engineer -> Track A/B | 2 | Phase agent spawns dual-track |
| Track A -> Chunk Agents | 3 | Track A sub-agent fans out to N chunks |

Maximum depth: 3 levels. This is the practical limit for agent nesting in Claude Code (context window constraints and latency).

Track B does NOT fan out, so its path remains at depth 2.

---

## 8. Error Handling in Phase 16

| Error | Handling | Reference |
|-------|----------|-----------|
| Config read failure | Use defaults (Article X) | ERR-CFG-001 |
| Chunk splitter empty items | Log warning, use single-agent path | ERR-CS-001 |
| Chunk agent timeout | Mark chunk as timed_out, merge N-1 results | ERR-SP-002 |
| Chunk agent invalid response | Mark chunk as failed, merge N-1 results | ERR-MG-001 |
| All chunks failed | Report overall failure, iteration loop retries | ERR-MG-003 |
| Coverage union mismatch | Log warning, use best-effort aggregation | ERR-MG-002 |
| Data integrity warning | Log warning, continue with merged data | ERR-MG-002 |

---

## 9. Mutation Testing with Fan-Out

Mutation testing (QL-003, group A3) runs as a separate step AFTER fan-out merging. It does NOT run within chunk agents because:
1. Mutation testing modifies source code temporarily -- running it in parallel chunks would cause conflicts
2. Mutation testing operates on the full codebase, not subsets
3. It is already optional ("only if mutation framework configured")

Sequence when both fan-out and mutation testing are active:
```
Track A sub-agent:
  1. Fan-out: split tests into N chunks, run in parallel, merge results
  2. IF mutation testing configured:
       Run mutation testing as single agent (A3 behavior, unchanged)
       Append mutation results to Track A result
  3. Return combined Track A result
```

---

## 10. Traceability

| Design Element | Requirement | Acceptance Criteria |
|----------------|-------------|---------------------|
| Fan-out decision tree | FR-005 | AC-005-07 (skip for < 250 tests) |
| Round-robin chunk splitting | FR-002, FR-005 | AC-005-01, AC-002-01 |
| N parallel Task calls | FR-003, FR-005 | AC-005-01, AC-003-01 |
| Chunk agent prompt template | FR-003 | AC-003-02, AC-003-05 |
| Read-only chunk constraints | C-001, C-002 | AC-003-03 |
| Test result merging | FR-004, FR-005 | AC-005-03, AC-004-01 |
| Coverage union aggregation | FR-005 | AC-005-05 |
| Failure bubbling | FR-005 | AC-005-04 |
| Track B unchanged | FR-005 | AC-005-06 |
| Partial failure handling | FR-001 | AC-001-05 |
| A1/A2/A3 replacement | ADR-0003 | AC-005-06 |
| Backward-compatible output | ADR-0004 | NFR-003 |
| Configuration read | FR-007 | AC-007-01, AC-007-03 |
| Parallelism Summary | NFR-004 | AC-NFR-004-02 |
