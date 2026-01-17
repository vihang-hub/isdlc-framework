# Phase 3: Design Gate Checklist

**Phase**: Design & API Contracts
**Primary Agent**: Design Agent

---

## Required Artifacts

| Artifact | Path | Required |
|----------|------|----------|
| OpenAPI Specification | `openapi.yaml` | Yes |
| Module Designs | `modules/` | Yes |
| Wireframes | `wireframes/` | Yes |
| Error Taxonomy | `error-taxonomy.md` | Yes |
| Validation Rules | `validation-rules.json` | No |
| User Flows | `user-flows.md` | No |

---

## Validation Criteria

### 1. API Design
- [ ] OpenAPI specification is valid (passes validation)
- [ ] All endpoints documented
- [ ] Request schemas defined with validation rules
- [ ] Response schemas defined
- [ ] Error responses standardized
- [ ] Authentication requirements specified per endpoint
- [ ] Versioning strategy implemented

### 2. Module Design
- [ ] All architectural components have module designs
- [ ] Each module has clear responsibilities
- [ ] Module dependencies documented
- [ ] Public interfaces defined
- [ ] Data models specified
- [ ] Error handling documented

### 3. UI/UX Design
- [ ] Wireframes exist for all screens
- [ ] User flows documented
- [ ] Component hierarchy defined
- [ ] Responsive breakpoints specified
- [ ] Accessibility requirements documented (WCAG level)
- [ ] All states defined (loading, error, empty, success)

### 4. Error Handling
- [ ] Error taxonomy defined
- [ ] Error codes documented
- [ ] HTTP status mappings specified
- [ ] User-facing messages defined
- [ ] Logging requirements specified

### 5. Integration Design
- [ ] External integrations specified
- [ ] Integration contracts documented
- [ ] Retry strategies defined
- [ ] Circuit breaker patterns documented (if applicable)

### 6. Validation Design
- [ ] Input validation rules defined
- [ ] Cross-field validation rules defined
- [ ] Business rule validations specified
- [ ] Sanitization rules defined

### 7. Requirement Coverage
- [ ] All functional requirements mapped to design components
- [ ] All user stories have corresponding UI designs
- [ ] All APIs support required functionality
- [ ] Security requirements reflected in design

---

## Gate Decision

| Criteria | Status | Notes |
|----------|--------|-------|
| Required artifacts present | [ ] Pass / [ ] Fail | |
| API specification complete | [ ] Pass / [ ] Fail | |
| Module designs complete | [ ] Pass / [ ] Fail | |
| UI designs complete | [ ] Pass / [ ] Fail | |
| Error handling defined | [ ] Pass / [ ] Fail | |
| Requirements covered | [ ] Pass / [ ] Fail | |

**Gate Status**: [ ] PASS / [ ] FAIL

**Reviewer**: _______________
**Date**: _______________

---

## Next Phase

Upon passing this gate:
- Advance to Phase 4: Test Strategy & Design
- Primary Agent: Test Manager Agent
- Command: `/sdlc-test-manager strategy`
