# Test Strategy: REQ-0004 Advisory Behavior Hooks

**Version:** 1.0
**Date:** 2026-02-08
**Status:** Approved
**Phase:** 05-test-strategy
**Traces to:** requirements-spec.md (FR-01 through FR-07, NFR-01 through NFR-05), design-spec.md (Sections 3-13)

---

## 1. Existing Test Infrastructure

### 1.1 Framework and Runner

| Aspect | Value |
|--------|-------|
| Test runner | `node:test` (Node.js built-in) |
| Assertion library | `node:assert/strict` |
| Module system | CJS (`.test.cjs` files) |
| Test location | `src/claude/hooks/tests/` (co-located with hook source) |
| Coverage tool | None currently configured for hooks (manual coverage assessment) |
| CI matrix | 3 OS (macOS, Linux, Windows) x 3 Node (18, 20, 22) |

### 1.2 Existing Test Files

| File | Tests | Pattern |
|------|-------|---------|
| `review-reminder.test.cjs` | 10 | Subprocess execution via `execSync`, stdin piping, stdout/exit code assertions |
| `common-code-review.test.cjs` | 6 | Direct `require()` with cache clearing, env manipulation, state file mocking |
| `schema-validation.test.cjs` | 25 | Direct `require()` with temp directories, schema file copying, validation assertions |

### 1.3 Established Patterns (MUST Follow)

All new tests MUST follow these established conventions observed in the existing test suite:

1. **Subprocess model for hook tests**: Each hook test spawns the hook as a child process via `execSync`, pipes JSON stdin, and captures stdout/stderr/exit code. This accurately simulates the Claude Code hook protocol.

2. **Direct require model for utility tests**: Tests for `common.cjs` functions use direct `require()` with `delete require.cache[...]` between tests to get fresh module instances.

3. **Temp directory setup/teardown**: Every test creates a unique temp directory via `fs.mkdtempSync()`, writes state files there, sets `CLAUDE_PROJECT_DIR` env var, and cleans up with `fs.rmSync()` in `afterEach()`.

4. **Test ID naming**: Tests are labeled `T{nn}:` matching the test strategy IDs (e.g., `it('T19: warns when...')`).

5. **No external dependencies**: Tests use only `node:test`, `node:assert/strict`, `fs`, `path`, `os`, and `child_process`.

6. **Strict assertions**: Use `assert.equal`, `assert.ok`, `assert.deepEqual` from `node:assert/strict`.

### 1.4 Strategy: Extend Existing Patterns

This test strategy **extends** the existing test infrastructure. It does NOT introduce new frameworks, tools, or patterns. All new test files follow the exact same structure as `review-reminder.test.cjs` (for hook subprocess tests) and `common-code-review.test.cjs` (for utility direct-require tests).

---

## 2. Test Approach

### 2.1 Test Types

| Type | Scope | Tool | Count |
|------|-------|------|-------|
| **Unit tests (hook subprocess)** | Each hook file in isolation via subprocess execution | `node:test` + `execSync` | 82 |
| **Unit tests (utility direct)** | `common.cjs` new exports via direct require | `node:test` + `require()` | 10 |
| **Integration tests** | Hook interaction with real state.json, git repos, file system | `node:test` + real FS | Included in above |
| **Regression tests** | Full existing test suite must pass | `npm test` | 586+ existing |

### 2.2 What We Are NOT Testing (Out of Scope)

- Claude Code's hook dispatch mechanism (owned by Anthropic)
- Existing hooks (already tested, regression protected by existing suite)
- settings.json registration correctness (tested at integration test phase)
- Installer/uninstaller hook deployment (tested at integration test phase)
- Performance benchmarks (validated manually; hook budgets are well under timeouts)

### 2.3 Test Execution

```bash
# Run all new hook tests
node --test src/claude/hooks/tests/phase-loop-controller.test.cjs
node --test src/claude/hooks/tests/plan-surfacer.test.cjs
node --test src/claude/hooks/tests/phase-sequence-guard.test.cjs
node --test src/claude/hooks/tests/branch-guard.test.cjs
node --test src/claude/hooks/tests/state-write-validator.test.cjs
node --test src/claude/hooks/tests/walkthrough-tracker.test.cjs
node --test src/claude/hooks/tests/discover-menu-guard.test.cjs
node --test src/claude/hooks/tests/common-phase-detection.test.cjs

# Run full CJS test suite (includes existing + new)
node --test src/claude/hooks/tests/*.test.cjs

# Run full project test suite (ESM + CJS + characterization + E2E)
npm test
```

### 2.4 Coverage Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| Line coverage per hook | 100% | All code paths exercised (Constitution Art II) |
| Branch coverage per hook | 100% | All if/else/switch branches taken |
| AC coverage | 100% (34 ACs mapped) | Every acceptance criterion has at least one test (Art VII) |
| Fail-open paths | 100% | Every error scenario tested for silent exit (Art X, NFR-01) |
| Block/warn scenarios | 100% | Every blocking/warning condition tested (Art IX) |
| Allow scenarios | 100% | Every allow condition tested |

---

## 3. Test File Inventory

### 3.1 New Test Files (8 files, 92 test cases)

| File | Hook Under Test | Test Count | Blocking | Allow | Fail-Open | Warn |
|------|----------------|------------|----------|-------|-----------|------|
| `common-phase-detection.test.cjs` | common.cjs additions | 10 | n/a | n/a | 2 | n/a |
| `phase-loop-controller.test.cjs` | phase-loop-controller.cjs | 12 | 2 | 7 | 3 | 0 |
| `plan-surfacer.test.cjs` | plan-surfacer.cjs | 10 | 2 | 5 | 3 | 0 |
| `phase-sequence-guard.test.cjs` | phase-sequence-guard.cjs | 12 | 2 | 6 | 4 | 0 |
| `branch-guard.test.cjs` | branch-guard.cjs | 14 | 3 | 7 | 4 | 0 |
| `state-write-validator.test.cjs` | state-write-validator.cjs | 14 | 0 | 5 | 4 | 5 |
| `walkthrough-tracker.test.cjs` | walkthrough-tracker.cjs | 10 | 0 | 5 | 3 | 2 |
| `discover-menu-guard.test.cjs` | discover-menu-guard.cjs | 10 | 0 | 4 | 3 | 3 |
| **Total** | | **92** | **9** | **39** | **26** | **10** |

### 3.2 File Locations

All test files are placed in the existing test directory:

```
src/claude/hooks/tests/
  common-phase-detection.test.cjs    (NEW)
  phase-loop-controller.test.cjs     (NEW)
  plan-surfacer.test.cjs             (NEW)
  phase-sequence-guard.test.cjs      (NEW)
  branch-guard.test.cjs              (NEW)
  state-write-validator.test.cjs     (NEW)
  walkthrough-tracker.test.cjs       (NEW)
  discover-menu-guard.test.cjs       (NEW)
  review-reminder.test.cjs           (EXISTING - unchanged)
  common-code-review.test.cjs        (EXISTING - unchanged)
  schema-validation.test.cjs         (EXISTING - unchanged)
```

---

## 4. Test Case Specifications

### 4.1 common-phase-detection.test.cjs (10 tests)

Tests the three new `common.cjs` exports: `SETUP_COMMAND_KEYWORDS`, `isSetupCommand()`, and `detectPhaseDelegation()`.

**Test pattern:** Direct `require()` model (like `common-code-review.test.cjs`).

| ID | Test Name | Category | Given | When | Then |
|----|-----------|----------|-------|------|------|
| T01 | SETUP_COMMAND_KEYWORDS is a frozen array | Unit | common.cjs loaded | Access SETUP_COMMAND_KEYWORDS | Array is frozen, contains at least 'discover', 'init', 'setup', 'status' |
| T02 | isSetupCommand returns true for 'discover the project' | Unit | common.cjs loaded | `isSetupCommand('discover the project')` | Returns `true` |
| T03 | isSetupCommand returns true for 'configure cloud' | Unit | common.cjs loaded | `isSetupCommand('configure cloud settings')` | Returns `true` |
| T04 | isSetupCommand returns false for 'implement the feature' | Unit | common.cjs loaded | `isSetupCommand('implement the feature')` | Returns `false` |
| T05 | isSetupCommand returns false for null/empty | Unit | common.cjs loaded | `isSetupCommand(null)` and `isSetupCommand('')` | Both return `false` |
| T06 | detectPhaseDelegation returns not-a-delegation for non-Task tool | Unit | common.cjs loaded | `detectPhaseDelegation({tool_name: 'Bash', tool_input: {command: 'ls'}})` | Returns `{isDelegation: false, targetPhase: null, agentName: null}` |
| T07 | detectPhaseDelegation detects agent name in subagent_type | Unit | common.cjs loaded, manifest available | `detectPhaseDelegation({tool_name: 'Task', tool_input: {subagent_type: 'software-developer', prompt: 'implement'}})` | Returns `{isDelegation: true, targetPhase: '06-implementation', agentName: 'software-developer'}` |
| T08 | detectPhaseDelegation returns not-a-delegation for setup commands | Unit | common.cjs loaded | `detectPhaseDelegation({tool_name: 'Task', tool_input: {subagent_type: 'discover-orchestrator', prompt: 'discover project'}})` | Returns `{isDelegation: false, ...}` |
| T09 | detectPhaseDelegation detects phase pattern in prompt text | Unit | common.cjs loaded | `detectPhaseDelegation({tool_name: 'Task', tool_input: {prompt: 'delegate to 06-implementation agent'}})` | Returns `{isDelegation: true, targetPhase: '06-implementation', ...}` |
| T10 | detectPhaseDelegation fails open with null input | Fail-open | common.cjs loaded | `detectPhaseDelegation(null)` | Returns `{isDelegation: false, ...}` (no crash) |

**Traces to:** Design spec section 3.1-3.3, ADR-001, ADR-002

---

### 4.2 phase-loop-controller.test.cjs (12 tests)

Tests the Phase-Loop Controller hook (PreToolUse[Task]).

**Test pattern:** Subprocess execution model (like `review-reminder.test.cjs`).

| ID | Test Name | Category | State Setup | Stdin | Expected Outcome |
|----|-----------|----------|-------------|-------|------------------|
| T11 | Blocks phase delegation when phase status is pending | Block | `active_workflow.current_phase: '06-implementation'`, `phases['06-implementation'].status: 'pending'` | Task tool call with `subagent_type: 'software-developer'` | stdout contains `{"continue":false,"stopReason":"PHASE DELEGATION WITHOUT PROGRESS TRACKING..."}`, exit 0 |
| T12 | Blocks phase delegation when phase entry is missing | Block | `active_workflow.current_phase: '06-implementation'`, no `phases['06-implementation']` entry | Task tool call with `subagent_type: 'software-developer'` | stdout contains block response, exit 0 |
| T13 | Allows when phase status is in_progress | Allow | `active_workflow.current_phase: '06-implementation'`, `phases['06-implementation'].status: 'in_progress'` | Task tool call with `subagent_type: 'software-developer'` | No stdout output, exit 0 |
| T14 | Allows when phase status is completed | Allow | `active_workflow.current_phase: '06-implementation'`, `phases['06-implementation'].status: 'completed'` | Task tool call with `subagent_type: 'software-developer'` | No stdout output, exit 0 |
| T15 | Allows non-phase-delegation Task calls | Allow | `active_workflow.current_phase: '06-implementation'` | Task tool call with `subagent_type: 'helper'`, no phase match | No stdout output, exit 0 |
| T16 | Allows setup commands (discover) | Allow | `active_workflow.current_phase: '06-implementation'` | Task tool call with prompt containing 'discover' | No stdout output, exit 0 |
| T17 | Allows when active_workflow is null | Allow | No `active_workflow` in state | Task tool call with `subagent_type: 'software-developer'` | No stdout output, exit 0 |
| T18 | Allows non-Task tool calls | Allow | Any state | Bash tool call `{tool_name: 'Bash', tool_input: {command: 'ls'}}` | No stdout output, exit 0 |
| T19 | Allows when current_phase is null | Allow | `active_workflow` exists but `current_phase` is null | Task tool call with phase delegation | No stdout output, exit 0 |
| T20 | Fails open when state.json is missing | Fail-open | No state.json file | Task tool call with `subagent_type: 'software-developer'` | No stdout output, exit 0 |
| T21 | Fails open on invalid JSON stdin | Fail-open | Valid state | Empty string stdin | No stdout output, exit 0 |
| T22 | Fails open when state.json has invalid JSON | Fail-open | state.json contains `{invalid json` | Task tool call with `subagent_type: 'software-developer'` | No stdout output, exit 0 |

**Traces to:** FR-01, AC-01 (T11-T12), AC-01a (T15, T18), AC-01b (T17), AC-01c (T20-T22)

---

### 4.3 plan-surfacer.test.cjs (10 tests)

Tests the Plan Surfacing Enforcer hook (PreToolUse[Task]).

**Test pattern:** Subprocess execution model.

| ID | Test Name | Category | State Setup | File System | Stdin | Expected Outcome |
|----|-----------|----------|-------------|-------------|-------|------------------|
| T23 | Blocks delegation to impl phase when tasks.md missing | Block | `active_workflow.current_phase: '06-implementation'` | No tasks.md | Task tool call | stdout contains block response with "TASK PLAN NOT GENERATED", exit 0 |
| T24 | Blocks delegation to testing phase when tasks.md missing | Block | `active_workflow.current_phase: '07-testing'` | No tasks.md | Task tool call | stdout contains block response, exit 0 |
| T25 | Allows delegation to early phase 01-requirements | Allow | `active_workflow.current_phase: '01-requirements'` | No tasks.md | Task tool call | No stdout, exit 0 |
| T26 | Allows delegation to early phase 05-test-strategy | Allow | `active_workflow.current_phase: '05-test-strategy'` | No tasks.md | Task tool call | No stdout, exit 0 |
| T27 | Allows when tasks.md exists | Allow | `active_workflow.current_phase: '06-implementation'` | tasks.md exists (any content) | Task tool call | No stdout, exit 0 |
| T28 | Allows non-Task tool calls | Allow | Any | Any | `{tool_name: 'Bash'}` | No stdout, exit 0 |
| T29 | Allows when no active_workflow | Allow | No `active_workflow` | No tasks.md | Task tool call | No stdout, exit 0 |
| T30 | Fails open when state.json missing | Fail-open | No state.json | No tasks.md | Task tool call | No stdout, exit 0 |
| T31 | Fails open on empty stdin | Fail-open | Valid state | No tasks.md | Empty string | No stdout, exit 0 |
| T32 | Fails open on malformed stdin JSON | Fail-open | Valid state | No tasks.md | `{not valid json}` | No stdout, exit 0 |

**Traces to:** FR-02, AC-02 (T23-T24), AC-02a (T25-T26), AC-02b (T27), AC-02c (T30-T32)

---

### 4.4 phase-sequence-guard.test.cjs (12 tests)

Tests the Sequential Phase Execution hook (PreToolUse[Task]).

**Test pattern:** Subprocess execution model.

| ID | Test Name | Category | State Setup | Stdin | Expected Outcome |
|----|-----------|----------|-------------|-------|------------------|
| T33 | Blocks delegation to wrong phase (ahead) | Block | `active_workflow.current_phase: '03-architecture'` | Task with `subagent_type: 'software-developer'` (phase 06) | stdout contains block "OUT-OF-ORDER PHASE DELEGATION", mentions both phases, exit 0 |
| T34 | Blocks delegation to wrong phase (behind) | Block | `active_workflow.current_phase: '06-implementation'` | Task with prompt mentioning `01-requirements` | stdout contains block response, exit 0 |
| T35 | Allows delegation to correct current phase | Allow | `active_workflow.current_phase: '06-implementation'` | Task with `subagent_type: 'software-developer'` (phase 06) | No stdout, exit 0 |
| T36 | Allows non-phase-delegation Task calls | Allow | `active_workflow.current_phase: '03-architecture'` | Task with `subagent_type: 'helper-agent'` (no phase match) | No stdout, exit 0 |
| T37 | Allows setup commands in task prompt | Allow | `active_workflow.current_phase: '03-architecture'` | Task with prompt containing 'discover' | No stdout, exit 0 |
| T38 | Allows non-Task tool calls | Allow | Any state | `{tool_name: 'Bash', ...}` | No stdout, exit 0 |
| T39 | Allows when no active_workflow | Allow | No `active_workflow` | Task delegation | No stdout, exit 0 |
| T40 | Allows when current_phase is null | Allow | `active_workflow` with no `current_phase` | Task delegation | No stdout, exit 0 |
| T41 | Fails open when state.json missing | Fail-open | No state.json | Task delegation | No stdout, exit 0 |
| T42 | Fails open on empty stdin | Fail-open | Valid state | Empty string | No stdout, exit 0 |
| T43 | Fails open on invalid JSON stdin | Fail-open | Valid state | `{not valid}` | No stdout, exit 0 |
| T44 | Allows when target phase is null (ambiguous detection) | Fail-open | `active_workflow.current_phase: '03-architecture'` | Task with vague prompt, no phase pattern | No stdout, exit 0 |

**Traces to:** FR-03, AC-03 (T33-T34), AC-03a (T35), AC-03b (T36-T38), AC-03c (T39), AC-03d (T41-T44)

---

### 4.5 branch-guard.test.cjs (14 tests)

Tests the Branch Management hook (PreToolUse[Bash]).

**Test pattern:** Subprocess execution model. **Special:** requires `git init` for git-dependent tests.

**Setup helper:**
```javascript
function setupGitRepo(tmpDir, branchName) {
    execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Test');
    execSync('git add . && git commit -m "init"', { cwd: tmpDir, stdio: 'pipe' });
    if (branchName && branchName !== 'main') {
        execSync(`git checkout -b ${branchName}`, { cwd: tmpDir, stdio: 'pipe' });
    }
}
```

| ID | Test Name | Category | State Setup | Git Setup | Stdin | Expected Outcome |
|----|-----------|----------|-------------|-----------|-------|------------------|
| T45 | Blocks git commit on main with active workflow branch | Block | `active_workflow.git_branch: {name: 'feature/X', status: 'active'}` | `git init` on main | Bash: `git commit -m "msg"` | stdout contains block "COMMIT TO MAIN BLOCKED", exit 0 |
| T46 | Blocks git commit on master with active workflow branch | Block | `active_workflow.git_branch: {name: 'feature/X', status: 'active'}` | `git init`, rename to master | Bash: `git commit -m "msg"` | stdout contains block response, exit 0 |
| T47 | Blocks git commit --amend on main | Block | `active_workflow.git_branch: {name: 'feature/X', status: 'active'}` | `git init` on main | Bash: `git commit --amend` | stdout contains block response, exit 0 |
| T48 | Allows git commit on feature branch | Allow | `active_workflow.git_branch: {name: 'feature/X', status: 'active'}` | `git init`, `git checkout -b feature/X` | Bash: `git commit -m "msg"` | No stdout, exit 0 |
| T49 | Allows git commit when no active_workflow | Allow | No `active_workflow` | `git init` on main | Bash: `git commit -m "msg"` | No stdout, exit 0 |
| T50 | Allows git commit when no git_branch in workflow | Allow | `active_workflow` exists, no `git_branch` | `git init` on main | Bash: `git commit -m "msg"` | No stdout, exit 0 |
| T51 | Allows git commit when branch status is merged | Allow | `active_workflow.git_branch: {name: 'feature/X', status: 'merged'}` | `git init` on main | Bash: `git commit -m "msg"` | No stdout, exit 0 |
| T52 | Allows non-git-commit commands (git push) | Allow | `active_workflow.git_branch: {name: 'feature/X', status: 'active'}` | `git init` on main | Bash: `git push origin main` | No stdout, exit 0 |
| T53 | Allows non-git commands (npm test) | Allow | `active_workflow.git_branch: {name: 'feature/X', status: 'active'}` | `git init` on main | Bash: `npm test` | No stdout, exit 0 |
| T54 | Allows non-Bash tool calls | Allow | Any state | Any git | `{tool_name: 'Task', ...}` | No stdout, exit 0 |
| T55 | Detects git commit in chained command | Block | `active_workflow.git_branch: {name: 'feature/X', status: 'active'}` | `git init` on main | Bash: `git add . && git commit -m "msg"` | stdout contains block response, exit 0 |
| T56 | Fails open when state.json missing | Fail-open | No state.json | `git init` on main | Bash: `git commit -m "msg"` | No stdout, exit 0 |
| T57 | Fails open when git rev-parse fails (no git repo) | Fail-open | `active_workflow.git_branch: {name: 'feature/X', status: 'active'}` | NO git init | Bash: `git commit -m "msg"` | No stdout, exit 0 |
| T58 | Fails open on empty stdin | Fail-open | Valid state | `git init` on main | Empty string | No stdout, exit 0 |

**Traces to:** FR-04, AC-04 (T45-T47, T55), AC-04a (T48), AC-04b (T49), AC-04c (T50), AC-04d (T52-T54), AC-04e (T56-T58)

---

### 4.6 state-write-validator.test.cjs (14 tests)

Tests the State Write Validation hook (PostToolUse[Write, Edit]).

**Test pattern:** Subprocess execution model. **Special:** must capture stderr for warning assertions. Uses `runHookWithStderr()` variant that enables `SKILL_VALIDATOR_DEBUG=true` and captures stderr from `execSync`.

**Note:** This hook NEVER produces stdout output. All assertions check stderr for warnings and verify stdout is always empty.

| ID | Test Name | Category | State File Content | Stdin | Expected Outcome |
|----|-----------|----------|-------------------|-------|------------------|
| T59 | Warns on fake constitutional_validation (completed=true, iterations_used=0) | Warn | Phase with `constitutional_validation: {completed: true, iterations_used: 0}` | Write to `.isdlc/state.json` | stderr contains "[state-write-validator] WARNING" and "constitutional_validation", stdout empty, exit 0 |
| T60 | Warns on fake constitutional_validation (completed=true, iterations_used missing) | Warn | Phase with `constitutional_validation: {completed: true}` (no iterations_used) | Write to `.isdlc/state.json` | stderr contains warning, stdout empty, exit 0 |
| T61 | Warns on fake interactive_elicitation (completed=true, menu_interactions=0) | Warn | Phase with `iteration_requirements.interactive_elicitation: {completed: true, menu_interactions: 0}` | Write to `.isdlc/state.json` | stderr contains "interactive_elicitation" warning, stdout empty, exit 0 |
| T62 | Warns on fake test_iteration (completed=true, current_iteration=0) | Warn | Phase with `iteration_requirements.test_iteration: {completed: true, current_iteration: 0}` | Write to `.isdlc/state.json` | stderr contains "test_iteration" warning, stdout empty, exit 0 |
| T63 | Warns on multiple violations in multiple phases | Warn | Two phases, each with a different fake violation | Write to `.isdlc/state.json` | stderr contains multiple warnings, stdout empty, exit 0 |
| T64 | Silent on valid state (completed=true, iterations_used=1) | Allow | Phase with `constitutional_validation: {completed: true, iterations_used: 1}` | Write to `.isdlc/state.json` | No stderr warnings (only debug), stdout empty, exit 0 |
| T65 | Silent on incomplete validation (completed=false) | Allow | Phase with `constitutional_validation: {completed: false, iterations_used: 0}` | Write to `.isdlc/state.json` | No stderr warnings, stdout empty, exit 0 |
| T66 | Silent on non-state.json write | Allow | N/A | Write to `src/foo.js` (non-state path) | No stderr warnings, stdout empty, exit 0 |
| T67 | Silent on non-Write/Edit tool call | Allow | N/A | `{tool_name: 'Task', ...}` | No stderr warnings, stdout empty, exit 0 |
| T68 | Detects monorepo state.json path | Allow/Warn | File at `.isdlc/projects/my-app/state.json` with fake data | Write to `.isdlc/projects/my-app/state.json` | Detects and validates (warns if fake), exit 0 |
| T69 | Fails open on invalid JSON in state file | Fail-open | state.json contains `{invalid}` | Write to `.isdlc/state.json` | No warnings, stdout empty, exit 0 |
| T70 | Fails open when state file does not exist on disk | Fail-open | No state.json file on disk | Write to `.isdlc/state.json` (file_path claimed but file missing) | No warnings, stdout empty, exit 0 |
| T71 | Fails open on empty stdin | Fail-open | N/A | Empty string | No warnings, stdout empty, exit 0 |
| T72 | Never produces stdout output (critical invariant) | Allow | Phase with fake data that triggers warnings | Write to `.isdlc/state.json` | stdout is ALWAYS empty string, regardless of warnings |

**Traces to:** FR-05, AC-05 (T59-T60, T68), AC-05a (T59-T60), AC-05b (T61), AC-05c (T62), AC-05d (T67, T72), AC-05e (T69-T71)

---

### 4.7 walkthrough-tracker.test.cjs (10 tests)

Tests the Constitution Walkthrough Tracker hook (PostToolUse[Task]).

**Test pattern:** Subprocess execution model. Must capture stderr for warning assertions.

| ID | Test Name | Category | State Setup | Stdin | Expected Outcome |
|----|-----------|----------|-------------|-------|------------------|
| T73 | Warns when discover completes without walkthrough | Warn | `discovery_context: {walkthrough_completed: false}` | Task with `subagent_type: 'discover-orchestrator'`, `tool_result: 'completed'` | stderr contains "[walkthrough-tracker] WARNING", stdout empty, exit 0 |
| T74 | Warns when discover completes with no walkthrough field | Warn | `discovery_context: {}` (no walkthrough_completed) | Task with `subagent_type: 'discover-orchestrator'`, `tool_result: 'completed'` | stderr contains warning, stdout empty, exit 0 |
| T75 | Silent when walkthrough_completed is true | Allow | `discovery_context: {walkthrough_completed: true}` | Task with `subagent_type: 'discover-orchestrator'`, `tool_result: 'completed'` | No stderr warnings, stdout empty, exit 0 |
| T76 | Silent for non-discover tasks | Allow | `discovery_context: {walkthrough_completed: false}` | Task with `subagent_type: 'software-developer'` | No warnings, stdout empty, exit 0 |
| T77 | Silent for non-Task tool calls | Allow | Any state | `{tool_name: 'Bash', ...}` | No warnings, stdout empty, exit 0 |
| T78 | Silent when no tool_result (task not yet complete) | Allow | `discovery_context: {walkthrough_completed: false}` | Task with `subagent_type: 'discover-orchestrator'`, no `tool_result` | No warnings, stdout empty, exit 0 |
| T79 | Silent when no discovery_context in state | Allow | No `discovery_context` | Task with discover completion | No warnings, stdout empty, exit 0 |
| T80 | Fails open when state.json missing | Fail-open | No state.json | Task with discover completion | No warnings, stdout empty, exit 0 |
| T81 | Fails open on empty stdin | Fail-open | Valid state | Empty string | No output, exit 0 |
| T82 | Fails open on malformed stdin | Fail-open | Valid state | `{invalid json}` | No output, exit 0 |

**Traces to:** FR-06, AC-06 (T73-T74), AC-06a (T73-T74), AC-06b (T75), AC-06c (T80-T82)

---

### 4.8 discover-menu-guard.test.cjs (10 tests)

Tests the Discover Menu Validation hook (PostToolUse[Task]).

**Test pattern:** Subprocess execution model. Must capture stderr for warning assertions.

| ID | Test Name | Category | Stdin Content | Expected Outcome |
|----|-----------|----------|---------------|------------------|
| T83 | Silent on correct 3-option menu | Allow | Task with discover, `tool_result` containing "[1] New Project [2] Existing Project (Recommended) [3] Chat/Explore" | No warnings, stdout empty, exit 0 |
| T84 | Silent on correct menu with variant wording | Allow | Task with discover, `tool_result` containing "1. New Project" "2. Existing Project" "3. Chat or Explore" | No warnings, stdout empty, exit 0 |
| T85 | Warns when Chat/Explore option is missing | Warn | Task with discover, `tool_result` containing "[1] New Project [2] Existing Project" (no option 3) | stderr contains "[discover-menu-guard] WARNING" and "Missing options", stdout empty, exit 0 |
| T86 | Warns when Scoped Analysis (removed) option is present | Warn | Task with discover, `tool_result` containing all 3 correct options PLUS "Scoped Analysis" | stderr contains "removed options" warning, stdout empty, exit 0 |
| T87 | Warns when Auto-detect is presented as standalone option | Warn | Task with discover, `tool_result` containing "Auto-detect" as option | stderr contains warning, stdout empty, exit 0 |
| T88 | Silent for non-discover tasks | Allow | Task with `subagent_type: 'software-developer'`, any result | No warnings, stdout empty, exit 0 |
| T89 | Silent for non-Task tool calls | Allow | `{tool_name: 'Bash', ...}` | No warnings, stdout empty, exit 0 |
| T90 | Silent when tool_result is too short (not a menu) | Fail-open | Task with discover, `tool_result: 'ok'` (< 50 chars) | No warnings, stdout empty, exit 0 |
| T91 | Silent when tool_result has no numbered options | Fail-open | Task with discover, `tool_result` is long text but no numbered patterns | No warnings, stdout empty, exit 0 |
| T92 | Fails open on empty stdin | Fail-open | Empty string | No output, exit 0 |

**Traces to:** FR-07, AC-07 (T83-T84, T88), AC-07a (T85-T87), AC-07b (T83-T84), AC-07c (T90-T92)

---

## 5. Test Data Plan

### 5.1 Mock State Structures

All state.json mock structures used across tests. Each test constructs only the fields it needs; unneeded fields are omitted for clarity.

#### 5.1.1 Active Workflow with Phase Status (phase-loop-controller, phase-sequence-guard)

```json
{
  "active_workflow": {
    "type": "feature",
    "current_phase": "06-implementation",
    "phases": ["01-requirements", "02-impact-analysis", "03-architecture", "04-design", "05-test-strategy", "06-implementation"]
  },
  "phases": {
    "06-implementation": {
      "status": "pending"
    }
  }
}
```

Variants: `status: "in_progress"`, `status: "completed"`, missing `phases` object, missing phase entry.

#### 5.1.2 Active Workflow with Git Branch (branch-guard)

```json
{
  "active_workflow": {
    "type": "feature",
    "git_branch": {
      "name": "feature/REQ-0004-advisory-behavior-hooks",
      "status": "active",
      "created_at": "2026-02-08T20:00:00Z"
    }
  }
}
```

Variants: `status: "merged"`, `status: "abandoned"`, no `git_branch`, no `active_workflow`.

#### 5.1.3 Discovery Context (walkthrough-tracker)

```json
{
  "discovery_context": {
    "completed_at": "2026-02-08T11:20:00Z",
    "walkthrough_completed": true
  }
}
```

Variants: `walkthrough_completed: false`, no `walkthrough_completed`, no `discovery_context`.

#### 5.1.4 Phases with Validation Data (state-write-validator)

```json
{
  "phases": {
    "01-requirements": {
      "status": "completed",
      "constitutional_validation": {
        "completed": true,
        "iterations_used": 1,
        "status": "compliant"
      },
      "iteration_requirements": {
        "interactive_elicitation": {
          "completed": true,
          "menu_interactions": 3
        }
      }
    }
  }
}
```

Fake variants: `iterations_used: 0`, `menu_interactions: 0`, `current_iteration: 0`, missing fields.

### 5.2 Mock Stdin Payloads

#### 5.2.1 PreToolUse[Task] - Phase Delegation

```json
{
  "tool_name": "Task",
  "tool_input": {
    "subagent_type": "software-developer",
    "prompt": "Implement the feature per the design spec",
    "description": "Phase 06 implementation"
  }
}
```

#### 5.2.2 PreToolUse[Task] - Non-Delegation

```json
{
  "tool_name": "Task",
  "tool_input": {
    "subagent_type": "helper",
    "prompt": "Help me understand this code",
    "description": "Code exploration"
  }
}
```

#### 5.2.3 PreToolUse[Task] - Setup Command

```json
{
  "tool_name": "Task",
  "tool_input": {
    "subagent_type": "discover-orchestrator",
    "prompt": "discover the project structure",
    "description": "Project discovery"
  }
}
```

#### 5.2.4 PreToolUse[Bash] - Git Commit

```json
{
  "tool_name": "Bash",
  "tool_input": {
    "command": "git commit -m \"feat: add feature\""
  }
}
```

#### 5.2.5 PreToolUse[Bash] - Non-Commit

```json
{
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm test"
  }
}
```

#### 5.2.6 PostToolUse[Write] - State Write

```json
{
  "tool_name": "Write",
  "tool_input": {
    "file_path": "/tmp/test-dir/.isdlc/state.json"
  },
  "tool_result": "File written successfully"
}
```

#### 5.2.7 PostToolUse[Task] - Discover Completion

```json
{
  "tool_name": "Task",
  "tool_input": {
    "subagent_type": "discover-orchestrator",
    "prompt": "Run project discovery"
  },
  "tool_result": "[1] New Project\n[2] Existing Project (Recommended)\n[3] Chat/Explore\n\nSelect an option:"
}
```

#### 5.2.8 PostToolUse[Task] - Discover with Wrong Menu

```json
{
  "tool_name": "Task",
  "tool_input": {
    "subagent_type": "discover-orchestrator",
    "prompt": "Run project discovery"
  },
  "tool_result": "[1] Auto-detect Project\n[2] Existing Project Analysis\n[3] New Project\n[4] Scoped Analysis\n\nSelect an option:"
}
```

### 5.3 Config File Fixtures

#### 5.3.1 Minimal Manifest (for detectPhaseDelegation tests)

Tests that need the skills manifest will copy it from the source location:

```javascript
const manifestSrc = path.join(__dirname, '..', 'config', 'skills-manifest.json');
const manifestDst = path.join(tmpDir, '.isdlc', 'config', 'skills-manifest.json');
fs.mkdirSync(path.dirname(manifestDst), { recursive: true });
if (fs.existsSync(manifestSrc)) {
    fs.copyFileSync(manifestSrc, manifestDst);
}
```

This follows the same pattern as `schema-validation.test.cjs`.

#### 5.3.2 tasks.md Fixture (for plan-surfacer tests)

For tests that need `tasks.md` to exist:

```javascript
function createTasksPlan(tmpDir) {
    const docsDir = path.join(tmpDir, 'docs', 'isdlc');
    fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(path.join(docsDir, 'tasks.md'), '# Task Plan\n## Phase 01\n- [ ] Requirements');
}
```

### 5.4 Git Repository Fixtures (for branch-guard tests)

```javascript
function setupGitRepo(tmpDir, branchName) {
    execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Test');
    execSync('git add . && git commit -m "init"', { cwd: tmpDir, stdio: 'pipe' });
    if (branchName && branchName !== 'main') {
        execSync(`git checkout -b ${branchName}`, { cwd: tmpDir, stdio: 'pipe' });
    }
}
```

---

## 6. Traceability Matrix (Test Cases)

### 6.1 Acceptance Criteria to Test Mapping

| AC | Description | Test IDs | Test Count |
|----|-------------|----------|------------|
| AC-01 | Block phase delegation without TaskUpdate | T11, T12 | 2 |
| AC-01a | Allow non-phase-delegation Task calls | T15, T16, T18 | 3 |
| AC-01b | Allow when active_workflow is null | T17, T19 | 2 |
| AC-01c | Fail open on state.json read errors | T20, T21, T22 | 3 |
| AC-02 | Block impl+ phases when tasks.md missing | T23, T24 | 2 |
| AC-02a | Allow early phases without tasks.md | T25, T26 | 2 |
| AC-02b | Allow when tasks.md exists | T27 | 1 |
| AC-02c | Fail open on file system errors | T28, T30, T31, T32 | 4 |
| AC-03 | Block out-of-order phase delegation | T33, T34 | 2 |
| AC-03a | Allow delegation to correct phase | T35 | 1 |
| AC-03b | Allow non-phase-delegation Task calls | T36, T37, T38 | 3 |
| AC-03c | Fail open when no active workflow | T39, T40 | 2 |
| AC-03d | Fail open on state.json errors | T41, T42, T43, T44 | 4 |
| AC-04 | Block git commit on main with active branch | T45, T46, T47, T55 | 4 |
| AC-04a | Allow git commit on feature branch | T48 | 1 |
| AC-04b | Allow when no active workflow | T49 | 1 |
| AC-04c | Allow when no git_branch | T50, T51 | 2 |
| AC-04d | Allow non-git-commit commands | T52, T53, T54 | 3 |
| AC-04e | Fail open on errors | T56, T57, T58 | 3 |
| AC-05 | Detect state.json writes (single + monorepo) | T59, T60, T68 | 3 |
| AC-05a | Warn on fake constitutional_validation | T59, T60 | 2 |
| AC-05b | Warn on fake interactive_elicitation | T61 | 1 |
| AC-05c | Warn on fake test_iteration | T62 | 1 |
| AC-05d | Never block (PostToolUse observational) | T67, T72 | 2 |
| AC-05e | Fail open on read/parse errors | T69, T70, T71 | 3 |
| AC-06 | Detect discover task completions | T73, T74 | 2 |
| AC-06a | Warn when walkthrough_completed is false | T73, T74 | 2 |
| AC-06b | Silent when walkthrough_completed is true | T75 | 1 |
| AC-06c | Fail open on all errors | T80, T81, T82 | 3 |
| AC-07 | Detect discover task delegations | T83, T84, T88 | 3 |
| AC-07a | Warn on incorrect menu | T85, T86, T87 | 3 |
| AC-07b | Silent on correct menu | T83, T84 | 2 |
| AC-07c | Fail open on all errors | T90, T91, T92 | 3 |

### 6.2 NFR Coverage

| NFR | Covered By | How |
|-----|-----------|-----|
| NFR-01 (Fail-open) | T10, T20-T22, T30-T32, T41-T44, T56-T58, T69-T71, T80-T82, T90-T92 | All fail-open tests verify exit 0 with no stdout on errors |
| NFR-02 (Performance) | Implicit in test timeouts (5000ms) | All tests timeout at 5000ms; hooks have < 200ms budgets |
| NFR-03 (CJS/Node/OS) | All test files are `.test.cjs` | CI matrix validates across 3 OS x 3 Node |
| NFR-04 (Testability) | 92 tests across 8 files | Minimum 10 per hook exceeded |
| NFR-05 (No regressions) | Full `npm test` run | Must pass 586+ existing tests alongside 92 new |

### 6.3 Constitutional Article Coverage

| Article | Relevant Tests | How Validated |
|---------|---------------|---------------|
| Art II (Test-First) | All 92 tests | Tests designed before implementation (this document) |
| Art VII (Traceability) | Section 6.1 matrix | Every AC maps to at least 1 test |
| Art IX (Quality Gates) | T11-T12, T23-T24, T33-T34, T45-T47 | Blocking hooks enforce gate integrity |
| Art X (Fail-Safe) | T10, T20-T22, T30-T32, T41-T44, T56-T58, T69-T71, T80-T82, T90-T92 | Every error scenario exits cleanly |
| Art XI (Integration) | T45-T48, T55-T57 (real git repos), all subprocess tests | Real FS and git operations, real stdin/stdout protocol |
| Art XII (Dual Module) | All `.test.cjs` files | CJS format enforced by file extension |
| Art XIII (Hook Protocol) | All blocking tests check stdout JSON, all warn tests check stderr | Protocol compliance verified |

---

## 7. Quality Gates and Acceptance

### 7.1 Test Execution Gate

All 92 tests must pass with:
- Exit code 0 for each test run
- No skipped tests (all tests active)
- No flaky tests (deterministic state setup/teardown)

### 7.2 Regression Gate

The full project test suite must pass:
```bash
npm test
```
Expected: 586+ existing tests pass alongside 92 new tests = 678+ total.

### 7.3 Coverage Gate

Every acceptance criterion (34 ACs from requirements) has at least one test. The traceability matrix in section 6.1 demonstrates 100% AC coverage.

### 7.4 Fail-Open Gate

Every hook has at least 3 fail-open test cases covering:
- Missing state.json
- Invalid/empty stdin
- Malformed state data or file system errors

### 7.5 No-Stdout Gate (PostToolUse hooks)

state-write-validator, walkthrough-tracker, and discover-menu-guard MUST never produce stdout output. Tests T67, T72, T75-T82, T83-T92 all assert `stdout === ''`.

---

## 8. Test Implementation Order

Aligned with the design spec's implementation order (section 10):

| Step | Test File | Depends On | Rationale |
|------|-----------|------------|-----------|
| 1 | common-phase-detection.test.cjs | common.cjs additions (step 1 of impl) | Validates shared utilities before hooks that use them |
| 2 | branch-guard.test.cjs | common.cjs existing exports | Independent hook, no new common.cjs deps |
| 3 | plan-surfacer.test.cjs | common.cjs existing exports | Independent hook, uses resolveTasksPath |
| 4 | state-write-validator.test.cjs | common.cjs existing exports | Independent hook, reads files directly |
| 5 | phase-loop-controller.test.cjs | common.cjs detectPhaseDelegation (step 1) | Depends on new detectPhaseDelegation utility |
| 6 | phase-sequence-guard.test.cjs | common.cjs detectPhaseDelegation (step 1) | Depends on new detectPhaseDelegation utility |
| 7 | walkthrough-tracker.test.cjs | common.cjs existing exports | Observational hook, minimal deps |
| 8 | discover-menu-guard.test.cjs | common.cjs existing exports | Observational hook, minimal deps |

---

## 9. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Git tests flaky on CI (branch name defaults) | Medium | Low | Use explicit `git init -b main` or `git branch -m main` in setup |
| Manifest file not available in test env | Medium | Medium | Copy from source path with fallback (as in schema-validation.test.cjs) |
| Shell escaping issues with JSON stdin piping | Low | Medium | Use `replace(/'/g, "\\\\'")` as in existing pattern |
| Node process startup time varies by platform | Low | Low | Use generous test timeouts (5000ms) vs hook budgets (100-200ms) |
| New hooks interfere with each other in CI | Low | High | Each test creates isolated temp directory; no shared state |
| stderr capture differs across platforms | Low | Medium | Check for specific warning prefix strings, not exact messages |

---

## 10. GATE-04 Checklist

- [x] Test strategy covers unit, integration, E2E, security, performance
  - Unit: 92 test cases across 8 files
  - Integration: Real FS, git repos, and stdin/stdout protocol in subprocess tests
  - E2E: Not applicable (hook-level testing is the end-to-end boundary)
  - Security: Fail-open tests prevent hooks from crashing user workflows
  - Performance: Implicit via test timeouts; hooks budgeted at < 200ms
- [x] Test cases exist for all requirements (34 ACs, 7 FRs, 5 NFRs)
- [x] Traceability matrix complete (100% AC coverage, section 6.1)
- [x] Coverage targets defined (100% line, branch, AC, fail-open paths)
- [x] Test data strategy documented (section 5)
- [x] Critical paths identified (blocking hooks: T11-T12, T23-T24, T33-T34, T45-T47)
