# E2E and Manual Test Cases: Roundtable Analysis Agent

**Feature ID**: REQ-ROUNDTABLE-ANALYST (GH-20)
**Phase**: 05-test-strategy
**Date**: 2026-02-19

---

## Suite E: Manual E2E Scenarios

These scenarios validate the full roundtable agent behavior including persona interactions, menu system, adaptive depth, and artifact production. They cannot be automated because they require LLM-driven conversational interaction.

### TC-E01: Full Analyze Flow with Roundtable Agent

- **Type**: positive (E2E)
- **Requirements**: FR-001, FR-002, FR-003, FR-004, FR-007, FR-008, FR-010, FR-011, NFR-001, NFR-002, NFR-006
- **Priority**: P0
- **Preconditions**:
  - `src/claude/agents/roundtable-analyst.md` exists
  - All 24 step files exist in `src/claude/skills/analysis-steps/`
  - A backlog item exists (via `/isdlc add`)
- **Steps**:
  1. Run `/isdlc analyze "test-item"` for a new backlog item
  2. **Phase 00 (Quick Scan)**: Verify Maya Chen introduces herself ("Hi, I'm Maya, your Business Analyst"). Verify step header format: "Maya Chen (Business Analyst) -- Step 00-01: Scope Estimation". Complete steps 00-01 through 00-03.
  3. **Phase boundary**: Verify isdlc.md asks "Phase 00 (Quick Scan) complete. Continue to Phase 01?" Confirm with Y.
  4. **Phase 01 (Requirements)**: Verify Maya continues (same persona for Phase 01). Verify step menu appears after each step: `[E]`, `[C]`, `[S]` options. Select `[C]` to continue. Verify Maya asks open-ended questions (not yes/no). Verify Maya acknowledges user responses before proceeding.
  5. **Phase boundary 01->02**: Verify handoff message: "Maya Chen has finished requirements discovery. Handing off to Alex Rivera (Solutions Architect)..."
  6. **Phase 02 (Impact Analysis)**: Verify Alex Rivera's communication style (strategic, tradeoff-focused). Verify step header: "Alex Rivera (Solutions Architect) -- Step 02-01:...". Verify Alex summarizes Maya's work: "I've reviewed Maya's requirements spec. Here's what I'm working with..."
  7. **Phase boundary 02->03**: Verify seamless persona continuation (Alex for both phases).
  8. **Phase boundary 03->04**: Verify handoff from Alex to Jordan Park (System Designer).
  9. **Phase 04 (Design)**: Verify Jordan's communication style (precise, interface-focused). Verify concrete examples in responses.
  10. **Final phase completion**: Verify "Phase 04 (Design) complete. Analysis complete." message.
  11. **Artifact verification**: Check that all expected artifacts exist: quick-scan.md, requirements-spec.md, user-stories.json, impact-analysis.md, architecture-overview.md, module-design-*.md, interface-spec.yaml, error-taxonomy.md.
- **Expected Result**:
  - All three personas (Maya, Alex, Jordan) exhibit distinct communication styles
  - Phase transitions include explicit handoff messages
  - Menu system works at every step boundary
  - All expected artifacts are produced
  - meta.json has `steps_completed` populated, `phases_completed` complete
- **Pass Criteria**: All verification points confirmed visually

### TC-E02: Session Resume Across Sessions

- **Type**: positive (E2E)
- **Requirements**: FR-005, FR-011, NFR-003
- **Priority**: P0
- **Preconditions**:
  - Roundtable agent and all step files exist
  - A backlog item exists
- **Steps**:
  1. Run `/isdlc analyze "test-item"` for a new item
  2. Complete Phase 00 and the first 3 steps of Phase 01 (steps 01-01, 01-02, 01-03)
  3. Select `[S]` to skip remaining Phase 01 steps, or interrupt the session (close terminal)
  4. Verify meta.json on disk contains `steps_completed` with at least `["00-01","00-02","00-03","01-01","01-02","01-03"]`
  5. Start a new terminal session
  6. Run `/isdlc analyze "test-item"` again
  7. Verify Maya provides context recovery: "Welcome back. Last time we completed business context, user needs, and UX journeys. Let's pick up from Technical Context."
  8. Verify the agent starts at step 01-04 (not step 01-01)
  9. Complete remaining Phase 01 steps
  10. Verify Phase 01 completion message
  11. Continue to Phase 02 -- verify Alex Rivera introduces himself (persona transition)
- **Expected Result**:
  - Resume takes under 5 seconds (NFR-003)
  - No completed steps are re-executed
  - Context recovery message accurately reflects completed steps
  - Persona transitions fire correctly even after resume
- **Timing**: Measure time from command start to first agent output; should be under 5 seconds

### TC-E03: Fallback to Standard Agents

- **Type**: positive (E2E)
- **Requirements**: FR-009 AC-009-04, NFR-005 AC-NFR-005-01
- **Priority**: P0
- **Preconditions**:
  - `src/claude/agents/roundtable-analyst.md` has been removed or renamed
  - All other framework files intact
  - A backlog item exists
- **Steps**:
  1. Rename `roundtable-analyst.md` to `roundtable-analyst.md.bak`
  2. Run `/isdlc analyze "test-item"`
  3. Verify Phase 00 delegates to `quick-scan-agent` (not roundtable)
  4. Verify no error messages related to missing roundtable agent
  5. Complete Phase 00
  6. Verify Phase 01 delegates to `01-requirements-analyst` (standard agent)
  7. Verify artifacts produced are in the same format as before roundtable feature
  8. Restore: rename `.bak` file back
- **Expected Result**:
  - Standard phase agents used for all phases
  - No errors, warnings, or regressions
  - Analysis completes successfully with standard agents
  - Artifacts produced are compatible with build verb

---

## Suite F: Adaptive Depth E2E Scenarios

### TC-F01: Brief Depth for Small Items

- **Type**: positive (E2E)
- **Requirements**: FR-006 AC-006-01, AC-006-04, AC-006-05
- **Priority**: P1
- **Preconditions**: Item with quick-scan scope "small" (fewer than 5 files)
- **Steps**:
  1. Run analyze for a small-scope item
  2. Verify depth announcement: "This looks straightforward. I'll keep the analysis brief"
  3. Verify steps present draft summaries for confirmation (not open-ended questions)
  4. Type "deep" during a step
  5. Verify override: "Got it, switching to thorough mode."
  6. Verify subsequent questions are deeper/more detailed
- **Expected Result**: Brief mode detected, draft-confirmation style, user override works

### TC-F02: Deep Depth for Large Items

- **Type**: positive (E2E)
- **Requirements**: FR-006 AC-006-03
- **Priority**: P1
- **Preconditions**: Item with quick-scan scope "large" (more than 15 files)
- **Steps**:
  1. Run analyze for a large-scope item
  2. Verify depth announcement: "This is a substantial change. I'll do a thorough analysis"
  3. Verify steps present multiple probing questions (not just confirmation)
- **Expected Result**: Deep mode detected and applied

### TC-F03: Elaboration Mode Stub

- **Type**: positive (E2E)
- **Requirements**: FR-007 AC-007-03
- **Priority**: P2
- **Steps**:
  1. During any step, select `[E]`
  2. Verify message: "Elaboration mode is coming in a future update (#21)..."
  3. Verify agent goes deeper on the current topic
  4. Verify menu re-appears after elaboration
- **Expected Result**: Stub message shown, agent temporarily deepens analysis

### TC-F04: Skip Remaining Steps

- **Type**: positive (E2E)
- **Requirements**: FR-007 AC-007-06
- **Priority**: P2
- **Steps**:
  1. Start Phase 01, complete step 01-01
  2. Select `[S]` (Skip remaining steps)
  3. Verify agent returns to isdlc.md
  4. Verify phase boundary prompt appears: "Phase 01 complete. Continue to Phase 02?"
  5. Verify skipped steps are NOT in steps_completed
- **Expected Result**: Skip advances to phase boundary; skipped steps available for future sessions

---

## Suite G: Persona Behavior Validation (Manual Review)

### TC-G01: Maya Chen Communication Style Validation

- **Type**: positive (manual review)
- **Requirements**: FR-002 AC-002-01, AC-002-04, NFR-006 AC-NFR-006-01, AC-NFR-006-02
- **Priority**: P1
- **Review Criteria**:
  - [ ] Opens with context-setting ("Based on what you've told me...")
  - [ ] Asks open-ended questions (not yes/no)
  - [ ] Challenges assumptions ("What happens if we ship without this?")
  - [ ] Summarizes before moving on ("So what I'm hearing is...")
  - [ ] Uses concrete examples ("If a user tries to X while Y happens...")
  - [ ] Acknowledges responses with rephrasing ("That's important -- so...")
  - [ ] Persona name in step header, not repeated in every message

### TC-G02: Alex Rivera Communication Style Validation

- **Type**: positive (manual review)
- **Requirements**: FR-002 AC-002-02, AC-002-04, NFR-002 AC-NFR-002-01
- **Priority**: P1
- **Review Criteria**:
  - [ ] Presents options with tradeoffs ("I see two approaches here...")
  - [ ] Discusses blast radius of changes
  - [ ] Asks about risk appetite
  - [ ] Direct about technical debt
  - [ ] No BA-style probing questions about user pain points
  - [ ] Persona name in step header, not repeated in every message

### TC-G03: Jordan Park Communication Style Validation

- **Type**: positive (manual review)
- **Requirements**: FR-002 AC-002-03, AC-002-04
- **Priority**: P1
- **Review Criteria**:
  - [ ] Shows concrete code examples / function signatures
  - [ ] Defines module boundaries explicitly
  - [ ] Focuses on data structures and interfaces
  - [ ] Explicit about error handling
  - [ ] Advocates for simplicity
  - [ ] Persona name in step header, not repeated in every message

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-19 | Test Strategy Designer (Phase 05) | Initial E2E and manual test cases |
