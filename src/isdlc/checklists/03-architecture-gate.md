# Phase 03: Architecture Gate Checklist

**Phase**: Architecture & Blueprint
**Primary Agent**: Solution Architect (Agent 03)

---

## Required Artifacts

| Artifact | Path | Required |
|----------|------|----------|
| Architecture Overview | `architecture-overview.md` | Yes |
| Tech Stack Decision | `tech-stack-decision.md` | Yes |
| Database Design | `database-design.md` | Yes |
| Security Architecture | `security-architecture.md` | Yes |
| ADRs | `adrs/` | Yes (at least 1) |
| Diagrams | `diagrams/` | Yes |

---

## Validation Criteria

### 1. Architecture Documentation
- [ ] System context diagram (C4 Level 1) exists
- [ ] Container diagram (C4 Level 2) exists
- [ ] Architecture pattern documented and justified
- [ ] All major components identified
- [ ] Component responsibilities defined

### 2. Technology Stack
- [ ] Frontend technology selected and justified
- [ ] Backend technology selected and justified
- [ ] Database technology selected and justified
- [ ] Authentication approach selected and justified
- [ ] Cloud/hosting platform selected
- [ ] Evaluation criteria documented

### 3. Database Design
- [ ] Entity-relationship diagram exists
- [ ] Schema design documented
- [ ] Data relationships defined
- [ ] Migration strategy documented
- [ ] Backup strategy defined

### 4. Security Architecture
- [ ] Authentication flow designed
- [ ] Authorization model defined (RBAC/ABAC)
- [ ] Encryption strategy documented (at-rest, in-transit)
- [ ] Secret management approach defined
- [ ] Security reviewed by Security & Compliance Auditor

### 5. Infrastructure
- [ ] Environment strategy defined (dev/staging/prod)
- [ ] Deployment architecture documented
- [ ] Scaling strategy documented
- [ ] Cost estimate provided

### 6. Architecture Decision Records
- [ ] ADR exists for architecture pattern
- [ ] ADR exists for database selection
- [ ] ADR exists for authentication approach
- [ ] All ADRs have status (Accepted/Proposed)

### 7. NFR Coverage
- [ ] Architecture addresses performance requirements
- [ ] Architecture addresses scalability requirements
- [ ] Architecture addresses availability requirements
- [ ] Architecture addresses security requirements

### 8. Constitutional Compliance Iteration (NEW)
- [ ] Constitutional self-validation performed
- [ ] Articles III, IV, V, VII, IX, X validated
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
| Architecture documented | [ ] Pass / [ ] Fail | |
| Tech stack justified | [ ] Pass / [ ] Fail | |
| Database designed | [ ] Pass / [ ] Fail | |
| Security reviewed | [ ] Pass / [ ] Fail | |
| NFRs addressed | [ ] Pass / [ ] Fail | |

**Gate Status**: [ ] PASS / [ ] FAIL

**Reviewer**: _______________
**Date**: _______________

---

## Next Phase

Upon passing this gate:
- Advance to Phase 3: Design & API Contracts
- Primary Agent: System Designer (Agent 03)
- Next Phase Handler: system-designer
