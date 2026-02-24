# Test Strategy: REQ-0003 - Framework-Controlled Suggested Prompts

**Artifact ID:** REQ-0003-suggested-prompts
**Phase:** 05 - Test Strategy
**Created:** 2026-02-08
**Status:** Final

---

## 1. Test Philosophy

This feature modifies **only markdown agent instruction files** -- zero runtime code, zero hooks, zero configs, zero new dependencies. The test strategy therefore focuses on **structural format validation** of the 36 agent markdown files rather than behavioral/functional testing.

Testing validates that:
1. Every agent file contains the required prompt section (coverage completeness)
2. Each section follows the correct format for its agent classification (format compliance)
3. Dynamic resolution references are used instead of hardcoded phase names (correctness)
4. No regressions are introduced in the existing 610-test suite (regression safety)

### Test Pyramid for This Feature

```
         /\
        /  \    Manual: Workflow walkthrough (1 run, not automated)
       /----\
      / E2E  \   None needed -- no runtime code changed
     /--------\
    / Integr.  \  None needed -- no cross-module interaction changed
   /------------\
  / Unit/Static  \  ALL testing here: structural validation of .md files
 /________________\
```

Since the feature is purely additive markdown, all automated tests are **static analysis tests** that read agent files and verify structural properties. No mocking, no I/O simulation, no subprocess execution required.

---

## 2. Test Architecture

### 2.1 Test File

**Location:** `lib/prompt-format.test.js` (ESM)

**Framework:** `node:test` + `node:assert/strict` (existing framework, zero new dependencies)

**Why ESM not CJS:** The test reads agent `.md` files from `src/claude/agents/` and validates their content. It is not testing hooks (which use CJS). ESM aligns with the `lib/*.test.js` convention.

### 2.2 Test Registration

Add to `package.json` scripts: No change needed. The existing `"test": "node --test lib/*.test.js lib/utils/*.test.js"` glob already captures `lib/prompt-format.test.js`.

### 2.3 Agent File Classification

Tests require classifying each agent file into one of four categories. A helper function handles this:

```
classify(filePath) -> 'orchestrator' | 'sub-orchestrator' | 'sub-agent' | 'phase-agent'
```

**Classification rules (evaluated in order):**

| Pattern | Classification | Count |
|---------|---------------|-------|
| `00-sdlc-orchestrator` | orchestrator | 1 |
| `impact-analysis-orchestrator` | sub-orchestrator | 1 |
| `tracing-orchestrator` | sub-orchestrator | 1 |
| `discover-orchestrator` | sub-orchestrator | 1 |
| `discover/` directory | sub-agent | 11 |
| `impact-analysis/` directory (not orchestrator) | sub-agent | 3 |
| `tracing/` directory (not orchestrator) | sub-agent | 3 |
| Everything else | phase-agent | 16 |
| **Total** | | **36** |

Note: The quick-scan-agent (`quick-scan/quick-scan-agent.md`) classifies as `phase-agent` because `quick-scan/` does not match any sub-agent pattern.

### 2.4 Expected Agent File Inventory

The test MUST validate against a complete, explicit file list to ensure no agent is missed. The expected inventory:

**Phase agents (16):**
- `01-requirements-analyst.md`
- `02-solution-architect.md`
- `03-system-designer.md`
- `04-test-design-engineer.md`
- `05-software-developer.md`
- `06-integration-tester.md`
- `07-qa-engineer.md`
- `08-security-compliance-auditor.md`
- `09-cicd-engineer.md`
- `10-dev-environment-engineer.md`
- `11-deployment-engineer-staging.md`
- `12-release-manager.md`
- `13-site-reliability-engineer.md`
- `14-upgrade-engineer.md`
- `quick-scan/quick-scan-agent.md`
- `00-sdlc-orchestrator.md` (counted separately as orchestrator, but validated for prompt section)

**Sub-orchestrators (3):**
- `impact-analysis/impact-analysis-orchestrator.md`
- `tracing/tracing-orchestrator.md`
- `discover-orchestrator.md`

**Sub-agents (17):**
- `discover/architecture-analyzer.md`
- `discover/test-evaluator.md`
- `discover/constitution-generator.md`
- `discover/skills-researcher.md`
- `discover/data-model-analyzer.md`
- `discover/product-analyst.md`
- `discover/architecture-designer.md`
- `discover/feature-mapper.md`
- `discover/characterization-test-generator.md`
- `discover/artifact-integration.md`
- `discover/atdd-bridge.md`
- `impact-analysis/impact-analyzer.md`
- `impact-analysis/entry-point-finder.md`
- `impact-analysis/risk-assessor.md`
- `tracing/symptom-analyzer.md`
- `tracing/execution-path-tracer.md`
- `tracing/root-cause-identifier.md`

---

## 3. Test Case Design

### 3.1 Test Suites by Validation Rule

Each validation rule (VR-001 through VR-014) maps to one or more test cases. Tests are grouped into logical suites.

| Suite | Validation Rules | Test Count | Priority |
|-------|-----------------|------------|----------|
| TC-01: Section Presence | VR-001 | 4 | Critical |
| TC-02: Phase Agent Format | VR-002, VR-014 | 6 | Critical |
| TC-03: Sub-Agent Format | VR-003 | 4 | Critical |
| TC-04: Sub-Orchestrator Format | VR-004 | 4 | Medium |
| TC-05: Orchestrator Emission | VR-005 | 4 | High |
| TC-06: ASCII Compliance | VR-006 | 2 | Medium |
| TC-07: Dynamic Resolution | VR-007 | 3 | High |
| TC-08: Prompt Tier Order | VR-008 | 3 | High |
| TC-09: Fallback Presence | VR-009 | 3 | Medium |
| TC-10: Agent 01 Interactive | VR-010 | 2 | Medium |
| TC-11: State Schema | VR-011 | 1 | High |
| TC-12: No New Dependencies | VR-013 | 1 | Low |
| TC-13: Agent Inventory | (meta) | 2 | Critical |
| **Total** | | **39** | |

### 3.2 Test Case Definitions

#### TC-01: Section Presence (VR-001)

| ID | Description | Input | Expected | Priority |
|----|-------------|-------|----------|----------|
| TC-01-01 | All 36 agent files exist | Glob `src/claude/agents/**/*.md` | Exactly 36 files found | Critical |
| TC-01-02 | All 15 phase agents + QS have `# SUGGESTED PROMPTS` | Read each file | Section heading found | Critical |
| TC-01-03 | All 17 sub-agents have `# SUGGESTED PROMPTS` | Read each file | Section heading found | Critical |
| TC-01-04 | Orchestrator has `# PROMPT EMISSION PROTOCOL` | Read `00-sdlc-orchestrator.md` | Section heading found | Critical |

#### TC-02: Phase Agent Format (VR-002, VR-014)

| ID | Description | Input | Expected | Priority |
|----|-------------|-------|----------|----------|
| TC-02-01 | Phase agents have `## Resolution Logic` subsection | Read SUGGESTED PROMPTS section | Subsection found in all 16 | Critical |
| TC-02-02 | Phase agents have `## Output Format` subsection | Read SUGGESTED PROMPTS section | Subsection found in all 16 | Critical |
| TC-02-03 | Phase agents have `## Fallback` subsection | Read SUGGESTED PROMPTS section | Subsection found in all 16 | Critical |
| TC-02-04 | Phase agents have `SUGGESTED NEXT STEPS:` in output template | Read SUGGESTED PROMPTS section | String found in all 16 | Critical |
| TC-02-05 | Phase agents have at least `[1]`, `[2]`, `[3]` references | Read SUGGESTED PROMPTS section | All three item references found | Critical |
| TC-02-06 | SUGGESTED PROMPTS appears after SELF-VALIDATION | Read full file, compare line positions | SELF-VALIDATION line < SUGGESTED PROMPTS line (when both present) | Low |

#### TC-03: Sub-Agent Format (VR-003)

| ID | Description | Input | Expected | Priority |
|----|-------------|-------|----------|----------|
| TC-03-01 | Sub-agents have `STATUS:` in prompt section | Read SUGGESTED PROMPTS section | String found in all 17 | Critical |
| TC-03-02 | Sub-agents do NOT have `[1]` items | Read SUGGESTED PROMPTS section | No `[1]`, `[2]`, `[3]` references | Critical |
| TC-03-03 | Sub-agents do NOT have `SUGGESTED NEXT STEPS:` | Read SUGGESTED PROMPTS section | String NOT found in any of 17 | Critical |
| TC-03-04 | Sub-agents reference their parent orchestrator | Read STATUS line | Contains `Returning results to` | High |

#### TC-04: Sub-Orchestrator Format (VR-004)

| ID | Description | Input | Expected | Priority |
|----|-------------|-------|----------|----------|
| TC-04-01 | Sub-orchestrators have `SUGGESTED NEXT STEPS:` | Read SUGGESTED PROMPTS section | String found in all 3 | Medium |
| TC-04-02 | Sub-orchestrators have `[1]`, `[2]`, `[3]` items | Read SUGGESTED PROMPTS section | All three item references found | Medium |
| TC-04-03 | Sub-orchestrators do NOT use STATUS format as output | Read Output Format subsection | STATUS is not the output pattern | Medium |
| TC-04-04 | Discover orchestrator uses static prompts (no Resolution Logic) | Read SUGGESTED PROMPTS section | No `## Resolution Logic` in discover-orchestrator | Medium |

#### TC-05: Orchestrator Emission Points (VR-005)

| ID | Description | Input | Expected | Priority |
|----|-------------|-------|----------|----------|
| TC-05-01 | Orchestrator has PROMPT EMISSION PROTOCOL section | Read file | `# PROMPT EMISSION PROTOCOL` heading found | High |
| TC-05-02 | Orchestrator defines exactly 5 numbered emission points | Count `### N.` subsections in PROMPT EMISSION PROTOCOL | Exactly 5 subsections | High |
| TC-05-03 | Each emission point contains at least one `[1]` item | Read each emission point subsection | `[1]` found in all 5 | High |
| TC-05-04 | All 5 lifecycle names present | Search for keywords | "Workflow Initialization", "Gate Passage", "Gate Failure", "Blocker", "Workflow Completion" all found | High |

#### TC-06: ASCII Compliance (VR-006)

| ID | Description | Input | Expected | Priority |
|----|-------------|-------|----------|----------|
| TC-06-01 | No non-ASCII characters in any SUGGESTED PROMPTS section | Read each section, check char codes | All characters in 0x00-0x7F range | Medium |
| TC-06-02 | No emoji in prompt sections | Regex scan for emoji patterns | No matches | Medium |

#### TC-07: Dynamic Resolution (VR-007)

| ID | Description | Input | Expected | Priority |
|----|-------------|-------|----------|----------|
| TC-07-01 | Phase agents use `{primary_prompt}` or `{display_name}` placeholder in `[1]` | Read Output Format section | Placeholder present, no literal "Phase NN" | High |
| TC-07-02 | Sub-orchestrators with Resolution Logic use dynamic placeholders | Read Output Format section for IA and Tracing | Placeholder present, no literal phase names | High |
| TC-07-03 | Discover orchestrator uses static prompts (exception) | Read discover-orchestrator SUGGESTED PROMPTS | Static text allowed (no dynamic resolution required) | High |

#### TC-08: Prompt Tier Order (VR-008)

| ID | Description | Input | Expected | Priority |
|----|-------------|-------|----------|----------|
| TC-08-01 | `[1]` is the primary action in all canonical prompt blocks | Read Output Format for phase agents and sub-orchestrators | `[1]` contains primary action (advance or complete) | High |
| TC-08-02 | Last `[N]` is the utility action | Read Output Format for all canonical blocks | Last item contains "status" | High |
| TC-08-03 | Items are sequential with no gaps | Read all `[N]` references in each prompt block | Sequential numbering (1, 2, 3 or 1, 2, 3, 4) | High |

#### TC-09: Fallback Presence (VR-009)

| ID | Description | Input | Expected | Priority |
|----|-------------|-------|----------|----------|
| TC-09-01 | Phase agents and dynamic sub-orchestrators have Fallback section | Read section | "Fallback" heading found | Medium |
| TC-09-02 | Fallback includes "Show project status" | Read fallback section | String present | Medium |
| TC-09-03 | Fallback includes "Start a new workflow" | Read fallback section | String present | Medium |

#### TC-10: Agent 01 Interactive Exception (VR-010)

| ID | Description | Input | Expected | Priority |
|----|-------------|-------|----------|----------|
| TC-10-01 | Agent 01 has "Do NOT emit" instruction for interactive pauses | Read SUGGESTED PROMPTS section | "Do NOT emit" and ("interactive" or "A/R/C" or "menu") found | Medium |
| TC-10-02 | Agent 01 specifies prompts only at final completion | Read section | "final" or "end of the phase" instruction present | Medium |

#### TC-11: State Schema (VR-011)

| ID | Description | Input | Expected | Priority |
|----|-------------|-------|----------|----------|
| TC-11-01 | No agent file writes prompt data to state.json | Search for "prompt" write patterns in all 36 files | No patterns found that suggest state.json writes for prompts | High |

#### TC-12: No New Dependencies (VR-013)

| ID | Description | Input | Expected | Priority |
|----|-------------|-------|----------|----------|
| TC-12-01 | package.json dependency count unchanged | Read package.json | Dependencies and devDependencies counts match baseline | Low |

#### TC-13: Agent Inventory (Meta)

| ID | Description | Input | Expected | Priority |
|----|-------------|-------|----------|----------|
| TC-13-01 | Exactly 36 agent markdown files exist | Glob pattern | 36 files | Critical |
| TC-13-02 | Classification counts match expected | Classify all files | 1 orchestrator + 3 sub-orchestrators + 15 phase agents + 1 QS + 17 sub-agents = 37 classifications, 36 unique files (orchestrator is also phase-agent-like) | Critical |

---

## 4. Test Data Strategy

### 4.1 No External Test Data

All test data is the actual agent files in `src/claude/agents/`. Tests read real files, not mocked content. This provides:
- **Fidelity:** Tests validate actual implementation, not a representation
- **Simplicity:** No test fixtures to maintain
- **Drift detection:** If agent files change, tests catch format deviations immediately

### 4.2 Baseline Values

| Metric | Baseline | Source |
|--------|----------|--------|
| Total agent files | 36 | Glob `src/claude/agents/**/*.md` |
| Phase agent files | 16 (15 numbered + 1 QS) | Explicit list |
| Sub-orchestrator files | 3 | Explicit list |
| Sub-agent files | 17 | Explicit list |
| Orchestrator files | 1 | Explicit file |
| Existing test count (ESM) | 312 | `npm test` |
| Existing test count (CJS) | 298 | `npm run test:hooks` |
| Total existing tests | 610 | `npm run test:all` |
| package.json dependencies | Count at time of implementation | `package.json` |

### 4.3 Agent File Paths (Anchored)

All file paths in tests use `path.join()` relative to the repository root, resolved via `import.meta.url`. This ensures tests work regardless of CWD.

```javascript
const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const AGENTS_DIR = join(__dirname, '..', 'src', 'claude', 'agents');
```

---

## 5. Test Execution Plan

### 5.1 When to Run

| Trigger | Tests Run | Command |
|---------|-----------|---------|
| During Phase 06 (implementation) | New prompt-format tests | `node --test lib/prompt-format.test.js` |
| Before gate validation | Full regression suite | `npm run test:all` |
| CI/CD (GitHub Actions) | Full suite | `npm run test:all` |

### 5.2 Expected Test Count After Implementation

| Stream | Current | New | Total |
|--------|---------|-----|-------|
| ESM (`lib/*.test.js`) | 312 | +39 | 351 |
| CJS (`src/claude/hooks/tests/*.test.cjs`) | 298 | 0 | 298 |
| **Total** | **610** | **+39** | **649** |

### 5.3 Pass Criteria

- **All 39 new tests pass**: Every validation rule verified
- **All 610 existing tests pass**: Zero regressions
- **Total test count >= 649**: Net increase from new tests

---

## 6. NFR Verification Matrix

| NFR | Test Coverage | Verification Method |
|-----|--------------|---------------------|
| NFR-001 (Zero regression) | VR-012 | `npm run test:all` returns exit 0, test count >= 610 |
| NFR-002 (Additive changes) | VR-014 | TC-02-06 validates insertion order; code review confirms append-only |
| NFR-003 (No new deps) | VR-013 | TC-12-01 checks package.json dependency counts |
| NFR-004 (Module system) | N/A | No new code files -- this feature is markdown-only. No ESM/CJS boundary to test. |
| NFR-005 (ASCII output) | VR-006 | TC-06-01 and TC-06-02 scan all prompt sections for non-ASCII |
| NFR-006 (No state changes) | VR-011 | TC-11-01 searches for state.json write patterns in agent files |
| NFR-007 (Performance) | N/A | No runtime code -- zero performance overhead by design |

---

## 7. Risk Mitigation via Testing

| Risk ID | Risk Description | Test Mitigation |
|---------|-----------------|-----------------|
| R-001 | Agent file format drift | TC-02-01 through TC-02-05 enforce format consistency across all 16 phase agents |
| R-002 | Sub-agent/phase-agent format confusion | TC-03-01 through TC-03-03 ensure sub-agents use STATUS, not full prompts |
| R-003 | Hardcoded phase numbers | TC-07-01 and TC-07-02 verify dynamic placeholders, reject literal phase names |
| R-004 | Missing fallback behavior | TC-09-01 through TC-09-03 verify fallback sections exist with correct content |
| R-005 | Unicode characters in prompts | TC-06-01 and TC-06-02 scan for non-ASCII characters |

---

## 8. ADR Compliance Verification

| ADR | Test Verification |
|-----|-------------------|
| ADR-001 (Template-in-markdown) | TC-01-02, TC-01-03, TC-01-04: sections exist in agent files |
| ADR-002 (Dynamic resolution) | TC-07-01, TC-07-02: placeholders used instead of hardcoded names |
| ADR-003 (Three-tier categorization) | TC-08-01, TC-08-02, TC-08-03: tier order enforced |
| ADR-004 (Distinct --- format) | TC-02-04: `SUGGESTED NEXT STEPS:` string present in format blocks |
| ADR-005 (Sub-agent minimal) | TC-03-01 through TC-03-03: STATUS format enforced for sub-agents |
| ADR-006 (Orchestrator 5 points) | TC-05-01 through TC-05-04: exactly 5 emission points verified |
| ADR-007 (Phase name convention) | TC-07-01: dynamic resolution uses placeholder, not hardcoded names |

---

## 9. Traceability Summary

### 9.1 Requirement -> Validation Rule -> Test Case

| Requirement | VR | Test Cases | Coverage |
|-------------|-----|------------|----------|
| REQ-001 | VR-008 | TC-08-01, TC-08-02, TC-08-03 | FULL |
| REQ-002 | VR-007 | TC-07-01, TC-07-02, TC-07-03 | FULL |
| REQ-003 | VR-001, VR-014 | TC-01-01..04, TC-02-06 | FULL |
| REQ-004 | VR-004, VR-005 | TC-04-01..04, TC-05-01..04 | FULL |
| REQ-005 | VR-002 | TC-02-01..05 | FULL |
| REQ-006 | VR-007 | TC-07-01, TC-07-02, TC-07-03 | FULL |
| REQ-007 | VR-010 | TC-10-01, TC-10-02 | FULL |

### 9.2 Acceptance Criteria -> Test Case

| AC | Test Cases |
|----|------------|
| AC-001-01 | TC-02-04 (format compliance) |
| AC-001-02 | TC-07-01 (dynamic resolution) |
| AC-001-03 | TC-07-01 (dynamic resolution) |
| AC-002-01 | TC-07-01, TC-07-02 (dynamic resolution) |
| AC-002-02 | TC-07-01 (dynamic resolution in test-run) |
| AC-002-03 | TC-08-01 (last-phase detection) |
| AC-003-01 | TC-02-01..05 (format compliance) |
| AC-003-02 | TC-08-01, TC-08-02 (tier order) |
| AC-004-01 | TC-05-02, TC-05-04 (emission points) |
| AC-004-02 | TC-05-02, TC-05-04 (emission points) |
| AC-005-01 | TC-01-02, TC-01-03, TC-01-04 (section presence) |
| AC-005-02 | TC-10-01, TC-10-02 (interactive exception) |
| AC-005-03 | TC-09-01..03 (fallback presence) |

### 9.3 Coverage Verification

**100% of requirements covered:** All 7 REQs traced to at least one test case.
**100% of NFRs covered:** All 7 NFRs have verification methods (automated or design-inherent).
**100% of ACs covered:** All 13 acceptance criteria traced to at least one test case.
**100% of ADRs covered:** All 7 ADRs have compliance verification tests.
**100% of VRs covered:** All 14 validation rules mapped to test cases (VR-012 is via `npm run test:all`).

---

## 10. Constitutional Compliance

| Article | Status | Evidence |
|---------|--------|----------|
| I (Specification Primacy) | COMPLIANT | Test cases implement validation rules directly from design specs |
| II (Test-First Development) | COMPLIANT | Test strategy produced BEFORE implementation (Phase 05 before Phase 06) |
| IV (Explicit Over Implicit) | COMPLIANT | All test cases have explicit inputs, expected outputs, and traceability |
| V (Simplicity First) | COMPLIANT | Single test file, zero new dependencies, reads real files |
| VII (Artifact Traceability) | COMPLIANT | Full traceability matrix (Section 9) covers REQ -> VR -> TC |
| VIII (Documentation Currency) | COMPLIANT | Test strategy documents all test cases alongside their purpose |
| IX (Gate Integrity) | COMPLIANT | Pass criteria defined (Section 5.3), gate requirements clear |
