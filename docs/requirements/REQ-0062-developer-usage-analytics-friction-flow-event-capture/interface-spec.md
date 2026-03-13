# Interface Specification: REQ-0062 Developer Usage Analytics

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-03-12
**Coverage**: 100%

---

## 1. analytics-store.cjs

### appendEvent(event, projectRoot?)

```javascript
/**
 * @param {LocalEvent} event - Must have timestamp, event_type, framework_version
 * @param {string} [projectRoot] - Auto-detected if omitted
 * @returns {void}
 *
 * Preconditions:
 *   - event.timestamp is valid ISO 8601 string
 *   - event.event_type is non-empty string
 *   - event.framework_version is non-empty string
 *
 * Postconditions:
 *   - events.jsonl has one new line appended (JSON + '\n')
 *   - .isdlc/analytics/ directory exists
 *   - On any error: no effect, debugLog records error
 *
 * Error behavior: fail-open. Never throws.
 */
```

**Valid input example**:
```json
{ "timestamp": "2026-03-12T10:00:00Z", "event_type": "workflow.start", "framework_version": "0.1.0-alpha", "workflow_type": "feature", "verb": "build" }
```

**Invalid input handling**:
- Missing `timestamp`: set to `new Date().toISOString()`
- Missing `event_type`: skip event, log warning
- Missing `framework_version`: set to `'unknown'`

### readEvents(filter?, projectRoot?)

```javascript
/**
 * @param {object} [filter]
 * @param {string} [filter.event_type] - Exact match on event_type
 * @param {string} [filter.since] - ISO timestamp, events >= this time
 * @param {string} [filter.until] - ISO timestamp, events <= this time
 * @param {string} [projectRoot]
 * @returns {LocalEvent[]} Parsed events matching filter. Empty array on error.
 *
 * Preconditions: none (graceful on missing file)
 * Postconditions: returned array is a new array (no shared references)
 *
 * Error behavior: fail-open. Returns [] on any error.
 */
```

**Output example** (filtered by event_type):
```json
[
  { "timestamp": "2026-03-12T10:00:00Z", "event_type": "workflow.start", "framework_version": "0.1.0-alpha", "workflow_type": "feature", "verb": "build" },
  { "timestamp": "2026-03-12T10:45:00Z", "event_type": "workflow.start", "framework_version": "0.1.0-alpha", "workflow_type": "fix", "verb": "fix" }
]
```

### rotateIfNeeded(maxBytes?, projectRoot?)

```javascript
/**
 * @param {number} [maxBytes=1048576] - Default 1MB
 * @param {string} [projectRoot]
 * @returns {{ rotated: boolean, rotatedFile: string|null }}
 *
 * Preconditions: none
 * Postconditions:
 *   - If file size > maxBytes: file renamed to events-{ISO}.jsonl, new empty events.jsonl created
 *   - If file size <= maxBytes: no change
 *
 * Error behavior: fail-open. Returns { rotated: false, rotatedFile: null } on error.
 */
```

### pruneEvents(retention, projectRoot?)

```javascript
/**
 * @param {{ max_entries: number, max_days: number }} retention
 * @param {string} [projectRoot]
 * @returns {{ pruned: number }}
 *
 * Preconditions:
 *   - retention.max_entries > 0
 *   - retention.max_days > 0
 *
 * Postconditions:
 *   - events.jsonl contains at most max_entries events
 *   - No event older than max_days remains
 *   - Oldest events removed first
 *
 * Error behavior: fail-open. Returns { pruned: 0 } on error.
 */
```

---

## 2. analytics-anonymizer.cjs

### anonymize(event, anonymousInstanceId)

```javascript
/**
 * @param {LocalEvent} event - Full-detail event
 * @param {string} anonymousInstanceId - UUID v4
 * @returns {TelemetryEvent} Anonymized event
 *
 * Preconditions:
 *   - event has event_type field
 *   - anonymousInstanceId is non-empty string
 *
 * Postconditions:
 *   - Returned object has only fields from TELEMETRY_ALLOWLIST[_common] + TELEMETRY_ALLOWLIST[event.event_type]
 *   - Returned object has anonymous_instance_id set
 *   - No field in returned object contains a file path, slug, branch name, project name, or description
 *   - failure_detail is NOT present; failure_category IS present (for gate.fail events)
 *
 * Invariant: anonymize is a pure function. Same input always produces same output.
 * Error behavior: throws if event_type is not in allowlist (unknown event type).
 */
```

**Input example**:
```json
{
  "timestamp": "2026-03-12T10:00:00Z",
  "event_type": "gate.fail",
  "framework_version": "0.1.0-alpha",
  "gate_type": "test_iteration",
  "phase_key": "06-implementation",
  "failure_detail": "Tests failed: src/hooks/test-watcher.test.cjs line 42",
  "failure_category": "developer",
  "slug": "REQ-0062-developer-usage-analytics"
}
```

**Output example**:
```json
{
  "timestamp": "2026-03-12T10:00:00Z",
  "event_type": "gate.fail",
  "framework_version": "0.1.0-alpha",
  "anonymous_instance_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "gate_type": "test_iteration",
  "phase_key": "06-implementation",
  "failure_category": "developer"
}
```

**Error output** (unknown event type):
```
Error: Unknown event type 'custom.event' -- not in TELEMETRY_ALLOWLIST. Add to allowlist to transmit, or this event is local-only.
```

### anonymizeBatch(events, anonymousInstanceId)

```javascript
/**
 * @param {LocalEvent[]} events
 * @param {string} anonymousInstanceId
 * @returns {TelemetryEvent[]}
 *
 * Behavior: Calls anonymize() for each event. Skips events with unknown event_type
 * (logs warning, does not throw). Returns array of successfully anonymized events.
 */
```

---

## 3. analytics-transmitter.cjs

### attemptTransmission(projectRoot?)

```javascript
/**
 * @param {string} [projectRoot]
 * @returns {Promise<{ transmitted: boolean, count: number, error: string|null }>}
 *
 * Preconditions: none (checks consent internally)
 *
 * Postconditions:
 *   - If telemetry disabled or unset: { transmitted: false, count: 0, error: null }
 *   - If no events pending: { transmitted: false, count: 0, error: null }
 *   - If retry window not elapsed: { transmitted: false, count: 0, error: 'retry_window' }
 *   - If POST succeeds: rotated stores deleted, .transmit-state updated, { transmitted: true, count: N, error: null }
 *   - If POST fails: .transmit-state updated with error, { transmitted: false, count: 0, error: '...' }
 *
 * Error behavior: never throws. All errors captured in return value.
 */
```

**HTTP Request format**:
```
POST {collector_url}
Content-Type: application/json
X-Framework-Version: 0.1.0-alpha

{
  "instance_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "batch_id": "b9e8d7c6-f5a4-3210-9876-543210fedcba",
  "events": [ ...TelemetryEvent[] ],
  "sent_at": "2026-03-12T10:05:00Z"
}
```

**HTTP Response expected**:
```json
// 200 OK
{ "received": 42, "batch_id": "b9e8d7c6-f5a4-3210-9876-543210fedcba" }

// 400 Bad Request
{ "error": "validation_failed", "details": "events[3] missing timestamp" }

// 500 Server Error
{ "error": "storage_failed", "details": "blob write error" }
```

---

## 4. analytics-config.cjs

### readConfig(projectRoot?)

```javascript
/**
 * @param {string} [projectRoot]
 * @returns {AnalyticsConfig}
 *
 * Postconditions:
 *   - Returns complete config with defaults applied for missing fields
 *   - Default: { telemetry: 'unset', anonymous_instance_id: null,
 *     collector_url: 'https://isdlc-telemetry.vercel.app/api/telemetry',
 *     retention: { max_entries: 10000, max_days: 90 } }
 *
 * Error behavior: returns defaults on any read/parse error.
 */
```

### writeConfigField(key, value, projectRoot?)

```javascript
/**
 * @param {string} key - Top-level key under 'analytics' section
 * @param {*} value - Value to set
 * @param {string} [projectRoot]
 * @returns {void}
 *
 * Preconditions: key is a valid analytics config key
 * Postconditions: .isdlc/config.yaml updated, other fields preserved
 *
 * Error behavior: fail-open. Logs error but does not throw.
 */
```

---

## 5. Collector API (`collector/api/telemetry.js`)

### POST /api/telemetry

```javascript
/**
 * @param {Request} req
 *   Body: { instance_id: string, batch_id: string, events: TelemetryEvent[], sent_at: string }
 * @param {Response} res
 *
 * Validation:
 *   - Method: POST only (405 otherwise)
 *   - Content-Type: application/json (415 otherwise)
 *   - Body size: < 1MB (413 otherwise)
 *   - instance_id: UUID format (400 otherwise)
 *   - events: array, 1-1000 elements (400 otherwise)
 *   - Each event: must have timestamp, event_type, framework_version (400 otherwise)
 *   - PII scan: no event field value matches file path pattern (400 + logged as security event)
 *
 * Success response: 200 { received: number, batch_id: string }
 * Error responses: 400, 405, 413, 415, 500 with { error: string, details: string }
 */
```

---

## 6. stats-reporter.js

### generateReport(options?, projectRoot?)

```javascript
/**
 * @param {object} [options]
 * @param {string} [options.since='30d'] - Time filter: '7d', '30d', '90d', 'all'
 * @param {string} [options.format='text'] - Output format: 'text' | 'json'
 * @param {string} [projectRoot]
 * @returns {string} Formatted report
 *
 * Postconditions:
 *   - If format='text': human-readable report string
 *   - If format='json': JSON string of aggregated metrics
 *   - If no events: "No analytics data yet. Run a workflow to start collecting."
 *
 * Error behavior: returns error message string, never throws.
 */
```

**JSON output example** (format='json'):
```json
{
  "period": { "since": "2026-02-10T00:00:00Z", "until": "2026-03-12T00:00:00Z" },
  "workflows": {
    "feature": { "count": 12, "completed": 10, "cancelled": 2, "avg_duration_minutes": 45 },
    "fix": { "count": 8, "completed": 8, "cancelled": 0, "avg_duration_minutes": 18 }
  },
  "verbs": { "build": 14, "analyze": 8, "fix": 8, "add": 5, "test-run": 3 },
  "phases": {
    "fastest": { "phase": "01-requirements", "avg_minutes": 8 },
    "slowest": { "phase": "06-implementation", "avg_minutes": 22 },
    "first_pass_rate": 0.68
  },
  "tiers": { "standard": 10, "light": 6, "trivial": 4, "epic": 2 },
  "sessions": {
    "avg_duration_minutes": 38,
    "avg_compactions": 1.4,
    "avg_cache_size_bytes": 12595
  },
  "friction": {
    "gate_failures": { "developer": 4, "framework": 2, "ambiguous": 1 },
    "circuit_breakers": 1,
    "interruptions": { "resumed": 1, "abandoned": 1 }
  },
  "trends": {
    "completion_rate": { "current": 0.86, "previous": 0.72, "direction": "improving" },
    "avg_duration": { "current": 45, "previous": 44, "direction": "stable" },
    "first_pass_rate": { "current": 0.68, "previous": 0.75, "direction": "declining" }
  }
}
```
