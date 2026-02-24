# Impact Analysis: Multi-agent Test Strategy Team

**Generated**: 2026-02-15T19:30:00Z
**Feature**: Multi-agent Test Strategy Team -- Creator/Critic/Refiner debate loop for Phase 05 test strategy
**Based On**: Phase 01 Requirements (finalized -- REQ-0016 requirements-spec.md)
**Phase**: 02-impact-analysis

---

## Scope Comparison

| Aspect | Original Description | Clarified (Phase 01) |
|--------|---------------------|----------------------|
| Description | Add Test Strategy Critic and Test Strategy Refiner agents that collaborate with the existing test-design-engineer via propose-critique-refine cycles | Same -- 7 functional requirements, 4 NFRs, 4 constraints covering new agents, orchestrator routing, Creator awareness, skills manifest, and tests |
| Keywords | critic, refiner, debate, test strategy, Phase 05 | + TC-01..TC-08 mandatory checks, BLOCKING/WARNING, convergence, test pyramid, negative tests, flaky test risk, orphan tests |
| Estimated Files | ~6 files (2 new agents, 3 modified, 1 test) | 8-10 files (2 new agents, 4 modified, 1-2 new tests) |
| Scope Change | - | NONE (requirements match original description) |

---

## Executive Summary

This feature adds the fourth debate team to the iSDLC framework, extending the established Creator/Critic/Refiner pattern from Phases 01, 03, and 04 to Phase 05 (Test Strategy & Design). The blast radius is **MEDIUM**: 2 new agent files are created, 4 existing files are modified (orchestrator, test-design-engineer, isdlc.md command, skills manifest), and 1-2 new test files are added. The risk level is **LOW** because the pattern is well-established across 3 prior debate teams, and the changes are additive (no breaking modifications to existing behavior). The key risk areas are: (1) ensuring the orchestrator DEBATE_ROUTING table extension is syntactically correct and the lookup logic continues to work, (2) the test-design-engineer Creator awareness modification preserves backward-compatible single-agent mode, and (3) the skills manifest update correctly registers agents without creating duplicate skill IDs or changing total_skills count.

**Blast Radius**: MEDIUM (8-10 files across 5 modules)
**Risk Level**: LOW
**Affected Files**: 8-10 files (2 new, 4-6 modified)
**Affected Modules**: agents/, commands/, hooks/config/, hooks/tests/

---

## Impact Analysis (M1)

### Directly Affected Files

#### 1. NEW: `src/claude/agents/04-test-strategy-critic.md`
- **Requirement**: FR-01 (AC-01.1 through AC-01.5), FR-02 (AC-02.1 through AC-02.8)
- **Type**: CREATE
- **Dependencies (inward)**: None (new file)
- **Dependencies (outward)**: Referenced by orchestrator DEBATE_ROUTING table
- **Pattern source**: `src/claude/agents/03-design-critic.md` (most recent critic agent)
- **Estimated size**: ~300-400 lines (based on design-critic precedent)

#### 2. NEW: `src/claude/agents/04-test-strategy-refiner.md`
- **Requirement**: FR-03 (AC-03.1 through AC-03.5)
- **Type**: CREATE
- **Dependencies (inward)**: None (new file)
- **Dependencies (outward)**: Referenced by orchestrator DEBATE_ROUTING table
- **Pattern source**: `src/claude/agents/03-design-refiner.md` (most recent refiner agent)
- **Estimated size**: ~200-300 lines (based on design-refiner precedent)

#### 3. MODIFY: `src/claude/agents/00-sdlc-orchestrator.md`
- **Requirement**: FR-04 (AC-04.1 through AC-04.4)
- **Type**: MODIFY (additive -- new row in DEBATE_ROUTING table)
- **Lines affected**: ~3-5 lines (one new table row + documentation update)
- **Location**: Line ~1035 (DEBATE_ROUTING table section)
- **Risk**: LOW -- adding a row to a markdown table; existing rows unchanged
- **Change propagation**: The orchestrator's lookup logic (`IF current_phase IN DEBATE_ROUTING`) already handles arbitrary table entries. No code changes needed to the lookup logic itself.
- **Outward dependencies**: All debate-enabled workflow runs pass through this table

#### 4. MODIFY: `src/claude/agents/04-test-design-engineer.md`
- **Requirement**: FR-05 (AC-05.1 through AC-05.4)
- **Type**: MODIFY (additive -- new DEBATE_CONTEXT handling section)
- **Lines affected**: ~40-60 lines inserted (new section near top of agent)
- **Current state**: No DEBATE_CONTEXT awareness at all (confirmed by grep)
- **Pattern source**: `src/claude/agents/01-requirements-analyst.md` lines 28-98 (Mode Detection + Debate Mode Behavior sections)
- **Risk**: LOW-MEDIUM -- must preserve exact single-agent behavior when DEBATE_CONTEXT is absent (AC-05.3 is critical)
- **Outward dependencies**: Phase 05 output artifacts consumed by Phase 06 (implementation)

#### 5. MODIFY: `src/claude/commands/isdlc.md`
- **Requirement**: Implicit (documentation alignment)
- **Type**: MODIFY (update "Debate-enabled phases" documentation)
- **Lines affected**: 2-3 lines (line 276-279)
- **Current text**: "The debate loop currently supports Phase 01 (Requirements), Phase 03 (Architecture), and Phase 04 (Design)."
- **New text**: Add "Phase 05 (Test Strategy)" to the list
- **Risk**: TRIVIAL -- documentation-only change

#### 6. MODIFY: `src/claude/hooks/config/skills-manifest.json`
- **Requirement**: FR-06 (AC-06.1 through AC-06.4)
- **Type**: MODIFY (add 2 agent entries to agents section)
- **Lines affected**: ~20 lines inserted (2 agent blocks)
- **Current agents section**: Lines 302-590 (20 agents registered)
- **Key constraint**: C-02 -- No new skill IDs. The critic/refiner agents share existing TEST-* skills from test-design-engineer
- **Critic agent skills (from AC-06.1)**: TEST-002, TEST-004, TEST-005
- **Refiner agent skills (from AC-06.2)**: TEST-001, TEST-002, TEST-003, TEST-004, TEST-005
- **Risk**: LOW -- additive agent entries; total_skills must remain 242; skill_owners map stays unchanged (primary_owner remains test-design-engineer)
- **NOTE**: Existing critic/refiner agents (Phase 01, 03, 04) are NOT in the skills manifest. This feature explicitly requires adding the Phase 05 critic/refiner (AC-06.1, AC-06.2). This creates a precedent divergence. Implementation should decide whether to add only Phase 05 or retroactively add all 6 existing critic/refiner agents for consistency.

#### 7. NEW: `src/claude/hooks/tests/test-strategy-debate-team.test.cjs`
- **Requirement**: FR-07 (AC-07.1 through AC-07.6)
- **Type**: CREATE
- **Estimated tests**: 25-35 test cases covering:
  - Critic agent file validation (frontmatter, 8 mandatory checks, output format, severity classification)
  - Refiner agent file validation (frontmatter, fix strategies, change log format, escalation)
  - Orchestrator DEBATE_ROUTING update (Phase 05 row, agent mapping, artifact list, critical artifact)
  - Creator awareness update (DEBATE_CONTEXT detection, round labeling, single-agent fallback)
  - Skills manifest update (both agents listed, skill assignments, total_skills unchanged, no duplicates)
- **Pattern source**: `src/claude/hooks/tests/tasks-format-validation.test.cjs` (CJS test pattern)
- **Framework**: `node:test` + `node:assert/strict` (CJS)

#### 8. POTENTIAL MODIFY: `.claude/agents/` (runtime copies)
- **Note**: Per MEMORY.md, changes to `src/claude/agents/` MUST be synced to `.claude/agents/` (live runtime copy, gitignored)
- **Files**: 04-test-strategy-critic.md (new), 04-test-strategy-refiner.md (new), 04-test-design-engineer.md (modified), 00-sdlc-orchestrator.md (modified)

### Change Propagation Paths

```
04-test-strategy-critic.md (NEW)
  --> Referenced by 00-sdlc-orchestrator.md DEBATE_ROUTING
  --> Invoked by orchestrator during debate mode for Phase 05
  --> Reads Phase 05 artifacts: test-strategy.md, test-cases/, traceability-matrix.csv, test-data-plan.md
  --> Produces round-{N}-critique.md (consumed by refiner)

04-test-strategy-refiner.md (NEW)
  --> Referenced by 00-sdlc-orchestrator.md DEBATE_ROUTING
  --> Invoked by orchestrator during debate mode for Phase 05
  --> Reads round-{N}-critique.md + current Phase 05 artifacts
  --> Produces updated Phase 05 artifacts

00-sdlc-orchestrator.md (MODIFY)
  --> DEBATE_ROUTING table gains 1 row
  --> Existing lookup logic handles it (no code change needed)
  --> Phase 05 delegation now routes to debate team when debate_mode=true

04-test-design-engineer.md (MODIFY)
  --> Gains DEBATE_CONTEXT mode detection
  --> Single-agent mode preserved (no DEBATE_CONTEXT = same as before)
  --> Creator mode: labels artifacts as "Round N Draft", produces review-optimized output

isdlc.md (MODIFY)
  --> Documentation update only (no behavioral change)

skills-manifest.json (MODIFY)
  --> 2 new agent entries (test-strategy-critic, test-strategy-refiner)
  --> Shared TEST-* skills (no new IDs, no total_skills change)
  --> skill_owners map unchanged
```

### Modules NOT Affected

- **Hooks**: No hook logic changes needed. The debate loop is orchestrated via the DEBATE_ROUTING table (markdown-based routing), not hook code.
- **CLI (bin/, lib/)**: No CLI changes needed. The `--debate` / `--no-debate` flags already exist and apply to all debate-enabled phases.
- **Other agents**: No changes to existing debate teams (Phase 01, 03, 04 agents are untouched).
- **Discovery agents**: Unaffected.
- **CI/CD workflows**: No changes needed.

---

## Entry Points (M2)

### Existing Entry Points Affected

#### 1. Orchestrator Debate Loop Entry (Primary)
- **File**: `src/claude/agents/00-sdlc-orchestrator.md`
- **Section**: 7.5 DEBATE LOOP ORCHESTRATION (line ~1018)
- **How**: When `current_phase == "05-test-strategy"` and `debate_mode == true`, the orchestrator now finds a matching row in DEBATE_ROUTING and invokes the Creator -> Critic -> Refiner loop
- **Current behavior**: Phase 05 falls through to single-agent delegation (NOT in DEBATE_ROUTING)
- **New behavior**: Phase 05 matches DEBATE_ROUTING and enters debate loop

#### 2. Test-Design-Engineer Invocation
- **File**: `src/claude/agents/04-test-design-engineer.md`
- **How**: The orchestrator delegates to this agent via Task tool. When DEBATE_CONTEXT is in the prompt, the agent switches to Creator mode.
- **Current behavior**: Always runs in single-agent mode (no DEBATE_CONTEXT handling)
- **New behavior**: Detects DEBATE_CONTEXT and adapts output for debate review

#### 3. Skills Manifest Validation
- **File**: `src/claude/hooks/config/skills-manifest.json`
- **How**: The `skill-validator` hook reads this manifest at runtime. Adding new agent entries is consumed automatically.
- **Current behavior**: 20 agents in registry
- **New behavior**: 22 agents in registry (test-strategy-critic + test-strategy-refiner added)

### New Entry Points to Create

#### 4. Test Strategy Critic Agent
- **File**: `src/claude/agents/04-test-strategy-critic.md`
- **Invoked by**: Orchestrator (Task tool delegation during debate Step 4)
- **Input**: DEBATE_CONTEXT + Phase 05 artifacts
- **Output**: `round-{N}-critique.md` with BLOCKING/WARNING findings

#### 5. Test Strategy Refiner Agent
- **File**: `src/claude/agents/04-test-strategy-refiner.md`
- **Invoked by**: Orchestrator (Task tool delegation during debate Step 4)
- **Input**: DEBATE_CONTEXT + Phase 05 artifacts + `round-{N}-critique.md`
- **Output**: Updated Phase 05 artifacts with findings addressed

### Implementation Chain

```
1. isdlc.md receives feature request
2. Orchestrator starts workflow, reaches Phase 05
3. Orchestrator checks: Is "05-test-strategy" in DEBATE_ROUTING? --> YES (new row)
4. Orchestrator checks: debate_mode == true? --> YES (resolved from flags/sizing)
5. Orchestrator delegates to Creator (04-test-design-engineer.md) with DEBATE_CONTEXT
6. Creator produces "Round 1 Draft" artifacts
7. Orchestrator delegates to Critic (04-test-strategy-critic.md)
8. Critic applies TC-01..TC-08, produces round-1-critique.md
9. IF BLOCKING findings > 0: Orchestrator delegates to Refiner (04-test-strategy-refiner.md)
10. Refiner addresses findings, produces updated artifacts
11. Loop back to step 7 (max 3 rounds)
12. On convergence: Orchestrator writes debate-summary.md and proceeds to GATE-05
```

### Recommended Implementation Order

1. **Create critic agent** (`04-test-strategy-critic.md`) -- standalone, no dependencies
2. **Create refiner agent** (`04-test-strategy-refiner.md`) -- standalone, no dependencies
3. **Modify test-design-engineer** (`04-test-design-engineer.md`) -- add DEBATE_CONTEXT awareness
4. **Modify orchestrator** (`00-sdlc-orchestrator.md`) -- add DEBATE_ROUTING row (ties everything together)
5. **Modify isdlc.md** -- update documentation text
6. **Modify skills manifest** (`skills-manifest.json`) -- add agent entries
7. **Create tests** (`test-strategy-debate-team.test.cjs`) -- validate all changes
8. **Sync to .claude/** -- copy modified/new agent files to runtime directory

---

## Risk Assessment (M3)

### Test Coverage Analysis

| File | Current Coverage | Status |
|------|-----------------|--------|
| `00-sdlc-orchestrator.md` | No direct unit tests; validated by `phase-loop-controller.test.cjs` for general flow | LOW -- but DEBATE_ROUTING is markdown-parsed, not code |
| `04-test-design-engineer.md` | No direct unit tests | LOW -- agent files are markdown-based, not executable code |
| `skills-manifest.json` | Validated by `test-skill-validator.test.cjs` (13 tests) | MEDIUM -- existing tests validate agent registration format |
| `isdlc.md` | Validated by `prompt-format.test.js` (partially) | MEDIUM -- TC-13-01 checks agent count (already failing) |
| New test file | N/A (will be created) | To be created as part of FR-07 |

### Pre-existing Test Failures (Baseline)

| Test | File | Issue | Impact on This Feature |
|------|------|-------|----------------------|
| TC-E09 | `lib/deep-discovery-consistency.test.js:115` | Expects "40 agents" in README | NONE -- known pre-existing, unrelated to debate teams |
| TC-13-01 | `lib/prompt-format.test.js:159` | Expects 48 agent files, found 57 | WILL WORSEN -- adding 2 new agent files increases count to 59 (was 57). This is already broken. |

**Test baseline**: 632 tests, 630 pass, 2 fail (pre-existing)

### Complexity Hotspots

| Area | Complexity | Risk |
|------|-----------|------|
| Orchestrator DEBATE_ROUTING table | LOW | Simple markdown table row addition. No parsing logic changes needed. |
| Critic's 8 mandatory checks (TC-01..TC-08) | MEDIUM | The 8 check definitions are the core deliverable. Must be exhaustive and correctly categorized as BLOCKING vs WARNING. |
| test-design-engineer Creator awareness | MEDIUM | Must correctly detect DEBATE_CONTEXT presence/absence. Must preserve exact single-agent behavior as fallback. Pattern exists in requirements-analyst. |
| Skills manifest agent registration | LOW | Additive JSON change. But note the precedent divergence: existing critic/refiner agents are NOT in the manifest. |
| New test file | MEDIUM | Must cover all 7 FRs with ~25-35 test cases. Must not regress existing tests. |

### Technical Debt Markers

1. **Agent count drift (TC-13-01)**: The test expects 48 agents but 57 exist. Adding 2 more makes it 59. This test has been broken for a while and should be fixed (update expected count or make it dynamic).

2. **Critic/Refiner manifest inconsistency**: Existing debate team agents (requirements-critic, requirements-refiner, architecture-critic, architecture-refiner, design-critic, design-refiner) are NOT in `skills-manifest.json`. The requirements for REQ-0016 explicitly require adding the new agents to the manifest (FR-06). This creates inconsistency: Phase 05 critic/refiner are registered but Phases 01/03/04 are not.

3. **Phase numbering inconsistency**: Agent files use `04-` prefix for Phase 05 agents (test-design-engineer is `04-test-design-engineer.md`). New agents will also use `04-` prefix. The mapping between file prefix and phase key is:
   - File prefix `04-` = Phase `05-test-strategy`
   - This is documented but could confuse new contributors.

### Risk Recommendations Per Acceptance Criterion

| AC Group | Risk | Recommendation |
|----------|------|----------------|
| AC-01.x (Critic agent) | LOW | Follow design-critic pattern exactly. All structural decisions are precedented. |
| AC-02.x (8 mandatory checks) | MEDIUM | These are domain-specific (test strategy). Validate that each check maps to a real defect category. Cross-reference with existing test infrastructure. |
| AC-03.x (Refiner agent) | LOW | Follow design-refiner pattern exactly. |
| AC-04.x (DEBATE_ROUTING) | LOW | Single row addition. Verify lookup logic handles 4 entries correctly (test with existing 3 + new). |
| AC-05.x (Creator awareness) | MEDIUM | Highest regression risk. Test both modes (with and without DEBATE_CONTEXT). Use requirements-analyst as pattern. |
| AC-06.x (Skills manifest) | LOW-MEDIUM | Note the precedent divergence. Decide on consistency approach during implementation. |
| AC-07.x (Tests) | MEDIUM | Must create comprehensive tests. Use `node:test` + `node:assert/strict` CJS pattern. Validate no regressions in test suite. |

### Risk Zones (Intersection of Low Coverage + Breaking Change Potential)

1. **Orchestrator DEBATE_ROUTING modification** + No direct unit tests for routing table = MONITOR. The routing is markdown-based (not code), so traditional unit testing does not apply. The new test file (FR-07 AC-07.3) will validate the routing entry.

2. **test-design-engineer Creator awareness** + No existing tests for this agent = MEDIUM RISK. The new test file (FR-07 AC-07.4) must validate both modes. Recommend: write the fallback/single-agent test case first, then add Creator mode test.

---

## Implementation Recommendations

Based on the impact analysis:

1. **Suggested Order**: Create new agents first (no dependencies), then modify existing files (orchestrator last since it ties everything together), then tests last (validate all changes). See Entry Points section for detailed order.

2. **High-Risk Areas**:
   - test-design-engineer DEBATE_CONTEXT modification -- write "single-agent fallback preserved" test FIRST before making changes
   - 8 mandatory checks (TC-01..TC-08) -- validate exhaustiveness against test strategy domain

3. **Dependencies to Resolve**:
   - Decide on skills manifest consistency: add only Phase 05 critic/refiner (per requirements) or retroactively add all 6 existing critic/refiner agents
   - TC-13-01 (agent count test) is already broken and will worsen -- consider updating expected count during implementation

4. **Pattern Sources for Implementation**:
   - Critic agent: `src/claude/agents/03-design-critic.md` (structure, frontmatter, check format)
   - Refiner agent: `src/claude/agents/03-design-refiner.md` (structure, frontmatter, fix strategy format)
   - Creator awareness: `src/claude/agents/01-requirements-analyst.md` lines 28-98 (DEBATE_CONTEXT detection pattern)
   - DEBATE_ROUTING row: `src/claude/agents/00-sdlc-orchestrator.md` lines 1031-1035 (existing table format)
   - Test file: `src/claude/hooks/tests/tasks-format-validation.test.cjs` (CJS test pattern with node:test)

---

## Impact Analysis Metadata

```json
{
  "analysis_completed_at": "2026-02-15T19:30:00Z",
  "sub_agents": ["M1-impact-analyzer", "M2-entry-point-finder", "M3-risk-assessor"],
  "requirements_document": "docs/requirements/REQ-0016-multi-agent-test-strategy-team/requirements-spec.md",
  "quick_scan_used": null,
  "scope_change_from_original": "none",
  "requirements_keywords": ["critic", "refiner", "debate", "test-strategy", "DEBATE_ROUTING", "TC-01..TC-08", "BLOCKING", "WARNING", "convergence", "test-pyramid", "negative-tests", "flaky-test", "orphan-tests"],
  "blast_radius": "medium",
  "risk_level": "low",
  "files_affected": {
    "new": [
      "src/claude/agents/04-test-strategy-critic.md",
      "src/claude/agents/04-test-strategy-refiner.md",
      "src/claude/hooks/tests/test-strategy-debate-team.test.cjs"
    ],
    "modified": [
      "src/claude/agents/00-sdlc-orchestrator.md",
      "src/claude/agents/04-test-design-engineer.md",
      "src/claude/commands/isdlc.md",
      "src/claude/hooks/config/skills-manifest.json"
    ],
    "sync_required": [
      ".claude/agents/04-test-strategy-critic.md",
      ".claude/agents/04-test-strategy-refiner.md",
      ".claude/agents/04-test-design-engineer.md",
      ".claude/agents/00-sdlc-orchestrator.md"
    ]
  },
  "test_baseline": {
    "total_tests": 632,
    "passing": 630,
    "failing": 2,
    "pre_existing_failures": ["TC-E09 (README agent count)", "TC-13-01 (agent file count)"]
  }
}
```
