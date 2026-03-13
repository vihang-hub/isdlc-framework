# Requirements Specification: REQ-0062 Developer Usage Analytics

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-03-12
**Coverage**: 100%
**Source**: GH-121

---

## 1. Business Context

### Problem Statement

iSDLC is a product used by external developers, but there is no visibility into how the framework is being used. The framework author cannot answer basic questions: Which workflows are most popular? Where do developers struggle? How much context window pressure does the session cache create? What's the completion rate? Without product analytics, framework improvements are driven by intuition rather than data.

### Success Metrics

- Framework author can view aggregate usage patterns across all opted-in iSDLC installations
- Individual developers can view their own usage patterns via `/isdlc stats`
- Analytics collection adds < 5ms overhead per hook execution
- Zero PII leakage in transmitted telemetry (auditable via `/isdlc telemetry preview`)

### Driving Factors

- iSDLC is transitioning from internal dogfooding tool to external product
- Need data-driven framework improvement decisions
- Need to understand adoption patterns, friction points, and feature utilization at scale
- Reference model: Claude Code uses OpenTelemetry for similar product telemetry

## 2. Stakeholders and Personas

### P1: Framework Author (Primary)

- **Role**: Maintainer of iSDLC framework
- **Goals**: Understand adoption patterns, identify friction points, prioritize improvements based on real usage data
- **Pain Points**: Currently blind to how external users interact with the framework; relies on GitHub issues for feedback
- **Tasks**: Review aggregate telemetry dashboards, identify trending friction patterns, correlate feature utilization with satisfaction

### P2: Developer User (Primary)

- **Role**: Developer using iSDLC in their projects
- **Goals**: Understand their own development patterns, identify personal friction points, track improvement over time
- **Pain Points**: No visibility into workflow efficiency, gate failure rates, or time spent per workflow type
- **Tasks**: Run `/isdlc stats` to review personal metrics, decide whether to opt into telemetry, preview what data would be sent

### P3: Team Lead (Secondary)

- **Role**: Engineering lead overseeing a team using iSDLC
- **Goals**: Understand team-wide adoption and efficiency patterns
- **Pain Points**: Cannot aggregate individual developer metrics into team-level insights
- **Tasks**: Review aggregated stats across team members (future scope -- requires team-level telemetry, out of scope for this feature)

## 3. User Journeys

### UJ-1: First Encounter with Telemetry

- **Entry**: Developer completes their first workflow successfully
- **Flow**: Consent prompt appears asking to share anonymous usage data -> Developer can preview what would be sent -> Developer accepts or declines -> Decision persists in config
- **Exit**: Telemetry state is set (`enabled` or `disabled`), local collection active regardless

### UJ-2: Reviewing Personal Stats

- **Entry**: Developer runs `/isdlc stats`
- **Flow**: Stats command reads local event store -> Aggregates by workflow type, verb, completion rate, timing, tier distribution -> Displays summary with trend indicators (if 7+ days of data)
- **Exit**: Developer sees actionable summary of their framework usage

### UJ-3: Framework Author Reviewing Aggregate Telemetry

- **Entry**: Framework author queries the collector endpoint or dashboard
- **Flow**: Collector has received anonymized batches from opted-in installations -> Author queries by framework version, event type, time range -> Identifies patterns (e.g., 40% of gate failures are framework-driven)
- **Exit**: Author has data to inform roadmap priorities

### UJ-4: Developer Toggling Telemetry

- **Entry**: Developer runs `/isdlc telemetry off` or `/isdlc telemetry on`
- **Flow**: Config updated immediately -> If toggling off: pending events are not transmitted (stay local) -> If toggling on: next batch cycle transmits pending events
- **Exit**: Telemetry state updated, takes effect immediately

---

## 4. Technical Context

### Existing Infrastructure

- **workflow_history**: Already captures workflow type, timing, completion/cancellation, phase snapshots, and gate metrics (`gates_passed_first_try`, `gates_required_iteration`)
- **skill_usage_log**: Append-only array tracking agent/skill invocations, capped at 50 entries
- **pending_escalations**: Captures gate failures and hook blocks with type, hook, phase, detail
- **state-archive.json**: Multi-key indexed archive of completed workflow records via `appendToArchive()`
- **inject-session-cache.cjs**: SessionStart hook that fires on every session/compaction, reads `.isdlc/session-cache.md`
- **test-watcher.cjs**: Tracks circuit breaker triggers with `identical_failure_count` and `escalation_reason`
- **Pruning functions**: `pruneSkillUsageLog()` (50), `pruneWorkflowHistory()` (50), `pruneHistory()` (100), `pruneCompletedPhases()`

### Constraints

- Hook performance budget: < 200ms per hook execution; analytics emission must be non-blocking or < 5ms
- `.isdlc/` directory is gitignored; analytics files live here
- Existing hooks have performance budgets enforced by `performance-budget.cjs`
- `inject-session-cache.cjs` is self-contained (no `common.cjs` dependency per ADR-0027)
- Cross-platform: macOS, Linux, Windows (Node.js only, no native modules)

### Integration Points

- All 29 hook files are potential event emitters
- `inject-session-cache.cjs` for compaction detection (read-only contract needs new sibling hook)
- `workflow-completion-enforcer.cjs` for workflow lifecycle events
- `isdlc.md` command handler for new `/isdlc stats` and `/isdlc telemetry` commands
- `config.yaml` for consent state and retention configuration

---

## 5. Quality Attributes and Risks

### Quality Attributes

| Attribute | Priority | Threshold |
|-----------|----------|-----------|
| Privacy | Critical | Zero PII in transmitted telemetry; auditable via preview command |
| Performance | Critical | < 5ms added latency per hook execution for event emission |
| Reliability | High | Local event collection never fails silently; store-and-forward guarantees no data loss under normal operation |
| Usability | High | `/isdlc stats` output is immediately actionable; consent prompt is non-intrusive |
| Maintainability | Medium | Adding a new event type requires changes in 1-2 files only |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Hook performance degradation from analytics writes | Medium | High | Async/buffered writes; benchmark before/after; performance budget enforcement |
| PII leakage in telemetry | Low | Critical | Allowlist-based anonymization (exclude by default); automated tests for PII detection; preview command for manual audit |
| Collector endpoint availability | Medium | Low | Store-and-forward with 10-min retry; local stats unaffected by collector downtime |
| Local event store grows unbounded | Low | Medium | Configurable retention (entries + days); 1MB rotation cap for transmission buffer |
| Breaking `inject-session-cache.cjs` ADR-0027 contract | Medium | Medium | Separate SessionStart hook for analytics; don't modify existing hook |

---

## 6. Functional Requirements

### FR-001: Event Collection Pipeline

**Confidence**: High

iSDLC hooks emit structured analytics events for framework interactions covering workflow lifecycle, phase lifecycle, gate results, verb invocations, tier selection, and interruptions.

- **AC-001-01**: Given a developer starts a workflow, when the workflow initializes, then a `workflow.start` event is emitted with `workflow_type`, `verb`, `framework_version`, and `timestamp`
- **AC-001-02**: Given a workflow completes or is cancelled, when the final state is recorded, then a `workflow.complete` or `workflow.cancel` event is emitted with `duration_minutes`, `phases_completed`, and `exit_reason`
- **AC-001-03**: Given a phase completes, when the phase state is finalized, then a `phase.complete` event is emitted with `phase_key`, `iterations_used`, `first_pass` (boolean), and `duration_minutes`
- **AC-001-04**: Given a gate check runs, when the result is determined, then a `gate.pass` or `gate.fail` event is emitted with `gate_type`, `phase_key`, and `failure_detail` (for fails only)
- **AC-001-05**: Given an analysis tier is selected, when the sizing decision is made, then a `tier.select` event is emitted with `tier` (trivial/light/standard/epic) and `source` (auto/user-override)
- **AC-001-06**: Given a workflow is suspended or resumed via `--interrupt`, when the state transition occurs, then an `interrupt.suspend` or `interrupt.resume` event is emitted with `workflow_type` and `phase_at_interrupt`

**Dependencies**: FR-003 (Local Event Store)

### FR-002: Compaction Detection

**Confidence**: Medium

Detect conversation compaction by monitoring session cache reload frequency against session duration.

- **AC-002-01**: Given a session is active, when the SessionStart hook fires for the first time, then a `session.start` event is emitted with `session_cache_size_bytes` and `load_sequence: 1`
- **AC-002-02**: Given a session is already active (duration > 0), when the SessionStart hook fires again, then a `session.reload` event is emitted with `load_sequence` incremented and `session_duration_at_reload`
- **AC-002-03**: Given session reload events exist, when `/isdlc stats` calculates compaction frequency, then reloads where `load_sequence > 1` AND `session_duration_at_reload > 0` are counted as compactions

**Dependencies**: FR-001 (Event Collection), FR-003 (Local Event Store)

### FR-003: Local Event Store

**Confidence**: High

Append-only local event log with store-and-forward semantics and rotation.

- **AC-003-01**: Given any analytics event is emitted, when the event pipeline processes it, then the event is appended to `.isdlc/analytics/events.jsonl` (newline-delimited JSON)
- **AC-003-02**: Given the local store exceeds 1MB, when a new event is written, then the current store is rotated (renamed with timestamp suffix) and a new store is started
- **AC-003-03**: Given a rotated store exists and transmission is successful, when the flush cycle runs, then the rotated store is deleted
- **AC-003-04**: Given the local store is available, when the collector endpoint is unreachable, then events continue to accumulate locally with no data loss

**Dependencies**: None (foundational)

### FR-004: Telemetry Transmission

**Confidence**: High

Batch transmission of anonymized events to a remote collector with retry semantics.

- **AC-004-01**: Given telemetry is enabled and events exist in the local store, when the transmission cycle triggers, then events are sent in a single batch (not individually)
- **AC-004-02**: Given the collector is unreachable, when a transmission attempt fails, then the system retries after 10 minutes
- **AC-004-03**: Given a batch is transmitted successfully, when the collector acknowledges receipt, then the transmitted events are flushed from the local store
- **AC-004-04**: Given events are queued for transmission, when the anonymization transform runs, then all events are converted from `LocalEvent` schema to `TelemetryEvent` schema with PII stripped

**Dependencies**: FR-003 (Local Event Store), FR-009 (Anonymization Transform), FR-006 (Consent)

### FR-005: Collector Endpoint

**Confidence**: Medium

A standalone microservice that receives, validates, and stores anonymized telemetry batches. Lives in this repo, initially deployed to a free-tier PaaS (e.g., Vercel serverless function). Future migration to cloud function.

- **AC-005-01**: Given the collector is running, when it receives a valid telemetry batch via HTTP POST, then it acknowledges receipt with HTTP 200 and persists the events
- **AC-005-02**: Given the collector receives a malformed or oversized batch, when validation fails, then it responds with HTTP 400 and a structured error message
- **AC-005-03**: Given the collector stores events, when a query is made, then events are retrievable by `framework_version`, `event_type`, and time range

**Dependencies**: FR-009 (Anonymization -- validates incoming schema)

### FR-006: Consent and Opt-In

**Confidence**: High

One-time consent prompt with persistent toggle for telemetry transmission.

- **AC-006-01**: Given a developer has never been prompted (telemetry state is `unset` in `.isdlc/config.yaml`), when their first workflow completes successfully, then a consent prompt is displayed: "Help improve iSDLC by sharing anonymous usage data? You can preview what's sent with `/isdlc telemetry preview`. [y/n]"
- **AC-006-02**: Given the developer responds `y`, when the consent is recorded, then `telemetry: enabled` is written to `.isdlc/config.yaml` and transmission begins on next batch cycle
- **AC-006-03**: Given the developer responds `n`, when the consent is recorded, then `telemetry: disabled` is written and no transmission occurs; local collection continues
- **AC-006-04**: Given telemetry is in any state, when the developer runs `/isdlc telemetry on` or `/isdlc telemetry off`, then the state is updated and the change takes effect immediately

**Dependencies**: None

### FR-007: Stats Command

**Confidence**: High

`/isdlc stats` reports local usage analytics with trend detection and friction attribution.

- **AC-007-01**: Given events exist in the local store, when `/isdlc stats` is invoked, then a summary displays: workflow counts by type, completion rate, average duration by workflow type, most-used verbs, tier selection distribution
- **AC-007-02**: Given sufficient history exists (7+ days), when `/isdlc stats` is invoked, then trend indicators are shown (improving/stable/declining) for key metrics
- **AC-007-03**: Given gate failure events exist, when `/isdlc stats` shows friction breakdown, then failures are categorized as developer-driven, framework-driven, or ambiguous with counts per category
- **AC-007-04**: Given session reload events exist, when `/isdlc stats` is invoked, then average compaction frequency per session and session cache size trend are displayed

**Dependencies**: FR-001 (Event Collection), FR-003 (Local Event Store)

### FR-008: Telemetry Preview

**Confidence**: High

`/isdlc telemetry preview` shows exactly what would be transmitted, enabling developer audit before or after opting in.

- **AC-008-01**: Given events exist in the local store, when `/isdlc telemetry preview` is invoked, then the anonymized `TelemetryEvent` versions of pending events are displayed
- **AC-008-02**: Given the preview is displayed, when the developer inspects it, then no field contains PII (no slugs, file paths, project names, branch names, or user identifiers)

**Dependencies**: FR-009 (Anonymization Transform), FR-003 (Local Event Store)

### FR-009: Anonymization Transform

**Confidence**: High

Deterministic, auditable transform from local events to telemetry events with strict PII exclusion.

- **AC-009-01**: Given a `LocalEvent` with full detail, when the anonymization transform runs, then the output `TelemetryEvent` contains only: `timestamp`, `event_type`, `framework_version`, `anonymous_instance_id`, and event-specific non-PII fields
- **AC-009-02**: Given the `anonymous_instance_id` is generated, when first telemetry consent is given, then a random UUID is created and persisted in `.isdlc/config.yaml` (never derived from machine or user identity)
- **AC-009-03**: Given the anonymization module is updated, when a new field is added to `LocalEvent`, then the default behavior is to **exclude** the field from `TelemetryEvent` unless explicitly allowlisted
- **AC-009-04**: Given a `LocalEvent` contains a `slug`, `file_path`, `branch_name`, or `project_name` field, when the transform runs, then that field is stripped from the output (not hashed, not truncated -- removed entirely)

**Dependencies**: None

### FR-010: Configurable Retention

**Confidence**: High

Local event store retention controlled by entry count and age, whichever triggers first.

- **AC-010-01**: Given retention is configured with `max_entries` and `max_days`, when the retention check runs, then events exceeding either limit (whichever triggers first) are pruned from oldest first
- **AC-010-02**: Given no explicit configuration, when the retention check runs, then defaults apply: 10,000 entries and 90 days
- **AC-010-03**: Given retention settings exist in `.isdlc/config.yaml`, when the developer changes them, then the new limits apply on the next retention cycle

**Dependencies**: FR-003 (Local Event Store)

---

## 7. Out of Scope

| Item | Reason | Dependency |
|------|--------|------------|
| Team-level aggregation | Requires multi-user identity; future feature | FR-005 collector would need team grouping |
| Real-time dashboard | Collector MVP is storage + query; visualization later | FR-005 |
| A/B testing framework | Requires experiment infrastructure beyond analytics | None |
| Custom event definitions | Users defining their own events; future extensibility | FR-001 event schema would need extension points |
| Backfilling historical data | Existing `workflow_history` data predates the event schema | Could be a follow-up migration script |
| GDPR data export/deletion for remote data | Anonymized data has no PII link; may need legal review | FR-009 anonymization design |

---

## 8. MoSCoW Prioritization

| FR | Title | Priority | Rationale |
|----|-------|----------|-----------|
| FR-001 | Event Collection Pipeline | Must Have | Core capability -- without events, nothing else works |
| FR-003 | Local Event Store | Must Have | Foundation for all storage and reporting |
| FR-006 | Consent and Opt-In | Must Have | Cannot transmit without consent; regulatory and trust requirement |
| FR-009 | Anonymization Transform | Must Have | Cannot transmit without PII guarantees |
| FR-007 | Stats Command | Must Have | Primary user-facing value for developers |
| FR-004 | Telemetry Transmission | Must Have | Core capability for framework author analytics |
| FR-010 | Configurable Retention | Should Have | Prevents unbounded growth; has sensible defaults |
| FR-002 | Compaction Detection | Should Have | Valuable metric but not blocking for MVP |
| FR-008 | Telemetry Preview | Should Have | Trust mechanism; important but not blocking |
| FR-005 | Collector Endpoint | Must Have | Required for telemetry to have a destination |
