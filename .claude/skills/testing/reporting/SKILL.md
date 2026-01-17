---
name: test-reporting
description: Generate test status and quality reports
skill_id: TEST-009
owner: test-manager
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Sprint reviews, gate validation, stakeholder updates
dependencies: [TEST-004, TEST-008]
---

# Test Reporting

## Purpose
Generate clear, actionable test reports that communicate quality status, coverage, and risks to stakeholders at various levels.

## When to Use
- Sprint reviews
- Gate validations
- Release decisions
- Stakeholder updates

## Prerequisites
- Test execution complete
- Coverage data available
- Defect data available

## Process

### Step 1: Determine Audience
```
Report types by audience:
- Executive: High-level summary
- Technical: Detailed metrics
- Development: Actionable items
- Compliance: Audit trail
```

### Step 2: Collect Data
```
Data sources:
- Test execution results
- Code coverage reports
- Defect tracking
- Traceability matrix
```

### Step 3: Calculate Metrics
```
Key metrics:
- Pass/fail rates
- Coverage percentages
- Defect counts
- Trend data
```

### Step 4: Analyze Results
```
Analysis:
- Quality assessment
- Risk identification
- Blockers
- Recommendations
```

### Step 5: Generate Report
```
Report sections:
- Executive summary
- Test execution
- Coverage analysis
- Defects
- Risks
- Recommendations
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| test_results | JSON | Yes | Execution data |
| coverage_data | JSON | Yes | Coverage metrics |
| defect_data | JSON | Yes | Defect information |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| test_report.md | Markdown | Full report |
| executive_summary.md | Markdown | Summary view |
| dashboard_data.json | JSON | Dashboard metrics |

## Project-Specific Considerations
- GDPR compliance status
- External API test results
- Performance test results
- Accessibility status

## Integration Points
- **Orchestrator**: Gate reports
- **Documentation Agent**: Report archiving
- **DevOps Agent**: CI/CD dashboards

## Examples
```
Test Report - SDLC Framework
Sprint 6 Release Candidate

═══════════════════════════════════════════════════════
EXECUTIVE SUMMARY
═══════════════════════════════════════════════════════

Quality Status: ✅ READY FOR RELEASE

Key Metrics:
┌────────────────────────────────────────────┐
│ Tests Passed: 247/252 (98.0%)             │
│ Code Coverage: 83.2%                       │
│ Critical Bugs: 0                           │
│ Open High Bugs: 1 (non-blocking)          │
└────────────────────────────────────────────┘

Recommendation: Proceed with release
Conditions: Monitor BUG-042 in production

═══════════════════════════════════════════════════════
TEST EXECUTION SUMMARY
═══════════════════════════════════════════════════════

By Test Type:
| Type | Total | Pass | Fail | Skip | Rate |
|------|-------|------|------|------|------|
| Unit | 189 | 187 | 2 | 0 | 98.9% |
| Integration | 43 | 42 | 1 | 0 | 97.7% |
| E2E | 15 | 13 | 0 | 2 | 100%* |
| Security | 5 | 5 | 0 | 0 | 100% |
| Total | 252 | 247 | 3 | 2 | 98.0% |

*E2E skip: Environment issue, manual verified

By Feature:
| Feature | Tests | Pass | Status |
|---------|-------|------|--------|
| Authentication | 28 | 28 | ✅ |
| User Profile | 22 | 22 | ✅ |
| University Search | 35 | 35 | ✅ |
| Application | 58 | 55 | ⚠️ |
| Documents | 32 | 32 | ✅ |
| GDPR | 18 | 18 | ✅ |
| Notifications | 12 | 10 | ⚠️ |

Failed Tests:
| Test ID | Feature | Reason | Impact |
|---------|---------|--------|--------|
| TC-APP-045 | Application | Race condition | BUG-042 |
| TC-APP-046 | Application | Flaky, retry pass | Low |
| TC-NOTIF-008 | Notification | Timing issue | BUG-043 |

═══════════════════════════════════════════════════════
COVERAGE ANALYSIS
═══════════════════════════════════════════════════════

Code Coverage: 83.2% (Target: 80%) ✅

By Module:
| Module | Lines | Branch | Status |
|--------|-------|--------|--------|
| auth | 92% | 88% | ✅ |
| user | 89% | 84% | ✅ |
| application | 81% | 74% | ✅ |
| document | 78% | 71% | ⚠️ |
| gdpr | 94% | 91% | ✅ |

Requirement Coverage: 97% (33/34 requirements)
- Missing: REQ-034 (deferred to Phase 2)

═══════════════════════════════════════════════════════
DEFECT STATUS
═══════════════════════════════════════════════════════

Open Defects:
| Severity | Count | In Sprint | Status |
|----------|-------|-----------|--------|
| Critical | 0 | - | ✅ |
| High | 1 | BUG-042 | ⚠️ |
| Medium | 3 | - | Deferred |
| Low | 5 | - | Deferred |

BUG-042: Application submission timeout
- Status: Known issue, workaround available
- Impact: <1% of submissions
- Mitigation: Retry mechanism added
- Plan: Fix in Sprint 7

Defects Fixed This Sprint: 12
Defect Escape Rate: 0 (no production issues)

═══════════════════════════════════════════════════════
RISK ASSESSMENT
═══════════════════════════════════════════════════════

| Risk | Level | Mitigation |
|------|-------|------------|
| BUG-042 timeout | Medium | Retry + monitoring |
| Document coverage | Low | Added to Sprint 7 |
| E2E env stability | Low | Infra improvements |

═══════════════════════════════════════════════════════
RECOMMENDATIONS
═══════════════════════════════════════════════════════

Release Recommendation: ✅ APPROVE

Conditions:
1. Deploy with enhanced monitoring for submissions
2. Alert threshold for timeout errors
3. Plan BUG-042 fix for Sprint 7

Post-Release:
1. Monitor submission success rate
2. Watch notification delivery metrics
3. Continue E2E stability improvements

═══════════════════════════════════════════════════════
SIGN-OFF
═══════════════════════════════════════════════════════

Test Manager: Approved
Date: 2024-01-15
Next Review: Sprint 7 Planning
```

## Validation
- All data sources included
- Metrics accurately calculated
- Clear recommendation
- Risks identified
- Actionable items listed