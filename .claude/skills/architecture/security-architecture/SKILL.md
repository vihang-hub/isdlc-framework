---
name: security-architecture
description: Design authentication, authorization, and encryption architecture
skill_id: ARCH-006
owner: solution-architect
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Security design, auth flows, data protection planning
dependencies: [ARCH-001, ARCH-004]
---

# Security Architecture

## Purpose
Design comprehensive security architecture covering authentication, authorization, encryption, and security controls to protect the application and user data.

## When to Use
- Initial security design
- Authentication implementation
- Data protection planning
- Compliance requirements

## Prerequisites
- Application architecture defined
- Security requirements known
- Compliance needs (GDPR)
- Threat model available

## Process

### Step 1: Design Authentication
```
Authentication components:
- Identity providers (Google, University SSO)
- Local auth (if needed)
- Token management (JWT)
- Session handling
- MFA (if required)
```

### Step 2: Design Authorization
```
Authorization model:
- Role definitions (student, advisor, admin)
- Permission matrix
- Resource-level access
- Row-level security (users see only their data)
```

### Step 3: Plan Data Protection
```
Data protection layers:
- Encryption in transit (TLS 1.3)
- Encryption at rest (AES-256)
- PII handling
- Key management
- Data masking/anonymization
```

### Step 4: Define Security Controls
```
Control categories:
- Input validation
- Output encoding
- Rate limiting
- CORS policy
- Security headers
- Audit logging
```

### Step 5: Document Security Architecture
```
Create:
- Auth flow diagrams
- Permission matrices
- Encryption topology
- Security control checklist
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| threat_model | Markdown | Optional | Identified threats |
| compliance_reqs | Markdown | Yes | GDPR, etc. |
| user_roles | JSON | Yes | Role definitions |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| security_architecture.md | Markdown | Complete design |
| auth_flow_diagram | Mermaid | Auth sequences |
| permission_matrix.md | Markdown | RBAC matrix |

## Project-Specific Considerations
- OAuth2 with Google and University SSO
- GDPR requires consent management
- PII encryption for user data
- Student data is sensitive (FERPA-like)
- Document access controls

## Integration Points
- **Security Agent**: Review and validation
- **Developer Agent**: Implementation
- **Test Manager**: Security test design

## Examples
```
Security Architecture - SDLC Framework

AUTHENTICATION:

OAuth2 Flow:
┌──────┐      ┌──────────┐      ┌──────────┐
│Client│      │ API      │      │ Google   │
└──┬───┘      └────┬─────┘      └────┬─────┘
   │ 1. Login      │                 │
   │──────────────>│                 │
   │ 2. Redirect   │                 │
   │<──────────────│                 │
   │ 3. Auth Request                 │
   │────────────────────────────────>│
   │ 4. Consent & Code               │
   │<────────────────────────────────│
   │ 5. Code                         │
   │──────────────>│                 │
   │               │ 6. Exchange     │
   │               │────────────────>│
   │               │ 7. Tokens       │
   │               │<────────────────│
   │ 8. JWT + Refresh                │
   │<──────────────│                 │

Token Strategy:
- Access Token: JWT, 15 min expiry
- Refresh Token: Opaque, 7 day expiry, rotation
- Storage: httpOnly cookies (not localStorage)

AUTHORIZATION:

Role Hierarchy:
- Admin > Advisor > Student > Guest

Permission Matrix:
| Resource | Student | Advisor | Admin |
|----------|---------|---------|-------|
| Own profile | RW | RW | RW |
| Own applications | RW | R | RW |
| All applications | - | R (assigned) | RW |
| Universities | R | R | RW |
| User management | - | - | RW |

DATA PROTECTION:

Encryption:
- In Transit: TLS 1.3 (enforced)
- At Rest: AES-256 (RDS, S3)
- PII Fields: Application-level encryption
- Secrets: AWS Secrets Manager

PII Fields (encrypted at application level):
- users.email (searchable encryption)
- users.first_name
- users.last_name
- users.date_of_birth
- users.nationality

SECURITY CONTROLS:

Headers:
- Strict-Transport-Security
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Content-Security-Policy
- X-XSS-Protection

Rate Limiting:
- Auth endpoints: 10/min per IP
- API endpoints: 100/min per user
- Public search: 30/min per IP
```

## Validation
- Auth flow covers all scenarios
- RBAC matrix complete
- Encryption strategy defined
- Security controls documented
- GDPR compliance addressed