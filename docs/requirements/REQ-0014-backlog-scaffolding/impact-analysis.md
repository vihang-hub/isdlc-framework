# Impact Analysis: BACKLOG.md Scaffolding in Installer

**Generated**: 2026-02-14T17:38:00.000Z
**Feature**: Add BACKLOG.md scaffolding to installer -- create empty BACKLOG.md with expected section headers during isdlc init. Uninstaller should leave it alone.
**Based On**: Phase 01 Requirements (finalized) -- REQ-0014
**Phase**: 02-impact-analysis

---

## Scope Comparison

| Aspect | Original (Phase 00) | Clarified (Phase 01) |
|--------|---------------------|----------------------|
| Description | Add BACKLOG.md scaffolding to installer | Add BACKLOG.md with ## Open / ## Completed headers during isdlc init, skip if exists, respect --dry-run, uninstaller ignores |
| Keywords | BACKLOG, installer, scaffolding | BACKLOG, installer, uninstaller, dry-run, skip-if-exists, preamble, format convention |
| Estimated Files | 3 files direct | 4 files (2 modified, 1 verified, 1 reference-only) |
| Scope Change | - | REFINED (added specifics for log messages, preamble, ordering -- same boundary) |

---

## Executive Summary

This is a **small, well-bounded feature** that adds BACKLOG.md file creation to the existing installer flow. The change is isolated to a single function (`install()` in `lib/installer.js`) following an established pattern (the CLAUDE.md creation block at lines 557-569). The uninstaller already has no references to BACKLOG.md, confirming FR-04 is satisfied with zero code changes. Test additions are straightforward extensions of the existing subprocess-based testing pattern in `lib/installer.test.js`.

**Blast Radius**: LOW (2 files modified, 1 verified clean, 1 reference-only)
**Risk Level**: LOW
**Affected Files**: 2 (installer.js, installer.test.js)
**Affected Modules**: 1 (lib/ -- installer module)

---

## Impact Analysis

### M1: Directly Affected Files

| File | Change Type | Lines Affected | Acceptance Criteria |
|------|------------|---------------|---------------------|
| `lib/installer.js` | **Modified** | ~15 new lines after line 569 | AC-01 through AC-09 |
| `lib/installer.test.js` | **Modified** | ~60 new lines (3 new describe blocks) | AC-01 through AC-12 |
| `lib/uninstaller.js` | **Verified clean** | 0 lines changed | AC-10, AC-11, AC-12 |
| `src/claude/CLAUDE.md.template` | **Reference only** | 0 lines changed | NFR-01 (format source of truth) |

### M1: Dependency Analysis

**Outward dependencies (what depends on installer.js):**
- `lib/cli.js` -- imports and calls `install()` from the CLI command handler
- `lib/installer.test.js` -- tests the install function via subprocess (`node bin/isdlc.js init`)
- `bin/isdlc.js` -- CLI entry point that routes to `lib/cli.js`
- No other modules import from `lib/installer.js`

**Inward dependencies (what installer.js depends on):**
- `lib/utils/fs-helpers.js` -- `exists()`, `writeFile()` (already imported, already used in the CLAUDE.md pattern)
- `lib/utils/logger.js` -- `logger.success()`, `logger.warning()` (already imported)
- No new imports needed

**Change propagation paths:**
- The change is **additive** -- a new code block inserted between the CLAUDE.md creation (line 569) and the "Done!" section (line 572)
- No existing function signatures change
- No existing return values change
- No new exports added
- Propagation: NONE -- change is fully contained

### M1: Uninstaller Verification

Grep analysis of `lib/uninstaller.js` (514 lines) confirms:
- Zero occurrences of "BACKLOG" anywhere in the file
- The uninstaller's file removal patterns do NOT match `BACKLOG.md`
- The `frameworkFiles` array (line 281) lists only `installed-files.json` and `monorepo.json`
- The `frameworkDirs` array (line 269) lists only `config`, `templates`, `scripts`
- The `--purge-all` flag removes only `.isdlc/` directory (line 262), not project root files
- **Verdict: FR-04 is satisfied with zero changes to uninstaller.js**

---

## Entry Points

### M2: Existing Entry Points

| Entry Point | Type | Relevance |
|------------|------|-----------|
| `bin/isdlc.js init` | CLI command | Primary trigger -- calls `install()` |
| `lib/cli.js` init handler | Code path | Routes CLI args to `install(projectRoot, options)` |
| `lib/installer.js install()` | Function | Single function to modify |

### M2: New Entry Points Required

None. All work fits within the existing `install()` function.

### M2: Implementation Chain

```
bin/isdlc.js init --force
  -> lib/cli.js handleInit()
    -> lib/installer.js install(projectRoot, { force: true, dryRun: false })
      -> [existing Step 6: docs setup]
      -> [NEW: Create BACKLOG.md after CLAUDE.md block, before "Done!" section]
        -> exists(backlogPath)            -- check if already exists (FR-02)
        -> if (!dryRun) writeFile(...)    -- respect dry-run (FR-03)
        -> logger.success/warning(...)    -- log result (AC-07, AC-09)
      -> [existing: "Done!" section]
```

### M2: Recommended Implementation Order

1. **Add BACKLOG.md content generator** -- a small helper function `generateBacklogMd()` that returns the template string matching `CLAUDE.md.template` convention (## Open / ## Completed headers with preamble)
2. **Add BACKLOG.md creation block** in `install()` -- insert after the CLAUDE.md creation block (line 569), following the identical exists-check + dry-run + writeFile pattern
3. **Add installer tests** -- 3 new describe blocks in `installer.test.js`:
   - BACKLOG.md is created with correct headers (AC-01 through AC-05)
   - BACKLOG.md is skipped if pre-existing (AC-06, AC-07)
   - BACKLOG.md respects --dry-run (AC-08, AC-09)
4. **Add uninstaller verification tests** -- confirm BACKLOG.md survives uninstall and purge-all (AC-10 through AC-12)

---

## Risk Assessment

### M3: Test Coverage Analysis

| File | Current Tests | Coverage | Risk |
|------|--------------|----------|------|
| `lib/installer.js` | 41 passing (16 suites) | HIGH -- covers dirs, state, settings, dry-run, merge, reinstall, docs, CLAUDE.md | LOW |
| `lib/installer.test.js` | Self (test file) | N/A | LOW |
| `lib/uninstaller.js` | 19 passing (9 suites) | MEDIUM -- covers detect, manifest, remove, preserve, purge | LOW |
| `lib/utils/fs-helpers.js` | 33 passing | HIGH | LOW |

**Coverage gaps relevant to this feature:**
- No existing test for BACKLOG.md creation (expected -- feature does not exist yet)
- No existing test for uninstaller ignoring BACKLOG.md (needs verification test)
- The CLAUDE.md creation pattern at line 557-569 has a test ("CLAUDE.md created if missing") -- this is the exact pattern to replicate

### M3: Complexity Hotspots

| Area | Complexity | Risk |
|------|-----------|------|
| `install()` function | MEDIUM (637 lines, many steps) | LOW -- insertion point is clear, pattern is established |
| BACKLOG.md content generation | LOW | LOW -- static template string |
| exists() + writeFile() pattern | LOW | LOW -- identical to CLAUDE.md pattern already proven |
| Uninstaller | NONE | LOW -- no changes required |

### M3: Technical Debt Markers

- The `install()` function is long (637 lines) but well-structured with clear step comments
- The step numbering (`1/7` through `7/7`) will NOT change -- BACKLOG.md creation fits within Step 6 or between Step 6 and Step 7
- No circular dependencies or tight coupling

### M3: Risk Recommendations per Acceptance Criterion

| AC | Risk | Recommendation |
|----|------|---------------|
| AC-01 (file created) | LOW | Follow CLAUDE.md pattern exactly |
| AC-02 (## Open header) | LOW | Hard-coded in template string |
| AC-03 (## Completed header) | LOW | Hard-coded in template string |
| AC-04 (preamble) | LOW | Match existing BACKLOG.md style |
| AC-05 (## Open before ## Completed) | LOW | Template string ordering |
| AC-06 (skip if exists) | LOW | `exists()` check -- identical to CLAUDE.md pattern |
| AC-07 (log on skip) | LOW | `logger.warning()` call |
| AC-08 (dry-run no write) | LOW | `if (!dryRun)` guard -- identical to CLAUDE.md pattern |
| AC-09 (dry-run log) | LOW | `logger.success()` outside guard |
| AC-10 (not in uninstaller paths) | NONE | Already verified clean |
| AC-11 (survives purge-all) | NONE | purge-all only removes .isdlc/, not project root files |
| AC-12 (no uninstaller references) | NONE | Grep confirms 0 occurrences |

### M3: Overall Risk Summary

**Overall Risk: LOW**

This feature has ideal characteristics for low-risk implementation:
- Follows an established, proven pattern (CLAUDE.md creation)
- Uses only already-imported utilities (exists, writeFile, logger)
- No new dependencies
- No API changes
- No schema changes
- The uninstaller requires zero modifications
- Comprehensive existing test infrastructure to extend

---

## Implementation Recommendations

Based on the impact analysis:

1. **Suggested Order**:
   - Write `generateBacklogMd()` helper function
   - Add creation block after CLAUDE.md block in `install()`
   - Add installer tests for creation, skip-if-exists, dry-run
   - Add uninstaller verification test for BACKLOG.md preservation

2. **High-Risk Areas**: None identified. All areas are low-risk.

3. **Dependencies to Resolve**: None. All required utilities are already imported.

4. **Pattern to Follow**: Lines 557-569 of `lib/installer.js` (CLAUDE.md creation block):
   ```javascript
   const claudeMdPath = path.join(projectRoot, 'CLAUDE.md');
   if (!(await exists(claudeMdPath))) {
     if (!dryRun) {
       // ... create file
     }
     logger.warning('CLAUDE.md was missing - created from template in project root');
   }
   ```
   Replicate this exact pattern for BACKLOG.md, with appropriate messaging.

5. **Insertion Point**: After line 569 (CLAUDE.md creation), before line 572 ("Done!" section). This matches NFR-02 (placement consistency).

---

## Impact Analysis Metadata

```json
{
  "analysis_completed_at": "2026-02-14T17:38:00.000Z",
  "sub_agents": ["M1-impact-analyzer", "M2-entry-point-finder", "M3-risk-assessor"],
  "requirements_document": "docs/requirements/REQ-0014-backlog-scaffolding/requirements-spec.md",
  "quick_scan_used": "Phase 00 quick-scan (inline, 3 files estimated)",
  "scope_change_from_original": "refined",
  "requirements_keywords": ["BACKLOG", "installer", "uninstaller", "dry-run", "skip-if-exists", "preamble", "format convention"],
  "blast_radius": "low",
  "risk_level": "low",
  "files_directly_affected": 2,
  "files_verified_clean": 1,
  "files_reference_only": 1,
  "modules_affected": 1,
  "existing_test_count_installer": 41,
  "existing_test_count_uninstaller": 19,
  "new_tests_estimated": 12
}
```
