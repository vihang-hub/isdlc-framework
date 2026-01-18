---
name: defect-analysis
description: Analyze test failures and defect patterns
skill_id: TEST-007
owner: integration-tester
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Test failure triage, quality trends, root cause analysis
dependencies: []
---

# Defect Analysis

## Purpose
Analyze test failures and defects to identify patterns, root causes, and quality trends that inform testing strategy and development practices.

## When to Use
- Test failure triage
- Sprint retrospectives
- Quality reviews
- Process improvement

## Prerequisites
- Defect tracking system
- Test execution results
- Historical data available

## Process

### Step 1: Collect Defect Data
```
Data points:
- Defect ID and description
- Severity and priority
- Component/module
- Root cause category
- Detection phase
- Resolution time
```

### Step 2: Categorize Defects
```
Categories:
- Functional bugs
- Integration issues
- Performance problems
- Security vulnerabilities
- UI/UX issues
- Data issues
```

### Step 3: Identify Patterns
```
Pattern analysis:
- Hot spots (problem areas)
- Common root causes
- Detection trends
- Escape analysis
```

### Step 4: Calculate Metrics
```
Quality metrics:
- Defect density
- Defect removal efficiency
- Mean time to detect
- Mean time to resolve
- Escape rate
```

### Step 5: Generate Insights
```
Insights:
- Problem areas
- Process gaps
- Test coverage gaps
- Training needs
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| defect_log | JSON | Yes | Defect records |
| test_results | JSON | Yes | Test execution data |
| code_metrics | JSON | Optional | Complexity data |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| defect_analysis.md | Markdown | Analysis report |
| quality_metrics.json | JSON | Calculated metrics |
| recommendations.md | Markdown | Improvement actions |

## Project-Specific Considerations
- Track OAuth integration issues
- Monitor external API failures
- Document upload edge cases
- Multi-step form issues

## Integration Points
- **Developer Agent**: Root cause info
- **Orchestrator**: Quality reporting
- **Operations Agent**: Production defects

## Examples
```
Defect Analysis Report - SDLC Framework
Period: Sprint 4-6 (6 weeks)

SUMMARY:
Total Defects: 34
- Critical: 2
- High: 8
- Medium: 16
- Low: 8

Defect Removal Efficiency: 92%
(31 found in test, 3 escaped to production)

DEFECT DISTRIBUTION BY MODULE:

```
Module          | Count | % of Total
----------------|-------|----------
Application     | 12    | 35%
Document Upload | 8     | 24%
Authentication  | 5     | 15%
University      | 4     | 12%
User Profile    | 3     | 9%
Other           | 2     | 6%
```

ROOT CAUSE ANALYSIS:

| Root Cause | Count | % |
|------------|-------|---|
| Logic error | 10 | 29% |
| Missing validation | 8 | 24% |
| Integration issue | 6 | 18% |
| Edge case missed | 5 | 15% |
| Concurrency | 3 | 9% |
| Configuration | 2 | 6% |

PATTERN ANALYSIS:

Hot Spots Identified:
1. Application Module (35% of defects)
   - Form validation issues
   - State management bugs
   - Action: Increase unit tests, add state diagrams

2. Document Upload (24% of defects)
   - File type edge cases
   - Network timeout handling
   - Action: Add more boundary tests

Common Patterns:
1. Form validation bypass (5 instances)
   - Client-side only validation
   - Action: Mandate server-side validation

2. Async operation failures (4 instances)
   - Missing error handling in promises
   - Action: Async testing patterns training

DETECTION PHASE:

| Phase | Found | Should Find |
|-------|-------|-------------|
| Unit Test | 12 | 15 |
| Integration Test | 10 | 12 |
| E2E Test | 6 | 5 |
| Code Review | 3 | 3 |
| Production | 3 | 0 |

Gap: 3 defects escaped that should have been caught in unit/integration tests

ESCAPED DEFECTS (Production):

BUG-034: OAuth token refresh race condition
- Severity: Critical
- Detection: User report
- Root cause: Concurrency
- Prevention: Add integration test for concurrent refresh

BUG-029: Unicode filename display
- Severity: Low
- Detection: User report
- Root cause: Edge case
- Prevention: Add unicode test data

BUG-031: Application deadline timezone
- Severity: High
- Detection: Monitoring alert
- Root cause: Logic error
- Prevention: Add timezone test cases

QUALITY METRICS:

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Defect Density | 2.8/KLOC | <5 | ✓ |
| Critical Escape | 1 | 0 | ✗ |
| MTTR (Critical) | 4 hours | <8 hours | ✓ |
| Test Coverage | 82% | 80% | ✓ |

RECOMMENDATIONS:

1. Application Module
   - Add state transition tests
   - Review form validation patterns
   - Priority: High

2. Document Upload
   - Expand edge case test data
   - Add network failure simulations
   - Priority: High

3. Testing Process
   - Add concurrency testing to strategy
   - Mandate timezone test cases
   - Add unicode to standard test data
   - Priority: Medium

4. Training
   - Async error handling patterns
   - Server-side validation importance
   - Priority: Medium
```

## Validation
- All defects categorized
- Patterns identified
- Metrics calculated
- Actionable recommendations
- Trends tracked