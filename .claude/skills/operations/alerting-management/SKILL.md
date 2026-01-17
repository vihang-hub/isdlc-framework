---
name: alerting-management
description: Configure and manage alerting rules
skill_id: MON-002
owner: operations
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Alert configuration, incident detection
dependencies: [MON-001]
---

## Process
1. Define alert thresholds
2. Configure notification channels
3. Set up escalation policies
4. Reduce alert fatigue
5. Review and tune alerts

## Project-Specific
- Error rate > 1% → Warning
- Error rate > 5% → Critical
- Response time > 2s → Warning
- External API down → Critical