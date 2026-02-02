---
name: traceability-matrix-generation
description: Generate comprehensive code to AC to test traceability matrix
skill_id: RE-202
owner: artifact-integration
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Creating full traceability from code through AC to tests
dependencies: [RE-201, RE-106]
---

# Traceability Matrix Generation

## Purpose
Generate a comprehensive traceability matrix that maps source code locations to acceptance criteria to characterization tests. This matrix enables impact analysis and ensures complete coverage.

## When to Use
- After AC-feature linking (RE-201) completes
- After test scaffold generation (RE-106) completes
- When creating audit trail for reverse engineering

## Prerequisites
- Link records from RE-201
- Test files from RE-106
- AC files with test references

## Process

### Step 1: Gather All Links
```
Collect:
- Code → AC links (from RE-201)
- AC → Test links (from test file references)
- Test → Fixture links (from test imports)
```

### Step 2: Build Matrix Structure
```
For each code location:
├── Source file
├── Line number
├── Function/method name
└── Linked items:
    ├── AC ID
    ├── AC title
    ├── Domain
    ├── Priority
    ├── Test file
    ├── Test name
    └── Fixture file
```

### Step 3: Generate CSV Format
```csv
Source File,Line,Function,AC ID,AC Title,Domain,Priority,Test File,Test Name,Fixture,Status
src/modules/users/user.controller.ts,45,register,AC-RE-001,Successful registration,user-management,P0,user-registration.characterization.ts,AC-RE-001: captures successful registration,user-management.fixtures.ts,linked
```

### Step 4: Generate Summary Statistics
```json
{
  "total_code_locations": 87,
  "total_ac": 87,
  "total_tests": 45,
  "linked_percentage": 100,
  "by_domain": {
    "user-management": { "code": 12, "ac": 12, "tests": 8 }
  },
  "by_priority": {
    "P0": { "code": 15, "ac": 15, "tests": 15 }
  }
}
```

### Step 5: Identify Gaps
```
Gaps to report:
- Code with no AC
- AC with no test
- Tests with no AC reference
- Missing fixture references
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| link_records | Array | Yes | From RE-201 |
| test_files | Array | Yes | Characterization tests |
| fixture_files | Array | Yes | Test fixtures |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| traceability_csv | File | Full matrix as CSV |
| summary_json | Object | Statistics and metrics |
| gap_report | Array | Missing links |

## Project-Specific Considerations
- CSV format enables import into tracking tools
- Large projects may need domain-specific matrices
- Matrix should be regenerated after any AC/test changes
- Consider integration with existing traceability tools

## Integration Points
- **AC Feature Linking (RE-201)**: Provides code → AC links
- **Test Scaffold Generation (RE-106)**: Provides test → AC mappings
- **Report Generation (RE-203)**: Includes matrix summary
- **QA Engineer (07)**: Uses matrix for coverage review

## Validation
- All AC appear in matrix
- All tests linked to AC
- No orphan entries
- Statistics match expectations
