# Developer Usage Analytics — Friction/Flow Event Capture

**Source**: GitHub #121
**Type**: Feature (REQ)

## Description

Developer usage analytics — capture friction events (gate failures, circuit breakers, cancellations, hook blocks), flow events (smooth completions, first-pass successes), and optional developer sentiment on workflow completion/cancellation. Local-only analytics with /isdlc stats reporting. Privacy-respecting: no file paths, no code content, no branch names in telemetry. Friction log (.isdlc/friction.log) with structural events. Completion/cancellation prompts for developer sentiment. Stats command that reports smooth runs (protect these) vs friction points (investigate these) with trend detection.

## Key Requirements

### Friction Events (auto-captured)
- Gate failures (which gate, which phase, which requirement failed)
- Circuit breaker triggers (phase, iteration count)
- Workflow cancellations (workflow type, phase reached, reason)
- Hook blocks (which hook, which phase, recovery action taken)

### Flow Events (auto-captured)
- Workflow completed without gate failures
- Phase completed on first iteration
- Implementation passed quality loop on first pass
- Roundtable analysis accepted without amendments

### Sentiment Capture (developer-initiated, optional)
- On workflow completion: "What worked well? What didn't? (optional)"
- On workflow cancellation: "What went wrong? (optional)"
- Stored locally, developer reviews before sharing

### Friction Log (.isdlc/friction.log)
- Append-only structured event log
- No file paths, no code content, no branch names
- Events: timestamp, workflow type, phase, event type, structural metadata only
- Developer can inspect the log at any time

### Stats Command (/isdlc stats)
- Smooth runs section: protect these patterns
- Friction points section: investigate these patterns
- Trend detection across workflow history
- Per-phase success rates
- First-pass vs retry rates

### Privacy Requirements
- All data local-only (no network transmission)
- No file paths in telemetry
- No code content in telemetry
- No branch names in telemetry
- Developer can delete the log at any time
