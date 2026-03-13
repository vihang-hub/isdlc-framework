# Impact Analysis: REQ-0062 Developer Usage Analytics

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-03-12
**Coverage**: 100%

---

## 1. Blast Radius

### Tier 1: Direct Changes

| File | Module | Change Type | FR Traces |
|------|--------|-------------|-----------|
| `src/claude/hooks/lib/analytics.cjs` | Analytics | New | FR-001, FR-003 |
| `src/claude/hooks/lib/anonymizer.cjs` | Analytics | New | FR-009 |
| `src/claude/hooks/lib/transmitter.cjs` | Analytics | New | FR-004 |
| `src/claude/hooks/analytics-session-tracker.cjs` | Hooks | New | FR-002 |
| `src/claude/hooks/analytics-event-emitter.cjs` | Hooks | New | FR-001 |
| `lib/analytics/stats.js` | CLI | New | FR-007 |
| `lib/analytics/telemetry.js` | CLI | New | FR-006, FR-008 |
| `lib/analytics/retention.js` | CLI | New | FR-010 |
| `collector/index.js` | Collector | New | FR-005 |
| `collector/validator.js` | Collector | New | FR-005 |
| `collector/storage.js` | Collector | New | FR-005 |
| `src/claude/commands/isdlc.md` | Commands | Modify | FR-007, FR-008 |
| `src/claude/hooks/lib/common.cjs` | Hooks/Lib | Modify | FR-001 (emitAnalyticsEvent utility) |
| `src/claude/hooks/workflow-completion-enforcer.cjs` | Hooks | Modify | FR-001 (workflow.complete/cancel events), FR-006 (consent prompt trigger) |
| `src/claude/hooks/dispatchers/post-task-dispatcher.cjs` | Dispatchers | Modify | FR-001 (add analytics emitter to dispatch chain) |
| `src/claude/hooks/dispatchers/post-write-edit-dispatcher.cjs` | Dispatchers | Modify | FR-001 (add analytics emitter to dispatch chain) |
| `src/claude/hooks/dispatchers/post-bash-dispatcher.cjs` | Dispatchers | Modify | FR-001 (add analytics emitter to dispatch chain) |

### Tier 2: Transitive Impact

| File | Module | Impact | Change Needed |
|------|--------|--------|---------------|
| `src/claude/hooks/gate-blocker.cjs` | Hooks | Provides gate pass/fail data consumed by analytics emitter | Read-only (analytics emitter reads gate result from dispatcher ctx) |
| `src/claude/hooks/test-watcher.cjs` | Hooks | Provides circuit breaker data consumed by analytics emitter | Read-only (analytics emitter reads escalation_reason from state) |
| `src/claude/hooks/inject-session-cache.cjs` | Hooks | Session cache size measured by new sibling hook | No change (ADR-0027 preserved); new hook reads same file |
| `src/claude/hooks/lib/performance-budget.cjs` | Hooks/Lib | New hooks must comply with performance budgets | Config update: add analytics hooks to budget registry |
| `lib/installer.js` | CLI | May need to create `.isdlc/analytics/` directory on init | Minor modification |
| `.isdlc/roundtable.yaml` | Config | Config pattern referenced for `.isdlc/config.yaml` telemetry settings | Schema extension |

### Tier 3: Side Effects

| Area | Potential Impact | Risk Level |
|------|-----------------|------------|
| Hook dispatcher performance | Adding analytics hook to dispatch chain increases per-dispatch time | Medium |
| `.isdlc/` directory size | Analytics event log grows over time; 1MB rotation mitigates | Low |
| State.json write frequency | Analytics events go to separate file, not state.json; no additional state writes | Low |
| CI/CD pipelines | Collector service needs deployment pipeline | Low (separate service) |
| Existing test suites | No change to existing test behavior; new tests additive | Low |

---

## 2. Entry Points

| Entry Point | Rationale |
|-------------|-----------|
| `src/claude/hooks/lib/analytics.cjs` | Foundation module: event schema, append-to-store, retention. Everything depends on this. |
| `src/claude/hooks/analytics-event-emitter.cjs` | Wire into dispatchers to emit events. Validates the event pipeline end-to-end. |
| `lib/analytics/stats.js` | User-visible value: `/isdlc stats` output. Validates the local read path. |
| `collector/index.js` | Independent service: can be built in parallel with client-side work. |

---

## 3. Implementation Order

| Order | FRs | Description | Risk | Parallel | Depends On |
|-------|-----|-------------|------|----------|------------|
| 1 | FR-003 | Local event store (events.jsonl, append, rotate) | Low | -- | None |
| 2 | FR-001 | Event collection pipeline (schema, emitter utility) | Medium | -- | FR-003 |
| 3 | FR-009 | Anonymization transform (allowlist module) | Low | Yes (with 4) | FR-001 |
| 4 | FR-002 | Compaction detection (SessionStart hook) | Low | Yes (with 3) | FR-001 |
| 5 | FR-007 | Stats command (local read, aggregation, display) | Medium | Yes (with 6) | FR-001, FR-003 |
| 6 | FR-006 | Consent and opt-in (prompt, config persistence) | Low | Yes (with 5) | None |
| 7 | FR-010 | Configurable retention (pruning logic) | Low | -- | FR-003 |
| 8 | FR-008 | Telemetry preview command | Low | Yes (with 9) | FR-009 |
| 9 | FR-004 | Telemetry transmission (batch, retry, flush) | Medium | Yes (with 8) | FR-003, FR-009, FR-006 |
| 10 | FR-005 | Collector endpoint (microservice) | Medium | Yes (with 8,9) | FR-009 |

---

## 4. Risk Zones

| ID | Risk | Area | Likelihood | Impact | Mitigation |
|----|------|------|-----------|--------|------------|
| R1 | Hook performance degradation | Dispatchers | Medium | High | Analytics emission is a single `fs.appendFileSync` to events.jsonl (< 1ms). Benchmark before/after. Performance budget hook enforces limits. |
| R2 | PII leakage in telemetry | Anonymizer | Low | Critical | Allowlist-based: new fields excluded by default. Automated test suite scans TelemetryEvent output for PII patterns. Preview command for manual audit. |
| R3 | Event store growth | Local storage | Low | Medium | 1MB rotation cap. Configurable retention (10k entries / 90 days). Pruning runs on store open. |
| R4 | Collector availability | Transmission | Medium | Low | Store-and-forward: events queue locally. 10-min retry. Local stats fully independent of collector. |
| R5 | inject-session-cache ADR violation | Hooks | Medium | Medium | New separate SessionStart hook (`analytics-session-tracker.cjs`). Existing hook untouched. |
| R6 | Consent prompt disrupts workflow flow | UX | Low | Medium | Prompt fires after workflow completion (not during). One-time only. Non-blocking (no default). |
| R7 | Dispatcher coupling | Architecture | Medium | Medium | Analytics emitter follows same pattern as `log-skill-usage` -- already proven in dispatchers. |

**Overall Risk**: Medium
**Key Concerns**: Hook performance (R1) and PII guarantee (R2) are the highest-priority risks.
**Go/No-Go**: Go -- risks are well-mitigated, patterns are proven in codebase.

---

## 5. Summary

| Metric | Count |
|--------|-------|
| Direct modifications | 7 files |
| New files | 10-12 files |
| New test files | 10-15 files |
| Transitive impact | 6 files |
| Collector service files | 3-5 files |
| **Total affected** | **36-45 files** |

**Decision Log**:
- Analytics events go to a separate file (`.isdlc/analytics/events.jsonl`), not state.json -- avoids state write contention and pruning conflicts
- New SessionStart hook for compaction detection rather than modifying inject-session-cache -- preserves ADR-0027
- Analytics emitter added to existing dispatcher chain rather than standalone hooks -- follows proven consolidation pattern (REQ-0010)
- Collector is a separate service directory in the same repo -- deployable independently

**Implementation Recommendations**:
1. Start with FR-003 (local store) + FR-001 (event pipeline) -- validates the core before anything else
2. FR-005 (collector) can be built in parallel by a separate contributor
3. FR-007 (stats command) provides immediate user value once events flow
