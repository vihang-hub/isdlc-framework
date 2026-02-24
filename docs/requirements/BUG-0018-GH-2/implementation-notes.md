# Implementation Notes: BUG-0018-GH-2 -- Backlog Picker Pattern Mismatch

**Phase**: 06-implementation
**Implemented**: 2026-02-16
**Bug**: BUG-0018 -- Backlog picker pattern mismatch after BACKLOG.md restructure

---

## Summary of Changes

### 1. Orchestrator Backlog Picker -- Suffix Stripping (PRIMARY FIX)

**File**: `src/claude/agents/00-sdlc-orchestrator.md`

**Changes to Feature Mode Sources (line 294)**:
- Added explicit `[x]` checkbox exclusion instruction: "Skip checked `[x]` items (these are completed and often have ~~strikethrough~~ formatting)"
- Added **Suffix stripping** instruction: "if the captured `<text>` contains a trailing `-> [requirements](...)` or `-> [design](...)` link suffix, strip it to produce the clean title"
- Added backward compatibility clause: "Items without a `->` suffix pass through unchanged"

**Changes to Fix Mode Sources (line 312)**:
- Added matching scan pattern `- N.N [ ] <text>` and `[x]` exclusion
- Added suffix stripping: "Apply the same suffix stripping as feature mode: strip any trailing `-> [requirements](...)` or `-> [design](...)` link suffix from the captured text"

**Changes to Presentation Rules (line 345)**:
- Updated selection text from "use chosen text as description" to "use the clean title (after suffix stripping) as the workflow description"

### 2. Start Action Documentation (MINOR)

**File**: `src/claude/commands/isdlc.md`

Added a **Design note** after step 8 of the `start` action explaining why there is no `workflows.json` entry for `start`:
> The `start` action intentionally reuses the `feature` workflow definition from `workflows.json` (with Phase 00 and Phase 01 skipped). It does not have its own entry in `workflows.json` because the phase sequence from 02 onward is identical to the feature workflow.

### 3. Test File

**File**: `src/claude/hooks/tests/test-backlog-picker-content.test.cjs`

26 test cases covering all 5 FRs, 3 NFRs, and 19 ACs from the requirements spec. Tests use content verification pattern (reading markdown files and asserting presence of specific instructions).

### 4. Runtime Sync

The `src/claude/agents/` and `src/claude/commands/` directories are already symlinked/identical to `.claude/agents/` and `.claude/commands/`. No separate sync step was needed.

---

## Design Decisions

1. **Content verification over functional testing**: Since the backlog picker is defined in markdown agent instructions (not executable code), tests verify the markdown contains correct instructions rather than testing runtime behavior. This matches the nature of the fix.

2. **Conditional suffix stripping**: The stripping instruction is phrased conditionally ("if the captured text contains...") so items without the `-> [...]` suffix pass through unchanged. This preserves backward compatibility with the old BACKLOG.md format.

3. **Both link types covered**: Both `-> [requirements](...)` and `-> [design](...)` are handled, as the format could theoretically reference design documents.

4. **Fix mode inherits feature mode behavior**: The fix mode section explicitly references "the same suffix stripping as feature mode" to ensure consistency.

---

## Test Results

- **26 tests**: All passing
- **0 regressions**: CJS stream: 1451/1452 pass (1 pre-existing failure in gate-blocker-extended SM-04, unrelated)
- **Requirements coverage**: 100% (5 FRs + 3 NFRs)
- **AC coverage**: 100% (19 ACs)

---

## Files Changed

| File | Change Type | Description |
|------|------------|-------------|
| `src/claude/agents/00-sdlc-orchestrator.md` | MODIFY | Added suffix stripping, [x] exclusion, clean title in presentation rules |
| `src/claude/commands/isdlc.md` | MODIFY | Added design note about start action workflow reuse |
| `src/claude/hooks/tests/test-backlog-picker-content.test.cjs` | CREATE | 26 content verification test cases |
