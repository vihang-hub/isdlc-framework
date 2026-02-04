---
name: complexity-scoring
description: Score code complexity in affected areas to identify hard-to-modify code
skill_id: IA-301
owner: risk-assessor
collaborators: []
project: isdlc
version: 1.0.0
when_to_use: During M3 Risk Assessment to evaluate code complexity
dependencies: []
---

# Complexity Scoring

## Purpose
Analyze and score code complexity in areas affected by the feature to identify modules that may be difficult to modify safely, helping prioritize refactoring or extra testing.

## When to Use
- Assessing modification risk in affected code
- Identifying complexity hotspots
- Planning refactoring before changes
- Estimating development difficulty

## Prerequisites
- Affected files identified (from M1)
- Source files accessible
- Complexity metrics available or calculable

## Process

### Step 1: Measure Complexity Metrics
```
For each affected file:
1. Cyclomatic complexity (branches, conditions)
2. Lines of code
3. Number of dependencies (imports)
4. Nesting depth (nested conditions/loops)
5. Cognitive complexity (human readability)
```

### Step 2: Apply Scoring Thresholds
```
| Metric | Low (0-1) | Medium (2) | High (3) |
|--------|-----------|------------|----------|
| Cyclomatic | <10 | 10-20 | >20 |
| Lines | <200 | 200-500 | >500 |
| Dependencies | <10 | 10-20 | >20 |
| Nesting | <3 | 3-5 | >5 |
```

### Step 3: Calculate Composite Score
```
Per-file score = sum of metric scores (0-12)
- Low: 0-3
- Medium: 4-7
- High: 8-12

Map to acceptance criteria:
- Which ACs touch high-complexity code?
- Are there clusters of complexity?
```

### Step 4: Identify Hotspots
```
Flag complexity hotspots:
- Files with score > 8
- Functions with cyclomatic > 15
- Classes with > 500 lines
- Deep nesting (> 4 levels)
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| affected_files | Array | Yes | Files to analyze |
| acceptance_criteria | Array | Yes | ACs for mapping |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| file_scores | Object | Per-file complexity scores |
| hotspots | Array | High-complexity locations |
| by_ac | Object | Complexity per acceptance criterion |
| recommendations | Array | Refactoring suggestions |

## Validation
- All affected files scored
- Hotspots identified
- AC mapping complete
- Recommendations actionable
