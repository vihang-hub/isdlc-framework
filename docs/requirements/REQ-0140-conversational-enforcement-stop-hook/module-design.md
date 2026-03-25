# Module Design: REQ-0140 — Conversational Enforcement via Stop Hook

**Status**: Analyzed
**Created**: 2026-03-25

---

## 1. Module: compliance-engine.cjs

**Responsibility**: Load conversational rules from JSON, evaluate them against response content, and return a verdict with corrective guidance. Shared core consumed by both the Stop hook (Claude) and the runtime adapter (Codex).

**Location**: `src/core/compliance/engine.cjs`

**Public Interface**:

```js
/**
 * Load rules from the conversational-rules.json config file.
 * Invalid rules are skipped with a warning (fail-open).
 *
 * @param {string} [rulesPath] - Override path to rules file (for testing)
 * @returns {Rule[]} Parsed and validated rules
 */
function loadRules(rulesPath)

/**
 * Evaluate all applicable rules against a response.
 *
 * @param {string} response - The assistant's response text
 * @param {Rule[]} rules - Loaded rules from loadRules()
 * @param {Object} config - Verbosity config from roundtable.yaml
 * @param {Object|null} roundtableState - Parsed .isdlc/roundtable-state.json (or null if unavailable)
 * @returns {Verdict}
 */
function evaluateRules(response, rules, config, roundtableState)

module.exports = { loadRules, evaluateRules }
```

**Return type `Verdict`**:

```js
{
  violation: boolean,
  rule_id: string | null,         // ID of the violated rule (highest severity)
  rule_name: string | null,       // Human-readable name
  severity: "block" | "warn" | null,
  corrective_guidance: string | null, // Feedback for retry
  all_violations: Array<{         // All violations found (not just highest)
    rule_id: string,
    severity: string,
    corrective_guidance: string
  }>
}
```

**Algorithm**:

1. Filter rules by `provider_scope` (caller passes "claude" or "codex")
2. Filter rules by `trigger_condition`: check config values (e.g., `verbosity === "bulleted"`) and roundtable state (e.g., `confirmation_state !== null`)
3. For each applicable rule, execute `check`:
   - `type: "pattern"` -- regex match against response lines with threshold
   - `type: "structural"` -- check for presence/absence of structural elements (headings, domain names)
   - `type: "state-match"` -- compare response content against expected behavior for current roundtable state
4. Collect all violations; return highest-severity violation as primary
5. Short-circuit: if a `block` violation is found and elapsed time > 4s, return immediately (fail-open on timeout approach)

**Dependencies**:
- `.isdlc/config/conversational-rules.json` (loaded once, cached in module scope)
- `.isdlc/roundtable-state.json` (read per evaluation, may not exist)
- `.isdlc/roundtable.yaml` (for verbosity config)
- No external packages

**Estimated size**: ~120-150 lines

---

## 2. Module: conversational-compliance.cjs (Stop Hook)

**Responsibility**: Claude Stop hook that reads stdin, invokes the compliance engine, and returns block/allow decisions.

**Location**: `src/claude/hooks/conversational-compliance.cjs`

**Public Interface** (Stop hook contract):

```js
// Reads from stdin: { stop_hook_active: true, assistant_response: "..." }
// Writes to stdout:
//   Block: { "decision": "block", "reason": "<corrective_guidance>" }
//   Allow: (empty output or { "decision": "allow" })
```

**Algorithm**:

1. Parse stdin JSON
2. If `stop_hook_active` is not true, exit (allow)
3. Load rules via `loadRules()` (cached after first call)
4. Read `.isdlc/roundtable.yaml` for verbosity config
5. Read `.isdlc/roundtable-state.json` for current roundtable state:
   - If file does not exist: `roundtableState = null` (state-dependent rules will be skipped)
   - If file exists but is unparseable: `roundtableState = null` (fail-open)
6. Call `evaluateRules(response, rules, config, roundtableState)`
7. If verdict has `severity: "block"`:
   - Check retry counter (in-memory, keyed by `rule_id + response_hash`)
   - If retries < 3: return `{ "decision": "block", "reason": verdict.corrective_guidance }`
   - If retries >= 3: allow through, append violation warning banner
8. If verdict has `severity: "warn"`: log warning, allow through
9. Otherwise: allow through

**Retry Counter**:
- In-memory Map keyed by `rule_id`
- Reset when a different rule is violated or response passes
- Not persisted -- scoped to the hook process lifetime within one conversation turn

**Dependencies**:
- `src/core/compliance/engine.cjs`
- No external packages

**Estimated size**: ~60-80 lines

---

## 3. Module: roundtable-state.json (Sidecar File)

**Responsibility**: Lightweight sidecar file that persists roundtable confirmation state for cross-process communication between the conversation (roundtable analyst) and the Stop hook.

**Location**: `.isdlc/roundtable-state.json`

**Schema**:

```json
{
  "confirmation_state": "PRESENTING_REQUIREMENTS",
  "updated_at": "2026-03-25T15:30:00.000Z"
}
```

**Valid `confirmation_state` values**:
- `IDLE` -- confirmation not yet started
- `PRESENTING_REQUIREMENTS` -- displaying requirements summary for Accept/Amend
- `PRESENTING_ARCHITECTURE` -- displaying architecture summary for Accept/Amend
- `PRESENTING_DESIGN` -- displaying design summary for Accept/Amend
- `AMENDING` -- user chose Amend; roundtable re-engaging
- `TRIVIAL_SHOW` -- trivial tier brief mention
- `FINALIZING` -- all summaries accepted; persisting artifacts

**Lifecycle**:

1. **Created**: When the roundtable analyst enters the confirmation sequence (transition from analysis conversation to PRESENTING_REQUIREMENTS or TRIVIAL_SHOW)
2. **Updated**: At each confirmation state transition (e.g., PRESENTING_REQUIREMENTS -> PRESENTING_ARCHITECTURE on Accept)
3. **Deleted**: At roundtable finalization (FINALIZING -> COMPLETE transition). The roundtable analyst or analyze handler deletes the file as part of cleanup.

**Write responsibility**: Roundtable analyst (sole writer, same as meta.json ownership)

**Read consumers**: Stop hook (`conversational-compliance.cjs`), compliance engine

**Contention avoidance**: This file is independent of `state.json`, which may be actively written by build workflows. The analyze command operates independently of build workflows, so the sidecar file has a single writer (roundtable analyst) and a single reader pattern (Stop hook).

---

## 4. Module: engine.mjs (ESM Wrapper)

**Responsibility**: Thin ESM re-export of the CJS compliance engine for use in Codex runtime adapter.

**Location**: `src/core/compliance/engine.mjs`

**Public Interface**:

```js
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { loadRules, evaluateRules } = require('./engine.cjs')
export { loadRules, evaluateRules }
```

**Estimated size**: ~5 lines

---

## 5. Module: Codex Output Validator (runtime.js changes)

**Responsibility**: Post-generation output inspection in the Codex runtime adapter. Calls the shared compliance engine and re-invokes Codex on block violations.

**Location**: `src/providers/codex/runtime.js` (modification)

**New function**:

```js
/**
 * Validate Codex output against conversational rules.
 *
 * @param {string} output - Codex assistant output
 * @param {Rule[]} rules - Loaded rules
 * @param {Object} config - Verbosity config
 * @param {Object|null} roundtableState - Parsed roundtable-state.json
 * @returns {Verdict}
 */
function validateOutput(output, rules, config, roundtableState)
```

**Integration point** (in `execute()` after Codex process returns):

```js
const roundtableState = readRoundtableState() // reads .isdlc/roundtable-state.json, returns null on missing/error
const verdict = validateOutput(output, loadedRules, config, roundtableState)
if (verdict.violation && verdict.severity === 'block' && retryCount < 3) {
  return execute({ ...task, prompt: verdict.corrective_guidance + '\n\n' + task.prompt })
}
```

**Fail-open**: If `validateOutput` throws, accept the output with a logged warning.

**Estimated change**: ~30-40 lines added to runtime.js

---

## 6. Module: prose-extractor.js (Rule Extraction)

**Responsibility**: Parse CLAUDE.md and agent files to identify enforceable behavioral rules and generate candidate rule definitions.

**Location**: `src/core/compliance/extractors/prose-extractor.js`

**Public Interface**:

```js
/**
 * Extract enforceable rules from prose files.
 *
 * @param {string[]} filePaths - Paths to CLAUDE.md, agent files, AGENTS.md
 * @param {Object} [options]
 * @param {string} [options.outputPath] - Path to write generated rules
 * @returns {CandidateRule[]}
 */
export function extractRules(filePaths, options = {})
```

**Algorithm**:

1. Read each file
2. Identify sections with behavioral constraints (pattern: "MUST", "NEVER", "ALWAYS", "CRITICAL")
3. For each candidate: parse into rule structure (trigger_condition, check pattern, corrective_guidance)
4. Deduplicate against existing manually authored rules (by `id`)
5. Set `severity: "warn"` on all extracted rules (manual promotion to `block` required)
6. Write to output path or return array

**Estimated size**: ~100-120 lines

---

## 7. Module: conversational-rules.json (Config)

**Responsibility**: Declarative rule definitions that ship with the framework. Three built-in rules addressing the motivating pain points.

**Location**: `.isdlc/config/conversational-rules.json`

**Schema** (per rule):

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

**Built-in rules**:

1. **bulleted-format**: When `verbosity: bulleted`, reject responses with >30% prose lines
2. **sequential-domain-confirmation**: When roundtable state is a `PRESENTING_*` state, reject output that contains confirmations for domains other than the current one
3. **elicitation-first**: On first analyze exchange (roundtable state is `IDLE` or not yet set), reject "analysis complete" declarations without prior elicitation questions

---

## 8. Changes to Existing Modules

### 8.1 `.claude/settings.json`

Add second Stop hook entry:

```json
{
  "hooks": {
    "Stop": [
      "src/claude/hooks/delegation-gate.cjs",
      "src/claude/hooks/conversational-compliance.cjs"
    ]
  }
}
```

### 8.2 `bin/isdlc.js`

Register `extract-rules` CLI subcommand:

```js
case 'extract-rules':
  // Import and run prose extractor
  // Default files: CLAUDE.md, src/claude/agents/*.md, docs/AGENTS.md
  // Output: .isdlc/config/conversational-rules.json (merge with existing)
  break
```

### 8.3 `src/claude/agents/roundtable-analyst.md` (or analyze handler)

Add sidecar file write at confirmation state transitions:

- On entering confirmation sequence: write `{ "confirmation_state": "PRESENTING_REQUIREMENTS", "updated_at": "..." }` to `.isdlc/roundtable-state.json`
- On each state transition (Accept/Amend): update the file
- On finalization (COMPLETE): delete `.isdlc/roundtable-state.json`

This is the only change needed to support AD-07. The roundtable analyst already tracks `confirmationState` in memory (Section 2.5.3 of roundtable-analyst.md) -- this adds a file-system write at transitions.

---

## 9. Error Handling

| Condition | Behavior | Article |
|---|---|---|
| `conversational-rules.json` missing | Empty rule set, no enforcement | Article X (fail-safe) |
| Invalid rule definition (missing fields) | Skip invalid rule, log warning | Article X |
| `.isdlc/roundtable-state.json` missing | Skip state-dependent rules, evaluate remainder | Article X |
| `.isdlc/roundtable-state.json` unparseable | Treat as missing (null state) | Article X |
| `roundtable.yaml` missing | Skip config-dependent rules | Article X |
| Compliance engine throws | Allow response through, log error | Article X |
| Stop hook timeout approaching (4s) | Short-circuit evaluation, allow through | Article X |
| Codex validation throws | Accept output, log warning | Article X |
| Stale sidecar file (roundtable finished but file not cleaned up) | Next roundtable start overwrites it; compliance engine checks `updated_at` freshness | Article X |

---

## 10. Test Strategy Outline

### Unit Tests (`engine.test.cjs`)

- Rule loading: valid rules, invalid rules (skipped), missing file (empty set)
- Rule filtering: provider scope, trigger conditions, roundtable state
- Pattern check: bulleted format threshold, line classification
- Structural check: domain confirmation detection
- State-match check: roundtable state vs output content
- Verdict: highest severity wins, all violations collected

### Unit Tests (`conversational-compliance.test.cjs`)

- Hook stdin parsing and response
- Block decision with corrective guidance
- Allow decision on no violations
- Retry counter: increment, reset, escalation at 3
- Fail-open: missing rules file, missing sidecar file, engine error
- Timeout short-circuit at 4s mark

### Unit Tests (`output-validation.test.js`)

- Codex output validation: violation detection and retry
- Retry limit: escalation after 3 attempts
- Fail-open: validation error accepted with warning
- Sidecar file reading: present, missing, unparseable

### Integration Tests

- Stop hook chain: delegation-gate + conversational-compliance running in sequence
- End-to-end: bulleted format violation blocked and corrected
- End-to-end: collapsed domain confirmation blocked and corrected
- Sidecar file lifecycle: created, updated, deleted across roundtable session
