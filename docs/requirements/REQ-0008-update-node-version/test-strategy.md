# Test Strategy: REQ-0008 -- Update Node Version

**Phase**: 05-test-strategy
**Created**: 2026-02-10
**Status**: APPROVED
**Traces To**: REQ-001 through REQ-007, NFR-001 through NFR-004
**Design Input**: design-specification.md (Phase 04)

---

## 1. Test Strategy Overview

### 1.1 Feature Nature

REQ-0008 is a **configuration-only change** with zero runtime code modifications. All changes are string replacements in configuration files, CI workflow YAML, documentation, and metadata. This fundamentally shapes the test strategy:

- **No unit tests for new code** -- there is no new code
- **Configuration verification** -- the primary test type: validate that all 16 edits were applied correctly
- **Regression testing** -- confirm the existing 1142-test suite passes unchanged on Node 20, 22, and 24
- **Completeness scanning** -- ensure no stale Node 18 references remain in the codebase

### 1.2 Existing Test Infrastructure (Preserved)

| Aspect | Value |
|--------|-------|
| **Framework** | Node.js built-in `node:test` + `node:assert/strict` |
| **ESM Tests** | `lib/*.test.js`, `lib/utils/*.test.js` (446 tests) |
| **CJS Tests** | `src/claude/hooks/tests/*.test.cjs` (696 tests) |
| **Characterization** | `tests/characterization/*.test.js` (0 active) |
| **E2E** | `tests/e2e/*.test.js` (0 active) |
| **Total Tests** | 1142 (445 pass, 1 pre-existing failure TC-E09) |
| **Test Commands** | `npm test`, `npm run test:hooks`, `npm run test:all` |
| **CI Matrix** | 3 OS x 3 Node versions (currently 18, 20, 22 -- will become 20, 22, 24) |

All test infrastructure is **preserved as-is**. This strategy adds NO new test framework, NO new test patterns, and NO new dependencies.

### 1.3 Pre-existing Failure

TC-E09 in `lib/deep-discovery-consistency.test.js` fails expecting "40 agents" in README. This is a known pre-existing issue (documented in project memory) and is **excluded from regression assessment**.

---

## 2. Test Types and Approach

### 2.1 Configuration Verification Tests (Primary)

**Purpose**: Validate that all 16 string edits were applied correctly.
**Method**: Programmatic file reading + string/regex matching.
**Tool**: Node.js `node:test` with `node:assert/strict`.
**When**: Post-implementation, before quality loop.

These tests verify the **positive case** (correct values present) and **negative case** (old values absent) for each edited file.

### 2.2 Regression Testing (Secondary)

**Purpose**: Confirm existing test suite still passes.
**Method**: Run `npm run test:all` on the current Node version (24).
**When**: Post-implementation.

Since this is config-only with zero runtime changes, the existing 1142 tests are the regression suite. No new regression tests are needed.

### 2.3 Cross-Version Regression Testing (CI-Validated)

**Purpose**: Confirm all tests pass on Node 20, 22, and 24.
**Method**: CI matrix execution after pushing to feature branch.
**When**: CI pipeline run.

The CI matrix itself is part of this change (REQ-002, REQ-003). The first CI run on the updated branch validates both the matrix change AND cross-version compatibility.

### 2.4 Completeness Scanning (Supplementary)

**Purpose**: Ensure no stale Node 18 references remain in version-sensitive files.
**Method**: Grep-based negative testing across the 9 affected files + full codebase scan.
**When**: Post-implementation verification step.

### 2.5 Structural Validation (Supplementary)

**Purpose**: Ensure edited files remain syntactically valid.
**Method**: JSON.parse for JSON files, YAML structure check for workflow files, markdown rendering check for documentation.
**When**: Post-implementation.

---

## 3. Test Case Specifications

### 3.1 REQ-001: package.json engines field

| TC ID | Description | AC | Type | Priority | Method |
|-------|-------------|-----|------|----------|--------|
| TC-001 | package.json engines.node reads ">=20.0.0" | AC-1 | Config Verification | P0 | Read package.json, assert `engines.node === ">=20.0.0"` |
| TC-002 | package.json does NOT contain ">=18.0.0" | AC-1 | Negative Verification | P0 | Grep package.json for ">=18.0.0", expect 0 matches |
| TC-003 | package.json is valid JSON after edit | AC-1 | Structural | P1 | `JSON.parse(fs.readFileSync('package.json'))` succeeds |
| TC-004 | package-lock.json engines.node reads ">=20.0.0" | AC-1 | Config Verification | P1 | Read package-lock.json, assert engines.node updated |
| TC-005 | package-lock.json does NOT contain ">=18.0.0" | AC-1 | Negative Verification | P1 | Grep for ">=18.0.0", expect 0 matches |
| TC-006 | npm install succeeds without engines warning on Node 20+ | AC-3 | Runtime Validation | P0 | `npm install --dry-run` on Node 24, check exit code 0 |

**Note on AC-2**: "Running npm install on Node 18 produces an engines warning" is not directly testable in CI since Node 18 is being removed from the matrix. This AC is validated by the fact that `engines.node` is set to `>=20.0.0` (TC-001 confirms the constraint is in place). This is a **manual verification** item only.

### 3.2 REQ-002: CI workflow ci.yml

| TC ID | Description | AC | Type | Priority | Method |
|-------|-------------|-----|------|----------|--------|
| TC-007 | ci.yml test matrix contains `[20, 22, 24]` | AC-4 | Config Verification | P0 | Grep ci.yml for "node: [20, 22, 24]" |
| TC-008 | ci.yml test matrix does NOT contain 18 | AC-4 | Negative Verification | P0 | Grep ci.yml matrix line, assert no "18" |
| TC-009 | ci.yml lint job uses node-version '22' | AC-5 | Config Verification | P0 | Parse ci.yml lint section, verify node-version |
| TC-010 | ci.yml integration job uses node-version '22' | AC-6 | Config Verification | P0 | Parse ci.yml integration section, verify node-version |
| TC-011 | ci.yml matrix still yields 3 OS x 3 Node = 9 combinations | AC-7 | Structural Verification | P1 | Parse matrix, verify 3 OS entries, 3 Node entries |
| TC-012 | ci.yml bash-install job has NO node-version field | AC-8 | Negative Verification | P1 | Parse bash-install job, verify no setup-node step |
| TC-013 | ci.yml powershell-install job has NO node-version field | AC-9 | Negative Verification | P1 | Parse powershell-install job, verify no setup-node step |
| TC-014 | ci.yml is valid YAML after edit | AC-4 | Structural | P1 | Read and verify YAML structure parses without error |

### 3.3 REQ-003: publish.yml

| TC ID | Description | AC | Type | Priority | Method |
|-------|-------------|-----|------|----------|--------|
| TC-015 | publish.yml test matrix contains `[20, 22, 24]` | AC-10 | Config Verification | P0 | Grep publish.yml for "node-version: [20, 22, 24]" |
| TC-016 | publish.yml test matrix does NOT contain 18 | AC-10 | Negative Verification | P0 | Grep matrix line, assert no "18" |
| TC-017 | publish.yml publish-npm job uses node-version '22' | AC-11 | Config Verification | P0 | Parse publish-npm section, verify node-version |
| TC-018 | publish.yml publish-github job uses node-version '22' | AC-12 | Config Verification | P0 | Parse publish-github section, verify node-version |
| TC-019 | publish.yml is valid YAML after edit | AC-10 | Structural | P1 | Verify YAML structure parses |

### 3.4 REQ-004: constitution.md

| TC ID | Description | AC | Type | Priority | Method |
|-------|-------------|-----|------|----------|--------|
| TC-020 | constitution Article XII req 4 references "Node 20, 22, 24" | AC-13 | Config Verification | P0 | Grep constitution.md for "Node 20, 22, 24" |
| TC-021 | constitution Article XII does NOT reference "Node 18" | AC-13 | Negative Verification | P0 | Grep Article XII section, assert no "Node 18" |
| TC-022 | constitution version is "1.2.0" | AC-14 | Config Verification | P0 | Grep line 4 for "Version**: 1.2.0" |
| TC-023 | constitution amendment log has v1.2.0 entry | AC-14 | Config Verification | P0 | Grep amendment log for "1.2.0" row with date and description |
| TC-024 | constitution amendment log entry mentions Article XII and ADR-0008 | AC-14 | Content Verification | P1 | Verify amendment row content |
| TC-025 | No articles other than Article XII were modified | AC-15 | Scope Verification | P1 | Diff constitution changes, verify only Article XII, version header, and amendment log changed |

### 3.5 REQ-005: README.md

| TC ID | Description | AC | Type | Priority | Method |
|-------|-------------|-----|------|----------|--------|
| TC-026 | README prerequisites table shows "20+" for Node.js | AC-16 | Config Verification | P0 | Grep README for "Node.js.*20+" in prerequisites |
| TC-027 | README does NOT reference "18+" for Node.js | AC-16 | Negative Verification | P0 | Grep README for "18+", expect 0 matches in version context |
| TC-028 | README system requirements shows "Node.js 20+" | AC-17 | Config Verification | P0 | Grep README for "Node.js 20+" in system requirements |

### 3.6 REQ-006: state.json

| TC ID | Description | AC | Type | Priority | Method |
|-------|-------------|-----|------|----------|--------|
| TC-029 | state.json tech_stack.runtime reads "node-20+" | AC-18 | Config Verification | P1 | Read state.json, assert `project.tech_stack.runtime === "node-20+"` |
| TC-030 | state.json does NOT contain "node-18+" | AC-18 | Negative Verification | P1 | Grep state.json for "node-18+", expect 0 matches |

### 3.7 REQ-007: API Compatibility and Regression

| TC ID | Description | AC | Type | Priority | Method |
|-------|-------------|-----|------|----------|--------|
| TC-031 | No deprecated/removed Node 18 APIs used in codebase | AC-19 | Static Analysis | P1 | Impact analysis M3 confirmed zero risk; verify no `process.version` checks |
| TC-032 | node:test framework works on current Node version | AC-20 | Regression | P0 | `npm run test:hooks` succeeds (696 CJS tests) |
| TC-033 | All ESM tests pass on current Node version | AC-21 | Regression | P0 | `npm test` passes (445 of 446, excluding TC-E09) |
| TC-034 | All CJS tests pass on current Node version | AC-21 | Regression | P0 | `npm run test:hooks` passes (696 tests) |
| TC-035 | Full test suite passes end-to-end | AC-21 | Regression | P0 | `npm run test:all` completes with expected results |

### 3.8 NFR-004: Documentation Consistency

| TC ID | Description | AC | Type | Priority | Method |
|-------|-------------|-----|------|----------|--------|
| TC-036 | project-discovery-report.md shows ">= 20.0.0" | NFR-004 | Config Verification | P2 | Grep discovery report for ">= 20.0.0" |
| TC-037 | project-discovery-report.md shows "20, 22, 24 in CI" | NFR-004 | Config Verification | P2 | Grep discovery report for CI matrix reference |
| TC-038 | test-strategy template shows "{20+}" | NFR-004 | Config Verification | P2 | Grep template for "{20+}" |

### 3.9 Cross-Cutting: Completeness Scan

| TC ID | Description | AC | Type | Priority | Method |
|-------|-------------|-----|------|----------|--------|
| TC-039 | No "node.*18" in package.json | Cross | Completeness | P0 | Regex grep |
| TC-040 | No "node.*18" in package-lock.json version fields | Cross | Completeness | P1 | Regex grep (excluding dependency references) |
| TC-041 | No "node.*18" in ci.yml | Cross | Completeness | P0 | Regex grep |
| TC-042 | No "node.*18" in publish.yml | Cross | Completeness | P0 | Regex grep |
| TC-043 | No "Node 18" in constitution.md Article XII | Cross | Completeness | P0 | Regex grep Article XII section |
| TC-044 | No "18+" in README.md version context | Cross | Completeness | P0 | Regex grep |
| TC-045 | No "node-18+" in state.json | Cross | Completeness | P1 | Regex grep |
| TC-046 | No stale "18" references in discovery report | Cross | Completeness | P2 | Regex grep |
| TC-047 | No stale "{18+}" in test-strategy template | Cross | Completeness | P2 | Regex grep |

---

## 4. Test Data Plan

### 4.1 Expected Values (Post-Implementation)

| File | Field/Pattern | Expected Value |
|------|--------------|----------------|
| package.json | `engines.node` | `">=20.0.0"` |
| package-lock.json | `engines.node` | `">=20.0.0"` |
| ci.yml | test matrix | `node: [20, 22, 24]` |
| ci.yml | lint node-version | `'22'` |
| ci.yml | integration node-version | `'22'` |
| publish.yml | test matrix | `node-version: [20, 22, 24]` |
| publish.yml | publish-npm node-version | `'22'` |
| publish.yml | publish-github node-version | `'22'` |
| constitution.md | version | `1.2.0` |
| constitution.md | Article XII req 4 | `Node 20, 22, 24` |
| README.md | prerequisites | `20+` |
| README.md | system requirements | `Node.js 20+` |
| state.json | tech_stack.runtime | `"node-20+"` |
| discovery report | runtime row | `>= 20.0.0` |
| test-strategy template | node version | `{20+}` |

### 4.2 Forbidden Values (Must NOT Appear)

| Pattern | Files Checked | Context |
|---------|---------------|---------|
| `>=18.0.0` | package.json, package-lock.json | engines field |
| `[18, 20, 22]` | ci.yml, publish.yml | matrix arrays |
| `node-version: '18'` | ci.yml, publish.yml | job node-version |
| `Node 18, 20, 22` | constitution.md | Article XII |
| `18+` | README.md | version references |
| `node-18+` | state.json | runtime field |
| `>= 18.0.0` | discovery report | runtime row |
| `{18+}` | test-strategy template | placeholder |

---

## 5. Test Execution Plan

### 5.1 Pre-Implementation Baseline

**Run before any edits**:
```bash
npm run test:all
```
Expected: 1141 pass, 1 fail (TC-E09 pre-existing). This establishes the regression baseline.

### 5.2 Post-Implementation Verification

**Step 1: Structural Validation**
```bash
# Verify JSON files are valid
node -e "JSON.parse(require('fs').readFileSync('package.json', 'utf8')); console.log('package.json: valid')"
node -e "JSON.parse(require('fs').readFileSync('package-lock.json', 'utf8')); console.log('package-lock.json: valid')"
```

**Step 2: Positive Config Verification**
```bash
grep -n ">=20.0.0" package.json
grep -n "\[20, 22, 24\]" .github/workflows/ci.yml
grep -n "\[20, 22, 24\]" .github/workflows/publish.yml
grep -n "Node 20, 22, 24" docs/isdlc/constitution.md
grep -n "1.2.0" docs/isdlc/constitution.md
grep -n "20+" README.md
grep -n "node-20+" .isdlc/state.json
```

**Step 3: Negative Completeness Scan**
```bash
# Must return ZERO results
grep -rn "node.*18" package.json .github/workflows/ci.yml .github/workflows/publish.yml docs/isdlc/constitution.md README.md .isdlc/state.json docs/project-discovery-report.md src/isdlc/templates/testing/test-strategy.md 2>/dev/null
```

**Step 4: Regression Suite**
```bash
npm run test:all
```
Expected: Same results as baseline (1141 pass, 1 fail TC-E09).

### 5.3 CI Execution

After pushing to `feature/REQ-0008-update-node-version`:
- CI will run the updated matrix [20, 22, 24] x [ubuntu, macos, windows]
- First successful CI run validates both the matrix change AND cross-version compatibility
- This covers AC-21 (all tests pass on Node 20, 22, 24)

---

## 6. Coverage Analysis

### 6.1 Acceptance Criteria Coverage

| AC | Test Cases | Coverage |
|----|-----------|----------|
| AC-1 | TC-001, TC-002, TC-003, TC-004, TC-005 | FULL |
| AC-2 | (Manual verification -- Node 18 removed from CI) | MANUAL |
| AC-3 | TC-006 | FULL |
| AC-4 | TC-007, TC-008, TC-014 | FULL |
| AC-5 | TC-009 | FULL |
| AC-6 | TC-010 | FULL |
| AC-7 | TC-011 | FULL |
| AC-8 | TC-012 | FULL |
| AC-9 | TC-013 | FULL |
| AC-10 | TC-015, TC-016, TC-019 | FULL |
| AC-11 | TC-017 | FULL |
| AC-12 | TC-018 | FULL |
| AC-13 | TC-020, TC-021 | FULL |
| AC-14 | TC-022, TC-023, TC-024 | FULL |
| AC-15 | TC-025 | FULL |
| AC-16 | TC-026, TC-027 | FULL |
| AC-17 | TC-028 | FULL |
| AC-18 | TC-029, TC-030 | FULL |
| AC-19 | TC-031 | FULL |
| AC-20 | TC-032 | FULL |
| AC-21 | TC-033, TC-034, TC-035 | FULL |

**Coverage**: 21/21 AC covered (20 automated, 1 manual-only: AC-2)

### 6.2 NFR Coverage

| NFR | Test Cases | Coverage |
|-----|-----------|----------|
| NFR-001 (Backward Compat) | TC-033, TC-034, TC-035 | FULL (regression suite) |
| NFR-002 (CI Time) | CI run duration comparison | CI-OBSERVED |
| NFR-003 (Zero Regression) | TC-033, TC-034, TC-035 | FULL |
| NFR-004 (Doc Consistency) | TC-036, TC-037, TC-038, TC-039 through TC-047 | FULL |

### 6.3 Priority Distribution

| Priority | Count | Percentage |
|----------|-------|------------|
| P0 | 22 | 47% |
| P1 | 16 | 34% |
| P2 | 9 | 19% |
| **Total** | **47** | **100%** |

---

## 7. Risk Mitigation

### 7.1 Risk: YAML Syntax Error

**Impact**: CI workflows fail to parse, blocking all CI runs.
**Mitigation**: TC-014 and TC-019 validate YAML structural integrity.
**Recovery**: Revert the specific YAML edit if broken.

### 7.2 Risk: Missed Node 18 Reference

**Impact**: Documentation inconsistency (NFR-004 violation).
**Mitigation**: TC-039 through TC-047 perform exhaustive completeness scan across all 9 affected files.

### 7.3 Risk: Test Regression on Node 24

**Impact**: Tests that passed on Node 22 fail on Node 24.
**Mitigation**: Impact analysis M3 confirmed zero API risk. TC-033/TC-034/TC-035 validate on current Node (24). CI matrix validates on 20 and 22.

### 7.4 Risk: Constitution Amendment Format Error

**Impact**: Constitution validator hook may flag malformed amendment.
**Mitigation**: TC-022 through TC-025 validate version, amendment log format, and scope of changes.

---

## 8. Test Execution Commands

All tests use the **existing test infrastructure**. No new test framework or tooling is needed.

| Command | Purpose | Expected |
|---------|---------|----------|
| `npm test` | ESM tests (lib/*.test.js) | 445 pass, 1 fail (TC-E09) |
| `npm run test:hooks` | CJS tests (hooks) | 696 pass, 0 fail |
| `npm run test:all` | Full regression suite | 1141 pass, 1 fail |
| `node -e "JSON.parse(...)"` | JSON validation | Exit code 0 |
| `grep -rn "node.*18" ...` | Completeness scan | 0 matches |

---

## 9. Constitutional Compliance

| Article | Status | Evidence |
|---------|--------|----------|
| Article II (Test-First) | COMPLIANT | Test cases designed before implementation (this document, Phase 05) |
| Article VII (Traceability) | COMPLIANT | All 21 AC mapped to test cases (Section 6.1), traceability matrix produced |
| Article IX (Quality Gate) | COMPLIANT | GATE-05 checklist validated (all artifacts present) |
| Article XI (Integration Testing) | COMPLIANT | Regression suite validates component interactions; CI matrix validates cross-version |

---

## 10. Test Strategy Metadata

```json
{
  "strategy_completed_at": "2026-02-10T00:30:00.000Z",
  "total_test_cases": 47,
  "test_types": {
    "config_verification": 24,
    "negative_verification": 14,
    "structural_validation": 3,
    "regression": 4,
    "static_analysis": 1,
    "runtime_validation": 1
  },
  "ac_coverage": {
    "total_ac": 21,
    "automated": 20,
    "manual_only": 1,
    "coverage_percent": 100
  },
  "priority_distribution": {
    "P0": 22,
    "P1": 16,
    "P2": 9
  },
  "existing_infrastructure_preserved": true,
  "new_test_framework": false,
  "new_dependencies": 0,
  "regression_baseline": {
    "esm_tests": 446,
    "cjs_tests": 696,
    "total": 1142,
    "expected_pass": 1141,
    "pre_existing_failures": 1
  }
}
```
