---
name: backup-and-recovery
description: Implement backup strategies and disaster recovery
skill_id: OPS-012
owner: release-manager
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Data protection, disaster recovery planning
dependencies: []
---

## Process
1. Define RPO/RTO objectives
2. Configure automated backups
3. Set up cross-region replication
4. Document recovery procedures
5. Test recovery regularly

## Project-Specific
- RPO: 1 hour, RTO: 4 hours
- RDS: Daily snapshots, 7-day retention
- S3: Cross-region replication for documents
- Quarterly DR testing