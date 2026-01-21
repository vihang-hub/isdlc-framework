---
name: api-architecture
description: Design API structure, versioning, and contracts
skill_id: ARCH-004
owner: solution-architect
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: API design, integration planning, contract definition
dependencies: [ARCH-001]
---

# API Architecture

## Purpose
Design the overall API architecture including style (REST/GraphQL), versioning strategy, authentication flow, and high-level endpoint structure.

## When to Use
- System API design
- Integration architecture
- API versioning decisions
- Authentication design

## Prerequisites
- Requirements understood
- Consumers identified (web, mobile, third-party)
- Security requirements known

## Process

### Step 1: Choose API Style
```
Options:
- REST: Resource-based, HTTP verbs, stateless
- GraphQL: Flexible queries, single endpoint
- gRPC: High performance, binary protocol

Selection criteria:
- Consumer needs (flexibility vs simplicity)
- Team experience
- Performance requirements
- Tooling needs
```

### Step 2: Define Resource Structure
```
For REST:
- Identify resources (nouns)
- Define URL hierarchy
- Map HTTP verbs to operations
- Plan query parameters
- Design response formats
```

### Step 3: Design Authentication Flow
```
Common patterns:
- Session-based: Server-side session
- JWT: Stateless token
- OAuth2: Third-party auth
- API Keys: Service-to-service

For Project:
- User auth: OAuth2 (Google, University SSO)
- API auth: JWT tokens
- Refresh token rotation
```

### Step 4: Plan Versioning Strategy
```
Options:
- URL versioning: /api/v1/users
- Header versioning: Accept-Version: v1
- Query param: /api/users?version=1

Recommendation: URL versioning
- Clear and visible
- Easy to route
- Cache-friendly
```

### Step 5: Define API Standards
```
Standards to document:
- Request/response formats (JSON)
- Error response structure
- Pagination approach
- Filtering syntax
- Rate limiting
- CORS policy
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| requirements | Markdown | Yes | Feature requirements |
| consumers | Markdown | Yes | Who will use API |
| security_reqs | Markdown | Yes | Auth requirements |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| api_architecture.md | Markdown | Overall API design |
| auth_flow.md | Markdown | Authentication design |
| api_standards.md | Markdown | API conventions |

## Project-Specific Considerations
- REST API for simplicity
- OAuth2 with Google + University SSO
- JWT for API authentication
- Rate limiting for external API calls
- Versioning for future compatibility

## Integration Points
- **Design Agent**: Creates OpenAPI spec
- **Security Agent**: Auth flow review
- **Developer Agent**: Implementation

## Examples
```
API Architecture - SDLC Framework

Style: REST
Base URL: https://api.example.com
Version: /api/v1/

Resource Hierarchy:
/api/v1/
├── /auth
│   ├── POST /login
│   ├── POST /logout
│   ├── POST /refresh
│   └── GET /oauth/{provider}/callback
├── /users
│   ├── GET /me
│   ├── PUT /me
│   └── DELETE /me (GDPR)
├── /universities
│   ├── GET / (search, paginated)
│   └── GET /{id}
├── /programs
│   ├── GET / (search, filtered)
│   ├── GET /{id}
│   └── GET /{id}/requirements
├── /applications
│   ├── GET / (user's applications)
│   ├── POST /
│   ├── GET /{id}
│   ├── PUT /{id}
│   └── POST /{id}/submit
├── /documents
│   ├── POST /upload
│   ├── GET /{id}
│   └── DELETE /{id}
└── /gdpr
    ├── GET /export
    └── POST /delete-request

Authentication Flow:
1. User clicks "Login with Google"
2. Redirect to Google OAuth
3. Callback with auth code
4. Exchange for tokens
5. Create/update user
6. Issue JWT (15min) + Refresh (7days)
7. Return tokens to client

Standard Response Format:
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "total": 100,
    "request_id": "uuid"
  }
}

Error Response Format:
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": [
      { "field": "email", "issue": "invalid format" }
    ]
  },
  "meta": {
    "request_id": "uuid"
  }
}
```

## Validation
- API style matches requirements
- All resources mapped
- Auth flow secured
- Versioning planned
- Standards documented