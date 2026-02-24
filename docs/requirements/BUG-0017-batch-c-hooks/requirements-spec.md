# BUG-0017: Batch C Hook Bugs — Gate Blocker Misleading Errors + State Write Validator Version Lock Bypass

**Type**: Bug Fix (Batch)
**Priority**: High
**Reported**: 2026-02-15
**Artifact Folder**: BUG-0017-batch-c-hooks
**External ID**: None (internal dogfooding)

---

## Bug 0.9: Misleading Artifact Error Messages in gate-blocker.cjs

### Summary

When `checkArtifactSatisfaction()` in `gate-blocker.cjs` encounters a gate requirement with multiple valid file variants (e.g., `interface-spec.yaml` OR `interface-spec.md`), it groups paths by directory and checks if ANY variant exists. If none exists, it reports only the **first variant** in the list as missing, rather than listing all acceptable variants. This produces misleading error messages that tell the developer to create a specific file format when any of the valid variants would satisfy the requirement.

### Reproduction Steps

1. Configure a gate requirement that accepts `interface-spec.yaml` OR `interface-spec.md`
2. Ensure neither file exists in the target directory
3. Trigger gate validation
4. **Observed**: Error message says `Required artifact(s) missing: docs/.../interface-spec.yaml`
5. **Expected**: Error message says `Required artifact(s) missing: docs/.../interface-spec.yaml (or interface-spec.md)` — or lists all valid variants

### Root Cause

`gate-blocker.cjs` lines 486-498. When no variant in a directory group exists, line 497 pushes only `dirPaths[0]` (the first variant) to `missingArtifacts`, discarding the other valid variants from the error message.

```javascript
// Current (buggy):
if (!anyExists) {
    missingArtifacts.push(dirPaths[0]); // Report first variant as missing
}
```

### Affected Code

- **File**: `src/claude/hooks/gate-blocker.cjs`
- **Function**: `checkArtifactSatisfaction()`
- **Lines**: 486-498

### Fix Requirements

- **FR-1**: When no variant in a directory group satisfies the requirement, report ALL valid variants in the error message, not just the first one
- **FR-2**: The `missing_artifacts` array in the return value must contain a representation that conveys all acceptable variants for each unsatisfied group
- **FR-3**: The `reason` string must clearly indicate that ANY of the listed variants would satisfy the requirement

### Acceptance Criteria

- **AC-1.1**: When a gate requires `interface-spec.yaml` OR `interface-spec.md` and neither exists, the error message lists both variants
- **AC-1.2**: When a gate requires `interface-spec.yaml` OR `interface-spec.md` and `interface-spec.md` exists, no error is reported (existing behavior preserved)
- **AC-1.3**: When a gate requires a single artifact (no variants) and it is missing, error message is unchanged
- **AC-1.4**: The `missing_artifacts` array contains a composite representation (e.g., `"interface-spec.yaml (or interface-spec.md)"`) for variant groups
- **AC-1.5**: When all variants exist, no error is reported
- **AC-1.6**: The fix does not break existing gate-blocker tests

---

## Bug 0.10: Version Lock Bypass During State Migration in state-write-validator.cjs

### Summary

The V7 version lock in `state-write-validator.cjs` is designed to prevent stale writes by ensuring the incoming `state_version` is >= the on-disk version. However, when the incoming state has **no** `state_version` field (undefined/null), the check returns `null` (allow) at line 131-133 without ever reading the disk state. This means an unversioned incoming write can overwrite a versioned disk state, bypassing the entire version lock mechanism.

### Reproduction Steps

1. Write a state.json to disk with `state_version: 50`
2. Attempt to write a new state.json that has NO `state_version` field
3. **Observed**: Write is allowed (hook returns `null`)
4. **Expected**: Write is blocked or the incoming state is required to have a version >= 50

### Root Cause

`state-write-validator.cjs` lines 128-133. The backward-compatibility guard for unversioned incoming state exits early without checking the disk state at all. If the disk has a versioned state, this creates a regression window where any agent writing unversioned state can clobber versioned state.

```javascript
// Current (buggy):
const incomingVersion = incomingState.state_version;

// Backward compat: if incoming has no state_version, allow
if (incomingVersion === undefined || incomingVersion === null) {
    return null;  // <-- Bypasses disk version check entirely
}
```

Additionally, the migration case at lines 149-152 correctly handles when the **disk** has no version. But the interaction between these two guards creates a gap: unversioned incoming + versioned disk = allowed.

### Affected Code

- **File**: `src/claude/hooks/state-write-validator.cjs`
- **Function**: `check()` (the main validation function)
- **Lines**: 128-152

### Fix Requirements

- **FR-4**: When incoming state has no `state_version`, check if the disk state HAS a `state_version`. If disk is versioned, BLOCK the write
- **FR-5**: When incoming state has no `state_version` AND disk has no `state_version` (or no disk file), ALLOW the write (true migration/first-write case)
- **FR-6**: The fix must not break existing backward compatibility for genuinely unversioned projects (no disk version either)

### Acceptance Criteria

- **AC-2.1**: Unversioned incoming state is BLOCKED when disk has `state_version >= 1`
- **AC-2.2**: Unversioned incoming state is ALLOWED when disk has no `state_version` (migration)
- **AC-2.3**: Unversioned incoming state is ALLOWED when no disk file exists (first write)
- **AC-2.4**: Versioned incoming state with version >= disk version is ALLOWED (existing behavior)
- **AC-2.5**: Versioned incoming state with version < disk version is BLOCKED (existing behavior)
- **AC-2.6**: The block message for unversioned incoming clearly states the reason (disk is versioned, incoming must include state_version)
- **AC-2.7**: The fix does not break existing state-write-validator tests

---

## Non-Functional Requirements

- **NFR-1**: Both fixes must maintain fail-open behavior for genuine edge cases (corrupt files, permission errors)
- **NFR-2**: Error messages must be actionable — the developer must be able to understand what to do from the message alone
- **NFR-3**: Both fixes must be backward compatible with existing hook test suites
- **NFR-4**: No new dependencies introduced
