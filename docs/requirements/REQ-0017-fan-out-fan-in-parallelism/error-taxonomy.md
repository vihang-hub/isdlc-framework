# Error Taxonomy: Fan-Out/Fan-In Engine

**REQ ID**: REQ-0017
**Phase**: 04-design
**Created**: 2026-02-15
**Author**: System Designer (Agent 04)
**Traces**: NFR-002, Article X (Fail-Safe Defaults)

---

## 1. Design Principles

All errors in the fan-out engine follow these principles:

1. **Fail-open**: No fan-out error should block the user's workflow. If fan-out cannot proceed, fall back to single-agent execution.
2. **Graceful degradation**: Partial results are always preferred over no results. If K of N chunks succeed, use K results.
3. **Logging over blocking**: Invalid configuration and edge cases are logged as warnings, not thrown as errors.
4. **Deterministic recovery**: Given the same error condition, the same recovery path is always taken.

---

## 2. Error Code Taxonomy

### 2.1 Configuration Errors (ERR-CFG-*)

Errors related to reading and validating fan-out configuration from state.json.

| Code | Name | Severity | Trigger | Recovery | Impact |
|------|------|----------|---------|----------|--------|
| ERR-CFG-001 | Config Read Failure | Warning | state.json unreadable or corrupt fan_out section | Use all defaults, log warning | Fan-out uses default thresholds |
| ERR-CFG-002 | Invalid Max Agents | Warning | `max_agents` not integer or out of range [1,8] | Default to 8, log warning | Parallelism uses max capacity |
| ERR-CFG-003 | Invalid Timeout | Warning | `timeout_per_chunk_ms` not positive integer | Default to 600000, log warning | 10-minute timeout per chunk |
| ERR-CFG-004 | Invalid Strategy | Warning | `strategy` not "round-robin" or "group-by-directory" | Default to phase-specific strategy, log warning | Correct strategy for phase used |
| ERR-CFG-005 | Invalid Threshold | Warning | `min_*_threshold` or `*_per_agent` not positive integer | Default to phase-specific value, log warning | Default threshold applied |
| ERR-CFG-006 | Unknown Phase Override Key | Info | Phase override key not "16-quality-loop" or "08-code-review" | Ignore unknown key, log info | No impact on known phases |

**Recovery pattern**: All ERR-CFG errors use the same pattern:
```
IF value is invalid:
  LOG WARNING: "Fan-out config: {field} has invalid value ({value}), using default ({default})"
  USE default value
  CONTINUE normally
```

### 2.2 Chunk Splitter Errors (ERR-CS-*)

Errors during the work item splitting phase.

| Code | Name | Severity | Trigger | Recovery | Impact |
|------|------|----------|---------|----------|--------|
| ERR-CS-001 | Empty Items List | Error | items[] is empty or null | Skip fan-out, fall back to single-agent path, log warning | Single-agent execution |
| ERR-CS-002 | Single Directory Group | Info | All files belong to one directory (group-by-directory strategy) | N = 1, effectively single-agent execution, log info | No parallelism benefit but no error |
| ERR-CS-003 | Duplicate Items Detected | Warning | Same item appears multiple times in input | Deduplicate before splitting, log warning with count | Correct splitting with deduplicated items |
| ERR-CS-004 | Computed N Exceeds Max | Info | ceil(items/per_agent) > max_chunks | Cap at max_chunks, log info | Expected behavior, not an error |
| ERR-CS-005 | Min Items Per Chunk Enforcement | Info | Computed N would result in chunks below minimum | Reduce N to satisfy minimum, log info | Fewer but larger chunks |

**Recovery pattern for ERR-CS-001**:
```
IF items is empty or null:
  LOG WARNING: "Fan-out: no work items to split, using single-agent path"
  RETURN to single-agent execution path
  DO NOT attempt to spawn zero chunks
```

### 2.3 Spawner Errors (ERR-SP-*)

Errors during the parallel Task spawning phase.

| Code | Name | Severity | Trigger | Recovery | Impact |
|------|------|----------|---------|----------|--------|
| ERR-SP-001 | Task Spawn Failure | Error | Task tool call fails to launch | Attempt remaining chunks; if all fail, fall back to single-agent | Degraded or single-agent execution |
| ERR-SP-002 | Chunk Agent Timeout | Warning | Chunk agent exceeds timeout_per_chunk_ms | Mark chunk as `status: "timed_out"`, continue with N-1 results | Degraded result with N-1 chunks |
| ERR-SP-003 | Git Diff Failure | Warning | `git diff` command fails (Phase 08 only) | Try `git status` for changed files; if both fail, review all tracked files | Best-effort file list |
| ERR-SP-004 | Chunk Agent Crash | Warning | Chunk agent returns non-structured error | Mark chunk as `status: "failed"`, preserve error text, continue with N-1 results | Degraded result |

**Recovery pattern for ERR-SP-002**:
```
IF chunk[i] exceeds timeout:
  chunk_results[i] = {
    chunk_index: i,
    status: "timed_out",
    error: "Task timed out after {timeout_ms}ms",
    elapsed_ms: timeout_ms,
    test_results: null
  }
  CONTINUE collecting remaining chunk results
  PROCEED to merger with N-1 valid results + 1 timed-out result
```

### 2.4 Merger Errors (ERR-MG-*)

Errors during result merging.

| Code | Name | Severity | Trigger | Recovery | Impact |
|------|------|----------|---------|----------|--------|
| ERR-MG-001 | Invalid Chunk Result | Warning | Chunk result cannot be parsed as expected schema | Mark chunk as failed, merge N-1 valid results | Degraded result |
| ERR-MG-002 | Data Integrity Warning | Warning | Sum of chunk totals does not equal splitter metadata.total_items | Log warning with mismatch details, continue with actual counts | Aggregated counts may differ from expected |
| ERR-MG-003 | All Chunks Failed | Error | All N chunk agents returned failed/timed_out status | Report overall phase failure with all N error messages | Phase fails, iteration loop may retry |
| ERR-MG-004 | Deduplication Ambiguity | Info | Two findings match file+category+lines but have significantly different descriptions | Keep both findings (do not deduplicate), log info | Slightly more findings than expected but no data loss |
| ERR-MG-005 | Coverage Aggregation Mismatch | Warning | Different chunks report different total_lines for the same source file | Use MAX of total_lines, log warning | Coverage percentage may be slightly off |
| ERR-MG-006 | Missing Chunk Index | Warning | Chunk result does not include chunk_index field | Assign chunk_index based on Task call order, log warning | Correct ordering maintained |

**Recovery pattern for ERR-MG-003 (total failure)**:
```
IF all N chunks failed:
  merged_result = {
    status: "failed",
    error: "All {N} fan-out chunks failed",
    chunk_errors: [
      { chunk_index: 0, error: "...", status: "failed" },
      { chunk_index: 1, error: "...", status: "timed_out" },
      ...
    ],
    fan_out_summary: { used: true, degraded: true, chunk_count: N, failures: [...] }
  }
  RETURN merged_result to phase agent
  Phase agent treats this as overall failure -> iteration loop retries
```

---

## 3. Error Severity Classification

| Severity | Definition | Fan-Out Behavior |
|----------|-----------|-----------------|
| **Error** | Cannot proceed with fan-out | Fall back to single-agent path OR report phase failure |
| **Warning** | Can proceed with degradation | Log warning, use defaults or partial results |
| **Info** | Normal operating condition | Log for observability, no action needed |

---

## 4. Error Response Format

All fan-out errors that reach the merged result are reported in a consistent format:

```json
{
  "fan_out_summary": {
    "used": true,
    "degraded": true,
    "chunk_count": 5,
    "strategy": "round-robin",
    "failures": [
      {
        "chunk_index": 2,
        "status": "timed_out",
        "error": "Task timed out after 600000ms",
        "error_code": "ERR-SP-002",
        "items_affected": 210,
        "items_lost": true
      }
    ],
    "warnings": [
      {
        "code": "ERR-MG-002",
        "message": "Data integrity: merged total (840) != splitter total (1050) -- 1 chunk timed out"
      }
    ]
  }
}
```

---

## 5. Error Propagation Chain

```
Config Error (ERR-CFG-*) -> Use defaults, continue
  |
  v
Splitter Error (ERR-CS-*) -> Fall back to single-agent, OR continue with adjusted N
  |
  v
Spawner Error (ERR-SP-*) -> Mark failed chunks, continue with N-K results
  |
  v
Merger Error (ERR-MG-*) -> Log warning, produce best-effort merged result
  |
  v
Merged Result (may be degraded)
  |
  v
Phase Agent -> If degraded: include in quality/review report
  |
  v
Gate Validation -> Unchanged (reads same schema, ignores fan_out_summary)
  |
  v
Iteration Loop -> If overall failure: retry entire phase (all N chunks)
```

---

## 6. Retry Strategy

### 6.1 No Chunk-Level Retry

Individual chunk failures are NOT retried at the chunk level. The rationale:
- Retrying a single chunk would require re-spawning a Task, waiting for it, and then re-merging
- The iteration loop already retries the entire phase (including all chunks)
- Chunk-level retry adds complexity without clear benefit (most chunk failures are systemic, not transient)

### 6.2 Phase-Level Retry

When the merged result indicates failures, the existing iteration loop in Phase 16 and Phase 08 handles retries:
- Phase 16: "If EITHER track fails: consolidate all failures, delegate fixes to software-developer, re-run BOTH tracks"
- Phase 08: Gate validation fails, phase is retried

On retry, ALL N chunks are re-run (not just the failed ones). This is simpler and avoids stale-result issues.

### 6.3 Circuit Breaker

The existing circuit breaker (from iteration-requirements.json) applies to phase-level iterations. If the same failure occurs `circuit_breaker_threshold` times consecutively, the phase escalates to the orchestrator. This is unchanged by fan-out.

---

## 7. Traceability

| Error Code | Requirement | Acceptance Criteria |
|------------|-------------|---------------------|
| ERR-CFG-* | FR-007, Article X | AC-007-01 (config), Fail-safe defaults |
| ERR-CS-001 | FR-002, FR-005, FR-006 | AC-005-07, AC-006-06 (below threshold) |
| ERR-SP-002 | FR-003, NFR-002 | AC-003-04 (timeout), AC-001-05 (partial failure) |
| ERR-MG-001 | FR-004, NFR-002 | AC-001-05 (partial failure handling) |
| ERR-MG-003 | FR-004, NFR-002 | All-fail scenario |
| ERR-MG-004 | FR-004, FR-006 | AC-004-03, AC-006-05 (deduplication) |
| ERR-MG-002 | FR-004 | AC-004-01 (data integrity) |
