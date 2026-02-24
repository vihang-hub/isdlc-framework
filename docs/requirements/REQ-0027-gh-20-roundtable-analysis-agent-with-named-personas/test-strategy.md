# Test Strategy: Roundtable Analysis Agent with Named Personas

**Feature ID**: REQ-ROUNDTABLE-ANALYST (GH-20)
**Phase**: 05-test-strategy
**Date**: 2026-02-19
**Traces**: FR-001 through FR-012, NFR-001 through NFR-006, CON-001 through CON-006
**Constitutional Articles**: II (Test-First), VII (Traceability), IX (Quality Gate), XI (Integration Testing)

---

## 1. Executive Summary

This test strategy covers the Roundtable Analysis Agent feature, which introduces 1 new agent file, 24 step files, and modifications to 2 existing files (`three-verb-utils.cjs` and `isdlc.md`). The strategy extends the existing test infrastructure (Node.js built-in `node:test` + `node:assert/strict`, CJS tests in `src/claude/hooks/tests/`) rather than replacing it.

The feature's testability profile is mixed:
- **Directly testable**: `three-verb-utils.cjs` changes (CJS unit tests, 184 existing tests to maintain)
- **Structurally testable**: Step file YAML frontmatter validation (static analysis / parsing tests)
- **Indirectly testable**: Agent behavior (`roundtable-analyst.md` is a markdown prompt -- not programmatically testable, but integration patterns can be validated)
- **Manual verification**: Persona communication style, conversational UX quality

---

## 2. Existing Infrastructure (from test evaluation)

- **Framework**: Node.js built-in `node:test` + `node:assert/strict` (Node 18+)
- **Test Streams**: ESM (`lib/*.test.js`) and CJS (`src/claude/hooks/tests/*.test.cjs`)
- **Current Test Count**: 555 tests (302 ESM + 253 CJS) -- baseline per Article II
- **Coverage Tool**: None (no Istanbul/c8 configured); coverage tracked by test count and manual audit
- **Existing Patterns**:
  - CJS hook tests: `src/claude/hooks/tests/test-{module}.test.cjs` naming convention
  - Temp directory isolation: `fs.mkdtempSync()` for each test suite
  - Direct `require()` of target modules
  - `describe/it/beforeEach/afterEach` from `node:test`
  - `assert` from `node:assert/strict`
- **Existing three-verb-utils Tests**: 184 tests covering `readMetaJson`, `writeMetaJson`, `generateSlug`, `detectSource`, `deriveAnalysisStatus`, `parseBacklogLine`, `resolveItem`, `validatePhasesCompleted`, `computeStartPhase`, `checkStaleness`, and related utilities
- **Run Commands**:
  - Unit (CJS hooks): `node --test src/claude/hooks/tests/test-three-verb-utils.test.cjs`
  - All CJS: `npm run test:hooks`
  - All ESM: `npm test`
  - All: `npm run test:all`

---

## 3. Strategy Overview

### 3.1 Approach

Extend existing test suite -- do NOT redesign from scratch. Focus new tests on:
1. The `readMetaJson()` / `writeMetaJson()` schema extension (two new fields)
2. Step file YAML frontmatter validation logic (new test file)
3. Integration patterns: meta.json round-trip with step tracking
4. Backward compatibility of all changes

### 3.2 Testability Classification

| Component | Testability | Test Type | Approach |
|-----------|-------------|-----------|----------|
| `three-verb-utils.cjs` (readMetaJson/writeMetaJson) | HIGH | Unit (CJS) | Extend existing test suite with new test file |
| Step file YAML frontmatter schema | HIGH | Unit (CJS) | Parse step files and validate against VR-STEP-001..009 |
| Step file body structure | MEDIUM | Unit (CJS) | Validate presence of required sections |
| `isdlc.md` conditional delegation | LOW | Manual integration | Cannot unit test markdown; verify via end-to-end manual test |
| `roundtable-analyst.md` behavior | LOW | Manual integration | Agent behavior is LLM-driven; verify through usage |
| Persona communication style | LOW | Manual review | Subjective quality; verify by running analyze verb |
| Adaptive depth selection | MEDIUM | Unit (CJS) | Test depth determination logic extracted into testable functions |
| Session resumability | MEDIUM | Integration (manual) | Verify meta.json persistence across sessions |
| Backward compatibility | HIGH | Unit (CJS) | Existing 184 tests MUST continue passing |

---

## Test Pyramid

### 3.3 Test Distribution

```
                    /\
                   /  \       Manual E2E (3 scenarios)
                  /    \      - Full analyze verb with roundtable agent
                 /  E2E \     - Session resume across sessions
                /________\    - Fallback to standard agents
               /          \
              / Integration \   Integration Tests (8 tests)
             /   (CJS)      \  - meta.json round-trip with steps
            /______________  \  - Step file discovery + parsing
           /                  \
          /    Unit Tests       \   Unit Tests (45+ tests)
         /     (CJS)             \  - readMetaJson defaults (12 tests)
        /                         \ - writeMetaJson preservation (8 tests)
       /                           \- Step frontmatter validation (15 tests)
      /_____________________________\ - Body structure validation (10 tests)

Total automated: ~53+ tests
Total manual: 3 E2E scenarios
```

### 3.4 Coverage Targets

| Test Type | Target Count | Coverage Goal |
|-----------|-------------|---------------|
| Unit tests (three-verb-utils steps) | 20+ tests | 100% of new readMetaJson/writeMetaJson paths |
| Unit tests (step validation) | 25+ tests | 100% of VR-STEP-001 through VR-STEP-010 |
| Integration tests | 8+ tests | meta.json round-trip, step file discovery/parsing |
| Manual E2E | 3 scenarios | Full workflow, resume, fallback |
| Regression | 184 existing | 0 failures (100% pass rate maintained) |

**Baseline Impact**: After implementation, the total test count should increase from 555 to at least 608 (555 + 53 new). This satisfies Article II's regression threshold requirement.

---

## 4. Test File Organization

### 4.1 New Test Files

| File | Type | Module System | Description |
|------|------|--------------|-------------|
| `src/claude/hooks/tests/test-three-verb-utils-steps.test.cjs` | Unit | CJS | Tests for `steps_completed` and `depth_overrides` meta.json fields |
| `src/claude/hooks/tests/test-step-file-validator.test.cjs` | Unit | CJS | Tests for step file YAML frontmatter validation rules |

### 4.2 Existing Test Files (Unchanged)

| File | Impact |
|------|--------|
| `src/claude/hooks/tests/test-three-verb-utils.test.cjs` | MUST still pass all 184 tests after three-verb-utils.cjs change |

### 4.3 File Naming Convention

Follow existing convention: `test-{module-name}.test.cjs` for CJS hook tests.

---

## 5. Test Suites

### 5.1 Suite A: three-verb-utils Steps Extension (test-three-verb-utils-steps.test.cjs)

**Purpose**: Validate `readMetaJson()` and `writeMetaJson()` handle the new `steps_completed` and `depth_overrides` fields correctly.

**Traces**: FR-005, FR-006, NFR-005, VR-META-005 through VR-META-BC-004

#### Test Cases

| TC ID | Test Case | Type | Requirement | Priority |
|-------|-----------|------|-------------|----------|
| TC-A01 | readMetaJson defaults steps_completed to [] when field absent | positive | FR-005 AC-005-04, VR-META-005, VR-META-BC-001 | P0 |
| TC-A02 | readMetaJson defaults depth_overrides to {} when field absent | positive | FR-006 AC-006-06, VR-META-007, VR-META-BC-001 | P0 |
| TC-A03 | readMetaJson preserves existing steps_completed array | positive | FR-005 AC-005-01 | P0 |
| TC-A04 | readMetaJson preserves existing depth_overrides object | positive | FR-006 AC-006-06 | P0 |
| TC-A05 | readMetaJson corrects steps_completed when it is a string | negative | VR-META-005, ERR-META-004 | P1 |
| TC-A06 | readMetaJson corrects steps_completed when it is null | negative | VR-META-005, ERR-META-004 | P1 |
| TC-A07 | readMetaJson corrects steps_completed when it is a number | negative | VR-META-005, ERR-META-004 | P1 |
| TC-A08 | readMetaJson corrects depth_overrides when it is null | negative | VR-META-007, ERR-META-005 | P1 |
| TC-A09 | readMetaJson corrects depth_overrides when it is an array | negative | VR-META-007, ERR-META-005 | P1 |
| TC-A10 | readMetaJson corrects depth_overrides when it is a string | negative | VR-META-007, ERR-META-005 | P1 |
| TC-A11 | readMetaJson preserves all existing fields alongside new defaults | positive | NFR-005 AC-NFR-005-03 | P0 |
| TC-A12 | readMetaJson returns null for missing meta.json (unchanged behavior) | positive | ERR-META-001 | P0 |
| TC-A13 | readMetaJson returns null for corrupt JSON (unchanged behavior) | negative | ERR-META-002 | P1 |
| TC-A14 | writeMetaJson preserves steps_completed through write cycle | positive | FR-005 AC-005-05, VR-META-BC-002 | P0 |
| TC-A15 | writeMetaJson preserves depth_overrides through write cycle | positive | FR-006, VR-META-BC-002 | P0 |
| TC-A16 | writeMetaJson succeeds when steps_completed is absent (old callers) | positive | NFR-005 AC-NFR-005-04, VR-META-BC-003 | P0 |
| TC-A17 | writeMetaJson derives analysis_status from phases_completed only, not steps_completed | positive | VR-META-BC-004, NFR-005 AC-NFR-005-02 | P0 |
| TC-A18 | writeMetaJson deletes phase_a_completed but preserves steps_completed | positive | VR-META-BC-002 | P1 |
| TC-A19 | readMetaJson -> writeMetaJson round-trip preserves steps + depth | positive | FR-005, FR-006, NFR-005 | P0 |
| TC-A20 | readMetaJson handles meta.json with only legacy fields (full backward compat) | positive | NFR-005 AC-NFR-005-03 | P0 |

### 5.2 Suite B: Step File Validation (test-step-file-validator.test.cjs)

**Purpose**: Validate step file YAML frontmatter against VR-STEP-001 through VR-STEP-010 rules.

**Traces**: FR-004, FR-012, VR-STEP-001 through VR-STEP-015

**Implementation Note**: This test file will implement a `parseStepFrontmatter()` helper function that extracts and validates YAML frontmatter from step file content. This helper replicates the parsing logic the roundtable agent uses at runtime. It can also be used at authoring time to validate step files before committing.

#### Test Cases

| TC ID | Test Case | Type | Requirement | Priority |
|-------|-----------|------|-------------|----------|
| TC-B01 | Valid step file parses successfully with all required fields | positive | FR-012 AC-012-01, VR-STEP-001..005 | P0 |
| TC-B02 | step_id matching PP-NN format is accepted | positive | VR-STEP-001 | P0 |
| TC-B03 | step_id with invalid format is rejected | negative | VR-STEP-001 | P1 |
| TC-B04 | Empty step_id is rejected | negative | VR-STEP-001 | P1 |
| TC-B05 | Missing step_id field is rejected | negative | VR-STEP-001, ERR-STEP-005 | P1 |
| TC-B06 | title exceeding 60 characters is rejected | negative | VR-STEP-002 | P2 |
| TC-B07 | Empty title is rejected | negative | VR-STEP-002, ERR-STEP-005 | P1 |
| TC-B08 | persona "business-analyst" is accepted | positive | VR-STEP-003 | P0 |
| TC-B09 | persona "solutions-architect" is accepted | positive | VR-STEP-003 | P0 |
| TC-B10 | persona "system-designer" is accepted | positive | VR-STEP-003 | P0 |
| TC-B11 | persona with invalid value is rejected | negative | VR-STEP-003, ERR-STEP-006 | P1 |
| TC-B12 | depth "brief" is accepted | positive | VR-STEP-004 | P0 |
| TC-B13 | depth "standard" is accepted | positive | VR-STEP-004 | P0 |
| TC-B14 | depth "deep" is accepted | positive | VR-STEP-004 | P0 |
| TC-B15 | depth with invalid value is rejected | negative | VR-STEP-004, ERR-STEP-006 | P1 |
| TC-B16 | outputs with non-empty array is accepted | positive | VR-STEP-005 | P0 |
| TC-B17 | outputs with empty array is rejected | negative | VR-STEP-005, ERR-STEP-005 | P1 |
| TC-B18 | outputs that is not an array is rejected | negative | VR-STEP-005, ERR-STEP-005 | P1 |
| TC-B19 | depends_on as valid array is preserved | positive | VR-STEP-006, FR-012 AC-012-02 | P2 |
| TC-B20 | depends_on with invalid type defaults to [] | negative | VR-STEP-006 | P2 |
| TC-B21 | skip_if as string is preserved | positive | VR-STEP-007, FR-012 AC-012-02 | P2 |
| TC-B22 | skip_if with non-string type defaults to "" | negative | VR-STEP-007 | P2 |
| TC-B23 | Step body contains ## Standard Mode section | positive | VR-STEP-010 | P1 |
| TC-B24 | Step body missing ## Standard Mode falls back to raw body | negative | VR-STEP-010, ERR-STEP-007 | P1 |
| TC-B25 | Malformed YAML frontmatter returns parse error | negative | ERR-STEP-004 | P1 |
| TC-B26 | Missing YAML delimiters returns parse error | negative | ERR-STEP-004 | P1 |
| TC-B27 | step_id matches parent directory phase number (VR-STEP-008 cross-validation) | positive | VR-STEP-008, CON-005 | P2 |
| TC-B28 | Duplicate step_id across files is detected | negative | VR-STEP-009 | P2 |

### 5.3 Suite C: Step File Inventory Validation (within test-step-file-validator.test.cjs)

**Purpose**: Validate that all 24 required step files exist, have valid frontmatter, and follow the naming convention.

**Traces**: FR-004 AC-004-01, FR-012, CON-005, Section 10 (Step File Inventory)

| TC ID | Test Case | Type | Requirement | Priority |
|-------|-----------|------|-------------|----------|
| TC-C01 | All 3 Phase 00 step files exist | positive | FR-004 AC-004-01 | P0 |
| TC-C02 | All 8 Phase 01 step files exist | positive | FR-004 AC-004-01 | P0 |
| TC-C03 | All 4 Phase 02 step files exist | positive | FR-004 AC-004-01 | P0 |
| TC-C04 | All 4 Phase 03 step files exist | positive | FR-004 AC-004-01 | P0 |
| TC-C05 | All 5 Phase 04 step files exist | positive | FR-004 AC-004-01 | P0 |
| TC-C06 | Every step file has valid YAML frontmatter | positive | FR-012 AC-012-01 | P0 |
| TC-C07 | All step_ids match their file location (VR-STEP-008) | positive | VR-STEP-008, CON-005 | P1 |
| TC-C08 | No duplicate step_ids across all 24 files | positive | VR-STEP-009 | P1 |
| TC-C09 | All step files follow NN-name.md naming convention | positive | CON-005 | P1 |
| TC-C10 | Every step file body contains ## Standard Mode section | positive | VR-STEP-010 | P1 |

### 5.4 Suite D: Integration Tests (within test-three-verb-utils-steps.test.cjs)

**Purpose**: Validate end-to-end flows for meta.json step tracking.

**Traces**: FR-005, FR-006, NFR-003, NFR-005

| TC ID | Test Case | Type | Requirement | Priority |
|-------|-----------|------|-------------|----------|
| TC-D01 | Simulate step-by-step progression: read -> add step -> write -> read back | positive | FR-005 AC-005-01, AC-005-02 | P0 |
| TC-D02 | Simulate resume: read meta with partial steps, verify next step is correct | positive | FR-005 AC-005-02, NFR-003 AC-NFR-003-01 | P0 |
| TC-D03 | Simulate depth override: read -> set override -> write -> read back | positive | FR-006 AC-006-06 | P1 |
| TC-D04 | Simulate phase completion with steps: all steps done + phase appended | positive | FR-005, FR-009 AC-009-03 | P0 |
| TC-D05 | Old meta.json (no step fields) upgraded on read and preserved on write | positive | NFR-005 AC-NFR-005-02, AC-NFR-005-03 | P0 |

### 5.5 Suite E: Manual E2E Scenarios

**Purpose**: Validate full roundtable agent behavior that cannot be automated.

**Traces**: FR-001, FR-002, FR-003, FR-007, FR-008, FR-009, FR-011, NFR-002, NFR-006

| TC ID | Scenario | Steps | Expected | Priority |
|-------|----------|-------|----------|----------|
| TC-E01 | Full analyze flow with roundtable agent | 1. Add item to backlog. 2. Run `/isdlc analyze "item"`. 3. Verify Maya greets user in Phase 00. 4. Complete Phase 00 steps. 5. Verify Alex takes over for Phase 02. 6. Verify Jordan takes over for Phase 04. 7. Verify all artifacts produced. | All phases complete, persona transitions visible, artifacts in correct format | P0 |
| TC-E02 | Session resume | 1. Start analyze. 2. Complete 3 steps. 3. Interrupt (close terminal). 4. Re-run analyze for same item. 5. Verify resume from step 4 with context recovery. | "Welcome back" message, skipped completed steps, no work lost | P0 |
| TC-E03 | Fallback to standard agents | 1. Remove/rename roundtable-analyst.md. 2. Run analyze. 3. Verify standard phase agents are used. | Standard agents delegated, no errors | P0 |

---

## Flaky Test Mitigation

### 6.1 Flaky Test Prevention Strategies

| Risk | Mitigation |
|------|-----------|
| Temp directory cleanup race conditions | Use unique `fs.mkdtempSync()` prefix per test suite; `afterEach` cleanup with `force: true` |
| File system timing on CI | All file operations use synchronous APIs (`fs.readFileSync`, `fs.writeFileSync`) |
| JSON parse precision | Use `JSON.stringify(meta, null, 2)` consistently; compare parsed objects, not raw strings |
| Step file ordering on different OS | Tests sort by filename explicitly (lexicographic); do not rely on `fs.readdir` order |
| Test isolation | Each test creates its own temp directory; no shared mutable state between tests |
| Timestamp-dependent tests | Mock `Date.now()` or compare with tolerance where timestamps are involved |

### 6.2 Test Isolation Protocol

1. Each `describe()` block uses its own temp directory created in `beforeEach`.
2. No test reads or writes to the actual project directory.
3. Step file inventory tests (Suite C) read from the source tree but do not modify files.
4. All meta.json tests use synthetic test data, not production meta.json files.

---

## Performance Test Plan

### 7.1 Performance Characteristics

This feature is primarily I/O-bound (file reads/writes) and LLM-bound (agent conversation). The performance-critical paths are:

| Path | NFR | Target | How to Measure |
|------|-----|--------|----------------|
| Step transition time | NFR-001 AC-NFR-001-01 | Under 3 seconds | Manual: time between [C] press and next prompt |
| Phase boundary transition | NFR-001 AC-NFR-001-02 | Under 5 seconds | Manual: time from persona handoff to first step prompt |
| Session resume time | NFR-003 AC-NFR-003-01 | Under 5 seconds | Manual: time from analyze command to context recovery message |

### 7.2 Performance Test Approach

Performance testing is manual for this feature because the bottleneck is LLM response time, not code execution. The three-verb-utils.cjs file operations (readMetaJson, writeMetaJson) are fast (sub-millisecond) and do not warrant load testing. Step file parsing involves reading 3-8 small markdown files per phase, which completes in under 100ms.

**Automated micro-benchmark** (optional, in test-three-verb-utils-steps.test.cjs):
- TC-PERF-01: readMetaJson with 24 steps_completed entries completes in under 10ms
- TC-PERF-02: writeMetaJson with 24 steps_completed entries completes in under 10ms

---

## 8. Security Test Considerations

### 8.1 Input Validation

| Input | Validation Test | Approach |
|-------|----------------|----------|
| meta.json content (from disk) | Malformed JSON, unexpected types, missing fields | TC-A05..A13 (unit tests) |
| Step file YAML frontmatter | Injection via frontmatter values, malformed YAML | TC-B03..B26 (unit tests) |
| Step file body content | Not a security concern (content is read by LLM, not executed as code) | N/A |
| User input during conversation | Handled by Claude Code runtime, not by our code | N/A |

### 8.2 File System Security

| Risk | Mitigation | Test |
|------|-----------|------|
| Path traversal in artifact folder | Artifact folder path comes from isdlc.md (trusted); roundtable agent uses provided path | Manual review |
| Step file directory traversal | Step files discovered via Glob with fixed prefix path | Manual review |
| meta.json corruption by malicious actor | readMetaJson returns null on corrupt JSON; analysis restarts | TC-A13 |

---

## 9. Mutation Testing Plan (Article XI)

### 9.1 Scope

Mutation testing targets the `three-verb-utils.cjs` changes specifically:
- The `readMetaJson()` function's new conditional blocks (lines added for steps_completed and depth_overrides defaults)
- Boundary conditions in the type checking (`!Array.isArray`, `typeof !== 'object'`, `=== null`)

### 9.2 Approach

Since the project does not have a mutation testing tool configured, the test strategy uses **manual mutation analysis** to ensure test quality:

| Mutation | Expected Failing Test |
|----------|--------------------|
| Remove `!Array.isArray(raw.steps_completed)` check | TC-A05, TC-A06, TC-A07 should fail |
| Remove `raw.steps_completed = []` assignment | TC-A01, TC-A05..A07 should fail |
| Remove `typeof raw.depth_overrides !== 'object'` check | TC-A08 should fail |
| Remove `raw.depth_overrides === null` check | TC-A08 should fail |
| Remove `Array.isArray(raw.depth_overrides)` check | TC-A09 should fail |
| Remove `raw.depth_overrides = {}` assignment | TC-A02, TC-A08..A10 should fail |
| Change `[]` default to `null` | TC-A01, TC-A11, TC-A19 should fail |
| Change `{}` default to `null` | TC-A02, TC-A11, TC-A19 should fail |
| Remove `delete meta.phase_a_completed` from writeMetaJson | TC-A18 should fail |

Each mutation must kill at least one test. If a mutation survives, add a test to catch it.

### 9.3 Coverage Target

Mutation score target: >=80% (per Article XI). With the manual mutation set above (9 mutations), at least 8 must be detected.

---

## 10. Adversarial Testing Plan (Article XI)

### 10.1 Property-Based Inputs for meta.json

The following property generators ensure edge cases are covered:

| Property | Generator | Tests |
|----------|-----------|-------|
| steps_completed type | Random from: undefined, null, 0, "", false, [], {}, [1,2,3], "00-01" | TC-A01, TC-A05..A07 |
| depth_overrides type | Random from: undefined, null, 0, "", false, [], {}, {"01-requirements":"brief"} | TC-A02, TC-A08..A10 |
| steps_completed elements | Mix of valid step_ids, empty strings, numbers, objects | TC-A03, TC-A05 |
| depth_overrides values | Mix of valid depths, empty strings, numbers, invalid strings | TC-A04, TC-A08 |
| meta.json with only legacy fields | `{phase_a_completed: true}` | TC-A20 |

### 10.2 Boundary Value Analysis for Step Files

| Boundary | Value | Tests |
|----------|-------|-------|
| step_id minimum valid | "00-01" (4 chars + hyphen) | TC-B02 |
| step_id maximum valid | "99-99" | TC-B02 |
| step_id one char short | "0-01" (3-digit prefix) | TC-B03 |
| step_id with extra digits | "000-001" | TC-B03 |
| title at boundary (60 chars) | 60-char string | TC-B06 |
| title at boundary (61 chars) | 61-char string | TC-B06 |
| title empty | "" | TC-B07 |
| outputs with one element | ["file.md"] | TC-B16 |
| outputs with many elements | ["a.md", "b.md", "c.md"] | TC-B16 |
| outputs empty array | [] | TC-B17 |

---

## 11. Test Data Requirements

### 11.1 Meta.json Test Fixtures

| Fixture Name | Content | Used By |
|-------------|---------|---------|
| `meta-legacy-only` | `{description:"test", source:"manual", created_at:"2026-01-01", analysis_status:"raw", phases_completed:[]}` | TC-A01, TC-A02, TC-A11, TC-A20 |
| `meta-with-steps` | Legacy + `steps_completed:["00-01","00-02"]`, `depth_overrides:{"01-requirements":"brief"}` | TC-A03, TC-A04, TC-A14, TC-A15, TC-A19 |
| `meta-steps-string` | Legacy + `steps_completed:"00-01"` | TC-A05 |
| `meta-steps-null` | Legacy + `steps_completed:null` | TC-A06 |
| `meta-steps-number` | Legacy + `steps_completed:42` | TC-A07 |
| `meta-depth-null` | Legacy + `depth_overrides:null` | TC-A08 |
| `meta-depth-array` | Legacy + `depth_overrides:["brief"]` | TC-A09 |
| `meta-depth-string` | Legacy + `depth_overrides:"brief"` | TC-A10 |
| `meta-corrupt` | `{not valid json` | TC-A13 |
| `meta-full-legacy` | `{phase_a_completed:true, description:"old"}` | TC-A18, TC-A20 |

### 11.2 Step File Test Fixtures

| Fixture Name | Content | Used By |
|-------------|---------|---------|
| `valid-step` | Complete frontmatter with all required fields + ## Standard Mode body | TC-B01, TC-B02 |
| `invalid-step-id` | step_id: "abc" | TC-B03 |
| `empty-step-id` | step_id: "" | TC-B04 |
| `missing-step-id` | No step_id field in frontmatter | TC-B05 |
| `long-title` | title with 61 characters | TC-B06 |
| `invalid-persona` | persona: "product-manager" | TC-B11 |
| `invalid-depth` | depth: "thorough" | TC-B15 |
| `empty-outputs` | outputs: [] | TC-B17 |
| `malformed-yaml` | `---\nstep_id: "unclosed` | TC-B25 |
| `no-delimiters` | Markdown without --- delimiters | TC-B26 |

---

## 12. Regression Testing

### 12.1 Regression Scope

| Area | Test Count | Action |
|------|-----------|--------|
| Existing three-verb-utils tests | 184 | MUST all pass after `readMetaJson()` change |
| Existing CJS hook tests | 253 total | Run full `npm run test:hooks` after changes |
| Existing ESM lib tests | 302 total | Run full `npm test` (no changes to ESM modules) |
| Build auto-detection | Part of existing 184 | `computeStartPhase`, `checkStaleness` must still work |
| analysis_status derivation | Part of existing 184 | Must still derive from phases_completed only |

### 12.2 Regression Test Commands

```bash
# Run all hook tests (includes existing 184 + new tests)
npm run test:hooks

# Run specific three-verb-utils tests (verify existing pass)
node --test src/claude/hooks/tests/test-three-verb-utils.test.cjs

# Run new step tests
node --test src/claude/hooks/tests/test-three-verb-utils-steps.test.cjs

# Run step file validation tests
node --test src/claude/hooks/tests/test-step-file-validator.test.cjs

# Run all tests (full regression)
npm run test:all
```

---

## 13. Test Execution Plan

### 13.1 Execution Order

1. **Pre-implementation**: Verify all 555 existing tests pass (baseline)
2. **After three-verb-utils.cjs change**: Run existing 184 three-verb-utils tests (regression)
3. **After new test file creation**: Run test-three-verb-utils-steps.test.cjs (all should fail initially -- RED phase)
4. **After implementation**: Run test-three-verb-utils-steps.test.cjs (all should pass -- GREEN phase)
5. **After step files created**: Run test-step-file-validator.test.cjs
6. **Post-implementation**: Run full `npm run test:all` (555 + 53 new = 608+ total)
7. **Manual E2E**: Execute TC-E01, TC-E02, TC-E03

### 13.2 CI Integration

The new test files follow the existing CJS test convention and will be picked up by `npm run test:hooks` automatically (which runs `node --test src/claude/hooks/tests/*.test.cjs`).

---

## 14. Acceptance Criteria Coverage Summary

| Requirement | AC Count | Automated Test Count | Manual Test Count | Coverage |
|-------------|----------|---------------------|-------------------|----------|
| FR-001 | 4 | 0 | 1 (TC-E01) | Manual (agent behavior) |
| FR-002 | 5 | 0 | 1 (TC-E01) | Manual (persona behavior) |
| FR-003 | 6 | 0 | 1 (TC-E01) | Manual (phase mapping) |
| FR-004 | 6 | 10 (TC-C01..C10) | 0 | Automated |
| FR-005 | 5 | 7 (TC-A01,A03,A14,A19,D01,D02,D04) | 0 | Automated |
| FR-006 | 7 | 5 (TC-A02,A04,A15,A19,D03) | 0 | Automated |
| FR-007 | 6 | 0 | 1 (TC-E01) | Manual (menu system) |
| FR-008 | 4 | 0 | 1 (TC-E01) | Manual (persona transition) |
| FR-009 | 4 | 2 (TC-A12,D05) | 1 (TC-E03) | Mixed |
| FR-010 | 6 | 0 | 1 (TC-E01) | Manual (artifact production) |
| FR-011 | 3 | 0 | 2 (TC-E01,E02) | Manual (greetings) |
| FR-012 | 4 | 28 (TC-B01..B28) | 0 | Automated |
| NFR-001 | 2 | 0 | 1 (TC-E01) | Manual (timing) |
| NFR-002 | 2 | 0 | 1 (TC-E01) | Manual (persona consistency) |
| NFR-003 | 3 | 2 (TC-D02,D05) | 1 (TC-E02) | Mixed |
| NFR-004 | 3 | 2 (TC-C06,TC-B01) | 0 | Automated |
| NFR-005 | 4 | 7 (TC-A16..A20,D05) | 1 (TC-E03) | Mixed |
| NFR-006 | 3 | 0 | 1 (TC-E01) | Manual (UX quality) |

**Total Requirements**: 18 (12 FR + 6 NFR)
**Total ACs**: ~77
**Automated Tests**: 53+
**Manual Tests**: 3 E2E scenarios covering 13 requirements

---

## 15. GATE-04 Checklist

- [x] Test strategy covers unit, integration, E2E, security, performance
- [x] Test cases exist for all requirements (see traceability matrix)
- [x] Traceability matrix complete (100% requirement coverage verified)
- [x] Coverage targets defined (553+ new tests, baseline maintained)
- [x] Test data strategy documented (Section 11)
- [x] Critical paths identified (three-verb-utils backward compat, step validation, fallback)
- [x] Extends existing test infrastructure (Node.js node:test, CJS conventions)
- [x] Mutation testing plan included (Section 9, Article XI)
- [x] Adversarial testing plan included (Section 10, Article XI)

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-19 | Test Strategy Designer (Phase 05) | Initial test strategy |
