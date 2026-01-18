---
name: dependency-mapping
description: Identify dependencies between requirements
skill_id: REQ-006
owner: requirements-analyst
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Implementation planning, sequencing, impact analysis
dependencies: [REQ-001]
---

# Dependency Mapping

## Purpose
Identify and document dependencies between requirements to enable proper sequencing, impact analysis, and prevent blocked work during implementation.

## When to Use
- After requirements documented
- Implementation planning
- Sprint planning
- Impact analysis
- Risk assessment

## Prerequisites
- Requirements enumerated with IDs
- Requirements understood
- Technical context available

## Process

### Step 1: Identify Dependency Types
```
Dependency categories:
- Requires: REQ-A requires REQ-B to exist first
- Enhances: REQ-A enhances/extends REQ-B
- Conflicts: REQ-A conflicts with REQ-B
- Related: REQ-A and REQ-B share components
- External: REQ-A depends on external system
```

### Step 2: Map Each Requirement
```
For each requirement:
1. What must exist before this can work?
2. What does this enable?
3. Are there shared components?
4. Are there conflicts?
5. External dependencies?
```

### Step 3: Create Dependency Graph
```
Document as:
- Directed graph (A → B means A depends on B)
- Identify root nodes (no dependencies)
- Identify leaf nodes (nothing depends on them)
- Find critical paths
- Detect cycles (error!)
```

### Step 4: Identify Implementation Order
```
Topological sort:
1. Implement root nodes first
2. Then nodes whose dependencies are met
3. Continue until all implemented
4. Flag parallel opportunities
```

### Step 5: Document Dependency Matrix
```
Matrix format:
          | REQ-A | REQ-B | REQ-C |
REQ-A     |   -   |   →   |       |
REQ-B     |   ←   |   -   |   →   |
REQ-C     |       |   ←   |   -   |

→ = depends on
← = depended upon by
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| requirements_spec | Markdown | Yes | All requirements |
| architecture | Markdown | Optional | Technical dependencies |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| dependency_map.json | JSON | Complete dependency data |
| dependency_graph.mermaid | Mermaid | Visual graph |
| implementation_order.md | Markdown | Suggested sequence |

## Project-Specific Considerations
- Authentication is foundational (most features depend on it)
- University API must work before search features
- Profile must exist before application features
- GDPR features required across all data handling

## Integration Points
- **Orchestrator**: Task sequencing
- **Test Manager**: Test order planning
- **Architecture Agent**: Technical dependency validation

## Examples
```
Dependency Graph - SDLC Framework

graph TD
    REQ-001[User Auth] --> REQ-002[Profile]
    REQ-001 --> REQ-003[Search]
    REQ-002 --> REQ-004[Application]
    REQ-003 --> REQ-004
    REQ-004 --> REQ-005[Documents]
    REQ-004 --> REQ-006[Tracking]
    REQ-001 --> REQ-010[GDPR Consent]
    REQ-002 --> REQ-011[Data Export]
    REQ-002 --> REQ-012[Account Delete]

Implementation Order:
1. REQ-001 (Auth) - Foundation
2. REQ-010 (GDPR Consent) - Required with auth
3. REQ-002 (Profile) - After auth
4. REQ-003 (Search) - After auth
5. REQ-011, REQ-012 (GDPR) - After profile
6. REQ-004 (Application) - After profile & search
7. REQ-005 (Documents) - After application
8. REQ-006 (Tracking) - After application

Parallel Opportunities:
- REQ-002 and REQ-003 can parallel after REQ-001
- REQ-005 and REQ-006 can parallel after REQ-004
```

## Validation
- All requirements in dependency map
- No circular dependencies
- Root nodes identified
- Implementation order valid
- External dependencies flagged