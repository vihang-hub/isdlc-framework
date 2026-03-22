# Requirements Specification: Analyze Finalization Path

**Item**: REQ-0112 | **GitHub**: #176 | **CODEX**: CODEX-043 | **Phase**: 7
**Status**: Analyzed

---

## 1. Business Context

The analyze finalization path is a 6-step chain currently implemented as procedural logic in `src/antigravity/analyze-finalize.cjs` (229 lines). This item models the chain as a frozen data structure so that downstream tools can introspect step ordering, provider dependencies, and fail-open behavior without parsing the runtime script.

## 2. Functional Requirements

### FR-001: Finalization Chain
- **AC-001-01**: A frozen 6-step trigger chain is defined: `meta_status_update` → `backlog_marker_update` → `github_sync` → `sizing_computation` → `memory_writeback` → `async_enrichment`.
- **AC-001-02**: Steps execute in declared order; each step's `depends_on` field lists prerequisite step IDs.

### FR-002: Step Schema
- **AC-002-01**: Each step has: `id` (string), `action` (string description), `depends_on` (string[]), `provider_specific` (boolean), `fail_open` (boolean).
- **AC-002-02**: Steps 1-3 (`meta_status_update`, `backlog_marker_update`, `github_sync`) are synchronous.
- **AC-002-03**: Steps 4-6 (`sizing_computation`, `memory_writeback`, `async_enrichment`) are asynchronous.

### FR-003: Provider Classification
- **AC-003-01**: `meta_status_update`, `backlog_marker_update`, `sizing_computation` are provider-neutral (`provider_specific: false`).
- **AC-003-02**: `github_sync` is provider-specific (`provider_specific: true`) — conditional on GitHub being the configured issue tracker.
- **AC-003-03**: `memory_writeback`, `async_enrichment` are provider-neutral but async.

### FR-004: Registry Functions
- **AC-004-01**: `getFinalizationChain()` returns the full frozen 6-step chain.
- **AC-004-02**: `getProviderNeutralSteps()` returns only steps where `provider_specific === false`.
- **AC-004-03**: `getAsyncSteps()` returns only async steps (4-6).

## 3. Out of Scope

- Modifying `src/antigravity/analyze-finalize.cjs`
- Runtime execution of the finalization chain
- Provider-specific adapter logic

## 4. MoSCoW

FR-001, FR-002, FR-003, FR-004: **Must Have**.
