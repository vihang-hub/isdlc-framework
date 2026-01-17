---
name: traceability-management
description: Maintain links between requirements, tests, and code
skill_id: TEST-005
owner: test-manager
collaborators: [requirements]
project: sdlc-framework
version: 1.0.0
when_to_use: Throughout project, artifact linking, coverage tracking
dependencies: []
---

# Traceability Management

## Purpose
Maintain bidirectional traceability between requirements, design, test cases, and code to ensure complete coverage and enable impact analysis.

## When to Use
- Test case creation
- Requirement changes
- Coverage analysis
- Audit preparation

## Prerequisites
- ID conventions established
- Artifacts created
- Matrix template ready

## Process

### Step 1: Establish ID Scheme
```
ID formats:
- Requirements: REQ-XXX
- User Stories: US-XXX
- Test Cases: TC-XXX-YYY
- Code: file paths
- Bugs: BUG-XXX
```

### Step 2: Create Forward Links
```
Forward traceability:
REQ → US → TC → Code

Each test case must link to:
- Requirement(s) it verifies
- User story/acceptance criteria
```

### Step 3: Create Backward Links
```
Backward traceability:
Code → TC → US → REQ

Each code file should link to:
- Tests that cover it
- Requirements it implements
```

### Step 4: Maintain Matrix
```
Matrix columns:
- Requirement ID
- User Story ID
- Design ID
- Test Case IDs
- Code Paths
- Status
- Last Updated
```

### Step 5: Validate Traceability
```
Validation checks:
- All REQs have tests
- All tests link to REQs
- No orphan artifacts
- Links are current
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| requirements | JSON | Yes | All requirements |
| test_cases | JSON | Yes | All test cases |
| code_map | JSON | Yes | Code file list |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| traceability_matrix.csv | CSV | Complete matrix |
| orphan_report.md | Markdown | Unlinked items |
| coverage_by_req.json | JSON | Coverage per REQ |

## Project-Specific Considerations
- GDPR requirements must have complete trace
- External API requirements trace to mock tests
- Security requirements trace to security tests

## Integration Points
- **Requirements Agent**: REQ traceability
- **Developer Agent**: Code linking
- **Impact Analysis**: Change queries

## Examples
```
Traceability Matrix - SDLC Framework

CSV Format:
req_id,user_story,design,test_cases,code_paths,status,last_updated
REQ-001,US-001,DES-001,"TC-001-001,TC-001-002,TC-001-003",src/auth/,Complete,2024-01-15
REQ-002,US-002,DES-002,"TC-002-001,TC-002-002",src/user/profile.ts,Complete,2024-01-15
REQ-003,"US-003,US-004",DES-003,"TC-003-001 to TC-003-010",src/university/,Complete,2024-01-14
REQ-005,US-005,DES-005,"TC-005-001 to TC-005-008",src/document/,Complete,2024-01-15
REQ-010,US-010,DES-010,"TC-010-001 to TC-010-005",src/gdpr/,Complete,2024-01-15
REQ-023,US-023,-,-,-,No Tests,2024-01-15

Visual Trace Example:

REQ-005: Document Upload
    │
    ├──► US-005: User can upload documents
    │       │
    │       ├──► AC1: Successful upload
    │       │       └──► TC-005-001: PDF upload success
    │       │       └──► TC-005-006: Special characters
    │       │
    │       ├──► AC2: File type validation
    │       │       └──► TC-005-003: Invalid type rejected
    │       │
    │       ├──► AC3: Size limit
    │       │       └──► TC-005-002: Oversized rejected
    │       │       └──► TC-005-005: Boundary 10MB
    │       │
    │       └──► AC4: Error recovery
    │               └──► TC-005-004: Network interruption
    │
    └──► Code: src/document/
            ├── upload.service.ts
            ├── upload.controller.ts
            └── upload.test.ts

Orphan Report:

Tests without Requirements:
- TC-MISC-001: Health check endpoint
  Action: Link to NFR-005 (Availability)

Requirements without Tests:
- REQ-023: Email notifications
  Action: Create test suite

Code without Tests:
- src/utils/date-helpers.ts (utility functions)
  Action: Add unit tests or mark as coverage exception
```

## Validation
- All requirements linked
- All tests have REQ reference
- Matrix is current
- Orphans identified
- Regular updates scheduled