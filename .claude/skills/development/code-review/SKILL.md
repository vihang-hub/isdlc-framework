---
name: code-review
description: Review code for quality, security, and standards compliance
skill_id: DEV-011
owner: developer
collaborators: [security, architecture]
project: sdlc-framework
version: 1.0.0
when_to_use: Pull request review, code quality assurance
dependencies: [DEV-001]
---

# Code Review

## Purpose
Review code changes for quality, security, performance, and standards compliance before merging.

## When to Use
- Pull request review
- Pre-merge validation
- Knowledge sharing
- Quality assurance

## Process

### Step 1: Understand Context
- Read PR description
- Review linked issues
- Understand requirements

### Step 2: Review Code
- Correctness
- Security concerns
- Performance implications
- Code style/standards
- Test coverage

### Step 3: Provide Feedback
- Clear, constructive comments
- Suggest improvements
- Ask questions
- Approve or request changes

## Project-Specific Considerations
- Check for PII handling
- Verify authentication/authorization
- Validate error handling
- Confirm test coverage

## Examples
```markdown
## Code Review Checklist

### Functionality
- [ ] Meets requirements
- [ ] Edge cases handled
- [ ] Error handling appropriate

### Security
- [ ] Input validation present
- [ ] No SQL injection risks
- [ ] Auth checks in place
- [ ] No secrets in code

### Quality
- [ ] Clear naming
- [ ] DRY principle followed
- [ ] Functions are focused
- [ ] Comments where needed

### Testing
- [ ] Unit tests present
- [ ] Tests are meaningful
- [ ] Edge cases tested
```