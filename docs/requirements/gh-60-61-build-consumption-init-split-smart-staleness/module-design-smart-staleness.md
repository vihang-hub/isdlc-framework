# Module Design: Blast-Radius-Aware Smart Staleness (GH-61)

**Feature**: GH-61 (Smart Staleness Check)
**Artifact Folder**: gh-60-61-build-consumption-init-split-smart-staleness
**Phase**: 04-design
**Status**: Draft
**Created**: 2026-02-20

**Traces**: FR-004, FR-005, FR-006, NFR-002, NFR-003, NFR-004

---

## 1. Module Overview

GH-61 replaces the naive hash-comparison staleness check with a blast-radius-aware
algorithm. Two new functions are added to `three-verb-utils.cjs`, and the
staleness handling in `isdlc.md` Steps 4b-4c is updated to consume the new
tiered result.

**Modified files**: 2 (`three-verb-utils.cjs`, `isdlc.md`)
**New functions**: 2 (`extractFilesFromImpactAnalysis`, `checkBlastRadiusStaleness`)
**Modified test files**: 1 (`test-three-verb-utils.test.cjs`)

---

## 2. New Function: extractFilesFromImpactAnalysis(mdContent)

### 2.1 Location

`src/claude/hooks/lib/three-verb-utils.cjs`, inserted after the `checkStaleness()` function
(after line ~539) and before the TIER_ORDER constant block.

### 2.2 Purpose

Parses the "Directly Affected Files" markdown table from `impact-analysis.md` and
returns a deduplicated, normalized array of file paths. This is a pure function
with no I/O dependencies (string in, array out).

### 2.3 Algorithm

```
INPUT: mdContent (string | null | undefined)

STEP 1: Guard -- null/undefined/empty/non-string input
  IF mdContent is null, undefined, empty string, or not a string:
    RETURN []

STEP 2: Find the "Directly Affected Files" section
  Split content into lines.
  Scan for a heading line matching: /^#{2,3}\s+.*Directly Affected Files/i
  IF not found:
    RETURN []
  Record startIndex = line index of the heading + 1

STEP 3: Find section boundary
  From startIndex, scan forward for the next heading: /^#{2,3}\s/
  Record endIndex = line index of next heading (or end of content)

STEP 4: Extract file paths from table rows
  For each line from startIndex to endIndex:
    Match against: /^\|\s*`([^`]+)`\s*\|/
    IF match:
      Extract group 1 as rawPath
      Normalize: strip leading "./" or "/"
      Add to a Set (for deduplication)

STEP 5: Return
  RETURN Array.from(set)
```

### 2.4 Parsing Strategy: Section-Scoped Extraction

The function uses section-scoped extraction rather than whole-document scanning.
This ensures it only extracts from the "Directly Affected Files" table and not from
"Indirectly Affected Files" or other tables that also contain file paths in backtick
format.

**Section header detection**: The regex `/^#{2,3}\s+.*Directly Affected Files/i` matches:
- `### Directly Affected Files` (standard format)
- `## Directly Affected Files` (variant)
- `### 3.1 Directly Affected Files` (numbered variant)

This is resilient to the semi-stable format per CON-005.

**Table row regex**: `/^\|\s*`([^`]+)`\s*\|/` matches any markdown table row with
a backtick-wrapped value in the first column. This is intentionally simpler than the
blast-radius-validator's `IMPACT_TABLE_ROW` regex which also requires a change type
column (`CREATE|MODIFY|DELETE|NO CHANGE`). The simpler pattern handles table format
variations where the second column may not be a change type.

### 2.5 Path Normalization Rules

| Input Path | Normalized Output | Rule |
|------------|-------------------|------|
| `src/claude/commands/isdlc.md` | `src/claude/commands/isdlc.md` | No change (already relative) |
| `./src/hooks/lib/utils.cjs` | `src/hooks/lib/utils.cjs` | Strip leading `./` |
| `/src/hooks/lib/utils.cjs` | `src/hooks/lib/utils.cjs` | Strip leading `/` |
| `src/hooks/lib/utils.cjs` | `src/hooks/lib/utils.cjs` | No change |

Normalization ensures consistent matching against `git diff --name-only` output,
which produces root-relative paths without any prefix.

### 2.6 Edge Cases

| Scenario | Behavior | Trace |
|----------|----------|-------|
| null input | Return `[]` | AC-005-03 |
| undefined input | Return `[]` | AC-005-03 |
| Empty string input | Return `[]` | AC-005-03 |
| Non-string input (number, object) | Return `[]` | AC-005-03 |
| Content with only "Indirectly Affected" table | Return `[]` | AC-005-02 |
| Content with no tables at all | Return `[]` | AC-005-03 |
| Content with both Directly and Indirectly tables | Return only Directly files | AC-005-02 |
| Duplicate file paths in table | Deduplicated (Set) | AC-005-04 |
| Paths with `./` prefix | Stripped to relative | AC-005-04 |
| Paths with `/` prefix | Stripped to relative | AC-005-04 |
| Table header row (e.g., `| File | Change Type |`) | Skipped (no backticks in standard headers) | Implicit |
| Table separator row (e.g., `|------|------|`) | Skipped (no backtick match) | Implicit |

---

## 3. New Function: checkBlastRadiusStaleness(meta, currentHash, impactAnalysisContent, changedFiles)

### 3.1 Location

`src/claude/hooks/lib/three-verb-utils.cjs`, inserted immediately after
`extractFilesFromImpactAnalysis()`.

### 3.2 Purpose

Enhanced staleness check that intersects git-changed files with the blast radius
from impact-analysis.md to produce a tiered severity response.

### 3.3 Algorithm

```
INPUT:
  meta: object | null              -- Parsed meta.json
  currentHash: string              -- Current git HEAD short hash
  impactAnalysisContent: string | null  -- Raw impact-analysis.md content
  changedFiles: string[] | null    -- Pre-computed changed files (null = compute via git)

STEP 1: Early exit -- no meta or no hash to compare
  IF meta is null OR meta is undefined OR typeof meta !== 'object':
    RETURN { stale: false, severity: 'none', overlappingFiles: [],
             changedFileCount: 0, blastRadiusFileCount: 0,
             originalHash: null, currentHash, fallbackReason: null }

  IF !meta.codebase_hash (falsy):
    RETURN { stale: false, severity: 'none', overlappingFiles: [],
             changedFileCount: 0, blastRadiusFileCount: 0,
             originalHash: null, currentHash, fallbackReason: null }

STEP 2: Early exit -- same hash (not stale)
  IF meta.codebase_hash === currentHash:
    RETURN { stale: false, severity: 'none', overlappingFiles: [],
             changedFileCount: 0, blastRadiusFileCount: 0,
             originalHash: meta.codebase_hash, currentHash, fallbackReason: null }

STEP 3: Extract blast radius files
  blastRadiusFiles = extractFilesFromImpactAnalysis(impactAnalysisContent)

  IF impactAnalysisContent is null/undefined/empty OR blastRadiusFiles.length === 0:
    fallbackReason = impactAnalysisContent ? 'no-parseable-table' : 'no-impact-analysis'
    RETURN { stale: true, severity: 'fallback',
             overlappingFiles: [], changedFileCount: 0,
             blastRadiusFileCount: 0,
             originalHash: meta.codebase_hash, currentHash,
             fallbackReason }

STEP 4: Get changed files
  IF changedFiles is provided (non-null array):
    USE changedFiles directly (testability path)
  ELSE:
    TRY:
      result = execSync('git diff --name-only ' + meta.codebase_hash + '..HEAD',
                         { encoding: 'utf8', timeout: 5000 })
      changedFiles = result.trim().split('\n').filter(line => line.trim() !== '')
    CATCH:
      RETURN { stale: true, severity: 'fallback',
               overlappingFiles: [], changedFileCount: 0,
               blastRadiusFileCount: blastRadiusFiles.length,
               originalHash: meta.codebase_hash, currentHash,
               fallbackReason: 'git-diff-failed' }

STEP 5: Compute intersection
  blastRadiusSet = new Set(blastRadiusFiles)
  overlapping = changedFiles.filter(f => blastRadiusSet.has(f))

STEP 6: Determine severity tier
  IF overlapping.length === 0:
    stale = false
    severity = 'none'
  ELSE IF overlapping.length <= 3:
    stale = true
    severity = 'info'
  ELSE:
    stale = true
    severity = 'warning'

STEP 7: Return
  RETURN {
    stale,
    severity,
    overlappingFiles: overlapping,
    changedFileCount: changedFiles.length,
    blastRadiusFileCount: blastRadiusFiles.length,
    originalHash: meta.codebase_hash,
    currentHash,
    fallbackReason: null
  }
```

### 3.4 Severity Tier Thresholds

| Overlapping Files | Severity | stale | UX Behavior |
|-------------------|----------|-------|-------------|
| 0 | `'none'` | `false` | Silent proceed |
| 1-3 | `'info'` | `true` | Informational note, no menu |
| 4+ | `'warning'` | `true` | Full warning menu |
| N/A (fallback) | `'fallback'` | `true` | Naive hash-based menu |

The thresholds (3 for info/warning boundary) are hardcoded per ADR-002 ("YAGNI
for now"). Future work could make these configurable via workflows.json.

### 3.5 Testability Design (NFR-004)

The `changedFiles` parameter is the key testability mechanism:

- **Production path**: `changedFiles = null` -- the function calls `git diff --name-only` internally
- **Test path**: `changedFiles = ['file1.js', 'file2.js']` -- the function skips the git call entirely

This eliminates the need for git mocks, temp repositories, or process spawning in
unit tests. Tests provide a pre-computed array and validate only the intersection
logic and severity determination.

```javascript
// Example test (no git needed):
const result = checkBlastRadiusStaleness(
  { codebase_hash: 'abc1234' },
  'def5678',
  impactAnalysisMdContent,
  ['src/file1.js', 'src/file2.js', 'unrelated/file3.js']
);
assert.strictEqual(result.severity, 'info');
assert.deepStrictEqual(result.overlappingFiles, ['src/file1.js', 'src/file2.js']);
```

### 3.6 Git Command Details

When `changedFiles` is null, the function executes:

```bash
git diff --name-only {meta.codebase_hash}..HEAD
```

- **Timeout**: 5000ms (5 seconds) -- well above the 2-second NFR-002 requirement
- **Encoding**: `utf8`
- **Output parsing**: Split on newlines, filter empty lines
- **Error handling**: Any exception (non-zero exit, timeout, git not found) triggers fallback
- **Node API**: `require('child_process').execSync(...)` (CommonJS, consistent with module style)

The `execSync` import must be added to the top of `three-verb-utils.cjs`:

```javascript
const { execSync } = require('child_process');
```

This is the only new import required. The module already imports `fs` and `path`.

### 3.7 Relationship to Existing checkStaleness()

`checkStaleness()` is **preserved unchanged** for backward compatibility (NFR-001).
The new `checkBlastRadiusStaleness()` is a separate function, not a modification of
the existing one. The call site in `isdlc.md` Step 4b changes to call the new function,
with fallback to the old function's behavior via the `severity: 'fallback'` return.

```
checkStaleness()              -- Pure hash comparison (preserved)
checkBlastRadiusStaleness()   -- Blast-radius intersection (new, calls extractFiles)
extractFilesFromImpactAnalysis() -- Markdown parser (new, pure function)
```

---

## 4. isdlc.md Changes: Steps 4b-4c

### 4.1 Step 4b: Check Staleness (Line ~766-783)

**Current**:
```markdown
**Step 4b: Check staleness** (FR-004, NFR-002) -- only if `analysisStatus !== 'raw'`

TRY:
  currentHash = git rev-parse --short HEAD (trim whitespace)
CATCH:
  ...

stalenessResult = checkStaleness(meta, currentHash)

IF stalenessResult.stale:
  TRY:
    commitCount = git rev-list --count {stalenessResult.originalHash}..HEAD
    stalenessResult.commitsBehind = parseInt(commitCount.trim(), 10)
  CATCH:
    stalenessResult.commitsBehind = null
```

**After**:
```markdown
**Step 4b: Check staleness** (FR-004, NFR-002) -- only if `analysisStatus !== 'raw'`

TRY:
  currentHash = git rev-parse --short HEAD (trim whitespace)
CATCH:
  Log warning: "Could not determine current codebase version. Skipping staleness check."
  stalenessResult = { stale: false, severity: 'none', overlappingFiles: [],
                      changedFileCount: 0, blastRadiusFileCount: 0,
                      originalHash: null, currentHash: null, fallbackReason: null }
  SKIP to step 4d.

// Read impact-analysis.md for blast-radius-aware check
LET impactAnalysisContent = null
TRY:
  impactAnalysisPath = path.join(slugDir, 'impact-analysis.md')
  IF file exists at impactAnalysisPath:
    impactAnalysisContent = fs.readFileSync(impactAnalysisPath, 'utf8')
CATCH:
  impactAnalysisContent = null  // fallback to naive

stalenessResult = checkBlastRadiusStaleness(meta, currentHash, impactAnalysisContent, null)

// For fallback mode, enrich with commit count (same as before)
IF stalenessResult.stale AND (stalenessResult.severity === 'fallback' OR stalenessResult.severity === 'warning'):
  TRY:
    commitCount = git rev-list --count {stalenessResult.originalHash}..HEAD
    stalenessResult.commitsBehind = parseInt(commitCount.trim(), 10)
  CATCH:
    stalenessResult.commitsBehind = null
```

**Key changes**:
1. Read `impact-analysis.md` from the slug directory
2. Call `checkBlastRadiusStaleness` instead of `checkStaleness`
3. Pass `null` for `changedFiles` (production path -- function runs git internally)
4. Commit count enrichment only for `fallback` and `warning` severities (info/none do not show commit info)

**Traces**: FR-004 (AC-004-01), FR-006 (AC-006-01)

### 4.2 Step 4c: Handle Staleness (Line ~785-804)

**Current**:
```markdown
**Step 4c: Handle staleness** (FR-004) -- only if `stalenessResult.stale === true`

Display staleness warning and present menu:
  STALENESS WARNING: {item slug}
  Analysis was performed at commit {originalHash}{commitsBehindStr}.
  Current HEAD is {currentHash}.
  Options:
    [P] Proceed anyway ...
    [Q] Re-run quick-scan ...
    [A] Re-analyze from scratch ...
```

**After**:
```markdown
**Step 4c: Handle staleness** (FR-004, FR-006) -- tiered response based on severity

IF stalenessResult.severity === 'none':
  // Silent proceed -- no output, no user interaction
  (continue to step 4d)

ELSE IF stalenessResult.severity === 'info':
  // Informational note -- display but do not block
  Display:
    INFO: {overlappingFiles.length} file(s) in this item's blast radius
    changed since analysis (commit {originalHash} -> {currentHash}):
      - {overlappingFiles[0]}
      - {overlappingFiles[1]}
      - ...
    Proceeding with existing analysis.
  (continue to step 4d -- no menu, automatic proceed)

ELSE IF stalenessResult.severity === 'warning':
  // Full warning menu -- 4+ overlapping files
  Display:
    STALENESS WARNING: {item slug}
    {overlappingFiles.length} file(s) in this item's blast radius changed
    since analysis (commit {originalHash}{commitsBehindStr} -> {currentHash}):
      - {overlappingFiles[0]}
      - {overlappingFiles[1]}
      - {overlappingFiles[2]}
      - {overlappingFiles[3]}
      - ... ({remaining} more)
    Options:
      [P] Proceed anyway -- use existing analysis as-is
      [Q] Re-run quick-scan -- refresh scope check
      [A] Re-analyze from scratch -- clear all analysis, start fresh

  Handle each choice (SAME as current step 4c behavior):
  - [P] Proceed: No changes.
  - [Q] Re-run quick-scan: Set startPhase = "00-quick-scan", etc.
  - [A] Re-analyze: Clear meta, etc.

ELSE IF stalenessResult.severity === 'fallback':
  // Naive hash-based warning -- identical to current step 4c behavior
  Display:
    STALENESS WARNING: {item slug}
    Analysis was performed at commit {originalHash}{commitsBehindStr}.
    Current HEAD is {currentHash}.
    (Blast-radius check unavailable: {fallbackReason})
    Options:
      [P] Proceed anyway -- use existing analysis as-is
      [Q] Re-run quick-scan -- refresh scope check
      [A] Re-analyze from scratch -- clear all analysis, start fresh

  Handle each choice (SAME as current step 4c):
  - [P] Proceed: No changes.
  - [Q] Re-run quick-scan: Set startPhase = "00-quick-scan", etc.
  - [A] Re-analyze: Clear meta, etc.
```

**Key changes**:
1. Replace single-path "stale = true -> menu" with four-tier conditional
2. `severity: 'none'` -- silent proceed (new, eliminates false positives)
3. `severity: 'info'` -- display note with file list, no menu (new, reduces friction)
4. `severity: 'warning'` -- display menu with specific overlapping files (enhanced)
5. `severity: 'fallback'` -- identical to current behavior with fallback reason note (backward compat)
6. Menu options [P]/[Q]/[A] and their handlers are identical across warning and fallback

**Warning display format**: For the `warning` tier, show the first 4 files individually
and summarize the rest as "... (N more)" to keep the display compact. For the `info`
tier, show all files (there are at most 3).

**Traces**: FR-006 (AC-006-01 through AC-006-04)

---

## 5. Export Changes in three-verb-utils.cjs

### 5.1 New Exports

Add to the module.exports block (after the `checkStaleness` line):

```javascript
module.exports = {
    // ... existing exports ...

    // Build auto-detection utilities (REQ-0026)
    validatePhasesCompleted,
    computeStartPhase,
    checkStaleness,

    // Blast-radius staleness utilities (GH-61)
    extractFilesFromImpactAnalysis,
    checkBlastRadiusStaleness,

    // Tier recommendation utilities (GH-59)
    // ... existing ...
};
```

### 5.2 New Import

Add at the top of the file (after the existing `const path = require('path');`):

```javascript
const { execSync } = require('child_process');
```

---

## 6. Data Flow Diagram

```
isdlc.md Step 4b                   three-verb-utils.cjs                  Git          FS
    |                                       |                              |            |
    |-- fs.readFileSync(impact-analysis.md) --------------------------------------------->|
    |<-- content (or null) ----------------------------------------------------------|
    |                                       |                              |            |
    |-- checkBlastRadiusStaleness(meta, hash, content, null) ----------->|            |
    |                                       |                              |            |
    |                              [STEP 1: null meta?]                    |            |
    |                              [STEP 2: same hash?]                    |            |
    |                                       |                              |            |
    |                              [STEP 3: extractFilesFromImpactAnalysis(content)]    |
    |                              blastRadiusFiles = ['a.js', 'b.js', 'c.cjs', ...]   |
    |                                       |                              |            |
    |                              [STEP 4: changedFiles = null, so run git]            |
    |                              execSync('git diff --name-only ...') -->|            |
    |                              changedFiles = ['a.js', 'x.js', ...]<--|            |
    |                                       |                              |            |
    |                              [STEP 5: intersect]                     |            |
    |                              overlapping = ['a.js']                  |            |
    |                                       |                              |            |
    |                              [STEP 6: 1 overlap -> severity='info']  |            |
    |                                       |                              |            |
    |<-- { stale:true, severity:'info', overlappingFiles:['a.js'], ... } |            |
    |                                                                      |            |
    |-- Step 4c: display info note                                         |            |
    |   "1 file in blast radius changed: a.js"                             |            |
    |   (auto-proceed, no menu)                                            |            |
```

---

## 7. Test Strategy Hooks

### 7.1 Unit Tests for extractFilesFromImpactAnalysis() (Pure Function)

All tests go in `src/claude/hooks/tests/test-three-verb-utils.test.cjs`.

| TC ID | Description | Input | Expected | AC Trace |
|-------|-------------|-------|----------|----------|
| TC-EF-01 | Standard table with backtick-wrapped paths | MD with "Directly Affected Files" table, 5 rows | Array of 5 file paths | AC-005-01 |
| TC-EF-02 | Only Indirectly Affected table | MD with "Indirectly Affected" table | `[]` | AC-005-02 |
| TC-EF-03 | Both Directly and Indirectly tables | MD with both tables | Only Directly files | AC-005-02 |
| TC-EF-04 | null input | `null` | `[]` | AC-005-03 |
| TC-EF-05 | undefined input | `undefined` | `[]` | AC-005-03 |
| TC-EF-06 | Empty string input | `''` | `[]` | AC-005-03 |
| TC-EF-07 | No recognizable table | `"# Some markdown\n\nNo tables here."` | `[]` | AC-005-03 |
| TC-EF-08 | Paths with leading `./` | `./src/foo.js` in table | `['src/foo.js']` | AC-005-04 |
| TC-EF-09 | Paths with leading `/` | `/src/foo.js` in table | `['src/foo.js']` | AC-005-04 |
| TC-EF-10 | Duplicate file paths | Same path in two rows | Single entry in result | AC-005-04 |
| TC-EF-11 | Non-string input (number) | `42` | `[]` | AC-005-03 |
| TC-EF-12 | Table header row skipped | Header `| File | Change Type |` not extracted | Correct file count | Implicit |
| TC-EF-13 | Real impact-analysis.md format | Use actual format from this project's impact-analysis.md | Correct 5 file paths | AC-005-01 |

### 7.2 Unit Tests for checkBlastRadiusStaleness() (Injectable I/O)

| TC ID | Description | Input | Expected | AC Trace |
|-------|-------------|-------|----------|----------|
| TC-BR-01 | 0 overlapping files | 3 changed, 5 blast radius, 0 overlap | `{ stale:false, severity:'none' }` | AC-004-02 |
| TC-BR-02 | 2 overlapping files | 5 changed, 5 blast radius, 2 overlap | `{ stale:true, severity:'info', overlappingFiles.length:2 }` | AC-004-03 |
| TC-BR-03 | 5 overlapping files | 8 changed, 5 blast radius, 5 overlap | `{ stale:true, severity:'warning', overlappingFiles.length:5 }` | AC-004-04 |
| TC-BR-04 | Exactly 3 overlapping (boundary) | 3 overlap | `{ severity:'info' }` | AC-004-03 |
| TC-BR-05 | Exactly 4 overlapping (boundary) | 4 overlap | `{ severity:'warning' }` | AC-004-04 |
| TC-BR-06 | null impactAnalysisContent | `null` for content | `{ severity:'fallback', fallbackReason:'no-impact-analysis' }` | AC-004-05 |
| TC-BR-07 | Empty impact analysis (no table) | Content with no table | `{ severity:'fallback', fallbackReason:'no-parseable-table' }` | AC-004-05 |
| TC-BR-08 | Same hash (not stale) | `meta.codebase_hash === currentHash` | `{ stale:false, severity:'none' }` | Implicit |
| TC-BR-09 | null meta | `null` | `{ stale:false }` | Implicit |
| TC-BR-10 | Missing codebase_hash | `meta = {}` | `{ stale:false }` | Implicit |
| TC-BR-11 | changedFiles provided as array | `changedFiles = [...]` | Uses array, correct intersection | NFR-004 |
| TC-BR-12 | All blast radius files changed | 5 blast, 5 changed, all overlap | `{ severity:'warning', overlappingFiles.length:5 }` | AC-004-04 |
| TC-BR-13 | changedFiles empty array | `changedFiles = []` | `{ stale:false, severity:'none' }` | AC-004-02 |
| TC-BR-14 | Return includes all metadata fields | Any valid input | All fields present in return | AC-004-01 |

### 7.3 Cross-Validation Test

| TC ID | Description | Purpose |
|-------|-------------|---------|
| TC-XV-01 | Parse same impact-analysis.md with extractFilesFromImpactAnalysis() and blast-radius-validator's parseImpactAnalysis() | Verify file paths are compatible (same paths extracted, even though return shapes differ) |

---

## 8. Risk Mitigation

| Risk | Severity | Mitigation |
|------|----------|------------|
| impact-analysis.md format varies | MEDIUM | Section-scoped extraction with flexible header regex (CON-005). TC-EF-13 tests real format. |
| git diff fails on shallow clone | LOW | Fallback to naive check (severity: 'fallback'). TC-BR-07 validates. |
| Path normalization mismatch | LOW | Both extractFiles and git diff produce relative paths. Explicit strip of `./` and `/`. |
| execSync blocks event loop | LOW | 5-second timeout. Git diff is fast (< 100ms typical). NFR-002 validated. |
| Threshold hardcoding (3/4 boundary) | LOW | YAGNI. Future configurable via workflows.json if needed. |

---

## 9. Traceability

| Requirement | Design Section | Test Cases |
|-------------|---------------|------------|
| FR-004 | 3 (checkBlastRadiusStaleness) | TC-BR-01..14 |
| FR-005 | 2 (extractFilesFromImpactAnalysis) | TC-EF-01..13 |
| FR-006 | 4 (isdlc.md Steps 4b-4c) | TC-BR-01..07 (severity drives UX) |
| NFR-002 | 3.6 (git timeout), 2.3 (single-pass) | TC-BR-14 (perf implicit) |
| NFR-003 | 3.3 STEP 3-4 fallbacks | TC-BR-06, TC-BR-07 |
| NFR-004 | 3.5 (changedFiles injection) | TC-BR-11 |
| CON-004 | 3.6 (git dependency) | TC-BR-06 fallback |
| CON-005 | 2.4 (resilient parser) | TC-EF-01..13 |
