# Architecture Review: Phase Handshake Mechanism (GH-55)

**Phase**: 03-architecture (Architecture Review)
**Investigation**: Phase-to-phase state transitions, artifact passing, gate validation
**Based On**: Phase 01 Requirements Spec (13 IRs, 76 ACs), Phase 02 Impact Analysis (35 files)
**Date**: 2026-02-20
**Mode**: ANALYSIS (no state changes, no branches)

---

## 1. Executive Summary

The phase handshake mechanism is the central coordination system of the iSDLC framework. It orchestrates state transitions, gate enforcement, and artifact passing across sequential SDLC phases. This review evaluates its architectural fitness based on source code analysis of the core files: `isdlc.md` (Phase-Loop Controller), `common.cjs` (state management and detection), `gate-blocker.cjs`, `phase-loop-controller.cjs`, `phase-sequence-guard.cjs`, `iteration-corridor.cjs`, `workflow-completion-enforcer.cjs`, `state-write-validator.cjs`, `delegation-gate.cjs`, and the `pre-task-dispatcher.cjs`.

**Overall Assessment**: The architecture is fundamentally sound but has accumulated structural debt through organic evolution. Three prior bug fixes (BUG-0005, BUG-0006, BUG-0013) have addressed specific failure modes, but the underlying architectural tensions that produced those bugs remain. The most significant concerns are: triple-redundant state tracking without a single source of truth, a prose-based Phase-Loop Controller that cannot be unit-tested, and configuration drift across three separate PHASE_AGENT_MAP instances.

**Recommendation**: Targeted refactoring (not a full redesign). The issues identified can be addressed through 5-7 focused fixes without restructuring the overall architecture. A full iSDLC build workflow is not warranted; instead, a series of targeted bug/fix workflows or a single consolidation feature workflow would be appropriate.

---

## 2. Current Architecture

### 2.1 System Context

The phase handshake mechanism operates within the Claude Code hook system, where pre-tool and post-tool hooks intercept agent actions to enforce workflow constraints. The mechanism spans three layers:

```
+-----------------------------------------------------------------------+
|                          CLAUDE CODE RUNTIME                          |
|                                                                       |
|  User Command ("/isdlc feature")                                      |
|       |                                                               |
|       v                                                               |
|  +-------------------+                                                |
|  | isdlc.md          |  <-- Phase-Loop Controller (prose)             |
|  | (Skill/Command)   |      STEP 3a-3e: loop over phases             |
|  +-------------------+                                                |
|       |                                                               |
|       | delegates via Task tool                                       |
|       v                                                               |
|  +-------------------+     +---------------------------------+        |
|  | Phase Agent        |<--->| Hook System (pre-task-dispatcher)|       |
|  | (01-requirements,  |     | phase-loop-controller.cjs       |       |
|  |  02-impact, etc.)  |     | phase-sequence-guard.cjs        |       |
|  +-------------------+     | iteration-corridor.cjs          |       |
|       |                     | gate-blocker.cjs                |       |
|       | reads/writes        | constitution-validator.cjs      |       |
|       v                     +---------------------------------+        |
|  +-------------------+     +---------------------------------+        |
|  | .isdlc/state.json |<--->| Hook System (post-write-edit)   |       |
|  | (persistent state) |     | state-write-validator.cjs       |       |
|  +-------------------+     | workflow-completion-enforcer.cjs |       |
|                             +---------------------------------+        |
+-----------------------------------------------------------------------+
```

### 2.2 Phase Transition Data Flow

A single phase boundary crossing involves two write cycles separated by a Task delegation:

```
Phase N Completes
     |
     v
STEP 3e: POST-PHASE UPDATE (5 writes)
     |  1. phases[N].status = "completed"
     |  2. phases[N].summary = "..."
     |  3. active_workflow.current_phase_index += 1
     |  4. active_workflow.phase_status[N] = "completed"
     |  5. writeState()
     |
     |  Note: STEP 3e does NOT activate Phase N+1 (BUG-0006 fix)
     |
     v
STEP 3c-prime: PRE-DELEGATION UPDATE (7 writes)
     |  1. phases[N+1].status = "in_progress"
     |  2. phases[N+1].started = ISO-8601 timestamp
     |  3. active_workflow.current_phase = phase_key(N+1)
     |  4. active_workflow.phase_status[N+1] = "in_progress"
     |  5. current_phase (top-level) = phase_key(N+1)
     |  6. active_agent (top-level) = PHASE_AGENT_MAP[phase_key(N+1)]
     |  7. writeState()
     |
     v
STEP 3d: PHASE DELEGATION
     |  Task tool -> phase agent (subagent_type from STEP 3d table)
     |
     v
PRE-TASK-DISPATCHER fires (9 hooks in sequence):
     |  1. iteration-corridor     -- corridor enforcement
     |  2. skill-validator        -- observational only
     |  3. phase-loop-controller  -- checks phases[N+1].status == "in_progress"
     |  4. plan-surfacer          -- task plan check
     |  5. phase-sequence-guard   -- checks target matches current_phase
     |  6. gate-blocker           -- gate requirements check
     |  7. constitution-validator -- constitutional compliance
     |  8. test-adequacy-blocker  -- upgrade phases only
     |  9. blast-radius-validator -- feature Phase 06 only
     |
     v
Phase Agent Executes (reads artifacts, writes artifacts, runs tests)
     |
     v
POST-TASK-DISPATCHER fires:
     |  - phase-transition-enforcer (observational)
     |  - workflow-completion-enforcer (self-healing)
     |
     v
Return to STEP 3e for this phase
```

### 2.3 State Schema: The Triple-Redundancy Model

Phase status is tracked in three distinct locations within `state.json`:

```
Location 1: active_workflow.phase_status[phase_key]
  - Type: Map<string, "pending" | "in_progress" | "completed">
  - Written by: STEP 3c-prime (in_progress), STEP 3e (completed)
  - Read by: Hooks for quick phase status checks, BUG-0005 sync target

Location 2: phases[phase_key].status
  - Type: "pending" | "in_progress" | "completed" | "executed"
  - Written by: STEP 3c-prime (in_progress), STEP 3e (completed)
  - Read by: phase-loop-controller (line 84-85), gate-blocker,
             iteration-corridor, test-watcher, constitution-validator
  - Also stores: started, completed, gate_passed, artifacts[],
                 iteration_requirements{}, constitutional_validation{},
                 gate_validation{}, timing{}

Location 3: active_workflow.current_phase
  - Type: string (phase key of the active phase)
  - Written by: STEP 3c-prime
  - Read by: All hooks for current phase determination (BUG-0005 primary source)

Backward-compatibility shadow:
  current_phase (top-level)    -- shadow of active_workflow.current_phase
  active_agent (top-level)     -- resolved from PHASE_AGENT_MAP for current phase
```

### 2.4 Hook Chain Architecture

The pre-task-dispatcher (`dispatchers/pre-task-dispatcher.cjs`) implements a linear pipeline with short-circuit semantics:

```
Input (Task tool call)
  |
  v
[iteration-corridor] --block--> STOP (return block to Claude)
  | allow
  v
[skill-validator] -- observational, never blocks
  |
  v
[phase-loop-controller] --block--> STOP
  | allow
  v
[plan-surfacer] --block--> STOP
  | allow
  v
[phase-sequence-guard] --block--> STOP
  | allow
  v
[gate-blocker] --block--> STOP
  | allow
  v
[constitution-validator] --block--> STOP
  | allow
  v
[test-adequacy-blocker] --block--> STOP (upgrade phases only)
  | allow
  v
[blast-radius-validator] --block--> STOP (feature Phase 06 only)
  | allow
  v
DELEGATION PROCEEDS
```

Each hook receives the same shared `ctx` object: `{ input, state, manifest, requirements, workflows }`. State is read once by the dispatcher and passed to all hooks. If any hook modifies state (via `stateModified: true`), the dispatcher writes it back after the pipeline completes or after a block.

---

## 3. Architectural Strengths

### S-1: Fail-Open Design (Constitution Article X)

Every hook follows a consistent fail-open pattern: unreadable state, missing config, or unexpected errors result in `{ decision: 'allow' }`. This prevents the hook system from becoming a single point of failure that blocks all workflows. The pattern is applied uniformly across all 9 pre-task hooks.

### S-2: Dispatcher Consolidation (REQ-0010)

The 5 dispatchers consolidate 21+ hooks into 5 processes, each reading state/config once and sharing the ctx object. This reduces I/O from ~21 disk reads per tool call to ~5. The short-circuit semantics (PreToolUse dispatchers stop on first block) further reduce unnecessary computation.

### S-3: Defense-in-Depth Validation

Multiple overlapping checks catch different failure modes:
- **phase-loop-controller**: Catches delegations to phases not yet activated (status not "in_progress")
- **phase-sequence-guard**: Catches out-of-order delegations (target phase != current phase)
- **gate-blocker**: Catches advancement without passing iteration requirements
- **state-write-validator V7**: Catches stale writes (version regression)
- **state-write-validator V8**: Catches phase status regression (completed -> pending)

This layering means a single hook failure does not compromise the gate system.

### S-4: Self-Healing Infrastructure

Several hooks include self-healing capabilities:
- `normalizePhaseKey()` catches alias drift between config files
- `diagnoseBlockCause()` distinguishes infrastructure issues from genuine failures
- `workflow-completion-enforcer` auto-remediates missing phase snapshots
- Pending escalation system surfaces hook blocks to the Phase-Loop Controller

### S-5: BUG-0006 Separation of Concerns

The split between STEP 3e (completion only) and STEP 3c-prime (activation only) is a clean architectural boundary. STEP 3e marks the completed phase without touching the next phase. STEP 3c-prime activates the next phase without touching the completed phase. This eliminates the race condition class identified in BUG-0006.

---

## 4. Architectural Weaknesses

### W-1: CRITICAL -- Three PHASE_AGENT_MAP Instances with Active Drift

**Severity**: HIGH
**IRs Affected**: IR-001, IR-005, IR-008

Three separate maps define the phase-to-agent relationship, and they have drifted significantly:

**Map 1: common.cjs PHASE_AGENT_MAP (line 2029)** -- 18 entries. Used by `detectPhaseDelegation()` fallback logic and `isAgentAuthorizedForPhase()`. Agent names match actual agent file names (e.g., `impact-analysis-orchestrator`, `system-designer`, `qa-engineer`).

**Map 2: isdlc.md STEP 3d delegation table (line 1158)** -- 20 entries. Used for actual Task delegation (`subagent_type`). Matches Map 1 exactly, plus includes `00-quick-scan -> quick-scan-agent` (absent from common.cjs).

**Map 3: isdlc.md STEP 3c-prime PHASE_AGENT_MAP (line 1337)** -- 15 entries. Used for `active_agent` top-level field. Contains extensive drift from Maps 1 and 2:

| Phase Key | Map 1/2 (common.cjs & STEP 3d) | Map 3 (STEP 3c-prime) | Status |
|-----------|-------------------------------|----------------------|--------|
| `02-tracing` | tracing-orchestrator | trace-analyst | DRIFTED |
| `02-impact-analysis` | impact-analysis-orchestrator | impact-analyst | DRIFTED |
| `04-design` | system-designer | software-designer | DRIFTED |
| `07-testing` | integration-tester | quality-assurance-engineer | DRIFTED |
| `08-code-review` | qa-engineer | code-reviewer | DRIFTED |
| `09-validation` | security-compliance-auditor | security-engineer | DRIFTED (key also differs: `09-security`) |
| `10-cicd` | cicd-engineer | (missing) | MISSING |
| `11-local-testing` | environment-builder | quality-assurance-engineer | DRIFTED (key: `11-deployment`) |
| `12-test-deploy` | deployment-engineer-staging | release-engineer | DRIFTED |
| `13-production` | release-manager | release-engineer | DRIFTED |
| `14-operations` | site-reliability-engineer | (missing) | MISSING |
| `15-upgrade-plan` | upgrade-engineer | (missing) | MISSING |
| `15-upgrade-execute` | upgrade-engineer | (missing) | MISSING |
| `16-quality-loop` | quality-loop-engineer | quality-assurance-engineer | DRIFTED |

**Impact**: The `active_agent` top-level field will contain values from Map 3 (STEP 3c-prime), while actual delegation uses Map 2 (STEP 3d). Any hook or tool that reads `active_agent` to determine which agent is running will get an incorrect value. Currently, no hook reads `active_agent` for enforcement decisions (they all use `active_workflow.current_phase` after BUG-0005), so this is a latent defect rather than an active bug. However, it represents a correctness violation: the state file contains demonstrably wrong metadata.

**Root Cause**: Map 3 appears to be an early prototype that was never synchronized when agent names were standardized. The lack of any automated consistency check between the three maps allowed drift to accumulate silently.

### W-2: HIGH -- Prose-Based Phase-Loop Controller (Testability Gap)

**Severity**: HIGH
**IRs Affected**: IR-002, IR-003, IR-009

The Phase-Loop Controller logic (STEP 3a through 3e in `isdlc.md`) is written as Markdown prose instructions for Claude to interpret, not as executable code. This creates a fundamental testability gap:

- **No unit tests possible**: STEP 3c-prime's 7-field write sequence, STEP 3e's 5-field write sequence and 5-field prohibition, and STEP 3e-timing budget calculations cannot be tested in isolation.
- **Behavioral verification only**: The `isdlc-step3-ordering.test.cjs` file (385 LOC) tests some ordering constraints but cannot directly verify that Claude follows the prose instructions correctly. It tests what the hooks observe, not what the controller writes.
- **Regression risk**: Each modification to STEP 3 prose requires careful manual review because there is no automated guardrail against introducing field omissions or ordering changes.

The hooks partially compensate (phase-loop-controller checks `phases[key].status`, state-write-validator V7/V8 catch version regressions and status regressions), but they validate constraints after the fact rather than preventing incorrect writes.

**Contrast with hook system**: Every hook function has a `check(ctx)` function that returns a well-typed result. This is directly testable. STEP 3 has no equivalent function -- it is an instruction set that Claude interprets.

### W-3: MEDIUM-HIGH -- Triple-Redundancy State Model (Liability, Not Asset)

**Severity**: MEDIUM-HIGH
**IRs Affected**: IR-001

The three-location phase tracking model (Section 2.3 above) was inherited from early design. It creates several problems:

1. **Synchronization burden**: Every phase transition must update 3+ locations atomically. STEP 3c-prime writes 7 fields across 2 locations. STEP 3e writes 5 fields across 2 locations. Missing any one write creates a BUG-0005-class defect.

2. **No single source of truth**: Different hooks read from different locations:
   - `phase-loop-controller.cjs` (line 84): reads `state.phases[currentPhase].status`
   - `phase-sequence-guard.cjs` (line 58): reads `state.active_workflow.current_phase`
   - `gate-blocker.cjs` (line 642): reads `activeWorkflow.current_phase || state.current_phase`
   - `iteration-corridor.cjs` (line 260): reads `(activeWorkflow && activeWorkflow.current_phase) || state.current_phase`

   All hooks converge on `active_workflow.current_phase` as primary (BUG-0005 fix), but the `phases[key].status` is the ground truth for detailed phase data (iteration requirements, timing, artifacts).

3. **Backward-compatibility cost**: The top-level `current_phase` and `active_agent` exist solely for backward compatibility. No current hook uses them as primary source. They are write-only overhead in STEP 3c-prime.

**Assessment**: The triple-redundancy model is a liability, not an asset. The `active_workflow.phase_status` map and the `phases[key].status` field always hold the same value ("pending", "in_progress", or "completed"). One of them is redundant. The top-level `current_phase` and `active_agent` are pure backward-compatibility shadows that add write overhead and drift risk.

### W-4: MEDIUM -- writeState() Shallow Copy Vulnerability

**Severity**: MEDIUM
**IRs Affected**: IR-011

`writeState()` (common.cjs line 1115) uses `Object.assign({}, state)` to create a "copy" before writing. This is a shallow copy -- nested objects (`phases`, `active_workflow`, `active_workflow.phase_status`) are still shared references between the caller's object and the copy.

```javascript
const stateCopy = Object.assign({}, state);
stateCopy.state_version = currentVersion + 1;
fs.writeFileSync(stateFile, JSON.stringify(stateCopy, null, 2));
```

The only field modified on the copy is `state_version`. All nested mutations (including phase status changes, iteration requirement updates) have already been applied to the caller's object before calling `writeState()`. The shallow copy prevents `state_version` from leaking back to the caller, but it does NOT prevent the caller from seeing mutations made by other code paths that share the same nested object references.

**Current impact**: Low, because the single-process, single-thread execution model means only one code path touches state at a time. But the semantic contract ("does NOT mutate the caller's object" per the JSDoc) is incorrect for nested properties.

### W-5: MEDIUM -- loadIterationRequirements() Duplicated in 5 Hooks

**Severity**: MEDIUM
**IRs Affected**: IR-004, IR-013

The `loadIterationRequirements()` function is defined identically in 5 separate files:

1. `common.cjs` (line 2554) -- canonical version
2. `gate-blocker.cjs` (line 35) -- local fallback
3. `iteration-corridor.cjs` (line 83) -- local fallback
4. `test-watcher.cjs` (line 253) -- local fallback
5. `constitution-validator.cjs` (line 49) -- local fallback

Each hook imports from common.cjs as `loadIterationRequirementsFromCommon` and also defines its own local fallback with the same logic. The dispatcher already loads requirements once and passes them via `ctx.requirements`. The local fallbacks are dead code when running under the dispatcher (which is the production path).

**Root Cause**: These local fallbacks predate the dispatcher consolidation (REQ-0010). When hooks ran as standalone processes, each needed to load its own config. After dispatcher consolidation, the local loaders became redundant but were never removed.

### W-6: MEDIUM -- STATE_JSON_PATTERN Regex Duplicated in 3 Files

**Severity**: MEDIUM
**IRs Affected**: Maintenance

The regex `/\.isdlc[/\\](?:projects[/\\][^/\\]+[/\\])?state\.json$/` is defined in:

1. `common.cjs` (line 64) -- exported
2. `state-write-validator.cjs` (line 29) -- local copy
3. `workflow-completion-enforcer.cjs` (line 45) -- local copy

`state-file-guard.cjs` imports from common.cjs correctly. The other two files define their own copies. If the state path convention changes (e.g., for a new monorepo layout), two of three files would not be updated.

### W-7: LOW-MEDIUM -- workflow-completion-enforcer Fragile Reconstruction Pattern

**Severity**: LOW-MEDIUM
**IRs Affected**: IR-010

The `workflow-completion-enforcer.cjs` reconstructs a temporary `active_workflow` object (lines 154-159) to feed into `collectPhaseSnapshots()`:

```javascript
state.active_workflow = {
    phases: phasesArray,
    started_at: lastEntry.started_at || null,
    completed_at: lastEntry.completed_at || lastEntry.cancelled_at || null,
    sizing: sizingRecord
};
const { phase_snapshots, metrics } = collectPhaseSnapshots(state);
state.active_workflow = null;
```

This pattern is fragile because:
1. It temporarily mutates the global state object with a synthetic `active_workflow`
2. If `collectPhaseSnapshots()` ever reads additional fields from `active_workflow` (e.g., `type`, `description`, `phase_status`), the reconstructed object will lack them
3. The cleanup (`state.active_workflow = null`) must execute even on error -- there is no try/finally wrapper around the reconstruction

### W-8: LOW -- normalizeAgentName() Hardcoded Mappings

**Severity**: LOW
**IRs Affected**: IR-006

The `normalizeAgentName()` function (common.cjs line 1361) contains 40+ hardcoded mappings from agent name variations to canonical names. This list was manually constructed and is separate from the skills manifest `ownership` section. If a new agent is added to the manifest but not to `normalizeAgentName()`, the function will return the input unchanged, which may not match any manifest entry.

---

## 5. Architecture Diagrams

### 5.1 State Read/Write Responsibility Matrix

```
                    Reads                           Writes
                    -----                           ------
STEP 3c-prime:      state.json (full read)          phases[key].status
                                                    phases[key].started
                                                    active_workflow.current_phase
                                                    active_workflow.phase_status[key]
                                                    current_phase (top-level)
                                                    active_agent (top-level)

STEP 3e:            state.json (full read)          phases[key].status
                                                    phases[key].summary
                                                    active_workflow.current_phase_index
                                                    active_workflow.phase_status[key]

phase-loop-ctrl:    state.active_workflow.current_phase
                    state.phases[key].status         (none)

phase-seq-guard:    state.active_workflow.current_phase
                                                     (none)

gate-blocker:       active_workflow.current_phase
                    phases[key].iteration_requirements
                    phases[key].constitutional_validation
                    phases[key].gate_validation       pending_escalations[] (via addPendingEscalation)

iteration-corridor: active_workflow.current_phase
                    phases[key].iteration_requirements
                    phases[key].constitutional_validation
                                                     pending_escalations[] (via addPendingEscalation)

state-write-val:    incoming content (parsed)
                    disk state (pre-read by dispatcher) (none -- observational + block)

workflow-compl:     state.json (fresh disk read)     workflow_history[last] (snapshots, metrics)
                    workflow_history[last]            state.json (pruning)

test-watcher:       active_workflow.current_phase
                    phases[key].iteration_requirements
                                                     phases[key].iteration_requirements.test_iteration

delegation-gate:    pending_delegation marker
                    skill_usage_log[]
                    active_workflow.current_phase_index
                    phases[key].status               _delegation_gate_error_count
```

### 5.2 Phase Transition State Machine

```
                      +-------------------+
                      | WORKFLOW_NOT_STARTED |
                      +-------------------+
                              |
                    orchestrator init
                              |
                              v
          +----------------------------------------+
          |  Phase 0: "in_progress"                |
          |  active_workflow.current_phase = P0     |
          |  active_workflow.current_phase_index = 0|
          +----------------------------------------+
                              |
                    phase agent completes
                              |
                              v
          +----------------------------------------+
   STEP   |  Phase 0: "completed"                  |
   3e     |  current_phase_index = 1               |
          +----------------------------------------+
                              |
                    next loop iteration
                              |
                              v
          +----------------------------------------+
   STEP   |  Phase 1: "in_progress"                |
   3c'    |  active_workflow.current_phase = P1     |
          |  current_phase (top) = P1              |
          |  active_agent (top) = agent(P1)        |
          +----------------------------------------+
                              |
                    phase agent completes
                              |
                              v
                           ...
                              |
                    last phase completes
                              |
                              v
          +----------------------------------------+
          |  current_phase_index = phases.length   |
          |  All phase_status = "completed"        |
          +----------------------------------------+
                              |
                    loop terminates, finalize
                              |
                              v
          +----------------------------------------+
          |  active_workflow = null                 |
          |  workflow_history[] += entry            |
          +----------------------------------------+
```

### 5.3 Hook-to-State Field Dependency Graph

```
detectPhaseDelegation(input) -----> { isDelegation, targetPhase, agentName }
      |                                    |
      | used by                            | compared against
      |                                    |
      v                                    v
phase-loop-controller:          active_workflow.current_phase
  reads phases[current].status       (same-phase bypass: BUG-0013)
      |
phase-sequence-guard:           active_workflow.current_phase
  compares target vs current         (exact match required)
      |
iteration-corridor:             phases[current].iteration_requirements
  corridor state derivation          .test_iteration
                                     .constitutional_validation
      |
gate-blocker:                   phases[current].iteration_requirements
  5 requirement checks               .test_iteration
                                     .constitutional_validation
                                     .interactive_elicitation
                                     .agent_delegation
                                artifact_paths[current]
      |
state-write-validator:          incoming.state_version vs disk.state_version
  V7 version lock                incoming.active_workflow.current_phase_index
  V8 regression protection       incoming.active_workflow.phase_status[*]
```

---

## 6. Assessment of Key Architectural Questions

### 6.1 Is the Triple-Redundancy Model Necessary or a Liability?

**Verdict: Liability.** The three locations serve distinct purposes that could be consolidated:

| Location | Purpose | Could Be Derived? |
|----------|---------|-------------------|
| `active_workflow.phase_status[key]` | Quick status lookup | YES -- from `phases[key].status` |
| `phases[key].status` | Detailed phase data root | NO -- this is the source of truth |
| `active_workflow.current_phase` | Current phase identity | NO -- needed for index-to-key resolution |
| `current_phase` (top-level) | Backward compat | YES -- from `active_workflow.current_phase` |
| `active_agent` (top-level) | Backward compat | YES -- from PHASE_AGENT_MAP lookup |

**Recommendation**: Eliminate `active_workflow.phase_status` map entirely. All hooks already read from `phases[key].status` for detailed data. The `phase_status` map is a redundant summary that must be kept in sync but provides no unique information. The top-level `current_phase` and `active_agent` should be marked as deprecated but can remain for backward compatibility if they are derived (written but never read by the framework itself).

### 6.2 Can the Testability Gap Be Closed?

**Verdict: Partially.** The Phase-Loop Controller is a prose instruction set for Claude, so it cannot be converted to executable code without fundamental architecture change. However, testability can be improved through:

1. **Stronger post-hoc validation**: Expand `state-write-validator.cjs` with a new rule (V9) that checks: after any state write where `phases[key].status` transitions to `"completed"`, verify that `active_workflow.phase_status[key]` also equals `"completed"`. This catches synchronization failures.

2. **Extracting critical logic to executable helpers**: The 7-field write in STEP 3c-prime and the 5-field write in STEP 3e could each be expressed as a helper function in `common.cjs`:
   ```javascript
   function activatePhase(state, phaseKey, agentName) { ... }
   function completePhase(state, phaseKey, summary) { ... }
   ```
   The prose instructions would then say "call `activatePhase()`" instead of listing 7 individual writes. The helper would be unit-testable.

3. **Integration test expansion**: Write multi-phase transition tests that simulate the full STEP 3e -> STEP 3c-prime -> delegation -> STEP 3e cycle through state assertions.

### 6.3 Does the Hook Chain Have Single Points of Failure?

**Verdict: The pre-task-dispatcher is a SPOF, but with appropriate mitigations.**

If `pre-task-dispatcher.cjs` fails to load (syntax error, missing dependency), no pre-task hooks fire. This means:
- Phase-loop-controller will not enforce progress tracking
- Phase-sequence-guard will not enforce ordering
- Gate-blocker will not enforce iteration requirements
- All delegations will proceed unchecked

The mitigation is that Claude Code's hook system itself is the outer safety net. If a hook process crashes (exit code != 0, stderr without JSON block response), Claude Code treats it as "allow" (fail-open). This is the correct behavior for availability, but means a broken dispatcher silently disables all enforcement.

**Secondary SPOF: common.cjs** (3,458 lines). Every hook imports from common.cjs. A syntax error or import failure in common.cjs would break all hooks simultaneously. The file is well-tested (3,013 LOC of tests) but its size makes it a concentration risk.

### 6.4 Is the `detectPhaseDelegation()` Cascade Reliable?

**Verdict: Adequate but fragile.**

The 4-step detection cascade (common.cjs lines 1723-1780) works as follows:

1. **Setup command whitelist**: If the Task prompt contains setup keywords, return `NOT_DELEGATION`. This prevents false positives on discover/init/status commands.

2. **subagent_type match**: If `subagent_type` is provided, normalize it and look up the agent's phase in the manifest. This is the most reliable path because `subagent_type` is an explicit field set by the Phase-Loop Controller.

3. **Manifest name scan**: Scan the combined prompt+description for exact agent names from the manifest. This has false positive risk: an agent name like "release-manager" could match prompt text that mentions "release manager" in natural language.

4. **Phase name regex**: Match patterns like `01-requirements` or `phase 06-implementation`. This is a fallback for cases where neither `subagent_type` nor manifest names match. The regex `/(?:phase\s+)?(\d{2})-([a-z][a-z-]*)/i` could match non-delegation text that happens to contain phase-like strings.

Steps 3 and 4 are the fragile paths. In practice, the Phase-Loop Controller always sets `subagent_type` (via the STEP 3d table), so Step 2 handles production traffic. Steps 3 and 4 primarily catch sub-agent calls and edge cases. BUG-0013 was caused by the same-phase bypass not existing, not by detection failure.

---

## 7. Recommendations

### R-1: CRITICAL -- Unify PHASE_AGENT_MAP to a Single Source of Truth

**Priority**: P0 (highest)
**Effort**: LOW (1-2 hours)
**Type**: Bug fix / consistency fix

**Problem**: Three separate maps define phase-to-agent relationships. Map 3 (STEP 3c-prime in isdlc.md) has drifted extensively from Maps 1 and 2.

**Recommendation**:
1. Replace the STEP 3c-prime PHASE_AGENT_MAP in isdlc.md with a reference to the STEP 3d delegation table: "Resolve `active_agent` by looking up the phase key in the PHASE-AGENT table in STEP 3d above."
2. Add the missing `00-quick-scan -> quick-scan-agent` entry to `common.cjs` PHASE_AGENT_MAP.
3. Document that the STEP 3d table in isdlc.md and the `PHASE_AGENT_MAP` in common.cjs are the two canonical sources, and they must match.
4. Add a test in `test-common.test.cjs` that loads both maps (parse isdlc.md STEP 3d table, import common.cjs PHASE_AGENT_MAP) and asserts they are equivalent.

**ADR**:
```
ADR: Consolidate PHASE_AGENT_MAP to a single source of truth
Status: Proposed
Context: Three separate PHASE_AGENT_MAP instances exist with active drift.
         Map 3 (STEP 3c-prime) has 10+ incorrect entries.
Decision: Eliminate Map 3, make STEP 3c-prime reference STEP 3d.
          Add automated consistency test between STEP 3d and common.cjs.
Consequences:
  Positive: Eliminates drift risk, corrects active_agent metadata.
  Negative: STEP 3c-prime becomes slightly less self-contained.
```

### R-2: HIGH -- Eliminate active_workflow.phase_status Redundancy

**Priority**: P1
**Effort**: MEDIUM (3-4 hours)
**Type**: Refactoring

**Problem**: `active_workflow.phase_status[key]` is a redundant copy of `phases[key].status`. Both must be synchronized on every transition, and failure to synchronize causes BUG-0005-class defects.

**Recommendation**:
1. Stop writing to `active_workflow.phase_status` in STEP 3c-prime and STEP 3e.
2. Add a backward-compatibility read helper in common.cjs that derives `phase_status` from `phases`:
   ```javascript
   function getPhaseStatus(state, phaseKey) {
       return state.phases?.[phaseKey]?.status || 'pending';
   }
   ```
3. Any code that reads `active_workflow.phase_status[key]` should be redirected to `getPhaseStatus()`.
4. Keep `active_workflow.phase_status` populated for backward compatibility during a deprecation period, but document it as deprecated.

**Risk**: Low. All hooks already read from `phases[key].status` for detailed data. The `phase_status` map is read by the Phase-Loop Controller (prose) for display purposes only.

### R-3: HIGH -- Extract activatePhase() and completePhase() Helpers

**Priority**: P1
**Effort**: MEDIUM (2-3 hours)
**Type**: Refactoring for testability

**Problem**: STEP 3c-prime and STEP 3e define 7-field and 5-field write sequences as prose. These cannot be unit-tested.

**Recommendation**: Add two functions to common.cjs:

```javascript
/**
 * Activate a phase: write all required state fields for STEP 3c-prime.
 * @param {object} state - State object to mutate
 * @param {string} phaseKey - Phase key to activate
 * @param {string} agentName - Agent name from PHASE_AGENT_MAP
 * @returns {object} Mutated state
 */
function activatePhase(state, phaseKey, agentName) {
    // Location 1: detailed phases object
    if (!state.phases[phaseKey]) {
        state.phases[phaseKey] = { status: 'pending', started: null, completed: null, gate_passed: null, artifacts: [] };
    }
    state.phases[phaseKey].status = 'in_progress';
    if (!state.phases[phaseKey].started) {
        state.phases[phaseKey].started = new Date().toISOString();
    }
    // Location 2: active_workflow
    state.active_workflow.current_phase = phaseKey;
    state.active_workflow.phase_status[phaseKey] = 'in_progress';
    // Location 3: top-level backward compat
    state.current_phase = phaseKey;
    state.active_agent = agentName;
    return state;
}

/**
 * Complete a phase: write all required state fields for STEP 3e.
 * @param {object} state - State object to mutate
 * @param {string} phaseKey - Phase key to complete
 * @param {string} summary - Phase summary (max 150 chars)
 * @returns {object} Mutated state
 */
function completePhase(state, phaseKey, summary) {
    state.phases[phaseKey].status = 'completed';
    state.phases[phaseKey].summary = (summary || '').substring(0, 150);
    state.active_workflow.current_phase_index += 1;
    state.active_workflow.phase_status[phaseKey] = 'completed';
    return state;
}
```

Then update STEP 3c-prime and STEP 3e prose to reference these functions: "Apply `activatePhase(state, phaseKey, agentName)` from common.cjs, then call `writeState(state)`."

These helpers can be directly unit-tested with full assertions on all modified fields.

### R-4: MEDIUM -- Remove Duplicate loadIterationRequirements() Definitions

**Priority**: P2
**Effort**: LOW (30 minutes)
**Type**: Dead code removal

**Problem**: 4 hooks define their own `loadIterationRequirements()` that duplicates `common.cjs`. Under the dispatcher, `ctx.requirements` is always populated, making the local fallbacks dead code.

**Recommendation**: Remove local `loadIterationRequirements()` from gate-blocker.cjs, iteration-corridor.cjs, test-watcher.cjs, and constitution-validator.cjs. Each hook already imports from common.cjs as a fallback; the triple-fallback chain (`ctx.requirements || loadIterationRequirementsFromCommon() || loadIterationRequirements()`) can be simplified to `ctx.requirements || loadIterationRequirementsFromCommon()`.

### R-5: MEDIUM -- Consolidate STATE_JSON_PATTERN to common.cjs Import

**Priority**: P2
**Effort**: LOW (15 minutes)
**Type**: Dead code removal

**Problem**: `STATE_JSON_PATTERN` is defined in 3 files. `common.cjs` exports it; `state-write-validator.cjs` and `workflow-completion-enforcer.cjs` define their own copies.

**Recommendation**: Replace local definitions with imports from common.cjs. The `state-file-guard.cjs` already does this correctly.

### R-6: MEDIUM -- Add V9 Rule for Cross-Location Consistency Validation

**Priority**: P2
**Effort**: MEDIUM (1-2 hours)
**Type**: New validation rule

**Problem**: No automated check verifies that `active_workflow.phase_status[key]` and `phases[key].status` agree after a state write.

**Recommendation**: Add a V9 rule to `state-write-validator.cjs` that, for each phase in `active_workflow.phase_status`, verifies that the corresponding `phases[key].status` matches. Emit a warning (not block) on mismatch, since the divergence might be a transient mid-write state. Log to hook-activity.log for diagnosis.

This provides observational detection of the triple-redundancy synchronization failure mode without introducing false positives.

### R-7: LOW -- Fix writeState() JSDoc Claim

**Priority**: P3
**Effort**: LOW (5 minutes)
**Type**: Documentation fix

**Problem**: The JSDoc says writeState "does NOT mutate the caller's object" but the shallow copy only prevents `state_version` from leaking. Nested objects are shared references.

**Recommendation**: Update the JSDoc to accurately describe the behavior: "Creates a shallow copy to set `state_version` without mutating the caller's top-level `state_version` field. Nested objects (phases, active_workflow) are shared references and WILL reflect mutations made before the write."

Alternatively, switch to `JSON.parse(JSON.stringify(state))` for a true deep copy. The performance cost (~0.5ms for a typical state.json) is negligible within the 100ms hook budget.

---

## 8. Build Workflow Assessment

### Does This Need a Full iSDLC Build Workflow?

**No.** The issues identified are localized and do not require new architecture, new components, or cross-cutting redesign. They fall into three categories:

1. **Data correction** (R-1): Fix PHASE_AGENT_MAP drift -- a simple text edit in isdlc.md
2. **Dead code removal** (R-4, R-5, R-7): Remove duplicated functions and fix documentation
3. **Targeted refactoring** (R-2, R-3, R-6): Extract helpers, add validation rule

### Recommended Approach

| Recommendation | Suggested Approach |
|---------------|-------------------|
| R-1 (PHASE_AGENT_MAP drift) | `/isdlc fix` -- this is a bug: state metadata is incorrect |
| R-2 (phase_status redundancy) | `/isdlc feature` -- refactoring with backward-compat consideration |
| R-3 (activatePhase/completePhase) | Bundle with R-2 as same feature workflow |
| R-4 (duplicate loaders) | Direct fix, no workflow needed (simple deletion) |
| R-5 (duplicate regex) | Direct fix, no workflow needed (simple import change) |
| R-6 (V9 validation rule) | `/isdlc feature` -- new hook rule with tests |
| R-7 (writeState JSDoc) | Direct fix, no workflow needed (documentation only) |

**Suggested prioritization**:
1. Fix R-1 immediately (P0, prevents incorrect metadata from accumulating)
2. Bundle R-2 + R-3 into a single refactoring workflow (P1, reduces triple-redundancy debt)
3. Apply R-4, R-5, R-7 as quick cleanup fixes (P2, no workflow needed)
4. Implement R-6 as a separate small feature (P2, adds observational safety)

---

## 9. Cross-Reference to Investigation Requirements

| IR | Architectural Finding | Recommendation |
|----|----------------------|----------------|
| IR-001 (State field sync) | Triple redundancy creates sync burden; W-3 documents the liability | R-2: Eliminate phase_status redundancy |
| IR-002 (STEP 3c-prime) | Prose-based, not unit-testable; W-2 documents the gap | R-3: Extract activatePhase() helper |
| IR-003 (STEP 3e) | BUG-0006 fix is architecturally sound (S-5); prose still untestable | R-3: Extract completePhase() helper |
| IR-004 (Gate validation) | Defense-in-depth (S-3) is solid; gate-blocker well-tested | No architectural change needed |
| IR-005 (Phase read priority) | BUG-0005 fix applied consistently; hooks converge on active_workflow | No architectural change needed |
| IR-006 (Intra-phase bypass) | BUG-0013 fix is clean; detectPhaseDelegation() adequate (Section 6.4) | No architectural change needed |
| IR-007 (Artifact passing) | Implicit file system convention; no structural weakness found | No architectural change needed |
| IR-008 (Workflow init) | Orchestrator init is straightforward; relies on resetPhasesForWorkflow() | R-1: Fix PHASE_AGENT_MAP drift |
| IR-009 (Phase skipping) | Variable-length phases work with current index arithmetic | No architectural change needed |
| IR-010 (Workflow completion) | Fragile reconstruction pattern (W-7); low severity | No immediate action; monitor |
| IR-011 (State version) | V7 rule is sound; writeState() shallow copy misleading (W-4) | R-7: Fix JSDoc |
| IR-012 (V8 protection) | Regression detection is architecturally sound | No architectural change needed |
| IR-013 (Iteration corridor) | Corridor enforcement is well-designed and well-tested | No architectural change needed |

---

## 10. Conclusion

The phase handshake architecture is fundamentally sound. The core design decisions -- dispatcher consolidation, defense-in-depth hooks, fail-open behavior, and the BUG-0006 separation between completion and activation -- are well-reasoned and effective. The system has been stress-tested by real usage and three prior bug fixes.

The primary weaknesses are not in the design itself but in implementation drift and technical debt:

1. **Map drift** (W-1): A configuration management failure, not an architectural one. Fix is mechanical.
2. **State redundancy** (W-3): An early design decision that has not been rationalized. The framework has evolved past the need for triple-redundancy. Consolidation would simplify future maintenance.
3. **Testability gap** (W-2): An inherent limitation of prose-based controllers. Mitigatable through extracted helpers.
4. **Dead code** (W-5, W-6): Artifacts of the pre-dispatcher era. Straightforward removal.

None of these weaknesses require architectural redesign. They are addressable through targeted fixes that preserve the existing architecture while reducing its maintenance burden.

---

## Appendix A: Files Analyzed

| File | LOC | Role |
|------|-----|------|
| `src/claude/commands/isdlc.md` | ~2000+ | Phase-Loop Controller (STEP 3a-3e) |
| `src/claude/hooks/lib/common.cjs` | 3,458 | State management, detection, normalization |
| `src/claude/hooks/dispatchers/pre-task-dispatcher.cjs` | 222 | PreToolUse[Task] dispatcher (9 hooks) |
| `src/claude/hooks/phase-loop-controller.cjs` | 159 | Progress tracking enforcement |
| `src/claude/hooks/phase-sequence-guard.cjs` | 149 | Phase ordering enforcement |
| `src/claude/hooks/gate-blocker.cjs` | 926 | Gate requirement validation |
| `src/claude/hooks/iteration-corridor.cjs` | 429 | Corridor enforcement |
| `src/claude/hooks/state-write-validator.cjs` | 497 | Write validation (V1-V8) |
| `src/claude/hooks/workflow-completion-enforcer.cjs` | 271 | Completion detection and remediation |
| `src/claude/hooks/delegation-gate.cjs` | 223 | Delegation verification (stop hook) |
| `src/claude/agents/00-sdlc-orchestrator.md` | ~1500+ | Workflow initialization and finalization |
