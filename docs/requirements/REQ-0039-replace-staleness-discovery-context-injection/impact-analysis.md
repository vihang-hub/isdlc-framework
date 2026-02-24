# Impact Analysis: Replace 24h Staleness Discovery Context Injection with Project Skills

**Generated**: 2026-02-25T01:30:00Z
**Feature**: Replace 24h staleness discovery context injection with project skills (#90)
**Based On**: Phase 01 Requirements (finalized) -- requirements-spec.md
**Phase**: 02-impact-analysis

---

## Scope Comparison

| Aspect | Original (Phase 00) | Clarified (Phase 01) |
|--------|---------------------|----------------------|
| Description | Remove legacy discovery context injection from STEP 3d, update agent docs | Replace 24h staleness discovery context injection with project skills (6 FRs, 14 ACs) |
| Keywords | discovery_context, DISCOVERY CONTEXT, staleness, 24h | discovery_context, DISCOVERY CONTEXT, DISCOVERY_CONTEXT, staleness, 24h, envelope, audit-only, fail-open |
| Estimated Files | ~11 files | 14 files (11 original + 3 newly identified) |
| Scope Change | - | REFINED -- same core scope but 3 additional files discovered during deep analysis |

---

## Executive Summary

This is a **medium-scope refactoring** that removes the legacy `discovery_context` injection mechanism from the phase delegation pipeline in `isdlc.md` STEP 3d. The change affects 14 files across 4 tiers: 2 primary edit targets (isdlc.md, discover-orchestrator.md), 4 secondary agent files requiring documentation updates, 5 infrastructure/hook files, and 3 newly discovered files (roundtable-analyst.md, party-personas.json, test-session-cache-builder.test.cjs) that reference `DISCOVERY_CONTEXT` in different contexts. The risk is LOW because all changes are removals or documentation clarifications -- no new functionality is introduced. The fail-open design ensures backward compatibility for all project states.

**Blast Radius**: MEDIUM (14 files, 5 modules)
**Risk Level**: LOW
**Affected Files**: 14
**Affected Modules**: commands (2), agents (6), hooks (3), hooks/tests (2), agents/discover (1)

---

## Impact Analysis

### M1: Files Directly Affected by Each Acceptance Criterion

#### FR-001: Remove Discovery Context Injection Block (AC-001-01 through AC-001-03)

| File | Line(s) | Reference Type | Action Required |
|------|---------|---------------|-----------------|
| `src/claude/commands/isdlc.md` | 1566 | Primary injection block | **REMOVE** -- entire discovery context paragraph including session cache check and state.json fallback |
| `src/claude/commands/isdlc.md` | 1619 | STEP C assembly reference | **UPDATE** -- remove "after DISCOVERY CONTEXT" from comment, change to "after WORKFLOW MODIFIERS" |

#### FR-002: Update Delegation Prompt Template (AC-002-01 through AC-002-02)

| File | Line(s) | Reference Type | Action Required |
|------|---------|---------------|-----------------|
| `src/claude/commands/isdlc.md` | 1794 | Template placeholder | **REMOVE** -- `{DISCOVERY CONTEXT: ... -- if phase 02 or 03}` line from delegation template |
| `src/claude/commands/isdlc.md` | 1619 | STEP C positioning | **UPDATE** -- skill blocks positioned after WORKFLOW MODIFIERS (not after non-existent DISCOVERY CONTEXT) |

#### FR-003: Deprecate discovery_context Envelope to Audit-Only (AC-003-01 through AC-003-03)

| File | Line(s) | Reference Type | Action Required |
|------|---------|---------------|-----------------|
| `src/claude/agents/discover-orchestrator.md` | 668-680 | Envelope documentation (sequential mode) | **UPDATE** -- add "audit-only" designation, remove "enables seamless handover" claim, clarify not consumed during phase delegation |
| `src/claude/agents/discover-orchestrator.md` | 1175 | Phase 5 envelope reference | **UPDATE** -- add audit-only qualifier |
| `src/claude/agents/discover-orchestrator.md` | 1191-1194 | Walkthrough mode envelope writing | **UPDATE** -- add audit-only qualifier, "SAME schema" note is fine |
| `src/claude/agents/discover-orchestrator.md` | 2539 | User next action recording | **NO CHANGE** -- writes `user_next_action` sub-field; audit data, fine as-is |
| `src/claude/agents/discover-orchestrator.md` | 2567-2575 | Walkthrough envelope writing (second instance) | **UPDATE** -- add audit-only designation, remove "enables seamless handover" |

#### FR-004: Update Phase Agent Documentation (AC-004-01)

| File | Line(s) | Reference Type | Action Required |
|------|---------|---------------|-----------------|
| `src/claude/agents/00-sdlc-orchestrator.md` | 880-903 | DISCOVERY CONTEXT INJECTION section with 4-tier fallback and 24h staleness | **REWRITE** -- replace with skill-based delivery description, remove 24h staleness tiers, remove envelope fields injection template |
| `src/claude/agents/00-sdlc-orchestrator.md` | 907-912 | Agent Delegation Table (3 rows reference DISCOVERY CONTEXT) | **UPDATE** -- remove "DISCOVERY CONTEXT (above)" from Inputs column for phases 01, 02, 03 |
| `src/claude/agents/00-sdlc-orchestrator.md` | 955 | Conversational Opening step 2 | **UPDATE** -- remove "READ discovery_context from state.json (if available and < 24h old)" |
| `src/claude/agents/01-requirements-analyst.md` | 45 | Conversational Opening step 2 | **UPDATE** -- remove "READ discovery_context from state.json (if available and < 24h old)" |
| `src/claude/agents/01-requirements-analyst.md` | 231-271 | PRE-PHASE CHECK section | **UPDATE** -- clarify that project knowledge is delivered via AVAILABLE SKILLS, not legacy block |
| `src/claude/agents/02-solution-architect.md` | 105-154 | PRE-PHASE CHECK section | **UPDATE** -- remove line 114 reference to "DISCOVERY CONTEXT block in delegation prompt", clarify skill-based delivery |
| `src/claude/agents/03-system-designer.md` | 103-154 | PRE-PHASE CHECK section | **UPDATE** -- remove line 112 reference to "DISCOVERY CONTEXT block in delegation prompt", clarify skill-based delivery |

#### FR-005: Fail-Open Backward Compatibility (AC-005-01, AC-005-02)

No file changes required. The removal of injection logic is inherently fail-open -- if the block is not injected, nothing breaks. Verified: no phase agent errors on missing `DISCOVERY CONTEXT` block because agents already have fallback behavior (read from disk if block not present).

#### FR-006: Update Hook/Infrastructure Files (AC-006-01 through AC-006-03)

| File | Line(s) | Reference Type | Action Required |
|------|---------|---------------|-----------------|
| `src/claude/hooks/walkthrough-tracker.cjs` | 64-88 | Reads `discovery_context.walkthrough_completed` | **NO CHANGE** -- reads audit-only field for warning purposes, not for staleness or injection decisions |
| `src/claude/hooks/test-adequacy-blocker.cjs` | 106-110 | Reads `discovery_context.coverage_summary` | **REVIEW** -- reads coverage data from discovery context, not for staleness but for adequacy checking. Confirm this is acceptable as audit-adjacent usage |
| `src/claude/hooks/tests/walkthrough-tracker.test.cjs` | 76, 87, 97, 105, 115, 125 | Test fixtures with `discovery_context` | **NO CHANGE** -- test fixtures validate audit/provenance behavior (walkthrough completion tracking), not staleness |

### Newly Discovered Files (Not in Quick Scan)

| File | Line(s) | Reference Type | Action Required |
|------|---------|---------------|-----------------|
| `src/claude/commands/isdlc.md` | 709-759 | Roundtable DISCOVERY_CONTEXT extraction and injection | **SCOPING DECISION NEEDED** -- the roundtable dispatch in STEP 7a extracts `DISCOVERY_CONTEXT` from session cache and passes it to roundtable-analyst. This is a DIFFERENT code path from STEP 3d phase delegation. FR-001 targets STEP 3d only. Recommend: OUT OF SCOPE for this change (separate roundtable refactoring) |
| `src/claude/agents/roundtable-analyst.md` | 62-64 | Parses DISCOVERY_CONTEXT from dispatch prompt | **OUT OF SCOPE** -- downstream consumer of roundtable dispatch, not STEP 3d |
| `src/claude/agents/discover/party-personas.json` | 153 | `"output": "discovery_context"` | **NO CHANGE** -- describes output target of the discover party, metadata only |
| `src/claude/hooks/tests/test-session-cache-builder.test.cjs` | 981-1006 | TC-BUILD-16: asserts cache does NOT contain DISCOVERY_CONTEXT section | **NO CHANGE** -- validates that session cache builder does not emit DISCOVERY_CONTEXT section. This test should continue to pass (and becomes even more correct after the change) |
| `src/claude/commands/discover.md` | 176 | Envelope documentation reference | **UPDATE** -- add "audit-only" qualifier to handover description |
| `src/claude/commands/tour.md` | 22 | Reads `discovery_context.project_type` | **NO CHANGE** -- reads audit metadata for tour menu highlighting |

### Outward Dependency Map

Files that depend on the affected files (what else could break):

```
isdlc.md (STEP 3d)
  --> ALL phase agents receive delegation prompts from this step
  --> Removing DISCOVERY CONTEXT block affects: 13 phase agents
  --> BUT: All agents already have fail-open behavior for missing context
  --> Risk: NONE (fail-open by design)

isdlc.md (STEP 7a roundtable)
  --> roundtable-analyst.md receives DISCOVERY_CONTEXT field
  --> OUT OF SCOPE (different code path)

discover-orchestrator.md
  --> state.json discovery_context envelope (still written)
  --> walkthrough-tracker.cjs (reads walkthrough_completed)
  --> test-adequacy-blocker.cjs (reads coverage_summary)
  --> tour.md (reads project_type)
  --> Risk: NONE (envelope still written, just documented as audit-only)

00-sdlc-orchestrator.md
  --> This is the orchestrator that reads isdlc.md instructions
  --> Removing the DISCOVERY CONTEXT INJECTION section aligns with isdlc.md changes
  --> Risk: LOW (documentation alignment)
```

### Inward Dependency Map

What the affected files depend on:

```
isdlc.md STEP 3d injection block depends on:
  <-- .isdlc/state.json → discovery_context (to read envelope)
  <-- Session cache → <!-- SECTION: DISCOVERY_CONTEXT --> (to read cached version)
  After removal: Neither dependency exists

Phase agents PRE-PHASE CHECK sections depend on:
  <-- .isdlc/state.json → project.discovery_completed
  <-- docs/project-discovery-report.md
  <-- docs/isdlc/constitution.md
  After update: Same dependencies for direct file reads; DISCOVERY CONTEXT block reference removed
```

---

## Entry Points

### M2: Implementation Entry Points

#### Entry Point 1 (Primary): isdlc.md STEP 3d Discovery Context Injection

**File**: `src/claude/commands/isdlc.md`
**Lines**: 1566 (injection block), 1619 (STEP C reference), 1794 (template placeholder)
**Type**: Removal
**Coupling**: HIGH -- this is the central dispatch point for all phase delegations

**Implementation chain**:
1. Remove line 1566 paragraph (discovery context injection block)
2. Update line 1619 (STEP C assembly -- change "after DISCOVERY CONTEXT" to "after WORKFLOW MODIFIERS")
3. Remove line 1794 `{DISCOVERY CONTEXT: ... -- if phase 02 or 03}` from template

#### Entry Point 2 (Primary): discover-orchestrator.md Envelope Documentation

**File**: `src/claude/agents/discover-orchestrator.md`
**Lines**: 668-680, 1175, 1191-1194, 2567-2575
**Type**: Documentation update
**Coupling**: MEDIUM -- documentation changes only, no behavioral changes

**Implementation chain**:
1. Update line 670 heading to include "Audit-Only" qualifier
2. Add clarification that envelope is NOT consumed during phase delegation
3. Remove "enables seamless handover" language (lines 670, 2569)
4. Remove any 24h expiry/staleness references if present

#### Entry Point 3 (Secondary): 00-sdlc-orchestrator.md Discovery Context Injection Section

**File**: `src/claude/agents/00-sdlc-orchestrator.md`
**Lines**: 880-903
**Type**: Rewrite/removal
**Coupling**: MEDIUM -- the orchestrator's delegation documentation

**Implementation chain**:
1. Replace the "DISCOVERY CONTEXT INJECTION (Phases 01, 02, 03)" section (lines 880-903) with a note that project knowledge is delivered via AVAILABLE SKILLS
2. Update Agent Delegation Table (lines 909-912) to remove "DISCOVERY CONTEXT" from Inputs column
3. Update Conversational Opening (line 955) to remove discovery_context read instruction

#### Entry Point 4 (Secondary): Phase Agent PRE-PHASE CHECK Sections

**Files**: `01-requirements-analyst.md`, `02-solution-architect.md`, `03-system-designer.md`
**Type**: Documentation update
**Coupling**: LOW -- each agent is independently editable

**Implementation chain per agent**:
1. Update PRE-PHASE CHECK section to clarify project skills delivery
2. Remove references to "DISCOVERY CONTEXT block in delegation prompt"
3. Keep the check for `project.discovery_completed` and direct file reads (these are independent of the injection mechanism)

#### Entry Point 5 (Infrastructure): discover.md Envelope Reference

**File**: `src/claude/commands/discover.md`
**Line**: 176
**Type**: Documentation clarification
**Coupling**: LOW

**Implementation chain**:
1. Add "audit-only" qualifier to the context handover description

### New Entry Points Required

None. This change removes functionality; no new entry points are created.

### Recommended Implementation Order

1. **isdlc.md** (Entry Point 1) -- remove the injection block first, as this is the primary behavioral change
2. **00-sdlc-orchestrator.md** (Entry Point 3) -- align orchestrator documentation with isdlc.md changes
3. **discover-orchestrator.md** (Entry Point 2) -- update envelope documentation to audit-only
4. **Phase agents** (Entry Point 4) -- update documentation references in 01, 02, 03
5. **discover.md** (Entry Point 5) -- minor documentation fix
6. **Hooks review** (FR-006) -- verify no changes needed (walkthrough-tracker, test-adequacy-blocker)

---

## Risk Assessment

### M3: Risk Zones and Coverage

#### Test Coverage for Affected Files

| File | Test Coverage | Risk |
|------|--------------|------|
| `src/claude/commands/isdlc.md` | No direct tests (markdown agent instructions) | LOW -- changes are removals, validated by manual walkthrough |
| `src/claude/agents/discover-orchestrator.md` | No direct tests (markdown agent instructions) | LOW -- documentation changes only |
| `src/claude/agents/00-sdlc-orchestrator.md` | No direct tests (markdown agent instructions) | LOW -- documentation changes only |
| `src/claude/agents/01-requirements-analyst.md` | No direct tests (markdown agent instructions) | LOW -- documentation changes only |
| `src/claude/agents/02-solution-architect.md` | No direct tests (markdown agent instructions) | LOW -- documentation changes only |
| `src/claude/agents/03-system-designer.md` | No direct tests (markdown agent instructions) | LOW -- documentation changes only |
| `src/claude/hooks/walkthrough-tracker.cjs` | 7 tests in `walkthrough-tracker.test.cjs` | NO CHANGE NEEDED -- tests validate audit behavior |
| `src/claude/hooks/test-adequacy-blocker.cjs` | Tests exist | NO CHANGE NEEDED -- reads coverage_summary, not staleness |
| `src/claude/hooks/tests/walkthrough-tracker.test.cjs` | N/A (is the test file) | NO CHANGE NEEDED -- fixtures test audit behavior |
| `src/claude/hooks/tests/test-session-cache-builder.test.cjs` | N/A (is the test file) | NO CHANGE NEEDED -- TC-BUILD-16 validates absence of DISCOVERY_CONTEXT in cache |
| `src/claude/commands/discover.md` | No direct tests | LOW -- documentation change only |
| `src/claude/commands/tour.md` | No direct tests | NO CHANGE NEEDED |
| `src/claude/agents/roundtable-analyst.md` | No direct tests | OUT OF SCOPE |
| `src/claude/agents/discover/party-personas.json` | No direct tests | NO CHANGE NEEDED |

#### Complexity Hotspots

| File | Complexity | Notes |
|------|-----------|-------|
| `src/claude/commands/isdlc.md` | HIGH (1800+ lines) | Primary edit target. The STEP 3d section is dense with injection logic. However, the discovery context block (line 1566) is a single paragraph -- surgical removal is straightforward. |
| `src/claude/agents/00-sdlc-orchestrator.md` | MEDIUM | The DISCOVERY CONTEXT INJECTION section (lines 880-903) is a self-contained block with 4-tier fallback logic. Replacing it with a skill-based note is clean. |
| `src/claude/agents/discover-orchestrator.md` | MEDIUM | Multiple envelope documentation instances (lines 668-680, 1191-1194, 2567-2575). Each is self-contained but must be updated consistently. |

#### Technical Debt Markers

1. **Roundtable DISCOVERY_CONTEXT** (isdlc.md lines 709-759): The roundtable dispatch still extracts `DISCOVERY_CONTEXT` from session cache and injects it into the roundtable-analyst. This is a separate code path from STEP 3d but represents residual coupling to the old discovery context mechanism. **Recommendation**: Track as follow-up tech debt item.

2. **test-adequacy-blocker reads coverage_summary** (line 106): The hook reads `discovery_context.coverage_summary` for test adequacy decisions. This is functional usage of the discovery context envelope, not purely audit. However, it does not use staleness/24h logic and is fail-open. **Recommendation**: Acceptable as-is; the hook uses the data for quality gating, which is adjacent to audit. Document in FR-006 review.

3. **Session cache builder DISCOVERY_CONTEXT test** (TC-BUILD-16): This test asserts that the session cache does NOT contain `DISCOVERY_CONTEXT` section delimiters. After our change, this assertion becomes even more correct. No update needed.

#### Risk Zones (Intersections of High Impact + Low Coverage)

| Risk Zone | Impact | Coverage | Mitigation |
|-----------|--------|----------|------------|
| isdlc.md STEP 3d removal | HIGH | None (manual) | Careful surgical edit; verify no surrounding logic depends on the removed block |
| 00-sdlc-orchestrator.md 4-tier fallback removal | MEDIUM | None (manual) | Replace with clear skill-based note; verify delegation table consistency |
| discover-orchestrator.md multi-instance update | MEDIUM | None (manual) | Update all instances consistently; search-verify no remaining "enables seamless handover" language |

#### Recommended Test Additions Before Migration

1. **Run existing test suite**: Verify all 555+ tests pass before and after changes (NFR-003)
2. **Manual validation**: Walk through a phase delegation in isdlc.md STEP 3d and confirm no DISCOVERY CONTEXT block is assembled
3. **Grep validation**: After changes, run `grep -r "discovery_context" src/` and verify only audit-purpose references remain

---

## Cross-Validation

### M4: Cross-Validation Findings

#### File List Comparison (M1 vs M2)

M1 identified 14 files. M2 identified 6 entry points across those same files. All M2 entry points are a subset of M1's file list. **PASS** -- no orphan files.

#### Risk Scoring Consistency (M1 coupling vs M3 risk)

| File | M1 Coupling | M3 Risk | Consistent? |
|------|-------------|---------|------------|
| isdlc.md | HIGH | LOW (removals only) | YES -- high coupling but low risk because changes are removals |
| discover-orchestrator.md | MEDIUM | LOW (docs only) | YES |
| 00-sdlc-orchestrator.md | MEDIUM | LOW (docs only) | YES |
| Phase agents (01, 02, 03) | LOW | LOW | YES |
| Hooks (walkthrough, test-adequacy) | LOW | NONE (no changes) | YES |

**Verification Status**: PASS -- all risk assessments are internally consistent.

#### Completeness Check

- All 6 FRs have mapped file impacts: YES
- All 14 ACs have traceable file changes: YES
- No orphan files (files with no FR mapping): YES
- Roundtable DISCOVERY_CONTEXT correctly scoped as OUT OF SCOPE: YES (separate code path from STEP 3d)

#### Overall Verification: PASS

No critical findings. One INFO-level note: the roundtable DISCOVERY_CONTEXT (isdlc.md lines 709-759) is correctly scoped as out-of-scope but should be tracked as follow-up tech debt.

---

## Implementation Recommendations

Based on the impact analysis:

1. **Suggested Order**: isdlc.md (STEP 3d removal) -> 00-sdlc-orchestrator.md (section rewrite) -> discover-orchestrator.md (audit-only docs) -> phase agents (01, 02, 03 doc updates) -> discover.md (minor fix) -> hooks review (verify no changes needed)
2. **High-Risk Areas**: None significant. The isdlc.md edit is the most sensitive due to the file's size and density, but the change is a clean removal of a self-contained paragraph and two line edits.
3. **Dependencies to Resolve**: None. All three prerequisites (REQ-0037, REQ-0038, REQ-0033) are completed.
4. **Scoping Decision**: The roundtable DISCOVERY_CONTEXT extraction (isdlc.md lines 709-759) and roundtable-analyst.md consumption are OUT OF SCOPE for this change. They operate on a different code path (STEP 7a roundtable dispatch vs STEP 3d phase delegation). Track as follow-up.
5. **Test Strategy**: Run full test suite (555+ tests) before and after. No new tests needed because changes are removals. Existing TC-BUILD-16 and walkthrough-tracker tests validate the correct remaining behavior.

---

## Impact Analysis Metadata

```json
{
  "analysis_completed_at": "2026-02-25T01:30:00Z",
  "sub_agents": ["M1", "M2", "M3", "M4"],
  "verification_status": "PASS",
  "requirements_document": "docs/requirements/REQ-0039-replace-staleness-discovery-context-injection/requirements-spec.md",
  "quick_scan_used": "docs/requirements/REQ-0039-replace-staleness-discovery-context-injection/quick-scan.md",
  "scope_change_from_original": "refined",
  "requirements_keywords": ["discovery_context", "DISCOVERY CONTEXT", "DISCOVERY_CONTEXT", "staleness", "24h", "envelope", "audit-only", "fail-open", "project skills"],
  "files_directly_affected": 14,
  "modules_affected": 5,
  "risk_level": "low",
  "blast_radius": "medium",
  "coverage_gaps": 0
}
```
