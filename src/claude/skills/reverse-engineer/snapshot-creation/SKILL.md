---
name: snapshot-creation
description: Create golden file snapshots for complex outputs
skill_id: RE-104
owner: characterization-test-generator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Capturing complex output structures as baseline snapshots
dependencies: [RE-101]
---

# Snapshot Creation

## Purpose
Create snapshot baselines for complex outputs that are difficult to assert field-by-field. Snapshots capture the exact structure and content of responses, enabling regression detection when behavior changes.

## When to Use
- Complex nested response structures
- HTML/template outputs
- Error message formats
- Large JSON responses
- Configuration outputs

## Prerequisites
- Execution capture from RE-101
- Response data available
- Snapshot storage location defined

## Process

### Step 1: Identify Snapshot Candidates
```
Good candidates:
- Deep nested objects (>3 levels)
- Responses with many fields
- Template-generated content
- Error response structures
- Configuration exports

Poor candidates:
- Timestamps (always change)
- IDs (generated values)
- Large binary data
- Rapidly changing content
```

### Step 2: Normalize Dynamic Values
```
Replace dynamic values:
- IDs → expect.any(String) or placeholder
- Timestamps → expect.any(String) or fixed
- Random values → placeholder
- Environment-specific → normalized
```

### Step 3: Create Snapshot File
```
Format options:
- JSON for data structures
- Text for string content
- HTML for rendered output
- Custom matchers for complex rules
```

### Step 4: Define Update Strategy
```
When snapshot changes:
1. Review diff in PR
2. Confirm intentional change
3. Update snapshot (--updateSnapshot)
4. Document change reason
```

## Snapshot Patterns

### JSON Response Snapshot
```typescript
// Test file
describe('UserController.getProfile', () => {
  it.skip('CHARACTERIZATION: captures profile response shape', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`);

    // Snapshot with dynamic field handling
    expect(response.body).toMatchSnapshot({
      id: expect.any(String),
      createdAt: expect.any(String),
      updatedAt: expect.any(String)
    });
  });
});

// Snapshot file (__snapshots__/user.characterization.ts.snap)
exports[`UserController.getProfile CHARACTERIZATION: captures profile response shape 1`] = `
{
  "id": Any<String>,
  "email": "test@example.com",
  "name": "Test User",
  "profile": {
    "bio": "Software developer",
    "avatar": "https://example.com/avatar.jpg",
    "social": {
      "twitter": "@testuser",
      "github": "testuser"
    }
  },
  "settings": {
    "notifications": {
      "email": true,
      "push": false
    },
    "theme": "dark"
  },
  "createdAt": Any<String>,
  "updatedAt": Any<String>
}
`;
```

### Error Response Snapshot
```typescript
it.skip('CHARACTERIZATION: captures validation error shape', async () => {
  const response = await request(app.getHttpServer())
    .post('/api/users')
    .send({ email: 'invalid' });

  expect(response.body).toMatchSnapshot();
});

// Snapshot
exports[`CHARACTERIZATION: captures validation error shape 1`] = `
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": [
    {
      "property": "email",
      "constraints": {
        "isEmail": "email must be a valid email"
      }
    },
    {
      "property": "password",
      "constraints": {
        "isNotEmpty": "password should not be empty",
        "minLength": "password must be at least 8 characters"
      }
    }
  ]
}
`;
```

### Inline Snapshot
```typescript
// For smaller outputs, use inline snapshots
it.skip('CHARACTERIZATION: captures order status transitions', async () => {
  const order = await orderService.create({ items: [...] });

  expect(order.statusHistory).toMatchInlineSnapshot(`
    [
      {
        "status": "pending",
        "timestamp": Any<String>,
        "reason": "Order created"
      }
    ]
  `);
});
```

### Golden File Pattern
```typescript
// For very large outputs or non-JSON data
// tests/characterization/__golden__/

import { readGoldenFile, writeGoldenFile } from '../../helpers/golden-files';

it.skip('CHARACTERIZATION: captures report output', async () => {
  const report = await reportService.generateMonthly('2026-01');

  // Compare against golden file
  const golden = readGoldenFile('monthly-report-2026-01.json');

  expect(report).toMatchGoldenFile(golden, {
    ignore: ['generatedAt', 'reportId']
  });
});

// Update golden file
it.only('UPDATE GOLDEN: monthly report', async () => {
  const report = await reportService.generateMonthly('2026-01');
  writeGoldenFile('monthly-report-2026-01.json', report);
});
```

## Golden File Helpers

```typescript
// tests/helpers/golden-files.ts

import * as fs from 'fs';
import * as path from 'path';

const GOLDEN_DIR = path.join(__dirname, '../characterization/__golden__');

export const readGoldenFile = (filename: string): any => {
  const filepath = path.join(GOLDEN_DIR, filename);
  if (!fs.existsSync(filepath)) {
    throw new Error(`Golden file not found: ${filename}`);
  }
  const content = fs.readFileSync(filepath, 'utf-8');
  return JSON.parse(content);
};

export const writeGoldenFile = (filename: string, data: any): void => {
  const filepath = path.join(GOLDEN_DIR, filename);
  fs.mkdirSync(GOLDEN_DIR, { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  console.log(`Golden file updated: ${filename}`);
};

export const toMatchGoldenFile = (
  received: any,
  golden: any,
  options: { ignore?: string[] } = {}
): { pass: boolean; message: () => string } => {
  const { ignore = [] } = options;

  const normalize = (obj: any): any => {
    if (typeof obj !== 'object' || obj === null) return obj;
    const result: any = Array.isArray(obj) ? [] : {};
    for (const key of Object.keys(obj)) {
      if (ignore.includes(key)) continue;
      result[key] = normalize(obj[key]);
    }
    return result;
  };

  const normalizedReceived = normalize(received);
  const normalizedGolden = normalize(golden);

  const pass = JSON.stringify(normalizedReceived) === JSON.stringify(normalizedGolden);

  return {
    pass,
    message: () => pass
      ? `Expected not to match golden file`
      : `Expected to match golden file\n\nDiff:\n${JSON.stringify(normalizedReceived, null, 2)}`
  };
};

// Add to Jest
expect.extend({ toMatchGoldenFile });
```

## Snapshot Directory Structure

```
tests/characterization/
├── __snapshots__/
│   ├── user.characterization.ts.snap
│   ├── order.characterization.ts.snap
│   └── payment.characterization.ts.snap
├── __golden__/
│   ├── user-profile-response.json
│   ├── order-summary-response.json
│   └── monthly-report-2026-01.json
└── helpers/
    └── golden-files.ts
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| captured_output | Any | Yes | From RE-101 |
| dynamic_fields | Array | Optional | Fields to normalize |
| format | String | Optional | json, text, html |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| snapshot_file | File | .snap or golden file |
| snapshot_test | TypeScript | Test with snapshot assertion |
| update_helper | TypeScript | Golden file update script |

## Project-Specific Considerations
- Use project's snapshot format (Jest inline, separate .snap files)
- Configure snapshot serializers for custom types
- Document snapshot update workflow for the team
- Handle CI/CD snapshot verification setup
- Include snapshot review guidelines in PR process

## Integration Points
- **Execution Capture (RE-101)**: Captured responses become snapshots
- **Golden File Management (RE-107)**: Large outputs go to golden files
- **Test Scaffold Generation (RE-106)**: Snapshot assertions in tests
- **QA Engineer (07)**: Snapshot review in code review process

## Validation
- Dynamic values normalized
- Snapshots deterministic
- File paths correct
- Diff readable on failure
