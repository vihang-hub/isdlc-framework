# Phase 3: Design Gate Checklist

**Phase**: Design & Specifications
**Primary Agent**: System Designer (Agent 03)

---

## Required Artifacts

| Artifact | Path | Required |
|----------|------|----------|
| Interface Specification | `interface-spec.yaml` or `openapi.yaml` | Yes |
| Module Designs | `modules/` | Yes |
| Wireframes | `wireframes/` | Yes |
| Error Taxonomy | `error-taxonomy.md` | Yes |
| Validation Rules | `validation-rules.json` | No |
| User Flows | `user-flows.md` | No |

---

## Validation Criteria

### 1. Interface Design
- [ ] Interface specification is valid (OpenAPI for APIs, or equivalent for CLIs/libraries)
- [ ] All interfaces documented (endpoints, commands, methods)
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
- [ ] All interfaces support required functionality
- [ ] Security requirements reflected in design

### 8. Constitutional Compliance Iteration (NEW)
- [ ] Constitutional self-validation performed
- [ ] Articles I, V, VI, VII, XI validated
- [ ] Iteration count logged in state.json → `constitutional_validation`
- [ ] All violations documented and addressed
- [ ] Final status is "compliant" (not "escalated" or "iterating")
- [ ] Iterations within limit (Quick: 3, Standard: 5, Enterprise: 7)
- [ ] If escalated: unresolved violations documented with recommendations

---

## Gate Decision

| Criteria | Status | Notes |
|----------|--------|-------|
| Required artifacts present | [ ] Pass / [ ] Fail | |
| Interface specification complete | [ ] Pass / [ ] Fail | |
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
- Primary Agent: Test Design Engineer (Agent 04)
- Next Phase Handler: test-design-engineer
