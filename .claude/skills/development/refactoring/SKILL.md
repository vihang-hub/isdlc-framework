---
name: code-refactoring
description: Improve code quality through refactoring
skill_id: DEV-009
owner: developer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Code improvement, technical debt reduction
dependencies: [DEV-001, DEV-002]
---

# Code Refactoring

## Purpose
Improve code quality, readability, and maintainability without changing external behavior, ensuring tests continue to pass.

## When to Use
- After feature completion
- Technical debt reduction
- Before major changes
- Code review feedback

## Prerequisites
- Tests covering code to refactor
- Code review or analysis identifying issues
- Clear improvement goals

## Process

### Step 1: Identify Refactoring Targets
```
Code smells:
- Long methods
- Duplicate code
- Large classes
- Complex conditionals
- Deep nesting
- Poor naming
```

### Step 2: Ensure Test Coverage
```
Before refactoring:
- Run existing tests
- Add tests if needed
- Verify coverage
```

### Step 3: Apply Refactoring
```
Common refactorings:
- Extract method
- Extract class
- Rename
- Simplify conditionals
- Remove duplication
- Introduce patterns
```

### Step 4: Run Tests
```
After each change:
- Run unit tests
- Run integration tests
- Verify behavior unchanged
```

### Step 5: Review and Document
```
Completion:
- Self-review changes
- Update documentation
- Commit with clear message
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| code_to_refactor | TypeScript | Yes | Target code |
| test_suite | TypeScript | Yes | Existing tests |
| issues | Markdown | Optional | Known problems |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| refactored_code | TypeScript | Improved code |
| updated_tests | TypeScript | Updated tests if needed |

## Project-Specific Considerations
- Maintain API compatibility
- Don't break form validation
- Keep error handling consistent
- Document architectural changes

## Integration Points
- **Test Manager**: Test verification
- **Security Agent**: No security regressions

## Examples
```typescript
// BEFORE: Long method with multiple responsibilities
class ApplicationService {
  async submitApplication(id: string, userId: string) {
    // Find application
    const application = await this.prisma.application.findFirst({
      where: { id, userId },
      include: { documents: true, program: true }
    })

    if (!application) {
      throw new NotFoundException('Application')
    }

    // Check status
    if (application.status !== 'draft') {
      throw new BusinessException('BIZ_ALREADY_SUBMITTED', 'Already submitted')
    }

    // Check deadline
    if (new Date() > application.program.deadline) {
      throw new BusinessException('BIZ_DEADLINE_PASSED', 'Deadline passed')
    }

    // Validate completeness
    const requiredDocs = ['transcript', 'passport', 'motivation_letter']
    const uploadedTypes = application.documents.map(d => d.documentType)
    const missingDocs = requiredDocs.filter(t => !uploadedTypes.includes(t))
    
    if (missingDocs.length > 0) {
      throw new BusinessException(
        'BIZ_INCOMPLETE',
        `Missing documents: ${missingDocs.join(', ')}`
      )
    }

    // Update status
    const updated = await this.prisma.application.update({
      where: { id },
      data: {
        status: 'submitted',
        submittedAt: new Date()
      }
    })

    // Create history
    await this.prisma.applicationStatusHistory.create({
      data: {
        applicationId: id,
        oldStatus: 'draft',
        newStatus: 'submitted',
        changedBy: userId
      }
    })

    // Send notification
    await this.emailService.sendApplicationSubmitted(
      application.userId,
      application.program.name
    )

    return updated
  }
}

// AFTER: Refactored with extracted methods and single responsibility
class ApplicationService {
  async submitApplication(id: string, userId: string) {
    const application = await this.findUserApplication(id, userId)
    
    this.validateCanSubmit(application)
    
    const updated = await this.executeSubmission(application, userId)
    
    await this.notifySubmission(application)
    
    return updated
  }

  private async findUserApplication(id: string, userId: string) {
    const application = await this.prisma.application.findFirst({
      where: { id, userId },
      include: { documents: true, program: true }
    })

    if (!application) {
      throw new NotFoundException('Application')
    }

    return application
  }

  private validateCanSubmit(application: ApplicationWithRelations): void {
    this.validateStatus(application)
    this.validateDeadline(application)
    this.validateDocuments(application)
  }

  private validateStatus(application: ApplicationWithRelations): void {
    if (application.status !== 'draft') {
      throw new BusinessException(
        'BIZ_ALREADY_SUBMITTED',
        'Application has already been submitted'
      )
    }
  }

  private validateDeadline(application: ApplicationWithRelations): void {
    if (new Date() > application.program.deadline) {
      throw new BusinessException(
        'BIZ_DEADLINE_PASSED',
        'The application deadline has passed'
      )
    }
  }

  private validateDocuments(application: ApplicationWithRelations): void {
    const missingDocs = this.findMissingDocuments(application)
    
    if (missingDocs.length > 0) {
      throw new BusinessException(
        'BIZ_INCOMPLETE',
        `Please upload the following documents: ${missingDocs.join(', ')}`
      )
    }
  }

  private findMissingDocuments(application: ApplicationWithRelations): string[] {
    const requiredDocuments = ['transcript', 'passport', 'motivation_letter']
    const uploadedTypes = new Set(
      application.documents.map(d => d.documentType)
    )
    
    return requiredDocuments.filter(type => !uploadedTypes.has(type))
  }

  private async executeSubmission(
    application: ApplicationWithRelations,
    userId: string
  ) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.application.update({
        where: { id: application.id },
        data: {
          status: 'submitted',
          submittedAt: new Date()
        }
      })

      await tx.applicationStatusHistory.create({
        data: {
          applicationId: application.id,
          oldStatus: application.status,
          newStatus: 'submitted',
          changedBy: userId
        }
      })

      return updated
    })
  }

  private async notifySubmission(
    application: ApplicationWithRelations
  ): Promise<void> {
    // Fire and forget - don't fail submission if notification fails
    this.emailService
      .sendApplicationSubmitted(
        application.userId,
        application.program.name
      )
      .catch(error => {
        this.logger.error('Failed to send submission email', error)
      })
  }
}
```

## Validation
- All tests still pass
- Code coverage maintained
- No functional changes
- Improved readability
- Documented changes