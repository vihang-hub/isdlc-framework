# Impact Analysis: GH-64 - Agents Ignore Injected Gate Requirements

**Generated:** 2026-02-20
**Phase:** 02-impact-analysis
**Issue:** GH-64

---

## Executive Summary

This change modifies the gate requirements injection mechanism, agent files, constitutional text, hook block messages, and the delegation prompt structure. The blast radius is **medium** — 12 files across 4 modules, with low risk of regression due to the prompt-engineering nature of most changes.

---

## Sizing Metrics

| Metric | Value |
|--------|-------|
| **Files affected** | 12 |
| **Modules affected** | 4 |
| **Risk level** | medium |
| **Coupling** | low |
| **Coverage gaps** | 2 |

---

## File Impact Inventory

### Module 1: Gate Requirements Injector (Core)

| # | File | Change Type | FR | Risk | Rationale |
|---|------|-------------|-----|------|-----------|
| 1 | `src/claude/hooks/lib/gate-requirements-injector.cjs` | MODIFY | FR-001, FR-002, FR-007, FR-008 | Medium | Core logic: add PROHIBITED ACTIONS section, restructure format with separators, add logging, read prohibited_actions from config. 369 LOC, well-structured with fail-open design. |
| 2 | `src/claude/hooks/config/iteration-requirements.json` | MODIFY | FR-008 | Low | Add `prohibited_actions` array to phase configs (06-implementation, 16-quality-loop). Backward compatible — new optional field. |

### Module 2: Agent Files (Constraint Reinforcement)

| # | File | Change Type | FR | Risk | Rationale |
|---|------|-------------|-----|------|-----------|
| 3 | `src/claude/agents/05-software-developer.md` | MODIFY | FR-004 | Low | Add inline git prohibition text near line 29 (currently just a cross-reference to CLAUDE.md). |
| 4 | `src/claude/agents/16-quality-loop-engineer.md` | MODIFY | FR-004 | Low | Same inline prohibition treatment. Only 2 agents reference Git Commit Prohibition. |

### Module 3: Constitutional & Prompt Engineering

| # | File | Change Type | FR | Risk | Rationale |
|---|------|-------------|-----|------|-----------|
| 5 | `docs/isdlc/constitution.md` | MODIFY | FR-005 | Low | Clarify Article VII (line 147) to explicitly state commit management is orchestrator-only. |
| 6 | `src/claude/commands/isdlc.md` | MODIFY | FR-003 | Medium | Move GATE REQUIREMENTS INJECTION block from position 8 to position 4 in STEP 3d delegation prompt structure. 2142 LOC file, careful editing needed. |

### Module 4: Hook Enforcement (Feedback Loop)

| # | File | Change Type | FR | Risk | Rationale |
|---|------|-------------|-----|------|-----------|
| 7 | `src/claude/hooks/branch-guard.cjs` | MODIFY | FR-006 | Low | Update block message to reference gate requirements. 225 LOC, isolated change in `outputBlockResponse` call. |
| 8 | `src/claude/hooks/lib/common.cjs` | MODIFY | FR-006 | Low | Update `outputBlockResponse()` format to support gate requirement references. |

### Module 5: Tests

| # | File | Change Type | FR | Risk | Rationale |
|---|------|-------------|-----|------|-----------|
| 9 | `src/claude/hooks/tests/gate-requirements-injector.test.cjs` | CREATE | FR-001, FR-002, FR-008 | Low | New test file for injector changes. |
| 10 | `src/claude/hooks/tests/branch-guard.test.cjs` | MODIFY | FR-006 | Low | Add test for updated block message format. Existing test file (part of CJS test stream). |

### Sync Copies (gitignored runtime)

| # | File | Change Type | FR | Risk | Rationale |
|---|------|-------------|-----|------|-----------|
| 11 | `.claude/hooks/lib/gate-requirements-injector.cjs` | SYNC | — | Low | Runtime copy, synced from src/claude/. |
| 12 | `.claude/hooks/config/iteration-requirements.json` | SYNC | — | Low | Runtime copy, synced from src/claude/. |

---

## Entry Points

### Primary Entry: `buildGateRequirementsBlock()` in gate-requirements-injector.cjs
- Called by: STEP 3d in isdlc.md (Phase-Loop Controller)
- Input: phaseKey, artifactFolder, workflowType, projectRoot
- Output: formatted text block (string)
- Change: Add PROHIBITED ACTIONS section, restructure format, add logging

### Secondary Entry: STEP 3d Delegation Prompt in isdlc.md
- Called by: Phase-Loop Controller (every phase delegation)
- Change: Reorder injection blocks so gate requirements appear before task instructions

### Tertiary Entry: `outputBlockResponse()` in common.cjs
- Called by: branch-guard.cjs on commit block
- Change: Accept optional gate requirement reference parameter

---

## Dependency Analysis

```
iteration-requirements.json
  └── gate-requirements-injector.cjs (reads prohibited_actions)
        └── isdlc.md STEP 3d (injects block into prompt)
              └── Phase agents (read block in delegation prompt)

branch-guard.cjs
  └── common.cjs outputBlockResponse() (sends block message)
        └── Phase agents (read block error in tool result)
```

**Coupling assessment: LOW** — Changes are additive (new config field, new section in existing block, new parameter to existing function). No existing function signatures change in breaking ways.

---

## Risk Assessment

### High Risk Areas
None — all changes are additive prompt/format engineering.

### Medium Risk Areas
1. **isdlc.md STEP 3d reordering** (FR-003): Moving injection blocks in a 2142-line markdown file requires careful editing. Risk: accidentally breaking other injection blocks.
2. **gate-requirements-injector.cjs restructure** (FR-001/FR-002): Changing output format may break snapshot tests if any exist.

### Low Risk Areas
- Agent file edits (text additions only)
- Constitution clarification (text edit only)
- Config file additions (new optional fields)
- Hook message updates (text changes)

---

## Coverage Gaps

1. **gate-requirements-injector.cjs**: No dedicated test file exists. Tests should be created (FR-001, FR-002, FR-008 all need test coverage).
2. **isdlc.md prompt ordering**: No automated test validates injection order. Verification is manual via workflow execution.

---

## Blast Radius Summary

- **Direct changes**: 10 source files + 2 sync copies = 12 files
- **Modules**: 4 (injector, agents, constitutional/prompt, hooks)
- **Test files**: 1 create + 1 modify
- **Breaking changes**: None (all additive)
- **Deployment risk**: Low (prompt engineering + config changes)

---

## Recommendation

**Proceed with standard workflow.** The change set is well-contained within the gate requirements injection subsystem. The primary risk is in isdlc.md editing (large file) and ensuring the injector restructure maintains backward compatibility. All changes are additive — no function signatures or API contracts change.
