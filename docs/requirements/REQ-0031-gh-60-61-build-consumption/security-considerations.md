# Security Considerations: Build Consumption -- Init Split & Smart Staleness

**Feature**: GH-60 + GH-61 (Feature B: Build Consumption)
**Phase**: 03-architecture
**Status**: Draft
**Created**: 2026-02-20

---

## 1. Threat Assessment

This feature has a **LOW** security impact. Both GH-60 and GH-61 are internal refactors to the orchestration pipeline. No new external interfaces, network calls, authentication flows, or data stores are introduced. The changes operate entirely within the local filesystem and git repository.

---

## 2. Security-Relevant Changes

### 2.1 Git Command Execution (GH-61)

**Change**: `checkBlastRadiusStaleness()` executes `git diff --name-only {hash}..HEAD` via `child_process.execSync`.

**Threat**: Command injection if `meta.codebase_hash` contains shell metacharacters.

**Mitigation**:
- `meta.codebase_hash` is always written by the framework itself (never user-supplied). It is the output of `git rev-parse --short HEAD`, which produces a 7-12 character hex string.
- The hash is validated before use: it must match the pattern `/^[0-9a-f]{7,40}$/` (hex characters only, 7-40 chars). If validation fails, the function falls back to naive staleness (no git command executed).
- This is the same pattern used by the existing orchestrator (Section 3a branch creation) and blast-radius-validator, which already execute git commands with hash parameters.

**Recommendation**: Add an explicit hash validation check at the top of `checkBlastRadiusStaleness()`:
```javascript
const HASH_PATTERN = /^[0-9a-f]{7,40}$/;
if (!HASH_PATTERN.test(meta.codebase_hash)) {
    return { stale: true, severity: 'fallback', fallbackReason: 'invalid-hash-format' };
}
```

### 2.2 File System Reads (GH-61)

**Change**: The build handler reads `impact-analysis.md` from the artifact folder.

**Threat**: Path traversal if the artifact folder path is manipulated.

**Mitigation**:
- The artifact folder path is constructed from `requirementsDir` (a framework-controlled constant) and the item's slug directory (resolved via `resolveItem()` which validates against existing directories).
- `impact-analysis.md` is a known filename, not user-supplied.
- The file is read as a string and parsed as markdown -- no code execution from the content.

### 2.3 MODE: init-only (GH-60)

**Change**: New orchestrator mode that performs workflow initialization.

**Threat**: Mode confusion -- could an attacker invoke init-only in a context where init-and-phase-01 was expected, skipping Phase 01 gate validation?

**Mitigation**:
- The MODE parameter is set by isdlc.md (the command handler), not by the user. Users interact via natural language or `/isdlc build` -- they never directly specify MODE.
- The Phase-Loop Controller always validates gates after each phase, so Phase 01's gate is validated in STEP 3 regardless of which init mode was used.
- The gate validation path is not bypassed -- it is moved from the orchestrator to the Phase-Loop Controller.

---

## 3. Fail-Open Behavior Analysis

### 3.1 Staleness Check Fail-Open (Article X)

The blast-radius staleness check fails open in three scenarios:
1. `impact-analysis.md` missing -- fall back to naive hash comparison
2. `git diff` fails -- fall back to naive hash comparison
3. Impact analysis table unparseable -- fall back to naive hash comparison

**Security assessment**: The staleness check is an informational quality guard, not a security boundary. Failing open means the user might proceed with stale analysis, which could reduce output quality but does not create a security vulnerability. The naive fallback still presents a warning menu, so the user is informed that the codebase has changed.

**Article X compliance**: Fail-open is the correct default for non-security infrastructure. The staleness check has no authorization, authentication, or access control implications.

### 3.2 init-only Fail-Open

If `MODE: init-only` fails (e.g., cannot write state.json, cannot create branch), the orchestrator returns an error result and isdlc.md STEP 1 stops. This is fail-closed behavior (the build does not proceed on initialization failure), which is correct.

---

## 4. Data Integrity

### 4.1 State.json Integrity

`MODE: init-only` writes the same state.json fields as `init-and-phase-01` (active_workflow, phases, current_phase). The write operation is atomic (JSON.stringify + writeFileSync). No new fields are added (CON-002).

### 4.2 Impact-Analysis.md Integrity

The `extractFilesFromImpactAnalysis()` function performs read-only access on `impact-analysis.md`. The file is never modified by the staleness check. Per Section 8.1 of the orchestrator, `impact-analysis.md` is READ-ONLY after Phase 02 completes.

---

## 5. Secrets and Credentials

No secrets, credentials, API keys, or tokens are involved in this feature. The git operations use the local repository (no remote interactions). No network calls are made.

---

## 6. Compliance

No compliance implications (GDPR, HIPAA, PCI-DSS). The feature operates on local development artifacts with no personal data, financial data, or health data.

---

## 7. Summary

| Area | Risk Level | Notes |
|------|-----------|-------|
| Command injection (git) | LOW | Hash validated against hex pattern; same pattern as existing codebase |
| Path traversal | NONE | All paths framework-controlled |
| Mode confusion | NONE | MODE set by framework, not user; gates validated regardless |
| Fail-open staleness | ACCEPTABLE | Staleness is informational, not security-critical |
| Data integrity | NONE | Read-only access on impact-analysis.md; same write patterns for state.json |
| Secrets exposure | NONE | No secrets involved |

**Overall security posture**: This feature does not degrade the existing security posture. The single recommendation (explicit hash validation regex) is a defense-in-depth measure for the git command execution path.
