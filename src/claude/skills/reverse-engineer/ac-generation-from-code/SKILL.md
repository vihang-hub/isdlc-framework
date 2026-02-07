---
name: ac-generation-from-code
description: Convert code behavior patterns to Given-When-Then acceptance criteria
skill_id: RE-002
owner: feature-mapper
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Generating acceptance criteria from extracted code behavior
dependencies: [RE-001]
---

# AC Generation from Code

## Purpose
Transform extracted behavior models into structured Given-When-Then acceptance criteria. Converts implementation details into business-readable specifications that can be reviewed, validated, and used for test generation.

## When to Use
- After behavior extraction (RE-001)
- Creating documentation from code
- Preparing for ATDD workflow integration
- Bridging code to specifications

## Prerequisites
- Behavior model from RE-001
- Control flow analysis complete
- Side effects identified

## Process

### Step 1: Map Behavior to Scenarios
```
For each behavior model:
1. Identify the happy path → primary AC
2. Identify error branches → error AC
3. Identify edge cases → boundary AC
4. Identify state dependencies → precondition AC
```

### Step 2: Generate Given Clauses
```
Given clauses from:
- Authentication state (logged in, admin, guest)
- Entity state (exists, doesn't exist, specific values)
- System state (feature flags, config, time)
- Prior actions (completed steps)

Example:
Behavior: "Check if user exists before registration"
Given: "no user exists with email 'test@example.com'"
```

### Step 3: Generate When Clauses
```
When clauses from:
- HTTP request (method + path + body)
- User action (click, submit, navigate)
- System event (cron trigger, queue message)
- Method invocation

Example:
Behavior: "POST /api/users with email and password"
When: "POST /api/users/register with email 'test@example.com' and password 'Secure123!'"
```

### Step 4: Generate Then Clauses
```
Then clauses from:
- Return values / Response status
- Response body content
- Database mutations
- Events emitted
- External calls made

Example:
Behavior: "Returns 201 with user object, saves to DB, sends email"
Then: "response status is 201"
And: "response body contains { id, email, name }"
And: "user is persisted in database"
And: "welcome email is queued"
```

### Step 5: Structure AC Document
```markdown
### AC-RE-{NNN}: {descriptive_title}

**Source:** {file_path}:{line_number}
**Confidence:** {HIGH|MEDIUM|LOW}
**Priority:** {P0|P1|P2|P3}

**Given** {precondition_1}
**And** {precondition_2}
**When** {action}
**Then** {expected_outcome_1}
**And** {expected_outcome_2}

---
**Extraction Notes:**
- Source branch: {conditional or main flow}
- Validation rules: {list}
- Side effects: {list}
```

## AC Patterns by Behavior Type

### API Endpoint → AC
```
Behavior Model:
{
  "entry_point": "POST /api/orders",
  "inputs": [{ "name": "items", "type": "array" }],
  "guard": "user authenticated",
  "validation": "items not empty",
  "output": { "status": 201, "body": "Order" },
  "side_effects": ["database:INSERT:orders", "event:OrderCreated"]
}

Generated AC:
Given a user is authenticated
And the user has items in their cart
When POST /api/orders with cart items
Then response status is 201
And response contains order ID and total
And order is saved to database
And OrderCreated event is published
```

### UI Component → AC
```
Behavior Model:
{
  "component": "LoginForm",
  "props": ["onSuccess"],
  "state": ["email", "password", "error"],
  "event": "form submit",
  "validation": "email format, password required",
  "output": "calls onSuccess with token"
}

Generated AC:
Given the login form is displayed
When user enters valid email and password
And user clicks "Sign In"
Then login API is called
And user is redirected to dashboard
And success callback is invoked
```

### Background Job → AC
```
Behavior Model:
{
  "job": "SyncInventory",
  "trigger": "cron every 15 minutes",
  "inputs": ["supplier API response"],
  "output": "database updates",
  "error_handling": "retry 3 times, alert on failure"
}

Generated AC:
Given the inventory sync job is scheduled
When the cron trigger fires
Then the supplier API is called
And inventory levels are updated in database
And sync timestamp is recorded
```

## Confidence Scoring

| Factor | HIGH | MEDIUM | LOW |
|--------|------|--------|-----|
| Type safety | Fully typed | Partially typed | Untyped |
| Validation | Explicit | Implicit | Missing |
| Documentation | JSDoc/docstring | Comments | None |
| Test coverage | Has tests | Partial | None |
| Complexity | Simple flow | Multiple branches | Complex logic |

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| behavior_model | JSON | Yes | From RE-001 |
| domain_context | String | Optional | Business domain name |
| priority | String | Optional | P0/P1/P2/P3 |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| acceptance_criteria | Markdown | GWT format AC |
| ac_metadata | JSON | Source, confidence, priority |
| extraction_notes | Markdown | Details for review |

## Project-Specific Considerations
- Follow existing AC naming conventions if project has them (AC-001, US-001-AC-01, etc.)
- Include domain-specific terminology from project glossary
- Reference existing user stories or requirements if available
- Align Given-When-Then style with existing test patterns
- Note compliance requirements (GDPR, PCI-DSS) in relevant AC

## Integration Points
- **Behavior Extraction (RE-001)**: Consumes behavior models as input
- **Precondition Inference (RE-003)**: Provides Given clause details
- **Postcondition Inference (RE-004)**: Provides Then clause details
- **Test Scaffold Generation (RE-106)**: AC used to generate test cases
- **Requirements Analyst (01)**: AC format aligns with forward-engineering AC

## Validation
- Given clauses capture all preconditions
- When clauses are specific and actionable
- Then clauses are testable and measurable
- No ambiguous language used
- Source reference included
