---
name: atdd-fixture-generation
description: Generate test data factories and fixtures for ATDD acceptance tests
skill_id: TEST-015
owner: test-design-engineer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: ATDD mode - when creating test data for acceptance test scenarios
dependencies: [TEST-014, TEST-003]
---

# ATDD Fixture Generation

## Purpose
Generate comprehensive test data factories and fixtures that support acceptance test scenarios, including valid, invalid, and boundary case data.

## When to Use
- ATDD mode is active
- After scenario mapping is complete (TEST-014)
- Before implementation begins
- When test scenarios require specific data states

## Prerequisites
- Acceptance criteria mapped to test scenarios
- Data models/schemas understood
- Domain constraints identified

## Process

### Step 1: Analyze Data Requirements

For each acceptance criterion, identify required data:

```markdown
### AC1: Successful order submission
**Given** a customer with items in their cart ← Customer, Cart, CartItems
**And** valid payment method on file ← PaymentMethod
**When** they click "Place Order"
**Then** the order is created ← Order (expected output)
```

### Step 2: Define Fixture Categories

Create fixtures for each data category:

| Category | Purpose | Examples |
|----------|---------|----------|
| **Valid** | Happy path scenarios | Complete user, valid payment |
| **Invalid** | Negative test cases | Expired card, malformed email |
| **Boundary** | Edge cases | Max length, min values |
| **Null/Empty** | Missing data | Null fields, empty arrays |
| **Special** | Character handling | Unicode, special chars |

### Step 3: Create Factory Functions

```typescript
// tests/fixtures/user.fixtures.ts

import { faker } from '@faker-js/faker';

export const userFixtures = {
  // Valid user - happy path
  validUser: () => ({
    id: faker.string.uuid(),
    email: faker.internet.email(),
    password: 'SecurePass123!',
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    createdAt: faker.date.past()
  }),

  // Invalid email format
  invalidEmailUser: () => ({
    ...userFixtures.validUser(),
    email: 'not-an-email'
  }),

  // Boundary: maximum length fields
  maxLengthUser: () => ({
    ...userFixtures.validUser(),
    firstName: 'A'.repeat(255),
    lastName: 'B'.repeat(255),
    email: `${'x'.repeat(64)}@${'y'.repeat(185)}.com`
  }),

  // Special characters
  specialCharsUser: () => ({
    ...userFixtures.validUser(),
    firstName: "O'Brien-Smith",
    lastName: "Müller"
  }),

  // Unregistered user (for login failure tests)
  unregisteredUser: () => ({
    email: 'notfound@example.com',
    password: 'anypassword'
  })
};

// Factory function for custom overrides
export function createUser(overrides = {}) {
  return {
    ...userFixtures.validUser(),
    ...overrides
  };
}
```

### Step 4: Create Domain-Specific Fixtures

```typescript
// tests/fixtures/order.fixtures.ts

export const orderFixtures = {
  // Cart with items
  cartWithItems: () => ({
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    items: [
      {
        productId: faker.string.uuid(),
        name: faker.commerce.productName(),
        quantity: 2,
        price: parseFloat(faker.commerce.price())
      }
    ],
    subtotal: 59.98,
    tax: 5.40,
    total: 65.38
  }),

  // Empty cart (for validation tests)
  emptyCart: () => ({
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    items: [],
    subtotal: 0,
    tax: 0,
    total: 0
  }),

  // Valid payment method
  validPaymentMethod: () => ({
    id: faker.string.uuid(),
    type: 'credit_card',
    last4: '4242',
    expiryMonth: 12,
    expiryYear: new Date().getFullYear() + 2,
    isDefault: true
  }),

  // Expired payment method
  expiredPaymentMethod: () => ({
    ...orderFixtures.validPaymentMethod(),
    expiryMonth: 1,
    expiryYear: new Date().getFullYear() - 1
  }),

  // Expected successful order
  expectedOrder: (cartId, paymentMethodId) => ({
    id: expect.any(String),
    cartId,
    paymentMethodId,
    status: 'pending',
    createdAt: expect.any(Date)
  })
};
```

### Step 5: Map Fixtures to Acceptance Criteria

Link fixtures to specific ACs:

```typescript
// tests/fixtures/index.ts

export const fixturesForAC = {
  AC1: {
    // AC1: Successful order submission
    given: {
      cart: orderFixtures.cartWithItems(),
      paymentMethod: orderFixtures.validPaymentMethod()
    },
    expected: {
      order: orderFixtures.expectedOrder
    }
  },

  AC2: {
    // AC2: Order fails on invalid payment
    given: {
      cart: orderFixtures.cartWithItems(),
      paymentMethod: orderFixtures.expiredPaymentMethod()
    },
    expected: {
      error: 'Payment method expired'
    }
  },

  AC3: {
    // AC3: Order fails on empty cart
    given: {
      cart: orderFixtures.emptyCart(),
      paymentMethod: orderFixtures.validPaymentMethod()
    },
    expected: {
      error: 'Cart is empty'
    }
  }
};
```

### Step 6: Create Boundary Value Sets

```typescript
// tests/fixtures/boundaries.fixtures.ts

export const boundaryFixtures = {
  strings: {
    empty: '',
    singleChar: 'a',
    maxLength255: 'x'.repeat(255),
    overMaxLength: 'x'.repeat(256),
    whitespaceOnly: '   ',
    unicode: '测试数据',
    emoji: '👍🏼',
    sqlInjection: "'; DROP TABLE users; --",
    xss: '<script>alert("xss")</script>',
    nullByte: 'test\x00value'
  },

  numbers: {
    zero: 0,
    negative: -1,
    maxInt: Number.MAX_SAFE_INTEGER,
    minInt: Number.MIN_SAFE_INTEGER,
    float: 0.123456789,
    infinity: Infinity,
    nan: NaN
  },

  dates: {
    past: new Date('1900-01-01'),
    future: new Date('2100-12-31'),
    now: new Date(),
    epoch: new Date(0),
    invalid: new Date('invalid')
  },

  arrays: {
    empty: [],
    single: [1],
    large: Array(1000).fill(0).map((_, i) => i)
  }
};
```

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| acceptance_criteria | Markdown | Yes | AC mapped scenarios |
| data_models | Schema | Yes | Domain model definitions |
| constraints | JSON | Optional | Validation rules |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| tests/fixtures/*.fixtures.ts | TypeScript | Fixture factory files |
| tests/fixtures/index.ts | TypeScript | Central fixture exports |
| tests/fixtures/boundaries.fixtures.ts | TypeScript | Boundary value sets |

## Fixture File Organization

```
tests/
└── fixtures/
    ├── index.ts                    # Central exports
    ├── user.fixtures.ts            # User domain fixtures
    ├── order.fixtures.ts           # Order domain fixtures
    ├── payment.fixtures.ts         # Payment domain fixtures
    ├── boundaries.fixtures.ts      # Boundary values
    └── ac-mappings.ts              # AC → fixture mappings
```

## Framework-Specific Patterns

### Python (pytest fixtures)
```python
# tests/fixtures/conftest.py
import pytest

@pytest.fixture
def valid_user():
    return {
        'email': 'test@example.com',
        'password': 'SecurePass123!'
    }

@pytest.fixture
def expired_payment():
    return {
        'type': 'credit_card',
        'expiry_year': 2020
    }
```

### Java (JUnit 5)
```java
// src/test/java/fixtures/UserFixtures.java
public class UserFixtures {
    public static User validUser() {
        return User.builder()
            .email("test@example.com")
            .password("SecurePass123!")
            .build();
    }
}
```

## Validation

Before completing fixture generation:
- [ ] All ACs have corresponding fixtures
- [ ] Valid/invalid/boundary cases covered
- [ ] Fixtures are deterministic (seeded random if needed)
- [ ] Fixtures match actual data model schemas
- [ ] Special characters and security payloads included
- [ ] AC → fixture mapping documented

## Integration Points

- **Scenario Mapping (TEST-014)**: Receives AC requirements
- **Test Data (TEST-003)**: Extends core test data patterns
- **Software Developer (05)**: Uses fixtures in test implementation
