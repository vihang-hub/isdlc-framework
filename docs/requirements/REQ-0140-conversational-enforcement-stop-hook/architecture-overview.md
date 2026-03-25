# Architecture Overview: Conversational Enforcement via Stop Hook

**REQ**: REQ-0140
**Source**: GitHub Issue #206
**Status**: Analyzed
**Date**: 2026-03-25

---

## 1. Architectural Approach

**Pattern**: Dual-surface output interceptor with shared compliance engine

The system introduces a **compliance engine** — a pure-function rule evaluator — consumed by two enforcement surfaces:

1. **Claude Stop Hook** — intercepts Claude responses before they reach the user; returns block + corrective guidance on violations so Claude regenerates autonomously
2. **Codex Output Validator** — inspects Codex process output after generation; re-invokes Codex with corrective guidance on violations

Both surfaces share the same rule evaluation core but differ in integration mechanics (hook stdin/stdout vs function call in the runtime adapter).

---

## 2. Key Architectural Decisions

### AD-01: Shared Compliance Engine, Separate Integration Surfaces

- **Decision**: Extract a standalone `compliance-engine.cjs` module that loads rules, evaluates them against response content, and returns a verdict. The Stop hook and Codex adapter each call this module.
- **Rationale**: Provider-neutral rule evaluation (FR-001, FR-005). Avoids duplicating rule logic across two code paths.
- **Trade-off**: CJS module required for Claude hooks (CJS-only runtime). Codex adapter is ESM. The engine will be CJS with an ESM re-export wrapper.

### AD-02: Stop Hook Extension (Not Replacement)

- **Decision**: Add the compliance engine as a **second Stop hook** in `.claude/settings.json`, alongside the existing `delegation-gate.cjs`. Do not merge into delegation-gate.
- **Rationale**: Single Responsibility — delegation-gate checks delegation markers; the new hook checks conversational rule compliance. Independent failure domains: a bug in one does not break the other.
- **Hook contract**: Receives `{ stop_hook_active: true }` on stdin plus the assistant's response content. Returns `{ "decision": "block", "reason": "..." }` to reject, or allows through (empty/allow response).

### AD-03: Declarative Rule Definitions in JSON

- **Decision**: Rules are defined in `.isdlc/config/conversational-rules.json` using a structured schema: `id`, `name`, `trigger_condition`, `check`, `corrective_guidance`, `severity`, `provider_scope`.
- **Rationale**: Deterministic evaluation via pattern matching (regex, structural checks). No LLM call inside the hook — stays within 5-second timeout budget.
- **File location**: `.isdlc/config/conversational-rules.json` — alongside existing config files (`iteration-requirements.json`, `workflows.json`).

### AD-04: Rule Extraction as a Build-Time CLI Command

- **Decision**: Rule extraction from CLAUDE.md and agent files (FR-002) is a **build-time CLI command** (`bin/isdlc.js extract-rules`), not a runtime operation. It parses prose files, generates candidate rule definitions, and writes them to `conversational-rules.json`.
- **Rationale**: Prose parsing is inherently slower and less deterministic than evaluating pre-defined rules. Separating extraction (slow, LLM-assisted) from evaluation (fast, deterministic) keeps the hook within timeout.
- **User flow**: Maintainer runs `isdlc extract-rules` after editing CLAUDE.md. Reviews generated rules. Promotes candidates from `severity: warn` to `severity: block` as needed.

### AD-05: Retry State via In-Memory Counter (Not state.json)

- **Decision**: The auto-retry counter (FR-004, max 3 retries) is tracked in-memory within the Stop hook process lifetime, keyed by a hash of the violated rule + conversation turn. Not persisted to state.json.
- **Rationale**: Stop hooks are invoked per-response by Claude Code. The retry loop is entirely within one conversation turn — no cross-session persistence needed. Writing to state.json on every retry would add I/O latency and risk contention with other hooks.
- **Escalation**: After 3 retries, the hook allows the response through and appends a violation warning banner that the user sees.

### AD-06: Codex Integration via runtime.js Post-Processing

- **Decision**: Add a `validateOutput(output, rules)` step in `src/providers/codex/runtime.js` after the Codex process returns. This calls the shared compliance engine. On violation, re-invoke Codex with corrective guidance prepended.
- **Rationale**: Codex has no hook surface (documented gap in REQ-0117). Runtime-side output inspection is the only integration point. The existing `runtime.js` already handles output parsing and has the process re-invocation path.
- **Fail-open**: If validation throws, accept the output with a logged warning.

### AD-07: Roundtable State Persisted to `.isdlc/roundtable-state.json`

- **Decision**: The roundtable analyst writes its current confirmation state machine state (`IDLE`, `PRESENTING_REQUIREMENTS`, etc.) to a **sidecar file** `.isdlc/roundtable-state.json` at confirmation state transitions. The Stop hook reads this file to determine current roundtable context. The file is deleted at roundtable finalization (cleanup).
- **Rationale**: The compliance engine needs to know which state the analyst is in to validate the three-domain confirmation sequence (FR-005). Writing to `state.json` would create contention with active build workflows since the analyze command runs independently. The Stop hook runs as a separate child process and cannot share memory with the conversation. A lightweight sidecar file is the cleanest solution -- written at state transitions, read by the Stop hook, and cleaned up at finalization.
- **Dependency**: Requires a small change to the roundtable-analyst agent or analyze handler to write the sidecar file at confirmation state transitions and delete it at finalization.

---

## 3. Component Architecture

```
                    +----------------------------+
                    |   conversational-rules.json |
                    |   (.isdlc/config/)          |
                    +-------------+--------------+
                                  |
                    +-------------v--------------+
                    |    compliance-engine.cjs     |
                    |  - loadRules()               |
                    |  - evaluateRules(response,   |
                    |      config, state)          |
                    |  - Returns verdict + guidance |
                    +---+--------------------+----+
                        |                    |
            +-----------v------+    +--------v-----------+
            | Stop Hook        |    | Codex Adapter      |
            | (conversational- |    | (runtime.js)       |
            |  compliance.cjs) |    |                    |
            |                  |    | validateOutput()   |
            | Reads stdin      |    | calls engine       |
            | Calls engine     |    | re-invokes on fail |
            | Returns block/   |    |                    |
            |   allow          |    |                    |
            +------------------+    +--------------------+

            +----------------------------+
            |   bin/isdlc.js             |
            |   extract-rules command    |
            |                            |
            |   Parses CLAUDE.md +       |
            |   agent .md files          |
            |   Writes to rules.json     |
            +----------------------------+
```

---

## 4. File Layout

| New File | Purpose |
|----------|---------|
| `src/claude/hooks/conversational-compliance.cjs` | Stop hook — loads engine, evaluates, returns block/allow |
| `src/core/compliance/engine.cjs` | Shared compliance engine — rule loading, evaluation, verdict |
| `src/core/compliance/engine.mjs` | ESM re-export wrapper for Codex adapter |
| `.isdlc/config/conversational-rules.json` | Declarative rule definitions (ships with 3 built-in rules) |
| `src/core/compliance/extractors/prose-extractor.js` | Parses CLAUDE.md/agent files for enforceable rules |
| `src/claude/hooks/tests/conversational-compliance.test.cjs` | Tests for the Stop hook |
| `src/core/compliance/tests/engine.test.cjs` | Tests for the compliance engine |
| `src/providers/codex/tests/output-validation.test.js` | Tests for Codex output validation |

| Modified File | Change |
|---------------|--------|
| `.claude/settings.json` | Add second Stop hook entry for `conversational-compliance.cjs` |
| `src/providers/codex/runtime.js` | Add `validateOutput()` call after process output |
| `src/claude/agents/roundtable-analyst.md` (or analyze handler) | Write confirmation state to `.isdlc/roundtable-state.json` sidecar; delete at finalization |
| `bin/isdlc.js` | Register `extract-rules` CLI subcommand |

---

## 5. Rule Schema

```json
{
  "id": "bulleted-format",
  "name": "Bulleted Output Format",
  "trigger_condition": {
    "config": "verbosity",
    "value": "bulleted",
    "workflow": "analyze"
  },
  "check": {
    "type": "pattern",
    "pattern": "^(?!\\s*[-*]|\\s*\\d+\\.|#{1,6}\\s|\\|.*\\||```|---)",
    "scope": "line",
    "threshold": 0.3,
    "description": "More than 30% of non-empty lines are prose (not bullets, headings, tables, or code blocks)"
  },
  "corrective_guidance": "Your response must use bullet-point formatting. Rewrite all prose paragraphs as bulleted lists. Each point should be a single bullet starting with - or *.",
  "severity": "block",
  "provider_scope": "both"
}
```

---

## 6. Integration Points

### 6.1 Stop Hook Chain

Current Stop hook chain:
```
Stop: [ delegation-gate.cjs (5s timeout) ]
```

Proposed:
```
Stop: [
  delegation-gate.cjs (5s timeout),
  conversational-compliance.cjs (5s timeout)
]
```

Both hooks run independently. If delegation-gate blocks, conversational-compliance does not execute (Claude regenerates first). If delegation-gate allows, conversational-compliance evaluates.

### 6.2 Codex Runtime Integration

```javascript
// In runtime.js execute(), after Codex process returns output:
const verdict = validateOutput(output, loadedRules, config, state);
if (verdict.violation && verdict.severity === 'block' && retryCount < 3) {
  // Re-invoke with corrective guidance
  return execute({ ...task, prompt: verdict.corrective_guidance + '\n\n' + task.prompt });
}
```

### 6.3 State Machine State Persistence (Sidecar File)

The roundtable analyst (or the analyze handler wrapping it) writes to a sidecar file `.isdlc/roundtable-state.json` at each confirmation state transition:
```json
{
  "confirmation_state": "PRESENTING_REQUIREMENTS",
  "updated_at": "2026-03-25T..."
}
```

The sidecar file is:
- **Written** by the roundtable protocol at confirmation state transitions (IDLE -> PRESENTING_REQUIREMENTS, etc.)
- **Read** by the Stop hook to determine current roundtable context for rule evaluation
- **Deleted** at roundtable finalization (FINALIZING -> COMPLETE transition) to avoid stale state

This avoids contention with `state.json`, which may be actively written by build workflows. The Stop hook reads the sidecar file to validate that the analyst's output matches its declared state (e.g., if state is `PRESENTING_REQUIREMENTS`, the output must not contain Architecture or Design confirmations).

---

## 7. Performance Budget

| Operation | Budget | Approach |
|-----------|--------|----------|
| Rule loading | < 50ms | Parse JSON once, cache in module scope |
| Rule evaluation (3 built-in rules) | < 200ms | Regex/structural checks, short-circuit on first block violation |
| Sidecar + config read | < 50ms | Read `.isdlc/roundtable-state.json` for roundtable state + roundtable.yaml for verbosity config |
| Total Stop hook | < 500ms | Well within 5s timeout; leaves margin for future rules |
| Codex validation | < 200ms | Same engine, called as function (no process spawn overhead) |

---

## 8. Fail-Open Guarantees

- Rule definition parsing errors: skip invalid rules, log warning
- No rule file: empty rule set, no enforcement
- Engine evaluation error: allow response through, log error
- Sidecar file missing or read failure: skip state-dependent rules, evaluate remainder
- Stop hook timeout approaching (4s mark): short-circuit, allow through
- Codex validation error: accept output, log warning

---

## 9. Built-in Rules (Ships with 3)

1. **bulleted-format**: When `verbosity: bulleted`, reject prose paragraphs
2. **sequential-domain-confirmation**: When in domain-confirmation state, reject collapsed multi-domain output
3. **elicitation-first**: On first analyze exchange, reject "analysis complete" without elicitation questions

These three rules directly address the motivating user pain points from Issue #206.

---

## 10. Risk Mitigations

| Risk | Mitigation |
|------|------------|
| CJS/ESM boundary friction | Engine is CJS (hook-compatible); thin ESM wrapper for Codex adapter import |
| False positives from regex-based checks | Each rule has a `threshold` parameter; bulleted-format allows 30% non-bullet lines (headings, tables, code blocks are excluded) |
| State machine state not available at hook time | AD-07 requires sidecar file persistence; if `.isdlc/roundtable-state.json` is missing, skip state-dependent rules (fail-open) |
| Rule extraction generates bad rules | Extracted rules default to `severity: warn`; require manual promotion to `block` |
| Two Stop hooks increase total response latency | Hooks run sequentially but each within budget; total < 1s for both |
