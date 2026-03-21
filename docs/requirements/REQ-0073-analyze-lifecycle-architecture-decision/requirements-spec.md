# Requirements Specification: Analyze Lifecycle Architecture Decision

**Item**: REQ-0073 | **GitHub**: #137 | **Depends on**: REQ-0070 (Codex capability audit — completed)
**Workstream**: D (Content Model) | **Phase**: 0
**Status**: Analyzed

---

## 1. Business Context

The Codex integration design doc identified a critical architectural fork: should the analyze/roundtable lifecycle be part of the shared workflow engine or a separate subsystem? This decision determines the shape of 11 backlog items across Phases 6-7 (Discover & Analyze).

The current implementation already answers this question — analyze runs as an inline handler that uses meta.json, not state.json, and operates in parallel with active build workflows. This decision formalizes that separation as an architectural principle for the shared core.

**Stakeholders**:
- Framework developers (primary) — need to know where analyze code lives in `src/core/`
- Users (secondary) — parallel analyze + build is a working feature that must be preserved

**Success metric**: ADR documented. Analyze subsystem boundary defined. Parallel execution model preserved.

**Critical constraint**: Analyze and build MUST run in parallel. A user can analyze item A while building item B. This works today in Claude Code and must not regress.

## 2. Stakeholders and Personas

### Framework Developer (Primary)
- **Role**: Designs the shared core services architecture
- **Goals**: Clear boundary between analyze subsystem and WorkflowEngine
- **Pain points**: Design doc left this as an open question; ambiguity blocks Phases 6-7 planning

## 3. User Journeys

### Parallel Work Journey (must preserve)
1. **Entry**: Developer starts `/isdlc build "item-A"` — creates active_workflow in state.json
2. **Parallel**: While build runs, developer opens another session and runs `/isdlc analyze "item-B"`
3. **No contention**: Analyze writes to `docs/requirements/item-B/meta.json`. Build writes to `.isdlc/state.json`. Different state stores, no conflict.
4. **Exit**: Both complete independently.

## 4. Technical Context

- **Build workflows** use: state.json → active_workflow → phases, gates, branches, WorkflowEngine
- **Analyze** uses: meta.json → topics, confirmations, artifact readiness, inline execution
- **Shared surfaces**: BACKLOG.md (both read/write), docs/requirements/{slug}/ (analyze creates, build consumes)
- **No contention**: Build and analyze operate on different items and different state files
- **Current implementation**: `src/claude/commands/isdlc.md` analyze handler + `src/claude/agents/roundtable-analyst.md` + `src/antigravity/analyze-item.cjs`

## 5. Quality Attributes and Risks

| Attribute | Priority | Threshold |
|-----------|----------|-----------|
| Parallel execution | Critical | Analyze + build on different items must work concurrently |
| Separation clarity | High | No ambiguity about which code is analyze vs workflow engine |
| Service reuse | High | Analyze consumes shared services without duplicating them |

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Analyze accidentally coupled to WorkflowEngine | Medium | High — breaks parallel execution | ADR explicitly prohibits this; code review enforcement |
| Shared surface contention on same item | Low | Medium | Document that analyze-then-build is sequential per item |
| Analyze subsystem becomes a second workflow engine | Medium | Medium — code duplication | Define minimal interface; analyze is an orchestration consumer, not an engine |

## 6. Functional Requirements

### FR-001: Separate Subsystem Classification
**Confidence**: High
Document analyze as a separate lifecycle subsystem with its own orchestration, distinct from WorkflowEngine.

- **AC-001-01**: Given the ADR, then it explicitly states WorkflowEngine is for build/fix/upgrade/test workflows ONLY.
- **AC-001-02**: Given the ADR, then it explicitly states analyze is a separate subsystem that does NOT use WorkflowEngine, ValidatorEngine, or gate logic.
- **AC-001-03**: Given the ADR, then the rationale explains why: different state model (meta.json vs state.json), different progression model (topics vs phases), different execution model (inline vs phase-loop).

### FR-002: Shared Service Interface
**Confidence**: High
Define which shared core services analyze consumes and how.

- **AC-002-01**: Given the analyze subsystem, then its service dependencies are enumerated: ItemStateService, BacklogService, MemoryService, SessionCacheService, ProjectRootService.
- **AC-002-02**: Given the analyze subsystem, then the services it does NOT use are enumerated: WorkflowEngine, ValidatorEngine, gate logic, branch management.

### FR-003: Parallel Execution Model
**Confidence**: High
Document the parallel execution model — analyze on item A while build runs on item B.

- **AC-003-01**: Given parallel execution, then the document explains the state isolation: analyze uses meta.json per item, build uses state.json global.
- **AC-003-02**: Given parallel execution, then shared surface access patterns are documented: BACKLOG.md (both read/write on different items), docs/requirements/ (analyze creates, build consumes).
- **AC-003-03**: Given the same item, then analyze-then-build is sequential: analyze must complete before build starts on that item.

### FR-004: Subsystem Boundary
**Confidence**: High
Define what analyze owns exclusively vs what it shares with build.

- **AC-004-01**: Given the boundary, then analyze-exclusive surfaces are listed: meta.json lifecycle (topics_covered, confirmation state, acceptance record), roundtable orchestration, bug-gather routing, memory write-back.
- **AC-004-02**: Given the boundary, then shared surfaces are listed with ownership: BACKLOG.md (BacklogService owns, both consume), docs/requirements/{slug}/ (ItemStateService owns, both consume).

### FR-005: Decision Artifact
**Confidence**: High
Write ADR to the requirements folder and a summary to the isdlc-codex repo.

- **AC-005-01**: Given the decision, then an ADR exists with Status, Context, Decision, Rationale, Consequences.

## 7. Out of Scope

| Item | Reason |
|------|--------|
| Implementing the analyze subsystem | That's Phase 7 (REQ-0108-0113) |
| Implementing the WorkflowEngine | That's Phase 2 (REQ-0082) |
| Designing the roundtable for Codex | That's REQ-0109 |
| Discover lifecycle design | That's Phase 6 (REQ-0103) — but this decision informs it |

## 8. MoSCoW Prioritization

| FR | Title | Priority | Rationale |
|----|-------|----------|-----------|
| FR-001 | Separate subsystem classification | Must Have | Core architectural decision |
| FR-002 | Shared service interface | Must Have | Defines core service requirements |
| FR-003 | Parallel execution model | Must Have | Preserves working feature |
| FR-004 | Subsystem boundary | Must Have | Prevents coupling |
| FR-005 | Decision artifact | Must Have | Deliverable format |
