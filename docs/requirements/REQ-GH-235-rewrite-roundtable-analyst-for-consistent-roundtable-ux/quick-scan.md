# Quick Scan — REQ-GH-235

**Slug**: REQ-GH-235-rewrite-roundtable-analyst-for-consistent-roundtable-ux
**Codebase Hash**: 95a54cb
**Last Updated**: 2026-04-05

---

## 1. Scope

**Classification**: **Large** (epic-tier, deferred to standard execution)

**Rationale**: 987-line prompt rewrite + sibling prompt rewrite + runtime composition module + 3 new hooks + 4 updated hooks + 16 tests (7 new feature + 1 new bug + 8 updated) + documentation across ~43 files.

---

## 2. Keywords

| Keyword | Hits | Key Files |
|---|---|---|
| roundtable-analyst | 40 | `src/claude/agents/roundtable-analyst.md`, `src/claude/commands/isdlc.md`, tests/prompt-verification/* |
| confirmation | 80+ | roundtable-analyst.md, bug-roundtable-analyst.md, hooks/output-format-validator.cjs |
| persona | 200+ | persona-*.md files, hooks/*.cjs, tests/* |
| rendering mode | 30+ | roundtable-analyst.md, hooks/conversational-compliance.cjs |
| role_type | 20+ | persona-*.md frontmatter, hooks/persona-loader tests |
| PRESENTING_ | 30+ | roundtable-analyst.md, bug-roundtable-analyst.md |
| ROUNDTABLE_CONTEXT | 10+ | isdlc.md, common.cjs, session-cache infra |

---

## 3. File Count

| Category | Count | Details |
|---|---|---|
| Prompt rewrites | 2 | roundtable-analyst.md, bug-roundtable-analyst.md |
| Persona files updated | 1 | persona-domain-expert.md (template) |
| New core modules | 1 | src/core/roundtable/runtime-composer.js |
| Modified core/command | 1 | src/claude/commands/isdlc.md |
| New hooks | 3 | tasks-as-table, participation-gate, extension-composer |
| Updated hooks | ~4 | conversational-compliance, output-format-validator, menu-halt-enforcer, + audit-driven |
| New hook tests | 3 | one per new hook |
| New prompt-verification tests | 8 | 7 feature + 1 bug |
| Updated prompt-verification tests | 8 | existing tests updated for new structure |
| Updated core/hook unit tests | ~4 | updated alongside hook changes |
| Documentation | 3 | CLAUDE.md, docs/AGENTS.md, persona-authoring-guide.md |
| Config | 1 | .claude/settings.json (register new hooks) |
| Runtime composer tests | 1 | tests/core/roundtable/runtime-composer.test.js |

**Total affected**: ~43 files

**Confidence**: High — preservation inventory + existing codebase scans provide comprehensive coverage.

---

## 4. Final Scope

**Classification**: Large / Epic (deferred to standard execution)

**Summary**: This is a cross-cutting rewrite affecting prompts, runtime composition, hooks, tests, and documentation. The scope is justified by:
1. Structural drift in the 987-line prompt creating dogfooding failures
2. User requirement for scope C hook alignment (audit + update + extend)
3. Parallel rewrite of sibling bug-roundtable prompt to prevent asymmetric drift
4. New runtime composition logic needed for plugin-based persona extensibility

The scope is bounded by explicit out-of-scope items (see requirements-spec.md §8) and does not include sprawl detection (deferred to separate REQ per user decision).
