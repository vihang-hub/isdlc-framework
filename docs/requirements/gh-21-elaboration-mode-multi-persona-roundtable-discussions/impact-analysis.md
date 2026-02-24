# Impact Analysis: Elaboration Mode -- Multi-Persona Roundtable Discussions

**Generated**: 2026-02-20
**Feature**: Elaboration mode -- at any analysis step, user enters [E] to bring all 3 personas (Maya Chen/BA, Alex Rivera/Architect, Jordan Park/Designer) into focused roundtable discussion on the current topic
**Based On**: Phase 01 Requirements (finalized) -- requirements-spec.md
**Phase**: 02-impact-analysis
**Source**: GH-21 / Backlog Item 16.3
**Depends On**: REQ-0027 (Roundtable Agent with Named Personas) -- COMPLETED, MERGED

---

## Scope Comparison

| Aspect | Original (Phase 00) | Clarified (Phase 01) |
|--------|---------------------|----------------------|
| Description | Multi-persona roundtable discussions via [E] menu | Full multi-persona discussion with entry, exit, cross-talk, synthesis, state tracking, persona voice integrity |
| Keywords | persona, elaboration, roundtable, menu, step, meta.json, depth | + cross-talk, turn limits, synthesis, addressing, topic focus, elaboration record, voice integrity |
| Estimated Files | ~15-20 files | 1 primary file (roundtable-analyst.md) + 1 utility file (three-verb-utils.cjs) + meta.json schema |
| Scope Change | -- | REFINED (narrower file breadth, deeper behavioral specification: 10 FRs, 7 NFRs, 35 ACs) |

---

## Executive Summary

The elaboration mode feature has a **low blast radius** and **low-to-medium risk**. The implementation is tightly contained within a single agent file (`src/claude/agents/roundtable-analyst.md`), replacing a 7-line stub (section 4.4, lines 224-230) with approximately 150-200 lines of multi-persona discussion orchestration logic. No new files are created. The 25 analysis step files remain unchanged -- elaboration operates on step output/topics, not step file content. The command handler (`isdlc.md`) requires no changes. The only secondary file affected is `src/claude/hooks/lib/three-verb-utils.cjs`, which needs a minor addition to `readMetaJson()` for defensive defaults on the new `elaborations` array field. The constraints are well-defined (CON-001 through CON-006) and the dependency on REQ-0027 is complete and merged, providing a stable foundation.

**Blast Radius**: LOW (1 primary file modified, 1 utility file with minor addition, 0 new files)
**Risk Level**: LOW-MEDIUM (behavioral complexity in multi-persona orchestration, but no structural changes)
**Affected Files**: 2 (directly modified)
**Affected Modules**: 2 (roundtable-analyst agent, three-verb-utils library)

---

## Impact Analysis

### M1: Files Affected

#### Directly Modified Files

| # | File | Change Type | Lines Affected | Description |
|---|------|-------------|----------------|-------------|
| 1 | `src/claude/agents/roundtable-analyst.md` | MODIFY | ~150-200 lines added/modified | Replace section 4.4 elaboration stub (lines 224-230) with full elaboration handler; extend section 5 (Session Management) for elaboration state recovery; add section for elaboration-specific persona behaviors |
| 2 | `src/claude/hooks/lib/three-verb-utils.cjs` | MODIFY | ~5-8 lines added | Add defensive default for `elaborations` array in `readMetaJson()` (same pattern as `steps_completed` and `depth_overrides`); add optional `elaboration_config` default |

#### Schema Extensions (No File Changes, Runtime Only)

| # | Resource | Change Type | Description |
|---|----------|-------------|-------------|
| 3 | `meta.json` (per artifact folder) | EXTEND | New optional fields: `elaborations[]` array (elaboration records per step), `elaboration_config.max_turns` (default: 10). Backward compatible -- existing consumers ignore unknown fields. |

#### Unchanged Files (Verified No Impact)

| # | File/Pattern | Reason Unchanged |
|---|-------------|-----------------|
| 4 | `src/claude/skills/analysis-steps/**/*.md` (25 step files) | Step files define topics and depth modes. Elaboration operates on step output, not step file content (CON-006: Step File Immutability). |
| 5 | `src/claude/commands/isdlc.md` | Analyze handler delegates to roundtable-analyst via Task tool. Elaboration is contained within the agent -- no command-level changes needed. |
| 6 | `src/claude/hooks/lib/three-verb-utils.cjs` -- `writeMetaJson()` | Write function already handles arbitrary meta fields. `elaborations` array persists through JSON.stringify without code changes. Only `readMetaJson()` needs the defensive default. |
| 7 | All other agents in `src/claude/agents/` | Elaboration is roundtable-analyst exclusive (CON-001, CON-002). No other agent is affected. |
| 8 | All hooks in `src/claude/hooks/` | No hook logic depends on elaboration state. The analyze verb does not trigger workflow hooks. |

### M1: Dependency Analysis

#### Outward Dependencies (What Depends on Modified Files)

```
roundtable-analyst.md
  '-- Consumed by: isdlc.md analyze handler (Task delegation)
       Impact: NONE -- delegation interface unchanged (same Task prompt format)

three-verb-utils.cjs
  '-- Consumed by: isdlc.md (inline references)
  '-- Consumed by: test-three-verb-utils.test.cjs (61 tests)
  '-- Consumed by: test-three-verb-utils-steps.test.cjs (step-tracking tests)
       Impact: LOW -- additive change to readMetaJson() output; existing fields unchanged
```

#### Inward Dependencies (What Modified Files Depend On)

```
roundtable-analyst.md depends on:
  |- Step files (src/claude/skills/analysis-steps/**/*.md) -- READ only, no writes
  |- meta.json (via readMetaJson/writeMetaJson in three-verb-utils.cjs) -- READ/WRITE
  |- Artifact files in docs/requirements/{slug}/ -- WRITE (synthesis updates)
  '-- Persona definitions (internal sections 1.1-1.3) -- READ

three-verb-utils.cjs depends on:
  |- Node.js fs, path modules -- stable
  '-- No external dependencies
```

#### Change Propagation Paths

```
Section 4.4 replacement (roundtable-analyst.md)
  |- Menu handler [E] routing -- contained within agent
  |- Multi-persona orchestration -- contained within agent
  |- Synthesis logic -- writes to existing artifact files (additive)
  |- Elaboration state tracking -- writes to meta.json (new optional fields)
  '-- Session recovery -- reads meta.json elaborations[] (new code path)

readMetaJson() defensive default (three-verb-utils.cjs)
  '-- Returns elaborations: [] when field missing
       Impact: All existing consumers see no change (they never read this field)
```

### M1: Blast Radius Assessment

**Blast Radius: LOW**

Rationale:
- **1 primary file** modified (roundtable-analyst.md) -- self-contained agent with no outward API
- **1 utility file** with minor additive change (3-line defensive default)
- **0 new files** created
- **25 step files** confirmed unchanged (CON-006)
- **No hook interactions** -- analyze verb does not trigger workflow hooks
- **No command handler changes** -- delegation interface preserved
- **Backward compatible** meta.json extension (optional fields, existing consumers unaffected)

---

## Entry Points

### M2: Existing Entry Points

| # | Entry Point | Type | Location | Impact |
|---|------------|------|----------|--------|
| 1 | `[E]` menu selection at step boundary | User Input | roundtable-analyst.md, Section 4.1 (Step Boundary Menu) | PRIMARY -- this is where elaboration is triggered. Menu already displays [E] option. |
| 2 | `[E]` menu selection at phase boundary | User Input | roundtable-analyst.md, Section 4.2 (Phase Boundary Menu) | SECONDARY -- same [E] trigger at phase boundaries. |
| 3 | Analyze handler delegation | Internal | isdlc.md, line 589 -- Task tool delegation to roundtable-analyst | UNCHANGED -- delegation prompt format does not change. |
| 4 | readMetaJson() call | Internal | three-verb-utils.cjs, line 207 | MINOR -- new defensive default added for `elaborations` field. |
| 5 | Session resume (Context Recovery) | Internal | roundtable-analyst.md, Section 5.1 | EXTENDED -- must now recover elaboration state from meta.json. |

### M2: New Entry Points to Create

| # | Entry Point | Type | Location | Description |
|---|------------|------|----------|-------------|
| 1 | Elaboration mode handler | Internal Function | roundtable-analyst.md, new Section 4.4 | Replaces stub. Routes [E] input to multi-persona discussion orchestration. |
| 2 | Persona addressing parser | Internal Logic | roundtable-analyst.md, within elaboration handler | Detects when user addresses a specific persona by name (e.g., "Alex, what about...?") vs. group. |
| 3 | Turn counter | Internal Logic | roundtable-analyst.md, within elaboration handler | Tracks turn count (persona + user contributions), enforces max_turns limit. |
| 4 | Synthesis engine | Internal Logic | roundtable-analyst.md, new section | Compresses discussion into structured insights, updates artifact files additively. |
| 5 | Elaboration exit handler | Internal Logic | roundtable-analyst.md, within elaboration handler | Detects exit keywords (done, exit, wrap up, back) and triggers synthesis. |
| 6 | Topic focus enforcer | Internal Logic | roundtable-analyst.md, within elaboration handler | Lead persona detects and redirects off-topic drift. |

### M2: Implementation Chain (Entry to Data Layer)

```
User selects [E] at step boundary menu
  |
  v
Step Execution Loop (Section 2.3) detects [E] input
  |
  v
Routes to Section 4.4 Elaboration Handler (replaces stub)
  |
  +-- 1. Read current step context (step_id, title, outputs, step output so far)
  +-- 2. Activate all 3 personas (determine lead persona from phase-persona mapping)
  +-- 3. Display introduction message
  +-- 4. Lead persona frames discussion topic
  |
  v
Multi-Turn Discussion Loop
  +-- 5. Personas contribute in rotation (lead first, then others)
  +-- 6. User participates (addressing parser determines target persona)
  +-- 7. Cross-talk: personas reference each other's points
  +-- 8. Topic focus: lead persona redirects drift
  +-- 9. Turn counter increments; check turn limit (FR-007)
  +-- 10. Inactivity check: prompt user after 3 passive exchanges (FR-003 AC-003-04)
  |
  v
Exit Trigger (user keyword OR turn limit reached)
  |
  v
Synthesis Engine
  +-- 11. Produce structured summary (key insights, decisions, open questions)
  +-- 12. Read step outputs[] field -> identify artifact files
  +-- 13. Update artifact files additively (enrichment, not replacement)
  +-- 14. Display synthesis summary to user
  |
  v
State Update
  +-- 15. Write elaboration record to meta.json elaborations[]
  +-- 16. Write meta.json via writeMetaJson()
  |
  v
Return to Step Boundary Menu (same position, [E] still available)
```

### M2: Recommended Implementation Order

1. **readMetaJson() defensive default** (three-verb-utils.cjs) -- 5 minutes. Add `elaborations: []` and `elaboration_config: {}` defaults. This is prerequisite for all other work.

2. **Elaboration handler skeleton** (roundtable-analyst.md, Section 4.4) -- Replace stub with handler structure: entry detection, persona activation, introduction message. Test: verify [E] no longer shows "coming soon" stub message.

3. **Multi-turn discussion loop** (roundtable-analyst.md) -- Implement persona rotation, user participation, persona addressing parser, turn counter. This is the core behavioral logic and largest implementation unit.

4. **Cross-talk and topic focus** (roundtable-analyst.md) -- Add cross-reference patterns, drift detection/redirection by lead persona. Can be incrementally refined.

5. **Synthesis engine** (roundtable-analyst.md) -- Implement structured summary generation and additive artifact updates. This requires reading step file `outputs` fields.

6. **Elaboration state tracking** (roundtable-analyst.md) -- Write elaboration records to meta.json. Extend session recovery (Section 5.1) to read elaboration history.

7. **Exit mechanism and edge cases** (roundtable-analyst.md) -- Implement exit keyword detection, turn limit enforcement with warning at turn 8, user inactivity prompt.

---

## Risk Assessment

### M3: Test Coverage Analysis

| File | Existing Tests | Coverage | Risk |
|------|---------------|----------|------|
| `src/claude/agents/roundtable-analyst.md` | 0 tests | 0% | HIGH -- Agent markdown files are not unit-testable. Behavior is verified through manual analysis sessions. |
| `src/claude/hooks/lib/three-verb-utils.cjs` | 61+ tests (test-three-verb-utils.test.cjs) + step tests | HIGH (~85-90%) | LOW -- readMetaJson() is well-tested. Adding defensive default follows existing pattern. |
| `src/claude/commands/isdlc.md` | 0 direct tests (command files are not unit-testable) | 0% | LOW -- No changes to this file. |
| `src/claude/skills/analysis-steps/**/*.md` | 0 tests (step files are declarative) | N/A | NONE -- Not modified. |
| `meta.json` schema | Tested indirectly via readMetaJson/writeMetaJson tests | MEDIUM | LOW -- Optional field extension, backward compatible. |

### M3: Complexity Hotspots

| # | Area | Complexity | Risk Level | Rationale |
|---|------|-----------|------------|-----------|
| 1 | Multi-persona orchestration (within single agent context) | HIGH | MEDIUM | Simulating 3 distinct personas sequentially in a single context window requires careful prompt engineering to prevent voice blending. This is the most complex behavioral requirement (FR-002, FR-010). |
| 2 | Synthesis engine (additive artifact updates) | MEDIUM | MEDIUM | Must read existing artifact content, identify correct section, append without corrupting existing content. Risk of unintended overwrites (RSK-003, NFR-004). |
| 3 | Persona addressing parser | MEDIUM | LOW | Detecting "Alex, ..." or "Maya, what about..." patterns is straightforward regex/string matching. Edge cases: ambiguous references, pronouns. |
| 4 | Turn counter and limit enforcement | LOW | LOW | Simple counter with max comparison. Edge case: should user messages count as turns? (Yes, per AC-007-01). |
| 5 | Topic focus enforcement | MEDIUM | LOW | Lead persona redirecting off-topic drift is a behavioral instruction, not code logic. Effectiveness depends on prompt quality, not implementation correctness. |
| 6 | Exit keyword detection | LOW | LOW | Pattern matching against "done", "exit", "wrap up", "back". Well-defined per AC-006-01. |
| 7 | Session recovery with elaboration state | LOW | LOW | Reading `elaborations[]` from meta.json and summarizing in context recovery message. Follows existing `steps_completed` pattern. |

### M3: Technical Debt Markers

| # | Area | Debt Type | Severity | Notes |
|---|------|-----------|----------|-------|
| 1 | Elaboration stub (Section 4.4) | Planned placeholder | LOW | Being replaced by this feature -- debt is resolved. |
| 2 | No automated tests for agent files | Structural | MEDIUM | Agent markdown files (roundtable-analyst.md) have no automated test framework. Behavior is validated through manual sessions. This is a framework-wide limitation, not specific to this feature. |
| 3 | readMetaJson() growing defaults list | Incremental accumulation | LOW | Each feature adds defensive defaults. Currently: `steps_completed`, `depth_overrides`, and now `elaborations`. Pattern is manageable at current scale. |

### M3: Risk Matrix

| Risk ID | Risk | Likelihood | Impact | Mitigation | Acceptance Criteria Affected |
|---------|------|-----------|--------|------------|------------------------------|
| RSK-001 | Elaboration discussions go off-topic or become unbounded | Medium | Medium | Turn limits (FR-007, max 10). Lead persona redirects drift (FR-004). | AC-004-02, AC-007-01 |
| RSK-002 | Persona voices blend or become indistinguishable | Medium | High | Explicit attribution prefix (FR-002 AC-002-04). Style guidelines per persona (Section 13 of requirements). | AC-010-01 through AC-010-04 |
| RSK-003 | Synthesis corrupts existing artifact content | Low | High | Synthesis is additive only (FR-008 AC-008-03). Read-then-append pattern. | AC-008-03, NFR-004 |
| RSK-004 | Context window overflow from lengthy discussions | Low | High | Turn limits bound total content. Synthesis compresses before writing. | AC-007-01, NFR-006 |
| RSK-005 | Meta.json elaboration tracking breaks session resume | Low | Medium | Optional fields, defensive defaults in readMetaJson(). Follows established pattern from REQ-0027. | AC-009-02, NFR-005 |
| RSK-006 | [E] handler breaks existing [C], [S] menu behavior | Low | High | Menu routing is a simple string match. [E] handler is a new branch, not a modification of [C]/[S] branches. | NFR-007 (AC-NFR-007-01) |

### M3: Recommendations

1. **Test before modify**: Run existing `test-three-verb-utils.test.cjs` before and after modifying `readMetaJson()` to verify no regressions.
2. **Manual validation protocol**: Define a manual test script for elaboration mode covering: entry, multi-persona response, user addressing, cross-talk, turn limit, exit, synthesis, session resume.
3. **Incremental implementation**: Implement in the order specified by M2 (handler skeleton first, discussion loop second, synthesis third) to validate each layer independently.
4. **Persona voice testing**: After implementation, run 3-5 elaboration sessions and verify persona distinctiveness per NFR-002 (80% identification rate).
5. **Artifact diff check**: After each synthesis, diff the artifact file to verify additive-only changes per NFR-004.

---

## Cross-Validation

### M4: Cross-Validation Results

#### File List Comparison (M1 vs M2)

| Check | Result | Notes |
|-------|--------|-------|
| M1 affected files subset of M2 entry point files | PASS | Both identify roundtable-analyst.md and three-verb-utils.cjs as the only modified files. |
| M2 entry points covered by M1 dependency analysis | PASS | All 6 new entry points (elaboration handler, addressing parser, turn counter, synthesis engine, exit handler, topic enforcer) are within roundtable-analyst.md, which M1 identifies as the primary modified file. |
| Step files confirmed unchanged by both | PASS | M1 lists 25 step files as unchanged (CON-006). M2 implementation chain shows step files are READ-only (outputs field). |
| isdlc.md confirmed unchanged by both | PASS | M1: no command handler changes. M2: delegation interface preserved. |

#### Risk Scoring Consistency (M1 coupling vs M3 risk)

| Check | Result | Notes |
|-------|--------|-------|
| Low blast radius + low-medium risk | CONSISTENT | M1 identifies low coupling (1 primary file, no outward API). M3 identifies medium complexity in behavioral logic but low structural risk. Combined: LOW-MEDIUM is appropriate. |
| High-complexity areas aligned with risk items | PASS | M3 complexity hotspot #1 (multi-persona orchestration) aligns with RSK-002 (voice blending). M3 hotspot #2 (synthesis) aligns with RSK-003 (artifact corruption). |
| Coverage gaps aligned with risk recommendations | PASS | M3 identifies 0% test coverage for roundtable-analyst.md. M3 recommendations include manual validation protocol to compensate. |

#### Completeness Check

| Check | Result | Notes |
|-------|--------|-------|
| All 10 FRs mapped to affected files | PASS | All FRs (001-010) map to roundtable-analyst.md sections. FR-009 additionally maps to three-verb-utils.cjs (meta.json schema). |
| All 7 NFRs have risk coverage | PASS | NFR-001 (responsiveness), NFR-002 (voice distinctiveness), NFR-003 (synthesis completeness), NFR-004 (artifact integrity), NFR-005 (session resume), NFR-006 (turn limit), NFR-007 (backward compatibility) all have corresponding risk items or verification points. |
| All 6 constraints verified | PASS | CON-001 (single agent), CON-002 (analyze only), CON-003 (no state.json), CON-004 (single-line bash), CON-005 (sequential personas), CON-006 (step immutability) all confirmed by M1 analysis. |

**Verification Status**: PASS (0 critical findings, 0 warnings)

---

## Implementation Recommendations

Based on the impact analysis:

1. **Suggested Order**: readMetaJson() default -> handler skeleton -> discussion loop -> cross-talk/focus -> synthesis -> state tracking -> exit/edge cases (from M2)
2. **High-Risk Areas**: Multi-persona voice integrity (test with 3-5 manual sessions per NFR-002); additive synthesis (diff artifacts before/after per NFR-004)
3. **Dependencies to Resolve**: None -- REQ-0027 is complete and merged; all infrastructure is in place
4. **Pre-Implementation Testing**: Run `npm run test:hooks` to establish baseline. After modifying three-verb-utils.cjs, re-run to verify 0 regressions.
5. **Implementation Scope**: ~150-200 lines added to roundtable-analyst.md, ~5-8 lines added to three-verb-utils.cjs. No new files. No structural changes.

---

## Impact Analysis Metadata

```json
{
  "analysis_completed_at": "2026-02-20",
  "sub_agents": ["M1", "M2", "M3", "M4"],
  "verification_status": "PASS",
  "requirements_document": "docs/requirements/gh-21-elaboration-mode-multi-persona-roundtable-discussions/requirements-spec.md",
  "quick_scan_used": "docs/requirements/gh-21-elaboration-mode-multi-persona-roundtable-discussions/quick-scan.md",
  "scope_change_from_original": "refined",
  "requirements_keywords": ["persona", "elaboration", "roundtable", "multi-persona", "cross-talk", "turn limits", "synthesis", "addressing", "topic focus", "voice integrity", "meta.json", "menu"],
  "files_directly_affected": 2,
  "modules_affected": 2,
  "risk_level": "low-medium",
  "blast_radius": "low",
  "coverage_gaps": 1
}
```
