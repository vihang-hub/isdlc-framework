# Infrastructure Design: Fan-Out/Fan-In Parallelism

**REQ ID**: REQ-0017
**Phase**: 03-architecture
**Created**: 2026-02-15
**Author**: Solution Architect (Agent 03)

---

## 1. Overview

The iSDLC framework is a local development tool with no cloud infrastructure, servers, or containers. All execution happens within the developer's Claude Code session. This document defines the "infrastructure" in terms of:

1. File system layout for new artifacts
2. Integration with the existing phase agent pipeline
3. Environment considerations
4. Monitoring and observability

---

## 2. File System Layout

### New Files to Create

| # | Path | Type | Purpose |
|---|------|------|---------|
| 1 | `src/claude/skills/quality-loop/fan-out-engine/SKILL.md` | Skill definition | Reusable fan-out/fan-in protocol (chunk splitter + spawner + merger contracts) |
| 2 | `src/claude/agents/16-quality-loop-engineer.md` | Agent (modify) | Add Fan-Out Protocol section for Track A test splitting |
| 3 | `src/claude/agents/07-qa-engineer.md` | Agent (modify) | Add Fan-Out Protocol section for file review splitting |
| 4 | `src/claude/commands/isdlc.md` | Command (modify) | Add --no-fan-out flag parsing |
| 5 | `src/claude/hooks/config/skills-manifest.json` | Config (modify) | Register QL-012 skill ID |

### Files NOT Modified

| # | Path | Reason |
|---|------|--------|
| 1 | `src/claude/hooks/gate-blocker.cjs` | Merged output uses same schema as single-agent; no hook changes needed |
| 2 | `src/claude/hooks/lib/common.cjs` | No new utility functions needed; phase agents handle fan-out logic inline |
| 3 | `src/claude/hooks/config/iteration-requirements.json` | Existing success_criteria schema is sufficient; fan_out_summary is optional metadata |
| 4 | `src/claude/hooks/iteration-corridor.cjs` | Fan-out chunk iterations are internal to Track A; corridor only sees phase-level iterations |

### Sync Requirement

After implementation, these files must be synced from `src/claude/` to `.claude/` (the live runtime copy):
- `src/claude/skills/quality-loop/fan-out-engine/SKILL.md` -> `.claude/skills/quality-loop/fan-out-engine/SKILL.md`
- `src/claude/agents/16-quality-loop-engineer.md` -> `.claude/agents/16-quality-loop-engineer.md`
- `src/claude/agents/07-qa-engineer.md` -> `.claude/agents/07-qa-engineer.md`
- `src/claude/commands/isdlc.md` -> `.claude/commands/isdlc.md`
- `src/claude/hooks/config/skills-manifest.json` -> `.claude/hooks/config/skills-manifest.json`

This is handled by the existing `isdlc update` sync mechanism.

---

## 3. Integration Architecture

### 3.1 Phase 16 Integration: Track A Fan-Out

**Current Architecture (before fan-out)**:

```
Phase Loop Controller (isdlc.md)
  |
  +-> Task: quality-loop-engineer
       |
       +-> Task: Track A (single agent: build + lint + type-check + tests + coverage)
       +-> Task: Track B (single agent: SAST + audit + code review)
       |
       +-> Merge Track A + Track B
       +-> Iteration loop if failures
       +-> GATE-16
```

**New Architecture (with fan-out)**:

```
Phase Loop Controller (isdlc.md)
  |
  +-> Task: quality-loop-engineer
       |
       +-> Read fan_out config from state.json
       +-> Task: Track A (orchestrator role)
       |    |
       |    +-> Count tests (T)
       |    +-> IF T < threshold: run as single agent (unchanged)
       |    +-> IF T >= threshold:
       |         +-> Chunk Splitter: T tests -> N chunks (round-robin)
       |         +-> Parallel Spawner: emit N Task calls
       |         |    +-> Task: Chunk 0 (tests[0..k])
       |         |    +-> Task: Chunk 1 (tests[k..2k])
       |         |    +-> ...
       |         |    +-> Task: Chunk N-1 (tests[(N-1)k..T])
       |         +-> Collect N results
       |         +-> Result Merger: aggregate counts, union coverage
       |         +-> Return merged Track A result
       |
       +-> Task: Track B (unchanged - single agent)
       |
       +-> Merge Track A + Track B (existing logic)
       +-> Add Parallelism Summary if fan-out used
       +-> Iteration loop if failures
       +-> GATE-16
```

**Key integration points**:
1. The Track A sub-agent becomes a mini-orchestrator when fan-out is active
2. Its output format is unchanged (same JSON schema as single-agent Track A result)
3. The quality-loop-engineer merges Track A + Track B identically whether fan-out was used or not
4. The existing A1/A2/A3 grouping strategy is **replaced** by fan-out chunking when fan-out is active (see ADR-0003)

### 3.2 Phase 08 Integration: File Review Fan-Out

**Current Architecture (before fan-out)**:

```
Phase Loop Controller (isdlc.md)
  |
  +-> Task: qa-engineer
       |
       +-> Gather changed files (git diff)
       +-> Review all files sequentially
       +-> Produce code-review-report.md
       +-> GATE-07
```

**New Architecture (with fan-out)**:

```
Phase Loop Controller (isdlc.md)
  |
  +-> Task: qa-engineer
       |
       +-> Read fan_out config from state.json
       +-> Gather changed files (git diff) -> F files
       +-> IF F < threshold: review as single agent (unchanged)
       +-> IF F >= threshold:
       |    +-> Chunk Splitter: F files -> N chunks (group-by-directory)
       |    +-> Parallel Spawner: emit N Task calls
       |    |    +-> Task: Chunk 0 (files in dirs A, B)
       |    |    +-> Task: Chunk 1 (files in dirs C, D)
       |    |    +-> ...
       |    |    +-> Task: Chunk N-1 (files in dirs Y, Z)
       |    +-> Collect N results
       |    +-> Result Merger: deduplicate findings, priority sort, cross-cutting concerns
       |    +-> Produce unified code-review-report.md
       |
       +-> Add Parallelism Summary if fan-out used
       +-> GATE-07
```

**Key integration points**:
1. The qa-engineer becomes a fan-out orchestrator when the changeset is large enough
2. The code-review-report.md output format is unchanged (same structure with optional new sections)
3. Gate-07 validation reads the same artifact paths (`docs/reviews/{artifact_folder}/review-summary.md`)

### 3.3 CLI Integration: --no-fan-out Flag

**Modification to isdlc.md**:

In the workflow init section (STEP 1), after parsing existing flags (e.g., `-light`):

```
IF workflow command includes --no-fan-out:
  Store in state.json: active_workflow.flags.no_fan_out = true
ELSE:
  Store: active_workflow.flags.no_fan_out = false (or omit)
```

Phase agents check this flag before deciding whether to fan out:

```
IF active_workflow.flags.no_fan_out == true: skip fan-out
ELSE IF fan_out.enabled == false: skip fan-out
ELSE IF fan_out.phase_overrides[phase_key].enabled == false: skip fan-out
ELSE: check threshold and potentially fan out
```

---

## 4. Environment Considerations

### Development Environment

The fan-out feature works on any environment where Claude Code runs:
- macOS (primary development environment for this project)
- Linux
- Windows (via WSL)

No environment-specific configuration is needed. The Task tool is a Claude Code primitive available in all environments.

### Resource Considerations

Spawning N parallel Task agents increases:
- **Context window usage**: Each Task agent gets its own context. N agents use N times the context.
- **API token usage**: N parallel agents make N times the API calls.
- **Wall-clock time**: Reduced (parallel execution), but total compute time increases due to per-agent overhead.

The max_agents cap of 8 is designed to balance throughput gain against resource usage. For typical workloads:
- 2-4 agents provide the best throughput/resource ratio
- 5-8 agents show diminishing returns but are useful for very large workloads

---

## 5. Observability

### 5.1 Skill Usage Log

Fan-out executions are logged to `skill_usage_log` in state.json:

```json
{
  "agent": "quality-loop-engineer",
  "skill": "QL-012",
  "skill_name": "fan-out-orchestration",
  "phase": "16-quality-loop",
  "timestamp": "2026-02-15T18:30:00.000Z",
  "metadata": {
    "consumer": "track-a-test-execution",
    "total_items": 1050,
    "chunk_count": 5,
    "strategy": "round-robin",
    "wall_clock_ms": 45500,
    "degraded": false,
    "failures": 0
  }
}
```

### 5.2 Parallelism Summary in Gate Reports

When fan-out is used, the quality-report.md and code-review-report.md include a Parallelism Summary section:

```markdown
## Parallelism Summary

| Metric | Value |
|--------|-------|
| Fan-out enabled | Yes |
| Strategy | round-robin |
| Total items | 1050 |
| Chunk count | 5 |
| Items per chunk | 210 (avg) |
| Wall-clock time | 45.5s |
| Estimated sequential time | 180s |
| Speedup | 3.96x |
| Degraded | No |
| Failures | 0 |
```

### 5.3 Error Reporting

Fan-out failures appear in the quality report's failure section with `source_chunk` attribution:

```markdown
### Failures

| Test | Error | Source Chunk |
|------|-------|-------------|
| test/auth.test.js > should validate token | AssertionError: expected 401 to equal 200 | Chunk 0 |
| test/api.test.js > should return 200 | TimeoutError: exceeded 5000ms | Chunk 2 |
```

---

## 6. Disaster Recovery

Not applicable in the traditional sense (no servers to recover). However:

### Fan-Out Failure Recovery

| Failure | Recovery |
|---------|---------|
| All chunk agents fail | Phase reports failure; iteration loop retries with single-agent fallback |
| state.json becomes corrupted during fan-out | Not possible (chunk agents do not write to state.json) |
| Fan-out produces incorrect merged results | Quality report and gate validation catch discrepancies; iteration loop retries |
| --no-fan-out needed mid-workflow | Configuration changes take effect on next workflow start (AC-007-04); current workflow continues with fan-out |

### Rollback

To disable fan-out entirely:
1. Set `fan_out.enabled: false` in state.json, OR
2. Use `--no-fan-out` flag on next workflow, OR
3. Remove the `fan_out` section from state.json (defaults apply, but below-threshold workloads skip automatically)

---

## 7. Cost Estimate

### Infrastructure Cost

**$0** -- The fan-out feature has no infrastructure cost. There are no cloud resources, servers, containers, or databases.

### API Token Cost Impact

Spawning N parallel agents increases Claude API token usage:
- Each chunk agent receives a prompt (~2-5K tokens depending on chunk size)
- Each chunk agent returns a response (~1-3K tokens for test results, ~2-5K tokens for review findings)
- Orchestration overhead (splitting, merging): ~1-2K tokens

**Estimated per-execution cost increase** (compared to single-agent):
- 2 agents: ~1.5x token usage (overhead + parallelism)
- 4 agents: ~2.5x token usage
- 8 agents: ~4x token usage

The cost is offset by reduced wall-clock time. For time-sensitive workflows, the tradeoff is favorable.

### Development Cost

- Agent markdown modifications: ~2-3 hours (Phase 16 + Phase 08)
- Skill definition: ~30 minutes
- CLI flag addition: ~15 minutes
- Skills manifest update: ~15 minutes
- Testing: ~2-3 hours (characterization tests + new fan-out tests)
- Total estimated: ~6-8 hours
