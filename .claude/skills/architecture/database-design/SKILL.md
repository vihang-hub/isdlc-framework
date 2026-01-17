---
name: database-design
description: Design database schemas and select appropriate database types
skill_id: ARCH-003
owner: architecture
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: System design, data modeling, schema changes
dependencies: [ARCH-001, ARCH-002]
---

# Database Design

## Purpose
Design database schemas that efficiently support application requirements, ensure data integrity, optimize for query patterns, and scale appropriately.

## When to Use
- Initial database design
- New feature requiring schema changes
- Performance optimization
- Data model evolution

## Prerequisites
- Domain entities understood
- Data relationships identified
- Query patterns known
- Performance requirements defined

## Process

### Step 1: Identify Entities
```
From requirements, identify:
- Core entities (users, programs, applications)
- Relationships (user applies to program)
- Attributes for each entity
- Required vs optional fields
```

### Step 2: Define Relationships
```
Relationship types:
- One-to-One (User ↔ Profile)
- One-to-Many (User → Applications)
- Many-to-Many (Users ↔ Programs via Favorites)

For each relationship:
- Cardinality
- Required/optional
- Cascade behavior
```

### Step 3: Create Entity-Relationship Diagram
```
ERD showing:
- All entities as boxes
- Attributes listed
- Relationships as lines
- Cardinality notation
- Primary keys highlighted
```

### Step 4: Define Schema Details
```
For each table:
- Column names and types
- Primary key
- Foreign keys
- Indexes
- Constraints (unique, check, not null)
- Default values
```

### Step 5: Optimize for Queries
```
Optimization steps:
- Identify hot query paths
- Add indexes for common filters
- Consider denormalization for read-heavy
- Plan partitioning for large tables
- Design for common JOINs
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| requirements | Markdown | Yes | Data requirements |
| domain_model | Markdown | Optional | Domain entities |
| query_patterns | Markdown | Optional | Expected queries |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| database_schema.sql | SQL | DDL statements |
| erd.mermaid | Mermaid | ER diagram |
| index_strategy.md | Markdown | Indexing plan |

## Project-Specific Considerations
- User PII requires encryption notation
- Application status history (audit trail)
- Document storage references (S3 URLs)
- External IDs for university/program mapping
- GDPR deletion requirements (soft delete vs hard delete)

## Integration Points
- **Developer Agent**: Migration implementation
- **Security Agent**: PII field identification
- **DevOps Agent**: Database provisioning

## Examples
```
Database Schema - SDLC Framework

-- Users (PII - encrypted fields marked)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL, -- PII
  email_verified BOOLEAN DEFAULT FALSE,
  password_hash VARCHAR(255), -- nullable for OAuth
  first_name VARCHAR(100), -- PII
  last_name VARCHAR(100), -- PII
  date_of_birth DATE, -- PII
  nationality VARCHAR(100), -- PII
  gdpr_consent BOOLEAN DEFAULT FALSE,
  gdpr_consent_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP -- soft delete for GDPR
);

-- Universities (external data)
CREATE TABLE universities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id VARCHAR(100) UNIQUE, -- from API
  name VARCHAR(255) NOT NULL,
  country VARCHAR(100) NOT NULL,
  city VARCHAR(100),
  website_url VARCHAR(500),
  logo_url VARCHAR(500),
  data_source VARCHAR(50), -- which API
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Programs
CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID REFERENCES universities(id),
  external_id VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  degree_level VARCHAR(50), -- bachelor, master, etc
  field_of_study VARCHAR(100),
  duration_months INTEGER,
  language VARCHAR(50),
  tuition_amount DECIMAL(10,2),
  tuition_currency VARCHAR(3),
  application_deadline DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Applications
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  program_id UUID REFERENCES programs(id),
  status VARCHAR(50) DEFAULT 'draft',
  submitted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, program_id)
);

-- Application Status History (audit trail)
CREATE TABLE application_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id),
  old_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  changed_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Documents
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  application_id UUID REFERENCES applications(id),
  document_type VARCHAR(50) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  storage_url VARCHAR(500) NOT NULL, -- S3 URL
  uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_programs_university ON programs(university_id);
CREATE INDEX idx_programs_country ON programs(university_id, field_of_study);
CREATE INDEX idx_applications_user ON applications(user_id);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_documents_application ON documents(application_id);
```

## Validation
- All entities from requirements represented
- Relationships correctly modeled
- Primary and foreign keys defined
- Indexes cover main query patterns
- PII fields identified
- GDPR compliance considered (soft delete)