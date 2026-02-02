---
name: precondition-inference
description: Identify required preconditions from guards, validation, and context
skill_id: RE-003
owner: behavior-analyzer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Determining Given clauses for acceptance criteria
dependencies: [RE-001]
---

# Precondition Inference

## Purpose
Analyze code to identify all preconditions required for a behavior to execute successfully. These preconditions become the "Given" clauses in acceptance criteria and inform test setup requirements.

## When to Use
- Generating Given clauses for AC
- Understanding test setup requirements
- Identifying dependencies and state
- Documenting implicit requirements

## Prerequisites
- Behavior model from RE-001
- Access to source code
- Guards and middleware identified

## Process

### Step 1: Identify Authentication Requirements
```
Scan for:
- Auth decorators: @UseGuards(), @Authenticate, @Public
- Middleware: authMiddleware, requireAuth
- Session checks: req.user, currentUser, isAuthenticated()
- Token validation: jwt.verify, passport

Extract:
- "user is authenticated"
- "user has role 'admin'"
- "user owns resource"
- "valid API key provided"
```

### Step 2: Identify Authorization Requirements
```
Scan for:
- Permission checks: hasPermission(), can(), ability.can()
- Role guards: @Roles('admin'), role_required()
- Resource ownership: user.id === resource.ownerId
- RBAC/ABAC policies

Extract:
- "user has permission 'orders:create'"
- "user is owner of the resource"
- "user belongs to organization"
```

### Step 3: Identify Input Validation Preconditions
```
Scan for:
- Validation decorators: @IsEmail(), @MinLength(), @NotEmpty()
- Schema validation: Joi, Zod, class-validator
- Guard clauses: if (!email) throw, assert(email)
- Type constraints: string, number, array length

Extract:
- "email is valid format"
- "password meets complexity requirements"
- "items array is not empty"
- "quantity is positive integer"
```

### Step 4: Identify State Preconditions
```
Scan for:
- Database lookups: findOne, exists, count
- State checks: order.status === 'pending'
- Feature flags: isFeatureEnabled('x')
- Configuration: config.get('limit')

Extract:
- "user with email does not exist"
- "order status is 'pending'"
- "feature 'bulk_upload' is enabled"
- "inventory has sufficient stock"
```

### Step 5: Identify External Preconditions
```
Scan for:
- External service availability
- Rate limiting checks
- Circuit breaker state
- Third-party API requirements

Extract:
- "payment gateway is available"
- "rate limit not exceeded"
- "external inventory service responds"
```

### Step 6: Identify Temporal Preconditions
```
Scan for:
- Date/time comparisons
- Expiration checks
- Scheduling constraints
- Business hours logic

Extract:
- "current time is within business hours"
- "offer has not expired"
- "within 30 days of purchase"
```

## Precondition Patterns by Framework

### NestJS Guards
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Post('users')
createUser() { ... }

// Preconditions:
// - User is authenticated (JWT valid)
// - User has 'admin' role
```

### Express Middleware
```typescript
router.post('/orders',
  authenticate,
  checkPermission('orders:create'),
  validateBody(OrderSchema),
  createOrder
);

// Preconditions:
// - User is authenticated
// - User has 'orders:create' permission
// - Request body matches OrderSchema
```

### FastAPI Dependencies
```python
@app.post("/items")
async def create_item(
    item: ItemCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    ...

# Preconditions:
# - User is authenticated and active
# - Database connection available
# - Item data is valid
```

### Django Decorators
```python
@login_required
@permission_required('products.add_product')
def create_product(request):
    ...

# Preconditions:
# - User is logged in
# - User has 'products.add_product' permission
```

## Implicit Preconditions

Some preconditions are implicit and must be inferred:

| Code Pattern | Implicit Precondition |
|--------------|----------------------|
| `user.orders` | User exists |
| `product.stock - quantity` | Product exists, has stock |
| `order.total * discount` | Order has items |
| `file.upload()` | File is valid |

## Precondition Categories

| Category | Examples | Given Clause Template |
|----------|----------|----------------------|
| Authentication | Login, session, token | "user is authenticated" |
| Authorization | Roles, permissions | "user has permission X" |
| Input validity | Format, constraints | "input X is valid" |
| Entity state | Exists, status | "entity X exists with status Y" |
| System state | Config, features | "feature X is enabled" |
| External deps | Services, APIs | "service X is available" |

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| behavior_model | JSON | Yes | From RE-001 |
| source_code | String | Yes | Code to analyze |
| framework | String | Optional | Framework name |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| preconditions | Array | List of Given clauses |
| auth_requirements | Object | Auth/authz details |
| state_requirements | Array | Required entity states |

## Project-Specific Considerations
- Map custom auth decorators/middleware to standard patterns
- Include tenant/organization isolation for multi-tenant apps
- Document feature flag dependencies as preconditions
- Note environment-specific preconditions (dev vs prod behavior)
- Handle custom validation frameworks beyond standard decorators

## Integration Points
- **Behavior Extraction (RE-001)**: Receives guard/middleware chain information
- **AC Generation (RE-002)**: Provides Given clauses for AC
- **Fixture Generation (RE-102)**: Preconditions inform test setup requirements
- **Security Auditor (08)**: Auth requirements feed security review

## Validation
- All guards and middleware captured
- Validation rules documented
- State dependencies identified
- Implicit preconditions noted
