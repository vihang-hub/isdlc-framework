---
name: migration-analysis
description: Analyze database migration history and schema evolution
skill_id: DISC-504
owner: data-model-analyzer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: When analyzing migration files to understand schema evolution and identify risks
dependencies: [DISC-501]
---

# Migration Analysis

## Purpose
Analyze the database migration history to understand schema evolution over time. Identifies destructive migrations, assesses migration health, and provides a timeline of schema changes to inform architecture decisions.

## When to Use
- After data store detection has located migration directories
- When assessing database schema stability and evolution patterns
- When evaluating migration practices for constitution requirements

## Prerequisites
- Data store detection has identified migration directories
- Migration files are accessible and readable
- ORM framework type is known for correct migration file parsing

## Process

### Step 1: Discover Migration Files
Locate all migration files within the project. Search standard locations by ORM: Prisma (prisma/migrations/), TypeORM (src/migrations/ or migrations/), Django (*/migrations/), SQLAlchemy (alembic/versions/), Sequelize (migrations/), and raw SQL migration directories.

### Step 2: Parse Migration Chronology
Read migration files in chronological order based on timestamps or sequence numbers embedded in filenames. For each migration, extract: timestamp, name/description, the up (apply) operations, and the down (rollback) operations if present.

### Step 3: Identify Destructive Changes
Flag migrations that contain destructive operations: column drops, table drops, type narrowing (e.g., varchar(255) to varchar(100)), NOT NULL additions without defaults, and index removals. Classify severity as warning (reversible) or critical (data loss risk).

### Step 4: Assess Migration Health
Calculate migration health metrics: total migration count, average time between migrations, percentage of migrations with rollback support, number of destructive migrations, and longest gap between migrations. Compare against baseline thresholds for project age.

### Step 5: Generate Timeline Report
Produce a chronological timeline of significant schema changes. Highlight periods of high migration activity, destructive changes, and any migrations that were later reverted. Include a health summary with actionable recommendations.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| migration_directory | string | Yes | Path to the migration files directory |
| orm_framework | string | No | ORM framework name for parsing strategy selection |
| project_age_months | number | No | Project age for health threshold calibration |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| migration_count | number | Total number of migration files found |
| migration_timeline | array | Chronological list of migrations with details |
| destructive_warnings | array | Flagged destructive migrations with severity |
| health_summary | object | Migration health metrics and recommendations |

## Integration Points
- **data-store-detection**: Receives migration directory paths and ORM framework type
- **schema-extraction**: Shares migration files for supplemental schema information
- **data-model-analyzer**: Reports migration analysis to orchestrating agent

## Validation
- All migration files in the directory were parsed successfully
- Destructive changes are correctly classified by severity
- Timeline is in correct chronological order
- Health metrics are calculated against appropriate thresholds
