---
name: priority-migration
description: Map reverse-engineered priorities to ATDD workflow priorities
skill_id: RE-303
owner: atdd-bridge
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Planning priority-based ATDD migration
dependencies: [RE-008, RE-301]
---

# Priority Migration

## Purpose
Map the priority scores from reverse engineering (P0-P3) to the ATDD workflow priority system, ensuring that the most critical behavior is validated first during migration.

## When to Use
- During ATDD bridge phase (R4)
- When planning migration order
- When generating ATDD checklists

## Prerequisites
- Priority scores from RE-008
- ATDD checklist structure from RE-301
- Project ATDD conventions

## Process

### Step 1: Load Priority Data
```
From R1 phase:
- P0 (Critical): 15 AC
- P1 (High): 32 AC
- P2 (Medium): 28 AC
- P3 (Low): 12 AC
```

### Step 2: Map to ATDD Priorities
```
Default mapping (1:1):
RE Priority → ATDD Priority → Implementation Order

P0 (Critical) → P0 → First (must pass for MVP)
P1 (High)     → P1 → After all P0 pass
P2 (Medium)   → P2 → After all P1 pass
P3 (Low)      → P3 → If time permits
```

### Step 3: Generate Migration Plan
```markdown
## Priority Migration Plan

### Phase 1: P0 Critical (15 AC)
Target: 100% passing before any P1 work
Domains: payments (10), authentication (5)

### Phase 2: P1 High (32 AC)
Target: 100% passing before any P2 work
Domains: user-management (12), orders (20)

### Phase 3: P2 Medium (28 AC)
Target: 100% passing
Domains: inventory (15), reporting (13)

### Phase 4: P3 Low (12 AC)
Target: Best effort
Domains: utilities (12)
```

### Step 4: Add Migration Estimates
```json
{
  "migration_plan": {
    "P0": {
      "ac_count": 15,
      "domains": ["payments", "authentication"],
      "recommended_order": ["authentication", "payments"],
      "reason": "Auth must work before payments"
    }
  }
}
```

### Step 5: Document Special Cases
```markdown
## Special Migration Considerations

### Cross-Domain Dependencies
- Payment processing depends on user authentication
- Order processing depends on inventory checks

### Recommended Migration Order
1. authentication (no dependencies)
2. user-management (depends on auth)
3. payments (depends on auth + user)
4. inventory (standalone)
5. orders (depends on inventory + user)
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| priority_scores | Object | Yes | From RE-008 |
| domain_ac | Object | Yes | AC by domain |
| dependencies | Array | Optional | Known dependencies |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| migration_plan | Object | Ordered migration plan |
| priority_mapping | Object | RE → ATDD mapping |
| documentation | File | Migration guide section |

## Project-Specific Considerations
- Priority mapping may need adjustment for project context
- Cross-domain dependencies affect migration order
- Consider team capacity for parallel migration
- Risk-based ordering may differ from priority ordering

## Integration Points
- **Priority Scoring (RE-008)**: Source of RE priorities
- **ATDD Checklist (RE-301)**: Receives priority mappings
- **Test Design Engineer (04)**: Uses priorities in ATDD mode
- **Software Developer (05)**: Follows priority order in implementation

## Validation
- All AC have priority assignments
- Mapping is consistent
- Dependencies documented
- Plan is achievable
