# Error Taxonomy: REQ-0062 Developer Usage Analytics

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-03-12
**Coverage**: 100%

---

## Error Propagation Strategy

**All analytics errors use log-and-continue**. No analytics error ever blocks framework operation. Every function in the analytics subsystem is fail-open.

| Layer | Strategy | Rationale |
|-------|----------|-----------|
| Event emission (hooks) | Catch all, debugLog, return `{ decision: 'allow' }` | Analytics must never block hook chain |
| Local store (read/write) | Catch all, debugLog, return safe default (empty array, false, etc.) | File I/O failures should not affect workflow |
| Transmission | Catch all, update .transmit-state with error, return result object | Network failures are expected and retried |
| Stats command | Catch all, return user-friendly error message string | CLI command should always produce output |
| Collector service | Return HTTP error code with structured body | Standard HTTP error handling |

---

## Error Code Table

### Client-Side Errors (analytics modules)

| Code | Description | Trigger | Severity | Recovery |
|------|-------------|---------|----------|----------|
| AE-001 | Store directory creation failed | `.isdlc/analytics/` cannot be created (permissions) | Warning | Skip event emission; retry on next event |
| AE-002 | Event append failed | `fs.appendFileSync` throws (disk full, permissions) | Warning | Skip event; debugLog error; next event retries naturally |
| AE-003 | Event store read failed | `events.jsonl` cannot be read or parsed | Warning | Return empty array; stats shows "No data yet" |
| AE-004 | Malformed event line | JSON.parse fails on a line in events.jsonl | Info | Skip malformed line; continue reading remaining lines |
| AE-005 | Config read failed | `.isdlc/config.yaml` cannot be read or parsed | Warning | Use defaults (telemetry: unset, default retention) |
| AE-006 | Config write failed | `.isdlc/config.yaml` cannot be written | Warning | Consent state not persisted; re-prompt on next completion |
| AE-007 | Session file read/write failed | `.isdlc/analytics/.session` I/O error | Warning | Treat as new session; compaction detection degraded |
| AE-008 | Store rotation failed | File rename fails during rotation | Warning | Continue appending to current file; rotation retried on next event |
| AE-009 | Retention pruning failed | Read/write during prune fails | Warning | Skip pruning; store may grow beyond limits temporarily |
| AE-010 | Unknown event type in anonymizer | Event type not in TELEMETRY_ALLOWLIST | Info | Skip event in batch; log warning; other events transmitted |
| AE-011 | Transmission network failure | fetch() throws or times out (no connectivity) | Info | Update .transmit-state; retry on next trigger (10 min window) |
| AE-012 | Transmission HTTP error | Collector returns 4xx or 5xx | Warning | Update .transmit-state with status code; retry on next trigger |
| AE-013 | Transmit state file I/O failed | `.transmit-state` cannot be read or written | Info | Ignore retry window; attempt transmission anyway |
| AE-014 | Instance ID generation failed | `crypto.randomUUID()` not available | Warning | Fallback to `Date.now().toString(36) + Math.random().toString(36)` |

### Collector-Side Errors

| Code | Description | Trigger | Severity | Recovery |
|------|-------------|---------|----------|----------|
| CE-001 | Invalid HTTP method | Non-POST request to /api/telemetry | Info | Return 405 Method Not Allowed |
| CE-002 | Invalid content type | Non-JSON content type | Info | Return 415 Unsupported Media Type |
| CE-003 | Body too large | Request body > 1MB | Warning | Return 413 Payload Too Large |
| CE-004 | Missing required field | instance_id, events, or event fields missing | Warning | Return 400 with details of missing field |
| CE-005 | Invalid instance ID format | instance_id is not UUID format | Warning | Return 400 |
| CE-006 | Events array invalid | Not an array, empty, or > 1000 elements | Warning | Return 400 with details |
| CE-007 | PII detected in event | Field value matches file path pattern | Error | Return 400; log as security event; do not store batch |
| CE-008 | Blob storage write failed | Vercel Blob API error | Error | Return 500; client retries |
| CE-009 | Blob storage read failed | Blob retrieval error during query | Error | Return 500 |

---

## Graceful Degradation Levels

| Level | Condition | What Still Works | What Degrades |
|-------|-----------|-----------------|---------------|
| Full | All systems operational | Everything | Nothing |
| No transmission | Collector unreachable or telemetry disabled | Local event collection, `/isdlc stats`, `/isdlc telemetry preview` | Remote telemetry (events queue locally) |
| No local store | events.jsonl write fails (disk issue) | Framework operation, workflow execution | All analytics (events lost until I/O recovers) |
| No config | config.yaml unreadable | Local event collection with defaults, framework operation | Consent state (defaults to unset), retention (defaults applied) |
| Corrupted store | events.jsonl has malformed lines | Framework operation, new events still append | Stats may show partial data; malformed lines skipped |

---

## User-Facing Error Messages

| Scenario | Message |
|----------|---------|
| No analytics data yet | "No analytics data yet. Run a workflow to start collecting." |
| Stats with corrupted store | "Some events could not be read (X skipped). Showing available data." |
| Telemetry preview with no events | "No pending events to preview." |
| Telemetry on but no instance ID | "Telemetry enabled. Anonymous instance ID generated." |
| Telemetry toggle confirmation | "Telemetry [enabled/disabled]. Local analytics collection continues regardless." |
| Config read failure | (silent -- defaults applied, no user message) |
