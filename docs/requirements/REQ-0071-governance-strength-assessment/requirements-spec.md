# Requirements Specification: Governance Strength Assessment

**Item**: REQ-0071 | **GitHub**: #135 | **Depends on**: REQ-0070 (Codex capability audit — completed)
**Workstream**: A (Runtime & Governance) | **Phase**: 0
**Status**: Analyzed

---

## 1. Business Context

The Codex capability audit (REQ-0070) proved all 6 runtime assumptions verified. The critical finding was that Codex has instruction-level governance (AGENTS.md) but no external hook interception (no PreToolUse/PostToolUse equivalent). This assessment formalizes the governance gap by classifying all 26 hooks individually, determining gap severity, and defining the mitigation path for each.

**Stakeholders**:
- Framework developers (primary) — need per-hook classification to plan the hook conversion workstream (REQ-0090-0093)
- Architecture team — needs gap analysis to design enforcement layering (REQ-0088)

**Success metric**: All 26 hooks + inject-session-cache classified with Claude strength, Codex equivalent, gap severity, and mitigation.

**Cost of not doing this**: Hook conversion proceeds without authoritative gap analysis, risking governance downgrades being introduced silently.

## 2. Stakeholders and Personas

### Framework Developer (Primary)
- **Role**: Implements hook-to-core migration
- **Goals**: Know exactly which hooks port cleanly and which need architectural mitigation
- **Pain points**: Design doc groups hooks into classes but doesn't assess Codex equivalence per hook

## 3. User Journeys

### Assessment Consumption Journey
1. **Entry**: Developer reads governance-strength-assessment.md
2. **Per-hook lookup**: Finds specific hook, sees Claude vs Codex strength, gap, mitigation
3. **Tier overview**: Reads tier summary to understand overall risk posture
4. **Exit**: Uses assessment as input for REQ-0088 (enforcement layering) and REQ-0090-0093 (hook conversions)

## 4. Technical Context

- **Input**: Codex capability audit (REQ-0070), hook conversion map from CODEX-INTEGRATION-DESIGN.md
- **26 hooks** across 5 tiers:
  - Tier 1: 9 core validators (gate-blocker, constitution-validator, etc.)
  - Tier 2: 7 workflow guards (iteration-corridor, phase-loop-controller, etc.)
  - Tier 3: 5 file-protection hooks (branch-guard, state-file-guard, etc.)
  - Tier 4: 6 observability hooks (skill-validator, log-skill-usage, etc.)
  - Tier 5: 1 context injection (inject-session-cache)
- **Constraint**: Assessment only — no code changes

## 5. Quality Attributes and Risks

| Attribute | Priority | Threshold |
|-----------|----------|-----------|
| Completeness | Critical | All 26 hooks + inject-session-cache classified |
| Accuracy | High | Classifications consistent with audit findings |
| Actionability | High | Each hook has a concrete mitigation, not just "needs work" |

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Tier 3 gaps are wider than assessed | Low | Medium | P6 proved instruction governance works; core validators provide hard boundary |
| New hooks added before assessment consumed | Low | Low | Assessment documents hook list version; re-run if hooks change |

## 6. Functional Requirements

### FR-001: Per-Hook Governance Classification
**Confidence**: High
Classify all 26 hooks plus inject-session-cache with: Claude enforcement mechanism, Codex equivalent mechanism, gap severity (none/low/moderate/high), and specific mitigation.

- **AC-001-01**: Given each of the 26 hooks, then a row exists in the classification matrix with all 6 columns populated (hook, class, Claude strength, Codex equivalent, gap severity, mitigation).
- **AC-001-02**: Given inject-session-cache, then it is classified separately as context injection with adapter-specific handling.

### FR-002: Tier Summary Analysis
**Confidence**: High
Produce a per-tier summary with overall gap severity and key finding.

- **AC-002-01**: Given all 5 tiers, then each has a summary section with: number of hooks, overall gap severity, key finding, and relationship to downstream items.

### FR-003: Enforcement Layering Recommendation
**Confidence**: High
Document how core validators + instruction projection + Antigravity scripts close the identified gaps.

- **AC-003-01**: Given Tier 3 hooks with moderate gap, then the enforcement layering recommendation describes how core validators provide the hard boundary and instruction-level governance provides defense-in-depth.
- **AC-003-02**: Given the recommendation, then it maps to REQ-0088 (enforcement layering protocol) as the implementation item.

### FR-004: Downstream Item Input
**Confidence**: High
Document how the assessment feeds into hook conversion items.

- **AC-004-01**: Given the assessment, then it maps each tier to the corresponding hook conversion item (REQ-0090 for Tier 1, REQ-0091 for Tier 2, REQ-0092 for Tier 4).
- **AC-004-02**: Given Tier 3 hooks, then the assessment specifies whether they stay Claude-only or get instruction-level Codex equivalents.

### FR-005: Assessment Artifact
**Confidence**: High
Write to `docs/governance-strength-assessment.md` in the isdlc-codex repo.

- **AC-005-01**: Given all classifications are complete, then the artifact contains: summary, per-hook matrix, tier analysis, enforcement layering recommendation, and downstream item mapping.

## 7. Out of Scope

| Item | Reason |
|------|--------|
| Implementing hook conversions | That's REQ-0090-0093 |
| Implementing enforcement layering | That's REQ-0088 |
| Modifying any hooks | Assessment only |
| Testing Codex enforcement live | Already done in REQ-0070 P6 |

## 8. MoSCoW Prioritization

| FR | Title | Priority | Rationale |
|----|-------|----------|-----------|
| FR-001 | Per-hook classification | Must Have | Core deliverable |
| FR-002 | Tier summary | Must Have | Executive view for planning |
| FR-003 | Enforcement layering recommendation | Must Have | Bridges to REQ-0088 |
| FR-004 | Downstream item input | Should Have | Planning convenience |
| FR-005 | Assessment artifact | Must Have | Deliverable format |
