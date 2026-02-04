---
name: keyword-search
description: Perform fast keyword searches across codebase for domain and technical terms
skill_id: QS-002
owner: quick-scan-agent
collaborators: []
project: isdlc
version: 1.0.0
when_to_use: During Phase 00 Quick Scan to find code related to feature keywords
dependencies: []
---

# Keyword Search

## Purpose
Perform rapid keyword searches across the codebase to find files and modules related to a feature description. This is a lightweight search for initial context, not a comprehensive dependency analysis.

## When to Use
- Identifying relevant code areas for a new feature
- Finding existing implementations of domain concepts
- Discovering technical entry points
- Building initial context for requirements gathering

## Prerequisites
- Keyword list available
- Codebase accessible
- Discovery report for tech stack context

## Process

### Step 1: Prepare Keywords
```
1. Domain keywords: business concepts from feature description
2. Technical keywords: API, database, service, controller, etc.
3. Scope hints: any mentioned file paths or module names
```

### Step 2: Configure Search
```
Based on tech stack from discovery:
- File extensions to search (*.ts, *.py, *.java, etc.)
- Directories to include (src/, lib/, etc.)
- Directories to exclude (node_modules/, vendor/, etc.)
```

### Step 3: Execute Searches
```
For each keyword:
1. Run glob for file name matches
2. Run grep for content matches
3. Record file paths and match counts
4. Stop at 30-second time limit

Time budget: ~2-3 seconds per keyword
```

### Step 4: Aggregate Results
```
1. Deduplicate file matches across keywords
2. Rank files by match frequency
3. Group by module/directory
4. Return top matches
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| keywords | Array | Yes | List of keywords to search |
| tech_stack | Object | No | Tech stack info from discovery |
| time_limit_ms | Number | No | Max search time (default: 30000) |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| matches | Array | Files with match details |
| keyword_stats | Object | Match counts per keyword |
| search_duration_ms | Number | Time taken for search |
| truncated | Boolean | Whether search hit time limit |

## Examples
```
Input: {
  "keywords": ["user", "preferences", "settings"],
  "tech_stack": { "language": "typescript" }
}

Output: {
  "matches": [
    { "file": "src/services/user.service.ts", "keywords": ["user"], "count": 12 },
    { "file": "src/models/preferences.ts", "keywords": ["preferences"], "count": 5 }
  ],
  "keyword_stats": {
    "user": 15,
    "preferences": 3,
    "settings": 2
  },
  "search_duration_ms": 1250,
  "truncated": false
}
```

## Validation
- All keywords searched
- Results aggregated and deduplicated
- Search completed within time limit
- Match counts recorded
