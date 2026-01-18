---
name: api-contract-design
description: Design API contracts using OpenAPI specification
skill_id: DES-002
owner: system-designer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Before API implementation, for external integrations
dependencies: [DES-001]
---

# API Contract Design

## Purpose
Define clear, consistent API contracts using OpenAPI 3.0 specification that serve as the source of truth for implementation.

## When to Use
- Before API implementation
- For external integrations
- When documenting existing APIs
- API versioning

## Prerequisites
- Module design complete
- Data models defined
- Authentication approach known

## Process

### Step 1: Define Resources
```
Resource identification:
- Core entities (users, applications)
- Sub-resources (application documents)
- Actions (submit, approve)
```

### Step 2: Design Endpoints
```
RESTful design:
- GET /resources - list
- GET /resources/:id - get one
- POST /resources - create
- PUT /resources/:id - update
- DELETE /resources/:id - delete
- POST /resources/:id/action - actions
```

### Step 3: Define Request/Response Schemas
```
Schema design:
- Request DTOs
- Response DTOs
- Error responses
- Pagination
```

### Step 4: Document Authentication
```
Auth documentation:
- Auth methods
- Required scopes
- Token format
```

### Step 5: Write OpenAPI Spec
```
Specification includes:
- Info and servers
- Paths and operations
- Schemas
- Security
- Examples
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| module_specs | Markdown | Yes | Module designs |
| data_models | TypeScript | Yes | Entity definitions |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| openapi.yaml | YAML | API specification |
| api_docs/ | Markdown | Additional docs |

## Project-Specific Considerations
- JWT Bearer authentication
- Consistent error format
- Pagination for lists
- Versioning (/api/v1/)

## Integration Points
- **Developer Agent**: Implementation guide
- **Test Manager**: Contract testing
- **Documentation Agent**: API docs

## Examples
```yaml
openapi: 3.0.3
info:
  title: Project API
  version: 1.0.0
  description: API for study abroad application management

servers:
  - url: https://api.example.com/v1
    description: Production

security:
  - bearerAuth: []

paths:
  /applications:
    get:
      summary: List user's applications
      tags: [Applications]
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [draft, submitted, under_review, accepted, rejected]
        - $ref: '#/components/parameters/Page'
        - $ref: '#/components/parameters/Limit'
      responses:
        '200':
          description: List of applications
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ApplicationListResponse'
        '401':
          $ref: '#/components/responses/Unauthorized'

    post:
      summary: Create new application
      tags: [Applications]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateApplicationRequest'
      responses:
        '201':
          description: Application created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ApplicationResponse'
        '400':
          $ref: '#/components/responses/BadRequest'

components:
  schemas:
    Application:
      type: object
      properties:
        id:
          type: string
          format: uuid
        programId:
          type: string
          format: uuid
        status:
          type: string
          enum: [draft, submitted, under_review, accepted, rejected]
        progress:
          type: integer
          minimum: 0
          maximum: 100
        submittedAt:
          type: string
          format: date-time
          nullable: true
        createdAt:
          type: string
          format: date-time

    ErrorResponse:
      type: object
      properties:
        success:
          type: boolean
          example: false
        error:
          type: object
          properties:
            code:
              type: string
              example: VAL_INVALID_INPUT
            message:
              type: string
            details:
              type: array
              items:
                type: object

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

## Validation
- All endpoints documented
- Schemas complete
- Examples provided
- Consistent naming
- Error responses defined