---
name: environment-configuration
description: Manage environment variables and secrets securely
skill_id: OPS-007
owner: dev-environment-engineer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Configuration management, secret handling
dependencies: []
---

## Process
1. Categorize config (public vs secrets)
2. Use AWS Secrets Manager for secrets
3. Validate configuration on startup
4. Document all required variables
5. Implement rotation for credentials

## Project-Specific
- OAuth credentials (Google)
- Database connection strings
- JWT secrets (32+ chars)
- External API keys