# Requirements Specification: Codex Runtime Capability Audit

**Item**: REQ-0070 | **GitHub**: #134 | **Source**: CODEX-INTEGRATION-DESIGN.md + CODEX-INTEGRATION-IMPLEMENTATION-PLAN.md
**Workstream**: A (Runtime & Governance) | **Phase**: 0
**Status**: Analyzed

---

## 1. Business Context

The iSDLC framework is adding first-class Codex support by extracting a provider-neutral core with Claude and Codex as separate runtime adapters. Before any broad extraction begins, the Codex runtime must be audited to prove or falsify the key assumptions the design relies on. This audit is the Phase 0 gate — everything else in the 58-item Codex integration backlog is blocked until it completes.

**Stakeholders**:
- Framework developers (primary) — need to know what Codex can and can't do before committing to extraction work
- Future Codex users (secondary) — audit findings define the scope of Codex support they'll receive

**Success metric**: All 6 runtime assumptions classified with evidence from live testing; go/no-go recommendation produced.

**Cost of not doing this**: Broad extraction proceeds on untested assumptions, risking wasted effort if Codex can't support core capabilities.

## 2. Stakeholders and Personas

### Framework Developer (Primary)
- **Role**: Builds and maintains the iSDLC framework
- **Goals**: Understand Codex limitations before investing in extraction work
- **Pain points**: No authoritative source exists for what Codex can actually do in an orchestration context
- **Proficiency**: Expert in iSDLC internals, familiar with Claude Code runtime model

## 3. User Journeys

### Audit Execution Journey
1. **Entry**: Developer opens isdlc-codex repo with Codex CLI
2. **P1-P2**: Run prerequisite probes (file access, instruction projection). If fail → stop with "no-go"
3. **P3-P6**: Run capability probes (sub-agents, structured results, orchestration loops, governance)
4. **Exit**: Write audit artifact with classifications, governance matrix, and go/no-go recommendation

## 4. Technical Context

- **Test environment**: `~/projects/isdlc-codex` — a fork of iSDLC framework with full codebase, npm deps, and test suite
- **Runtime**: Codex CLI
- **No Codex config exists yet** — no `.codex/`, no `CODEX.md`, no `agents.md`
- **Existing assets to exercise**: 555+ tests, 26 hooks, 48 agents, 15 Antigravity scripts, ~240 skills
- **Constraint**: Audit is read-only on the main framework repo; all testing happens in isdlc-codex

## 5. Quality Attributes and Risks

| Attribute | Priority | Threshold |
|-----------|----------|-----------|
| Completeness | Critical | All 6 assumptions must be classified |
| Reproducibility | High | Any probe can be re-run by another developer |
| Evidence quality | High | Raw outputs captured, not just subjective assessment |

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Codex CLI doesn't support sub-agents | Medium | High — blocks team execution model | Document limitation, narrow Codex scope to single-agent workflows |
| Governance boundary is weaker than Claude | High | High — requires architectural mitigation | Enforcement layering protocol (core validates, adapter trusts core) |
| Codex behavior changes between versions | Medium | Medium — audit findings become stale | Record Codex CLI version, date findings, plan re-audit cadence |
| P1 fails (basic file/process access) | Low | Critical — blocks entire integration | Early termination with "no-go" recommendation |

## 6. Functional Requirements

### FR-001: Runtime Assumption Classification
**Confidence**: High
Classify all 6 Codex runtime assumptions as verified/inferred/partial/unsupported with evidence from live testing against the isdlc-codex repo.

**Assumptions to classify**:
1. Bounded sub-agent execution
2. Structured result collection from sub-agents
3. Deterministic file and process access
4. Sufficient tool support for orchestration-driven workflows
5. Provider-specific instruction/runtime projection
6. Permission/authorization boundaries

- **AC-001-01**: Given Codex CLI running against isdlc-codex, when each of the 6 probes is executed, then a classification (verified/inferred/partial/unsupported) is recorded with supporting evidence.
- **AC-001-02**: Given a classification of "partial", then the specific limitation and any viable workaround are documented.
- **AC-001-03**: Given a classification of "unsupported", then the architectural implication for the extraction plan is documented.

### FR-002: Governance Strength Matrix
**Confidence**: High
Produce a comparison matrix of enforcement boundaries between Claude and Codex.

- **AC-002-01**: Given the audit results, then a governance matrix is produced with columns: Capability, Claude Strength, Codex Strength, Gap, Mitigation.
- **AC-002-02**: Given the matrix, then each capability is rated as strong/medium/weak/none for both providers.

### FR-003: Go/No-Go Recommendation
**Confidence**: High
Produce a tiered go/no-go recommendation for Phase 1 (vertical spike).

- **AC-003-01**: Given Tier 1 probes (P1, P2) both fail, then recommendation is "no-go."
- **AC-003-02**: Given Tier 1 passes but Tier 2 (P3, P4) fails, then recommendation is "go with narrow scope" (single-agent Codex only).
- **AC-003-03**: Given all tiers pass, then recommendation is "go" for full extraction.
- **AC-003-04**: Given any "go" recommendation, then conditions and caveats are explicitly listed.

### FR-004: Workaround Documentation
**Confidence**: High
Document workarounds for any partial or unsupported capabilities.

- **AC-004-01**: Given a probe result of "partial", then a workaround is documented with trade-offs.
- **AC-004-02**: Given a probe result of "unsupported" with no workaround, then the scope reduction is documented.

### FR-005: Reproducible Test Procedures
**Confidence**: High
Each probe must have a procedure that another developer can independently re-run.

- **AC-005-01**: Given a probe procedure, then it specifies: input, numbered steps, expected output, and actual output fields.
- **AC-005-02**: Given a probe, then the Codex CLI version and environment details are recorded.

### FR-006: Audit Artifact
**Confidence**: High
Write the audit to `docs/codex-capability-audit.md` in the isdlc-codex repo.

- **AC-006-01**: Given all probes are complete, then the artifact contains: summary matrix, governance matrix, go/no-go recommendation, per-probe results, workarounds, and raw output appendix.

## 7. Out of Scope

| Item | Reason |
|------|--------|
| Building the Codex adapter | That's Phase 8 (REQ-0114) — this is research only |
| Modifying the main iSDLC framework | All testing in isdlc-codex repo |
| Testing Codex API directly | Audit uses Codex CLI, not raw API |
| Performance benchmarking | Separate item (REQ-0121) |
| Content audit of agents/skills | Separate item (REQ-0074) |

## 8. MoSCoW Prioritization

| FR | Title | Priority | Rationale |
|----|-------|----------|-----------|
| FR-001 | Runtime assumption classification | Must Have | Core deliverable — everything depends on this |
| FR-002 | Governance strength matrix | Must Have | Critical input for REQ-0071 and enforcement layering |
| FR-003 | Go/no-go recommendation | Must Have | Phase 0 gate decision |
| FR-004 | Workaround documentation | Should Have | Valuable but only applies if partial findings exist |
| FR-005 | Reproducible procedures | Should Have | Good practice; enables re-audit |
| FR-006 | Audit artifact | Must Have | Deliverable format |
