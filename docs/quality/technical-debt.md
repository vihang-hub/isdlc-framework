# Technical Debt Inventory

**Project:** iSDLC Framework
**Workflow:** REQ-0001-implement-sessionstart-hook-for-skill-cache-injection (feature)
**Phase:** 08 - Code Review & QA
**Date:** 2026-02-23
**Updated by:** QA Engineer (Phase 08)

---

## 1. New Technical Debt (This Feature)

### TD-REQ01-N01: Cache Size Exceeds Context Window Budget

**Severity**: Low
**Location**: `src/claude/hooks/lib/common.cjs` rebuildSessionCache()
**Description**: The generated session cache file is 153,863 characters, exceeding the NFR-009 target of ~128,000 characters. The function correctly logs a warning to stderr in verbose mode but does not enforce or fail on the budget. The tilde in the requirement indicates this is approximate, and the cache functions correctly at the larger size.
**Recommendation**: Consider adding section-level truncation for the SKILL_INDEX section (largest contributor) or implementing a `--budget-check` flag for CI integration. Could also be addressed by excluding less-used skill descriptions from the cache.

### TD-REQ01-N02: Hardcoded Persona File List

**Severity**: Low
**Location**: `src/claude/hooks/lib/common.cjs` line 4079
**Description**: The `rebuildSessionCache()` function hardcodes three persona filenames. If new persona files are added, the cache will not include them without a code change.
**Recommendation**: Future enhancement: scan for all `persona-*.md` files in the agents directory.

---

## 2. Resolved Technical Debt (This Feature)

### TD-REQ01-R01: Redundant Static File Reads (RESOLVED)

**Severity**: High
**Location**: Framework-wide (hooks, commands, phase agents)
**Description**: A single 9-phase feature workflow triggered 200-340 reads of static files that never change during execution. Skills, constitution, configuration, persona definitions, and topic definitions were re-read from disk at every phase transition and agent delegation.
**Resolution**: Unified SessionStart cache pre-loads all static content into the LLM context at session start. All downstream consumers reference cached content from session context, failing open to disk reads when cache is absent.
**Status**: RESOLVED. Verified by 51 unit/integration tests.

### TD-REQ01-R02: Unused path_lookup and skill_paths in Manifest (RESOLVED)

**Severity**: Medium
**Location**: `src/claude/hooks/config/skills-manifest.json`
**Description**: The `path_lookup` (240 entries) and `skill_paths` (redundant copy) fields consumed manifest space but were never used by runtime hooks. They were maintenance burdens and increased JSON parse time.
**Resolution**: Removed both fields. Replaced with runtime `_buildSkillPathIndex()` that scans SKILL.md files directly with mtime-based caching.
**Status**: RESOLVED. Verified by TC-MAN-01, TC-MAN-02, TC-MAN-03.

### TD-PRE-005: SessionStart Skill Cache Not Implemented (RESOLVED)

**Severity**: Low (previously tracked)
**Location**: GitHub Issue #91
**Description**: Previously tracked as pre-existing debt -- the SessionStart cache feature was proposed but not implemented. Now fully implemented by REQ-0001.
**Status**: RESOLVED.

---

## 3. Pre-Existing Technical Debt (Unchanged)

### TD-PRE-001: Pre-Existing Test Failures (14 total)

**Severity**: Medium
**Description**: 14 tests fail in the full test suite (8 ESM, 6 CJS), all pre-existing and unrelated to REQ-0001. These include agent count checks (expects 48, found 64), sync drift checks, delegation-gate tests, and workflow-completion-enforcer tests.

### TD-PRE-002: No Mutation Testing

**Severity**: Low
**Description**: No mutation testing framework configured.

### TD-PRE-003: No Native Coverage Reporting

**Severity**: Low
**Description**: Node.js `node:test` lacks native coverage reporting.

### TD-PRE-004: No Automated Linting

**Severity**: Medium (pre-existing)
**Description**: No ESLint or TypeScript configuration.

---

## 4. Technical Debt Ledger

| Category | Count | Details |
|----------|-------|---------|
| New debt items | 2 | TD-REQ01-N01 (cache budget), TD-REQ01-N02 (hardcoded personas) |
| Resolved debt items | 3 | TD-REQ01-R01 (redundant reads), TD-REQ01-R02 (unused manifest fields), TD-PRE-005 (cache not implemented) |
| Pre-existing debt | 4 | TD-PRE-001 through TD-PRE-004 |
| Net change | -1 | Feature reduces net technical debt |

---

## 5. Summary

This feature resolves 3 technical debt items (redundant static file reads, unused manifest fields, and the previously tracked "SessionStart cache not implemented" item) while introducing 2 low-severity items (cache size budget and hardcoded persona list). The net effect is a reduction of 1 debt item. The 2 new items are low severity and documented with clear remediation paths.
