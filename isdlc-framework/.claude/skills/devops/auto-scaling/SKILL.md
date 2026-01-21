---
name: auto-scaling-configuration
description: Configure auto-scaling for compute resources
skill_id: OPS-013
owner: release-manager
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Capacity management, cost optimization
dependencies: [OPS-003]
---

## Process
1. Define scaling metrics (CPU, requests)
2. Set target tracking policies
3. Configure min/max instances
4. Set up scheduled scaling
5. Test scaling behavior

## Project-Specific
- Scale on CPU > 70%
- Min 2, max 10 instances
- Pre-scale before application deadlines
- Scale workers on queue depth