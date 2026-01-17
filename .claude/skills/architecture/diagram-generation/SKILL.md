---
name: diagram-generation
description: Create C4, sequence, and ER diagrams
skill_id: ARCH-011
owner: architecture
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Architecture documentation, design communication, reviews
dependencies: [ARCH-001]
---

# Diagram Generation

## Purpose
Create clear, consistent architectural diagrams (C4 model, sequence diagrams, ER diagrams) to communicate system design to technical and non-technical stakeholders.

## When to Use
- Architecture documentation
- Design reviews
- Stakeholder communication
- Onboarding materials
- Change impact visualization

## Prerequisites
- Architecture defined
- Diagram type selected
- Audience identified
- Tool selected (Mermaid, PlantUML)

## Process

### Step 1: Select Diagram Type
```
Diagram types:
- C4 Context: System and external actors
- C4 Container: Major components
- C4 Component: Internal structure
- Sequence: Interaction flows
- ER Diagram: Data model
- Deployment: Infrastructure
```

### Step 2: Identify Scope
```
For each diagram:
- What level of detail?
- Which components included?
- What story does it tell?
- Who is the audience?
```

### Step 3: Create Diagram
```
Using Mermaid syntax:
- Use consistent naming
- Group related elements
- Add clear labels
- Include legend if needed
```

### Step 4: Add Documentation
```
With each diagram:
- Title and purpose
- Key for any abbreviations
- Version/date
- Related diagrams
```

### Step 5: Review and Iterate
```
Quality checks:
- Accurate representation
- Appropriate detail level
- Consistent styling
- Clear legend/labels
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| architecture | Markdown | Yes | Architecture docs |
| diagram_type | String | Yes | Type requested |
| audience | String | Optional | Technical/business |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| diagrams/*.mermaid | Mermaid | Source files |
| diagrams/*.png | Image | Rendered diagrams |

## Project-Specific Considerations
- Show external university API clearly
- Highlight GDPR data flows
- Include OAuth2 providers
- Show document storage path

## Integration Points
- **Documentation Agent**: Diagram maintenance
- **All Agents**: Reference diagrams

## Examples
```
C4 Context Diagram - SDLC Framework

```mermaid
graph TB
    subgraph External
        Student[Student<br/>Study abroad applicant]
        Advisor[Advisor<br/>University staff]
        Admin[Admin<br/>System administrator]
    end
    
    subgraph Project System
        WebApp[Project<br/>Web Application]
    end
    
    subgraph External Systems
        Google[Google OAuth<br/>Authentication]
        UniAPI[University Database<br/>Program data]
        VisaAPI[Visa Service<br/>Status checking]
        Email[Email Service<br/>Notifications]
    end
    
    Student --> WebApp
    Advisor --> WebApp
    Admin --> WebApp
    
    WebApp --> Google
    WebApp --> UniAPI
    WebApp --> VisaAPI
    WebApp --> Email
```

C4 Container Diagram:

```mermaid
graph TB
    subgraph Client
        Browser[Web Browser<br/>React SPA]
    end
    
    subgraph API Layer
        ALB[Load Balancer<br/>AWS ALB]
        API[API Service<br/>NestJS]
    end
    
    subgraph Data Layer
        DB[(PostgreSQL<br/>Primary DB)]
        Cache[(Redis<br/>Cache/Sessions)]
        S3[(S3<br/>Documents)]
    end
    
    subgraph Background
        Worker[Worker Service<br/>Async tasks]
        Queue[SQS<br/>Job queue]
    end
    
    Browser --> ALB
    ALB --> API
    API --> DB
    API --> Cache
    API --> S3
    API --> Queue
    Queue --> Worker
    Worker --> DB
```

Sequence Diagram - OAuth Login:

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API
    participant G as Google
    participant D as Database
    
    U->>F: Click "Login with Google"
    F->>A: GET /auth/google
    A->>F: Redirect URL
    F->>G: Authorization request
    G->>U: Show consent screen
    U->>G: Grant consent
    G->>F: Redirect with code
    F->>A: POST /auth/callback?code=xxx
    A->>G: Exchange code for tokens
    G->>A: Access token + ID token
    A->>D: Find/create user
    D->>A: User record
    A->>A: Generate JWT
    A->>F: JWT + Refresh token
    F->>U: Logged in
```
```

## Validation
- Diagrams match architecture
- Appropriate detail level
- Consistent naming
- Legend provided
- Version tracked