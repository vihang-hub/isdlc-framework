---
name: code-implementation
description: Write production code following designs and best practices
skill_id: DEV-001
owner: software-developer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Feature implementation, coding tasks
dependencies: []
---

# Code Implementation

## Purpose
Write clean, maintainable, production-quality code that implements designs, follows coding standards, and adheres to project conventions.

## When to Use
- Feature implementation
- Bug fixes
- Refactoring
- Technical debt reduction

## Prerequisites
- Design specifications available
- Coding standards defined
- Development environment ready
- Tests defined (TDD)

## Process

### Step 1: Understand Requirements
```
Before coding:
- Review design documents
- Understand acceptance criteria
- Identify dependencies
- Clarify ambiguities
```

### Step 2: Plan Implementation
```
Planning:
- Break into small increments
- Identify interfaces
- Consider edge cases
- Plan for testability
```

### Step 3: Write Code (TDD)
```
TDD cycle:
1. Write failing test
2. Write minimum code to pass
3. Refactor for quality
4. Repeat
```

### Step 4: Follow Standards
```
Standards:
- Naming conventions
- File organization
- Code formatting
- Documentation
- Error handling
```

### Step 5: Review and Refine
```
Quality checks:
- Self-review
- Lint/format
- Tests pass
- Documentation complete
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| design_spec | Markdown | Yes | Design document |
| test_cases | Markdown | Yes | Test requirements |
| coding_standards | Markdown | Yes | Project conventions |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| source_code | TypeScript | Implementation |
| tests | TypeScript | Unit tests |
| documentation | Markdown | Code docs |

## Project-Specific Considerations
- TypeScript strict mode
- NestJS/React patterns
- Prisma for database
- Error handling patterns

## Integration Points
- **Design Agent**: Receives specs
- **Test Manager**: TDD coordination
- **Security Agent**: Security review

## Examples
```typescript
// Example: Implementing University Search Service

// 1. First, write the test (RED)
// src/university/university.service.spec.ts
describe('UniversityService', () => {
  describe('search', () => {
    it('should return universities filtered by country', async () => {
      const result = await service.search({ country: 'DE' })
      
      expect(result.data).toHaveLength(2)
      expect(result.data.every(u => u.country === 'DE')).toBe(true)
    })
    
    it('should return empty array for no matches', async () => {
      const result = await service.search({ country: 'XX' })
      
      expect(result.data).toHaveLength(0)
    })
    
    it('should paginate results', async () => {
      const result = await service.search({ page: 1, limit: 10 })
      
      expect(result.meta.page).toBe(1)
      expect(result.meta.limit).toBe(10)
      expect(result.data.length).toBeLessThanOrEqual(10)
    })
  })
})

// 2. Write implementation (GREEN)
// src/university/university.service.ts
import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { SearchUniversitiesDto } from './dto/search-universities.dto'
import { PaginatedResponse } from '../common/types'
import { University } from './entities/university.entity'

@Injectable()
export class UniversityService {
  constructor(private readonly prisma: PrismaService) {}

  async search(dto: SearchUniversitiesDto): Promise<PaginatedResponse<University>> {
    const { country, query, page = 1, limit = 20 } = dto
    
    // Build where clause
    const where: Prisma.UniversityWhereInput = {}
    
    if (country) {
      where.country = country
    }
    
    if (query) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { city: { contains: query, mode: 'insensitive' } }
      ]
    }
    
    // Execute queries
    const [data, total] = await Promise.all([
      this.prisma.university.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' }
      }),
      this.prisma.university.count({ where })
    ])
    
    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }
  }
}

// 3. Refactor (REFACTOR)
// - Extract pagination logic to utility
// - Add caching
// - Improve types
```

## Validation
- All tests pass
- Code meets standards
- No linting errors
- Documentation complete
- PR ready for review