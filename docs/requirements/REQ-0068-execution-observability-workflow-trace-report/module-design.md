# Module Design: Execution Observability

**ID**: REQ-0068
**Status**: Re-analyzed (multi-provider update)
**Re-analysis date**: 2026-03-24
**Reason**: Original design assumed Claude-only execution via isdlc.md Phase-Loop Controller. Now must work with provider-neutral orchestrators (phase-loop.js, fan-out.js, dual-track.js).

---

## Module 1: State Tracking Extensions

**Responsibility**: Capture sub-agent execution, hook events, artifact creation, and provider attribution during workflows

**Location**: `src/core/observability/state-tracking.js` (new, ESM) + CJS bridge at `src/core/bridge/observability.cjs`

**Rationale for new module**: The original design placed these functions in `common.cjs`. However, the multi-provider architecture uses ESM-first core modules with CJS bridges. Placing observability state tracking in `src/core/observability/` follows the established pattern (cf. `src/core/providers/`, `src/core/orchestration/`). A CJS bridge allows hooks to call these functions.

**Public interface**:
```js
// ESM exports from src/core/observability/state-tracking.js

appendSubAgentLog(state, { parent_agent, agent, agent_id, phase, started_at, completed_at, status, duration_ms, tokens_used, provider })
// Appends to state.active_workflow.sub_agent_log[]

appendHookEvent(state, { timestamp, hook, phase, action, reason, resolution, provider })
// Appends to state.active_workflow.hook_events[]
// 'provider' field distinguishes Claude hook events from Codex governance events

appendArtifactProduced(state, { timestamp, phase, file_path, action })
// Appends to state.active_workflow.artifacts_produced[]

getSubAgentLog(state) -> []
// Returns sub_agent_log array, empty array if missing

getHookEvents(state) -> []
// Returns hook_events array, empty array if missing

getArtifactsProduced(state) -> []
// Returns artifacts_produced array, empty array if missing
```

**Data structures**:
```
sub_agent_log entry:
  parent_agent: string    -- e.g. "impact-analysis-orchestrator"
  agent: string           -- e.g. "impact-analyzer"
  agent_id: string|null   -- Task tool agent ID (Claude) or process PID (Codex) or null
  phase: string           -- e.g. "02-impact-analysis"
  started_at: string      -- ISO-8601
  completed_at: string|null
  status: string          -- "running" | "completed" | "failed"
  duration_ms: number|null -- from TaskResult.duration_ms
  tokens_used: number|null -- available on Claude, typically null on Codex
  provider: string        -- "claude" | "codex" | "antigravity" | "unknown"

hook_event entry:
  timestamp: string       -- ISO-8601
  hook: string            -- e.g. "gate-blocker" (Claude) or "governance-check" (Codex)
  phase: string           -- e.g. "06-implementation"
  action: string          -- "blocked" | "warned" | "allowed"
  reason: string          -- human-readable explanation
  resolution: string|null -- "retry" | "skip" | "fixed" | null
  provider: string        -- which provider's enforcement surface produced this event

artifact_produced entry:
  timestamp: string       -- ISO-8601
  phase: string
  file_path: string       -- relative to project root
  action: string          -- "created" | "modified"
```

**Dependencies**: None new. Uses existing `writeState()` via core state bridge.

**Estimated size**: ~100 lines (6 functions, append-only logic, null-safe getters, provider field handling)

---

## Module 2: Phase Topology Config

**Responsibility**: Declare the sub-agent DAG structure for each phase

**Location**: `src/claude/hooks/config/phase-topology.json`

**Note on location**: This file is in the Claude hooks config directory for historical reasons (hooks consume it). It is read-only static data and is provider-neutral. The dashboard server reads it regardless of active provider.

**Schema**:
```json
{
  "version": "1.0.0",
  "phases": {
    "{phase_key}": {
      "nodes": [
        { "id": "string", "agent": "string", "label": "string" }
      ],
      "edges": [
        { "from": "string", "to": "string" }
      ]
    }
  }
}
```

**Phase topologies**:

| Phase | Nodes | Edges (dependencies) |
|-------|-------|---------------------|
| `00-quick-scan` | QS (quick-scan-agent) | -- |
| `01-requirements` | RA (requirements-analyst) | -- |
| `01-requirements` (debate) | CR (creator), CK (critic), RF (refiner) | CR->CK->RF |
| `02-impact-analysis` | IA0 (orchestrator), M1, M2, M3 (parallel), M4 (verifier) | IA0->M1, IA0->M2, IA0->M3, M1->M4, M2->M4, M3->M4 |
| `02-tracing` | T0 (orchestrator), T1, T2, T3 (parallel) | T0->T1, T0->T2, T0->T3 |
| `03-architecture` | SA (solution-architect) | -- |
| `03-architecture` (debate) | CR, CK, RF | CR->CK->RF |
| `04-design` | SD (system-designer) | -- |
| `04-design` (debate) | CR, CK, RF | CR->CK->RF |
| `05-test-strategy` | TE (test-design-engineer) | -- |
| `05-test-strategy` (debate) | CR, CK, RF | CR->CK->RF |
| `06-implementation` | SW (software-developer), IR (implementation-reviewer), IU (implementation-updater) | SW->IR->IU |
| `16-quality-loop` | QL (quality-loop-engineer) | -- |
| `08-code-review` | QA (qa-engineer) | -- |
| `15-upgrade-plan` | UE (upgrade-engineer) | -- |
| `15-upgrade-execute` | UE (upgrade-engineer) | -- |

**Dependencies**: None. Static JSON file.

**Estimated size**: ~150 lines of JSON

---

## Module 3: CLI Formatter (provider-neutral)

**Responsibility**: Format phase completion output as structured text based on display_level

**Location**: `src/core/observability/cli-formatter.js` (new, ESM) + CJS bridge at `src/core/bridge/observability.cjs`

**Rationale for separate module**: The original design embedded formatting in isdlc.md (Claude-specific). With multiple providers, the formatter must be a standalone module callable by any provider's output surface. ESM module with CJS bridge follows established patterns.

**Public interface**:
```js
// ESM exports from src/core/observability/cli-formatter.js

formatPhaseCompletion(phaseState, options) -> string
// options: { display_level: 'minimal'|'standard'|'detailed', include_provider: boolean }
// Returns formatted string for CLI output

formatWorkflowTrace(workflowEntry, options) -> string
// Renders full inline trace report for a completed workflow
// options: { display_level: 'standard'|'detailed' }

formatWorkflowSummary(workflowEntries, options) -> string
// Renders summary table of multiple workflows (for /isdlc status with no args)
// options: { max_entries: number }

parseObservabilityConfig(claudeMdContent) -> { display_level: string, live_dashboard: boolean }
// Parses ## Observability section from CLAUDE.md content
// Returns defaults on parse failure
```

**Behavior by display level**:

| Level | After each phase completes | Example output |
|-------|---------------------------|----------------|
| `minimal` | Current behavior -- task list update only | `~~[2] Analyze impact (Phase 02)~~` |
| `standard` | Task update + timing + iterations + coverage | `~~[2] Analyze impact (Phase 02)~~ -- 3m 12s, 1 iteration, 87% coverage` |
| `detailed` | Standard + sub-agent breakdown + hook events + artifacts + provider | Standard line + indented sub-agent tree + hook event lines + artifact list + `[codex]` badge |

**CLAUDE.md parsing**:
```
## Observability
display_level: standard
live_dashboard: false
```
- Parsed once at workflow start (by CLI wrapper or by isdlc.md at the start of orchestration)
- Uses same pattern as `## Issue Tracker Configuration`
- Missing section -> `{ display_level: "standard", live_dashboard: false }`
- Invalid values -> fall back to defaults
- If CLAUDE.md does not exist (e.g., pure Codex project), use defaults

**Dependencies**: Reads state.json (existing). Pure formatting -- no side effects.

**Estimated size**: ~200 lines (4 functions, template rendering, display level branching)

---

## Module 4: Dashboard Server

**Responsibility**: Serve the browser visualization and provide state API

**Location**: `src/dashboard/server.js` (new, ESM)

**Public interface**:
```js
startDashboardServer(options) -> { port, url, close() }
// options: { stateJsonPath, topologyPath, port?, autoStop? }
// Returns server info and close function

// CLI entry: bin/isdlc.js dashboard [--port N]
```

**Routes**:

| Method | Path | Response | Notes |
|--------|------|----------|-------|
| GET | `/` | `index.html` | Serves the SPA |
| GET | `/api/state` | JSON | Current state.json + topology merged |
| GET | `/api/history` | JSON | `workflow_history[]` array |
| GET | `/api/history/:id` | JSON | Single workflow by slug or source_id |

**`/api/state` response shape**:
```json
{
  "active_workflow": {
    "type": "...",
    "current_phase": "...",
    "phases": [],
    "phase_status": {},
    "sub_agent_log": [],
    "hook_events": [],
    "artifacts_produced": [],
    "budget_status": {},
    "timing": {}
  },
  "phases": {
    "{phase_key}": {
      "status": "...",
      "timing": {},
      "summary": "...",
      "provider": "claude|codex|antigravity|unknown"
    }
  },
  "topology": {
    "{phase_key}": { "nodes": [], "edges": [] }
  },
  "workflow_type": "feature|fix|upgrade|test-generate",
  "timestamp": "ISO-8601"
}
```

**Server lifecycle**:
- Auto-start: CLI wrapper (`bin/isdlc.js`) spawns as detached child process when `live_dashboard: true` (provider-neutral -- the CLI wrapper runs regardless of which provider is active)
- Auto-stop: Server watches for `active_workflow` to become null, then exits after 30s grace period
- Manual start: `npx isdlc dashboard` -- stays alive until Ctrl+C
- Port selection: Try 3456, fallback 3457-3460. Print chosen port to stdout.
- Bind: 127.0.0.1 only

**Error handling**:
- state.json read failure -> return last-good cached response with `stale: true` flag
- Port in use -> try next, max 5 attempts
- Server crash -> workflow continues unaffected

**Dependencies**: Node.js `http`, `fs`, `path` (all built-in)

**Estimated size**: ~150 lines

---

## Module 5: Dashboard UI

**Responsibility**: Render interactive DAG visualization in the browser

**Location**: `src/dashboard/index.html`

**Layout**:
```
+----------------------------------------------------------+
| Header: workflow title, type badge, status, elapsed time  |
| Provider: claude | Workflow: feature                      |
+-----------------------------------------+----------------+
|                                         |                |
|          DAG Visualization              |  Detail Panel  |
|                                         |                |
|  +------+                               |  Phase: Impact |
|  | Reqs |                               |  Agent: M1     |
|  +--+---+                               |  Duration: 45s |
|     |                                   |  Iterations: 1 |
|  +--+---+                               |  Provider: codex
|  |Impact|-> M1, M2, M3 -> M4           |  Hook events: 0|
|  +--+---+                               |  Artifacts:    |
|     |                                   |   - impact.md  |
|  +--+--+                                |  Tokens: N/A   |
|  |Arch |                                |                |
|  +--+--+                                |                |
|    ...                                  |                |
|                                         |                |
+-----------------------------------------+----------------+
| Footer: poll status, server URL, workflow ID              |
+----------------------------------------------------------+
```

**DAG rendering (SVG)**:
- Topological sort of phases (vertical flow, top to bottom)
- Each phase is a group (`<g>`) containing:
  - Phase header bar (label, status color, optional provider badge)
  - Sub-agent nodes within the phase (horizontal layout for parallel, vertical for sequential)
- Edges between phases: vertical SVG paths with arrowheads
- Edges within phases (sub-agent dependencies): horizontal/diagonal paths

**Node styling**:
```
pending:   fill: #374151 (grey), stroke: #6B7280
running:   fill: #1E40AF (blue), stroke: #3B82F6, pulse animation
completed: fill: #065F46 (green), stroke: #10B981
failed:    fill: #991B1B (red), stroke: #EF4444
skipped:   fill: #374151 (grey), stroke: #6B7280, opacity: 0.5, strikethrough label
```

**Provider badges** (new):
```
claude:      small "C" circle, fill: #E86D35
codex:       small "X" circle, fill: #10A37F
antigravity: small "A" circle, fill: #7C3AED
unknown:     small "?" circle, fill: #6B7280
```

**Interaction**:
- Click node -> right panel shows detail (timing, iterations, hook events, artifacts, tokens, provider)
- Hover node -> tooltip with agent name, status, and provider
- Auto-scroll to currently running node during live view

**Polling**:
```js
const POLL_ACTIVE = 2000;   // 2s during active workflow
const POLL_HISTORY = 10000; // 10s for historical view

async function poll() {
  const res = await fetch('/api/state');
  const data = await res.json();
  updateDAG(data);
  const interval = data.active_workflow ? POLL_ACTIVE : POLL_HISTORY;
  setTimeout(poll, interval);
}
```

**Dependencies**: None -- vanilla JS, SVG, CSS embedded in single HTML file

**Estimated size**: ~500-700 lines (HTML + CSS + JS)

---

## Module 6: Status Command

**Responsibility**: Handle `/isdlc status` with -inline and -visual flags

**Location**: `src/claude/commands/isdlc.md` (new status handler section) for Claude; equivalent routing in CLI wrapper for other providers

**Interface**:
```
/isdlc status                        -> summary of recent workflows (last 5)
/isdlc status -inline {id}           -> structured CLI report for specific workflow
/isdlc status -visual {id}           -> open browser dashboard for specific workflow
/isdlc status -inline last           -> most recent workflow
/isdlc status -visual                -> current active workflow (if any)
```

**Identifier resolution**: Uses `resolveItem()` from `three-verb-utils.cjs` for slug/GitHub/Jira resolution, then matches against `workflow_history[].id` or `workflow_history[].source_id`

**Inline report format** (standard display_level):
```
WORKFLOW TRACE: REQ-0066 (feature)
Status: completed | Duration: 55m | Coverage: 91.35%
Branch: feature/REQ-0066-team-continuity-memory
Provider: claude (hybrid mode)

Phase Timeline:
  [done] 05-test-strategy    9m   1 iter   --          [claude]
  [done] 06-implementation  28m   3 iter   91.35% cov  [codex]
  [done] 16-quality-loop     8m   1 iter   all passing [claude]
  [done] 08-code-review      4m   1 iter   APPROVED    [claude]

Sub-Agent Activity:
  06-implementation:
    software-developer     24m  completed  [codex]
    implementation-reviewer 2m  completed  [codex]
    implementation-updater  2m  completed  [codex]

Hook Events: 2
  gate-blocker blocked 06-implementation: test coverage below 80% -> fixed
  test-watcher circuit-break 06-implementation: 3 identical failures -> resolved

Artifacts Produced: 12 files
  docs/requirements/REQ-0066/test-strategy.md (created)
  lib/memory.js (created)
  tests/lib/memory.test.js (created)
  ...
```

**Note on provider-neutrality**: The status command reads state.json, which is the same regardless of provider. The formatting is done by Module 3 (CLI Formatter). For Claude, isdlc.md invokes the formatter. For Codex, the CLI wrapper invokes the formatter. The output format is identical.

**Dependencies**: `resolveItem()` from three-verb-utils.cjs, state.json read, Module 3 (CLI Formatter), Module 4 (Dashboard server, for -visual)

**Estimated size**: ~120 lines of additions to isdlc.md + ~40 lines in CLI wrapper for Codex routing

---

## Module 7: Orchestrator Observability Callbacks (new)

**Responsibility**: Wire observability data collection into the provider-neutral orchestrators

**Location**: `src/core/observability/orchestrator-hooks.js` (new, ESM)

**Rationale**: The `phase-loop.js` orchestrator already has `onPhaseStart`/`onPhaseComplete`/`onError` callbacks. This module provides implementations of those callbacks that write observability data to state.json. The orchestrators call these hooks; the hooks call Module 1 (State Tracking) functions.

**Public interface**:
```js
// ESM exports from src/core/observability/orchestrator-hooks.js

createObservabilityCallbacks(stateWriter, providerName) -> {
  onPhaseStart(phase),
  onPhaseComplete(phase, result),
  onError(phase, error)
}
// stateWriter: { readState(), writeState(state) } -- injected for testability
// providerName: string -- from provider routing

// Returns callback object compatible with phase-loop.js options parameter
```

**Callback behavior**:

| Callback | Action |
|----------|--------|
| `onPhaseStart(phase)` | Append `sub_agent_log` entry with `status: "running"`, `started_at`, `provider` |
| `onPhaseComplete(phase, result)` | Update `sub_agent_log` entry with `status: "completed"`, `completed_at`, `duration_ms` from `result.duration_ms`. Append to `artifacts_produced` if result contains file paths. Write `provider` to phase state. |
| `onError(phase, error)` | Append `hook_events` entry with `action: "blocked"`, `reason: error`. Update `sub_agent_log` entry with `status: "failed"`. |

**Integration with phase-loop.js**:
```js
// In the caller that sets up the phase loop:
import { createObservabilityCallbacks } from '../observability/orchestrator-hooks.js';

const callbacks = createObservabilityCallbacks(stateWriter, providerName);
const result = await runPhaseLoop(runtime, workflow, state, {
  onPhaseStart: callbacks.onPhaseStart,
  onPhaseComplete: callbacks.onPhaseComplete,
  onError: callbacks.onError,
  maxRetries: 3
});
```

**Dependencies**: Module 1 (State Tracking), state bridge for read/write

**Estimated size**: ~80 lines

---

## Dependency Map

```
Module 7 (Orchestrator Callbacks)
  | uses
  v
Module 1 (State Tracking)
  | writes data
  v
state.json
  ^
  | reads
Module 4 (Dashboard Server) <-- reads --> phase-topology.json (Module 2)
  | serves
  v
Module 5 (Dashboard UI)

Module 3 (CLI Formatter) <-- reads --> state.json (written by Module 1)
                         <-- reads --> CLAUDE.md (## Observability)

Module 6 (Status Command) <-- reads --> state.json / workflow_history
                           <-- uses --> Module 3 (for formatting)
                           <-- uses --> Module 4 (for -visual mode)
                           <-- uses --> resolveItem() (existing)

Orchestration Layer:
  phase-loop.js  --> Module 7 callbacks --> Module 1 --> state.json
  fan-out.js     --> Module 7 callbacks --> Module 1 --> state.json
  dual-track.js  --> Module 7 callbacks --> Module 1 --> state.json
```

No circular dependencies. Module 1 (state tracking) is the foundation -- all other modules consume its data. Module 7 is the glue between orchestrators and Module 1.

---

## Implementation Order

| Order | Module | Rationale | Depends On |
|-------|--------|-----------|------------|
| 1 | Module 2: Phase Topology Config | Static JSON, no code dependencies | -- |
| 2 | Module 1: State Tracking Extensions | Data foundation for everything else | -- |
| 3 | Module 7: Orchestrator Callbacks | Wires observability into orchestrators | Module 1 |
| 4 | Module 3: CLI Formatter | Smallest user-visible change, validates data tracking | Module 1 |
| 5 | Module 4: Dashboard Server | Infrastructure for browser visualization | Module 1, Module 2 |
| 6 | Module 5: Dashboard UI | The primary visual deliverable | Module 4, Module 2 |
| 7 | Module 6: Status Command | Ties everything together | Module 1, Module 3, Module 4, Module 5 |

---

## Changes from Original Design

| Area | Original (2026-03-21) | Updated (2026-03-24) | Reason |
|------|----------------------|---------------------|--------|
| State tracking location | `common.cjs` inline | `src/core/observability/state-tracking.js` (ESM) + CJS bridge | Follows ESM-first core pattern established by multi-provider architecture |
| CLI formatter location | Embedded in `isdlc.md` | `src/core/observability/cli-formatter.js` (ESM) + CJS bridge | Must be callable by Codex adapter runner, not just Claude's isdlc.md |
| Dashboard auto-start | Phase-Loop Controller in isdlc.md | CLI wrapper (`bin/isdlc.js`) | CLI wrapper is provider-neutral; isdlc.md is Claude-specific |
| sub_agent_log schema | No `provider` or `duration_ms` field | Added `provider` and `duration_ms` fields | Multi-provider attribution and `TaskResult.duration_ms` alignment |
| hook_events schema | No `provider` field | Added `provider` field | Distinguish Claude hook events from Codex governance events |
| phase_snapshots schema | No `provider` field | Added `provider` field | Know which provider executed each phase |
| New module | -- | Module 7: Orchestrator Callbacks | Bridge between provider-neutral orchestrators and observability state tracking |
| Integration count | I1-I8 | I1-I13 | Additional integrations for multi-provider paths |
| Assumption count | A1-A10 | A1-A13 | Additional assumptions for provider-neutral behavior |
