---
name: test-data-generation
description: Create appropriate test data for various scenarios
skill_id: TEST-003
owner: test-manager
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Test preparation, fixture creation, data setup
dependencies: [TEST-002]
---

# Test Data Generation

## Purpose
Create comprehensive test data sets including valid data, boundary values, invalid data, and realistic scenarios that support thorough testing.

## When to Use
- Test case implementation
- Fixture creation
- Database seeding
- Performance test data

## Prerequisites
- Data models understood
- Validation rules known
- Test cases designed
- Privacy requirements known

## Process

### Step 1: Identify Data Needs
```
Data categories:
- Entity data (users, applications)
- Reference data (countries, programs)
- State data (statuses, dates)
- File data (documents)
```

### Step 2: Design Data Sets
```
Set types:
- Minimal valid set
- Full valid set
- Boundary values
- Invalid values
- Edge cases
```

### Step 3: Generate Data
```
Generation approaches:
- Static fixtures (JSON/SQL)
- Factory patterns
- Faker libraries
- Anonymized production data
```

### Step 4: Handle Sensitive Data
```
Privacy considerations:
- No real PII in tests
- Anonymization rules
- Fake but realistic
- GDPR compliant
```

### Step 5: Document and Version
```
Documentation:
- Data structure
- Generation scripts
- Refresh procedures
- Data relationships
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| data_models | TypeScript | Yes | Entity definitions |
| validation_rules | Markdown | Yes | Field constraints |
| test_cases | Markdown | Yes | Data requirements |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| fixtures/ | JSON | Static test data |
| factories/ | TypeScript | Data factories |
| seeds/ | SQL | Database seeds |

## Project-Specific Considerations
- Fake but realistic student data
- Program deadlines (past, future, today)
- Various application statuses
- Document file fixtures
- University/program relationships

## Integration Points
- **Developer Agent**: Uses fixtures
- **DevOps Agent**: Seed scripts
- **Security Agent**: PII handling verification

## Examples
```
Test Data - SDLC Framework

1. USER DATA FACTORY

```typescript
// factories/user.factory.ts
import { faker } from '@faker-js/faker'

export const createUser = (overrides = {}) => ({
  id: faker.string.uuid(),
  email: faker.internet.email(),
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  dateOfBirth: faker.date.birthdate({ min: 18, max: 30, mode: 'age' }),
  nationality: faker.helpers.arrayElement(['US', 'GB', 'DE', 'FR', 'IN']),
  createdAt: faker.date.past(),
  ...overrides
})

export const createUsers = (count: number) => 
  Array.from({ length: count }, () => createUser())

// Specific user scenarios
export const userScenarios = {
  newUser: createUser({ createdAt: new Date() }),
  userWithApplications: createUser({ id: 'user-with-apps' }),
  euUser: createUser({ nationality: 'DE' }), // For GDPR tests
  minorUser: createUser({ 
    dateOfBirth: faker.date.birthdate({ min: 16, max: 17, mode: 'age' })
  })
}
```

2. APPLICATION TEST DATA

```typescript
// fixtures/applications.ts
export const applicationFixtures = {
  // Status variations
  draftApplication: {
    id: 'app-draft-001',
    userId: 'user-001',
    programId: 'prog-001',
    status: 'draft',
    progress: 40,
    submittedAt: null
  },
  
  submittedApplication: {
    id: 'app-submitted-001',
    userId: 'user-001',
    programId: 'prog-002',
    status: 'submitted',
    progress: 100,
    submittedAt: '2024-01-10T10:00:00Z'
  },
  
  // Deadline scenarios
  applicationNearDeadline: {
    id: 'app-urgent',
    programId: 'prog-deadline-soon',
    status: 'draft',
    // Program deadline is in 3 days
  },
  
  applicationPastDeadline: {
    id: 'app-late',
    programId: 'prog-deadline-passed',
    status: 'draft',
    // Program deadline was yesterday
  }
}
```

3. UNIVERSITY/PROGRAM DATA

```json
// fixtures/universities.json
{
  "universities": [
    {
      "id": "uni-001",
      "externalId": "EXT-TUM",
      "name": "Technical University of Munich",
      "country": "DE",
      "city": "Munich",
      "programCount": 3
    },
    {
      "id": "uni-002",
      "externalId": "EXT-UVA",
      "name": "University of Amsterdam",
      "country": "NL",
      "city": "Amsterdam",
      "programCount": 2
    }
  ],
  "programs": [
    {
      "id": "prog-001",
      "universityId": "uni-001",
      "name": "MSc Computer Science",
      "degreeLevel": "master",
      "language": "English",
      "deadline": "2024-03-15",
      "tuitionAmount": 1500,
      "tuitionCurrency": "EUR"
    },
    {
      "id": "prog-deadline-soon",
      "universityId": "uni-001",
      "name": "MSc Data Science",
      "deadline": "{{TODAY+3}}"
    },
    {
      "id": "prog-deadline-passed",
      "universityId": "uni-002",
      "name": "BA Economics",
      "deadline": "{{TODAY-1}}"
    }
  ]
}
```

4. DOCUMENT TEST FILES

```
fixtures/documents/
├── valid/
│   ├── transcript_small.pdf (500KB)
│   ├── transcript_medium.pdf (5MB)
│   ├── transcript_max.pdf (10MB)
│   ├── photo.jpg (2MB)
│   └── certificate.png (1MB)
├── invalid/
│   ├── too_large.pdf (15MB)
│   ├── wrong_type.exe
│   ├── wrong_type.docx
│   └── corrupted.pdf
└── edge/
    ├── unicode_名前.pdf
    ├── spaces in name.pdf
    └── special(chars)[1].pdf
```

5. DATABASE SEED SCRIPT

```sql
-- seeds/01_users.sql
INSERT INTO users (id, email, first_name, last_name, nationality, gdpr_consent)
VALUES
  ('user-001', 'john@test.com', 'John', 'Doe', 'US', true),
  ('user-002', 'jane@test.com', 'Jane', 'Smith', 'GB', true),
  ('user-eu-001', 'hans@test.de', 'Hans', 'Mueller', 'DE', true);

-- seeds/02_applications.sql
INSERT INTO applications (id, user_id, program_id, status)
VALUES
  ('app-001', 'user-001', 'prog-001', 'draft'),
  ('app-002', 'user-001', 'prog-002', 'submitted');
```

6. EXTERNAL API MOCK DATA

```typescript
// mocks/university-api.ts
export const universityApiResponses = {
  searchSuccess: {
    universities: [
      { id: 'EXT-TUM', name: 'TU Munich', country_code: 'DE' },
      { id: 'EXT-LMU', name: 'LMU Munich', country_code: 'DE' }
    ],
    pagination: { page: 1, total: 2, hasMore: false }
  },
  
  searchEmpty: {
    universities: [],
    pagination: { page: 1, total: 0, hasMore: false }
  },
  
  rateLimited: {
    error: 'rate_limited',
    message: 'Too many requests',
    retryAfter: 60
  },
  
  serverError: {
    error: 'server_error',
    message: 'Internal server error'
  }
}
```
```

## Validation
- All test scenarios have data
- Boundary values included
- No real PII used
- Relationships maintained
- Data documented