---
name: data-store-detection
description: Detect all data stores used by the project
skill_id: DISC-501
owner: data-model-analyzer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: When identifying all databases, caches, queues, and search engines used by the project
dependencies: []
---

# Data Store Detection

## Purpose
Scan the project to detect all data stores in use, including relational databases, NoSQL databases, caching layers, message queues, and search engines. Classifies each store by type to guide downstream schema extraction and analysis.

## When to Use
- At the start of data model analysis for a project
- When the project's data infrastructure is unknown
- When auditing data store usage across the codebase

## Prerequisites
- Project root directory is accessible for scanning
- Configuration files and environment files are readable
- Package manifest files (package.json, requirements.txt, etc.) are available

## Process

### Step 1: Scan Configuration Files
Search for database configuration in common locations: environment files (.env, .env.local), config directories, Docker Compose files, and infrastructure-as-code files (Terraform, CloudFormation). Extract connection strings, host references, and port numbers.

### Step 2: Detect Database Clients
Scan package manifests and import statements for database client libraries. Identify SQL databases (pg, mysql2, sqlite3, mssql), NoSQL databases (mongoose, mongodb, dynamodb-client, cassandra-driver), and ORM frameworks (Prisma, TypeORM, Sequelize, Django ORM, SQLAlchemy).

### Step 3: Detect Caches and Queues
Search for cache client imports and configuration: Redis (ioredis, redis, jedis), Memcached (memcached, pylibmc). Detect message queue connections: RabbitMQ (amqplib), Kafka (kafkajs), SQS (aws-sdk), Bull/BullMQ for job queues.

### Step 4: Detect Search Engines
Identify search engine integrations: Elasticsearch (@elastic/elasticsearch), OpenSearch, Solr, Meilisearch, Algolia. Check for search-related configuration files and index definitions.

### Step 5: Classify and Report
Classify each detected store into categories: SQL, NoSQL, cache, queue, or search. Record the specific technology, detected version if available, and the files where evidence was found.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| project_root | string | Yes | Path to the project root directory |
| config_files | array | No | Known configuration file paths |
| environment_files | array | No | Environment variable file paths |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| data_stores | array | List of detected stores with type (SQL/NoSQL/cache/queue/search) |
| store_evidence | object | Files and patterns that identified each store |
| orm_frameworks | array | Detected ORM or ODM frameworks in use |

## Integration Points
- **schema-extraction**: Provides store types and ORM frameworks to guide schema parsing
- **relationship-mapping**: Informs which stores to analyze for cross-store data flow
- **data-model-analyzer**: Reports detection results to orchestrating agent

## Validation
- All common configuration locations were scanned
- Each detected store has supporting evidence (file path and pattern)
- Store types are correctly classified into the five categories
- No false positives from commented-out or test-only configurations
