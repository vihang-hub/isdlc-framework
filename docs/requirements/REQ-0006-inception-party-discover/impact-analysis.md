# Impact Analysis — REQ-0006: Inception Party

**Feature**: BMAD-inspired role-based party mode for `/discover --new`
**Analyzed**: 2026-02-09
**Blast Radius**: MEDIUM
**Risk Level**: LOW-MEDIUM

---

## 1. Executive Summary

This feature adds a parallel multi-agent "party mode" as an alternative to the existing sequential new-project discovery flow. The primary blast radius is the `discover-orchestrator.md` agent file (~1987 lines), which will receive a large insertion (estimated 400-600 lines) for the PARTY MODE FLOW section. Secondary changes affect the `discover.md` command definition (new flags), a new persona configuration file, and 3-6 new agent markdown files. The existing sequential flow (classic mode) and all existing project analysis flows remain unchanged.

---

## 2. Affected Files

### 2.1 MODIFIED Files (Existing)

| File | Type | Change Scope | Risk |
|------|------|-------------|------|
| `src/claude/agents/discover-orchestrator.md` | Agent | MAJOR — Add PARTY MODE FLOW section (~500 lines), modify FIRST-TIME MENU to add party/classic mode selection, add mode detection logic before FAST PATH CHECK | MEDIUM |
| `src/claude/commands/discover.md` | Command | MINOR — Add `--party` and `--classic` flags to Options table, add Examples section entries | LOW |
| `src/claude/agents/discover/product-analyst.md` | Agent | MINOR — May need persona-aware prompting additions for Nadia role (Phase 1). Currently used as D7 for vision elicitation. Party mode reuses this agent but with persona context. | LOW |
| `src/claude/agents/discover/architecture-designer.md` | Agent | MINOR — Reused as-is in Phase 3 (Blueprint Assembly). May need cross-review protocol additions for SendMessage integration. | LOW |
| `src/claude/agents/discover/data-model-analyzer.md` | Agent | MINOR — Adapted for Phase 3 (Blueprint Assembly) as Data Model Designer. Currently scoped for existing projects only. Needs new-project data model design capability. | LOW-MEDIUM |
| `src/claude/hooks/config/skills-manifest.json` | Config | MINOR — Add new agent entries and skill IDs for party mode personas if new skills are defined | LOW |
| `docs/isdlc/AGENTS.md` | Docs | MINOR — Add new party mode agent entries to the agent registry | LOW |
| `README.md` | Docs | MINOR — Update agent count if new agents are added | LOW |

### 2.2 NEW Files (To Be Created)

| File | Type | Purpose |
|------|------|---------|
| `src/claude/agents/discover/party-personas.json` | Config | Declarative persona definitions: name, title, phase, communication_style, expertise for all 9 personas (REQ-009, AC-17) |
| `src/claude/agents/discover/domain-researcher.md` | Agent | Oscar — Domain Researcher persona for Phase 1 (Vision Council). New agent. |
| `src/claude/agents/discover/technical-scout.md` | Agent | Tessa — Technical Scout persona for Phase 1 (Vision Council). New agent. |
| `src/claude/agents/discover/solution-architect-party.md` | Agent | Liam — Solution Architect persona for Phase 2 (Stack Debate). New agent (distinct from SDLC Phase 03 solution-architect). |
| `src/claude/agents/discover/security-advisor.md` | Agent | Zara — Security Advisor persona for Phase 2 (Stack Debate). New agent. |
| `src/claude/agents/discover/devops-pragmatist.md` | Agent | Felix — DevOps Pragmatist persona for Phase 2 (Stack Debate). New agent. |
| `src/claude/agents/discover/test-strategist.md` | Agent | Test Strategist for Phase 3 (Blueprint Assembly). New agent. |

### 2.3 UNCHANGED Files (Confirmed Safe)

| File | Reason |
|------|--------|
| `src/claude/agents/discover/architecture-analyzer.md` (D1) | Existing project only — not used in new project flow |
| `src/claude/agents/discover/test-evaluator.md` (D2) | Existing project only — not used in new project flow |
| `src/claude/agents/discover/constitution-generator.md` (D3) | Reused as-is in Phase 4 (Constitution & Scaffold) — no changes needed |
| `src/claude/agents/discover/skills-researcher.md` (D4) | Reused as-is in Phase 4 (Constitution & Scaffold) — no changes needed |
| `src/claude/agents/discover/feature-mapper.md` (D6) | Existing project only — not used in new project flow |
| `src/claude/agents/discover/characterization-test-generator.md` | Existing project only |
| `src/claude/agents/discover/artifact-integration.md` | Existing project only |
| `src/claude/agents/discover/atdd-bridge.md` | Existing project only |
| All SDLC phase agents (01-14) | No changes — party mode is within /discover scope only |
| All hooks (`src/claude/hooks/*.cjs`) | No changes — party mode runs pre-workflow, hooks only fire during SDLC workflows |
| `src/claude/hooks/config/iteration-requirements.json` | No changes — discover phases are not in the iteration requirements |
| `src/claude/hooks/lib/common.cjs` | No changes — no new hook logic needed |
| `.isdlc/config/workflows.json` | No changes — discover is not an SDLC workflow |
| `src/claude/agents/00-sdlc-orchestrator.md` | No changes — party mode output is the same discovery_context envelope |
| `src/claude/commands/sdlc.md` | No changes — /isdlc command unchanged |
| `lib/*.js`, `bin/isdlc.js` | No changes — CLI/installer unaffected |

---

## 3. Entry Points

### 3.1 Primary Entry Point

```
User invokes: /discover --new
                  |
                  v
discover.md (command definition) reads --party / --classic / no flag
                  |
                  v
discover-orchestrator.md (agent)
                  |
    +-------------+-------------+
    |             |             |
    v             v             v
  --party      (no flag)     --classic
    |             |             |
    v             v             v
  PARTY       MODE SELECT    CLASSIC
  MODE FLOW    MENU          MODE FLOW
                  |          (existing)
           +------+------+
           |             |
           v             v
        [1] Party    [2] Classic
        Mode Flow    Mode Flow
```

### 3.2 Flow Integration Points

| Integration Point | Description | Risk |
|-------------------|-------------|------|
| **Mode Selection Menu** | New 2-option menu inserted before FAST PATH CHECK when `/discover --new` is invoked without --party/--classic | LOW — additive, existing menu logic preserved |
| **TeamCreate lifecycle** | Party mode creates a team at Phase 1 start and deletes it at Phase 5 end | LOW — self-contained lifecycle |
| **Sub-agent reuse** | D3 (constitution-generator) and D4 (skills-researcher) used identically in Phase 4 | LOW — no changes to these agents |
| **D5 adaptation** | data-model-analyzer needs new-project design capability (currently analysis-only) | MEDIUM — functional gap |
| **D8 reuse** | architecture-designer used in Phase 3 (same as classic mode Phase 5) | LOW — no changes needed |
| **discovery_context envelope** | Party mode must write identical schema to state.json | LOW — well-defined schema, tested by AC-16 |
| **Walkthrough reuse** | Phase 5 walkthrough follows same protocol as existing walkthrough | LOW — reuse existing walkthrough logic |

---

## 4. Risk Assessment

### 4.1 Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Classic mode regression | LOW | HIGH | REQ-007 + AC-15 require classic mode to produce identical output. Classic flow code is not modified — only wrapped in a conditional branch. |
| discovery_context schema mismatch | LOW | HIGH | AC-16 explicitly validates schema identity. Both modes write the same envelope fields. |
| Agent team lifecycle leak | MEDIUM | MEDIUM | AC-20 requires graceful shutdown. TeamDelete must be called even on error paths. Mitigation: try/finally pattern in orchestrator. |
| D5 adaptation for new projects | MEDIUM | MEDIUM | D5 currently only analyzes existing data models. Party mode Phase 3 needs it to *design* data models. May need a separate agent or mode parameter. |
| Inter-agent message volume | LOW | LOW | NFR-002 bounds messages at 10 per phase. Easy to enforce in agent instructions. |
| Phase 1 user interaction complexity | MEDIUM | LOW | User receives questions from 3 agents simultaneously. Broadcast pattern (AC-6) ensures single response is shared. User experience depends on question quality. |
| Persona name collision with existing agents | LOW | LOW | All 6 named personas (Nadia, Oscar, Tessa, Liam, Zara, Felix) are new names not used elsewhere in the framework. |

### 4.2 Overall Risk: LOW-MEDIUM

The feature is **additive** — it adds a new code path alongside the existing one. The primary risk is ensuring the new path produces output compatible with downstream SDLC workflows (discovery_context envelope), which is directly testable.

---

## 5. Dependency Analysis

### 5.1 Upstream Dependencies (What This Feature Needs)

| Dependency | Status | Notes |
|-----------|--------|-------|
| Claude Code TeamCreate API | Available | Built-in tool, no framework changes needed |
| Claude Code SendMessage API | Available | Built-in tool, no framework changes needed |
| Claude Code TaskCreate API | Available | Built-in tool, no framework changes needed |
| D3 (constitution-generator) | Unchanged | Reused as-is in Phase 4 |
| D4 (skills-researcher) | Unchanged | Reused as-is in Phase 4 |
| D7 (product-analyst) | Unchanged | Reused as Nadia in Phase 1 (or adapted with persona context) |
| D8 (architecture-designer) | Unchanged | Reused in Phase 3 |
| Walkthrough protocol (Step 7.5) | Unchanged | Reused in Phase 5 |
| discovery_context envelope schema | Unchanged | Same schema, populated from party mode results |

### 5.2 Downstream Dependencies (What Depends on This Feature's Output)

| Consumer | Coupling | Risk |
|----------|----------|------|
| `/isdlc feature` workflow | Reads `discovery_context` from state.json | LOW — schema unchanged (AC-16) |
| `/isdlc fix` workflow | Reads `discovery_context` from state.json | LOW — schema unchanged |
| SDLC Orchestrator (Phases 01-03) | Reads `discovery_context` for DISCOVERY CONTEXT blocks | LOW — schema unchanged |
| Hooks (gate-blocker, iteration-corridor, etc.) | Read state.json `current_phase` | NONE — discover runs pre-workflow |

---

## 6. Complexity Assessment

### 6.1 Lines of Code Impact (Estimated)

| Category | Files | Lines Added | Lines Modified | Lines Removed |
|----------|-------|-------------|----------------|---------------|
| Agent (orchestrator) | 1 | ~500 | ~30 | 0 |
| Agent (new personas) | 6 | ~600 | 0 | 0 |
| Agent (adapted) | 1-2 | ~50 | ~20 | 0 |
| Config (personas.json) | 1 | ~80 | 0 | 0 |
| Command (discover.md) | 1 | ~15 | ~5 | 0 |
| Docs (AGENTS.md, README) | 2 | ~20 | ~5 | 0 |
| **Total** | **12-14** | **~1265** | **~60** | **0** |

### 6.2 Architectural Complexity

- **New coordination pattern**: TeamCreate/SendMessage is a new pattern for the discover flow. Existing discover uses Task tool for sub-agents. Party mode introduces inter-agent communication.
- **Parallel execution**: Phases 1-3 each run 3 agents in parallel. This is more complex than classic mode's sequential agent calls.
- **Agent lifecycle management**: Team must be created, agents spawned/shutdown, and team deleted. Failure in any step requires cleanup.
- **No new npm dependencies**: All team features are Claude Code built-ins (Constraint #1).
- **No hook changes**: Party mode runs in discover context, not SDLC workflow context.

---

## 7. Testing Impact

### 7.1 Existing Tests: No Impact

All 917 existing tests (362 ESM + 555 CJS) are unaffected. Party mode:
- Adds no new hooks (no CJS tests needed)
- Adds no new lib/ functions (no ESM tests needed)
- Modifies no existing agent behavior (classic mode unchanged)

### 7.2 New Testing Requirements

| Test Type | Count (Est.) | What to Test |
|-----------|-------------|-------------|
| Agent behavior (manual/integration) | 5-8 | Mode selection menu, --party/--classic flags, persona configuration loading, team lifecycle, discovery_context output compatibility |
| Schema validation | 1-2 | Verify party mode discovery_context matches classic mode schema |
| Error handling | 2-3 | Agent failure in parallel phase, team cleanup on error |

Note: Party mode agents are markdown-based (no code), so testing is primarily manual validation and integration testing through actual `/discover --new --party` invocations.

---

## 8. Constitutional Compliance

| Article | Applicable | Status |
|---------|-----------|--------|
| I (Spec as Source of Truth) | Yes | Requirements spec defines all 12 functional requirements, 20 AC |
| III (Security First) | No | Discovery phase, no security-sensitive operations |
| V (Simplicity) | Yes | Party mode adds complexity but is justified by parallel execution benefit. Classic mode preserved as simpler alternative. |
| VII (Traceability) | Yes | All requirements traced to user stories and AC in requirements-spec.md |
| VIII (Documentation Currency) | Yes | AGENTS.md and README must be updated with new agent count |
| IX (Gate Integrity) | Yes | Party mode output must pass same discovery gates as classic mode |
| XIII (Module System) | Yes | New agent .md files follow existing YAML frontmatter + markdown conventions. New config file uses JSON (consistent with existing configs). No new .cjs files. |
| XIV (State Management) | Yes | discovery_context envelope schema preserved. No state.json structural changes. |

---

## 9. Implementation Recommendations

1. **Branch the orchestrator early**: The discover-orchestrator.md modification is the critical path. Start by adding the mode selection logic and PARTY MODE FLOW skeleton.

2. **Create persona config first**: `party-personas.json` should be created before agent files, since agents will reference it for their persona context.

3. **Reuse D7 for Nadia**: Rather than creating a new agent, pass persona context to the existing product-analyst (D7) agent. This aligns with Constraint #3 (existing agent reuse).

4. **Create new agent for D5 adaptation**: The data-model-analyzer is currently analysis-only. For party mode Phase 3, either:
   - (a) Add a `mode: "design"` parameter to D5 (preferred — smaller change), or
   - (b) Create a new `data-model-designer.md` agent for new-project data model design

5. **Test discovery_context compatibility early**: Write a validation check that compares party mode output schema against classic mode output schema before any walkthrough steps.

6. **Team cleanup is critical**: The orchestrator MUST call TeamDelete even if a phase fails. Use defensive coding patterns in the orchestrator instructions.

---

## 10. Change Summary

```
BLAST RADIUS: MEDIUM (12-14 files, ~1325 total lines changed)
RISK LEVEL: LOW-MEDIUM
REGRESSION RISK: LOW (classic mode unchanged, hooks unaffected)
DOWNSTREAM IMPACT: NONE (discovery_context schema preserved)
```

Key decision points for architecture phase:
- D7 reuse vs new Nadia agent
- D5 adaptation vs new Data Model Designer agent
- Persona config format (JSON vs YAML)
- Error handling strategy for parallel agent failures
