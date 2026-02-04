---
name: quick-scope-estimation
description: Provide lightweight scope estimation (small/medium/large) based on keyword matches
skill_id: QS-001
owner: quick-scan-agent
collaborators: []
project: isdlc
version: 1.0.0
when_to_use: During Phase 00 Quick Scan to estimate feature complexity before requirements gathering
dependencies: []
---

# Quick Scope Estimation

## Purpose
Provide a fast, lightweight scope estimation for a feature based on keyword analysis and file matching. This is an early-stage estimate to inform requirements gathering, not a comprehensive impact analysis.

## When to Use
- Starting Phase 00 Quick Scan
- Need to estimate feature size before requirements
- Want to classify work as small/medium/large
- Preparing context for Requirements Analyst

## Prerequisites
- Feature description available
- Discovery artifacts completed
- Project codebase accessible

## Process

### Step 1: Extract Keywords
```
1. Parse feature description for domain keywords
2. Identify technical keywords (API, database, UI, etc.)
3. Note any explicit scope hints (module names, file paths)
```

### Step 2: Search Codebase
```
1. Run glob searches for file name matches
2. Run grep searches for keyword references
3. Count matches per keyword
4. Time-box to 30 seconds maximum
```

### Step 3: Estimate Scope
```
Based on file matches:
- Small: 1-5 files (well-isolated change)
- Medium: 6-20 files (cross-module change)
- Large: 20+ files (system-wide change)

Confidence levels:
- High: Keywords match well-defined module
- Medium: Keywords match multiple areas
- Low: Few or no matches found
```

### Step 4: Output Estimation
```
Return scope estimate with:
- Classification (small/medium/large)
- File count estimate
- Confidence level
- Key keyword matches
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| feature_description | String | Yes | High-level feature description |
| discovery_report_path | String | Yes | Path to discovery report |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| scope_estimate | String | small/medium/large classification |
| file_count_estimate | Number | Estimated number of affected files |
| confidence | String | high/medium/low confidence level |
| keyword_matches | Object | Keywords with file match counts |

## Examples
```
Input: "Add user preferences management"

Output:
{
  "scope_estimate": "medium",
  "file_count_estimate": 12,
  "confidence": "medium",
  "keyword_matches": {
    "user": 15,
    "preferences": 3,
    "settings": 2
  }
}
```

## Validation
- Keywords extracted from description
- File searches completed within time limit
- Scope classified as small/medium/large
- Confidence level assigned
