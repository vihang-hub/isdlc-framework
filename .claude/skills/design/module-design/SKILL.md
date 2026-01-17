---
name: module-design
description: Break architecture into implementable modules with clear interfaces
skill_id: DES-001
owner: design
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: After architecture, before implementation
dependencies: []
---

# Module Design

## Purpose
Break down system architecture into discrete, implementable modules with well-defined boundaries, interfaces, and responsibilities.

## When to Use
- After architecture design approved
- Before development starts
- When planning sprint work
- For complex feature decomposition

## Prerequisites
- Architecture documentation
- Component diagrams
- Data models defined

## Process

### Step 1: Identify Module Boundaries
```
Boundary criteria:
- Single responsibility
- High cohesion within
- Low coupling between
- Clear ownership
```

### Step 2: Define Module Interfaces
```
Interface definition:
- Public API (exposed functions)
- Events emitted/consumed
- Data contracts
- Dependencies
```

### Step 3: Create Module Specification
```
Specification includes:
- Purpose and scope
- Public interface
- Internal structure
- Dependencies
- Testing approach
```

### Step 4: Validate Design
```
Validation:
- Meets requirements
- Fits architecture
- Testable
- Maintainable
```

### Step 5: Document Design Decisions
```
Documentation:
- Design rationale
- Alternatives considered
- Trade-offs made
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| architecture_doc | Markdown | Yes | System architecture |
| requirements | Markdown | Yes | Feature requirements |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| module_specs/ | Markdown | Module specifications |
| interface_docs/ | Markdown | API definitions |

## Project-Specific Considerations
- University module (search, details, sync)
- Application module (CRUD, workflow, validation)
- Document module (upload, storage, retrieval)
- User module (profile, preferences, GDPR)
- Auth module (OAuth, JWT, sessions)

## Integration Points
- **Architecture Agent**: Receives architecture
- **Developer Agent**: Implements modules
- **Test Manager**: Test planning

## Examples
```
Module: Application

Purpose: Manage study abroad applications through their lifecycle

Public Interface:
  - createApplication(userId, programId): Application
  - updateApplication(id, data): Application
  - submitApplication(id): Application
  - getApplication(id): Application
  - getUserApplications(userId, filters): Application[]
  - cancelApplication(id): void

Events:
  - application.created
  - application.submitted
  - application.statusChanged

Dependencies:
  - User module (user data)
  - University module (program validation)
  - Document module (attachments)
  - Notification module (emails)

Internal Structure:
  src/application/
  ├── application.module.ts
  ├── application.controller.ts
  ├── application.service.ts
  ├── application.repository.ts
  ├── dto/
  │   ├── create-application.dto.ts
  │   ├── update-application.dto.ts
  │   └── application-response.dto.ts
  ├── entities/
  │   └── application.entity.ts
  ├── events/
  │   └── application.events.ts
  └── __tests__/
      ├── application.service.spec.ts
      └── application.controller.spec.ts
```

## Validation
- All requirements mapped to modules
- Interfaces clearly defined
- Dependencies documented
- No circular dependencies
- Testability verified