# Local Verification Signoff

**Project**: [PROJECT_NAME]
**Date**: [DATE]
**Signed Off By**: [DEVELOPER_NAME]

---

## Purpose

This document confirms that the software has been fully tested and verified in the local
development environment and is ready for deployment (if cloud provider is configured).

This signoff is MANDATORY before:
- Advancing to Phase 11 (Staging Deployment)
- Marking workflow complete (for local-only projects)

---

## Pre-Signoff Checklist

### 1. Test Execution
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] All e2e tests passing (if applicable)
- [ ] Test coverage meets threshold (unit: ≥80%, integration: ≥70%)

**Test Results Summary**:
| Test Type | Total | Passed | Failed | Skipped | Coverage |
|-----------|-------|--------|--------|---------|----------|
| Unit | | | | | % |
| Integration | | | | | % |
| E2E | | | | | % |

### 2. Manual Verification
- [ ] Critical user journeys tested manually
- [ ] All forms and inputs validated
- [ ] Error handling verified
- [ ] Success flows completed

**Critical Journeys Tested**:
1. [ ] [Journey 1]: _________________
2. [ ] [Journey 2]: _________________
3. [ ] [Journey 3]: _________________
4. [ ] [Journey 4]: _________________

### 3. Local Environment Health
- [ ] All services start successfully
- [ ] Database connections working
- [ ] External service mocks functioning
- [ ] No console errors or warnings

### 4. Performance Check
- [ ] Page load times acceptable
- [ ] API response times acceptable
- [ ] No memory leaks observed
- [ ] No performance degradation noted

### 5. Bug Status
- [ ] No critical bugs open
- [ ] No high-priority bugs open
- [ ] All blocking issues resolved

**Open Bugs (if any)**:
| Bug ID | Severity | Description | Status |
|--------|----------|-------------|--------|
| | | | |

---

## Signoff Declaration

I confirm that:

1. All automated tests are passing in the local environment
2. Manual verification of critical functionality is complete
3. The software behaves as expected per the requirements
4. No critical or high-severity bugs are unresolved
5. The software is ready for deployment (if cloud configured) or local use

### Developer Signoff

**Name**: _______________________________

**Date**: _______________________________

**Signature**: _______________________________

---

## Cloud Configuration Status

Current cloud_configuration.provider: [ ] aws [ ] gcp [ ] azure [ ] none [ ] undecided

**If cloud configured (aws/gcp/azure)**:
- [ ] Ready for staging deployment
- [ ] Credentials verified and available

**If no cloud (none)**:
- [ ] Workflow complete (local-only development)
- [ ] Software ready for local use

**If undecided**:
- [ ] Workflow paused at deployment checkpoint
- [ ] Will configure cloud later via /isdlc configure-cloud

---

## Next Steps

Based on cloud configuration:

| Configuration | Next Action |
|---------------|-------------|
| aws/gcp/azure | Advance to Phase 11: Staging Deployment |
| none | Workflow Complete - Local-only |
| undecided | Run /isdlc configure-cloud to continue |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | | | Initial signoff |
