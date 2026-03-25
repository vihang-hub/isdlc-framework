# Test Strategy: REQ-0139 — Codex Reserved Verb Routing

## 1. Scope

Unit and integration tests for the reserved verb routing feature:
- `src/providers/codex/verb-resolver.js` — `resolveVerb()` and `loadVerbSpec()` functions
- `src/isdlc/config/reserved-verbs.json` — canonical verb spec schema validation
- `src/providers/codex/projection.js` — `buildVerbRoutingSection()` addition
- `src/providers/codex/runtime.js` — `applyVerbGuard()` addition

## 2. Existing Infrastructure

- **Framework**: `node:test` (project standard)
- **Assertions**: `node:assert/strict`
- **Existing tests**: 7 codex provider test files in `tests/providers/codex/`
- **Naming convention**: `{module}.test.js` with Test ID prefix (e.g., PRJ-, XRT-)
- **Test command**: `npm run test:providers` (glob: `tests/providers/**/*.test.js`)
- **Patterns**: ESM imports, `describe`/`it` blocks, AC references in test names

This strategy extends the existing codex provider test suite. It does NOT replace or restructure existing tests.

## 3. Test Framework

- **Runner**: `node:test` (project standard)
- **Assertions**: `node:assert/strict`
- **Command**: `npm run test:providers`
- **Module system**: ESM (`import`/`export`)

## 4. Test Files

| File | Prefix | Approx Tests | Type |
|------|--------|-------------|------|
| `tests/providers/codex/verb-resolver.test.js` | VR- | ~35 | Unit |
| `tests/providers/codex/runtime-verb-guard.test.js` | RVG- | ~12 | Integration |
| `tests/providers/codex/projection-verb-section.test.js` | PVS- | ~8 | Unit |

**Total new tests**: ~55

## 5. Test Pyramid

| Layer | Count | Percentage | Focus |
|-------|-------|------------|-------|
| Unit (verb-resolver) | ~35 | 64% | Pure function logic: phrase matching, precedence, disambiguation, exclusions, edge cases |
| Unit (projection) | ~8 | 14% | `buildVerbRoutingSection()` output format and content |
| Integration (runtime guard) | ~12 | 22% | `applyVerbGuard()` end-to-end: config reading, verb resolution, preamble generation |

The pyramid is bottom-heavy by design: `resolveVerb()` is a pure function with many input variations, making it ideal for exhaustive unit testing. Integration tests cover the runtime guard composition.

## 6. Coverage Strategy

### 6.1 verb-resolver.js — Unit Tests (VR-)

#### 6.1.1 Phrase Matching (FR-001, FR-006)

| Test ID | Target | Type | Acceptance Criteria |
|---------|--------|------|--------------------|
| VR-01 | `resolveVerb("analyze it")` → detected: true, verb: "analyze" | positive | AC-006-01 |
| VR-02 | `resolveVerb("think through this problem")` → detected: true, verb: "analyze" | positive | AC-001-03 |
| VR-03 | `resolveVerb("add to backlog")` → detected: true, verb: "add" | positive | AC-001-03 |
| VR-04 | `resolveVerb("track this idea")` → detected: true, verb: "add" | positive | AC-001-03 |
| VR-05 | `resolveVerb("build this component")` → detected: true, verb: "build" | positive | AC-001-03 |
| VR-06 | `resolveVerb("implement the feature")` → detected: true, verb: "build" | positive | AC-001-03 |
| VR-07 | `resolveVerb("let's do this")` → detected: true, verb: "build" | positive | AC-001-03 |
| VR-08 | `resolveVerb("ship it")` → detected: true, verb: "build" | positive | AC-001-03 |
| VR-09 | `resolveVerb("refactor the module")` → detected: true, verb: "build" | positive | AC-001-03 |
| VR-10 | `resolveVerb("ANALYZE IT")` → case insensitive match | positive | AC-001-03 |

#### 6.1.2 Command Mapping (FR-001)

| Test ID | Target | Type | Acceptance Criteria |
|---------|--------|------|--------------------|
| VR-11 | verb: "add" → command: "/isdlc add" | positive | AC-006-01 |
| VR-12 | verb: "analyze" → command: "/isdlc analyze" | positive | AC-006-01 |
| VR-13 | verb: "build" → command: "/isdlc build" | positive | AC-006-01 |

#### 6.1.3 Precedence (FR-001)

| Test ID | Target | Type | Acceptance Criteria |
|---------|--------|------|--------------------|
| VR-14 | analyze (precedence 2) wins over add (precedence 3) when both match | positive | AC-001-04 |
| VR-15 | build (precedence 1) wins over analyze (precedence 2) when both match | positive | AC-001-04 |
| VR-16 | build (precedence 1) wins when all three match | positive | AC-001-04 |

#### 6.1.4 Ambiguity and Disambiguation (FR-006)

| Test ID | Target | Type | Acceptance Criteria |
|---------|--------|------|--------------------|
| VR-17 | `resolveVerb("add and analyze this")` → ambiguity: true, ambiguous_verbs: ["add", "analyze"], verb: "analyze" | positive | AC-006-02 |
| VR-18 | `resolveVerb("analyze and build this")` → ambiguity: true, verb: "build" | positive | AC-001-04 |
| VR-19 | `resolveVerb("add and build this")` → ambiguity: true, verb: "build" | positive | AC-001-04 |
| VR-20 | `resolveVerb("add, analyze, and build")` → ambiguity: true, verb: "build" | positive | AC-001-04 |

#### 6.1.5 Exclusions (FR-001, FR-006)

| Test ID | Target | Type | Acceptance Criteria |
|---------|--------|------|--------------------|
| VR-21 | `resolveVerb("explain this code")` → detected: false, reason: "excluded" | negative | AC-006-03 |
| VR-22 | `resolveVerb("what does this function do")` → detected: false, reason: "excluded" | negative | AC-001-05 |
| VR-23 | `resolveVerb("help me understand the architecture")` → detected: false, reason: "excluded" | negative | AC-001-05 |
| VR-24 | `resolveVerb("show me the code")` → detected: false, reason: "excluded" | negative | AC-001-05 |
| VR-25 | `resolveVerb("describe the module")` → detected: false, reason: "excluded" | negative | AC-001-05 |

#### 6.1.6 Active Workflow (FR-006)

| Test ID | Target | Type | Acceptance Criteria |
|---------|--------|------|--------------------|
| VR-26 | `resolveVerb("build it", { activeWorkflow: true })` → detected: true, blocked_by: "active_workflow" | positive | AC-006-04 |
| VR-27 | `resolveVerb("analyze it", { activeWorkflow: false })` → blocked_by: null | positive | AC-006-04 |

#### 6.1.7 Slash Command Bypass (FR-006)

| Test ID | Target | Type | Acceptance Criteria |
|---------|--------|------|--------------------|
| VR-28 | `resolveVerb("/isdlc analyze foo", { isSlashCommand: true })` → detected: false, reason: "slash_command" | negative | AC-006-05 |

#### 6.1.8 Edge Cases (FR-006)

| Test ID | Target | Type | Acceptance Criteria |
|---------|--------|------|--------------------|
| VR-29 | `resolveVerb("")` → detected: false, reason: "empty_input" | negative | AC-006-06 |
| VR-30 | `resolveVerb(null)` → detected: false, reason: "empty_input" | negative | AC-006-06 |
| VR-31 | `resolveVerb(undefined)` → detected: false, reason: "empty_input" | negative | AC-006-06 |
| VR-32 | `resolveVerb("hello world")` → detected: false (no verb match, no exclusion) | negative | FR-006 |
| VR-33 | confirmation_required is always true on detected results | positive | AC-003-04 |
| VR-34 | source_phrase is populated with the matched phrase | positive | AC-003-02 |

#### 6.1.9 Verb Spec Loading (FR-001)

| Test ID | Target | Type | Acceptance Criteria |
|---------|--------|------|--------------------|
| VR-35 | `loadVerbSpec()` returns object with version, verbs, disambiguation, exclusions | positive | AC-001-01, AC-001-02 |
| VR-36 | Verb spec defines three verbs: add, analyze, build | positive | AC-001-02 |
| VR-37 | Missing spec file → resolveVerb returns reason: "spec_missing" | negative | Error handling |

### 6.2 projection.js — buildVerbRoutingSection (PVS-)

| Test ID | Target | Type | Acceptance Criteria |
|---------|--------|------|--------------------|
| PVS-01 | `buildVerbRoutingSection(spec)` returns a string | positive | AC-002-01 |
| PVS-02 | Output contains "RESERVED VERBS" header | positive | AC-002-03 |
| PVS-03 | Output contains intent detection table | positive | AC-002-03 |
| PVS-04 | Output lists all three verbs (add, analyze, build) | positive | AC-002-03 |
| PVS-05 | Output contains disambiguation rules | positive | AC-002-03 |
| PVS-06 | Output includes "MUST route" language | positive | AC-005-02 |
| PVS-07 | Empty/null spec → returns empty string (fail-safe) | negative | Error handling |
| PVS-08 | Verb routing section is inserted at index 0 of instruction bundle | positive | AC-002-02 |

### 6.3 runtime.js — applyVerbGuard Integration (RVG-)

| Test ID | Target | Type | Acceptance Criteria |
|---------|--------|------|--------------------|
| RVG-01 | Runtime mode + verb detected → modifiedPrompt contains RESERVED_VERB_ROUTING preamble | positive | AC-007-01 |
| RVG-02 | Runtime mode + verb detected → preamble has detected, verb, command, confirmation_required fields | positive | AC-003-02 |
| RVG-03 | Prompt mode → modifiedPrompt === original prompt | positive | AC-007-02 |
| RVG-04 | Missing verb_routing config → defaults to prompt mode, returns unmodified | positive | AC-004-03 |
| RVG-05 | Runtime mode + no verb detected → modifiedPrompt === original prompt | positive | AC-003-03 |
| RVG-06 | Runtime mode + active workflow → preamble includes blocked_by: "active_workflow" | positive | AC-003-02 |
| RVG-07 | Runtime mode + ambiguous prompt → preamble includes ambiguity: true | positive | AC-003-02 |
| RVG-08 | Runtime mode + excluded prompt → no preamble added | negative | AC-003-03 |
| RVG-09 | Runtime mode + slash command → no preamble added | negative | AC-003-03 |
| RVG-10 | Runtime mode + empty prompt → no preamble added | negative | AC-003-03 |
| RVG-11 | Preamble confirmation_required is always true | positive | AC-003-04 |
| RVG-12 | Return value is `{ modifiedPrompt, verbResult }` shape | positive | AC-003-01 |

## 7. Flaky Test Mitigation

- **Pure functions**: `resolveVerb()` is deterministic with no I/O, network, or timing dependencies. Tests are inherently stable.
- **File I/O isolation**: `loadVerbSpec()` reads a static JSON file. Tests that need to simulate missing spec should use the `specPath` parameter to point to a nonexistent path, not modify the real file.
- **No process spawning**: Unlike existing `runtime.test.js`, the verb guard tests do not spawn `codex exec`. They test the guard function in isolation.
- **Config injection**: `applyVerbGuard()` takes config and state as parameters (not read from disk), enabling deterministic testing without filesystem side effects.

## 8. Performance Test Plan

Performance is a quality attribute with threshold < 5ms for verb resolution.

| Test | Approach | Threshold |
|------|----------|-----------|
| VR-PERF-01 | Call `resolveVerb()` 1000 times, measure mean | Mean < 1ms per call |
| VR-PERF-02 | Cold load of verb spec via `loadVerbSpec()` | < 10ms |

These are lightweight checks embedded in the unit test file, not a separate performance suite. The verb set is small (3 verbs, ~20 phrases) and matching is regex-based, so sub-millisecond resolution is expected.

## 9. Security Considerations

- **Input validation**: Tests cover null, undefined, empty string, and extremely long inputs
- **No code execution**: `resolveVerb()` never executes commands — it only returns structured data with `confirmation_required: true`
- **No file writes**: The verb resolver only reads `reserved-verbs.json` via `readFileSync`

## 10. Risk Mitigation

| Risk | Mitigation | Test Coverage |
|------|------------|---------------|
| False positive on "analyze" in non-imperative context | Exclusion pattern tests (VR-21 through VR-25) | 5 negative tests |
| Structured preamble has wrong format | Preamble field validation (RVG-01, RVG-02) | 2 integration tests |
| Config drift between modes | Both modes tested with same inputs (RVG-01 vs RVG-03) | 2 integration tests |
| Missing verb spec at runtime | Fail-safe returns (VR-37, PVS-07) | 2 negative tests |
| Disambiguation map incomplete | All 4 combinations tested (VR-17 through VR-20) | 4 positive tests |

## 11. Coverage Target

- **Line coverage**: >= 80% (aligns with Article II threshold)
- **Branch coverage**: >= 80%
- **Function coverage**: 100% (all exported functions tested)
- **Requirement coverage**: 100% (all ACs traced — see traceability-matrix.csv)

## 12. Test Data Plan

### Boundary Values

| Input | Expected | Test ID |
|-------|----------|--------|
| Empty string `""` | detected: false, reason: "empty_input" | VR-29 |
| null | detected: false, reason: "empty_input" | VR-30 |
| undefined | detected: false, reason: "empty_input" | VR-31 |
| Single character `"a"` | detected: false | Implicit |
| Very long string (10K chars) | Completes without error | VR-PERF-01 |

### Invalid Inputs

| Input | Expected | Test ID |
|-------|----------|--------|
| Number (42) | detected: false, reason: "empty_input" | Edge case |
| Object ({}) | detected: false, reason: "empty_input" | Edge case |
| Missing spec file path | detected: false, reason: "spec_missing" | VR-37 |
| Malformed JSON spec | detected: false, reason: "spec_missing" | Error handling |

### Maximum-Size Inputs

| Input | Expected | Test ID |
|-------|----------|--------|
| 10,000 character prompt | Resolves correctly, < 5ms | VR-PERF-01 |
| Prompt with all verb phrases concatenated | Detects all, disambiguates to "build" | VR-20 |

### Valid Test Data (Fixtures)

Test data is inline in test files (matching existing codex test pattern). The verb spec itself serves as the fixture since it defines all phrases, forms, and disambiguation rules. No separate fixture files are needed.

## 13. Mutation Testing

Per Article XI, mutation testing is required:
- **Tool**: Stryker (JavaScript mutator)
- **Target**: `src/providers/codex/verb-resolver.js` (primary), `applyVerbGuard` in `runtime.js`
- **Score threshold**: >= 80%
- **Strategy**: The high test count (~55 tests) for a small module (~100 lines) provides strong mutation kill rates. Key mutants to watch: precedence comparisons, disambiguation map lookups, exclusion pattern matches.
