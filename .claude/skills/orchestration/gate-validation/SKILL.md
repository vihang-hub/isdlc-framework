---
name: gate-validation
description: Verify phase completion criteria before allowing transition
skill_id: ORCH-004
owner: orchestrator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Phase completion, before transitions, quality checkpoints
dependencies: [ORCH-001]
---

# Gate Validation

## Purpose
Enforce quality gates between SDLC phases by verifying all required artifacts exist, meet quality standards, and have necessary approvals before allowing phase transitions.

## When to Use
- When phase completion is claimed
- Before transitioning to next phase
- Quality checkpoint verification
- Audit trail requirements
- Compliance verification

## Prerequisites
- Gate definitions configured
- Phase artifacts available
- Approval workflow defined
- 12 Factors enforcement rules loaded

## Process

### Step 1: Identify Gate Requirements
```
Load gate checklist for requested gate:

GATE-1 (Requirements → Architecture):
- [ ] requirements_spec.md complete
- [ ] All user stories have acceptance criteria
- [ ] NFRs quantified with metrics
- [ ] User journeys documented
- [ ] External API requirements listed
- [ ] GDPR requirements identified
- [ ] Human approval obtained

GATE-2 (Architecture → Design):
- [ ] architecture.md complete
- [ ] ADRs created for major decisions
- [ ] Database schema defined
- [ ] Security architecture documented
- [ ] Tech stack finalized
- [ ] External API architecture defined

(Continue for GATE-3 through GATE-8)
```

### Step 2: Verify Artifact Existence
```
For each required artifact:
1. Check file exists at expected path
2. Verify file is not empty
3. Check last modified date (recent)
4. Validate file format (parseable)
```

### Step 3: Validate Artifact Quality
```
Quality checks:
- Requirements: No TBD/TODO markers
- Architecture: All components defined
- Design: OpenAPI spec validates
- Tests: Coverage meets threshold
- Code: Linting passes
- Security: No critical findings
```

### Step 4: Check Approvals
```
For gates requiring human approval:
1. Check approval record exists
2. Verify approver authority
3. Confirm approval not expired
4. Document in audit trail
```

### Step 5: Generate Validation Report
```
Report includes:
- Gate ID and description
- Checklist with pass/fail status
- Missing items details
- Quality issues found
- Approval status
- Overall: PASS / FAIL
- Recommended actions if failed
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| gate_id | String | Yes | Gate to validate (GATE-1 to GATE-8) |
| phase_artifacts | Files | Yes | All artifacts from current phase |
| approval_records | JSON | If required | Human approval records |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| gate_validation.json | JSON | Detailed validation results |
| gate_report.md | Markdown | Human-readable report |
| audit_entry.json | JSON | Audit trail record |

## Project-Specific Considerations
- GATE-2 must verify external API integration architecture
- GATE-3 requires GDPR compliance check on data flows
- GATE-5 must verify OAuth2 implementation security
- GATE-7 requires security sign-off for PII handling

## Integration Points
- **12 Factors**: Factor 6 (The Great Filter) enforcement
- **Security Agent**: Security-related gate checks
- **Test Manager**: Coverage verification
- **All Agents**: Artifact submission

## Examples
```
/orchestrate validate GATE-3

Gate Validation Report: GATE-3 (Design → Test Design)
=====================================================

Checklist Results:
✓ openapi_spec.yaml exists and validates
✓ Module designs complete (8/8 modules)
✓ Error taxonomy defined
✗ Wireframes: 3/5 screens approved
✗ User flow diagrams: Missing "forgot password" flow

Quality Checks:
✓ OpenAPI spec: Valid, no errors
✓ No TODO markers in designs
⚠ Warning: 2 endpoints missing error responses

Approvals:
✓ Design review: Approved by architecture-agent
✗ UX review: Pending

Overall Result: FAIL
Blocking Items: 2

Recommended Actions:
1. Complete wireframes for remaining 2 screens
2. Add "forgot password" user flow diagram
3. Obtain UX review approval

Retry validation after completing above items.
```

## Validation
- All checklist items evaluated
- No false positives (missing items marked as complete)
- Quality checks actually executed (not skipped)
- Approval verification accurate
- Audit trail properly recorded