# Architecture Summary: REQ-0062 Developer Usage Analytics

**Accepted**: 2026-03-12

## Key Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| ADR-001 | Event emission pattern | Dispatcher chain | Follows proven `log-skill-usage` pattern; existing hooks unchanged |
| ADR-002 | Local store format | JSONL file | Zero dependencies; append-only; human-readable |
| ADR-003 | Transmission trigger | SessionStart + workflow completion | Frequent opportunities without daemon |
| ADR-004 | Collector architecture | Vercel serverless + Blob | Free tier; zero ops; auto-deploy |
| ADR-005 | Anonymization boundary | At transmission time | Local stats retain full detail; auditable |
| ADR-006 | Compaction detection | Separate SessionStart hook | Preserves ADR-0027; clean separation |

## Technology

Zero new client-side dependencies. Uses Node.js built-ins: `fs.appendFileSync`, `crypto.randomUUID()`, `fetch`. Collector uses `@vercel/blob` (single dependency).

## Blast Radius

7 modified files, 10-12 new files, 10-15 test files. ~40 total affected. Top risks: hook performance (mitigated by <1ms append) and PII leakage (mitigated by allowlist + automated tests).
