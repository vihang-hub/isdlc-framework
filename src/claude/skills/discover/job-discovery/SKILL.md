---
name: job-discovery
description: Catalog background jobs, workers, and scheduled tasks
skill_id: DISC-603
owner: feature-mapper
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: When mapping an existing codebase to understand its background processing
dependencies: []
---

# Job Discovery

## Purpose
Scan source code to catalog all background jobs, queue workers, and scheduled tasks. Produces a structured inventory of asynchronous processing with schedules, queue names, and operational purpose.

## When to Use
- During initial discovery to understand background processing in the system
- When auditing scheduled tasks for reliability or monitoring gaps
- Before migrating infrastructure to ensure all async work is accounted for

## Prerequisites
- Source code access to worker files, job definitions, and cron configurations
- Infrastructure configuration files accessible (docker-compose, Procfile, task scheduler configs)

## Process

### Step 1: Scan for Job Definitions
Search for queue consumer registrations (Bull/BullMQ processors, Celery tasks, Sidekiq workers, AWS Lambda handlers, Go worker goroutines), cron schedule definitions (node-cron, crontab files, CloudWatch Events), and any recurring task patterns.

### Step 2: Extract Job Metadata
For each discovered job, capture the job name or identifier, the queue or topic it consumes from, the schedule expression if time-based, retry and timeout configuration, and the handler function that executes the work.

### Step 3: Determine Job Purpose
Analyze the handler logic to classify each job by purpose — data synchronization, notification dispatch, cleanup or maintenance, report generation, webhook processing, or other categories. Note any external service dependencies.

### Step 4: Compile Job Catalog
Assemble all discovered jobs into a structured catalog grouped by type (scheduled, queue-driven, event-driven), including name, schedule, queue, handler, purpose, and retry configuration.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| source_code | directory | Yes | Worker files, job definitions, and task handlers |
| infra_config | directory | No | Docker, Procfile, or scheduler configuration files |
| tech_stack | object | Yes | Identified framework and queue system from tech detection |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| job_catalog | array | List of jobs with name, schedule, queue, handler, and purpose |
| job_count | number | Total number of discovered background jobs |
| queue_summary | object | Summary of queues and the jobs that consume from them |

## Integration Points
- **tech-detection**: Provides framework and queue system context for targeting job patterns
- **domain-mapping**: Consumes job catalog to associate jobs with business domains
- **dependency-analysis**: Cross-references job dependencies on external services

## Validation
- Every job definition and worker registration has a corresponding catalog entry
- Schedules are accurately captured in their original format (cron expressions, intervals)
- Queue names and retry configurations match the source code definitions
