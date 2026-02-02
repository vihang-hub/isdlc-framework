---
name: golden-file-management
description: Manage baseline output files for regression comparison
skill_id: RE-107
owner: characterization-test-generator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Creating and managing golden file baselines for complex outputs
dependencies: [RE-101, RE-104]
---

# Golden File Management

## Purpose
Create and manage golden files - baseline output files that capture expected behavior for complex outputs. Golden files provide a reference point for detecting regressions when code behavior changes.

## When to Use
- Large JSON responses (too big for inline snapshots)
- Non-JSON outputs (HTML, XML, CSV)
- Generated reports or exports
- Configuration outputs
- API contract validation

## Prerequisites
- Execution capture from RE-101
- Snapshot decisions from RE-104
- Golden file directory established

## Process

### Step 1: Identify Golden File Candidates
```
Good for golden files:
- Responses > 50 lines
- Multi-format outputs (HTML, XML)
- Generated documents
- Export files
- Full API responses

Keep as snapshots:
- Small JSON objects
- Simple strings
- Error messages
```

### Step 2: Create Golden File Structure
```
Directory layout:
tests/characterization/__golden__/
├── {domain}/
│   ├── {feature}-{scenario}.json
│   ├── {feature}-{scenario}.html
│   └── {feature}-{scenario}.xml
└── _manifest.json
```

### Step 3: Generate Golden Files
```
For each candidate:
1. Execute code path
2. Capture full output
3. Normalize dynamic values
4. Write to golden file
5. Register in manifest
```

### Step 4: Create Comparison Logic
```
Comparison features:
- Ignore specified fields
- Normalize timestamps
- Sort arrays for stability
- Fuzzy number matching
- Structural diff on failure
```

## Golden File Patterns

### JSON Golden File
```json
// tests/characterization/__golden__/users/profile-response.json
{
  "$golden": {
    "created": "2026-02-02T10:00:00Z",
    "source": "GET /api/users/me",
    "ac_reference": "AC-RE-015",
    "dynamic_fields": ["id", "createdAt", "updatedAt"]
  },
  "data": {
    "id": "{{DYNAMIC}}",
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
        "push": false,
        "sms": false
      },
      "privacy": {
        "profilePublic": true,
        "showEmail": false
      },
      "theme": "dark",
      "language": "en-US"
    },
    "stats": {
      "postsCount": 42,
      "followersCount": 1337,
      "followingCount": 256
    },
    "createdAt": "{{DYNAMIC}}",
    "updatedAt": "{{DYNAMIC}}"
  }
}
```

### HTML Golden File
```html
<!-- tests/characterization/__golden__/reports/monthly-summary.html -->
<!--
  GOLDEN FILE: Monthly Summary Report
  Generated: 2026-02-02T10:00:00Z
  Source: GET /api/reports/monthly?month=2026-01
  AC Reference: AC-RE-045
-->
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Monthly Summary - January 2026</title>
</head>
<body>
  <h1>Monthly Summary Report</h1>
  <p>Generated: {{DYNAMIC:timestamp}}</p>

  <section id="summary">
    <h2>Summary</h2>
    <table>
      <tr><th>Total Orders</th><td>1,234</td></tr>
      <tr><th>Revenue</th><td>$98,765.43</td></tr>
      <tr><th>New Customers</th><td>89</td></tr>
    </table>
  </section>

  <section id="trends">
    <h2>Trends</h2>
    <ul>
      <li>Orders: +12% from last month</li>
      <li>Revenue: +8% from last month</li>
    </ul>
  </section>
</body>
</html>
```

### Manifest File
```json
// tests/characterization/__golden__/_manifest.json
{
  "version": "1.0.0",
  "created": "2026-02-02T10:00:00Z",
  "files": [
    {
      "path": "users/profile-response.json",
      "source": "GET /api/users/me",
      "ac_reference": "AC-RE-015",
      "format": "json",
      "dynamic_fields": ["id", "createdAt", "updatedAt"],
      "last_updated": "2026-02-02T10:00:00Z"
    },
    {
      "path": "reports/monthly-summary.html",
      "source": "GET /api/reports/monthly",
      "ac_reference": "AC-RE-045",
      "format": "html",
      "dynamic_fields": ["timestamp"],
      "last_updated": "2026-02-02T10:00:00Z"
    }
  ]
}
```

## Golden File Utilities

```typescript
// tests/helpers/golden-files.ts

import * as fs from 'fs';
import * as path from 'path';
import { diff } from 'jest-diff';

const GOLDEN_DIR = path.join(__dirname, '../characterization/__golden__');

interface GoldenFileMetadata {
  created: string;
  source: string;
  ac_reference: string;
  dynamic_fields: string[];
}

interface GoldenFile<T = any> {
  $golden: GoldenFileMetadata;
  data: T;
}

/**
 * Read a golden file and parse it
 */
export function readGoldenFile<T = any>(relativePath: string): GoldenFile<T> {
  const fullPath = path.join(GOLDEN_DIR, relativePath);
  const content = fs.readFileSync(fullPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Write a new golden file
 */
export function writeGoldenFile<T>(
  relativePath: string,
  data: T,
  metadata: Omit<GoldenFileMetadata, 'created'>
): void {
  const fullPath = path.join(GOLDEN_DIR, relativePath);
  const dir = path.dirname(fullPath);

  // Ensure directory exists
  fs.mkdirSync(dir, { recursive: true });

  const goldenFile: GoldenFile<T> = {
    $golden: {
      ...metadata,
      created: new Date().toISOString()
    },
    data
  };

  fs.writeFileSync(fullPath, JSON.stringify(goldenFile, null, 2));
  console.log(`Golden file written: ${relativePath}`);

  // Update manifest
  updateManifest(relativePath, metadata);
}

/**
 * Compare actual output against golden file
 */
export function compareWithGolden<T>(
  actual: T,
  relativePath: string,
  options: { ignoreFields?: string[] } = {}
): { match: boolean; diff?: string } {
  const golden = readGoldenFile<T>(relativePath);
  const dynamicFields = [
    ...golden.$golden.dynamic_fields,
    ...(options.ignoreFields || [])
  ];

  const normalizedActual = normalizeForComparison(actual, dynamicFields);
  const normalizedExpected = normalizeForComparison(golden.data, dynamicFields);

  const actualJson = JSON.stringify(normalizedActual, null, 2);
  const expectedJson = JSON.stringify(normalizedExpected, null, 2);

  if (actualJson === expectedJson) {
    return { match: true };
  }

  return {
    match: false,
    diff: diff(normalizedExpected, normalizedActual, { expand: false })
  };
}

/**
 * Normalize object by replacing dynamic fields
 */
function normalizeForComparison(obj: any, dynamicFields: string[]): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => normalizeForComparison(item, dynamicFields));
  }

  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (dynamicFields.includes(key)) {
      result[key] = '{{DYNAMIC}}';
    } else {
      result[key] = normalizeForComparison(value, dynamicFields);
    }
  }
  return result;
}

/**
 * Update the manifest file
 */
function updateManifest(
  relativePath: string,
  metadata: Omit<GoldenFileMetadata, 'created'>
): void {
  const manifestPath = path.join(GOLDEN_DIR, '_manifest.json');
  let manifest = { version: '1.0.0', created: new Date().toISOString(), files: [] };

  if (fs.existsSync(manifestPath)) {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  }

  // Update or add entry
  const existingIndex = manifest.files.findIndex((f: any) => f.path === relativePath);
  const entry = {
    path: relativePath,
    ...metadata,
    format: relativePath.split('.').pop(),
    last_updated: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    manifest.files[existingIndex] = entry;
  } else {
    manifest.files.push(entry);
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

// Jest custom matcher
expect.extend({
  toMatchGoldenFile(received: any, relativePath: string, options?: { ignoreFields?: string[] }) {
    const result = compareWithGolden(received, relativePath, options);

    return {
      pass: result.match,
      message: () => result.match
        ? `Expected not to match golden file ${relativePath}`
        : `Golden file mismatch: ${relativePath}\n\n${result.diff}`
    };
  }
});
```

## Usage in Tests

```typescript
describe('CHARACTERIZATION: ReportService', () => {
  it.skip('AC-RE-045: captures monthly report output', async () => {
    const report = await reportService.generateMonthly('2026-01');

    expect(report).toMatchGoldenFile('reports/monthly-summary.json');
  });

  it.skip('AC-RE-046: captures HTML report format', async () => {
    const html = await reportService.generateMonthlyHTML('2026-01');

    expect(html).toMatchGoldenFile('reports/monthly-summary.html', {
      ignoreFields: ['generatedAt']
    });
  });
});

// Update golden file (run once to create/update baseline)
describe.skip('UPDATE GOLDEN FILES', () => {
  it('update monthly report golden', async () => {
    const report = await reportService.generateMonthly('2026-01');

    writeGoldenFile('reports/monthly-summary.json', report, {
      source: 'GET /api/reports/monthly',
      ac_reference: 'AC-RE-045',
      dynamic_fields: ['generatedAt', 'reportId']
    });
  });
});
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| captured_output | Any | Yes | Output to store |
| file_path | String | Yes | Relative path |
| metadata | Object | Yes | Source and AC info |
| dynamic_fields | Array | Yes | Fields to ignore |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| golden_file | File | Baseline output file |
| manifest_entry | JSON | Entry in _manifest.json |
| comparison_helper | Function | Compare utility |

## Project-Specific Considerations
- Store golden files in version control for team visibility
- Document golden file update approval process
- Configure CI to fail on unexpected golden file changes
- Support multiple output formats (JSON, HTML, XML, CSV)
- Include manifest for tracking golden file provenance

## Integration Points
- **Snapshot Creation (RE-104)**: Large outputs redirected to golden files
- **Execution Capture (RE-101)**: Captured outputs become baselines
- **Test Scaffold Generation (RE-106)**: Tests reference golden files
- **QA Engineer (07)**: Golden file changes reviewed in PRs
- **CI/CD Engineer (09)**: Golden file verification in pipeline

## Validation
- File created successfully
- Manifest updated
- Dynamic fields documented
- Comparison works correctly
