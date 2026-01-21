---
name: impact-analysis
description: Identify tests affected by changes for regression management
skill_id: TEST-011
owner: integration-tester
collaborators: [requirements, developer]
project: sdlc-framework
version: 1.0.0
when_to_use: Requirement changes, code changes, bug fixes
dependencies: [TEST-005]
---

# Impact Analysis

## Purpose
Analyze the impact of changes (requirements, design, code) on existing tests to identify which tests need to be updated, added, or re-executed.

## When to Use
- Requirement added/modified/removed
- Code changes
- Bug fixes
- Design changes
- External API changes

## Prerequisites
- Traceability matrix current
- Change details available
- Test inventory known

## Process

### Step 1: Identify Change Type
```
Change categories:
- Requirement change
- Design change
- Code change
- Bug fix
- External API change
- Configuration change
```

### Step 2: Query Traceability
```
Using matrix, find:
- Direct test links
- Dependent tests
- Related requirements
- Affected code paths
```

### Step 3: Categorize Impact
```
Impact categories:
- MUST_UPDATE: Test logic invalid
- MUST_REVIEW: May need changes
- MUST_RUN: Re-execute to verify
- NO_IMPACT: Unaffected
```

### Step 4: Assess Risk
```
Risk factors:
- Criticality of changed area
- Test coverage of change
- Dependencies affected
- User impact
```

### Step 5: Generate Impact Report
```
Report includes:
- Change summary
- Affected tests by category
- Risk assessment
- Recommended actions
- Effort estimate
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| change_request | JSON | Yes | Change details |
| traceability_matrix | CSV | Yes | Current traceability |
| test_inventory | JSON | Yes | All tests |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| impact_report.md | Markdown | Analysis results |
| affected_tests.json | JSON | Test list |
| action_items.json | JSON | Required actions |

## Project-Specific Considerations
- Auth changes cascade widely
- GDPR changes need legal review
- External API changes affect mocks
- UI changes affect E2E tests

## Integration Points
- **Requirements Agent**: Change notifications
- **Developer Agent**: Code change info
- **Orchestrator**: Change coordination

## Examples
```
Impact Analysis Report

CHANGE REQUEST: CR-007
Type: Requirement Modified
Requirement: REQ-005 (Document Upload)
Change: Add virus scan before storage
Requested by: security-agent
Date: 2024-01-15

CHANGE SUMMARY:
- Add virus scanning step after upload
- Block infected files
- Add new error type: VIRUS_DETECTED
- Update upload flow with scan status

TRACEABILITY QUERY:
REQ-005 links to:
├── Design: DES-005
├── Tests: TC-005-001 to TC-005-008
├── Code: src/document/upload.*
└── Related: REQ-004 (Application), NFR-004 (Security)

AFFECTED TESTS:

MUST_UPDATE (Test logic will be invalid):
| Test ID | Reason | Action |
|---------|--------|--------|
| TC-005-001 | Success flow changes | Add scan step verification |
| TC-005-004 | Error handling | Add scan failure scenario |

MUST_ADD (New scenarios needed):
| Test ID | Description |
|---------|-------------|
| TC-005-009 | Virus detected - file rejected |
| TC-005-010 | Scan timeout handling |
| TC-005-011 | Scan service unavailable |

MUST_REVIEW (May need changes):
| Test ID | Reason |
|---------|--------|
| TC-005-002 | Size check still before scan? |
| TC-005-005 | Boundary test timing |

MUST_RUN (Regression verification):
| Test ID | Reason |
|---------|--------|
| TC-005-003 | Verify type check still works |
| TC-005-006 | Verify special chars still work |
| TC-004-* | Application tests (uses upload) |

NO_IMPACT:
- All tests outside document module
- University tests
- User tests

RISK ASSESSMENT:

| Factor | Level | Notes |
|--------|-------|-------|
| Change scope | Medium | Single module |
| Test coverage | High | Well covered area |
| User impact | Medium | Upload flow visible |
| Security | High | Security feature |

Overall Risk: MEDIUM

RECOMMENDATIONS:

1. Update TC-005-001 with scan verification
2. Create 3 new test cases for scan scenarios
3. Update test data with test virus file (EICAR)
4. Add mock for virus scan service
5. Run full document module regression
6. Run application submission E2E tests

EFFORT ESTIMATE:
- Test updates: 4 hours
- New test cases: 4 hours
- Mock creation: 2 hours
- Regression run: 1 hour
- Total: ~11 hours

TRACEABILITY UPDATE:
- Add TC-005-009 to TC-005-011 to matrix
- Update DES-005 with scan flow
- Add NFR-004 link to TC-005-009
```

## Validation
- All affected tests identified
- Categories correctly assigned
- Risk assessment complete
- Actions are specific
- Effort estimated