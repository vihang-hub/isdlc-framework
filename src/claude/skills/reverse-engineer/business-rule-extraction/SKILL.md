---
name: business-rule-extraction
description: Extract business logic rules from conditionals and validations
skill_id: RE-006
owner: feature-mapper
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Identifying business rules embedded in code
dependencies: [RE-001]
---

# Business Rule Extraction

## Purpose
Extract business logic rules that are embedded in code conditionals, validations, and guard clauses. These rules often represent important domain constraints that should be documented in acceptance criteria and tested explicitly.

## When to Use
- Documenting domain logic
- Generating business-focused AC
- Identifying validation requirements
- Understanding domain constraints

## Prerequisites
- Behavior model from RE-001
- Access to source code
- Domain context (optional but helpful)

## Process

### Step 1: Identify Conditional Business Logic
```
Scan for:
- If/else blocks with business conditions
- Switch statements on status/type
- Ternary operators with business logic
- Guard clauses at function start

Extract:
- Condition being checked
- Business meaning of the condition
- Action taken when true/false
```

### Step 2: Identify Validation Rules
```
Scan for:
- Field validators (min, max, pattern, enum)
- Cross-field validations (confirm password)
- Business validations (balance check, inventory)
- Format constraints (phone, SSN, date)

Extract:
- Field being validated
- Validation constraint
- Error message/behavior
```

### Step 3: Identify State Machine Rules
```
Scan for:
- Status transitions (pending -> approved)
- Allowed/disallowed transitions
- Transition guards
- State-dependent behavior

Extract:
- States involved
- Transition conditions
- Side effects of transition
```

### Step 4: Identify Calculation Rules
```
Scan for:
- Price calculations (subtotal, tax, discount)
- Date calculations (expiry, due dates)
- Quantity calculations (available stock)
- Aggregate calculations (totals, averages)

Extract:
- Calculation formula
- Input variables
- Rounding/precision rules
```

### Step 5: Identify Access Control Rules
```
Scan for:
- Role-based access
- Resource ownership checks
- Permission matrices
- Org/tenant isolation

Extract:
- Who can do what
- Under what conditions
- Exceptions and overrides
```

### Step 6: Identify Temporal Rules
```
Scan for:
- Date comparisons
- Business hours
- Rate limiting
- Time-based expiry

Extract:
- Temporal constraint
- Time window
- Consequences of violation
```

## Business Rule Patterns

### Conditional Logic
```typescript
// Code:
if (order.status !== 'pending') {
  throw new BadRequestException('Only pending orders can be modified');
}

// Business Rule:
// Rule: ORDER-001
// Description: Orders can only be modified when in pending status
// AC: Given an order with status "confirmed"
//     When user attempts to modify the order
//     Then request is rejected with "Only pending orders can be modified"
```

### Validation Rule
```typescript
// Code:
@Min(1)
@Max(100)
quantity: number;

if (quantity > product.availableStock) {
  throw new BadRequestException('Insufficient stock');
}

// Business Rules:
// Rule: INV-001: Quantity must be between 1 and 100
// Rule: INV-002: Quantity cannot exceed available stock
```

### State Transition Rule
```typescript
// Code:
const allowedTransitions = {
  pending: ['approved', 'rejected'],
  approved: ['shipped'],
  shipped: ['delivered', 'returned'],
  delivered: ['returned'],
};

if (!allowedTransitions[current].includes(next)) {
  throw new BadRequestException(`Cannot transition from ${current} to ${next}`);
}

// Business Rule:
// Rule: ORDER-TRANS-001
// Description: Order status transitions are restricted
// Allowed transitions:
// - pending → approved, rejected
// - approved → shipped
// - shipped → delivered, returned
// - delivered → returned
```

### Calculation Rule
```typescript
// Code:
const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
const tax = subtotal * 0.0825;
const discount = subtotal > 100 ? subtotal * 0.1 : 0;
const total = subtotal + tax - discount;

// Business Rules:
// Rule: CALC-001: Tax is 8.25% of subtotal
// Rule: CALC-002: Orders over $100 receive 10% discount on subtotal
// Rule: CALC-003: Total = subtotal + tax - discount
```

### Access Control Rule
```typescript
// Code:
if (user.role !== 'admin' && order.userId !== user.id) {
  throw new ForbiddenException('Cannot view orders of other users');
}

// Business Rule:
// Rule: ACCESS-001
// Description: Users can only view their own orders unless admin
// AC: Given a regular user
//     When user attempts to view another user's order
//     Then access is denied with "Cannot view orders of other users"
```

### Temporal Rule
```typescript
// Code:
const RETURN_WINDOW_DAYS = 30;
const orderDate = new Date(order.createdAt);
const now = new Date();
const daysSinceOrder = Math.floor((now - orderDate) / (1000 * 60 * 60 * 24));

if (daysSinceOrder > RETURN_WINDOW_DAYS) {
  throw new BadRequestException('Return window has expired');
}

// Business Rule:
// Rule: RETURN-001
// Description: Returns must be initiated within 30 days of order
// AC: Given an order placed 31 days ago
//     When user attempts to return the order
//     Then request is rejected with "Return window has expired"
```

## Business Rule Output Format

```markdown
## Extracted Business Rules

### ORDER-001: Order Modification Restriction
**Source:** src/orders/order.service.ts:45
**Type:** State Constraint
**Rule:** Orders can only be modified when status is 'pending'
**Validation:** status === 'pending'
**On Violation:** BadRequestException with message "Only pending orders can be modified"

### INV-002: Stock Availability Check
**Source:** src/inventory/inventory.service.ts:78
**Type:** Business Validation
**Rule:** Ordered quantity cannot exceed available stock
**Validation:** quantity <= product.availableStock
**On Violation:** BadRequestException with message "Insufficient stock"

### CALC-002: Volume Discount
**Source:** src/orders/pricing.service.ts:23
**Type:** Calculation Rule
**Rule:** Orders over $100 subtotal receive 10% discount
**Formula:** discount = subtotal > 100 ? subtotal * 0.1 : 0
**Variables:** subtotal (sum of item prices * quantities)
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| behavior_model | JSON | Yes | From RE-001 |
| source_code | String | Yes | Code to analyze |
| domain | String | Optional | Business domain |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| business_rules | Array | Extracted rules |
| validation_rules | Array | Field validations |
| state_machine | Object | State transition rules |
| calculations | Array | Calculation formulas |

## Project-Specific Considerations
- Document currency handling and rounding rules for financial calculations
- Note timezone handling for date-based business rules
- Include localization rules if behavior varies by region
- Map to existing business rule documentation if available
- Flag rules that may need compliance review (pricing, eligibility)

## Integration Points
- **Behavior Extraction (RE-001)**: Receives conditional logic from control flow
- **AC Generation (RE-002)**: Business rules become AC scenarios
- **Boundary Input Discovery (RE-105)**: Rules inform boundary values
- **Test Design Engineer (04)**: Rules guide test case design
- **Requirements Analyst (01)**: Cross-reference with documented requirements

## Validation
- All conditionals analyzed
- Business meaning documented
- Error messages captured
- Formulas extracted
