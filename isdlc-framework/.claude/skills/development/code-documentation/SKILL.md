---
name: code-documentation
description: Write inline code documentation and JSDoc comments
skill_id: DEV-011
owner: software-developer
collaborators: [documentation]
project: sdlc-framework
version: 1.0.0
when_to_use: Code commenting, API documentation
dependencies: [DEV-001]
---

# Code Documentation

## Purpose
Write clear documentation within code using JSDoc, inline comments, and README files.

## When to Use
- Public function documentation
- Complex logic explanation
- API documentation
- Module overviews

## Process

1. Document public interfaces
2. Add JSDoc to functions
3. Comment complex logic
4. Create module README
5. Keep docs in sync

## Project-Specific Considerations
- Document all service methods
- Explain business logic
- Document DTOs
- API endpoint documentation

## Examples
```typescript
/**
 * Submits an application for review.
 * 
 * @param applicationId - The UUID of the application to submit
 * @param userId - The UUID of the user submitting (must be owner)
 * @throws {NotFoundException} If application doesn't exist or user doesn't own it
 * @throws {BusinessException} If application is incomplete or already submitted
 * @returns The updated application with 'submitted' status
 * 
 * @example
 * const submitted = await applicationService.submit('app-123', 'user-456');
 * console.log(submitted.status); // 'submitted'
 */
async submit(applicationId: string, userId: string): Promise<Application> {
  // Implementation...
}
```