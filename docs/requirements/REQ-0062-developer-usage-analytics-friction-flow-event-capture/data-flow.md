# Data Flow: REQ-0062 Developer Usage Analytics

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-03-12
**Coverage**: 100%

---

## 1. Event Emission Flow

```
Developer uses iSDLC (runs workflow, invokes verb, hits gate, etc.)
  |
  v
Claude Code invokes hook dispatcher (post-task / post-bash / post-write-edit)
  |
  v
Dispatcher runs all hooks in sequence, accumulating ctx
  |
  v
analytics-event-emitter.check(ctx) runs LAST
  |-- Reads ctx.input (tool invocation details)
  |-- Reads ctx.state (state.json with changes from prior hooks)
  |-- Infers which events occurred (see event inference table in module-design.md)
  |
  v
For each inferred event:
  analytics-store.appendEvent(localEvent)
    |
    v
  fs.appendFileSync('.isdlc/analytics/events.jsonl', JSON.stringify(event) + '\n')
```

**State mutations**: Only `.isdlc/analytics/events.jsonl` is written. No state.json modification.

**Data transformation**: Raw ctx fields are mapped to LocalEvent fields. Event-type-specific fields are populated based on what's available in ctx. Missing optional fields are omitted (not set to null).

---

## 2. Session Tracking Flow

```
Claude Code starts session (new or compaction)
  |
  v
SessionStart hooks fire in order:
  1. inject-session-cache.cjs (outputs cache content to stdout -- UNCHANGED)
  2. analytics-session-tracker.cjs (observational)
       |
       |-- Read file size of .isdlc/session-cache.md
       |-- Read .isdlc/analytics/.session (session state)
       |
       |-- If .session missing OR started_at > 4 hours ago:
       |     New session: load_sequence = 1
       |     Emit session.start event
       |     Write .session: { started_at: now, load_sequence: 1, last_load_at: now }
       |
       |-- If .session exists AND started_at <= 4 hours ago:
       |     Reload: load_sequence += 1
       |     Emit session.reload event (with session_duration_at_reload)
       |     Update .session: { load_sequence, last_load_at: now }
       |
       v
  attemptTransmission() (async, non-blocking)
```

**State mutations**: `.isdlc/analytics/.session` (session tracking), `.isdlc/analytics/events.jsonl` (event append).

---

## 3. Transmission Flow

```
Trigger fires (SessionStart or workflow completion)
  |
  v
transmitter.attemptTransmission()
  |
  |-- Read analytics config (.isdlc/config.yaml)
  |     telemetry !== 'enabled'? --> EXIT (no transmission)
  |
  |-- Read .transmit-state
  |     last_attempt_at < 10 min ago AND last failed? --> EXIT (retry window)
  |
  |-- List rotated store files (events-*.jsonl), oldest first
  |-- Read current store (events.jsonl)
  |-- Combine all events
  |     No events? --> EXIT
  |
  v
anonymizer.anonymizeBatch(events, anonymous_instance_id)
  |-- For each LocalEvent:
  |     Extract _common fields (timestamp, event_type, framework_version)
  |     Extract event-type-specific allowlisted fields
  |     Add anonymous_instance_id
  |     Drop all other fields (slug, description, failure_detail, etc.)
  |
  v
TelemetryEvent[] batch ready
  |
  v
fetch(collector_url, { method: 'POST', body: { instance_id, batch_id, events, sent_at } })
  |
  |-- HTTP 200:
  |     Delete rotated stores
  |     Truncate events from current store (remove transmitted lines)
  |     Update .transmit-state: { last_success_at: now, consecutive_failures: 0 }
  |
  |-- HTTP 4xx/5xx or network error:
  |     Update .transmit-state: { last_attempt_at: now, last_error: ..., consecutive_failures++ }
  |     Events remain in local store for next attempt
  |
  v
Done (caller continues without waiting for result in hook context)
```

**State mutations**: `.isdlc/analytics/.transmit-state`, potentially `.isdlc/analytics/events.jsonl` (truncation on success), potentially rotated files (deletion on success).

---

## 4. Stats Query Flow

```
Developer runs /isdlc stats [--since 30d] [--format json]
  |
  v
stats-reporter.generateReport(options)
  |
  |-- analytics-store.readEvents({ since: computed_date })
  |     Read events.jsonl line by line
  |     Parse each line as JSON
  |     Apply filter (event_type, since, until)
  |     Return LocalEvent[]
  |
  v
Aggregate events by category:
  |
  |-- Workflows: group by event_type=workflow.*, count by workflow_type
  |     completion_rate = complete / (complete + cancel)
  |     avg_duration = mean(duration_minutes) per type
  |
  |-- Verbs: count event_type=verb.invoke, group by verb field
  |
  |-- Phases: group event_type=phase.complete by phase_key
  |     first_pass_rate = count(first_pass=true) / total
  |     avg_duration per phase
  |
  |-- Tiers: count event_type=tier.select, group by tier field
  |
  |-- Sessions: group event_type=session.* by session_id (derived from date)
  |     compaction_count = count(session.reload) per session
  |     avg_cache_size = mean(session_cache_size_bytes)
  |
  |-- Friction: count event_type=gate.fail, group by failure_category
  |     circuit_breakers = count(circuit_breaker.trigger)
  |     interruptions = count(interrupt.suspend), resumed = count(interrupt.resume)
  |
  |-- Trends: split events into current period and previous period (same length)
  |     Compare key metrics between periods
  |     Direction: improving (>5% better), declining (>5% worse), stable
  |
  v
Format output (text or JSON)
  |
  v
Return formatted string
```

**State mutations**: None. Read-only operation.

---

## 5. Consent Flow

```
Developer completes first workflow successfully
  |
  v
workflow-completion-enforcer detects completed workflow in workflow_history
  |
  v
consent-prompt.shouldPrompt()
  |-- Read analytics config
  |     telemetry !== 'unset'? --> EXIT (already prompted)
  |-- Check workflow_history has >= 1 completed entry
  |     No completed workflows? --> EXIT (too early)
  |
  v
Display prompt to stderr:
  "Help improve iSDLC by sharing anonymous usage data?
   You can preview what's sent with '/isdlc telemetry preview'. [y/n]"
  |
  |-- 'y':
  |     writeConfigField('telemetry', 'enabled')
  |     generateInstanceId() --> writeConfigField('anonymous_instance_id', uuid)
  |
  |-- 'n':
  |     writeConfigField('telemetry', 'disabled')
  |
  |-- other / timeout:
  |     Remain 'unset', re-prompt on next workflow completion
  |
  v
Done
```

**State mutations**: `.isdlc/config.yaml` (telemetry state, instance ID).

---

## 6. Telemetry Preview Flow

```
Developer runs /isdlc telemetry preview
  |
  v
telemetry-command.execute('preview')
  |
  |-- analytics-store.readEvents() -- read all pending events
  |-- analytics-config.readConfig() -- get anonymous_instance_id
  |
  v
anonymizer.anonymizeBatch(events, instance_id)
  |-- Transform each event through allowlist
  |
  v
Display output:
  "Pending events: 42
   Sample (first 5):
   { timestamp, event_type, framework_version, anonymous_instance_id, ... }
   ...
   No PII fields present. These events would be sent to: {collector_url}"
```

**State mutations**: None. Read-only operation.

---

## 7. Retention Pruning Flow

```
analytics-store.appendEvent() is called
  |
  v
Before append, check if pruning is due:
  |-- Read event count (wc -l equivalent on events.jsonl)
  |-- Read first event timestamp
  |
  |-- If count > max_entries OR oldest event > max_days:
  |     pruneEvents(retention)
  |       Read all events
  |       Sort by timestamp ascending
  |       Remove events until count <= max_entries AND oldest <= max_days
  |       Write remaining events back to events.jsonl
  |
  v
Proceed with append
```

**Pruning frequency**: Checked on every append, but actual pruning only occurs when limits are exceeded. The check itself is O(1) (read first line for timestamp, stat for file line count estimate via file size / avg line size).

**State mutations**: `.isdlc/analytics/events.jsonl` (truncation of old events).

---

## 8. Collector Storage Flow

```
Collector receives POST /api/telemetry
  |
  v
Validate request:
  |-- Method = POST? Content-Type = application/json? Size < 1MB?
  |-- Parse body: { instance_id, batch_id, events, sent_at }
  |-- Validate instance_id format (UUID)
  |-- Validate events array (1-1000, each has required fields)
  |-- PII scan: no field value matches file path pattern
  |
  v
storage.storeBatch(events, instance_id)
  |
  |-- Compute blob path: telemetry/{YYYY-MM-DD}/{instance_prefix_4}.jsonl
  |-- For each event: append JSON line to blob
  |-- Vercel Blob API: put(path, content, { addRandomSuffix: false, access: 'public' })
  |     Note: 'public' here means accessible via blob URL, not unauthenticated API
  |
  v
Return 200 { received: events.length, batch_id }
```

**Persistence**: Vercel Blob storage (S3-compatible). Date-partitioned. Instance ID prefix groups without full ID exposure.

---

## 9. File Layout Summary

```
.isdlc/
  config.yaml                          # analytics.telemetry, analytics.anonymous_instance_id, etc.
  analytics/
    events.jsonl                       # Current event store (append-only)
    events-2026-03-12T10-00-00Z.jsonl  # Rotated store (pending transmission)
    .session                           # Session tracking state
    .transmit-state                    # Transmission retry state
```
