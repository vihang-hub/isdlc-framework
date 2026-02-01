---
name: domain-mapping
description: Identify business domains and map features to domain boundaries
skill_id: DISC-604
owner: feature-mapper
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: When organizing discovered features into coherent business domain groupings
dependencies: [DISC-601, DISC-602, DISC-603]
---

# Domain Mapping

## Purpose
Analyze discovered endpoints, pages, and jobs to identify business domain boundaries and map each feature to its owning domain. Produces a domain map that reveals the system's bounded contexts and cross-domain dependencies.

## When to Use
- After endpoint, page, and job discovery to organize findings by business domain
- When assessing codebase modularity and identifying coupling between domains
- Before architecture refactoring to understand current domain boundaries

## Prerequisites
- Endpoint catalog from endpoint-discovery (DISC-601)
- Page catalog from page-discovery (DISC-602)
- Job catalog from job-discovery (DISC-603)
- Directory structure scan available for module grouping analysis

## Process

### Step 1: Analyze Module Groupings
Examine the directory structure and module organization to detect domain-oriented groupings. Look for top-level directories or module boundaries that correspond to business concepts such as auth, billing, inventory, notifications, or users.

### Step 2: Identify Domain Patterns from Naming
Scan endpoint paths, page routes, job names, and file names for recurring domain keywords. Cluster related features using naming conventions — for example, `/api/billing/*` endpoints, `billing/` pages, and `billing-*` jobs all belong to the billing domain.

### Step 3: Cluster Features by Domain
Assign each endpoint, page, and job to a domain based on module grouping and naming analysis. Handle ambiguous features by examining handler logic and data dependencies to determine the best-fit domain.

### Step 4: Map Domain Dependencies
Trace cross-domain calls, shared data models, and event flows to build a domain dependency graph. Identify tightly coupled domains that may benefit from clearer boundaries and loosely coupled domains that are well-separated.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| endpoint_catalog | array | Yes | Discovered API endpoints from DISC-601 |
| page_catalog | array | Yes | Discovered UI pages from DISC-602 |
| job_catalog | array | No | Discovered background jobs from DISC-603 |
| directory_structure | object | Yes | Project directory tree for module grouping analysis |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| domain_map | object | Domains with their assigned endpoints, pages, and jobs |
| domain_dependency_graph | object | Cross-domain dependency relationships |
| domain_summary | array | List of domains with feature counts and descriptions |

## Integration Points
- **endpoint-discovery**: Provides the endpoint catalog as input for domain clustering
- **page-discovery**: Provides the page catalog as input for domain clustering
- **job-discovery**: Provides the job catalog as input for domain clustering
- **gap-identification**: Uses domain map to detect missing features within domains

## Validation
- Every discovered endpoint, page, and job is assigned to exactly one domain
- Domain boundaries align with the module structure in the codebase
- Cross-domain dependencies are documented with directionality
