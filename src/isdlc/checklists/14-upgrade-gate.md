# Phase 14: Upgrade Gate Checklist

**Phase**: Dependency/Tool Upgrade
**Primary Agent**: Upgrade Engineer (Agent 14)

---

## Required Artifacts

| Artifact | Path | Required |
|----------|------|----------|
| Upgrade Analysis | `docs/requirements/UPG-NNNN-{name}-v{version}/upgrade-analysis.md` | Yes |
| Migration Plan | `docs/requirements/UPG-NNNN-{name}-v{version}/migration-plan.md` | Yes |
| Execution Log | `docs/requirements/UPG-NNNN-{name}-v{version}/upgrade-execution-log.md` | Yes |
| Upgrade Summary | `docs/requirements/UPG-NNNN-{name}-v{version}/upgrade-summary.md` | Yes |

---

## Validation Criteria

### 1. Test Adequacy Prerequisite
- [ ] Test suite exists and is runnable
- [ ] At least 1 test passes (suite is not broken)
- [ ] Test adequacy check executed before upgrade began
- [ ] If thresholds not met: user explicitly accepted risk OR tests were generated first
- [ ] If no tests exist: upgrade was blocked until tests were created
- [ ] Test adequacy result recorded in state.json (`test_adequacy` field)

### 2. Version Detection
- [ ] Ecosystem correctly identified
- [ ] Current version extracted from manifest
- [ ] Version string is valid semver (or ecosystem equivalent)
- [ ] Baseline recorded in state.json

### 3. Registry Lookup
- [ ] Available versions queried from registry
- [ ] Target version is a valid, published version
- [ ] Version gap (major/minor/patch) documented
- [ ] User confirmed target version selection

### 4. Impact Analysis
- [ ] Changelogs fetched for version range
- [ ] Breaking changes identified and categorized
- [ ] Codebase scanned for usage of affected APIs
- [ ] Risk level calculated (LOW/MEDIUM/HIGH/CRITICAL)
- [ ] Dependency compatibility verified
- [ ] Analysis report written to output path

### 5. Migration Plan
- [ ] Upgrade path decision justified (DIRECT vs STEPWISE)
- [ ] All breaking changes have corresponding migration steps
- [ ] Steps ordered by ascending risk
- [ ] Each step has before/after code and verification criteria
- [ ] Rollback strategy documented
- [ ] **User approved migration plan before execution**

### 6. Upgrade Execution
- [ ] Baseline test results captured before any changes
- [ ] Git branch created (`upgrade/{name}-v{version}`)
- [ ] Each migration step applied and committed individually
- [ ] Fix loop iterated for test failures
- [ ] Iteration count within configured limit
- [ ] Execution log documents every step and iteration

### 7. Regression Validation
- [ ] Full test suite executed from clean environment
- [ ] **Zero regressions vs baseline** (all baseline-passing tests still pass)
- [ ] Build succeeds without errors
- [ ] Test coverage not decreased
- [ ] Upgrade summary report generated

### 8. Autonomous Iteration
- [ ] Iteration count logged in state.json
- [ ] All iterations documented with results
- [ ] Final status recorded (success/escalated)
- [ ] Iterations within limit (default: 10)
- [ ] If escalated: detailed failure report with context
- [ ] Circuit breaker triggered after 3 identical failures
- [ ] Iteration history shows failure analysis and fixes applied

### 9. Constitutional Compliance Iteration
- [ ] Constitutional self-validation performed
- [ ] Articles I, II, III, V, VII, VIII, IX, X validated
- [ ] Iteration count logged in state.json → `constitutional_validation`
- [ ] All violations documented and addressed
- [ ] Final status is "compliant" (not "escalated" or "iterating")
- [ ] If escalated: unresolved violations documented with recommendations

### 10. Git Branch Management
- [ ] Upgrade branch created from main
- [ ] All changes committed on upgrade branch
- [ ] Branch naming follows convention: `upgrade/{name}-v{version}`
- [ ] No uncommitted changes on branch
- [ ] Branch ready for merge after code review

---

## Gate Decision

| Criteria | Status | Notes |
|----------|--------|-------|
| Test adequacy validated | [ ] Pass / [ ] Fail | |
| Required artifacts present | [ ] Pass / [ ] Fail | |
| Version detection correct | [ ] Pass / [ ] Fail | |
| Impact analysis complete | [ ] Pass / [ ] Fail | |
| Migration plan approved | [ ] Pass / [ ] Fail | |
| All regression tests passing | [ ] Pass / [ ] Fail | |
| Zero regressions vs baseline | [ ] Pass / [ ] Fail | |
| Git branch created and committed | [ ] Pass / [ ] Fail | |
| Autonomous iteration documented | [ ] Pass / [ ] Fail | |
| Constitutional compliance | [ ] Pass / [ ] Fail | |

**Gate Status**: [ ] PASS / [ ] FAIL

**Article XI Compliance**: [ ] COMPLIANT / [ ] NON-COMPLIANT

**Reviewer**: _______________
**Date**: _______________

---

## Next Phase

Upon passing this gate:
- Advance to Phase 7: Code Review & Quality Assurance
- Primary Agent: QA Engineer (Agent 07)
- Next Phase Handler: qa-engineer
- QA reviews upgrade changes with `scope: "upgrade-review"`
