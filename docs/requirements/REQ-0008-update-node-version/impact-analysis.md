# Impact Analysis: REQ-0008 -- Update Node Version

**Generated**: 2026-02-10
**Feature**: Drop Node 18 (EOL), set Node 20 as minimum (>=20.0.0), update CI matrix to [20, 22, 24]
**Based On**: Phase 01 Requirements (finalized -- 7 requirements, 21 AC)
**Phase**: 02-impact-analysis

---

## Scope Comparison

| Aspect | Original (Workflow Init) | Clarified (Phase 01) |
|--------|--------------------------|----------------------|
| Description | Update Node version -- drop Node 18, set 20 as min, add Node 24 to CI | 7 functional requirements covering package.json, 2 CI workflows, constitution amendment, README, state.json, API validation |
| Keywords | node, version, CI, matrix | node, version, CI, matrix, constitution, amendment, engines, EOL, LTS |
| Estimated Files | 6 (package.json, ci.yml, publish.yml, constitution.md, README.md, state.json) | 8+ (adds package-lock.json, test-strategy template, discovery report) |
| Scope Change | -- | NONE (faithful expansion of original description) |

---

## Executive Summary

This is a **configuration-only change** with no runtime code modifications. The feature involves updating version strings and CI matrix values across 8-10 files. No JavaScript source code (hooks, lib, CLI) needs to change -- only configuration files, documentation, and CI workflow YAML. The codebase uses only standard Node.js APIs (`fs`, `path`, `os`, `child_process`, `http/https`) via CommonJS `require()` in hooks and ESM `import` in lib -- none of which have breaking changes between Node 18 and Node 20/22/24. The `node:test` built-in test runner used extensively is stable across all target versions.

**Blast Radius**: LOW (8-10 files, 0 modules, configuration-only)
**Risk Level**: LOW (no runtime code changes, well-isolated file edits)
**Affected Files**: 8-10 files across config, CI, docs
**Affected Modules**: 0 runtime modules (configuration-only)

---

## Impact Analysis (M1)

### Files Directly Affected by Each Requirement

| Requirement | File | Change Type | Change Description |
|-------------|------|-------------|-------------------|
| REQ-001 | `package.json` | MODIFY | `engines.node`: `">=18.0.0"` -> `">=20.0.0"` |
| REQ-001 | `package-lock.json` | AUTO-UPDATE | Regenerated from package.json change |
| REQ-002 | `.github/workflows/ci.yml` | MODIFY | Test matrix: `[18, 20, 22]` -> `[20, 22, 24]`; lint job Node 20->22; integration job Node 20->22 |
| REQ-003 | `.github/workflows/publish.yml` | MODIFY | Test matrix: `[18, 20, 22]` -> `[20, 22, 24]`; publish-npm Node 20->22; publish-github Node 20->22 |
| REQ-004 | `docs/isdlc/constitution.md` | MODIFY | Article XII req 4: "Node 18, 20, 22" -> "Node 20, 22, 24"; version bump 1.1.0->1.2.0; amendment log entry |
| REQ-005 | `README.md` | MODIFY | Line 45: "18+" -> "20+"; Line 270: "Node.js 18+" -> "Node.js 20+" |
| REQ-006 | `.isdlc/state.json` | MODIFY | `project.tech_stack.runtime`: `"node-18+"` -> `"node-20+"` |
| REQ-007 | (validation only) | NONE | Verify no Node 18-only APIs in use |

### Secondary Files (Version References Found)

| File | Current Reference | Change Needed |
|------|-------------------|---------------|
| `docs/project-discovery-report.md` | `">= 18.0.0"`, `"Tested on 18, 20, 22 in CI"` | Update to `">= 20.0.0"`, `"Tested on 20, 22, 24 in CI"` |
| `src/isdlc/templates/testing/test-strategy.md` | `"{18+}"` (template placeholder) | Update to `"{20+}"` |

### Outward Dependencies (What Depends on Changed Files)

| Changed File | Dependents | Impact |
|-------------|------------|--------|
| `package.json` | `npm ci` in all CI jobs, `package-lock.json` | engines field affects npm install warnings -- no code impact |
| `.github/workflows/ci.yml` | GitHub Actions runners | Only CI execution environment changes |
| `.github/workflows/publish.yml` | npm/GitHub Packages publish pipeline | Only CI execution environment changes |
| `docs/isdlc/constitution.md` | All 48 agents (read at phase start) | Agents will see updated Article XII -- no behavioral change |
| `README.md` | End users reading docs | Informational only |
| `.isdlc/state.json` | All hooks read state.json | `tech_stack.runtime` is informational metadata, not used in hook logic |

### Inward Dependencies (What Changed Files Depend On)

| Changed File | Dependencies | Impact |
|-------------|-------------|--------|
| `package.json` | None (root config) | Self-contained |
| CI workflows | `actions/checkout@v4`, `actions/setup-node@v4` | setup-node@v4 supports Node 24 -- verified |
| `constitution.md` | None (standalone doc) | Self-contained |

### Change Propagation

The change propagation is **minimal and contained**:
- `package.json` -> `package-lock.json` (auto-regenerated)
- All other changes are leaf-node edits with no cascading effects
- No import/require chains are affected
- No runtime behavior changes

---

## Entry Points (M2)

### Existing Entry Points Relevant to This Feature

| Entry Point | Type | Relevance | Change Needed |
|-------------|------|-----------|---------------|
| `package.json` `engines` field | Config | npm version gate for `npm install` | Direct edit: `>=18.0.0` -> `>=20.0.0` |
| `.github/workflows/ci.yml` `test.strategy.matrix.node` | CI Config | Controls which Node versions CI tests against | Direct edit: `[18, 20, 22]` -> `[20, 22, 24]` |
| `.github/workflows/ci.yml` `lint.steps[].with.node-version` | CI Config | Lint job Node version | Direct edit: `'20'` -> `'22'` |
| `.github/workflows/ci.yml` `integration.steps[].with.node-version` | CI Config | Integration test Node version | Direct edit: `'20'` -> `'22'` |
| `.github/workflows/publish.yml` `test.strategy.matrix.node-version` | CI Config | Pre-publish test matrix | Direct edit: `[18, 20, 22]` -> `[20, 22, 24]` |
| `.github/workflows/publish.yml` `publish-npm.steps[].with.node-version` | CI Config | Publish job Node version | Direct edit: `'20'` -> `'22'` |
| `.github/workflows/publish.yml` `publish-github.steps[].with.node-version` | CI Config | GitHub Packages publish Node version | Direct edit: `'20'` -> `'22'` |

### New Entry Points

None. This feature creates no new files, endpoints, or code paths.

### Implementation Chain

This is a flat, non-chained change set. Each file edit is independent:

```
package.json           (standalone edit -- no dependencies)
ci.yml                 (standalone edit -- no dependencies)
publish.yml            (standalone edit -- no dependencies)
constitution.md        (standalone edit -- version bump + amendment log)
README.md              (standalone edit -- text replacement)
state.json             (standalone edit -- metadata field)
project-discovery-report.md  (standalone edit -- text replacement)
test-strategy.md template    (standalone edit -- template placeholder)
```

### Recommended Implementation Order

1. **package.json** -- foundational version gate (REQ-001)
2. **.github/workflows/ci.yml** -- CI matrix update (REQ-002)
3. **.github/workflows/publish.yml** -- publish matrix update (REQ-003)
4. **docs/isdlc/constitution.md** -- Article XII amendment with version bump (REQ-004)
5. **README.md** -- user-facing documentation (REQ-005)
6. **.isdlc/state.json** -- internal state metadata (REQ-006)
7. **Secondary files** -- discovery report, template (cleanup)
8. **Validation** -- run full test suite on Node 20, 22, 24 (REQ-007)

Rationale: Start with the normative files (package.json, CI), then documentation, then metadata. Validation is last because it verifies the entire change set.

---

## Risk Assessment (M3)

### Node 18 -> Node 20 API Compatibility Analysis

**FINDING: ZERO API RISK**

The codebase was scanned for Node.js APIs that changed between versions 18 and 20/22/24:

| API Pattern | Found in Codebase | Risk |
|-------------|-------------------|------|
| `structuredClone()` | Not used | N/A |
| `Array.findLast()` / `Array.findLastIndex()` | Not used | N/A |
| `Error.cause` | Not used | N/A |
| `AbortSignal.timeout()` | Not used | N/A |
| `fetch()` (global) | Not used (hooks use `http`/`https` modules) | N/A |
| `navigator` global | Not used | N/A |
| `process.version` checks | Not used in any source files | N/A |
| `node:test` runner | Used extensively (17 ESM + 28 CJS test files) | NONE -- stable across Node 20-24 |
| `node:test` `mock` | Used in `lib/utils/test-helpers.js` | NONE -- available since Node 18.13 |
| `require()` in CJS hooks | All hooks use `require('fs')`, `require('path')`, etc. | NONE -- stable CommonJS APIs |
| ESM `import` in lib | Standard ES module imports | NONE -- stable across all target versions |

**All Node.js APIs used in this codebase are core stable APIs that have been unchanged since well before Node 18.** No migration risk.

### Test Coverage in Affected Areas

| Affected File | Direct Tests | Coverage Status | Risk |
|---------------|-------------|-----------------|------|
| `package.json` | `lib/cli.test.js` (version check), `lib/prompt-format.test.js` (dep count) | PARTIAL -- no engines field test | LOW |
| `.github/workflows/ci.yml` | No direct test | NONE (CI config -- tested by CI execution itself) | LOW |
| `.github/workflows/publish.yml` | No direct test | NONE (CI config -- tested by CI execution itself) | LOW |
| `docs/isdlc/constitution.md` | `src/claude/hooks/tests/test-constitution-validator.test.cjs` (26 test calls) | GOOD -- validates constitution structure | LOW |
| `README.md` | `lib/prompt-format.test.js` (TC-E09 checks agent count) | PARTIAL | LOW |
| `.isdlc/state.json` | Multiple hook tests validate state structure | GOOD | LOW |

### Complexity Analysis

| File | Complexity | Change Complexity | Risk |
|------|-----------|-------------------|------|
| `package.json` | LOW (JSON key-value) | Trivial string replacement | NEGLIGIBLE |
| `ci.yml` | MEDIUM (YAML matrix, multiple jobs) | 3 edits in same file (matrix + 2 node-version) | LOW |
| `publish.yml` | MEDIUM (YAML matrix, multiple jobs) | 3 edits in same file (matrix + 2 node-version) | LOW |
| `constitution.md` | LOW (Markdown text) | String replacement + amendment process | LOW |
| `README.md` | LOW (Markdown text) | 2 string replacements | NEGLIGIBLE |
| `state.json` | LOW (JSON key-value) | Single field update | NEGLIGIBLE |

### Technical Debt in Affected Areas

| Area | Debt Item | Impact on This Feature |
|------|-----------|----------------------|
| `constitution.md` Article XIII req 5 | States "Never add `.cjs` extensions to hooks" but all hooks ARE `.cjs` | NOT RELATED to this feature -- existing discrepancy |
| `ci.yml` lint job | Uses `echo 'No linter configured'` | NOT RELATED -- lint job runs but does nothing |
| `package-lock.json` | Will need regeneration | MINOR -- standard npm behavior |

### Risk Zones

| Zone | Files | Risk Level | Recommendation |
|------|-------|------------|----------------|
| CI Matrix YAML | `ci.yml`, `publish.yml` | LOW | Verify YAML syntax after edit (indentation matters) |
| Constitution Amendment | `constitution.md` | LOW | Follow amendment process: bump version, add log entry |
| Test Suite Compatibility | All test files | LOW | Run `npm run test:all` on Node 20, 22, 24 to verify |

### Recommended Pre-Implementation Actions

1. **Run full test suite on Node 20** -- Verify baseline (1000+ tests should all pass)
2. **Run full test suite on Node 24** -- Verify forward compatibility (developer already runs Node 24 locally)
3. **No pre-migration test additions needed** -- existing test coverage is adequate for a configuration-only change

---

## Implementation Recommendations

Based on the impact analysis:

1. **Suggested Order**: package.json -> ci.yml -> publish.yml -> constitution.md -> README.md -> state.json -> secondary files -> validation
2. **High-Risk Areas**: NONE identified. All changes are string/number replacements in configuration files.
3. **Dependencies to Resolve**: NONE. All edits are independent leaf-node changes.
4. **Pre-Implementation Verification**: Run `npm run test:all` to confirm current test suite passes (baseline).
5. **Post-Implementation Verification**: Run `npm run test:all` on Node 20, 22, and 24 to confirm zero regressions.
6. **Constitution Process**: Article XII amendment requires version bump (1.1.0 -> 1.2.0) and amendment log entry.

---

## Impact Analysis Metadata

```json
{
  "analysis_completed_at": "2026-02-10T23:45:00.000Z",
  "sub_agents": ["M1-impact-analyzer", "M2-entry-point-finder", "M3-risk-assessor"],
  "requirements_document": "docs/requirements/REQ-0008-update-node-version/requirements-spec.md",
  "quick_scan_used": null,
  "scope_change_from_original": "none",
  "requirements_keywords": ["node", "version", "CI", "matrix", "engines", "constitution", "amendment", "EOL", "LTS", "Node 20", "Node 22", "Node 24"],
  "files_analyzed": {
    "directly_affected": 8,
    "secondary": 2,
    "total_blast_radius": 10
  },
  "api_compatibility": {
    "breaking_apis_found": 0,
    "deprecated_apis_found": 0,
    "node18_specific_patterns": 0
  },
  "test_suite": {
    "total_tests": "1000+",
    "esm_test_files": 17,
    "cjs_test_files": 28,
    "affected_file_coverage": "partial (CI configs have no direct tests, which is expected)"
  }
}
```
