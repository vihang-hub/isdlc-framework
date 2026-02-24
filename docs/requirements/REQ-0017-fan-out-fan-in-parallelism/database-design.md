# Data Schema Design: Fan-Out/Fan-In Parallelism

**REQ ID**: REQ-0017
**Phase**: 03-architecture
**Created**: 2026-02-15
**Author**: Solution Architect (Agent 03)

---

## 1. Overview

The iSDLC framework has no database -- all state is managed via JSON files on the filesystem (`.isdlc/state.json`). This document defines the data schema extensions needed for the fan-out/fan-in parallelism feature: the state.json configuration section, the JSON contracts between engine components, and the output formats.

---

## 2. State.json Schema Extension

### 2.1 Fan-Out Configuration Section

A new top-level `fan_out` section is added to `.isdlc/state.json`. This section is **optional** -- if absent, all defaults apply.

```json
{
  "fan_out": {
    "enabled": true,
    "defaults": {
      "max_agents": 8,
      "timeout_per_chunk_ms": 600000
    },
    "phase_overrides": {
      "16-quality-loop": {
        "enabled": true,
        "tests_per_agent": 250,
        "min_tests_threshold": 250,
        "max_agents": 8,
        "strategy": "round-robin"
      },
      "08-code-review": {
        "enabled": true,
        "files_per_agent": 7,
        "min_files_threshold": 5,
        "max_agents": 8,
        "strategy": "group-by-directory"
      }
    }
  }
}
```

### 2.2 Schema Definitions

#### fan_out (top-level)

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `enabled` | boolean | No | `true` | Global enable/disable for fan-out. When false, all phases use single-agent execution. |
| `defaults` | object | No | See below | Default parameters for all phases |
| `phase_overrides` | object | No | `{}` | Per-phase configuration overrides (keyed by phase key) |

#### fan_out.defaults

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `max_agents` | integer | No | `8` | Maximum number of parallel chunk agents |
| `timeout_per_chunk_ms` | integer | No | `600000` | Timeout per chunk agent in milliseconds (10 minutes) |

#### fan_out.phase_overrides[phase_key]

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `enabled` | boolean | No | inherits from `fan_out.enabled` | Enable/disable fan-out for this specific phase |
| `tests_per_agent` | integer | No | `250` | Phase 16: number of tests per chunk agent |
| `files_per_agent` | integer | No | `7` | Phase 08: number of files per chunk agent |
| `min_tests_threshold` | integer | No | `250` | Phase 16: minimum test count to trigger fan-out |
| `min_files_threshold` | integer | No | `5` | Phase 08: minimum file count to trigger fan-out |
| `max_agents` | integer | No | inherits from `defaults.max_agents` | Maximum agents for this phase |
| `strategy` | string (enum) | No | phase-specific default | Chunk splitting strategy: `"round-robin"` or `"group-by-directory"` |

### 2.3 Workflow Flags Extension

The `--no-fan-out` CLI flag is stored in the active workflow flags:

```json
{
  "active_workflow": {
    "flags": {
      "no_fan_out": true
    }
  }
}
```

#### Flag Precedence (highest to lowest)

1. `active_workflow.flags.no_fan_out` (CLI flag -- overrides all)
2. `fan_out.phase_overrides[phase_key].enabled` (per-phase override)
3. `fan_out.enabled` (global setting)
4. Default: `true` (fan-out enabled by default)

### 2.4 Fan-Out Execution State

After a fan-out execution completes, the phase agent records execution metadata in the phase state. This extends the existing `test_results.parallel_execution` structure in Phase 16.

```json
{
  "phases": {
    "16-quality-loop": {
      "test_results": {
        "parallel_execution": {
          "enabled": true,
          "framework": "node:test",
          "flag": "--test-concurrency=7",
          "workers": 7,
          "fan_out": {
            "used": true,
            "total_items": 1050,
            "chunk_count": 5,
            "strategy": "round-robin",
            "chunks": [
              { "index": 0, "item_count": 210, "elapsed_ms": 42000, "status": "completed" },
              { "index": 1, "item_count": 210, "elapsed_ms": 38000, "status": "completed" },
              { "index": 2, "item_count": 210, "elapsed_ms": 45000, "status": "completed" },
              { "index": 3, "item_count": 210, "elapsed_ms": 40000, "status": "completed" },
              { "index": 4, "item_count": 210, "elapsed_ms": 41000, "status": "completed" }
            ],
            "merge_elapsed_ms": 500,
            "total_elapsed_ms": 45500,
            "failures": [],
            "degraded": false
          }
        }
      }
    }
  }
}
```

---

## 3. JSON Contracts Between Engine Components

### 3.1 Chunk Splitter Input/Output

#### Input

```json
{
  "items": ["test/a.test.js", "test/b.test.js", "test/c.test.js"],
  "strategy": "round-robin",
  "max_chunks": 8,
  "min_items_per_chunk": 10,
  "items_per_agent": 250
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `items` | string[] | Yes | List of work items (test file paths or source file paths) |
| `strategy` | string (enum) | Yes | `"round-robin"` or `"group-by-directory"` |
| `max_chunks` | integer | No (default 8) | Maximum number of chunks to produce |
| `min_items_per_chunk` | integer | No (default varies) | Minimum items per chunk (prevents over-splitting) |
| `items_per_agent` | integer | No (default varies) | Target items per agent (used to compute N) |

#### Output

```json
{
  "chunks": [
    {
      "index": 0,
      "items": ["test/a.test.js", "test/d.test.js", "test/g.test.js"],
      "item_count": 3,
      "weight": 1.0
    },
    {
      "index": 1,
      "items": ["test/b.test.js", "test/e.test.js", "test/h.test.js"],
      "item_count": 3,
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

### 3.2 Chunk Splitter Algorithm

#### Round-Robin Strategy

```
Input: items[] (sorted alphabetically for determinism), items_per_agent, max_chunks, min_items_per_chunk
1. N = min(ceil(len(items) / items_per_agent), max_chunks)
2. N = max(1, N)  // At least 1 chunk
3. IF len(items) / N < min_items_per_chunk:
     N = max(1, floor(len(items) / min_items_per_chunk))
4. Sort items alphabetically (determinism: C-003)
5. Distribute items round-robin across N chunks:
     chunk[i % N].append(items[i]) for i in 0..len(items)-1
6. Set weight = chunk.item_count / (total_items / N) for each chunk
```

#### Group-by-Directory Strategy

```
Input: items[] (file paths), files_per_agent, max_chunks, min_items_per_chunk
1. Group items by directory: dir_groups = { dir: [files] }
2. Sort dir_groups by directory name (determinism: C-003)
3. N = min(ceil(len(items) / files_per_agent), max_chunks)
4. N = max(1, N)
5. IF len(items) / N < min_items_per_chunk:
     N = max(1, floor(len(items) / min_items_per_chunk))
6. Assign directory groups to chunks using first-fit-decreasing:
     Sort dir_groups by size descending
     For each dir_group:
       Assign to the chunk with the fewest items
7. Set weight = chunk.item_count / (total_items / N) for each chunk
```

### 3.3 Chunk Agent Result Format (Test Execution)

Each chunk agent returns results in this format:

```json
{
  "chunk_index": 0,
  "status": "completed",
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
    "build": "PASS",
    "lint": "PASS",
    "type_check": "PASS",
    "tests": "FAIL",
    "coverage": "PASS"
  }
}
```

### 3.4 Chunk Agent Result Format (Code Review)

Each chunk agent returns review findings in this format:

```json
{
  "chunk_index": 0,
  "status": "completed",
  "findings": [
    {
      "file": "src/auth/login.js",
      "line_start": 42,
      "line_end": 55,
      "severity": "high",
      "category": "security",
      "description": "User input not sanitized before database query",
      "suggestion": "Use parameterized queries instead of string concatenation",
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
  "elapsed_ms": 35000
}
```

### 3.5 Merged Result Format (Test Execution)

The merger produces output identical to the existing single-agent test result format:

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
  ]
}
```

This is the **same schema** that gate-blocker.cjs reads from `phases[phase].test_results`. The only addition is the optional `source_chunk` field on each failure, which gate-blocker ignores (backward compatible).

### 3.6 Merged Result Format (Code Review)

The merger produces a `code-review-report.md` with the same structure as the existing single-agent report, plus an optional cross-cutting concerns section:

```markdown
# Code Review Report

## Summary
- Files reviewed: 22
- Total findings: 15
- Critical: 1 | High: 3 | Medium: 8 | Low: 3

## Findings

### Critical

#### [C-001] SQL injection in user authentication
- **File**: src/auth/login.js:42-55
- **Category**: security
- **Description**: User input not sanitized before database query
- **Suggestion**: Use parameterized queries

### High
...

### Medium
...

### Low
...

## Cross-Cutting Concerns

### [CC-001] API contract change in UserService
- **Affected files**: src/api/users.js, src/services/user-service.js, test/api/users.test.js
- **Description**: Return type changed from object to array; all consumers must be updated
- **Impact**: Breaking change for 3 downstream consumers

## Parallelism Summary
- Agents used: 4
- Strategy: group-by-directory
- Chunks: [5 files, 6 files, 5 files, 6 files]
- Wall-clock time: 38s (estimated sequential: 120s)
- Duplicates removed: 2
```

---

## 4. Deduplication Algorithm

### Finding Deduplication (Phase 08)

Two findings are considered duplicates if ALL of the following match:
1. Same `file` path
2. Overlapping `line_start`..`line_end` ranges (ranges overlap if `a.start <= b.end AND b.start <= a.end`)
3. Same `category` (security, quality, logic, etc.)

When duplicates are detected:
- Keep the finding with the longer `description` (more detailed)
- If descriptions are the same length, keep the one from the lower `chunk_index` (deterministic)
- Log the deduplication in the Parallelism Summary

### Test Result Deduplication (Phase 16)

Test results do not need deduplication because each chunk runs a disjoint set of tests (round-robin splitting ensures no test appears in multiple chunks). The merger performs a sanity check: `sum(chunk.total) == total_items` from the splitter metadata. If the counts do not match, the merger reports a data integrity warning.

---

## 5. Coverage Aggregation Algorithm

Coverage from multiple chunk agents must be aggregated using **line-level union**, not percentage averaging.

```
For each source file in any chunk's coverage:
  covered_lines = UNION of covered_lines from all chunks that tested this file
  total_lines = MAX of total_lines from all chunks (should be identical)

overall_coverage_percent = sum(covered_lines across all files) / sum(total_lines across all files) * 100
```

This ensures that if chunk A covers lines 1-50 and chunk B covers lines 30-80 of the same file, the merged coverage reflects lines 1-80 (not the average of two partial percentages).

---

## 6. Error and Timeout Handling

### Partial Failure

If a chunk agent fails (returns an error or times out):

```json
{
  "chunk_index": 2,
  "status": "failed",
  "error": "Task timed out after 600000ms",
  "elapsed_ms": 600000,
  "test_results": null
}
```

The merger:
1. Collects results from the N-1 successful chunks
2. Marks the merged result as `degraded: true`
3. Includes the failed chunk in `failures[]` with full error details
4. Computes aggregate statistics from successful chunks only
5. Reports: "Warning: {K} of {N} chunk agents failed. Results are from {N-K} agents."

### Total Failure

If ALL N chunk agents fail:
1. The phase reports failure
2. All N error messages are preserved in the failure report
3. The iteration loop may retry (same as existing behavior for single-agent failures)

---

## 7. Migration Strategy

### Backward Compatibility

The state.json `fan_out` section is entirely optional. When absent:
- Fan-out is enabled with default parameters
- This means existing state.json files require zero changes
- Below-threshold workloads (< 250 tests, < 5 files) skip fan-out automatically

### Forward Compatibility

New state.json fields are additive. Existing hooks and agents ignore unknown fields. The `fan_out` section can be removed at any time to revert to defaults.

### No Data Migration Needed

There is no existing data to migrate. The `fan_out` section is new. The `fan_out.used` field in phase execution state is new. No existing state.json fields are modified or removed.

---

## 8. Schema Validation

The `fan_out` section is validated at read-time by the phase agent using simple type checks:

| Field | Validation | On Failure |
|-------|-----------|-----------|
| `fan_out.enabled` | Must be boolean if present | Default to `true` |
| `fan_out.defaults.max_agents` | Must be integer 1-8 | Default to `8` |
| `fan_out.defaults.timeout_per_chunk_ms` | Must be integer > 0 | Default to `600000` |
| `fan_out.phase_overrides[key].strategy` | Must be `"round-robin"` or `"group-by-directory"` | Default to phase-specific default |

Invalid values are logged as warnings and replaced with defaults (Article X: Fail-Safe Defaults). The phase agent does not fail on invalid configuration -- it degrades gracefully.
