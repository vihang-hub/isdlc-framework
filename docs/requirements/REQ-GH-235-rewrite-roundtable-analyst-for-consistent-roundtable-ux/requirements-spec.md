# Requirements Specification — REQ-GH-235

**Slug**: REQ-GH-235-rewrite-roundtable-analyst-for-consistent-roundtable-ux
**Title**: Rewrite roundtable-analyst.md for consistent roundtable UX
**Source**: GitHub issue GH-235
**Status**: Analyzed
**Analysis Tier**: Epic (deferred to Standard execution)
**Last Updated**: 2026-04-05
**Codebase Hash**: 95a54cb

---

## 1. Business Context

### Problem
`src/claude/agents/roundtable-analyst.md` has grown to 987 lines through organic accumulation of features across REQ-0046 (depth sensing), REQ-0047 (contributing personas), REQ-0063 (memory), REQ-GH-212 (light tier), and GH-234 (template enforcement). The current structure interleaves behavior contract, runtime adapter notes, dormant future design, operational plumbing, and UX rendering rules in one prompt. This increases drift risk for both Claude Code and Codex execution.

### Recent dogfooding failures
- The assistant can shortcut from initial clarification into artifact generation instead of staying in the roundtable discussion loop
- Template authority is not always bound tightly enough to the active confirmation state
- On-screen task/traceability confirmations can drift from the intended template-shaped UX even when written artifacts are later validated
- Repeated rules and distant instructions make the prompt harder to follow consistently across providers

### Success metric
The rewritten prompt produces a consistent demo-style roundtable experience across Claude Code and Codex, with state-local template authority, explicit anti-shortcut enforcement, plugin-based persona extensibility, and stronger runtime enforcement via aligned hooks.

---

## 2. Stakeholders and Personas

### Primary user
Solo developer dogfooding iSDLC framework (zero external users currently — pre-1.0 alpha).

### Indirect stakeholders
- Future iSDLC adopters (Claude Code + Codex users)
- Persona authors who will extend the roundtable with custom perspectives

---

## 3. User Journeys

### Core journey: `/isdlc analyze "item"`
1. User invokes analyze on a backlog item
2. Maya opens with a single scope-shaping question, stops for input
3. Alex contributes codebase evidence after first user reply
4. Jordan surfaces design implications before first confirmation
5. Staged confirmations (Requirements → Architecture → Design → Tasks) — each presents a template-shaped on-screen summary
6. Each confirmation ends with Accept/Amend, stops for user decision
7. Artifacts written to disk only after final Accept (except explicit early exit)
8. Same experience reproduces across `bulleted`, `conversational`, `silent` rendering modes

### Extension journey: user promotes a persona
1. User creates or edits `persona-{name}.md` with promotion frontmatter (`role_type: primary`, `owns_state`, `template`, `inserts_at`)
2. Next `/isdlc analyze` invocation composes the effective state machine from defaults + user's persona declarations
3. The new confirmation state appears in sequence without editing `roundtable-analyst.md`
4. Framework updates to `roundtable-analyst.md` do not collide with user's persona declarations

---

## 4. Technical Context

- Dual-provider support: Claude Code + Codex (provider-neutral protocol with adapter notes)
- ESM core layer at `src/core/`, CommonJS hooks at `src/claude/hooks/*.cjs` (per Article XIII)
- Existing infrastructure reused:
  - Session-cache persona loading via `ROUNDTABLE_CONTEXT`
  - Hook framework with 30 registered hooks
  - Prompt-verification test suite (~16 existing tests)
  - `.isdlc/config.json` unified config (GH-231)
- Templates catalog at `src/isdlc/config/templates/` (GH-234 strict enforcement)

---

## 5. Quality Attributes and Risks

### Quality attributes

| Attribute | Priority | Threshold |
|---|---|---|
| Maintainability | Critical | Rewritten prompt materially smaller, layered (contract → state machine → appendices) |
| Testability | Critical | State machine and template bindings statically verifiable via prompt-verification tests |
| Backward compatibility | Must | Existing 8 persona files work without frontmatter modification |
| Upgrade safety | Must | User promotion configs live in persona files, don't collide with framework prompt updates |
| Provider neutrality | Critical | Claude Code and Codex produce identical staged-confirmation behavior |
| Anti-shortcut enforcement | Critical | Runtime + static verification prevents clarification-to-artifact collapse |

### Risks

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-001 | Loss of tacit behavior during rewrite | Medium | High | Preservation inventory + snapshot + 7 prompt-verification tests |
| R-002 | Hook updates introduce regressions | Medium | Medium | Existing hook test suite + audit alignment report |
| R-003 | Extension-point schema churn post-ship | Medium | Low | Conservative initial schema; incremental additions |
| R-004 | Bug-roundtable parallel work expands REQ | Low | Medium | Shared architecture, ~50% cost of first rewrite |
| R-005 | Runtime composition breaks existing persona loading | Low | High | Extends existing ROUNDTABLE_CONTEXT pattern; contributing unchanged |
| R-006 | Sprawl detection appetite creates scope creep | Low | Medium | Deferred to separate REQ per user decision |

---

## 6. Functional Requirements

### FR-001: Rewrite roundtable-analyst.md into behavior-first architecture
**Description**: Preservation-driven rewrite producing a materially cleaner, layered prompt that retains all §2-7 inventory behaviors verbatim while eliminating structural overlap.
**Priority**: Must
**Confidence**: High
**Acceptance Criteria**:
- AC-001-01: Current file snapshot preserved as baseline (already exists at `roundtable-analyst.snapshot-2026-04-05.md`)
- AC-001-02: Rewritten file is materially smaller, layered, harder to shortcut
- AC-001-03: All §2-7 preserved behaviors from preservation inventory retained verbatim

### FR-002: Bind templates to confirmation states locally
**Description**: Template authority must be state-local, declared inline at each PRESENTING_* state, not centralized in a distant section.
**Priority**: Must
**Confidence**: High
**Acceptance Criteria**:
- AC-002-01: Each PRESENTING_* state explicitly names its governing template inline
- AC-002-02: On-screen Tasks uses `traceability.template.json`
- AC-002-03: Written `tasks.md` uses `tasks.template.json` (separately specified)

### FR-003: Enforce §14 anti-shortcut hard rules as contract
**Description**: The roundtable experience itself is contract, not aspirational style. Anti-shortcut rules apply at runtime, not just prose guidance.
**Priority**: Must
**Confidence**: High
**Acceptance Criteria**:
- AC-003-01: No collapse from first clarification to artifact generation
- AC-003-02: Before first confirmation: Maya scope + Alex codebase evidence + Jordan design implication (internal-only in silent mode)
- AC-003-03: Tasks confirmation renders traceability table, never bullets/prose
- AC-003-04: No artifact writes before staged confirmations except explicit early exit

### FR-004: Elevate rendering modes to first-class with shared invariants
**Description**: The three rendering modes (`bulleted`, `conversational`, `silent`) surface near the top of the prompt with explicit invariants that prevent mode changes from altering protocol semantics.
**Priority**: Must
**Confidence**: High
**Acceptance Criteria**:
- AC-004-01: All three modes defined early in rewritten prompt
- AC-004-02: Mode changes cannot alter confirmation order, Accept/Amend gating, template binding, anti-shortcut behavior, A&I handling, write timing, tier applicability
- AC-004-03: §14 participation gates are internal-only in silent mode (no persona-name surface cues)

### FR-005: Persona extensibility via plugin/contribution model
**Description**: Added personas default to contributing. Promotion to primary requires explicit frontmatter declaration. Runtime composes effective state machine from defaults + persona declarations at analyze dispatch time.
**Priority**: Must
**Confidence**: High
**Acceptance Criteria**:
- AC-005-01: Added personas default to contributing (fold into state-owned confirmations)
- AC-005-02: Contributing personas don't create new templates, domains, or confirmation stages
- AC-005-03: Promotion requires explicit persona frontmatter: `role_type: primary`, `owns_state`, `template`, `inserts_at`
- AC-005-04: Runtime composes effective protocol from defaults + persona declarations at analyze dispatch
- AC-005-05: Conflict resolution defined: first-declared wins + warn on conflict
- AC-005-06: Existing 4 contributing persona files work unchanged (zero-touch migration)

### FR-006: Move dormant/adapter content to appendices
**Description**: Main execution path must be UX-contract-focused. Dormant Agent Teams design, runtime adapter details, search wiring, and low-level schemas relocate to labeled appendices.
**Priority**: Must
**Confidence**: High
**Acceptance Criteria**:
- AC-006-01: Agent Teams spawn/merge details moved to Appendix A
- AC-006-02: File discovery internals, enhanced search wiring, low-level meta.json schemas moved to appendices B/C
- AC-006-03: Runtime resume semantics collapsed to single reference

### FR-007: Ship 7 new prompt-verification tests
**Description**: Seven new prompt-verification tests covering the rewritten behavior contract.
**Priority**: Must
**Confidence**: High
**Acceptance Criteria**:
- AC-007-01: anti-shortcut-enforcement test
- AC-007-02: state-local-template-binding test
- AC-007-03: confirmation-sequencing-v2 test
- AC-007-04: rendering-mode-invariants test (modes cannot alter protocol)
- AC-007-05: persona-extension-composition test
- AC-007-06: pre-confirmation participation gates test
- AC-007-07: tasks-render-as-table enforcement test

### FR-008: Hook audit + update + extend (scope C)
**Description**: Audit 7 relevant hooks for alignment with rewritten prompt, update drifting hooks, add 3 new hooks for new rules the rewrite introduces.
**Priority**: Must
**Confidence**: High
**Acceptance Criteria**:
- AC-008-01: Audit report produced for 7 relevant hooks
- AC-008-02: Updates applied to hooks with broken assumptions (conversational-compliance, output-format-validator, menu-halt-enforcer, others as found)
- AC-008-03: 3 new hooks shipped (tasks-as-table-validator, participation-gate-enforcer, persona-extension-composer-validator)
- AC-008-04: All hook tests pass; 8 existing prompt-verification tests updated

### FR-009: Parallel rewrite of bug-roundtable-analyst.md
**Description**: Sibling bug-roundtable prompt follows identical behavior-first architecture with bug-specific confirmation stages.
**Priority**: Must
**Confidence**: High
**Acceptance Criteria**:
- AC-009-01: Bug roundtable prompt uses same behavior-first structure
- AC-009-02: Same rendering modes, persona extensibility, state-local template authority
- AC-009-03: Bug-specific confirmations (BUG_SUMMARY, ROOT_CAUSE, FIX_STRATEGY, TASKS) bind to bug templates inline
- AC-009-04: Dedicated prompt-verification test (bug-roundtable-rewritten-contract.test.js)

### FR-010: Update documentation alignment
**Description**: Documentation reflects persona extensibility model and regenerated structural summaries per Article VIII.
**Priority**: Should
**Confidence**: Medium
**Acceptance Criteria**:
- AC-010-01: CLAUDE.md updated for persona extensibility model
- AC-010-02: docs/AGENTS.md regenerated
- AC-010-03: docs/isdlc/persona-authoring-guide.md updated with extension-point schema and promotion example

---

## 7. Non-Functional Requirements

| NFR | Description | Threshold |
|---|---|---|
| NFR-001 | Maintainability | Rewritten prompt materially smaller; sections justified individually |
| NFR-002 | Testability | All 7 new tests must pass; 8 updated tests must pass |
| NFR-003 | Backward compat | Zero-touch for 4 existing contributing personas |
| NFR-004 | Upgrade safety | User persona files and framework prompt updates don't collide |
| NFR-005 | Provider neutrality | Claude Code and Codex produce identical staged confirmations |
| NFR-006 | Tunability | Sprawl-detection thresholds (future REQ) configurable via `.isdlc/config.json` |

---

## 8. Out of Scope

- Changing the underlying analysis artifact set (requirements-spec.md etc. structure unchanged)
- Activating true multi-agent execution (Agent Teams stays dormant future design)
- Redesigning unrelated build/runtime hooks beyond prompt-verification/alignment needs
- Building a UI/CLI tool for persona promotion (frontmatter-driven only)
- Monorepo-specific persona overrides (treat as follow-up if needed)
- Retroactively flagging sprawl in existing codebase artifacts (deferred: separate REQ)
- Sprawl/scatter detection as first-class roundtable signal (deferred: separate REQ per user decision)
- Auto-spawning follow-up REQs from persona-triggered scope recommendations

---

## 9. MoSCoW Prioritization

### Must Have
- FR-001 rewrite core
- FR-002 template binding
- FR-003 §14 anti-shortcut contract
- FR-004 rendering modes first-class
- FR-005 persona extensibility
- FR-006 appendix moves
- FR-007 7 new prompt-verification tests
- FR-008 hook audit + update + extend
- FR-009 bug-roundtable parallel rewrite

### Should Have
- FR-010 documentation alignment

### Could Have
(none identified)

### Won't Have (see Out of Scope)
- Sprawl detection feature
- Multi-agent execution

---

## 10. Assumptions and Inferences

| Assumption | Confidence | Source |
|---|---|---|
| §14 new hard rules treated as enforceable contract | High | User accepted scope C for hooks + 7 test areas |
| Runtime composition happens at analyze dispatch time | High | User confirmed plugin/contribution model |
| Default tier: epic, deferred to standard execution | High | Workflow system convention (epic decomposition not active) |
| Migration for contributing personas is zero-touch | High | Plugin model extends existing `role_type: contributing` schema |
| Conflict resolution: first-declared wins + warn | Medium | Fail-open per Article X; final call at Design stage |
| Extension-point taxonomy stable at 5 points | Medium | `before:requirements`, `after:{req,arch,design,tasks}`; expandable |
| Participation-gate-enforcer runs as Stop hook | Medium | Alternative: prompt-verification only |
