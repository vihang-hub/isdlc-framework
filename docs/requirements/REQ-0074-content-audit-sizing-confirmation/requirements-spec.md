# Requirements Specification: Content Audit Sizing Confirmation

**Item**: REQ-0074 | **GitHub**: #138
**Workstream**: D (Content Model) | **Phase**: 0
**Status**: Analyzed

---

## 1. Business Context

The Codex integration requires decomposing agent, skill, command, and topic content into provider-neutral semantic content and provider-specific runtime packaging. Before that work begins (Phase 5), the scope must be sized. The design doc estimated ~293 files / ~1MB. Actual measurement reveals **325 files / ~2.1 MB** — larger than estimated.

**Success metric**: Effort classification per content category; total effort estimate; recommended audit sequence.

## 2. Technical Context

### Actual File Counts (measured)

| Category | Count | Size | Design Doc Estimate |
|----------|-------|------|-------------------|
| Agent files | 70 | ~800 KB | 48 |
| SKILL.md files | 245 | ~1.1 MB | ~240 |
| Command files | 4 | ~200 KB | 4 |
| Topic files | 6 | ~50 KB | (not estimated) |
| **Total** | **325** | **~2.1 MB** | ~293 / ~1MB |

### Agent Breakdown

| Subcategory | Count | Examples |
|-------------|-------|---------|
| Core phase agents (numbered) | 26 | 00-sdlc-orchestrator, 01-requirements-analyst, 05-software-developer |
| Persona agents | 8 | persona-business-analyst, persona-solutions-architect |
| Debate agents (critic/refiner) | 8 | requirements-critic, architecture-refiner |
| Discover agents | 22 | architecture-analyzer, test-evaluator, feature-mapper |
| Impact analysis agents | 5 | impact-analysis-orchestrator, impact-analyzer |
| Tracing agents | 4 | tracing-orchestrator, symptom-analyzer |
| Other (orchestrators, misc) | ~5 | roundtable-analyst, bug-gather-analyst |

### Skill Categories (19)

analysis-steps, analysis-topics, architecture, design, development, devops, discover, documentation, impact-analysis, operations, orchestration, quality-loop, quick-scan, requirements, reverse-engineer, security, testing, tracing, upgrade

## 3. Functional Requirements

### FR-001: Effort Classification Per Category
**Confidence**: High

- **AC-001-01**: Given each content category, then effort is classified as low/medium/high with rationale.
- **AC-001-02**: Given the classification, then total effort is estimated in terms of relative sizing (not hours).

### FR-002: Audit Sequence
**Confidence**: High

- **AC-002-01**: Given the effort classifications, then a recommended audit sequence is documented with rationale for ordering.

### FR-003: Sizing Artifact
**Confidence**: High

- **AC-003-01**: Given the sizing is complete, then `docs/content-audit-sizing.md` exists in the isdlc-codex repo with file counts, effort breakdown, and sequence.

## 4. Out of Scope

| Item | Reason |
|------|--------|
| Actually decomposing files | Phase 5 (REQ-0099-0102) |
| Rewriting any content | Phase 5 |
| Auditing individual files | Phase 5 |

## 5. MoSCoW Prioritization

| FR | Title | Priority |
|----|-------|----------|
| FR-001 | Effort classification | Must Have |
| FR-002 | Audit sequence | Must Have |
| FR-003 | Sizing artifact | Must Have |
