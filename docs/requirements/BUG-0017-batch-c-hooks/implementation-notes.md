# Implementation Notes: BUG-0017 Batch C Hook Bugs

**Phase**: 06-implementation
**Date**: 2026-02-15
**Implementer**: Software Developer (Phase 06)

---

## Bug 0.9 -- Misleading Artifact Error Messages (gate-blocker.cjs)

### Root Cause
`checkArtifactPresenceRequirement()` at line ~497 pushed only `dirPaths[0]` to the missing artifacts list, discarding other valid variant alternatives from the error message. When `interface-spec.yaml` and `interface-spec.md` were both configured as variants in the same directory and neither existed, the error only reported `interface-spec.yaml` as missing.

### Fix Applied
**File**: `src/claude/hooks/gate-blocker.cjs` (line 494-506)

When `dirPaths.length > 1`, build a composite string showing all variants instead of just reporting `dirPaths[0]`. For example:
- Before: `interface-spec.yaml`
- After: `docs/design/REQ-TEST/interface-spec.yaml (or interface-spec.md)`

For single-path requirements (no variants), behavior is unchanged -- the path is reported directly.

### Design Decisions
- The composite format uses `path (or basename1, basename2)` to keep the full path visible for the first variant while listing alternatives by basename only (avoids overly long messages).
- The `path.basename()` function is used for alternatives to avoid redundant directory repetition.
- The `missing_artifacts` array in the returned object contains the composite strings, so downstream consumers (e.g., gate_validation state) also get the full variant info.

### Tests Added
- **TC-GB-V01**: Multi-variant missing error lists all variants (P0)
- **TC-GB-V02**: Multi-variant satisfied by second variant (P0)
- **TC-GB-V03**: Single-path missing has no "or" syntax (P1)
- **TC-GB-V04**: Composite representation in gate_validation state (P1)
- **TC-GB-V05**: All variants exist, no artifact error (P1)
- **TC-GB-V07**: Three-variant group all listed when missing (P2)

---

## Bug 0.10 -- Version Lock Bypass During State Migration (state-write-validator.cjs)

### Root Cause
`checkVersionLock()` at lines ~131-133 returned `null` (allow) when incoming state had no `state_version`, WITHOUT first reading disk state. This allowed unversioned writes to silently overwrite versioned disk state, bypassing the optimistic locking protection added in BUG-0009.

### Fix Applied
**File**: `src/claude/hooks/state-write-validator.cjs` (lines 130-161)

Moved the disk read BEFORE the unversioned-incoming guard. The new logic:

1. Parse incoming content (unchanged)
2. Read disk state_version (moved up -- was previously after the unversioned guard)
3. If no disk file exists: ALLOW (first write)
4. If incoming has no `state_version`:
   - If disk also has no version: ALLOW (legacy compat -- both unversioned)
   - If disk HAS version: BLOCK with actionable message
5. If disk has no version: ALLOW (migration case)
6. If incoming < disk: BLOCK (existing behavior, unchanged)

### Design Decisions
- The block message for unversioned writes against versioned disk is intentionally different from the standard version mismatch message: it says "Unversioned write rejected" and instructs the agent to "Include state_version in your write."
- Fail-open behavior is preserved: if disk read fails (corrupt JSON, I/O error), the write is allowed.
- Legacy compatibility maintained: if BOTH disk and incoming lack `state_version`, the write is allowed.

### Tests Added/Updated
- **TC-SWV-01**: Unversioned incoming blocked when disk versioned (P0)
- **TC-SWV-02**: Unversioned incoming allowed when disk unversioned (P0)
- **TC-SWV-03**: Unversioned incoming allowed when no disk file (P0)
- **TC-SWV-06**: Block message is actionable (P1)
- **TC-SWV-07**: Null incoming blocked when disk versioned (P0)
- **TC-SWV-08**: Fail-open on corrupt disk during unversioned check (P2)
- **T19**: Updated from ALLOW to BLOCK expectation
- **T20**: Updated from ALLOW to BLOCK expectation

---

## Test Results

### Gate-Blocker Extended
- **Total tests**: 54 (38 existing + 8 supervised mode + 2 phase key + 2 cross-ref + 1 notification + 3 BUG-0005 + 6 new BUG-0017 -- minus overlap in counting = 54)
- **Passing**: 54/54
- **Regressions**: 0

### State-Write-Validator
- **Total tests**: 73 (67 existing + 6 new - 2 updated but same count = 73)
- **Passing**: 73/73
- **Regressions**: 0

### Full Hook Suite
- **Total tests**: 1380
- **Passing**: 1380/1380
- **Regressions**: 0

---

## Files Modified

| File | Change Type | Lines Changed |
|------|------------|---------------|
| `src/claude/hooks/gate-blocker.cjs` | Bug fix | ~10 lines (lines 494-506) |
| `src/claude/hooks/state-write-validator.cjs` | Bug fix | ~20 lines (lines 128-161) |
| `src/claude/hooks/tests/test-gate-blocker-extended.test.cjs` | Tests added | +260 lines (6 new tests) |
| `src/claude/hooks/tests/state-write-validator.test.cjs` | Tests added/updated | +110 lines (6 new tests, 2 updated) |

---

## Traceability

| Requirement | Implementation |
|-------------|---------------|
| AC-1.1 (FR-1, FR-2, FR-3) | gate-blocker.cjs line 499-504, TC-GB-V01, TC-GB-V07 |
| AC-1.2 | TC-GB-V02 |
| AC-1.3 | TC-GB-V03 |
| AC-1.4 (FR-2) | TC-GB-V04 |
| AC-1.5 | TC-GB-V05 |
| AC-1.6 | Implicit (all 38 existing tests pass) |
| AC-2.1 (FR-4) | state-write-validator.cjs line 146-161, TC-SWV-01, TC-SWV-07, T19, T20 |
| AC-2.2 (FR-5) | state-write-validator.cjs line 148-149, TC-SWV-02 |
| AC-2.3 (FR-5) | state-write-validator.cjs line 134-135, TC-SWV-03 |
| AC-2.6 (NFR-2) | TC-SWV-06 |
| NFR-1 | TC-SWV-08 |
