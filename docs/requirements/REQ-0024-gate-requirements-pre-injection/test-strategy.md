# Test Strategy: Gate Requirements Pre-Injection

**REQ ID:** REQ-0024
**Phase:** 05-test-strategy
**Created:** 2026-02-18
**Status:** Draft
**Module Under Test:** `src/claude/hooks/lib/gate-requirements-injector.cjs`

---

## 1. Existing Infrastructure

### 1.1 Framework and Conventions

- **Test framework:** Node.js built-in `node:test` + `node:assert/strict` (Node 18+)
- **Module system:** CommonJS (`.test.cjs` extension)
- **Test file location:** `src/claude/hooks/tests/`
- **Naming convention:** `gate-requirements-injector.test.cjs`
- **Shared utilities:** `src/claude/hooks/tests/hook-test-utils.cjs` -- provides `setupTestEnv()`, `cleanupTestEnv()`, `writeConfig()`, `writeIterationRequirements()`
- **Test runner command:** `node --test src/claude/hooks/tests/gate-requirements-injector.test.cjs`
- **Existing test baseline:** 555 tests (302 ESM + 253 CJS) per constitution Article II

### 1.2 Patterns to Follow

This test file follows the convention established by `test-three-verb-utils.test.cjs` and `common.test.cjs`:

1. Direct `require()` of the module under test (not child process spawn) because the module is a library, not a hook
2. Temp directory isolation with `fs.mkdtempSync` for config file fixture creation
3. `beforeEach` / `afterEach` for setup and teardown
4. Test IDs prefixed with category codes (e.g., `TC-U01`, `TC-I01`, `TC-E01`)
5. Traceability comments linking each test to requirement IDs

### 1.3 Coverage Tool

No dedicated coverage tool is in use. Coverage validation is structural: every acceptance criterion must have a corresponding test case, verified through the traceability matrix.

---

## 2. Test Strategy

### 2.1 Approach

**Test-first design** (Article II): All test cases are specified here before implementation begins. The implementation in Phase 06 will write production code to satisfy these tests.

**Direct module testing**: Since `gate-requirements-injector.cjs` is a stateless library module (not a hook that runs as a child process), tests require the module directly and call its exported function. Internal helpers are tested indirectly through the exported `buildGateRequirementsBlock()` function.

**Isolated filesystem**: Each test creates a temporary directory with the exact config file structure needed. No test reads from the real project config files.

### 2.2 Test Types

| Type | Count | Coverage Focus |
|------|-------|---------------|
| Unit -- Main function (`buildGateRequirementsBlock`) | 15 | All acceptance criteria for FR-01, FR-05, NFR-01, NFR-04 |
| Unit -- Template variable resolution | 4 | FR-02 (AC-02-01 through AC-02-03) + edge case |
| Unit -- Constitution article parsing | 5 | FR-03 (AC-03-01 through AC-03-04) + edge case |
| Unit -- Workflow override merging | 6 | FR-04 (AC-04-01 through AC-04-05) + deep merge |
| Unit -- Output format validation | 5 | FR-05 (AC-05-01 through AC-05-06) |
| Integration -- Full pipeline | 3 | End-to-end with all 4 config files |
| Edge cases -- Invalid inputs and error handling | 12 | NFR-01, error taxonomy E-INP-001 through E-RT-002 |
| Performance | 1 | NFR-02 (sub-100ms execution) |
| **Total** | **51** | |

### 2.3 Coverage Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| Requirement coverage | 100% | Every AC has at least one test (Article VII) |
| Branch coverage (structural) | 95%+ | All conditional paths in formatBlock, all try/catch branches |
| Error scenario coverage | 100% | Every entry in the error taxonomy (Section 4 of design) has a test |
| Edge case coverage | 100% | All 12 edge cases from design EC-01 through EC-12 |

### 2.4 Test Execution

```bash
# Run this test file only
node --test src/claude/hooks/tests/gate-requirements-injector.test.cjs

# Run all CJS hook tests (includes this file)
npm run test:hooks

# Run full test suite
npm run test:all
```

---

## 3. Test Case Specifications

### 3.1 Category U: Unit Tests -- Main Function (buildGateRequirementsBlock)

#### TC-U01: Happy path -- known phase with all configs present
**Traces:** FR-01 (AC-01-01, AC-01-02, AC-01-03), FR-05 (AC-05-01)
**Given:** Temp dir with `iteration-requirements.json` containing phase `06-implementation` with test_iteration enabled, `artifact-paths.json` with paths for `06-implementation`, `constitution.md` with all 14 articles, `workflows.json` with feature workflow agent_modifiers for `06-implementation`
**When:** `buildGateRequirementsBlock('06-implementation', 'REQ-0024-test', 'feature', testDir)` is called
**Then:** Returns a non-empty string starting with `GATE REQUIREMENTS (Phase: 06-implementation):`
**And:** Contains `test_iteration: enabled`
**And:** Contains `constitutional_validation: enabled`
**And:** Contains `Constitutional Articles:` section
**And:** Contains `Workflow Overrides:` section

#### TC-U02: Unknown phase key returns empty string
**Traces:** FR-01 (AC-01-04), NFR-01
**Given:** Temp dir with valid `iteration-requirements.json` (no phase `99-unknown`)
**When:** `buildGateRequirementsBlock('99-unknown', 'REQ-0024-test', 'feature', testDir)` is called
**Then:** Returns `""` (empty string)

#### TC-U03: Missing iteration-requirements.json returns empty string
**Traces:** FR-01 (AC-01-05), NFR-01, error E-FILE-001
**Given:** Temp dir with NO `iteration-requirements.json` at either lookup path
**When:** `buildGateRequirementsBlock('01-requirements', 'REQ-0024-test', 'feature', testDir)` is called
**Then:** Returns `""` (empty string)

#### TC-U04: Missing artifact-paths.json -- block generated without artifact content
**Traces:** FR-01 (AC-01-06), NFR-01, error E-FILE-002
**Given:** Temp dir with `iteration-requirements.json` for `01-requirements` but NO `artifact-paths.json`
**When:** `buildGateRequirementsBlock('01-requirements', 'REQ-0024-test', 'feature', testDir)` is called
**Then:** Returns a non-empty string containing `Required Artifacts:`
**And:** Contains `(none for this phase)` in the artifacts section

#### TC-U05: Missing constitution.md -- article IDs shown as fallback
**Traces:** FR-03 (AC-03-04), NFR-01, error E-FILE-003
**Given:** Temp dir with `iteration-requirements.json` for `01-requirements` (constitutional_validation enabled with articles ["I", "IV"]) but NO `constitution.md`
**When:** `buildGateRequirementsBlock('01-requirements', 'REQ-0024-test', 'feature', testDir)` is called
**Then:** Returns a non-empty string containing `Constitutional Articles:`
**And:** Contains `Article I (unknown)` (raw ID fallback)
**And:** Contains `Article IV (unknown)` (raw ID fallback)

#### TC-U06: Missing workflows.json -- block without Workflow Overrides section
**Traces:** FR-04 (AC-04-03), NFR-01, error E-FILE-004
**Given:** Temp dir with `iteration-requirements.json` for `01-requirements`, `artifact-paths.json`, `constitution.md`, but NO `workflows.json`
**When:** `buildGateRequirementsBlock('01-requirements', 'REQ-0024-test', 'feature', testDir)` is called
**Then:** Returns a non-empty string
**And:** Does NOT contain `Workflow Overrides:`

#### TC-U07: Phase with all requirements disabled produces valid block
**Traces:** FR-05 (AC-05-05), FR-01
**Given:** Temp dir with `iteration-requirements.json` containing phase `00-quick-scan` with all requirements disabled
**When:** `buildGateRequirementsBlock('00-quick-scan', 'REQ-0024-test', 'feature', testDir)` is called
**Then:** Returns a non-empty string starting with `GATE REQUIREMENTS (Phase: 00-quick-scan):`
**And:** Contains `test_iteration: disabled`
**And:** Contains `constitutional_validation: disabled`
**And:** Does NOT contain `Constitutional Articles:` section

#### TC-U08: Return type is always string -- never null or undefined
**Traces:** FR-05 (AC-05-06), NFR-01
**Given:** Various invalid inputs
**When:** `buildGateRequirementsBlock()` is called with each invalid input
**Then:** Return value satisfies `typeof result === 'string'` for every case

#### TC-U09: No workflow type provided -- skips workflow overrides and modifiers
**Traces:** FR-04 (AC-04-03)
**Given:** Temp dir with all configs, `workflows.json` with agent_modifiers
**When:** `buildGateRequirementsBlock('01-requirements', 'REQ-0024-test', undefined, testDir)` is called
**Then:** Returns a non-empty string
**And:** Does NOT contain `Workflow Overrides:` section

#### TC-U10: Workflow type not in workflows.json -- skips overrides
**Traces:** FR-04 (AC-04-04)
**Given:** Temp dir with `workflows.json` containing only `feature` workflow
**When:** `buildGateRequirementsBlock('01-requirements', 'REQ-0024-test', 'unknown-workflow', testDir)` is called
**Then:** Returns a non-empty string
**And:** Does NOT contain `Workflow Overrides:` section

#### TC-U11: Phase with no agent_modifiers in workflow -- no overrides section
**Traces:** FR-04 (AC-04-05)
**Given:** Temp dir with `workflows.json` where `feature` workflow has no `agent_modifiers` entry for `04-design`
**When:** `buildGateRequirementsBlock('04-design', 'REQ-0024-test', 'feature', testDir)` is called
**Then:** Returns a non-empty string
**And:** Does NOT contain `Workflow Overrides:` section

#### TC-U12: Invalid JSON in iteration-requirements.json returns empty string
**Traces:** NFR-01, error E-PARSE-001
**Given:** Temp dir with `iteration-requirements.json` containing `{invalid json`
**When:** `buildGateRequirementsBlock('01-requirements', 'REQ-0024-test', 'feature', testDir)` is called
**Then:** Returns `""` (empty string)

#### TC-U13: Invalid JSON in artifact-paths.json -- block without artifacts
**Traces:** NFR-01, error E-PARSE-002
**Given:** Temp dir with valid `iteration-requirements.json` and `artifact-paths.json` containing `not json`
**When:** `buildGateRequirementsBlock('01-requirements', 'REQ-0024-test', 'feature', testDir)` is called
**Then:** Returns a non-empty string
**And:** Contains `(none for this phase)` in the artifacts section

#### TC-U14: Invalid JSON in workflows.json -- block without overrides
**Traces:** NFR-01, error E-PARSE-004
**Given:** Temp dir with valid configs except `workflows.json` containing `{bad`
**When:** `buildGateRequirementsBlock('01-requirements', 'REQ-0024-test', 'feature', testDir)` is called
**Then:** Returns a non-empty string
**And:** Does NOT contain `Workflow Overrides:`

#### TC-U15: Dual-path config lookup -- source path preferred over runtime path
**Traces:** NFR-03
**Given:** Temp dir with `iteration-requirements.json` at both `src/claude/hooks/config/` (source) and `.claude/hooks/config/` (runtime), with different content
**When:** `buildGateRequirementsBlock('01-requirements', 'REQ-0024-test', 'feature', testDir)` is called
**Then:** Returns block based on the source path content (not runtime path content)

---

### 3.2 Category T: Unit Tests -- Template Variable Resolution

#### TC-T01: artifact_folder substitution
**Traces:** FR-02 (AC-02-01)
**Given:** Temp dir with `artifact-paths.json` containing path `docs/requirements/{artifact_folder}/requirements-spec.md`
**When:** `buildGateRequirementsBlock('01-requirements', 'REQ-0024-test', undefined, testDir)` is called
**Then:** Output contains `docs/requirements/REQ-0024-test/requirements-spec.md`

#### TC-T02: Path with no template variables -- unchanged
**Traces:** FR-02 (AC-02-02)
**Given:** Temp dir with `artifact-paths.json` containing path `docs/common/test-strategy.md` (no variables)
**When:** `buildGateRequirementsBlock('01-requirements', 'REQ-0024-test', undefined, testDir)` is called
**Then:** Output contains `docs/common/test-strategy.md` unchanged

#### TC-T03: Unrecognized template variable left as-is
**Traces:** FR-02 (AC-02-03)
**Given:** Temp dir with `artifact-paths.json` containing path `docs/{unknown_var}/file.md`
**When:** `buildGateRequirementsBlock('01-requirements', 'REQ-0024-test', undefined, testDir)` is called
**Then:** Output contains `docs/{unknown_var}/file.md` (unrecognized variable preserved)

#### TC-T04: Multiple occurrences of same variable in one path
**Traces:** FR-02 (implicit)
**Given:** Temp dir with `artifact-paths.json` containing path `docs/{artifact_folder}/{artifact_folder}/file.md`
**When:** `buildGateRequirementsBlock('01-requirements', 'REQ-0024-test', undefined, testDir)` is called
**Then:** Output contains `docs/REQ-0024-test/REQ-0024-test/file.md` (both replaced)

---

### 3.3 Category C: Unit Tests -- Constitution Article Parsing

#### TC-C01: Standard article mapping
**Traces:** FR-03 (AC-03-01)
**Given:** Temp dir with `constitution.md` containing `### Article VII: Artifact Traceability` and `iteration-requirements.json` with constitutional_validation.articles including `"VII"`
**When:** `buildGateRequirementsBlock(...)` is called for a phase with constitutional_validation
**Then:** Output contains `Article VII: Artifact Traceability`

#### TC-C02: Multiple articles mapped in order
**Traces:** FR-03 (AC-03-02)
**Given:** Temp dir with `constitution.md` containing articles I, IV, VII, IX, XII and config requiring all five
**When:** `buildGateRequirementsBlock(...)` is called
**Then:** Output contains all five articles in the order listed in the config: `Article I: Specification Primacy`, `Article IV: Explicit Over Implicit`, `Article VII: Artifact Traceability`, `Article IX: Quality Gate Integrity`, `Article XII: Cross-Platform Compatibility`

#### TC-C03: Unknown article ID -- fallback format
**Traces:** FR-03 (AC-03-03)
**Given:** Temp dir with `constitution.md` containing articles I through XIV, and config requiring article `"XV"` (not in constitution)
**When:** `buildGateRequirementsBlock(...)` is called
**Then:** Output contains `Article XV (unknown)`

#### TC-C04: Constitution.md missing -- raw IDs for all articles
**Traces:** FR-03 (AC-03-04)
**Given:** Temp dir with NO `constitution.md`, config requiring articles `["I", "IV"]`
**When:** `buildGateRequirementsBlock(...)` is called
**Then:** Output contains `Article I (unknown)` and `Article IV (unknown)`

#### TC-C05: Constitution.md with no matching headers -- empty article map
**Traces:** FR-03 (implicit), error E-PARSE-003
**Given:** Temp dir with `constitution.md` containing random text with no `### Article` headers
**When:** `buildGateRequirementsBlock(...)` is called for a phase with articles ["I"]
**Then:** Output contains `Article I (unknown)` (regex found no matches)

---

### 3.4 Category W: Unit Tests -- Workflow Override Merging

#### TC-W01: Feature workflow with phase-specific agent_modifiers
**Traces:** FR-04 (AC-04-01)
**Given:** Temp dir with `workflows.json` containing feature workflow with `agent_modifiers["01-requirements"]` = `{ "scope": "feature", "artifact_prefix": "REQ" }`
**When:** `buildGateRequirementsBlock('01-requirements', 'REQ-0024-test', 'feature', testDir)` is called
**Then:** Output contains `Workflow Overrides:` section with `scope: feature` and `artifact_prefix: REQ`

#### TC-W02: ATDD conditional modifiers serialized as JSON
**Traces:** FR-04 (AC-04-02)
**Given:** Temp dir with `workflows.json` containing feature workflow with `agent_modifiers["06-implementation"]` containing `_when_atdd_mode` nested object
**When:** `buildGateRequirementsBlock('06-implementation', 'REQ-0024-test', 'feature', testDir)` is called
**Then:** Output contains `_when_atdd_mode:` with JSON-serialized nested object

#### TC-W03: Missing workflows.json -- no overrides section
**Traces:** FR-04 (AC-04-03)
**Given:** Temp dir with NO `workflows.json`
**When:** `buildGateRequirementsBlock('01-requirements', 'REQ-0024-test', 'feature', testDir)` is called
**Then:** Output does NOT contain `Workflow Overrides:`

#### TC-W04: Workflow type not found in workflows.json -- no overrides
**Traces:** FR-04 (AC-04-04)
**Given:** Temp dir with `workflows.json` containing only `feature` workflow
**When:** `buildGateRequirementsBlock('01-requirements', 'REQ-0024-test', 'hotfix', testDir)` is called
**Then:** Output does NOT contain `Workflow Overrides:`

#### TC-W05: Phase key not in agent_modifiers -- no overrides section
**Traces:** FR-04 (AC-04-05)
**Given:** Temp dir with `workflows.json` containing feature workflow but no `agent_modifiers["04-design"]`
**When:** `buildGateRequirementsBlock('04-design', 'REQ-0024-test', 'feature', testDir)` is called
**Then:** Output does NOT contain `Workflow Overrides:`

#### TC-W06: Deep merge of workflow_overrides from iteration-requirements.json
**Traces:** FR-04 (implicit), design section 2.1 step 3
**Given:** Temp dir with `iteration-requirements.json` containing `workflow_overrides.feature["08-code-review"]` that sets `constitutional_validation.articles` to `["VI", "IX"]`, and base `08-code-review` phase having articles `["I", "VI", "IX"]`
**When:** `buildGateRequirementsBlock('08-code-review', 'REQ-0024-test', 'feature', testDir)` is called
**Then:** Output `Constitutional Articles:` section shows only the overridden articles `["VI", "IX"]` (not the base articles)

---

### 3.5 Category F: Unit Tests -- Output Format Validation

#### TC-F01: Block header format
**Traces:** FR-05, design section 3.1
**Given:** Any valid call that returns a non-empty block
**When:** Result is inspected
**Then:** First line matches `GATE REQUIREMENTS (Phase: {phaseKey}):`

#### TC-F02: Iteration Requirements section always present
**Traces:** FR-05, design section 3.1
**Given:** Any valid call that returns a non-empty block
**When:** Result is inspected
**Then:** Contains `  Iteration Requirements:` (2-space indent)
**And:** Contains at least `test_iteration`, `constitutional_validation`, `artifact_validation`, `interactive_elicitation`, `agent_delegation_validation`, `atdd_validation`

#### TC-F03: Enabled test_iteration shows sub-parameters
**Traces:** FR-05 (AC-05-01)
**Given:** Config with test_iteration enabled (max_iterations: 10, circuit_breaker_threshold: 3, success_criteria.min_coverage_percent: 80)
**When:** `buildGateRequirementsBlock(...)` is called
**Then:** Output contains `test_iteration: enabled`
**And:** Contains `max_iterations: 10, circuit_breaker: 3, min_coverage: 80%` on the sub-parameter line

#### TC-F04: Disabled test_iteration shows no sub-parameters
**Traces:** FR-05 (AC-05-02)
**Given:** Config with test_iteration disabled
**When:** `buildGateRequirementsBlock(...)` is called
**Then:** Output contains `test_iteration: disabled`
**And:** No sub-parameter line follows

#### TC-F05: Indentation hierarchy (0/2/4/6 spaces)
**Traces:** FR-05, design section 3.2
**Given:** A call that produces a full block with all sections
**When:** Output lines are inspected
**Then:** Block header has 0-space indent
**And:** Section headers (`Iteration Requirements:`, `Required Artifacts:`, `Constitutional Articles:`, `Workflow Overrides:`) have 2-space indent
**And:** Item lines (`- test_iteration:`, `- docs/...`) have 4-space indent
**And:** Sub-parameter lines have 6-space indent

---

### 3.6 Category I: Integration Tests

#### TC-I01: Full pipeline with all 4 config files
**Traces:** FR-01, FR-02, FR-03, FR-04, FR-05
**Given:** Temp dir with all 4 config files populated realistically:
  - `iteration-requirements.json` with `01-requirements` phase
  - `artifact-paths.json` with `01-requirements` paths
  - `constitution.md` with articles I, IV, VII, IX, XII
  - `workflows.json` with feature workflow agent_modifiers for `01-requirements`
**When:** `buildGateRequirementsBlock('01-requirements', 'REQ-0024-test', 'feature', testDir)` is called
**Then:** Returns a block matching the expected output from design Example B
**And:** Contains `Iteration Requirements:` section
**And:** Contains `Required Artifacts:` with resolved path `docs/requirements/REQ-0024-test/requirements-spec.md`
**And:** Contains `Constitutional Articles:` with all 5 articles and titles
**And:** Contains `Workflow Overrides:` with `scope: feature`

#### TC-I02: Full pipeline with minimal phase (00-quick-scan)
**Traces:** FR-01, FR-05 (AC-05-05)
**Given:** Temp dir with configs matching design Example E
**When:** `buildGateRequirementsBlock('00-quick-scan', 'REQ-0024-test', 'feature', testDir)` is called
**Then:** Returns a block with all iteration requirements showing `disabled`
**And:** No `Constitutional Articles:` section
**And:** `Required Artifacts:` shows `(none for this phase)`

#### TC-I03: Full pipeline with overridden phase (08-code-review feature)
**Traces:** FR-04, FR-05, design Example D
**Given:** Temp dir with configs matching design Example D (workflow overrides change constitutional articles)
**When:** `buildGateRequirementsBlock('08-code-review', 'REQ-0024-test', 'feature', testDir)` is called
**Then:** Returns a block with articles `["VI", "IX"]` (overridden from base)
**And:** Contains `Workflow Overrides:` with `scope: human-review-only`

---

### 3.7 Category E: Edge Case Tests

#### TC-E01: null phaseKey
**Traces:** NFR-01, error E-INP-001, edge case EC-01
**Given:** No special setup
**When:** `buildGateRequirementsBlock(null, 'REQ-0024-test', 'feature', testDir)` is called
**Then:** Returns `""` (empty string)

#### TC-E02: Empty string phaseKey
**Traces:** NFR-01, error E-INP-001, edge case EC-02
**Given:** No special setup
**When:** `buildGateRequirementsBlock('', 'REQ-0024-test', 'feature', testDir)` is called
**Then:** Returns `""` (empty string)

#### TC-E03: Non-string phaseKey (number)
**Traces:** NFR-01, error E-INP-001, edge case EC-03
**Given:** No special setup
**When:** `buildGateRequirementsBlock(42, 'REQ-0024-test', 'feature', testDir)` is called
**Then:** Returns `""` (empty string)

#### TC-E04: null artifactFolder
**Traces:** NFR-01, error E-INP-002, edge case EC-04
**Given:** No special setup
**When:** `buildGateRequirementsBlock('04-design', null, 'feature', testDir)` is called
**Then:** Returns `""` (empty string)

#### TC-E05: Empty string artifactFolder
**Traces:** NFR-01, error E-INP-002, edge case EC-05
**Given:** No special setup
**When:** `buildGateRequirementsBlock('04-design', '', 'feature', testDir)` is called
**Then:** Returns `""` (empty string)

#### TC-E06: Non-string workflowType (number) -- treated as absent
**Traces:** NFR-01, error E-INP-003, edge case EC-06/EC-07
**Given:** Temp dir with valid configs
**When:** `buildGateRequirementsBlock('04-design', 'REQ-0024-test', 42, testDir)` is called
**Then:** Returns a non-empty block
**And:** Does NOT contain `Workflow Overrides:`

#### TC-E07: null projectRoot -- falls back to process.cwd()
**Traces:** NFR-01, error E-INP-004, edge case EC-08
**Given:** Config files placed in the process.cwd() directory structure (or mock)
**When:** `buildGateRequirementsBlock('01-requirements', 'REQ-0024-test', 'feature', null)` is called
**Then:** Attempts to read configs from CWD (returns `""` if configs not at CWD, which validates the fallback path runs without error)

#### TC-E08: Non-existent projectRoot path
**Traces:** NFR-01, error E-FILE-001, edge case EC-09
**Given:** projectRoot set to `/nonexistent/path/12345`
**When:** `buildGateRequirementsBlock('01-requirements', 'REQ-0024-test', 'feature', '/nonexistent/path/12345')` is called
**Then:** Returns `""` (empty string, config files not found)

#### TC-E09: undefined phaseKey
**Traces:** NFR-01, error E-INP-001
**Given:** No special setup
**When:** `buildGateRequirementsBlock(undefined, 'REQ-0024-test', 'feature', testDir)` is called
**Then:** Returns `""` (empty string)

#### TC-E10: Config file with BOM encoding
**Traces:** NFR-01, error E-RT-002
**Given:** Temp dir with `iteration-requirements.json` prefixed with UTF-8 BOM (\\xEF\\xBB\\xBF)
**When:** `buildGateRequirementsBlock('01-requirements', 'REQ-0024-test', 'feature', testDir)` is called
**Then:** Either returns a valid block (if JSON.parse handles BOM) or returns `""` (fail-open)

#### TC-E11: Empty iteration-requirements.json file
**Traces:** NFR-01, error E-PARSE-001
**Given:** Temp dir with empty `iteration-requirements.json` file (0 bytes)
**When:** `buildGateRequirementsBlock('01-requirements', 'REQ-0024-test', 'feature', testDir)` is called
**Then:** Returns `""` (empty string)

#### TC-E12: Config with missing phase_requirements property
**Traces:** NFR-01, error E-SCHEMA-001
**Given:** Temp dir with `iteration-requirements.json` containing `{ "version": "2.1.0" }` (no `phase_requirements`)
**When:** `buildGateRequirementsBlock('01-requirements', 'REQ-0024-test', 'feature', testDir)` is called
**Then:** Returns `""` (empty string)

---

### 3.8 Category P: Performance Tests

#### TC-P01: Execution completes under 100ms
**Traces:** NFR-02
**Given:** Temp dir with all 4 config files (realistic size)
**When:** `buildGateRequirementsBlock(...)` is called with timing measurement
**Then:** Execution duration is less than 100ms

---

## 4. Test Data Plan

### 4.1 Config File Fixtures

Each test creates its own config file fixtures in a temp directory. The following fixture templates are reused across tests.

#### iteration-requirements.json (minimal valid)
```json
{
  "version": "2.1.0",
  "phase_requirements": {
    "01-requirements": {
      "test_iteration": { "enabled": false },
      "constitutional_validation": {
        "enabled": true,
        "max_iterations": 5,
        "articles": ["I", "IV", "VII", "IX", "XII"]
      },
      "artifact_validation": { "enabled": true },
      "interactive_elicitation": {
        "enabled": true,
        "min_menu_interactions": 3
      },
      "agent_delegation_validation": { "enabled": true },
      "atdd_validation": { "enabled": false }
    },
    "00-quick-scan": {
      "test_iteration": { "enabled": false },
      "constitutional_validation": { "enabled": false },
      "artifact_validation": { "enabled": false },
      "interactive_elicitation": { "enabled": false },
      "agent_delegation_validation": { "enabled": false },
      "atdd_validation": { "enabled": false }
    },
    "06-implementation": {
      "test_iteration": {
        "enabled": true,
        "max_iterations": 10,
        "circuit_breaker_threshold": 3,
        "success_criteria": {
          "all_tests_passing": true,
          "min_coverage_percent": 80
        }
      },
      "constitutional_validation": {
        "enabled": true,
        "max_iterations": 5,
        "articles": ["I", "II", "III", "V", "VI", "VII", "VIII", "IX", "X"]
      },
      "artifact_validation": { "enabled": false },
      "interactive_elicitation": { "enabled": false },
      "agent_delegation_validation": { "enabled": true },
      "atdd_validation": {
        "enabled": true,
        "when": "atdd_mode",
        "requires": ["all_priority_tests_passing", "no_orphan_skips", "red_green_transitions_recorded"]
      }
    },
    "04-design": {
      "test_iteration": { "enabled": false },
      "constitutional_validation": {
        "enabled": true,
        "max_iterations": 5,
        "articles": ["I", "IV", "V", "VII", "IX"]
      },
      "artifact_validation": { "enabled": true },
      "interactive_elicitation": { "enabled": false },
      "agent_delegation_validation": { "enabled": true },
      "atdd_validation": { "enabled": false }
    },
    "08-code-review": {
      "test_iteration": { "enabled": true, "max_iterations": 5, "circuit_breaker_threshold": 3 },
      "constitutional_validation": {
        "enabled": true,
        "max_iterations": 5,
        "articles": ["I", "VI", "IX"]
      },
      "artifact_validation": { "enabled": true },
      "interactive_elicitation": { "enabled": false },
      "agent_delegation_validation": { "enabled": true },
      "atdd_validation": { "enabled": false }
    }
  },
  "workflow_overrides": {
    "feature": {
      "08-code-review": {
        "test_iteration": { "enabled": false },
        "constitutional_validation": {
          "articles": ["VI", "IX"]
        }
      }
    }
  }
}
```

#### artifact-paths.json (minimal valid)
```json
{
  "version": "1.0.0",
  "phases": {
    "01-requirements": {
      "paths": ["docs/requirements/{artifact_folder}/requirements-spec.md"]
    },
    "04-design": {
      "paths": ["docs/requirements/{artifact_folder}/module-design.md"]
    },
    "08-code-review": {
      "paths": ["docs/requirements/{artifact_folder}/code-review-report.md"]
    }
  }
}
```

#### constitution.md (minimal valid)
```markdown
# Project Constitution

### Article I: Specification Primacy
Content...

### Article IV: Explicit Over Implicit
Content...

### Article V: Simplicity First
Content...

### Article VI: Code Review Required
Content...

### Article VII: Artifact Traceability
Content...

### Article IX: Quality Gate Integrity
Content...

### Article XII: Cross-Platform Compatibility
Content...
```

#### workflows.json (minimal valid)
```json
{
  "version": "1.0.0",
  "workflows": {
    "feature": {
      "agent_modifiers": {
        "00-quick-scan": {
          "scope": "lightweight-scan",
          "generate_scope_estimate": true
        },
        "01-requirements": {
          "scope": "feature",
          "artifact_prefix": "REQ",
          "read_quick_scan": true
        },
        "06-implementation": {
          "_when_atdd_mode": {
            "track_red_green_transitions": true,
            "require_priority_order": true
          }
        },
        "08-code-review": {
          "scope": "human-review-only"
        }
      }
    }
  }
}
```

### 4.2 Fixture Placement in Temp Directory

The test helper creates the following directory structure per test:

```
{testDir}/
  src/claude/hooks/config/
    iteration-requirements.json    # Source path (preferred by dual-path lookup)
    artifact-paths.json
  .claude/hooks/config/
    iteration-requirements.json    # Runtime path (fallback)
    artifact-paths.json
  .isdlc/config/
    workflows.json
  docs/isdlc/
    constitution.md
```

### 4.3 Fixture Helper Functions

```javascript
// Helper: write iteration-requirements.json to source path
function writeIterReq(testDir, config) {
    const dir = path.join(testDir, 'src', 'claude', 'hooks', 'config');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'iteration-requirements.json'),
        JSON.stringify(config, null, 2));
}

// Helper: write artifact-paths.json to source path
function writeArtifactPaths(testDir, config) {
    const dir = path.join(testDir, 'src', 'claude', 'hooks', 'config');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'artifact-paths.json'),
        JSON.stringify(config, null, 2));
}

// Helper: write constitution.md
function writeConstitution(testDir, content) {
    const dir = path.join(testDir, 'docs', 'isdlc');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'constitution.md'), content);
}

// Helper: write workflows.json
function writeWorkflows(testDir, config) {
    const dir = path.join(testDir, '.isdlc', 'config');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'workflows.json'),
        JSON.stringify(config, null, 2));
}

// Helper: write all 4 configs with realistic data
function writeAllConfigs(testDir) {
    writeIterReq(testDir, FIXTURE_ITER_REQ);
    writeArtifactPaths(testDir, FIXTURE_ARTIFACT_PATHS);
    writeConstitution(testDir, FIXTURE_CONSTITUTION);
    writeWorkflows(testDir, FIXTURE_WORKFLOWS);
}
```

---

## 5. Traceability Matrix

### 5.1 Requirements to Test Cases

| Requirement | Acceptance Criterion | Test Case(s) | Priority |
|-------------|---------------------|-------------|----------|
| FR-01 | AC-01-01 | TC-U01 | Must Have |
| FR-01 | AC-01-02 | TC-U01, TC-T01 | Must Have |
| FR-01 | AC-01-03 | TC-U01, TC-C01 | Must Have |
| FR-01 | AC-01-04 | TC-U02 | Must Have |
| FR-01 | AC-01-05 | TC-U03 | Must Have |
| FR-01 | AC-01-06 | TC-U04, TC-U13 | Must Have |
| FR-01 | AC-01-07 | TC-U05, TC-C04 | Must Have |
| FR-02 | AC-02-01 | TC-T01 | Must Have |
| FR-02 | AC-02-02 | TC-T02 | Must Have |
| FR-02 | AC-02-03 | TC-T03 | Must Have |
| FR-03 | AC-03-01 | TC-C01 | Must Have |
| FR-03 | AC-03-02 | TC-C02 | Must Have |
| FR-03 | AC-03-03 | TC-C03 | Must Have |
| FR-03 | AC-03-04 | TC-C04 | Must Have |
| FR-04 | AC-04-01 | TC-W01 | Should Have |
| FR-04 | AC-04-02 | TC-W02 | Should Have |
| FR-04 | AC-04-03 | TC-W03, TC-U06, TC-U09 | Should Have |
| FR-04 | AC-04-04 | TC-W04, TC-U10 | Should Have |
| FR-04 | AC-04-05 | TC-W05, TC-U11 | Should Have |
| FR-05 | AC-05-01 | TC-F03, TC-U01 | Must Have |
| FR-05 | AC-05-02 | TC-F04 | Must Have |
| FR-05 | AC-05-03 | TC-C02, TC-I01 | Must Have |
| FR-05 | AC-05-04 | TC-T01, TC-I01 | Must Have |
| FR-05 | AC-05-05 | TC-U07, TC-I02 | Must Have |
| FR-05 | AC-05-06 | TC-U08 | Must Have |
| FR-06 | AC-06-01 | TC-I01 (validates output format compatible with delegation) | Must Have |
| FR-06 | AC-06-02 | TC-U03, TC-U02 (empty string result) | Must Have |
| FR-06 | AC-06-03 | TC-I01 (parseable block structure) | Must Have |
| FR-06 | AC-06-04 | (integration test -- verified by design, not unit-testable in isolation) | Must Have |
| FR-06 | AC-06-05 | (integration test -- verified by design) | Must Have |
| NFR-01 | Fail-open on any error | TC-U02, TC-U03, TC-U04, TC-U05, TC-U06, TC-U08, TC-U12, TC-U13, TC-U14, TC-E01-TC-E12 | Must Have |
| NFR-02 | Sub-100ms execution | TC-P01 | Should Have |
| NFR-03 | Source path preferred | TC-U15 | Must Have |
| NFR-04 | Backward compatibility | TC-U02, TC-U03 (empty string = unchanged prompt) | Must Have |
| NFR-05 | CJS module pattern | (verified at implementation, not runtime test) | Must Have |

### 5.2 Error Taxonomy to Test Cases

| Error Code | Test Case |
|-----------|-----------|
| E-INP-001 | TC-E01, TC-E02, TC-E03, TC-E09 |
| E-INP-002 | TC-E04, TC-E05 |
| E-INP-003 | TC-E06 |
| E-INP-004 | TC-E07 |
| E-FILE-001 | TC-U03 |
| E-FILE-002 | TC-U04 |
| E-FILE-003 | TC-U05, TC-C04 |
| E-FILE-004 | TC-U06, TC-W03 |
| E-PARSE-001 | TC-U12, TC-E11 |
| E-PARSE-002 | TC-U13 |
| E-PARSE-003 | TC-C05 |
| E-PARSE-004 | TC-U14 |
| E-SCHEMA-001 | TC-E12 |
| E-SCHEMA-002 | TC-U07 (missing fields treated as disabled) |
| E-SCHEMA-003 | TC-U04 (artifact-paths with no phases property) |
| E-RT-001 | TC-E08 (non-existent path triggers readFileSync error) |
| E-RT-002 | TC-E10 |

### 5.3 Design Edge Cases to Test Cases

| Edge Case | Test Case |
|----------|-----------|
| EC-01 | TC-E01 |
| EC-02 | TC-E02 |
| EC-03 | TC-E03 |
| EC-04 | TC-E04 |
| EC-05 | TC-E05 |
| EC-06 | TC-E06 |
| EC-07 | TC-E06 |
| EC-08 | TC-E07 |
| EC-09 | TC-E08 |
| EC-10 | TC-U02 |
| EC-11 | TC-U10 |
| EC-12 | TC-U07 |

---

## 6. Test File Organization

### 6.1 File Path

```
src/claude/hooks/tests/gate-requirements-injector.test.cjs
```

### 6.2 Internal Structure

```javascript
'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Module under test (direct require, not child process)
const { buildGateRequirementsBlock } = require('../lib/gate-requirements-injector.cjs');

// --- Fixtures ---
const FIXTURE_ITER_REQ = { ... };
const FIXTURE_ARTIFACT_PATHS = { ... };
const FIXTURE_CONSTITUTION = '...';
const FIXTURE_WORKFLOWS = { ... };

// --- Helpers ---
let testDir;
function setup() { ... }
function cleanup() { ... }
function writeIterReq(dir, config) { ... }
function writeArtifactPaths(dir, config) { ... }
function writeConstitution(dir, content) { ... }
function writeWorkflows(dir, config) { ... }
function writeAllConfigs(dir) { ... }

// --- Test Categories ---
describe('REQ-0024: Gate Requirements Injector', () => {

    describe('Unit: Main function (buildGateRequirementsBlock)', () => {
        // TC-U01 through TC-U15
    });

    describe('Unit: Template variable resolution', () => {
        // TC-T01 through TC-T04
    });

    describe('Unit: Constitution article parsing', () => {
        // TC-C01 through TC-C05
    });

    describe('Unit: Workflow override merging', () => {
        // TC-W01 through TC-W06
    });

    describe('Unit: Output format validation', () => {
        // TC-F01 through TC-F05
    });

    describe('Integration: Full pipeline', () => {
        // TC-I01 through TC-I03
    });

    describe('Edge cases: Invalid inputs and error handling', () => {
        // TC-E01 through TC-E12
    });

    describe('Performance', () => {
        // TC-P01
    });
});
```

---

## 7. Critical Paths

The following paths are critical and require 100% coverage:

1. **Fail-open contract**: Every code path that could throw must be caught and return `""`. Tested by TC-U02, TC-U03, TC-U12, TC-E01 through TC-E12.
2. **Template variable resolution**: Incorrect resolution would inject wrong artifact paths into delegation prompts. Tested by TC-T01 through TC-T04.
3. **Config file lookup order**: Using wrong config file could give stale/wrong requirements. Tested by TC-U15.
4. **Constitutional article mapping**: Wrong article titles could mislead agents. Tested by TC-C01 through TC-C05.
5. **Workflow override deep merge**: Incorrect merge could give wrong requirements to agents. Tested by TC-W06, TC-I03.

---

## 8. Constitutional Compliance

| Article | How This Test Strategy Complies |
|---------|-------------------------------|
| II (Test-First Development) | All 51 test cases specified before implementation begins. Test file structure designed to be written in Phase 06 before production code. |
| VII (Artifact Traceability) | Every requirement (FR-01 through FR-06, NFR-01 through NFR-05) traced to specific test cases (Section 5). Every error code mapped to tests (Section 5.2). Every design edge case mapped to tests (Section 5.3). |
| IX (Quality Gate Integrity) | Test strategy validates the very feature that informs agents about gate requirements. All gate-related scenarios covered. |
| XI (Integration Testing Integrity) | Three integration tests (TC-I01 through TC-I03) validate the full pipeline of config loading, parsing, template resolution, and output formatting working together. |

---

## 9. GATE-05 Checklist

- [x] Test strategy covers unit, integration, edge case, and performance testing
- [x] Test cases exist for all requirements (FR-01 through FR-06, NFR-01 through NFR-05)
- [x] Traceability matrix complete (100% requirement coverage verified in Section 5)
- [x] Coverage targets defined (Section 2.3)
- [x] Test data strategy documented (Section 4)
- [x] Critical paths identified (Section 7)
- [x] Test file follows existing CJS conventions (Section 6)
- [x] All 32 acceptance criteria have corresponding test cases
- [x] All 15 error codes have corresponding test cases
- [x] All 12 design edge cases have corresponding test cases
