---
name: database-integration
description: Implement data access layer and database operations
skill_id: DEV-004
owner: software-developer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Database operations, ORM usage, query optimization
dependencies: [DEV-001]
---

# Database Integration

## Purpose
Implement reliable and efficient database operations using the ORM, including queries, transactions, and migrations.

## When to Use
- Data model implementation
- Query optimization
- Transaction handling
- Migration writing

## Prerequisites
- Database schema defined
- ORM configured (Prisma)
- Connection pooling set up

## Process

### Step 1: Define Schema
```
Prisma schema:
- Models
- Relations
- Indexes
- Constraints
```

### Step 2: Generate Client
```
Commands:
- prisma generate
- prisma migrate dev
```

### Step 3: Implement Repository
```
Repository pattern:
- CRUD operations
- Complex queries
- Transactions
```

### Step 4: Optimize Queries
```
Optimization:
- Select only needed fields
- Use indexes
- Avoid N+1 queries
- Use transactions
```

### Step 5: Handle Errors
```
Error handling:
- Constraint violations
- Connection errors
- Deadlocks
- Timeouts
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| database_schema | SQL | Yes | Schema design |
| queries | Markdown | Yes | Required queries |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| schema.prisma | Prisma | Schema definition |
| migrations/ | SQL | Migration files |
| repositories/ | TypeScript | Data access |

## Project-Specific Considerations
- User data privacy
- Application audit trail
- Soft deletes for GDPR
- Efficient search queries

## Integration Points
- **Architecture Agent**: Schema design
- **Security Agent**: Data protection
- **DevOps Agent**: Migrations

## Examples
```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(uuid())
  email         String    @unique
  passwordHash  String?
  firstName     String
  lastName      String
  dateOfBirth   DateTime?
  nationality   String?
  gdprConsent   Boolean   @default(false)
  gdprConsentAt DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  deletedAt     DateTime? // Soft delete for GDPR

  applications  Application[]
  documents     Document[]
  oauthAccounts OAuthAccount[]

  @@index([email])
  @@index([deletedAt])
}

model Application {
  id          String    @id @default(uuid())
  userId      String
  programId   String
  status      String    @default("draft")
  progress    Int       @default(0)
  submittedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  user        User      @relation(fields: [userId], references: [id])
  program     Program   @relation(fields: [programId], references: [id])
  documents   Document[]
  statusHistory ApplicationStatusHistory[]

  @@unique([userId, programId])
  @@index([userId])
  @@index([status])
}

model ApplicationStatusHistory {
  id            String   @id @default(uuid())
  applicationId String
  oldStatus     String?
  newStatus     String
  changedBy     String?
  notes         String?
  createdAt     DateTime @default(now())

  application   Application @relation(fields: [applicationId], references: [id])

  @@index([applicationId])
}
```

```typescript
// src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { PrismaClient, Prisma } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' }
      ]
    })
  }

  async onModuleInit() {
    await this.$connect()
    
    // Soft delete middleware
    this.$use(async (params, next) => {
      if (params.model === 'User') {
        if (params.action === 'delete') {
          params.action = 'update'
          params.args['data'] = { deletedAt: new Date() }
        }
        if (params.action === 'deleteMany') {
          params.action = 'updateMany'
          if (params.args.data !== undefined) {
            params.args.data['deletedAt'] = new Date()
          } else {
            params.args['data'] = { deletedAt: new Date() }
          }
        }
        // Filter out soft-deleted by default
        if (params.action === 'findUnique' || params.action === 'findFirst') {
          params.action = 'findFirst'
          params.args.where['deletedAt'] = null
        }
        if (params.action === 'findMany') {
          if (params.args.where) {
            if (params.args.where.deletedAt === undefined) {
              params.args.where['deletedAt'] = null
            }
          } else {
            params.args['where'] = { deletedAt: null }
          }
        }
      }
      return next(params)
    })
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }

  // Transaction helper
  async executeInTransaction<T>(
    fn: (prisma: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    return this.$transaction(fn, {
      maxWait: 5000,
      timeout: 10000,
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    })
  }
}

// src/application/application.repository.ts
@Injectable()
export class ApplicationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserWithPrograms(
    userId: string,
    options: { status?: string; page: number; limit: number }
  ) {
    const { status, page, limit } = options
    const where: Prisma.ApplicationWhereInput = { userId }
    
    if (status) {
      where.status = status
    }

    const [applications, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        include: {
          program: {
            include: {
              university: true
            }
          },
          documents: {
            select: { id: true, documentType: true, fileName: true }
          }
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.application.count({ where })
    ])

    return { applications, total }
  }

  async submitWithHistory(
    id: string,
    userId: string
  ): Promise<Application> {
    return this.prisma.executeInTransaction(async (tx) => {
      // Get current application
      const application = await tx.application.findFirst({
        where: { id, userId }
      })

      if (!application) {
        throw new NotFoundException()
      }

      // Update status
      const updated = await tx.application.update({
        where: { id },
        data: {
          status: 'submitted',
          submittedAt: new Date()
        }
      })

      // Create history record
      await tx.applicationStatusHistory.create({
        data: {
          applicationId: id,
          oldStatus: application.status,
          newStatus: 'submitted',
          changedBy: userId
        }
      })

      return updated
    })
  }
}
```

## Validation
- Schema matches design
- Migrations run cleanly
- Queries are efficient
- Transactions used correctly
- Errors handled properly