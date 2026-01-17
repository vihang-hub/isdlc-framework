---
name: containerization
description: Create optimized Docker images and container configurations
skill_id: OPS-002
owner: devops
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Docker setup, image optimization, development environments
dependencies: []
---

## Process
1. Select base image (node:20-alpine)
2. Multi-stage builds for size optimization
3. Security hardening (non-root user)
4. Health checks configuration
5. Docker Compose for local development

## Project-Specific
- Prisma client generation in build
- Static asset handling
- Environment variable injection
- MinIO for local S3 replacement