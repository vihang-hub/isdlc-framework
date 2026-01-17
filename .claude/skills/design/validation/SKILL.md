---
name: validation-design
description: Design validation strategy across application layers
skill_id: DES-009
owner: design
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Form design, API design, data integrity
dependencies: []
---

# Validation Design

## Purpose
Design comprehensive validation strategy that ensures data integrity at all application layers.

## Process
1. Define validation layers
2. Create validation rules
3. Design error messages
4. Plan client/server sync
5. Document validation

## Project-Specific Considerations
- Client: Zod schemas with React Hook Form
- API: class-validator DTOs
- Database: Prisma constraints
- Cross-field validation (dates, document requirements)

## Examples
```
Validation Layers:

1. Client (immediate feedback)
   - Required fields
   - Format validation
   - Length limits

2. API (security boundary)
   - All client validations
   - Business rules
   - Authorization

3. Database (data integrity)
   - Unique constraints
   - Foreign keys
   - Check constraints
```