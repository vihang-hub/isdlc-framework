# Quick Scan: REQ-0023 Three-Verb Backlog Model

**Feature**: Three-verb backlog model (add/analyze/build) — unify backlog management around three natural verbs, eliminate Phase A/B naming, redesign command surface and intent detection
**Scanned**: 2026-02-18
**Source**: BACKLOG.md item 16.1, GitHub Issue #19

## Scope Estimate

**Estimated Size**: Standard (10-15 files modified)
**Risk Level**: Medium — command surface redesign affects UX contract, multiple hook files reference Phase A

## Key Files Identified

### Primary Changes (command surface redesign)

| File | Change Type | Impact |
|------|-------------|--------|
| `src/claude/commands/isdlc.md` | Major rewrite | Replace SCENARIO 5 (Phase A), `/isdlc analyze`, `/isdlc start` with `add`, `analyze`, `build` verbs. Remove backlog picker. Redesign Phase-Loop Controller action routing. |
| `CLAUDE.md` | Moderate rewrite | Rewrite intent detection table: replace Feature/Fix split with Add/Analyze/Build verbs. Update signal words. |
| `src/claude/agents/00-sdlc-orchestrator.md` | Moderate rewrite | Remove BACKLOG PICKER section. Simplify SCENARIO 3/4 menus. Update commands list. |
| `src/claude/CLAUDE.md.template` | Minor update | Mirror CLAUDE.md intent detection changes for new installs. |

### Hook Changes (Phase A references)

| File | Change Type | Impact |
|------|-------------|--------|
| `src/claude/hooks/skill-delegation-enforcer.cjs` | Minor | Update `EXEMPT_ACTIONS` set: replace `'analyze'` with new exempt verbs (add, analyze run inline). |
| `src/claude/hooks/gate-blocker.cjs` | Review | Check for Phase A references in gate logic. |
| `src/claude/hooks/menu-halt-enforcer.cjs` | Review | Check for analyze/start action references. |
| `src/claude/hooks/lib/common.cjs` | Minor | Review PHASE_AGENT_MAP; no Phase A entries expected (Phase A was outside workflow machinery). |

### Schema Changes

| File | Change Type | Impact |
|------|-------------|--------|
| `docs/requirements/*/meta.json` | Schema update | Replace `phase_a_completed` field with analysis status enum. |
| `.isdlc/config/workflows.json` | No change expected | Workflow definitions unchanged (add/analyze/build map to existing feature/fix workflows). |

### Documentation / Backlog

| File | Change Type | Impact |
|------|-------------|--------|
| `BACKLOG.md` | Format update | Add analysis status markers: `[ ]` raw, `[~]` partial, `[A]` analyzed, `[x]` completed. |

## Keyword Matches

- "Phase A" / "Phase B": 50+ occurrences in isdlc.md, 2 in skill-delegation-enforcer.cjs
- "backlog picker": 6 occurrences in 00-sdlc-orchestrator.md
- `/isdlc analyze`: 12 occurrences across isdlc.md
- `/isdlc start`: 10 occurrences across isdlc.md
- `meta.json`: 15+ occurrences in isdlc.md
- `phase_a_completed`: 8 occurrences in isdlc.md

## Dependencies

- Items 16.2 (roundtable agent), 16.3 (elaboration mode), 16.4 (transparent critic/refiner), 16.5 (build auto-detection) depend on this item
- Subsumes: 8.1, 11.2/BUG-0022, 12.2/BUG-0024, 12.3, 12.4, 14.2/BUG-0028

## Risks

1. **Breaking existing workflows**: Users who have in-progress Phase A artifacts (meta.json with phase_a_completed) need migration path
2. **Hook compatibility**: skill-delegation-enforcer has EXEMPT_ACTIONS tied to "analyze" -- must update
3. **Test coverage**: Existing tests reference Phase A patterns -- test updates needed
4. **BACKLOG.md format change**: Need backward compatibility for existing `[ ]`/`[x]` markers
