# Blast Radius Coverage Checklist: REQ-0031 (GH-60 + GH-61)

**Phase**: 06-implementation
**Created**: 2026-02-20
**Status**: Complete

---

## Modified Files Checklist

### 1. `src/claude/hooks/lib/three-verb-utils.cjs`

- [x] Added `const { execSync } = require('child_process');` import
- [x] Added `extractFilesFromImpactAnalysis(mdContent)` function
  - Section-scoped extraction with `\bDirectly Affected Files` heading regex
  - Backtick-wrapped file path extraction from table rows
  - Path normalization (strip `./` and `/` prefixes)
  - Deduplication via Set
  - Guard against null/undefined/empty/non-string input
- [x] Added `checkBlastRadiusStaleness(meta, currentHash, impactAnalysisContent, changedFiles)` function
  - Early exit for null meta, missing codebase_hash, same hash
  - Fallback to `severity: 'fallback'` when no impact analysis or no parseable table
  - Injectable `changedFiles` parameter for testability (NFR-004)
  - Intersection with blast radius files via Set
  - Tiered severity: none (0 overlap), info (1-3), warning (4+)
  - Git fallback via `execSync('git diff --name-only ...')` with 5s timeout
- [x] Both functions exported in `module.exports`
- **Traces**: FR-004, FR-005, FR-006, NFR-002, NFR-003, NFR-004, CON-005

### 2. `src/claude/hooks/tests/test-three-verb-utils.test.cjs`

- [x] Added imports for `extractFilesFromImpactAnalysis` and `checkBlastRadiusStaleness`
- [x] Added `extractFilesFromImpactAnalysis()` test suite (15 tests: TC-EF-01 through TC-EF-15)
  - Standard table parsing, heading level variants, numbered headings
  - Section boundary enforcement (only Directly Affected, not Indirectly)
  - Guard tests: null, undefined, empty string, non-string, no table
  - Path normalization: `./` prefix, `/` prefix
  - Deduplication, header row skip
- [x] Added `checkBlastRadiusStaleness()` test suite (16 tests: TC-BR-01 through TC-BR-16)
  - Severity tiers: none (0), info (1-3), warning (4+), fallback
  - Boundary tests: exactly 3 (info), exactly 4 (warning)
  - Edge cases: null meta, undefined meta, missing hash, same hash, empty changedFiles
  - Fallback modes: null content, no-parseable-table, empty string content
  - Metadata field validation (all return fields present)
- **Total new tests**: 31 (15 + 16)
- **Traces**: AC-004-02 through AC-004-05, AC-005-01 through AC-005-04

### 3. `src/claude/hooks/tests/test-three-verb-utils-steps.test.cjs`

- [x] Added imports for `extractFilesFromImpactAnalysis` and `checkBlastRadiusStaleness`
- [x] Added integration test suite: `blast-radius staleness integration (GH-61)` (9 tests: TC-INT-01 through TC-INT-09)
  - Realistic impact-analysis.md content with 5 direct + 2 indirect files
  - End-to-end extract + check pipeline: no overlap, 2 overlaps, all 5 overlaps
  - Indirect files exclusion verification
  - Same hash early exit with blast radius content
  - Fallback scenarios: null content, no-parseable-table content
  - Path normalization pipeline (./ prefix matching)
  - Full round-trip with `readMetaJson` integration
- **Total new tests**: 9
- **Traces**: FR-004, FR-005, FR-006, NFR-003, NFR-004

### 4. `src/claude/commands/isdlc.md`

- [x] STEP 1: Changed MODE from `init-and-phase-01` to `init-only`
- [x] STEP 1: Updated heading to "Launch orchestrator for workflow initialization"
- [x] STEP 1: Updated return format documentation (`init_complete`, `next_phase_index: 0`)
- [x] STEP 2: Removed "Mark Phase 01's task as completed" paragraph
- [x] STEP 2: Replaced with "All tasks start as pending" note
- [x] STEP 3: Updated heading from "remaining phases" to "all phases"
- [x] STEP 3: Updated loop description to `next_phase_index (0)`
- [x] Step 4b: Updated to read `impact-analysis.md` and call `checkBlastRadiusStaleness`
- [x] Step 4b: Commit count enrichment only for fallback and warning severities
- [x] Step 4c: Replaced single-path menu with four-tier conditional (none/info/warning/fallback)
- [x] Step 7 (build handler): Changed MODE from `init-and-phase-01` to `init-only`
- [x] Step 8-9: Updated descriptions for init-only behavior
- [x] Added 3e-plan: Plan generation hook after Phase 01 completion
- **Traces**: FR-001 through FR-007, NFR-001, NFR-005

### 5. `src/claude/agents/00-sdlc-orchestrator.md`

- [x] MODE ENFORCEMENT: Added `init-only` entry (before init-and-phase-01)
- [x] MODE ENFORCEMENT: Marked `init-and-phase-01` as deprecated
- [x] Mode Parameter examples: Added `init-only`, marked `init-and-phase-01` as deprecated
- [x] Mode Definitions table: Added `init-only` row, marked `init-and-phase-01` as deprecated
- [x] Return Format: Added `init-only` return format
- [x] Mode Behavior: Added entry 0 for `init-only` with deprecation notice for `init-and-phase-01`
- [x] Mode-Aware Guard: Added `init-only` check
- [x] CHECK MODE BOUNDARY: Added `init-only` reference
- [x] TaskCreate exception: Added `init-only` to skip list
- **Traces**: FR-001 (AC-001-01 through AC-001-06), FR-003 (AC-003-02, AC-003-04), FR-007

---

## Test Summary

| Test File | Existing Tests | New Tests | Total | All Passing |
|-----------|---------------|-----------|-------|-------------|
| test-three-verb-utils.test.cjs | 262 | 31 | 293 | Yes |
| test-three-verb-utils-steps.test.cjs | 25 | 9 | 34 | Yes |
| **Combined** | **287** | **40** | **327** | **Yes** |

---

## FR/AC Traceability

| Requirement | Implementation | Test Coverage |
|-------------|---------------|---------------|
| FR-004 (Blast-radius staleness) | `checkBlastRadiusStaleness()` + isdlc.md Step 4b | TC-BR-01..16, TC-INT-01..08 |
| FR-005 (Extract files from impact analysis) | `extractFilesFromImpactAnalysis()` | TC-EF-01..15, TC-INT-01..04 |
| FR-006 (Tiered staleness UX) | isdlc.md Step 4c (4-tier conditional) | TC-BR-01..07 (severity drives UX) |
| FR-001 (MODE: init-only) | orchestrator.md mode sections | Manual verification (TC-IO-01..05) |
| FR-002 (Phase-Loop handles all phases) | isdlc.md STEP 1/2/3 changes | Manual verification (TC-IO-06..09) |
| FR-003 (Deprecate init-and-phase-01) | orchestrator.md deprecation marks | Manual verification (TC-IO-10..11) |
| FR-007 (init-only return format) | orchestrator.md return format | Manual verification (TC-IO-01..03) |
| NFR-003 (Graceful degradation) | Fallback path in checkBlastRadiusStaleness | TC-BR-06, TC-BR-07, TC-INT-06..07 |
| NFR-004 (Testability) | Injectable changedFiles parameter | TC-BR-11, TC-INT-01..09 |
