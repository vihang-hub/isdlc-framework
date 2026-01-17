---
name: coverage-analysis
description: Analyze test coverage against requirements and code
skill_id: TEST-004
owner: test-manager
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Quality assessment, gap identification, gate validation
dependencies: [TEST-002, TEST-005]
---

# Coverage Analysis

## Purpose
Analyze and measure test coverage at multiple levels (requirements, code, features) to identify gaps and ensure adequate testing before release.

## When to Use
- Gate validation
- Sprint review
- Release assessment
- Quality reporting

## Prerequisites
- Test cases executed
- Code coverage tools configured
- Traceability matrix available

## Process

### Step 1: Measure Code Coverage
```
Coverage metrics:
- Line coverage
- Branch coverage
- Function coverage
- Statement coverage
```

### Step 2: Measure Requirement Coverage
```
Requirement coverage:
- Requirements with tests
- Requirements without tests
- Test pass rate per requirement
```

### Step 3: Analyze Coverage Gaps
```
Gap identification:
- Untested code paths
- Untested requirements
- Low coverage modules
- Missing negative tests
```

### Step 4: Assess Risk
```
Risk assessment:
- Critical features coverage
- Security features coverage
- High-risk changes coverage
```

### Step 5: Generate Report
```
Coverage report:
- Summary metrics
- Gap details
- Risk assessment
- Recommendations
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| test_results | JSON | Yes | Test execution results |
| coverage_data | JSON | Yes | Code coverage output |
| traceability_matrix | CSV | Yes | Req-to-test mapping |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| coverage_report.md | Markdown | Analysis report |
| coverage_gaps.json | JSON | Identified gaps |
| risk_assessment.md | Markdown | Risk analysis |

## Project-Specific Considerations
- GDPR features must have 100% coverage
- OAuth2 flows need complete coverage
- External API integration coverage
- Application state transitions

## Integration Points
- **Orchestrator**: Gate validation
- **Developer Agent**: Gap remediation
- **Security Agent**: Security coverage

## Examples
```
Coverage Analysis Report - SDLC Framework
Sprint 5

SUMMARY:
┌─────────────────────────────────────┐
│ Overall Code Coverage: 82%         │
│ Requirement Coverage: 95%          │
│ Critical Path Coverage: 100%       │
└─────────────────────────────────────┘

CODE COVERAGE BY MODULE:

| Module | Lines | Branches | Functions |
|--------|-------|----------|-----------|
| auth | 91% | 85% | 100% |
| user | 88% | 82% | 95% |
| application | 79% | 71% | 90% |
| university | 85% | 78% | 92% |
| document | 76% | 68% | 88% |
| gdpr | 95% | 92% | 100% |
| integration | 72% | 65% | 85% |

REQUIREMENT COVERAGE:

| Priority | Total | Covered | % |
|----------|-------|---------|---|
| Must Have | 15 | 15 | 100% |
| Should Have | 12 | 11 | 92% |
| Could Have | 8 | 5 | 63% |
| Total | 35 | 31 | 89% |

COVERAGE GAPS:

Critical Gaps (Must Fix):
- None ✓

High Priority Gaps:
1. application/submit.ts lines 45-52
   - Error handling for concurrent submissions
   - Risk: Race condition possible
   - Action: Add test TC-APP-015

2. integration/university-sync.ts lines 120-135
   - Retry logic after circuit breaker opens
   - Risk: Sync failures not tested
   - Action: Add integration test

Medium Priority Gaps:
1. document/upload.ts lines 88-95
   - Virus scan timeout handling
   - Action: Add mock timeout test

2. REQ-023 (Email notifications)
   - No test cases written
   - Action: Create TC-NOTIF-001 to TC-NOTIF-005

Low Priority Gaps:
1. user/preferences.ts
   - Dark mode toggle (cosmetic)
   - Defer to Phase 2

UNCOVERED REQUIREMENTS:

| REQ ID | Description | Priority | Action |
|--------|-------------|----------|--------|
| REQ-023 | Email notifications | Should | Create tests |
| REQ-028 | Export to PDF | Could | Defer |
| REQ-029 | Social sharing | Could | Defer |
| REQ-031 | Chat support | Could | Out of scope |

RISK ASSESSMENT:

| Area | Coverage | Risk | Mitigation |
|------|----------|------|------------|
| Authentication | 91% | Low | Acceptable |
| Application Submit | 79% | Medium | Add gap tests |
| GDPR | 95% | Low | Acceptable |
| External APIs | 72% | Medium | Add mock tests |
| Document Upload | 76% | Medium | Add edge cases |

RECOMMENDATIONS:

1. Add 3 test cases for application submission edge cases
2. Increase integration module coverage to 80%
3. Create notification test suite
4. Review document upload error scenarios

GATE-6 STATUS: ⚠️ CONDITIONAL PASS
- Code coverage: 82% ✓ (target: 80%)
- Requirement coverage: 89% ⚠️ (target: 95%)
- Critical coverage: 100% ✓
- Action: Add REQ-023 tests before release
```

## Validation
- All coverage metrics calculated
- Gaps clearly identified
- Risks assessed
- Recommendations actionable
- Report is current