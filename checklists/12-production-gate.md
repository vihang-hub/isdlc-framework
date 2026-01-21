# Phase 12: Production Deployment Gate Checklist

**Phase**: Production Deployment
**Primary Agent**: Release Manager (Agent 12)

---

## Prerequisites (MANDATORY)

Before this phase can begin, the following prerequisites MUST be met:

| Prerequisite | Check | Description |
|--------------|-------|-------------|
| GATE-10 Passed | [ ] | Local Testing gate must have passed |
| GATE-11 Passed | [ ] | Staging Deployment gate must have passed |
| Cloud Provider Configured | [ ] | `cloud_configuration.provider` must be `aws`, `gcp`, or `azure` |
| Production Enabled | [ ] | `cloud_configuration.deployment.production_enabled` must be `true` |

```
┌─────────────────────────────────────────────────────────────────┐
│                PHASE 12 PREREQUISITES CHECK                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. GATE-10 (Local Testing): [PASSED / NOT PASSED]              │
│  2. GATE-11 (Staging): [PASSED / NOT PASSED / SKIPPED]          │
│  3. Cloud Provider: [aws / gcp / azure / none / undecided]      │
│  4. Production Enabled: [true / false]                          │
│                                                                  │
│  IF any prerequisite fails → Phase SKIPPED automatically        │
│  IF all prerequisites pass → Phase can proceed                  │
│                                                                  │
│  NOTE: GATE-11 (Staging) must pass before production.           │
│  Skipping staging is NOT allowed for production deployment.     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**If prerequisites not met:**
- This phase is **SKIPPED automatically**
- Workflow completes at Phase 11 (staging only) or earlier
- Production deployment requires successful staging validation first

---

## Required Artifacts

| Artifact | Path | Required |
|----------|------|----------|
| Pre-deployment Checklist | `pre-deployment-checklist.md` | Yes |
| Production Deployment Log | `deployment-log-production.md` | Yes |
| Post-deployment Verification | `post-deployment-verification.md` | Yes |
| Release Notes | `release-notes.md` | Yes |

---

## Pre-Deployment Criteria

### 1. Approval Requirements
- [ ] All previous gates passed
- [ ] Security sign-off obtained
- [ ] Stakeholder approval obtained
- [ ] Deployment window confirmed
- [ ] Change management approval (if required)

### 2. Readiness Verification
- [ ] All tests passing
- [ ] No critical/high defects
- [ ] Security scan clean
- [ ] Performance targets verified
- [ ] Documentation complete

### 3. Operational Readiness
- [ ] Monitoring configured
- [ ] Alerting configured
- [ ] Logging configured
- [ ] Runbooks ready
- [ ] On-call schedule confirmed

### 4. Backup and Recovery
- [ ] Production backup taken
- [ ] Backup verified
- [ ] Recovery procedure tested
- [ ] Rollback procedure ready

### 5. Communication
- [ ] Stakeholders notified
- [ ] Support team notified
- [ ] Status page prepared (if applicable)

---

## Deployment Criteria

### 6. Deployment Execution
- [ ] Deployment started at scheduled time
- [ ] Deployment completed successfully
- [ ] No errors during deployment
- [ ] Database migrations successful

### 7. Post-Deployment Verification
- [ ] Health checks passing
- [ ] Smoke tests passing
- [ ] Critical functionality verified
- [ ] No spike in errors
- [ ] Response times normal
- [ ] External integrations working

### 8. Monitoring Verification
- [ ] Metrics being collected
- [ ] Dashboards showing data
- [ ] Alerts working
- [ ] Logs flowing

---

## Post-Deployment Criteria

### 9. Release Documentation
- [ ] Release notes published
- [ ] CHANGELOG updated
- [ ] Version tagged in git
- [ ] Documentation updated

### 10. Stakeholder Communication
- [ ] Deployment success communicated
- [ ] Any known issues communicated
- [ ] Support team briefed

### 11. Hypercare Period
- [ ] Enhanced monitoring active
- [ ] Team available for quick response
- [ ] Rollback ready if needed
- [ ] User feedback channels monitored

---

## Rollback Criteria

**Initiate rollback if any of the following occur:**
- [ ] Error rate > 5%
- [ ] Response time p99 > {threshold}ms
- [ ] Health checks failing repeatedly
- [ ] Critical functionality broken
- [ ] Security issue discovered
- [ ] Data integrity issue

### 12. Constitutional Compliance Iteration (NEW)
- [ ] Constitutional self-validation performed
- [ ] Articles IX, X, XI validated
- [ ] Iteration count logged in state.json → `constitutional_validation`
- [ ] All violations documented and addressed
- [ ] Final status is "compliant" (not "escalated" or "iterating")
- [ ] Iterations within limit (Quick: 3, Standard: 5, Enterprise: 7)
- [ ] If escalated: unresolved violations documented with recommendations

---

## Gate Decision

| Criteria | Status | Notes |
|----------|--------|-------|
| Pre-deployment checks passed | [ ] Pass / [ ] Fail | |
| Approvals obtained | [ ] Pass / [ ] Fail | |
| Deployment successful | [ ] Pass / [ ] Fail | |
| Post-deployment verified | [ ] Pass / [ ] Fail | |
| Monitoring verified | [ ] Pass / [ ] Fail | |
| Release documented | [ ] Pass / [ ] Fail | |
| No rollback triggered | [ ] Pass / [ ] Fail | |

**Gate Status**: [ ] PASS / [ ] FAIL

**Reviewer**: _______________
**Date**: _______________

---

## Next Phase

Upon passing this gate:
- Advance to Phase 13: Production Operations & Monitoring
- Primary Agent: Site Reliability Engineer (Agent 13)
- Next Phase Handler: site-reliability-engineer
