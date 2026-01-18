---
name: cicd-pipeline-design
description: Design and implement CI/CD pipelines for automated testing and deployment
skill_id: OPS-001
owner: cicd-engineer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Pipeline setup, automation, deployment automation
dependencies: []
---

## Process
1. Define pipeline stages (lint, test, build, deploy)
2. Configure triggers (push, PR, schedule)
3. Set up environments and secrets
4. Implement quality gates
5. Add notifications and monitoring

## Project-Specific
- Multi-stage builds for frontend/backend
- Database migrations in deployment
- E2E tests on staging before production
- Slack notifications for deployments