---
name: acceptance-criteria-writing
description: Define testable acceptance criteria for user stories
skill_id: REQ-009
owner: requirements
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: User story refinement, test case basis, definition of done
dependencies: [REQ-002]
---

# Acceptance Criteria Writing

## Purpose
Write clear, specific, and testable acceptance criteria that define exactly when a user story is complete and can be used directly for test case creation.

## When to Use
- User story creation
- Story refinement sessions
- Before sprint commitment
- Test case planning

## Prerequisites
- User story defined
- Domain understanding
- Edge cases identified
- Error scenarios known

## Process

### Step 1: Identify Scenarios
```
For each user story, identify:
- Happy path (main success scenario)
- Alternative paths (valid variations)
- Error paths (invalid inputs, failures)
- Edge cases (boundaries, limits)
```

### Step 2: Use Given-When-Then Format
```
Structure:
GIVEN [precondition/context]
  AND [additional context]
WHEN [action is performed]
  AND [additional action]
THEN [expected outcome]
  AND [additional outcome]
```

### Step 3: Make Criteria Testable
```
Testable criteria:
✓ "Search results appear within 2 seconds"
✗ "Search is fast"

✓ "Error message displays: 'Invalid email format'"
✗ "Appropriate error is shown"

✓ "User receives email within 5 minutes"
✗ "User is notified"
```

### Step 4: Cover All Paths
```
Checklist:
- [ ] Happy path covered
- [ ] All input validations
- [ ] All error conditions
- [ ] Boundary values tested
- [ ] Security scenarios (if applicable)
- [ ] Accessibility requirements (if UI)
```

### Step 5: Review and Validate
```
Quality checks:
- Each AC is independently testable
- No ambiguous terms
- Specific expected outcomes
- Covers acceptance by stakeholder
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| user_story | Markdown | Yes | Story to detail |
| domain_rules | Markdown | Optional | Business rules |
| similar_stories | JSON | Optional | Reference patterns |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| acceptance_criteria | Markdown | GWT format criteria |
| test_case_outline | Markdown | Ready for test creation |

## Project-Specific Considerations
- Include GDPR consent in user registration AC
- Specify OAuth2 flows in authentication AC
- Include accessibility checks in UI stories
- Specify file types/sizes in upload stories

## Integration Points
- **Test Manager**: AC becomes test cases
- **Developer**: AC is definition of done
- **BMAD QA**: Validation reference
- **Ralph Wiggum**: /ralph-loop for iterative AC refinement until testable

## Examples
```
User Story: US-005 - Document Upload

As a study abroad applicant
I want to upload required documents
So that I can complete my application

Acceptance Criteria:

AC1: Successful upload
GIVEN I am logged in and on my application page
  AND I have a PDF document under 10MB
WHEN I click "Upload Document" and select the file
THEN the document uploads successfully
  AND I see a success message "Document uploaded"
  AND the document appears in my documents list
  AND the upload timestamp is displayed

AC2: File type validation
GIVEN I am on the document upload page
WHEN I attempt to upload a file that is not PDF, JPG, or PNG
THEN the upload is rejected
  AND I see error "Invalid file type. Please upload PDF, JPG, or PNG"
  AND no file is stored

AC3: File size limit
GIVEN I am on the document upload page
WHEN I attempt to upload a file larger than 10MB
THEN the upload is rejected
  AND I see error "File too large. Maximum size is 10MB"

AC4: Upload progress
GIVEN I am uploading a document
WHEN the upload is in progress
THEN I see a progress indicator
  AND the upload button is disabled
  AND I can cancel the upload

AC5: Duplicate handling
GIVEN I have already uploaded a document named "transcript.pdf"
WHEN I upload another file named "transcript.pdf"
THEN I am prompted to confirm replacement
  AND previous version is retained until confirmed

AC6: Upload failure recovery
GIVEN my upload fails due to network error
WHEN the connection is restored
THEN I can retry the upload
  AND partial uploads are cleaned up
```

## Validation
- All scenarios covered (happy, error, edge)
- Given-When-Then format used
- Specific measurable outcomes
- No ambiguous language
- Traceable to requirements