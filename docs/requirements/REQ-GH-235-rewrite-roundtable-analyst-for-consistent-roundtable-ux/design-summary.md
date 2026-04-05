# Design Summary — REQ-GH-235

**Slug**: REQ-GH-235-rewrite-roundtable-analyst-for-consistent-roundtable-ux
**Last Updated**: 2026-04-05

---

## Executive Summary

This REQ rewrites `src/claude/agents/roundtable-analyst.md` (987 lines) and `src/claude/agents/bug-roundtable-analyst.md` into a behavior-first architecture with state-local template authority, first-class rendering modes, and plugin-based persona extensibility. The rewrite is accompanied by a runtime composer module (`src/core/roundtable/runtime-composer.js`), 3 new hooks, 7 new prompt-verification tests, 8 updated existing prompt-verification tests, hook audit + updates, and documentation alignment.

---

## Key Design Decisions

| Decision | Resolution |
|---|---|
| Prompt architecture | Preservation-driven rewrite against inventory + snapshot baseline |
| Target structure | 12-15 main sections + 3 appendices (down from current 10 main sections + nested sub-sections) |
| Template authority | State-local, inline per PRESENTING_* state |
| Persona extensibility | Plugin/contribution model via persona-file frontmatter; runtime composer |
| Extension-point taxonomy | 5 named points: `before:requirements`, `after:{requirements, architecture, design, tasks}` |
| Conflict resolution | First-declared wins + warning (fail-open per Article X) |
| Hook alignment | Scope C: audit + update + extend (3 new hooks, ~4 updated hooks) |
| Bug-roundtable | Parallel rewrite in same REQ; shares architecture |
| Rendering modes | Elevated to §5 of rewritten prompt with shared-invariants block |
| Silent mode gates | §14 participation requirements are internal-only (no surface cues) |

---

## Module Boundaries

**Rewritten prompts** (markdown, behavior contracts):
- `src/claude/agents/roundtable-analyst.md` — feature analysis roundtable
- `src/claude/agents/bug-roundtable-analyst.md` — bug analysis roundtable

**Runtime composition** (ESM, `src/core/`):
- `src/core/roundtable/runtime-composer.js` — compose effective state machine from defaults + persona declarations

**Enforcement** (CommonJS, `src/claude/hooks/`):
- `tasks-as-table-validator.cjs` — PostToolUse enforcement
- `participation-gate-enforcer.cjs` — Stop hook
- `persona-extension-composer-validator.cjs` — PreToolUse validation
- Updates to: `conversational-compliance.cjs`, `output-format-validator.cjs`, `menu-halt-enforcer.cjs`, others (audit-driven)

**Persona schema** (frontmatter extensions):
- `src/claude/agents/persona-domain-expert.md` — template updated with promotion fields
- Existing 4 contributing personas unchanged (zero-touch migration)

**Tests**:
- 8 new prompt-verification tests (7 feature + 1 bug)
- 8 existing prompt-verification tests updated
- 3 new hook tests
- Runtime composer unit tests

---

## Cross-Check Results

| Check | Status |
|---|---|
| FRs referenced in tasks all exist in requirements-spec | ✓ |
| Integration points in architecture match interface-spec | ✓ |
| Module boundaries align with ADRs | ✓ |
| Confidence indicators consistent across artifacts | ✓ |
| No circular dependencies | ✓ |
| All 10 FRs covered by at least 1 task | ✓ |
| All 40 ACs covered by at least 1 task | ✓ |
| Extension-point schema consistent with composer interface | ✓ |

---

## Open Questions (deferred to Build)

- Q1: Conflict resolution — should the composer also support priority fields on personas to resolve insertion conflicts more richly than first-wins? (deferred: monitor during Phase 06, consider for follow-up REQ)
- Q2: Participation-gate hook trigger — Stop hook vs PostToolUse? Current design: Stop. Revisit if performance issues surface.
- Q3: Additional extension points beyond 5 named — expand taxonomy if user personas need custom insertion points. Start conservative.

---

## Implementation Readiness

**Ready for Build** (Phase 05 → Phase 06):
- All FRs have ACs with measurable outcomes
- All tasks have file paths and dependency annotations
- Blast radius documented (~43 files affected)
- Risk mitigations identified for all medium+ risks
- Test coverage plan covers all 40 ACs

**Prerequisites confirmed**:
- Snapshot exists at `src/claude/agents/roundtable-analyst.snapshot-2026-04-05.md`
- Preservation inventory complete
- Existing infrastructure (prompt-verification test suite, hook framework, session cache) all proven

**No blockers.**
