# Architecture Overview: Performance Budget and Guardrail System

**ID**: REQ-0022
**Phase**: 03-architecture
**Generated**: 2026-02-18
**Backlog Item**: 2.4
**Traces To**: FR-001 through FR-008, NFR-001 through NFR-005

---

## 1. Architecture Pattern: Extend Existing Modular Monolith

**Decision**: Extend the existing hook/dispatcher/lib architecture. No new patterns introduced.

The iSDLC framework follows a modular monolith with clear module boundaries:

- **Phase-Loop Controller** (`isdlc.md`) -- orchestration layer (markdown command)
- **Hook Dispatchers** (`dispatchers/*.cjs`) -- pre/post tool-use enforcement layer
- **Hook Modules** (`hooks/*.cjs`) -- individual enforcement/observation hooks
- **Shared Libraries** (`hooks/lib/*.cjs`) -- reusable utility functions
- **Configuration** (`.isdlc/config/*.json`) -- declarative workflow/budget definitions

The performance budget system slots into this existing architecture as:

| New Component | Layer | Pattern Followed |
|--------------|-------|-----------------|
| `performance-budget.cjs` | Shared Library | Same as `gate-requirements-injector.cjs` |
| `workflows.json` extension | Configuration | Same as existing `agent_modifiers`, `sizing` |
| STEP 3 timing additions | Orchestration | Same as existing STEP 3c-prime/3e state writes |
| Dispatcher timing | Enforcement | Same as existing `DEGRADATION_HINT` in pre-task-dispatcher |
| Regression tracking | Enforcement | Same as `collectPhaseSnapshots()` in workflow-completion-enforcer |

**Rationale (ADR-0001)**: No architectural change is needed. The feature is pure observability + advisory governance layered onto existing integration points. Introducing a separate service, event bus, or database would violate Article V (Simplicity First).

---

## 2. Architecture Decisions

### ADR-0001: New CJS Module vs. Extending common.cjs

**Context**: The feature requires 7 new utility functions. `common.cjs` is already 3453 lines with 86 exports.

**Decision**: Create a new `src/claude/hooks/lib/performance-budget.cjs` module.

**Rationale**:
- `common.cjs` is already at technical debt threshold (flagged in impact analysis)
- The 7 functions form a cohesive module with a single responsibility (performance budget computation)
- The new module follows the exact pattern of `gate-requirements-injector.cjs`: standalone CJS, fail-open, reads config files
- The only change to `common.cjs` is extending `collectPhaseSnapshots()` to include the `timing` object from phase data -- a 5-line additive change

**Exception**: `collectPhaseSnapshots()` stays in `common.cjs` because it is already exported there and called by 3 consumers. Moving it would be a breaking change with no benefit.

**Consequences**:
- Positive: Keeps `common.cjs` from growing. New module is independently testable.
- Negative: Callers in `isdlc.md` and `workflow-completion-enforcer.cjs` must import from a new path. But since these are markdown instructions (not `require()` calls), this is a documentation change only.

### ADR-0002: Dashboard Rendering -- Utility Function vs. Inline Markdown

**Context**: FR-007 requires a completion dashboard. The dashboard could be rendered inline in `isdlc.md` (as prose instructions) or by a utility function in `performance-budget.cjs` that produces formatted text.

**Decision**: Utility function `formatCompletionDashboard()` in `performance-budget.cjs`.

**Rationale**:
- The dashboard has 6 acceptance criteria (AC-007a through AC-007f) with conditional formatting logic (regression display, degradation count, budget status)
- Embedding this logic as natural-language instructions in `isdlc.md` would produce inconsistent output across LLM invocations -- the format would drift
- A utility function produces deterministic, testable output
- `isdlc.md` calls the function and displays the result -- minimal instruction complexity

**Implementation**: `formatCompletionDashboard()` accepts structured data (phase timings, budget, regression check) and returns a multi-line string. The phase-loop controller in `isdlc.md` calls this function conceptually (the LLM follows the spec to produce equivalent output). The function itself is called by `workflow-completion-enforcer.cjs` for the `workflow_history` entry.

**Note on LLM execution**: Since `isdlc.md` is a markdown command executed by the LLM (not a Node.js script), it cannot literally call `require('performance-budget.cjs').formatCompletionDashboard()`. Instead, the dashboard specification in `isdlc.md` defines the exact format, and the LLM renders it. The utility function exists for:
1. Unit testing the format specification
2. Use by `workflow-completion-enforcer.cjs` (which IS a Node.js script)
3. Reference implementation that the LLM instructions mirror

**Consequences**:
- Positive: Testable format, deterministic in Node.js contexts, documented spec for LLM contexts
- Negative: Slight duplication between the utility function and the isdlc.md prose specification. Mitigation: isdlc.md references the format spec by example, not by reimplementation.

### ADR-0003: Agent Reporting of debate_rounds_used and fan_out_chunks

**Context**: FR-001e and FR-001f require recording how many debate rounds and fan-out chunks a phase used. Agents must communicate these counts back to the orchestrator.

**Decision**: Phase-loop controller extracts counts from the agent's return text using a structured metadata block convention, with fallback to state.json writes by agents.

**Rationale**:

Three options were evaluated:

| Option | Mechanism | Pros | Cons |
|--------|-----------|------|------|
| A. Agent return value | Agent includes `TIMING_METADATA: {...}` in Task result text | No state.json writes by agents; clean separation | Requires parsing unstructured text; agent must remember to include it |
| B. State.json writes by agents | Agent writes `phases[phase_key].timing.debate_rounds_used` directly | Simple; data immediately in state.json | Violates existing pattern where agents do NOT write timing fields; state-write-validator may block |
| C. Orchestrator inference | Orchestrator reads agent logs/output and infers counts | No agent changes needed | Fragile; counts not reliably inferable from text |

**Selected**: Option A with fallback to orchestrator defaults.

The convention is:
1. The delegation prompt in STEP 3d includes an instruction: "When your phase completes, include a `PHASE_TIMING_REPORT:` line with `debate_rounds_used` and `fan_out_chunks` counts."
2. The phase-loop controller in STEP 3e parses the agent's return for this line.
3. If not found, defaults to `debate_rounds_used = 0` and `fan_out_chunks = 0`.
4. The orchestrator (isdlc.md STEP 3e) writes these values to `phases[phase_key].timing`.

This follows the existing pattern where agents produce structured output blocks (e.g., `SCOPE_ESTIMATE:`, `SIZING_METADATA:`) and the orchestrator parses them.

**Consequences**:
- Positive: No state-write-validator changes. Agents are told what to report via prompt. Fail-safe defaults when agents do not comply.
- Negative: Text parsing is inherently fragile. Mitigation: defaults of 0 are safe (under-report, never over-report).

### ADR-0004: Dispatcher Timing API -- performance.now() vs. Date.now()

**Context**: FR-008 requires sub-millisecond timing for hook dispatchers. Two APIs are available.

| API | Resolution | Availability | Monotonic |
|-----|-----------|-------------|-----------|
| `performance.now()` | Microsecond | Node 16+ (global since Node 19) | Yes |
| `Date.now()` | Millisecond | All Node versions | No (affected by clock adjustments) |

**Decision**: Use `performance.now()` with `Date.now()` fallback.

**Implementation**:
```javascript
const _now = typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? () => performance.now()
    : () => Date.now();
```

**Rationale**:
- The project requires Node 18+ (per package.json engines). `performance` is available as a global in Node 16+.
- `performance.now()` is monotonic -- not affected by system clock changes during dispatcher execution.
- The fallback ensures fail-open behavior if some edge environment lacks `performance` (AC-008a specifies the fallback).
- Dispatcher execution is typically 5-200ms, so millisecond resolution from `Date.now()` is adequate as fallback. `performance.now()` provides better precision for sub-10ms dispatchers.

**Consequences**:
- Positive: Best available precision; monotonic; fail-open fallback
- Negative: Minor code complexity for the fallback. Mitigation: the `_now` helper is 2 lines and tested once.

### ADR-0005: Regression Tracking Location -- Orchestrator Finalize vs. workflow-completion-enforcer

**Context**: FR-006 requires comparing the current workflow's timing against a rolling average. Two locations can run this check:

| Location | Trigger | State Access | Timing |
|----------|---------|-------------|--------|
| `isdlc.md` pre-STEP-4 (dashboard) | Phase loop completes, before finalize | Has all timing in memory | Before workflow_history entry is created |
| `workflow-completion-enforcer.cjs` | PostToolUse[Write] fires when active_workflow is cleared | Reads fresh state from disk | After workflow_history entry exists |

**Decision**: Split responsibility.

1. **Regression computation**: `workflow-completion-enforcer.cjs` -- runs after finalize writes the `workflow_history` entry. It reads the entry, computes rolling average from prior entries, writes `regression_check` back.
2. **Regression display**: `isdlc.md` pre-STEP-4 -- the dashboard displays a preliminary regression estimate using in-memory timing data. If the workflow-completion-enforcer later refines the number, the persistent data in `workflow_history` is authoritative.

**Rationale**:
- The workflow-completion-enforcer already fires on workflow finalize and already calls `collectPhaseSnapshots()`. Adding `computeRollingAverage()` and `detectRegression()` is a natural extension.
- The enforcer has disk-level state access (it reads fresh state), which is needed to scan `workflow_history[]`.
- The isdlc.md dashboard runs BEFORE the finalize step, so it cannot read the `workflow_history` entry that finalize will create. It can compute a preliminary regression using `active_workflow.started_at` and the current time, compared against previously persisted `workflow_history` entries.

**Consequences**:
- Positive: Authoritative regression data lives in `workflow_history` (persistent). Dashboard provides immediate feedback. Natural extension of existing enforcer pattern.
- Negative: Slight discrepancy possible between dashboard's preliminary regression and enforcer's authoritative regression (because dashboard runs before all pruning/snapshotting). Mitigation: Dashboard labels its output as "preliminary" only if prior data exists; the authoritative regression check in `workflow_history` is the source of truth.

---

## 3. Component Architecture

### 3.1 System Context (C4 Level 1)

```
+-------------------+        +-----------------------+
|   Developer       |------->|  iSDLC Framework      |
|   (Human)         |<-------|  (Claude Code CLI)    |
+-------------------+        +-----------------------+
     |                              |
     | sees dashboard,              | reads/writes
     | warnings on stderr           |
     v                              v
+-------------------+        +-----------------------+
|  Terminal Output   |        |  .isdlc/state.json    |
|  (stderr/stdout)   |        |  .isdlc/config/       |
+-------------------+        |  workflows.json        |
                              +-----------------------+
```

The performance budget system is entirely internal to the iSDLC framework. No external services, databases, or APIs are involved.

### 3.2 Container Diagram (C4 Level 2)

```
+================================================================+
|                    iSDLC Framework                               |
|                                                                  |
|  +---------------------------+    +---------------------------+  |
|  | Phase-Loop Controller     |    | Hook Dispatchers (5)      |  |
|  | (isdlc.md)                |    | pre-task, post-task,      |  |
|  |                           |    | pre-skill, post-bash,     |  |
|  | STEP 3c': timing.start    |    | post-write-edit           |  |
|  | STEP 3d:  degradation     |    |                           |  |
|  | STEP 3e:  timing.end +    |    | + dispatcher timing       |  |
|  |           budget check    |    |   (performance.now)       |  |
|  | pre-STEP4: dashboard      |    +---------------------------+  |
|  +---------------------------+                                   |
|       |         |         |                                      |
|       | calls   | reads   | reads/writes                        |
|       v         v         v                                      |
|  +---------------------------+    +---------------------------+  |
|  | performance-budget.cjs    |    | .isdlc/config/            |  |
|  | (NEW -- shared library)   |    | workflows.json            |  |
|  |                           |    | (performance_budgets)     |  |
|  | getPerformanceBudget()    |    +---------------------------+  |
|  | computeBudgetStatus()     |                                   |
|  | buildBudgetWarning()      |    +---------------------------+  |
|  | buildDegradationDirective |    | .isdlc/state.json         |  |
|  | computeRollingAverage()   |    | phases[].timing           |  |
|  | detectRegression()        |    | budget_status             |  |
|  | formatCompletionDashboard |    | workflow_history[]        |  |
|  +---------------------------+    |   .regression_check       |  |
|       ^                           +---------------------------+  |
|       |                                    ^                     |
|       | imports                             | reads/writes       |
|       |                                    |                     |
|  +---------------------------+    +---------------------------+  |
|  | common.cjs                |    | workflow-completion-      |  |
|  | (EXISTING -- extended)    |    | enforcer.cjs              |  |
|  |                           |    | (EXISTING -- extended)    |  |
|  | collectPhaseSnapshots()   |    |                           |  |
|  | + timing field in output  |    | + regression check at     |  |
|  +---------------------------+    |   workflow completion      |  |
|                                   +---------------------------+  |
+================================================================+
```

### 3.3 Module Responsibilities

| Module | Responsibility | FR Coverage |
|--------|---------------|-------------|
| `performance-budget.cjs` | All budget computation, degradation logic, regression detection, dashboard formatting | FR-002 (defaults), FR-003 (status), FR-004 (debate degradation), FR-005 (fan-out degradation), FR-006 (regression), FR-007 (dashboard) |
| `isdlc.md` STEP 3c-prime | Write `timing.started_at` to state.json | FR-001 (AC-001a, AC-001c) |
| `isdlc.md` STEP 3d | Inject `BUDGET_DEGRADATION` into delegation prompts | FR-004 (AC-004a-e), FR-005 (AC-005a-d) |
| `isdlc.md` STEP 3e | Write `timing.completed_at`, compute `wall_clock_minutes`, run budget check, extract debate/fan-out counts | FR-001 (AC-001b, AC-001e, AC-001f), FR-003 (AC-003a-f) |
| `isdlc.md` pre-STEP-4 | Render completion dashboard | FR-007 (AC-007a-f) |
| `common.cjs` | Extend `collectPhaseSnapshots()` to include timing data | FR-001 (AC-001d) |
| `workflow-completion-enforcer.cjs` | Regression tracking at workflow finalization | FR-006 (AC-006a-e) |
| 5 dispatchers | Self-timing instrumentation | FR-008 (AC-008a-c) |
| `workflows.json` | Budget tier configuration | FR-002 (AC-002a-b) |

---

## 4. Data Architecture

### 4.1 Data Flow Diagram

```
Phase Start (STEP 3c-prime)
  |
  +-> state.json: phases[key].timing.started_at = ISO-8601
  |
Phase Execution (STEP 3d delegation)
  |
  +-> Read state.json: active_workflow.budget_status
  +-> If exceeded/approaching: inject BUDGET_DEGRADATION into prompt
  |
  +-> Agent executes phase
  +-> Agent returns PHASE_TIMING_REPORT: { debate_rounds_used, fan_out_chunks }
  |
Phase End (STEP 3e)
  |
  +-> state.json: phases[key].timing.completed_at = ISO-8601
  +-> state.json: phases[key].timing.wall_clock_minutes = computed
  +-> state.json: phases[key].timing.debate_rounds_used = from agent
  +-> state.json: phases[key].timing.fan_out_chunks = from agent
  +-> state.json: phases[key].timing.debate_rounds_degraded_to = if degraded
  +-> state.json: phases[key].timing.fan_out_degraded_to = if degraded
  |
  +-> Read workflows.json: performance_budgets[effective_intensity]
  +-> Compute elapsed = (now - active_workflow.started_at)
  +-> computeBudgetStatus(elapsed, budget) -> on_track | approaching | exceeded
  +-> state.json: active_workflow.budget_status = result
  +-> stderr: BUDGET_WARNING or BUDGET_APPROACHING (if applicable)
  |
  (loop to next phase)
  |
All Phases Complete (pre-STEP-4)
  |
  +-> Read all phases[].timing from state.json
  +-> Read workflow_history[] for prior same-intensity workflows
  +-> computeRollingAverage(history, intensity, 5)
  +-> detectRegression(currentMinutes, rollingAvg, 0.20)
  +-> formatCompletionDashboard(phases, budget, regression)
  +-> Display dashboard to terminal
  |
Finalize (STEP 4 -> workflow-completion-enforcer fires)
  |
  +-> collectPhaseSnapshots() now includes timing objects
  +-> workflow_history[current].regression_check = computed
```

### 4.2 State.json Schema Extensions

All extensions are additive. No existing fields are modified or removed.

#### 4.2.1 Per-Phase Timing (under `phases[phase_key]`)

```json
{
  "timing": {
    "started_at": "2026-02-17T10:00:00.000Z",
    "completed_at": "2026-02-17T10:08:32.000Z",
    "wall_clock_minutes": 9,
    "retries": 0,
    "debate_rounds_used": 2,
    "debate_rounds_degraded_to": null,
    "fan_out_chunks": 0,
    "fan_out_degraded_to": null
  }
}
```

**Size**: ~140 bytes per phase (within NFR-003 limit of 150 bytes).

**Field semantics**:
- `started_at`: ISO-8601 timestamp set at STEP 3c-prime. Preserved across retries (AC-001c).
- `completed_at`: ISO-8601 timestamp set at STEP 3e.
- `wall_clock_minutes`: `Math.round((completed_at - started_at) / 60000)`. Integer.
- `retries`: Incremented each time the phase re-enters STEP 3c-prime after initial run.
- `debate_rounds_used`: Integer from agent PHASE_TIMING_REPORT. Default 0.
- `debate_rounds_degraded_to`: Integer if BUDGET_DEGRADATION was applied, null otherwise.
- `fan_out_chunks`: Integer from agent PHASE_TIMING_REPORT. Default 0.
- `fan_out_degraded_to`: Integer if BUDGET_DEGRADATION was applied, null otherwise.

#### 4.2.2 Budget Status (under `active_workflow`)

```json
{
  "budget_status": "on_track",
  "budget_exceeded_at_phase": null
}
```

**Size**: ~70 bytes (within NFR-003 limit of 100 bytes).

**Field semantics**:
- `budget_status`: Enum `"on_track" | "approaching" | "exceeded"`. Updated at every STEP 3e.
- `budget_exceeded_at_phase`: Phase key where budget was first exceeded. Set once, never overwritten.

#### 4.2.3 Regression Check (under `workflow_history[n]`)

```json
{
  "regression_check": {
    "baseline_avg_minutes": 52,
    "current_minutes": 68,
    "percent_over": 31,
    "regressed": true,
    "slowest_phase": "06-implementation",
    "compared_against": 5
  }
}
```

**Size**: ~180 bytes (within NFR-003 limit of 200 bytes).

### 4.3 Workflows.json Schema Extension

```json
{
  "workflows": {
    "feature": {
      "performance_budgets": {
        "light": {
          "max_total_minutes": 30,
          "max_phase_minutes": 10,
          "max_debate_rounds": 0,
          "max_fan_out_chunks": 1
        },
        "standard": {
          "max_total_minutes": 90,
          "max_phase_minutes": 25,
          "max_debate_rounds": 2,
          "max_fan_out_chunks": 4
        },
        "epic": {
          "max_total_minutes": 180,
          "max_phase_minutes": 40,
          "max_debate_rounds": 3,
          "max_fan_out_chunks": 8
        }
      }
    },
    "fix": {
      "performance_budgets": {
        "standard": {
          "max_total_minutes": 90,
          "max_phase_minutes": 25,
          "max_debate_rounds": 2,
          "max_fan_out_chunks": 4
        }
      }
    }
  }
}
```

**Note**: The `fix` workflow only defines `standard` tier because fix workflows do not have a sizing step (AC-002e). `getPerformanceBudget()` defaults to `standard` for any workflow type that lacks a sizing-derived intensity.

---

## 5. Function Specifications (performance-budget.cjs)

### 5.1 Module Header

```javascript
'use strict';

/**
 * iSDLC Performance Budget Utilities (CommonJS)
 * ================================================
 * Budget computation, degradation logic, rolling average,
 * regression detection, and completion dashboard formatting.
 *
 * Design principles:
 * - Fail-open: every exported function wraps in try/catch, returns safe default
 * - Pure functions: no side effects, no state.json writes, no process.exit
 * - Deterministic: given same inputs, always produces same outputs
 *
 * Traces to: REQ-0022 (Performance Budget and Guardrail System)
 * Version: 1.0.0
 */
```

### 5.2 Function Signatures

#### `getPerformanceBudget(workflowConfig, intensity)`

- **Purpose**: Look up budget tier from workflow config with hardcoded fallback defaults.
- **Params**: `workflowConfig` (parsed workflow object from workflows.json), `intensity` (string: `"light"`, `"standard"`, `"epic"`)
- **Returns**: `{ max_total_minutes, max_phase_minutes, max_debate_rounds, max_fan_out_chunks }`
- **Fallback**: If config missing or intensity not found, returns hardcoded defaults per AC-002c
- **Traces**: FR-002, AC-002a-e

#### `computeBudgetStatus(elapsedMinutes, maxTotalMinutes)`

- **Purpose**: Determine budget status based on elapsed time vs. budget.
- **Params**: `elapsedMinutes` (number), `maxTotalMinutes` (number)
- **Returns**: `"on_track"` if <= 80%, `"approaching"` if > 80% and <= 100%, `"exceeded"` if > 100%
- **Traces**: FR-003, AC-003c-e

#### `buildBudgetWarning(elapsedMinutes, budget, phaseKey, intensity, phaseDuration)`

- **Purpose**: Format budget warning string for stderr.
- **Params**: elapsed time, budget object, current phase key, intensity tier, current phase duration
- **Returns**: Formatted warning string or empty string if on_track
- **Traces**: FR-003, AC-003b

#### `buildDegradationDirective(budgetStatus, budget, phaseKey, workflowFlags)`

- **Purpose**: Generate BUDGET_DEGRADATION text for agent delegation prompt.
- **Params**: current budget status, budget tier object, target phase key, workflow flags (`{ no_debate, no_fan_out }`)
- **Returns**: Directive string or empty string if no degradation needed
- **Logic**:
  - Debate-enabled phases: `01-requirements`, `03-architecture`, `04-design`, `05-test-strategy`
  - Fan-out phases: `16-quality-loop`, `08-code-review`
  - If `exceeded`: debate rounds = 1, fan-out chunks = 2
  - If `approaching`: debate rounds = tier_max - 1 (min 1), fan-out chunks = floor(tier_max / 2) (min 2)
  - If `on_track`: empty string (no degradation)
  - Respects `--no-debate` and `--no-fan-out` flags (skip if already disabled)
- **Traces**: FR-004, FR-005, AC-004a-e, AC-005a-d

#### `computeRollingAverage(workflowHistory, intensity, maxPrior)`

- **Purpose**: Compute rolling average duration from prior workflows of same intensity.
- **Params**: `workflowHistory` (array), `intensity` (string), `maxPrior` (number, default 5)
- **Returns**: `{ avg_minutes, count }` or `null` if fewer than 2 matching prior workflows
- **Traces**: FR-006, AC-006a-b, AC-006d

#### `detectRegression(currentMinutes, rollingAvg, threshold)`

- **Purpose**: Compare current duration against rolling average and detect regression.
- **Params**: `currentMinutes` (number), `rollingAvg` (object from `computeRollingAverage`), `threshold` (number, default 0.20)
- **Returns**: `{ baseline_avg_minutes, current_minutes, percent_over, regressed, compared_against }` or `null` if rollingAvg is null
- **Traces**: FR-006, AC-006c-e

#### `formatCompletionDashboard(phasesTimingArray, budget, regressionCheck, degradationCount)`

- **Purpose**: Format the human-readable timing summary table.
- **Params**: Array of `{ phase_key, wall_clock_minutes, debate_rounds_used, fan_out_chunks }`, budget object, regression check result, count of degraded phases
- **Returns**: Multi-line formatted string
- **Format** (per AC-007a-f):

```
========================================
WORKFLOW TIMING SUMMARY
========================================
Phase                    Duration  Debates  Fan-out
01-requirements              8m       2        -
02-impact-analysis           5m       -        -
03-architecture              12m      1*       -
04-design                    7m       -        -
05-test-strategy             4m       -        -
06-implementation            22m      -        -
16-quality-loop              9m       -       3
08-code-review               3m       -       2*
                           ----
Total                       70m

Budget: 70m / 90m (78%) -- ON TRACK
Degradation applied: 2 phases had reduced debate rounds or fan-out chunks (marked *)
========================================
```

- **Traces**: FR-007, AC-007a-f

### 5.3 Constants

```javascript
/** Hardcoded budget defaults per AC-002c */
const DEFAULT_BUDGETS = {
    light:    { max_total_minutes: 30,  max_phase_minutes: 10, max_debate_rounds: 0, max_fan_out_chunks: 1 },
    standard: { max_total_minutes: 90,  max_phase_minutes: 25, max_debate_rounds: 2, max_fan_out_chunks: 4 },
    epic:     { max_total_minutes: 180, max_phase_minutes: 40, max_debate_rounds: 3, max_fan_out_chunks: 8 }
};

/** Phases where debate rounds apply */
const DEBATE_ENABLED_PHASES = ['01-requirements', '03-architecture', '04-design', '05-test-strategy'];

/** Phases where fan-out parallelism applies */
const FAN_OUT_PHASES = ['16-quality-loop', '08-code-review'];

/** Regression threshold: flag if current > average * (1 + threshold) */
const DEFAULT_REGRESSION_THRESHOLD = 0.20;

/** Maximum prior workflows for rolling average */
const DEFAULT_MAX_PRIOR = 5;
```

---

## 6. Integration Points

### 6.1 isdlc.md STEP 3c-prime (Timing Start)

**Current behavior**: Sets `phases[phase_key].status = "in_progress"`, `phases[phase_key].started = timestamp`.

**Addition**: After existing state writes, add:

```
8. If `phases[phase_key].timing` does not exist, create it:
   phases[phase_key].timing = {
     started_at: new Date().toISOString(),
     retries: 0
   }
   If `phases[phase_key].timing.started_at` already exists (retry case per AC-001c):
     phases[phase_key].timing.retries += 1
     (Do NOT overwrite started_at)
```

**Traces**: FR-001, AC-001a, AC-001c

### 6.2 isdlc.md STEP 3d (Degradation Injection)

**Current behavior**: Constructs delegation prompt with WORKFLOW MODIFIERS, DISCOVERY CONTEXT, SKILL INDEX, EXTERNAL SKILLS, GATE REQUIREMENTS blocks.

**Addition**: After GATE REQUIREMENTS block, before closing the prompt:

```
{BUDGET DEGRADATION (REQ-0022) -- Inject degradation directive when budget is exceeded or approaching.
 1. Read active_workflow.budget_status from state.json.
 2. If budget_status is "on_track" or missing: SKIP injection.
 3. Read performance_budgets[effective_intensity] from workflows.json (or DEFAULT_BUDGETS).
 4. Read active_workflow.options for --no-debate and --no-fan-out flags.
 5. Determine if this phase_key is in DEBATE_ENABLED_PHASES or FAN_OUT_PHASES.
 6. Compute degraded limits per ADR-0003 rules.
 7. If degradation applies, append:
    BUDGET_DEGRADATION:
      budget_status: exceeded
      max_debate_rounds: 1
      max_fan_out_chunks: 2
      reason: "Workflow has consumed 95m of 90m budget"
 8. Error handling: fail-open. If any step fails, continue without injection.
}
```

Additionally, add the PHASE_TIMING_REPORT instruction to the delegation prompt:

```
When your phase work completes, include a PHASE_TIMING_REPORT line:
PHASE_TIMING_REPORT: { "debate_rounds_used": N, "fan_out_chunks": N }
If your phase did not use debates or fan-out, report 0 for each.
```

**Traces**: FR-004, FR-005, AC-004a-e, AC-005a-d

### 6.3 isdlc.md STEP 3e (Timing End + Budget Check)

**Current behavior**: Sets `phases[phase_key].status = "completed"`, `phases[phase_key].summary`, increments `current_phase_index`.

**Addition**: After existing state writes, before phase task completion:

```
9.  Set phases[phase_key].timing.completed_at = new Date().toISOString()
10. Compute wall_clock_minutes:
    const start = new Date(phases[phase_key].timing.started_at).getTime()
    const end = new Date(phases[phase_key].timing.completed_at).getTime()
    phases[phase_key].timing.wall_clock_minutes = Math.round((end - start) / 60000)

11. Extract PHASE_TIMING_REPORT from agent result (parse text for the JSON line):
    phases[phase_key].timing.debate_rounds_used = parsed.debate_rounds_used || 0
    phases[phase_key].timing.fan_out_chunks = parsed.fan_out_chunks || 0

12. If BUDGET_DEGRADATION was injected for this phase (check delegation prompt):
    phases[phase_key].timing.debate_rounds_degraded_to = degraded debate limit
    phases[phase_key].timing.fan_out_degraded_to = degraded fan-out limit

13. BUDGET CHECK:
    a. Read effective_intensity from active_workflow.sizing.effective_intensity
       (default "standard" if missing -- covers fix workflows per AC-002e)
    b. Read performance_budgets[effective_intensity] from workflows.json
       (fall back to DEFAULT_BUDGETS if missing per AC-002c)
    c. Compute elapsed = Math.round((Date.now() - new Date(active_workflow.started_at).getTime()) / 60000)
    d. Call computeBudgetStatus(elapsed, budget.max_total_minutes)
    e. Set active_workflow.budget_status = result
    f. If result === "exceeded" and active_workflow.budget_exceeded_at_phase is not set:
       Set active_workflow.budget_exceeded_at_phase = phase_key
    g. If result === "exceeded":
       Emit to stderr: BUDGET_WARNING: Workflow has consumed {elapsed}m of {budget}m budget ({percent}%). Phase {phase_key} took {phase_duration}m.
    h. If result === "approaching":
       Emit to stderr: BUDGET_APPROACHING: Workflow at {percent}% of {budget}m budget. {remaining}m remaining.

14. Write state.json with all timing and budget updates.
```

**Traces**: FR-001, FR-003, AC-001b, AC-001e, AC-001f, AC-003a-f

### 6.4 isdlc.md pre-STEP-4 (Dashboard)

**Location**: Between the phase loop exit and STEP 4 (finalize).

**Addition**: New step "STEP 3-dashboard":

```
STEP 3-dashboard: COMPLETION DASHBOARD

After the phase loop exits (all phases completed), before STEP 4 (finalize):

1. Collect timing data from all phases[].timing in state.json.
2. Read performance_budgets[effective_intensity] for the total budget.
3. Read workflow_history[] for prior same-intensity workflows.
4. Compute rolling average: computeRollingAverage(history, intensity, 5).
5. Detect regression: detectRegression(total_minutes, rolling_avg, 0.20).
6. Count phases where debate_rounds_degraded_to or fan_out_degraded_to is not null.
7. Display the formatted dashboard (per AC-007a-f format).
8. Error handling: fail-open. If dashboard generation fails, log warning and continue to STEP 4.
```

**Traces**: FR-007, AC-007a-f

### 6.5 common.cjs -- collectPhaseSnapshots() Extension

**Current behavior** (line 2320-2341): Builds snapshot with `key, status, started, completed, gate_passed, duration_minutes, summary, artifacts, test_iterations`.

**Addition**: After the `test_iterations` conditional block (line ~2339), add:

```javascript
// Conditional: timing (omit if no data -- REQ-0022)
if (phaseData.timing && typeof phaseData.timing === 'object') {
    snapshot.timing = phaseData.timing;
}
```

This is a 3-line change. The timing object is copied as-is from the phase data into the snapshot.

**Traces**: FR-001, AC-001d

### 6.6 workflow-completion-enforcer.cjs Extension

**Current behavior**: Fires on state.json write when `active_workflow` is cleared. Reconstructs snapshots, applies pruning.

**Addition**: After `collectPhaseSnapshots()` call, before pruning:

```javascript
// REQ-0022: Regression tracking
try {
    const { computeRollingAverage, detectRegression } = require('./lib/performance-budget.cjs');
    const history = state.workflow_history || [];
    const currentEntry = history[history.length - 1];
    if (currentEntry && currentEntry.metrics && currentEntry.metrics.total_duration_minutes) {
        const intensity = currentEntry.sizing?.effective_intensity || 'standard';
        const rollingAvg = computeRollingAverage(history.slice(0, -1), intensity, 5);
        const regression = detectRegression(
            currentEntry.metrics.total_duration_minutes,
            rollingAvg,
            0.20
        );
        if (regression) {
            // Find slowest phase
            const snapshots = currentEntry.phase_snapshots || [];
            let slowest = { key: 'unknown', wall_clock_minutes: 0 };
            for (const s of snapshots) {
                if (s.timing && s.timing.wall_clock_minutes > slowest.wall_clock_minutes) {
                    slowest = { key: s.key, wall_clock_minutes: s.timing.wall_clock_minutes };
                }
            }
            currentEntry.regression_check = {
                ...regression,
                slowest_phase: slowest.key
            };
            stateModified = true;
        }
    }
} catch (e) {
    // Fail-open: regression errors must never block
    debugLog('workflow-completion-enforcer: regression check error:', e.message);
}
```

**Traces**: FR-006, AC-006a-e

### 6.7 Dispatcher Timing (5 files)

**Pattern** (identical across all 5 dispatchers):

At the top of `main()`, after `'use strict'`:
```javascript
const _dispatcherStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
```

After the hook loop completes, before `process.exit(0)`:
```javascript
// REQ-0022 FR-008: Dispatcher timing instrumentation
try {
    const _elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - _dispatcherStart;
    const _hookCount = HOOKS.filter((h, i) => /* count hooks that actually ran */).length;
    console.error(`DISPATCHER_TIMING: ${DISPATCHER_NAME} completed in ${_elapsed.toFixed(1)}ms (${_hookCount} hooks)`);
} catch (_e) {
    // Fail-open: timing errors must never affect dispatcher behavior
}
```

Where `DISPATCHER_NAME` is a constant defined per dispatcher file:
- `pre-task-dispatcher`
- `post-task-dispatcher`
- `pre-skill-dispatcher`
- `post-bash-dispatcher`
- `post-write-edit-dispatcher`

The hook count can be tracked by incrementing a counter in the hook loop rather than filtering after the fact:

```javascript
let _hooksRan = 0;
for (const hook of HOOKS) {
    if (hook.shouldActivate && !hook.shouldActivate(ctx)) {
        continue;
    }
    _hooksRan++;
    // ... existing hook execution ...
}
```

**Traces**: FR-008, AC-008a-c

---

## 7. Sequence Diagrams

### 7.1 Phase Execution with Timing and Budget Check

```
Developer          isdlc.md            state.json         workflows.json      Agent
    |                  |                    |                    |                |
    |  start phase     |                    |                    |                |
    |----------------->|                    |                    |                |
    |                  | STEP 3c-prime      |                    |                |
    |                  | write timing.start |                    |                |
    |                  |------------------->|                    |                |
    |                  |                    |                    |                |
    |                  | STEP 3d            |                    |                |
    |                  | read budget_status |                    |                |
    |                  |<-------------------|                    |                |
    |                  | read budget config |                    |                |
    |                  |                    |<-------------------|                |
    |                  |                    |                    |                |
    |                  | delegate + BUDGET_DEGRADATION (if any)  |                |
    |                  |---------------------------------------------------->|   |
    |                  |                    |                    |                |
    |                  |     agent executes phase               |                |
    |                  |<----------------------------------------------------|   |
    |                  |     PHASE_TIMING_REPORT: {...}         |                |
    |                  |                    |                    |                |
    |                  | STEP 3e            |                    |                |
    |                  | write timing.end   |                    |                |
    |                  | compute wall_clock |                    |                |
    |                  | budget check       |                    |                |
    |                  |------------------->|                    |                |
    |                  |                    |                    |                |
    | BUDGET_WARNING   |                    |                    |                |
    |<---- (stderr) ---|                    |                    |                |
    |                  |                    |                    |                |
```

### 7.2 Workflow Completion with Regression Check

```
isdlc.md              state.json         workflow-completion-enforcer    performance-budget.cjs
    |                      |                         |                          |
    | all phases done      |                         |                          |
    | STEP 3-dashboard     |                         |                          |
    | read all timing      |                         |                          |
    |<---------------------|                         |                          |
    | display dashboard    |                         |                          |
    |                      |                         |                          |
    | STEP 4 finalize      |                         |                          |
    | clear active_workflow|                         |                          |
    |--------------------->|                         |                          |
    |                      | PostToolUse[Write] fires|                          |
    |                      |------------------------>|                          |
    |                      |                         | collectPhaseSnapshots()  |
    |                      |                         | (includes timing)        |
    |                      |                         |                          |
    |                      |                         | computeRollingAverage()  |
    |                      |                         |------------------------->|
    |                      |                         |<-------------------------|
    |                      |                         |                          |
    |                      |                         | detectRegression()       |
    |                      |                         |------------------------->|
    |                      |                         |<-------------------------|
    |                      |                         |                          |
    |                      |                         | write regression_check   |
    |                      |<------------------------|                          |
    |                      |                         |                          |
```

---

## 8. Error Handling Strategy

**Principle**: Every code path in the performance budget system is fail-open. Budget/timing features enhance observability but must NEVER block workflow execution (NFR-001).

### 8.1 Error Handling by Component

| Component | Error Scenario | Handling | Traces |
|-----------|---------------|----------|--------|
| `getPerformanceBudget()` | Missing/corrupt workflows.json | Return hardcoded DEFAULT_BUDGETS[intensity] | AC-002c, NFR-001 |
| `computeBudgetStatus()` | NaN elapsed or budget | Return `"on_track"` (conservative default) | NFR-001 |
| `buildDegradationDirective()` | Unknown phase key | Return empty string (no degradation) | NFR-001 |
| `computeRollingAverage()` | Fewer than 2 matching prior workflows | Return `null` (skip regression) | AC-006d |
| `detectRegression()` | Null rolling average | Return `null` (no regression data) | AC-006d |
| `formatCompletionDashboard()` | Missing timing data for a phase | Show `?` for that phase, continue | NFR-001 |
| isdlc.md STEP 3c-prime timing | State.json write fails | Log warning, continue phase execution | NFR-001 |
| isdlc.md STEP 3e budget check | Budget computation fails | Log warning, continue to next phase | NFR-001 |
| isdlc.md pre-STEP-4 dashboard | Dashboard rendering fails | Log warning, proceed to STEP 4 | NFR-001 |
| workflow-completion-enforcer | Regression computation fails | debugLog error, continue pruning | NFR-001 |
| Dispatcher timing | performance.now() throws | Use Date.now() fallback | AC-008a |

### 8.2 Fail-Open Wrapper Pattern

Every exported function in `performance-budget.cjs` follows this pattern:

```javascript
function computeBudgetStatus(elapsedMinutes, maxTotalMinutes) {
    try {
        if (typeof elapsedMinutes !== 'number' || typeof maxTotalMinutes !== 'number') {
            return 'on_track';
        }
        if (maxTotalMinutes <= 0) return 'on_track';
        const ratio = elapsedMinutes / maxTotalMinutes;
        if (ratio > 1.0) return 'exceeded';
        if (ratio > 0.8) return 'approaching';
        return 'on_track';
    } catch (_e) {
        return 'on_track';
    }
}
```

This matches the pattern established by `gate-requirements-injector.cjs` where every function has a top-level `try/catch` returning a safe default.

---

## 9. Testing Strategy

### 9.1 New Test File: `performance-budget.test.cjs`

| Test Group | Test Cases | Count |
|-----------|------------|-------|
| `getPerformanceBudget()` | Valid tier lookup; missing config returns defaults; unknown intensity falls back to standard; null input returns standard defaults | 4 |
| `computeBudgetStatus()` | on_track (< 80%); approaching (80-100%); exceeded (> 100%); edge cases (0, NaN, negative) | 6 |
| `buildBudgetWarning()` | Warning on exceeded; warning on approaching; empty on on_track; format validation | 4 |
| `buildDegradationDirective()` | Debate phase + exceeded; debate phase + approaching; fan-out phase + exceeded; on_track returns empty; no-debate flag skips; no-fan-out flag skips; non-debate/fan-out phase returns empty | 7 |
| `computeRollingAverage()` | 0 prior returns null; 1 prior returns null; 2 prior computes average; 5+ prior uses last 5; intensity filtering works; fix workflow defaults to standard | 6 |
| `detectRegression()` | No regression (< 20% over); regression (> 20% over); null rolling avg returns null; edge: exactly 20% | 4 |
| `formatCompletionDashboard()` | Full dashboard with all data; no regression line when not regressed; degradation count displayed; budget exceeded format; budget on-track format; missing timing shows fallback | 6 |

**Total**: ~37 test cases

### 9.2 Existing Test Extensions

| File | Addition | Count |
|------|----------|-------|
| `common.test.cjs` | collectPhaseSnapshots() with timing data present; timing data absent (backward compat) | 2 |
| `workflow-completion-enforcer.test.cjs` | Regression check with sufficient history; regression check with insufficient history; regression check error handling | 3 |
| Each dispatcher test (5 files) | Verify DISPATCHER_TIMING on stderr; verify JSON stdout unaffected | 10 |

**Total additions to existing tests**: ~15 test cases

### 9.3 Integration Testing

Manual integration test checklist (executed during Phase 16 quality loop):

1. Run a feature workflow end-to-end. Verify timing data in state.json after each phase.
2. Artificially set `budget_status = "exceeded"` in state.json. Run next phase. Verify BUDGET_DEGRADATION in delegation prompt.
3. Complete a workflow. Verify dashboard output.
4. Complete 3+ workflows of same intensity. Verify regression detection on the 3rd workflow.
5. Verify all 1300+ existing tests pass with no modifications (NFR-004).

---

## 10. Backward Compatibility

| Concern | Mitigation | NFR |
|---------|-----------|-----|
| Existing workflows without `performance_budgets` | Hardcoded defaults in `getPerformanceBudget()` | NFR-004, AC-002c |
| Existing `phase_snapshots` in workflow_history | `timing` field is additive -- existing consumers ignore unknown fields | NFR-004 |
| Existing state.json schema | `timing` and `budget_status` are new fields -- no existing fields modified | NFR-004 |
| Existing dispatcher tests | Timing output goes to stderr only -- stdout JSON protocol unchanged | NFR-004, AC-008c |
| Agents that do not return PHASE_TIMING_REPORT | Defaults to 0 for debate_rounds_used and fan_out_chunks | ADR-0003 |
| DEGRADATION_HINT vs BUDGET_DEGRADATION | These are independent mechanisms. DEGRADATION_HINT is per-tool-call from pre-task-dispatcher (phase timeout). BUDGET_DEGRADATION is per-delegation from isdlc.md (workflow budget). Both can coexist. | Technical debt note |

---

## 11. Implementation Order

Based on the dependency graph from the impact analysis, with testing priorities:

| Order | File(s) | Depends On | Rationale |
|-------|---------|-----------|-----------|
| 1 | `src/claude/hooks/lib/performance-budget.cjs` + `tests/performance-budget.test.cjs` | Nothing | Foundation. All pure utility functions with unit tests. No external dependencies. TDD: write tests first. |
| 2 | `.isdlc/config/workflows.json` | Nothing | Configuration. Add `performance_budgets` section. Pure data, no logic. |
| 3 | `src/claude/hooks/lib/common.cjs` | #1 (indirectly) | Extend `collectPhaseSnapshots()` with timing field. 3-line additive change. Add tests to common.test.cjs. |
| 4 | `src/claude/commands/isdlc.md` (STEP 3c-prime, STEP 3e) | #1, #2 | Core timing instrumentation and budget checking. Depends on performance-budget.cjs functions and workflows.json config. |
| 5 | `src/claude/commands/isdlc.md` (STEP 3d) | #4 | Degradation injection. Depends on budget_status computed in STEP 3e of previous phase. |
| 6 | `src/claude/commands/isdlc.md` (pre-STEP-4 dashboard) | #1, #4 | Display. Depends on formatCompletionDashboard() and timing data from #4. |
| 7 | `src/claude/hooks/workflow-completion-enforcer.cjs` | #1, #3 | Regression tracking. Depends on performance-budget.cjs for regression functions and common.cjs for extended snapshots. |
| 8 | `src/claude/hooks/dispatchers/*.cjs` (5 files) | Nothing | Independent. Dispatcher timing can be added at any point. No cross-dependencies. |

---

## 12. Risk Summary

| Risk | Severity | Mitigation |
|------|----------|-----------|
| isdlc.md is not unit-testable | HIGH | Keep logic in performance-budget.cjs (testable). isdlc.md only calls functions and formats output. Integration test via full workflow run. |
| PHASE_TIMING_REPORT not returned by agents | MEDIUM | Default to 0 for both counts. Under-reporting is safe. Over time, agents learn to include the report from prompt instructions. |
| BUDGET_DEGRADATION naming collision with DEGRADATION_HINT | LOW | Document distinction clearly. DEGRADATION_HINT is hook-level (per-tool-call, phase timeout). BUDGET_DEGRADATION is phase-level (per-delegation, workflow budget). |
| State.json footprint growth | LOW | NFR-003 specifies limits. Verified: timing ~140 bytes/phase, budget_status ~70 bytes, regression_check ~180 bytes. Well within 2KB total. |
| Regression false positives | LOW | 20% threshold with minimum 2 prior workflows reduces noise. First 2 workflows of any intensity tier have no regression check (AC-006d). |

---

## 13. Traceability Matrix

| Requirement | Architecture Component | ADR | Section |
|------------|----------------------|-----|---------|
| FR-001 (Phase timing) | isdlc.md STEP 3c-prime, STEP 3e; common.cjs snapshot extension | -- | 6.1, 6.3, 6.5 |
| FR-002 (Budget config) | workflows.json; performance-budget.cjs `getPerformanceBudget()` | ADR-0001 | 4.3, 5.2 |
| FR-003 (Budget check) | isdlc.md STEP 3e; performance-budget.cjs `computeBudgetStatus()`, `buildBudgetWarning()` | -- | 6.3, 5.2 |
| FR-004 (Debate degradation) | isdlc.md STEP 3d; performance-budget.cjs `buildDegradationDirective()` | ADR-0003 | 6.2, 5.2 |
| FR-005 (Fan-out degradation) | isdlc.md STEP 3d; performance-budget.cjs `buildDegradationDirective()` | ADR-0003 | 6.2, 5.2 |
| FR-006 (Regression tracking) | workflow-completion-enforcer.cjs; performance-budget.cjs `computeRollingAverage()`, `detectRegression()` | ADR-0005 | 6.6, 5.2 |
| FR-007 (Dashboard) | isdlc.md pre-STEP-4; performance-budget.cjs `formatCompletionDashboard()` | ADR-0002 | 6.4, 5.2 |
| FR-008 (Dispatcher timing) | 5 dispatcher files | ADR-0004 | 6.7 |
| NFR-001 (Zero blocking) | All components: fail-open pattern | -- | 8 |
| NFR-002 (Timing accuracy) | ISO-8601 timestamps, Math.round for minutes | -- | 4.2.1 |
| NFR-003 (State footprint) | Verified byte counts per field group | -- | 4.2 |
| NFR-004 (Backward compat) | Additive fields, hardcoded defaults, stderr-only output | -- | 10 |
| NFR-005 (Observability) | Structured stderr prefixes, state.json queryable fields | -- | 6.3, 6.7 |

---

## 14. Constitutional Compliance

| Article | Requirement | Compliance |
|---------|------------|------------|
| III (Security by Design) | No security-sensitive data introduced. Timing data is operational metadata, not PII. No new authentication or authorization surfaces. | COMPLIANT |
| IV (Explicit Over Implicit) | All 5 architecture decisions documented with rationale. No `[NEEDS CLARIFICATION]` markers. Agent reporting convention (ADR-0003) explicitly defines contract. | COMPLIANT |
| V (Simplicity First) | No new architectural patterns. Reuses existing hook/lib/dispatcher structure. New module follows established CJS pattern. All functions are pure with fail-open wrappers. | COMPLIANT |
| VII (Artifact Traceability) | Every function, integration point, and data field traces to specific FR/AC. Traceability matrix in Section 13. | COMPLIANT |
| IX (Quality Gate Integrity) | Architecture addresses all 8 FRs and 5 NFRs. Test strategy covers all new and modified code. | COMPLIANT |
| X (Fail-Safe Defaults) | Budget defaults to "on_track". Missing config falls back to hardcoded defaults. Missing agent report defaults to 0. Regression skip with insufficient data. All functions wrapped in try/catch. | COMPLIANT |
