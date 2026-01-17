---
name: test-environment-management
description: Manage test environment setup and data
skill_id: TEST-011
owner: test-manager
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Test setup, environment configuration, data management
dependencies: [TEST-003]
---

# Test Environment Management

## Purpose
Manage test environments including setup, configuration, data management, and external service mocking to ensure reliable and reproducible test execution.

## When to Use
- Test environment setup
- CI/CD configuration
- Data refresh planning
- Mock service management

## Prerequisites
- Infrastructure available
- Test data ready
- Mock requirements known

## Process

### Step 1: Define Environment Requirements
```
Requirements:
- Compute resources
- Database instances
- External service mocks
- Network configuration
- Data requirements
```

### Step 2: Configure Environments
```
Environment types:
- Local: Developer machines
- CI: Ephemeral containers
- Staging: Persistent shared
- Performance: Scaled infrastructure
```

### Step 3: Setup Data Management
```
Data management:
- Seed scripts
- Fixture loading
- Data reset procedures
- Anonymization rules
```

### Step 4: Configure Mocks
```
Mock services:
- External APIs
- Email services
- File storage
- Payment gateways
```

### Step 5: Document Procedures
```
Documentation:
- Setup instructions
- Reset procedures
- Troubleshooting
- Access management
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| infrastructure_design | Markdown | Yes | Architecture |
| test_requirements | Markdown | Yes | What's needed |
| external_apis | JSON | Yes | APIs to mock |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| environment_config | YAML | Configuration files |
| setup_scripts/ | Bash | Setup automation |
| mock_services/ | Code | Mock implementations |

## Project-Specific Considerations
- University API mocks
- OAuth provider mocks
- Document storage mocks
- Email service mocks

## Integration Points
- **DevOps Agent**: Infrastructure
- **Developer Agent**: Local setup
- **Security Agent**: Environment security

## Examples
```
Test Environment Management - SDLC Framework

ENVIRONMENT MATRIX:

| Aspect | Local | CI | Staging |
|--------|-------|-----|---------|
| Database | Docker PG | Docker PG | RDS |
| Cache | Docker Redis | Docker Redis | ElastiCache |
| Storage | MinIO | MinIO | S3 Staging |
| External APIs | MSW mocks | MSW mocks | Sandbox |
| Email | Mailhog | None | Mailhog |
| OAuth | Mock provider | Mock provider | Test apps |

LOCAL SETUP:

```bash
# docker-compose.test.yml
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: myapp_test
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    ports:
      - "5433:5432"
  
  redis:
    image: redis:7
    ports:
      - "6380:6379"
  
  minio:
    image: minio/minio
    command: server /data
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
  
  mailhog:
    image: mailhog/mailhog
    ports:
      - "8025:8025"
      - "1025:1025"
```

CI ENVIRONMENT:

```yaml
# .github/workflows/test.yml
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: test
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
    
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node
        uses: actions/setup-node@v3
      - name: Install
        run: npm ci
      - name: Run migrations
        run: npm run db:migrate:test
      - name: Seed data
        run: npm run db:seed:test
      - name: Run tests
        run: npm test
```

MOCK SERVICES:

```typescript
// mocks/handlers.ts
import { http, HttpResponse } from 'msw'

export const handlers = [
  // University API
  http.get('https://api.universitydb.com/v2/universities', ({ request }) => {
    const url = new URL(request.url)
    const country = url.searchParams.get('country')
    
    return HttpResponse.json({
      universities: mockUniversities.filter(
        u => !country || u.country === country
      ),
      pagination: { page: 1, total: 10 }
    })
  }),
  
  // OAuth
  http.post('https://oauth2.googleapis.com/token', () => {
    return HttpResponse.json({
      access_token: 'mock-access-token',
      id_token: 'mock-id-token',
      expires_in: 3600
    })
  }),
  
  // Virus scan
  http.post('https://scan.example.com/scan', async ({ request }) => {
    const body = await request.formData()
    const file = body.get('file') as File
    
    // Simulate scan delay
    await new Promise(r => setTimeout(r, 100))
    
    // EICAR test file triggers virus detection
    if (file.name.includes('eicar')) {
      return HttpResponse.json({ 
        clean: false, 
        threat: 'EICAR-Test-File' 
      })
    }
    
    return HttpResponse.json({ clean: true })
  })
]
```

DATA MANAGEMENT:

```typescript
// scripts/seed-test-data.ts
import { prisma } from './client'
import { userFixtures, universityFixtures } from '../fixtures'

async function seedTestData() {
  // Clear existing data
  await prisma.$transaction([
    prisma.application.deleteMany(),
    prisma.document.deleteMany(),
    prisma.user.deleteMany(),
    prisma.program.deleteMany(),
    prisma.university.deleteMany()
  ])
  
  // Seed reference data
  await prisma.university.createMany({
    data: universityFixtures
  })
  
  // Seed test users
  await prisma.user.createMany({
    data: userFixtures
  })
  
  console.log('Test data seeded successfully')
}

// Reset between test suites
export async function resetTestData() {
  await prisma.application.deleteMany()
  await prisma.document.deleteMany()
}
```

ENVIRONMENT VARIABLES:

```bash
# .env.test
DATABASE_URL=postgresql://test:test@localhost:5433/myapp_test
REDIS_URL=redis://localhost:6380
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=test-documents
SMTP_HOST=localhost
SMTP_PORT=1025

# Mock external services
UNIVERSITY_API_URL=https://api.universitydb.com/v2
OAUTH_MOCK=true

# Test configuration
NODE_ENV=test
LOG_LEVEL=error
```

TROUBLESHOOTING:

| Issue | Cause | Solution |
|-------|-------|----------|
| DB connection fail | Container not ready | Add health check wait |
| Mock not intercepting | MSW not started | Start in setupTests |
| Flaky async tests | Race conditions | Use waitFor utilities |
| Stale data | Incomplete reset | Reset in beforeEach |
```

## Validation
- All environments documented
- Setup scripts work
- Mocks are reliable
- Data reset works
- Team can use locally