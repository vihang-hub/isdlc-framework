# Quick Scan: Elaboration Mode (Multi-Persona Roundtable Discussions)

**Generated**: 2026-02-20T17:42:00Z
**Feature**: Elaboration Mode — at any step during analyze workflow, user enters [E] to bring all three personas into focused roundtable discussion on current topic
**Phase**: 00-quick-scan
**Source**: GitHub Issue #21
**Dependency**: REQ-0027 (Roundtable Agent with Named Personas) — COMPLETED, MERGED

---

## Scope Estimate

**Estimated Scope**: MEDIUM
**File Count Estimate**: ~15-20 files
**Confidence**: MEDIUM

### Rationale

This is a UI/interaction enhancement to an existing multi-persona analysis framework. The roundtable-analyst agent already exists with persona definitions and menu structure in place. Elaboration Mode adds:

1. **Menu interaction handler** — Route [E] input to elaboration flow
2. **Multi-persona orchestration** — Activate all 3 personas for group discussion
3. **Context threading** — Capture discussion output, synthesize into artifact updates
4. **Session state** — Track elaboration depth in meta.json

The dependency on REQ-0027 (roundtable-analyst.md, persona definitions, step files) reduces greenfield work significantly. Elaboration Mode is already stubbed at section 4.4 of roundtable-analyst.md with placeholder text: "Elaboration mode is coming in a future update (#21)."

---

## Keyword Matches

### Domain Keywords

| Keyword | Matches | Files |
|---------|---------|-------|
| persona/personas | 12 | roundtable-analyst.md, persona definitions (4 sections), analysis steps (8 files) |
| elaboration | 7 | roundtable-analyst.md (stub + menu refs), draft.md, this scan |
| roundtable | 5 | roundtable-analyst.md, isdlc.md (analyze handler refs), feature metadata |
| multi-persona | 4 | draft.md, roundtable-analyst.md, requirements context |

### Technical Keywords

| Keyword | Matches | Files |
|---------|---------|-------|
| menu | 8+ | roundtable-analyst.md (sections 4.1-4.5), analysis step files (menu display) |
| step/steps | 40+ | analysis-steps/ directory (5 phases × 6-8 steps each = 35+ step files), roundtable-analyst.md |
| meta.json | 6 | roundtable-analyst.md (session management), analyze handler, metadata tracking |
| depth/deep | 8+ | roundtable-analyst.md (brief/standard/deep modes), step files (depth variants) |

---

## Architecture Findings

### Persona Definitions (Existing, REQ-0027)

Four named personas in phase-to-persona mapping (roundtable-analyst.md, section 1.4):

- **Maya Chen** (Business Analyst) — Phases 00-quick-scan, 01-requirements
- **Alex Rivera** (Solutions Architect) — Phases 02-impact-analysis, 03-architecture
- **Jordan Park** (System Designer) — Phase 04-design
- **User** (Participant, not a persona)

### Analysis Steps Infrastructure

```
src/claude/skills/analysis-steps/
├── 00-quick-scan/         (3-4 steps)
├── 01-requirements/       (8 steps: business-context through prioritization)
├── 02-impact-analysis/    (6 steps)
├── 03-architecture/       (6 steps)
└── 04-design/            (7 steps)
```

Each step file:
- Frontmatter: `step_id`, `title`, `persona`, `depth` (brief/standard/deep), `outputs`, `depends_on`
- Three content sections: Brief Mode, Standard Mode, Deep Mode
- Validation rules
- Artifact update instructions

### Current Elaboration Stub (Placeholder)

**Location**: roundtable-analyst.md, section 4.4 (lines 224-230)

**Current behavior**:
1. Display: "Elaboration mode is coming in a future update (#21). For now, I'll go deeper on this topic myself."
2. Switch current step to "deep" depth mode
3. Re-engage with current step using Deep Mode section
4. Re-present step menu

**Stub logic**: Single-persona fallback that deepens analysis without multi-persona discussion.

### Menu System (Existing)

**Step Boundary Menu** (section 4.1):
```
[E] Elaboration Mode -- bring all perspectives to discuss this topic
[C] Continue -- move to the next step
[S] Skip remaining steps in this phase
Or type naturally to provide feedback.
```

**Phase Boundary Menu** (section 4.2):
```
[E] Elaboration Mode -- bring all perspectives to discuss this topic
[C] Continue to Phase {NN+1} ({next phase name})
Or type naturally to provide feedback.
```

Both menus already reference [E] as the elaboration trigger — no menu UI changes needed.

---

## Relevant Modules & Entry Points

### Phase Agents (Existing)

- **`src/claude/agents/roundtable-analyst.md`** (REQ-0027) — Main orchestrator for analyze workflow
  - Active during `/isdlc analyze` commands only
  - Manages persona transitions and step execution
  - Reads step files, tracks progress in meta.json
  - **Modified by**: Section 4.4 elaboration stub → elaboration flow handler

### Command Handler (Existing)

- **`src/claude/commands/isdlc.md`** — Top-level command router
  - **Analyze handler**: Inline handler (no workflow, no state.json writes)
  - Delegates to roundtable-analyst for each phase 00-04
  - **Likely touched**: If elaboration needs to reference new artifact file conventions

### Analysis Step Files (Existing, 35+ files)

- Each step already supports three depth modes (brief/standard/deep)
- Existing infrastructure supports reusing step files at different depths
- **May be touched**: To register or document elaboration's use of deep mode

### Analysis Step Input/Output (Existing)

- Step frontmatter defines `outputs: [artifact_files]`
- roundtable-analyst.md section 5 (artifact production) writes updates
- **Likely touched**: To capture elaboration discussion output and synthesize into artifact updates

---

## Elaboration Flow: Inferred Architecture

Based on existing code and stub, elaboration mode likely requires:

### 1. Menu Input Routing
- Capture [E] input in roundtable-analyst.md step loop
- Route to elaboration handler (new section ~4.4b)

### 2. Persona Activation
- Activate all 3 personas relevant to current analysis phase
- Example: In 01-requirements (Maya's phase), bring Alex & Jordan to discuss scope tradeoffs
- Personas stay in character, address each other by name
- User participates as equals, can address personas or whole group

### 3. Context Threading
- Input: current step_id, current analysis topic, artifacts so far
- Process: Multi-turn discussion with cross-talk
- Output: Refined understanding, discussion points to synthesize

### 4. Synthesis & State Update
- Capture key discussion points
- Update artifact files (requirements-spec.md, architecture.md, design.md, etc.)
- Mark elaboration.completed in meta.json step tracking
- Return to step menu with enriched context

### 5. Session Continuity
- Store elaboration depth in meta.json per step
- Example: `steps_completed: ["01-01-elaborated", "01-02", "01-03-elaborated"]`
- Support resume: user can re-enter elaboration if deepening needed

---

## File Impact Summary

### Certain Changes (Scope Baseline)

1. **roundtable-analyst.md** (~150 lines added/modified)
   - Replace section 4.4 elaboration stub with actual handler
   - Add section ~4.4b: Multi-persona discussion orchestration
   - Add section 4.6: Synthesis and artifact update logic
   - Update section 5 (Session Management) to track elaboration state

2. **isdlc.md** (~20 lines, possibly)
   - May need to update analyze handler documentation if elaboration changes command semantics
   - Likely minimal — elaboration is contained within roundtable-analyst

### Possible Changes (Refinement)

3. **Analysis step files** (35+ files, shallow changes)
   - May add elaboration.discussion_points to artifact output sections
   - Likely no changes — steps already support deep mode reuse

4. **Persona definition refinements** (roundtable-analyst.md, section 1)
   - May clarify cross-persona dialogue patterns
   - May extend communication styles for group discussion mode

5. **Meta.json schema** (minimal)
   - Track elaboration_mode flag per step
   - No new file needed, uses existing meta.json

### Unlikely Changes

- Analysis step files directory structure — infrastructure sufficient
- Command syntax — /isdlc analyze uses existing structure
- Menu system UI — [E] already exists, just needs handler

---

## Questions for Requirements Phase

The following clarifications will help phase 01 capture precise scope:

1. **Persona Count in Elaboration**: All 3 personas always, or subset based on current phase?
   - Example: In 01-requirements (Maya's phase), do Alex & Jordan join, or only Maya deepens?

2. **User Role**: User as equal participant? Can interrupt personas, ask direct questions?

3. **Cross-Talk Semantics**: How explicit? Example formats:
   - "Alex, your architecture concerns — can we address subscriptions later?"
   - "The user raises a good point about subscriptions..."

4. **Exit Strategy**: Explicit command to end elaboration and return to step menu? [X] or just continue?

5. **Artifact Synthesis**: Automatic or manual?
   - Automatic: Synthesize discussion into requirements-spec.md, etc.
   - Manual: User reviews synthesized content and decides what to keep

6. **Session Resume**: If user elaborates on step 01-01, then comes back later, can they re-elaborate?

7. **Elaboration Depth Limits**: Any max length or turn-count to prevent rabbit holes?

8. **Scope Exclusion**: Elaboration always at step boundary, or also within a single step's response?

---

## Quick Scan Metadata

```json
{
  "scan_completed_at": "2026-02-20T17:42:00Z",
  "feature": "elaboration-mode-multi-persona-roundtable",
  "gh_issue": 21,
  "github_source": "GH-21",
  "dependency": "REQ-0027",
  "dependency_status": "completed-merged",
  "scope_estimate": "medium",
  "file_count_estimate": 18,
  "confidence": "medium",
  "keywords_searched": 12,
  "modules_identified": 4,
  "entry_points": 2,
  "analysis_focus": "interaction-handler-and-persona-orchestration",
  "risk_level": "low",
  "risk_notes": "Well-scoped feature within proven persona framework; stub already in place; minimal external dependencies"
}
```

---

## Summary for Requirements Analyst

**Elaboration Mode** is a tightly scoped interaction feature that plugs into the existing roundtable-analyst persona framework. The dependency on REQ-0027 (completed & merged) provides:

- Three named personas with distinct communication styles
- Five analysis phases with step-by-step flow
- Multi-depth support (brief/standard/deep modes)
- Session tracking via meta.json
- Artifact generation infrastructure

Elaboration Mode's job is to activate all three personas to discuss the current topic in depth, then synthesize insights back into the analysis artifacts. The main implementation work is in **roundtable-analyst.md** (replacing the stub with actual orchestration logic), with minimal changes to peripheral files.

**Entry point**: User selects [E] at any step boundary menu in `/isdlc analyze` command.

**Confidence**: Medium (clear scope, proven dependencies, no architectural surprises expected — design decisions on persona interaction patterns and synthesis approach will refine estimates in Phase 01).
