# Test Strategy: Codex Provider Adapter (Batch)

**Items**: REQ-0114, REQ-0115, REQ-0116, REQ-0117
**Phase**: 05-test-strategy | **Date**: 2026-03-22

---

## 1. Test Infrastructure

| Aspect | Decision |
|--------|----------|
| Framework | `node:test` (project standard) |
| Assertions | `node:assert/strict` |
| Test runner | `npm run test:providers` (`node --test tests/providers/**/*.test.js`) |
| Helpers | `lib/utils/test-helpers.js` — `createTempDir`, `cleanupTempDir`, `createProjectDir` |
| Mocking | `node:test` `mock` module for core model imports |
| File fixtures | Temp directories via `mkdtempSync` (same pattern as `tests/providers/claude/installer.test.js`) |

## 2. Test File Layout

```
tests/providers/codex/
  index.test.js          — barrel re-export verification (REQ-0114 FR-003)
  projection.test.js     — config, paths, projectInstructions (REQ-0114 FR-001/002, REQ-0116)
  installer.test.js      — install/update/uninstall/doctor (REQ-0115)
  governance.test.js     — governance model + validateCheckpoint (REQ-0117)
```

## 3. Test Inventory by Requirement

### 3.1 REQ-0114: Provider Adapter (index.test.js)

| Test ID | AC | Description | Type |
|---------|-----|-------------|------|
| IDX-01 | AC-003-01 | Re-exports getCodexConfig from projection | Positive |
| IDX-02 | AC-003-01 | Re-exports getProjectionPaths from projection | Positive |
| IDX-03 | AC-003-02 | Re-exports installCodex, updateCodex, uninstallCodex, doctorCodex | Positive |
| IDX-04 | AC-003-03 | Re-exports getGovernanceModel, validateCheckpoint | Positive |
| IDX-05 | AC-003-01 | All exports are functions | Positive |

### 3.2 REQ-0114 + REQ-0116: Projection (projection.test.js)

| Test ID | AC | Description | Type |
|---------|-----|-------------|------|
| PRJ-01 | AC-001-01 | getCodexConfig returns { provider, frameworkDir, instructionFormat } | Positive |
| PRJ-02 | AC-001-02 | Config object is frozen | Positive |
| PRJ-03 | AC-001-01 | provider field is 'codex' | Positive |
| PRJ-04 | AC-002-01 | getProjectionPaths returns frozen paths object | Positive |
| PRJ-05 | AC-002-02 | All projection paths are relative (no leading /) | Positive |
| PRJ-06 | AC-002-01 | Paths include instructions, teamSpec, contentModel, skillManifest, providerConfig | Positive |
| PRJ-07 | 116/AC-001-01 | projectInstructions returns { content, metadata } | Positive |
| PRJ-08 | 116/AC-001-03 | metadata contains phase, agent, skills_injected, team_type | Positive |
| PRJ-09 | 116/AC-003-01 | content is a non-empty markdown string | Positive |
| PRJ-10 | 116/AC-005-01 | Fail-open: missing team spec produces minimal instruction | Negative |
| PRJ-11 | 116/AC-005-01 | Fail-open: missing agent classification still returns content | Negative |
| PRJ-12 | 116/AC-005-02 | Fail-open: warnings reported in metadata | Negative |
| PRJ-13 | 116/AC-003-02 | Content has markdown heading structure (# or ##) | Positive |
| PRJ-14 | 116/AC-004-04 | Skills are assembled into content when injection plan has skills | Positive |

### 3.3 REQ-0115: Installer (installer.test.js)

| Test ID | AC | Description | Type |
|---------|-----|-------------|------|
| INS-01 | AC-001-01 | installCodex creates .codex/ directory | Positive |
| INS-02 | AC-001-02 | installCodex creates config.json | Positive |
| INS-03 | AC-001-03 | installCodex generates instruction files | Positive |
| INS-04 | AC-001-04 | installCodex returns { success, filesCreated, errors } | Positive |
| INS-05 | AC-001-04 | installCodex success=true on clean install | Positive |
| INS-06 | AC-002-01 | updateCodex regenerates instruction files | Positive |
| INS-07 | AC-002-02 | updateCodex skips user-modified files | Positive |
| INS-08 | AC-002-03 | updateCodex returns { success, filesUpdated, filesSkipped, errors } | Positive |
| INS-09 | AC-003-01 | uninstallCodex removes generated files | Positive |
| INS-10 | AC-003-02 | uninstallCodex preserves user-created content | Positive |
| INS-11 | AC-003-03 | uninstallCodex returns { success, filesRemoved, filesPreserved, errors } | Positive |
| INS-12 | AC-004-01 | doctorCodex validates installation | Positive |
| INS-13 | AC-004-02 | doctorCodex checks: files exist, config valid, specs loadable | Positive |
| INS-14 | AC-004-03 | doctorCodex returns { healthy, checks } | Positive |
| INS-15 | AC-004-01 | doctorCodex reports unhealthy when .codex/ missing | Negative |
| INS-16 | AC-005-01 | API signature parity: same params and return shape as Claude | Contract |

### 3.4 REQ-0117: Governance (governance.test.js)

| Test ID | AC | Description | Type |
|---------|-----|-------------|------|
| GOV-01 | AC-001-01 | getGovernanceModel returns frozen config | Positive |
| GOV-02 | AC-001-02 | Each entry has checkpoint, claude_hook, codex_equivalent, status, mitigation | Positive |
| GOV-03 | AC-002-01 | phase-transition is enforceable | Positive |
| GOV-04 | AC-002-02 | state-schema is enforceable | Positive |
| GOV-05 | AC-002-03 | artifact-existence is enforceable | Positive |
| GOV-06 | AC-003-01 | delegation-gate is a gap | Positive |
| GOV-07 | AC-003-02 | branch-guard is a gap | Positive |
| GOV-08 | AC-003-03 | test-watcher is a gap | Positive |
| GOV-09 | AC-004-01 | getGovernanceModel has enforceable and gaps arrays | Positive |
| GOV-10 | AC-004-02 | enforceable array entries have status='enforceable' | Positive |
| GOV-11 | AC-004-03 | gaps array entries have status='gap' | Positive |
| GOV-12 | AC-005-01 | validateCheckpoint returns { valid, violations } | Positive |
| GOV-13 | AC-005-02 | validateCheckpoint runs enforceable checks | Positive |
| GOV-14 | AC-005-03 | validateCheckpoint reports violations on bad state | Negative |
| GOV-15 | AC-004-01 | Model has mitigation_strategy field | Positive |
| GOV-16 | AC-001-01 | All enforceable and gaps entries are individually frozen | Positive |

## 4. Mocking Strategy

Core model imports are mocked to isolate Codex adapter tests from core model data:

- **projection.test.js**: Mock `getTeamSpec`, `getTeamInstance`, `getTeamInstancesByPhase`, `getAgentClassification`, `computeInjectionPlan` to return controlled test data.
- **installer.test.js**: Uses temp directories (real filesystem). Does NOT mock fs operations. Mocks core model imports for content generation.
- **governance.test.js**: Mock `existsSync` for artifact checks. Provide synthetic state objects for `validateCheckpoint`.

## 5. Coverage Target

- **Line coverage**: >= 80% across all 4 files
- **Branch coverage**: >= 75% (fail-open paths, error handlers)
- **Function coverage**: 100% (all exported functions tested)

## 6. Test Execution

```bash
npm run test:providers    # runs all provider tests including codex
```

Expected: 835 existing + ~55 new tests = ~890 total passing.

## 7. Risk Areas

| Risk | Mitigation |
|------|-----------|
| Core model import failures at test time | Mock all core imports; test fail-open paths |
| File system race conditions in installer tests | Each test gets isolated temp directory |
| Frozen object mutation | Assert Object.isFrozen on all returned configs |
