# Architecture Overview — REQ-GH-235

**Slug**: REQ-GH-235-rewrite-roundtable-analyst-for-consistent-roundtable-ux
**Last Updated**: 2026-04-05

---

## 1. Architecture Options

### Option A: Prompt Architecture Pattern

| Option | Summary | Pros | Cons | Pattern Alignment | Verdict |
|---|---|---|---|---|---|
| Patch-only | Targeted edits to current file | Low risk, preserves proven wording | Accumulates scar tissue; structural overlap persists | No precedent in iSDLC | Eliminated |
| Preservation-driven rewrite | Full rewrite against snapshot + inventory | Clean structure, forces justification of each section, reduces drift surface | Higher upfront risk | Matches GH-234 strict-enforcement philosophy | **Selected** |
| Greenfield rewrite | Discard current file, write new from requirements only | Fastest structural cleanup | Guaranteed loss of memory-rule behaviors | — | Eliminated |

### Option B: Persona Promotion Mechanism

| Option | Summary | Pros | Cons | Pattern Alignment | Verdict |
|---|---|---|---|---|---|
| Edit roundtable-analyst.md directly | User modifies framework prompt for custom personas | Simple, one file to change | Breaks framework-update safety; user edits clobbered | Doesn't match preserve-user-artifacts pattern | Eliminated |
| Separate roster config file | Promotion declared in `.isdlc/config.json` | Explicit activation | Duplicates persona-level metadata across two files | Doesn't match existing persona-file-as-unit pattern | Eliminated |
| Frontmatter + runtime composition (plugin model) | Promoted personas declare ownership in their own persona-*.md frontmatter; runtime composes effective state machine | Industry-standard (VS Code, ESLint, Nuxt); extends existing `role_type` convention; survives framework updates | Requires runtime composition logic | Matches existing `role_type: contributing` pattern | **Selected** |

### Option C: Hook Alignment Scope

| Option | Summary | Pros | Cons | Verdict |
|---|---|---|---|---|
| Audit-only | Document misalignment without fixing | Smallest REQ | Drift persists | Eliminated |
| Audit + update | Fix drift; no new hooks | Balanced | Doesn't enforce new rules at runtime | Eliminated |
| Audit + update + extend (scope C) | Full alignment + new hooks for new rules | Strongest runtime contract; prose-only enforcement insufficient | Larger REQ; more tests | **Selected** (user choice) |

---

## 2. Selected Architecture

### ADR-001: Preservation-driven behavior-first rewrite
- **Status**: Accepted
- **Context**: 987-line prompt has accumulated structural overlap mixing behavior contract, runtime adapter notes, dormant future design, and UX rules. Dogfooding failures: clarification-to-artifact shortcuts, template drift, tasks-confirmation collapse to bullets, repeated rules across sections.
- **Decision**: Rewrite from scratch against preservation inventory + snapshot baseline. Organize around behavior contract → state machine → appendices.
- **Rationale**: Solo-user dogfooding eliminates rollback coordination cost. Preservation inventory captures tacit behaviors piecemeal patches would preserve as dead code. Every surviving section must justify its existence.
- **Consequences**: One-time regression risk (mitigated by 16-test safety net); long-term drift reduction; clearer main path.

### ADR-002: State-local template authority
- **Status**: Accepted
- **Context**: Current §2.5.5 centralizes template bindings far from the state machine (§2.5.1), enabling drift between state and template.
- **Decision**: Bind template references inline at each PRESENTING_* state in the state machine section.
- **Rationale**: Template drift is the #1 dogfooding failure mode. Co-location eliminates distance.
- **Consequences**: Minor textual redundancy across states; enforced via prompt-verification test.

### ADR-003: Plugin/contribution model for persona extensibility
- **Status**: Accepted
- **Context**: Users need to extend roundtable with custom personas without editing framework files.
- **Decision**: Promoted personas declare ownership in their own frontmatter; runtime composes effective state machine at analyze dispatch time, extending existing `ROUNDTABLE_CONTEXT` session-cache loading pattern.
- **Rationale**: Industry-standard extension pattern (VS Code contributions, ESLint plugins, Nuxt modules). Survives framework updates. Reuses existing persona-loading infrastructure. Added personas default to contributing (zero-touch for current files).
- **Consequences**: New frontmatter schema fields; runtime composition logic; conflict resolution required when two promoted personas target same insertion point.

### ADR-004: Hook audit + update + extend (scope C)
- **Status**: Accepted
- **Context**: Runtime hooks enforce behavior; prompt and hooks must agree. Prompt-verification tests alone don't catch runtime shortcuts.
- **Decision**: Audit 7 relevant hooks, update any whose assumptions break, add 3 new hooks for rules the rewrite introduces.
- **Rationale**: User preference for strongest runtime contract. Runtime enforcement stronger than prose.
- **Consequences**: +10-15 tasks; parallel hook work track; stronger overall contract.

### ADR-005: Parallel rewrite of bug-roundtable-analyst.md
- **Status**: Accepted
- **Context**: Sibling prompt has identical structural issues (behavior contract + adapter notes + dormant design mixed).
- **Decision**: Rewrite both prompts in the same REQ using shared architecture.
- **Rationale**: Avoids asymmetric drift; shared architecture transfers cleanly; second rewrite is ~50% cost of first.
- **Consequences**: Larger REQ; +1 prompt-verification test file; shared pattern benefits both prompts.

### ADR-006: Appendix separation for adapter/dormant content
- **Status**: Accepted
- **Context**: Main execution path diluted by runtime adapter details (Agent Teams, file discovery, enhanced search, meta.json schemas).
- **Decision**: Move dormant/adapter content to 3 labeled appendices (A: Agent Teams, B: Runtime Adapter, C: Meta/Search Internal Data).
- **Rationale**: Main path should be UX-contract-focused; dormant/runtime details remain documented without competing for attention.
- **Consequences**: Clearer main path; explicit "current vs future" separation.

---

## 3. Technology Decisions

| Technology | Version | Rationale | Alternatives Considered |
|---|---|---|---|
| YAML frontmatter | existing | Consistent with current persona files | TOML/JSON — rejected, codebase convention mismatch |
| Session-cache composition | existing | Runtime already loads personas via `ROUNDTABLE_CONTEXT` | Per-dispatch Read — rejected, adds latency |
| Prompt-verification test framework | existing | 16+ existing tests prove pattern | New framework — rejected, toolchain fragmentation |
| Hook framework `.cjs` | existing | 30 hooks already use CommonJS per Article XIII | ESM-based — rejected per Article XIII |
| ESM core modules `.js` | existing | `src/core/` pattern established in GH-231 | Hook-directly — rejected per Article XIII separation |

**Zero new dependencies added.**

---

## 4. Integration Architecture

### Integration points

| ID | Source | Target | Interface Type | Data Format | Error Handling |
|---|---|---|---|---|---|
| IP-001 | `persona-*.md` frontmatter | analyze handler | File read | YAML | Fail-open — unknown fields ignored; contributing default |
| IP-002 | analyze handler | runtime-composer | ESM function call via bridge | `{defaults, personas[]}` → `effectiveStateMachine` | Conflict detected → warn, first-declared wins |
| IP-003 | runtime-composer | roundtable execution | Inline dispatch | Composed state machine in memory | N/A |
| IP-004 | roundtable execution | hooks (runtime) | stdin JSON | Standard hook payload | Hook fail-open per Article X |
| IP-005 | prompt-verification tests | CI | Jest test runner | Test assertions against prompt text | Test failure blocks merge |
| IP-006 | `.isdlc/config.json` | future sprawl detection | Config read | JSON | Fail-open — defaults applied on missing keys |

### Data flow (analyze-time composition)

```
persona-*.md files
  (frontmatter: role_type, owns_state, template, inserts_at)
        │
        ▼
analyze handler (src/claude/commands/isdlc.md)
        │
        ▼
ROUNDTABLE_CONTEXT (session cache, existing)
        │
        ▼
runtime-composer (src/core/roundtable/runtime-composer.js, NEW)
  input:  defaultStateMachine, personaFiles[]
  output: effectiveStateMachine
        │
        ▼
inline roundtable execution (existing)
        │
        ▼
hooks enforce contract
  (conversational-compliance, output-format-validator,
   tasks-as-table-validator [NEW], participation-gate-enforcer [NEW],
   persona-extension-composer-validator [NEW], others)
```

### Synchronization model
- Runtime composition happens per `/isdlc analyze` invocation (not cached)
- Persona frontmatter changes are picked up at next invocation
- No concurrency concerns (single-threaded analyze execution)

---

## 5. Summary

**Key decisions**:
| Decision | Rationale |
|---|---|
| Preservation-driven rewrite | Clean structure + inventory safety net |
| State-local template authority | Eliminates #1 drift vector |
| Plugin/contribution persona model | Industry-standard, upgrade-safe |
| Scope C hook alignment | Runtime + static enforcement |
| Parallel bug-roundtable rewrite | Prevents asymmetric drift |
| Appendix separation | UX-contract focus in main path |

**Trade-offs accepted**:
- One-time rewrite regression risk vs. long-term drift reduction
- Larger REQ (scope C hooks) vs. stronger runtime contract
- New frontmatter schema vs. upgrade-safe user customization

**Go/no-go**: **GO** — architecture is consistent with existing iSDLC patterns, extends proven infrastructure, and provides clear path to runtime enforcement.
