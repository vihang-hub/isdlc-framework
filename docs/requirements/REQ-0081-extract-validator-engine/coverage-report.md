# Coverage Report: Phase 2 Batch 2

**Date**: 2026-03-22
**Framework**: node:test (no built-in coverage instrumentation)

## Coverage Summary

No formal coverage tool configured (c8, istanbul, nyc). Coverage is verified structurally.

## Structural Coverage Analysis

### src/core/validators/ (REQ-0081)

| File | Exported Functions | Tested Functions | Coverage |
|------|-------------------|-----------------|----------|
| gate-logic.js | 10 | 10 | 100% |
| profile-loader.js | 12 | 12 | 100% |
| gate-requirements.js | 10 | 0 (tested via integration in gate-logic) | indirect |
| index.js | re-exports only | N/A | N/A |

**gate-logic.js tested functions**: mergeRequirements, isGateAdvancementAttempt, checkTestIterationRequirement, checkConstitutionalRequirement, checkElicitationRequirement, checkAgentDelegationRequirement, resolveArtifactPaths, check, loadArtifactPaths, getArtifactPathsForPhase

**profile-loader.js tested functions**: levenshtein, findClosestMatch, getBuiltinProfilesDir, KNOWN_OVERRIDE_KEYS, loadAllProfiles, resolveProfileOverrides, validateProfile, healProfile, resolveProfile, matchProfileByTrigger, checkThresholdWarnings, getProjectProfilesDir

### src/core/workflow/ (REQ-0082)

| File | Exported Functions | Tested Functions | Coverage |
|------|-------------------|-----------------|----------|
| registry.js | 7 | 7 | 100% |
| constants.js | 6 (re-exports) | 6 | 100% |
| index.js | re-exports only | N/A | N/A |

**registry.js tested functions**: resolveExtension, validatePhaseOrdering, validateWorkflow, loadPhaseOrdering, buildShippedEntry, buildCustomEntry, loadWorkflows

**constants.js tested symbols**: KNOWN_PHASE_KEYS, PHASE_KEY_ALIASES, ANALYSIS_PHASES, IMPLEMENTATION_PHASES, PHASE_NAME_MAP, normalizePhaseKey

### src/core/backlog/ (REQ-0083)

| File | Exported Functions | Tested Functions | Coverage |
|------|-------------------|-----------------|----------|
| slug.js | 1 | 1 | 100% |
| source-detection.js | 1 | 0 (tested via characterization) | indirect |
| item-state.js | 4 | 4 | 100% |
| backlog-ops.js | 3 | 3 | 100% |
| item-resolution.js | 5 | 5 | 100% |
| github.js | 3 | 0 (requires gh CLI) | excluded |
| index.js | re-exports only | N/A | N/A |

### src/core/config/ (REQ-0125)

| File | Exported Functions | Tested Functions | Coverage |
|------|-------------------|-----------------|----------|
| phase-ids.js | 6 | 6 | 100% |
| index.js | 4 + re-exports | 4 | 100% |

**Tested functions**: loadCoreProfile, loadCoreSchema, listCoreProfiles, listCoreSchemas

## Test File Inventory (132 new tests)

| Test File | Tests |
|-----------|-------|
| tests/core/validators/gate-logic.test.js | 22 |
| tests/core/validators/profile-loader.test.js | 12 |
| tests/core/workflow/registry.test.js | 20 |
| tests/core/workflow/constants.test.js | 12 |
| tests/core/backlog/slug.test.js | 7 |
| tests/core/backlog/item-state.test.js | 16 |
| tests/core/backlog/backlog-ops.test.js | 8 |
| tests/core/backlog/item-resolution.test.js | 13 |
| tests/core/config/profiles.test.js | 7 |
| tests/core/config/schemas.test.js | 15 |
| **Total** | **132** |
