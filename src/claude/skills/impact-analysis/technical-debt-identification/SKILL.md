---
name: technical-debt-identification
description: Identify technical debt markers in affected areas (TODOs, FIXMEs, deprecated code)
skill_id: IA-303
owner: risk-assessor
collaborators: []
project: isdlc
version: 1.0.0
when_to_use: During M3 Risk Assessment to find debt in affected code
dependencies: []
---

# Technical Debt Identification

## Purpose
Identify technical debt markers in code areas affected by the feature, including TODOs, FIXMEs, deprecated code, and other debt indicators that may complicate implementation.

## When to Use
- Finding debt in affected areas
- Planning debt remediation
- Assessing maintenance burden
- Avoiding debt accumulation

## Prerequisites
- Affected files identified (from M1)
- Source files accessible
- Debt patterns defined

## Process

### Step 1: Search Debt Markers
```
Search affected files for:
1. TODO comments
2. FIXME comments
3. HACK comments
4. XXX comments
5. @deprecated annotations
6. Disabled tests (skip, xit, xtest)
```

### Step 2: Categorize Debt
```
Categories:
- MISSING_IMPL: TODOs for unfinished work
- KNOWN_BUGS: FIXMEs for known issues
- WORKAROUNDS: HACKs and temporary fixes
- DEPRECATED: Outdated code/APIs
- SKIPPED_TESTS: Disabled test coverage
```

### Step 3: Map to Acceptance Criteria
```
For each AC:
1. Count debt markers in affected files
2. Assess debt severity (blocking vs. minor)
3. Note debt that must be addressed for AC
4. Flag debt that will worsen if ignored
```

### Step 4: Prioritize Debt
```
Priority levels:
- Blocking: Must address before implementing AC
- High: Should address during AC implementation
- Medium: Address if touching that code
- Low: Track but don't block
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| affected_files | Array | Yes | Files to analyze |
| acceptance_criteria | Array | Yes | ACs for mapping |
| debt_patterns | Array | No | Custom debt patterns |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| debt_markers | Array | All found debt markers |
| debt_by_file | Object | Debt count per file |
| debt_by_ac | Object | Debt affecting each AC |
| priority_list | Array | Prioritized debt items |

## Validation
- All affected files scanned
- Debt categorized correctly
- AC mapping complete
- Priorities assigned
