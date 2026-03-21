# Requirements Specification: Antigravity Viability Assessment

**Item**: REQ-0072 | **GitHub**: #136 | **Depends on**: REQ-0070 (Codex capability audit — completed)
**Workstream**: A (Runtime & Governance) | **Phase**: 0
**Status**: Analyzed

---

## 1. Business Context

The original design doc treated Antigravity as a candidate shared control plane. This assessment corrects that: Antigravity is a **peer provider** — a standalone IDE that sits alongside Claude Code and Codex CLI as an equal way to interact with iSDLC. The assessment evaluates what Antigravity's 15 scripts contribute to shared core extraction vs what stays as Antigravity-specific adapter logic.

**Stakeholders**:
- Framework developers (primary) — need to know how to decompose Antigravity scripts during core extraction
- Antigravity users — need the IDE to keep working throughout the migration

**Success metric**: Each of 15 scripts decomposed into core logic vs adapter logic; provider comparison documented; extraction sequence recommended.

## 2. Stakeholders and Personas

### Framework Developer (Primary)
- **Role**: Extracts shared core from existing provider-specific code
- **Goals**: Know exactly which logic moves to `src/core/` and which stays in `src/providers/antigravity/`

## 3. User Journeys

### Extraction Planning Journey
1. **Entry**: Developer reads antigravity-viability-assessment.md
2. **Per-script lookup**: Finds a script, sees core logic vs adapter logic split
3. **Extraction sequence**: Reads recommended order for pulling logic into core
4. **Exit**: Uses assessment to plan core extraction (REQ-0079 through REQ-0086)

## 4. Technical Context

- **15 Antigravity scripts** in `src/antigravity/`
- All scripts depend on `common.cjs` — the primary coupling point
- 3 scripts also depend on `user-hooks.cjs` (user-space hook execution)
- 1 script (analyze-item.cjs) has heavy dependencies (persona-loader, roundtable-config)
- Scripts are Node.js CLI tools — already provider-neutral in shape
- **Key correction**: Antigravity is not a shared backbone. It's a peer provider alongside Claude and Codex.

## 5. Quality Attributes and Risks

| Attribute | Priority | Threshold |
|-----------|----------|-----------|
| Completeness | Critical | All 15 scripts assessed |
| Accuracy | High | Core vs adapter split is actionable for extraction |
| Consistency | High | Decomposition aligns with core service design (REQ-0079-0086) |

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Antigravity breaks during extraction | Medium | High — users lose a working IDE | Extract core incrementally; keep scripts working at each step |
| Core services designed around Antigravity's needs only | Medium | Medium — Claude/Codex adapters don't fit | Provider comparison ensures all three adapters' needs are considered |

## 6. Functional Requirements

### FR-001: Peer Provider Classification
**Confidence**: High
Classify Antigravity as a peer provider with clear adapter boundary. Document how it differs from Claude and Codex.

- **AC-001-01**: Given the three providers, then a comparison table exists with: invocation model, governance mechanism, session model, sub-agent capability, and instruction surface for each.
- **AC-001-02**: Given Antigravity's classification, then the assessment explicitly states it is a peer provider, not a shared backbone.

### FR-002: Per-Script Decomposition
**Confidence**: High
For each of the 15 scripts, identify what logic belongs in `src/core/` vs what stays in `src/providers/antigravity/`.

- **AC-002-01**: Given each script, then a row exists in the decomposition table with: script name, current dependencies, core logic (what moves), adapter logic (what stays), and target core service.
- **AC-002-02**: Given the decomposition, then no script is left unclassified.

### FR-003: Antigravity Characteristics
**Confidence**: High
Document what makes Antigravity a distinct IDE vs Claude and Codex.

- **AC-003-01**: Given Antigravity's unique characteristics, then they are documented with: what it provides that Claude/Codex don't, and what it lacks that they have.

### FR-004: Extraction Sequence
**Confidence**: High
Recommend which scripts yield core services first and in what order.

- **AC-004-01**: Given the decomposition, then an ordered extraction sequence is documented with rationale for the ordering.
- **AC-004-02**: Given the sequence, then it aligns with the dependency chain in the Codex integration backlog (Phase 2 items).

### FR-005: Assessment Artifact
**Confidence**: High
Write to `docs/antigravity-viability-assessment.md` in the isdlc-codex repo.

- **AC-005-01**: Given all assessments complete, then the artifact contains: provider comparison, per-script decomposition, extraction sequence, and Antigravity characteristics.

## 7. Out of Scope

| Item | Reason |
|------|--------|
| Actually extracting core services | That's Phase 2 (REQ-0079-0086) |
| Modifying Antigravity scripts | Assessment only |
| Designing the Antigravity adapter interface | Post-extraction work |

## 8. MoSCoW Prioritization

| FR | Title | Priority | Rationale |
|----|-------|----------|-----------|
| FR-001 | Peer provider classification | Must Have | Corrects design doc assumption |
| FR-002 | Per-script decomposition | Must Have | Core extraction planning input |
| FR-003 | Antigravity characteristics | Should Have | Informs adapter design |
| FR-004 | Extraction sequence | Must Have | Orders Phase 2 work |
| FR-005 | Assessment artifact | Must Have | Deliverable format |
