---
name: test-prioritization
description: Prioritize tests based on risk and impact
skill_id: TEST-005
owner: test-design-engineer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Time-constrained testing, regression selection, smoke test design
dependencies: [TEST-004, TEST-006]
---

# Test Prioritization

## Purpose
Prioritize test execution based on risk, impact, and constraints to maximize defect detection within available time and resources.

## When to Use
- Limited testing time
- Regression test selection
- Smoke test suite design
- Risk-based testing

## Prerequisites
- Test inventory available
- Risk assessment done
- Change information available
- Historical data (optional)

## Process

### Step 1: Define Prioritization Criteria
```
Criteria:
- Business criticality
- Change frequency
- Defect history
- User impact
- Complexity
- Dependencies
```

### Step 2: Score Each Test
```
Scoring model:
Priority = (Criticality × 3) + 
           (Recent Change × 2) + 
           (Defect History × 2) + 
           (User Impact × 1)
```

### Step 3: Apply Constraints
```
Constraints:
- Available time
- Environment availability
- Data dependencies
- Execution order
```

### Step 4: Create Prioritized List
```
Priority levels:
- P0: Always run (critical path)
- P1: Run for all releases
- P2: Run for major releases
- P3: Run periodically
```

### Step 5: Generate Test Suite
```
Suite types:
- Smoke (P0 only)
- Regression (P0 + P1)
- Full (All)
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| test_inventory | JSON | Yes | All tests |
| risk_matrix | JSON | Yes | Risk by feature |
| change_log | JSON | Optional | Recent changes |
| defect_history | JSON | Optional | Past defects |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| prioritized_tests.json | JSON | Sorted test list |
| smoke_suite.json | JSON | Smoke tests |
| regression_suite.json | JSON | Regression tests |

## Project-Specific Considerations
- Authentication always P0
- Application submission P0
- GDPR features P0/P1
- Search features P1
- UI cosmetic tests P3

## Integration Points
- **Developer Agent**: Change info
- **DevOps Agent**: CI/CD suite selection
- **Operations Agent**: Production issues

## Examples
```
Test Prioritization - SDLC Framework

PRIORITIZATION CRITERIA:

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Business Critical | 3 | Revenue/core function |
| Recently Changed | 2 | Changed in last sprint |
| Defect History | 2 | Had bugs before |
| User Impact | 1 | Affects many users |
| Complexity | 1 | Complex code path |

SCORING EXAMPLE:

TC-001-001: User Login
- Business Critical: 3 (auth is critical)
- Recently Changed: 0 (no recent changes)
- Defect History: 1 (one bug last quarter)
- User Impact: 3 (all users)
- Complexity: 2 (OAuth flows)

Score = (3×3) + (0×2) + (1×2) + (3×1) + (2×1) = 16

Priority: P0

PRIORITIZED TEST SUITES:

P0 - Smoke Suite (Always Run):
Run Time: ~10 minutes
| Test | Feature | Score |
|------|---------|-------|
| TC-001-001 | Login | 16 |
| TC-001-003 | Logout | 14 |
| TC-004-010 | Application Submit | 15 |
| TC-010-001 | GDPR Export | 14 |
| TC-003-001 | University Search | 13 |

P1 - Core Regression (Every Release):
Run Time: ~45 minutes
- All P0 tests +
| Test | Feature | Score |
|------|---------|-------|
| TC-002-* | User Profile (all) | 10-12 |
| TC-003-* | Search (all) | 9-13 |
| TC-004-* | Application (all) | 11-15 |
| TC-005-001-003 | Document Upload | 10-12 |
| TC-010-* | GDPR (all) | 12-14 |

P2 - Extended Regression (Major Releases):
Run Time: ~2 hours
- All P1 tests +
| Test | Feature | Score |
|------|---------|-------|
| TC-005-* | Documents (all) | 8-12 |
| TC-006-* | Notifications | 7-9 |
| TC-007-* | University Details | 6-8 |
| TC-E2E-* | E2E flows | 8-11 |

P3 - Full Suite (Periodic):
Run Time: ~4 hours
- All tests
- Run weekly or before major milestones

CI/CD CONFIGURATION:

```yaml
# .github/workflows/test.yml
jobs:
  smoke:
    # Run on every PR
    runs-on: ubuntu-latest
    steps:
      - run: npm test -- --suite=smoke

  regression:
    # Run on merge to main
    if: github.ref == 'refs/heads/main'
    steps:
      - run: npm test -- --suite=regression

  full:
    # Run weekly
    schedule:
      - cron: '0 2 * * 0'
    steps:
      - run: npm test -- --suite=full
```

DYNAMIC PRIORITIZATION:

When code changes detected:
1. Find affected tests (impact analysis)
2. Boost priority of affected tests
3. Include related regression tests
4. Generate custom suite for PR

Example PR Suite for auth changes:
- All TC-001-* (directly affected)
- TC-004-010 (submit uses auth)
- TC-010-001 (export uses auth)
- Execution time: ~15 minutes
```

## Validation
- All tests have priority
- Scoring is consistent
- Suites fit time constraints
- Critical tests always included
- Regular review scheduled