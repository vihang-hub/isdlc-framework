# Test Cases: FR-04 -- Runtime Copy Sync

**Requirement**: FR-04 (Runtime copy sync)
**Test File**: `src/claude/hooks/tests/isdlc-step3-ordering.test.cjs`
**Type**: Prompt Content Verification (Layer 1)

---

## TC-04a: Runtime copy matches source

**Traces to**: AC-04a
**Priority**: P0 (Critical)

**Description**: Verify that `.claude/commands/isdlc.md` is byte-for-byte identical to `src/claude/commands/isdlc.md` after the fix is applied.

**Method**: Read both files and compare their contents. Use `fs.readFileSync()` for both paths and assert equality.

**Expected**: The files are identical.

---

# Test Cases: NFR -- Non-Functional Requirements

---

## TC-NFR01: No new hooks or files created

**Traces to**: NFR-03
**Priority**: P1 (High)

**Description**: Verify that the fix does not introduce any new hook files, test files (beyond the prompt verification tests), or other source files. The fix scope is `isdlc.md` only.

**Method**: After the fix is applied (Phase 06), verify that the only modified files are:
- `src/claude/commands/isdlc.md`
- `.claude/commands/isdlc.md`
- Test and doc files (expected additions)

No new files should appear in `src/claude/hooks/` or `lib/`.

**Expected**: No new hook or library files.

---

## TC-NFR02: Existing hook tests pass (regression)

**Traces to**: NFR-02
**Priority**: P0 (Critical)

**Description**: Verify that all existing hook tests pass after the fix. Since no hook code is changed, all 253+ CJS hook tests must continue to pass.

**Method**: Run `npm run test:hooks` and verify 0 failures.

**Expected**: All existing tests pass. This is verified during Phase 16 (Quality Loop).

---

## TC-NFR04: Backward compatibility with BUG-0005

**Traces to**: NFR-04
**Priority**: P1 (High)

**Description**: Verify that the STEP 3e changes are compatible with the BUG-0005 state sync improvements. Specifically:
- STEP 3e still writes `phase_status[key] = "completed"` (BUG-0005 added this)
- STEP 3e still writes state.json after completion
- STEP 3e still updates tasks.md

**Method**: Cross-reference with TC-02f (STEP 3e steps 1-5 and 7-8 remain unchanged). The BUG-0005 additions are in steps 2, 5, 7, and 8.

**Expected**: All BUG-0005 additions remain in STEP 3e.
