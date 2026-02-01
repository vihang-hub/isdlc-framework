---
name: api-design
description: Design API structure, endpoint groups, and authentication strategy
skill_id: DISC-803
owner: architecture-designer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: When designing the API layer for a new project
dependencies: [DISC-801]
---

# API Design

## Purpose
Design the API structure including communication style, endpoint groupings, authentication strategy, and error response format. Produces a comprehensive API design specification that guides implementation of the project's interface layer.

## When to Use
- After architecture pattern selection when the communication approach needs definition
- When designing how clients will interact with the system's backend services
- Before directory scaffolding to inform route and controller organization

## Prerequisites
- PRD with functional requirements from DISC-703
- Architecture pattern selected from DISC-801
- Data model designed or in progress from DISC-802

## Process

### Step 1: Select API Style
Evaluate and select the primary API communication style based on requirements. Consider REST (resource-oriented, wide ecosystem support), GraphQL (flexible queries, reduced over-fetching), or gRPC (high performance, typed contracts, service-to-service). Document the selection rationale.

### Step 2: Group Endpoints by Domain
Organize API endpoints into logical groups based on business domains identified in the PRD. Each group represents a resource or capability area. Define the base path prefix for each group and any versioning strategy (path-based, header-based).

### Step 3: Define Key Endpoints
For each domain group, specify the primary endpoints with their HTTP methods, paths, request parameters, and response shapes. Cover the essential CRUD operations and any domain-specific actions. Include pagination, filtering, and sorting conventions.

### Step 4: Design Auth and Error Strategy
Select the authentication strategy — JWT tokens, OAuth2 flows, API keys, or session-based auth. Define which endpoints are public versus protected. Design a consistent error response format with error codes, messages, and field-level validation details.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| prd | object | Yes | PRD with functional requirements and user flows |
| architecture_pattern | string | Yes | Selected architecture pattern from DISC-801 |
| data_model | object | No | Entity definitions from DISC-802 if available |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| api_style | string | Selected API style with rationale |
| endpoint_groups | array | Grouped endpoints with methods, paths, and descriptions |
| auth_strategy | object | Authentication approach and protected endpoint rules |
| error_format | object | Standardized error response structure |

## Integration Points
- **architecture-pattern-selection**: Informs whether APIs are internal, external, or both
- **data-model-design**: Entity structure shapes request and response payloads
- **prd-generation**: Functional requirements define what endpoints are needed
- **directory-scaffolding**: Endpoint groups inform controller and route file organization

## Validation
- Every functional requirement in the PRD has supporting API endpoints
- Endpoint groups align with identified business domains
- Authentication strategy covers all protected resources
- Error format includes structured codes, messages, and validation details
