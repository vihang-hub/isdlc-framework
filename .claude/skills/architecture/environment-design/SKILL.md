---
name: environment-design
description: Define development, test, staging, and production environments
skill_id: ARCH-012
owner: architecture
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Environment planning, CI/CD setup, deployment strategy
dependencies: [ARCH-005]
---

# Environment Design

## Purpose
Define consistent environment configurations for development, testing, staging, and production to ensure reliable deployments and proper isolation between environments.

## When to Use
- Project setup
- CI/CD pipeline design
- Deployment planning
- Environment troubleshooting

## Prerequisites
- Infrastructure design complete
- Deployment needs understood
- Testing strategy defined
- Cost constraints known

## Process

### Step 1: Identify Environments
```
Standard environments:
- Development: Local/shared dev
- Testing: Automated test execution
- Staging: Pre-production validation
- Production: Live system
```

### Step 2: Define Environment Purposes
```
For each environment:
- Primary use case
- Who has access
- Data characteristics
- Uptime expectations
- Cost constraints
```

### Step 3: Specify Configuration
```
For each environment define:
- Infrastructure (scale, redundancy)
- Data (real, synthetic, anonymized)
- Integrations (mocked, sandbox, production)
- Secrets management
- Monitoring level
```

### Step 4: Plan Data Management
```
Data strategy:
- Development: Seed data, minimal
- Testing: Fixtures, automated reset
- Staging: Anonymized production copy
- Production: Real data, protected
```

### Step 5: Document Environment Matrix
```
Create matrix showing:
- All configuration parameters
- Values per environment
- Parity indicators
- Differences and reasons
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| infrastructure_design | Markdown | Yes | Production architecture |
| testing_strategy | Markdown | Yes | Test environment needs |
| cost_constraints | JSON | Optional | Budget per environment |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| environments.md | Markdown | Environment definitions |
| env_config/ | Files | Environment configs |
| env_matrix.md | Markdown | Configuration matrix |

## Project-Specific Considerations
- External API sandboxes for testing
- Anonymized GDPR data for staging
- Separate OAuth apps per environment
- Document storage isolation

## Integration Points
- **DevOps Agent**: Environment provisioning
- **Developer Agent**: Local setup
- **Test Manager**: Test environment needs

## Examples
```
Environment Matrix - SDLC Framework

| Config | Development | Testing | Staging | Production |
|--------|-------------|---------|---------|------------|
| Purpose | Local dev | CI/CD tests | UAT/QA | Live |
| URL | localhost:3000 | test.internal | staging.example.com | example.com |
| API instances | 1 | 1 | 2 | 2-10 |
| Database | Local PG / Docker | Docker PG | RDS small | RDS medium |
| Cache | Local Redis | Docker Redis | ElastiCache | ElastiCache |
| Storage | Local / MinIO | MinIO | S3 (staging) | S3 (prod) |
| Data | Seed data | Fixtures | Anonymized copy | Real |
| Ext APIs | Mocked | Sandbox | Sandbox | Production |
| OAuth | Dev app | Test app | Staging app | Prod app |
| Secrets | .env file | CI secrets | AWS Secrets | AWS Secrets |
| Monitoring | Console | Minimal | Full | Full + alerts |
| Cost/month | $0 | ~$20 | ~$150 | ~$500 |

ENVIRONMENT PURPOSES:

Development:
- Individual developer machines
- Docker Compose for dependencies
- Seed data for common scenarios
- All external APIs mocked
- Fast feedback loop

Testing:
- CI/CD pipeline execution
- Automated test suites
- Ephemeral (created/destroyed per run)
- Sandbox API connections
- Fixtures for consistent tests

Staging:
- Pre-production validation
- UAT testing
- Production-like infrastructure (smaller)
- Anonymized data snapshot
- Sandbox APIs (or production with test data)
- Manual testing by QA/stakeholders

Production:
- Live user traffic
- Full redundancy
- Real data with backups
- Production API connections
- 24/7 monitoring and alerts
- Change management required

DATA MANAGEMENT:

Development → Testing:
- Fixtures in version control
- npm run seed for setup

Production → Staging (weekly):
1. pg_dump from production
2. Run anonymization script
3. Restore to staging
4. Clear sensitive documents
5. Reset OAuth tokens
```

## Validation
- All environments defined
- Clear purpose for each
- Data strategy documented
- Cost estimates included
- Parity with production clear

###DIFFBREAK###
# Complete SDLC Skills Content Library - Part 2 Continued
# Project: SDLC Framework
# Test Manager Agent Skills (continued)