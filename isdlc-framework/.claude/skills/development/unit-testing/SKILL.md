---
name: unit-test-writing
description: Write comprehensive unit tests with good coverage
skill_id: DEV-002
owner: software-developer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Test-driven development, code coverage
dependencies: [DEV-001]
---

# Unit Test Writing

## Purpose
Write effective unit tests that verify individual components work correctly in isolation, catch regressions, and document expected behavior.

## When to Use
- TDD (before implementation)
- After implementation (coverage)
- Bug reproduction
- Refactoring safety net

## Prerequisites
- Testing framework configured
- Mocking utilities available
- Code to test (or spec for TDD)

## Process

### Step 1: Identify Test Cases
```
Case categories:
- Happy path (normal operation)
- Edge cases (boundaries)
- Error cases (exceptions)
- Null/undefined handling
```

### Step 2: Structure Tests
```
Test organization:
- describe() for grouping
- it() for individual cases
- beforeEach() for setup
- afterEach() for cleanup
```

### Step 3: Write Tests
```
AAA pattern:
- Arrange: Set up test data
- Act: Execute the code
- Assert: Verify results
```

### Step 4: Use Mocking
```
Mock strategies:
- Mock dependencies
- Mock external services
- Spy on functions
- Stub data
```

### Step 5: Verify Coverage
```
Coverage goals:
- Line coverage > 80%
- Branch coverage > 75%
- Function coverage > 90%
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| code_under_test | TypeScript | Yes | Implementation |
| requirements | Markdown | Yes | Expected behavior |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| test_files | TypeScript | Unit tests |
| coverage_report | HTML | Coverage data |

## Project-Specific Considerations
- Mock Prisma client
- Mock external APIs
- Test validation logic
- Test error handling

## Integration Points
- **Test Manager**: Coverage reporting
- **DevOps Agent**: CI integration

## Examples
```typescript
// src/application/application.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing'
import { ApplicationService } from './application.service'
import { PrismaService } from '../prisma/prisma.service'
import { BadRequestException, NotFoundException } from '@nestjs/common'

describe('ApplicationService', () => {
  let service: ApplicationService
  let prisma: jest.Mocked<PrismaService>

  // Test fixtures
  const mockUser = { id: 'user-1', email: 'test@test.com' }
  const mockProgram = { 
    id: 'prog-1', 
    deadline: new Date('2024-12-31'),
    universityId: 'uni-1'
  }
  const mockApplication = {
    id: 'app-1',
    userId: 'user-1',
    programId: 'prog-1',
    status: 'draft'
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationService,
        {
          provide: PrismaService,
          useValue: {
            application: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn()
            },
            program: {
              findUnique: jest.fn()
            }
          }
        }
      ]
    }).compile()

    service = module.get<ApplicationService>(ApplicationService)
    prisma = module.get(PrismaService)
  })

  describe('create', () => {
    it('should create an application for valid program', async () => {
      // Arrange
      prisma.program.findUnique.mockResolvedValue(mockProgram)
      prisma.application.create.mockResolvedValue(mockApplication)

      // Act
      const result = await service.create(mockUser.id, { 
        programId: mockProgram.id 
      })

      // Assert
      expect(result).toEqual(mockApplication)
      expect(prisma.application.create).toHaveBeenCalledWith({
        data: {
          userId: mockUser.id,
          programId: mockProgram.id,
          status: 'draft'
        }
      })
    })

    it('should throw if program not found', async () => {
      // Arrange
      prisma.program.findUnique.mockResolvedValue(null)

      // Act & Assert
      await expect(
        service.create(mockUser.id, { programId: 'invalid' })
      ).rejects.toThrow(NotFoundException)
    })

    it('should throw if deadline passed', async () => {
      // Arrange
      const expiredProgram = {
        ...mockProgram,
        deadline: new Date('2020-01-01')
      }
      prisma.program.findUnique.mockResolvedValue(expiredProgram)

      // Act & Assert
      await expect(
        service.create(mockUser.id, { programId: mockProgram.id })
      ).rejects.toThrow(BadRequestException)
    })
  })

  describe('submit', () => {
    it('should submit a complete draft application', async () => {
      // Arrange
      const completeApp = { ...mockApplication, progress: 100 }
      prisma.application.findUnique.mockResolvedValue(completeApp)
      prisma.application.update.mockResolvedValue({
        ...completeApp,
        status: 'submitted',
        submittedAt: expect.any(Date)
      })

      // Act
      const result = await service.submit('app-1', mockUser.id)

      // Assert
      expect(result.status).toBe('submitted')
      expect(prisma.application.update).toHaveBeenCalledWith({
        where: { id: 'app-1' },
        data: {
          status: 'submitted',
          submittedAt: expect.any(Date)
        }
      })
    })

    it('should throw if application incomplete', async () => {
      // Arrange
      const incompleteApp = { ...mockApplication, progress: 60 }
      prisma.application.findUnique.mockResolvedValue(incompleteApp)

      // Act & Assert
      await expect(
        service.submit('app-1', mockUser.id)
      ).rejects.toThrow(BadRequestException)
    })

    it('should throw if not owner', async () => {
      // Arrange
      prisma.application.findUnique.mockResolvedValue(mockApplication)

      // Act & Assert
      await expect(
        service.submit('app-1', 'other-user')
      ).rejects.toThrow(NotFoundException)
    })

    it('should throw if already submitted', async () => {
      // Arrange
      const submittedApp = { ...mockApplication, status: 'submitted' }
      prisma.application.findUnique.mockResolvedValue(submittedApp)

      // Act & Assert
      await expect(
        service.submit('app-1', mockUser.id)
      ).rejects.toThrow(BadRequestException)
    })
  })
})
```

## Validation
- All test cases covered
- Tests are isolated
- Mocks properly configured
- Coverage meets threshold
- Tests run quickly