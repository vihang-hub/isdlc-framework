# Quick Scan: Phase Handshake Audit — State Transitions and Artifact Passing (GH-55)

**Generated**: 2026-02-20T19:00:00Z
**Investigation**: Phase handshake audit — verify state transitions and artifact passing between phases
**GitHub Issue**: GH-55
**Scan Mode**: ANALYSIS (no state changes, no branches)

---

## Executive Summary

Phase handshake mechanism is distributed across 28 hook files, 1 phase-loop controller hook, 1 orchestrator agent, and the isdlc.md Phase-Loop Controller (STEP 3c-prime, 3d, 3e). The mechanism coordinates phase-to-phase transitions via state.json updates, gate validation, and artifact passing.

**Estimated Scope**: LARGE (~65 files, ~54,961 lines of hook code)
**Confidence**: HIGH
**Risk Level**: MEDIUM (state transitions are critical path; existing bugs indicate subtle issues)

---

## Scope Estimate

| Metric | Value | Rationale |
|--------|-------|-----------|
| **Scope** | LARGE | 65+ files involved in phase handshake (hooks, agents, tests, orchestrator) |
| **File Count Estimate** | ~65 files | 28 hooks + 7 dispatchers + 30 tests + 1 orchestrator + commands + agents |
| **Blast Radius** | CRITICAL-PATH | Phase transitions affect all workflows; bugs block entire pipeline |
| **Confidence** | HIGH | 3 completed bugs (BUG-0005, BUG-0006, BUG-0013) provide detailed traceability |
| **Complexity** | MEDIUM-HIGH | Multiple interdependent systems (state reads, phase transitions, gates, artifact passing) |

---

## Phase Handshake Architecture

### 1. Core Components

#### A. Phase-Loop Controller (isdlc.md — STEP 3c-prime, 3d, 3e)

**File**: `src/claude/commands/isdlc.md`
**Role**: Orchestrates phase-to-phase state transitions
**Key Steps**:
- **STEP 3c-prime**: Read current phase state from `active_workflow.current_phase`
- **STEP 3d**: Delegate to next phase agent via Task tool
- **STEP 3e**: POST-PHASE STATE UPDATE
  - Update `active_workflow.current_phase` to next phase
  - Increment `active_workflow.current_phase_index`
  - Set next phase status to `"in_progress"` in `active_workflow.phase_status`
  - Update top-level `current_phase` and `active_agent` (backward compatibility)

**Status**: Implementation exists but has had state transition bugs (BUG-0005, BUG-0006, BUG-0013)

#### B. SDLC Orchestrator Agent

**File**: `src/claude/agents/00-sdlc-orchestrator.md`
**Role**: Coordinates workflow initialization, phase delegation, and finalization
**Key Responsibilities**:
- Initialize `active_workflow` with phases array and phase status tracking
- Delegate to phase agents (01-requirements through 13-sre)
- Invoke Phase-Loop Controller for state transitions
- Handle finalize mode (merge, cleanup)

**Modes**: `init-and-phase-01`, `single-phase`, `finalize`, full-workflow

#### C. Hook System (28 files, 7 dispatcher types)

**Total Lines**: 54,961 LOC (hooks + tests + libs)
**Primary Hooks** (state-aware):

| Hook | Type | Purpose | State Refs |
|------|------|---------|-----------|
| `phase-loop-controller.cjs` | PreToolUse[Task] | Blocks delegations without TaskUpdate to in_progress | 2 refs |
| `phase-sequence-guard.cjs` | PreToolUse[Task] | Enforces phase ordering (no out-of-order delegation) | 2 refs |
| `phase-transition-enforcer.cjs` | PreToolUse[Task] | Validates phase key consistency | 2 refs |
| `gate-blocker.cjs` | PostToolUse | Blocks gate advancement on validation failures | 9 refs |
| `iteration-corridor.cjs` | PreToolUse[Task] | Enforces iteration limits per phase | 3 refs |
| `test-watcher.cjs` | PostBash/PostTask | Tracks test iteration state | 3 refs |
| `state-write-validator.cjs` | PostWrite/PostEdit | Validates state.json mutations | 17 refs |
| `workflow-completion-enforcer.cjs` | PreToolUse[Task] | Detects workflow completion, triggers finalize | 9 refs |
| `constitution-validator.cjs` | PreToolUse[Task] | Phase-gated constitutional validation | 2 refs |
| `delegation-gate.cjs` | PreToolUse[Task] | Stop hook for delegation validation | 4 refs |
| `log-skill-usage.cjs` | PreToolUse[Skill] | Logs skill usage with phase context | 3 refs |
| `skill-validator.cjs` | PreToolUse[Skill] | Validates skill is available in phase | 2 refs |

**Dispatchers** (consolidate 21 hooks):
- `pre-task-dispatcher.cjs` (16 lines)
- `pre-skill-dispatcher.cjs` (13 lines)
- `post-task-dispatcher.cjs` (15 lines)
- `post-bash-dispatcher.cjs` (15 lines)
- `post-write-edit-dispatcher.cjs` (16 lines)
- `branch-guard.cjs` (standalone)
- `state-file-guard.cjs` (standalone)

---

## State Transition Model

### state.json Schema (Phase Tracking)

```json
{
  "active_workflow": {
    "id": "REQ-0055",
    "type": "feature",
    "phases": ["00-quick-scan", "01-requirements", ..., "08-code-review"],
    "current_phase": "06-implementation",
    "current_phase_index": 6,
    "phase_status": {
      "00-quick-scan": "completed",
      "01-requirements": "completed",
      "02-impact-analysis": "completed",
      "03-architecture": "completed",
      "04-design": "completed",
      "05-test-strategy": "completed",
      "06-implementation": "in_progress",
      "16-quality-loop": "pending",
      "08-code-review": "pending"
    }
  },
  "current_phase": "06-implementation",      // top-level (backward compat)
  "active_agent": "software-developer",       // top-level (backward compat)
  "phases": {
    "06-implementation": {
      "status": "executed",
      "gate_validation": { ... },
      "iteration_requirements": { ... },
      "constitutional_validation": { ... }
    }
  }
}
```

### Phase Transition Flow

```
BEFORE STEP 3e:
  active_workflow.current_phase = "05-test-strategy"
  active_workflow.current_phase_index = 5
  active_workflow.phase_status["05-test-strategy"] = "in_progress"
  active_workflow.phase_status["06-implementation"] = "pending"

STEP 3e (POST-PHASE UPDATE):
  1. Set phase_status["05-test-strategy"] = "completed"
  2. Set phase_status["06-implementation"] = "in_progress"
  3. Set current_phase = "06-implementation"
  4. Set current_phase_index = 6
  5. Set active_agent = "software-developer"

AFTER STEP 3e:
  active_workflow.current_phase = "06-implementation"
  active_workflow.current_phase_index = 6
  active_workflow.phase_status["06-implementation"] = "in_progress"
```

---

## Artifact Passing Mechanism

### Artifacts by Phase

| Phase | Output Artifacts | Consumer | Passing Method |
|-------|------------------|----------|-----------------|
| 00-quick-scan | quick-scan.md | Phase 01 | File system (docs/requirements/{id}/) |
| 01-requirements | fr.md, requirements-spec.md | Phase 02 | File system + discovery context injection |
| 02-impact-analysis | impact-analysis-report.md, affected-files.json | Phase 03 | File system + state.json.impact_analysis |
| 03-architecture | architecture-spec.md | Phase 04 | File system |
| 04-design | design-specification.md | Phase 05 | File system |
| 05-test-strategy | test-strategy.md, test-cases.md | Phase 06 | File system |
| 06-implementation | code files + pull-request | Phase 08 | Git branch + state.json.files_modified |
| 16-quality-loop | quality-report.md | Phase 08 | File system + state.json.quality_check |
| 08-code-review | code-review-report.md | Phase 13 (finalize) | File system + state.json.reviews |

### Artifact Path Resolution

**Single-Project Mode**:
```
docs/requirements/{artifact-folder}/
docs/architecture/{artifact-folder}/
docs/design/{artifact-folder}/
```

**Monorepo Mode**:
```
docs/{project-id}/requirements/{artifact-folder}/
.isdlc/projects/{project-id}/requirements/{artifact-folder}/  (alternate)
```

---

## Keyword Match Analysis

### Domain Keywords

| Keyword | Files | Contexts |
|---------|-------|----------|
| `phase_status` | 8 files | BUG-0005 fix: constitution-validator, delegation-gate, log-skill-usage, skill-validator, gate-blocker, provider-utils + tests |
| `current_phase` | 28 files | Read in almost all hooks for phase context; written by STEP 3e |
| `active_workflow` | 28 files | Read in all phase-aware hooks; written by orchestrator and STEP 3e |
| `phase_key` | 5 files | Phase normalization in common.cjs, three-verb-utils.cjs |
| `current_phase_index` | 6 files | STEP 3e, orchestrator, phase-loop-controller |

### Technical Keywords

| Keyword | Files | Contexts |
|---------|-------|----------|
| `state transition` | 3 files | phase-loop-controller, phase-sequence-guard, phase-transition-enforcer |
| `pre-delegation` | 5 files | phase-loop-controller, phase-sequence-guard, phase-transition-enforcer, delegation-gate |
| `post-phase` | 2 files | STEP 3e logic, workflow-completion-enforcer |
| `gate.*validation` | 12 files | gate-blocker, phase-loop-controller, common.cjs + 9 tests |
| `readState` | 20 files | All dispatchers and hooks that read state.json |
| `writeState` | 8 files | state-write-validator, orchestrator, STEP 3e |
| `phase_delegation` | 8 files | phase-loop-controller, phase-sequence-guard, delegation-gate + tests |

---

## Bug History: State Transition Issues

### BUG-0005: State Tracking Stale Phase Reads

**Status**: COMPLETED (2026-02-12)
**Issue**: Hooks read phase state from inconsistent locations with wrong priority
- Top-level `current_phase` was stale
- Hooks didn't read `active_workflow.current_phase` (the source of truth)
- False blocks due to stale phase context

**Fix**: 6 hooks updated with read-priority order: `active_workflow.current_phase` → `current_phase` (fallback)
**Files Modified**:
1. constitution-validator.cjs (line 245)
2. delegation-gate.cjs (line 133)
3. log-skill-usage.cjs (line 87)
4. skill-validator.cjs (line 95)
5. gate-blocker.cjs (line 578)
6. provider-utils.cjs (line 323)

**Tests**: 23 test cases covering all 6 hooks (all passing)
**Artifact Folder**: `docs/requirements/BUG-0005-state-tracking-stale/`

### BUG-0006: Phase-Loop State Ordering

**Status**: COMPLETED (2026-02-13)
**Issue**: STEP 3e was updating state fields in wrong order, causing race conditions
- `current_phase_index` incremented before `phase_status` update
- Hooks read intermediate state during transition
- Out-of-sync phase tracking

**Fix**: Reordered STEP 3e updates to be atomic and consistent
**Artifact Folder**: `docs/requirements/BUG-0006-phase-loop-state-ordering/`

### BUG-0013: Phase-Loop Controller False Blocks

**Status**: COMPLETED (2026-02-19)
**Issue**: Phase-loop controller blocked legitimate intra-phase Task calls
- Sub-agents (symptom-analyzer, execution-path-tracer) calling TaskUpdate within same phase
- Were falsely blocked as "cross-phase delegation"
- Needed same-phase bypass

**Fix**: Added same-phase bypass logic (version 1.2.0)
```cjs
// BUG-0013: Same-phase bypass — sub-agent Task calls within the active
// phase are legitimate and must not be blocked regardless of phase status.
if (delegation.targetPhase === currentPhase) {
    return { decision: 'allow' };  // intra-phase call, not cross-phase
}
```

**Files Modified**: phase-loop-controller.cjs (added lines 68-80)
**Artifact Folder**: `docs/requirements/BUG-0013-phase-loop-controller-false-blocks/`
**Complexity Note**: This fix required understanding the distinction between phase-level agents and sub-agents, and their phase resolution strategy.

---

## File Inventory

### Hook Files (State-Aware)

**Core Phase Management** (4 files):
- phase-loop-controller.cjs — 133 lines
- phase-sequence-guard.cjs — 92 lines
- phase-transition-enforcer.cjs — 89 lines
- workflow-completion-enforcer.cjs — 167 lines

**Gate Enforcement** (2 files):
- gate-blocker.cjs — 925 lines (largest single hook)
- delegation-gate.cjs — 73 lines

**State Tracking** (4 files):
- state-write-validator.cjs — 247 lines
- iteration-corridor.cjs — 89 lines
- test-watcher.cjs — 142 lines
- menu-tracker.cjs — 71 lines

**Phase Context** (4 files):
- constitution-validator.cjs — 267 lines
- log-skill-usage.cjs — 78 lines
- skill-validator.cjs — 102 lines
- model-provider-router.cjs — 93 lines

**Utility Libraries** (3 files):
- lib/common.cjs — 3,458 lines (central: state reading, phase detection)
- lib/provider-utils.cjs — 964 lines (includes phase reading)
- lib/three-verb-utils.cjs — 863 lines (phase normalization)

### Command Files

- **isdlc.md** (Phase-Loop Controller STEP 3 logic) — key state transition orchestration
- **discover.md** — pre-workflow discovery
- **tour.md** — walkthrough mode

### Agent Files

- **00-sdlc-orchestrator.md** — workflow initialization and delegation
- **01-requirements-refiner.md through 13-site-reliability-engineer.md** (12 phase agents)
- **Tracing agents** — symptom-analyzer, execution-path-tracer (sub-agents, same-phase context)
- **Impact analysis agents** — cross-validation-verifier (Phase 02 context)

### Test Files

**Hook Tests** (~30 files, ~30,000 lines):
- test-common.test.cjs — 3,013 lines (phase detection, state schema)
- test-gate-blocker-extended.test.cjs — 2,365 lines
- test-three-verb-utils.test.cjs — 2,223 lines
- state-write-validator.test.cjs — 1,853 lines
- test-io-optimization.test.cjs — 1,207 lines
- test-fan-out-integration.test.cjs — 980 lines
- cross-hook-integration.test.cjs — 754 lines (phase handshake scenarios)
- And 23 others covering specific hooks

**Phase-Specific Tests**:
- test-phase-loop-controller.test.cjs — controller blocking and delegation
- phase-sequence-guard.test.cjs — out-of-order prevention
- isdlc-step3-ordering.test.cjs — STEP 3e transition ordering

---

## Critical Interaction Points

### 1. Phase Status Read Chain

```
Hook needs current phase
  ↓
Call detectPhaseDelegation() in common.cjs (line ~XX)
  ↓
Read state.active_workflow.current_phase (primary)
  ↓
Fallback: read state.current_phase (if active_workflow missing)
  ↓
Use phase for gate checks, iteration limits, skill validation
```

### 2. Phase Status Write Chain

```
STEP 3e completes phase
  ↓
Set active_workflow.phase_status[current] = "completed"
  ↓
Set active_workflow.phase_status[next] = "in_progress"
  ↓
Set active_workflow.current_phase = next_phase_key
  ↓
Set active_workflow.current_phase_index = next_index
  ↓
Set top-level current_phase = next_phase_key (backward compat)
  ↓
Set top-level active_agent = agent_for(next_phase_key)
  ↓
Persist to .isdlc/state.json
  ↓
next phase agent's Task is unblocked by phase-loop-controller
```

### 3. Gate Validation Chain

```
Phase agent completes
  ↓
STEP 3 → gate-blocker hook (PostTask)
  ↓
gate-blocker reads state.phases[currentPhase].gate_validation
  ↓
if failing, block STEP 3e (return decision: block)
  ↓
if passing, allow STEP 3e to proceed
  ↓
STEP 3e updates phase_status["completed"]
  ↓
Next phase delegation unblocked
```

---

## Entry Points for Phase Handshake

### Direct Entry Points

1. **Orchestrator Initialization** (src/claude/agents/00-sdlc-orchestrator.md)
   - Initializes active_workflow with phases, phase_status, current_phase

2. **Phase Delegation** (isdlc.md STEP 3d)
   - Task tool call to delegate to phase agent
   - Triggered by phase-loop-controller (must be in_progress)

3. **Gate Validation** (isdlc.md STEP 3 → gate-blocker)
   - PostTask hook on phase completion
   - Reads gate validation data from state.phases[currentPhase]

4. **State Transition** (isdlc.md STEP 3e)
   - Updates active_workflow and top-level fields
   - Increments phase_index, sets next phase to in_progress

5. **Workflow Completion** (workflow-completion-enforcer)
   - Detects all phases complete
   - Triggers finalize mode delegation

### Hook Entry Points

- **phase-loop-controller**: PreToolUse[Task] — blocks non-in_progress delegations
- **phase-sequence-guard**: PreToolUse[Task] — blocks out-of-order delegations
- **gate-blocker**: PostTask — validates gates before phase transition
- **state-write-validator**: PostWrite/PostEdit — validates state.json mutations
- **delegation-gate**: PreToolUse[Task] — stop hook for delegation validation

---

## Complexity Assessment

### High-Complexity Areas

1. **State.json Schema Redundancy** (BUG-0005 revealed)
   - 3 locations track phase status: `active_workflow.phase_status[]`, `active_workflow.current_phase`, top-level `current_phase`
   - Synchronization during STEP 3e is critical
   - Backward compatibility complicates cleanup

2. **Phase-to-Agent Mapping** (phase-loop-controller, STEP 3d)
   - Phase key prefix (00, 01, ..., 16) must map to correct agent name
   - BUG-0013 revealed sub-agent complexity (asymmetric phase resolution)
   - Three-verb-utils.cjs normalizes phase keys (handles aliases)

3. **Gate Validation Ordering** (gate-blocker, STEP 3e)
   - Gate must pass BEFORE phase_status update to "completed"
   - BUG-0006 revealed ordering bugs (race conditions)
   - Current order: validate gate → update status → transition

4. **Monorepo State Isolation** (BACKLOG #30)
   - Currently single `active_workflow` per project
   - Future: per-workflow state files may break current assumptions

5. **Intra-Phase vs Cross-Phase Delegation** (BUG-0013)
   - Sub-agents (symptom-analyzer, execution-path-tracer) exist within a phase
   - Phase-loop-controller must allow intra-phase Task calls
   - Requires phase resolution for sub-agents, not just phase agents

---

## Investigation Questions for Requirements Phase

Based on quick scan findings, the audit should clarify:

1. **State Coherency**: How do we ensure `active_workflow.phase_status`, `active_workflow.current_phase`, and top-level `current_phase` stay synchronized during STEP 3e? Can we eliminate the redundancy (backward-compat cost vs clarity gain)?

2. **Phase Key Normalization**: What is the canonical phase key format? STEP 3e uses phase_index and phase array — should we rely on phase array order instead of string keys?

3. **Gate Validation Atomicity**: If gate validation fails in PostTask, can the orchestrator resume from that point, or does it need to re-run the entire phase? What are the artifact implications?

4. **Sub-Agent Phase Resolution**: How should sub-agents (tracing, impact-analysis cross-validation) signal their parent phase? Current: hardcoded in detectPhaseDelegation(). Better: declarative mapping in manifest?

5. **Artifact Passing Consistency**: Are all artifacts explicitly passed (referenced in state.json) or implicitly (file system scan)? How do we ensure agents don't miss dependencies?

6. **Monorepo Phase Isolation** (#30): If parallel workflows are enabled, how does phase-loop-controller remain aware of the current workflow's phases? Current: assumes single active_workflow.

7. **Phase Index Sync**: If a phase is skipped (e.g., 16-quality-loop for light scope), how is current_phase_index updated? Does STEP 3e look ahead to next non-skipped phase?

---

## Quick Scan Metadata

```json
{
  "scan_completed_at": "2026-02-20T19:00:00Z",
  "scan_duration_seconds": 180,
  "keywords_searched": 12,
  "files_identified": 65,
  "hooks_involved": 28,
  "dispatchers": 7,
  "tests_found": 30,
  "bug_fixes_referenced": 3,
  "scope_estimate": "large",
  "confidence_level": "high",
  "critical_path": true,
  "ready_for_requirements": true
}
```

---

## Phase Handshake Blast Radius

**Artifact Dependency Chain**:
```
Orchestrator Init
  → Phase 00 (quick-scan) → 01-requirements → 02-impact → 03-architecture
    ↓                        ↓                  ↓           ↓
  state init            artifact passing    artifact       artifact
                        (file system)       passing        passing
    ↓
    → 04-design → 05-test-strategy → 06-implementation
      ↓           ↓                   ↓
    artifact   artifact            git branch
    passing    passing
      ↓
    → 16-quality-loop → 08-code-review → 13-finalize
      ↓                  ↓                ↓
    quality           code review       merge to main,
    report            report            cleanup
```

**If phase-loop-controller breaks**:
- All delegations blocked
- Entire workflow halts
- No phase transitions possible

**If STEP 3e breaks**:
- Artifacts generated but state not updated
- Next phase delegation falsely blocked
- Workflow appears stuck

**If gate-blocker breaks**:
- Invalid phases advance past quality gates
- Bad artifacts flow downstream
- Cumulative defects increase

---

## Sources and References

1. **BUG-0005**: `docs/requirements/BUG-0005-state-tracking-stale/`
   - requirements-spec.md — phase state read-priority fix
   - code-review-report.md — implementation validation
   - test-strategy.md — 23 test cases covering all 6 hooks

2. **BUG-0006**: `docs/requirements/BUG-0006-phase-loop-state-ordering/`
   - STEP 3e ordering constraints

3. **BUG-0013**: `docs/requirements/BUG-0013-phase-loop-controller-false-blocks/`
   - Same-phase bypass logic
   - Sub-agent phase resolution

4. **BACKLOG.md**:
   - #30: Parallel workflow support (phase state isolation)
   - #39: State.json pruning (schema cleanup)

5. **src/claude/hooks/lib/common.cjs** (3,458 lines)
   - detectPhaseDelegation()
   - Phase key normalization
   - State schema utilities

---

## Next Steps

This quick scan is ready for Phase 01 (Requirements) to begin detailed investigation. The scope is clearly defined, critical files are identified, and existing bug fixes provide a foundation for understanding the mechanism.

**Recommended Requirements Focus**:
1. State schema clarification and redundancy elimination
2. Phase-loop-controller contract and guarantees
3. Artifact passing verification (explicit vs implicit)
4. Sub-agent phase resolution formalization
5. Monorepo and parallel workflow implications
