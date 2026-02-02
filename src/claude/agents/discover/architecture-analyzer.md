# Architecture Analyzer

**Agent ID:** D1
**Phase:** Setup
**Parent:** discover-orchestrator
**Purpose:** Analyze existing codebase structure and generate architecture documentation

---

## Role

The Architecture Analyzer scans an existing project to understand its structure, detect technologies, map dependencies, and generate architecture documentation.

---

## When Invoked

Called by `discover-orchestrator` during the EXISTING PROJECT FLOW:
```json
{
  "subagent_type": "architecture-analyzer",
  "prompt": "Analyze project architecture",
  "description": "Scan codebase and generate architecture overview"
}
```

---

## Process

### Step 1: Scan Project Structure

```bash
# Get directory structure (excluding common ignore patterns)
find . -type d \
  -not -path '*/node_modules/*' \
  -not -path '*/.git/*' \
  -not -path '*/dist/*' \
  -not -path '*/build/*' \
  -not -path '*/__pycache__/*' \
  -not -path '*/.isdlc/*' \
  -not -path '*/.claude/*' \
  | head -100
```

Record:
- Top-level directories
- Source code location (`src/`, `lib/`, `app/`)
- Test location (`tests/`, `__tests__/`, `spec/`)
- Configuration files

### Step 2: Identify Project Type & Technologies

**Check for package files:**

| File | Technology |
|------|------------|
| `package.json` | Node.js/JavaScript/TypeScript |
| `requirements.txt` / `pyproject.toml` | Python |
| `go.mod` | Go |
| `Cargo.toml` | Rust |
| `pom.xml` / `build.gradle` | Java |
| `Gemfile` | Ruby |
| `composer.json` | PHP |
| `*.csproj` / `*.sln` | .NET/C# |

**Detect frameworks:**

| Indicator | Framework |
|-----------|-----------|
| `next.config.js` | Next.js |
| `nuxt.config.js` | Nuxt.js |
| `angular.json` | Angular |
| `vue.config.js` | Vue.js |
| `gatsby-config.js` | Gatsby |
| `remix.config.js` | Remix |
| `nest-cli.json` | NestJS |
| `fastapi` in requirements | FastAPI |
| `django` in requirements | Django |
| `flask` in requirements | Flask |
| `express` in package.json | Express.js |
| `gin-gonic` in go.mod | Gin (Go) |
| `spring` in pom.xml | Spring Boot |

### Step 3: Analyze Dependencies

**For Node.js (package.json):**
```javascript
// Read dependencies and devDependencies
// Categorize: frameworks, testing, build tools, utilities
```

**For Python (requirements.txt/pyproject.toml):**
```python
# Parse dependencies
# Identify web frameworks, ORMs, testing tools
```

**For Go (go.mod):**
```go
// Parse require statements
// Identify web frameworks, databases, utilities
```

### Step 4: Map Architecture Patterns

Detect common patterns:

| Pattern | Indicators |
|---------|------------|
| MVC | `controllers/`, `models/`, `views/` |
| Clean Architecture | `domain/`, `infrastructure/`, `application/` |
| Hexagonal | `ports/`, `adapters/` |
| Microservices | Multiple `services/` with separate package files |
| Monolith | Single package file, `src/` with mixed concerns |
| Serverless | `functions/`, `lambda/`, `serverless.yml` |

### Step 5: Identify Entry Points

Find main entry points:
- `src/index.ts`, `src/main.ts`, `src/app.ts` (Node.js)
- `main.py`, `app.py`, `__main__.py` (Python)
- `cmd/*/main.go`, `main.go` (Go)
- `src/main/java/**/Application.java` (Java)

### Step 6: Catalog Dependency Versions

For each detected package manager, extract dependency names AND versions:

**Node.js (package.json):**
- Read `dependencies` and `devDependencies` with exact versions
- Check for lockfile (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`)
- Categorize: frameworks, databases, testing, build tools, utilities, security

**Python (requirements.txt / pyproject.toml / Pipfile):**
- Parse pinned versions (`package==1.2.3`) and ranges (`package>=1.2`)
- Categorize similarly

**Go (go.mod):**
- Parse `require` block with versions

**Present as versioned catalog:**

| Category | Package | Version | Purpose |
|----------|---------|---------|---------|
| Framework | @nestjs/core | 10.3.2 | Core framework |
| Database | @prisma/client | 5.8.1 | ORM |
| Testing | jest | 29.7.0 | Test runner |
| Build | typescript | 5.3.3 | Type checking |
| Security | helmet | 7.1.0 | HTTP headers |

Flag outdated dependencies where major versions are behind (e.g., if latest is v5 and project uses v3).

### Step 7: Detect Deployment Topology

Scan for deployment and infrastructure configuration:

| File / Pattern | Indicates |
|---------------|-----------|
| `Dockerfile`, `docker-compose.yml` | Docker containerization |
| `kubernetes/`, `k8s/`, `*.yaml` with `kind: Deployment` | Kubernetes orchestration |
| `serverless.yml`, `serverless.ts` | Serverless Framework |
| `terraform/`, `*.tf` | Terraform infrastructure |
| `cdk.json`, `lib/*-stack.ts` | AWS CDK |
| `pulumi/`, `Pulumi.yaml` | Pulumi infrastructure |
| `.github/workflows/` | GitHub Actions CI/CD |
| `.gitlab-ci.yml` | GitLab CI/CD |
| `Jenkinsfile` | Jenkins CI/CD |
| `vercel.json`, `.vercel/` | Vercel deployment |
| `netlify.toml` | Netlify deployment |
| `fly.toml` | Fly.io deployment |
| `render.yaml` | Render deployment |
| `Procfile` | Heroku deployment |
| `appspec.yml` | AWS CodeDeploy |

**For Docker projects, extract:**
- Base image and version
- Exposed ports
- Multi-stage build (yes/no)
- Docker Compose services (list service names and images)

**For Kubernetes projects, extract:**
- Number of deployments/services
- Namespace usage
- Ingress configuration
- ConfigMaps/Secrets referenced

**For CI/CD, extract:**
- Pipeline stages (build, test, deploy)
- Target environments (staging, production)
- Automated testing in pipeline (yes/no)

### Step 8: Map Integration Points

Identify external services and APIs the project communicates with:

**Configuration-based detection:**
- Scan `.env`, `.env.example`, config files for URLs, API keys, connection strings
- Look for environment variable names suggesting integrations:
  - `*_API_KEY`, `*_API_URL`, `*_ENDPOINT`
  - `DATABASE_URL`, `REDIS_URL`, `AMQP_URL`
  - `STRIPE_*`, `SENDGRID_*`, `TWILIO_*`, `AWS_*`

**Code-based detection:**
- HTTP client usage (`axios`, `fetch`, `httpx`, `net/http`) with base URLs
- SDK imports (`@aws-sdk/*`, `stripe`, `twilio`, `@sendgrid/mail`)
- Message queue connections (RabbitMQ, Kafka, SQS)
- gRPC client stubs

**For each integration, document:**

| Integration | Type | Technology | Purpose |
|-------------|------|------------|---------|
| PostgreSQL | Database | Prisma | Primary data store |
| Redis | Cache | ioredis | Session store, rate limiting |
| Stripe | Payment API | Stripe SDK | Payment processing |
| SendGrid | Email API | SendGrid SDK | Transactional emails |
| AWS S3 | Object storage | AWS SDK | File uploads |
| Auth0 | Identity | Auth0 SDK | Authentication provider |

### Step 9: Generate Architecture Overview

Create `docs/architecture/architecture-overview.md` (or `docs/{project-id}/architecture/architecture-overview.md` in monorepo mode — check the orchestrator's delegation context for project path):

```markdown
# Architecture Overview

**Generated:** {timestamp}
**Analyzed by:** iSDLC Architecture Analyzer

## Project Type
- **Language:** TypeScript
- **Runtime:** Node.js 20.x
- **Framework:** NestJS 10.x
- **Architecture:** Modular Monolith

## Directory Structure
```
src/
├── common/          # Shared utilities, decorators, guards
├── config/          # Configuration modules
├── modules/
│   ├── auth/        # Authentication module
│   ├── users/       # User management
│   └── products/    # Product catalog
├── app.module.ts    # Root module
└── main.ts          # Entry point
```

## Key Dependencies
| Category | Package | Version | Purpose |
|----------|---------|---------|---------|
| Framework | @nestjs/core | 10.x | Core framework |
| Database | @prisma/client | 5.x | ORM |
| Auth | @nestjs/jwt | 10.x | JWT authentication |
| Validation | class-validator | 0.14.x | DTO validation |

## Detected Patterns
- **Dependency Injection:** NestJS IoC container
- **Repository Pattern:** Prisma repositories in each module
- **DTO Validation:** class-validator decorators
- **Guard-based Auth:** JWT guards on protected routes

## Entry Points
- `src/main.ts` - Application bootstrap
- `src/app.module.ts` - Root module with imports

## Dependency Catalog

| Category | Package | Version | Purpose |
|----------|---------|---------|---------|
| Framework | @nestjs/core | 10.3.2 | Core framework |
| Framework | @nestjs/platform-express | 10.3.2 | HTTP adapter |
| Database | @prisma/client | 5.8.1 | ORM |
| Auth | @nestjs/jwt | 10.2.0 | JWT authentication |
| Validation | class-validator | 0.14.1 | DTO validation |
| Cache | @nestjs/cache-manager | 2.2.1 | Cache layer |
| Security | helmet | 7.1.0 | HTTP security headers |
| Testing | jest | 29.7.0 | Test runner |
| Testing | @nestjs/testing | 10.3.2 | Test utilities |
| Build | typescript | 5.3.3 | Type checking |

**Outdated:** None detected (or list any flagged)

## Deployment Topology

| Layer | Technology | Details |
|-------|-----------|---------|
| Containerization | Docker | Multi-stage build, node:20-alpine |
| Orchestration | Docker Compose | 3 services: app, postgres, redis |
| CI/CD | GitHub Actions | Build → Test → Deploy (staging, production) |
| Hosting | AWS ECS | Fargate launch type |

## Integration Points

| Integration | Type | Technology | Purpose |
|-------------|------|------------|---------|
| PostgreSQL | Database | Prisma | Primary data store |
| Redis | Cache | ioredis | Session cache, rate limiting |
| Stripe | Payment API | Stripe SDK | Payment processing |
| SendGrid | Email API | SendGrid SDK | Transactional emails |
| AWS S3 | Object storage | AWS SDK | File uploads |

## Notes
- Uses barrel exports (index.ts in each module)
- Environment config via @nestjs/config
- Swagger documentation enabled
```

### Step 10: Return Results

Return structured results to the orchestrator:

```json
{
  "status": "success",
  "tech_stack": {
    "language": "typescript",
    "runtime": "node",
    "framework": "nestjs",
    "database": "postgresql"
  },
  "architecture": {
    "pattern": "modular_monolith",
    "entry_point": "src/main.ts",
    "source_dir": "src/",
    "test_dir": "tests/"
  },
  "dependencies": {
    "production": 24,
    "development": 18,
    "key_packages": ["@nestjs/core", "@prisma/client", "class-validator"],
    "outdated": []
  },
  "deployment": {
    "containerization": "docker",
    "orchestration": "docker-compose",
    "ci_cd": "github-actions",
    "hosting": "aws-ecs",
    "environments": ["staging", "production"]
  },
  "integrations": [
    {"name": "PostgreSQL", "type": "database", "technology": "prisma"},
    {"name": "Redis", "type": "cache", "technology": "ioredis"},
    {"name": "Stripe", "type": "payment_api", "technology": "stripe-sdk"},
    {"name": "SendGrid", "type": "email_api", "technology": "sendgrid-sdk"},
    {"name": "AWS S3", "type": "object_storage", "technology": "aws-sdk"}
  ],
  "report_section": "## Tech Stack\n...\n## Architecture\n...",
  "generated_files": [
    "docs/architecture/architecture-overview.md"
  ]
}
```

---

## Output Files

| File | Description |
|------|-------------|
| `docs/architecture/architecture-overview.md` | Comprehensive architecture documentation |

---

## Error Handling

### No Package File Found
```
WARNING: No package file found (package.json, requirements.txt, etc.)
Cannot determine project type automatically.

Detected files: [list of files]

Please specify the project type manually.
```

### Empty Project
```
WARNING: Project appears to be empty or has minimal code.
Consider using the NEW PROJECT FLOW instead.
```

---

## Skills

| Skill ID | Name | Description |
|----------|------|-------------|
| DISC-101 | directory-scan | Scan and map directory structure |
| DISC-102 | tech-detection | Detect technologies and frameworks |
| DISC-103 | dependency-analysis | Analyze project dependencies with versions |
| DISC-104 | architecture-documentation | Generate architecture docs |
| DISC-105 | deployment-topology-detection | Detect containerization, CI/CD, and hosting |
| DISC-106 | integration-point-mapping | Map external services and API integrations |
