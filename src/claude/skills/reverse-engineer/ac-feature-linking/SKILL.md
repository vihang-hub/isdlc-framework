---
name: ac-feature-linking
description: Link generated acceptance criteria to feature map entries
skill_id: RE-201
owner: artifact-integration
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Connecting extracted AC to discovered features
dependencies: [RE-002]
---

# AC Feature Linking

## Purpose
Link each generated acceptance criterion to its corresponding feature map entry from the discovery phase. This creates bidirectional traceability between documented behavior and discovered code features.

## When to Use
- After AC generation (R1) completes
- Before generating traceability matrix
- When establishing code → AC relationships

## Prerequisites
- AC files from RE-002 (ac-generation-from-code)
- Feature map from docs/project-discovery-report.md
- Source file references in AC

## Process

### Step 1: Load Feature Map
```
Read docs/project-discovery-report.md
Extract feature entries:
- Endpoints (path, method, controller)
- Pages (route, component)
- Jobs (trigger, handler)
- Services (methods, dependencies)
```

### Step 2: Load AC Index
```
Read docs/requirements/reverse-engineered/index.md
For each AC:
- Get AC ID
- Get source file reference
- Get domain
```

### Step 3: Match AC to Features
```
For each AC:
1. Extract source file from AC
2. Find matching feature by source file
3. Verify domain alignment
4. Create link record
```

### Step 4: Generate Link Records
```json
{
  "ac_id": "AC-RE-001",
  "feature": {
    "type": "endpoint",
    "path": "POST /api/users/register",
    "source": "src/modules/users/user.controller.ts"
  },
  "confidence": "high",
  "link_type": "direct"
}
```

### Step 5: Handle Unlinked AC
```
If no matching feature:
- Mark as "orphan"
- Log for review
- May indicate missing discovery or new code
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| ac_index | File | Yes | AC summary file |
| feature_map | File | Yes | Discovery report |
| domain_filter | String | Optional | Limit to domain |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| link_records | Array | AC-to-feature mappings |
| orphan_ac | Array | AC without feature matches |
| link_summary | Object | Statistics |

## Project-Specific Considerations
- Feature map structure varies by project type (REST, GraphQL, monolith)
- Source file paths must use consistent format
- Some AC may map to multiple features (shared code)
- Feature discovery must be complete before linking

## Integration Points
- **AC Generation (RE-002)**: Source of AC with file references
- **Feature Mapper (D6)**: Source of feature map
- **Traceability Matrix (RE-202)**: Consumes link records
- **Report Generation (RE-203)**: Uses link statistics

## Validation
- All high-priority AC linked
- No duplicate links
- Source files exist
- Features exist in map
