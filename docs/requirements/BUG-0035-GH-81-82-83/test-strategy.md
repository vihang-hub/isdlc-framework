# Test Strategy: BUG-0035-GH-81-82-83

**Bug ID:** BUG-0035-GH-81-82-83
**Phase:** 05-test-strategy
**Created:** 2026-02-23
**Status:** Draft

---

## Existing Infrastructure

- **Framework:** Node.js built-in `node:test` + `node:assert/strict` (Node 18+)
- **Module Format:** CJS (`.cjs` extension) for all hook tests
- **Test Runner:** `npm run test:hooks` (CJS stream)
- **Coverage Tool:** Not explicitly configured for hooks (code coverage via test assertions)
- **Existing Test File:** `src/claude/hooks/tests/skill-injection.test.cjs` (61 test cases for BUG-0011)
- **Test Helpers:** `src/claude/hooks/tests/hook-test-utils.cjs` (shared CJS utilities)
- **Current Coverage:** Existing tests pass against buggy code because fixtures match buggy schema (GH-83)

## Strategy for This Fix

- **Approach:** Create a NEW test file (`test-bug-0035-skill-index.test.cjs`) with RED-state tests that assert correct behavior against the production manifest schema. Phase 06 will modify `skill-injection.test.cjs` to update its fixtures.
- **New Test Types Needed:** Unit tests (string-ID resolution, dual-path resolution), integration test (real production manifest), regression tests (fixture schema validation)
- **Coverage Target:** 100% of FR-01, FR-02, FR-03 acceptance criteria (15 ACs total)

## Test Commands (use existing)

- Unit/Integration: `node --test src/claude/hooks/tests/test-bug-0035-skill-index.test.cjs`
- Full hooks suite: `npm run test:hooks`
- Full suite: `npm run test:all`

---

## Scope of Testing

### In Scope

| Area | Description |
|------|-------------|
| `getAgentSkillIndex()` function | Core function under fix -- string ID resolution from production manifest |
| Dual-path skill resolution | `.claude/skills/` and `src/claude/skills/` fallback chain |
| Fail-open behavior | Graceful degradation on missing/corrupt data at every level |
| Production manifest integration | Validation against real `skills-manifest.json` v5.0.0 |
| Test fixture schema alignment | Ensure test fixtures use production format (flat strings) |

### Out of Scope

| Area | Reason |
|------|--------|
| `formatSkillIndexBlock()` | Not affected by this bug -- consumes output of fixed function |
| `_extractSkillDescription()` | Assumed working correctly (ASM-03) |
| `loadManifest()` / caching | Already tested in TC-05/TC-06, not changed by this fix |
| STEP 3d prompt template (TC-09) | Not affected by this bug |
| Agent file validation (TC-07) | Not affected by this bug |

---

## Test Pyramid

### Unit Tests (12 test cases)

Test the rewritten `getAgentSkillIndex()` against mock manifests that use the **production schema** (flat string arrays in `ownership[agent].skills`, plus `skill_lookup` and `path_lookup` tables).

| Test Group | Count | Description |
|------------|-------|-------------|
| String-ID resolution (FR-01) | 6 | Validate function resolves flat string IDs to `{id, name, description, path}` objects |
| Dual-path resolution (FR-02) | 5 | Validate `.claude/skills/` tried first, `src/claude/skills/` fallback, skip if neither |
| Fail-open resilience (FR-01) | 1 | Unresolvable skill IDs are skipped, others continue |

### Integration Tests (3 test cases)

| Test Group | Count | Description |
|------------|-------|-------------|
| Production manifest (FR-03) | 2 | Load real `skills-manifest.json`, call with `software-developer`, validate 14 results |
| Fixture schema validation (FR-03) | 1 | Verify mock fixtures match production schema structure |

### Regression Tests (implicit)

The existing `skill-injection.test.cjs` will be modified in Phase 06 to update fixtures. The new test file ensures the fix does not break fail-open behavior.

---

## Test Case Design: FR-01 (String ID Resolution)

### TC-B35-01: Happy path -- agent with production-schema skills returns resolved objects

- **Requirement:** FR-01, AC-01-01
- **Type:** positive
- **Setup:** Mock manifest with `ownership.test-agent.skills: ["TST-001", "TST-002", "TST-003"]` as flat strings; `skill_lookup` and `path_lookup` tables populated; SKILL.md files created at `src/claude/skills/{category}/{name}/SKILL.md`
- **Action:** Call `getAgentSkillIndex('test-agent')`
- **Assert:** Returns array of exactly 3 objects, each with `{id, name, description, path}` fields

### TC-B35-02: Each returned object has correct id, name, description, path

- **Requirement:** FR-01, AC-01-02
- **Type:** positive
- **Setup:** Same as TC-B35-01
- **Action:** Call `getAgentSkillIndex('test-agent')`, inspect first entry
- **Assert:** `id` matches skill ID string, `name` matches directory name from `path_lookup`, `description` is non-empty string from SKILL.md, `path` ends with `SKILL.md`

### TC-B35-03: Missing/corrupt manifest returns empty array

- **Requirement:** FR-01, AC-01-03
- **Type:** negative
- **Setup:** No manifest file on disk
- **Action:** Call `getAgentSkillIndex('test-agent')`
- **Assert:** Returns `[]`, no throw

### TC-B35-04: Unknown agent returns empty array

- **Requirement:** FR-01, AC-01-04
- **Type:** negative
- **Setup:** Valid manifest, agent name not in `ownership`
- **Action:** Call `getAgentSkillIndex('nonexistent-agent')`
- **Assert:** Returns `[]`

### TC-B35-05: Unresolvable skill ID is skipped, others continue

- **Requirement:** FR-01, AC-01-05
- **Type:** negative
- **Setup:** Manifest with 3 skill IDs, one has no matching SKILL.md file
- **Action:** Call `getAgentSkillIndex('test-agent')`
- **Assert:** Returns 2 entries (the resolvable ones), missing one skipped

### TC-B35-06: Empty/null/undefined agent name returns empty array

- **Requirement:** FR-01, AC-01-06
- **Type:** negative
- **Setup:** Valid manifest
- **Action:** Call with `null`, `undefined`, `''`, `'   '`
- **Assert:** Each returns `[]`

## Test Case Design: FR-02 (Dual-Path Resolution)

### TC-B35-07: Development path src/claude/skills/ works

- **Requirement:** FR-02, AC-02-01
- **Type:** positive
- **Setup:** SKILL.md at `src/claude/skills/testing/skill-one/SKILL.md`, no `.claude/skills/`
- **Action:** Call `getAgentSkillIndex('test-agent')`
- **Assert:** Returns entry with path containing `src/claude/skills/`

### TC-B35-08: Installed path .claude/skills/ works when src/ absent

- **Requirement:** FR-02, AC-02-02
- **Type:** positive
- **Setup:** SKILL.md at `.claude/skills/testing/skill-one/SKILL.md`, no `src/claude/skills/`
- **Action:** Call `getAgentSkillIndex('test-agent')`
- **Assert:** Returns entry with path containing `.claude/skills/`

### TC-B35-09: .claude/skills/ takes precedence over src/claude/skills/

- **Requirement:** FR-02, AC-02-03
- **Type:** positive
- **Setup:** SKILL.md exists in both locations
- **Action:** Call `getAgentSkillIndex('test-agent')`
- **Assert:** Returned path uses `.claude/skills/` (installed takes precedence)

### TC-B35-10: Neither path exists -- skill skipped without error

- **Requirement:** FR-02, AC-02-04
- **Type:** negative
- **Setup:** No SKILL.md in either location for one skill
- **Action:** Call `getAgentSkillIndex('test-agent')`
- **Assert:** That skill is skipped, others returned, no throw

### TC-B35-11: Returned path is relative from project root

- **Requirement:** FR-02, AC-02-05
- **Type:** positive
- **Setup:** Valid SKILL.md in one path
- **Action:** Call `getAgentSkillIndex('test-agent')`, inspect `path` field
- **Assert:** Path does not start with `/` or project root absolute path; is relative like `.claude/skills/.../SKILL.md` or `src/claude/skills/.../SKILL.md`

## Test Case Design: FR-03 (Fixture Alignment)

### TC-B35-12: Mock manifest uses string arrays not objects

- **Requirement:** FR-03, AC-03-01
- **Type:** positive (schema validation)
- **Setup:** Read the mock manifest created by `createTestProject()`
- **Action:** Inspect `ownership[agent].skills` entries
- **Assert:** Each entry is a string (not an object)

### TC-B35-13: Integration test against real skills-manifest.json

- **Requirement:** FR-03, AC-03-02
- **Type:** positive (integration)
- **Setup:** Load real `src/claude/hooks/config/skills-manifest.json`, set project root to actual project
- **Action:** Call `getAgentSkillIndex('software-developer')`
- **Assert:** Returns exactly 14 entries; each has valid `id`, `name`, `description`, `path`; IDs are DEV-001 through DEV-014

### TC-B35-14: Mock includes skill_lookup/path_lookup tables

- **Requirement:** FR-03, AC-03-04
- **Type:** positive (schema validation)
- **Setup:** Read the mock manifest
- **Action:** Inspect for `skill_lookup` and `path_lookup` keys
- **Assert:** Both exist and are consistent with mock skill IDs

### TC-B35-15: Corrupt manifest returns empty array (fail-open regression)

- **Requirement:** FR-01, AC-01-03
- **Type:** negative (regression)
- **Setup:** Corrupt JSON in manifest file
- **Action:** Call `getAgentSkillIndex('test-agent')`
- **Assert:** Returns `[]`, no throw

---

## Flaky Test Mitigation

| Risk | Mitigation |
|------|------------|
| Temp directory cleanup failures | Use `fs.rmSync({ force: true })` in `after()` hooks; best-effort cleanup |
| Require cache leaks between tests | Clear `require.cache` and call `_resetCaches()` before each test group |
| File system race conditions | All temp dirs use `mkdtempSync()` with unique prefixes |
| Integration test depends on real manifest | Only run when `skills-manifest.json` exists; skip gracefully if absent |
| ENV variable leaks | Store and restore `CLAUDE_PROJECT_DIR` in `before`/`after` hooks |

---

## Performance Test Plan

| Metric | Target | Method |
|--------|--------|--------|
| `getAgentSkillIndex()` execution time | < 100ms cold, < 10ms cached | `process.hrtime.bigint()` measurement in TC-B35-NFR-01 |
| Test suite execution time | < 5 seconds total | Measured by `node --test` runner |

No load/stress testing is required for this utility function.

---

## Test Data Plan

### Boundary Values

| Data Point | Values | Rationale |
|------------|--------|-----------|
| Agent name | `''`, `' '`, `'\t'`, `null`, `undefined` | AC-01-06 empty/null/undefined guard |
| Skills array length | 0, 1, 14 (production max for single agent) | Empty vs single vs typical |
| Skill ID format | `"DEV-001"`, `"NONEXISTENT-999"` | Valid vs unresolvable |

### Invalid Inputs

| Input | Expected Behavior |
|-------|-------------------|
| `null` agent name | Returns `[]` |
| `undefined` agent name | Returns `[]` |
| Empty string `''` | Returns `[]` |
| Whitespace-only string `'   '` | Returns `[]` |
| Numeric agent name `123` | Returns `[]` (type guard) |
| Agent with no skills entry | Returns `[]` |

### Maximum-Size Inputs

| Input | Size | Expected Behavior |
|-------|------|-------------------|
| Agent with 14 skills (software-developer) | 14 skill IDs | All 14 resolved in < 100ms |
| Skills array with 50 entries (synthetic) | 50 | All resolvable ones returned, < 100ms |

---

## Traceability Matrix

| Requirement | AC | Test Case | Test Type | Priority |
|-------------|-----|-----------|-----------|----------|
| FR-01 | AC-01-01 | TC-B35-01 | positive | P0 |
| FR-01 | AC-01-02 | TC-B35-02 | positive | P0 |
| FR-01 | AC-01-03 | TC-B35-03, TC-B35-15 | negative | P0 |
| FR-01 | AC-01-04 | TC-B35-04 | negative | P1 |
| FR-01 | AC-01-05 | TC-B35-05 | negative | P0 |
| FR-01 | AC-01-06 | TC-B35-06 | negative | P1 |
| FR-02 | AC-02-01 | TC-B35-07 | positive | P0 |
| FR-02 | AC-02-02 | TC-B35-08 | positive | P0 |
| FR-02 | AC-02-03 | TC-B35-09 | positive | P1 |
| FR-02 | AC-02-04 | TC-B35-10 | negative | P1 |
| FR-02 | AC-02-05 | TC-B35-11 | positive | P1 |
| FR-03 | AC-03-01 | TC-B35-12 | positive | P0 |
| FR-03 | AC-03-02 | TC-B35-13 | positive | P0 |
| FR-03 | AC-03-03 | (validated by full suite pass) | regression | P0 |
| FR-03 | AC-03-04 | TC-B35-14 | positive | P1 |

**Coverage:** 15/15 acceptance criteria covered (100%).

---

## Gate Validation (GATE-05)

- [x] Test strategy covers unit, integration, regression
- [x] Test cases exist for all 15 acceptance criteria
- [x] Traceability matrix complete (100% requirement coverage)
- [x] Coverage targets defined (100% AC coverage)
- [x] Test data strategy documented (boundary, invalid, max-size)
- [x] Critical paths identified (string-ID resolution, dual-path, fail-open)
- [x] RED-state TDD tests written (will fail until Phase 06 implements fix)
