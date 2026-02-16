# QL-012: Fan-Out/Fan-In Parallel Execution

**Version**: 1.0.0
**Category**: quality-loop
**Path**: quality-loop/fan-out-engine

## Description

Reusable fan-out/fan-in protocol for splitting work across N parallel Task agents.
Provides a Chunk Splitter (round-robin and group-by-directory strategies), a Parallel
Spawner that emits N Task tool calls in a single response, and a Result Merger with
deduplication for combining chunk agent outputs into a unified result.

## Owner

- **Agent**: quality-loop-engineer
- **Phase**: 16-quality-loop (primary); also consumed by 08-code-review

## Skill Registration

```yaml
id: QL-012
name: fan-out-orchestration
category: quality-loop
path: quality-loop/fan-out-engine
owner: quality-loop-engineer
```

## When to Use

This skill is invoked when a phase agent determines the workload exceeds the single-agent
threshold. The decision is made by the consuming phase agent (not by this skill):

- **Phase 16 (Quality Loop)**: Fan-out within Track A when test file count T >= 250
- **Phase 08 (Code Review)**: Fan-out for file review when changed file count F >= 5

When the workload is below the threshold, the phase agent skips fan-out and uses the
existing single-agent path. This ensures backward compatibility (NFR-003).

## Components

### 1. Chunk Splitter

The Chunk Splitter divides W work items into N roughly-equal chunks. It supports two
strategies selected by the consuming phase agent:

**round-robin**: Used by Phase 16 for test file splitting. Items are sorted
alphabetically for determinism, then distributed in round-robin order across N chunks.
N = min(ceil(W / items_per_agent), max_chunks), clamped so each chunk has at least
min_items_per_chunk items.

**group-by-directory**: Used by Phase 08 for file review splitting. Items are grouped
by parent directory, then assigned to N chunks using first-fit-decreasing (largest
directory group first, placed in the chunk with fewest items, ties broken by lowest
chunk index). Keeps files from the same directory together for contextual review.

Both strategies guarantee deterministic output: given the same input items (in any
order), the output is always identical.

### 2. Parallel Spawner

The Parallel Spawner generates N Task tool calls in a single response. Each Task call
instructs a chunk agent with:

- Role description and phase context
- The specific work items assigned to that chunk
- Work instructions (what to do with the items)
- Return format specification
- Read-only sandbox constraints

All N Task calls MUST be emitted in a single response for parallel execution. The
parent agent waits for ALL N results before proceeding to the Result Merger.

**Chunk Agent Constraints (read-only sandbox):**
1. Do NOT write to .isdlc/state.json -- the parent agent manages state
2. Do NOT run git add, git commit, git push, or any git write operations
3. Do NOT modify source files -- chunk agents are read-only
4. Do NOT spawn sub-agents -- chunk agents are leaf agents
5. Include chunk_index in the response

### 3. Result Merger

The Result Merger combines N chunk agent results into a single unified output that is
backward-compatible with the existing single-agent output format.

**Test Result Merger (Phase 16)**:
- Sum pass_count, fail_count, skip_count across all chunks
- Union coverage at the line level (not average -- lines covered by ANY chunk count)
- Collect all failure details with source_chunk annotation
- Merge check results: any FAIL in any chunk = overall FAIL
- Compute aggregate coverage_percent from union of covered lines

**Review Finding Merger (Phase 08)**:
- Collect all findings from successful chunks
- Deduplicate: same file + same category + overlapping line ranges = duplicate
  (keep finding with longer description; tie-break by lower chunk_index)
- Sort by severity: critical > high > medium > low
  (within same severity: sort by file path, then line_start)
- Merge cross-cutting concerns from all chunks
- Detect additional cross-cutting concerns across chunk boundaries

## Partial Failure Handling

If K of N chunk agents fail (status != "completed" or timeout):
- The Result Merger processes the N-K successful chunk results
- The merged result is marked as `degraded: true`
- Failed chunk details are recorded in `fan_out_summary.failures`
- The overall result reflects partial data from N-K chunks
- The parent agent's iteration loop will retry the full phase on failure

This ensures the system degrades gracefully rather than failing completely when
individual chunk agents encounter errors (Article X: Fail-Safe Defaults).

## Below-Threshold Behavior

When the workload is below the configured threshold (T < 250 for tests, F < 5 for
files), the phase agent skips fan-out entirely and uses the existing single-agent
execution path. No fan-out overhead is incurred. This is the default path for small
projects and ensures 100% backward compatibility.

## Orchestration Overhead

The fan-out protocol is designed to keep orchestration overhead below 5% of total
execution time. Overhead consists of: chunk splitting (deterministic, O(W log W)),
spawner prompt generation (O(N)), and result merging (O(total findings)). For typical
workloads (250-2000 test files, 5-40 review files), overhead is negligible compared
to actual test execution or code review time.

## Observability

Fan-out usage is logged to `skill_usage_log` in state.json with `fan_out_metadata`:

```json
{
  "agent": "quality-loop-engineer",
  "skill_id": "QL-012",
  "phase": "16-quality-loop",
  "fan_out_metadata": {
    "chunk_count": 4,
    "total_items": 1000,
    "strategy": "round-robin",
    "degraded": false,
    "elapsed_ms": 45000
  }
}
```

The metadata includes: skill_id, chunk_count, total_items, strategy, and degraded
status. This enables tracking of fan-out usage patterns and performance over time.

## Configuration

Fan-out behavior is configured in `state.json` under the `fan_out` section.
Configuration resolution follows this precedence (highest to lowest):

1. `active_workflow.flags.no_fan_out` -- CLI flag override (disables all fan-out)
2. `fan_out.phase_overrides[phase].enabled` -- per-phase enable/disable
3. `fan_out.enabled` -- global enable/disable
4. Default: enabled

Phase-specific defaults are documented in the consuming agent files.

## Hard Limits

- Maximum 8 parallel chunk agents (hard cap, configurable down but not up)
- Maximum timeout per chunk: 600000ms (10 minutes) by default
- Minimum items per chunk: prevents over-splitting into too-small chunks

## Observability

Skill usage is logged for observability. Cross-phase usage is recorded but never blocked.
