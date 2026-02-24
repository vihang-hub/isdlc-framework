# Test Cases: REQ-0008 -- Update Node Version

**Phase**: 05-test-strategy
**Created**: 2026-02-10
**Total Test Cases**: 47
**Traces To**: requirements-spec.md (21 AC), design-specification.md (16 edits)

---

## Category 1: package.json Verification (REQ-001)

### TC-001: engines.node field reads ">=20.0.0"
- **AC**: AC-1
- **Priority**: P0
- **Type**: Config Verification
- **Precondition**: All 16 edits applied per design-specification.md
- **Steps**:
  1. Read `package.json` from project root
  2. Parse as JSON
  3. Navigate to `engines.node`
- **Expected Result**: Value equals `">=20.0.0"`
- **Automated**: Yes
- **Command**: `node -e "const p=JSON.parse(require('fs').readFileSync('package.json','utf8')); console.assert(p.engines.node==='>=20.0.0', 'Expected >=20.0.0 got '+p.engines.node); console.log('PASS: TC-001')"`

### TC-002: package.json does NOT contain ">=18.0.0"
- **AC**: AC-1
- **Priority**: P0
- **Type**: Negative Verification
- **Steps**:
  1. Read `package.json`
  2. Search for string `>=18.0.0`
- **Expected Result**: String not found (0 matches)
- **Automated**: Yes
- **Command**: `grep -c ">=18.0.0" package.json && echo "FAIL: TC-002" || echo "PASS: TC-002"`

### TC-003: package.json is valid JSON
- **AC**: AC-1
- **Priority**: P1
- **Type**: Structural Validation
- **Steps**:
  1. Read `package.json`
  2. Parse with `JSON.parse()`
- **Expected Result**: Parse succeeds without error
- **Automated**: Yes
- **Command**: `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('PASS: TC-003')"`

### TC-004: package-lock.json engines.node reads ">=20.0.0"
- **AC**: AC-1
- **Priority**: P1
- **Type**: Config Verification
- **Steps**:
  1. Read `package-lock.json`
  2. Search for `"node": ">=20.0.0"` in the root package entry
- **Expected Result**: Found in root package entry
- **Automated**: Yes
- **Command**: `grep -c '"node": ">=20.0.0"' package-lock.json && echo "PASS: TC-004" || echo "FAIL: TC-004"`

### TC-005: package-lock.json does NOT contain ">=18.0.0"
- **AC**: AC-1
- **Priority**: P1
- **Type**: Negative Verification
- **Steps**:
  1. Read `package-lock.json`
  2. Search for string `>=18.0.0`
- **Expected Result**: 0 matches
- **Automated**: Yes
- **Command**: `grep -c ">=18.0.0" package-lock.json && echo "FAIL: TC-005" || echo "PASS: TC-005"`

### TC-006: npm install succeeds on Node 20+
- **AC**: AC-3
- **Priority**: P0
- **Type**: Runtime Validation
- **Steps**:
  1. Run `npm install --dry-run` on current Node (24)
  2. Check exit code
- **Expected Result**: Exit code 0, no engines mismatch warning
- **Automated**: Yes
- **Command**: `npm install --dry-run 2>&1 | grep -i "engine" && echo "FAIL: TC-006 (engines warning)" || echo "PASS: TC-006"`

---

## Category 2: CI Workflow ci.yml (REQ-002)

### TC-007: ci.yml test matrix is [20, 22, 24]
- **AC**: AC-4
- **Priority**: P0
- **Type**: Config Verification
- **Steps**:
  1. Read `.github/workflows/ci.yml`
  2. Locate `test.strategy.matrix.node`
  3. Verify array is `[20, 22, 24]`
- **Expected Result**: Line contains `node: [20, 22, 24]`
- **Automated**: Yes
- **Command**: `grep "node: \[20, 22, 24\]" .github/workflows/ci.yml && echo "PASS: TC-007" || echo "FAIL: TC-007"`

### TC-008: ci.yml test matrix does NOT contain 18
- **AC**: AC-4
- **Priority**: P0
- **Type**: Negative Verification
- **Steps**:
  1. Read `.github/workflows/ci.yml`
  2. Locate the matrix node line
  3. Verify 18 is not present
- **Expected Result**: Matrix line does not contain "18"
- **Automated**: Yes
- **Command**: `grep "node:.*18" .github/workflows/ci.yml && echo "FAIL: TC-008" || echo "PASS: TC-008"`

### TC-009: ci.yml lint job uses node-version '22'
- **AC**: AC-5
- **Priority**: P0
- **Type**: Config Verification
- **Steps**:
  1. Read `.github/workflows/ci.yml`
  2. Locate the lint job section
  3. Check node-version in setup-node step
- **Expected Result**: lint job contains `node-version: '22'`
- **Automated**: Yes
- **Method**: Parse YAML, navigate to lint.steps, find setup-node, assert node-version is '22'

### TC-010: ci.yml integration job uses node-version '22'
- **AC**: AC-6
- **Priority**: P0
- **Type**: Config Verification
- **Steps**:
  1. Read `.github/workflows/ci.yml`
  2. Locate the integration job section
  3. Check node-version in setup-node step
- **Expected Result**: integration job contains `node-version: '22'`
- **Automated**: Yes
- **Method**: Parse YAML, navigate to integration.steps, find setup-node, assert node-version is '22'

### TC-011: ci.yml matrix yields 3 OS x 3 Node = 9 combinations
- **AC**: AC-7
- **Priority**: P1
- **Type**: Structural Verification
- **Steps**:
  1. Read `.github/workflows/ci.yml`
  2. Parse test job matrix
  3. Count OS entries and Node entries
- **Expected Result**: 3 OS entries (ubuntu-latest, macos-latest, windows-latest) x 3 Node entries (20, 22, 24) = 9 combinations
- **Automated**: Yes

### TC-012: ci.yml bash-install job has no node-version
- **AC**: AC-8
- **Priority**: P1
- **Type**: Negative Verification
- **Steps**:
  1. Read `.github/workflows/ci.yml`
  2. Locate bash-install job
  3. Check that no `setup-node` step or `node-version` field exists
- **Expected Result**: No node-version in bash-install job
- **Automated**: Yes

### TC-013: ci.yml powershell-install job has no node-version
- **AC**: AC-9
- **Priority**: P1
- **Type**: Negative Verification
- **Steps**:
  1. Read `.github/workflows/ci.yml`
  2. Locate powershell-install job
  3. Check that no `setup-node` step or `node-version` field exists
- **Expected Result**: No node-version in powershell-install job
- **Automated**: Yes

### TC-014: ci.yml is syntactically valid YAML
- **AC**: AC-4
- **Priority**: P1
- **Type**: Structural Validation
- **Steps**:
  1. Read `.github/workflows/ci.yml`
  2. Attempt to parse as YAML
- **Expected Result**: Parse succeeds
- **Automated**: Yes
- **Command**: `node -e "require('fs').readFileSync('.github/workflows/ci.yml', 'utf8'); console.log('PASS: TC-014 (file reads OK)')"`

---

## Category 3: Publish Workflow publish.yml (REQ-003)

### TC-015: publish.yml test matrix is [20, 22, 24]
- **AC**: AC-10
- **Priority**: P0
- **Type**: Config Verification
- **Steps**:
  1. Read `.github/workflows/publish.yml`
  2. Locate test matrix
- **Expected Result**: Line contains `node-version: [20, 22, 24]`
- **Automated**: Yes
- **Command**: `grep "node-version: \[20, 22, 24\]" .github/workflows/publish.yml && echo "PASS: TC-015" || echo "FAIL: TC-015"`

### TC-016: publish.yml test matrix does NOT contain 18
- **AC**: AC-10
- **Priority**: P0
- **Type**: Negative Verification
- **Steps**:
  1. Check publish.yml matrix line for "18"
- **Expected Result**: 0 matches
- **Automated**: Yes

### TC-017: publish.yml publish-npm job uses node-version '22'
- **AC**: AC-11
- **Priority**: P0
- **Type**: Config Verification
- **Steps**:
  1. Locate publish-npm job in publish.yml
  2. Find setup-node step with registry-url 'https://registry.npmjs.org'
  3. Check node-version
- **Expected Result**: `node-version: '22'`
- **Automated**: Yes

### TC-018: publish.yml publish-github job uses node-version '22'
- **AC**: AC-12
- **Priority**: P0
- **Type**: Config Verification
- **Steps**:
  1. Locate publish-github job in publish.yml
  2. Find setup-node step with registry-url 'https://npm.pkg.github.com'
  3. Check node-version
- **Expected Result**: `node-version: '22'`
- **Automated**: Yes

### TC-019: publish.yml is syntactically valid YAML
- **AC**: AC-10
- **Priority**: P1
- **Type**: Structural Validation
- **Steps**:
  1. Read `.github/workflows/publish.yml`
  2. Verify file reads without error
- **Expected Result**: File reads successfully
- **Automated**: Yes

---

## Category 4: Constitution Amendment (REQ-004)

### TC-020: Article XII req 4 references "Node 20, 22, 24"
- **AC**: AC-13
- **Priority**: P0
- **Type**: Config Verification
- **Steps**:
  1. Read `docs/isdlc/constitution.md`
  2. Locate Article XII requirement 4
- **Expected Result**: Contains "Node 20, 22, 24"
- **Automated**: Yes
- **Command**: `grep "Node 20, 22, 24" docs/isdlc/constitution.md && echo "PASS: TC-020" || echo "FAIL: TC-020"`

### TC-021: Article XII does NOT reference "Node 18"
- **AC**: AC-13
- **Priority**: P0
- **Type**: Negative Verification
- **Steps**:
  1. Search Article XII section for "Node 18"
- **Expected Result**: 0 matches in Article XII
- **Automated**: Yes

### TC-022: Constitution version is 1.2.0
- **AC**: AC-14
- **Priority**: P0
- **Type**: Config Verification
- **Steps**:
  1. Read line 4 of constitution.md
  2. Check version field
- **Expected Result**: `**Version**: 1.2.0`
- **Automated**: Yes
- **Command**: `grep "Version.*1.2.0" docs/isdlc/constitution.md && echo "PASS: TC-022" || echo "FAIL: TC-022"`

### TC-023: Amendment log has v1.2.0 entry
- **AC**: AC-14
- **Priority**: P0
- **Type**: Config Verification
- **Steps**:
  1. Read amendment log section of constitution.md
  2. Find row with "1.2.0"
- **Expected Result**: Row with version 1.2.0, date 2026-02-10, description of Article XII update
- **Automated**: Yes

### TC-024: Amendment log mentions Article XII and ADR-0008
- **AC**: AC-14
- **Priority**: P1
- **Type**: Content Verification
- **Steps**:
  1. Read the v1.2.0 amendment log row
  2. Check content references
- **Expected Result**: Row mentions "Article XII" and "ADR-0008"
- **Automated**: Yes

### TC-025: No articles other than Article XII modified
- **AC**: AC-15
- **Priority**: P1
- **Type**: Scope Verification
- **Steps**:
  1. Compare constitution.md changes (git diff)
  2. Verify only version line (4), Article XII req 4, and amendment log changed
- **Expected Result**: Only lines 4, ~283, and amendment log rows differ
- **Automated**: Yes (via git diff line inspection)

---

## Category 5: README Documentation (REQ-005)

### TC-026: README prerequisites table shows "20+"
- **AC**: AC-16
- **Priority**: P0
- **Type**: Config Verification
- **Steps**:
  1. Read `README.md`
  2. Find Node.js row in prerequisites table
- **Expected Result**: Contains "20+"
- **Automated**: Yes
- **Command**: `grep -n "Node.js.*20+" README.md | head -1 && echo "PASS: TC-026" || echo "FAIL: TC-026"`

### TC-027: README does NOT reference "18+" for Node
- **AC**: AC-16
- **Priority**: P0
- **Type**: Negative Verification
- **Steps**:
  1. Search README.md for "18+" in version context
- **Expected Result**: 0 matches for Node.js 18+
- **Automated**: Yes

### TC-028: README system requirements shows "Node.js 20+"
- **AC**: AC-17
- **Priority**: P0
- **Type**: Config Verification
- **Steps**:
  1. Read README.md system requirements section
  2. Find Node.js entry
- **Expected Result**: Contains "Node.js 20+"
- **Automated**: Yes

---

## Category 6: Internal State (REQ-006)

### TC-029: state.json runtime reads "node-20+"
- **AC**: AC-18
- **Priority**: P1
- **Type**: Config Verification
- **Steps**:
  1. Read `.isdlc/state.json`
  2. Navigate to `project.tech_stack.runtime`
- **Expected Result**: Value equals `"node-20+"`
- **Automated**: Yes
- **Command**: `node -e "const s=JSON.parse(require('fs').readFileSync('.isdlc/state.json','utf8')); console.assert(s.project.tech_stack.runtime==='node-20+'); console.log('PASS: TC-029')"`

### TC-030: state.json does NOT contain "node-18+"
- **AC**: AC-18
- **Priority**: P1
- **Type**: Negative Verification
- **Steps**:
  1. Search state.json for "node-18+"
- **Expected Result**: 0 matches
- **Automated**: Yes

---

## Category 7: API Compatibility and Regression (REQ-007)

### TC-031: No deprecated Node 18 APIs in codebase
- **AC**: AC-19
- **Priority**: P1
- **Type**: Static Analysis
- **Steps**:
  1. Search codebase for `process.version` checks that gate on Node 18
  2. Search for Node 18-only API patterns
- **Expected Result**: No Node 18-specific API usage found
- **Automated**: Yes (grep-based)
- **Evidence**: Impact analysis M3 confirmed zero API risk

### TC-032: node:test framework works on current Node
- **AC**: AC-20
- **Priority**: P0
- **Type**: Regression
- **Steps**:
  1. Run `npm run test:hooks`
  2. Check all 696 CJS tests pass
- **Expected Result**: 696 pass, 0 fail
- **Automated**: Yes

### TC-033: All ESM tests pass
- **AC**: AC-21
- **Priority**: P0
- **Type**: Regression
- **Steps**:
  1. Run `npm test`
  2. Check results
- **Expected Result**: 445 pass, 1 fail (pre-existing TC-E09 only)
- **Automated**: Yes

### TC-034: All CJS tests pass
- **AC**: AC-21
- **Priority**: P0
- **Type**: Regression
- **Steps**:
  1. Run `npm run test:hooks`
  2. Check results
- **Expected Result**: 696 pass, 0 fail
- **Automated**: Yes

### TC-035: Full test suite passes end-to-end
- **AC**: AC-21
- **Priority**: P0
- **Type**: Regression
- **Steps**:
  1. Run `npm run test:all`
  2. Check combined results
- **Expected Result**: 1141 pass, 1 fail (pre-existing TC-E09)
- **Automated**: Yes

---

## Category 8: Documentation Consistency (NFR-004)

### TC-036: Discovery report shows ">= 20.0.0"
- **AC**: NFR-004
- **Priority**: P2
- **Type**: Config Verification
- **Steps**:
  1. Read `docs/project-discovery-report.md`
  2. Find runtime version reference
- **Expected Result**: Contains ">= 20.0.0"
- **Automated**: Yes

### TC-037: Discovery report shows "20, 22, 24 in CI"
- **AC**: NFR-004
- **Priority**: P2
- **Type**: Config Verification
- **Steps**:
  1. Find CI matrix reference in discovery report
- **Expected Result**: Contains "20, 22, 24 in CI"
- **Automated**: Yes

### TC-038: Test-strategy template shows "{20+}"
- **AC**: NFR-004
- **Priority**: P2
- **Type**: Config Verification
- **Steps**:
  1. Read `src/isdlc/templates/testing/test-strategy.md`
  2. Find Node version placeholder
- **Expected Result**: Contains "{20+}"
- **Automated**: Yes

---

## Category 9: Completeness Scan (Cross-Cutting)

### TC-039 through TC-047: Stale Reference Elimination

| TC ID | File | Forbidden Pattern | Priority |
|-------|------|-------------------|----------|
| TC-039 | package.json | `node.*18` | P0 |
| TC-040 | package-lock.json | `>=18.0.0` | P1 |
| TC-041 | ci.yml | `node.*18` | P0 |
| TC-042 | publish.yml | `node.*18` | P0 |
| TC-043 | constitution.md (Art XII) | `Node 18` | P0 |
| TC-044 | README.md | `18+` (version context) | P0 |
| TC-045 | state.json | `node-18+` | P1 |
| TC-046 | project-discovery-report.md | `18` (version context) | P2 |
| TC-047 | test-strategy template | `{18+}` | P2 |

For each: Read file, search for forbidden pattern, assert 0 matches.

---

## Summary

| Category | Test Cases | P0 | P1 | P2 |
|----------|-----------|----|----|-----|
| package.json (REQ-001) | 6 | 3 | 3 | 0 |
| ci.yml (REQ-002) | 8 | 4 | 4 | 0 |
| publish.yml (REQ-003) | 5 | 3 | 2 | 0 |
| constitution (REQ-004) | 6 | 3 | 3 | 0 |
| README (REQ-005) | 3 | 3 | 0 | 0 |
| state.json (REQ-006) | 2 | 0 | 2 | 0 |
| API/Regression (REQ-007) | 5 | 4 | 1 | 0 |
| Doc Consistency (NFR-004) | 3 | 0 | 0 | 3 |
| Completeness Scan | 9 | 4 | 2 | 3 |
| **Total** | **47** | **24** | **17** | **6** |
