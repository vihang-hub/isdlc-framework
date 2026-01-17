# Phase 2: Architecture Gate Checklist

**Phase**: Architecture & Blueprint
**Primary Agent**: Architecture Agent

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
- [ ] Security reviewed by Security Agent

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
- Primary Agent: Design Agent
- Command: `/sdlc-design api` and `/sdlc-design modules`
