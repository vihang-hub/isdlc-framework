---
name: data-model-design
description: Design database schema and entity relationships for new projects
skill_id: DISC-802
owner: architecture-designer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: When designing the data model and database schema for a new project
dependencies: [DISC-801]
---

# Data Model Design

## Purpose
Design the database schema and entity relationships based on PRD data requirements and the selected architecture pattern. Produces entity definitions, relationship mappings, and index recommendations that serve as the blueprint for database implementation.

## When to Use
- After architecture pattern selection when the data storage strategy is established
- When PRD data requirements need to be translated into a concrete schema
- Before API design to ensure data structures support the required operations

## Prerequisites
- PRD with data requirements and core entity descriptions from DISC-703
- Architecture pattern selected from DISC-801 to inform storage strategy
- Database technology selected as part of the tech stack

## Process

### Step 1: Extract Entities from PRD
Identify all data entities referenced in the PRD — user-facing objects, system objects, and reference data. For each entity, extract fields with their data types, required versus optional status, and any default values or constraints mentioned in requirements.

### Step 2: Define Relationships and Cardinality
Establish relationships between entities — one-to-one, one-to-many, and many-to-many. Define foreign key references and junction tables where needed. Document relationship cardinality, optional versus required participation, and cascade behavior for updates and deletes.

### Step 3: Design Indexes for Query Patterns
Analyze the functional requirements to identify common query patterns — lookups by ID, searches by field, filtered listings, and aggregation queries. Recommend indexes that support these patterns, including composite indexes for multi-field queries and unique constraints for business rules.

### Step 4: Document in ER Diagram Format
Compile the complete data model into a structured format showing entities, fields, types, relationships, and indexes. Use a text-based ER notation that can be rendered as a diagram or read as documentation.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| prd | object | Yes | PRD with data requirements and core entities |
| selected_database | string | Yes | Database technology (PostgreSQL, MongoDB, etc.) |
| architecture_pattern | string | Yes | Selected architecture pattern from DISC-801 |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| entity_definitions | array | Entities with fields, types, and constraints |
| relationship_map | object | Entity relationships with cardinality and keys |
| index_recommendations | array | Recommended indexes for common query patterns |

## Integration Points
- **architecture-pattern-selection**: Informs whether data is centralized or distributed
- **prd-generation**: Provides data requirements and entity descriptions
- **api-design**: Data model shapes API request and response structures
- **directory-scaffolding**: Entity definitions inform model file generation

## Validation
- Every data entity mentioned in the PRD has a corresponding entity definition
- All relationships include cardinality and foreign key specifications
- Index recommendations cover the primary query patterns from functional requirements
- Field types are appropriate for the selected database technology
