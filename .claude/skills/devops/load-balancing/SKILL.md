---
name: load-balancing
description: Configure load balancers and traffic distribution
skill_id: OPS-010
owner: deployment-engineer-staging
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Traffic management, high availability
dependencies: [OPS-003]
---

## Process
1. Set up ALB with HTTPS
2. Configure health checks
3. Set up SSL termination
4. Configure routing rules
5. Enable access logging

## Project-Specific
- Path-based routing (/api/*)
- Health check: /health endpoint
- Sticky sessions for WebSocket (future)
- WAF integration for security