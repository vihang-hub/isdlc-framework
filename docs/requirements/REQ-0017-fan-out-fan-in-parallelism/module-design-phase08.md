# Module Design: Phase 08 Fan-Out Integration

**REQ ID**: REQ-0017
**Phase**: 04-design
**Created**: 2026-02-15
**Author**: System Designer (Agent 04)
**Traces**: FR-006, ADR-0001, ADR-0004

---

## 1. Module Overview

| Field | Value |
|-------|-------|
| Module | Phase 08 Fan-Out Integration |
| File | `src/claude/agents/07-qa-engineer.md` |
| Responsibility | Integrate fan-out engine protocol for parallel file review |
| Dependencies | Fan-out engine (QL-012 SKILL.md), state.json, Task tool, git |
| Consumers | Phase Loop Controller (isdlc.md), gate-blocker.cjs |

### Design Principle

Fan-out is integrated as an **alternative execution path** for the code review. The existing single-agent review remains unchanged for small changesets (< 5 files). For larger changesets, files are grouped by directory and split across N parallel reviewer agents.

Note: The agent file is `07-qa-engineer.md` but the phase key is `08-code-review` in the workflow. This is an existing naming convention (not a bug) -- the phase-agent mapping in isdlc.md routes `08-code-review` to `qa-engineer`.

---

## 2. Current Architecture (Before)

```
Phase Loop Controller
  |
  v
qa-engineer
  |
  +-> Read state.json (implementation_loop_state)
  +-> Determine scope (HUMAN REVIEW ONLY vs FULL SCOPE)
  +-> Gather changed files (git diff against base branch)
  +-> Review all files sequentially (single agent)
  +-> Produce code-review-report.md
  +-> GATE-07
```

## 3. Target Architecture (After)

```
Phase Loop Controller
  |
  v
qa-engineer
  |
  +-> Read state.json (implementation_loop_state, fan_out config, flags)
  +-> Determine scope (HUMAN REVIEW ONLY vs FULL SCOPE)
  +-> Gather changed files (git diff against base branch)
  +-> Count changed files (F)
  |
  +-> Resolve fan-out config for "08-code-review"
  |
  +-> IF F < threshold OR fan-out disabled:
  |     Review all files as single agent (EXISTING BEHAVIOR)
  |     Produce code-review-report.md (existing format)
  |
  +-> IF F >= threshold AND fan-out enabled:
  |     1. Chunk Splitter: group-by-directory into N chunks
  |     2. Parallel Spawner: N reviewer Task calls
  |     3. Wait for all N results
  |     4. Result Merger: deduplicate, priority-sort, cross-cutting concerns
  |     5. Produce code-review-report.md (extended format)
  |
  +-> Add Parallelism Summary (if fan-out was used)
  +-> GATE-07
```

---

## 4. Modification Points in 07-qa-engineer.md

### 4.1 New Section: Fan-Out Protocol (insert after "FULL SCOPE Mode" section)

```markdown
## Fan-Out Protocol (Code Review)

When the changeset is large enough, this agent uses the fan-out engine (QL-012)
to split file review across multiple parallel reviewer agents.

### Activation

1. Read fan_out config from state.json
2. IF fan-out is disabled (flag, global, or per-phase): review all files as single agent
3. Gather changed files: run `git diff --name-only main...HEAD` (or base branch)
4. Filter to relevant file types (exclude binary, lockfiles, generated files):
   - INCLUDE: .js, .cjs, .mjs, .ts, .tsx, .jsx, .md, .json, .yaml, .yml, .sh, .ps1
   - EXCLUDE: package-lock.json, yarn.lock, *.min.js, coverage/*, node_modules/*
5. Count remaining files: F
6. IF F < min_files_threshold (default 5): review all files as single agent
7. COMPUTE N = min(ceil(F / files_per_agent), max_agents)
8. IF N <= 1: review all files as single agent
9. OTHERWISE: use fan-out path with N chunks

### Configuration Resolution

Read from state.json with this precedence (highest to lowest):
1. active_workflow.flags.no_fan_out (CLI flag)
2. fan_out.phase_overrides["08-code-review"].enabled (per-phase)
3. fan_out.enabled (global)
4. Default: true

Phase-specific defaults:
- files_per_agent: 7
- min_files_threshold: 5
- max_agents: 8
- strategy: group-by-directory
- timeout_per_chunk_ms: 600000

### Chunk Splitting

Use the group-by-directory strategy from the fan-out engine:
1. Group changed files by parent directory
2. Sort directory groups by name (determinism)
3. Use first-fit-decreasing to assign groups to N chunks
4. Files in the same directory stay together for contextual review

### Reviewer Chunk Agent Prompt

Each chunk reviewer agent receives this prompt:

---BEGIN CHUNK REVIEWER PROMPT---
You are a fan-out chunk code reviewer for Phase 08 Code Review.

## Context
- Phase: 08-code-review
- Chunk: {chunk_index} of {chunk_count}
- Strategy: group-by-directory
- Files in this chunk: {item_count}
- Total files across all chunks: {total_items}
- Scope mode: {HUMAN_REVIEW_ONLY or FULL_SCOPE}

## Files to Review
{numbered list of file paths with directory grouping}

## Review Instructions

### If FULL SCOPE mode:
Review each file for:
1. Logic correctness
2. Error handling
3. Security considerations (injection, XSS, path traversal, etc.)
4. Performance implications
5. Test coverage adequacy
6. Code documentation
7. Naming clarity and DRY principle
8. Constitutional compliance (relevant articles)

### If HUMAN REVIEW ONLY mode:
Focus on cross-cutting concerns visible within this chunk:
1. Architecture decisions alignment
2. Business logic coherence across files in this chunk
3. Design pattern compliance
4. Non-obvious security concerns from file interactions
5. Integration coherence between files

### For ALL findings, report in this format:
{
  "file": "path/to/file.js",
  "line_start": 42,
  "line_end": 55,
  "severity": "critical | high | medium | low",
  "category": "security | quality | logic | performance | constitutional | documentation",
  "description": "Clear description of the issue",
  "suggestion": "Recommended fix or improvement"
}

### Cross-Cutting Concerns
If you notice issues that span multiple files in your chunk (e.g., API contract
changes, shared utility misuse, inconsistent error handling), report them separately
as cross-cutting concerns:
{
  "id": "CC-NNN",
  "description": "Description of the cross-file concern",
  "affected_files": ["file1.js", "file2.js"],
  "impact": "Impact description"
}

## CRITICAL CONSTRAINTS
1. Do NOT write to .isdlc/state.json
2. Do NOT run git add, git commit, git push, or any git write operations
3. Do NOT modify source files
4. Do NOT spawn sub-agents
5. Include chunk_index: {chunk_index} in your response

## Return Format
Structure your response with:
- chunk_index: {chunk_index}
- status: "completed" or "failed"
- findings: [{finding objects}]
- cross_cutting_concerns: [{concern objects}]
- summary: { files_reviewed, findings_count, critical, high, medium, low }
- elapsed_ms: (approximate)
---END CHUNK REVIEWER PROMPT---

### Result Merging

After all N reviewer agents return:
1. Parse each chunk result
2. If a chunk failed to return structured results, mark it as status: "failed"
3. Use the review finding merge algorithm (Section 5.3 of interface-spec.md):
   a. Collect all findings from successful chunks
   b. Deduplicate: same file + same category + overlapping line ranges = duplicate
      - Keep finding with longer description
      - Tie-break: lower chunk_index
   c. Sort by severity: critical > high > medium > low
      - Within same severity: sort by file path, then line_start
   d. Collect all cross-cutting concerns, merge by affected_files overlap
   e. Aggregate summary counts
4. Generate code-review-report.md in the format specified below

### Cross-Cutting Concern Detection

Cross-cutting concerns can originate from two sources:
1. **Within a chunk**: A chunk reviewer identifies concerns spanning files in its chunk
2. **Across chunks**: The merger detects patterns across chunk boundaries

For across-chunk detection, after merging:
- IF the same file appears in findings from 2+ chunks: flag as potential cross-cutting
- IF findings in different chunks reference the same exported function/class: flag as
  potential cross-cutting
- These detected concerns are marked as "merger-detected" vs "reviewer-reported"

### Partial Failure Handling

If K of N reviewers fail:
- Merge findings from the N-K successful reviewers
- Mark result as degraded: true
- Log which file chunks were NOT reviewed (from failed chunks)
- Include a "Review Coverage Gaps" section in the report listing unreviewed files
```

### 4.2 Modification to Output Artifacts

The code-review-report.md gains an optional "Cross-Cutting Concerns" and "Parallelism Summary" section when fan-out was used:

```markdown
# Code Review Report

## Summary
- Files reviewed: 22 (of 22 changed)
- Review mode: HUMAN REVIEW ONLY
- Total findings: 15 (after deduplication: 2 duplicates removed)
- Critical: 1 | High: 3 | Medium: 8 | Low: 3

## Findings

### Critical
#### [C-001] SQL injection in user authentication
- **File**: src/auth/login.js:42-55
- **Category**: security
- **Description**: User input not sanitized before database query
- **Suggestion**: Use parameterized queries instead of string concatenation
- **Source**: Chunk 0

### High
[... findings sorted by severity ...]

### Medium
[...]

### Low
[...]

## Cross-Cutting Concerns

### [CC-001] API contract change in UserService (reviewer-reported)
- **Affected files**: src/api/users.js, src/services/user-service.js, test/api/users.test.js
- **Description**: Return type changed from object to array; all consumers must be updated
- **Impact**: Breaking change for 3 downstream consumers

### [CC-002] Inconsistent error handling pattern (merger-detected)
- **Affected files**: src/hooks/gate-blocker.cjs, src/hooks/iteration-corridor.cjs
- **Description**: Findings in chunks 0 and 2 both flag error handling inconsistencies
- **Impact**: Error handling should use uniform try/catch pattern

## Review Coverage Gaps
(Only present if chunks failed)
- NONE (all 4 chunks completed successfully)

## Parallelism Summary
- Agents used: 4
- Strategy: group-by-directory
- Chunks: [6 files, 5 files, 7 files, 4 files]
- Wall-clock time: 38000ms
- Per-chunk timing: [chunk 0: 35000ms, chunk 1: 32000ms, chunk 2: 38000ms, chunk 3: 28000ms]
- Duplicates removed: 2
- Cross-cutting concerns: 2 (1 reviewer-reported, 1 merger-detected)
- Degraded: false
```

### 4.3 No Changes to GATE-07 Validation

Gate-blocker reads code-review-report.md (or validates via artifact_validation paths). The report format is extended but not changed -- existing sections remain identical. New sections (Cross-Cutting Concerns, Parallelism Summary) are additive.

### 4.4 Interaction with Scope Modes

| Scope Mode | Fan-Out Behavior |
|------------|-----------------|
| HUMAN REVIEW ONLY | Fan-out allowed. Chunk reviewers focus on cross-cutting concerns per their scope instructions. |
| FULL SCOPE | Fan-out allowed. Chunk reviewers perform full review per their scope instructions. |
| MAX_ITERATIONS files | Files with MAX_ITERATIONS verdict receive full attention regardless of scope mode. These files are distributed across chunks normally. The chunk prompt notes which files have unresolved findings. |

---

## 5. Sequence Diagram: Fan-Out Active

```
qa-engineer                     Chunk Reviewers (N=4)
    |                                  |
    |-- Read state.json (config) ------|
    |-- Determine scope mode ----------|
    |-- git diff: 22 changed files ----|
    |-- F=22 >= 5: fan out ------------|
    |                                  |
    |-- Group by directory ------------|
    |-- First-fit-decreasing: 4 chunks |
    |                                  |
    |-- Task: chunk 0 (6 files) ------>| src/api/ (6 files)
    |-- Task: chunk 1 (5 files) ------>| src/hooks/ (5 files)
    |-- Task: chunk 2 (7 files) ------>| src/auth/ (4) + test/ (3)
    |-- Task: chunk 3 (4 files) ------>| lib/ (4 files)
    |                                  |
    |<-- findings chunk 0 -------------|
    |<-- findings chunk 2 -------------|  (any order)
    |<-- findings chunk 1 -------------|
    |<-- findings chunk 3 -------------|
    |                                  |
    |-- Deduplicate findings ----------|
    |-- Priority sort ------------------|
    |-- Detect cross-cutting concerns --|
    |-- Generate code-review-report.md -|
    |-- Parallelism Summary ------------|
    |-- GATE-07 -----------------------|
```

---

## 6. Sequence Diagram: Fan-Out Inactive

```
qa-engineer
    |
    |-- Read state.json (config)
    |-- Determine scope mode
    |-- git diff: 3 changed files
    |-- F=3 < 5: skip fan-out
    |-- Review all 3 files (existing single-agent behavior)
    |-- Generate code-review-report.md (existing format, no Parallelism Summary)
    |-- GATE-07
```

---

## 7. File Type Filtering

The file filter ensures only reviewable files enter the fan-out pipeline:

| Category | Pattern | Action |
|----------|---------|--------|
| Source code | `*.js`, `*.cjs`, `*.mjs`, `*.ts`, `*.tsx`, `*.jsx` | INCLUDE |
| Agent/skill markdown | `*.md` | INCLUDE |
| Configuration | `*.json`, `*.yaml`, `*.yml` | INCLUDE |
| Shell scripts | `*.sh`, `*.ps1` | INCLUDE |
| Lock files | `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml` | EXCLUDE |
| Minified files | `*.min.js`, `*.min.css` | EXCLUDE |
| Generated files | `coverage/*`, `node_modules/*`, `.isdlc/*.json` | EXCLUDE |
| Binary files | `*.png`, `*.jpg`, `*.gif`, `*.woff`, `*.woff2` | EXCLUDE |

The filter is applied BEFORE counting and splitting.

---

## 8. Error Handling in Phase 08

| Error | Handling | Reference |
|-------|----------|-----------|
| git diff fails | Fall back to `git status` for changed files; if both fail, skip fan-out and review manually | ERR-SP-003 |
| Config read failure | Use defaults (Article X) | ERR-CFG-001 |
| All files in one directory | N = 1 (single chunk = single agent), effectively no fan-out | ERR-CS-002 |
| Chunk reviewer timeout | Mark chunk as timed_out, merge N-1 results, list unreviewed files | ERR-SP-002 |
| Chunk reviewer invalid response | Parse best-effort; if unparseable, mark as failed | ERR-MG-001 |
| Deduplication ambiguity | If two findings have same file+category+lines but different descriptions, keep both (do not deduplicate) | ERR-MG-004 |
| All reviewers failed | Report failure, list all files as unreviewed | ERR-MG-003 |

---

## 9. Nesting Depth Analysis

| Path | Depth | Description |
|------|-------|-------------|
| Phase Loop -> qa-engineer | 1 | Orchestrator delegates to phase agent |
| qa-engineer -> Chunk Reviewers | 2 | Phase agent fans out to N reviewer chunks |

Maximum depth: 2 levels. Simpler than Phase 16 (which has the dual-track layer).

---

## 10. Traceability

| Design Element | Requirement | Acceptance Criteria |
|----------------|-------------|---------------------|
| Fan-out decision tree | FR-006 | AC-006-06 (skip for < 5 files) |
| Group-by-directory splitting | FR-002, FR-006 | AC-006-01, AC-002-02 |
| N parallel Task calls | FR-003, FR-006 | AC-006-01, AC-003-01 |
| Reviewer chunk prompt | FR-003, FR-006 | AC-003-02, AC-006-02 |
| Read-only chunk constraints | C-001, C-002 | AC-003-03 |
| Finding deduplication | FR-004, FR-006 | AC-006-05, AC-004-03 |
| Priority sort | FR-004 | AC-004-02 |
| Cross-cutting concerns | FR-006 | AC-006-07 |
| Backward-compatible output | ADR-0004 | NFR-003 |
| Partial failure handling | FR-001 | AC-001-05 |
| Configuration read | FR-007 | AC-007-01, AC-007-03 |
| Parallelism Summary | NFR-004 | AC-NFR-004-02 |
| File type filtering | FR-006 | AC-006-01 (sensible file selection) |
