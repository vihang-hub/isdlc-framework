# Architecture Overview: REQ-0007 Deep Discovery

**Feature**: Unify /discover under --deep flag with debate rounds
**Architect**: Solution Architect (Phase 03)
**Date**: 2026-02-09
**Status**: Draft

---

## 1. Executive Summary

This architecture unifies the `/discover` command by replacing `--party` and `--classic` flags with a single `--deep [standard|full]` flag. The core change introduces **structured debate rounds** for existing project discovery (3 rounds standard, 5 rounds full) and **renames** the existing party mode to deep discovery for new projects. Four new agents (D16-D19) are added for existing project analysis. All changes are markdown-only agent definitions -- no runtime code or hook modifications.

---

## 2. Architecture Principles

| # | Principle | Rationale |
|---|-----------|-----------|
| P1 | **Extend, don't rewrite** | The existing orchestrator flow is battle-tested across 7+ workflows. Modify sections, don't replace the whole file. |
| P2 | **Additive config changes** | party-personas.json gains new fields (depth_levels) but existing persona structure is preserved (C-003). |
| P3 | **Agents are markdown-only** | D16-D19 follow the established pattern: .md files with YAML frontmatter, no runtime code (C-001). |
| P4 | **Fail-open on new fields** | discovery_context envelope extensions are additive. Hooks that read discovery_context gracefully ignore unknown keys. |
| P5 | **Sequential debates, parallel analysis** | Analysis agents run in parallel (existing pattern). Debate rounds run sequentially (each round's output feeds the next). |
| P6 | **Config-driven depth levels** | Depth level (standard/full) determines agent count and debate round count. Configured in a new `deep-discovery-config.json` for existing projects. |

---

## 3. System Architecture

### 3.1 High-Level Flow

```
/discover [--deep [standard|full]] [--new|--existing] [--verbose]
    │
    ├─ Flag Resolution (discover.md)
    │   ├─ --deep → set depth (standard default)
    │   ├─ --party → ERROR: deprecated
    │   ├─ --classic → ERROR: deprecated
    │   └─ (no flag) → auto-detect + confirm project type, default standard
    │
    ├─ Project Type Resolution (discover-orchestrator.md)
    │   ├─ --new → NEW PROJECT FLOW (deep discovery)
    │   │   └─ Same party flow, renamed. Standard=3 phases, Full=5 phases.
    │   │
    │   └─ --existing → EXISTING PROJECT FLOW (deep discovery)
    │       ├─ Phase 1: Parallel Analysis (D1, D2, D5, D6 + D16, D17 [+ D18, D19 if full])
    │       ├─ Phase 1-DEBATE: Sequential Debate Rounds (3 standard, 5 full)
    │       ├─ Phase 1b: Characterization Tests (unchanged)
    │       ├─ Phase 1c: Artifact Integration (unchanged)
    │       ├─ Phase 1d: ATDD Bridge (unchanged, --atdd-ready only)
    │       ├─ Phase 2: Discovery Report (extended with debate synthesis)
    │       ├─ Phase 3: Constitution Generation (unchanged)
    │       ├─ Phase 4: Skills & Testing Setup (unchanged)
    │       ├─ Walkthrough (unchanged)
    │       └─ Phase 5: Finalize (extended with new envelope fields)
    │
    └─ Output Artifacts
        ├─ Existing artifacts (unchanged)
        ├─ NEW: security-posture.md (from D16)
        ├─ NEW: technical-debt-report.md (from D17)
        ├─ NEW: performance-analysis.md (from D18, full only)
        ├─ NEW: ops-readiness-report.md (from D19, full only)
        ├─ NEW: debate-round-N-synthesis.md (per round)
        └─ EXTENDED: discovery_context envelope in state.json
```

### 3.2 Component Architecture

```
discover.md (command)
  │
  ▼
discover-orchestrator.md (D0)
  ├── FAST PATH CHECK (flag resolution + auto-detect)
  │
  ├── NEW PROJECT FLOW ──────────────────────────────────────────────
  │   │  (renamed from PARTY MODE FLOW)
  │   ├── Standard depth: Party Phases 1-3 (Vision, Stack, Blueprint)
  │   └── Full depth: Party Phases 1-5 (above + Constitution Alignment + Completeness)
  │   │   Personas: Nadia, Oscar, Tessa, Liam, Zara, Felix (unchanged)
  │   └── Config: party-personas.json (unchanged for new projects)
  │
  └── EXISTING PROJECT FLOW ─────────────────────────────────────────
      │
      ├── Phase 1: Parallel Analysis
      │   ├── D1 (architecture-analyzer) ── always
      │   ├── D2 (test-evaluator) ── always
      │   ├── D5 (data-model-analyzer) ── always
      │   ├── D6 (feature-mapper) ── always
      │   ├── D16 (security-auditor) ── standard + full
      │   ├── D17 (technical-debt-auditor) ── standard + full
      │   ├── D18 (performance-analyst) ── full only
      │   └── D19 (ops-readiness-reviewer) ── full only
      │
      ├── Phase 1-DEBATE: Debate Rounds (sequential)
      │   ├── Round 1: Architecture + Security [+ Ops if full]
      │   │   Agents: D1, D16 [, D19]
      │   ├── Round 2: Data + Testability + Architecture
      │   │   Agents: D5, D2, D1
      │   ├── Round 3: Behavior + Security + Coverage
      │   │   Agents: D6, D16, D2
      │   ├── Round 4 (full): Constitution Alignment
      │   │   Agents: All analysis agents
      │   └── Round 5 (full): Artifact Completeness + Cross-Review
      │       Agents: All analysis agents
      │
      └── Config: deep-discovery-config.json (NEW)
```

---

## 4. Architecture Decision Records (ADRs)

### ADR-001: Separate Config for Existing Project Debate (deep-discovery-config.json)

**Context**: Existing project deep discovery needs debate round definitions, agent groupings by depth level, and round-specific instructions. party-personas.json currently serves new project flows only.

**Decision**: Create a new `deep-discovery-config.json` in `src/claude/agents/discover/` alongside `party-personas.json`. This file defines:
- `depth_levels.standard.agents` and `depth_levels.full.agents`
- `debate_rounds` array with participants, interaction type, and focus per round
- Round-specific instructions (what each agent cross-validates)

**Rationale**:
- party-personas.json is preserved untouched for new projects (C-003)
- Existing project agents use role-only personas (REQ-008), structurally different from named personas
- Separate config avoids conditional complexity in a single JSON
- Follows established pattern: config + agent .md files, read by orchestrator

**Alternatives Rejected**:
- Extend party-personas.json: Would mix named personas (new) with role-only agents (existing), increasing complexity
- No config file (hardcode in orchestrator): Would make the orchestrator even larger (~2600 lines already)

### ADR-002: Debate Rounds as Sequential Orchestrator Phases

**Context**: Debate rounds require agents to cross-validate each other's findings. Each round produces a synthesis artifact. The orchestrator must manage message flow.

**Decision**: Implement debate rounds as a new sequential phase (Phase 1-DEBATE) between Phase 1 (parallel analysis) and Phase 1b (characterization tests). The orchestrator drives each round:
1. Select round participants from config
2. Provide each participant with the other participants' Phase 1 output
3. Each agent produces a cross-review critique (via Task tool, not real-time chat)
4. Orchestrator synthesizes critiques into `debate-round-N-synthesis.md`

**Rationale**:
- Task-based approach (not real-time messaging) avoids the complexity of team messaging for existing project agents
- Sequential rounds ensure each round can reference previous round outcomes
- Orchestrator owns synthesis — agents don't need to coordinate directly
- Matches existing Phase 1 → Phase 1b → Phase 1c sequential pattern

**Key Detail**: Unlike the new project party flow (which uses TeamCreate/SendMessage for real-time debate), existing project debate rounds use **serial Task delegation** for each agent in a round, then the orchestrator synthesizes. This is simpler and more predictable.

### ADR-003: Auto-Detect with Confirmation (Not Silent)

**Context**: When `/discover` is invoked with no `--new` or `--existing` flag, the system should detect the project type automatically.

**Decision**: Auto-detect project type (check for src/, lib/, package.json, etc.), then present a confirmation prompt with option to override:
```
Detected: existing project. Proceed? [Y/N/Switch]
```

**Rationale**:
- Silent auto-detect could produce incorrect results (empty src/ dir = false positive)
- Confirmation takes 1 second but prevents expensive mistakes (running wrong flow)
- "Switch" option allows override without re-invoking the command
- Follows existing first-time menu pattern (already shows detection-based recommendation)

### ADR-004: Depth-Conditional Agent Inclusion (Not Phase Splitting)

**Context**: Standard depth runs 8 agents; full depth runs 10. The additional 2 agents (D18, D19) only appear in full mode.

**Decision**: Use a single Phase 1 parallel launch with depth-conditional agent inclusion:
```
agents_to_launch = config.depth_levels[selected_depth].agents
// standard: [D1, D2, D5, D6, D16, D17]
// full: [D1, D2, D5, D6, D16, D17, D18, D19]
```

All agents run in the same parallel batch. No separate "full-only" phase.

**Rationale**:
- Adding 2 more parallel agents has negligible time impact (NFR-001: parallel, not sequential)
- Single Phase 1 is simpler to manage than Phase 1 + Phase 1-full
- Depth level already resolves to an agent list — just iterate and launch

### ADR-005: Orchestrator-Driven Synthesis (Not Agent-to-Agent)

**Context**: Each debate round produces cross-reviews. These need to be merged into a single synthesis document.

**Decision**: The orchestrator collects all agent critiques for a round, then writes the synthesis artifact itself. Agents never see each other's critiques directly within a round.

```
Round N Flow:
  1. Orchestrator provides Agent-A's Phase 1 output to Agent-B, Agent-C
  2. Agent-B writes critique of Agent-A's output
  3. Agent-C writes critique of Agent-A's output
  4. (Similarly, each agent reviews the others)
  5. Orchestrator reads all critiques, writes debate-round-N-synthesis.md
```

**Rationale**:
- Orchestrator is the single source of truth for synthesis (consistent quality)
- Agents stay focused on their domain expertise (no synthesis/merge logic)
- Avoids circular dependencies between agent critiques
- Synthesis template ensures consistent format across rounds

### ADR-006: Flag Deprecation as Hard Errors (Not Warnings)

**Context**: `--party` and `--classic` flags are being removed. Users may invoke them from muscle memory.

**Decision**: Produce hard errors with migration guidance, not silent fallback:
```
--party:   "The --party flag has been replaced by --deep. Use /discover --deep [standard|full]"
--classic: "The --classic flag has been removed. /discover now uses deep discovery by default."
```

**Rationale**:
- Pre-release framework (C-004): no backward compatibility obligation
- Hard errors force immediate awareness of the change
- Includes exact replacement syntax, zero guesswork
- Better than silent fallback which could confuse users about what mode actually ran

### ADR-007: New Project Flow Reuses Party Infrastructure (Rename Only)

**Context**: The existing party mode flow (PARTY MODE FLOW section in orchestrator) already implements multi-agent debate with named personas. REQ-007 renames it to "deep discovery" for new projects.

**Decision**: The PARTY MODE FLOW section is renamed to DEEP DISCOVERY FLOW (NEW PROJECTS). Internally:
- Same agents (Nadia, Oscar, Tessa, Liam, Zara, Felix)
- Same team lifecycle (TeamCreate, SendMessage, shutdown)
- Same phases (Vision Council, Stack Debate, Blueprint Assembly, Constitution & Scaffold, Walkthrough)
- Standard depth = phases 1-3, Full depth = phases 1-5
- party-personas.json read as-is

**Rationale**:
- Avoids introducing risk by rewriting a working system
- Depth level simply controls which phases execute (already natural)
- The party infrastructure (team, messaging) is appropriate for new projects where user interaction is expected

### ADR-008: Debate Transcript Persistence (Always Saved, Selectively Shown)

**Context**: Users may want to see full debate transcripts or just the final synthesis. REQ-009 requires a runtime toggle.

**Decision**:
- Always save full transcripts to `docs/requirements/reverse-engineered/debates/` (or equivalent artifact path)
- By default, display only the synthesis summary after each round
- `--verbose` flag or user typing "show transcript" during a round toggles full transcript display
- Transcripts are debate input/output pairs per agent per round

**Rationale**:
- Always-save ensures auditability (Article VII: Artifact Traceability)
- Synthesis-by-default keeps the UX clean for most users
- Runtime toggle allows drill-down without re-running discovery
- Transcript files are small (markdown), no storage concern

---

## 5. File Inventory and Change Classification

### 5.1 New Files

| File | Type | Purpose |
|------|------|---------|
| `src/claude/agents/discover/deep-discovery-config.json` | Config | Depth levels, agent groupings, debate round definitions for existing projects |
| `src/claude/agents/discover/security-auditor.md` | Agent (D16) | Security posture analysis for existing projects |
| `src/claude/agents/discover/technical-debt-auditor.md` | Agent (D17) | Technical debt analysis for existing projects |
| `src/claude/agents/discover/performance-analyst.md` | Agent (D18) | Performance analysis (full depth only) |
| `src/claude/agents/discover/ops-readiness-reviewer.md` | Agent (D19) | Ops readiness review (full depth only) |

### 5.2 Major Modifications

| File | Scope | Changes |
|------|-------|---------|
| `src/claude/agents/discover-orchestrator.md` | LARGE (~2600 lines) | Remove Step 0 Mode Selection, rename PARTY MODE FLOW to DEEP DISCOVERY FLOW, add depth level handling to FAST PATH CHECK, add Phase 1-DEBATE section to EXISTING PROJECT FLOW, extend Phase 1 parallel launch to include D16-D19, add auto-detect confirmation logic, update discovery_context envelope write |
| `src/claude/commands/discover.md` | MEDIUM (~248 lines) | Remove --party/--classic from options table, add --deep/--verbose, update examples, update help text |

### 5.3 Minor Modifications

| File | Changes |
|------|---------|
| 7 party agent .md files | Replace "party mode" with "deep discovery" in descriptions |
| `src/claude/commands/tour.md` | Update --party/--classic references |
| `CLAUDE.md` | Update checklist item text |
| `docs/AGENTS.md` | Add D16-D19 entries, update agent count 12 -> 16, remove stale --shallow reference |
| `README.md` | Update agent count badge 36 -> 40, update discover agent count 12 -> 16 |

### 5.4 Test Files

| File | Changes |
|------|---------|
| `lib/party-personas.test.js` | Update test descriptions from "party" to "deep discovery", keep schema validation |
| NEW: `lib/deep-discovery-config.test.js` | Schema validation for deep-discovery-config.json, depth level validation, debate round config validation |
| NEW: `src/claude/hooks/tests/test-discover-flags.test.cjs` | Deprecated flag error messages, --deep flag parsing, --verbose handling |

---

## 6. Data Architecture

### 6.1 deep-discovery-config.json Schema

```json
{
  "version": "1.0.0",
  "description": "Configuration for existing project deep discovery with debate rounds",
  "depth_levels": {
    "standard": {
      "agents": ["D1", "D2", "D5", "D6", "D16", "D17"],
      "debate_rounds": 3,
      "max_round_messages": 6,
      "timeout_minutes_per_round": 3
    },
    "full": {
      "agents": ["D1", "D2", "D5", "D6", "D16", "D17", "D18", "D19"],
      "debate_rounds": 5,
      "max_round_messages": 10,
      "timeout_minutes_per_round": 5
    }
  },
  "agents": {
    "D16": {
      "title": "Security Auditor",
      "agent_type": "security-auditor",
      "depth_level": "standard",
      "output_artifact": "security-posture.md",
      "scan_domains": ["dependency-vulnerabilities", "secret-exposure", "auth-patterns", "input-validation", "owasp-top-10"]
    },
    "D17": {
      "title": "Technical Debt Auditor",
      "agent_type": "technical-debt-auditor",
      "depth_level": "standard",
      "output_artifact": "technical-debt-report.md",
      "scan_domains": ["code-duplication", "complexity-hotspots", "deprecated-apis", "missing-error-handling", "stale-dependencies", "anti-patterns"]
    },
    "D18": {
      "title": "Performance Analyst",
      "agent_type": "performance-analyst",
      "depth_level": "full",
      "output_artifact": "performance-analysis.md",
      "scan_domains": ["response-time-patterns", "memory-cpu-profiling", "caching-strategy", "db-query-patterns", "n-plus-1-queries", "bundle-sizes"]
    },
    "D19": {
      "title": "Ops Readiness Reviewer",
      "agent_type": "ops-readiness-reviewer",
      "depth_level": "full",
      "output_artifact": "ops-readiness-report.md",
      "scan_domains": ["logging-adequacy", "health-check-endpoints", "graceful-shutdown", "config-management", "env-variable-handling", "monitoring-hooks"]
    }
  },
  "debate_rounds": [
    {
      "round": 1,
      "name": "Architecture + Security",
      "participants_standard": ["D1", "D16"],
      "participants_full": ["D1", "D16", "D19"],
      "focus": "Architecture validates security recommendations are feasible; Security validates architecture has no blind spots",
      "interaction": "cross-review"
    },
    {
      "round": 2,
      "name": "Data + Testability + Architecture",
      "participants_standard": ["D5", "D2", "D1"],
      "participants_full": ["D5", "D2", "D1"],
      "focus": "Data model validated against test gaps; Test evaluator validates data access patterns are testable",
      "interaction": "cross-review"
    },
    {
      "round": 3,
      "name": "Behavior + Security + Coverage",
      "participants_standard": ["D6", "D16", "D2"],
      "participants_full": ["D6", "D16", "D2"],
      "focus": "Behavior extraction validated against security; Security validates feature-level access control; Coverage validated against behaviors",
      "interaction": "cross-review"
    },
    {
      "round": 4,
      "name": "Constitution Alignment",
      "participants_standard": null,
      "participants_full": "all",
      "focus": "All agents cross-check findings against constitution articles. Each identifies which articles their findings impact.",
      "interaction": "constitution-cross-check"
    },
    {
      "round": 5,
      "name": "Artifact Completeness + Cross-Review",
      "participants_standard": null,
      "participants_full": "all",
      "focus": "All agents verify combined output covers all discovery dimensions. Identify blind spots. Each reviews one other agent's primary artifact.",
      "interaction": "completeness-review"
    }
  ]
}
```

### 6.2 discovery_context Envelope Extensions

New fields added to the `discovery_context` object in state.json (additive only):

```json
{
  "discovery_context": {
    "completed_at": "...",
    "tech_stack": { "..." },
    "coverage_summary": { "..." },
    "architecture_summary": "...",
    "re_artifacts": { "..." },

    "security_posture": {
      "risk_level": "medium",
      "findings_count": 12,
      "critical_count": 1,
      "owasp_coverage": ["A01", "A02", "A03", "A05", "A07"]
    },
    "technical_debt": {
      "debt_score": 42,
      "hotspot_count": 5,
      "deprecated_api_count": 3,
      "remediation_priority": ["Replace deprecated crypto.createCipher", "Reduce cyclomatic complexity in auth.js", "Update 4 stale dependencies", "Add error handling to 3 uncovered paths", "Deduplicate validation logic"]
    },
    "debate_summary": {
      "depth_level": "standard",
      "rounds_completed": 3,
      "agreements_count": 8,
      "disagreements_count": 2,
      "resolutions": ["Architecture team accepted security recommendation to add rate limiting", "Security accepted architecture justification for shared session store"]
    }
  }
}
```

### 6.3 Debate Transcript File Structure

```
docs/requirements/reverse-engineered/debates/
  ├── debate-round-1-synthesis.md
  ├── debate-round-1-transcript.md   (always saved)
  ├── debate-round-2-synthesis.md
  ├── debate-round-2-transcript.md
  ├── debate-round-3-synthesis.md
  ├── debate-round-3-transcript.md
  ├── debate-round-4-synthesis.md     (full only)
  ├── debate-round-4-transcript.md    (full only)
  ├── debate-round-5-synthesis.md     (full only)
  ├── debate-round-5-transcript.md    (full only)
  └── cross-review-summary.md         (full only)
```

---

## 7. Interaction Patterns

### 7.1 Debate Round Execution (Existing Projects)

Unlike new project party mode (which uses TeamCreate/SendMessage for real-time agent interaction), existing project debate rounds use **serial Task delegation**:

```
For each round in debate_rounds:
  IF round.participants_{depth} is null: SKIP (not applicable at this depth)

  participants = resolve_agents(round.participants_{depth})
  critiques = {}

  FOR each agent_A in participants:
    other_agents_outputs = collect_phase1_outputs(participants - agent_A)
    critique = Task(
      agent_type: agent_A.agent_type,
      prompt: "Review these findings from your cross-domain perspective: {other_agents_outputs}. Focus: {round.focus}. Return your critique in structured format."
    )
    critiques[agent_A] = critique

  synthesis = orchestrator_synthesize(critiques, round)
  write_file("debate-round-{round.round}-synthesis.md", synthesis)
  write_file("debate-round-{round.round}-transcript.md", full_critiques)

  IF --verbose: display full transcript to user
  ELSE: display synthesis summary only
```

### 7.2 Auto-Detect and Confirmation

```
1. Read .isdlc/state.json → project.is_new_project
2. IF is_new_project explicitly set: use it
3. ELSE: file-based detection (src/, lib/, package.json, etc.)
4. Present confirmation:
   "Detected: [existing/new] project. Proceed? [Y/N/Switch]"
5. Y → proceed with detected type
6. N → abort
7. Switch → proceed with opposite type
```

### 7.3 Flag Resolution

```
IF --party: ERROR "The --party flag has been replaced by --deep..."
IF --classic: ERROR "The --classic flag has been removed..."
IF --deep full: depth = "full"
IF --deep standard: depth = "standard"
IF --deep (no arg): depth = "standard"
IF (no --deep flag): depth = "standard" (default)
```

---

## 8. Integration Points

### 8.1 Hooks (No Changes Required)

All hooks are guarded by `active_workflow` checks and/or fail-open on unknown fields:

| Hook | Impact | Reason |
|------|--------|--------|
| gate-blocker.cjs | NONE | Discover is pre-workflow |
| iteration-corridor.cjs | NONE | Not active during discover |
| constitution-validator.cjs | NONE | Not active during discover |
| test-watcher.cjs | NONE | Guarded by active_workflow |
| menu-tracker.cjs | NONE | Guarded by active_workflow |
| walkthrough-tracker.cjs | SAFE | Reads discovery_context; additive fields ignored |
| test-adequacy-blocker.cjs | SAFE | Reads discovery_context; additive fields ignored |
| discover-menu-guard.cjs | MAYBE | May need option count update if menu structure changes |

### 8.2 Skills Manifest

D16-D19 should be added to `skills-manifest.json` for observability. This is a documentation/tracing concern, not a blocking issue (skill enforcement is in `observe` mode).

### 8.3 Downstream Consumers

The SDLC orchestrator reads `discovery_context` in Phase 01-03 delegations. The new fields (`security_posture`, `technical_debt`, `debate_summary`) are additive and will be included in DISCOVERY CONTEXT blocks when present. No changes needed to the SDLC orchestrator -- it already uses a structural template that passes through whatever fields exist.

---

## 9. Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| Orchestrator .md context window overflow | Keep debate round instructions concise; reference config file by path rather than inlining all round definitions |
| Debate rounds slow discovery significantly | NFR-001 timeout per round (3min standard, 5min full). Abort round on timeout with partial synthesis. |
| Debate quality inconsistency between rounds | Use structured critique template in each agent's prompt (agreements, disagreements, risk flags, recommendations) |
| New agents produce inconsistent output format | Define output template in each agent .md file with required sections and severity rating scale |
| discover-menu-guard false positive | Verify guard's expected option count after menu structure changes; update if needed |

---

## 10. Implementation Sequence

Recommended implementation order (aligned with dependency graph from impact analysis):

1. **New agent .md files** (D16-D19) -- no dependencies, fully parallel
2. **deep-discovery-config.json** -- standalone config, no dependencies
3. **discover.md command** -- flag changes, deprecation errors
4. **discover-orchestrator.md** -- the main change (depends on 1, 2, 3)
   - 4a: Remove Step 0 Mode Selection
   - 4b: Add auto-detect confirmation to FAST PATH CHECK
   - 4c: Rename PARTY MODE FLOW to DEEP DISCOVERY FLOW (NEW PROJECTS)
   - 4d: Extend Phase 1 parallel launch (add D16-D19)
   - 4e: Add Phase 1-DEBATE section
   - 4f: Extend discovery_context envelope write
   - 4g: Update first-time menu (remove mode selection reference)
5. **7 party agent .md files** -- cosmetic renames ("party mode" -> "deep discovery")
6. **Tests** -- schema validation, debate config, flag deprecation, discovery_context extensions
7. **Documentation** -- AGENTS.md, README.md, CLAUDE.md, tour.md
8. **Hook review** -- discover-menu-guard (if needed)

---

## 11. Constitutional Compliance

| Article | Compliance | Detail |
|---------|-----------|--------|
| I (Spec as Source of Truth) | COMPLIANT | Requirements spec (REQ-0007) drives all changes |
| III (Security) | COMPLIANT | D16 security auditor adds security analysis to discovery |
| V (Simplicity) | COMPLIANT | Single flag (--deep) replaces two (--party, --classic) |
| VII (Traceability) | COMPLIANT | Debate transcripts always saved for audit trail |
| VIII (Documentation Currency) | REQUIRES | AGENTS.md, README.md, tour.md must be updated |
| IX (Gate Integrity) | N/A | Discover is pre-workflow, no SDLC gates |
| XIII (Module System) | COMPLIANT | New agents are markdown-only, no hook/code changes |
| XIV (State Management) | COMPLIANT | discovery_context extensions are additive only |
