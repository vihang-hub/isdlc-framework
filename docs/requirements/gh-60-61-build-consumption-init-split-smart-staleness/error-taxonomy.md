# Error Taxonomy: Build Consumption -- Init Split & Smart Staleness

**Feature**: GH-60 + GH-61 (Feature B: Build Consumption)
**Artifact Folder**: gh-60-61-build-consumption-init-split-smart-staleness
**Phase**: 04-design
**Status**: Draft
**Created**: 2026-02-20

**Traces**: FR-001 through FR-007, NFR-003

---

## 1. Overview

This document catalogs all error conditions, their codes, messages, severity levels,
and recovery strategies for both GH-60 (init-only mode) and GH-61 (smart staleness).

**Design principle**: The staleness check is an informational quality guard, not a
security boundary. Per Article X (Fail-Safe Defaults), all staleness errors degrade
gracefully to existing behavior rather than blocking the build.

---

## 2. Error Classification

| Category | Prefix | Behavior |
|----------|--------|----------|
| Infrastructure (init) | ERR-INIT | Blocking -- workflow cannot proceed |
| Staleness (parse) | ERR-STALE | Non-blocking -- fallback to naive check |
| Staleness (git) | ERR-GIT | Non-blocking -- fallback to naive check |
| Deprecation | WARN-DEPR | Non-blocking -- informational notice |

---

## 3. GH-60: Init-Only Mode Errors

### 3.1 ERR-INIT-001: Constitution Not Found

| Field | Value |
|-------|-------|
| Code | ERR-INIT-001 |
| Condition | `docs/isdlc/constitution.md` does not exist when init-only runs |
| Message | `"Cannot initialize workflow: constitution not found at docs/isdlc/constitution.md. Run 'isdlc init' first."` |
| Severity | FATAL |
| Recovery | User must run `isdlc init` to set up the project |
| Behavior | Stop initialization, do not write state.json |
| FR Trace | FR-001 (prerequisite) |

**Note**: This is an existing error from init-and-phase-01, preserved identically in init-only.

### 3.2 ERR-INIT-002: Active Workflow Exists

| Field | Value |
|-------|-------|
| Code | ERR-INIT-002 |
| Condition | `state.json` has a non-null `active_workflow` when init-only runs |
| Message | `"Cannot initialize: a workflow is already active ({workflow_type}: {description}). Cancel it first with '/isdlc cancel'."` |
| Severity | FATAL |
| Recovery | User must cancel or complete the existing workflow |
| Behavior | Stop initialization, do not overwrite active_workflow |
| FR Trace | FR-001 (prerequisite) |

**Note**: Existing error, preserved identically.

### 3.3 ERR-INIT-003: Branch Creation Failed

| Field | Value |
|-------|-------|
| Code | ERR-INIT-003 |
| Condition | `git checkout -b {branch}` fails (e.g., branch already exists, git not available) |
| Message | `"Branch creation failed: {git error message}. Workflow initialized but branch not created."` |
| Severity | ERROR |
| Recovery | User can create the branch manually or cancel and retry |
| Behavior | Stop initialization -- workflow state is partially written |
| FR Trace | FR-001 (AC-001-03) |

**Note**: Existing error, preserved identically.

### 3.4 ERR-INIT-004: Workflow Definition Not Found

| Field | Value |
|-------|-------|
| Code | ERR-INIT-004 |
| Condition | `workflows.json` does not contain a definition for the requested ACTION type |
| Message | `"No workflow definition found for action '{action}' in workflows.json."` |
| Severity | FATAL |
| Recovery | Verify the ACTION type is valid |
| Behavior | Stop initialization |
| FR Trace | FR-001 (prerequisite) |

### 3.5 ERR-INIT-005: Invalid START_PHASE

| Field | Value |
|-------|-------|
| Code | ERR-INIT-005 |
| Condition | START_PHASE provided but not found in the workflow's phases array |
| Message | `"START_PHASE '{phase}' not found in {workflow_type} workflow phases."` |
| Severity | FATAL |
| Recovery | Verify the START_PHASE is a valid phase key for the workflow |
| Behavior | Stop initialization |
| FR Trace | FR-001 (AC-001-02) |

---

## 4. GH-61: Smart Staleness Errors

### 4.1 ERR-STALE-001: Impact Analysis Missing (Fallback)

| Field | Value |
|-------|-------|
| Code | ERR-STALE-001 |
| Condition | `impact-analysis.md` does not exist in the artifact folder |
| Message | (none -- no user-visible error message) |
| Severity | INFO |
| Recovery | Automatic fallback to naive hash comparison |
| Behavior | `checkBlastRadiusStaleness` returns `{ severity: 'fallback', fallbackReason: 'no-impact-analysis' }` |
| FR Trace | FR-004 (AC-004-05), NFR-003 (AC-NFR-003-01) |

### 4.2 ERR-STALE-002: Impact Analysis Unparseable (Fallback)

| Field | Value |
|-------|-------|
| Code | ERR-STALE-002 |
| Condition | `impact-analysis.md` exists but has no parseable "Directly Affected Files" table |
| Message | (none -- no user-visible error message) |
| Severity | INFO |
| Recovery | Automatic fallback to naive hash comparison |
| Behavior | `extractFilesFromImpactAnalysis` returns `[]`, which triggers `{ severity: 'fallback', fallbackReason: 'no-parseable-table' }` |
| FR Trace | FR-004 (AC-004-05), NFR-003 (AC-NFR-003-03) |

### 4.3 ERR-GIT-001: Git Diff Failed (Fallback)

| Field | Value |
|-------|-------|
| Code | ERR-GIT-001 |
| Condition | `git diff --name-only {hash}..HEAD` returns non-zero exit code or times out |
| Message | stderr: `"[staleness] git diff failed: {error message}. Falling back to hash comparison."` |
| Severity | WARN |
| Recovery | Automatic fallback to naive hash comparison |
| Behavior | `checkBlastRadiusStaleness` returns `{ severity: 'fallback', fallbackReason: 'git-diff-failed' }` |
| FR Trace | FR-004 (AC-004-06), NFR-003 (AC-NFR-003-02) |

Possible causes:
- Original hash no longer in git history (force-push, shallow clone)
- Git not available on PATH (should not happen -- framework requires git)
- Timeout (> 5 seconds -- unlikely for name-only diff)

### 4.4 ERR-GIT-002: Git Rev-Parse Failed

| Field | Value |
|-------|-------|
| Code | ERR-GIT-002 |
| Condition | `git rev-parse --short HEAD` fails in Step 4b |
| Message | stderr: `"Could not determine current codebase version. Skipping staleness check."` |
| Severity | WARN |
| Recovery | Skip staleness check entirely |
| Behavior | `stalenessResult = { stale: false, severity: 'none', ... }` |
| FR Trace | FR-004 (implicit -- git required per CON-004) |

**Note**: This is an existing error path, preserved identically.

### 4.5 ERR-STALE-003: Unexpected Error (Defensive Fallback)

| Field | Value |
|-------|-------|
| Code | ERR-STALE-003 |
| Condition | Any unhandled exception inside `checkBlastRadiusStaleness` |
| Message | stderr: `"[staleness] Unexpected error: {error message}. Falling back to hash comparison."` |
| Severity | WARN |
| Recovery | Automatic fallback to naive hash comparison |
| Behavior | Outer try/catch returns `{ severity: 'fallback', fallbackReason: 'unexpected-error' }` |
| FR Trace | NFR-003 (defensive) |

---

## 5. GH-60: Deprecation Warnings

### 5.1 WARN-DEPR-001: init-and-phase-01 Deprecated

| Field | Value |
|-------|-------|
| Code | WARN-DEPR-001 |
| Condition | Orchestrator receives `MODE: init-and-phase-01` |
| Message | stderr: `"DEPRECATED: MODE init-and-phase-01 will be removed in v0.3.0. Use MODE init-only with Phase-Loop Controller."` |
| Severity | WARN |
| Recovery | None needed -- mode still works. Caller should migrate to init-only. |
| Behavior | Full existing behavior preserved, deprecation notice emitted to stderr |
| FR Trace | FR-003 (AC-003-04) |

---

## 6. Error Flow Diagram

```
Step 4b entry
    |
    +-- ERR-GIT-002: git rev-parse failed
    |   => skip staleness entirely (stale: false)
    |
    +-- Read impact-analysis.md
    |   |
    |   +-- File not found: impactAnalysisContent = null
    |   +-- Read error: impactAnalysisContent = null
    |   +-- Success: impactAnalysisContent = content
    |
    +-- checkBlastRadiusStaleness(meta, hash, content, null)
        |
        +-- meta null/no hash: { stale: false } (not an error)
        +-- same hash: { stale: false } (not an error)
        |
        +-- content null:
        |   => ERR-STALE-001: { severity: 'fallback', reason: 'no-impact-analysis' }
        |
        +-- extractFiles returns []:
        |   => ERR-STALE-002: { severity: 'fallback', reason: 'no-parseable-table' }
        |
        +-- git diff fails:
        |   => ERR-GIT-001: { severity: 'fallback', reason: 'git-diff-failed' }
        |
        +-- unexpected error:
        |   => ERR-STALE-003: { severity: 'fallback', reason: 'unexpected-error' }
        |
        +-- success: { severity: 'none'|'info'|'warning' }
```

---

## 7. Error Handling Summary

| Error Code | Type | Blocks Build? | User Visible? | Auto-Recovery? |
|------------|------|---------------|---------------|----------------|
| ERR-INIT-001 | Infrastructure | YES | YES (error message) | NO |
| ERR-INIT-002 | Infrastructure | YES | YES (error message) | NO |
| ERR-INIT-003 | Infrastructure | YES | YES (error message) | NO |
| ERR-INIT-004 | Infrastructure | YES | YES (error message) | NO |
| ERR-INIT-005 | Infrastructure | YES | YES (error message) | NO |
| ERR-STALE-001 | Staleness | NO | NO (silent fallback) | YES (fallback) |
| ERR-STALE-002 | Staleness | NO | NO (silent fallback) | YES (fallback) |
| ERR-STALE-003 | Staleness | NO | stderr only | YES (fallback) |
| ERR-GIT-001 | Git | NO | stderr only | YES (fallback) |
| ERR-GIT-002 | Git | NO | stderr only | YES (skip check) |
| WARN-DEPR-001 | Deprecation | NO | stderr only | N/A |

---

## 8. Traceability

| Error Code | FR/NFR Trace |
|------------|-------------|
| ERR-INIT-001 | FR-001 |
| ERR-INIT-002 | FR-001 |
| ERR-INIT-003 | FR-001 (AC-001-03) |
| ERR-INIT-004 | FR-001 |
| ERR-INIT-005 | FR-001 (AC-001-02) |
| ERR-STALE-001 | FR-004 (AC-004-05), NFR-003 (AC-NFR-003-01) |
| ERR-STALE-002 | FR-004 (AC-004-05), NFR-003 (AC-NFR-003-03) |
| ERR-STALE-003 | NFR-003 |
| ERR-GIT-001 | FR-004 (AC-004-06), NFR-003 (AC-NFR-003-02) |
| ERR-GIT-002 | FR-004 (implicit) |
| WARN-DEPR-001 | FR-003 (AC-003-04) |
