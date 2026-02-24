# Requirements Specification: Phase Handshake Audit (GH-55)

**Investigation ID**: GH-55
**Type**: Audit / Investigation
**Scope**: Phase-to-phase state transitions, artifact passing, gate validation
**Created**: 2026-02-20
**Status**: Draft

---

## 1. Executive Summary

This specification defines what must be verified to confirm that the phase handshake mechanism -- the coordination of state transitions, artifact passing, and gate validation between sequential SDLC phases -- is operating correctly. The investigation scope covers ~65 files across hooks, dispatchers, the Phase-Loop Controller (`isdlc.md`), and the orchestrator (`00-sdlc-orchestrator.md`).

Three prior bugs (BUG-0005, BUG-0006, BUG-0013) have already addressed specific handshake failures. This audit verifies whether the fixes are complete, whether additional gaps remain, and whether the mechanism is resilient under edge cases.

---

## 2. Investigation Requirements

### IR-001: State Field Synchronization at Phase Boundaries

**What to verify**: At every phase transition (Phase N completes, Phase N+1 begins), all three redundant state tracking locations must be consistent.

**state.json fields to audit**:

| Field | Location | Writer | Expected Value After N Completes |
|-------|----------|--------|----------------------------------|
| `phases[N].status` | Top-level `phases` object | STEP 3e (line 2-3) | `"completed"` |
| `phases[N].summary` | Top-level `phases` object | STEP 3e (line 3) | Non-empty string (max 150 chars) |
| `active_workflow.phase_status[N]` | `active_workflow` map | STEP 3e (line 5) | `"completed"` |
| `active_workflow.current_phase` | `active_workflow` | STEP 3c-prime (line 3) | Phase N+1 key |
| `active_workflow.current_phase_index` | `active_workflow` | STEP 3e (line 4) | Previous value + 1 |
| `current_phase` | Top-level | STEP 3c-prime (line 5) | Phase N+1 key |
| `active_agent` | Top-level | STEP 3c-prime (line 6) | Agent for Phase N+1 |
| `phases[N+1].status` | Top-level `phases` object | STEP 3c-prime (line 1) | `"in_progress"` |
| `active_workflow.phase_status[N+1]` | `active_workflow` map | STEP 3c-prime (line 4) | `"in_progress"` |

**Acceptance Criteria**:
- AC-001a: After STEP 3e completes for Phase N, `phases[N].status` == `"completed"` AND `active_workflow.phase_status[N]` == `"completed"`. Both locations agree.
- AC-001b: After STEP 3c-prime runs for Phase N+1, `phases[N+1].status` == `"in_progress"` AND `active_workflow.phase_status[N+1]` == `"in_progress"` AND `active_workflow.current_phase` == Phase N+1 key AND top-level `current_phase` == Phase N+1 key. All four locations agree.
- AC-001c: `active_workflow.current_phase_index` is monotonically increasing and equals the 0-based index of the current phase in the `phases[]` array.
- AC-001d: Top-level `active_agent` matches the PHASE_AGENT_MAP entry for the current phase key.
- AC-001e: No intermediate state exists where `active_workflow.current_phase` disagrees with `phases[current].status` (i.e., current_phase points to X but phases[X].status is `"pending"`).

**Risk**: BUG-0005 established that hooks read from `active_workflow.current_phase` as primary, falling back to top-level `current_phase`. If STEP 3e writes `active_workflow.phase_status[N]` = `"completed"` but fails before writing to `phases[N].status`, the detailed phases object would be stale. Hooks reading from `phases[current_phase]` for iteration requirements and gate validation would see outdated data.

---

### IR-002: Pre-Delegation State Write Ordering (STEP 3c-prime)

**What to verify**: The pre-delegation state write occurs atomically before the Task tool delegation, and all 7 fields are written in the correct order.

**Expected write sequence (from isdlc.md STEP 3c-prime)**:
1. `phases[phase_key].status` = `"in_progress"` (detailed phases object)
2. `phases[phase_key].started` = ISO-8601 timestamp (only if not already set)
3. `active_workflow.current_phase` = `phase_key`
4. `active_workflow.phase_status[phase_key]` = `"in_progress"`
5. Top-level `current_phase` = `phase_key`
6. Top-level `active_agent` = agent name (from PHASE_AGENT_MAP)
7. Write to disk

**Acceptance Criteria**:
- AC-002a: All 7 fields are written before the Task tool delegation fires.
- AC-002b: The `phase-loop-controller.cjs` hook reads `phases[phase_key].status` and finds `"in_progress"` at the time of delegation.
- AC-002c: The `phase-sequence-guard.cjs` hook reads `active_workflow.current_phase` and finds it matches the delegation target.
- AC-002d: On retries, `phases[phase_key].started` preserves the original timestamp.
- AC-002e: `phases[phase_key].timing.started_at` is initialized on first run and `timing.retries` is incremented on subsequent runs.
- AC-002f: The state write is a single `writeState()` call (not multiple partial writes).

**Risk**: BUG-0006 root cause was that STEP 3e originally performed next-phase activation, creating a window where the phase was active but `phases[].status` was `"pending"`. The fix moved activation to STEP 3c-prime. Verify this fix is complete and no residual next-phase writes remain in STEP 3e.

---

### IR-003: Post-Phase State Update (STEP 3e)

**What to verify**: After a phase agent returns, STEP 3e correctly marks the phase as completed, increments the index, and does NOT perform next-phase activation (which was moved to STEP 3c-prime per BUG-0006).

**Expected write sequence (from isdlc.md STEP 3e)**:
1. Read `state.json`
2. `phases[phase_key].status` = `"completed"`
3. `phases[phase_key].summary` = extracted from agent result (max 150 chars)
4. `active_workflow.current_phase_index` += 1
5. `active_workflow.phase_status[phase_key]` = `"completed"`
6. If more phases remain: NO action (next iteration's 3c-prime handles activation)
7. Write `state.json`
8. Update `docs/isdlc/tasks.md` (if exists)

**Acceptance Criteria**:
- AC-003a: STEP 3e does NOT set `phases[next_phase].status` to `"in_progress"` (BUG-0006 FR-02 AC-02a).
- AC-003b: STEP 3e does NOT set `active_workflow.phase_status[next_phase]` to `"in_progress"` (BUG-0006 FR-02 AC-02b).
- AC-003c: STEP 3e does NOT set `active_workflow.current_phase` to the next phase key (BUG-0006 FR-02 AC-02c).
- AC-003d: STEP 3e does NOT set top-level `current_phase` or `active_agent` to next-phase values (BUG-0006 FR-02 AC-02d).
- AC-003e: STEP 3e DOES increment `active_workflow.current_phase_index` (BUG-0006 FR-02 AC-02e).
- AC-003f: After STEP 3e writes, `state_version` is incremented by `writeState()`.
- AC-003g: `phases[phase_key].timing.completed_at` is set and `wall_clock_minutes` is computed.

**Risk**: If STEP 3e accidentally retains any next-phase activation logic from the pre-BUG-0006 era, both STEP 3e and the next iteration's STEP 3c-prime would write to the same fields, causing double-writes and potential race conditions.

---

### IR-004: Gate Validation Before Phase Transition

**What to verify**: The gate-blocker hook correctly validates iteration requirements (test_iteration, constitutional_validation, interactive_elicitation, artifact_validation, agent_delegation) before allowing gate advancement, and blocked gates prevent STEP 3e from executing.

**state.json fields read by gate-blocker**:
- `phases[currentPhase].iteration_requirements.test_iteration` -- test pass/fail state
- `phases[currentPhase].constitutional_validation` -- constitutional compliance state
- `phases[currentPhase].iteration_requirements.interactive_elicitation` -- menu interaction count
- `phases[currentPhase].gate_validation` -- gate validation status

**Acceptance Criteria**:
- AC-004a: If `test_iteration.completed` is false and `test_iteration.last_test_result` is `"failed"`, the gate-blocker blocks advancement.
- AC-004b: If `constitutional_validation.completed` is false and `constitutional_validation.status` is not `"escalated"`, the gate-blocker blocks advancement.
- AC-004c: If `interactive_elicitation.completed` is false and `interactive_elicitation.menu_interactions` < 1, the gate-blocker blocks advancement.
- AC-004d: Gate-blocker correctly distinguishes phase delegations from gate advancement attempts (BUG-0008 fix: `detectPhaseDelegation()` guard prevents false positives).
- AC-004e: Setup commands (discover, constitution, init, setup, configure, status) are never blocked by gate validation.
- AC-004f: The gate-blocker reads `currentPhase` from `active_workflow.current_phase` first, falling back to top-level `current_phase` (BUG-0005 fix).
- AC-004g: Schema validation (V1, V2, V3 in state-write-validator) catches impossible state combinations: completed=true with iterations_used=0 or current_iteration=0.

**Risk**: If the gate-blocker reads from `phases[stalePhase]` due to a BUG-0005-style read priority issue, it may validate against the wrong phase's data.

---

### IR-005: Phase Read Priority Consistency Across All Hooks

**What to verify**: All hooks that read the current phase use the correct priority order: `active_workflow.current_phase` (primary) -> `current_phase` (fallback). This was the BUG-0005 fix, applied to 6 hooks.

**Hooks to audit** (all must use correct read priority):

| Hook | BUG-0005 Fixed | Read Pattern |
|------|----------------|--------------|
| `phase-loop-controller.cjs` | Pre-existing correct | `state.active_workflow.current_phase` (line 62) |
| `phase-sequence-guard.cjs` | Pre-existing correct | `state.active_workflow.current_phase` (line 58) |
| `iteration-corridor.cjs` | Pre-existing correct | `(activeWorkflow && activeWorkflow.current_phase) \|\| state.current_phase` (line 260) |
| `constitution-validator.cjs` | Fixed in BUG-0005 | Must read from `active_workflow.current_phase` first |
| `delegation-gate.cjs` | Fixed in BUG-0005 | `(state.active_workflow && state.active_workflow.current_phase) \|\| state.current_phase` (line 153) |
| `log-skill-usage.cjs` | Fixed in BUG-0005 | Must read from `active_workflow.current_phase` first |
| `skill-validator.cjs` | Fixed in BUG-0005 | Must read from `active_workflow.current_phase` first |
| `gate-blocker.cjs` | Fixed in BUG-0005 | Must read from `active_workflow.current_phase` first |
| `provider-utils.cjs` | Fixed in BUG-0005 | Must read from `active_workflow.current_phase` first |
| `workflow-completion-enforcer.cjs` | Not in BUG-0005 scope | Reads `state.active_workflow` directly |
| `state-write-validator.cjs` | Not in BUG-0005 scope | Observational only, reads from parsed content |
| `test-watcher.cjs` | Not in BUG-0005 scope | Must be verified |
| `menu-tracker.cjs` | Not in BUG-0005 scope | Must be verified |

**Acceptance Criteria**:
- AC-005a: All 6 hooks fixed in BUG-0005 retain the correct read priority.
- AC-005b: No hook reads from top-level `current_phase` as primary source when `active_workflow` exists.
- AC-005c: Hooks not in BUG-0005 scope (test-watcher, menu-tracker) are verified to use correct read priority or documented as not needing it.
- AC-005d: The `normalizePhaseKey()` function is applied consistently wherever phase keys are read (self-healing for alias mismatches like `13-test-deploy` -> `12-test-deploy`).

---

### IR-006: Intra-Phase vs Cross-Phase Delegation (BUG-0013 Bypass)

**What to verify**: The same-phase bypass in `phase-loop-controller.cjs` correctly allows sub-agent Task calls within the active phase while still blocking out-of-order cross-phase delegations.

**Mechanism**:
- `detectPhaseDelegation(input)` resolves sub-agents (e.g., `symptom-analyzer`, `execution-path-tracer`) to their parent phase via `normalizeAgentName()` + `getAgentPhase()`.
- If `delegation.targetPhase === active_workflow.current_phase`, the call is intra-phase and allowed.
- If `delegation.targetPhase !== active_workflow.current_phase`, normal blocking logic applies.

**Acceptance Criteria**:
- AC-006a: Sub-agent calls (T1/T2/T3 in tracing, M1/M2/M3 in impact analysis) within the active phase are allowed.
- AC-006b: Cross-phase delegation attempts are still blocked when target phase status is `"pending"`.
- AC-006c: The bypass logs a `same-phase-bypass` event in hook-activity.log.
- AC-006d: `phase-sequence-guard.cjs` also allows same-phase delegations (line 71: `targetPhase === currentPhase` check).
- AC-006e: The `detectPhaseDelegation()` function correctly maps all sub-agent names to their parent phase via the skills manifest `ownership` section.

**Risk**: If a sub-agent name is not registered in the manifest's `ownership` map, `detectPhaseDelegation()` may fall through to the phase-name pattern match (Step 4), which could produce incorrect results for agent names that contain phase-like substrings.

---

### IR-007: Artifact Passing Between Phases

**What to verify**: Phase N's output artifacts are accessible to Phase N+1, and the passing mechanism (file system paths + delegation prompt context) is reliable.

**Artifact passing methods**:
1. **File system (primary)**: Artifacts written to `docs/requirements/{artifact_folder}/`, `docs/architecture/{artifact_folder}/`, etc.
2. **Delegation prompt context**: Phase-Loop Controller includes `artifact_folder` in the Task prompt.
3. **state.json fields**: Some artifacts recorded in `phases[N].artifacts[]`, `active_workflow.files_modified`, etc.
4. **Discovery context injection**: Phases 02-03 receive discovery context from state.json with 24h staleness check.

**Acceptance Criteria**:
- AC-007a: The `artifact_folder` value in state.json (`active_workflow.artifact_folder`) is included in every phase delegation prompt.
- AC-007b: Each phase agent can resolve the artifact path from the folder name and its own docs subdirectory.
- AC-007c: Discovery context is injected for phases 02 and 03 only, with staleness warning if >24h old.
- AC-007d: No phase agent assumes artifacts exist without checking -- fail-open if predecessor artifacts are missing.
- AC-007e: Monorepo artifact paths are correctly scoped to the project (`docs/{project-id}/requirements/` or `{project-path}/docs/requirements/`).

**Risk**: Artifact passing is implicit (file system convention) rather than explicit (typed contract). If a phase agent writes to an unexpected path or uses a different naming convention, the downstream phase will not find the artifacts and may either fail or produce incomplete output.

---

### IR-008: Workflow Initialization Consistency

**What to verify**: The orchestrator's workflow initialization (STEP 4 in `00-sdlc-orchestrator.md`) correctly sets up all state fields that STEP 3c-prime and STEP 3e depend on.

**Initialization fields**:
- `active_workflow.type` (feature, fix, upgrade, test-run, test-generate)
- `active_workflow.phases[]` (ordered array of phase keys)
- `active_workflow.current_phase` = first phase key
- `active_workflow.current_phase_index` = 0
- `active_workflow.phase_status` = { first: "in_progress", rest: "pending" }
- Top-level `phases[key]` = `{ status: "pending", started: null, completed: null, gate_passed: null, artifacts: [] }` for each phase
- Top-level `current_phase` = first phase key

**Acceptance Criteria**:
- AC-008a: `active_workflow.phases[]` contains exactly the phases defined by the workflow type.
- AC-008b: `active_workflow.phase_status` has entries for all phases in the array, with the first set to `"in_progress"` and all others set to `"pending"`.
- AC-008c: `active_workflow.current_phase_index` = 0.
- AC-008d: `phases` object (top-level) is reset via `resetPhasesForWorkflow()` -- stale phases from previous workflows are removed.
- AC-008e: `current_phase` (top-level) matches `active_workflow.current_phase`.
- AC-008f: Adaptive sizing (REQ-0011) may shorten the phases array; initialization must work with variable-length phase arrays.

---

### IR-009: Phase Skipping and Variable-Length Workflows

**What to verify**: When phases are skipped (e.g., `16-quality-loop` for light scope), the `current_phase_index` correctly advances to the next non-skipped phase, and hooks handle gaps in the phases array.

**Acceptance Criteria**:
- AC-009a: `active_workflow.phases[]` only contains phases that will execute (skipped phases are excluded from the array).
- AC-009b: `current_phase_index` always indexes into the `phases[]` array, not into a full phase list.
- AC-009c: `phases` (top-level) only has entries for phases in the current workflow (stale entries removed by `resetPhasesForWorkflow()`).
- AC-009d: If adaptive sizing removes a phase mid-workflow (REQ-0011), the remaining phases still transition correctly.
- AC-009e: `PHASE_KEY_ALIASES` in `normalizePhaseKey()` handles legacy keys (e.g., `13-test-deploy` -> `12-test-deploy`) and does not create index mismatches.

**Risk**: If `current_phase_index` gets out of sync with the `phases[]` array length -- for example, due to a mid-workflow phase removal -- the loop termination condition (`next_phase_index >= phases.length`) may either terminate early or index out of bounds.

---

### IR-010: Workflow Completion Detection

**What to verify**: The `workflow-completion-enforcer.cjs` hook correctly detects when all phases are complete and the finalize step is triggered.

**Detection logic in the Phase-Loop Controller**:
- After STEP 3e increments `current_phase_index`, if `current_phase_index >= phases.length`, the workflow is complete.
- The Phase-Loop Controller delegates to the orchestrator in `finalize` mode.
- The orchestrator archives `active_workflow` to `workflow_history[]`, sets `active_workflow = null`, and runs cleanup.

**Acceptance Criteria**:
- AC-010a: When the last phase completes, `current_phase_index` equals `phases.length` (one past the end).
- AC-010b: The finalize mode delegation includes `collectPhaseSnapshots()` output.
- AC-010c: `workflow_history[]` entry includes `phases` array, `phase_snapshots`, `metrics`, `started_at`, `completed_at`.
- AC-010d: `active_workflow` is set to `null` after finalization.
- AC-010e: `workflow-completion-enforcer.cjs` auto-remediates if the history entry is missing `phase_snapshots` or `metrics` (within 2-minute staleness window).
- AC-010f: Pruning functions (`pruneSkillUsageLog`, `pruneCompletedPhases`, `pruneHistory`, `pruneWorkflowHistory`) run after finalization without corrupting state.

---

### IR-011: State Version Integrity (Optimistic Locking)

**What to verify**: The `writeState()` function in `common.cjs` correctly increments `state_version` on each write, and the `state-write-validator.cjs` V7 rule blocks stale writes.

**Mechanism**:
- `writeState(state)` reads current `state_version` from disk, creates a shallow copy, sets `state_version = current + 1`, writes to disk.
- V7 rule: incoming `state_version` must be >= disk `state_version`. Blocks if incoming < disk.

**Acceptance Criteria**:
- AC-011a: Every call to `writeState()` increments `state_version` by exactly 1.
- AC-011b: `writeState()` does not mutate the caller's state object (uses shallow copy).
- AC-011c: V7 blocks writes where `incoming.state_version < disk.state_version`.
- AC-011d: V7 allows writes where `incoming.state_version >= disk.state_version`.
- AC-011e: V7 is backward compatible -- allows if either version is missing/null.
- AC-011f: No race condition between STEP 3c-prime write and the hook system reading state mid-write (single-process, single-thread model).

**Risk**: `writeState()` performs a read-modify-write cycle on `state_version`. If two processes call `writeState()` concurrently (which should not happen in current single-process architecture, but could in future monorepo parallel workflows), the version increment could produce duplicates.

---

### IR-012: Phase Orchestration Field Protection (V8)

**What to verify**: The `state-write-validator.cjs` V8 rule blocks phase status regressions and phase index regressions.

**V8 detection rules**:
- `current_phase_index` in incoming < disk = regression (blocked)
- Any `phase_status[key]` going from higher ordinal to lower (e.g., `"completed"` -> `"pending"`) = regression (blocked)
- Status ordinal: `pending` = 0, `in_progress` = 1, `completed` = 2

**Acceptance Criteria**:
- AC-012a: V8 blocks `current_phase_index` regression (e.g., agent writes index 2 when disk has index 3).
- AC-012b: V8 blocks `phase_status` regression (e.g., agent writes phase as `"pending"` when disk has `"completed"`).
- AC-012c: V8 only applies to Write events (Edit events are skipped).
- AC-012d: V8 is backward compatible -- allows if fields are missing in either incoming or disk.
- AC-012e: The `PHASE_STATUS_ORDINAL` map handles all valid statuses: `pending`, `in_progress`, `completed`.

---

### IR-013: Iteration Corridor Enforcement During Phase Execution

**What to verify**: The `iteration-corridor.cjs` hook correctly restricts agent actions during active iteration states (TEST_CORRIDOR, CONST_CORRIDOR) and does not inadvertently block legitimate phase work.

**Acceptance Criteria**:
- AC-013a: When `test_iteration.last_test_result` == `"failed"`, the TEST_CORRIDOR blocks Task calls with advance/delegate keywords.
- AC-013b: When `constitutional_validation.completed` == false and tests are satisfied, the CONST_CORRIDOR blocks Task calls with advance/delegate keywords.
- AC-013c: Non-advance actions (Bash, Read, Write, Edit, Grep) are always allowed within corridors.
- AC-013d: Setup commands are always allowed within corridors.
- AC-013e: Phase delegations detected by `detectPhaseDelegation()` are NOT treated as advance attempts (BUG-0008 fix).
- AC-013f: Corridor state is correctly derived from `phases[currentPhase]` data, not from stale state.

---

## 3. Test Scenarios

### TS-001: Happy Path -- Full Feature Workflow (8 phases)

**Precondition**: Fresh workflow initialized with phases `[01-requirements, 02-impact-analysis, 03-architecture, 04-design, 05-test-strategy, 06-implementation, 16-quality-loop, 08-code-review]`.

**Verify at each boundary**:
1. After orchestrator init: `active_workflow.current_phase` = `"01-requirements"`, `current_phase_index` = 0, `phase_status["01-requirements"]` = `"in_progress"`, all other phases = `"pending"`.
2. After Phase 01 completes: `phase_status["01-requirements"]` = `"completed"`, `current_phase_index` = 1.
3. Before Phase 02 delegation: `phases["02-impact-analysis"].status` = `"in_progress"`, `active_workflow.current_phase` = `"02-impact-analysis"`.
4. (Repeat for each boundary through final phase.)
5. After last phase completes: `current_phase_index` = 8 (= `phases.length`), finalize triggers.

### TS-002: Bug Fix Workflow (4 phases)

**Precondition**: Fix workflow with phases `[02-tracing, 06-implementation, 16-quality-loop, 08-code-review]`.

**Verify**: Shorter phase array works correctly; `current_phase_index` stays within array bounds; finalize triggers at index 4.

### TS-003: Phase Agent With Sub-Agents (BUG-0013 Scenario)

**Precondition**: Phase `02-tracing` is active. Tracing-orchestrator spawns T1 (trace-code-analyzer), T2 (execution-path-tracer), T3 (trace-synthesizer).

**Verify**:
- `phase-loop-controller.cjs` allows all three sub-agent Task calls (same-phase bypass).
- `phase-sequence-guard.cjs` allows all three (target phase matches current).
- A cross-phase delegation attempt (e.g., to `06-implementation` agent) is blocked.

### TS-004: Gate Validation Failure -- Test Iteration

**Precondition**: Phase `06-implementation`, test iteration enabled, `test_iteration.last_test_result` = `"failed"`, `current_iteration` = 2, `max_iterations` = 5.

**Verify**:
- Gate-blocker blocks advancement.
- Iteration-corridor blocks Task calls with advance keywords.
- Agent can still run Bash (test commands), Write/Edit (fix code), Read.
- After tests pass and `completed` = true, gate-blocker allows advancement.

### TS-005: Gate Validation Failure -- Constitutional Validation

**Precondition**: Phase `01-requirements`, constitutional validation enabled, `status` = `"in_progress"`, `iterations_used` = 1, `max_iterations` = 5.

**Verify**: Same pattern as TS-004 but for CONST_CORRIDOR.

### TS-006: Stale Phase Read (BUG-0005 Regression Test)

**Precondition**: `active_workflow.current_phase` = `"03-architecture"`, but top-level `current_phase` is stale at `"01-requirements"` (simulating incomplete sync).

**Verify**:
- All hooks read `"03-architecture"` (from `active_workflow.current_phase`).
- No hook reads `"01-requirements"` as the current phase.
- Gate validation checks against Phase 03 data, not Phase 01.

### TS-007: Pre-Delegation Write Failure (STEP 3c-prime Partial Failure)

**Precondition**: STEP 3c-prime writes state but the write to disk fails (simulated I/O error).

**Verify**:
- `phase-loop-controller.cjs` blocks the delegation (phase status is still `"pending"`).
- The Phase-Loop Controller receives the block message and can retry.
- No partial state corruption on disk.

### TS-008: Phase Key Alias Normalization

**Precondition**: Workflow contains `13-test-deploy` (legacy key). `normalizePhaseKey()` should map this to `12-test-deploy`.

**Verify**:
- Iteration requirements are loaded for `12-test-deploy` (canonical key).
- Gate validation checks against `12-test-deploy` requirements.
- No "missing requirements" self-heal messages for the legacy key.

### TS-009: Concurrent State Writes (Write Version Conflict)

**Precondition**: State version on disk = 5. An agent attempts to write with `state_version` = 3 (stale read).

**Verify**:
- V7 rule blocks the write.
- Error message instructs the agent to re-read state.json.
- State on disk is unchanged (version 5).

### TS-010: Phase Status Regression Protection

**Precondition**: `phase_status["01-requirements"]` = `"completed"` on disk. An agent attempts to write `phase_status["01-requirements"]` = `"pending"`.

**Verify**:
- V8 rule blocks the write.
- Error message identifies the status regression.
- State on disk is unchanged.

### TS-011: Workflow Completion and History Archival

**Precondition**: All 8 phases completed. Phase-Loop Controller triggers finalize.

**Verify**:
- `collectPhaseSnapshots()` produces snapshots for all 8 phases.
- `workflow_history[]` entry has `phase_snapshots`, `metrics`, `phases` array.
- `active_workflow` is set to `null`.
- Pruning functions run without corruption.
- `workflow-completion-enforcer.cjs` does not trigger remediation (snapshots already present).

### TS-012: Monorepo State Isolation

**Precondition**: Monorepo with two projects (`api-service`, `web-frontend`). `api-service` has an active workflow at Phase 03. `web-frontend` has no active workflow.

**Verify**:
- State reads for `api-service` resolve to `.isdlc/projects/api-service/state.json`.
- State reads for `web-frontend` resolve to `.isdlc/projects/web-frontend/state.json`.
- Hook enforcement for `api-service` does not affect `web-frontend`.
- Artifact paths for `api-service` are correctly scoped.

### TS-013: Artifact Passing Chain Verification

**Precondition**: Full feature workflow. Phase 01 produces `requirements-spec.md`. Phase 02 needs to read it.

**Verify**:
- Phase 02 delegation prompt includes `artifact_folder` value.
- Phase 02 agent can read `docs/requirements/{artifact_folder}/requirements-spec.md`.
- If artifact is missing, Phase 02 continues with a warning (fail-open).

### TS-014: Supervised Review Gate at Phase Boundary

**Precondition**: Supervised mode enabled. Phase 01 completes.

**Verify**:
- STEP 3e-review fires after post-phase state update.
- Review gate banner is presented to user.
- User can select [C] Continue, [R] Review, or [D] Redo.
- On [D] Redo, the phase re-executes (3c-prime re-runs, timing.retries increments).
- On [C] Continue, next phase activates normally.

### TS-015: Escalation Handling at Phase Boundary

**Precondition**: `pending_escalations[]` has entries from a previous hook block. STEP 3b reads escalations.

**Verify**:
- Blocker banner is displayed (STEP 3c).
- User options: Retry, Skip (override), Cancel.
- On Retry: escalations cleared, phase re-run.
- On Skip: escalations cleared, task completed, next phase starts.
- On Cancel: orchestrator cancel mode, workflow archived.

---

## 4. Known Risks and Edge Cases

### Risk-001: Triple Redundancy in Phase Tracking

**Description**: Phase status is tracked in three locations: `active_workflow.phase_status[]`, `phases[].status`, and `active_workflow.current_phase`. This redundancy was inherited from early design and partially addressed in BUG-0005. Any future code change that updates one location but not the others will reintroduce staleness.

**Mitigation**: Consider consolidating to a single source of truth (`active_workflow.phase_status`) with computed derivations for backward compatibility. Short-term: add automated consistency checks in `state-write-validator.cjs` to detect divergence.

### Risk-002: Non-Atomic State Writes

**Description**: STEP 3c-prime and STEP 3e update multiple fields in a single `writeState()` call. The write itself is atomic (single `fs.writeFileSync`), but the state construction is not -- if the Phase-Loop Controller crashes between reading state and writing it, partial state may result.

**Mitigation**: The current single-process, single-thread model makes this unlikely. However, future parallel workflow support (BACKLOG #30) would need to address this with file locking or atomic rename patterns.

### Risk-003: PHASE_AGENT_MAP Drift

**Description**: Two separate agent maps exist: one in STEP 3c-prime (for `active_agent` resolution) and one in STEP 3d (for delegation). If these drift apart, `active_agent` may not match the agent that actually executes.

**Mitigation**: Audit both maps for consistency. Consider extracting to a single source (e.g., `workflows.json` or the skills manifest).

### Risk-004: detectPhaseDelegation False Negatives

**Description**: `detectPhaseDelegation()` relies on four detection steps: subagent_type match, manifest scan, and phase-name regex. If a new agent is added but not registered in the manifest, the function may return `isDelegation: false`, causing hooks to miss a delegation that should be validated.

**Mitigation**: Ensure manifest registration is part of the agent addition checklist. Consider adding a catch-all warning when an unrecognized agent name is used in a Task call.

### Risk-005: Timing Data Loss on Agent Crash

**Description**: STEP 3e-timing records `completed_at` and computes `wall_clock_minutes`. If the Phase-Loop Controller crashes before executing 3e-timing, the timing data for that phase is lost. The timing is fail-open (NFR-001), so the workflow continues, but historical metrics are incomplete.

**Mitigation**: Accept as known limitation. Timing data is best-effort. The `workflow-completion-enforcer` can partially reconstruct from workflow-level timestamps.

### Risk-006: Escalation Queue Overflow

**Description**: `pending_escalations[]` is bounded by `MAX_ESCALATIONS` (20) with 60s dedup. If hooks generate escalations faster than the Phase-Loop Controller processes them, older escalations are dropped (FIFO). This could mask important blockers.

**Mitigation**: The 60s dedup window prevents identical escalations from flooding. The Phase-Loop Controller processes escalations in STEP 3b/3c before each phase, so the queue should drain between phases.

---

## 5. State.json Fields to Audit at Each Phase Boundary

### Checklist: Fields to Verify After STEP 3c-prime (Pre-Delegation)

```
[ ] active_workflow.current_phase == phase_key
[ ] active_workflow.phase_status[phase_key] == "in_progress"
[ ] active_workflow.current_phase_index == expected index
[ ] phases[phase_key].status == "in_progress"
[ ] phases[phase_key].started != null (ISO-8601)
[ ] phases[phase_key].timing.started_at exists (or created)
[ ] current_phase (top-level) == phase_key
[ ] active_agent (top-level) == PHASE_AGENT_MAP[phase_key]
[ ] state_version incremented
```

### Checklist: Fields to Verify After STEP 3e (Post-Phase)

```
[ ] active_workflow.phase_status[phase_key] == "completed"
[ ] active_workflow.current_phase_index == previous + 1
[ ] phases[phase_key].status == "completed"
[ ] phases[phase_key].summary != null (max 150 chars)
[ ] phases[phase_key].timing.completed_at exists
[ ] phases[phase_key].timing.wall_clock_minutes >= 0
[ ] state_version incremented
[ ] active_workflow.budget_status updated (if applicable)
[ ] docs/isdlc/tasks.md updated (if exists)
```

### Checklist: Fields That Must NOT Change in STEP 3e

```
[ ] active_workflow.current_phase NOT changed to next phase
[ ] active_workflow.phase_status[next_phase] NOT set to "in_progress"
[ ] phases[next_phase].status NOT set to "in_progress"
[ ] current_phase (top-level) NOT changed to next phase
[ ] active_agent (top-level) NOT changed to next phase's agent
```

---

## 6. Cross-References

| Document | Relevance |
|----------|-----------|
| `docs/requirements/BUG-0005-state-tracking-stale/requirements-spec.md` | Phase read priority fix (FR-03: 6 hooks updated) |
| `docs/requirements/BUG-0006-phase-loop-state-ordering/requirements-spec.md` | Pre-delegation state write ordering fix (FR-01, FR-02) |
| `docs/requirements/BUG-0013-phase-loop-controller-false-blocks/requirements-spec.md` | Same-phase bypass for sub-agent calls (FR-01) |
| `src/claude/commands/isdlc.md` (STEP 3c-prime, 3d, 3e) | Phase-Loop Controller implementation |
| `src/claude/agents/00-sdlc-orchestrator.md` (STEP 3-4) | Workflow initialization |
| `src/claude/hooks/phase-loop-controller.cjs` | Pre-delegation status check (133 lines) |
| `src/claude/hooks/phase-sequence-guard.cjs` | Out-of-order delegation guard (92 lines) |
| `src/claude/hooks/gate-blocker.cjs` | Gate validation enforcement (925 lines) |
| `src/claude/hooks/iteration-corridor.cjs` | Iteration corridor enforcement (428 lines) |
| `src/claude/hooks/delegation-gate.cjs` | Delegation verification (223 lines) |
| `src/claude/hooks/workflow-completion-enforcer.cjs` | Completion detection and remediation (271 lines) |
| `src/claude/hooks/state-write-validator.cjs` | State write validation, V7/V8 rules (247+ lines) |
| `src/claude/hooks/lib/common.cjs` | readState, writeState, detectPhaseDelegation, normalizePhaseKey, collectPhaseSnapshots (3,458 lines) |

---

## 7. Scope Boundaries

### In Scope

- State field synchronization at every phase boundary
- Pre-delegation write ordering and atomicity
- Post-phase update correctness and field partitioning
- Gate validation hook behavior
- Phase read priority across all hooks
- Intra-phase vs cross-phase delegation discrimination
- Artifact passing between phases (file system + prompt context)
- Workflow initialization and completion lifecycle
- Phase skipping and variable-length workflows
- State version integrity (optimistic locking)
- Phase status regression protection

### Out of Scope

- Individual phase agent correctness (each agent's internal logic)
- Artifact content quality (whether requirements are "good")
- UI/UX of task spinners and progress display
- Git branch management (handled by orchestrator, not handshake)
- Jira/external tracker integration
- Performance benchmarking of hooks (< 100ms budget is established)

---

## 8. Glossary

| Term | Definition |
|------|-----------|
| **Phase handshake** | The coordinated state transition between sequential SDLC phases, including pre-delegation writes, delegation, post-phase updates, and gate validation. |
| **STEP 3c-prime** | Pre-delegation state write in the Phase-Loop Controller. Activates the next phase by writing `"in_progress"` status before delegating. |
| **STEP 3d** | Phase delegation step. Uses Task tool to invoke the phase agent. |
| **STEP 3e** | Post-phase state update. Marks the completed phase, increments the index. Does NOT activate the next phase. |
| **Gate validation** | Hook-enforced check that all iteration requirements (tests, constitution, elicitation) are satisfied before allowing phase advancement. |
| **Phase read priority** | The order in which hooks resolve the current phase: `active_workflow.current_phase` (primary), `current_phase` (fallback). Established by BUG-0005. |
| **Same-phase bypass** | BUG-0013 fix that allows sub-agent Task calls within the active phase without requiring `"in_progress"` status check. |
| **Iteration corridor** | A restricted execution mode during failing tests (TEST_CORRIDOR) or pending constitutional validation (CONST_CORRIDOR) that blocks advancement attempts. |
| **State version** | Monotonically increasing integer in state.json, incremented on every write by `writeState()`. Used for optimistic locking (V7 rule). |
| **V8 regression protection** | Rule in state-write-validator that blocks writes where `current_phase_index` or `phase_status` values regress to lower ordinals. |
