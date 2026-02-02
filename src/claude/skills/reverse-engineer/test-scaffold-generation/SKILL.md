---
name: test-scaffold-generation
description: Generate framework-specific test scaffolds with test.skip()
skill_id: RE-106
owner: characterization-test-generator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Creating test file structure with pending characterization tests
dependencies: [RE-002, RE-102]
---

# Test Scaffold Generation

## Purpose
Generate complete test file scaffolds using the appropriate test framework syntax. Tests are created as `test.skip()` / `it.skip()` to document captured behavior without immediately enforcing it, allowing human review before activation.

## When to Use
- Creating characterization test files
- Setting up test structure from AC
- Preparing tests for human review
- Establishing test baselines

## Prerequisites
- AC from RE-002
- Fixtures from RE-102
- Test framework identified (Jest, Vitest, Pytest, etc.)

## Process

### Step 1: Identify Test Framework
```
Detect from:
- package.json (jest, vitest, mocha)
- pytest.ini or pyproject.toml
- Test file patterns (*.spec.ts, *_test.py)
- Existing test files

Supported:
- Jest (Node.js)
- Vitest (Node.js)
- Pytest (Python)
- Mocha (Node.js)
- Go testing
```

### Step 2: Generate Test File Structure
```
Structure:
- File header with metadata
- Import statements
- Setup/teardown blocks
- Describe blocks by feature
- Individual test cases
```

### Step 3: Create Test Cases
```
For each AC:
- Create it.skip() test case
- Include AC reference in comment
- Add GIVEN/WHEN/THEN comments
- Include fixture references
- Add side effect assertions
```

### Step 4: Add Helper Code
```
Include:
- App factory/setup
- Mock configuration
- Assertion helpers
- Cleanup utilities
```

## Framework-Specific Scaffolds

### Jest / Vitest (TypeScript)
```typescript
/**
 * CHARACTERIZATION TESTS - User Registration
 *
 * Generated: 2026-02-02T10:00:00Z
 * Source AC: docs/requirements/reverse-engineered/user-management/user-registration.md
 *
 * PURPOSE:
 * These tests capture the ACTUAL behavior of the code at the time of
 * reverse engineering. They serve as regression baselines, NOT as
 * specifications of correct behavior.
 *
 * REVIEW INSTRUCTIONS:
 * 1. Run each test.skip() to verify it captures current behavior
 * 2. Review if the captured behavior is correct
 * 3. Remove .skip() to activate approved tests
 * 4. If behavior is incorrect, fix code and update test
 *
 * STATUS: PENDING_HUMAN_REVIEW
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp, cleanupTestApp } from '@test/helpers/test-app';
import { createMockContainer, resetAllMocks } from '@test/helpers/mock-setup';
import { userRegistrationFixtures } from '@test/fixtures/reverse-engineered/user-management.fixtures';
import type { INestApplication } from '@nestjs/common';
import type { MockContainer } from '@test/helpers/mock-setup';

describe('CHARACTERIZATION: UserController.register', () => {
  let app: INestApplication;
  let mocks: MockContainer;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupTestApp(app);
  });

  beforeEach(() => {
    mocks = createMockContainer();
    resetAllMocks(mocks);
  });

  /**
   * AC-RE-001: Successful user registration
   * Source: src/modules/users/user.controller.ts:45
   * Confidence: HIGH
   *
   * CAPTURED BEHAVIOR:
   * - Creates user in database
   * - Returns 201 with user object (id, email, name, createdAt)
   * - Queues welcome email
   */
  it.skip('AC-RE-001: captures successful registration behavior', async () => {
    // GIVEN
    const { input, expectedOutput } = userRegistrationFixtures.validRegistration;

    // WHEN
    const response = await request(app.getHttpServer())
      .post('/api/users/register')
      .send(input);

    // THEN - Response
    expect(response.status).toBe(expectedOutput.status);
    expect(response.body).toMatchObject(expectedOutput.body);

    // THEN - Side effects
    expect(mocks.userRepository._captured).toContainEqual(
      expect.objectContaining({
        operation: 'INSERT',
        table: 'users'
      })
    );

    expect(mocks.queues.email._captured).toContainEqual(
      expect.objectContaining({
        job: 'send-welcome',
        data: expect.objectContaining({ email: input.email })
      })
    );
  });

  /**
   * AC-RE-002: Duplicate email rejection
   * Source: src/modules/users/user.controller.ts:45
   * Confidence: HIGH
   */
  it.skip('AC-RE-002: captures duplicate email rejection', async () => {
    // GIVEN - User already exists
    const { input, expectedOutput } = userRegistrationFixtures.duplicateEmail;

    // WHEN
    const response = await request(app.getHttpServer())
      .post('/api/users/register')
      .send(input);

    // THEN
    expect(response.status).toBe(expectedOutput.status);
    expect(response.body).toMatchObject(expectedOutput.body);

    // THEN - No side effects on error
    expect(mocks.userRepository._captured).toHaveLength(0);
  });

  /**
   * AC-RE-003: Invalid email validation
   * Source: src/modules/users/user.controller.ts:45
   * Confidence: HIGH
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
    expect(response.body.errors).toContainEqual(
      expect.objectContaining({ field: 'email' })
    );
  });
});
```

### Pytest (Python)
```python
"""
CHARACTERIZATION TESTS - User Registration

Generated: 2026-02-02T10:00:00Z
Source AC: docs/requirements/reverse-engineered/user-management/user-registration.md

PURPOSE:
These tests capture the ACTUAL behavior of the code at the time of
reverse engineering. They serve as regression baselines, NOT as
specifications of correct behavior.

STATUS: PENDING_HUMAN_REVIEW
"""

import pytest
from unittest.mock import MagicMock, patch
from app import create_app
from tests.fixtures.user_management import (
    valid_registration_input,
    valid_registration_output,
    duplicate_email_input,
)


@pytest.fixture
def app():
    """Create test application."""
    app = create_app(testing=True)
    yield app


@pytest.fixture
def client(app):
    """Create test client."""
    return app.test_client()


@pytest.fixture
def mock_user_repository():
    """Mock user repository with capture."""
    captured = []
    mock = MagicMock()

    def capture_save(user):
        captured.append({'operation': 'INSERT', 'data': user})
        return {**user, 'id': 'generated-id'}

    mock.save.side_effect = capture_save
    mock._captured = captured
    return mock


class TestCharacterizationUserRegistration:
    """
    CHARACTERIZATION: UserController.register

    Run with: pytest -k "characterization" --runxfail
    """

    @pytest.mark.skip(reason="CHARACTERIZATION: Pending human review")
    def test_ac_re_001_successful_registration(
        self, client, mock_user_repository
    ):
        """
        AC-RE-001: Successful user registration
        Source: app/controllers/user_controller.py:45
        Confidence: HIGH
        """
        # GIVEN
        input_data = valid_registration_input()

        # WHEN
        with patch('app.repositories.user_repository', mock_user_repository):
            response = client.post('/api/users/register', json=input_data)

        # THEN - Response
        assert response.status_code == 201
        data = response.get_json()
        assert 'id' in data
        assert data['email'] == input_data['email']

        # THEN - Side effects
        assert len(mock_user_repository._captured) == 1
        assert mock_user_repository._captured[0]['operation'] == 'INSERT'

    @pytest.mark.skip(reason="CHARACTERIZATION: Pending human review")
    def test_ac_re_002_duplicate_email(self, client, mock_user_repository):
        """
        AC-RE-002: Duplicate email rejection
        Source: app/controllers/user_controller.py:45
        Confidence: HIGH
        """
        # GIVEN - User exists
        input_data = duplicate_email_input()

        # WHEN
        response = client.post('/api/users/register', json=input_data)

        # THEN
        assert response.status_code == 409
        assert response.get_json()['error'] == 'User already exists'
```

### Go Testing
```go
// characterization_test.go
package users_test

import (
    "bytes"
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"

    "example.com/app/users"
)

/*
CHARACTERIZATION TESTS - User Registration

Generated: 2026-02-02T10:00:00Z
Source AC: docs/requirements/reverse-engineered/user-management/user-registration.md

STATUS: PENDING_HUMAN_REVIEW
*/

func TestCharacterization_UserRegistration_Success(t *testing.T) {
    // SKIP: Characterization test pending human review
    t.Skip("CHARACTERIZATION: Pending human review - AC-RE-001")

    // GIVEN
    input := users.CreateUserInput{
        Email:    "test@example.com",
        Password: "SecurePass123!",
        Name:     "Test User",
    }
    body, _ := json.Marshal(input)

    // WHEN
    req := httptest.NewRequest("POST", "/api/users/register", bytes.NewReader(body))
    req.Header.Set("Content-Type", "application/json")
    w := httptest.NewRecorder()
    handler.ServeHTTP(w, req)

    // THEN
    if w.Code != http.StatusCreated {
        t.Errorf("expected status 201, got %d", w.Code)
    }

    var response users.UserResponse
    json.NewDecoder(w.Body).Decode(&response)

    if response.Email != input.Email {
        t.Errorf("expected email %s, got %s", input.Email, response.Email)
    }
}
```

## Scaffold File Structure

```
tests/characterization/
├── {domain}/
│   ├── {feature}.characterization.ts   # Jest/Vitest
│   ├── test_{feature}.py               # Pytest
│   └── {feature}_test.go               # Go
└── helpers/
    ├── test-app.ts
    ├── mock-setup.ts
    └── assertions.ts
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| acceptance_criteria | Array | Yes | AC to generate tests for |
| fixtures | Object | Yes | From RE-102 |
| framework | String | Yes | Test framework name |
| domain | String | Yes | Business domain |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| test_file | File | Complete test scaffold |
| helper_files | Array | Supporting test utilities |
| fixture_imports | Array | Required fixture imports |

## Project-Specific Considerations
- Match existing test file naming conventions (*.spec.ts, *.test.ts, test_*.py)
- Follow project's describe/it nesting patterns
- Use project's preferred assertion style (expect vs assert)
- Include existing test utilities and helpers
- Align with CI/CD test runner configuration

## Integration Points
- **AC Generation (RE-002)**: AC becomes test case documentation
- **Fixture Generation (RE-102)**: Imports generated fixtures
- **Side Effect Mocking (RE-103)**: Imports mock setup
- **Snapshot Creation (RE-104)**: Includes snapshot assertions
- **Test Evaluator (D2)**: Follows detected test patterns
- **Software Developer (05)**: Aligns with existing test structure

## Validation
- Framework syntax correct
- All AC have test cases
- Skip markers present
- Documentation complete
