# Code Review Report: Phase 2 Batch 2

**Phase**: 08-code-review
**Date**: 2026-03-22
**Reviewer**: Quality Loop Engineer (automated)
**Verdict**: APPROVED
**Files Reviewed**: 25 (17 source + 3 bridges + 3 index + 2 existing)

## Executive Summary

Phase 2 Batch 2 extracts 4 independent module groups from CJS hook files into clean ESM modules under `src/core/`. The extraction follows the proven Batch 1 pattern: ESM core modules with CJS bridge wrappers. Code quality is high, architecture is consistent, and all tests pass with zero regressions.

**0 blocking findings. 0 critical findings. 2 advisory notes.**

## Review Scope

### Files Reviewed

**src/core/validators/** (REQ-0081)
- gate-logic.js (394 lines) -- Gate validation logic
- profile-loader.js (369 lines) -- Profile discovery, validation, resolution
- gate-requirements.js (281 lines) -- Gate requirements block formatting
- index.js (51 lines) -- Re-exports

**src/core/workflow/** (REQ-0082)
- registry.js (385 lines) -- Workflow discovery, validation, merging
- constants.js (19 lines) -- Re-exports from config/phase-ids.js
- index.js (27 lines) -- Re-exports

**src/core/backlog/** (REQ-0083)
- slug.js (35 lines) -- Slug generation
- source-detection.js (49 lines) -- Source type detection
- item-state.js (117 lines) -- Meta.json read/write
- backlog-ops.js (105 lines) -- BACKLOG.md operations
- item-resolution.js (184 lines) -- Item resolution chain
- github.js (101 lines) -- GitHub CLI operations
- index.js (33 lines) -- Re-exports

**src/core/config/** (REQ-0125)
- phase-ids.js (103 lines) -- Phase constants
- index.js (86 lines) -- Profile/schema loaders

**src/core/bridge/** (CJS bridges)
- validators.cjs (211 lines)
- workflow.cjs (225 lines)
- backlog.cjs (232 lines)

## Correctness Review

### 1. Gate Logic Extraction (gate-logic.js)

**PASS** -- All 10 exported functions faithfully reproduce the original CJS logic from `src/claude/hooks/lib/gate-logic.cjs`. Key observations:

- `mergeRequirements()` uses deep clone via JSON.parse/stringify, consistent with original
- `isGateAdvancementAttempt()` preserves the exact keyword lists and tool name checks
- `check()` orchestrates all sub-checks in the same order as the original
- Dependency injection pattern preserved (helpers parameter for testability)
- Profile merge layer correctly integrates with `resolveProfileOverrides`

### 2. Profile Loader Extraction (profile-loader.js)

**PASS** -- Comprehensive extraction of profile management. Key observations:

- Three-tier discovery (builtin > project > personal) preserved
- `getBuiltinProfilesDir()` correctly resolves to `src/core/config/profiles/` first, falling back to hooks path
- `validateProfile()` preserves typo detection via Levenshtein distance
- `healProfile()` write-back logic is correct
- `resolveProfileOverrides()` correctly merges global + phase-specific overrides
- `checkThresholdWarnings()` coverage threshold validation handles both number and tiered-object formats

### 3. Gate Requirements Extraction (gate-requirements.js)

**PASS** -- Formatting logic extracted cleanly. Key observations:

- `buildGateRequirementsBlock()` preserves the full pipeline: load requirements, load artifacts, parse constitution, load modifiers, format block
- `deepMerge()` here uses array concatenation (arrays merged, not replaced) -- differs from the `mergeRequirements` in gate-logic.js which replaces arrays. This is intentional and matches the original CJS behavior.
- Coverage threshold resolver uses inline fallback when common.cjs is unavailable
- All functions wrapped in try/catch with fail-open returns, matching the original design

### 4. Workflow Registry Extraction (registry.js)

**PASS** -- Clean extraction from `workflow-loader.cjs`. Key observations:

- `resolveExtension()` preserves fixed operation order: remove -> add -> reorder
- `validateWorkflow()` correctly validates name collisions, extends references, and custom phase agents
- `loadWorkflows()` preserves the shipped-first, custom-merge pattern
- `buildCustomEntry()` correctly handles both standalone and extending workflows
- Top-level `await import('js-yaml')` matches the original optional-require pattern

### 5. Backlog Module Decomposition (backlog/)

**PASS** -- Three-verb-utils.cjs (1417 lines) cleanly decomposed into 6 focused modules. Key observations:

- **slug.js**: Single-responsibility, correct regex chain (lowercase, strip specials, collapse hyphens, truncate)
- **source-detection.js**: Correctly detects GitHub (#N), Jira (KEY-N), and manual sources
- **item-state.js**: Legacy migration (phase_a_completed) preserved, all defaults applied correctly
- **backlog-ops.js**: MARKER_REGEX correctly handles the `[marker]` pattern; updateBacklogMarker preserves case-insensitive slug matching
- **item-resolution.js**: ADR-0015 priority chain preserved (exact slug > partial > item number > external ref > fuzzy title)
- **github.js**: Command injection sanitization covers the 4 critical shell metacharacters

### 6. Config Module (config/)

**PASS** -- Phase constants centralized and profiles/schemas relocated. Key observations:

- `KNOWN_PHASE_KEYS` frozen array matches the original in profile-loader.cjs exactly
- `PHASE_KEY_ALIASES` frozen object handles all legacy phase remappings
- `loadCoreProfile()` / `loadCoreSchema()` use safe path resolution relative to module directory
- All 3 profiles (rapid, standard, strict) and 8 schemas verified to exist

## Bridge Integrity Review

### Validators Bridge (validators.cjs)

**PASS** -- Bridge provides:
- Lazy async loaders with module caching
- Sync preload cache for post-initialization performance
- Inline sync fallback for `mergeRequirements` (always needed synchronously)
- Fail-open defaults for all functions before preload (return `true`/`allow`/empty)
- `preload()` loads all 3 modules in parallel via `Promise.all`
- All 18 functions exported match the ESM module signatures

### Workflow Bridge (workflow.cjs)

**PASS** -- Bridge provides:
- Complete inline sync fallbacks for all 7 registry functions plus `normalizePhaseKey`
- Fallback implementations match ESM originals exactly (verified by code comparison)
- `PHASE_KEY_ALIASES` duplicated in CJS for synchronous access (necessary)
- `preload()` loads registry + constants in parallel

### Backlog Bridge (backlog.cjs)

**PASS** -- Bridge provides:
- Lazy loaders for all 6 ESM submodules
- Inline sync fallbacks for: `generateSlug`, `detectSource`, `deriveAnalysisStatus`, `deriveBacklogMarker`, `parseBacklogLine`
- Functions requiring filesystem (readMetaJson, updateBacklogMarker, resolveItem) return safe defaults before preload
- `preload()` loads all 6 modules in parallel

## Bridge Completeness Matrix

| ESM Export | Validators Bridge | Workflow Bridge | Backlog Bridge |
|-----------|------------------|----------------|----------------|
| All gate-logic.js exports | 8/8 exported | -- | -- |
| All profile-loader.js exports | 7/7 exported | -- | -- |
| All gate-requirements.js exports | 4/4 exported | -- | -- |
| All registry.js exports | -- | 7/7 exported | -- |
| normalizePhaseKey | -- | 1/1 exported | -- |
| All backlog submodule exports | -- | -- | 16/16 exported |

## Advisory Notes

### NOTE-1: Duplicate deepMerge implementations

There are two `deepMerge` functions with subtly different array behavior:
- `gate-logic.js::mergeRequirements()` -- replaces arrays
- `gate-requirements.js::deepMerge()` -- concatenates arrays

Both match their respective originals. This is intentional (different contexts require different merge strategies). Documenting for awareness.

### NOTE-2: No formal coverage tool

The project lacks a code coverage instrumentation tool (c8, istanbul). Adding one would provide quantitative coverage metrics. This is pre-existing and not a Batch 2 issue.

## Constitutional Compliance

| Article | Status | Notes |
|---------|--------|-------|
| II (Test-First) | COMPLIANT | 132 tests written, all passing |
| III (Architectural Integrity) | COMPLIANT | Follows established ESM core + CJS bridge pattern |
| V (Security by Design) | COMPLIANT | Input sanitization, fail-open, no secrets |
| VI (Code Quality) | COMPLIANT | JSDoc, consistent style, single-responsibility modules |
| VII (Documentation) | COMPLIANT | Module headers, implementation-notes.md |
| IX (Traceability) | COMPLIANT | REQ annotations in all files |
| XI (Integration Testing) | COMPLIANT | Regression tests confirm no breakage |

## Verdict

**APPROVED** -- Phase 2 Batch 2 extraction is correct, complete, well-tested, and follows established architectural patterns. No blocking findings. Ready for workflow finalization.
