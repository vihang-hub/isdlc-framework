# Impact Analysis: Adaptive Workflow Sizing (REQ-0011)

**Generated**: 2026-02-12
**Feature**: Adaptive Workflow Sizing -- framework auto-sizes features after Impact Analysis (Phase 02) with three intensities: light, standard, epic
**Based On**: Phase 01 Requirements (finalized -- requirements-spec.md v1.0.0)
**Phase**: 02-impact-analysis

---

## Scope Comparison

| Aspect | Original Description | Clarified (Phase 01) |
|--------|---------------------|----------------------|
| Description | Adaptive workflow sizing -- framework auto-sizes features after Impact Analysis | 7 functional requirements (FR-01 through FR-07), 25 acceptance criteria, scoping out epic execution as future work |
| Keywords | sizing, light, standard, epic, workflow | sizing, decision-point, intensity, light, standard, epic, phase-array, `-light` flag, state tracking, thresholds, UX, override |
| Estimated Files | ~6 (from delegation prompt) | 12 directly affected, ~8 transitively affected |
| Scope Change | - | REFINED -- epic execution deferred; `-light` flag added; configurable thresholds added; sizing state tracking added |

---

## Executive Summary

Adaptive Workflow Sizing introduces a sizing decision point into the Phase-Loop Controller (isdlc.md) that runs after GATE-02 passes and before Phase 03 delegation. The feature primarily modifies the Phase-Loop Controller command file, the workflows.json configuration, and the SDLC orchestrator, while also requiring a new shared utility function in the hooks library and updates to the state-write-validator hook to allow the new `sizing` state field. The blast radius is **MEDIUM** -- 12 files require direct changes across 5 modules (commands, agents, hooks, config, and CLI). The feature touches the core workflow progression logic, which is the most critical code path in the framework, requiring careful implementation and testing. Risk is **MEDIUM** due to the Phase-Loop Controller being the single most important control flow in the framework, but is mitigated by the fact that the sizing logic is additive (inserted between existing steps) rather than modifying existing step logic.

**Blast Radius**: MEDIUM
**Risk Level**: MEDIUM
**Affected Files**: 12 direct, ~8 transitive
**Affected Modules**: 5 (commands, agents, hooks/lib, config, state schema)

---

## Impact Analysis (M1)

### Directly Affected Files

| File | Change Type | Requirement | Description |
|------|-------------|-------------|-------------|
| `src/claude/commands/isdlc.md` | MODIFY | FR-01, FR-03, FR-04, FR-05 | Add sizing decision point after GATE-02 in Phase-Loop Controller (STEP 3e-sizing between 3e and 3f). Add `-light` flag parsing in feature command section. Add sizing UX menu (accept/override/show). Add phase array modification logic for light intensity. |
| `.isdlc/config/workflows.json` | MODIFY | FR-02, FR-07 | Add `sizing` configuration block to `feature` workflow definition with thresholds (light_max_files: 5, epic_min_files: 20), `light_skip_phases` array, and `-light` flag option. |
| `src/claude/agents/00-sdlc-orchestrator.md` | MODIFY | FR-04, FR-07 | Add `-light` flag parsing in init-and-phase-01 mode. Store `flags.light` in active_workflow. Pass flag through to Phase-Loop Controller response. |
| `src/claude/hooks/lib/common.cjs` | MODIFY | FR-01, FR-05 | Add `applySizingDecision(state, intensity, sizingData)` utility function that modifies `active_workflow.phases`, `active_workflow.phase_status`, `phases` object, and recalculates `current_phase_index`. Add `parseSizingFromImpactAnalysis(impactAnalysisMd)` parser function. |
| `src/claude/hooks/state-write-validator.cjs` | MODIFY | FR-07 | Allow `active_workflow.sizing` as a writable field in state.json (currently, the validator may block writes to unknown nested fields under active_workflow). |
| `src/claude/hooks/config/iteration-requirements.json` | MODIFY | FR-02 | No new phase requirements needed, but `workflow_overrides.feature` may need a `sizing` section to adjust gate requirements when light intensity skips phases. |
| `src/claude/agents/impact-analysis/impact-analysis-orchestrator.md` | MODIFY | FR-01 | Ensure impact-analysis.md output includes structured data that the sizing parser can extract: file count, module count, risk score (low/medium/high), coupling assessment, test coverage gaps. Currently outputs these but format must be stable. |
| `src/claude/hooks/blast-radius-validator.cjs` | MODIFY | FR-05 | When light intensity is active, the blast-radius-validator runs at GATE-16 (quality-loop) instead of GATE-06. The validator reads impact-analysis.md which still exists regardless of intensity. No logic change needed -- the hook already reads from impact-analysis.md and checks against git diff. However, the phase at which it triggers may need adjustment if the validator is phase-gated. |
| `src/claude/hooks/phase-sequence-guard.cjs` | NO CHANGE | - | This hook validates that the target phase matches current_phase. After sizing modifies the phases array, subsequent delegations will target the correct (modified) phase array. No change needed as long as state.json is updated before delegation. |
| `src/claude/hooks/phase-loop-controller.cjs` | NO CHANGE | - | This hook validates phase status is `in_progress` before delegation. Sizing modifies the phases array before any delegation to Phase 03/05 happens. No change needed. |
| `src/claude/hooks/gate-blocker.cjs` | MODIFY | FR-05 | When light intensity removes phases 03 and 04, the gate-blocker must not block advancement for those removed phases. Currently reads `active_workflow.phases` which will be modified. May need a guard: if `phase not in active_workflow.phases`, skip gate check for that phase. This is already implicitly handled because the Phase-Loop Controller only iterates over `active_workflow.phases`, but an explicit guard is safer. |
| `src/claude/hooks/workflow-completion-enforcer.cjs` | MODIFY | FR-07 | When workflow completes, `collectPhaseSnapshots()` must handle the modified phases array (fewer phases for light). Ensure `pruneCompletedPhases()` does not fail when expected phases are missing from `state.phases`. Add sizing data preservation in workflow_history entry. |

### Outward Dependencies (What Depends on Changed Files)

| Changed File | Depended On By | Impact |
|-------------|---------------|--------|
| `isdlc.md` (Phase-Loop Controller) | All workflow executions | HIGH -- this is the central control flow. Any bug here blocks all workflows. |
| `workflows.json` | `gate-blocker.cjs`, `phase-sequence-guard.cjs`, `sdlc-orchestrator.md`, `isdlc.md` | MEDIUM -- multiple hooks read workflow definitions. New `sizing` key must not break existing parsers. |
| `common.cjs` | All 28 hooks + 5 dispatchers | HIGH -- shared library. New functions must not break existing exports. Addition-only change (safe). |
| `state-write-validator.cjs` | All state.json writes | MEDIUM -- if incorrectly modified, could block legitimate state writes. |

### Inward Dependencies (What Changed Files Depend On)

| Changed File | Depends On | Impact |
|-------------|-----------|--------|
| `isdlc.md` | `.isdlc/state.json`, `workflows.json`, all phase agents | Phase-Loop Controller reads state and config at each iteration |
| `common.cjs` | `fs`, `path` (Node built-ins only) | No external deps -- safe |
| `gate-blocker.cjs` | `common.cjs`, `iteration-requirements.json`, `workflows.json` | Reads config at check time |

### Change Propagation Paths

```
isdlc.md (sizing decision point)
  |-> reads workflows.json (sizing thresholds)
  |-> reads impact-analysis.md (sizing inputs)
  |-> calls applySizingDecision() from common.cjs
  |-> modifies state.json (active_workflow.phases, sizing object)
  |-> subsequent phase delegations use modified phases array
       |-> phase-sequence-guard reads active_workflow.current_phase (OK)
       |-> gate-blocker reads active_workflow.phases (needs guard)
       |-> phase-loop-controller reads phases[phase].status (OK)
       |-> workflow-completion-enforcer reads phases for snapshots (needs guard)
```

---

## Entry Points (M2)

### Existing Entry Points Affected

| Entry Point | File | Acceptance Criteria | Change Required |
|------------|------|--------------------|----|
| `/isdlc feature "description"` | `src/claude/commands/isdlc.md` | AC-12, AC-13, AC-14 | Parse `-light` flag from command arguments |
| Phase-Loop Controller STEP 3e (post-phase state update) | `src/claude/commands/isdlc.md` | AC-01, AC-02, AC-03 | Insert sizing decision logic after GATE-02 pass, before Phase 03 delegation |
| `init-and-phase-01` mode in orchestrator | `src/claude/agents/00-sdlc-orchestrator.md` | AC-12 | Pass `-light` flag in init result |
| `active_workflow` initialization | `src/claude/agents/00-sdlc-orchestrator.md` | AC-24 | Initialize `sizing` object placeholder in active_workflow |
| `collectPhaseSnapshots()` | `src/claude/hooks/lib/common.cjs` | AC-25 | Handle variable-length phase arrays |
| Workflow finalization (STEP 4) | `src/claude/commands/isdlc.md` | AC-25 | Ensure sizing data persists to workflow_history |

### New Entry Points to Create

| Entry Point | File | Acceptance Criteria | Description |
|------------|------|--------------------|----|
| Sizing Decision Point (STEP 3e-sizing) | `src/claude/commands/isdlc.md` | AC-01 through AC-11 | New step in Phase-Loop Controller between GATE-02 completion and Phase 03 delegation. Reads impact-analysis.md, computes sizing recommendation, presents UX menu. |
| `applySizingDecision(state, intensity, sizingData)` | `src/claude/hooks/lib/common.cjs` | AC-15, AC-16, AC-17, AC-18 | New function that modifies phase arrays, phase_status, and current_phase_index based on chosen intensity. |
| `parseSizingFromImpactAnalysis(content)` | `src/claude/hooks/lib/common.cjs` | AC-01, AC-03 | New parser function that extracts file count, module count, risk score, coupling, and coverage gaps from impact-analysis.md markdown. Must be deterministic. |
| `computeSizingRecommendation(metrics, thresholds)` | `src/claude/hooks/lib/common.cjs` | AC-03, AC-07, AC-08 | New function that applies threshold logic to produce intensity recommendation with rationale. Pure function, deterministic. |
| `-light` flag option in workflows.json | `.isdlc/config/workflows.json` | AC-12, AC-14 | New option entry under `feature.options` |
| `sizing` config block in workflows.json | `.isdlc/config/workflows.json` | AC-07 | New configuration section with thresholds and light_skip_phases |

### Implementation Chain (Entry to Data Layer)

```
User invokes: /isdlc feature "description"
  -> isdlc.md: parse -light flag (if present)
  -> STEP 1: orchestrator init-and-phase-01 (stores flag in active_workflow)
  -> STEP 3: Phase loop begins
     -> Phase 00 (quick-scan) -> Phase 01 (requirements) -> Phase 02 (impact-analysis)
     -> STEP 3e: Post-phase state update for 02-impact-analysis
     -> NEW STEP 3e-sizing: (only for feature workflow, only after phase 02)
        IF -light flag set:
          -> applySizingDecision(state, 'light', { forced: true })
          -> Skip sizing UX menu
        ELSE:
          -> parseSizingFromImpactAnalysis(read impact-analysis.md)
          -> computeSizingRecommendation(metrics, thresholds from workflows.json)
          -> Display sizing recommendation UX
          -> User: [A] Accept / [O] Override / [S] Show analysis
          -> applySizingDecision(state, chosen_intensity, sizingData)
     -> Continue Phase loop with (possibly modified) phases array
     -> STEP 4: Finalize -- sizing data preserved in workflow_history
```

### Recommended Implementation Order

1. **workflows.json** -- Add sizing configuration (thresholds, options, light_skip_phases). Foundation that other changes reference.
2. **common.cjs** -- Add `parseSizingFromImpactAnalysis()`, `computeSizingRecommendation()`, `applySizingDecision()`. These are pure utility functions, testable in isolation.
3. **state-write-validator.cjs** -- Allow `active_workflow.sizing` field. Prerequisite for state writes.
4. **sdlc-orchestrator.md** -- Add `-light` flag parsing, sizing object initialization.
5. **isdlc.md** -- Add sizing decision point (STEP 3e-sizing), UX menu, `-light` flag parsing. This is the main integration point -- depends on steps 1-4.
6. **gate-blocker.cjs** -- Add guard for removed phases.
7. **workflow-completion-enforcer.cjs** -- Handle variable-length phase arrays, sizing data preservation.
8. **impact-analysis-orchestrator.md** -- Validate/stabilize output format for sizing parser.
9. **iteration-requirements.json** -- Add workflow overrides for light intensity (if needed).
10. **blast-radius-validator.cjs** -- Verify behavior with modified phase arrays (may need no change).

---

## Risk Assessment (M3)

### Test Coverage Analysis

| File | Current Test Coverage | Risk |
|------|---------------------|------|
| `src/claude/commands/isdlc.md` | No automated tests (markdown command file -- tested through integration) | HIGH -- Phase-Loop Controller is untested outside of manual workflow runs. Sizing logic added here has no unit test safety net. |
| `src/claude/hooks/lib/common.cjs` | ~61 tests (common.test.cjs) | LOW -- Well-tested shared library. New functions can follow existing test patterns. |
| `src/claude/hooks/gate-blocker.cjs` | ~26 tests (gate-blocker-ext.test.cjs) | LOW -- Good test coverage. Guard for removed phases needs new test cases. |
| `src/claude/hooks/state-write-validator.cjs` | Tested via spawnSync-based test | MEDIUM -- Custom test setup. Changes need matching test updates. |
| `src/claude/hooks/workflow-completion-enforcer.cjs` | ~22 tests | LOW -- Good coverage. Variable-length phases need new test cases. |
| `src/claude/hooks/phase-sequence-guard.cjs` | ~16 tests (via pre-task-dispatcher tests) | LOW -- No changes expected. |
| `src/claude/hooks/blast-radius-validator.cjs` | No dedicated test file found | MEDIUM -- If changes needed, no existing test infrastructure. |
| `.isdlc/config/workflows.json` | Read by multiple hooks -- tested indirectly | LOW -- JSON config addition. Existing parsers must tolerate new keys. |
| `src/claude/hooks/config/iteration-requirements.json` | Read by gate-blocker -- tested indirectly | LOW -- JSON config. Addition-only. |

### Complexity Hotspots

| Area | Complexity | Concern |
|------|-----------|---------|
| Phase-Loop Controller (isdlc.md STEP 3) | HIGH | The Phase-Loop Controller is ~960 lines of structured markdown with complex step sequencing. Inserting STEP 3e-sizing between 3e and 3f requires careful placement to avoid disrupting the existing flow. The controller uses `current_phase_index` arithmetic that must be correct after phase removal. |
| `applySizingDecision()` state mutation | MEDIUM | Modifying `active_workflow.phases` (array), `active_workflow.phase_status` (object), `phases` (object), and `current_phase_index` (number) atomically. If any of these is inconsistent, subsequent phase delegation will fail or target the wrong phase. |
| `-light` flag parsing in orchestrator | LOW | Flag parsing is a simple string check, but it must be propagated correctly through the init-and-phase-01 response JSON. |
| Sizing UX menu interaction | MEDIUM | The sizing recommendation UX (accept/override/show) must block the Phase-Loop Controller until the user responds. This is similar to the existing backlog picker pattern but occurs mid-workflow instead of at init time. |
| Impact Analysis output format stability | MEDIUM | `parseSizingFromImpactAnalysis()` depends on a stable markdown format in impact-analysis.md. If the format changes (e.g., different heading levels, table format), the parser breaks. Recommend using the JSON metadata block at the bottom of impact-analysis.md rather than parsing markdown tables. |

### Technical Debt Markers

| Area | Debt | Recommendation |
|------|------|---------------|
| Phase-Loop Controller in isdlc.md | The entire phase loop is a markdown specification, not executable code. Each "step" is interpreted by the LLM agent, making it fragile and hard to unit test. | Accept this debt for now. The sizing logic should follow the same markdown-specification pattern for consistency. Future work could extract the phase loop into executable JS. |
| `no_phase_skipping` rule in workflows.json | The current rule says `"no_phase_skipping": true`. Adaptive sizing contradicts this by removing phases. | Clarify the rule semantics: "no phase skipping" means phases cannot be skipped at runtime by agents, but the framework itself can modify the phase array before runtime based on sizing. Add a comment or rename to `no_agent_phase_skipping`. |
| State schema evolution | `active_workflow` gains a new `sizing` object. No formal schema versioning for state.json. | Document the schema change. The `state-write-validator` already handles unknown fields by allowing them (fail-open for new fields). |
| `collectPhaseSnapshots()` assumes standard phase array | Currently iterates `active_workflow.phases` which is assumed to be the full workflow phases. After sizing, this array may be shorter. | Verify the function handles variable-length arrays gracefully (it should, since it iterates the array as-is). |

### Risk Recommendations Per Acceptance Criterion

| AC | Risk | Recommendation |
|----|------|---------------|
| AC-01 (Parse impact-analysis.md) | MEDIUM | Use JSON metadata block, not markdown parsing. More stable and deterministic. |
| AC-02 (Sizing runs after GATE-02, before Phase 03) | HIGH | Critical timing. Must be placed exactly in the Phase-Loop Controller. Test with manual walkthrough. |
| AC-03 (Deterministic recommendation) | LOW | Pure function with no side effects. Easy to unit test. |
| AC-04, AC-15-18 (Phase array modification) | HIGH | Core state mutation. Requires comprehensive test cases: empty phases, single phase, all phases removed, index recalculation. |
| AC-07 (Configurable thresholds) | LOW | Simple JSON config read. |
| AC-08-10 (UX menu) | MEDIUM | Interactive UX mid-workflow. Must handle user cancellation gracefully. |
| AC-11, AC-24 (State tracking) | LOW | Standard state.json write pattern. |
| AC-12-14 (-light flag) | LOW | Simple flag propagation. |
| AC-25 (History preservation) | LOW | Extension of existing workflow_history pattern. |

### Risk Zones (High-Risk Intersections)

1. **Phase-Loop Controller + Phase Array Modification** (AC-02 + AC-04 + AC-15-18): The most critical intersection. The Phase-Loop Controller's `current_phase_index` must be correctly recalculated after removing phases. If index points to the wrong phase, the workflow delegates to the wrong agent or crashes.

2. **Gate-Blocker + Modified Phase Array** (AC-04 + gate validation): If the gate-blocker encounters a phase that was removed from the workflow, it must not block. Currently the gate-blocker reads `active_workflow.phases` to validate sequence, so this should work if state is updated before gate checks.

3. **Impact Analysis Output + Sizing Parser** (AC-01 + AC-03): The parser must handle all valid impact-analysis.md formats. If a previous run's format differs from the parser's expectations, sizing fails. Recommend a versioned format or fallback defaults.

### Recommended Test Additions BEFORE Implementation

| Test | File | Priority |
|------|------|----------|
| `parseSizingFromImpactAnalysis()` unit tests | `src/claude/hooks/tests/common.test.cjs` | P0 -- Must validate parser against sample impact-analysis.md files |
| `computeSizingRecommendation()` unit tests | `src/claude/hooks/tests/common.test.cjs` | P0 -- Must validate determinism with boundary cases (5 files, 6 files, 20 files, 21 files) |
| `applySizingDecision()` unit tests | `src/claude/hooks/tests/common.test.cjs` | P0 -- Must validate phase array mutation, index recalculation, state consistency |
| Gate-blocker with removed phases | `src/claude/hooks/tests/gate-blocker-ext.test.cjs` | P1 -- New test cases for light intensity workflow |
| Workflow-completion-enforcer with short phases | `src/claude/hooks/tests/workflow-completion-enforcer.test.cjs` | P1 -- Validate snapshot collection with fewer phases |
| Integration test: full light workflow | Manual | P1 -- End-to-end walkthrough of `/isdlc feature -light "small change"` |

---

## Implementation Recommendations

Based on the impact analysis:

1. **Suggested Order**: workflows.json -> common.cjs utilities -> state-write-validator -> orchestrator -> isdlc.md -> gate-blocker -> workflow-completion-enforcer -> impact-analysis-orchestrator -> iteration-requirements.json -> blast-radius-validator (see Entry Points section for full rationale)

2. **High-Risk Areas** (add tests first):
   - `applySizingDecision()` -- phase array mutation with index recalculation (P0 tests)
   - `parseSizingFromImpactAnalysis()` -- format-dependent parser (P0 tests)
   - Phase-Loop Controller STEP 3e-sizing integration -- manual walkthrough required
   - Gate-blocker behavior with modified phase arrays (P1 tests)

3. **Dependencies to Resolve**:
   - Impact analysis output format must be stabilized before parser is written. Consider adding a JSON metadata section to impact-analysis.md with structured fields.
   - The `no_phase_skipping` rule in workflows.json needs a semantic clarification: agent-level skipping is still blocked, but framework-level sizing-based removal is allowed.
   - `state-write-validator.cjs` must allow the new `sizing` field before any other changes that write it.

4. **Key Design Decisions Needed in Architecture Phase**:
   - Should sizing logic live entirely in isdlc.md (markdown specification) or partially in common.cjs (executable JS)? Recommendation: pure functions in common.cjs, orchestration in isdlc.md.
   - Should impact-analysis.md include a structured JSON metadata block for sizing, or should the parser handle free-form markdown? Recommendation: JSON metadata block for reliability.
   - How should epic intensity recommendation work without execution? Recommendation: display recommendation message, then proceed with standard intensity.

---

## Affected Files Summary

### Files Requiring Direct Modification

| # | File | Change Type | Module |
|---|------|-------------|--------|
| 1 | `src/claude/commands/isdlc.md` | MODIFY | commands |
| 2 | `.isdlc/config/workflows.json` | MODIFY | config |
| 3 | `src/claude/agents/00-sdlc-orchestrator.md` | MODIFY | agents |
| 4 | `src/claude/hooks/lib/common.cjs` | MODIFY | hooks/lib |
| 5 | `src/claude/hooks/state-write-validator.cjs` | MODIFY | hooks |
| 6 | `src/claude/hooks/gate-blocker.cjs` | MODIFY | hooks |
| 7 | `src/claude/hooks/workflow-completion-enforcer.cjs` | MODIFY | hooks |
| 8 | `src/claude/hooks/config/iteration-requirements.json` | MODIFY | config |
| 9 | `src/claude/agents/impact-analysis/impact-analysis-orchestrator.md` | MODIFY | agents |
| 10 | `src/claude/hooks/blast-radius-validator.cjs` | VERIFY | hooks |

### Files Requiring New Test Cases

| # | Test File | For |
|---|-----------|-----|
| 1 | `src/claude/hooks/tests/common.test.cjs` | parseSizingFromImpactAnalysis, computeSizingRecommendation, applySizingDecision |
| 2 | `src/claude/hooks/tests/gate-blocker-ext.test.cjs` | Light intensity phase removal scenarios |
| 3 | `src/claude/hooks/tests/workflow-completion-enforcer.test.cjs` | Variable-length phase array snapshots |

### Files Confirmed No Change Needed

| # | File | Reason |
|---|------|--------|
| 1 | `src/claude/hooks/phase-sequence-guard.cjs` | Reads current_phase from state -- state is updated before delegation |
| 2 | `src/claude/hooks/phase-loop-controller.cjs` | Reads phase status -- sizing updates state before any delegation |
| 3 | `src/claude/hooks/phase-transition-enforcer.cjs` | Observational only -- no logic depends on phase array shape |
| 4 | `src/claude/hooks/delegation-gate.cjs` | Validates agent delegation -- unaffected by phase array changes |
| 5 | `src/claude/hooks/skill-delegation-enforcer.cjs` | Validates skill ownership -- unaffected |
| 6 | `src/claude/hooks/constitution-validator.cjs` | Validates articles -- unaffected |
| 7 | `src/claude/hooks/iteration-corridor.cjs` | Tracks iteration counts -- unaffected |
| 8 | `src/claude/hooks/branch-guard.cjs` | Validates branch naming -- unaffected |

---

## Impact Analysis Metadata

```json
{
  "analysis_completed_at": "2026-02-12T00:00:00Z",
  "sub_agents": ["M1-impact-analyzer", "M2-entry-point-finder", "M3-risk-assessor"],
  "requirements_document": "docs/requirements/REQ-0011-adaptive-workflow-sizing/requirements-spec.md",
  "quick_scan_used": null,
  "scope_change_from_original": "refined",
  "requirements_keywords": ["sizing", "decision-point", "intensity", "light", "standard", "epic", "phase-array", "light-flag", "state-tracking", "thresholds", "UX", "override"],
  "files_directly_affected": 10,
  "files_transitively_affected": 8,
  "modules_affected": 5,
  "blast_radius": "medium",
  "risk_level": "medium",
  "acceptance_criteria_count": 25,
  "in_scope_criteria": 22,
  "future_criteria": 3
}
```
