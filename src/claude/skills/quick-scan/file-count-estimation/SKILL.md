---
name: file-count-estimation
description: Estimate number of files that will be affected by a feature based on keyword matches
skill_id: QS-003
owner: quick-scan-agent
collaborators: []
project: isdlc
version: 1.0.0
when_to_use: During Phase 00 Quick Scan to provide rough file impact numbers
dependencies: []
---

# File Count Estimation

## Purpose
Provide a rough estimate of how many files will be affected by a feature implementation based on keyword search results and project structure analysis.

## When to Use
- Sizing a feature for planning
- Comparing scope between feature options
- Setting expectations before detailed analysis
- Informing requirements gathering focus

## Prerequisites
- Keyword search results available
- Discovery report with project structure
- File matches identified

## Process

### Step 1: Analyze Direct Matches
```
1. Count unique files from keyword search
2. Identify primary affected modules
3. Note file types (service, controller, model, etc.)
```

### Step 2: Apply Multipliers
```
Based on project patterns:
- If service matched: likely +1 controller, +1 route
- If model matched: likely +1 repository, +1 migration
- If UI component matched: likely +1-2 related components

Typical multipliers:
- API feature: 1.5x keyword matches
- UI feature: 2x keyword matches
- Full-stack: 2.5x keyword matches
```

### Step 3: Adjust for Confidence
```
High confidence (keywords well-matched):
  - Use direct count + modest multiplier

Medium confidence (partial matches):
  - Use count + higher multiplier
  - Note uncertainty in estimate

Low confidence (few matches):
  - Provide range (e.g., 5-15 files)
  - Flag for deeper analysis in Phase 02
```

### Step 4: Return Estimate
```
Return:
- Point estimate (best guess)
- Range (min-max)
- Confidence level
- Breakdown by file type
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| keyword_matches | Object | Yes | Results from keyword search |
| feature_type | String | No | api/ui/fullstack/job |
| project_structure | Object | No | Discovery report structure |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| estimate | Number | Best guess file count |
| range_min | Number | Minimum expected |
| range_max | Number | Maximum expected |
| confidence | String | high/medium/low |
| breakdown | Object | Count by file type |

## Examples
```
Input: {
  "keyword_matches": {
    "user": 15,
    "preferences": 3
  },
  "feature_type": "fullstack"
}

Output: {
  "estimate": 12,
  "range_min": 8,
  "range_max": 18,
  "confidence": "medium",
  "breakdown": {
    "services": 2,
    "controllers": 1,
    "models": 1,
    "routes": 1,
    "components": 4,
    "tests": 3
  }
}
```

## Validation
- Estimate based on actual keyword matches
- Range provided with min/max
- Confidence level appropriate to match quality
- Breakdown by file type when possible
