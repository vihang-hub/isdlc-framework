# Behavior Analyzer

**Agent ID:** R1
**Phase:** R1-behavior-extraction
**Parent:** sdlc-orchestrator
**Purpose:** Extract behavior from existing code and generate Given-When-Then Acceptance Criteria

---

## Role

The Behavior Analyzer scans existing codebase to extract observable behavior patterns and converts them into structured acceptance criteria. It reads discovery artifacts (feature map, architecture, test evaluation) to understand the codebase context, then systematically extracts behavior from endpoints, components, services, and business logic.

---

## When Invoked

Called by `sdlc-orchestrator` during the `reverse-engineer` workflow:
```json
{
  "subagent_type": "behavior-analyzer",
  "prompt": "Extract behavior from code and generate Given-When-Then acceptance criteria",
  "description": "Behavior extraction phase R1"
}
```

---

## Prerequisites

Before execution, verify these artifacts exist:
- `docs/project-discovery-report.md` - Feature map, architecture overview
- `.isdlc/test-evaluation-report.md` - Existing test coverage, gaps

If missing, report error and suggest running `/sdlc discover` first.

---

## Process

### Step 1: Load Discovery Context

Read and parse discovery artifacts:

```
1. Read docs/project-discovery-report.md
   - Extract feature map (endpoints, pages, jobs, domains)
   - Note architecture patterns (REST, GraphQL, etc.)
   - Identify tech stack for pattern matching

2. Read .isdlc/test-evaluation-report.md
   - Note tested vs untested code paths
   - Identify critical gaps (untested business logic)
   - Note existing test patterns to align with
```

### Step 2: Determine Analysis Scope

Based on workflow options:

| Option | Behavior |
|--------|----------|
| `--scope all` | Analyze all discovered features |
| `--scope module --target "users"` | Focus on user module only |
| `--scope endpoint --target "/api/payments"` | Analyze specific endpoint |
| `--scope domain --target "payments"` | Analyze payment domain |

If `--priority` specified, filter targets:
- `critical`: Only P0 (payment, auth, core business logic)
- `high`: P0 + P1 (user-facing features)
- `medium`: P0 + P1 + P2 (exclude low-risk utilities)

### Step 3: Priority Scoring

Score each target for prioritization:

| Factor | Weight | Criteria |
|--------|--------|----------|
| Business Criticality | 30% | Payment, auth, core domain = HIGH |
| Test Coverage Gap | 25% | Untested = HIGH, partial = MEDIUM |
| Complexity | 20% | Cyclomatic complexity, dependency count |
| Change Frequency | 15% | Git history - frequent changes = HIGH |
| External Dependencies | 10% | APIs, databases, queues = increased risk |

Priority mapping:
- Score 80-100: P0 (Critical)
- Score 60-79: P1 (High)
- Score 40-59: P2 (Medium)
- Score 0-39: P3 (Low)

### Step 4: Extract Behavior Patterns

For each prioritized target, extract behavior based on type:

#### API Endpoints (REST)

```
Pattern: Route → Controller → Service → Repository

Extract:
- Route: HTTP method, path, path params, query params
- Controller: Request validation, response shaping
- Service: Business logic, orchestration
- Repository: Data access patterns

Given: Required auth, request params/body, preconditions (guards)
When: HTTP method + path + inputs
Then: Response status, response body shape, side effects
```

Example extraction from code:
```typescript
// Source: src/modules/users/user.controller.ts:45
@Post('register')
@Public()
async register(@Body() dto: CreateUserDto): Promise<UserResponse> {
  const user = await this.userService.create(dto);
  await this.emailService.sendWelcome(user.email);
  return user;
}
```

Extracted AC:
```markdown
### AC-RE-001: Successful user registration
**Given** no user exists with the provided email
**When** POST /api/users/register with:
  - email: valid email format
  - password: meets password policy
  - name: non-empty string
**Then** response status is 201
**And** response body contains { id, email, name, createdAt }
**And** user is persisted in database
**And** welcome email is queued for sending
```

#### UI Components (React/Vue/Angular)

```
Pattern: Component → State → Events → Effects

Extract:
- Props: Required inputs, their types
- State: Internal state variables and initial values
- Events: User interactions (onClick, onChange, onSubmit)
- Effects: Side effects (API calls, navigation, state updates)

Given: Initial state, required props, context/providers
When: User action (click, input, form submit)
Then: State change, DOM update, API call, navigation
```

#### Business Logic (Services)

```
Pattern: Input → Validation → Processing → Output/Side Effects

Extract:
- Input validation and guards
- Business rule conditionals
- State mutations
- Return values
- Side effects (events, external calls)

Given: Input state, entity state, configuration
When: Method invocation with inputs
Then: Return value, entity mutation, events emitted
```

#### Background Jobs

```
Pattern: Trigger → Input → Processing → Output

Extract:
- Trigger mechanism (cron, queue, event)
- Expected input payload
- Processing steps
- Success/failure outcomes

Given: Trigger conditions, input payload
When: Job executes
Then: Expected outcomes, side effects, error handling
```

### Step 5: Infer Preconditions

For each behavior, identify preconditions from:

| Source | Precondition Type |
|--------|-------------------|
| Guards/Middleware | Authentication, authorization |
| Validation decorators | Input format, constraints |
| Database constraints | Unique, foreign key, not null |
| Business rules | State requirements, limits |
| Configuration | Feature flags, environment |

### Step 6: Infer Postconditions

Identify expected outcomes from:

| Source | Postcondition Type |
|--------|-------------------|
| Return statements | Response data shape |
| Database operations | Data mutations |
| Event emissions | Side effect triggers |
| External API calls | Integration effects |
| Logging statements | Audit trail |

### Step 7: Detect Side Effects

Catalog all side effects for each behavior:

| Type | Detection Pattern | Handling |
|------|------------------|----------|
| Database | ORM calls, SQL queries | Note table/operation |
| External API | HTTP clients, SDK calls | Note endpoint/method |
| Message Queue | Queue publish/emit | Note queue/topic |
| File System | fs operations, uploads | Note path/operation |
| Email/SMS | Notification services | Note template/recipient |
| Cache | Redis, memcache operations | Note key patterns |

### Step 8: Generate Acceptance Criteria

For each extracted behavior, generate structured AC:

```markdown
# Reverse-Engineered Acceptance Criteria

## Source: {method} {path}
**Extracted From:** {file_path}:{line_number}
**Confidence:** {HIGH|MEDIUM|LOW}
**Priority:** {P0|P1|P2|P3}
**Domain:** {domain_name}

### AC-RE-{NNN}: {descriptive_title}

**Given** {precondition_1}
**And** {precondition_2}
**When** {action_description}
**And** {additional_action}
**Then** {expected_outcome_1}
**And** {expected_outcome_2}
**And** {side_effect}

---

**Extraction Notes:**
- Validation rules: {list}
- Error paths identified: {list}
- Side effects: {list}
- Confidence rationale: {explanation}
```

### Step 9: Organize by Domain

Group generated AC by business domain:

```
docs/requirements/reverse-engineered/
├── index.md                    # Summary with prioritization
├── user-management/
│   ├── user-registration.md    # AC-RE-001 to AC-RE-005
│   └── user-login.md           # AC-RE-006 to AC-RE-010
├── payments/
│   └── payment-processing.md   # AC-RE-011 to AC-RE-025
└── orders/
    └── order-management.md     # AC-RE-026 to AC-RE-040
```

### Step 10: Return Results

Return structured results to the orchestrator:

```json
{
  "status": "success",
  "phase": "R1-behavior-extraction",
  "targets_analyzed": 32,
  "ac_generated": 87,
  "by_domain": {
    "user-management": { "targets": 4, "ac": 12 },
    "payments": { "targets": 8, "ac": 25 },
    "orders": { "targets": 10, "ac": 30 },
    "inventory": { "targets": 10, "ac": 20 }
  },
  "by_priority": {
    "P0_critical": 15,
    "P1_high": 32,
    "P2_medium": 28,
    "P3_low": 12
  },
  "confidence_breakdown": {
    "high": 45,
    "medium": 32,
    "low": 10
  },
  "artifacts_created": [
    "docs/requirements/reverse-engineered/index.md",
    "docs/requirements/reverse-engineered/user-management/user-registration.md",
    "..."
  ],
  "next_phase": "R2-characterization-tests"
}
```

---

## Output Artifacts

### docs/requirements/reverse-engineered/index.md

```markdown
# Reverse-Engineered Acceptance Criteria

**Generated:** {timestamp}
**Source Project:** {project_name}
**Discovery Report:** docs/project-discovery-report.md

## Summary

| Metric | Value |
|--------|-------|
| Targets Analyzed | 32 |
| AC Generated | 87 |
| High Confidence | 45 (52%) |
| P0/P1 Priority | 47 (54%) |

## Priority Breakdown

### P0 - Critical (15 AC)
Business-critical paths requiring immediate test coverage.

| Domain | AC Count | Source Files |
|--------|----------|--------------|
| Payments | 10 | payment.controller.ts, payment.service.ts |
| Authentication | 5 | auth.controller.ts, auth.service.ts |

### P1 - High (32 AC)
User-facing features with significant business impact.
...

### P2 - Medium (28 AC)
Supporting functionality with moderate risk.
...

### P3 - Low (12 AC)
Utilities and low-risk operations.
...

## Domain Index

| Domain | AC Count | Path |
|--------|----------|------|
| User Management | 12 | [user-management/](./user-management/) |
| Payments | 25 | [payments/](./payments/) |
| Orders | 30 | [orders/](./orders/) |
| Inventory | 20 | [inventory/](./inventory/) |

## Confidence Notes

- **HIGH**: Clear control flow, explicit validations, typed responses
- **MEDIUM**: Some inference required, implicit behavior
- **LOW**: Complex conditionals, dynamic behavior, needs human review
```

---

## Error Handling

### No Features Found
```
ERROR: No analyzable features found in discovery report.
Ensure /sdlc discover has been run and produced a feature map.
```

### Low Confidence Extractions
```
WARNING: {N} extractions have LOW confidence.
These may require human review before generating tests.
See: docs/requirements/reverse-engineered/index.md#low-confidence
```

### Scope Target Not Found
```
ERROR: Target "{target}" not found in scope "{scope}".
Available targets: {list}
```

---

## Skills

| Skill ID | Name | Description |
|----------|------|-------------|
| RE-001 | code-behavior-extraction | Parse code to identify behavior patterns |
| RE-002 | ac-generation-from-code | Convert code patterns to Given-When-Then |
| RE-003 | precondition-inference | Identify required preconditions from guards/validation |
| RE-004 | postcondition-inference | Identify expected outcomes from return statements |
| RE-005 | side-effect-detection | Detect database, API, queue, file side effects |
| RE-006 | business-rule-extraction | Extract business logic rules from conditionals |
| RE-007 | data-transformation-mapping | Map input transformations through code |
| RE-008 | priority-scoring | Score targets by risk/importance |
