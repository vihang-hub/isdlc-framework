# Requirements Specification: Artifact Readiness and Write Strategy

**Item**: REQ-0110 | **GitHub**: #174 | **CODEX**: CODEX-041 | **Phase**: 7
**Status**: Analyzed

---

## 1. Business Context

The roundtable analyst decides when artifacts are ready to write based on which topics have been covered. These readiness rules, topic ordering dependencies, and write strategy preferences are currently implicit. Extract them into a frozen data module for testability and configurability.

## 2. Functional Requirements

### FR-001: Readiness Rules
- **AC-001-01**: A frozen map defines each artifact and its required topics (e.g., `requirements-spec.md` requires `problem-discovery` + `requirements-definition`).
- **AC-001-02**: An artifact is "ready" when all its required topics have been covered.
- **AC-001-03**: At minimum, rules cover: `requirements-spec.md`, `architecture-overview.md`, `module-design.md`, `meta.json`.

### FR-002: Topic Dependencies
- **AC-002-01**: A frozen DAG defines topic ordering: `problem-discovery` before `requirements-definition` before `architecture` before `specification`.
- **AC-002-02**: Each edge in the DAG is a `[predecessor, successor]` pair.
- **AC-002-03**: The DAG is acyclic (enforced by review, not runtime validation).

### FR-003: Write Strategy Config
- **AC-003-01**: `progressive_meta_only: true` — only meta.json is written progressively during conversation.
- **AC-003-02**: `final_batch_write: true` — all artifact files are written in one batch after final acceptance.
- **AC-003-03**: `pre_write_consistency_check: true` — a consistency check runs before the batch write.

### FR-004: Registry Functions
- **AC-004-01**: `getArtifactReadiness(artifact)` returns the required topics for a given artifact, or `null` if unknown.
- **AC-004-02**: `getTopicDependencies()` returns the full DAG edge list.
- **AC-004-03**: `getWriteStrategyConfig()` returns the write strategy configuration object.

## 3. Out of Scope

- Actual write logic (stays in `roundtable-analyst.md`)
- Runtime readiness evaluation
- Topic completion tracking

## 4. MoSCoW

FR-001, FR-002, FR-003, FR-004: **Must Have**.
