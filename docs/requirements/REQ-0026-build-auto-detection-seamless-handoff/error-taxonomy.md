# Error Taxonomy: Build Auto-Detection and Seamless Phase 05+ Handoff

**Phase**: 04-design
**Feature ID**: REQ-BUILD-AUTODETECT
**Based On**: requirements-spec.md (Section 10), architecture.md (Section 5)

---

## 1. Design Principles

All errors in the build auto-detection feature follow these principles:

1. **Graceful degradation**: Every error degrades to the full-workflow path. No error blocks the user from building.
2. **Fail-safe defaults**: When in doubt, treat the item as "raw" and proceed with the full workflow (NFR-004).
3. **Non-throwing utility functions**: The three utility functions (`validatePhasesCompleted`, `computeStartPhase`, `checkStaleness`) never throw exceptions. They return safe default values.
4. **Warnings over errors**: Most issues are warnings (logged but non-blocking), not errors (blocking).

---

## 2. Error Catalog

### 2.1 Build Verb Errors (ERR-BUILD-xxx)

| Code | Trigger Condition | Severity | User-Facing Message | Recovery | Component | FR Trace |
|------|-------------------|----------|---------------------|----------|-----------|----------|
| ERR-BUILD-001 | `resolveItem()` returns null for a reference-style input (#N, PROJECT-N) | ERROR | "No matching backlog item found for '{input}'. Check the slug, item number, or reference." | User retries with correct input | isdlc.md build handler (step 3) | FR-001 |
| ERR-BUILD-002 | `readMetaJson()` returns null due to corrupted JSON | WARNING | "Warning: meta.json for '{slug}' is corrupted. Treating as new item." | Proceed as raw, meta.json will be recreated by orchestrator | isdlc.md build handler (step 4) | FR-001 (AC-001-05) |
| ERR-BUILD-003 | `validatePhasesCompleted()` detects non-contiguous phases | WARNING | "Warning: Analysis phases for '{slug}' appear incomplete. Using only contiguous completed phases." | Use contiguous prefix, continue with partial/raw status | isdlc.md build handler (step 4a) | FR-003 (AC-003-06) |
| ERR-BUILD-004 | `git rev-parse --short HEAD` fails | WARNING | "Warning: Could not determine current codebase version. Skipping staleness check." | Skip staleness detection entirely, proceed with analysis-status handling | isdlc.md build handler (step 4b) | FR-004 (AC-004-07), NFR-004 (AC-NFR-004-02) |
| ERR-BUILD-005 | `git rev-list --count` fails after staleness detected | WARNING | (No user message -- staleness warning shown without commit count) | Show staleness warning with hashes only, omit commit count | isdlc.md build handler (step 4b) | FR-004 |
| ERR-BUILD-006 | `writeMetaJson()` fails during [F] Full restart or [A] Re-analyze | WARNING | "Warning: Could not update meta.json. Proceeding with build." | Proceed with in-memory values, meta.json is not updated | isdlc.md build handler (steps 4c, 4d) | FR-003, FR-004 |

### 2.2 Orchestrator Errors (ERR-ORCH-xxx)

| Code | Trigger Condition | Severity | User-Facing Message | Recovery | Component | FR Trace |
|------|-------------------|----------|---------------------|----------|-----------|----------|
| ERR-ORCH-INVALID-START-PHASE | `START_PHASE` value not found in workflow's phases array | ERROR (internal) | (Internal log) "Invalid start phase '{phase}'. Falling back to full workflow." | Fall back to full workflow (all phases from Phase 00) | orchestrator init-and-phase-01 | FR-006 (AC-006-03) |
| ERR-ORCH-META-WRITE-FAIL | Cannot write `build_started_at` to meta.json | WARNING | (No user message -- internal log only) | Continue without build tracking in meta.json | orchestrator step 9 | FR-008 |

### 2.3 Utility Function Non-Error Returns

These are not errors but safe default return values from utility functions when given invalid input:

| Function | Invalid Input | Return Value | Behavior |
|----------|--------------|--------------|----------|
| `validatePhasesCompleted(null)` | null/undefined/non-array | `{ valid: [], warnings: ["...not an array"] }` | Caller treats as raw |
| `validatePhasesCompleted(["unknown"])` | All unknown phase keys | `{ valid: [], warnings: [] }` | Caller treats as raw |
| `computeStartPhase(null, phases)` | null meta | `{ status: 'raw', startPhase: null, ... }` | Full workflow |
| `computeStartPhase({}, phases)` | Meta without phases_completed | `{ status: 'raw', startPhase: null, ... }` | Full workflow |
| `checkStaleness(null, hash)` | null meta | `{ stale: false, originalHash: null, ... }` | Staleness skipped |
| `checkStaleness({}, hash)` | Meta without codebase_hash | `{ stale: false, originalHash: null, ... }` | Staleness skipped |

---

## 3. Error Flow Diagram

```
Build verb invoked
     |
     +-- resolveItem() returns null?
     |     YES --> ERR-BUILD-001 (error, abort)
     |     NO  --> continue
     |
     +-- readMetaJson() returns null?
     |     YES --> ERR-BUILD-002 (warning, proceed as raw)
     |     NO  --> continue
     |
     +-- computeStartPhase() returns warnings?
     |     YES --> ERR-BUILD-003 (warning, log, continue)
     |     NO  --> continue
     |
     +-- git rev-parse fails?
     |     YES --> ERR-BUILD-004 (warning, skip staleness)
     |     NO  --> continue
     |
     +-- checkStaleness() returns stale?
     |     YES --> git rev-list fails?
     |     |        YES --> ERR-BUILD-005 (warning, show without count)
     |     |        NO  --> show full staleness warning
     |     NO  --> continue
     |
     +-- writeMetaJson() fails (on [F] or [A])?
     |     YES --> ERR-BUILD-006 (warning, use in-memory)
     |     NO  --> continue
     |
     +-- Delegate to orchestrator
           |
           +-- START_PHASE invalid?
           |     YES --> ERR-ORCH-INVALID-START-PHASE (error, fallback to full)
           |     NO  --> continue
           |
           +-- meta.json write fails?
                 YES --> ERR-ORCH-META-WRITE-FAIL (warning, continue)
                 NO  --> continue
```

---

## 4. Error Severity Definitions

| Severity | Meaning | User Impact | Workflow Impact |
|----------|---------|-------------|-----------------|
| ERROR | Operation cannot proceed as intended | User sees error message | Build aborts (ERR-BUILD-001) or falls back to full workflow (ERR-ORCH-INVALID-START-PHASE) |
| WARNING | Non-ideal condition detected | User may see warning message | Build proceeds with safe defaults |

---

## 5. Error Message Format

All user-facing error messages follow the existing iSDLC pattern:

```
[severity]: [message]
```

Examples:
- `Warning: meta.json for 'payment-processing' is corrupted. Treating as new item.`
- `Warning: Could not determine current codebase version. Skipping staleness check.`
- `No matching backlog item found for '#99'. Check the slug, item number, or reference.`

Internal-only messages (not shown to user) are logged to stderr:
- `ERR-ORCH-INVALID-START-PHASE: '99-nonexistent' is not a valid phase key in the feature workflow.`

---

## 6. Traceability

| Error Code | FR Trace | NFR Trace | AC Trace |
|------------|----------|-----------|----------|
| ERR-BUILD-001 | FR-001 | -- | -- |
| ERR-BUILD-002 | FR-001 | NFR-004 | AC-001-05, AC-NFR-004-01 |
| ERR-BUILD-003 | FR-003 | NFR-004 | AC-003-06, AC-NFR-004-03 |
| ERR-BUILD-004 | FR-004 | NFR-004 | AC-004-07, AC-NFR-004-02 |
| ERR-BUILD-005 | FR-004 | -- | -- |
| ERR-BUILD-006 | FR-003, FR-004 | -- | -- |
| ERR-ORCH-INVALID-START-PHASE | FR-006 | NFR-004 | AC-006-03 |
| ERR-ORCH-META-WRITE-FAIL | FR-008 | -- | -- |
