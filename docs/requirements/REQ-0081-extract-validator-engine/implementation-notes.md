# Implementation Notes: Phase 2 Batch 2

## REQ-0081, REQ-0082, REQ-0083, REQ-0125

### Summary

Four independent core extractions completed as a single batch, following the proven Batch 1 pattern (Extract -> ESM core -> CJS bridge -> regression).

### Items Completed

**ITEM 1 -- ValidatorEngine (REQ-0081)**
- Extracted gate-logic.cjs -> `src/core/validators/gate-logic.js`
- Extracted profile-loader.cjs -> `src/core/validators/profile-loader.js`
- Extracted gate-requirements-injector.cjs -> `src/core/validators/gate-requirements.js`
- CJS bridge: `src/core/bridge/validators.cjs`

**ITEM 2 -- WorkflowRegistry (REQ-0082)**
- Extracted workflow-loader.cjs -> `src/core/workflow/registry.js`
- Phase constants -> `src/core/workflow/constants.js` (re-exports from config/phase-ids.js)
- CJS bridge: `src/core/bridge/workflow.cjs`

**ITEM 3 -- BacklogService + ItemStateService (REQ-0083)**
- Extracted three-verb-utils.cjs into 6 focused ESM modules:
  - `src/core/backlog/slug.js` -- generateSlug
  - `src/core/backlog/source-detection.js` -- detectSource
  - `src/core/backlog/item-state.js` -- readMetaJson, writeMetaJson, deriveAnalysisStatus, deriveBacklogMarker
  - `src/core/backlog/backlog-ops.js` -- parseBacklogLine, updateBacklogMarker, appendToBacklog
  - `src/core/backlog/item-resolution.js` -- resolveItem, findBacklogItemByNumber, findByExternalRef, searchBacklogTitles, findDirForDescription
  - `src/core/backlog/github.js` -- checkGhAvailability, searchGitHubIssues, createGitHubIssue
- CJS bridge: `src/core/bridge/backlog.cjs`

**ITEM 4 -- Gate Profiles + Schemas (REQ-0125)**
- Copied 3 profile JSONs to `src/core/config/profiles/`
- Copied 8 schema JSONs to `src/core/config/schemas/`
- New `src/core/config/phase-ids.js` -- canonical phase constants
- New `src/core/config/index.js` -- loadCoreProfile, loadCoreSchema, listCoreProfiles, listCoreSchemas

### Architecture Pattern

Same proven Batch 1 pattern:
1. ESM core modules in `src/core/` are the canonical implementation
2. CJS bridges in `src/core/bridge/` provide async import wrappers with inline sync fallbacks
3. Original CJS files in `src/claude/hooks/lib/` remain unchanged (backward compat)
4. Original CJS files continue to work with their inline code + common.cjs helpers
5. New ESM consumers use the core modules directly

### Test Results

- **132 new unit tests** across 10 test files
- **286 total core tests** (154 existing + 132 new), all passing
- **0 regressions**: hooks tests (4081 pass, 262 pre-existing fail), npm test (1582 pass, 3 pre-existing fail)
- 2 TDD iterations (1 test fix for artifact path behavior)

### Key Decisions

1. **Decomposed three-verb-utils.cjs** (1417 lines) into 6 focused modules by concern: slug, source detection, item state, backlog operations, item resolution, GitHub operations. This improves testability and makes each module independently importable.

2. **Phase constants centralized** in `src/core/config/phase-ids.js` and re-exported through `src/core/workflow/constants.js` for backward-compatible import paths.

3. **ESM top-level await** used in `src/core/workflow/registry.js` for js-yaml import, matching the original optional dependency pattern.

4. **Bridge sync fallbacks** provide inline implementations of the most critical functions (mergeRequirements, generateSlug, detectSource, normalizePhaseKey, resolveExtension, etc.) so CJS consumers work immediately without async preload.
