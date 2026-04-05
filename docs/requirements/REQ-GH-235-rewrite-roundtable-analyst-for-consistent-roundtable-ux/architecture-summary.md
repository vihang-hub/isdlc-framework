# Architecture Summary — REQ-GH-235

**Slug**: REQ-GH-235-rewrite-roundtable-analyst-for-consistent-roundtable-ux
**Accepted**: 2026-04-05

---

## Architecture Options

**Prompt Architecture**: Preservation-driven rewrite (Selected) vs patch-only (Eliminated) vs greenfield (Eliminated)

**Persona Promotion**: Frontmatter + runtime composition plugin model (Selected) vs edit-in-place (Eliminated) vs separate roster config (Eliminated)

**Hook Alignment**: Scope C audit + update + extend (Selected) vs audit-only (Eliminated) vs audit + update (Eliminated)

---

## Selected Architecture (ADRs)

- **ADR-001 Accepted**: Preservation-driven behavior-first rewrite — clean structure, forces justification of each section, snapshot + inventory defend against loss
- **ADR-002 Accepted**: State-local template authority — bindings inline at each PRESENTING_* state to eliminate drift from distant centralized section
- **ADR-003 Accepted**: Plugin/contribution model for persona extensibility — promoted personas declare in own frontmatter, runtime composes at dispatch, industry-standard pattern (VS Code, ESLint, Nuxt)
- **ADR-004 Accepted**: Hook audit + update + extend (scope C) — runtime enforcement stronger than prose, prompt-verification tests alone don't catch runtime shortcuts
- **ADR-005 Accepted**: Parallel rewrite of bug-roundtable-analyst.md — prevents asymmetric drift, shared architecture transfers cleanly
- **ADR-006 Accepted**: Appendix separation for adapter/dormant content — main path stays UX-contract-focused, dormant content remains documented

---

## Technology Decisions

| Technology | Version | Rationale |
|---|---|---|
| YAML frontmatter | existing | Consistent with current persona files |
| Session-cache composition | existing | Runtime already loads personas via ROUNDTABLE_CONTEXT |
| Prompt-verification test framework | existing | 16+ existing tests prove pattern |
| Hook framework `.cjs` | existing | 30 hooks already use CommonJS per Article XIII |
| ESM core modules `.js` | existing | `src/core/` pattern from GH-231 |

**Zero new dependencies added.**

---

## Integration Architecture

**Data flow**: `persona-*.md frontmatter → analyze handler → runtime-composer → effective state machine → roundtable execution → hooks enforce`

**Integration points**:
| ID | Source | Target | Interface | Data |
|---|---|---|---|---|
| IP-001 | persona-*.md frontmatter | analyze handler | File read | YAML |
| IP-002 | analyze handler | runtime-composer | ESM call via bridge | StateMachine + PersonaFile[] |
| IP-003 | runtime-composer | roundtable execution | Inline dispatch | Composed state machine |
| IP-004 | roundtable execution | hooks | stdin JSON | Standard hook payload |
| IP-005 | prompt-verification tests | CI | Jest runner | Test assertions |
| IP-006 | .isdlc/config.json | future sprawl detection | Config read | JSON (deferred REQ) |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Loss of tacit behavior during rewrite | Medium | High | Preservation inventory + snapshot + 7 new tests |
| Hook updates introduce regressions | Medium | Medium | Existing hook test suite + audit report |
| Extension-point schema churn post-ship | Medium | Low | Conservative initial schema |
| bug-roundtable parallel work expands REQ | Low | Medium | Shared architecture, ~50% cost of first rewrite |
| Runtime composition breaks existing persona loading | Low | High | Extends ROUNDTABLE_CONTEXT pattern; contributing unchanged |

---

## Summary

Architecture is consistent with existing iSDLC patterns (GH-231 unified config, GH-234 strict templates, ROUNDTABLE_CONTEXT session cache, Article XIII module boundaries). Extends proven infrastructure without introducing new dependencies. Provides clear path to both static (prompt-verification) and runtime (hooks) enforcement of the rewritten behavior contract.

**Go/no-go**: **GO**
