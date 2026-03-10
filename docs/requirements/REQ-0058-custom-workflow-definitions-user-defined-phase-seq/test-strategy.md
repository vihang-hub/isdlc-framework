# Test Strategy: Custom Workflow Definitions

**Requirement ID:** REQ-0058
**Artifact Folder:** REQ-0058-custom-workflow-definitions-user-defined-phase-seq
**Phase:** 05-test-strategy
**Created:** 2026-03-10
**Status:** Complete

---

## 1. Existing Infrastructure

- **Framework:** `node:test` (Node.js built-in test runner)
- **Module System:** CJS (`.cjs` extension) -- matches hooks test pattern
- **Test Runner Command:** `node --test <glob>`
- **Existing Patterns:**
  - Hook tests: `src/claude/hooks/tests/*.test.cjs` (CJS, temp dir isolation)
  - Lib tests: `lib/**/*.test.js` (ESM, co-located)
- **Existing Utilities:** `src/claude/hooks/tests/hook-test-utils.cjs` (setupTestEnv, cleanupTestEnv, readState, writeState, prepareHook)
- **Modules Under Test:**
  - `src/isdlc/workflow-loader.cjs` (NEW -- CJS, core workflow discovery/merge/validation)
  - `src/isdlc/config/phase-ordering.json` (NEW -- canonical phase ordering ranks)
  - `src/antigravity/workflow-init.cjs` (MODIFY -- remove hardcoded constants, use workflow loader)
  - `src/isdlc/config/workflows.json` (MODIFY -- add intent/examples, feature-light)
  - `lib/installer.js` (MODIFY -- create .isdlc/workflows/)
  - `lib/updater.js` (MODIFY -- preserve .isdlc/workflows/)
  - `lib/uninstaller.js` (MODIFY -- leave .isdlc/workflows/)

### Strategy Adaptation

The `workflow-loader.cjs` module is a new CJS module at `src/isdlc/workflow-loader.cjs`. It will be tested using the CJS test pattern from existing hook tests. Tests will:

1. **USE** `node:test` with `describe`/`it`/`beforeEach`/`afterEach`
2. **USE** CJS test conventions (`.test.cjs` extension)
3. **FOLLOW** temp directory isolation: `fs.mkdtempSync` with `CLAUDE_PROJECT_DIR`
4. **COPY** workflow-loader.cjs and its dependencies to temp directory (Article XIII -- CJS outside package scope)
5. **CREATE** fixture YAML files for custom workflow testing
6. **REUSE** patterns from existing tests: fixture factories, JSON output parsing

### Test File Location

```
src/claude/hooks/tests/test-workflow-loader.test.cjs        # Unit tests (core loader)
src/claude/hooks/tests/test-workflow-loader-ext.test.cjs     # Extension/diff engine tests
src/claude/hooks/tests/test-workflow-init-loader.test.cjs    # Integration: workflow-init + loader
```

These co-locate with existing CJS hook tests and are covered by `npm run test:hooks`.

### Temp Directory Approach (Article XIII)

1. Each test creates a temp directory via `fs.mkdtempSync(path.join(os.tmpdir(), 'isdlc-wfloader-test-'))`
2. Copy `workflow-loader.cjs` and its dependency `common.cjs` to the temp directory
3. Create `src/isdlc/config/workflows.json` and `src/isdlc/config/phase-ordering.json` fixtures in temp
4. Create `.isdlc/workflows/` directory with YAML fixture files
5. `require()` the module from the temp path
6. Clean up in `afterEach`

---

## 2. Test Pyramid

```
         /\
        /  \       E2E Tests (0 tests, 0%)
       /    \      Not applicable -- LLM intent matching is non-deterministic
      /------\
     /        \    Integration Tests (18 tests, 22%)
    / Integr.  \   workflow-init.cjs via spawnSync, installer/updater/uninstaller
   /            \  scripts, prime-session WORKFLOW_REGISTRY section
  /--------------\
 /                \ Unit Tests (64 tests, 78%)
/    Unit Tests    \ loadWorkflows, resolveExtension, validatePhaseOrdering,
\__________________/ validateWorkflow, edge cases, error paths
```

**Total: 82 test cases**

---

## 3. Unit Tests -- workflow-loader.cjs

### 3.1 loadWorkflows() (12 tests)

| ID | Test Case | FR | AC | Priority |
|----|-----------|----|----|----------|
| U-001 | Returns shipped workflows when no .isdlc/workflows/ exists | FR-004 | AC-004-01 | P0 |
| U-002 | Returns shipped + custom when valid YAML files exist | FR-001 | AC-001-01 | P0 |
| U-003 | Skips malformed YAML files, returns per-file errors | FR-004 | AC-004-02 | P0 |
| U-004 | Rejects workflow missing `name` field | FR-004 | AC-004-03 | P0 |
| U-005 | Rejects workflow missing both `phases` and `extends` | FR-004 | AC-004-03 | P0 |
| U-006 | Rejects workflow with shipped name collision | FR-001 | AC-001-04 | P0 |
| U-007 | Accepts workflow with unique name and valid phases | FR-001 | AC-001-02 | P0 |
| U-008 | Validates custom phase agent file exists on disk | FR-001 | AC-001-03 | P1 |
| U-009 | Returns error for missing agent file | FR-004 | AC-004-04 | P1 |
| U-010 | Returns error for extends referencing non-existent base | FR-004 | AC-004-05 | P1 |
| U-011 | Handles empty .isdlc/workflows/ directory (no YAML files) | FR-004 | AC-004-01 | P1 |
| U-012 | Ignores non-YAML files in .isdlc/workflows/ | FR-004 | AC-004-01 | P2 |

### 3.2 resolveExtension() (18 tests)

| ID | Test Case | FR | AC | Priority |
|----|-----------|----|----|----------|
| U-013 | remove_phases removes a phase from base | FR-002 | AC-002-01 | P0 |
| U-014 | remove_phases removes multiple phases | FR-002 | AC-002-01 | P0 |
| U-015 | add_phases with `after` inserts at correct position | FR-002 | AC-002-02 | P0 |
| U-016 | add_phases with `before` inserts at correct position | FR-002 | AC-002-02 | P0 |
| U-017 | add_phases with custom phase includes agent path | FR-002 | AC-002-03 | P0 |
| U-018 | reorder moves a phase after a target | FR-002 | AC-002-04 | P0 |
| U-019 | Operations apply in order: remove → add → reorder | FR-002 | AC-002-05 | P0 |
| U-020 | Error when remove references non-existent phase | FR-002 | AC-002-05 | P1 |
| U-021 | Error when add references non-existent insertion point | FR-002 | AC-002-05 | P1 |
| U-022 | Error when reorder references non-existent phase | FR-002 | AC-002-05 | P1 |
| U-023 | Error when operations produce empty phase list | FR-002 | AC-002-06 | P0 |
| U-024 | add_phases at end (no before/after) appends | FR-002 | AC-002-02 | P1 |
| U-025 | Multiple add_phases in sequence maintain order | FR-002 | AC-002-02 | P1 |
| U-026 | remove then add same phase name repositions it | FR-002 | AC-002-05 | P2 |
| U-027 | Reorder with `before` target works correctly | FR-002 | AC-002-04 | P1 |
| U-028 | Feature workflow extending removes quick-scan correctly | FR-002 | AC-002-01 | P0 |
| U-029 | Multiple reorder operations in sequence | FR-002 | AC-002-04 | P2 |
| U-030 | Empty diff spec (no operations) returns base phases unchanged | FR-002 | AC-002-05 | P1 |

### 3.3 validatePhaseOrdering() (10 tests)

| ID | Test Case | FR | AC | Priority |
|----|-----------|----|----|----------|
| U-031 | No warnings for canonical order | FR-004 | - | P1 |
| U-032 | Warning when shipped phase A (higher rank) appears before B (lower rank) | FR-004 | - | P1 |
| U-033 | Custom phases are skipped in ordering checks | FR-004 | - | P0 |
| U-034 | Empty phase list returns no warnings | FR-004 | - | P2 |
| U-035 | Single phase returns no warnings | FR-004 | - | P2 |
| U-036 | Mixed custom and shipped phases validate only shipped pairs | FR-004 | - | P1 |
| U-037 | Phases with same rank (e.g., 02-impact-analysis, 02-tracing) produce no warning | FR-004 | - | P1 |
| U-038 | All shipped phases in reverse order produce N warnings | FR-004 | - | P2 |
| U-039 | Warning message includes phase names and expected order | FR-004 | - | P2 |
| U-040 | Unknown phase names (not in canonicalOrder) are treated as custom | FR-004 | - | P1 |

### 3.4 validateWorkflow() (14 tests)

| ID | Test Case | FR | AC | Priority |
|----|-----------|----|----|----------|
| U-041 | Valid standalone workflow passes validation | FR-004 | AC-004-01 | P0 |
| U-042 | Valid extending workflow passes validation | FR-002 | AC-002-01 | P0 |
| U-043 | Missing `name` field returns error | FR-004 | AC-004-03 | P0 |
| U-044 | Missing both `phases` and `extends` returns error | FR-004 | AC-004-03 | P0 |
| U-045 | Name collision with shipped workflow returns error | FR-001 | AC-001-04 | P0 |
| U-046 | Unknown phase (not shipped, no agent field) returns error | FR-004 | - | P1 |
| U-047 | Custom phase with agent field passes when file exists | FR-001 | AC-001-03 | P1 |
| U-048 | Custom phase with agent field fails when file missing | FR-004 | AC-004-04 | P1 |
| U-049 | Extends non-existent base returns error | FR-004 | AC-004-05 | P0 |
| U-050 | Intent field present and non-empty passes | FR-003 | AC-003-01 | P1 |
| U-051 | Empty intent field returns warning (not error) | FR-003 | - | P2 |
| U-052 | Examples field is optional -- absent is OK | FR-003 | - | P2 |
| U-053 | gate_mode defaults to "strict" when absent | FR-001 | AC-001-02 | P1 |
| U-054 | requires_branch defaults to false when absent | FR-001 | AC-001-02 | P1 |

### 3.5 Workflow Registry Entry Shape (10 tests)

| ID | Test Case | FR | AC | Priority |
|----|-----------|----|----|----------|
| U-055 | Shipped workflow entry has all required fields | FR-001 | AC-001-02 | P0 |
| U-056 | Custom standalone workflow entry has source="custom" | FR-001 | AC-001-02 | P0 |
| U-057 | Custom extending workflow has extends field set | FR-002 | - | P0 |
| U-058 | phase_agents populated for custom phases with agent field | FR-002 | AC-002-03 | P1 |
| U-059 | Merged registry contains both shipped and custom entries | FR-004 | AC-004-01 | P0 |
| U-060 | intent and examples fields present in shipped workflows | FR-003 | AC-003-03 | P1 |
| U-061 | file_path set for custom, null for shipped | FR-001 | - | P2 |
| U-062 | options field defaults to empty object | FR-001 | AC-001-02 | P2 |
| U-063 | gate_mode field preserved from YAML | FR-001 | AC-001-02 | P1 |
| U-064 | agent_modifiers preserved from source workflow | FR-001 | - | P2 |

---

## 4. Unit Tests -- Feature-Light Shipped Variant

| ID | Test Case | FR | AC | Priority |
|----|-----------|----|----|----------|
| U-065 | feature-light exists in shipped workflows | FR-005 | AC-005-01 | P0 |
| U-066 | feature-light extends feature workflow | FR-005 | AC-005-01 | P0 |
| U-067 | feature-light removes 03-architecture and 04-design | FR-005 | AC-005-01 | P0 |
| U-068 | feature-light resolved phases match expected sequence | FR-005 | AC-005-01 | P0 |

---

## 5. Integration Tests -- workflow-init.cjs

| ID | Test Case | FR | AC | Priority |
|----|-----------|----|----|----------|
| I-001 | workflow-init reads phases from workflow loader, not hardcoded constant | FR-005 | AC-005-02 | P0 |
| I-002 | workflow-init with --type feature-light uses loader-resolved phases | FR-005 | AC-005-02 | P0 |
| I-003 | workflow-init sets requires_branch from workflow registry | FR-001 | AC-001-02 | P0 |
| I-004 | workflow-init sets gate_mode from workflow registry | FR-001 | AC-001-02 | P1 |
| I-005 | workflow-init with custom workflow type resolves from merged registry | FR-001 | AC-001-01 | P0 |
| I-006 | workflow-init with unknown workflow type returns ERROR | FR-004 | - | P1 |
| I-007 | workflow-init stores phase_agents in active_workflow | FR-001 | - | P1 |
| I-008 | No --light flag logic in workflow-init.cjs (removed) | FR-005 | AC-005-02 | P0 |

### Test Pattern (spawnSync)

```javascript
const { spawnSync } = require('child_process');
const result = spawnSync('node', [
  path.join(tmpDir, 'workflow-init.cjs'),
  '--type', 'feature',
  '--description', 'Test feature'
], {
  cwd: tmpDir,
  env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
  encoding: 'utf8'
});
const output = JSON.parse(result.stdout);
assert.strictEqual(output.result, 'INITIALIZED');
```

---

## 6. Integration Tests -- Installer / Updater / Uninstaller

| ID | Test Case | FR | AC | Priority |
|----|-----------|----|----|----------|
| I-009 | installer.js creates .isdlc/workflows/ directory | FR-008 | AC-008-01 | P0 |
| I-010 | installer.js uses path.join for cross-platform compatibility | FR-008 | AC-008-04 | P1 |
| I-011 | updater.js preserves .isdlc/workflows/*.yaml files | FR-008 | AC-008-02 | P0 |
| I-012 | updater.js preserves nested workflow content | FR-008 | AC-008-02 | P1 |
| I-013 | uninstaller.js leaves .isdlc/workflows/ in place | FR-008 | AC-008-03 | P0 |

---

## 7. Integration Tests -- workflows.json Schema

| ID | Test Case | FR | AC | Priority |
|----|-----------|----|----|----------|
| I-014 | Each shipped workflow has intent field | FR-003 | AC-003-03 | P0 |
| I-015 | Each shipped workflow has examples array | FR-003 | AC-003-03 | P1 |
| I-016 | feature-light workflow present in workflows.json | FR-005 | AC-005-01 | P0 |
| I-017 | --supervised is a workflow-level option, not CLI flag | FR-005 | AC-005-03 | P1 |
| I-018 | All shipped workflow names are reserved (name collision test) | FR-001 | AC-001-04 | P1 |

---

## 8. Requirement Traceability Matrix

| FR | AC | Test IDs | Coverage |
|----|-----|----------|----------|
| FR-001 | AC-001-01 | U-002, U-007, I-005 | Full |
| FR-001 | AC-001-02 | U-007, U-053, U-054, U-055, U-056, U-063, I-003, I-004 | Full |
| FR-001 | AC-001-03 | U-008, U-047 | Full |
| FR-001 | AC-001-04 | U-006, U-045, I-018 | Full |
| FR-002 | AC-002-01 | U-013, U-014, U-028, U-042 | Full |
| FR-002 | AC-002-02 | U-015, U-016, U-024, U-025 | Full |
| FR-002 | AC-002-03 | U-017, U-058 | Full |
| FR-002 | AC-002-04 | U-018, U-027, U-029 | Full |
| FR-002 | AC-002-05 | U-019, U-020, U-021, U-022, U-026, U-030 | Full |
| FR-002 | AC-002-06 | U-023 | Full |
| FR-003 | AC-003-01 | U-050 | Partial (LLM matching is non-deterministic) |
| FR-003 | AC-003-02 | - | Not testable (LLM behavior) |
| FR-003 | AC-003-03 | U-060, I-014, I-015 | Full |
| FR-004 | AC-004-01 | U-001, U-002, U-011, U-012, U-059 | Full |
| FR-004 | AC-004-02 | U-003 | Full |
| FR-004 | AC-004-03 | U-004, U-005, U-043, U-044 | Full |
| FR-004 | AC-004-04 | U-009, U-048 | Full |
| FR-004 | AC-004-05 | U-010, U-049 | Full |
| FR-005 | AC-005-01 | U-065, U-066, U-067, U-068, I-016 | Full |
| FR-005 | AC-005-02 | I-001, I-002, I-008 | Full |
| FR-005 | AC-005-03 | I-017 | Full |
| FR-006 | AC-006-01 | - | Documentation review (manual) |
| FR-006 | AC-006-02 | - | Documentation review (manual) |
| FR-007 | AC-007-01 | - | Documentation review (manual) |
| FR-007 | AC-007-02 | - | Documentation review (manual) |
| FR-007 | AC-007-03 | - | Documentation review (manual) |
| FR-007 | AC-007-04 | - | Not testable at unit level (session cache is LLM-consumed) |
| FR-008 | AC-008-01 | I-009 | Full |
| FR-008 | AC-008-02 | I-011, I-012 | Full |
| FR-008 | AC-008-03 | I-013 | Full |
| FR-008 | AC-008-04 | I-010 | Full |

### Coverage Notes

- **FR-003 (LLM Intent Matching)**: AC-003-01 and AC-003-02 involve LLM interpretation and cannot be deterministically unit-tested. We test that intent/examples fields exist and are correctly loaded. Actual matching quality is validated through manual testing.
- **FR-006, FR-007 (Documentation)**: Validated during code review (Phase 08), not unit tests.
- **FR-007 AC-007-04 (Session cache)**: The WORKFLOW_REGISTRY section in the session cache is consumed by the LLM. We verify the loader output contains the data; cache serialization is tested separately in prime-session tests.

---

## 9. Test Data / Fixtures

### 9.1 Valid Custom Workflow YAML

```yaml
# .isdlc/workflows/spike.yaml
name: Spike
description: Quick exploration without full gates
intent: Quick exploration to validate an approach
examples:
  - "spike on this"
  - "quick exploration"
  - "let me prototype this"
phases:
  - 00-quick-scan
  - 01-requirements
  - 06-implementation
gate_mode: permissive
requires_branch: false
```

### 9.2 Extending Workflow YAML

```yaml
# .isdlc/workflows/thorough-feature.yaml
name: Thorough Feature
description: Feature with extra validation
intent: Feature with extra validation and security review
extends: feature
remove_phases:
  - 00-quick-scan
add_phases:
  - phase: 09-validation
    after: 16-quality-loop
gate_mode: strict
requires_branch: true
```

### 9.3 Custom Phase with Agent YAML

```yaml
# .isdlc/workflows/security-feature.yaml
name: Security Feature
description: Feature with custom security review phase
intent: Feature requiring dedicated security review
extends: feature
add_phases:
  - phase: security-review
    agent: .isdlc/agents/security-review.md
    after: 04-design
```

### 9.4 Invalid Fixtures

- `malformed.yaml`: Invalid YAML syntax (unclosed quote)
- `missing-name.yaml`: Valid YAML, no `name` field
- `collision.yaml`: `name: feature` (collides with shipped)
- `bad-extends.yaml`: `extends: nonexistent-workflow`
- `empty-result.yaml`: Extends feature, removes all phases
- `missing-agent.yaml`: Custom phase referencing non-existent agent file

---

## 10. Constitutional Compliance

| Article | Relevance | Validation |
|---------|-----------|------------|
| Article II | Test-First: Tests designed before implementation | This document precedes Phase 06 |
| Article VII | Traceability: Tests trace to FRs/ACs | Section 8 maps every test to FR/AC |
| Article IX | Gate Integrity: Quality gates enforced | Gate validation tests included |
| Article XI | Integration Testing: Real behavior, not mocks | Integration tests use real spawnSync |
| Article XII | Cross-Platform: path.join used | I-010 validates cross-platform paths |
| Article XIII | Module System: CJS tested correctly | Temp directory isolation per §1 |

---

## Pending Sections

None -- all sections complete.
