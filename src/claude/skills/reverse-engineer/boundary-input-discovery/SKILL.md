---
name: boundary-input-discovery
description: Generate boundary and edge case test inputs
skill_id: RE-105
owner: characterization-test-generator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Creating comprehensive edge case test coverage
dependencies: [RE-001, RE-003]
---

# Boundary Input Discovery

## Purpose
Systematically identify and generate boundary values, edge cases, and invalid inputs for characterization tests. This ensures tests cover not just happy paths but also behavior at limits and with unexpected inputs.

## When to Use
- Expanding test coverage beyond happy path
- Testing validation logic
- Finding edge case bugs
- Documenting behavior at limits

## Prerequisites
- Preconditions from RE-003
- Type definitions with constraints
- Validation rules identified

## Process

### Step 1: Identify Constrained Fields
```
Extract constraints from:
- Validation decorators (@Min, @Max, @Length)
- Type definitions (enum values, ranges)
- Database constraints (unique, not null)
- Business rules (limits, quotas)
```

### Step 2: Generate Boundary Values
```
For each constraint:
- Exactly at minimum
- One below minimum
- Exactly at maximum
- One above maximum
- Empty/null/undefined
- Type coercion values
```

### Step 3: Generate Edge Cases
```
Common edge cases:
- Empty strings vs null vs undefined
- Zero vs negative numbers
- Empty arrays vs arrays with one item
- Unicode and special characters
- Very long strings
- Deeply nested objects
```

### Step 4: Generate Invalid Combinations
```
Combinations:
- Multiple validation failures
- Conflicting field values
- Missing required fields
- Extra unexpected fields
```

## Boundary Patterns by Type

### String Boundaries
```typescript
// Constraint: @Length(3, 50)
export const stringBoundaries = {
  field: 'name',
  constraint: { min: 3, max: 50 },

  valid: [
    { value: 'abc', description: 'exactly minimum (3 chars)' },
    { value: 'a'.repeat(50), description: 'exactly maximum (50 chars)' },
    { value: 'Normal Name', description: 'typical value' }
  ],

  invalid: [
    { value: 'ab', description: 'below minimum (2 chars)' },
    { value: 'a'.repeat(51), description: 'above maximum (51 chars)' },
    { value: '', description: 'empty string' },
    { value: null, description: 'null' },
    { value: undefined, description: 'undefined' }
  ],

  edgeCases: [
    { value: '   ', description: 'whitespace only' },
    { value: '\t\n', description: 'special whitespace' },
    { value: '你好世界', description: 'unicode characters' },
    { value: '<script>', description: 'potential XSS' },
    { value: "O'Brien", description: 'single quote' },
    { value: 'a\x00b', description: 'null byte' }
  ]
};
```

### Number Boundaries
```typescript
// Constraint: @Min(0) @Max(100)
export const numberBoundaries = {
  field: 'quantity',
  constraint: { min: 0, max: 100 },

  valid: [
    { value: 0, description: 'exactly minimum' },
    { value: 100, description: 'exactly maximum' },
    { value: 1, description: 'just above minimum' },
    { value: 99, description: 'just below maximum' },
    { value: 50, description: 'middle value' }
  ],

  invalid: [
    { value: -1, description: 'below minimum' },
    { value: 101, description: 'above maximum' },
    { value: -0.01, description: 'slightly below zero' },
    { value: 100.01, description: 'slightly above max' },
    { value: null, description: 'null' },
    { value: NaN, description: 'NaN' },
    { value: Infinity, description: 'Infinity' }
  ],

  edgeCases: [
    { value: '50', description: 'string number (coercion)' },
    { value: 50.5, description: 'float when integer expected' },
    { value: 0.1 + 0.2, description: 'floating point precision' },
    { value: Number.MAX_SAFE_INTEGER, description: 'max safe integer' },
    { value: 1e308, description: 'very large number' }
  ]
};
```

### Array Boundaries
```typescript
// Constraint: array with 1-10 items
export const arrayBoundaries = {
  field: 'items',
  constraint: { minItems: 1, maxItems: 10 },

  valid: [
    { value: [item()], description: 'exactly 1 item (minimum)' },
    { value: Array(10).fill(null).map(item), description: 'exactly 10 items (maximum)' },
    { value: Array(5).fill(null).map(item), description: 'typical count' }
  ],

  invalid: [
    { value: [], description: 'empty array' },
    { value: Array(11).fill(null).map(item), description: 'above maximum (11 items)' },
    { value: null, description: 'null instead of array' },
    { value: 'not-array', description: 'wrong type' }
  ],

  edgeCases: [
    { value: [null], description: 'array with null item' },
    { value: [undefined], description: 'array with undefined' },
    { value: [item(), item()].concat(Array(1000).fill(null).map(item)), description: 'very large array' },
    { value: [duplicateItem(), duplicateItem()], description: 'duplicate items' }
  ]
};
```

### Date Boundaries
```typescript
export const dateBoundaries = {
  field: 'birthDate',

  valid: [
    { value: new Date('2000-01-01'), description: 'typical date' },
    { value: new Date().toISOString(), description: 'ISO string format' }
  ],

  invalid: [
    { value: 'not-a-date', description: 'invalid string' },
    { value: '2026-13-01', description: 'invalid month' },
    { value: '2026-02-30', description: 'invalid day' },
    { value: null, description: 'null' }
  ],

  edgeCases: [
    { value: new Date('1900-01-01'), description: 'very old date' },
    { value: new Date('2100-12-31'), description: 'future date' },
    { value: new Date(0), description: 'epoch' },
    { value: new Date('2026-02-29'), description: 'leap year edge' },
    { value: '2026-01-01T00:00:00.000Z', description: 'with timezone' }
  ]
};
```

### Email Boundaries
```typescript
export const emailBoundaries = {
  field: 'email',

  valid: [
    { value: 'user@example.com', description: 'typical email' },
    { value: 'user.name@example.com', description: 'with dot' },
    { value: 'user+tag@example.com', description: 'with plus' },
    { value: 'a@b.co', description: 'minimal valid' }
  ],

  invalid: [
    { value: 'not-an-email', description: 'missing @' },
    { value: '@example.com', description: 'missing local part' },
    { value: 'user@', description: 'missing domain' },
    { value: 'user@.com', description: 'invalid domain' },
    { value: '', description: 'empty' },
    { value: null, description: 'null' }
  ],

  edgeCases: [
    { value: 'user@localhost', description: 'localhost domain' },
    { value: 'user@192.168.1.1', description: 'IP address domain' },
    { value: 'a'.repeat(64) + '@example.com', description: 'max local part' },
    { value: 'user@' + 'a'.repeat(255) + '.com', description: 'long domain' },
    { value: '"user name"@example.com', description: 'quoted local part' }
  ]
};
```

## Boundary Test Generator

```typescript
// Generate boundary tests from constraints
export const generateBoundaryTests = (
  boundaries: BoundarySpec
): TestCase[] => {
  const tests: TestCase[] = [];

  // Valid boundary tests
  boundaries.valid.forEach(({ value, description }) => {
    tests.push({
      name: `accepts ${boundaries.field}: ${description}`,
      input: { [boundaries.field]: value },
      expectValid: true
    });
  });

  // Invalid boundary tests
  boundaries.invalid.forEach(({ value, description }) => {
    tests.push({
      name: `rejects ${boundaries.field}: ${description}`,
      input: { [boundaries.field]: value },
      expectValid: false,
      expectError: true
    });
  });

  // Edge case tests
  boundaries.edgeCases.forEach(({ value, description }) => {
    tests.push({
      name: `handles ${boundaries.field}: ${description}`,
      input: { [boundaries.field]: value },
      expectValid: 'capture',  // Capture actual behavior
      isEdgeCase: true
    });
  });

  return tests;
};
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| field_constraints | Object | Yes | Validation constraints |
| type_definition | Object | Yes | Field type info |
| existing_tests | Array | Optional | To avoid duplicates |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| boundary_values | Array | Generated test values |
| edge_cases | Array | Edge case inputs |
| test_matrix | Array | Full test case list |

## Project-Specific Considerations
- Respect domain-specific constraints (e.g., valid date ranges for bookings)
- Include locale-specific edge cases (Unicode, RTL text)
- Generate SQL injection and XSS payloads for security boundary tests
- Consider API rate limits as boundary conditions
- Include file size limits for upload endpoints

## Integration Points
- **Precondition Inference (RE-003)**: Validation rules inform boundaries
- **Business Rule Extraction (RE-006)**: Business limits define boundaries
- **Fixture Generation (RE-102)**: Boundary values added to fixtures
- **Test Scaffold Generation (RE-106)**: Boundary tests in test files
- **Security Auditor (08)**: Security boundaries for penetration testing

## Validation
- All boundaries identified
- Both sides of limits covered
- Type coercions included
- Edge cases documented
