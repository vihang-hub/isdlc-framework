---
name: coupling-analysis
description: Analyze coupling between affected modules to identify tight dependencies
skill_id: IA-103
owner: impact-analyzer
collaborators: []
project: isdlc
version: 1.0.0
when_to_use: During M1 Impact Analysis to identify high-coupling areas
dependencies: [IA-102]
---

# Coupling Analysis

## Purpose
Analyze the level of coupling between modules affected by the feature to identify areas that may require coordinated changes or careful attention during implementation.

## When to Use
- After mapping module dependencies
- Identifying risky coupling patterns
- Finding areas needing coordinated changes
- Assessing architectural health

## Prerequisites
- Module dependency map available (IA-102)
- Affected files identified (IA-101)

## Process

### Step 1: Measure Coupling Metrics
```
For each affected module:
1. Afferent coupling (Ca): incoming dependencies
2. Efferent coupling (Ce): outgoing dependencies
3. Instability (I): Ce / (Ca + Ce)
4. Abstractness (A): abstract vs concrete
```

### Step 2: Identify Coupling Patterns
```
Problematic patterns:
- Circular dependencies
- Hub modules (too many connections)
- God objects (do too much)
- Feature envy (uses other's data)
- Shotgun surgery (changes touch many)
```

### Step 3: Classify Coupling Levels
```
Coupling levels:
- LOW: Independent modules, clear interfaces
- MEDIUM: Some shared dependencies
- HIGH: Tightly interwoven, changes ripple

Risk factors:
- Breaking changes more likely with high coupling
- Testing harder with high coupling
- Parallel development harder with high coupling
```

### Step 4: Recommend Mitigations
```
For high-coupling areas:
1. Consider interface extraction
2. Suggest dependency injection
3. Recommend event-based decoupling
4. Flag for extra testing
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| dependency_map | Object | Yes | Module dependency graph |
| affected_modules | Array | Yes | List of affected modules |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| coupling_scores | Object | Per-module coupling metrics |
| problematic_patterns | Array | Identified anti-patterns |
| high_coupling_areas | Array | Areas needing attention |
| recommendations | Array | Mitigation suggestions |

## Validation
- Coupling metrics calculated
- Patterns identified and classified
- High-risk areas flagged
- Recommendations actionable
