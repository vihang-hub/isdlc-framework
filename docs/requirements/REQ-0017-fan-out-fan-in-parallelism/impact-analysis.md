# Impact Analysis: Fan-Out/Fan-In Parallelism

**Generated**: 2026-02-15T17:30:00Z
**Feature**: Reusable fan-out/fan-in engine with Phase 16 (Quality Loop) and Phase 08 (Code Review) consumers
**Based On**: Phase 01 Requirements (finalized) -- REQ-0017
**Phase**: 02-impact-analysis

---

## Scope Comparison

| Aspect | Original (Workflow Init) | Clarified (Phase 01) |
|--------|--------------------------|----------------------|
| Description | Fan-out/fan-in parallelism for execution-heavy phases -- split work across N parallel agents for throughput in Phase 16 and Phase 08 | Reusable fan-out/fan-in engine (chunk splitter, parallel Task spawner, result merger) as a shared module, with two consumers (Phase 16 Quality Loop within Track A, Phase 08 Code Review), configurable parameters, partial failure handling, deduplication, and observability logging |
| Keywords | fan-out, fan-in, parallel, Phase 16, Phase 08 | fan-out, fan-in, chunk-splitter, round-robin, group-by-directory, Task spawner, result merger, deduplication, partial failure, observability, thresholds, state.json config, workflows.json modifiers, --no-fan-out |
| Estimated Files | N/A (Phase 00 skipped) | 20+ files affected (see analysis below) |
| Scope Change | - | EXPANDED -- added reusable engine as separate module, two chunk strategies, config overrides, partial failure tolerance, observability, cross-cutting concerns section |

---

## Executive Summary

This feature introduces a reusable fan-out/fan-in parallelism infrastructure that will affect 22 files across 6 modules. The primary blast radius centers on two phase agents (16-quality-loop-engineer.md, 07-qa-engineer.md), the phase-loop controller (isdlc.md), and the shared hook utilities (common.cjs). A new shared module must be created (the fan-out engine) as a reusable component under `src/claude/`. The feature builds on the existing dual-track parallelism in Phase 16 but goes deeper -- parallelizing WITHIN Track A rather than between tracks. Phase 08 gains a new capability (parallel file review) that it currently lacks entirely. Configuration surfaces in state.json and workflows.json require schema additions. Gate validation hooks (gate-blocker.cjs, iteration-requirements.json) must accept the new merged output format without regression. The risk is MEDIUM -- the existing Phase 16 dual-track model and Phase 08 gate validation are the highest-risk integration points.

**Blast Radius**: MEDIUM (22 files, 6 modules)
**Risk Level**: MEDIUM
**Affected Files**: 22
**Affected Modules**: agents, hooks/lib, hooks/config, commands, skills, docs

---

## Impact Analysis (M1)

### Directly Affected Files by Functional Requirement

#### FR-001: Shared Fan-Out/Fan-In Engine (NEW MODULE)

| File | Change Type | Impact |
|------|------------|--------|
| `src/claude/skills/quality-loop/fan-out-engine/SKILL.md` | NEW | New skill definition for the fan-out engine |
| `src/claude/hooks/config/skills-manifest.json` | MODIFY | Register new fan-out skill IDs (e.g., QL-012 fan-out-engine or similar) |

The engine itself is a conceptual module defined in agent markdown. Since iSDLC agents are markdown-based (not executable code), the "reusable module" manifests as:
1. A shared skill/protocol section that Phase 16 and Phase 08 agents both reference
2. A standardized JSON contract for chunk definitions, spawn instructions, and merge results

#### FR-002: Chunk Splitting Logic

| File | Change Type | Impact |
|------|------------|--------|
| `src/claude/agents/16-quality-loop-engineer.md` | MODIFY | Add chunk splitting protocol for Track A test suite splitting |
| `src/claude/agents/07-qa-engineer.md` | MODIFY | Add chunk splitting protocol for file review splitting |

#### FR-003: Parallel Task Spawner

| File | Change Type | Impact |
|------|------------|--------|
| `src/claude/agents/16-quality-loop-engineer.md` | MODIFY | Replace single Track A Task call with N parallel Task calls |
| `src/claude/agents/07-qa-engineer.md` | MODIFY | Add N parallel Task calls for file review chunks |

#### FR-004: Result Merger

| File | Change Type | Impact |
|------|------------|--------|
| `src/claude/agents/16-quality-loop-engineer.md` | MODIFY | Add test result merging logic (pass/fail/skip aggregation, coverage union) |
| `src/claude/agents/07-qa-engineer.md` | MODIFY | Add review finding merger with deduplication and priority sorting |

#### FR-005: Phase 16 Fan-Out (Quality Loop)

| File | Change Type | Impact |
|------|------------|--------|
| `src/claude/agents/16-quality-loop-engineer.md` | MODIFY (major) | Core change -- Track A becomes a fan-out orchestrator instead of a single agent |
| `src/claude/hooks/config/iteration-requirements.json` | MODIFY | Phase 16 success criteria may need "fan_out_summary" field |
| `src/claude/hooks/gate-blocker.cjs` | VERIFY | Gate validation must accept merged test results from fan-out |

#### FR-006: Phase 08 Fan-Out (Code Review)

| File | Change Type | Impact |
|------|------------|--------|
| `src/claude/agents/07-qa-engineer.md` | MODIFY (major) | Core change -- adds parallel file review capability |
| `src/claude/hooks/config/iteration-requirements.json` | VERIFY | Phase 08 artifact validation paths unchanged (code-review-report.md) |
| `src/claude/hooks/gate-blocker.cjs` | VERIFY | Gate validation must accept merged review findings |

#### FR-007: Configuration and Overrides

| File | Change Type | Impact |
|------|------------|--------|
| `src/claude/hooks/lib/common.cjs` | MODIFY | Add `loadFanOutConfig()` utility function, or extend `loadWorkflowDefinitions()` |
| `src/claude/commands/isdlc.md` | MODIFY | Add --no-fan-out flag parsing in workflow init section |
| `src/claude/agents/00-sdlc-orchestrator.md` | MODIFY | Pass fan_out config as workflow modifier to Phase 16 and Phase 08 |

### Outward Dependencies (What Depends on Changed Files)

| Changed File | Dependents | Risk |
|-------------|------------|------|
| `16-quality-loop-engineer.md` | Phase-loop controller (isdlc.md), gate-blocker.cjs, iteration-corridor.cjs, test-quality-loop.test.cjs | HIGH -- many consumers depend on Phase 16 output format |
| `07-qa-engineer.md` | Phase-loop controller (isdlc.md), gate-blocker.cjs, iteration-requirements.json Phase 08 section | MEDIUM -- Phase 08 output format (code-review-report.md) consumed by gate |
| `common.cjs` | All 28 hooks via require(), all dispatcher hooks | LOW -- additive change (new function), no existing API modified |
| `isdlc.md` | All workflow executions, all phase delegations | MEDIUM -- flag parsing change is additive but touches critical path |
| `iteration-requirements.json` | gate-blocker.cjs, iteration-corridor.cjs, constitutional-iteration-validator.cjs | LOW -- schema additions are backward-compatible |
| `skills-manifest.json` | skill-validator.cjs, log-skill-usage.cjs | LOW -- additive (new skill registration) |

### Inward Dependencies (What Changed Files Depend On)

| Changed File | Dependencies | Risk |
|-------------|-------------|------|
| `16-quality-loop-engineer.md` | Task tool (Claude Code), state.json schema, gate-blocker validation | LOW -- Task tool is stable |
| `07-qa-engineer.md` | Task tool (Claude Code), state.json schema, gate-blocker validation | LOW -- Task tool is stable |
| `common.cjs` | fs, path, state.json file format | LOW -- no new external deps |
| `isdlc.md` | state.json, workflows.json (if it exists), CLI arg parser | LOW -- additive flag |

### Change Propagation Paths

```
Fan-Out Engine (new shared protocol)
  |
  +-- 16-quality-loop-engineer.md (Track A fan-out)
  |     |
  |     +-- quality-report.md (output format: add Parallelism Summary)
  |     +-- state.json test_results (add fan_out metadata)
  |     +-- gate-blocker.cjs (must validate merged results)
  |     +-- test-quality-loop.test.cjs (must test fan-out paths)
  |
  +-- 07-qa-engineer.md (Code Review fan-out)
  |     |
  |     +-- code-review-report.md (output format: add cross-cutting concerns)
  |     +-- gate-blocker.cjs (must validate merged findings)
  |
  +-- isdlc.md (--no-fan-out flag)
  |     |
  |     +-- state.json active_workflow.flags.no_fan_out
  |     +-- 00-sdlc-orchestrator.md (pass flag to agent modifiers)
  |
  +-- common.cjs (loadFanOutConfig utility)
  |     |
  |     +-- 16-quality-loop-engineer.md (reads config)
  |     +-- 07-qa-engineer.md (reads config)
  |
  +-- iteration-requirements.json (fan_out section)
  +-- skills-manifest.json (new skill IDs)
```

### Complete Affected File List

| # | File Path | Change Type | Reason |
|---|-----------|-------------|--------|
| 1 | `src/claude/agents/16-quality-loop-engineer.md` | MODIFY (major) | FR-005: Track A fan-out orchestration |
| 2 | `src/claude/agents/07-qa-engineer.md` | MODIFY (major) | FR-006: Code review fan-out |
| 3 | `src/claude/hooks/lib/common.cjs` | MODIFY (minor) | FR-007: Add loadFanOutConfig() |
| 4 | `src/claude/commands/isdlc.md` | MODIFY (minor) | FR-007: --no-fan-out flag parsing |
| 5 | `src/claude/agents/00-sdlc-orchestrator.md` | MODIFY (minor) | FR-007: Pass fan_out modifiers |
| 6 | `src/claude/hooks/config/iteration-requirements.json` | MODIFY (minor) | FR-005/006: Optional fan_out validation fields |
| 7 | `src/claude/hooks/config/skills-manifest.json` | MODIFY (minor) | FR-001: Register new fan-out skills |
| 8 | `src/claude/hooks/gate-blocker.cjs` | VERIFY | FR-005/006: Merged output must pass gate validation |
| 9 | `src/claude/hooks/tests/test-quality-loop.test.cjs` | MODIFY | Test fan-out code paths |
| 10 | `src/claude/hooks/tests/test-gate-blocker-extended.test.cjs` | MODIFY | Test gate validation with merged output |
| 11 | `src/claude/skills/quality-loop/fan-out-engine/SKILL.md` | NEW | FR-001: Fan-out engine skill definition |
| 12 | `src/claude/skills/quality-loop/fan-out-chunk-splitter/SKILL.md` | NEW | FR-002: Chunk splitter skill |
| 13 | `src/claude/skills/quality-loop/fan-out-result-merger/SKILL.md` | NEW | FR-004: Result merger skill |
| 14 | `.isdlc/state.json` | SCHEMA CHANGE | FR-007: fan_out configuration section |
| 15 | `src/claude/agents/05-implementation-reviewer.md` | VERIFY | Reviewer checks fan-out code for quality |
| 16 | `src/claude/hooks/log-skill-usage.cjs` | VERIFY | NFR-004: Must log fan-out skill usage correctly |
| 17 | `src/claude/hooks/skill-validator.cjs` | VERIFY | New skill IDs must pass validation |
| 18 | `src/claude/hooks/iteration-corridor.cjs` | VERIFY | Fan-out iterations within Track A must not trip corridor |
| 19 | `src/claude/hooks/blast-radius-validator.cjs` | VERIFY | New files must be within blast radius |
| 20 | `docs/requirements/REQ-0017-fan-out-fan-in-parallelism/` | EXISTS | Requirement artifacts (already created) |
| 21 | `docs/quality/quality-report.md` | FORMAT CHANGE | Parallelism Summary section added |
| 22 | `docs/quality/code-review-report.md` | FORMAT CHANGE | Cross-cutting concerns section added |

---

## Entry Points (M2)

### Existing Entry Points Relevant to Each Acceptance Criterion

#### AC-005-01 through AC-005-07 (Phase 16 Fan-Out)

**Primary Entry Point**: `src/claude/agents/16-quality-loop-engineer.md`

The Phase 16 agent is invoked by the phase-loop controller in `isdlc.md` (STEP 3d) via a Task tool call with `subagent_type: quality-loop-engineer`. The entry chain is:

```
User confirms workflow continue
  -> isdlc.md Phase Loop Controller (STEP 3)
    -> STEP 3d: Task tool -> quality-loop-engineer
      -> Agent reads state.json for implementation_loop_state
      -> Agent detects FINAL SWEEP vs FULL SCOPE mode
      -> Agent spawns Track A + Track B as two parallel Task calls
        -> [FAN-OUT INSERTION POINT] Track A internally splits tests
        -> Track A sub-agents run test chunks in parallel
        -> Track A consolidates chunk results
      -> Agent merges Track A + Track B results
      -> Agent runs iteration loop if failures
      -> Agent validates GATE-16
```

**Fan-Out Insertion Point**: Inside the Track A Task call, AFTER test suite size is determined and BEFORE test execution begins. The Track A sub-agent currently runs tests as a single unit. With fan-out, it becomes a mini-orchestrator that:
1. Counts tests (T)
2. If T >= 250: splits into N = min(ceil(T/250), 8) chunks
3. Spawns N parallel Task calls (one per chunk)
4. Merges N results into single Track A result
5. Returns merged result to the Quality Loop agent

#### AC-006-01 through AC-006-07 (Phase 08 Fan-Out)

**Primary Entry Point**: `src/claude/agents/07-qa-engineer.md`

The Phase 08 agent is invoked by the phase-loop controller via Task tool with `subagent_type: qa-engineer`. The entry chain is:

```
Phase 16 completes -> Phase Loop increments to Phase 08
  -> isdlc.md Phase Loop Controller (STEP 3d)
    -> Task tool -> qa-engineer
      -> Agent reads state.json for implementation_loop_state
      -> Agent detects HUMAN REVIEW ONLY vs FULL SCOPE mode
      -> Agent gathers changed files (git diff)
        -> [FAN-OUT INSERTION POINT] Split files by directory
        -> N parallel reviewer Task calls
        -> Merge findings, deduplicate, priority-sort
      -> Agent produces code-review-report.md
      -> Agent validates GATE-07 (Note: Phase 08 maps to GATE-07 in current config)
```

**Fan-Out Insertion Point**: After the changeset is determined (via git diff against main) and before the code review checklist is applied. Currently the agent reviews all files sequentially. With fan-out, it:
1. Counts changed files (F)
2. If F >= 5: groups by directory, then splits into N = min(ceil(F/7), 8) chunks
3. Spawns N parallel reviewer Task calls
4. Merges findings, deduplicates, priority-sorts
5. Produces unified code-review-report.md

#### AC-001-01 through AC-001-05 (Shared Engine)

**New Entry Points to Create**:

The fan-out engine does not need a separate executable entry point since iSDLC agents are markdown-based. Instead, the "engine" is a protocol defined as:

1. **Chunk Splitter Protocol** -- A section in the agent markdown defining input/output format:
   - Input: `{ items: string[], strategy: "round-robin" | "group-by-directory", maxChunks: 8, minItemsPerChunk: number }`
   - Output: `{ chunks: [{ index: number, items: string[], weight: number }], metadata: { totalItems, chunkCount } }`

2. **Spawner Protocol** -- A section defining how to emit N parallel Task calls:
   - Input: chunk definitions + agent prompt template
   - Output: N Task tool calls in single response

3. **Merger Protocol** -- A section defining how to combine results:
   - Input: N result objects (any order)
   - Output: unified result with dedup, priority sort, summary

These protocols are referenced by inclusion in Phase 16 and Phase 08 agents.

#### AC-007-01 through AC-007-04 (Configuration)

**Entry Points for Configuration**:

| Config Location | Entry Point | When Read |
|----------------|-------------|-----------|
| `.isdlc/state.json` -> `fan_out` | Loaded by Phase 16/08 agents at start | Phase start |
| `workflows.json` -> `agent_modifiers` | Loaded by isdlc.md at delegation (STEP 3d) | Pre-delegation |
| `--no-fan-out` CLI flag | Parsed by isdlc.md at workflow init | Workflow start |

The configuration read chain:
```
Workflow init (isdlc.md)
  -> Parse --no-fan-out flag
  -> Store in state.json: active_workflow.flags.no_fan_out = true
  -> STEP 3d delegation: include WORKFLOW MODIFIERS with fan_out config
  -> Phase agent reads modifiers + state.json fan_out section
  -> If no_fan_out: skip splitting, use single-agent path
  -> If fan_out config present: override default thresholds
```

### New Entry Points That Need to Be Created

| # | Entry Point | Type | Location | Purpose |
|---|-------------|------|----------|---------|
| 1 | Fan-Out Engine Skill | Skill definition | `src/claude/skills/quality-loop/fan-out-engine/SKILL.md` | Define the reusable protocol |
| 2 | Chunk Splitter Skill | Skill definition | `src/claude/skills/quality-loop/fan-out-chunk-splitter/SKILL.md` | Chunk splitting protocol |
| 3 | Result Merger Skill | Skill definition | `src/claude/skills/quality-loop/fan-out-result-merger/SKILL.md` | Result merging protocol |
| 4 | state.json fan_out section | Config schema | `.isdlc/state.json` | Runtime configuration |
| 5 | --no-fan-out flag handler | CLI flag | `src/claude/commands/isdlc.md` | Disable fan-out per workflow |

### Implementation Chain from Entry to Data Layer

```
CLI Layer:        isdlc.md (--no-fan-out parsing, flag storage)
                     |
Config Layer:     state.json (fan_out config) + workflows.json (agent_modifiers)
                     |
Orchestration:    isdlc.md Phase Loop Controller (passes modifiers to agent)
                     |
Agent Layer:      16-quality-loop-engineer.md / 07-qa-engineer.md
                     |
Protocol Layer:   Fan-out engine protocol (chunk split -> spawn -> merge)
                     |
Execution Layer:  N parallel Task calls (Claude Code Task tool)
                     |
Result Layer:     Merged results -> quality-report.md / code-review-report.md
                     |
Validation Layer: gate-blocker.cjs (validates merged output format)
```

### Recommended Implementation Order

1. **Phase 1: Engine Protocol** (FR-001, FR-002, FR-004) -- Define the shared fan-out/fan-in protocol as skills and agent-embeddable markdown sections. This is foundational.

2. **Phase 2: Phase 16 Consumer** (FR-005) -- Integrate fan-out into the Quality Loop's Track A. This is the primary use case and has the clearest test path (test count thresholds).

3. **Phase 3: Phase 08 Consumer** (FR-006) -- Integrate fan-out into Code Review. This follows the same pattern as Phase 16 but with the group-by-directory strategy.

4. **Phase 4: Configuration** (FR-007) -- Add state.json schema, workflows.json modifiers, and --no-fan-out flag. This is last because the consumers need to exist first to validate config reads.

5. **Phase 5: Observability & Tests** (NFR-004) -- Add skill_usage_log entries, Parallelism Summary sections, and test coverage.

---

## Risk Assessment (M3)

### Test Coverage Gaps in Affected Modules

| File | Current Coverage | Gap Description | Risk |
|------|-----------------|-----------------|------|
| `src/claude/agents/16-quality-loop-engineer.md` | Indirect (test-quality-loop.test.cjs tests gate-blocker + iteration corridor behavior for Phase 16) | No tests for Track A internal parallelism; fan-out adds a new code path that is completely untested | HIGH |
| `src/claude/agents/07-qa-engineer.md` | No dedicated test file | Phase 08 agent has no hook-level tests; fan-out adds complexity to an untested component | HIGH |
| `src/claude/hooks/lib/common.cjs` | Well-tested (common.test.cjs with 61 tests) | New loadFanOutConfig() function needs unit tests; existing functions unchanged | LOW |
| `src/claude/commands/isdlc.md` | No automated tests (markdown command) | --no-fan-out flag parsing is untestable at the hook level; relies on agent behavior | MEDIUM |
| `src/claude/hooks/gate-blocker.cjs` | Well-tested (26 extended tests) | Merged output format acceptance needs new test cases | LOW |
| `src/claude/hooks/config/iteration-requirements.json` | Schema tested by skill-validator | New fields are additive; backward-compatible | LOW |
| `src/claude/hooks/config/skills-manifest.json` | Tested by skill-validator.test.cjs | New skill IDs need registration; existing tests cover the validation path | LOW |

### Complexity Hotspots

| File | Complexity | Fan-Out Impact | Risk |
|------|-----------|----------------|------|
| `16-quality-loop-engineer.md` | HIGH (362 lines, dual-track parallelism, scope detection, iteration loop, framework detection table, grouping strategy) | MAJOR -- adding fan-out within Track A creates a 3-level nesting: Phase Loop -> Track A/B -> Fan-Out chunks. Agent markdown is already at complexity limit. | HIGH |
| `07-qa-engineer.md` | MEDIUM (283 lines, scope detection, review checklist, constitutional validation) | SIGNIFICANT -- adding parallel reviewer agents creates 2-level nesting: Phase Loop -> Fan-Out chunks. | MEDIUM |
| `gate-blocker.cjs` | HIGH (complex gate validation with test iteration, constitutional validation, artifact validation, phase delegation detection) | LOW -- fan-out is transparent to gate validation if merged output format matches existing schema | LOW |
| `common.cjs` | HIGH (2828 lines, 40+ exported functions) | LOW -- additive function, no modifications to existing exports | LOW |
| `isdlc.md` | HIGH (1100+ lines, phase loop controller, workflow init, sizing, supervised mode) | LOW -- additive flag parsing | LOW |

### Technical Debt Markers

| File | Debt Item | Fan-Out Interaction |
|------|-----------|---------------------|
| `16-quality-loop-engineer.md` | Grouping Strategy section already describes A1/A2/A3/B1/B2 sub-groups but implementation is RECOMMENDED (MAY/SHOULD language), not enforced. Fan-out would formalize this. | POSITIVE -- fan-out replaces informal grouping guidance with deterministic splitting |
| `07-qa-engineer.md` | Phase numbering mismatch: agent file is `07-qa-engineer.md` but phase key in workflow is `08-code-review`. The phase-agent mapping table in isdlc.md maps `08-code-review` -> `qa-engineer`. | NEUTRAL -- existing debt, not affected by fan-out |
| `common.cjs` | No `workflows.json` file exists on disk (both config paths return null from loadWorkflowDefinitions). Agent modifiers are currently never loaded. | RISK -- FR-007 depends on workflows.json for per-workflow fan-out overrides, but this file does not exist. Either create it or use state.json exclusively. |
| `isdlc.md` | Flag parsing for existing flags (e.g., -light) is embedded in sizing logic, not centralized. Adding --no-fan-out follows the same pattern. | NEUTRAL -- consistent with existing approach |

### Risk Recommendations per Acceptance Criterion

| AC | Risk Level | Recommendation |
|----|-----------|----------------|
| AC-001-01 to AC-001-05 (Engine) | LOW | Define clear JSON contracts; protocol-only, no executable code |
| AC-002-01 to AC-002-05 (Splitting) | LOW | Deterministic algorithm; easy to unit test with edge cases |
| AC-003-01 to AC-003-05 (Spawner) | MEDIUM | Task tool parallel calls are proven (dual-track works), but N > 2 is untested in this codebase |
| AC-004-01 to AC-004-05 (Merger) | MEDIUM | Deduplication logic (AC-004-03) is the most complex new algorithm; needs thorough edge case testing |
| AC-005-01 to AC-005-07 (Phase 16) | HIGH | Track A is already the most complex code path; adding fan-out nesting increases cognitive load. Test with edge cases: exactly 250 tests, 251 tests, 2000 tests, 0 tests |
| AC-006-01 to AC-006-07 (Phase 08) | MEDIUM | Simpler than Phase 16 (no dual-track nesting). Cross-cutting concerns detection (AC-006-07) is a judgment call, hard to validate deterministically |
| AC-007-01 to AC-007-04 (Config) | LOW-MEDIUM | workflows.json does not exist; must decide: create it or use state.json only. Config-not-applied-mid-workflow (AC-007-04) needs testing |

### High-Risk Integration Points

1. **Phase 16 Track A Fan-Out + Existing Grouping Strategy**: The current agent describes A1/A2/A3 sub-groups. Fan-out would replace this with N chunks where N is test-count-based. These two parallelism models must be reconciled -- the fan-out engine should REPLACE the existing grouping strategy for Track A, not layer on top of it.

2. **Gate Validation with Merged Output**: Gate-blocker reads Phase 16 test_results from state.json. The merged output must populate the same schema fields (all_tests_passing, lint_passing, coverage, etc.). If the merge changes field names or nesting, gate validation breaks.

3. **Phase 08 Output Format Compatibility**: Phase 08 produces `docs/reviews/{artifact_folder}/review-summary.md` (per iteration-requirements.json artifact_validation). Fan-out must produce this same artifact in the same format.

4. **Missing workflows.json**: FR-007 specifies workflows.json agent_modifiers for per-workflow overrides. This file does not exist. Either create it as part of this feature, or scope FR-007 to state.json-only config (reducing scope).

### Recommended Test Additions BEFORE Implementation

| Test | Target File | Purpose |
|------|-------------|---------|
| Test fan-out skip for small test suites | test-quality-loop.test.cjs | Verify < 250 tests uses single-agent path |
| Test fan-out activation for large test suites | test-quality-loop.test.cjs | Verify >= 250 tests triggers fan-out |
| Test result merger with partial failures | NEW test file | Verify N-1 results collected when 1 fails |
| Test deduplication logic | NEW test file | Verify same-file-same-line findings deduplicated |
| Test gate validation with merged output | test-gate-blocker-extended.test.cjs | Verify gate-blocker accepts merged format |
| Test --no-fan-out flag | NEW or existing test | Verify flag disables fan-out |
| Test configuration precedence | NEW test file | Verify state.json < workflows.json < flag |

---

## Implementation Recommendations

Based on the impact analysis:

1. **Suggested Order**:
   - Step 1: Define fan-out engine protocol (skills + shared markdown sections)
   - Step 2: Implement Phase 16 Track A fan-out (primary consumer, most valuable)
   - Step 3: Implement Phase 08 Code Review fan-out (second consumer)
   - Step 4: Add configuration and overrides (state.json fan_out section, --no-fan-out flag)
   - Step 5: Add observability logging and Parallelism Summary sections

2. **High-Risk Areas** (add tests first):
   - Phase 16 Quality Loop agent -- the most complex file being modified. Write characterization tests for the existing Track A behavior BEFORE adding fan-out
   - Gate-blocker validation -- add test cases for merged output format BEFORE changing the agent
   - Result merger deduplication -- write the dedup algorithm tests BEFORE implementing

3. **Dependencies to Resolve**:
   - **workflows.json missing**: Decide whether to create this file for FR-007 or scope overrides to state.json only. Recommendation: create a minimal workflows.json with fan_out agent_modifiers for feature and fix workflows.
   - **Phase numbering reconciliation**: Phase 08 maps to qa-engineer.md (file 07-*). Confirm this is intentional before proceeding.
   - **Grouping strategy reconciliation**: Fan-out replaces the existing A1/A2/A3 grouping in Track A. The architecture phase must define how these coexist or whether fan-out fully supersedes the existing grouping.

4. **Architecture Decision Required**:
   - The fan-out engine is described as a "reusable module" (AC-001-04) but iSDLC modules are markdown agents, not code. The architecture phase must decide: (a) embed the protocol in each consumer agent (simpler, some duplication), or (b) create a shared "fan-out-engine.md" included/referenced by both consumers (DRYer, more complex inclusion mechanism).

---

## Impact Analysis Metadata

```json
{
  "analysis_completed_at": "2026-02-15T17:30:00Z",
  "sub_agents": ["M1-impact-analyzer", "M2-entry-point-finder", "M3-risk-assessor"],
  "requirements_document": "docs/requirements/REQ-0017-fan-out-fan-in-parallelism/requirements-spec.md",
  "quick_scan_used": null,
  "scope_change_from_original": "expanded",
  "requirements_keywords": ["fan-out", "fan-in", "chunk-splitter", "round-robin", "group-by-directory", "parallel", "Task-spawner", "result-merger", "deduplication", "partial-failure", "observability", "thresholds", "configuration"],
  "functional_requirements_count": 7,
  "acceptance_criteria_count": 33,
  "user_stories_count": 7,
  "nfr_count": 4,
  "total_affected_files": 22,
  "files_modified": 10,
  "files_new": 3,
  "files_verify": 9,
  "blast_radius": "medium",
  "risk_level": "medium"
}
```
