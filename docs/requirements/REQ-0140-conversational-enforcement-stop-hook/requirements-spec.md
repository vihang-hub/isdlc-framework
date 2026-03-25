# Requirements Specification: Conversational Enforcement via Stop Hook

**ID**: REQ-0140
**Source**: GitHub Issue #206
**Status**: Analyzed (amended)
**Labels**: governance, hooks, codex
**Analysis date**: 2026-03-25
**Amendments**: 3 (FR-002 priority, FR-004 auto-retry, FR-006 Codex ACs)

---

## 1. Business Context

iSDLC's roundtable analysis produces structured output governed by conversational rules: bulleted format when `verbosity: bulleted` is active, sequential three-domain confirmation (Requirements then Architecture then Design -- never collapsed), and mandatory elicitation before declaring analysis complete. These rules are documented in CLAUDE.md and agent instructions, but enforcement is purely prompt-based -- the LLM can and does violate them.

The hook system enforces structural rules deterministically (phase ordering, gate requirements, iteration corridors), but no hook enforces conversational output rules. The Stop hook surface (`delegation-gate.cjs`) currently only checks delegation markers. This feature extends the Stop hook (for Claude) and introduces runtime-side output inspection (for Codex) to enforce conversational behavioral rules.

**Success metric**: Zero user-facing violations of bulleted format, three-domain confirmation sequence, and roundtable elicitation-first rules -- enforced deterministically, not by prompt compliance.

---

## 2. Stakeholders and Personas

### Primary User: Developer using iSDLC
- **Role**: Runs analyze workflows that produce roundtable analysis output
- **Goals**: Receive correctly formatted analysis output without manual correction
- **Pain points**: LLM sometimes collapses three-domain confirmations into one message, skips elicitation questions, or outputs prose when bulleted was requested

### Secondary User: Framework maintainer
- **Role**: Authors and maintains conversational rules
- **Goals**: Define rules declaratively and have them enforced automatically
- **Pain points**: Rules buried in prose across CLAUDE.md and agent files are hard to maintain and impossible to enforce programmatically

---

## 3. User Journeys

### Journey 1: Bulleted format enforcement (Claude provider)
- **Entry**: User has `verbosity: bulleted` in `.isdlc/roundtable.yaml`
- **Flow**: Roundtable analyst produces output. Stop hook inspects response. Output contains prose paragraphs instead of bullets. Stop hook returns corrective feedback to Claude. Claude regenerates with proper bullet formatting. User sees only the corrected output.
- **Exit**: User receives bulleted output without ever seeing the violation

### Journey 2: Three-domain confirmation enforcement (Claude provider)
- **Entry**: User runs analyze on a standard-tier item
- **Flow**: Roundtable analyst attempts to present all three domain confirmations in one message. Stop hook detects collapsed confirmation. Stop hook returns corrective feedback. Claude regenerates with Requirements confirmation only, waits for user response.
- **Exit**: User sees sequential domain confirmations as designed

### Journey 3: Roundtable elicitation-first enforcement (Claude provider)
- **Entry**: User runs analyze on a new backlog item
- **Flow**: Roundtable analyst declares "finished analysis" without asking elicitation questions. Stop hook detects missing elicitation. Stop hook returns corrective feedback. Claude regenerates with elicitation question first.
- **Exit**: User is asked questions before analysis is declared complete

### Journey 4: Codex output validation
- **Entry**: User runs analyze via Codex provider with `verbosity: bulleted`
- **Flow**: Codex runtime adapter inspects assistant output after generation. Non-bulleted output detected. Output rejected, Codex re-invoked with corrective guidance. Corrected output returned.
- **Exit**: User receives compliant output regardless of provider

### Journey 5: Rule authoring from prose
- **Entry**: Framework maintainer updates CLAUDE.md with a new conversational rule
- **Flow**: Rule extraction parses CLAUDE.md and agent files, identifies enforceable behavioral rules, generates rule definitions. Rules are available to the Stop hook and Codex validator.
- **Exit**: New rule is automatically enforced on next analysis run

---

## 4. Technical Context

- **Existing enforcement**: 26 hooks (5 dispatchers + 5 standalone). Stop hook surface used by `delegation-gate.cjs` only.
- **Stop hook behavior**: Fires after Claude completes a response. Can return `{ "decision": "block", "reason": "..." }` to reject the response. Claude receives the block reason and regenerates.
- **Codex runtime**: `src/providers/codex/runtime.js` -- spawns `codex exec` processes. No hook surface. Output available after process exits.
- **Roundtable state machine**: `src/claude/agents/roundtable-analyst.md` Section 2.5 -- defines `IDLE -> PRESENTING_REQUIREMENTS -> PRESENTING_ARCHITECTURE -> PRESENTING_DESIGN -> FINALIZING -> COMPLETE` flow.
- **Verbosity config**: `.isdlc/roundtable.yaml` -- `verbosity: bulleted | conversational | silent`
- **CLAUDE.md rules**: "Three-domain confirmation sequence" and "Analysis Completion Rules" in CLAUDE.md Section "Analysis Completion Rules"
- **Codex governance**: REQ-0117 documents governance gaps. Real-time hooks are a documented gap (`status: 'gap'`). This feature uses runtime-side output inspection instead of hooks.

### Constraints
- Stop hook timeout: 5 seconds (existing contract). Rule evaluation must complete within this budget.
- No new npm dependencies.
- Fail-open: if rule evaluation errors, allow the response through (do not block on validator bugs).
- Auto-retry limit: 3 attempts. After 3 failed retries, escalate to user.

---

## 5. Quality Attributes and Risks

| Attribute | Priority | Threshold |
|-----------|----------|-----------|
| Determinism | Critical | Rule evaluation produces same result for same input every time |
| Performance | High | Stop hook adds <500ms latency per response check |
| Fail-open safety | Critical | Validator parsing/state lookup failures must not block responses |
| Provider neutrality | High | Same rules enforced on Claude (via Stop hook) and Codex (via output inspection) |
| Maintainability | High | Adding a new rule requires editing one file, not multiple hooks |

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Stop hook 5s timeout exceeded with complex rule evaluation | Low | Medium | Short-circuit on first violation; evaluate rules in priority order |
| Rule extraction from prose is fragile -- natural language rules are ambiguous | Medium | Medium | Start with manually authored rule definitions; extraction is "Could Have" | --> AMENDED: extraction is now "Must Have" (see FR-002) |
| Auto-retry loop exhausts Claude context window | Low | Medium | Cap at 3 retries with progressively specific corrective guidance |
| Codex output inspection cannot distinguish between assistant output and tool output | Low | High | Inspect only the final assistant message, not tool call results |
| False positives block valid output | Medium | High | Each rule has configurable sensitivity; fail-open on uncertainty |

---

## 6. Functional Requirements

### FR-001: Rule Definition Schema
**Confidence**: High

- **AC-001-01**: Given a rule definition file (`conversational-rules.json` or `.yaml`), when the compliance engine loads, then it parses all rules into a normalized in-memory model with: `id`, `name`, `trigger_condition` (when the rule applies), `check` (what to validate), `corrective_guidance` (feedback for retry), `severity` (block|warn), `provider_scope` (claude|codex|both)
- **AC-001-02**: Given a rule with `trigger_condition: { config: "verbosity", value: "bulleted" }`, when `verbosity` is not `bulleted` in roundtable.yaml, then the rule is skipped (not evaluated)
- **AC-001-03**: Given a rule with `provider_scope: "claude"`, when running on Codex, then the rule is skipped
- **AC-001-04**: Given an invalid rule definition (missing required fields), when the compliance engine loads, then it logs a warning and skips the invalid rule (fail-open)
- **AC-001-05**: Given no rule definition file exists, when the compliance engine loads, then it operates with an empty rule set (no enforcement, no errors)

### FR-002: Rule Extraction from Prose
**Confidence**: Medium

- **AC-002-01**: Given CLAUDE.md contains a section "Analysis Completion Rules" with behavioral instructions, when the rule extractor runs, then it identifies enforceable rules and generates rule definition entries
- **AC-002-02**: Given an agent file (e.g., `roundtable-analyst.md`) contains state machine transitions with implicit rules, when the rule extractor runs, then it extracts sequence rules (e.g., "PRESENTING_REQUIREMENTS must precede PRESENTING_ARCHITECTURE")
- **AC-002-03**: Given a rule extracted from prose conflicts with a manually authored rule (same `id`), when both are loaded, then the manually authored rule takes precedence
- **AC-002-04**: Given AGENTS.md contains behavioral constraints, when the rule extractor runs, then it identifies and extracts enforceable rules from that file as well
- **AC-002-05**: Given extraction produces a candidate rule with low confidence, when the rule is generated, then it is marked `severity: warn` (not `block`) by default until manually promoted

### FR-003: Stop Hook Integration (Claude Provider)
**Confidence**: High

- **AC-003-01**: Given the compliance engine has active rules, when Claude completes a response during an analyze workflow, then the Stop hook evaluates all applicable rules against the response content
- **AC-003-02**: Given a rule violation is detected with `severity: block`, when the Stop hook returns, then it returns `{ "decision": "block", "reason": "<corrective_guidance from the violated rule>" }` so Claude regenerates
- **AC-003-03**: Given a rule violation is detected with `severity: warn`, when the Stop hook returns, then it logs the violation but allows the response through
- **AC-003-04**: Given multiple rules are violated, when the Stop hook evaluates, then it reports the highest-severity violation's corrective guidance (block trumps warn)
- **AC-003-05**: Given rule evaluation takes longer than 4 seconds (approaching 5s timeout), when the timeout threshold is reached, then evaluation short-circuits and allows the response through (fail-open)

### FR-004: Auto-Retry with Corrective Feedback
**Confidence**: High

- **AC-004-01**: Given the Stop hook blocks a response for a rule violation, when the block is returned to Claude, then the corrective guidance from the violated rule is included in the block reason so Claude can self-correct
- **AC-004-02**: Given the same rule is violated on consecutive retries, when the retry count reaches 3, then the compliance engine escalates to the user with a description of the violation and the 3 failed attempts
- **AC-004-03**: Given a retry succeeds (no violations on the regenerated response), when the Stop hook evaluates, then it allows the response through and resets the retry counter
- **AC-004-04**: Given the corrective guidance includes specific instructions (e.g., "Format as bullet points, not prose paragraphs"), when Claude receives the block, then the guidance is specific enough for Claude to self-correct without user intervention
- **AC-004-05**: Given the auto-retry mechanism is active, when all 3 retries fail, then the final (non-compliant) response is presented to the user with a warning banner explaining the violation, rather than silently blocking indefinitely
- **AC-004-06**: Given the compliance engine is operating, when a violation is detected and retried, then the retry is invisible to the user -- no permission prompt, no "would you like to retry" question. The Stop hook and Claude handle it autonomously.

### FR-005: Built-in Conversational Rules
**Confidence**: High

- **AC-005-01**: Given `verbosity: bulleted` is active in roundtable.yaml, when the roundtable analyst produces a response, then the compliance engine checks that the response uses bullet-point formatting (not prose paragraphs)
- **AC-005-02**: Given a standard or epic-tier analysis is active, when the roundtable analyst presents domain confirmations, then the compliance engine checks that confirmations are sequential (one domain per message, not collapsed)
- **AC-005-03**: Given the first exchange in a roundtable analysis, when the roundtable analyst produces output, then the compliance engine checks that the output contains at least one elicitation question before any "analysis complete" declaration
- **AC-005-04**: Given a rule is defined for three-domain confirmation sequence, when the roundtable analyst presents Requirements confirmation, then Architecture and Design confirmations must not appear in the same message
- **AC-005-05**: Given the roundtable analyst is in `domain-confirmation` state (per the state machine in roundtable-analyst.md Section 2.5), when the analyst produces output, then the compliance engine validates the output matches the expected state transition

### FR-006: Codex Provider Integration
**Confidence**: High

- **AC-006-01**: Given the Codex runtime adapter receives assistant output, when conversational rules are active, then the adapter inspects the output against all rules with `provider_scope: "codex"` or `"both"`
- **AC-006-02**: Given a rule violation is detected in Codex output, when the violation has `severity: block`, then the adapter re-invokes Codex with corrective guidance prepended to the prompt
- **AC-006-03**: Given Codex re-invocation for a rule violation, when the retry count reaches 3, then the adapter returns the last output with a violation warning (same escalation as Claude path)
- **AC-006-04**: Given the compliance engine runs on Codex, when rule evaluation requires reading state.json, then it reads from the file system (same as Claude hooks do)
- **AC-006-05**: Given a new Codex-specific rule is added, when it has `provider_scope: "codex"`, then it is only evaluated in the Codex output inspection path, not in the Claude Stop hook
- **AC-006-06**: Given the Codex runtime is executing with roundtable conversational rules active, when the assistant produces output, then the Codex runtime validates the output before accepting it
- **AC-006-07**: Given `verbosity: bulleted` is active, when the Codex runtime inspects assistant output, then non-bulleted output is rejected and retried with corrective guidance
- **AC-006-08**: Given the roundtable is in domain-confirmation mode, when the Codex runtime inspects assistant output, then collapsed multi-domain confirmation in one message is blocked
- **AC-006-09**: Given the first analyze-roundtable exchange, when the Codex runtime inspects assistant output, then output declaring "finished analysis" without an elicitation question is blocked
- **AC-006-10**: Given the Codex provider, when output validation is performed, then it is implemented via runtime-side output inspection, not via live hooks (Codex has no hook surface)
- **AC-006-11**: Given the Codex output validator encounters a parsing error or state lookup failure, when the error occurs, then fail-open behavior is preserved -- the output is accepted with a logged warning
- **AC-006-12**: Given the Codex output validation feature, when automated tests are written, then they cover violation detection and retry/correction behavior in Codex mode

---

## 7. Out of Scope

| Item | Reason | Dependency |
|------|--------|------------|
| Enforcing non-conversational rules (e.g., file naming, code style) | Different enforcement model -- use existing hooks | Existing hook system |
| Real-time Codex hook surface | Codex does not support hooks -- documented gap in REQ-0117 | Codex CLI roadmap |
| UI for rule management | CLI-first framework; rules are files | Future hackability feature |
| Enforcing rules outside analyze workflows | Scoped to roundtable analysis initially | Extend later if needed |
| Antigravity provider integration | Adapter not yet implemented | REQ-0135, provider roadmap |

---

## 8. MoSCoW Prioritization

| FR | Title | Priority | Rationale |
|----|-------|----------|-----------|
| FR-001 | Rule definition schema | Must Have | Foundation for all enforcement -- rules must be defined before they can be checked |
| FR-002 | Rule extraction from prose | Must Have | Users need to extract rules from CLAUDE.md/AGENTS.md -- this is the primary rule authoring path |
| FR-003 | Stop hook integration (Claude) | Must Have | Primary enforcement mechanism for the majority provider |
| FR-004 | Auto-retry with corrective feedback | Must Have | Core UX -- violations are corrected automatically without user involvement |
| FR-005 | Built-in conversational rules | Must Have | The three specific rules that motivated this feature |
| FR-006 | Codex provider integration | Must Have | Multi-provider parity requirement -- same rules on both providers |

---

## 9. Requirements Assumptions

| # | Assumption | Impact if wrong | Resolution |
|---|-----------|----------------|------------|
| RA1 | Claude's Stop hook can return corrective guidance that Claude uses to regenerate | Auto-retry mechanism fails; violations require user intervention | Fall back to user-facing block with explanation |
| RA2 | Stop hook fires on every Claude response, not just tool calls | Some responses may bypass enforcement | Verify hook contract with Claude Code team |
| RA3 | Codex output is available as a string after process exit | Output inspection impossible | Investigate Codex streaming API |
| RA4 | 3 retries is sufficient for Claude to self-correct | User escalation happens too frequently | Increase retry limit or improve corrective guidance specificity |
| RA5 | Conversational rules can be evaluated by pattern matching (regex, structural checks) without LLM | Rule evaluation requires LLM call inside the hook, breaking timeout | Start with structural/pattern rules; defer semantic rules |
| RA6 | The roundtable state machine state is readable from state.json at Stop hook time | Cannot determine which domain-confirmation state the analyst is in | Require state machine to write current state to state.json before output |
| RA7 | CLAUDE.md and agent file rules are stable enough for automated extraction | Extraction breaks on every prose change | Manually authored rules take precedence (AC-002-03); extraction is a convenience, not sole source |

---

## 10. Dependency Map

| Dependency | Type | Status | Impact |
|-----------|------|--------|--------|
| REQ-0117 (Codex Governance Checkpoints) | Informs | Shipped | Documents the governance gap that FR-006 addresses |
| REQ-0003 (Hooks API Contract) | Foundation | Shipped | Defines Stop hook stdin/stdout format |
| REQ-0135 (Codex Runtime Adapter) | Integration | Shipped | FR-006 extends the adapter with output inspection |
| REQ-0109 (Roundtable State Machine) | Data source | Shipped | FR-005 reads state machine state for validation |
| Roundtable analyst agent | Runtime | Active | Must write state machine state to state.json for FR-005 |

---

## 11. Amendment Log

| # | Date | FR | Change | Rationale |
|---|------|----|--------|-----------|
| 1 | 2026-03-25 | FR-002 | Priority changed from Could Have to **Must Have** | Users need to extract rules from CLAUDE.md/AGENTS.md -- this is the primary rule authoring path |
| 2 | 2026-03-25 | FR-004 | Behavior changed from user-facing block to **auto-retry with corrective feedback**. Stop hook returns corrective guidance to Claude for regeneration. 3 retries before user escalation. | Violations should be invisible to the user; the agent should redo work correctly without blocking |
| 3 | 2026-03-25 | FR-006 | Added **7 Codex-specific acceptance criteria** (AC-006-06 through AC-006-12) covering output validation, retry behavior, fail-open safety, and test coverage | Codex provider needs explicit validation ACs to ensure parity with Claude enforcement |
