# Interface Specification: Fan-Out/Fan-In Engine (QL-012)

**REQ ID**: REQ-0017
**Phase**: 04-design
**Created**: 2026-02-15
**Author**: System Designer (Agent 04)
**Status**: Approved
**Traces**: FR-001, FR-002, FR-003, FR-004, ADR-0001, ADR-0003

---

## 1. Overview

This document specifies the complete interface for the fan-out/fan-in engine, registered as skill QL-012 (`fan-out-orchestration`). The engine is a **markdown protocol** -- not executable code -- consisting of three components: Chunk Splitter, Parallel Spawner, and Result Merger. Each component has defined JSON input/output contracts that phase agents follow.

The engine is consumed by two phase agents:
- **Phase 16 (Quality Loop)**: Fan-out within Track A for test execution
- **Phase 07 agent / Phase 08 workflow (Code Review)**: Fan-out for file review

### Interface Type

Protocol specification in markdown (SKILL.md). Not an API, not a CLI, not a library. Agents read the protocol and follow the contracts.

---

## 2. Skill Registration

```yaml
id: QL-012
name: fan-out-orchestration
category: quality-loop
path: quality-loop/fan-out-engine
owner: quality-loop-engineer
description: >
  Reusable fan-out/fan-in protocol for splitting work across N parallel
  Task agents. Provides chunk splitter (round-robin + group-by-directory),
  parallel Task spawner, and result merger with deduplication.
```

### Skills Manifest Entry

```json
{
  "quality-loop-engineer": {
    "agent_id": "16",
    "phase": "16-quality-loop",
    "skill_count": 12,
    "skills": [
      "QL-001", "QL-002", "QL-003", "QL-004", "QL-005", "QL-006",
      "QL-007", "QL-008", "QL-009", "QL-010", "QL-011", "QL-012"
    ]
  }
}
```

Additions to `skill_lookup`:
```json
{
  "QL-012": "quality-loop-engineer"
}
```

Additions to `path_lookup`:
```json
{
  "quality-loop/fan-out-engine": "quality-loop-engineer"
}
```

---

## 3. Component 1: Chunk Splitter

### 3.1 Purpose

Splits a list of W work items into N roughly-equal chunks for parallel processing.

### 3.2 Input Contract

```json
{
  "items": ["string"],
  "strategy": "round-robin | group-by-directory",
  "max_chunks": 8,
  "min_items_per_chunk": 10,
  "items_per_agent": 250
}
```

| Field | Type | Required | Default | Validation | Description |
|-------|------|----------|---------|------------|-------------|
| `items` | string[] | Yes | -- | len >= 1 | Work item identifiers (file paths) |
| `strategy` | enum | Yes | -- | Must be `"round-robin"` or `"group-by-directory"` | Splitting strategy |
| `max_chunks` | integer | No | 8 | 1 <= value <= 8 | Maximum number of chunks |
| `min_items_per_chunk` | integer | No | 10 (tests), 3 (files) | value >= 1 | Minimum items per chunk to prevent over-splitting |
| `items_per_agent` | integer | No | 250 (tests), 7 (files) | value >= 1 | Target items per agent for computing N |

### 3.3 Output Contract

```json
{
  "chunks": [
    {
      "index": 0,
      "items": ["test/a.test.js", "test/d.test.js"],
      "item_count": 2,
      "weight": 1.0
    }
  ],
  "metadata": {
    "total_items": 6,
    "chunk_count": 2,
    "strategy": "round-robin",
    "items_per_chunk_target": 3
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `chunks` | array | Array of chunk objects |
| `chunks[].index` | integer | Zero-based chunk index (0 to N-1) |
| `chunks[].items` | string[] | Work items assigned to this chunk |
| `chunks[].item_count` | integer | Number of items in chunk (== items.length) |
| `chunks[].weight` | float | Relative weight: chunk.item_count / (total_items / chunk_count). ~1.0 for balanced chunks |
| `metadata.total_items` | integer | Total items across all chunks (must equal input items.length) |
| `metadata.chunk_count` | integer | Number of chunks produced (N) |
| `metadata.strategy` | string | Strategy used (echoed from input) |
| `metadata.items_per_chunk_target` | integer | Effective target items per chunk |

### 3.4 Algorithm: Round-Robin

Used by Phase 16 for test file splitting.

```
FUNCTION split_round_robin(items, items_per_agent, max_chunks, min_items_per_chunk):
  1. Sort items alphabetically (determinism guarantee: C-003)
  2. N = min(ceil(len(items) / items_per_agent), max_chunks)
  3. N = max(1, N)
  4. IF len(items) / N < min_items_per_chunk:
       N = max(1, floor(len(items) / min_items_per_chunk))
  5. Initialize N empty chunk arrays
  6. FOR i = 0 TO len(items) - 1:
       chunk_index = i % N
       chunks[chunk_index].append(items[i])
  7. FOR each chunk:
       weight = chunk.item_count / (total_items / N)
  8. RETURN { chunks, metadata }
```

**Determinism**: Given identical input items (same set, any order), the output is always identical because items are sorted before distribution.

**Example**:
- Input: 1050 test files, items_per_agent=250, max_chunks=8, min_items_per_chunk=10
- N = min(ceil(1050/250), 8) = min(5, 8) = 5
- Each chunk gets ~210 items (round-robin distribution)
- Chunks: [210, 210, 210, 210, 210]

### 3.5 Algorithm: Group-by-Directory

Used by Phase 08 for file review splitting.

```
FUNCTION split_group_by_directory(items, files_per_agent, max_chunks, min_items_per_chunk):
  1. Group items by parent directory:
       dir_groups = {}
       FOR each item in items:
         dir = parent_directory(item)
         dir_groups[dir].append(item)
  2. Sort dir_groups by directory name alphabetically (determinism: C-003)
  3. N = min(ceil(len(items) / files_per_agent), max_chunks)
  4. N = max(1, N)
  5. IF len(items) / N < min_items_per_chunk:
       N = max(1, floor(len(items) / min_items_per_chunk))
  6. Sort dir_groups by size descending (first-fit-decreasing)
  7. Initialize N empty chunks
  8. FOR each dir_group (largest first):
       target_chunk = chunk with fewest items (ties: lowest index)
       target_chunk.items.extend(dir_group.items)
  9. FOR each chunk:
       weight = chunk.item_count / (total_items / N)
  10. RETURN { chunks, metadata }
```

**Determinism**: Sorting by directory name and using first-fit-decreasing with tie-breaking by lowest index ensures identical outputs for identical inputs.

**Example**:
- Input: 22 files across 5 directories: src/auth/ (4), src/api/ (6), src/hooks/ (5), lib/ (4), test/ (3)
- N = min(ceil(22/7), 8) = min(4, 8) = 4
- First-fit-decreasing assignment:
  - src/api/ (6) -> chunk 0
  - src/hooks/ (5) -> chunk 1
  - src/auth/ (4) -> chunk 2
  - lib/ (4) -> chunk 3
  - test/ (3) -> chunk 2 (fewest items: chunk 2 had 4, chunk 3 had 4, tie = lower index)
- Result: [6, 5, 7, 4]

### 3.6 Edge Cases

| Scenario | Behavior |
|----------|----------|
| items.length == 0 | Return error (ERR-CS-001: empty items list) |
| items.length < min_items_per_chunk | N = 1 (single chunk, no splitting) |
| items.length == 1 | N = 1 |
| All files in one directory (group-by-directory) | N = 1 (cannot split a single group) |
| items_per_agent > items.length | N = 1 |
| Duplicate items in input | Deduplicate before splitting, log warning |

---

## 4. Component 2: Parallel Spawner

### 4.1 Purpose

Generates N Task tool calls in a single response, one per chunk, each with a properly scoped agent prompt.

### 4.2 Input Contract

The spawner takes the chunk splitter output plus a prompt template.

```json
{
  "chunks": [
    { "index": 0, "items": ["..."], "item_count": 210, "weight": 1.0 }
  ],
  "metadata": {
    "total_items": 1050,
    "chunk_count": 5,
    "strategy": "round-robin"
  },
  "prompt_template": {
    "role_description": "You are a chunk test runner...",
    "phase_context": "Phase 16 Quality Loop, Track A",
    "work_instruction": "Run these tests and report results",
    "return_format": "{ chunk_index, status, test_results, elapsed_ms, checks }",
    "constraints": [
      "Do NOT write to state.json",
      "Do NOT run git operations",
      "Do NOT modify source files"
    ]
  },
  "workflow_context": {
    "artifact_folder": "REQ-0017-fan-out-fan-in-parallelism",
    "current_phase": "16-quality-loop",
    "constitutional_requirements": ["II", "XI"]
  },
  "timeout_per_chunk_ms": 600000
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `chunks` | array | Yes | From chunk splitter output |
| `metadata` | object | Yes | From chunk splitter output |
| `prompt_template` | object | Yes | Template for chunk agent prompts |
| `prompt_template.role_description` | string | Yes | Agent role (varies by consumer) |
| `prompt_template.phase_context` | string | Yes | Current phase and track context |
| `prompt_template.work_instruction` | string | Yes | What the chunk agent should do |
| `prompt_template.return_format` | string | Yes | JSON schema the chunk agent must return |
| `prompt_template.constraints` | string[] | Yes | Read-only and safety constraints |
| `workflow_context` | object | Yes | Current workflow metadata |
| `timeout_per_chunk_ms` | integer | No (default 600000) | Per-chunk timeout in ms |

### 4.3 Output Pattern

The spawner does not produce a JSON output. It produces **N Task tool calls in a single response**. Each Task call has this structure:

```
Task call [i] (for chunk i):
  description: "Fan-out chunk {i}/{N}: {strategy} - {item_count} items"
  prompt: |
    {role_description}

    ## Context
    - Phase: {phase_context}
    - Chunk: {i} of {N}
    - Strategy: {strategy}
    - Items in this chunk: {item_count}
    - Total items across all chunks: {total_items}

    ## Work Items
    {chunk.items as numbered list}

    ## Instructions
    {work_instruction}

    ## Constraints
    {constraints as bullet list}

    ## Return Format
    Return your results as a structured report matching this schema:
    {return_format}

    Include chunk_index: {i} in your response.
```

### 4.4 Spawner Rules

1. All N Task calls MUST be emitted in a **single response** (parallel execution)
2. The phase agent MUST wait for ALL N results before proceeding to the merger
3. Results may arrive in any order -- the merger handles reordering by chunk_index
4. If a chunk agent does not include chunk_index in its response, the parent agent assigns it based on Task call order
5. The parent agent MUST NOT start merging until all N Tasks have returned (or timed out)

### 4.5 Chunk Agent Constraints (read-only sandbox)

Every chunk agent prompt MUST include these constraints:

```
CRITICAL CONSTRAINTS:
1. Do NOT write to .isdlc/state.json -- the parent agent manages state
2. Do NOT run git add, git commit, git push, or any git write operations
3. Do NOT modify source files -- you are a read-only reviewer/runner
4. Do NOT spawn sub-agents -- you are a leaf agent
5. Report your results in the specified return format
6. Include chunk_index in your response
```

These constraints ensure chunk agents are safe to run in parallel without conflicts.

---

## 5. Component 3: Result Merger

### 5.1 Purpose

Combines N chunk agent results into a single unified output compatible with the existing single-agent output format.

### 5.2 Test Result Merger (Phase 16)

#### Input Contract

Array of N chunk results, each conforming to:

```json
{
  "chunk_index": 0,
  "status": "completed | failed | timed_out",
  "test_results": {
    "pass_count": 45,
    "fail_count": 2,
    "skip_count": 3,
    "total": 50,
    "failures": [
      {
        "test_name": "test/auth.test.js > should validate token",
        "error": "AssertionError: expected 401 to equal 200",
        "file": "test/auth.test.js",
        "line": 42
      }
    ],
    "coverage": {
      "lines_covered": 320,
      "lines_total": 400,
      "covered_files": {
        "src/auth.js": { "covered": [1, 2, 3, 10, 11], "total": 50 }
      }
    }
  },
  "elapsed_ms": 42000,
  "checks": {
    "build": "PASS | FAIL | SKIP",
    "lint": "PASS | FAIL | SKIP",
    "type_check": "PASS | FAIL | SKIP",
    "tests": "PASS | FAIL",
    "coverage": "PASS | FAIL | SKIP"
  },
  "error": null
}
```

#### Output Contract (Merged)

The merged output MUST match the existing single-agent Phase 16 test result schema:

```json
{
  "all_tests_passing": false,
  "lint_passing": true,
  "type_check_passing": true,
  "no_critical_vulnerabilities": true,
  "coverage_percent": 82.5,
  "test_summary": {
    "pass_count": 980,
    "fail_count": 2,
    "skip_count": 18,
    "total": 1000
  },
  "failures": [
    {
      "test_name": "test/auth.test.js > should validate token",
      "error": "AssertionError: expected 401 to equal 200",
      "file": "test/auth.test.js",
      "line": 42,
      "source_chunk": 0
    }
  ],
  "fan_out_summary": {
    "used": true,
    "total_items": 1050,
    "chunk_count": 5,
    "strategy": "round-robin",
    "chunks": [
      { "index": 0, "item_count": 210, "elapsed_ms": 42000, "status": "completed" },
      { "index": 1, "item_count": 210, "elapsed_ms": 38000, "status": "completed" }
    ],
    "merge_elapsed_ms": 500,
    "total_elapsed_ms": 42500,
    "degraded": false,
    "failures": []
  }
}
```

**Backward compatibility**: The fields `all_tests_passing`, `lint_passing`, `type_check_passing`, `no_critical_vulnerabilities`, `coverage_percent`, `test_summary`, and `failures` are the SAME fields gate-blocker.cjs reads. The `fan_out_summary` and `source_chunk` fields are additive -- gate-blocker ignores unknown fields.

#### Merge Algorithm (Tests)

```
FUNCTION merge_test_results(chunk_results, splitter_metadata):
  1. Separate successful and failed chunks:
       successful = [r for r in chunk_results if r.status == "completed"]
       failed = [r for r in chunk_results if r.status != "completed"]

  2. Aggregate test counts from successful chunks:
       pass_count = SUM(r.test_results.pass_count for r in successful)
       fail_count = SUM(r.test_results.fail_count for r in successful)
       skip_count = SUM(r.test_results.skip_count for r in successful)
       total = SUM(r.test_results.total for r in successful)

  3. Sanity check: IF total != splitter_metadata.total_items AND no failed chunks:
       Log warning: "Data integrity: merged total ({total}) != splitter total ({splitter_metadata.total_items})"

  4. Aggregate coverage (line-level union):
       FOR each source file mentioned in any chunk's coverage:
         covered_lines = UNION of covered line sets from all chunks
         total_lines = MAX of total_lines from all chunks
       coverage_percent = SUM(covered_lines) / SUM(total_lines) * 100

  5. Collect all failures:
       failures = []
       FOR each successful chunk:
         FOR each failure in chunk.test_results.failures:
           failure.source_chunk = chunk.chunk_index
           failures.append(failure)

  6. Aggregate check results (build, lint, type_check):
       FOR each check_type in [build, lint, type_check]:
         IF ANY chunk reports FAIL: merged = FAIL
         ELSE IF ALL chunks report PASS: merged = PASS
         ELSE: merged = SKIP

  7. Determine all_tests_passing:
       all_tests_passing = (fail_count == 0 AND len(failed_chunks) == 0)

  8. Build fan_out_summary from chunk metadata + timing

  9. RETURN merged result
```

### 5.3 Review Finding Merger (Phase 08)

#### Input Contract

Array of N chunk results, each conforming to:

```json
{
  "chunk_index": 0,
  "status": "completed | failed | timed_out",
  "findings": [
    {
      "file": "src/auth/login.js",
      "line_start": 42,
      "line_end": 55,
      "severity": "critical | high | medium | low",
      "category": "security | quality | logic | performance | constitutional | documentation",
      "description": "User input not sanitized before database query",
      "suggestion": "Use parameterized queries",
      "chunk_index": 0
    }
  ],
  "summary": {
    "files_reviewed": 5,
    "findings_count": 3,
    "critical": 0,
    "high": 1,
    "medium": 2,
    "low": 0
  },
  "cross_cutting_concerns": [
    {
      "id": "CC-001",
      "description": "API contract change in UserService",
      "affected_files": ["src/api/users.js", "src/services/user-service.js"],
      "impact": "Breaking change for downstream consumers"
    }
  ],
  "elapsed_ms": 35000,
  "error": null
}
```

#### Output Contract (Merged)

The merged output produces a code-review-report.md in the existing Phase 08 format with additive sections:

```markdown
# Code Review Report

## Summary
- Files reviewed: {total_files}
- Total findings: {total_findings} (after deduplication: {dedup_removed} duplicates removed)
- Critical: {N} | High: {N} | Medium: {N} | Low: {N}

## Findings

### Critical
#### [C-001] {description}
- **File**: {file}:{line_start}-{line_end}
- **Category**: {category}
- **Description**: {description}
- **Suggestion**: {suggestion}
- **Source**: Chunk {chunk_index}

### High
...

### Medium
...

### Low
...

## Cross-Cutting Concerns
### [CC-001] {description}
- **Affected files**: {file list}
- **Description**: {description}
- **Impact**: {impact}

## Parallelism Summary
- Agents used: {N}
- Strategy: {strategy}
- Chunks: [{item_counts}]
- Wall-clock time: {total_elapsed_ms}ms
- Per-chunk timing: [{chunk timings}]
- Duplicates removed: {count}
- Degraded: {yes/no}
```

#### Merge Algorithm (Reviews)

```
FUNCTION merge_review_findings(chunk_results, splitter_metadata):
  1. Separate successful and failed chunks (same as test merger)

  2. Collect all findings from successful chunks:
       all_findings = []
       FOR each chunk in successful:
         FOR each finding in chunk.findings:
           finding.chunk_index = chunk.chunk_index  (if not already set)
           all_findings.append(finding)

  3. Deduplicate findings:
       deduplicated = []
       removed_count = 0
       FOR each finding A in all_findings:
         is_duplicate = FALSE
         FOR each finding B in deduplicated:
           IF is_duplicate_finding(A, B):
             is_duplicate = TRUE
             IF len(A.description) > len(B.description):
               REPLACE B with A in deduplicated  (keep more detailed)
             BREAK
         IF NOT is_duplicate:
           deduplicated.append(A)
         ELSE:
           removed_count += 1

  4. Sort by severity: critical > high > medium > low
       Within same severity: sort by file path, then line_start

  5. Collect cross-cutting concerns:
       all_cc = []
       FOR each chunk in successful:
         all_cc.extend(chunk.cross_cutting_concerns or [])
       Deduplicate by affected_files overlap

  6. Aggregate summary:
       files_reviewed = SUM(chunk.summary.files_reviewed)
       findings_count = len(deduplicated)
       critical = COUNT(f for f in deduplicated if f.severity == "critical")
       high = COUNT(f for f in deduplicated if f.severity == "high")
       medium = COUNT(f for f in deduplicated if f.severity == "medium")
       low = COUNT(f for f in deduplicated if f.severity == "low")

  7. Build fan_out_summary

  8. RETURN { findings: deduplicated, summary, cross_cutting_concerns, fan_out_summary }
```

#### Deduplication Predicate

```
FUNCTION is_duplicate_finding(A, B):
  RETURN (
    A.file == B.file
    AND A.category == B.category
    AND ranges_overlap(A.line_start, A.line_end, B.line_start, B.line_end)
  )

FUNCTION ranges_overlap(a_start, a_end, b_start, b_end):
  RETURN a_start <= b_end AND b_start <= a_end
```

**Tie-breaking**: When two findings are duplicates:
- Keep the one with the longer `description` (more detailed)
- If same length, keep the one from the lower `chunk_index` (deterministic)

---

## 6. Decision Flow

### 6.1 Fan-Out Decision Tree

Every consumer agent follows this decision tree before invoking the engine:

```
READ state.json

IF active_workflow.flags.no_fan_out == true:
  -> Use single-agent path (skip fan-out entirely)
  -> DONE

READ fan_out config from state.json (with defaults)

IF fan_out.enabled == false:
  -> Use single-agent path
  -> DONE

IF fan_out.phase_overrides[current_phase].enabled == false:
  -> Use single-agent path
  -> DONE

COUNT work items (T for tests, F for files)

IF count < threshold (min_tests_threshold or min_files_threshold):
  -> Use single-agent path (below threshold)
  -> DONE

COMPUTE N = min(ceil(count / items_per_agent), max_agents)

IF N <= 1:
  -> Use single-agent path (computed N=1)
  -> DONE

-> Use fan-out path with N chunks
```

### 6.2 Configuration Resolution

```
FUNCTION resolve_fan_out_config(state, current_phase):
  config = {
    enabled: true,
    max_agents: 8,
    timeout_per_chunk_ms: 600000,
    strategy: null,
    items_per_agent: null,
    min_threshold: null
  }

  // Layer 1: Global defaults
  IF state.fan_out exists:
    IF state.fan_out.enabled is boolean: config.enabled = state.fan_out.enabled
    IF state.fan_out.defaults exists:
      IF state.fan_out.defaults.max_agents is integer 1-8:
        config.max_agents = state.fan_out.defaults.max_agents
      IF state.fan_out.defaults.timeout_per_chunk_ms is integer > 0:
        config.timeout_per_chunk_ms = state.fan_out.defaults.timeout_per_chunk_ms

  // Layer 2: Per-phase overrides
  IF state.fan_out.phase_overrides[current_phase] exists:
    override = state.fan_out.phase_overrides[current_phase]
    IF override.enabled is boolean: config.enabled = override.enabled
    IF override.max_agents is integer 1-8: config.max_agents = override.max_agents
    IF override.strategy is valid enum: config.strategy = override.strategy
    // Phase-specific fields:
    IF current_phase == "16-quality-loop":
      config.items_per_agent = override.tests_per_agent or 250
      config.min_threshold = override.min_tests_threshold or 250
      config.strategy = config.strategy or "round-robin"
    IF current_phase == "08-code-review":
      config.items_per_agent = override.files_per_agent or 7
      config.min_threshold = override.min_files_threshold or 5
      config.strategy = config.strategy or "group-by-directory"

  // Layer 3: CLI flag override (highest precedence)
  IF state.active_workflow.flags.no_fan_out == true:
    config.enabled = false

  RETURN config
```

---

## 7. Observability Interface

### 7.1 Skill Usage Log Entry

When fan-out is invoked, the parent agent appends a skill_usage_log entry:

```json
{
  "timestamp": "2026-02-15T16:30:00.000Z",
  "agent": "quality-loop-engineer",
  "agent_phase": "16-quality-loop",
  "current_phase": "16-quality-loop",
  "description": "Fan-out orchestration: 5 chunks, round-robin, 1050 tests",
  "status": "executed",
  "reason": "authorized-phase-match",
  "enforcement_mode": "observe",
  "external_skills_registered": 0,
  "fan_out_metadata": {
    "skill_id": "QL-012",
    "chunk_count": 5,
    "total_items": 1050,
    "strategy": "round-robin",
    "degraded": false
  }
}
```

### 7.2 Parallelism Summary Section

Both consumers add a "Parallelism Summary" section to their gate reports when fan-out was used. Format defined in Section 5.3 (review merger output).

---

## 8. Backward Compatibility Guarantees

| Interface | Guarantee |
|-----------|-----------|
| Gate-blocker input schema | Unchanged. Merged output populates same fields. `fan_out_summary` and `source_chunk` are additive (ignored by gate-blocker). |
| quality-report.md format | Extended with optional "Parallelism Summary" section. All existing sections unchanged. |
| code-review-report.md format | Extended with optional "Cross-Cutting Concerns" and "Parallelism Summary" sections. Existing format unchanged. |
| state.json test_results | Extended with nested `fan_out` object. Existing fields unchanged. |
| state.json fan_out config | New optional top-level section. When absent, all defaults apply. |
| skill_usage_log entry | Additive `fan_out_metadata` field. Existing fields unchanged. |
| Below-threshold behavior | Identical to current behavior. Fan-out decision tree exits early. |

---

## 9. Versioning

This specification is version 1.0.0. Changes to the JSON contracts require a version bump. The version is tracked in the SKILL.md file header.

Breaking changes (would require version 2.0.0):
- Changing the chunk splitter output schema
- Changing the chunk agent result schema
- Modifying the merge algorithm in ways that alter the merged output schema
- Changing the fan-out decision tree logic

Non-breaking changes (minor version bump):
- Adding new optional fields to any contract
- Adding new splitting strategies
- Adjusting default threshold values
