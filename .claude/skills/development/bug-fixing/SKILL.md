---
name: bug-fixing
description: Diagnose and fix software defects
skill_id: DEV-010
owner: developer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Bug resolution, defect fixing
dependencies: [DEV-001, DEV-002]
---

# Bug Fixing

## Purpose
Systematically diagnose, fix, and verify resolution of software defects while preventing regression.

## When to Use
- Bug reports
- Test failures
- Production issues
- User-reported problems

## Prerequisites
- Bug report with steps to reproduce
- Access to relevant code
- Testing capability

## Process

### Step 1: Understand the Bug
```
Gather information:
- Expected behavior
- Actual behavior
- Steps to reproduce
- Environment details
- Error messages/logs
```

### Step 2: Reproduce the Bug
```
Reproduction:
- Follow reported steps
- Verify bug exists
- Identify minimal reproduction
- Document reproduction steps
```

### Step 3: Locate the Cause
```
Debugging:
- Analyze stack traces
- Add logging
- Use debugger
- Review recent changes
- Check related code
```

### Step 4: Write Failing Test
```
Test first:
- Write test that fails
- Covers the bug scenario
- Will pass when fixed
```

### Step 5: Implement Fix
```
Fix approach:
- Minimal change
- Don't introduce new issues
- Consider edge cases
- Update related code
```

### Step 6: Verify Fix
```
Verification:
- New test passes
- All existing tests pass
- Manual verification
- No regression
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| bug_report | Markdown | Yes | Bug details |
| related_code | TypeScript | Yes | Affected code |
| logs | Text | Optional | Error logs |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| fix_code | TypeScript | Code changes |
| regression_test | TypeScript | Test for bug |
| fix_notes | Markdown | Documentation |

## Project-Specific Considerations
- Check form validation edge cases
- Verify OAuth flow
- Test deadline calculations
- Check timezone handling

## Integration Points
- **Test Manager**: Regression test addition
- **Operations Agent**: Production issue info

## Examples
```typescript
// BUG-042: Application submission timeout for concurrent requests

// Step 1: Bug Report
/*
 * Title: Submission fails with timeout for rapid double-click
 * Steps:
 * 1. Fill out application completely
 * 2. Click Submit button twice rapidly
 * 3. First request succeeds, second times out
 * 4. User sees error even though submission worked
 * 
 * Expected: Second click should be ignored or show "already submitting"
 * Actual: Error message shown, user confused about status
 */

// Step 2: Reproduce - confirmed in development

// Step 3: Root Cause
/*
 * The submit endpoint doesn't handle concurrent requests from same user.
 * Both requests try to update status to 'submitted'.
 * Second request fails because status is no longer 'draft'.
 * Error handling shows generic error instead of "already submitted".
 */

// Step 4: Write failing test
describe('ApplicationService - concurrent submission', () => {
  it('should handle concurrent submit requests gracefully', async () => {
    const application = await createDraftApplication()
    
    // Simulate concurrent requests
    const results = await Promise.allSettled([
      service.submit(application.id, userId),
      service.submit(application.id, userId)
    ])

    // One should succeed
    const successes = results.filter(r => r.status === 'fulfilled')
    expect(successes).toHaveLength(1)

    // Other should fail with specific error, not generic
    const failures = results.filter(r => r.status === 'rejected')
    expect(failures).toHaveLength(1)
    expect(failures[0].reason.code).toBe('BIZ_ALREADY_SUBMITTED')
  })

  it('should return existing submission if already submitted', async () => {
    const application = await createDraftApplication()
    
    // First submit
    const first = await service.submit(application.id, userId)
    expect(first.status).toBe('submitted')

    // Second submit should return same result, not error
    await expect(
      service.submit(application.id, userId)
    ).rejects.toThrow(BusinessException)
    
    // Verify the error is user-friendly
    try {
      await service.submit(application.id, userId)
    } catch (e) {
      expect(e.message).toContain('already been submitted')
    }
  })
})

// Step 5: Implement fix
class ApplicationService {
  async submit(id: string, userId: string) {
    // Use transaction with locking to prevent race condition
    return this.prisma.$transaction(async (tx) => {
      // Lock the row for update
      const application = await tx.$queryRaw`
        SELECT * FROM applications 
        WHERE id = ${id} AND user_id = ${userId}
        FOR UPDATE
      `

      if (!application) {
        throw new NotFoundException('Application')
      }

      // Handle already submitted case with clear message
      if (application.status === 'submitted') {
        throw new BusinessException(
          'BIZ_ALREADY_SUBMITTED',
          'This application has already been submitted successfully. ' +
          'You can view its status in your dashboard.'
        )
      }

      if (application.status !== 'draft') {
        throw new BusinessException(
          'BIZ_INVALID_STATUS',
          `Application cannot be submitted from ${application.status} status`
        )
      }

      // ... rest of submission logic
    }, {
      isolationLevel: 'Serializable',
      timeout: 10000
    })
  }
}

// Frontend fix - disable button during submission
function SubmitButton({ applicationId }) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submit = useSubmitApplication()

  const handleSubmit = async () => {
    if (isSubmitting) return // Prevent double-click
    
    setIsSubmitting(true)
    try {
      await submit.mutateAsync(applicationId)
      toast.success('Application submitted successfully!')
    } catch (error) {
      if (error.code === 'BIZ_ALREADY_SUBMITTED') {
        // Not really an error - show success
        toast.info(error.message)
      } else {
        toast.error(error.message)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <button 
      onClick={handleSubmit}
      disabled={isSubmitting}
      className={isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}
    >
      {isSubmitting ? 'Submitting...' : 'Submit Application'}
    </button>
  )
}

// Step 6: Verify
// - All new tests pass ✓
// - All existing tests pass ✓
// - Manual test: double-click no longer causes error ✓
// - Manual test: shows appropriate message ✓
```

## Validation
- Bug is fixed
- Regression test added
- No new issues introduced
- All tests pass
- Fix documented