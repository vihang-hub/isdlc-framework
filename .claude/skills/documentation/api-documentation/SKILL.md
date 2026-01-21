---
name: api-documentation
description: Generate and maintain API documentation
skill_id: DOC-006
owner: release-manager
collaborators: [developer, design]
project: sdlc-framework
version: 1.0.0
when_to_use: API reference, integration guides
dependencies: []
---

## Process
1. Generate from OpenAPI spec
2. Add usage examples
3. Document authentication
4. Include error responses
5. Publish to documentation site

## Project-Specific
- Swagger UI at /api/docs
- Authentication flow examples
- Rate limit documentation
- Webhook documentation (future)