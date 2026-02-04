---
name: api-endpoint-discovery
description: Discover existing and new API endpoints for feature implementation
skill_id: IA-201
owner: entry-point-finder
collaborators: []
project: isdlc
version: 1.0.0
when_to_use: During M2 Entry Point analysis to find API entry points
dependencies: []
---

# API Endpoint Discovery

## Purpose
Discover existing API endpoints that relate to the feature and identify new endpoints that need to be created based on acceptance criteria from finalized requirements.

## When to Use
- Finding existing API routes for feature
- Planning new API endpoints
- Understanding API entry point landscape
- Mapping acceptance criteria to endpoints

## Prerequisites
- Finalized requirements with acceptance criteria
- Discovery report with API inventory
- Route/controller file locations known

## Process

### Step 1: Search Existing Endpoints
```
For each acceptance criterion:
1. Search route files for related paths
2. Check OpenAPI/Swagger definitions
3. Find controller methods matching AC
4. Note authentication requirements
```

### Step 2: Classify Relevance
```
For each found endpoint:
- HIGH: Directly supports acceptance criterion
- MEDIUM: Can be extended for AC
- LOW: Tangentially related

Map each endpoint to specific AC(s).
```

### Step 3: Identify New Endpoints
```
For ACs without existing endpoints:
1. Suggest RESTful path convention
2. Determine HTTP methods needed
3. Note authentication requirements
4. Identify request/response schemas
```

### Step 4: Document Findings
```
Return:
- Existing endpoints with AC mapping
- Suggested new endpoints
- Extension recommendations
- Integration points
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| acceptance_criteria | Array | Yes | List of ACs from requirements |
| discovery_report | Object | No | API inventory from discovery |
| route_patterns | Object | No | Project's routing conventions |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| existing_endpoints | Array | Found endpoints with AC mapping |
| new_endpoints | Array | Suggested new endpoints |
| extensions | Array | Endpoints to extend |
| relevance_scores | Object | Per-endpoint relevance |

## Validation
- All ACs have at least one endpoint (existing or new)
- Endpoints follow project conventions
- Relevance correctly classified
- AC mapping complete
