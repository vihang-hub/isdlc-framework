# Discover Architecture Skill

## Purpose
Analyze an existing project's codebase to understand its architecture and generate/update the architecture overview documentation.

## Owner
**Agent**: SDLC Orchestrator (Agent 00)

## Trigger
- `/sdlc discover` command
- When onboarding to an existing codebase
- When architecture documentation is missing or outdated

## Process

### Step 1: Scan Project Structure
```bash
# Get directory structure (excluding common ignore patterns)
find . -type d -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/build/*' -not -path '*/__pycache__/*' -not -path '*/.isdlc/*' | head -100
```

### Step 2: Identify Project Type & Technologies

**Package Files to Check:**
| File | Technology |
|------|------------|
| `package.json` | Node.js/JavaScript/TypeScript |
| `requirements.txt` / `pyproject.toml` / `setup.py` | Python |
| `go.mod` | Go |
| `Cargo.toml` | Rust |
| `pom.xml` / `build.gradle` | Java |
| `Gemfile` | Ruby |
| `composer.json` | PHP |
| `*.csproj` / `*.sln` | .NET/C# |

**Framework Detection:**
| Indicator | Framework |
|-----------|-----------|
| `next.config.js` | Next.js |
| `nuxt.config.js` | Nuxt.js |
| `angular.json` | Angular |
| `vue.config.js` | Vue.js |
| `gatsby-config.js` | Gatsby |
| `remix.config.js` | Remix |
| `fastapi` in requirements | FastAPI |
| `django` in requirements | Django |
| `flask` in requirements | Flask |
| `express` in package.json | Express.js |
| `nestjs` in package.json | NestJS |
| `gin-gonic` in go.mod | Gin (Go) |
| `actix-web` in Cargo.toml | Actix (Rust) |

### Step 3: Analyze Directory Structure

**Common Patterns:**
```
src/
├── components/    → Frontend components
├── pages/         → Page/route components
├── api/           → API routes/handlers
├── services/      → Business logic services
├── models/        → Data models/entities
├── controllers/   → Request handlers
├── middleware/    → Middleware functions
├── utils/         → Utility functions
├── config/        → Configuration
├── lib/           → Core library code
├── hooks/         → React hooks (if React)
├── store/         → State management
└── types/         → TypeScript types
```

### Step 4: Detect Database & ORM

**Database Indicators:**
| File/Pattern | Database/ORM |
|--------------|--------------|
| `prisma/schema.prisma` | Prisma ORM |
| `*.entity.ts` | TypeORM |
| `models/*.py` with SQLAlchemy | SQLAlchemy |
| `migrations/` | Database migrations present |
| `docker-compose.yml` with postgres/mysql | PostgreSQL/MySQL |
| `mongoose` in package.json | MongoDB (Mongoose) |
| `sequelize` in package.json | Sequelize ORM |

### Step 5: Identify External Integrations

**Check for:**
- API client configurations
- SDK imports (AWS, GCP, Azure, Stripe, etc.)
- Environment variable references in `.env.example`
- Service configuration files

### Step 6: Analyze API Structure

**Check for:**
- `openapi.yaml` / `swagger.json` - OpenAPI spec
- `*.graphql` / `schema.graphql` - GraphQL
- Route definitions in code
- Controller/handler patterns

### Step 7: Generate Architecture Overview

**Output Location:** `docs/architecture/architecture-overview.md`

**Template Sections to Populate:**
1. Executive Summary - Based on project type and main technologies
2. Technology Stack - From package files and framework detection
3. System Context - From external integrations found
4. Container Architecture - From directory structure analysis
5. Component Architecture - From src/ structure
6. Data Architecture - From database/ORM detection
7. Infrastructure - From Docker/deployment configs

### Step 8: Report Findings

**Console Output:**
```
╔════════════════════════════════════════════════════════════════╗
║                  ARCHITECTURE DISCOVERY COMPLETE                ║
╚════════════════════════════════════════════════════════════════╝

Project Type: [Web Application / API / Library / CLI / Monorepo]
Primary Language: [TypeScript / Python / Go / etc.]
Framework: [Next.js / FastAPI / Express / etc.]

Technology Stack:
  - Frontend: [React, Next.js, TailwindCSS]
  - Backend: [Node.js, Express, TypeScript]
  - Database: [PostgreSQL with Prisma]
  - Infrastructure: [Docker, GitHub Actions]

Directory Structure:
  - src/components/ (42 files) - React components
  - src/api/ (12 files) - API routes
  - src/services/ (8 files) - Business logic
  - src/models/ (6 files) - Data models

External Integrations:
  - Stripe (payments)
  - SendGrid (email)
  - AWS S3 (file storage)

Documentation Generated:
  ✓ docs/architecture/architecture-overview.md

Recommendations:
  - Consider adding API documentation (OpenAPI spec)
  - Database schema documentation is missing
  - No CI/CD configuration detected
```

## Output Artifacts

1. **Primary**: `docs/architecture/architecture-overview.md`
   - Populated with discovered information
   - Mermaid diagrams for structure
   - Technology stack tables

2. **Optional**: `docs/architecture/discovery-report.json`
   - Machine-readable discovery results
   - Useful for automation

## Error Handling

- If project is empty: Report "No source code found"
- If no package files: Try to infer from file extensions
- If structure is unusual: Generate best-effort documentation with `[NEEDS REVIEW]` markers

## Integration with SDLC Workflow

After discovery:
1. Update `.isdlc/state.json` with discovered tech stack
2. Determine required phases based on complexity
3. Suggest which phases may need more attention (e.g., security for detected auth systems)

## Version
- Skill Version: 1.0.0
- Framework Version: 2.0.0
