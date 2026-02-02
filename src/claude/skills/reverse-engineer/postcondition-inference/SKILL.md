---
name: postcondition-inference
description: Identify expected outcomes from return statements and mutations
skill_id: RE-004
owner: behavior-analyzer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Determining Then clauses for acceptance criteria
dependencies: [RE-001]
---

# Postcondition Inference

## Purpose
Analyze code to identify all expected outcomes and postconditions that result from a behavior executing. These postconditions become the "Then" clauses in acceptance criteria and define what characterization tests should assert.

## When to Use
- Generating Then clauses for AC
- Defining test assertions
- Understanding behavior outcomes
- Documenting expected results

## Prerequisites
- Behavior model from RE-001
- Access to source code
- Return types and side effects identified

## Process

### Step 1: Identify Return Values
```
Scan for:
- Return statements
- Response objects (res.json, Response)
- Thrown exceptions
- Generator yields

Extract:
- "returns user object with id, email, name"
- "returns 201 status code"
- "throws NotFoundException"
- "returns paginated list with total count"
```

### Step 2: Identify Response Shaping
```
Scan for:
- DTOs and response classes
- Serialization decorators
- Transform pipes
- Response interceptors

Extract:
- "response excludes password field"
- "dates are ISO 8601 format"
- "includes pagination metadata"
- "wraps in { data, meta } envelope"
```

### Step 3: Identify State Mutations
```
Scan for:
- Database saves: save(), insert(), update()
- State updates: setState, store.commit
- Cache operations: set, invalidate
- Entity modifications

Extract:
- "user is saved to database"
- "order status changes to 'confirmed'"
- "cache key 'user:123' is invalidated"
- "counter is incremented"
```

### Step 4: Identify Events/Messages
```
Scan for:
- Event emitters: emit(), publish()
- Message queues: send(), dispatch()
- Webhooks: axios.post to webhook URL
- Notifications: notify(), alert()

Extract:
- "UserCreated event is emitted"
- "message published to orders.completed queue"
- "webhook called with order data"
- "admin notification sent"
```

### Step 5: Identify Logging/Audit
```
Scan for:
- Logger calls: log(), info(), audit()
- Audit trail records
- Analytics events
- Metrics updates

Extract:
- "action logged with user ID and timestamp"
- "audit record created"
- "page_view event tracked"
```

### Step 6: Identify Error Responses
```
Scan for:
- Throw statements
- Error responses
- Validation failures
- Business rule violations

Extract:
- "returns 400 with validation errors"
- "returns 404 if user not found"
- "returns 409 for duplicate email"
- "returns 403 if not authorized"
```

## Postcondition Patterns by Type

### API Response Postconditions
```typescript
// Code:
return res.status(201).json({
  id: user.id,
  email: user.email,
  createdAt: user.createdAt
});

// Postconditions:
// - response status is 201
// - response body contains id, email, createdAt
// - password is NOT in response
```

### Database Mutation Postconditions
```typescript
// Code:
const order = await this.orderRepo.save({
  userId: user.id,
  items: dto.items,
  status: OrderStatus.PENDING
});

// Postconditions:
// - order is saved in orders table
// - order has userId set
// - order status is PENDING
// - order has generated ID
```

### Event Emission Postconditions
```typescript
// Code:
this.eventEmitter.emit('order.created', {
  orderId: order.id,
  userId: order.userId,
  total: order.total
});

// Postconditions:
// - 'order.created' event is emitted
// - event payload includes orderId, userId, total
```

### State Transition Postconditions
```typescript
// Code:
order.status = OrderStatus.CONFIRMED;
order.confirmedAt = new Date();
await this.orderRepo.save(order);

// Postconditions:
// - order status changed from PENDING to CONFIRMED
// - confirmedAt timestamp is set
// - changes persisted to database
```

## Response Shape Analysis

### Typed Responses
```typescript
// DTO definition
class UserResponseDto {
  @Expose() id: string;
  @Expose() email: string;
  @Expose() name: string;
  @Exclude() password: string;
  @Transform(({ value }) => value.toISOString())
  createdAt: Date;
}

// Inferred response shape:
// { id: string, email: string, name: string, createdAt: ISO8601 }
// password excluded
```

### Dynamic Responses
```typescript
// Code with conditional fields
return {
  ...user,
  ...(includeOrders && { orders: user.orders }),
  ...(isAdmin && { adminNotes: user.adminNotes })
};

// Postconditions:
// - base user fields always present
// - orders included when includeOrders flag set
// - adminNotes included for admin users
```

## Error Postconditions

| Error Type | HTTP Status | Then Clause |
|------------|-------------|-------------|
| ValidationError | 400 | "returns 400 with field errors" |
| NotFoundError | 404 | "returns 404 not found" |
| ConflictError | 409 | "returns 409 conflict" |
| UnauthorizedError | 401 | "returns 401 unauthorized" |
| ForbiddenError | 403 | "returns 403 forbidden" |
| InternalError | 500 | "returns 500 server error" |

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| behavior_model | JSON | Yes | From RE-001 |
| source_code | String | Yes | Code to analyze |
| return_types | Object | Optional | Type definitions |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| postconditions | Array | List of Then clauses |
| response_shape | Object | Expected response structure |
| mutations | Array | Database/state changes |
| events | Array | Emitted events/messages |

## Project-Specific Considerations
- Handle custom response wrappers and envelope patterns
- Document pagination metadata in list responses
- Note HATEOAS links if API follows REST maturity level 3
- Include rate limit headers in response documentation
- Account for content negotiation (JSON vs XML responses)

## Integration Points
- **Behavior Extraction (RE-001)**: Receives return type information
- **AC Generation (RE-002)**: Provides Then clauses for AC
- **Side Effect Detection (RE-005)**: Shares mutation analysis
- **Fixture Generation (RE-102)**: Response shapes inform expected outputs
- **Snapshot Creation (RE-104)**: Response shapes guide snapshot structure

## Validation
- All return paths documented
- Response shape fully captured
- Side effects identified
- Error cases covered
