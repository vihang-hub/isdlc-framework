---
name: regression-management
description: Maintain and optimize regression test suites
skill_id: TEST-010
owner: test-manager
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Suite maintenance, test optimization, suite expansion
dependencies: [TEST-002, TEST-007]
---

# Regression Management

## Purpose
Maintain effective regression test suites that catch regressions efficiently while minimizing execution time and maintenance burden.

## When to Use
- Suite maintenance
- After feature completion
- Performance optimization
- Suite health review

## Prerequisites
- Test inventory exists
- Execution history available
- Prioritization criteria defined

## Process

### Step 1: Assess Current Suite
```
Suite assessment:
- Total test count
- Execution time
- Pass rate history
- Flaky test rate
- Coverage overlap
```

### Step 2: Identify Optimization Opportunities
```
Optimization areas:
- Remove redundant tests
- Fix flaky tests
- Consolidate similar tests
- Parallelize execution
- Improve data setup
```

### Step 3: Manage Suite Growth
```
Addition criteria:
- Bug fix → regression test
- New feature → suite inclusion
- Critical path → P0 suite

Removal criteria:
- Feature removed
- Redundant coverage
- Consistently passing (risk-based)
```

### Step 4: Organize Suite Structure
```
Suite organization:
- By feature/module
- By priority level
- By execution time
- By dependency
```

### Step 5: Monitor Suite Health
```
Health metrics:
- Execution time trend
- Flaky test rate
- Failure patterns
- Maintenance effort
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| test_inventory | JSON | Yes | All tests |
| execution_history | JSON | Yes | Past results |
| feature_map | JSON | Yes | Feature to test mapping |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| regression_suite.json | JSON | Curated suite |
| suite_health.md | Markdown | Health report |
| optimization_plan.md | Markdown | Improvement plan |

## Project-Specific Considerations
- OAuth regression tests essential
- Document upload regressions
- Application workflow regressions
- GDPR regression mandatory

## Integration Points
- **Developer Agent**: Regression additions
- **DevOps Agent**: Suite execution
- **Orchestrator**: Gate validation

## Examples
```
Regression Suite Management - SDLC Framework

CURRENT SUITE STATUS:

Suite Overview:
| Suite | Tests | Time | Pass Rate |
|-------|-------|------|-----------|
| Smoke | 15 | 5 min | 100% |
| Core Regression | 85 | 25 min | 98.5% |
| Full Regression | 180 | 55 min | 97.2% |
| Nightly | 252 | 90 min | 96.8% |

Health Metrics:
- Flaky Tests: 5 (2.0%)
- Redundant Tests: 8 (estimated)
- Avg Maintenance: 4 hrs/sprint
- Test Growth: +12 tests/sprint

FLAKY TESTS:

| Test ID | Module | Flake Rate | Cause | Action |
|---------|--------|------------|-------|--------|
| TC-E2E-003 | App | 15% | Timing | Fix wait |
| TC-INT-022 | API | 10% | DB state | Isolate data |
| TC-E2E-008 | Upload | 8% | Network | Mock network |
| TC-UNIT-145 | Async | 5% | Race | Fix async |
| TC-E2E-012 | Search | 5% | Index | Wait for index |

Action Plan:
1. TC-E2E-003: Add explicit wait - Sprint 7
2. TC-INT-022: Transaction isolation - Sprint 7
3. Others: Batch fix in Sprint 8

REDUNDANCY ANALYSIS:

Potentially Redundant:
| Tests | Coverage | Recommendation |
|-------|----------|----------------|
| TC-003-001, TC-003-002 | Same path | Merge into 1 |
| TC-005-002, TC-005-005 | Similar boundary | Keep both |
| TC-UNIT-050-055 | Overlapping | Remove 3 |

Action: Review and merge 5 tests → Save 3 min

SUITE OPTIMIZATION PLAN:

Current: 55 min (full regression)
Target: 40 min

Optimizations:
1. Fix flaky tests: -5 min (no reruns)
2. Remove redundant: -3 min
3. Parallelize E2E: -10 min
4. Optimize data setup: -5 min
Projected: 32 min ✓

REGRESSION ADDITION QUEUE:

New Tests Pending Addition:
| Test | Feature | Priority | Sprint |
|------|---------|----------|--------|
| TC-SCAN-001 | Virus scan | P1 | 7 |
| TC-SCAN-002 | Scan timeout | P1 | 7 |
| TC-NOTIF-010 | Email retry | P2 | 7 |

Bug Fix Regressions:
| Bug | Test | Suite |
|-----|------|-------|
| BUG-034 | TC-REG-034 | Core |
| BUG-042 | TC-REG-042 | Core |

SUITE STRUCTURE:

```
regression/
├── smoke/                    # 5 min, always run
│   ├── auth.smoke.ts
│   ├── application.smoke.ts
│   └── search.smoke.ts
├── core/                     # 25 min, every merge
│   ├── auth/
│   ├── user/
│   ├── application/
│   ├── document/
│   └── gdpr/
├── extended/                 # 30 min, nightly
│   ├── university/
│   ├── notifications/
│   └── integrations/
└── e2e/                      # 20 min, parallel
    ├── user-journey/
    ├── admin-journey/
    └── error-flows/
```

MAINTENANCE SCHEDULE:

Weekly:
- Review flaky test alerts
- Triage new failures

Sprint End:
- Add feature regression tests
- Add bug fix regressions
- Review redundancy

Quarterly:
- Full suite review
- Performance optimization
- Archive obsolete tests
```

## Validation
- Suite execution time acceptable
- Flaky rate < 5%
- No redundant tests
- All critical paths covered
- Maintenance sustainable