# Requirements Specification: Fan-Out/Fan-In Parallelism

**REQ ID**: REQ-0017
**Feature**: Fan-out/fan-in parallelism for execution-heavy phases
**Status**: Draft
**Created**: 2026-02-15
**Author**: Requirements Analyst (Agent 01)
**Workflow**: feature

---

## 1. Overview

Build a reusable fan-out/fan-in parallelism infrastructure that allows execution-heavy SDLC phases to split work across N parallel agents for throughput. Two initial consumers: Phase 16 (Quality Loop) for parallel test execution, and Phase 08 (Code Review) for parallel file review. The infrastructure is built once and shared by both consumers.

## 2. Background & Motivation

Current bottleneck: Phases 16 and 08 process large volumes of work sequentially or with limited parallelism. For projects with 1000+ tests or 20+ changed files, single-agent execution is a throughput bottleneck. The existing Phase 16 dual-track parallelism (Track A: testing + Track B: QA) runs two agents in parallel but does not parallelise *within* each track. This feature goes further by splitting the work within each track across multiple agents.

### Existing Capabilities (Must Not Break)
- Phase 16 dual-track parallelism (REQ-0018): Track A (testing) and Track B (QA) run in parallel
- Phase 06 Writer/Reviewer/Updater loop: Iterative code generation with self-review
- Phase 08 human-review-only scope: After REQ-0017, Phase 08 assembles a review report for human approval
- Task tool parallelism: Claude Code supports launching multiple Task calls in a single response

## 3. Functional Requirements

### FR-001: Shared Fan-Out/Fan-In Engine

The framework SHALL provide a shared fan-out/fan-in orchestration engine that can be used by any phase agent needing parallel execution.

**Acceptance Criteria:**
- AC-001-01: The engine provides a chunk splitter that divides a work list into N roughly equal parts
- AC-001-02: The engine provides a parallel Task spawner that launches N agent tasks simultaneously using the Task tool
- AC-001-03: The engine provides a result merger that combines N agent outputs into a single unified result
- AC-001-04: The engine is implemented as a reusable module (not phase-specific code) under `src/claude/` or as a shared skill
- AC-001-05: The engine handles partial failures gracefully -- if 1 of N agents fails, the remaining N-1 results are still collected and the failure is reported

### FR-002: Chunk Splitting Logic

The framework SHALL split work items into N chunks using configurable strategies.

**Acceptance Criteria:**
- AC-002-01: Given a list of W work items and a target of N agents, the splitter produces N lists of approximately W/N items each (remainder distributed round-robin)
- AC-002-02: The splitter supports at least two strategies: (a) round-robin by count, (b) group-by-directory (files in the same directory stay together)
- AC-002-03: The splitter accepts a maximum chunk count parameter (default: 8) to cap parallelism
- AC-002-04: The splitter accepts a minimum items-per-chunk parameter (default: 10 for tests, 3 for files) to prevent over-splitting
- AC-002-05: The splitter returns metadata with each chunk: chunk index, item count, and estimated relative weight (if available)

### FR-003: Parallel Task Spawner

The framework SHALL launch N parallel Task calls, one per chunk, each with a properly scoped agent prompt.

**Acceptance Criteria:**
- AC-003-01: The spawner generates N Task calls in a single response block (leveraging Claude Code's parallel tool call capability)
- AC-003-02: Each Task call includes: chunk index, chunk items, phase context, and return format specification
- AC-003-03: The spawner enforces a maximum parallelism limit (configurable, default: 8)
- AC-003-04: The spawner includes a timeout per chunk (configurable, default: 10 minutes) -- if a chunk exceeds the timeout, it is marked as timed out rather than blocking all chunks
- AC-003-05: The spawner passes the current workflow context (artifact folder, phase, constitutional requirements) to each sub-agent

### FR-004: Result Merger

The framework SHALL merge N chunk results into a single unified output.

**Acceptance Criteria:**
- AC-004-01: The merger combines N test result sets into a single report with total pass/fail/skip counts, aggregated coverage percentage, and per-chunk breakdown
- AC-004-02: The merger combines N review finding sets into a single report with deduplicated findings, priority-sorted (critical > high > medium > low)
- AC-004-03: The merger detects and removes duplicate findings (same file + same line range + same issue type = duplicate)
- AC-004-04: The merger preserves the source chunk index for each finding/result for traceability
- AC-004-05: The merger produces a summary section with: total items processed, total agents used, wall-clock time, per-agent execution time, and any failures/timeouts

### FR-005: Phase 16 Fan-Out (Quality Loop)

Phase 16 SHALL use the fan-out engine to parallelize test execution within Track A.

**Acceptance Criteria:**
- AC-005-01: Given a test suite of T tests, the Quality Loop agent splits them into N chunks using the scaling heuristic: 1 agent per ~250 tests, minimum 1, maximum 8
- AC-005-02: Each chunk agent runs its subset of tests independently and reports: pass count, fail count, skip count, coverage data (if available), execution time
- AC-005-03: The orchestrator merges chunk results into the existing Quality Loop report format (compatible with current gate validation)
- AC-005-04: If any chunk reports failures, the merged result reflects those failures (failures from any chunk bubble up to the overall result)
- AC-005-05: Coverage is aggregated across chunks (union of covered lines, not average of percentages)
- AC-005-06: The fan-out is applied to Track A (testing track) only; Track B (QA track) continues as a single agent (QA review is not parallelizable by test chunk)
- AC-005-07: For test suites below the minimum threshold (< 250 tests), fan-out is skipped and the existing single-agent path is used

### FR-006: Phase 08 Fan-Out (Code Review)

Phase 08 SHALL use the fan-out engine to parallelize code review across changed files.

**Acceptance Criteria:**
- AC-006-01: Given a changeset of F files, the Code Review agent splits them into N chunks using the group-by-directory strategy, with a heuristic of 1 agent per ~5-10 files, minimum 1, maximum 8
- AC-006-02: Each chunk agent reviews its file subset for: logic correctness, security concerns, code quality, constitutional compliance, and test coverage
- AC-006-03: Each chunk agent produces findings in a structured format: file, line range, severity (critical/high/medium/low), category, description, suggestion
- AC-006-04: The orchestrator merges findings into a single code-review-report.md compatible with the existing Phase 08 gate validation format
- AC-006-05: Duplicate findings are detected and removed (same file + overlapping line range + same issue category)
- AC-006-06: For changesets below the minimum threshold (< 5 files), fan-out is skipped and the existing single-agent review is used
- AC-006-07: Cross-file concerns (e.g., API contract changes affecting multiple files) are flagged in a separate "cross-cutting concerns" section of the merged report

### FR-007: Configuration & Overrides

The fan-out parameters SHALL be configurable via state.json or workflow options.

**Acceptance Criteria:**
- AC-007-01: The default scaling heuristics (250 tests/agent, 5-10 files/agent, max 8 agents) are configurable in `.isdlc/state.json` under a `fan_out` configuration section
- AC-007-02: Per-workflow overrides can be specified in `workflows.json` agent_modifiers for Phase 16 and Phase 08
- AC-007-03: The `--no-fan-out` flag disables fan-out for any workflow, falling back to single-agent execution
- AC-007-04: Configuration changes take effect on the next workflow start (not mid-workflow)

## 4. Non-Functional Requirements

### NFR-001: Performance

- Fan-out execution SHALL complete in less wall-clock time than sequential single-agent execution for workloads above the minimum threshold
- Orchestration overhead (splitting + merging) SHALL be < 5% of total execution time
- The fan-out engine SHALL not introduce additional file I/O beyond writing chunk assignments and reading chunk results

### NFR-002: Reliability

- Partial failures (1 of N agents fails) SHALL NOT cause the entire phase to fail -- remaining results are collected and the failure is reported as a degraded result
- If all N agents fail, the phase reports a failure with all N error messages
- No test results or review findings SHALL be lost during the merge step

### NFR-003: Backward Compatibility

- Projects with fewer than 250 tests or fewer than 5 changed files SHALL experience zero behavioral change (fan-out is transparently skipped)
- All existing gate validation criteria for Phase 16 and Phase 08 SHALL continue to pass with fan-out enabled
- The merged output format SHALL be identical to the single-agent output format (gates and downstream phases are unaware of fan-out)

### NFR-004: Observability

- Fan-out events SHALL be logged to `skill_usage_log` in state.json with: chunk count, items per chunk, execution times, and merge outcome
- The Phase 16 and Phase 08 gate validation reports SHALL include a "Parallelism Summary" section when fan-out was used

## 5. Constraints

- C-001: The fan-out engine must use Claude Code's existing Task tool for parallel execution -- no external process spawning or job queues
- C-002: Maximum 8 parallel agents (diminishing returns beyond this due to orchestration overhead)
- C-003: The chunk splitter must be deterministic -- same inputs always produce the same chunk assignments
- C-004: The result merger must handle agents returning results in any order (no assumption about completion sequence)
- C-005: Fan-out must not break the existing Phase 16 dual-track model (Track A + Track B) -- it parallelises within Track A, not between tracks

## 6. Dependencies

- DEP-001: Existing Phase 16 Quality Loop agent and dual-track model (REQ-0018)
- DEP-002: Existing Phase 08 Code Review gate validation
- DEP-003: Claude Code Task tool parallel execution capability
- DEP-004: Phase 06 Writer/Reviewer/Updater loop (fan-out does not apply here -- Phase 06 is iterative, not parallelizable)

## 7. Out of Scope

- Fan-out for Phase 06 (Implementation) -- implementation is inherently sequential (write, test, iterate)
- Cross-machine distributed execution -- all agents run within the same Claude Code session
- Dynamic re-chunking mid-execution (e.g., rebalancing if one chunk finishes early)
- Fan-out for Phase 02 (Impact Analysis) -- already has its own M1/M2/M3 parallel sub-agents

## 8. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Result merge loses data | Low | High | Structured output format with validation; test with edge cases (empty chunks, single-item chunks) |
| Orchestration overhead exceeds benefit for small workloads | Medium | Medium | Minimum thresholds prevent fan-out for small workloads; skip heuristic tested |
| Agent context window exhaustion for large chunks | Low | Medium | Chunk size upper bound ensures each agent gets manageable subset |
| Duplicate detection misses cross-file issues | Medium | Medium | Separate "cross-cutting concerns" section in merged report; post-merge validation pass |
| Existing gate validation breaks with merged format | Low | High | NFR-003 mandates format compatibility; integration tests validate gate pass |
