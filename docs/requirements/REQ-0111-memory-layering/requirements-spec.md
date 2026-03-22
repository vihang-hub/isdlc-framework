# Requirements Specification: Memory Layering — User/Project/Session

**Item**: REQ-0111 | **GitHub**: #175 | **CODEX**: CODEX-042 | **Phase**: 7
**Status**: Analyzed

---

## 1. Business Context

The memory subsystem operates across three layers (user, project, session) with merge rules, search strategies, and an enrichment pipeline. The runtime implementation exists in `lib/memory.js` (693 lines), `lib/memory-search.js` (482 lines), and `lib/memory-embedder.js` (713 lines) with a CJS bridge at `src/core/bridge/memory.cjs`. This item extracts the schema and configuration metadata into a frozen data module — it does NOT modify the runtime code.

## 2. Functional Requirements

### FR-001: Memory Layer Schema
- **AC-001-01**: A frozen definition of 3 layers: `user` (paths: `profile.json`, `sessions/`), `project` (path: `roundtable-memory.json`), `session` (in-memory record, no persistence path).
- **AC-001-02**: Each layer declares its format (JSON file, directory of JSON files, in-memory object) and fail-open behavior.

### FR-002: Merge Rules
- **AC-002-01**: User preference overrides project history when merging.
- **AC-002-02**: Conflict threshold is configurable (default: weight >= 0.5).
- **AC-002-03**: Merge rules are frozen — runtime cannot mutate them.

### FR-003: Search Strategy Config
- **AC-003-01**: Preferred strategy is `hybrid` (vector-based search).
- **AC-003-02**: Fallback strategy is `legacy` (merge-based search).
- **AC-003-03**: Fail-open on missing vector indexes (degrade to legacy).

### FR-004: Enrichment Pipeline
- **AC-004-01**: 4 ordered steps: `writeSessionRecord` → `embedSession` → `vectorStore` → `searchIndex`.
- **AC-004-02**: Each step declares its ID, order, and whether it is async.

### FR-005: Registry Functions
- **AC-005-01**: `getMemoryLayerSchema()` returns the 3-layer schema.
- **AC-005-02**: `getMergeRules()` returns the merge rules config.
- **AC-005-03**: `getSearchStrategyConfig()` returns the search strategy.
- **AC-005-04**: `getEnrichmentPipeline()` returns the ordered pipeline steps.

## 3. Out of Scope

- Modifying `lib/memory.js`, `lib/memory-search.js`, or `lib/memory-embedder.js`
- Runtime memory operations
- Vector index management

## 4. MoSCoW

FR-001, FR-002, FR-003, FR-004, FR-005: **Must Have**.
