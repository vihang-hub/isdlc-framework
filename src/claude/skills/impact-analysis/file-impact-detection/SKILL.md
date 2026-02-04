---
name: file-impact-detection
description: Identify which files will be directly affected by each acceptance criterion
skill_id: IA-101
owner: impact-analyzer
collaborators: []
project: isdlc
version: 1.0.0
when_to_use: During M1 Impact Analysis to find directly affected files
dependencies: []
---

# File Impact Detection

## Purpose
Identify specific files that will be directly modified to implement each acceptance criterion from the finalized requirements. Maps requirements to concrete file locations.

## When to Use
- Analyzing impact of finalized requirements
- Finding files to modify per acceptance criterion
- Building direct impact list for blast radius
- Creating file-to-requirement traceability

## Prerequisites
- Finalized requirements with acceptance criteria
- Codebase accessible
- Discovery report for project structure

## Process

### Step 1: Parse Acceptance Criteria
```
For each AC in requirements:
1. Extract domain concepts
2. Identify technical implications
3. Note data entities mentioned
4. Flag any API/UI changes
```

### Step 2: Search for Related Files
```
For each AC:
1. Search file names for domain terms
2. Search file contents for related code
3. Check discovery report feature map
4. Note controller/service/model patterns
```

### Step 3: Classify Impact
```
For each file match:
- DIRECT: Will definitely be modified for this AC
- LIKELY: Probably needs changes
- POSSIBLE: May need updates

Map each file to the specific AC(s) it supports.
```

### Step 4: Return Affected Files
```
Return list with:
- File path
- Acceptance criteria it supports
- Impact classification
- Reason for inclusion
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| acceptance_criteria | Array | Yes | List of ACs from requirements |
| discovery_report | Object | No | Project discovery data |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| directly_affected | Array | Files with direct impact |
| files_by_ac | Object | Files grouped by AC |
| total_files | Number | Count of affected files |

## Validation
- All acceptance criteria analyzed
- Files mapped to specific ACs
- Impact classification applied
- No orphan files (all have AC linkage)
