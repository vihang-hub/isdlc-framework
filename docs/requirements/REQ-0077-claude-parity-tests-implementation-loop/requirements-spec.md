# Requirements Specification: Claude Parity Tests for Implementation Loop

**Item**: REQ-0077 | **GitHub**: #141 | **Depends on**: REQ-0076
**Workstream**: F (Verification) | **Phase**: 1
**Status**: Analyzed

---

## 1. Business Context

After extracting the implementation loop core slice (REQ-0076), we must prove that the refactored Claude path produces identical behavior. This is the first parity verification — it establishes the pattern for all subsequent extraction work.

**Success metric**: Parity tests pass. Refactored core + Claude agents == current Claude implementation for the loop.

## 2. Functional Requirements

### FR-001: Loop State Parity
**Confidence**: High

- **AC-001-01**: Given the same input files and task plan, then the core ImplementationLoop produces the same file ordering as the current inline logic.
- **AC-001-02**: Given the same reviewer verdict sequence, then processVerdict() produces the same cycle progression.
- **AC-001-03**: Given max cycles exceeded, then the same failure behavior occurs.

### FR-002: Contract Parity
**Confidence**: High

- **AC-002-01**: Given a file in the loop, then buildWriterContext() produces a WRITER_CONTEXT identical to the current quality-loop-engineer output.
- **AC-002-02**: Given a file and cycle, then buildReviewContext() produces identical REVIEW_CONTEXT.
- **AC-002-03**: Given findings, then buildUpdateContext() produces identical UPDATE_CONTEXT.

### FR-003: State Persistence Parity
**Confidence**: High

- **AC-003-01**: Given loop execution, then state.json loop progress fields match the current implementation at each checkpoint.

### FR-004: Fixture-Based Testing
**Confidence**: High

- **AC-004-01**: Given parity tests, then they use fixture state (not live LLM) for deterministic comparison.
- **AC-004-02**: Given a fixture, then it captures: initial state, file list, verdict sequence, expected final state.

## 3. Out of Scope

| Item | Reason |
|------|--------|
| Testing LLM output quality | Parity is about loop mechanics, not content |
| End-to-end workflow parity | That's Phase 9 (REQ-0118) |

## 4. MoSCoW Prioritization

| FR | Title | Priority |
|----|-------|----------|
| FR-001 | Loop state parity | Must Have |
| FR-002 | Contract parity | Must Have |
| FR-003 | State persistence parity | Must Have |
| FR-004 | Fixture-based testing | Must Have |
