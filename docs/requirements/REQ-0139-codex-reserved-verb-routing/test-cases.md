# Test Cases: REQ-0139 — Codex Reserved Verb Routing

## Test File 1: `tests/providers/codex/verb-resolver.test.js`

**Prefix**: VR-
**Module under test**: `src/providers/codex/verb-resolver.js`
**Imports**: `resolveVerb`, `loadVerbSpec` from verb-resolver.js

---

### describe: resolveVerb — Phrase Matching (FR-001, FR-006)

**VR-01** [P0] AC-006-01 | positive
- Given: prompt is `"analyze it"`
- When: `resolveVerb("analyze it")` is called
- Then: result is `{ detected: true, verb: "analyze", command: "/isdlc analyze" }`

**VR-02** [P1] AC-001-03 | positive
- Given: prompt is `"think through this problem"`
- When: `resolveVerb("think through this problem")` is called
- Then: result has `detected: true, verb: "analyze"`

**VR-03** [P0] AC-001-03 | positive
- Given: prompt is `"add to backlog"`
- When: `resolveVerb("add to backlog")` is called
- Then: result has `detected: true, verb: "add", command: "/isdlc add"`

**VR-04** [P1] AC-001-03 | positive
- Given: prompt is `"track this idea"`
- When: `resolveVerb("track this idea")` is called
- Then: result has `detected: true, verb: "add"`

**VR-05** [P0] AC-001-03 | positive
- Given: prompt is `"build this component"`
- When: `resolveVerb("build this component")` is called
- Then: result has `detected: true, verb: "build", command: "/isdlc build"`

**VR-06** [P1] AC-001-03 | positive
- Given: prompt is `"implement the feature"`
- When: `resolveVerb("implement the feature")` is called
- Then: result has `detected: true, verb: "build"`

**VR-07** [P1] AC-001-03 | positive
- Given: prompt is `"let's do this"`
- When: `resolveVerb("let's do this")` is called
- Then: result has `detected: true, verb: "build"`

**VR-08** [P1] AC-001-03 | positive
- Given: prompt is `"ship it"`
- When: `resolveVerb("ship it")` is called
- Then: result has `detected: true, verb: "build"`

**VR-09** [P1] AC-001-03 | positive
- Given: prompt is `"refactor the module"`
- When: `resolveVerb("refactor the module")` is called
- Then: result has `detected: true, verb: "build"`

**VR-10** [P1] AC-001-03 | positive
- Given: prompt is `"ANALYZE IT"` (uppercase)
- When: `resolveVerb("ANALYZE IT")` is called
- Then: result has `detected: true, verb: "analyze"` (case insensitive)

---

### describe: resolveVerb — Command Mapping (FR-001)

**VR-11** [P0] AC-006-01 | positive
- Given: a prompt matching verb "add"
- When: `resolveVerb("add to backlog")` is called
- Then: `result.command === "/isdlc add"`

**VR-12** [P0] AC-006-01 | positive
- Given: a prompt matching verb "analyze"
- When: `resolveVerb("analyze it")` is called
- Then: `result.command === "/isdlc analyze"`

**VR-13** [P0] AC-006-01 | positive
- Given: a prompt matching verb "build"
- When: `resolveVerb("build it")` is called
- Then: `result.command === "/isdlc build"`

---

### describe: resolveVerb — Precedence (FR-001)

**VR-14** [P0] AC-001-04 | positive
- Given: a prompt containing both "add" and "analyze" phrases
- When: `resolveVerb("add and analyze this")` is called
- Then: resolved verb is "analyze" (precedence 2 < 3)

**VR-15** [P0] AC-001-04 | positive
- Given: a prompt containing both "analyze" and "build" phrases
- When: `resolveVerb("analyze and build this")` is called
- Then: resolved verb is "build" (precedence 1 < 2)

**VR-16** [P0] AC-001-04 | positive
- Given: a prompt containing all three verb phrases
- When: `resolveVerb("add, analyze, and build everything")` is called
- Then: resolved verb is "build" (lowest precedence wins)

---

### describe: resolveVerb — Ambiguity and Disambiguation (FR-006)

**VR-17** [P0] AC-006-02 | positive
- Given: prompt is `"add and analyze this"`
- When: `resolveVerb("add and analyze this")` is called
- Then: `{ detected: true, verb: "analyze", ambiguity: true, ambiguous_verbs: ["add", "analyze"] }`

**VR-18** [P1] AC-001-04 | positive
- Given: prompt matches analyze + build
- When: `resolveVerb("analyze and build this")` is called
- Then: `ambiguity: true, ambiguous_verbs` includes both, verb: "build"

**VR-19** [P1] AC-001-04 | positive
- Given: prompt matches add + build
- When: `resolveVerb("add and build this")` is called
- Then: `ambiguity: true, verb: "build"`

**VR-20** [P1] AC-001-04 | positive
- Given: prompt matches all three verbs
- When: `resolveVerb("add, analyze, and build")` is called
- Then: `ambiguity: true, ambiguous_verbs` includes all three, verb: "build"

---

### describe: resolveVerb — Exclusions (FR-001, FR-006)

**VR-21** [P0] AC-006-03 | negative
- Given: prompt is `"explain this code"`
- When: `resolveVerb("explain this code")` is called
- Then: `{ detected: false, reason: "excluded" }`

**VR-22** [P1] AC-001-05 | negative
- Given: prompt is `"what does this function do"`
- When: `resolveVerb("what does this function do")` is called
- Then: `{ detected: false, reason: "excluded" }`

**VR-23** [P1] AC-001-05 | negative
- Given: prompt is `"help me understand the architecture"`
- When: `resolveVerb("help me understand the architecture")` is called
- Then: `{ detected: false, reason: "excluded" }`

**VR-24** [P1] AC-001-05 | negative
- Given: prompt is `"show me the code"`
- When: `resolveVerb("show me the code")` is called
- Then: `{ detected: false, reason: "excluded" }`

**VR-25** [P1] AC-001-05 | negative
- Given: prompt is `"describe the module"`
- When: `resolveVerb("describe the module")` is called
- Then: `{ detected: false, reason: "excluded" }`

---

### describe: resolveVerb — Active Workflow (FR-006)

**VR-26** [P0] AC-006-04 | positive
- Given: prompt is `"build it"` and options `{ activeWorkflow: true }`
- When: `resolveVerb("build it", { activeWorkflow: true })` is called
- Then: `{ detected: true, verb: "build", blocked_by: "active_workflow" }`

**VR-27** [P1] AC-006-04 | positive
- Given: prompt is `"analyze it"` and options `{ activeWorkflow: false }`
- When: `resolveVerb("analyze it", { activeWorkflow: false })` is called
- Then: `blocked_by` is null

---

### describe: resolveVerb — Slash Command Bypass (FR-006)

**VR-28** [P0] AC-006-05 | negative
- Given: prompt is `"/isdlc analyze foo"` and options `{ isSlashCommand: true }`
- When: `resolveVerb("/isdlc analyze foo", { isSlashCommand: true })` is called
- Then: `{ detected: false, reason: "slash_command" }`

---

### describe: resolveVerb — Edge Cases (FR-006)

**VR-29** [P0] AC-006-06 | negative
- Given: prompt is empty string `""`
- When: `resolveVerb("")` is called
- Then: `{ detected: false, reason: "empty_input" }`

**VR-30** [P1] AC-006-06 | negative
- Given: prompt is `null`
- When: `resolveVerb(null)` is called
- Then: `{ detected: false, reason: "empty_input" }`

**VR-31** [P1] AC-006-06 | negative
- Given: prompt is `undefined`
- When: `resolveVerb(undefined)` is called
- Then: `{ detected: false, reason: "empty_input" }`

**VR-32** [P2] FR-006 | negative
- Given: prompt is `"hello world"` (no verb match, no exclusion)
- When: `resolveVerb("hello world")` is called
- Then: `{ detected: false }` with no reason field (or reason: null)

**VR-33** [P0] AC-003-04 | positive
- Given: any prompt that produces detected: true
- When: `resolveVerb("analyze it")` is called
- Then: `confirmation_required` is `true`

**VR-34** [P1] AC-003-02 | positive
- Given: prompt is `"analyze it"`
- When: `resolveVerb("analyze it")` is called
- Then: `source_phrase` is populated (e.g., `"analyze"`)

---

### describe: loadVerbSpec (FR-001)

**VR-35** [P0] AC-001-01, AC-001-02 | positive
- Given: default spec path
- When: `loadVerbSpec()` is called
- Then: returns object with `version`, `verbs`, `disambiguation`, `exclusions`

**VR-36** [P0] AC-001-02 | positive
- Given: default spec path
- When: `loadVerbSpec()` is called
- Then: `verbs` contains keys "add", "analyze", "build" with correct precedence (3, 2, 1)

**VR-37** [P1] Error handling | negative
- Given: spec path points to nonexistent file
- When: `loadVerbSpec("/nonexistent/path.json")` is called or `resolveVerb()` with missing spec
- Then: returns null / resolveVerb returns `{ detected: false, reason: "spec_missing" }`

---

## Test File 2: `tests/providers/codex/projection-verb-section.test.js`

**Prefix**: PVS-
**Module under test**: `src/providers/codex/projection.js` (`buildVerbRoutingSection`)

---

### describe: buildVerbRoutingSection (FR-002)

**PVS-01** [P0] AC-002-01 | positive
- Given: a valid verb spec object
- When: `buildVerbRoutingSection(spec)` is called
- Then: returns a non-empty string

**PVS-02** [P0] AC-002-03 | positive
- Given: a valid verb spec object
- When: `buildVerbRoutingSection(spec)` is called
- Then: output contains "RESERVED VERBS" header text

**PVS-03** [P1] AC-002-03 | positive
- Given: a valid verb spec
- When: `buildVerbRoutingSection(spec)` is called
- Then: output contains an intent detection table with verb/command/phrases

**PVS-04** [P0] AC-002-03 | positive
- Given: a valid verb spec with 3 verbs
- When: `buildVerbRoutingSection(spec)` is called
- Then: output mentions "add", "analyze", and "build"

**PVS-05** [P1] AC-002-03 | positive
- Given: a valid verb spec with disambiguation rules
- When: `buildVerbRoutingSection(spec)` is called
- Then: output contains disambiguation section referencing precedence

**PVS-06** [P0] AC-005-02 | positive
- Given: a valid verb spec
- When: `buildVerbRoutingSection(spec)` is called
- Then: output contains "MUST route" or equivalent reserved verb enforcement language

**PVS-07** [P1] Error handling | negative
- Given: null or undefined spec
- When: `buildVerbRoutingSection(null)` is called
- Then: returns empty string (fail-safe, does not throw)

**PVS-08** [P0] AC-002-02 | positive
- Given: verb routing section is generated
- When: integrated into `projectInstructions()` output
- Then: verb routing section appears at index 0 (first section in bundle)

---

## Test File 3: `tests/providers/codex/runtime-verb-guard.test.js`

**Prefix**: RVG-
**Module under test**: `src/providers/codex/runtime.js` (`applyVerbGuard`)

---

### describe: applyVerbGuard — Runtime Mode (FR-003, FR-007)

**RVG-01** [P0] AC-007-01 | positive
- Given: config `{ verb_routing: "runtime" }`, prompt `"analyze it"`, no active workflow
- When: `applyVerbGuard("analyze it", config, null)` is called
- Then: `modifiedPrompt` contains `RESERVED_VERB_ROUTING:` preamble

**RVG-02** [P0] AC-003-02 | positive
- Given: config `{ verb_routing: "runtime" }`, prompt `"analyze it"`
- When: `applyVerbGuard("analyze it", config, null)` is called
- Then: preamble contains fields: `detected: true`, `verb: "analyze"`, `command: "/isdlc analyze"`, `confirmation_required: true`

**RVG-03** [P0] AC-007-02 | positive
- Given: config `{ verb_routing: "prompt" }`, prompt `"analyze it"`
- When: `applyVerbGuard("analyze it", config, null)` is called
- Then: `modifiedPrompt === "analyze it"` (unchanged)

**RVG-04** [P0] AC-004-03 | positive
- Given: config `{}` (no verb_routing key), prompt `"analyze it"`
- When: `applyVerbGuard("analyze it", config, null)` is called
- Then: `modifiedPrompt === "analyze it"` (defaults to prompt mode, unchanged)

**RVG-05** [P1] AC-003-03 | positive
- Given: config `{ verb_routing: "runtime" }`, prompt `"hello world"` (no verb)
- When: `applyVerbGuard("hello world", config, null)` is called
- Then: `modifiedPrompt === "hello world"` (no preamble)

### describe: applyVerbGuard — Context Flags (FR-003)

**RVG-06** [P0] AC-003-02 | positive
- Given: config `{ verb_routing: "runtime" }`, prompt `"build it"`, state has active_workflow
- When: `applyVerbGuard("build it", config, { active_workflow: { type: "feature" } })` is called
- Then: preamble contains `blocked_by: "active_workflow"`

**RVG-07** [P1] AC-003-02 | positive
- Given: config `{ verb_routing: "runtime" }`, prompt `"add and analyze this"`
- When: `applyVerbGuard("add and analyze this", config, null)` is called
- Then: preamble contains `ambiguity: true`

### describe: applyVerbGuard — Negative Cases (FR-003)

**RVG-08** [P1] AC-003-03 | negative
- Given: config `{ verb_routing: "runtime" }`, prompt `"explain this code"` (excluded)
- When: `applyVerbGuard("explain this code", config, null)` is called
- Then: `modifiedPrompt === "explain this code"` (no preamble)

**RVG-09** [P1] AC-003-03 | negative
- Given: config `{ verb_routing: "runtime" }`, prompt `"/isdlc analyze foo"` (starts with /)
- When: `applyVerbGuard("/isdlc analyze foo", config, null)` is called
- Then: `modifiedPrompt === "/isdlc analyze foo"` (no preamble)

**RVG-10** [P1] AC-003-03 | negative
- Given: config `{ verb_routing: "runtime" }`, prompt `""` (empty)
- When: `applyVerbGuard("", config, null)` is called
- Then: `modifiedPrompt === ""` (no preamble)

### describe: applyVerbGuard — Return Shape (FR-003)

**RVG-11** [P0] AC-003-04 | positive
- Given: config `{ verb_routing: "runtime" }`, prompt with detected verb
- When: `applyVerbGuard("build it", config, null)` is called
- Then: `verbResult.confirmation_required === true`

**RVG-12** [P0] AC-003-01 | positive
- Given: any valid inputs
- When: `applyVerbGuard(prompt, config, state)` is called
- Then: returns object with exactly `{ modifiedPrompt: string, verbResult: object }`
