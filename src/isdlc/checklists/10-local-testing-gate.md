# Phase 10: Local Testing Gate (DEPLOYMENT CHECKPOINT)

**Phase**: Local Development & Manual Testing
**Primary Agent**: Dev Environment Engineer (Agent 10)
**Gate Type**: DEPLOYMENT CHECKPOINT

---

## GATE PURPOSE

This gate validates that the software works correctly in a local environment and is the
**MANDATORY CHECKPOINT** before ANY remote deployment.

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT CHECKPOINT                         │
│                                                                  │
│  After this gate passes:                                         │
│  • If cloud configured (AWS/GCP/Azure): Continue to Phase 11     │
│  • If provider == "none": WORKFLOW COMPLETES HERE                │
│  • If provider == "undecided": WORKFLOW PAUSES HERE              │
│                                                                  │
│  This is the last common gate for ALL workflow configurations.   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Required Artifacts

| Artifact | Path | Required |
|----------|------|----------|
| Local Setup Documentation | `docs/local-setup.md` | Yes |
| Manual Test Results | `manual-test-results.md` | Yes |
| Local Verification Signoff | `local-verification-signoff.md` | Yes |
| Bug Reports | `bugs/` | If found |

---

## Validation Criteria

### 1. Local Environment
- [ ] Local environment setup documented
- [ ] Docker Compose (or equivalent) working
- [ ] All services start successfully
- [ ] Hot reload functioning
- [ ] Local database with seed data
- [ ] Mock services configured (if needed)

### 2. Local Setup Verification
- [ ] Fresh clone and setup works
- [ ] Setup instructions are accurate
- [ ] Dependencies install correctly
- [ ] Configuration steps are clear
- [ ] Common issues documented

### 3. Manual Testing
- [ ] All critical user journeys tested manually
- [ ] UI renders correctly
- [ ] Forms work correctly
- [ ] Validation messages display
- [ ] Error handling works
- [ ] Success flows complete

### 4. Cross-Browser Testing (if applicable)
- [ ] Chrome tested
- [ ] Firefox tested
- [ ] Safari tested
- [ ] Edge tested
- [ ] Mobile browsers tested (if required)

### 5. Responsive Design
- [ ] Mobile viewport tested
- [ ] Tablet viewport tested
- [ ] Desktop viewport tested
- [ ] No layout issues

### 6. Exploratory Testing
- [ ] Exploratory testing performed
- [ ] Edge cases discovered documented
- [ ] Usability issues noted
- [ ] Performance observations noted

### 7. Bug Management
- [ ] All bugs documented
- [ ] Bug severity assigned
- [ ] Critical bugs fixed
- [ ] High bugs fixed or accepted

### 8. Developer Experience
- [ ] Build time acceptable
- [ ] Test execution time acceptable
- [ ] Developer documentation adequate
- [ ] Debugging tools available

### 9. Constitutional Compliance Iteration
- [ ] Constitutional self-validation performed
- [ ] Articles VIII, IX validated
- [ ] Iteration count logged in state.json → `constitutional_validation`
- [ ] All violations documented and addressed
- [ ] Final status is "compliant" (not "escalated" or "iterating")
- [ ] Iterations within limit (Quick: 3, Standard: 5, Enterprise: 7)
- [ ] If escalated: unresolved violations documented with recommendations

### 10. Local Verification Signoff (MANDATORY FOR DEPLOYMENT)
- [ ] All tests passing locally (unit, integration, e2e)
- [ ] Manual verification of critical user journeys complete
- [ ] `local-verification-signoff.md` created and completed
- [ ] Developer confirms software is ready for deployment
- [ ] No unresolved critical or high bugs
- [ ] Performance acceptable in local environment

---

## Gate Decision

| Criteria | Status | Notes |
|----------|--------|-------|
| Required artifacts present | [ ] Pass / [ ] Fail | |
| Local environment works | [ ] Pass / [ ] Fail | |
| Manual testing complete | [ ] Pass / [ ] Fail | |
| Cross-browser verified | [ ] Pass / [ ] Fail | |
| Responsive design verified | [ ] Pass / [ ] Fail | |
| No critical bugs | [ ] Pass / [ ] Fail | |
| Developer experience acceptable | [ ] Pass / [ ] Fail | |

| Local verification signoff complete | [ ] Pass / [ ] Fail | |

**Gate Status**: [ ] PASS / [ ] FAIL

**Reviewer**: _______________
**Date**: _______________

---

## Conditional Workflow Continuation

```
┌─────────────────────────────────────────────────────────────────┐
│                     GATE-10 PASSED                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Check cloud_configuration.provider in state.json:               │
│                                                                  │
│  IF provider == "aws" | "gcp" | "azure":                         │
│     → AUTOMATIC: Advancing to Phase 11: Staging Deployment       │
│     → Primary Agent: Deployment Engineer - Staging (Agent 11)    │
│                                                                  │
│  IF provider == "none":                                          │
│     → WORKFLOW COMPLETE                                          │
│     → Status: Local-only development complete                    │
│     → All software validated and ready for local use             │
│                                                                  │
│  IF provider == "undecided":                                     │
│     → WORKFLOW PAUSED at Phase 10                                │
│     → Action: Run /sdlc configure-cloud to:                      │
│       • Configure cloud provider settings                        │
│       • Resume workflow with deployment phases                   │
│     → Alternative: Mark workflow as complete (local-only)        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Workflow Completion Messages

### If provider == "none" (Local-only)
```
WORKFLOW COMPLETE

Phase 10 (Local Testing) gate passed.
Provider: none (local-only development)

Your software has been:
✓ Built and tested locally
✓ Manually verified
✓ Signed off for local use

No remote deployment configured.
To enable deployment later, run: /sdlc configure-cloud
```

### If provider == "undecided"
```
WORKFLOW PAUSED AT DEPLOYMENT CHECKPOINT

Phase 10 (Local Testing) gate passed.
Provider: undecided

Your software is ready for deployment, but no cloud provider is configured.

To continue:
1. Run /sdlc configure-cloud to configure deployment
2. Workflow will resume with Phase 11 (Staging)

To complete without deployment:
- Run /sdlc configure-cloud and select "Local only"
```

---

## Next Phase (Conditional)

Upon passing this gate:
- **If cloud configured**: Advance to Phase 11: Test Environment Deployment
  - Primary Agent: Deployment Engineer - Staging (Agent 11)
  - Next Phase Handler: deployment-engineer-staging
- **If no cloud**: Workflow completes or pauses as described above
