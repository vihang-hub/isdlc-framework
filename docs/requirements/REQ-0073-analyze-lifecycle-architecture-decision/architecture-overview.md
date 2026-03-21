# Architecture Overview: Analyze Lifecycle Architecture Decision

**Item**: REQ-0073 | **GitHub**: #137

---

## 1. Architecture Options

| Option | Summary | Pros | Cons | Verdict |
|--------|---------|------|------|---------|
| 1: Extend WorkflowEngine for non-phase lifecycles | Add topic-based progression, confirmation states, no gates to the engine | Single engine for everything | Complicates engine; breaks parallel execution (state.json contention); forces analyze into phase model | **Eliminated** |
| 2: Separate analyze subsystem on shared services | Analyze has own orchestration, consumes core services, does NOT use WorkflowEngine | Clean separation; preserves parallel execution; matches current working implementation | Two orchestration paths to maintain | **Selected** |

## 2. Selected Architecture

### ADR-CODEX-005: Analyze as Separate Subsystem

- **Status**: Accepted
- **Context**: The analyze/roundtable lifecycle has fundamentally different semantics from build workflows. Build uses linear phase sequences with gates, state.json, and branches. Analyze uses topic coverage, confirmation state machines, meta.json, no branches, and no gates. Critically, analyze and build MUST run in parallel — users analyze item A while building item B. This works today and must not regress.
- **Decision**: Analyze is a separate subsystem. It is NOT a WorkflowEngine workflow. WorkflowEngine is exclusively for build/fix/upgrade/test workflows. The analyze subsystem consumes shared core services (ItemStateService, BacklogService, MemoryService, SessionCacheService, ProjectRootService) but has its own orchestration logic.
- **Rationale**:
  1. **Different state model**: Build uses `.isdlc/state.json` → `active_workflow`. Analyze uses `docs/requirements/{slug}/meta.json`. No overlap.
  2. **Different progression model**: Build advances through ordered phases with gate validation. Analyze tracks topic coverage with a confirmation state machine.
  3. **Different execution model**: Build uses the Phase-Loop Controller with agent delegation. Analyze runs inline (Claude) or as a direct CLI flow (Antigravity).
  4. **Parallel execution**: Build and analyze on different items run concurrently. Forcing analyze into WorkflowEngine would create state.json contention (only one `active_workflow` allowed).
  5. **Already working**: The current Claude Code implementation proves this separation works. Preserving it avoids regression.
- **Consequences**:
  - The shared core needs services that both subsystems consume, not a single engine that handles both.
  - `analyze-item.cjs` in Antigravity gets redesigned as an analyze subsystem adapter, not a WorkflowEngine consumer.
  - Discover (REQ-0103) likely follows the same pattern — a separate subsystem, not a workflow.
  - The core service layer must be designed to support multiple consumers (WorkflowEngine, analyze subsystem, discover subsystem) without assuming any single orchestration model.

## 3. Subsystem Architecture

```
┌─────────────────────────────────────────────────────┐
│                  src/core/                           │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │ WorkflowEngine│  │ ItemState    │  │ Memory    │ │
│  │ (build only) │  │ Service      │  │ Service   │ │
│  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘ │
│         │                 │                 │       │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌─────▼─────┐ │
│  │ Validator    │  │ Backlog      │  │ Session   │ │
│  │ Engine       │  │ Service      │  │ Cache     │ │
│  └──────────────┘  └──────────────┘  └───────────┘ │
│         │                 │                 │       │
│  ┌──────▼───────┐  ┌──────▼───────┐               │
│  │ StateStore   │  │ ProjectRoot  │               │
│  │              │  │ Service      │               │
│  └──────────────┘  └──────────────┘               │
└─────────────────────────────────────────────────────┘
         │                 │                 │
    ┌────┴────┐      ┌────┴────┐      ┌────┴────┐
    │  Build  │      │ Analyze │      │ Discover│
    │ (Wkfl  │      │ (Subsys)│      │ (Subsys)│
    │ Engine) │      │         │      │         │
    └─────────┘      └─────────┘      └─────────┘
```

**Build** consumes: WorkflowEngine, ValidatorEngine, StateStore, BacklogService, ItemStateService
**Analyze** consumes: ItemStateService, BacklogService, MemoryService, SessionCacheService, ProjectRootService
**Discover** (likely): Similar to Analyze — separate subsystem, own orchestration

## 4. Parallel Execution Model

### State Isolation

| Surface | Build (item A) | Analyze (item B) | Contention? |
|---------|---------------|-------------------|-------------|
| `.isdlc/state.json` | Read/write `active_workflow` | Does NOT touch | None |
| `docs/requirements/item-A/meta.json` | Reads (for artifact folder) | Does NOT touch | None |
| `docs/requirements/item-B/meta.json` | Does NOT touch | Read/write | None |
| `BACKLOG.md` | Updates item-A marker on finalize | Updates item-B marker on finalize | None (different items) |
| `docs/requirements/item-A/*.md` | Reads/creates artifacts | Does NOT touch | None |
| `docs/requirements/item-B/*.md` | Does NOT touch | Creates artifacts | None |

### Sequential Constraint (Same Item)

Analyze and build on the SAME item are sequential:
1. Analyze item-A → produces requirements-spec.md, architecture-overview.md, module-design.md, updates meta.json to "analyzed"
2. Build item-A → reads analyzed artifacts, creates branch, runs phases

Build on an unanalyzed item starts from Phase 00 (quick scan) and runs the full sequence. Build on an analyzed item starts from the appropriate phase based on `computeStartPhase(meta)`.

## 5. Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Analyze lifecycle | Separate subsystem | Different state/progression/execution model; parallel execution required |
| WorkflowEngine scope | Build/fix/upgrade/test only | Linear phase workflows with gates |
| Discover lifecycle | Likely separate subsystem | Same reasoning as analyze (pending REQ-0103) |
| Service layer design | Multi-consumer | Must support WorkflowEngine, analyze, and discover without assuming single orchestration |
