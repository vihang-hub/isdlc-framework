---
name: traceability-management
description: Maintain requirement IDs and relationships to downstream artifacts
skill_id: REQ-008
owner: requirements
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Throughout project, artifact creation, validation, audits
dependencies: [REQ-001]
---

# Traceability Management

## Purpose
Maintain bidirectional traceability between requirements and all downstream artifacts (designs, tests, code) to ensure complete coverage and enable impact analysis.

## When to Use
- When creating any artifact
- Validation and verification
- Impact analysis
- Audit and compliance
- Coverage gap analysis

## Prerequisites
- Requirements documented with IDs
- Artifact naming conventions defined
- Traceability matrix template ready

## Process

### Step 1: Establish ID Scheme
```
ID formats:
- Requirements: REQ-XXX
- User Stories: US-XXX
- Design: DES-XXX
- Test Cases: TC-XXX
- Code: file path
- ADRs: ADR-XXX
```

### Step 2: Create Forward Traceability
```
From requirement forward:
REQ-001 → 
  ├── DES-001 (Design)
  ├── US-001, US-002 (Stories)
  ├── TC-001, TC-002 (Tests)
  ├── src/auth/*.ts (Code)
  └── ADR-001 (Decision)
```

### Step 3: Create Backward Traceability
```
From artifact back to requirement:
src/auth/login.ts →
  └── Tests: TC-001, TC-005
      └── Stories: US-001
          └── Requirement: REQ-001
```

### Step 4: Maintain Traceability Matrix
```
Matrix format:
| REQ ID | Design | Stories | Tests | Code | Status |
|--------|--------|---------|-------|------|--------|
| REQ-001 | DES-001 | US-001,2 | TC-001-5 | auth/* | Complete |
| REQ-002 | DES-002 | US-003 | TC-010 | user/* | In Progress |
```

### Step 5: Verify Coverage
```
Coverage checks:
- Every REQ has at least one US
- Every US has at least one TC
- Every TC traces to code
- No orphan artifacts
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| requirements | Markdown | Yes | All requirements |
| artifacts | Various | Yes | Designs, tests, code |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| traceability_matrix.csv | CSV | Complete matrix |
| coverage_report.md | Markdown | Coverage analysis |
| orphan_report.md | Markdown | Unlinked artifacts |

## Project-Specific Considerations
- GDPR requirements must trace to specific code/tests
- External API requirements trace to integration code
- Security requirements trace to security tests
- Accessibility requirements trace to UI tests

## Integration Points
- **Test Manager**: Test traceability (TEST-005)
- **All Agents**: Artifact linking
- **Orchestrator**: Coverage validation

## Examples
```
Traceability Matrix (Excerpt)

REQ_ID,Design,User_Stories,Test_Cases,Code_Paths,Status
REQ-001,DES-001,"US-001,US-002","TC-001,TC-002,TC-003",src/backend/auth/,Complete
REQ-002,DES-002,US-003,"TC-010,TC-011",src/backend/user/profile.ts,Complete
REQ-003,"DES-003,DES-004","US-004,US-005","TC-020,TC-021,TC-022",src/backend/search/,In Progress
REQ-010,DES-010,"US-020,US-021","TC-100,TC-101",src/backend/gdpr/,Complete

Coverage Report:
- Requirements coverage: 100% (25/25 have designs)
- Test coverage: 92% (23/25 have tests)
- Code coverage: 88% (22/25 implemented)

Gaps Identified:
- REQ-023: No test cases defined
- REQ-024: No code implemented yet
```

## Validation
- Matrix complete for all requirements
- No orphan artifacts
- Bidirectional links verified
- Coverage meets thresholds
- Regular updates maintained