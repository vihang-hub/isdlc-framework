# Architecture Overview: Vertical Spike — Implementation Loop

**Item**: REQ-0076 | **GitHub**: #140

---

## 1. Selected Architecture

### ADR-CODEX-007: Minimal Core Slice for Implementation Loop

- **Status**: Accepted
- **Context**: The first extraction must prove the shared-core model end-to-end. The implementation loop (Writer/Reviewer/Updater) was selected because it's bounded, structured, and exercises state, contracts, and looping.
- **Decision**: Extract only what the implementation loop needs: loop state management, state persistence, and structured contracts. Do NOT extract validators, workflow engine, or backlog services yet.
- **Rationale**: Minimal slice reduces risk. Proves the adapter model before broader extraction. If this slice fails, the blast radius is small.
- **Consequences**: `src/core/` starts with just `state/`, `teams/`, `bridge/`. Other services are added in Phase 2 once this spike proves the model.

## 2. Extraction Boundary

```
BEFORE (current):
  quality-loop-engineer.md
    └── inline loop logic (file ordering, cycles, verdicts)
    └── delegates to: writer, reviewer, updater agents
    └── reads/writes state.json directly

AFTER (extracted):
  src/core/
    teams/
      implementation-loop.js    ← loop orchestration (ESM)
      contracts/
        writer-context.json     ← WRITER_CONTEXT schema
        review-context.json     ← REVIEW_CONTEXT schema
        update-context.json     ← UPDATE_CONTEXT schema
    state/
      index.js                  ← readState, writeState (ESM)
    bridge/
      teams.cjs                 ← CJS wrapper for hooks
      state.cjs                 ← CJS wrapper for hooks

  quality-loop-engineer.md
    └── calls core implementation-loop
    └── delegates to: writer, reviewer, updater agents (unchanged)
```

## 3. Data Flow

```
Provider Adapter (Claude/Codex)
    │
    ▼
Core: implementation-loop.js
    │
    ├── computeNextFile(loopState) → { file_path, file_number, is_test }
    ├── buildWriterContext(loopState, file) → WRITER_CONTEXT
    ├── buildReviewContext(loopState, file, cycle) → REVIEW_CONTEXT
    ├── buildUpdateContext(loopState, findings) → UPDATE_CONTEXT
    ├── processVerdict(loopState, verdict) → { action: "next_file" | "update" | "complete" }
    │
    ▼
Core: state/index.js
    │
    ├── readState(projectRoot) → state
    └── writeState(projectRoot, state) → void
```

## 4. Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Extraction scope | Minimal — loop state + state persistence + contracts | Prove model before expanding |
| Agent files | Unchanged | Role packaging stays provider-specific |
| Core format | ESM + CJS bridge | Per ADR-CODEX-006 |
