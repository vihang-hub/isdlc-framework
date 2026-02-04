# Phase 07: Testing Gate Checklist

**Phase**: Integration & Testing
**Primary Agent**: Integration Tester (Agent 07)

---

## Required Artifacts

| Artifact | Path | Required |
|----------|------|----------|
| Integration Test Results | `test-results/integration/` | Yes |
| E2E Test Results | `test-results/e2e/` | Yes |
| Security Scan Report | `security-scan-report.md` | Yes |
| Performance Test Results | `test-results/performance/` | Yes |
| Accessibility Report | `accessibility-report.md` | Yes |
| Coverage Report | `coverage-report.md` | Yes |
| Mutation Test Report | `test-results/mutation/` | Yes |
| Adversarial Test Results | `test-results/property/` | Yes |

---

## Validation Criteria

### 1. Integration Testing
- [ ] All integration tests executed
- [ ] Integration test pass rate >= 95%
- [ ] API contract tests passing
- [ ] Database integration verified
- [ ] External service integrations tested
- [ ] Authentication flows tested

### 2. End-to-End Testing
- [ ] All E2E tests executed
- [ ] Critical user journeys tested
- [ ] E2E pass rate >= 95%
- [ ] Cross-browser testing completed (if applicable)
- [ ] Responsive design tested

### 3. Security Testing
- [ ] SAST scan completed
- [ ] No critical vulnerabilities
- [ ] No high vulnerabilities (or accepted with justification)
- [ ] Dependency vulnerability scan completed
- [ ] OWASP Top 10 tested
- [ ] Authentication/authorization tested

### 4. Performance Testing
- [ ] Load testing completed
- [ ] Performance targets met (response time, throughput)
- [ ] Stress test completed
- [ ] No memory leaks identified
- [ ] Resource utilization acceptable

### 5. Accessibility Testing
- [ ] Automated accessibility scan completed
- [ ] WCAG 2.1 AA compliance verified
- [ ] Keyboard navigation tested
- [ ] Screen reader compatibility verified (critical flows)
- [ ] Color contrast requirements met

### 6. Test Coverage
- [ ] Requirement coverage >= 100%
- [ ] Code coverage meets target
- [ ] All critical paths covered
- [ ] No uncovered requirements

### 7. Defect Status
- [ ] No critical defects open
- [ ] No high defects open (or accepted)
- [ ] Medium defects triaged
- [ ] All regression tests passing

### 8. Autonomous Test Iteration
- [ ] Test execution iteration count logged in state.json → `iterations`
- [ ] All test run iterations documented with results
- [ ] Final status recorded (success/escalated)
- [ ] Iterations within limit (Quick: 5, Standard: 10, Enterprise: 15)
- [ ] If escalated: detailed failure report with test logs attached
- [ ] Defects properly categorized and logged in defect-log.json
- [ ] Iteration history shows failure analysis and fixes
- [ ] No test failures repeated without progress (3+ times)

### 9. Constitutional Compliance Iteration
- [ ] Constitutional self-validation performed
- [ ] Articles II, VII, IX, XI validated
- [ ] Iteration count logged in state.json → `constitutional_validation`
- [ ] All violations documented and addressed
- [ ] Final status is "compliant" (not "escalated" or "iterating")
- [ ] Iterations within limit (Quick: 3, Standard: 5, Enterprise: 7)
- [ ] If escalated: unresolved violations documented with recommendations

### 10. Article XI - Integration Testing Integrity (MANDATORY)

**Rule 1: Mutation Testing**
- [ ] Mutation testing tool configured (check `.isdlc/state.json` → `testing_infrastructure.tools.mutation`)
- [ ] Mutation tests executed
- [ ] Mutation score ≥ 80%
- [ ] Low-scoring tests improved or justified

**Rule 2: Real URLs Only (No Stubs)**
- [ ] Integration tests use `TEST_API_URL` or equivalent real endpoint
- [ ] NO mocks, stubs, or fakes in integration test files
- [ ] Grep verification: no `jest.mock`, `sinon.stub`, `unittest.mock` in integration tests
- [ ] If stub detected → FAIL gate, require removal

**Rule 3: No Assertions in Integration Tests**
- [ ] Integration tests do NOT use `expect()`, `assert()`, `should()`
- [ ] Tests validate via schema validation (zod, joi, JSON Schema)
- [ ] Tests validate via HTTP status codes
- [ ] Tests validate via state verification (database checks)
- [ ] Grep verification: no assertion libraries imported in integration tests

**Rule 4: Adversarial Testing**
- [ ] Property-based testing tool configured (check `.isdlc/state.json` → `testing_infrastructure.tools.adversarial`)
- [ ] Property-based tests written for input validation
- [ ] Fuzz testing executed on public interfaces
- [ ] Edge cases generated dynamically (not hardcoded)
- [ ] At least 100 generated test cases per property

**Rule 5: Execution-Based Reporting**
- [ ] Test reports show execution counts (not assertion counts)
- [ ] Reports include: executed, passed, failed, skipped, mutation score
- [ ] Failure reports include actual response data
- [ ] HTML reports generated for human review
- [ ] NO "X assertions passed" metrics in reports

---

## Gate Decision

| Criteria | Status | Notes |
|----------|--------|-------|
| Required artifacts present | [ ] Pass / [ ] Fail | |
| Integration tests passing | [ ] Pass / [ ] Fail | |
| E2E tests passing | [ ] Pass / [ ] Fail | |
| Security scan clean | [ ] Pass / [ ] Fail | |
| Performance targets met | [ ] Pass / [ ] Fail | |
| Accessibility compliant | [ ] Pass / [ ] Fail | |
| No critical/high defects | [ ] Pass / [ ] Fail | |
| Autonomous iteration documented | [ ] Pass / [ ] Fail | |
| **Article XI: Mutation score ≥80%** | [ ] Pass / [ ] Fail | |
| **Article XI: No stubs in integration** | [ ] Pass / [ ] Fail | |
| **Article XI: No assertions in integration** | [ ] Pass / [ ] Fail | |
| **Article XI: Adversarial tests executed** | [ ] Pass / [ ] Fail | |
| **Article XI: Execution-based reporting** | [ ] Pass / [ ] Fail | |

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
