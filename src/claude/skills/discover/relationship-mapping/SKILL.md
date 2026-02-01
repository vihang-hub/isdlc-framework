---
name: relationship-mapping
description: Map entity relationships and data flow between stores
skill_id: DISC-503
owner: data-model-analyzer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: When mapping foreign keys, join tables, and cross-store data flow between entities
dependencies: [DISC-502]
---

# Relationship Mapping

## Purpose
Map all entity relationships including foreign keys, join tables, and ORM relationship decorators. Identifies relationship cardinality (1:1, 1:N, N:M) and traces data flow across different data stores.

## When to Use
- After schema extraction has produced the entity inventory
- When building entity-relationship diagrams for documentation
- When analyzing data coupling between services or stores

## Prerequisites
- Schema extraction has completed with entity definitions
- ORM model files are accessible for relationship decorator analysis
- Data store detection results are available for cross-store mapping

## Process

### Step 1: Extract Foreign Key Relationships
Parse schema files and migration history for explicit foreign key constraints. For each foreign key, record the source entity, source field, target entity, target field, and any cascade rules (ON DELETE, ON UPDATE).

### Step 2: Parse ORM Relationship Decorators
Analyze ORM-specific relationship declarations. For TypeORM, scan for @OneToOne, @OneToMany, @ManyToOne, @ManyToMany decorators. For Prisma, parse relation fields. For Django, find ForeignKey, OneToOneField, ManyToManyField. For SQLAlchemy, find relationship() calls.

### Step 3: Identify Join Tables
Detect explicit and implicit join tables for many-to-many relationships. For explicit join tables, extract the linking fields. For ORM-generated implicit join tables, infer the table name from the ORM's naming convention and record both sides of the relationship.

### Step 4: Determine Cardinality
Classify each relationship by cardinality: one-to-one (1:1), one-to-many (1:N), or many-to-many (N:M). Use foreign key uniqueness constraints and ORM decorator types as evidence. Record whether each side is required or optional.

### Step 5: Map Cross-Store Data Flow
When multiple data stores are detected, trace data flow patterns between them. Identify entities that are synchronized across stores (e.g., user data in SQL replicated to Elasticsearch for search). Map cache invalidation patterns and queue-based data pipelines.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| extracted_schemas | array | Yes | Entity definitions from schema extraction |
| orm_model_files | array | Yes | ORM model source files for decorator parsing |
| data_stores | array | No | Detected data stores for cross-store analysis |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| relationships | array | Relationship map with source, target, and cardinality |
| join_tables | array | Identified join tables with linking fields |
| er_diagram_data | object | Structured data for entity-relationship diagram generation |

## Integration Points
- **schema-extraction**: Receives entity definitions as primary input
- **data-store-detection**: Uses store information for cross-store flow analysis
- **data-model-analyzer**: Reports relationship map to orchestrating agent

## Validation
- All foreign keys are resolved to valid target entities
- Every relationship has a defined cardinality type
- Join tables are linked to exactly two parent entities
- No orphaned relationships reference non-existent entities
