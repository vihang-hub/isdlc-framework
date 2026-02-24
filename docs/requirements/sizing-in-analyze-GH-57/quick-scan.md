# Quick Scan: Add sizing decision to analyze verb

**Generated**: 2026-02-19T22:15:00Z
**Feature**: GH-57 — Add sizing decision to the analyze verb — skip architecture/design for trivial changes
**Phase**: 00-quick-scan
**Mode**: ANALYSIS MODE (no state.json, no branches)

---

## Scope Estimate

**Estimated Scope**: MEDIUM
**Estimated File Count**: ~13-18 files
**Confidence**: MEDIUM

**Rationale**:
This feature requires changes to analyze workflow flow (isdlc.md), meta.json handling (three-verb-utils.cjs), sizing logic (common.cjs), and partial updates to design phase agents. The core logic already exists in build workflow (STEP 3e-sizing); analyze must integrate similar decisions but in a stateless context. No new workflow machinery required, but schema changes and decision branching needed.

---

## Keyword Matches

### Domain Keywords
| Keyword | Matches | Notes |
|---------|---------|-------|
| analyze | 15+ files | Verb handler in isdlc.md, Quick Scan agent, test files |
| sizing | 3 files | common.cjs (applySizingDecision), sizing-consent.test.cjs, isdlc.md (STEP 3e) |
| meta.json | 2 files | three-verb-utils.cjs (readMetaJson, writeMetaJson), common.cjs |
| phases_completed | 2 files | three-verb-utils.cjs (validation, derivation), common.cjs |
| light_skip_phases | 1 file | isdlc.md (STEP 3e-sizing only, build context) |
| analysis_status | 3 files | three-verb-utils.cjs (deriveAnalysisStatus), common.cjs, isdlc.md |

### Technical Keywords
| Keyword | Matches | Notes |
|---------|---------|-------|
| computeStartPhase | 1 file | three-verb-utils.cjs (already supports phase skipping) |
| deriveAnalysisStatus | 2 files | three-verb-utils.cjs (definition), isdlc.md (analyze handler) |
| ANALYSIS_PHASES | 2 files | three-verb-utils.cjs (constant: 00-04), isdlc.md |
| Task tool delegation | 1 file | isdlc.md (steps 7a-h for phase execution) |
| -light flag | 1 file | isdlc.md (STEP 3e-sizing, build context only) |

---

## Affected Modules

Based on codebase search and feature description:

### MUST MODIFY (Core Logic)

1. **src/claude/commands/isdlc.md** (PRIMARY)
   - **analyze verb handler** (lines 563-600):
     - Add sizing decision point AFTER Phase 02 Impact Analysis completes
     - Present sizing menu (light/standard/epic)
     - Update phases_completed record with sizing intent
     - Record sizing decision in meta.json
   - **build verb handler** (lines 604-730):
     - Minor: read sizing from meta.json if present
     - No changes to STEP 3e logic (build-side already done)

2. **src/claude/hooks/lib/three-verb-utils.cjs** (CORE UTILITIES)
   - **readMetaJson()** (lines 199-244):
     - Add handling for `sizing_decision` field (when present)
   - **writeMetaJson()** (lines 259-275):
     - Preserve `sizing_decision` field when writing
   - **deriveAnalysisStatus()** (lines 151-163):
     - Must distinguish: intentionally-skipped phases (03/04 by sizing) vs incomplete phases
     - If phases 03/04 missing BUT sizing.decision === 'light': return 'analyzed' (not 'partial')
   - **computeStartPhase()** (lines 351-414):
     - Handle start case when 03/04 are skipped by sizing (not missing)

3. **src/claude/hooks/lib/common.cjs** (SIZING LOGIC)
   - **applySizingDecision()** function (new parameters):
     - Extend to support `analyze` mode (no state.json write context)
     - Support recording intent in meta.json for build-time use
   - Add helper function to parse/format sizing decision in meta schema

### SHOULD MODIFY (Affected Workflows)

4. **src/claude/agents/quick-scan/quick-scan-agent.md**
   - Add note: "If this is a small/trivial change, analyze workflow may offer sizing decision after Phase 02"

5. **src/claude/agents/impact-analysis/impact-analyzer.md**
   - Add note: "Impact analysis may be final phase if sizing 'light' is accepted"
   - No logic change; documentation only

6. **src/claude/agents/03-system-designer.md** (Phase 03)
   - Add check: "If meta.sizing_decision === 'light': skip this phase, record as intentionally skipped"
   - OR: detect in orchestrator and don't delegate to this phase

7. **src/claude/agents/impact-analysis/cross-validation-verifier.md**
   - May need to check sizing decision before validating architecture scope

### TESTING

8. **src/claude/hooks/tests/sizing-consent.test.cjs**
   - Add test cases for analyze-mode sizing (meta.json-only writes)
   - Test deriveAnalysisStatus with skipped phases

### WORKFLOWS CONFIG

9. **src/claude/hooks/config/workflows.json** (Schema)
   - Verify `workflows.feature.sizing` schema supports:
     - `light_skip_phases`: ["03-architecture", "04-design"]
     - (Already present per isdlc.md STEP 3e references)

### DOCUMENTATION

10. **src/claude/CLAUDE.md.template**
   - Note: analyze verb now offers sizing after Phase 02

---

## Key Code Locations

### Analyze Workflow Flow (isdlc.md)
**Lines 563-600**: Current analyze handler
**Required addition**: After Phase 02 completes (post-step 6), insert sizing decision point

### Sizing Decision Logic (isdlc.md)
**Lines 1461-1600** (STEP 3e-sizing): Build-side sizing implementation
**Required addition**: Extract sizing logic into shared helper, invoke from analyze context

### Meta.json Handling (three-verb-utils.cjs)
**Lines 199-275**: readMetaJson / writeMetaJson
**Required addition**: Extend schema to store `sizing_decision` field

### Analysis Status Derivation (three-verb-utils.cjs)
**Lines 140-163**: deriveAnalysisStatus function
**Required change**: Account for intentionally-skipped phases (light sizing)

### Start Phase Computation (three-verb-utils.cjs)
**Lines 331-414**: computeStartPhase function
**Required change**: Handle case where phases 03/04 are missing due to sizing (not incomplete)

---

## Estimated Changes by Type

| Category | Count | Notes |
|----------|-------|-------|
| Core logic files | 3 | isdlc.md, three-verb-utils.cjs, common.cjs |
| Agent/phase files | 5 | Quick Scan, Impact Analyzer, System Designer, Cross-Validation, Design Refiner |
| Test files | 1 | sizing-consent.test.cjs |
| Config files | 1 | workflows.json (schema validation) |
| Documentation | 1 | CLAUDE.md.template |
| **Total** | **11-18** | Range due to uncertainty in Phase 03/04 handling pattern |

---

## Design Complexity

### Moderate (Medium Scope)

**Straightforward aspects:**
- Sizing menu rendering already exists (copy from STEP 3e)
- meta.json read/write already supported
- analyze handler already delegates to phase agents

**Tricky aspects:**
- **Stateless context**: Analyze has no state.json. Must store sizing decision in meta.json only
- **Analysis status derivation**: Must distinguish "light-skipped" phases from "incomplete" phases for accurate status reporting
- **Build-side recognition**: When build later runs, must recognize that 03/04 are intentionally skipped (not missing due to staleness)
- **computeStartPhase refactoring**: Must handle new case where valid.length < ANALYSIS_PHASES.length BUT phases are intentionally skipped

**Risk factors:**
- **Medium-Low**: meta.json schema change (additive, backward-compatible)
- **Medium-Low**: deriveAnalysisStatus change (scope expansion, requires test coverage)
- **Low**: Sizing menu integration (existing logic, different context)
- **Low**: Phase skipping (orchestrator already supports delegation model)

---

## Questions for Requirements Gathering

1. **Timing**: Should sizing menu appear after Phase 02 completes, or earlier (after Phase 01)?
   - Draft says "after Phase 02" — is this firm?

2. **Schema**: Should meta.json store the full sizing decision object (intensity, reason, timestamp)?
   - Or just a boolean flag (light_skipped: true)?

3. **Build interaction**: When build runs later and sees phases 03/04 intentionally skipped, should it:
   - (a) Skip directly to implementation (test-strategy)?
   - (b) Offer user the chance to "redo" architecture/design?
   - (c) Just proceed silently (use build's normal partial-analysis flow)?

4. **User confirmation**: After offering sizing in analyze, if user declines "light":
   - Should analyze continue with phases 03/04?
   - Or should user get another menu (standard/epic)?

5. **Flag behavior**: `-light` flag on analyze:
   - Should it auto-accept light recommendation without menu?
   - Or present menu with "light recommended" banner?

6. **Backwards compatibility**: For existing meta.json files (no sizing_decision field):
   - Should deriveAnalysisStatus treat missing field as "standard assumed"?

---

## Dependencies & Constraints

- **Dependency**: Phase 02 (Impact Analysis) agent must complete for sizing decision to appear
- **Dependency**: Sizing config in workflows.json must exist (light_skip_phases array)
- **Constraint**: No state.json writes (NFR-002: analyze is stateless)
- **Constraint**: Sizing decision must survive to build phase (stored in meta.json)
- **Constraint**: Backward compatible with existing meta.json files (no sizing_decision field)

---

## Discovery References

Based on discovery artifacts in `/Users/vihang/projects/isdlc/isdlc-framework/`:

**Tech Stack**: Node.js, CommonJS modules, markdown-based agents
**Architecture**: Hook-based enforcement, phase-agent delegation model
**Key Patterns**:
- Utility functions exported from `three-verb-utils.cjs` for cross-phase reuse
- Meta.json as single source of truth for item analysis state (no centralized state.json in analyze)
- BACKLOG.md marker updates for progress tracking

---

## Quick Scan Metadata

```json
{
  "scan_completed_at": "2026-02-19T22:15:00Z",
  "search_duration_ms": 45000,
  "keywords_searched": 12,
  "files_matched": 18,
  "scope_estimate": "MEDIUM",
  "affected_file_count": 13,
  "risk_level": "low-to-medium",
  "modules_affected": [
    "analyze_verb_handler",
    "sizing_decision_point",
    "meta_json_schema",
    "analysis_status_derivation",
    "phase_skipping_logic"
  ],
  "key_locations": {
    "analyze_handler": "src/claude/commands/isdlc.md:563-600",
    "sizing_logic": "src/claude/commands/isdlc.md:1461-1600",
    "meta_utilities": "src/claude/hooks/lib/three-verb-utils.cjs:199-275",
    "analysis_status": "src/claude/hooks/lib/three-verb-utils.cjs:140-163",
    "compute_start_phase": "src/claude/hooks/lib/three-verb-utils.cjs:331-414"
  }
}
```

---

## Next Steps (Phase 01)

Requirements gathering will clarify:
1. Exact positioning of sizing menu in analyze flow
2. meta.json schema for sizing_decision storage
3. Interaction between analyze-side sizing and build-side recognition
4. User experience for flag-based shortcuts (-light on analyze)
5. Backwards compatibility strategy for existing meta.json files
