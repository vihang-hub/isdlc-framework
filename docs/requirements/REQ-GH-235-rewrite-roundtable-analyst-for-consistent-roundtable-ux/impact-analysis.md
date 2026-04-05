# Impact Analysis — REQ-GH-235

**Slug**: REQ-GH-235-rewrite-roundtable-analyst-for-consistent-roundtable-ux
**Codebase Hash**: 95a54cb
**Last Updated**: 2026-04-05

---

## 1. Blast Radius

### Tier 1 — Direct modifications

| File | Module | Change Type | Requirement Traces |
|---|---|---|---|
| `src/claude/agents/roundtable-analyst.md` | agents | REWRITE | FR-001, FR-002, FR-003, FR-004, FR-005, FR-006 |
| `src/claude/agents/bug-roundtable-analyst.md` | agents | REWRITE | FR-009 |
| `src/claude/agents/persona-domain-expert.md` | agents | MODIFY | FR-005 (add promotion schema to template) |
| `src/claude/commands/isdlc.md` | commands | MODIFY | FR-005 (wire composer into analyze handler) |
| `CLAUDE.md` | docs | MODIFY | FR-010 |
| `docs/AGENTS.md` | docs | REGENERATE | FR-010 |
| `docs/isdlc/persona-authoring-guide.md` | docs | MODIFY | FR-010 |
| `src/claude/hooks/conversational-compliance.cjs` | hooks | MODIFY | FR-008 |
| `src/claude/hooks/output-format-validator.cjs` | hooks | MODIFY | FR-008 |
| `src/claude/hooks/menu-halt-enforcer.cjs` | hooks | MODIFY | FR-008 |
| `src/claude/hooks/*.cjs` (others, audit-driven) | hooks | MODIFY | FR-008 |

### Tier 1 — New files

| File | Module | Purpose | Requirement Traces |
|---|---|---|---|
| `src/core/roundtable/runtime-composer.js` | core | Runtime state-machine composition | FR-005 |
| `tests/core/roundtable/runtime-composer.test.js` | tests | Composer unit tests | FR-005 |
| `src/claude/hooks/tasks-as-table-validator.cjs` | hooks | Enforce tasks render as table | FR-003, FR-008 |
| `src/claude/hooks/participation-gate-enforcer.cjs` | hooks | §14 pre-confirmation gates | FR-003, FR-008 |
| `src/claude/hooks/persona-extension-composer-validator.cjs` | hooks | Validate promoted persona frontmatter | FR-005, FR-008 |
| `src/claude/hooks/tests/tasks-as-table-validator.test.cjs` | tests | Hook test | FR-008 |
| `src/claude/hooks/tests/participation-gate-enforcer.test.cjs` | tests | Hook test | FR-008 |
| `src/claude/hooks/tests/persona-extension-composer-validator.test.cjs` | tests | Hook test | FR-008 |
| `tests/prompt-verification/anti-shortcut-enforcement.test.js` | tests | FR-007 AC-01 | FR-007 |
| `tests/prompt-verification/state-local-template-binding.test.js` | tests | FR-007 AC-02 | FR-007 |
| `tests/prompt-verification/confirmation-sequencing-v2.test.js` | tests | FR-007 AC-03 | FR-007 |
| `tests/prompt-verification/rendering-mode-invariants.test.js` | tests | FR-007 AC-04 | FR-007 |
| `tests/prompt-verification/persona-extension-composition.test.js` | tests | FR-007 AC-05 | FR-007 |
| `tests/prompt-verification/participation-gate.test.js` | tests | FR-007 AC-06 | FR-007 |
| `tests/prompt-verification/tasks-render-as-table.test.js` | tests | FR-007 AC-07 | FR-007 |
| `tests/prompt-verification/bug-roundtable-rewritten-contract.test.js` | tests | FR-009 AC-04 | FR-009 |

### Tier 2 — Transitive impact (existing files updated)

| File | Module | Impact | Change Type |
|---|---|---|---|
| `tests/prompt-verification/template-confirmation-enforcement.test.js` | tests | Update assertions for state-local bindings | MODIFY |
| `tests/prompt-verification/provider-neutral-analysis-contract.test.js` | tests | Update assertions for new structure | MODIFY |
| `tests/prompt-verification/confirmation-sequence.test.js` | tests | Update for state machine changes | MODIFY |
| `tests/prompt-verification/inline-roundtable-execution.test.js` | tests | Update for rewrite | MODIFY |
| `tests/prompt-verification/orchestrator-conversational-opening.test.js` | tests | Update for rewrite | MODIFY |
| `tests/prompt-verification/depth-control.test.js` | tests | Update for new section structure | MODIFY |
| `tests/prompt-verification/analyze-flow-optimization.test.js` | tests | Update references | MODIFY |
| `tests/prompt-verification/parallel-execution.test.js` | tests | Update references | MODIFY |
| `src/claude/hooks/tests/conversational-compliance.test.cjs` | tests | Update alongside hook changes | MODIFY |
| `src/claude/hooks/tests/output-format-validator.test.cjs` | tests | Update alongside hook changes | MODIFY |
| `.claude/settings.json` | config | Register 3 new hooks | MODIFY |

### Tier 3 — Side effects

| Area | Potential Impact | Risk Level |
|---|---|---|
| `src/claude/agents/persona-*.md` (4 contributing personas) | Zero-touch migration expected; verify during audit | Low |
| Session cache ROUNDTABLE_CONTEXT loading | Composer extends existing pattern; verify cache rebuild works | Low |
| `bin/rebuild-cache.js` | May need to include promoted persona frontmatter validation | Low |
| Existing analyze flow tests | May surface assumptions that break post-rewrite | Medium |

### Summary metrics

- Direct modifications: 11 files
- New files: 17 files
- Transitive modifications: 11 files
- Side-effect verification: ~4 files
- **Total affected: ~43 files** (within earlier estimate of 38-51)

---

## 2. Entry Points

**Recommended implementation order**:

1. **Runtime composer + schema (FR-005)** — unblocks persona model in the rewritten prompt
2. **Rewritten `roundtable-analyst.md` skeleton (FR-001)** — establishes the new structure
3. **State machine with template bindings (FR-002)** — core of the UX contract
4. **§14 anti-shortcut rules (FR-003)** — lock the runtime contract
5. **Rendering modes + appendices (FR-004, FR-006)** — fill out the structure
6. **7 prompt-verification tests (FR-007)** — validate the contract statically
7. **Hook audit (FR-008 part 1)** — discover drift
8. **Hook updates + 3 new hooks (FR-008 part 2)** — runtime enforcement
9. **bug-roundtable-analyst parallel rewrite (FR-009)** — apply same pattern
10. **Documentation (FR-010)** — final alignment pass

---

## 3. Implementation Order with Parallelism

| Order | Tasks | Description | Risk | Parallel? | Depends On |
|---|---|---|---|---|---|
| 1 | T012-T017 | Runtime composer + schema + extension points | Medium | — | — |
| 2 | T004-T010, T018-T022 | Prompt rewrite sections | Medium | Partial within rewrite | T012-T017 |
| 3 | T023-T029 | New prompt-verification tests | Low | Yes | T004-T022 |
| 4 | T032 | Hook audit report | Low | — | T004-T022 |
| 5 | T033-T037 | Hook updates + 8 existing test updates | Medium | Yes | T032 |
| 6 | T038-T042 | 3 new hooks + tests + registration | Medium | Partial | T032 |
| 7 | T011, T030 | bug-roundtable rewrite + test | Medium | Yes | T004-T010 |
| 8 | T043-T045 | Documentation | Low | Yes | All code complete |

---

## 4. Risk Zones

| ID | Risk | Area | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| R-001 | Loss of tacit behavior | roundtable-analyst.md rewrite | Medium | High | Snapshot + inventory + 7 new tests |
| R-002 | Hook regressions | hook update track | Medium | Medium | Audit report + existing hook tests |
| R-003 | Schema churn | persona frontmatter extensions | Medium | Low | Conservative initial schema |
| R-004 | Composer breaks existing flow | `src/core/roundtable/runtime-composer.js` | Low | High | Composer extends ROUNDTABLE_CONTEXT pattern; contributing personas unchanged |
| R-005 | State machine drift | §7 state machine section | Medium | High | State-local template bindings enforced via test |
| R-006 | bug-roundtable divergence | FR-009 parallel track | Low | Medium | Shared architecture applied consistently |
| R-007 | Prompt-verification test flakiness | 16 tests total | Low | Low | Existing infrastructure proven |

---

## 5. Test Coverage Assessment

**Covered areas**:
- 8 existing prompt-verification tests (updated)
- 7 new feature tests (FR-007)
- 1 new bug test (FR-009)
- 3 new hook tests (FR-008)
- Runtime composer unit tests
- Existing hook tests (updated where needed)

**Coverage gap**: No integration test simulating a full analyze-time composition with a promoted persona — consider adding as stretch goal in Phase 06.

---

## 6. Summary

- **Total affected files**: ~43 (2 rewrites + 17 new + 11 updates + 13 secondary)
- **Overall risk**: Medium — substantial rewrite, but strong test safety net
- **Overall recommendation**: PROCEED — preservation inventory + 16 tests + snapshot provide adequate regression defense
- **Key concerns**: R-001 (tacit behavior loss), R-005 (state machine drift) — both mitigated by comprehensive test coverage
