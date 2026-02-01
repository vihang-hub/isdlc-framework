---
name: endpoint-discovery
description: Catalog all API endpoints with methods, paths, and handlers
skill_id: DISC-601
owner: feature-mapper
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: When mapping an existing codebase to understand its API surface area
dependencies: []
---

# Endpoint Discovery

## Purpose
Scan source code to catalog every API endpoint, capturing HTTP methods, route paths, handler functions, and authentication requirements. Produces a comprehensive endpoint inventory for downstream domain mapping and gap analysis.

## When to Use
- During initial codebase discovery to understand the full API surface
- When onboarding to an unfamiliar project that exposes HTTP APIs
- Before refactoring or migrating APIs to ensure complete coverage

## Prerequisites
- Source code access to controllers, route files, and handler modules
- Tech stack identified so the correct routing patterns can be targeted

## Process

### Step 1: Identify Routing Framework
Detect the routing mechanism in use — Express router files, NestJS controller decorators, FastAPI route decorators, Go HTTP handler registrations, Rails routes, or similar. Determine where route definitions live in the directory structure.

### Step 2: Extract Route Definitions
Parse each route definition to capture the HTTP method (GET, POST, PUT, DELETE, PATCH), the URL path including parameters, and the handler function or method that services the request. Resolve path prefixes from routers, controllers, or blueprint mounts.

### Step 3: Identify Middleware and Guards
For each endpoint, detect attached middleware such as authentication guards, rate limiters, validation layers, and CORS configuration. Note which endpoints are public versus protected.

### Step 4: Compile Endpoint Catalog
Assemble all discovered endpoints into a structured catalog grouped by resource or controller, including method, full path, handler reference, middleware chain, and any inline documentation or annotations.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| source_code | directory | Yes | Controllers, route files, and handler modules |
| tech_stack | object | Yes | Identified framework and language from tech detection |
| base_path | string | No | API base path prefix if known |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| endpoint_catalog | array | List of endpoints with method, path, handler, and auth requirements |
| route_count | number | Total number of discovered endpoints |
| auth_summary | object | Summary of authentication patterns found across endpoints |

## Integration Points
- **tech-detection**: Provides framework context to target correct routing patterns
- **domain-mapping**: Consumes endpoint catalog to cluster endpoints by business domain
- **gap-identification**: Uses endpoint catalog to detect missing CRUD operations or inconsistencies

## Validation
- Every route registration in the codebase has a corresponding catalog entry
- HTTP methods and paths are accurate and include resolved prefixes
- Middleware and auth requirements are captured for each endpoint
