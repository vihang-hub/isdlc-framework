# Quick Scan: GH-20 Roundtable analysis agent with named personas

**Generated**: 2026-02-19T00:00:00.000Z
**Feature**: Single roundtable agent that wears BA, Architect, and Designer hats during the analyze verb, with named personas, communication styles, and adaptive depth.
**Phase**: 00-quick-scan
**Artifact Folder**: gh-20-roundtable-analysis-agent-with-named-personas

---

## Scope Estimate

**Estimated Scope**: Medium
**File Count Estimate**: ~18-25 files
**Confidence**: Medium

---

## Keyword Matches

### Domain Keywords

| Keyword | File Matches | Context |
|---------|--------------|---------|
| analyze | 3 files | isdlc.md (analyze handler), discover.md, tour.md |
| persona | 191 files | Extensive persona/role patterns in agents and docs |
| debate | 15 files | Orchestrator, critic/refiner agents, hooks (debate loop) |
| hat | Multiple | Referenced in draft.md design (BA, Architect, Designer hats) |
| roundtable | 0 files | New pattern, currently called "debate loop" |

### Technical Keywords

| Keyword | File Matches | Context |
|---------|--------------|---------|
| agent | 60 files | Phase agents (00-04), critic/refiner pairs (4 agents) |
| phase | All | 13 agents for phases 00-04 in analyze scope |
| meta.json | 6 files | Tracks analysis progress, resumable state |
| step-files | 0 files | Architecture specified but not yet implemented |
| skill | 242 files | Skill infrastructure, elicitation/classification patterns |
| debate_context | 15 files | Orchestrator, critics, refiners use DEBATE_CONTEXT protocol |

---

## Relevant Modules (Discovery-Based)

### Analyze Verb Handler
- **File**: `src/claude/commands/isdlc.md` (1717 lines)
- **Status**: Exists, well-documented
- **Impact**: Core entrypoint for `/isdlc analyze` — will need persona routing logic
- **Dependencies**: `three-verb-utils.cjs`, `meta.json` tracking

### Phase 00-04 Agents (Existing, Will Be Wrapped)
- **Quick Scan**: `00-sdlc-orchestrator.md` — currently handles discovery orchestration
- **Requirements Analyst**: `01-requirements-analyst.md` (1841 lines) — existing debate-aware
- **Solution Architect**: `02-solution-architect.md` — will become Architect persona
- **System Designer**: `03-system-designer.md` — will become Designer persona
- **Test Design Engineer**: `04-test-design-engineer.md` — out of scope for roundtable

### Debate Infrastructure (Existing, Will Be Integrated)
- **Orchestrator**: `00-sdlc-orchestrator.md` (1660 lines) — manages debate routing for feature workflow
- **Critic/Refiner Agents** (8 files, 4 pairs):
  - `01-requirements-critic.md`, `01-requirements-refiner.md` (5037, 4722 lines)
  - `02-architecture-critic.md`, `02-architecture-refiner.md` (7403, 6341 lines)
  - `03-design-critic.md`, `03-design-refiner.md` (9129, 6553 lines)
  - `04-test-strategy-critic.md`, `04-test-strategy-refiner.md` (11870, 6223 lines)
- **Pattern**: Debate loop = Creator → Critic → Refiner → Round N+1 (existing for features)

### Three-Verb Utilities
- **File**: `src/claude/hooks/lib/three-verb-utils.cjs` (846 lines)
- **Provides**: `generateSlug()`, `readMetaJson()`, `writeMetaJson()`, `deriveAnalysisStatus()`
- **Status**: Dependency REQ-0019 complete ✓
- **Impact**: Analysis status tracking essential for persona context switching

### Skills Infrastructure
- **Total Skills**: 242 registered
- **Elicitation Skills** (REQ-001 family): requirements gathering, user stories, classification
- **Skill Pattern**: `src/claude/skills/{category}/{subcategory}/SKILL.md` + step files
- **New Pattern Needed**: Analysis-steps with persona wrappers

### Hook System
- **Debate Routing**: Hooks route feature workflow to critic/refiner based on phase
- **Test Watcher**: Enforces quality gates after phase completion
- **Delegation Gate**: Validates agent invocation context
- **Impact**: Hooks may need persona-awareness for logging/validation

---

## Architecture Patterns Found (Will Inform Design)

### 1. Multi-Agent Debate Loop (Existing, Reference Pattern)
- **Location**: `00-sdlc-orchestrator.md` (lines 956-1010)
- **Pattern**: Creator → Critic (identifies defects) → Refiner (proposes improvements) → Round N+1
- **Scope**: Currently only for feature workflow phases
- **For GH-20**: Can be adapted to single-agent roundtable with persona switching

### 2. DEBATE_CONTEXT Protocol (Existing)
- **Location**: `01-requirements-analyst.md` (lines 20-65)
- **Pattern**: Task prompt includes DEBATE_CONTEXT block with round number
- **Impact**: New roundtable agent must understand this protocol

### 3. Phase-Scoped Analysis (Existing)
- **File**: `isdlc.md` lines 563-599 (analyze handler)
- **Pattern**: Sequential phase delegation (00 → 01 → 02 → 03 → 04), resumable at boundaries
- **State Tracking**: `meta.json` with `phases_completed`, `analysis_status`, `codebase_hash`
- **For GH-20**: Persona transitions happen within this same phase loop

### 4. Agent Naming Convention
- **Existing**: `00-sdlc-orchestrator`, `01-requirements-analyst`, `02-solution-architect`, etc.
- **Debate Agents**: `01-requirements-critic`, `01-requirements-refiner` (phase-scoped)
- **For GH-20**: Single agent with multiple personas — suggest `00-roundtable-analyst` or phase-agnostic design

### 5. Skill File Organization
- **Pattern**: `src/claude/skills/{category}/{subcategory}/SKILL.md`
- **Variants**: Some categories have step-files (not yet observed in search)
- **For GH-20**: Could organize as `analysis-steps/{persona-name}/step-{NN}.md`

---

## Key Findings

### Strengths (Leverage Existing)
1. **Debate loop machinery exists** — critic/refiner patterns tested and working for features
2. **Three-verb model is stable** — REQ-0019 complete, analyze verb handler ready
3. **Meta.json resumable design** — perfect for step-based persona progression
4. **Phase agents are conversational** — already use DEBATE_CONTEXT, facilitator mode
5. **Skill infrastructure mature** — 242 skills available, elicitation patterns proven

### Unknowns (Require Clarification in Phase 01)
1. **Persona scope clarity**: Does roundtable replace entire phases 00-04, or wrap specific steps within each?
2. **Step-file architecture**: Are steps tracked in meta.json (phase-level) or sub-meta (step-level)?
3. **Communication style implementation**: How are persona voices implemented? (prompts, role-play, switching cues?)
4. **Adaptive depth logic**: What criteria determine when to use "brief confirmation" vs "full discussion"?
5. **User interaction model**: Menu options at each step? Continuous conversation? Mixed?
6. **Name/identity specificity**: Are persona names (e.g., "Sarah the BA", "Alex the Architect") hardcoded or configurable?

### Gaps Needing Design
1. **Persona wrapper pattern** — Not yet explored in codebase (debate uses separate agents)
2. **Single-agent multi-hat design** — Orchestrator currently delegates to separate agents per role
3. **Step-file skill organization** — No existing `analysis-steps/` directory structure
4. **Persona-aware logging** — Hooks may need to track which persona is executing

---

## Modules to Create/Modify

### New Files (~12-15)
1. **Main Agent**
   - `src/claude/agents/00-roundtable-analyst.md` — orchestrator for three personas

2. **Persona Step Files** (~3 sets, 6-9 files)
   - `src/claude/skills/analysis-steps/ba-discovery/` — BA elicitation steps
   - `src/claude/skills/analysis-steps/architect-analysis/` — Architect risk/tradeoff steps
   - `src/claude/skills/analysis-steps/designer-specification/` — Designer interface steps
   - Each with step-01.md, step-02.md, step-03.md templates

3. **Configuration/Personas**
   - `src/claude/agents/personas/roundtable-definitions.json` — persona metadata (names, styles, principles)
   - `src/claude/agents/personas/communication-styles.md` — communication pattern guide

### Modified Files (~8-10)
1. `src/claude/commands/isdlc.md` — Phase 7 of analyze handler adds persona routing logic
2. `src/claude/hooks/lib/three-verb-utils.cjs` — Add persona session tracking (optional)
3. `src/claude/hooks/config/iteration-requirements.json` — Add roundtable agent requirements
4. `src/claude/hooks/config/artifact-paths.json` — Add roundtable artifact paths
5. `src/claude/agents/00-sdlc-orchestrator.md` — Reference/delegate to roundtable (minor)
6. `src/claude/hooks/tests/` — Tests for persona switching, step tracking
7. `.claude/` symlink copies — sync from src/claude/

### Impacted (No Direct Changes, But Read)
- `docs/isdlc/constitution.md` — Validate roundtable against constitutional articles
- `src/claude/hooks/lib/common.cjs` — Study for state.json interaction patterns
- Phase agents (00-04) — Patterns to reference, not modify

---

## Dependency Chain

```
REQ-0019: Three-verb model (DONE)
  ↓
GH-20: Roundtable analyst
  ├── Depends on: /isdlc analyze handler (ready)
  ├── Depends on: meta.json tracking (ready)
  ├── Depends on: DEBATE_CONTEXT protocol (ready)
  ├── Depends on: Critic/refiner patterns (ready)
  └── Depends on: Skill infrastructure (ready)
```

---

## Quick Scope Summary

**Complexity Drivers**:
1. New agent with multi-hat behavior (medium complexity)
2. Persona wrappers around existing phase agents (reuse pattern)
3. Step-file architecture for resumable analysis (new pattern)
4. Communication style switching (prompt engineering)
5. Integration with existing analyze verb handler (localized)

**Risk Areas**:
1. Persona context bleeding between phases
2. Step-tracking state collision with existing meta.json
3. Communication style consistency across personas
4. Orchestrator delegation order (must preserve phase sequence)

**Success Criteria** (Phase 01 to clarify):
- Roundtable supports all 5 analysis phases (00-04)
- Resumable at step and phase boundaries
- Three personas distinguishable by communication style
- Adaptive depth based on complexity signals
- Fully backward compatible with existing analyze verb

---

## Next Steps for Phase 01: Requirements

Key questions to clarify scope:

1. **Persona Model**: Single agent with persona switching, or multiple sub-agents coordinated by one?
2. **Step Architecture**: Track steps in meta.json `"steps_completed"` field, or separate sub-metadata?
3. **User Engagement Model**: Fixed menus ([E]laboration/[C]ontinue) or natural conversation throughout?
4. **Adaptive Depth Signals**: What complexity indicators trigger "brief" vs "full" mode?
5. **Persona Names/Voices**: Are these hardcoded personas or customizable by project?
6. **Phase Boundaries**: Does each phase use all three personas, or specialized personas per phase?
7. **Backward Compatibility**: Must roundtable coexist with standard analyze agents (selectable)?
8. **External Skills**: How should analysis-steps interact with existing skill system (elicitation, classification)?

---

## Quick Scan Metadata

```json
{
  "scan_completed_at": "2026-02-19T00:00:00.000Z",
  "search_duration_ms": 2800,
  "keywords_searched": 12,
  "files_matched": 191,
  "scope_estimate": "medium",
  "file_count_estimate": 22,
  "confidence_level": "medium",
  "dependency_status": "req-0019-complete",
  "debate_patterns_available": true,
  "three_verb_ready": true,
  "phase_agents_count": 13,
  "critic_refiner_pairs_count": 4
}
```
