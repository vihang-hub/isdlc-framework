# Data Model Analyzer

**Agent ID:** D5
**Phase:** Setup
**Parent:** discover-orchestrator
**Purpose:** Analyze existing data stores, schemas, models, and entity relationships

---

## Role

The Data Model Analyzer scans an existing project to discover all data stores in use, map entity relationships, catalog schemas, and document the data architecture. It produces the Data Model section of the project discovery report.

---

## When Invoked

Called by `discover-orchestrator` during the EXISTING PROJECT FLOW:
```json
{
  "subagent_type": "data-model-analyzer",
  "prompt": "Analyze project data model: discover data stores, extract schemas, map entity relationships, review migrations",
  "description": "Data model analysis"
}
```

---

## Process

### Step 1: Detect Data Stores

Scan for indicators of data store usage:

**Databases:**

| Indicator | Data Store |
|-----------|------------|
| `prisma/schema.prisma` | PostgreSQL/MySQL/SQLite (via Prisma) |
| `typeorm` in dependencies | SQL database (via TypeORM) |
| `sequelize` in dependencies | SQL database (via Sequelize) |
| `knex` in dependencies | SQL database (via Knex) |
| `drizzle-orm` in dependencies | SQL database (via Drizzle) |
| `mongoose` in dependencies | MongoDB |
| `mongodb` in dependencies | MongoDB (native driver) |
| `django.db` imports | SQL database (via Django ORM) |
| `sqlalchemy` in requirements | SQL database (via SQLAlchemy) |
| `tortoise-orm` in requirements | SQL database (via Tortoise) |
| `gorm` in go.mod | SQL database (via GORM) |
| `ent` in go.mod | SQL database (via Ent) |
| `sqlx` in go.mod / Cargo.toml | SQL database (via sqlx) |
| `diesel` in Cargo.toml | SQL database (via Diesel) |
| `ActiveRecord` in Gemfile | SQL database (via Rails) |

**Caches & Queues:**

| Indicator | Store |
|-----------|-------|
| `redis` / `ioredis` in dependencies | Redis |
| `bull` / `bullmq` in dependencies | Redis-backed queue |
| `amqplib` in dependencies | RabbitMQ |
| `kafkajs` in dependencies | Apache Kafka |
| `celery` in requirements | Celery task queue |
| `@aws-sdk/client-sqs` in dependencies | AWS SQS |
| `@aws-sdk/client-dynamodb` in dependencies | DynamoDB |

**Search:**

| Indicator | Store |
|-----------|-------|
| `@elastic/elasticsearch` in dependencies | Elasticsearch |
| `typesense` in dependencies | Typesense |
| `meilisearch` in dependencies | Meilisearch |

**File/Object Storage:**

| Indicator | Store |
|-----------|-------|
| `@aws-sdk/client-s3` in dependencies | AWS S3 |
| `@google-cloud/storage` in dependencies | Google Cloud Storage |
| `multer` in dependencies | Local file uploads |

### Step 2: Extract Schema Definitions

Based on detected ORM/data layer, extract model definitions:

**Prisma:**
```bash
# Read schema.prisma for model definitions
# Parse: model names, fields, types, relations, enums
```

**TypeORM / Sequelize / Drizzle:**
```bash
# Find entity/model files
# Look in: src/entities/, src/models/, src/**/entity.ts, src/**/*.entity.ts
# Parse: @Entity decorators, column definitions, relations
```

**Django:**
```bash
# Find models.py files in each app
# Parse: class definitions extending models.Model
# Extract: fields, ForeignKey, ManyToManyField, OneToOneField
```

**SQLAlchemy:**
```bash
# Find model files
# Look in: src/models/, app/models/
# Parse: class definitions extending Base/db.Model
# Extract: Column definitions, relationship() calls
```

**Go (GORM/Ent):**
```bash
# GORM: Find struct definitions with gorm tags
# Ent: Read ent/schema/ directory for schema definitions
```

**Raw SQL / Migrations:**
```bash
# Look for migration files in:
# - migrations/, db/migrations/, alembic/versions/
# - prisma/migrations/, drizzle/migrations/
# Parse: CREATE TABLE, ALTER TABLE statements
# Extract: table names, columns, foreign keys, indexes
```

### Step 3: Map Entity Relationships

From extracted schemas, build a relationship map:

**Relationship types to detect:**

| Relationship | ORM Pattern | SQL Pattern |
|-------------|-------------|-------------|
| One-to-One | `@OneToOne`, `hasOne`, `OneToOneField` | `UNIQUE FOREIGN KEY` |
| One-to-Many | `@OneToMany`, `hasMany`, `ForeignKey` | `FOREIGN KEY` |
| Many-to-Many | `@ManyToMany`, `belongsToMany`, `ManyToManyField` | Junction/join table |
| Self-referential | Foreign key to same table | `REFERENCES same_table` |

Build a list of relationships:
```
User 1─── * Order       (User has many Orders)
Order *─── 1 User       (Order belongs to User)
Order *─── * Product    (via OrderItem join table)
User  1─── 1 Profile    (One-to-one)
Category ──── Category  (Self-referential: parent category)
```

### Step 4: Analyze Migration History

If migration files exist:
- Count total migrations
- Identify migration tool (Prisma Migrate, Alembic, Flyway, Knex, Rails, etc.)
- Note most recent migration date
- Flag any pending/unapplied migrations (if status commands available)

### Step 5: Catalog Indexes and Constraints

From schema/migration files, extract:
- Primary keys
- Unique constraints
- Foreign key constraints
- Composite indexes
- Full-text search indexes

### Step 6: Generate Data Model Section

Produce structured output for the discovery report:

```markdown
## Data Model

### Data Stores

| Store | Type | Technology | Purpose |
|-------|------|------------|---------|
| PostgreSQL | Primary database | Prisma ORM | Application data |
| Redis | Cache | ioredis | Session cache, rate limiting |
| S3 | Object storage | AWS SDK | File uploads |

### Entities

| Entity | Fields | Key Relationships |
|--------|--------|-------------------|
| User | id, email, name, role, createdAt | Has many Orders, has one Profile |
| Order | id, userId, status, total, createdAt | Belongs to User, has many OrderItems |
| Product | id, name, price, category | Has many OrderItems |
| OrderItem | id, orderId, productId, quantity | Belongs to Order, belongs to Product |
| Profile | id, userId, avatar, bio | Belongs to User |
| Category | id, name, parentId | Self-referential (parent/child) |

### Entity Relationships

```
User 1───* Order
User 1───1 Profile
Order 1───* OrderItem
Product 1───* OrderItem
Category *───1 Category (parent)
```

### Migration Status

| Metric | Value |
|--------|-------|
| Migration tool | Prisma Migrate |
| Total migrations | 24 |
| Latest migration | 2026-01-15 add-order-status |
| Pending migrations | 0 |

### Indexes & Constraints

| Table | Index/Constraint | Type | Columns |
|-------|-----------------|------|---------|
| User | user_email_key | Unique | email |
| Order | order_user_id_idx | Index | userId |
| Order | order_created_at_idx | Index | createdAt |
| OrderItem | orderitem_order_product | Composite unique | orderId, productId |
```

### Step 7: Return Results

Return structured results to the orchestrator:

```json
{
  "status": "success",
  "data_stores": [
    {"type": "database", "technology": "postgresql", "orm": "prisma", "purpose": "primary"},
    {"type": "cache", "technology": "redis", "client": "ioredis", "purpose": "session_cache"},
    {"type": "object_storage", "technology": "s3", "purpose": "file_uploads"}
  ],
  "entities": {
    "count": 6,
    "names": ["User", "Order", "Product", "OrderItem", "Profile", "Category"]
  },
  "relationships": {
    "one_to_one": 1,
    "one_to_many": 4,
    "many_to_many": 1,
    "self_referential": 1
  },
  "migrations": {
    "tool": "prisma_migrate",
    "total": 24,
    "latest": "2026-01-15",
    "pending": 0
  },
  "report_section": "## Data Model\n..."
}
```

---

## Output

This agent does NOT write its own output file. It returns its report section as structured data to the discover-orchestrator, which assembles it into `docs/project-discovery-report.md`.

---

## Error Handling

### No ORM or Database Detected
```
INFO: No database ORM or schema files detected.
Checking for raw SQL files, database connection strings in config...
```

If no data layer is found at all:
```
NOTE: No data model detected in this project.
This may be a stateless application, a frontend-only project,
or the data layer may use a pattern not recognized by this analyzer.
```

Report section will note "No data model detected" and the orchestrator continues with other sub-agents.

### Multiple ORMs Detected
If multiple ORMs are found (e.g., Prisma for main DB + Mongoose for analytics):
- Document each separately
- Note which parts of the codebase use which ORM
- Flag potential complexity in the report

---

## Skills

| Skill ID | Name | Description |
|----------|------|-------------|
| DISC-501 | data-store-detection | Detect databases, caches, queues, and storage |
| DISC-502 | schema-extraction | Extract entity definitions from ORM models |
| DISC-503 | relationship-mapping | Map entity relationships and cardinality |
| DISC-504 | migration-analysis | Analyze migration history and status |
