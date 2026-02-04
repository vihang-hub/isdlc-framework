---
name: job-handler-discovery
description: Discover existing and new background jobs/handlers for feature implementation
skill_id: IA-203
owner: entry-point-finder
collaborators: []
project: isdlc
version: 1.0.0
when_to_use: During M2 Entry Point analysis to find background job entry points
dependencies: []
---

# Job Handler Discovery

## Purpose
Discover existing background jobs, scheduled tasks, and queue handlers that relate to the feature and identify new jobs that need to be created based on acceptance criteria.

## When to Use
- Finding existing background processing
- Planning new jobs/workers
- Understanding async entry points
- Mapping acceptance criteria to jobs

## Prerequisites
- Finalized requirements with acceptance criteria
- Discovery report with job inventory
- Job/worker file locations known

## Process

### Step 1: Search Existing Jobs
```
For each acceptance criterion:
1. Search job/worker files
2. Check scheduled task definitions
3. Find queue processor handlers
4. Note cron schedules if applicable
```

### Step 2: Classify Relevance
```
For each found job:
- HIGH: Directly supports acceptance criterion
- MEDIUM: Can be extended for AC
- LOW: Tangentially related

Map each job to specific AC(s).
```

### Step 3: Identify New Jobs
```
For ACs requiring background processing:
1. Suggest job type (scheduled, queue, cron)
2. Define trigger conditions
3. Identify data inputs needed
4. Note error handling requirements
```

### Step 4: Document Findings
```
Return:
- Existing jobs with AC mapping
- Suggested new jobs
- Queue/scheduling requirements
- Error handling patterns
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| acceptance_criteria | Array | Yes | List of ACs from requirements |
| discovery_report | Object | No | Job inventory from discovery |
| job_patterns | Object | No | Project's job conventions |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| existing_jobs | Array | Found jobs with AC mapping |
| new_jobs | Array | Suggested new jobs |
| scheduling | Array | Schedule/trigger requirements |
| queue_config | Object | Queue configuration needs |

## Validation
- Async ACs have job coverage
- Jobs follow project patterns
- Scheduling requirements clear
- AC mapping complete
