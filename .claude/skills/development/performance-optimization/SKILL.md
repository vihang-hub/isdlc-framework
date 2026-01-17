---
name: performance-optimization
description: Optimize code and queries for better performance
skill_id: DEV-014
owner: developer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Performance issues, scalability improvements
dependencies: [DEV-001]
---

# Performance Optimization

## Purpose
Identify and resolve performance bottlenecks in code, queries, and application architecture.

## When to Use
- Performance issues identified
- Scalability requirements
- Resource optimization
- Response time improvements

## Process

1. Profile and measure
2. Identify bottlenecks
3. Implement optimizations
4. Verify improvements
5. Document changes

## Project-Specific Considerations
- University search query optimization
- Application list pagination
- Document upload streaming
- Caching strategy

## Examples
```typescript
// Before: N+1 query problem
const applications = await prisma.application.findMany();
for (const app of applications) {
  app.program = await prisma.program.findUnique({
    where: { id: app.programId }
  });
}

// After: Eager loading
const applications = await prisma.application.findMany({
  include: {
    program: {
      include: { university: true }
    }
  }
});
```