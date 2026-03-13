# Module Design: REQ-0062 Developer Usage Analytics

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-03-12
**Coverage**: 100%

---

## Module 1: analytics-store (`src/claude/hooks/lib/analytics-store.cjs`)

**Responsibility**: Manages the local JSONL event store -- append, rotate, prune, and read operations.

**Public Interface**:

```javascript
/**
 * Append a LocalEvent to the event store.
 * Creates .isdlc/analytics/ directory if missing.
 * @param {LocalEvent} event - Structured event object
 * @param {string} [projectRoot] - Project root (auto-detected if omitted)
 * @returns {void}
 * @throws Never -- fail-open, errors logged to debugLog
 */
function appendEvent(event, projectRoot)

/**
 * Read all events from the store, optionally filtered.
 * @param {object} [filter] - Optional filter
 * @param {string} [filter.event_type] - Filter by event type
 * @param {string} [filter.since] - ISO timestamp lower bound
 * @param {string} [filter.until] - ISO timestamp upper bound
 * @param {string} [projectRoot] - Project root
 * @returns {LocalEvent[]} Array of parsed events (empty on error)
 */
function readEvents(filter, projectRoot)

/**
 * Rotate the event store if it exceeds maxBytes.
 * Renames current store to events-{timestamp}.jsonl.
 * Creates new empty store.
 * @param {number} [maxBytes=1048576] - Rotation threshold (default 1MB)
 * @param {string} [projectRoot] - Project root
 * @returns {{ rotated: boolean, rotatedFile: string|null }}
 */
function rotateIfNeeded(maxBytes, projectRoot)

/**
 * Prune events exceeding retention limits.
 * Removes oldest events first.
 * @param {object} retention - { max_entries: number, max_days: number }
 * @param {string} [projectRoot] - Project root
 * @returns {{ pruned: number }} Count of pruned events
 */
function pruneEvents(retention, projectRoot)

/**
 * Delete a rotated store file after successful transmission.
 * @param {string} filePath - Absolute path to rotated file
 * @returns {void}
 */
function deleteRotatedStore(filePath)

/**
 * List all rotated store files pending transmission.
 * @param {string} [projectRoot] - Project root
 * @returns {string[]} Array of absolute file paths, oldest first
 */
function listRotatedStores(projectRoot)
```

**Internal State**:
- Store path: `.isdlc/analytics/events.jsonl`
- Rotated files: `.isdlc/analytics/events-{ISO-timestamp}.jsonl`
- Session tracker: `.isdlc/analytics/.session` (JSON, session-scoped)

**Dependencies**: `common.cjs` (debugLog, getProjectRoot only)

**Estimated Size**: ~150 lines

---

## Module 2: analytics-event-emitter (`src/claude/hooks/analytics-event-emitter.cjs`)

**Responsibility**: Dispatcher-compatible hook that reads accumulated ctx after all other hooks run and emits appropriate analytics events. Determines which events to emit based on state changes and input patterns.

**Public Interface**:

```javascript
/**
 * Dispatcher-compatible check function.
 * Runs last in each dispatcher's hook chain.
 * @param {object} ctx - { input, state, manifest, requirements, workflows }
 * @returns {{ decision: 'allow', stateModified: false }}
 */
function check(ctx)
```

**Event Inference Logic**:

| Dispatcher | Input Signal | Event Emitted |
|-----------|-------------|---------------|
| post-task | `input.tool_input.skill === 'isdlc'` + verb detected | `verb.invoke` |
| post-task | State transition: `active_workflow` appeared | `workflow.start` |
| post-task | State transition: `active_workflow` cleared + `workflow_history` grew | `workflow.complete` or `workflow.cancel` |
| post-task | Phase key changed in `active_workflow.current_phase` | `phase.complete` |
| post-write-edit | State write with `pending_escalations` containing gate failure | `gate.fail` |
| post-write-edit | State write with gate passed (iteration requirement satisfied) | `gate.pass` |
| post-write-edit | State write with `sizing_decision` in meta.json | `tier.select` |
| post-write-edit | State write with `suspended_workflow` appeared | `interrupt.suspend` |
| post-write-edit | State write with `suspended_workflow` cleared | `interrupt.resume` |
| post-bash | Test command detected + circuit breaker triggered | `circuit_breaker.trigger` |

**Dependencies**: `analytics-store.cjs` (appendEvent), `common.cjs` (debugLog)

**Estimated Size**: ~200 lines

---

## Module 3: analytics-anonymizer (`src/claude/hooks/lib/analytics-anonymizer.cjs`)

**Responsibility**: Pure-function transform from LocalEvent to TelemetryEvent using an explicit allowlist. New fields excluded by default.

**Public Interface**:

```javascript
/**
 * Transform a LocalEvent into a TelemetryEvent.
 * Only allowlisted fields pass through. All others are stripped.
 * @param {LocalEvent} event - Full-detail local event
 * @param {string} anonymousInstanceId - Pre-generated UUID
 * @returns {TelemetryEvent} Anonymized event safe for transmission
 */
function anonymize(event, anonymousInstanceId)

/**
 * Transform an array of LocalEvents for batch transmission.
 * @param {LocalEvent[]} events - Array of local events
 * @param {string} anonymousInstanceId - Pre-generated UUID
 * @returns {TelemetryEvent[]} Array of anonymized events
 */
function anonymizeBatch(events, anonymousInstanceId)

/**
 * The allowlist definition. Exported for testing and preview transparency.
 * @type {Record<string, string[]>} Map of event_type to allowed field names
 */
const TELEMETRY_ALLOWLIST
```

**Allowlist Definition**:

```javascript
const TELEMETRY_ALLOWLIST = {
  // Common fields included for ALL event types
  _common: ['timestamp', 'event_type', 'framework_version'],

  // Per-event-type allowed fields
  'workflow.start':       ['workflow_type', 'verb'],
  'workflow.complete':    ['workflow_type', 'duration_minutes', 'phases_completed', 'verb'],
  'workflow.cancel':      ['workflow_type', 'duration_minutes', 'phases_completed', 'exit_reason', 'verb'],
  'phase.complete':       ['phase_key', 'iterations_used', 'first_pass', 'duration_minutes'],
  'gate.pass':            ['gate_type', 'phase_key'],
  'gate.fail':            ['gate_type', 'phase_key', 'failure_category'],
  'tier.select':          ['tier', 'source'],
  'interrupt.suspend':    ['workflow_type', 'phase_at_interrupt'],
  'interrupt.resume':     ['workflow_type', 'phase_at_interrupt'],
  'session.start':        ['session_cache_size_bytes', 'load_sequence'],
  'session.reload':       ['session_cache_size_bytes', 'load_sequence', 'session_duration_at_reload'],
  'circuit_breaker.trigger': ['phase_key', 'identical_failure_count'],
  'verb.invoke':          ['verb'],
};
```

**PII Strip Rules**:
- Any field not in `_common` + event-specific allowlist is dropped
- `failure_detail` (from gate.fail LocalEvent) is replaced with `failure_category` (enum: `developer | framework | ambiguous`)
- `slug`, `file_path`, `branch_name`, `project_name`, `description` -- never appear in allowlist

**Dependencies**: None (pure functions)

**Estimated Size**: ~80 lines

---

## Module 4: analytics-transmitter (`src/claude/hooks/lib/analytics-transmitter.cjs`)

**Responsibility**: Batch transmission of anonymized events to the collector endpoint with store-and-forward semantics and retry logic.

**Public Interface**:

```javascript
/**
 * Attempt to transmit pending events.
 * Reads config for consent state, collector URL, and instance ID.
 * Skips if telemetry disabled, no events pending, or retry window not elapsed.
 * @param {string} [projectRoot] - Project root
 * @returns {Promise<{ transmitted: boolean, count: number, error: string|null }>}
 */
async function attemptTransmission(projectRoot)

/**
 * Check if transmission should be attempted.
 * @param {string} [projectRoot] - Project root
 * @returns {{ shouldTransmit: boolean, reason: string }}
 */
function shouldTransmit(projectRoot)
```

**Internal Logic**:

1. Read `.isdlc/config.yaml` for `telemetry` state -- skip if `disabled` or `unset`
2. Read `.isdlc/analytics/.transmit-state` for `last_attempt_at` -- skip if < 10 min ago and last attempt failed
3. Read rotated stores first (oldest), then current store
4. Run `anonymizeBatch()` on all events
5. POST batch to `collector_url` with headers: `Content-Type: application/json`, `X-Framework-Version: {version}`
6. On HTTP 200: delete rotated stores, truncate current store events that were sent
7. On failure: write `last_attempt_at` to `.transmit-state`, return error

**Transmission state file** (`.isdlc/analytics/.transmit-state`):
```json
{
  "last_attempt_at": "2026-03-12T10:00:00Z",
  "last_success_at": "2026-03-12T09:50:00Z",
  "last_error": null,
  "consecutive_failures": 0
}
```

**Dependencies**: `analytics-store.cjs` (readEvents, listRotatedStores, deleteRotatedStore), `analytics-anonymizer.cjs` (anonymizeBatch), `analytics-config.cjs` (readConfig)

**Estimated Size**: ~120 lines

---

## Module 5: analytics-config (`src/claude/hooks/lib/analytics-config.cjs`)

**Responsibility**: Read and write analytics configuration in `.isdlc/config.yaml`. Manages consent state, instance ID, retention settings, and collector URL.

**Public Interface**:

```javascript
/**
 * Read analytics configuration.
 * @param {string} [projectRoot] - Project root
 * @returns {AnalyticsConfig} Parsed config with defaults applied
 */
function readConfig(projectRoot)

/**
 * Write a config field.
 * Preserves existing fields, updates only the specified key.
 * @param {string} key - Config key (e.g., 'telemetry', 'anonymous_instance_id')
 * @param {*} value - Value to write
 * @param {string} [projectRoot] - Project root
 * @returns {void}
 */
function writeConfigField(key, value, projectRoot)

/**
 * Generate and persist a new anonymous instance ID.
 * Only called once, on first telemetry consent.
 * @param {string} [projectRoot] - Project root
 * @returns {string} The generated UUID
 */
function generateInstanceId(projectRoot)
```

**Config Schema** (`.isdlc/config.yaml`):

```yaml
# Analytics configuration
analytics:
  # Consent state: enabled | disabled | unset (default)
  telemetry: unset

  # Random UUID, generated on first consent. Never derived from identity.
  anonymous_instance_id: null

  # Collector endpoint URL
  collector_url: "https://isdlc-telemetry.vercel.app/api/telemetry"

  # Retention limits (whichever triggers first)
  retention:
    max_entries: 10000
    max_days: 90
```

**Dependencies**: `fs`, `path`. Uses simple YAML read/write (key-value only, no complex nesting beyond one level -- avoids YAML parser dependency by using line-based read/write).

**Estimated Size**: ~100 lines

---

## Module 6: analytics-session-tracker (`src/claude/hooks/analytics-session-tracker.cjs`)

**Responsibility**: SessionStart hook that tracks session cache loads for compaction detection and triggers transmission attempts.

**Public Interface**:

```javascript
// No exported function -- this is a standalone SessionStart hook.
// Invoked by Claude Code on session start / compaction / clear.
// Outputs nothing to stdout (observational only).
```

**Internal Logic**:

1. Read `.isdlc/session-cache.md` file size (bytes)
2. Read `.isdlc/analytics/.session` for current `load_sequence` (default 0 if missing)
3. Increment `load_sequence`
4. If `load_sequence === 1`: emit `session.start` event with `session_cache_size_bytes`
5. If `load_sequence > 1`: emit `session.reload` event with `session_cache_size_bytes` and `session_duration_at_reload` (derived from `.session` file's `started_at` vs now)
6. Write updated `.session` file: `{ started_at, load_sequence, last_load_at }`
7. Attempt transmission (non-blocking): call `attemptTransmission()`

**Session file** (`.isdlc/analytics/.session`):
```json
{
  "started_at": "2026-03-12T10:00:00Z",
  "load_sequence": 1,
  "last_load_at": "2026-03-12T10:00:00Z"
}
```

**Session detection logic**:
- If `.session` file is missing or `started_at` is > 4 hours ago: treat as new session, reset `load_sequence` to 0
- This handles the case where Claude Code exits without cleanup

**Dependencies**: `analytics-store.cjs` (appendEvent), `analytics-transmitter.cjs` (attemptTransmission), `fs`, `path`

**Estimated Size**: ~80 lines

---

## Module 7: stats-reporter (`lib/analytics/stats-reporter.js`)

**Responsibility**: Aggregation and display logic for `/isdlc stats` command. Reads local event store and produces formatted output.

**Public Interface**:

```javascript
/**
 * Generate and display the stats report.
 * @param {object} [options] - Display options
 * @param {string} [options.since] - Time filter (e.g., '7d', '30d', 'all')
 * @param {string} [options.format] - Output format ('text' | 'json')
 * @param {string} [projectRoot] - Project root
 * @returns {string} Formatted stats output
 */
function generateReport(options, projectRoot)
```

**Output Sections**:

```
iSDLC Usage Stats (last 30 days)
================================

Workflows
  feature: 12 runs, 83% completed, avg 45 min
  fix:      8 runs, 100% completed, avg 18 min
  upgrade:  2 runs, 50% completed, avg 62 min
  Total:   22 runs, 86% completion rate

Verbs
  build: 14 | analyze: 8 | fix: 8 | add: 5 | test-run: 3

Phases
  Fastest: 01-requirements (avg 8 min)
  Slowest: 06-implementation (avg 22 min)
  First-pass rate: 68% (15/22 phases passed gate on first try)

Tiers Selected
  standard: 10 | light: 6 | trivial: 4 | epic: 2

Sessions
  Avg session duration: 38 min
  Avg compactions per session: 1.4
  Session cache size (avg): 12.3 KB

Friction Points (investigate)
  Gate failures: 7 (4 developer, 2 framework, 1 ambiguous)
  Circuit breakers: 1
  Interruptions: 2 (1 resumed, 1 abandoned)

Flow Patterns (protect)
  First-pass successes: 15/22 phases
  Zero-failure workflows: 14/22

Trends (vs previous 30 days)
  Completion rate: 86% -> improving (was 72%)
  Avg duration: 45 min -> stable
  First-pass rate: 68% -> declining (was 75%)
```

**Dependencies**: `analytics-store.cjs` (readEvents)

**Estimated Size**: ~250 lines

---

## Module 8: telemetry-command (`lib/analytics/telemetry-command.js`)

**Responsibility**: Handles `/isdlc telemetry` subcommands: `on`, `off`, `preview`, `status`.

**Public Interface**:

```javascript
/**
 * Execute a telemetry subcommand.
 * @param {string} subcommand - 'on' | 'off' | 'preview' | 'status'
 * @param {string} [projectRoot] - Project root
 * @returns {string} Command output
 */
function execute(subcommand, projectRoot)
```

**Subcommand Behavior**:

| Subcommand | Action |
|-----------|--------|
| `on` | Set `telemetry: enabled` in config. Generate `anonymous_instance_id` if not present. Print confirmation. |
| `off` | Set `telemetry: disabled` in config. Print confirmation. Note: local collection continues. |
| `preview` | Read pending events, run anonymizer, display TelemetryEvent output. Print count and sample. |
| `status` | Print current state (`enabled`/`disabled`/`unset`), instance ID (masked), collector URL, pending event count, last transmission result. |

**Dependencies**: `analytics-config.cjs`, `analytics-anonymizer.cjs`, `analytics-store.cjs`

**Estimated Size**: ~100 lines

---

## Module 9: consent-prompt (`lib/analytics/consent-prompt.js`)

**Responsibility**: Displays the one-time telemetry consent prompt after first workflow completion.

**Public Interface**:

```javascript
/**
 * Check if consent prompt should be shown and display it.
 * Called from workflow-completion-enforcer after successful workflow completion.
 * @param {string} [projectRoot] - Project root
 * @returns {{ prompted: boolean, response: 'enabled'|'disabled'|null }}
 */
function checkAndPrompt(projectRoot)

/**
 * Check if the prompt should fire (without displaying).
 * @param {string} [projectRoot] - Project root
 * @returns {boolean}
 */
function shouldPrompt(projectRoot)
```

**Prompt Logic**:
1. Read config -- if `telemetry` is not `unset`, skip (already prompted)
2. Check `workflow_history` -- if no completed workflows exist, skip (too early)
3. Display prompt text to stderr (not stdout, to avoid interfering with hook protocol)
4. Read response from stdin (y/n)
5. On `y`: call `writeConfigField('telemetry', 'enabled')` + `generateInstanceId()`
6. On `n`: call `writeConfigField('telemetry', 'disabled')`
7. On anything else or timeout: skip, remain `unset`, re-prompt on next completion

**Dependencies**: `analytics-config.cjs`

**Estimated Size**: ~60 lines

---

## Module 10: Collector Service (`collector/`)

**Responsibility**: Vercel serverless function that receives, validates, and stores anonymized telemetry batches.

### `collector/api/telemetry.js` (Vercel serverless route)

```javascript
/**
 * POST /api/telemetry
 * Receives a batch of TelemetryEvent objects.
 * Validates schema, stores to Blob, returns acknowledgment.
 *
 * @param {Request} req - { body: { events: TelemetryEvent[], instance_id: string } }
 * @returns {Response} 200 OK | 400 Bad Request | 500 Server Error
 */
export default async function handler(req, res)
```

**Validation Rules**:
- Method must be POST
- Content-Type must be application/json
- Body must contain `events` array (max 1000 events per batch)
- Body must contain `instance_id` (UUID format)
- Each event must have `timestamp`, `event_type`, `framework_version`
- Total body size must be < 1MB
- No field in any event may contain a file path pattern (`/` or `\` with depth > 1)

### `collector/lib/storage.js`

```javascript
/**
 * Store a validated batch of events.
 * Appends events as JSONL to a date-partitioned blob.
 * @param {TelemetryEvent[]} events - Validated events
 * @param {string} instanceId - Anonymous instance ID
 * @returns {Promise<{ stored: number, blob: string }>}
 */
async function storeBatch(events, instanceId)
```

**Storage Layout**: `telemetry/{YYYY-MM-DD}/{instance_id_prefix_4chars}.jsonl`
- Date-partitioned for retention and querying
- Instance ID prefix groups events without full ID exposure in file names
- Each line is a single TelemetryEvent JSON object

### `collector/vercel.json`

```json
{
  "functions": {
    "api/telemetry.js": {
      "maxDuration": 10,
      "memory": 128
    }
  }
}
```

**Dependencies**: `@vercel/blob` (Vercel Blob SDK -- only dependency, in collector package.json)

**Estimated Size**: ~120 lines total across files

---

## Data Structures

### LocalEvent (full detail, stays on disk)

```typescript
interface LocalEvent {
  // Common fields (all events)
  timestamp: string;          // ISO 8601
  event_type: string;         // e.g., 'workflow.start', 'gate.fail'
  framework_version: string;  // e.g., '0.1.0-alpha'

  // Workflow events
  workflow_type?: string;     // 'feature' | 'fix' | 'upgrade' | 'discover' | 'test'
  verb?: string;              // 'build' | 'fix' | 'upgrade' | 'analyze' | 'add' | 'test-run' | 'test-generate'
  duration_minutes?: number;
  phases_completed?: number;
  exit_reason?: string;       // For cancellations

  // Phase events
  phase_key?: string;         // e.g., '01-requirements', '06-implementation'
  iterations_used?: number;
  first_pass?: boolean;

  // Gate events
  gate_type?: string;         // 'test_iteration' | 'constitutional_validation' | 'interactive_elicitation' | 'agent_delegation' | 'artifact_presence'
  failure_detail?: string;    // Full detail (LOCAL ONLY -- stripped in anonymization)
  failure_category?: string;  // 'developer' | 'framework' | 'ambiguous'

  // Tier events
  tier?: string;              // 'trivial' | 'light' | 'standard' | 'epic'
  source?: string;            // 'auto' | 'user-override'

  // Interrupt events
  phase_at_interrupt?: string;

  // Session events
  session_cache_size_bytes?: number;
  load_sequence?: number;
  session_duration_at_reload?: number; // minutes

  // Circuit breaker events
  identical_failure_count?: number;

  // Local-only fields (NEVER transmitted)
  slug?: string;              // Project slug
  description?: string;       // Workflow description
}
```

### TelemetryEvent (anonymized, transmitted)

```typescript
interface TelemetryEvent {
  // Always present
  timestamp: string;
  event_type: string;
  framework_version: string;
  anonymous_instance_id: string;  // Added by anonymizer

  // Event-specific fields (only those in TELEMETRY_ALLOWLIST)
  // See Module 3 allowlist definition for per-event-type fields
  [key: string]: string | number | boolean;
}
```

### AnalyticsConfig (persisted in .isdlc/config.yaml)

```typescript
interface AnalyticsConfig {
  telemetry: 'enabled' | 'disabled' | 'unset';
  anonymous_instance_id: string | null;
  collector_url: string;
  retention: {
    max_entries: number;  // default 10000
    max_days: number;     // default 90
  };
}
```

### TransmitState (persisted in .isdlc/analytics/.transmit-state)

```typescript
interface TransmitState {
  last_attempt_at: string | null;    // ISO timestamp
  last_success_at: string | null;    // ISO timestamp
  last_error: string | null;         // Error message
  consecutive_failures: number;      // Reset on success
}
```

### SessionState (persisted in .isdlc/analytics/.session)

```typescript
interface SessionState {
  started_at: string;       // ISO timestamp
  load_sequence: number;    // Increments on each SessionStart fire
  last_load_at: string;     // ISO timestamp
}
```

---

## Dependency Graph

```
analytics-event-emitter.cjs
  └── analytics-store.cjs
        └── common.cjs (debugLog, getProjectRoot)

analytics-session-tracker.cjs
  ├── analytics-store.cjs
  └── analytics-transmitter.cjs
        ├── analytics-store.cjs
        ├── analytics-anonymizer.cjs (pure, no deps)
        └── analytics-config.cjs

stats-reporter.js
  └── analytics-store.cjs

telemetry-command.js
  ├── analytics-config.cjs
  ├── analytics-anonymizer.cjs
  └── analytics-store.cjs

consent-prompt.js
  └── analytics-config.cjs

collector/api/telemetry.js
  └── collector/lib/storage.js
        └── @vercel/blob
```

No circular dependencies. All arrows point downward.
