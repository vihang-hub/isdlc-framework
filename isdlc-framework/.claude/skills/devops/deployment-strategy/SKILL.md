---
name: deployment-strategy
description: Implement blue-green and canary deployment strategies
skill_id: OPS-009
owner: deployment-engineer-staging
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Production deployments, zero-downtime releases
dependencies: [OPS-001, OPS-003]
---

## Process
1. Choose strategy (rolling/blue-green/canary)
2. Configure target groups and routing
3. Implement health validation
4. Define rollback triggers
5. Monitor deployment metrics

## Project-Specific
- Blue-green for major releases
- Canary (10%) for feature rollouts
- Database migration handling
- Session continuity during deployment