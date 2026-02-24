# Impact Analysis: IA Cross-Validation Verifier

**Generated**: 2026-02-15T01:10:00Z
**Feature**: New Verifier agent (M4) for cross-validation of M1/M2/M3 outputs -- flags file list inconsistencies, risk scoring gaps, and completeness issues
**Based On**: Phase 01 Requirements (finalized) -- 7 FRs, 3 NFRs, 28 ACs
**Phase**: 02-impact-analysis

---

## Scope Comparison

| Aspect | Original (Phase 00) | Clarified (Phase 01) |
|--------|---------------------|----------------------|
| Description | New Verifier agent (Approach A) that cross-checks M1/M2/M3 findings | New Verifier agent (M4) with 7 FRs: agent definition, file list cross-validation, risk scoring gap detection, completeness validation, orchestrator integration, report structure, skill registration |
| Keywords | verifier, cross-validation, M1/M2/M3, inconsistencies | verifier, cross-validation, M1-M4, completeness_score, verification_status, CRITICAL/WARNING/INFO severities, fail-open |
| Estimated Files | 8-12 | 5-7 direct + 2-3 test files |
| Scope Change | - | REFINED (original preserved, clarified into specific FRs/ACs with NFRs) |

---

## Executive Summary

This feature adds a Verifier agent (M4) to the Impact Analysis phase that cross-validates M1/M2/M3 outputs before the orchestrator consolidates them. The change is **purely additive**: one new agent definition, one new skill, updates to the orchestrator prompt to invoke M4, and a skills manifest update. No existing M1/M2/M3 agents are modified (NFR-03). The blast radius is **low** -- 5 directly affected files across 2 modules (agents, config). Risk is **low-medium** because the primary complexity is prompt engineering for the verifier's cross-validation logic, and the fail-open requirement (NFR-02) ensures M4 failures cannot block Phase 02 progression. No runtime code (hooks, CJS, ESM) requires modification -- all changes are agent prompt files and JSON config.

**Blast Radius**: LOW (5 files directly, 2 modules)
**Risk Level**: LOW-MEDIUM
**Affected Files**: 5 direct + 2-3 test files
**Affected Modules**: 2 (agents/impact-analysis, hooks/config)

---

## Impact Analysis

### Based On
Finalized requirements from Phase 01 (28 acceptance criteria across 7 FRs analyzed)

### Directly Affected Areas

| # | File | Type | Change | Acceptance Criteria |
|---|------|------|--------|---------------------|
| 1 | `src/claude/agents/impact-analysis/cross-validation-verifier.md` | Agent (NEW) | Create | AC-01.1, AC-01.2, AC-01.3, AC-01.4, AC-02.1-AC-02.4, AC-03.1-AC-03.4, AC-04.1-AC-04.4, AC-06.1-AC-06.5 |
| 2 | `src/claude/agents/impact-analysis/impact-analysis-orchestrator.md` | Agent (MODIFY) | Add M4 step | AC-05.1, AC-05.2, AC-05.3, AC-05.4, AC-05.5 |
| 3 | `src/claude/skills/impact-analysis/cross-validation/SKILL.md` | Skill (NEW) | Create | AC-07.1, AC-07.2 |
| 4 | `src/claude/hooks/config/skills-manifest.json` | Config (MODIFY) | Add M4 entries | AC-07.3 |
| 5 | `src/claude/skills/impact-analysis/impact-consolidation/SKILL.md` | Skill (MODIFY) | Reference M4 | AC-05.2 |

### Files NOT Modified (NFR-03 Backward Compatibility)

| File | Reason |
|------|--------|
| `src/claude/agents/impact-analysis/impact-analyzer.md` (M1) | Read-only input to M4; no output format changes |
| `src/claude/agents/impact-analysis/entry-point-finder.md` (M2) | Read-only input to M4; no output format changes |
| `src/claude/agents/impact-analysis/risk-assessor.md` (M3) | Read-only input to M4; no output format changes |

### Dependency Chain

```
isdlc.md (Phase-Loop Controller)
    |-- impact-analysis-orchestrator.md (MODIFY -- add M4 step)
        |-- impact-analyzer.md (M1) [unchanged, output consumed by M4]
        |-- entry-point-finder.md (M2) [unchanged, output consumed by M4]
        |-- risk-assessor.md (M3) [unchanged, output consumed by M4]
        |-- cross-validation-verifier.md (M4) [NEW]
        |-- impact-consolidation SKILL [MODIFY -- reference M4]
```

### Change Propagation

| Level | Files | Action Required |
|-------|-------|-----------------|
| 0 (Direct) | 5 | Will be created or modified |
| 1 (Dependent) | 2 | May need awareness (impact-delegation SKILL, SKILL.md.template if exists) |
| 2 (Testing) | 3 | Test files to validate report structure and orchestrator flow |

### Blast Radius: LOW

- **Files Estimated**: 5 direct + 2-3 test
- **Modules Estimated**: 2 (agents/impact-analysis, hooks/config)
- **Breaking Changes**: No
- **Database Changes**: No
- **Runtime Code Changes**: No (all prompt engineering and JSON config)

---

## Entry Points

### Based On
Finalized requirements from Phase 01 (28 acceptance criteria analyzed)

### Entry Points by Functional Requirement

#### FR-01: Verifier Agent Definition (AC-01.1 to AC-01.4)

| Type | Path/Name | Status | Notes |
|------|-----------|--------|-------|
| Agent | `src/claude/agents/impact-analysis/cross-validation-verifier.md` | NEW | New M4 agent file |

#### FR-02: File List Cross-Validation (AC-02.1 to AC-02.4)

| Type | Path/Name | Status | Notes |
|------|-----------|--------|-------|
| Agent Logic | Cross-validation checks in verifier agent prompt | NEW | Embedded in agent definition |

#### FR-03: Risk Scoring Gap Detection (AC-03.1 to AC-03.4)

| Type | Path/Name | Status | Notes |
|------|-----------|--------|-------|
| Agent Logic | Risk gap checks in verifier agent prompt | NEW | Embedded in agent definition |

#### FR-04: Completeness Validation (AC-04.1 to AC-04.4)

| Type | Path/Name | Status | Notes |
|------|-----------|--------|-------|
| Agent Logic | Completeness checks in verifier agent prompt | NEW | Embedded in agent definition |

#### FR-05: Orchestrator Integration (AC-05.1 to AC-05.5)

| Type | Path/Name | Status | Notes |
|------|-----------|--------|-------|
| Agent | `src/claude/agents/impact-analysis/impact-analysis-orchestrator.md` | MODIFY | Insert M4 step between "Collect Results" and "Consolidate Report" |
| Skill | `src/claude/skills/impact-analysis/impact-consolidation/SKILL.md` | MODIFY | Update to reference M4 output |

#### FR-06: Verification Report Structure (AC-06.1 to AC-06.5)

| Type | Path/Name | Status | Notes |
|------|-----------|--------|-------|
| Agent Logic | Report format in verifier agent prompt | NEW | JSON + markdown dual output |

#### FR-07: Skill Registration (AC-07.1 to AC-07.3)

| Type | Path/Name | Status | Notes |
|------|-----------|--------|-------|
| Skill | `src/claude/skills/impact-analysis/cross-validation/SKILL.md` | NEW | New skill file |
| Config | `src/claude/hooks/config/skills-manifest.json` | MODIFY | Add IA-401 (or similar) entries |

### Recommended Implementation Order

| Order | FR | Reason |
|-------|-----|--------|
| 1 | FR-01 + FR-06 | Agent definition with report structure -- foundation, no dependencies |
| 2 | FR-02 | File list cross-validation logic -- core verification capability |
| 3 | FR-03 | Risk scoring gap detection -- builds on FR-02 pattern |
| 4 | FR-04 | Completeness validation -- builds on FR-02/FR-03 patterns |
| 5 | FR-07 | Skill registration -- register after agent defined |
| 6 | FR-05 | Orchestrator integration -- connect M4 into flow last |

### Implementation Chain (Primary)

```
Phase-Loop Controller (isdlc.md)
    |-- Delegates to impact-analysis-orchestrator (Step 2-3: launch M1/M2/M3)
        |-- After M1/M2/M3 complete (Step 3: Collect Results)
        |-- NEW Step 3.5: Launch M4 (cross-validation-verifier)
            |-- Reads M1 output (impact_summary, report_section)
            |-- Reads M2 output (entry_points, report_section)
            |-- Reads M3 output (risk_assessment, report_section)
            |-- Produces verification_report (JSON + markdown)
        |-- Step 4: Consolidate (now includes M4 Cross-Validation section)
```

### Integration Points

| Integration Point | Pattern | Reason |
|-------------------|---------|--------|
| impact-analysis-orchestrator.md | Insert step | M4 runs after M1/M2/M3, before consolidation |
| impact-consolidation SKILL | Add M4 reference | Consolidation now merges 4 outputs instead of 3 |
| skills-manifest.json | Add entries | Register M4 agent and skills |
| state.json sub_agents | Add M4 entry | Track M4 status alongside M1/M2/M3 |

---

## Risk Assessment

### Based On
Finalized requirements from Phase 01 (28 acceptance criteria, 3 NFRs, 4 constraints analyzed)

### Risk Summary

| Risk Area | Risk Level | Mitigation |
|-----------|------------|------------|
| Orchestrator modification | MEDIUM | Prompt-only change; fail-open ensures no blocking |
| M1/M2/M3 output format variability | MEDIUM | Defensive parsing with fallbacks (per requirements risk R1) |
| False positive inconsistency flags | LOW | Severity levels (CRITICAL/WARNING/INFO) allow filtering |
| Performance overhead | LOW | Single sequential Task call; NFR-01 targets <20% overhead |
| Skills manifest update | LOW | Additive JSON entries; well-understood pattern |
| Backward compatibility | LOW | NFR-03 ensures no M1/M2/M3 changes; Verifier is purely additive |
| Upgrade workflow support | MEDIUM | C-02 requires both feature and upgrade support; need explicit testing |

### Test Coverage Analysis

| File | Current Coverage | Notes |
|------|-----------------|-------|
| `impact-analysis-orchestrator.md` | None (agent prompt) | Agent prompts tested indirectly via integration |
| `impact-analyzer.md` (M1) | None (agent prompt) | No modification needed |
| `entry-point-finder.md` (M2) | None (agent prompt) | No modification needed |
| `risk-assessor.md` (M3) | None (agent prompt) | No modification needed |
| `skills-manifest.json` | Covered by `skill-validator.test.cjs` | Existing tests validate manifest structure |
| `common.cjs` (parseSizingFromImpactAnalysis) | Covered by `common.test.cjs` | Not directly affected; sizing reads impact-analysis.md output |

### Complexity Hotspots

| Area | Complexity | Reason |
|------|------------|--------|
| Verifier cross-validation logic | MEDIUM | Must parse 3 different agent output formats; output varies between runs |
| Orchestrator M4 insertion | LOW | Single Task call insertion between existing steps |
| Dual workflow support (feature + upgrade) | MEDIUM | Must handle both requirements-based and breaking-changes-based M1/M2/M3 outputs |
| Report structure (JSON + markdown) | LOW | Well-defined format in FR-06 |

### Technical Debt Markers

| Area | Debt | Impact |
|------|------|--------|
| No runtime validation of agent outputs | Pre-existing | M4 must handle malformed M1/M2/M3 outputs gracefully |
| Agent prompts lack structured tests | Pre-existing | Can only test report structure, not prompt behavior |
| skills-manifest.yaml vs .json dual format | Pre-existing | Must update both or verify which is authoritative |

### Risk Recommendations per Area

1. **Orchestrator Integration (FR-05)**: Add explicit fail-open handling in orchestrator. If M4 Task call fails, log warning and proceed to consolidation without verification section. Test with simulated M4 failure.

2. **Output Format Parsing (FR-02, FR-03, FR-04)**: Document expected M1/M2/M3 output schemas in the verifier agent prompt. Include fallback behaviors for missing fields. Test with intentionally incomplete M1/M2/M3 outputs.

3. **Upgrade Workflow (C-02)**: Create explicit test scenarios for upgrade workflow M1/M2/M3 outputs, which differ from feature workflow outputs (breaking_changes vs acceptance_criteria focus).

4. **Skills Manifest (FR-07)**: Follow existing IA-1xx/2xx/3xx numbering pattern. Verify whether skills-manifest.yaml needs parallel update.

---

## Implementation Recommendations

Based on the impact analysis:

1. **Suggested Order**: Start with agent definition (FR-01+FR-06), then cross-validation logic (FR-02/03/04), then skill registration (FR-07), then orchestrator integration (FR-05) last
2. **High-Risk Areas**: Orchestrator modification needs fail-open guarantee; test with M4 failure scenarios
3. **Dependencies to Resolve**: Clarify skills-manifest.yaml vs .json authoritative source; determine skill ID numbering (IA-401 series suggested to follow IA-1xx/2xx/3xx pattern)
4. **Testing Approach**: Focus on report structure validation (JSON schema, markdown format), orchestrator flow (M4 invocation timing), and fail-open behavior (M4 failure graceful degradation)
5. **Key Constraint**: No M1/M2/M3 modifications (NFR-03) -- verifier reads their outputs as-is

---

## Impact Analysis Metadata

```json
{
  "analysis_completed_at": "2026-02-15T01:10:00Z",
  "sub_agents": ["M1", "M2", "M3"],
  "requirements_document": "docs/requirements/REQ-0015-ia-cross-validation-verifier/requirements-spec.md",
  "quick_scan_used": "docs/requirements/REQ-0015-ia-cross-validation-verifier/quick-scan.md",
  "scope_change_from_original": "refined",
  "requirements_keywords": ["verifier", "cross-validation", "M1", "M2", "M3", "M4", "impact-analysis", "orchestrator", "findings", "inconsistency", "verification"],
  "files_directly_affected": 5,
  "modules_affected": 2,
  "risk_level": "low-medium",
  "blast_radius": "low",
  "coverage_gaps": 0
}
```
