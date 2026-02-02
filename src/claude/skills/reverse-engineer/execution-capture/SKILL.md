---
name: execution-capture
description: Execute code and capture actual outputs for characterization tests
skill_id: RE-101
owner: characterization-test-generator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Capturing actual behavior outputs for baseline tests
dependencies: [RE-001, RE-002]
---

# Execution Capture

## Purpose
Execute code paths with controlled inputs and capture the actual outputs, response shapes, and side effects. This forms the baseline for characterization tests that document current behavior rather than expected behavior.

## When to Use
- Creating characterization test baselines
- Documenting actual API responses
- Capturing current behavior before refactoring
- Building regression test fixtures

## Prerequisites
- Behavior model from RE-001
- AC from RE-002
- Test environment available
- Dependencies mockable

## Process

### Step 1: Prepare Test Environment
```
Setup:
1. Initialize test database with seed data
2. Configure mock external services
3. Set up request/response capture
4. Initialize side effect tracking
```

### Step 2: Execute Code Path
```
For API endpoints:
1. Build request from AC inputs
2. Execute HTTP request
3. Capture response status, headers, body
4. Capture timing information

For functions:
1. Prepare input parameters
2. Execute function
3. Capture return value
4. Capture thrown exceptions
```

### Step 3: Capture Response Data
```
Capture for each execution:
- HTTP status code
- Response body (JSON/text)
- Response headers
- Response time
- Error messages (if any)
```

### Step 4: Capture Side Effects
```
Track:
- Database queries executed
- External API calls made
- Messages published to queues
- Events emitted
- Files written
- Cache operations
```

### Step 5: Document Captured Behavior
```
Output:
{
  "execution_id": "exec-001",
  "source_ac": "AC-RE-001",
  "input": { ... },
  "output": {
    "status": 201,
    "body": { ... },
    "headers": { ... }
  },
  "side_effects": [ ... ],
  "timing_ms": 45
}
```

## Execution Patterns

### REST API Execution
```typescript
// Setup
const app = await createTestApp();
const capturedSideEffects: SideEffect[] = [];

// Mock and capture database operations
jest.spyOn(userRepository, 'save').mockImplementation(async (user) => {
  capturedSideEffects.push({
    type: 'database',
    operation: 'INSERT',
    table: 'users',
    data: user
  });
  return { ...user, id: 'generated-id' };
});

// Execute
const response = await request(app.getHttpServer())
  .post('/api/users/register')
  .send({
    email: 'test@example.com',
    password: 'SecurePass123!',
    name: 'Test User'
  });

// Capture
const captured = {
  input: { email: 'test@example.com', ... },
  output: {
    status: response.status,       // 201
    body: response.body,           // { id, email, name, createdAt }
    headers: response.headers
  },
  side_effects: capturedSideEffects // [{ type: 'database', ... }]
};
```

### Function Execution
```typescript
// Setup
const mockDeps = {
  emailService: { send: jest.fn() },
  repository: { save: jest.fn().mockResolvedValue({ id: '123' }) }
};

const service = new UserService(mockDeps);

// Execute
const result = await service.register({
  email: 'test@example.com',
  password: 'password123'
});

// Capture
const captured = {
  input: { email: 'test@example.com', password: 'password123' },
  output: result,
  side_effects: [
    { type: 'database', call: mockDeps.repository.save.mock.calls[0] },
    { type: 'email', call: mockDeps.emailService.send.mock.calls[0] }
  ]
};
```

### Error Path Execution
```typescript
// Execute error path
const response = await request(app.getHttpServer())
  .post('/api/users/register')
  .send({
    email: 'existing@example.com', // Already exists
    password: 'SecurePass123!'
  });

// Capture error behavior
const captured = {
  input: { email: 'existing@example.com', ... },
  output: {
    status: response.status,       // 409
    body: response.body,           // { error: 'User already exists' }
  },
  error_type: 'ConflictError',
  side_effects: []  // No side effects on error
};
```

## Capture Format

### Successful Response Capture
```json
{
  "execution": {
    "id": "exec-001",
    "timestamp": "2026-02-02T10:00:00Z",
    "source_ac": "AC-RE-001",
    "confidence": "captured"
  },
  "request": {
    "method": "POST",
    "path": "/api/users/register",
    "body": {
      "email": "test@example.com",
      "password": "SecurePass123!",
      "name": "Test User"
    }
  },
  "response": {
    "status": 201,
    "body": {
      "id": "usr-abc123",
      "email": "test@example.com",
      "name": "Test User",
      "createdAt": "2026-02-02T10:00:00Z"
    },
    "headers": {
      "content-type": "application/json"
    }
  },
  "side_effects": [
    {
      "type": "database",
      "operation": "INSERT",
      "table": "users",
      "data": {
        "email": "test@example.com",
        "passwordHash": "[hashed]",
        "name": "Test User"
      }
    },
    {
      "type": "queue",
      "name": "email",
      "job": "send-welcome",
      "data": {
        "userId": "usr-abc123",
        "email": "test@example.com"
      }
    }
  ],
  "timing_ms": 45
}
```

### Error Response Capture
```json
{
  "execution": {
    "id": "exec-002",
    "timestamp": "2026-02-02T10:01:00Z",
    "source_ac": "AC-RE-002",
    "confidence": "captured"
  },
  "request": {
    "method": "POST",
    "path": "/api/users/register",
    "body": {
      "email": "invalid-email",
      "password": "123"
    }
  },
  "response": {
    "status": 400,
    "body": {
      "errors": [
        { "field": "email", "message": "Invalid email format" },
        { "field": "password", "message": "Password too short" }
      ]
    }
  },
  "side_effects": [],
  "timing_ms": 12
}
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| acceptance_criteria | Markdown | Yes | AC to test |
| test_inputs | JSON | Yes | Input values |
| mock_config | JSON | Optional | Mock setup |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| captured_execution | JSON | Full execution capture |
| response_snapshot | JSON | Response data |
| side_effect_log | Array | Tracked side effects |

## Project-Specific Considerations
- Configure test database with realistic seed data
- Handle authentication tokens for protected endpoints
- Set up appropriate mock servers for external APIs
- Account for rate limiting and retry logic
- Document environment variables needed for execution

## Integration Points
- **AC Generation (RE-002)**: Executes paths defined in AC
- **Side Effect Mocking (RE-103)**: Uses mock configuration
- **Fixture Generation (RE-102)**: Captured data seeds fixtures
- **Snapshot Creation (RE-104)**: Captured responses become snapshots
- **Test Evaluator (D2)**: Validates against existing test patterns

## Validation
- All inputs executed
- Outputs fully captured
- Side effects tracked
- Errors documented
