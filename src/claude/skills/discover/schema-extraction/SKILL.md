---
name: schema-extraction
description: Extract database schemas and ORM model definitions
skill_id: DISC-502
owner: data-model-analyzer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: When parsing ORM models, schema files, and migrations to extract entity definitions
dependencies: [DISC-501]
---

# Schema Extraction

## Purpose
Extract database schemas and entity definitions from ORM model files, schema definition files, and migration history. Produces a normalized list of entities with their fields, data types, and constraints.

## When to Use
- After data store detection has identified the ORM frameworks in use
- When building a comprehensive data model inventory for the project
- When analyzing entity structures for architecture documentation

## Prerequisites
- Data store detection has identified ORM frameworks and database types
- Model directories and schema files are accessible
- Migration files are available for schema history analysis

## Process

### Step 1: Identify Schema Sources
Based on the detected ORM framework, locate the primary schema source files. For Prisma, find schema.prisma. For TypeORM, scan for entity classes with decorators. For Django, find models.py files. For SQLAlchemy, locate model classes extending Base. For raw SQL, find migration files.

### Step 2: Parse Entity Definitions
Parse each schema source to extract entity (table/collection) definitions. For each entity, extract: entity name, field names, field data types, nullability constraints, default values, unique constraints, and index definitions.

### Step 3: Extract Field Constraints
Identify additional field-level constraints: primary keys, auto-increment fields, string length limits, numeric precision, enum types and values, JSON field schemas, and computed or virtual fields.

### Step 4: Parse GraphQL Types
If GraphQL type definitions are present (.graphql files or type-defs in code), extract type definitions, field types, required vs optional fields, and custom scalar types. Map GraphQL types to corresponding database entities where possible.

### Step 5: Normalize Output
Normalize all extracted entities into a consistent format regardless of the source ORM. Each entity includes: name, source file, field list with types and constraints, primary key fields, and any table-level constraints or indexes.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| orm_config_files | array | Yes | ORM configuration and schema file paths |
| model_directories | array | Yes | Directories containing model definitions |
| migration_files | array | No | Database migration file paths |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| entities | array | List of entities with fields, types, and constraints |
| field_count | number | Total number of fields across all entities |
| source_mapping | object | Maps each entity to its source file |

## Integration Points
- **data-store-detection**: Receives ORM framework and store type information
- **relationship-mapping**: Provides entity definitions for relationship extraction
- **migration-analysis**: Shares migration files for historical analysis

## Validation
- All identified schema source files were successfully parsed
- Every entity has at least one field and a primary key
- Field types are normalized to a consistent type system
- No parsing errors were silently skipped
