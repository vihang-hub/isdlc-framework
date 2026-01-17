# Phase 1: Requirements Gate Checklist

**Phase**: Requirements Capture & Clarification
**Primary Agent**: Requirements Analyst (Agent 01)

---

## Required Artifacts

| Artifact | Path | Required |
|----------|------|----------|
| Requirements Specification | `requirements-spec.md` | Yes |
| User Stories | `user-stories.json` | Yes |
| NFR Matrix | `nfr-matrix.md` | Yes |
| Traceability Matrix | `traceability-matrix.csv` | No |
| Glossary | `glossary.md` | No |

---

## Validation Criteria

### 1. Requirements Completeness
- [ ] All functional requirements documented
- [ ] All non-functional requirements documented
- [ ] All constraints identified
- [ ] All assumptions documented

### 2. Requirements Quality
- [ ] Each requirement has a unique ID (REQ-XXX, NFR-XXX, CON-XXX)
- [ ] Each requirement has a clear description
- [ ] Each requirement has a priority (Must/Should/Could/Won't)
- [ ] No ambiguous requirements (flagged and resolved)
- [ ] No conflicting requirements (flagged and resolved)

### 3. User Stories
- [ ] User stories exist for all functional requirements
- [ ] Each user story follows standard format (As a... I want... So that...)
- [ ] Each user story has at least one acceptance criterion
- [ ] Acceptance criteria use Given/When/Then format
- [ ] Stories are prioritized

### 4. Non-Functional Requirements
- [ ] Performance requirements have quantifiable metrics
- [ ] Security requirements are specified
- [ ] Scalability requirements are specified
- [ ] Availability requirements are specified (if applicable)
- [ ] Compliance requirements are specified (if applicable)

### 5. Traceability
- [ ] Requirements are linked to features/epics
- [ ] No orphan requirements
- [ ] Dependencies between requirements are documented

### 6. Stakeholder Approval
- [ ] Requirements reviewed with stakeholders
- [ ] Key requirements confirmed
- [ ] Sign-off obtained (if required)

---

## Gate Decision

| Criteria | Status | Notes |
|----------|--------|-------|
| Required artifacts present | [ ] Pass / [ ] Fail | |
| Requirements complete | [ ] Pass / [ ] Fail | |
| Requirements quality met | [ ] Pass / [ ] Fail | |
| User stories complete | [ ] Pass / [ ] Fail | |
| NFRs quantified | [ ] Pass / [ ] Fail | |
| Stakeholder approval | [ ] Pass / [ ] Fail | |

**Gate Status**: [ ] PASS / [ ] FAIL

**Reviewer**: _______________
**Date**: _______________

---

## Next Phase

Upon passing this gate:
- Advance to Phase 2: Architecture & Blueprint
- Primary Agent: Architecture Agent
- Command: `/sdlc-architecture design`
