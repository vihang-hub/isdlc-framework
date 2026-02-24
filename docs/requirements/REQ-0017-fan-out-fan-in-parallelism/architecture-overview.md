# Architecture Overview: Fan-Out/Fan-In Parallelism

**REQ ID**: REQ-0017
**Phase**: 03-architecture
**Created**: 2026-02-15
**Author**: Solution Architect (Agent 03)
**Status**: Accepted

---

## 1. Executive Summary

This document defines the architecture for a reusable fan-out/fan-in parallelism engine that enables execution-heavy iSDLC phases to split work across N parallel agents. The engine is implemented as a **shared protocol embedded in agent markdown** (not executable code), with two initial consumers: Phase 16 Quality Loop (test fan-out within Track A) and Phase 08 Code Review (file review fan-out by directory).

The architecture extends the existing agent-based markdown orchestration pattern. It adds no new runtime dependencies, no new executable modules, and no changes to the hook enforcement layer. The fan-out engine is a coordination protocol -- a set of JSON contracts and markdown instructions that phase agents follow to split, spawn, and merge work.

---

## 2. Architectural Drivers

### Key Requirements (from requirements-spec.md)

| ID | Driver | Architectural Impact |
|----|--------|---------------------|
| FR-001 | Shared reusable engine | Must be a protocol, not phase-specific code |
| FR-002 | Chunk splitting (round-robin + group-by-directory) | Deterministic splitting algorithm in markdown instructions |
| FR-003 | Parallel Task spawner | Leverages existing Task tool -- N calls in single response |
| FR-005 | Phase 16 Track A fan-out | Nests inside existing dual-track model (Phase Loop -> Track A/B -> Fan-Out chunks) |
| FR-006 | Phase 08 file review fan-out | Adds parallel review capability to existing sequential review |
| FR-007 | Configuration via state.json | Schema extension to existing state.json; no workflows.json (does not exist on disk) |

### Key NFRs

| ID | Constraint | Architectural Response |
|----|-----------|----------------------|
| NFR-001 | Faster than sequential for above-threshold workloads | N parallel Task calls vs 1; overhead < 5% |
| NFR-002 | Partial failure tolerance | Collect N-1 results; report degraded |
| NFR-003 | Backward compatibility | Below-threshold workloads skip fan-out transparently; merged output format identical to single-agent format |
| NFR-004 | Observability | skill_usage_log entries; Parallelism Summary in gate reports |

### Key Constraints

| ID | Constraint | Architectural Response |
|----|-----------|----------------------|
| C-001 | Must use existing Task tool | No external processes; N Task calls in one response |
| C-002 | Max 8 parallel agents | Hard cap enforced in chunk splitter |
| C-003 | Deterministic splitting | Same inputs produce same chunks (sorted input, deterministic algorithm) |
| C-004 | Any-order result collection | Merger handles unordered results by chunk index |
| C-005 | Must not break dual-track model | Fan-out is WITHIN Track A, not between tracks |

---

## 3. Architecture Pattern

### Pattern: Protocol-Based Agent Coordination (extending existing pattern)

The iSDLC framework uses **markdown-defined agents** orchestrated by the Phase Loop Controller (isdlc.md). Agents do not share executable code -- they follow protocols defined in their markdown instructions. The fan-out engine follows this same pattern.

**Selected pattern**: Embedded Shared Protocol with Skill Registration

The fan-out engine is defined as:
1. A **shared protocol section** in a dedicated skill markdown file (`src/claude/skills/quality-loop/fan-out-engine/SKILL.md`) that defines the JSON contracts, chunk splitting algorithm, spawn pattern, and merge rules
2. **Consumer-specific integration sections** embedded in each phase agent (16-quality-loop-engineer.md, 07-qa-engineer.md) that reference the protocol and provide phase-specific parameters

This pattern was chosen over alternatives because:
- It is consistent with how existing cross-cutting protocols work (e.g., Tool Discovery Protocol, Parallel Execution Protocol in Phase 16)
- It avoids duplicating the full protocol in each consumer agent -- consumers reference the skill and provide phase-specific configuration
- It keeps the engine as a protocol (markdown instructions), not executable code, consistent with the iSDLC architecture
- It allows future phase consumers to adopt fan-out by referencing the same skill

### Rejected Alternatives

| Alternative | Why Rejected |
|-------------|-------------|
| Shared executable module (JS/CJS) | iSDLC agents are markdown-based; adding runtime code for orchestration contradicts the architecture. Agents follow instructions, they do not call shared libraries. |
| CLAUDE.md shared protocol section | Would bloat CLAUDE.md (already large); skill files are the correct location for reusable capabilities. |
| New orchestrator sub-agent | Over-engineering; the fan-out protocol is simple enough to be followed by existing phase agents without a dedicated orchestrator. Adding an intermediary agent would increase latency and context window usage. |
| Duplicate protocol in each consumer | Violates DRY; two copies would drift. A single skill definition with consumer-specific parameters is cleaner. |

See ADR-0001 for the full decision record.

---

## 4. System Context (C4 Level 1)

```
                                                         [User]
                                                           |
                                                           v
                                                     [Claude Code]
                                                           |
                                                           v
                                                  [Phase Loop Controller]
                                                    (isdlc.md)
                                                      |       |
                                          +-----------+       +-----------+
                                          v                               v
                                [Phase 16 Agent]                  [Phase 08 Agent]
                           (quality-loop-engineer)               (qa-engineer)
                                  |       |                            |
                          +-------+       +-------+             +------+------+
                          v               v       v             v             v
                     [Track A]      [Track B]  [Gate-16]   [Fan-Out      [Gate-07]
                          |                                 Chunks]
                    +-----+-----+
                    v     v     v
               [Chunk 1][Chunk 2]...[Chunk N]
                    |     |     |
                    +--+--+--+--+
                       v
                 [Result Merger]
                       |
                       v
                [Merged Track A Result]
```

### External Boundaries

- **Claude Code Task Tool**: The execution substrate. All parallel agents are spawned via Task tool calls. The framework does not control Task tool internals.
- **Filesystem (state.json)**: Configuration source and state storage. Fan-out config is read from state.json at phase start.
- **Git Repository**: Changed file list for Phase 08 is derived from `git diff` against the base branch.

---

## 5. Container Diagram (C4 Level 2)

### Components

| Component | Type | Responsibility | Location |
|-----------|------|---------------|----------|
| Fan-Out Engine Protocol | Skill (markdown) | Defines JSON contracts, splitting algorithm, spawn pattern, merge rules | `src/claude/skills/quality-loop/fan-out-engine/SKILL.md` |
| Chunk Splitter Protocol | Sub-section of Engine | Split W items into N chunks with round-robin or group-by-directory strategy | Embedded in SKILL.md |
| Parallel Spawner Protocol | Sub-section of Engine | Generate N Task tool calls in single response with chunk-scoped prompts | Embedded in SKILL.md |
| Result Merger Protocol | Sub-section of Engine | Combine N results: aggregate counts, deduplicate findings, priority sort | Embedded in SKILL.md |
| Phase 16 Fan-Out Integration | Agent section | Track A test fan-out using round-robin strategy | `16-quality-loop-engineer.md` |
| Phase 08 Fan-Out Integration | Agent section | File review fan-out using group-by-directory strategy | `07-qa-engineer.md` |
| Fan-Out Configuration | State schema | Thresholds, max agents, per-phase overrides | `.isdlc/state.json` -> `fan_out` |
| --no-fan-out Flag | CLI flag | Disables fan-out for a workflow run | `isdlc.md` flag parsing |

### Component Interactions

```
[isdlc.md]
  |-- reads --no-fan-out flag from CLI args
  |-- stores flag in state.json: active_workflow.flags.no_fan_out
  |-- delegates to phase agent (STEP 3d)

[Phase Agent (16 or 08)]
  |-- reads state.json: fan_out config + active_workflow.flags.no_fan_out
  |-- IF no_fan_out OR below threshold: uses single-agent path (no change)
  |-- IF above threshold:
      |-- invokes Chunk Splitter Protocol (compute chunks from work list)
      |-- invokes Parallel Spawner Protocol (emit N Task calls)
      |-- waits for all N results
      |-- invokes Result Merger Protocol (combine results)
      |-- produces output in existing format (backward compatible)

[Gate Blocker (gate-blocker.cjs)]
  |-- validates phase output (unchanged)
  |-- merged output uses identical schema to single-agent output
  |-- no modification needed to gate-blocker
```

---

## 6. Data Flow

### Phase 16 Fan-Out Flow

```
Phase Loop Controller
  |
  +--> Task: quality-loop-engineer
       |
       +--> Read state.json (fan_out config, no_fan_out flag, test suite info)
       |
       +--> Spawn Track A + Track B (existing dual-track, 2 parallel Tasks)
       |    |
       |    +--> Track A sub-agent:
       |         |
       |         +--> Count test files (T)
       |         |
       |         +--> IF T < 250: run tests as single agent (existing behavior)
       |         |
       |         +--> IF T >= 250:
       |              |
       |              +--> Chunk Splitter: split T tests into N chunks
       |              |    N = min(ceil(T / tests_per_agent), max_agents)
       |              |    Strategy: round-robin
       |              |
       |              +--> Parallel Spawner: emit N Task calls
       |              |    Each chunk agent runs: build + lint + type-check + test subset + coverage
       |              |
       |              +--> Collect N results (any order)
       |              |
       |              +--> Result Merger: aggregate pass/fail/skip, union coverage, merge timing
       |              |
       |              +--> Return merged Track A result (same schema as single-agent result)
       |
       |    +--> Track B sub-agent: (unchanged -- no fan-out)
       |
       +--> Merge Track A + Track B into quality-report.md (existing consolidation)
       |
       +--> Add "Parallelism Summary" section if fan-out was used
       |
       +--> GATE-16 validation (unchanged)
```

### Phase 08 Fan-Out Flow

```
Phase Loop Controller
  |
  +--> Task: qa-engineer
       |
       +--> Read state.json (fan_out config, no_fan_out flag)
       |
       +--> Gather changed files via git diff (F files)
       |
       +--> IF F < 5: review all files as single agent (existing behavior)
       |
       +--> IF F >= 5:
       |    |
       |    +--> Chunk Splitter: group files by directory, split into N chunks
       |    |    N = min(ceil(F / files_per_agent), max_agents)
       |    |    Strategy: group-by-directory
       |    |
       |    +--> Parallel Spawner: emit N Task calls
       |    |    Each chunk agent reviews: logic, security, quality, constitutional compliance
       |    |
       |    +--> Collect N results (any order)
       |    |
       |    +--> Result Merger: deduplicate findings, priority sort, cross-cutting concerns
       |    |
       |    +--> Produce unified code-review-report.md (same format as single-agent)
       |
       +--> Add "Parallelism Summary" section if fan-out was used
       |
       +--> GATE-07 validation (unchanged)
```

---

## 7. Scalability Strategy

### Horizontal Scaling (Agent Count)

The fan-out engine scales horizontally by adding parallel agents up to the configured maximum (default: 8). The scaling heuristics are:

| Consumer | Heuristic | Min Threshold | Items per Agent | Max Agents |
|----------|-----------|--------------|-----------------|------------|
| Phase 16 (tests) | ceil(T / tests_per_agent) | 250 tests | ~250 | 8 |
| Phase 08 (files) | ceil(F / files_per_agent) | 5 files | ~7 | 8 |

### Diminishing Returns

Beyond 8 agents, orchestration overhead (prompt construction, result merging, context window usage) exceeds the throughput benefit. The hard cap of 8 is a design constraint (C-002).

### Future Extensibility

The engine protocol is phase-agnostic. Future consumers can adopt fan-out by:
1. Defining their work item type (tests, files, modules, etc.)
2. Choosing a splitting strategy (round-robin or group-by-directory)
3. Setting thresholds in state.json
4. Following the protocol in their agent markdown

No changes to the engine itself are needed.

---

## 8. Deployment Architecture

This feature has no deployment impact. The iSDLC framework is a local development tool installed via `npx isdlc init`. All fan-out execution happens within a single Claude Code session on the developer's machine. There are no servers, containers, or cloud resources involved.

### Artifact Deployment

New/modified files are deployed via the existing `isdlc update` mechanism:
- Agent markdown files are updated in `src/claude/agents/` and synced to `.claude/agents/`
- Skill files are added to `src/claude/skills/quality-loop/` and synced to `.claude/skills/`
- Skills manifest is updated in `src/claude/hooks/config/` and synced to `.claude/hooks/config/`
- State.json schema changes are backward-compatible (new optional section)

---

## 9. Technology Radar

| Technology | Status | Notes |
|-----------|--------|-------|
| Claude Code Task Tool | **Adopt** (existing) | Execution substrate for parallel agents; proven with 2-way parallelism in Phase 16 |
| Markdown Agent Protocols | **Adopt** (existing) | All agent logic is defined in markdown; fan-out follows this pattern |
| JSON State (state.json) | **Adopt** (existing) | Configuration and state storage; extended with fan_out section |
| CJS Hooks | **Hold** (existing, no changes) | Gate-blocker and iteration-corridor are not modified; merged output uses same schema |
| Skills Manifest | **Adopt** (existing) | New skill IDs registered for observability |

No new technologies are introduced. This is a protocol-level extension within the existing technology stack.

---

## 10. Key Architectural Decisions Summary

| # | Decision | Rationale | ADR |
|---|----------|-----------|-----|
| 1 | Implement fan-out as embedded agent protocol, not executable code | Consistent with markdown-agent architecture; no new runtime dependencies | ADR-0001 |
| 2 | Use state.json exclusively for configuration (no workflows.json) | workflows.json does not exist on disk; creating it introduces unnecessary complexity | ADR-0002 |
| 3 | Fan-out replaces existing A1/A2/A3 grouping in Track A | The existing grouping is informally defined (MAY/SHOULD language); fan-out provides deterministic splitting that supersedes it | ADR-0003 |
| 4 | Merged output uses identical schema to single-agent output | Gate-blocker and downstream phases remain unaware of fan-out; zero changes to validation layer | ADR-0004 |
| 5 | Track B is excluded from fan-out | QA review is not parallelizable by test chunk; Track B checks are inherently serial (security scan, dependency audit) | Inline (FR-005 AC-005-06) |
