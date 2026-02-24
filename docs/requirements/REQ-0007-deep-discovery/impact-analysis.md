# Impact Analysis: REQ-0007 Deep Discovery

**Feature**: Unify /discover under --deep flag with debate rounds
**Analyst**: Impact Analysis Orchestrator
**Date**: 2026-02-09
**Blast Radius**: MEDIUM-HIGH
**Risk Level**: MEDIUM

---

## 1. File Impact Summary

| Category | Files Affected | Change Type |
|----------|---------------|-------------|
| **Major modification** | 2 | Substantial rewrite of sections |
| **Minor modification** | 10 | Flag renames, reference updates, additive sections |
| **New files** | 4-6 | New agent definitions |
| **Test modifications** | 1-2 | Schema test updates, new debate tests |
| **Documentation** | 3 | AGENTS.md, README.md, CLAUDE.md |
| **TOTAL** | ~20-23 files | |

---

## 2. Detailed File Impact

### 2.1 Major Modifications (Substantial Rewrite)

#### File 1: `src/claude/agents/discover-orchestrator.md` (~2600 lines)
- **Scope**: LARGE — this is the central coordination file
- **Changes**:
  - Remove Step 0 Mode Selection (classic/party menu) from NEW PROJECT FLOW
  - Replace `--party` references with `--deep` throughout
  - Remove `--classic` references throughout
  - Add `--deep [standard|full]` flag handling to FAST PATH CHECK
  - Add auto-detect with confirmation logic (REQ-002)
  - Add 4 new agent entries to the Sub-Agents table (D16-D19)
  - Add debate round orchestration to EXISTING PROJECT FLOW (3 rounds standard, 5 rounds full)
  - Add debate synthesis and transcript visibility logic
  - Extend discovery_context envelope write with new fields
  - Update First-Time Menu to remove mode selection step after project type selection
  - Rename PARTY MODE FLOW references to DEEP DISCOVERY FLOW
- **Risk**: MEDIUM — Large file, but changes are section-level additions/replacements. Existing logic (parallel D1-D6 analysis, sequential phases 1b-1d) is preserved.
- **Constitutional Impact**: Article VIII (Documentation Currency) — must keep in sync

#### File 2: `src/claude/commands/discover.md` (~110 lines)
- **Scope**: MEDIUM — command definition and help text
- **Changes**:
  - Remove `--party` and `--classic` from Options table
  - Add `--deep [standard|full]` to Options table
  - Add `--verbose` for debate transcript visibility
  - Update Examples section
  - Add deprecation error messages for old flags
  - Update Description section (remove classic/party references)
- **Risk**: LOW — Straightforward option table changes

### 2.2 Minor Modifications (Flag Renames, Additive)

#### File 3: `src/claude/agents/discover/party-personas.json`
- **Change**: Add `depth_levels` config section. Remove any `--party` references in description field. Add existing-project persona stubs (role-only) or keep in separate config.
- **Risk**: LOW — Additive. Existing persona structure untouched (C-003).

#### Files 4-10: Party Agent .md Files (7 files)
- `src/claude/agents/discover/domain-researcher.md`
- `src/claude/agents/discover/technical-scout.md`
- `src/claude/agents/discover/solution-architect-party.md`
- `src/claude/agents/discover/security-advisor.md`
- `src/claude/agents/discover/devops-pragmatist.md`
- `src/claude/agents/discover/data-model-designer.md`
- `src/claude/agents/discover/test-strategist.md`
- **Change**: Replace "party mode" with "deep discovery" in descriptions and When Used fields. Minor text updates.
- **Risk**: LOW — Cosmetic renaming only.

#### File 11: `src/claude/commands/tour.md`
- **Change**: Update any references to `--party` or `--classic` in tour guide text.
- **Risk**: LOW

#### File 12: `CLAUDE.md`
- **Change**: Update "Add BMAD party mode" checklist item. Update agent counts.
- **Risk**: LOW

### 2.3 New Files (4-6 Agent Definitions)

| File | Agent ID | Purpose | Depth Level |
|------|----------|---------|-------------|
| `src/claude/agents/discover/security-auditor.md` | D16 | Security posture analysis for existing projects | Standard |
| `src/claude/agents/discover/technical-debt-auditor.md` | D17 | Technical debt analysis for existing projects | Standard |
| `src/claude/agents/discover/performance-analyst.md` | D18 | Performance analysis for existing projects | Full |
| `src/claude/agents/discover/ops-readiness-reviewer.md` | D19 | Ops readiness review for existing projects | Full |

Optional: A separate `deep-discovery-config.json` for existing-project debate round configuration (similar to party-personas.json for new projects).

- **Risk**: LOW — New files with no impact on existing functionality.

### 2.4 Test Impact

#### File: `lib/party-personas.test.js`
- **Change**: Update test descriptions from "party" to "deep discovery". May need to add tests for depth_levels config if added to party-personas.json. Add tests for deprecated flag error messages.
- **Risk**: LOW

#### New Test File: `lib/deep-discovery.test.js` (or similar)
- **Change**: New tests for debate round configuration, new agent persona validation, discovery_context envelope extension validation, flag deprecation messages.
- **Risk**: LOW — Additive only.

### 2.5 Documentation Impact

#### File: `docs/AGENTS.md`
- **Change**: Update discover agent table from 12 to 16 agents. Add D16-D19 entries. Update "12 specialized sub-agents" text. Remove `--shallow` reference (stale from DE-004). Update existing project description to mention debate rounds.
- **Risk**: LOW

#### File: `README.md`
- **Change**: Update agent count badge from 36 to 40. Update "12 Discover agents" to "16 Discover agents". Update discovery description to mention deep discovery with debate rounds.
- **Risk**: LOW

#### File: `docs/ARCHITECTURE.md`
- **Change**: Potentially update discovery workflow diagram if one exists.
- **Risk**: LOW

---

## 3. Hook Impact Assessment

| Hook | Affected? | Reason |
|------|-----------|--------|
| `gate-blocker.cjs` | NO | Discover is pre-workflow; no phase gates involved |
| `iteration-corridor.cjs` | NO | No iteration requirements for discover phases |
| `constitution-validator.cjs` | NO | Not active during discover |
| `test-watcher.cjs` | NO | Guarded by active_workflow check |
| `menu-tracker.cjs` | NO | Guarded by active_workflow check |
| `model-provider-router.cjs` | NO | No model routing changes |
| `skill-delegation-enforcer.cjs` | NO | Discover is not an SDLC workflow phase |
| `delegation-gate.cjs` | NO | Discover is not an SDLC workflow phase |
| `discover-menu-guard.cjs` | MAYBE | Validates menu option count — may need update if menu structure changes significantly |
| `walkthrough-tracker.cjs` | MAYBE | References discovery_context — may need to handle new fields gracefully |
| `test-adequacy-blocker.cjs` | MAYBE | References discovery_context — additive fields should be safe |

**Hook Risk**: LOW — All hooks fail-open. New discovery_context fields are additive and will be ignored by existing hooks that don't reference them. The discover-menu-guard may need a minor update if the first-time menu options change.

---

## 4. Skills Manifest Impact

The skills-manifest.json does NOT currently have entries for D9-D15 (party mode agents from REQ-0006). The 4 new agents (D16-D19) will also need manifest entries. However, since skill enforcement is in `observe` mode and all discover agents are markdown-only, this is a documentation/observability concern, not a blocking issue.

**Recommendation**: Add D16-D19 to skills-manifest.json for observability. Optionally add D9-D15 as a separate cleanup task.

---

## 5. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Orchestrator .md exceeds context window | MEDIUM | MEDIUM | Keep debate round logic concise; use config files for debate structure |
| Debate rounds slow discovery significantly | LOW | MEDIUM | NFR-001 time limits; abort debate if round exceeds timeout |
| discover-menu-guard false positive after menu changes | LOW | LOW | Update guard's expected option count |
| New agents produce inconsistent output format | LOW | MEDIUM | Define output template in agent .md files |
| party-personas.json schema change breaks tests | LOW | MEDIUM | Additive changes only (C-003) |

---

## 6. Dependency Graph

```
discover.md (command) ──────────┐
                                v
discover-orchestrator.md ───> D1-D6 (existing, unchanged)
     │                     ├─> D16 (new: Security Auditor)
     │                     ├─> D17 (new: Technical Debt Auditor)
     │                     ├─> D18 (new: Performance Analyst, full only)
     │                     └─> D19 (new: Ops Readiness Reviewer, full only)
     │
     ├──> Debate Round 1: D1 + D16 [+ D19 if full]
     ├──> Debate Round 2: D5 + D2 + D1
     ├──> Debate Round 3: D6 + D16 + D2
     ├──> Debate Round 4 (full): All agents vs constitution
     └──> Debate Round 5 (full): All agents completeness + cross-review

party-personas.json ──> New project flow (renamed --party to --deep)
                    ──> Existing project debate config (additive)

state.json ──> discovery_context envelope (additive: security_posture, technical_debt, debate_summary)
```

---

## 7. Implementation Order Recommendation

1. **New agent files** (D16-D19) — independent, no dependencies
2. **discover.md** command — flag changes
3. **discover-orchestrator.md** — the main change (builds on 1 + 2)
4. **party-personas.json** — additive config
5. **7 party agent .md files** — cosmetic renames
6. **Tests** — schema validation, debate config, flag deprecation
7. **Documentation** — AGENTS.md, README.md, CLAUDE.md
8. **Hook review** — discover-menu-guard, walkthrough-tracker (minor, if needed)

---

## 8. Summary

| Metric | Value |
|--------|-------|
| **Blast radius** | MEDIUM-HIGH (20-23 files) |
| **Risk level** | MEDIUM |
| **New files** | 4-6 (agent definitions + optional config) |
| **Major modifications** | 2 (orchestrator + command) |
| **Minor modifications** | ~10 (flag renames, additive sections) |
| **Hook impact** | LOW (0-2 hooks may need minor updates) |
| **Test impact** | LOW (1 existing test file modified, 1 new test file) |
| **Breaking changes** | YES — `--party` and `--classic` flags removed (pre-release, C-004) |
| **Constitutional risk** | LOW — Article VIII compliance required for doc updates |
