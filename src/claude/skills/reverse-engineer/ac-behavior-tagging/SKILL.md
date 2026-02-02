---
name: ac-behavior-tagging
description: Tag acceptance criteria as captured behavior for human review
skill_id: RE-302
owner: atdd-bridge
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Marking reverse-engineered AC for review before ATDD
dependencies: [RE-002]
---

# AC Behavior Tagging

## Purpose
Tag all reverse-engineered acceptance criteria with metadata indicating they represent captured (observed) behavior rather than specified (intended) behavior. This signals to humans that review is required before the AC becomes a contract.

## When to Use
- During ATDD bridge phase (R4)
- When preparing AC for human review
- Before enabling ATDD workflow

## Prerequisites
- AC files from RE-002
- ATDD checklist structure from RE-301

## Process

### Step 1: Load AC Files
```
For each domain directory:
- Read all AC markdown files
- Parse AC entries
- Identify metadata section
```

### Step 2: Add Captured Behavior Tag
```markdown
## AC-RE-001: Successful user registration

**Type:** captured_behavior
**Confidence:** HIGH
**Human Reviewed:** false
**Status:** pending_review
**Priority:** P0
**Captured From:** src/modules/users/user.controller.ts:45

**Given** ...
```

### Step 3: Add Review Instructions
```markdown
---
**Review Instructions:**
This AC was automatically extracted from existing code. Before removing
the `pending_review` status:
1. Verify the captured behavior is correct
2. Confirm this is desired behavior (not a bug)
3. Check edge cases are covered
4. Update status to `approved` or `needs_fix`
---
```

### Step 4: Track Review Status
```json
{
  "ac_id": "AC-RE-001",
  "type": "captured_behavior",
  "review_status": {
    "human_reviewed": false,
    "reviewer": null,
    "reviewed_at": null,
    "decision": null,
    "notes": null
  }
}
```

### Step 5: Update State
```json
{
  "reverse_engineering": {
    "ac_tagged": 87,
    "pending_review": 87,
    "approved": 0,
    "needs_fix": 0
  }
}
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| ac_files | Array | Yes | AC markdown files |
| confidence_data | Object | Yes | From R1 extraction |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| tagged_ac_files | Array | Updated AC files |
| review_summary | Object | Tagging statistics |

## Project-Specific Considerations
- Tag format should integrate with existing review tools
- Consider adding approval workflow hooks
- Large AC counts may need batch review process
- Track review progress in state.json

## Integration Points
- **AC Generation (RE-002)**: Source AC files
- **ATDD Checklist (RE-301)**: Reads tagged status
- **QA Engineer (07)**: Performs human review
- **Software Developer (05)**: Acts on approved AC

## Validation
- All AC tagged
- Metadata format consistent
- Review instructions present
- State updated accurately
