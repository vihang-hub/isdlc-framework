# Test Cases: Build Consumption -- Init Split & Smart Staleness (REQ-0031)

**Phase**: 05-test-strategy
**Version**: 1.0
**Created**: 2026-02-20
**Feature**: GH-60 + GH-61
**Total Test Cases**: 32 automated + 7 manual protocols
**Test File**: `src/claude/hooks/tests/test-three-verb-utils.test.cjs` (extend existing)

---

## Section 33: extractFilesFromImpactAnalysis() Tests

**Traces**: FR-005 (AC-005-01 through AC-005-04), NFR-004 (AC-NFR-004-01)
**Function**: `extractFilesFromImpactAnalysis(mdContent)` -- Pure function, string in, string[] out.
**Import**: `const { extractFilesFromImpactAnalysis } = require('../lib/three-verb-utils.cjs');`

### TC-EF-01: Parses standard "Directly Affected Files" table

**AC**: AC-005-01
**Priority**: P0
**Given**: A markdown string with `### Directly Affected Files` heading followed by a table with backtick-wrapped file paths
**When**: `extractFilesFromImpactAnalysis(mdContent)` is called
**Then**: Returns an array of file paths extracted from the table: `['src/claude/commands/isdlc.md', 'src/claude/agents/00-sdlc-orchestrator.md', 'src/claude/hooks/lib/three-verb-utils.cjs']`
**Test data**:
```
### Directly Affected Files

| File | Change Type | FR Trace | Impact |
|------|------------|----------|--------|
| `src/claude/commands/isdlc.md` | MODIFY | FR-002 | STEP 1 changes |
| `src/claude/agents/00-sdlc-orchestrator.md` | MODIFY | FR-001 | New mode |
| `src/claude/hooks/lib/three-verb-utils.cjs` | MODIFY | FR-004 | New functions |
```

### TC-EF-02: Parses with ## heading level (two hashes)

**AC**: AC-005-01
**Priority**: P1
**Given**: A markdown string with `## Directly Affected Files` (two hashes, not three)
**When**: `extractFilesFromImpactAnalysis(mdContent)` is called
**Then**: Returns file paths correctly (heading regex matches both ## and ###)

### TC-EF-03: Parses with numbered heading prefix

**AC**: AC-005-01
**Priority**: P2
**Given**: A markdown string with `### 3.1 Directly Affected Files` (numbered heading)
**When**: `extractFilesFromImpactAnalysis(mdContent)` is called
**Then**: Returns file paths correctly

### TC-EF-04: Extracts only from "Directly Affected Files" table, ignoring other tables

**AC**: AC-005-02
**Priority**: P0
**Given**: A markdown string with both "Directly Affected Files" table (3 files) and an "Indirectly Affected Files" table (2 files) separated by a section heading
**When**: `extractFilesFromImpactAnalysis(mdContent)` is called
**Then**: Returns only the 3 files from the "Directly Affected Files" table, not the 2 from the indirect table

### TC-EF-05: Stops at next section heading boundary

**AC**: AC-005-02
**Priority**: P1
**Given**: A markdown string with a "Directly Affected Files" table followed by `### New Functions/Exports` heading and another table
**When**: `extractFilesFromImpactAnalysis(mdContent)` is called
**Then**: Returns only files from before the next section heading

### TC-EF-06: Returns empty array for null input

**AC**: AC-005-03
**Priority**: P0
**Given**: `null` as input
**When**: `extractFilesFromImpactAnalysis(null)` is called
**Then**: Returns `[]`

### TC-EF-07: Returns empty array for undefined input

**AC**: AC-005-03
**Priority**: P0
**Given**: `undefined` as input
**When**: `extractFilesFromImpactAnalysis(undefined)` is called
**Then**: Returns `[]`

### TC-EF-08: Returns empty array for empty string input

**AC**: AC-005-03
**Priority**: P0
**Given**: `''` (empty string) as input
**When**: `extractFilesFromImpactAnalysis('')` is called
**Then**: Returns `[]`

### TC-EF-09: Normalizes paths with ./ prefix

**AC**: AC-005-04
**Priority**: P0
**Given**: A markdown table with paths like `./src/foo.js` (leading ./ prefix)
**When**: `extractFilesFromImpactAnalysis(mdContent)` is called
**Then**: Returns `['src/foo.js']` (stripped ./ prefix)

### TC-EF-10: Normalizes paths with / prefix

**AC**: AC-005-04
**Priority**: P0
**Given**: A markdown table with paths like `/src/foo.js` (leading / prefix)
**When**: `extractFilesFromImpactAnalysis(mdContent)` is called
**Then**: Returns `['src/foo.js']` (stripped / prefix)

### TC-EF-11: Deduplicates paths

**AC**: AC-005-04
**Priority**: P1
**Given**: A markdown table where the same file appears twice (e.g., `src/foo.js` and `./src/foo.js`)
**When**: `extractFilesFromImpactAnalysis(mdContent)` is called
**Then**: Returns `['src/foo.js']` (one entry, deduplicated after normalization)

### TC-EF-12: Handles large table (50+ files) within performance bounds

**AC**: AC-NFR-002-02
**Priority**: P2
**Given**: A markdown string with a "Directly Affected Files" table containing 50 rows
**When**: `extractFilesFromImpactAnalysis(mdContent)` is called
**Then**: Returns 50 file paths, completes in under 100ms

---

## Section 34: checkBlastRadiusStaleness() Tests

**Traces**: FR-004 (AC-004-01 through AC-004-06), FR-006 (AC-006-01 through AC-006-04), NFR-002, NFR-003, NFR-004
**Function**: `checkBlastRadiusStaleness(meta, currentHash, impactAnalysisContent, changedFiles)`
**Import**: `const { checkBlastRadiusStaleness } = require('../lib/three-verb-utils.cjs');`

All tests inject `changedFiles` parameter (non-null array) per NFR-004 testability design. No git calls in unit tests.

### TC-BR-01: Detects changed files (basic invocation with different hashes)

**AC**: AC-004-01
**Priority**: P0
**Given**: `meta = { codebase_hash: 'abc1234' }`, `currentHash = 'def5678'`, valid impactAnalysisContent with 3 blast-radius files, `changedFiles = ['src/file1.js', 'src/file2.js']` (2 changed, 0 overlap with blast radius)
**When**: `checkBlastRadiusStaleness(meta, currentHash, impactAnalysisContent, changedFiles)` is called
**Then**: Returns a result with `changedFileCount: 2` confirming changed files were processed

### TC-BR-02: Same hash returns not stale

**AC**: AC-004-01
**Priority**: P0
**Given**: `meta = { codebase_hash: 'abc1234' }`, `currentHash = 'abc1234'` (same hash), valid impactAnalysisContent, `changedFiles = []`
**When**: `checkBlastRadiusStaleness(meta, currentHash, impactAnalysisContent, changedFiles)` is called
**Then**: Returns `{ stale: false, severity: 'none', overlappingFiles: [], changedFileCount: 0 }`

### TC-BR-03: Zero overlap returns severity 'none'

**AC**: AC-004-02, AC-006-01
**Priority**: P0
**Given**: `meta = { codebase_hash: 'abc1234' }`, `currentHash = 'def5678'`, impactAnalysisContent with blast radius `['src/a.js', 'src/b.js']`, `changedFiles = ['src/x.js', 'src/y.js']` (0 overlap)
**When**: `checkBlastRadiusStaleness(...)` is called
**Then**: Returns `{ stale: false, severity: 'none', overlappingFiles: [], changedFileCount: 2, blastRadiusFileCount: 2 }`

### TC-BR-04: Zero overlap with many changed files still returns 'none'

**AC**: AC-004-02
**Priority**: P1
**Given**: `changedFiles` with 20 files, none overlapping with blast radius
**When**: `checkBlastRadiusStaleness(...)` is called
**Then**: Returns `severity: 'none'`, `stale: false`, `changedFileCount: 20`

### TC-BR-05: 1-3 overlapping files returns severity 'info'

**AC**: AC-004-03, AC-006-02
**Priority**: P0
**Given**: `meta = { codebase_hash: 'abc1234' }`, `currentHash = 'def5678'`, impactAnalysisContent with blast radius `['src/a.js', 'src/b.js', 'src/c.js']`, `changedFiles = ['src/a.js', 'src/b.js', 'src/x.js']` (2 overlapping)
**When**: `checkBlastRadiusStaleness(...)` is called
**Then**: Returns `{ stale: true, severity: 'info', overlappingFiles: ['src/a.js', 'src/b.js'], changedFileCount: 3, blastRadiusFileCount: 3 }`

### TC-BR-06: Exactly 3 overlapping files returns severity 'info'

**AC**: AC-004-03
**Priority**: P1
**Given**: `changedFiles` with exactly 3 files overlapping the blast radius
**When**: `checkBlastRadiusStaleness(...)` is called
**Then**: Returns `severity: 'info'` (boundary: 3 is still info, 4 is warning)

### TC-BR-07: 4+ overlapping files returns severity 'warning'

**AC**: AC-004-04, AC-006-03
**Priority**: P0
**Given**: `meta = { codebase_hash: 'abc1234' }`, `currentHash = 'def5678'`, impactAnalysisContent with blast radius of 6 files, `changedFiles` with 4 overlapping files
**When**: `checkBlastRadiusStaleness(...)` is called
**Then**: Returns `{ stale: true, severity: 'warning', overlappingFiles: [4 files], changedFileCount: ..., blastRadiusFileCount: 6 }`

### TC-BR-08: Exactly 4 overlapping files returns severity 'warning' (boundary)

**AC**: AC-004-04
**Priority**: P1
**Given**: `changedFiles` with exactly 4 files overlapping the blast radius
**When**: `checkBlastRadiusStaleness(...)` is called
**Then**: Returns `severity: 'warning'` (boundary: 4 is the threshold for warning)

### TC-BR-09: Null impactAnalysisContent falls back to 'fallback' severity

**AC**: AC-004-05, AC-006-04, AC-NFR-003-01
**Priority**: P0
**Given**: `meta = { codebase_hash: 'abc1234' }`, `currentHash = 'def5678'`, `impactAnalysisContent = null`
**When**: `checkBlastRadiusStaleness(meta, currentHash, null, ['src/x.js'])` is called
**Then**: Returns `{ stale: true, severity: 'fallback', fallbackReason: 'no-impact-analysis', overlappingFiles: [] }`

### TC-BR-10: Empty string impactAnalysisContent falls back to 'fallback'

**AC**: AC-004-05
**Priority**: P1
**Given**: `impactAnalysisContent = ''` (empty string)
**When**: `checkBlastRadiusStaleness(meta, currentHash, '', changedFiles)` is called
**Then**: Returns `severity: 'fallback'`, `fallbackReason: 'no-impact-analysis'`

### TC-BR-11: Unparseable impact analysis (no table) falls back

**AC**: AC-004-06, AC-NFR-003-02
**Priority**: P0
**Given**: `impactAnalysisContent = '# Some content\n\nNo table here.'` (valid markdown but no "Directly Affected Files" table)
**When**: `checkBlastRadiusStaleness(...)` is called
**Then**: Returns `severity: 'fallback'`, `fallbackReason: 'no-parseable-table'`

### TC-BR-12: Empty blast radius extracted (table found but no rows) falls back

**AC**: AC-004-06, AC-NFR-003-03
**Priority**: P1
**Given**: `impactAnalysisContent` with a "Directly Affected Files" heading but only header row, no data rows
**When**: `checkBlastRadiusStaleness(...)` is called
**Then**: Returns `severity: 'fallback'`, `fallbackReason: 'no-parseable-table'`

### TC-BR-13: Never throws -- null meta returns not stale

**AC**: NFR-004
**Priority**: P0
**Given**: `meta = null`, any other parameters
**When**: `checkBlastRadiusStaleness(null, 'abc1234', mdContent, [])` is called
**Then**: Returns `{ stale: false, severity: 'none', originalHash: null }` -- no throw

### TC-BR-14: Never throws -- undefined meta returns not stale

**AC**: NFR-004
**Priority**: P0
**Given**: `meta = undefined`
**When**: `checkBlastRadiusStaleness(undefined, 'abc1234', mdContent, [])` is called
**Then**: Returns `{ stale: false, severity: 'none', originalHash: null }` -- no throw

### TC-BR-15: Performance -- large changed file list

**AC**: AC-NFR-002-01
**Priority**: P2
**Given**: `changedFiles` with 500 file paths, blast radius with 50 files, 10 overlapping
**When**: `checkBlastRadiusStaleness(...)` is called
**Then**: Returns correct result (`severity: 'warning'`, 10 overlapping) and completes in under 100ms

---

## Section 35: Blast-Radius Staleness Integration Tests

**Traces**: FR-004 + FR-005 pipeline, NFR-003 (graceful degradation)
**Purpose**: Validate the cross-function flow from extractFilesFromImpactAnalysis through checkBlastRadiusStaleness using realistic impact-analysis.md content.

### TC-INT-01: Full pipeline -- real impact-analysis.md with overlapping changes

**AC**: FR-004 + FR-005 combined
**Priority**: P0
**Given**: A realistic impact-analysis.md string (from the actual REQ-0031 analysis), `changedFiles` with 2 files overlapping the extracted blast radius
**When**: `checkBlastRadiusStaleness(meta, currentHash, realMdContent, changedFiles)` is called
**Then**: `extractFilesFromImpactAnalysis` correctly parses the 5 files from the real table, intersection finds 2 overlaps, returns `severity: 'info'`

### TC-INT-02: Full pipeline -- real impact-analysis.md with no overlap

**AC**: FR-004 + FR-005 combined
**Priority**: P0
**Given**: Same realistic impact-analysis.md, `changedFiles` with files that do NOT appear in the blast radius
**When**: `checkBlastRadiusStaleness(meta, currentHash, realMdContent, changedFiles)` is called
**Then**: Returns `severity: 'none'`, `stale: false`

### TC-INT-03: Full pipeline -- mixed path formats in impact-analysis.md

**AC**: AC-005-04 + FR-004 combined
**Priority**: P1
**Given**: Impact-analysis.md with paths like `./src/foo.js` in the table, `changedFiles` with `src/foo.js` (no prefix)
**When**: `checkBlastRadiusStaleness(...)` is called
**Then**: Path normalization ensures match -- returns the overlap correctly

### TC-INT-04: Backward compatibility -- existing checkStaleness unchanged

**AC**: NFR-001
**Priority**: P0
**Given**: Same inputs as TC-CS-01 through TC-CS-09 (existing checkStaleness tests)
**When**: `checkStaleness()` is called with those inputs
**Then**: All 9 existing test assertions still pass (no regression)

### TC-INT-05: checkStaleness and checkBlastRadiusStaleness coexistence

**AC**: NFR-001
**Priority**: P1
**Given**: Both functions exported from three-verb-utils.cjs
**When**: Both are imported and called
**Then**: Both produce valid results without interference; existing checkStaleness behavior unchanged

---

## Section 36: Return Type Validation Tests

**Traces**: FR-004 (StalenessResult type), interface-spec.md Section 3.1
**Purpose**: Ensure all fields of StalenessResult are always present and correctly typed.

### TC-RT-01: StalenessResult -- all fields present for 'none' severity

**AC**: FR-004
**Priority**: P0
**Given**: A call that returns `severity: 'none'`
**When**: The result is examined
**Then**: Has all fields: `stale` (boolean), `severity` (string), `overlappingFiles` (array), `changedFileCount` (number), `blastRadiusFileCount` (number), `originalHash` (string|null), `currentHash` (string), `fallbackReason` (null)

### TC-RT-02: StalenessResult -- all fields present for 'fallback' severity

**AC**: FR-004
**Priority**: P0
**Given**: A call that returns `severity: 'fallback'`
**When**: The result is examined
**Then**: Has all fields; `fallbackReason` is a non-null string (one of: 'no-impact-analysis', 'no-parseable-table', 'git-diff-failed')

---

## Manual Validation Protocols

### MP-01: Full Feature Workflow with init-only

**Traces**: FR-001, FR-002, FR-007, NFR-001, NFR-005
**Priority**: P0
**Steps**:
1. Run `/isdlc build "test feature"` (or `/isdlc feature "test feature"`)
2. Observe STEP 1: verify the orchestrator is called with `MODE: init-only`
3. Verify state.json: `active_workflow` has correct type, phases, current_phase, current_phase_index = 0
4. Verify the return JSON: `{ status: "init_complete", phases: [...], next_phase_index: 0 }`
5. Verify STEP 2 task list includes Phase 01 and it is NOT pre-marked as completed
6. Verify Phase-Loop Controller starts from index 0 (Phase 01)
7. Verify all phases execute through the Phase-Loop Controller (no phases via orchestrator init mode)
**Pass criteria**: All 7 verifications pass

### MP-02: Pre-Analyzed Build with START_PHASE

**Traces**: FR-001 AC-001-02, FR-002 AC-002-02
**Priority**: P0
**Steps**:
1. Analyze an item first: `/isdlc analyze "test item"`
2. Then build it: `/isdlc build "test item"`
3. Verify init-only is called with START_PHASE set to "05-test-strategy"
4. Verify phases array is sliced from START_PHASE onward
5. Verify Phase-Loop Controller starts from the sliced array's index 0
**Pass criteria**: Phases 01-04 are NOT re-executed

### MP-03: Staleness -- No Overlap (Silent)

**Traces**: FR-006 AC-006-01
**Priority**: P1
**Steps**:
1. Analyze an item, make commits to unrelated files
2. Build the item
3. Verify no staleness output, no menu, silent proceed
**Pass criteria**: Build proceeds without any staleness notification

### MP-04: Staleness -- 1-3 Overlapping Files (Info)

**Traces**: FR-006 AC-006-02
**Priority**: P1
**Steps**:
1. Analyze an item, make commits to 2 files in the blast radius
2. Build the item
3. Verify an informational note listing the 2 overlapping files
4. Verify no menu is shown; build proceeds automatically
**Pass criteria**: Info note displayed, no blocking menu

### MP-05: Staleness -- 4+ Overlapping Files (Warning)

**Traces**: FR-006 AC-006-03
**Priority**: P1
**Steps**:
1. Analyze an item, make commits to 5+ files in the blast radius
2. Build the item
3. Verify a warning menu with [P] Proceed / [Q] Re-scan / [A] Re-analyze options
4. Verify overlapping file list is shown
**Pass criteria**: Warning menu displayed with correct options

### MP-06: Staleness -- Fallback (No Impact Analysis)

**Traces**: FR-006 AC-006-04
**Priority**: P0
**Steps**:
1. Create a partially analyzed item (no impact-analysis.md)
2. Build the item
3. Verify the staleness check falls back to naive hash comparison
4. Verify behavior matches current (pre-change) step 4c behavior
**Pass criteria**: Fallback to existing behavior with no errors

### MP-07: Backward Compatibility -- init-and-phase-01 Still Works

**Traces**: FR-003 AC-003-01, AC-003-04, NFR-001
**Priority**: P0
**Steps**:
1. Manually invoke the orchestrator with `MODE: init-and-phase-01`
2. Verify it executes the full existing behavior (init + phase + gate + plan)
3. Verify a deprecation notice is emitted
4. Verify the "deprecated" label is present in the orchestrator mode table
**Pass criteria**: Existing behavior preserved; deprecation notice visible
