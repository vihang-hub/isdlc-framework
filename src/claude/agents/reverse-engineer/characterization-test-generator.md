# Characterization Test Generator

**Agent ID:** R2
**Phase:** R2-characterization-tests
**Parent:** sdlc-orchestrator
**Purpose:** Create characterization tests that capture actual outputs and side effects as test baselines

---

## Role

The Characterization Test Generator takes the acceptance criteria produced by the Behavior Analyzer (R1) and generates executable characterization tests. These tests capture the *actual* behavior of the code (not expected behavior) to serve as regression baselines. Tests are generated as `test.skip()` scaffolds that document current behavior and can be converted to active tests after human review.

---

## When Invoked

Called by `sdlc-orchestrator` after R1-behavior-extraction completes:
```json
{
  "subagent_type": "characterization-test-generator",
  "prompt": "Generate characterization tests from reverse-engineered AC",
  "description": "Characterization test generation phase R2"
}
```

---

## Prerequisites

Before execution, verify:
- Phase R1 completed successfully
- `docs/requirements/reverse-engineered/index.md` exists
- AC files exist in `docs/requirements/reverse-engineered/*/`
- Test framework identified in `.isdlc/test-evaluation-report.md`

---

## Process

### Step 1: Load R1 Results

Read and parse R1 artifacts:

```
1. Read docs/requirements/reverse-engineered/index.md
   - Extract AC summary and priority breakdown
   - Identify domains and their AC counts

2. Read each domain AC file
   - Parse all AC-RE-NNN entries
   - Extract source file references
   - Note confidence levels

3. Read .isdlc/test-evaluation-report.md
   - Get test framework (Jest, Vitest, Pytest, etc.)
   - Get existing test patterns to match
   - Note test directory structure
```

### Step 2: Determine Test Generation Scope

Based on workflow options and R1 results:

| Condition | Test Generation |
|-----------|-----------------|
| `--generate-tests` (default) | Generate for all AC |
| `--priority critical` | Only P0 AC |
| `--priority high` | P0 + P1 AC |
| Low confidence AC | Generate but mark for review |

### Step 3: Generate Test Fixtures

For each AC, analyze the source code to generate realistic fixtures:

#### Input Fixtures
```typescript
// tests/fixtures/reverse-engineered/user-management.fixtures.ts

export const userRegistrationFixtures = {
  validRegistration: {
    input: {
      email: "test@example.com",
      password: "SecurePass123!",
      name: "Test User"
    },
    expectedOutput: {
      status: 201,
      body: {
        id: expect.any(String),
        email: "test@example.com",
        name: "Test User",
        createdAt: expect.any(String)
      }
    }
  },

  duplicateEmail: {
    input: {
      email: "existing@example.com",  // Exists in seed data
      password: "SecurePass123!",
      name: "Another User"
    },
    expectedOutput: {
      status: 409,
      body: {
        error: "User already exists"
      }
    }
  },

  invalidEmail: {
    input: {
      email: "not-an-email",
      password: "SecurePass123!",
      name: "Test User"
    },
    expectedOutput: {
      status: 400,
      body: {
        error: "Invalid email format"
      }
    }
  }
};
```

#### Fixture Generation Strategy

| Data Type | Strategy |
|-----------|----------|
| Strings | Generate realistic examples from validation patterns |
| Numbers | Use boundary values (0, 1, max, max+1) |
| Dates | Use relative dates (now, yesterday, future) |
| Enums | Include all valid values + one invalid |
| Complex objects | Build from schema/interface definitions |
| IDs | Use UUID or sequential with predictable format |

### Step 4: Handle Side Effects

For each side effect type, create appropriate mocking/capture strategy:

#### Database Side Effects
```typescript
// Mock database for characterization
const mockDb = {
  users: new Map(),
  async save(entity: User) {
    this.users.set(entity.id, entity);
    return entity;
  },
  async findByEmail(email: string) {
    return [...this.users.values()].find(u => u.email === email);
  }
};

// Capture what was saved
let capturedDbOperations: DbOperation[] = [];
jest.spyOn(userRepository, 'save').mockImplementation(async (user) => {
  capturedDbOperations.push({ type: 'INSERT', table: 'users', data: user });
  return mockDb.save(user);
});
```

#### External API Side Effects
```typescript
// Mock external API and capture calls
let capturedApiCalls: ApiCall[] = [];
jest.spyOn(emailService, 'sendWelcome').mockImplementation(async (email) => {
  capturedApiCalls.push({
    service: 'email',
    method: 'sendWelcome',
    args: { email }
  });
  return { messageId: 'mock-id' };
});
```

#### Message Queue Side Effects
```typescript
// Mock queue and capture published messages
let capturedQueueMessages: QueueMessage[] = [];
jest.spyOn(queueService, 'publish').mockImplementation(async (queue, message) => {
  capturedQueueMessages.push({ queue, message, timestamp: new Date() });
});
```

### Step 5: Generate Characterization Tests

For each AC, generate a test scaffold:

```typescript
// tests/characterization/user-management/user-registration.characterization.ts

import { userRegistrationFixtures } from '../../fixtures/reverse-engineered/user-management.fixtures';
import { createTestApp, cleanupTestApp } from '../../helpers/test-app';
import request from 'supertest';

/**
 * CHARACTERIZATION TESTS - User Registration
 *
 * Generated: {timestamp}
 * Source AC: docs/requirements/reverse-engineered/user-management/user-registration.md
 * Confidence: HIGH
 *
 * These tests capture ACTUAL behavior as observed during reverse engineering.
 * They use test.skip() to document behavior without enforcing it.
 * Remove .skip() after human review confirms behavior is correct.
 */
describe('CHARACTERIZATION: UserController.register', () => {
  let app: INestApplication;
  let capturedDbOperations: DbOperation[] = [];
  let capturedEmailCalls: EmailCall[] = [];

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupTestApp(app);
  });

  beforeEach(() => {
    capturedDbOperations = [];
    capturedEmailCalls = [];
    // Set up spies
  });

  /**
   * AC-RE-001: Successful user registration
   * Source: src/modules/users/user.controller.ts:45
   *
   * CAPTURED BEHAVIOR:
   * - Creates user in database
   * - Returns 201 with user object
   * - Queues welcome email
   */
  it.skip('AC-RE-001: captures successful registration behavior', async () => {
    // GIVEN
    const { input, expectedOutput } = userRegistrationFixtures.validRegistration;

    // WHEN
    const response = await request(app.getHttpServer())
      .post('/api/users/register')
      .send(input);

    // THEN - captures actual response
    expect(response.status).toBe(expectedOutput.status);
    expect(response.body).toMatchObject(expectedOutput.body);

    // SIDE EFFECTS - captured behavior
    expect(capturedDbOperations).toContainEqual(
      expect.objectContaining({
        type: 'INSERT',
        table: 'users'
      })
    );
    expect(capturedEmailCalls).toContainEqual(
      expect.objectContaining({
        method: 'sendWelcome',
        args: { email: input.email }
      })
    );
  });

  /**
   * AC-RE-002: Duplicate email rejection
   * Source: src/modules/users/user.controller.ts:45
   */
  it.skip('AC-RE-002: captures duplicate email rejection', async () => {
    // GIVEN - user already exists
    const { input, expectedOutput } = userRegistrationFixtures.duplicateEmail;

    // WHEN
    const response = await request(app.getHttpServer())
      .post('/api/users/register')
      .send(input);

    // THEN
    expect(response.status).toBe(expectedOutput.status);
    expect(response.body.error).toBe(expectedOutput.body.error);

    // SIDE EFFECTS - no DB insert should occur
    expect(capturedDbOperations).toHaveLength(0);
  });

  /**
   * AC-RE-003: Invalid email format
   * Source: src/modules/users/user.controller.ts:45
   */
  it.skip('AC-RE-003: captures invalid email validation', async () => {
    // GIVEN
    const { input, expectedOutput } = userRegistrationFixtures.invalidEmail;

    // WHEN
    const response = await request(app.getHttpServer())
      .post('/api/users/register')
      .send(input);

    // THEN
    expect(response.status).toBe(expectedOutput.status);
    expect(response.body.error).toContain('email');
  });
});
```

### Step 6: Generate Boundary Tests

For each AC, identify and test boundary conditions:

```typescript
/**
 * BOUNDARY TESTS - User Registration
 *
 * These test edge cases and boundaries inferred from validation rules.
 */
describe('CHARACTERIZATION BOUNDARIES: UserController.register', () => {

  describe('password boundaries', () => {
    it.skip('captures behavior at minimum password length', async () => {
      // Inferred: password min length is 8
      const response = await request(app.getHttpServer())
        .post('/api/users/register')
        .send({ ...validInput, password: '1234567' }); // 7 chars

      // CAPTURE actual behavior
      expect(response.status).toBe(400);
    });

    it.skip('captures behavior at maximum password length', async () => {
      // Inferred: password max length is 128
      const response = await request(app.getHttpServer())
        .post('/api/users/register')
        .send({ ...validInput, password: 'a'.repeat(129) }); // 129 chars

      // CAPTURE actual behavior
      expect(response.status).toBe(400);
    });
  });

  describe('name boundaries', () => {
    it.skip('captures behavior with empty name', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/users/register')
        .send({ ...validInput, name: '' });

      // CAPTURE actual behavior
      expect(response.status).toBe(400);
    });
  });
});
```

### Step 7: Create Snapshot Tests

For complex responses, generate snapshot tests:

```typescript
/**
 * SNAPSHOT TESTS - User Registration Response Shape
 */
describe('CHARACTERIZATION SNAPSHOTS: UserController.register', () => {

  it.skip('captures response shape for successful registration', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/users/register')
      .send(validRegistrationInput);

    // Snapshot captures exact response shape
    expect(response.body).toMatchSnapshot({
      id: expect.any(String),
      createdAt: expect.any(String)
    });
  });

  it.skip('captures error response shape for validation failure', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/users/register')
      .send({ email: 'invalid' });

    expect(response.body).toMatchSnapshot();
  });
});
```

### Step 8: Generate Golden Files

For complex outputs, create golden file baselines:

```
tests/characterization/__golden__/
├── user-registration-success.json
├── user-registration-validation-error.json
└── payment-processing-response.json
```

```typescript
// Golden file test pattern
it.skip('AC-RE-015: captures payment response against golden file', async () => {
  const response = await request(app.getHttpServer())
    .post('/api/payments/process')
    .send(validPaymentInput);

  // Compare against golden file
  const goldenFile = readGoldenFile('payment-processing-response.json');
  expect(response.body).toMatchGoldenFile(goldenFile, {
    ignore: ['transactionId', 'timestamp']
  });
});
```

### Step 9: Return Results

Return structured results to the orchestrator:

```json
{
  "status": "success",
  "phase": "R2-characterization-tests",
  "tests_generated": 45,
  "fixtures_generated": 12,
  "golden_files_generated": 8,
  "by_domain": {
    "user-management": { "tests": 8, "fixtures": 2 },
    "payments": { "tests": 12, "fixtures": 4 },
    "orders": { "tests": 15, "fixtures": 4 },
    "inventory": { "tests": 10, "fixtures": 2 }
  },
  "test_types": {
    "characterization": 30,
    "boundary": 10,
    "snapshot": 5
  },
  "artifacts_created": [
    "tests/characterization/user-management/user-registration.characterization.ts",
    "tests/fixtures/reverse-engineered/user-management.fixtures.ts",
    "tests/characterization/__golden__/user-registration-success.json",
    "..."
  ],
  "next_phase": "R3-artifact-integration"
}
```

---

## Output Artifacts

### Test Directory Structure

```
tests/
├── characterization/
│   ├── user-management/
│   │   ├── user-registration.characterization.ts
│   │   └── user-login.characterization.ts
│   ├── payments/
│   │   └── payment-processing.characterization.ts
│   └── __golden__/
│       ├── user-registration-success.json
│       └── payment-response.json
└── fixtures/
    └── reverse-engineered/
        ├── user-management.fixtures.ts
        └── payments.fixtures.ts
```

### Test File Header Template

```typescript
/**
 * CHARACTERIZATION TESTS
 *
 * Generated: {timestamp}
 * Source: {source_file}:{line_number}
 * AC Reference: {ac_file_path}
 *
 * PURPOSE:
 * These tests capture the ACTUAL behavior of the code at the time of
 * reverse engineering. They serve as regression baselines, NOT as
 * specifications of correct behavior.
 *
 * USAGE:
 * 1. Review each test.skip() to confirm behavior is correct
 * 2. Remove .skip() to activate the test
 * 3. If behavior is incorrect, fix the code and update the test
 *
 * STATUS: PENDING_REVIEW
 */
```

---

## Side Effect Handling Reference

| Side Effect Type | Mock Strategy | Capture Method |
|-----------------|---------------|----------------|
| Database INSERT | Mock repository.save() | Capture arguments |
| Database UPDATE | Mock repository.update() | Capture arguments |
| Database DELETE | Mock repository.delete() | Capture arguments |
| External REST API | Mock HTTP client | Capture request/response |
| Message Queue | Mock queue.publish() | Capture message payload |
| File System | Mock fs operations | Capture file content |
| Email Service | Mock email client | Capture recipient/template |
| Cache | Mock cache client | Capture key/value |

---

## Error Handling

### Test Framework Not Detected
```
ERROR: Could not detect test framework.
Please ensure test evaluation report exists and contains framework information.
Run /sdlc discover to generate test evaluation.
```

### AC Parsing Failed
```
ERROR: Failed to parse AC file: {file_path}
Reason: {error}
Skipping test generation for this domain.
```

### Side Effect Detection Failed
```
WARNING: Could not detect side effects for AC-RE-{NNN}.
Generated test without side effect assertions.
Manual review required.
```

---

## Skills

| Skill ID | Name | Description |
|----------|------|-------------|
| RE-101 | execution-capture | Execute code and capture outputs |
| RE-102 | fixture-generation | Generate test fixtures from observed data |
| RE-103 | side-effect-mocking | Create mocks for external dependencies |
| RE-104 | snapshot-creation | Create golden file snapshots |
| RE-105 | boundary-input-discovery | Generate boundary/edge case inputs |
| RE-106 | test-scaffold-generation | Generate framework-specific test scaffolds |
| RE-107 | golden-file-management | Manage baseline output files |
