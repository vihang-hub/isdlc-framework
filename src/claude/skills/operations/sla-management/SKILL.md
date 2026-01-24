---
name: sla-management
description: Monitor and report on SLA compliance
skill_id: SRE-008
owner: site-reliability-engineer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: SLA tracking, availability reporting
dependencies: [MON-001]
---

## Process
1. Define SLA metrics
2. Configure tracking
3. Generate reports
4. Identify violations
5. Plan improvements

## Project-Specific
- 99.5% uptime target
- API response < 500ms (p95)
- GDPR request response times
- Support response SLAs