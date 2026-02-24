# ADR-002: Blast-Radius-Aware Staleness Detection Algorithm

## Status

Proposed

## Date

2026-02-20

## Context

The `checkStaleness()` function in `three-verb-utils.cjs` compares `meta.codebase_hash` with the current git HEAD. Any hash difference -- even a commit to a completely unrelated file -- triggers a staleness warning menu that interrupts the user. In parallel development workflows (multiple branches, concurrent features), this fires on nearly every build because:

1. Merging any branch advances HEAD, changing the hash
2. Commits to unrelated parts of the codebase change the hash
3. The comparison has zero file-level granularity

This creates friction: developers learn to reflexively press [P] Proceed on every staleness warning, rendering the entire mechanism useless as a quality signal.

### Requirements Driving This Decision

- **FR-004**: Blast-radius-aware staleness check with tiered response
- **FR-005**: extractFilesFromImpactAnalysis() utility function
- **FR-006**: Tiered UX in build handler (none/info/warning)
- **NFR-002**: Staleness check must not add perceptible latency
- **NFR-003**: Graceful degradation when blast-radius data unavailable
- **NFR-004**: New functions must be testable with injectable I/O
- **CON-004**: Git must be available at runtime
- **CON-005**: impact-analysis.md format is semi-stable

## Decision

Replace the naive hash comparison with a blast-radius-aware algorithm that determines which files changed and intersects them with the blast radius from `impact-analysis.md`. The response is tiered based on overlap count.

### Algorithm

```
INPUT:
  meta.codebase_hash     -- the git hash at analysis time
  currentHash            -- current git HEAD short hash
  impactAnalysisContent  -- raw markdown of impact-analysis.md (or null)

STEP 1: Early exit
  IF meta is null OR meta.codebase_hash is falsy:
    RETURN { stale: false }  -- same as current checkStaleness
  IF meta.codebase_hash === currentHash:
    RETURN { stale: false, severity: 'none' }

STEP 2: Extract blast radius
  blastRadiusFiles = extractFilesFromImpactAnalysis(impactAnalysisContent)
  IF blastRadiusFiles is empty:
    RETURN { stale: true, severity: 'fallback', fallbackReason: 'no-blast-radius' }

STEP 3: Get changed files
  IF changedFiles parameter provided:
    USE changedFiles (testability path)
  ELSE:
    TRY: changedFiles = git diff --name-only {meta.codebase_hash}..HEAD
    CATCH: RETURN { stale: true, severity: 'fallback', fallbackReason: 'git-diff-failed' }

STEP 4: Compute intersection
  blastRadiusSet = Set(blastRadiusFiles)
  overlapping = changedFiles.filter(f => blastRadiusSet.has(f))

STEP 5: Determine severity
  IF overlapping.length === 0:
    severity = 'none'     -- silent proceed
    stale = false
  ELSE IF overlapping.length <= 3:
    severity = 'info'     -- informational note, no menu
    stale = true
  ELSE:
    severity = 'warning'  -- full menu [P]/[Q]/[A]
    stale = true

RETURN {
  stale, severity, overlappingFiles: overlapping,
  changedFileCount: changedFiles.length,
  blastRadiusFileCount: blastRadiusFiles.length,
  originalHash: meta.codebase_hash,
  currentHash,
  fallbackReason: null
}
```

### Tiered UX in isdlc.md Steps 4b-4c

| Severity | User Experience |
|----------|----------------|
| `none` | Silent proceed. No output, no interaction. |
| `info` | Display informational note listing the 1-3 overlapping files. No menu. Build proceeds automatically. |
| `warning` | Display warning with 4+ overlapping files and present menu: [P] Proceed / [Q] Re-scan / [A] Re-analyze. |
| `fallback` | Apply current naive behavior: display staleness warning menu with hash info (no file-level detail). |

### File Path Normalization

Both `extractFilesFromImpactAnalysis()` and the git diff output produce relative paths. Normalization rules:
- Strip leading `./` from impact-analysis.md paths
- Strip leading `/` from impact-analysis.md paths
- git diff --name-only already produces root-relative paths without prefix

### Module Location

Both new functions (`extractFilesFromImpactAnalysis` and `checkBlastRadiusStaleness`) are placed in `three-verb-utils.cjs` because:
1. They are consumed exclusively by the build handler staleness flow
2. `checkStaleness()` (which they supersede/extend) already lives there
3. They are pure/injectable functions fitting the module's character
4. `common.cjs` is for hook infrastructure, not markdown parsing

### Parsing Strategy for extractFilesFromImpactAnalysis

The function scans for the "Directly Affected Files" section header, then extracts file paths from table rows matching the pattern: `| \`file/path\` | ... |`. It stops at the next `###` heading or end of content.

The regex uses the simpler pattern ``/^\|\s*`([^`]+)`\s*\|/`` (just requires backtick-wrapped content in first column) rather than the stricter blast-radius-validator pattern that requires a change type column. This makes it resilient to table format variations (CON-005).

## Consequences

### Positive

- **Reduced false positives**: Changes to unrelated files no longer trigger warnings
- **Actionable warnings**: When warnings do fire, they list the specific overlapping files, giving the developer information to make an informed decision
- **Graduated response**: The three-tier model (silent/info/warning) reserves full-menu interruptions for significant overlap
- **Testable**: changedFiles injection means unit tests do not require git mocks
- **Backward compatible**: Falls back to existing behavior when impact-analysis.md is missing or unparseable

### Negative

- **Complexity increase**: The staleness check goes from a simple hash comparison to a multi-step algorithm with fallback paths. However, the complexity is encapsulated in two well-tested pure functions.
- **Git dependency for file-level detail**: Requires `git diff --name-only` to work. Falls back gracefully if git is unavailable, but the enhanced behavior is git-dependent.
- **Threshold hardcoding**: The 1-3 (info) and 4+ (warning) thresholds are hardcoded. Future work could make these configurable in workflows.json, but this is YAGNI for now.

## Alternatives Considered

### A: Keep Naive Hash Comparison, Add "Dismiss for This Session" Option

Add a session-local flag that suppresses staleness warnings after the first dismissal. Rejected because:
- Does not solve the fundamental problem (all warnings are false positives)
- Session-local state is fragile (lost on CLI restart)
- Does not provide file-level information

### B: Use git diff --stat Instead of --name-only

`--stat` provides insertion/deletion counts per file, which could weight the severity by change magnitude. Rejected because:
- Additional complexity for marginal benefit
- The overlap count (0 / 1-3 / 4+) is sufficient for the tiered UX
- `--stat` output is harder to parse reliably

### C: Place Functions in a New staleness-utils.cjs Module

Create a dedicated module for staleness-related utilities. Rejected because:
- Only two functions, ~80 lines total
- Existing module (three-verb-utils.cjs) already contains checkStaleness()
- Additional module increases import complexity and test file count
- Module cohesion is better when staleness functions are co-located

### D: Place extractFilesFromImpactAnalysis in common.cjs

common.cjs already has `parseSizingFromImpactAnalysis()` which also reads impact-analysis.md. Rejected because:
- common.cjs contains hook infrastructure (state management, project root, logging)
- parseSizingFromImpactAnalysis reads the JSON metadata block, not the file table
- extractFilesFromImpactAnalysis has no hook dependencies -- it is pure markdown parsing
- Mixing pure parsing functions into common.cjs blurs the module's responsibility

### E: Reuse blast-radius-validator's parseImpactAnalysis()

Import and reuse the existing parser from blast-radius-validator.cjs. Rejected because:
- blast-radius-validator returns `{ filePath, changeType }` pairs; we only need file paths
- Importing from a hook module creates a dependency from utility to hook layer
- The stricter regex requires a change type column; the new function needs resilience (CON-005)
- The two functions serve different purposes (coverage validation vs. intersection matching)

## Traces

- FR-004 (AC-004-01 through AC-004-06)
- FR-005 (AC-005-01 through AC-005-04)
- FR-006 (AC-006-01 through AC-006-04)
- NFR-002 (AC-NFR-002-01, AC-NFR-002-02)
- NFR-003 (AC-NFR-003-01 through AC-NFR-003-03)
- NFR-004 (AC-NFR-004-01, AC-NFR-004-02)
- CON-004, CON-005
