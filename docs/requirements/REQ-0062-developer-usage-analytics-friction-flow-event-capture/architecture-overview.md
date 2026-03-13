# Architecture Overview: REQ-0062 Developer Usage Analytics

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-03-12
**Coverage**: 100%

---

## 1. Architecture Options

### Decision 1: Event Emission Pattern

How do hooks emit analytics events?

| Option | Summary | Pros | Cons | Pattern Alignment | Verdict |
|--------|---------|------|------|-------------------|---------|
| A: Inline in existing hooks | Each hook (gate-blocker, test-watcher, etc.) calls `emitAnalyticsEvent()` directly | Minimal new files; event emitted at exact point of occurrence | Couples analytics to enforcement hooks; every hook gains analytics dependency; 29 hooks to modify | Against (hooks are single-responsibility today) | Eliminated |
| B: Dedicated analytics dispatcher hook | Single PostToolUse hook reads state changes after other hooks run, infers events from state diffs | Fully decoupled; single write point; existing hooks unchanged | Cannot capture events that don't produce state changes (e.g., gate pass without state mutation); state diff logic is complex | Partially aligned (dispatchers consolidate, but diff-based inference is novel) | Eliminated |
| C: Analytics emitter in dispatcher chain | Analytics `check()` function added to each dispatcher (post-task, post-bash, post-write-edit); reads ctx after all other hooks run; emits events based on accumulated state | Follows proven dispatcher pattern; single analytics module; existing hooks mostly unchanged; accesses full ctx including input, state, and other hook results | Dispatchers gain one more hook call; analytics logic centralized in one module but wired through 3+ dispatchers | Strong (matches `log-skill-usage` pattern exactly) | **Selected** |

### Decision 2: Local Store Format

| Option | Summary | Pros | Cons | Pattern Alignment | Verdict |
|--------|---------|------|------|-------------------|---------|
| A: Extend state.json | Add analytics events to state.json arrays | Single file; existing read/write utilities | State.json has pruning conflicts (50-100 entry caps); analytics needs longer retention (10k entries); increases state.json write contention; breaks separation of concerns | Against (state.json is operational state, not analytics) | Eliminated |
| B: SQLite database | `.isdlc/analytics/analytics.db` | Structured queries; efficient aggregation; built-in retention | Adds native dependency (`better-sqlite3`); cross-platform compilation issues; constraint violation: zero new native dependencies | Against (native dependency) | Eliminated |
| C: JSONL file | `.isdlc/analytics/events.jsonl` (newline-delimited JSON) | Zero dependencies; human-readable; append-only (single `fs.appendFileSync`); easy rotation (rename file); grep-friendly for debugging | Less efficient for aggregation than SQLite; requires full scan for stats | Strong (follows append-only pattern of skill_usage_log; simpler than state-archive.json indexing) | **Selected** |

### Decision 3: Transmission Trigger

When does the client attempt to transmit batched events?

| Option | Summary | Pros | Cons | Pattern Alignment | Verdict |
|--------|---------|------|------|-------------------|---------|
| A: On workflow completion | Transmit after each workflow completes/cancels | Natural batch boundary; transmission occurs at a moment of low activity | Doesn't transmit if workflows are long-running; delayed visibility for framework author | Partially aligned | Eliminated |
| B: On `/isdlc stats` invocation | Transmit as side effect of stats command | User-initiated; predictable; no background processes | Framework author gets no data unless developers run stats; unreliable | Against | Eliminated |
| C: On session start + workflow completion | Transmit on SessionStart (hooks fire on every new session) and after workflow completion | Frequent opportunities; covers both active-workflow and between-workflow moments; non-blocking (fire-and-forget with retry) | Two trigger points to maintain | Aligned (SessionStart hook already fires reliably) | **Selected** |

### Decision 4: Collector Architecture

| Option | Summary | Pros | Cons | Pattern Alignment | Verdict |
|--------|---------|------|------|-------------------|---------|
| A: Vercel serverless function | Single `/api/telemetry` endpoint as Vercel serverless function; auto-deploys from repo | Free tier; zero ops; auto-scaling; HTTPS by default | Vendor lock-in (minor); cold start latency (acceptable for analytics); storage limited to external service | Aligned (start small) | **Selected** |
| B: Express.js on Render/Fly.io | Traditional Node.js service on free-tier PaaS | Full control; persistent process; can use SQLite for storage | More ops burden; free tiers have sleep/spin-down; needs health monitoring | Partially aligned | Reserve as fallback |
| C: GitHub Actions webhook receiver | GitHub Actions workflow triggered by repository_dispatch | Zero additional infrastructure; lives in repo | Not designed for high-frequency POST requests; rate limits; complex for query/retrieval; poor DX | Against | Eliminated |

### Decision 5: Collector Storage

| Option | Summary | Pros | Cons | Pattern Alignment | Verdict |
|--------|---------|------|------|-------------------|---------|
| A: Vercel KV / Upstash Redis | Key-value store with time-series support; free tier available | Managed; fast writes; built-in TTL for retention | Not ideal for analytical queries; limited free tier | Partially aligned | Eliminated |
| B: Vercel Postgres / Neon | Managed PostgreSQL with free tier | Full SQL for analytics queries; robust; scalable | Heavier than needed for MVP; schema management | Partially aligned | Reserve for growth |
| C: JSONL files on Vercel Blob / R2 | Append batches as JSONL files to object storage | Cheapest; simplest; mirrors local store format; easy to download for offline analysis | No query layer (must download and process); manual retention | Strong (start small, mirrors local pattern) | **Selected** |

### Decision 6: Anonymization Boundary

Where in the pipeline does PII stripping occur?

| Option | Summary | Pros | Cons | Pattern Alignment | Verdict |
|--------|---------|------|------|-------------------|---------|
| A: At emission time | Strip PII when event is first created | Minimum PII surface; local store already anonymous | Local stats lose detail (developer's own data is anonymized) | Against (user loses their own data fidelity) | Eliminated |
| B: At transmission time | Local store has full detail; anonymization runs during batch preparation | Developer retains full local data; anonymization is a clear, auditable transform step; preview command shows exact output | PII exists in local file (acceptable -- it's the developer's own machine) | Strong (separation of concerns; auditable) | **Selected** |

---

## 2. Selected Architecture (ADRs)

### ADR-001: Analytics Emitter in Dispatcher Chain

- **Status**: Accepted
- **Context**: Need to emit analytics events from hook execution without modifying all 29 individual hooks or breaking single-responsibility
- **Decision**: Add an `analytics-event-emitter` check function to each dispatcher (post-task, post-bash, post-write-edit). The emitter runs last in the dispatch chain, reads the accumulated ctx (including state changes from prior hooks), and emits appropriate events to the local store.
- **Rationale**: Follows the proven dispatcher consolidation pattern (REQ-0010). `log-skill-usage` is already wired this way in post-task-dispatcher. The emitter accesses the full context without modifying upstream hooks. Single analytics module with one responsibility.
- **Consequences**: Three dispatchers gain one additional hook call. Analytics logic is centralized in `analytics-event-emitter.cjs` + `lib/analytics.cjs`. Existing hooks remain untouched.

### ADR-002: JSONL Local Event Store

- **Status**: Accepted
- **Context**: Need a local store for analytics events that supports append-only writes, long retention (10k entries / 90 days), rotation, and efficient append without read-modify-write
- **Decision**: Store events in `.isdlc/analytics/events.jsonl` as newline-delimited JSON. One JSON object per line. Append via `fs.appendFileSync()`.
- **Rationale**: Zero dependencies. Human-readable. Single syscall per event (append). Rotation is a simple file rename. Grep-friendly for debugging. Avoids state.json contention and pruning conflicts. Avoids native dependency (SQLite).
- **Consequences**: Stats command must scan the full file for aggregation (acceptable at 10k entries). No indexed queries. File size managed by 1MB rotation cap for transmission buffer and retention pruning.

### ADR-003: Dual Trigger Transmission

- **Status**: Accepted
- **Context**: Need to transmit telemetry batches without a background daemon or scheduled task (iSDLC is a CLI tool, not a service)
- **Decision**: Attempt transmission at two trigger points: (1) SessionStart hook fires (new session or compaction), (2) workflow completion. Transmission is non-blocking (fire-and-forget with 10-min retry on failure). Only runs if telemetry is enabled.
- **Rationale**: SessionStart fires reliably on every new Claude Code session. Workflow completion is a natural batch boundary. Together they provide frequent transmission opportunities without a daemon. If one trigger is missed, the other catches up.
- **Consequences**: Transmission logic must be fast (< 50ms including HTTP POST initiation). Failed transmissions are retried on next trigger, not via timer. The `_lastTransmitAttempt` timestamp prevents rapid retries within the 10-min window.

### ADR-004: Vercel Serverless Collector with Blob Storage

- **Status**: Accepted
- **Context**: Need a collector endpoint that receives HTTP POST batches, is free to operate at low volume, auto-deploys from the repo, and requires near-zero ops
- **Decision**: Vercel serverless function at `/api/telemetry` receiving JSON batches. Storage via Vercel Blob (S3-compatible object storage) as JSONL files. Free tier covers MVP volume.
- **Rationale**: Start small -- Vercel free tier, zero ops, HTTPS by default, auto-deploy from repo. Blob storage mirrors the local JSONL format. Can migrate to Vercel Postgres or external service when query needs grow.
- **Consequences**: No real-time query layer initially. Framework author downloads JSONL blobs for analysis (or builds a simple dashboard later). Storage costs are negligible at MVP scale.

### ADR-005: Anonymization at Transmission Time

- **Status**: Accepted
- **Context**: Need to guarantee zero PII in transmitted telemetry while preserving full detail for local stats
- **Decision**: Local event store contains full-detail `LocalEvent` objects. At transmission time, an anonymization transform converts each to `TelemetryEvent` using an explicit allowlist. Fields not on the allowlist are stripped. The transform is a pure function: `LocalEvent -> TelemetryEvent`.
- **Rationale**: Developer retains full data locally for `/isdlc stats`. Anonymization is a single, auditable module (`anonymizer.cjs`). Allowlist-based means new fields are excluded by default (secure by default). `/isdlc telemetry preview` runs the same transform and displays output.
- **Consequences**: PII exists in `.isdlc/analytics/events.jsonl` on the developer's machine (acceptable -- it's their data on their machine). Adding a new event field requires explicitly adding it to the allowlist to include in telemetry.

### ADR-006: Separate SessionStart Hook for Compaction Detection

- **Status**: Accepted
- **Context**: `inject-session-cache.cjs` is self-contained (no common.cjs dependency, ADR-0027). Need to track session cache loads for compaction detection without breaking that contract.
- **Decision**: Create `analytics-session-tracker.cjs` as a separate SessionStart hook. It measures `session-cache.md` file size, increments load_sequence in a session-scoped file (`.isdlc/analytics/.session`), and emits `session.start` or `session.reload` events.
- **Rationale**: Preserves ADR-0027. Separation of concerns: injection vs measurement. The new hook can depend on `analytics.cjs` without constraint.
- **Consequences**: Two SessionStart hooks fire on each session/compaction event. Order: `inject-session-cache` first (user-visible), `analytics-session-tracker` second (observational).

---

## 3. Technology Decisions

| Technology | Version | Rationale | Alternatives Considered |
|------------|---------|-----------|------------------------|
| JSONL (newline-delimited JSON) | N/A | Zero dependencies; append-only; human-readable | SQLite (native dep), state.json (contention) |
| `fs.appendFileSync` | Node.js built-in | Single synchronous syscall; < 1ms per event; no buffering complexity | Async write queue (over-engineered for single-line appends) |
| Vercel Serverless | Free tier | Zero ops; auto-deploy; HTTPS | Render (sleep on free), Fly.io (more config), GitHub Actions (not designed for POST) |
| Vercel Blob | Free tier | S3-compatible; JSONL storage; cheap | Upstash Redis (not analytical), Neon Postgres (heavier than needed) |
| `node:crypto.randomUUID()` | Node.js 19+ | Anonymous instance ID generation; no external dependency | uuid package (unnecessary dependency) |
| HTTPS POST (fetch) | Node.js 18+ built-in | Transmission protocol; no dependency | axios (unnecessary), got (unnecessary) |

**New Dependencies**: Zero. All functionality uses Node.js built-ins.

---

## 4. Integration Architecture

### Integration Points

| ID | Source | Target | Interface | Data Format | Error Handling |
|----|--------|--------|-----------|-------------|----------------|
| IP-1 | Dispatchers (post-task, post-bash, post-write-edit) | analytics-event-emitter.cjs | check(ctx) function call | Dispatcher ctx object | Fail-open (analytics failure never blocks hook chain) |
| IP-2 | analytics-event-emitter.cjs | lib/analytics.cjs | emitEvent(event) | LocalEvent object | Fail-open (append failure logged to debug, not surfaced) |
| IP-3 | lib/analytics.cjs | .isdlc/analytics/events.jsonl | fs.appendFileSync | JSON string + newline | Fail-open (file write failure silently skipped) |
| IP-4 | analytics-session-tracker.cjs | lib/analytics.cjs | emitEvent(event) | LocalEvent (session.start/reload) | Fail-open |
| IP-5 | lib/transmitter.cjs | Collector endpoint | HTTPS POST | JSON array of TelemetryEvent | Retry after 10 min; buffer locally |
| IP-6 | Collector /api/telemetry | Vercel Blob storage | Blob API | JSONL file append | HTTP 500 → client retries |
| IP-7 | /isdlc stats command | lib/analytics/stats.js → events.jsonl | File read + parse | JSONL → object array | Graceful: "No analytics data yet" |
| IP-8 | /isdlc telemetry command | lib/analytics/telemetry.js → config.yaml | File read/write | YAML | Graceful error messages |
| IP-9 | workflow-completion-enforcer.cjs | lib/analytics/telemetry.js | consent check | Boolean (should prompt?) | Fail-open (skip prompt on error) |

### Data Flow

```
Hook Execution (gate-blocker, test-watcher, etc.)
  → Dispatcher accumulates ctx with state changes
    → analytics-event-emitter reads ctx, infers events
      → emitEvent() appends LocalEvent to events.jsonl
        → [on trigger] transmitter reads events.jsonl
          → anonymizer transforms LocalEvent → TelemetryEvent
            → HTTPS POST batch to collector
              → collector validates + stores to Blob

SessionStart
  → inject-session-cache.cjs (outputs cache to stdout)
  → analytics-session-tracker.cjs (measures cache size, emits session event)
    → [on trigger] transmitter attempts batch send

/isdlc stats
  → reads events.jsonl
    → aggregates by event_type, workflow_type, time range
      → displays summary with trends

/isdlc telemetry preview
  → reads events.jsonl
    → runs anonymizer transform
      → displays TelemetryEvent output
```

### Synchronization Model

- **Event emission**: Synchronous (`fs.appendFileSync`) -- blocks for < 1ms per event, acceptable within 200ms hook budget
- **Transmission**: Asynchronous fire-and-forget (`fetch` without await in hook context). Result checked on next trigger.
- **Retention pruning**: Synchronous, runs on store open (first event of session). Reads file, truncates if over limits, writes back.
- **No concurrency concerns**: Claude Code runs hooks sequentially within a session. No parallel hook execution. No shared-state race conditions.

---

## 5. Summary

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Event emission pattern | Dispatcher chain (Option C) | Follows proven `log-skill-usage` pattern; hooks unchanged |
| Local store format | JSONL (Option C) | Zero dependencies; append-only; human-readable |
| Transmission trigger | Session start + workflow completion | Covers all scenarios without a daemon |
| Collector architecture | Vercel serverless + Blob (Option A/C) | Start small; zero ops; free tier |
| Anonymization boundary | At transmission time (Option B) | Preserves local detail; auditable transform |
| Compaction detection | Separate SessionStart hook | Preserves ADR-0027; clean separation |

### Trade-offs Accepted

- JSONL scans are O(n) for stats aggregation -- acceptable at 10k entry cap, revisit if retention grows
- Vercel Blob has no query layer -- framework author processes JSONL offline initially, add dashboard later
- Two SessionStart hooks fire per session -- marginal overhead (< 5ms combined)
- Fire-and-forget transmission means result is not known until next trigger -- acceptable for analytics (not mission-critical data)
