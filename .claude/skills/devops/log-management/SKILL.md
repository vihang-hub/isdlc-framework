---
name: log-management
description: Implement centralized logging and analysis
skill_id: OPS-008
owner: devops
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Logging infrastructure, troubleshooting
dependencies: []
---

## Process
1. Implement structured logging (JSON)
2. Ship logs to CloudWatch Logs
3. Set up log insights queries
4. Configure retention policies
5. Create log-based alerts

## Project-Specific
- Mask PII in logs
- Request correlation IDs
- GDPR audit logging
- Log retention: 90 days