# Implementation Notes: Unified SessionStart Cache (REQ-0001)

**Phase**: 06-Implementation
**Date**: 2026-02-23
**Traces to**: GH #91, #86, #89

---

## Summary

Implemented a unified SessionStart cache system that pre-loads all static framework
content into `.isdlc/session-cache.md` at session start, eliminating ~200+ redundant
file reads per workflow.

## Key Implementation Decisions

### 1. Cache Builder (`rebuildSessionCache()`)

Added to `src/claude/hooks/lib/common.cjs` (~180 lines). Builds 8 sections using
HTML comment delimiters (`<!-- SECTION: NAME -->` / `<!-- /SECTION: NAME -->`):

1. CONSTITUTION
2. WORKFLOW_CONFIG
3. ITERATION_REQUIREMENTS
4. ARTIFACT_PATHS
5. SKILLS_MANIFEST (filtered: no path_lookup/skill_paths)
6. SKILL_INDEX (per-agent pre-built blocks via getAgentSkillIndex)
7. EXTERNAL_SKILLS (with source field, truncated at 5K chars per skill)
8. ROUNDTABLE_CONTEXT (persona files + topic files)

Each section is wrapped in a try-catch via `buildSection()` -- if any section fails,
it is skipped gracefully and the cache file is still valid.

### 2. Skill Path Index (`_buildSkillPathIndex()`)

Replaced the removed `path_lookup` field in skills-manifest.json with a dynamic
file-system scan. Scans `src/claude/skills/` first (dev mode precedence), then
`.claude/skills/`. Caches per-process with mtime-based invalidation.

### 3. Source Mtime Hash (`_collectSourceMtimes()`)

Collects modification times from all static source files (config, skills, personas,
topics) and produces an 8-character hex hash for staleness detection. The hash is
included in the cache file header.

### 4. Self-Contained Hook (`inject-session-cache.cjs`)

25-line SessionStart hook with zero dependencies on common.cjs (per ADR-0027).
Only requires `fs` and `path`. Entire body in try-catch for fail-open behavior.

### 5. Hook Registration

Registered in `src/claude/settings.json` with two entries -- one for `startup`,
one for `resume`. Uses explicit matchers (NOT compact) per bug #15174 avoidance.
Timeout: 5000ms.

### 6. Manifest Cleanup (FR-008)

Removed `path_lookup` (~246 entries, ~250 lines) and `skill_paths` (~3 lines) from
`skills-manifest.json`. Refactored `getAgentSkillIndex()` to use `_buildSkillPathIndex()`
for direct skill ID to file path resolution.

### 7. Consumer Changes (FR-005, FR-006)

Updated `isdlc.md` to check session context before disk reads:
- SKILL INJECTION STEP A: session context lookup for SKILL_INDEX, fallback to Bash
- SKILL INJECTION STEP B: session context lookup for EXTERNAL_SKILLS, fallback to disk
- GATE REQUIREMENTS: session context lookup for ITERATION_REQUIREMENTS, ARTIFACT_PATHS, CONSTITUTION
- Roundtable dispatch: session context lookup for ROUNDTABLE_CONTEXT (personas + topics)

All consumers follow fail-open pattern: if cache absent, fall back to disk reads.

### 8. Cache Rebuild Triggers (FR-007)

Added `rebuildSessionCache()` calls to:
- `lib/installer.js` (after installation completes)
- `lib/updater.js` (after update completes)
- `src/claude/commands/isdlc.md` (after skill add/wire/remove)
- `src/claude/commands/discover.md` (after discover completes)
- `bin/rebuild-cache.js` (manual CLI escape hatch)

All triggers are fail-open -- cache rebuild failure does not block the parent operation.

## Files Changed

| File | Change | FR |
|------|--------|-----|
| `src/claude/hooks/lib/common.cjs` | Added _buildSkillPathIndex, _collectSourceMtimes, rebuildSessionCache | FR-001, FR-004 |
| `src/claude/hooks/inject-session-cache.cjs` | NEW - SessionStart hook | FR-002 |
| `src/claude/settings.json` | Added SessionStart hook registration | FR-003 |
| `bin/rebuild-cache.js` | NEW - CLI escape hatch | FR-004 |
| `src/claude/commands/isdlc.md` | Consumer changes, cache rebuild triggers | FR-005, FR-006, FR-007 |
| `src/claude/commands/discover.md` | Cache rebuild trigger | FR-007 |
| `lib/installer.js` | Cache rebuild trigger | FR-007 |
| `lib/updater.js` | Cache rebuild trigger | FR-007 |
| `src/claude/hooks/config/skills-manifest.json` | Removed path_lookup, skill_paths | FR-008 |

## Files Created (New)

| File | Purpose |
|------|---------|
| `src/claude/hooks/inject-session-cache.cjs` | SessionStart hook |
| `bin/rebuild-cache.js` | CLI cache rebuild tool |
| `src/claude/hooks/tests/test-session-cache-builder.test.cjs` | 44 unit tests |
| `src/claude/hooks/tests/test-inject-session-cache.test.cjs` | 7 unit tests |

## Test Results

- New tests: 51 passing (44 builder + 7 hook)
- Full hook suite: 2618 pass / 6 fail (all 6 pre-existing)
- Full ESM suite: 645 pass / 8 fail (all 8 pre-existing)
- Total: 3263 pass / 14 fail (0 regressions introduced)

## Test Files Modified (to accommodate FR-008 manifest cleanup)

| File | Change |
|------|--------|
| `test-fan-out-manifest.test.cjs` | TC-M04: check skill_lookup instead of path_lookup |
| `test-quality-loop.test.cjs` | Updated path_lookup test to use skill_lookup |
| `test-bug-0035-skill-index.test.cjs` | TC-B35-09: expect src/ precedence (dev mode) |
| `skill-injection.test.cjs` | TC-08.4: updated hook count from 28 to 29 |
| `test-req-0033-skill-injection-wiring.test.cjs` | TC-R33-08.1: updated assertion substring |
| `cross-validation-verifier.test.js` (ESM) | TC-07.3: removed skill_paths assertion |
