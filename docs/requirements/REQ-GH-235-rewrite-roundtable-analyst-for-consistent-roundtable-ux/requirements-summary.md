# Requirements Summary — REQ-GH-235

**Slug**: REQ-GH-235-rewrite-roundtable-analyst-for-consistent-roundtable-ux
**Accepted**: 2026-04-05

---

## Functional Requirements

**FR-001: Rewrite roundtable-analyst.md into behavior-first architecture** — preservation-driven rewrite producing a materially cleaner, layered prompt that retains all §2-7 inventory behaviors.
- AC-001-01: Snapshot preserved as baseline (already exists)
- AC-001-02: Rewritten file is materially smaller, layered, harder to shortcut
- AC-001-03: All §2-7 preserved behaviors from inventory retained verbatim
- Priority: Must | Confidence: High

**FR-002: Bind templates to confirmation states locally** — template authority is state-local, not distant.
- AC-002-01: Each PRESENTING_* state explicitly names its governing template inline
- AC-002-02: On-screen Tasks uses traceability.template.json
- AC-002-03: Written tasks.md uses tasks.template.json (separately specified)
- Priority: Must | Confidence: High

**FR-003: Enforce §14 anti-shortcut hard rules as contract** — roundtable experience is non-negotiable protocol, not style.
- AC-003-01: No collapse from first clarification to artifact generation
- AC-003-02: Before first confirmation, Maya scope + Alex codebase evidence + Jordan design implication (internal-only in silent mode)
- AC-003-03: Tasks confirmation renders traceability table, never bullets/prose
- AC-003-04: No artifact writes before staged confirmations except explicit early exit
- Priority: Must | Confidence: High

**FR-004: Elevate rendering modes to first-class with shared protocol invariants** — bulleted, conversational, silent surface near top of prompt with hard invariants.
- AC-004-01: All three modes defined early in rewritten prompt
- AC-004-02: Mode changes cannot alter confirmation order, Accept/Amend gating, template binding, anti-shortcut behavior, A&I handling, write timing, tier applicability
- AC-004-03: §14 participation gates are internal-only in silent mode
- Priority: Must | Confidence: High

**FR-005: Persona extensibility via plugin/contribution model** — promoted personas declare ownership in persona-file frontmatter; runtime composes effective state machine.
- AC-005-01: Added personas default to contributing
- AC-005-02: Contributing personas don't create new templates, domains, or confirmation stages
- AC-005-03: Promotion requires explicit persona frontmatter (role_type: primary, owns_state, template, inserts_at)
- AC-005-04: Runtime composes effective protocol from defaults + persona declarations at analyze dispatch time
- AC-005-05: Conflict resolution defined for two promoted personas targeting same insertion point
- AC-005-06: Existing contributing persona files work unchanged (zero-touch migration)
- Priority: Must | Confidence: High

**FR-006: Move dormant/adapter content to appendices** — main execution path is UX-contract-focused.
- AC-006-01: Agent Teams spawn/merge details → appendix
- AC-006-02: File discovery internals, enhanced search wiring, low-level meta.json schemas → appendix
- AC-006-03: Runtime resume semantics collapsed to single reference
- Priority: Must | Confidence: High

**FR-007: Ship 7 prompt-verification tests for new behavior contract**
- AC-007-01 anti-shortcut | AC-007-02 template binding | AC-007-03 confirmation sequencing | AC-007-04 rendering mode invariants | AC-007-05 persona extension composition | AC-007-06 participation gates | AC-007-07 tasks-render-as-table
- Priority: Must | Confidence: High

**FR-008: Hook audit + update + extend (scope C)** — runtime enforcement aligned with rewritten prompt.
- AC-008-01: Audit 7 relevant hooks, document alignment findings
- AC-008-02: Update hooks whose assumptions break
- AC-008-03: Add new hooks for new rules (tasks-as-table, §14 internal-satisfaction, persona extension composition)
- AC-008-04: All hook tests continue to pass or are updated alongside
- Priority: Must | Confidence: High

**FR-009: Parallel rewrite of bug-roundtable-analyst.md** — sibling prompt follows identical architecture.
- AC-009-01: Bug roundtable prompt uses same behavior-first structure
- AC-009-02: Same rendering modes, persona extensibility, state-local template authority
- AC-009-03: Bug-specific confirmations bind to bug templates
- AC-009-04: Bug prompt ships its own prompt-verification test coverage
- Priority: Must | Confidence: High

**FR-010: Update documentation alignment**
- AC-010-01: CLAUDE.md updated for persona extensibility model
- AC-010-02: docs/AGENTS.md regenerated
- AC-010-03: Persona authoring guide updated for extension-point schema
- Priority: Should | Confidence: Medium

---

## Assumptions and Inferences

- §14 new hard rules treated as enforceable contract (High)
- Runtime composition happens at analyze dispatch time (Medium)
- Default tier: epic, deferred to standard execution per workflow convention (High)
- Migration for existing contributing personas is zero-touch (High)
- Conflict resolution: first-declared wins + warn (Medium)

---

## Non-Functional Requirements

- Maintainability: materially smaller, layered prompt
- Testability: state machine and template bindings statically verifiable
- Backward compatibility: 8 existing persona files work without modification
- Upgrade safety: user promotion configs don't collide with framework updates
- Provider neutrality: Claude and Codex produce identical staged confirmations

---

## Out of Scope

- Changing the underlying analysis artifact set
- Activating true multi-agent execution
- Redesigning unrelated build/runtime hooks
- Building UI/CLI tooling for persona promotion
- Monorepo-specific persona overrides
- Sprawl/scatter detection (deferred to separate REQ)

---

## Prioritization

**Must Have**: FR-001 through FR-009
**Should Have**: FR-010
**Could Have**: (none)
**Won't Have**: see Out of Scope
