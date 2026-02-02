---
name: fixture-generation
description: Generate test fixtures from observed data and type definitions
skill_id: RE-102
owner: characterization-test-generator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Creating reusable test data from reverse engineering
dependencies: [RE-001, RE-007]
---

# Fixture Generation

## Purpose
Generate comprehensive, typed test fixtures based on observed data from code analysis and execution capture. These fixtures provide realistic test data that can be reused across characterization tests and future test development.

## When to Use
- Creating test input data
- Building expected output shapes
- Setting up test database seeds
- Providing mock response data

## Prerequisites
- Data transformation mapping from RE-007
- Type definitions (DTOs, interfaces)
- Captured execution data (optional)

## Process

### Step 1: Analyze Type Definitions
```
Extract from:
- DTOs and request/response types
- Database entities
- Interface definitions
- Validation decorators

Collect:
- Field names and types
- Required vs optional
- Validation constraints
- Default values
```

### Step 2: Generate Base Fixtures
```
For each type:
1. Create valid fixture with all required fields
2. Add optional fields with realistic values
3. Generate type-appropriate values
4. Respect validation constraints
```

### Step 3: Generate Edge Case Fixtures
```
For each field:
- Minimum valid value
- Maximum valid value
- Empty/null (if allowed)
- Boundary values
- Invalid values (for error tests)
```

### Step 4: Generate Relationship Fixtures
```
For related entities:
- Parent fixtures with child references
- Valid foreign key relationships
- Orphaned records (for edge cases)
- Circular reference handling
```

### Step 5: Export Fixture Files
```
Output:
- Typed fixture objects
- Factory functions
- Builder patterns (optional)
- Seed data scripts
```

## Fixture Generation Patterns

### Basic Type Fixtures
```typescript
// From type definition:
interface CreateUserDto {
  email: string;       // @IsEmail()
  password: string;    // @MinLength(8)
  name: string;        // @IsNotEmpty()
  age?: number;        // @IsOptional() @Min(18)
}

// Generated fixture:
export const createUserFixtures = {
  valid: {
    email: 'test.user@example.com',
    password: 'SecurePassword123!',
    name: 'Test User',
    age: 25
  },

  minimalValid: {
    email: 'minimal@example.com',
    password: 'Pass1234',
    name: 'Min'
  },

  withOptionalFields: {
    email: 'full@example.com',
    password: 'FullPassword123!',
    name: 'Full User',
    age: 30
  }
};
```

### Validation Edge Case Fixtures
```typescript
export const createUserEdgeCases = {
  // Valid boundaries
  passwordMinLength: {
    ...createUserFixtures.valid,
    password: '12345678'  // Exactly 8 chars
  },

  ageMinimum: {
    ...createUserFixtures.valid,
    age: 18  // Minimum allowed
  },

  // Invalid values (for error tests)
  invalidEmail: {
    ...createUserFixtures.valid,
    email: 'not-an-email'
  },

  passwordTooShort: {
    ...createUserFixtures.valid,
    password: '1234567'  // 7 chars, min is 8
  },

  emptyName: {
    ...createUserFixtures.valid,
    name: ''
  },

  ageTooYoung: {
    ...createUserFixtures.valid,
    age: 17  // Below minimum 18
  },

  missingRequired: {
    email: 'test@example.com'
    // Missing password and name
  }
};
```

### Expected Output Fixtures
```typescript
// For response validation
export const userResponseFixtures = {
  successfulRegistration: {
    status: 201,
    body: {
      id: expect.any(String),
      email: 'test.user@example.com',
      name: 'Test User',
      createdAt: expect.any(String)
      // Note: password NOT in response
    }
  },

  validationError: {
    status: 400,
    body: {
      errors: expect.arrayContaining([
        expect.objectContaining({
          field: expect.any(String),
          message: expect.any(String)
        })
      ])
    }
  },

  duplicateEmail: {
    status: 409,
    body: {
      error: 'User already exists'
    }
  }
};
```

### Entity Fixtures with Relationships
```typescript
// User with orders
export const entityFixtures = {
  user: {
    id: 'user-001',
    email: 'fixture.user@example.com',
    name: 'Fixture User',
    passwordHash: '$2b$10$...',  // Pre-hashed
    createdAt: new Date('2026-01-01T00:00:00Z')
  },

  orders: [
    {
      id: 'order-001',
      userId: 'user-001',  // References user
      status: 'pending',
      total: 99.99,
      createdAt: new Date('2026-01-15T00:00:00Z')
    },
    {
      id: 'order-002',
      userId: 'user-001',
      status: 'completed',
      total: 149.99,
      createdAt: new Date('2026-01-20T00:00:00Z')
    }
  ],

  orderItems: [
    {
      id: 'item-001',
      orderId: 'order-001',
      productId: 'prod-001',
      quantity: 2,
      price: 49.99
    }
  ]
};
```

### Factory Functions
```typescript
// Fixture factory for dynamic data
export const userFixtureFactory = {
  create(overrides: Partial<CreateUserDto> = {}): CreateUserDto {
    return {
      email: `user-${Date.now()}@example.com`,
      password: 'DefaultPass123!',
      name: 'Generated User',
      ...overrides
    };
  },

  createMany(count: number, overrides: Partial<CreateUserDto> = []): CreateUserDto[] {
    return Array.from({ length: count }, (_, i) =>
      this.create({
        email: `user-${i}@example.com`,
        name: `User ${i}`,
        ...(Array.isArray(overrides) ? overrides[i] : overrides)
      })
    );
  }
};
```

## Fixture File Structure

```
tests/fixtures/reverse-engineered/
├── user-management.fixtures.ts
├── payments.fixtures.ts
├── orders.fixtures.ts
├── shared/
│   ├── base-entities.fixtures.ts
│   └── factories.ts
└── index.ts
```

### Index Export
```typescript
// tests/fixtures/reverse-engineered/index.ts
export * from './user-management.fixtures';
export * from './payments.fixtures';
export * from './orders.fixtures';
export * from './shared/factories';
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| type_definitions | Object | Yes | DTOs, interfaces |
| captured_data | JSON | Optional | From execution capture |
| constraints | Array | Optional | Validation rules |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| fixture_file | TypeScript | Typed fixture exports |
| factory_functions | TypeScript | Dynamic generators |
| seed_data | JSON/SQL | Database seed scripts |

## Validation
- All required fields present
- Types match definitions
- Constraints respected
- Relationships valid
