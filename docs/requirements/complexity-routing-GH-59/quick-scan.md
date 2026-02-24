# Quick Scan: Complexity-Based Routing (GH-59)

**Generated**: 2026-02-19T22:34:00Z
**Feature**: Phase 00 recommends workflow tier including "trivial" direct-edit path. Quick scan produces a `recommended_tier`. Tiers: trivial (1-2 files, direct edit), light (3-8 files), standard (9-20 files), epic (20+ files). Trivial tier has no workflow/branches/gates but still records changes in requirements folder.
**Phase**: 00-quick-scan
**Mode**: ANALYSIS (no state.json, no branches)

---

## Scope Estimate

**Estimated Scope**: LARGE
**File Count Estimate**: ~28-35 files
**Confidence**: MEDIUM

**Rationale**: This feature introduces a new workflow subsystem that spans Phase 00 (quick scan tier recommendation), Phase 01 (requirements), and extends into the build/analyze verb handlers (orchestrator). The complexity comes from:
1. New tier-scoring algorithm in Phase 00
2. Updates to analyze and build verb handlers to display/present tier recommendations
3. Trivial tier execution path (direct edits with requirements folder recording)
4. Meta.json schema extension
5. State.json validation updates
6. Comprehensive test coverage for all tier combinations

---

## Keyword Matches

### Domain Keywords

| Keyword | File Matches | Concentration | Key Locations |
|---------|--------------|---|---|
| tier | 41 files | High | `isdlc.md`, orchestrator, requirements |
| trivial | 3 files | Low | Primarily in draft.md/backlog; needs implementation |
| complexity | 112 files | Very High | Architecture, design, impact analysis agents |
| routing | 93 files | High | Command routing, orchestrator, dispatcher |
| recommended | 54 files | Medium | Agent recommendations, UI prompts |
| scope | 287 files | Very High | Quick-scan agent, impact analysis, test strategy |

### Technical Keywords

| Keyword | File Matches | Concentration | Key Locations |
|---------|--------------|---|---|
| quick-scan | 101 files | High | Phase 00 agent, gate checklist, tests |
| analyze | 205 files | Very High | Verb handler, orchestrator, all agents |
| build | 345 files | Very High | Verb handler, CLI, orchestrator, tests |
| meta.json | 75 files | High | Requirements folder, three-verb-utils, validators |
| estimate | 71 files | High | Scope estimation, quick-scan agent |
| light | 109 files | Very High | -light flag, debate mode, workflow intensity |

---

## Relevant Modules & Dependencies

### Core Modules (Must Modify)

| Module | File(s) | Lines | Impact | Risk |
|--------|---------|-------|--------|------|
| **Phase 00 Agent** | `quick-scan-agent.md` | 317 | Tier scoring algorithm | MED |
| **isdlc.md** (analyze handler) | `src/claude/commands/isdlc.md` | ~500 (step 8 section) | Display recommended tier at completion | MED |
| **isdlc.md** (build handler) | `src/claude/commands/isdlc.md` | ~400 (step 4a section) | Present tier menu, execute trivial tier | HIGH |
| **Tier Scoring** | `three-verb-utils.cjs` (new functions) | ~100-150 lines | `computeRecommendedTier()`, `scoreTierBySize()` | MED |
| **Meta.json Schema** | Multiple `meta.json` files | Schema change | Add `recommended_tier` field | LOW |

### Supporting Modules (Likely Affected)

| Module | File(s) | Purpose | Modification Scope |
|--------|---------|---------|---|
| **State Utilities** | `common.cjs` | State field validation | Add tier field handling |
| **Trivial Tier Path** | New subsystem | Direct edit + requirements recording | ~150-200 lines new code |
| **Test Coverage** | 72 test suites | Verify tier logic across workflows | 15-20 new test cases |
| **Gate Validators** | `gate-blocker.cjs` | Phase gate validation | Possibly add tier-specific gates |
| **Dispatchers** | 5 dispatcher files | Command routing | No changes expected |

---

## Affected File Inventory

### Quick Scan Results (28-35 files estimated)

**Tier 1: Core Implementation (8-10 files)**
```
src/claude/agents/quick-scan/quick-scan-agent.md      (modify: add tier scoring)
src/claude/commands/isdlc.md                           (modify: analyze step 8 + build step 4a)
src/claude/agents/00-sdlc-orchestrator.md              (reference: no changes, uses isdlc.md)
src/claude/hooks/lib/three-verb-utils.cjs              (add: tier scoring functions)
src/claude/hooks/lib/common.cjs                        (add: state tier field handling)
src/claude/hooks/gate-blocker.cjs                      (possibly: tier-aware gate logic)
docs/requirements/*/meta.json                          (all: schema extension)
lib/trivial-tier-executor.js                           (NEW: trivial tier execution)
```

**Tier 2: Test Coverage (15-20 files)**
```
src/claude/hooks/tests/test-three-verb-utils.test.cjs (new tier scoring tests)
src/claude/hooks/tests/state-write-validator.test.cjs (state.json tier field)
src/claude/hooks/tests/gate-blocker.test.cjs           (tier-aware gate validation)
src/claude/agents/quick-scan/quick-scan-agent.test.md (Phase 00 tier output)
Integration tests: analyze/build handlers with tiers
```

**Tier 3: Indirect/No-Change Files (5-7 files)**
```
src/claude/agents/01-requirements-analyst.md           (no change: consumes tier from meta.json)
src/claude/hooks/tests/cross-hook-integration.test.cjs (extend: tier integration scenarios)
.isdlc/state.json                                      (schema: add tier field)
BACKLOG.md                                             (no structural change)
```

---

## Cross-Module Dependencies

### Strong Dependencies (Must Coordinate)

1. **quick-scan-agent.md → meta.json**
   - Phase 00 produces `recommended_tier` field in meta.json
   - Downstream: analyze and build handlers read this field

2. **isdlc.md (analyze handler) → quick-scan-agent**
   - Step 8 displays the `recommended_tier` from Phase 00 output
   - No workflow state needed (analysis mode)

3. **isdlc.md (build handler) → meta.json + trivial-tier-executor**
   - Step 4a reads `recommended_tier` from meta.json
   - Presents tier menu, routes to appropriate handler
   - Trivial tier: calls new trivial-tier-executor.js

4. **three-verb-utils.cjs → common.cjs**
   - Tier scoring functions may use state utilities for validation

### Weak Dependencies (Can Change in Isolation)

- Gate validators (gate-blocker.cjs) — tier-aware validation is optional enhancement
- Orchestrator (00-sdlc-orchestrator.md) — no changes, just uses isdlc.md verbs

---

## Key Code Locations & Patterns

### Phase 00 Tier Recommendation
- **File**: `src/claude/agents/quick-scan/quick-scan-agent.md`
- **Section**: Step 3 (Estimate Scope) — extend to compute tier
- **New logic**:
  ```
  IF file_count <= 2: tier = "trivial"
  ELSE IF file_count <= 8: tier = "light"
  ELSE IF file_count <= 20: tier = "standard"
  ELSE: tier = "epic"
  ```
- **Output**: Add `recommended_tier` to quick-scan.md JSON metadata block

### Analyze Handler Step 8 (Display Tier)
- **File**: `src/claude/commands/isdlc.md`
- **Section**: "analyze" action, step 8
- **New output**: "Recommended tier: {tier} — [brief description]"

### Build Handler Step 4a (Present Tier Menu)
- **File**: `src/claude/commands/isdlc.md`
- **Section**: "build" action, step 4a
- **New logic**:
  ```
  Display menu:
  [1] Trivial (direct edit, no workflow) — RECOMMENDED
  [2] Light (3-8 files, skip design)
  [3] Standard (9-20 files, full workflow)
  [4] Epic (20+ files, with decomposition)

  Default selection: recommended_tier
  ```

### Trivial Tier Execution
- **File**: NEW `lib/trivial-tier-executor.js`
- **Purpose**: Direct edit without workflow machinery
- **Requirements**:
  - Make the edit directly
  - Create/update `docs/requirements/{slug}/` with change record
  - Record: what changed, why, files modified, commit SHA
  - Preserve audit trail without full workflow

### Meta.json Schema Extension
- **File**: All `docs/requirements/*/meta.json`
- **Schema change**: Add field
  ```json
  "recommended_tier": "string (trivial|light|standard|epic)"
  ```
- **Backward compatibility**: Optional field, defaults to "standard" if missing

---

## Tier Scoring Algorithm

### File Count Thresholds
```
Files changed  →  Tier
─────────────────────────
1-2            →  trivial
3-8            →  light
9-20           →  standard
20+            →  epic
```

### Additional Scoring Factors (Possible Enhancements, Phase 02)
- Cross-module dependencies: increase tier
- Architectural impact: increase tier
- Critical path code: increase tier
- Schema/API changes: increase tier
- (Phase 02 Impact Analysis can refine these factors)

---

## Questions for Requirements Analyst

The following questions may help clarify scope during Phase 01:

1. **Trivial Tier Execution**: Should the framework make direct edits for trivial changes, or always present the edit to the user for confirmation? (Current spec: framework makes edit directly)

2. **Requirements Folder Recording**: What should the lightweight change record contain for trivial edits? Just the summary, or full before/after diffs?

3. **Tier Adjustment**: Can users override the recommended tier after Phase 00? (Current spec: framework recommends, user decides at build time)

4. **Tier Refinement in Phase 02**: Should the Impact Analysis phase allow tier re-evaluation if the scope grows? (Likely yes for standard/epic, but affects workflow branch points)

5. **Trivial Tier Integration**: Should trivial edits still create a commit to main, or just a local change record?

6. **Debate Mode**: Should trivial tier always disable debate mode? (Likely yes given 1-2 file scope)

7. **Gate Behavior**: Should trivial tier skip ALL gates or only skip constitutional validation? (Likely skips all per current spec)

---

## Impact Summary

### Scope Classification: **LARGE** (25-35 affected files)

- **Core implementation**: 8-10 files (quick-scan agent, isdlc.md, utilities)
- **Testing**: 15-20 files (tier scoring, state validation, integration)
- **Indirect**: 5-7 files (no-change references, schema propagation)

### Complexity Classification: **MEDIUM-HIGH**

- New subsystem: trivial-tier execution path
- Schema extension: meta.json + state.json
- UI changes: tier menu presentation in build handler
- Coordination: analyze handler step 8 + build handler step 4a
- Risk: Trivial tier bypass logic requires careful audit trail

### Effort Estimate (Full Workflow Phases 00-05)

| Phase | Estimate | Notes |
|-------|----------|-------|
| 00 - Quick Scan | 4-6 hours | This scan output |
| 01 - Requirements | 6-8 hours | Clarify tier UX, trivial execution details |
| 02 - Impact Analysis | 8-10 hours | Identify all test scenarios, refinement logic |
| 03 - Architecture | 6-8 hours | Trivial tier subsystem design |
| 04 - Design | 4-6 hours | Change record schema, tier menu UX |
| 05 - Implementation | 16-20 hours | 8-10 core files + 15-20 tests |

**Total**: 44-58 hours (1-1.5 weeks)

---

## Risk Assessment

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|---|
| Trivial tier bypass skips important guards | MED | HIGH | Comprehensive test coverage, audit trail verification |
| Meta.json schema migration | LOW | MED | Backward compatibility, lazy field initialization |
| Tier menu UI mismatch between analyze + build | MED | LOW | Consistent tier descriptions, single source of truth |
| Trivial execution creates untracked state | LOW | HIGH | Requires folder + commit record, test thoroughness |

### Requirements Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|---|
| Unclear "trivial" scope in practice | MED | MED | Phase 01 requirements clarification + user feedback loops |
| Users bypass trivial tier despite recommendation | HIGH | LOW | Design framework recommendation as first-class option |
| Tier adjustment after Phase 02 causes branch churn | MED | MED | Design tier decisions as commit points (no backtrack) |

---

## Quick Scan Metadata

```json
{
  "scan_completed_at": "2026-02-19T22:34:00Z",
  "search_duration_ms": 45000,
  "keywords_searched": 14,
  "keywords_with_matches": 14,
  "files_matched_total": 1847,
  "estimated_affected_files": 28,
  "estimated_scope": "LARGE",
  "scope_rationale": "New subsystem (trivial-tier execution) + tier recommendation algorithm + isdlc.md handler updates + meta.json schema extension + comprehensive test coverage",
  "confidence_level": "medium",
  "confidence_notes": "Feature design is clear from draft.md; implementation scope requires Phase 01 clarification on trivial tier execution details and tier adjustment logic.",
  "discovery_integration": "Scanned existing codebase for tier/complexity patterns; found no existing trivial-tier implementation, confirming this is new work",
  "next_phase_focus": "Phase 01 Requirements should clarify: (1) trivial execution details, (2) tier override behavior, (3) change record schema, (4) gate bypass implications"
}
```

---

## Summary

**Complexity-Based Routing (GH-59)** is a **LARGE feature** affecting 28-35 files across the framework. The core innovation is **tier-based workflow routing** with a new **trivial-tier path** for 1-2 file changes.

### Key Components

1. **Phase 00 Recommendation**: Quick scan produces `recommended_tier` (trivial|light|standard|epic) based on file count
2. **Analyze Handler Update**: Step 8 displays the recommendation
3. **Build Handler Update**: Step 4a presents tier menu, defaults to recommended
4. **Trivial Tier Execution**: New subsystem makes direct edits + records change in requirements folder
5. **Meta.json Extension**: Stores `recommended_tier` for downstream consumption

### Technical Complexity

- New tier-scoring algorithm (moderate)
- Trivial tier execution path (new subsystem, HIGH risk for audit trail)
- Schema extension + migration (LOW complexity)
- Comprehensive test coverage (15-20 test cases)

### Recommended Next Steps

1. **Phase 01**: Clarify tier decision logic, trivial execution behavior, change record schema
2. **Phase 02**: Impact analysis to identify all test scenarios and tier refinement points
3. **Phase 03**: Architecture the trivial-tier executor and change recording subsystem
4. **Phase 04**: Design tier menu UI and meta.json persistence
5. **Phase 05**: Implement core + tests in parallel

Estimated total effort: **1-1.5 weeks** (44-58 hours)
