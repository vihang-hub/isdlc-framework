---
name: change-impact-analysis
description: Assess impact of requirement changes on project
skill_id: REQ-007
owner: requirements-analyst
collaborators: [test-manager, developer]
project: sdlc-framework
version: 1.0.0
when_to_use: When requirements change, scope adjustments, new feature requests
dependencies: [REQ-006, REQ-008]
---

# Change Impact Analysis

## Purpose
Assess the impact of requirement changes on schedule, scope, architecture, and downstream artifacts to enable informed decisions about accepting or rejecting changes.

## When to Use
- New requirement requested
- Existing requirement modified
- Requirement removed
- Scope change discussion
- Mid-sprint changes

## Prerequisites
- Existing requirements documented
- Dependencies mapped
- Traceability matrix available
- Current project status known

## Process

### Step 1: Document the Change
```
Change record:
- Change ID
- Change type: Add/Modify/Remove
- Requirement affected
- Change description
- Requester
- Urgency
```

### Step 2: Analyze Direct Impact
```
Direct impacts:
- Which artifacts change?
- Which agents affected?
- Effort estimate for change
- Schedule impact
- Cost impact
```

### Step 3: Analyze Downstream Impact
```
Using traceability:
- Design documents affected
- Test cases needing update
- Code modules to modify
- Documentation updates
- Deployment changes
```

### Step 4: Analyze Dependencies
```
Dependency cascade:
- Requirements that depend on changed item
- Requirements that changed item depends on
- External system impacts
```

### Step 5: Generate Impact Report
```
Report includes:
- Change summary
- Impact assessment (Low/Medium/High)
- Affected artifacts list
- Effort estimate
- Schedule impact
- Risk assessment
- Recommendation (Accept/Reject/Defer)
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| change_request | JSON | Yes | Proposed change details |
| traceability_matrix | CSV | Yes | Current traceability |
| dependency_map | JSON | Yes | Requirement dependencies |
| project_status | JSON | Yes | Current progress |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| impact_report.md | Markdown | Complete analysis |
| affected_artifacts.json | JSON | List of artifacts |
| effort_estimate.json | JSON | Estimated work |

## Project-Specific Considerations
- Auth changes cascade to most features
- GDPR changes may require legal review
- External API changes affect integration layer
- UI changes may affect accessibility compliance

## Integration Points
- **Orchestrator**: Change decision input
- **Test Manager**: Test impact analysis (TEST-006)
- **All Agents**: Artifact impact notification

## Examples
```
Change Impact Analysis

Change Request: CR-005
Description: Add "Compare Programs" feature
Type: NEW REQUIREMENT
Urgency: Normal

Direct Impact:
- New requirement: REQ-025 (Compare Programs)
- Design: New UI component, new API endpoint
- Effort: 2 sprints estimated

Downstream Impact:
- Design: Add to openapi_spec.yaml
- Tests: 5-8 new test cases
- Documentation: Update user guide
- Code: New backend service, new React component

Dependencies:
- Depends on: REQ-003 (University Search) - EXISTS
- Blocks: Nothing

Impact Assessment: MEDIUM
- Moderate scope increase
- No architectural changes
- Fits within release timeline

Schedule Impact:
- Adds 2 weeks if added now
- Could parallelize with REQ-015

Risk Assessment: LOW
- No technical unknowns
- No external dependencies
- Similar patterns exist

Recommendation: ACCEPT
- High user value
- Manageable effort
- No conflicts
```

## Validation
- All downstream impacts identified
- Effort estimate reasonable
- Dependencies checked
- Recommendation justified
- Stakeholder review complete