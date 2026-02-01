# Phase 10: Environment Readiness Gate (DEPLOYMENT CHECKPOINT)

**Phase**: Environment Build & Launch
**Primary Agent**: Environment Builder (Agent 10)
**Gate Type**: DEPLOYMENT CHECKPOINT

---

## GATE PURPOSE

This gate validates that the application environment is built, running, and reachable before testing begins (local scope) or before deployment proceeds (remote scope).

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT CHECKPOINT                         │
│                                                                  │
│  Local scope (before Phase 06):                                  │
│  • Application built and running locally                         │
│  • testing_environment.local.base_url in state.json              │
│  • Next: Phase 06 (Integration Testing)                          │
│                                                                  │
│  Remote scope (before Phase 11):                                 │
│  • Application built and deployed to staging                     │
│  • testing_environment.remote.base_url in state.json             │
│  • Next: Phase 11 (Staging Deployment)                           │
│                                                                  │
│  After remote scope gate passes:                                 │
│  • If cloud configured (AWS/GCP/Azure): Continue to Phase 11     │
│  • If provider == "none": WORKFLOW COMPLETES HERE                │
│  • If provider == "undecided": WORKFLOW PAUSES HERE              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Required Artifacts

| Artifact | Path | Required |
|----------|------|----------|
| Testing environment in state.json | `.isdlc/state.json` → `testing_environment` | Yes |
| Build log | `docs/devops/build-log.md` | Yes |
| Developer Guide | `docs/common/dev-guide.md` | If local scope |
| Environment Readiness Validation | `docs/.validations/gate-10-environment-readiness.json` | Yes |

---

## Validation Criteria

### Local Scope Criteria

- [ ] Tech stack read from state.json (or fallback detection succeeded)
- [ ] Build command executed successfully
- [ ] Dependent services started (if docker-compose.yml/compose.yaml exists)
- [ ] Application process running (PID recorded)
- [ ] Health check passed (HTTP 200 at `localhost:{port}`)
- [ ] `testing_environment.local.base_url` written to state.json
- [ ] User confirmed build plan via A/R/C menu

### Remote Scope Criteria

- [ ] Production build executed successfully
- [ ] Deployment to staging/remote completed
- [ ] Remote health check passed (HTTP 200 at remote URL)
- [ ] `testing_environment.remote.base_url` written to state.json

### Constitutional Compliance Iteration
- [ ] Constitutional self-validation performed
- [ ] Articles VIII, IX validated
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
| Build succeeded | [ ] Pass / [ ] Fail | |
| Application reachable | [ ] Pass / [ ] Fail | |
| Health check passed | [ ] Pass / [ ] Fail | |
| testing_environment in state.json | [ ] Pass / [ ] Fail | |
| Constitutional compliance | [ ] Pass / [ ] Fail | |

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
│  IF scope == "local":                                            │
│     → AUTOMATIC: Advancing to Phase 06: Integration Testing      │
│     → Primary Agent: Integration Tester (Agent 06)               │
│                                                                  │
│  IF scope == "remote":                                           │
│     Check cloud_configuration.provider in state.json:            │
│                                                                  │
│     IF provider == "aws" | "gcp" | "azure":                      │
│        → AUTOMATIC: Advancing to Phase 11: Staging Deployment    │
│        → Primary Agent: Deployment Engineer - Staging (Agent 11) │
│                                                                  │
│     IF provider == "none":                                       │
│        → WORKFLOW COMPLETE                                       │
│        → Status: Local-only development complete                 │
│                                                                  │
│     IF provider == "undecided":                                  │
│        → WORKFLOW PAUSED at Phase 10                             │
│        → Action: Run /sdlc configure-cloud                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Next Phase (Conditional)

Upon passing this gate:
- **Local scope**: Advance to Phase 06: Integration & Testing
  - Primary Agent: Integration Tester (Agent 06)
- **Remote scope + cloud configured**: Advance to Phase 11: Test Environment Deployment
  - Primary Agent: Deployment Engineer - Staging (Agent 11)
- **Remote scope + no cloud**: Workflow completes or pauses as described above
