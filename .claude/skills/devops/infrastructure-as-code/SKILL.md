---
name: infrastructure-as-code
description: Define infrastructure using Terraform for reproducible deployments
skill_id: OPS-003
owner: devops
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Infrastructure provisioning, environment replication
dependencies: []
---

## Process
1. Define module structure
2. Create reusable modules (VPC, ECS, RDS)
3. Configure per-environment variables
4. Implement state management (S3 + DynamoDB)
5. Plan and apply workflow

## Project-Specific
- EU region (eu-west-1) for GDPR
- Multi-AZ RDS for availability
- ECS Fargate for serverless containers
- S3 with encryption for documents