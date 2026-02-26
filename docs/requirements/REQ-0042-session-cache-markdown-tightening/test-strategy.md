# Test Strategy: REQ-0042 Session Cache Markdown Tightening

| Field | Value |
|-------|-------|
| **Status** | Complete |
| **Phase** | 05 - Test Strategy |
| **Last Updated** | 2026-02-26 |
| **Coverage** | Unit, Integration, Performance, Boundary, Error Handling, Backward Compatibility |

---

## 1. Existing Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` + `node:assert/strict` |
| **Module System** | CommonJS (`.test.cjs` files in `src/claude/hooks/tests/`) |
| **Existing Tests** | `test-session-cache-builder.test.cjs` with 15+ tests covering `rebuildSessionCache()`, `_buildSkillPathIndex()`, `getAgentSkillIndex()` |
| **Test Utilities** | `hook-test-utils.cjs` (`setupTestEnv`, `runHook`, `prepareHook`) |
| **Test Isolation** | `os.tmpdir()` per test, `require.cache` clearing, cleanup in `finally` blocks |
| **Coverage Tool** | Manual coverage via test case traceability matrix |
| **Run Commands** | `node --test src/claude/hooks/tests/test-session-cache-builder.test.cjs` (individual), `npm run test:hooks` (all CJS) |

### Existing Patterns to Follow

- Test files named `{module}.test.cjs` in `src/claude/hooks/tests/`
- `describe/it` pattern with `before/after` for module loading and environment restoration
- Test case IDs: `TC-{PREFIX}-{NN}` format (e.g., `TC-BUILD-01`, `TC-INDEX-01`)
- Source loaded from project root via `path.resolve(__dirname, '..', 'lib', 'common.cjs')`
- Full test projects created with `createFullTestProject()` helper using realistic file structures
- `require.cache` cleared before each module load to avoid stale state

### Approach: Extend Existing Test Suite

This strategy extends `test-session-cache-builder.test.cjs` with new test suites for the four tightening functions: `tightenPersonaContent()`, `tightenTopicContent()`, `condenseDiscoveryContent()`, and the modified `formatSkillIndexBlock()`. No new test frameworks or tools. All new tests follow established naming, structure, and isolation conventions.

New test suites are added within the same file to leverage the existing `requireCommon()`, `createFullTestProject()`, and `cleanup()` helpers.

---

## 2. Test Pyramid

### Layer 1: Unit Tests (Primary Focus -- 70% of test effort)

Each tightening function is a pure string-in, string-out transformer. Unit tests validate transformation correctness in isolation.

| Suite | Prefix | Test Count | Purpose |
|-------|--------|-----------|---------|
| `tightenPersonaContent()` positive | TC-TPC | 8 | Correct section stripping, trimming, compacting |
| `tightenPersonaContent()` negative/edge | TC-TPC | 6 | Null/empty/malformed input, fail-open behavior |
| `tightenTopicContent()` positive | TC-TTC | 4 | Frontmatter stripping, content preservation |
| `tightenTopicContent()` negative/edge | TC-TTC | 4 | Null/empty/no-frontmatter input, fail-open |
| `condenseDiscoveryContent()` positive | TC-CDC | 5 | Table preservation, prose removal, heading retention |
| `condenseDiscoveryContent()` negative/edge | TC-CDC | 4 | Null/empty/no-tables input, fail-open |
| `formatSkillIndexBlock()` modified | TC-FSI | 5 | Single-line format, no banner, empty array |
| Reduction percentage validation | TC-RED | 4 | Per-function character count reduction thresholds |

**Unit test total: ~40 tests**

### Layer 2: Integration Tests (25% of test effort)

Validate that tightening functions integrate correctly within `rebuildSessionCache()`.

| Suite | Prefix | Test Count | Purpose |
|-------|--------|-----------|---------|
| SKILL_INDEX section integration | TC-INT | 4 | Banner at section level, single-line entries in built cache |
| ROUNDTABLE_CONTEXT integration | TC-INT | 4 | Persona and topic tightening applied during cache build |
| DISCOVERY_CONTEXT integration | TC-INT | 3 | Discovery condensation applied during cache build |
| Cross-section independence | TC-INT | 2 | One section failure does not affect others |
| Verbose reporting integration | TC-INT | 2 | Reduction stats written to stderr in verbose mode |

**Integration test total: ~15 tests**

### Layer 3: Backward Compatibility Tests (5% of test effort)

Validate downstream consumer parsing still works with tightened output.

| Suite | Prefix | Test Count | Purpose |
|-------|--------|-----------|---------|
| Section delimiter preservation | TC-BWC | 2 | `<!-- SECTION: ... -->` markers intact |
| Orchestrator extraction | TC-BWC | 2 | `### Persona:` and `### Topic:` headings parseable |
| Skill index parsability | TC-BWC | 2 | Skill IDs and paths extractable from single-line format |

**Backward compatibility test total: ~6 tests**

### Test Pyramid Summary

| Layer | Count | % |
|-------|-------|---|
| Unit | 40 | 66% |
| Integration | 15 | 25% |
| Backward Compatibility | 6 | 9% |
| **Total** | **61** | 100% |

---

## 3. Test Data Strategy

### Realistic Persona Content

Tests use a representative persona file matching the actual structure of `persona-business-analyst.md`:
- YAML frontmatter block (`---` delimited)
- Sections 1-10 with `## N. Title` headings
- Section 4 with multiple subsections (`### 4.1`, `### 4.2`, etc.) each containing 5-8 bullet points
- Section 7 with "Before writing" and "Before finalization" checklists

### Realistic Topic Content

Tests use a representative topic file matching actual topic structure:
- YAML frontmatter with `topic_id`, `topic_name`, `depth_guidance`, `source_step_files`
- Content sections: Analytical Knowledge, Validation Criteria, Artifact Instructions

### Realistic Discovery Content

Tests use discovery report content with:
- Heading hierarchy (`##`, `###`)
- Markdown tables with header rows and separator rows
- Prose paragraphs both adjacent to and distant from tables

### Skill Index Data

Tests use skill entry arrays matching the `{id, name, description, path}` shape from `getAgentSkillIndex()`.

### Boundary Values

See test-data-plan.md for complete boundary value analysis.

---

## 4. Flaky Test Mitigation

| Risk | Mitigation |
|------|------------|
| File system temp dir race | Each test creates its own `fs.mkdtempSync()` directory with unique prefix |
| Module caching | `delete require.cache[require.resolve(path)]` before each `require()` |
| Environment leakage | `process.env` saved in `before()`, restored in `after()` |
| String comparison brittleness | Tests assert structural properties (contains/not-contains, line count, char reduction) rather than exact string equality |
| OS-specific line endings | All test data uses explicit `\n` rather than relying on `os.EOL` |

---

## 5. Performance Test Plan

### Execution Time Budget

| Test Category | Budget |
|---------------|--------|
| Individual tightening function unit test | < 10ms |
| Full `rebuildSessionCache()` integration test | < 500ms |
| Entire new test suite (61 tests) | < 5s |

### Performance Assertions

- `tightenPersonaContent()` with realistic ~5,000 char input: < 5ms
- `condenseDiscoveryContent()` with realistic ~22,000 char input: < 10ms
- No performance regression: `rebuildSessionCache()` wall time stays within 2x of pre-REQ-0042 baseline

Performance is validated implicitly through test execution time; no dedicated performance test suite is needed for string transformation functions.

---

## 6. Coverage Targets

| Metric | Target |
|--------|--------|
| Requirement coverage | 100% of FRs (FR-001 through FR-008) |
| Acceptance criteria coverage | 100% of ACs (31 total) |
| Positive test paths | At least 1 per AC |
| Negative test paths | At least 1 per function (null, empty, malformed) |
| Boundary conditions | At least 1 per function (empty section list, single-item arrays, no frontmatter) |
| Error handling paths | All fail-open paths tested (TIGHT-001 through TIGHT-005) |

---

## 7. Critical Paths

### Critical Path 1: Persona Tightening Correctness (FR-003, FR-004, FR-005)

Highest risk path. If persona tightening removes sections needed by the roundtable lead (Identity, Principles, Voice Integrity, Interaction Style), agent behavior degrades.

**Test focus**: Explicit presence assertions for kept sections, explicit absence assertions for stripped sections.

### Critical Path 2: Orchestrator Extraction Compatibility (FR-003, FR-006)

The orchestrator splits on `### Persona:` and `### Topic:` headings. If tightening alters these delimiters, roundtable dispatch breaks.

**Test focus**: Regex extraction tests matching the orchestrator's actual split pattern.

### Critical Path 3: Skill Index Parsability (FR-001, FR-002)

Phase agents parse SKILL_INDEX to find skill IDs and paths. Format change must preserve parsability.

**Test focus**: Parse the tightened format to extract skill ID and path, verify both match input.

### Critical Path 4: Fail-Open Safety (FR-008)

Any tightening error must fall through to verbose content. Empty or corrupted output is never acceptable.

**Test focus**: Force errors (e.g., pass non-string input, mock regex failure) and verify original content returned.

---

## 8. Test Commands

All commands follow existing project conventions:

| Purpose | Command |
|---------|---------|
| Run REQ-0042 tests only | `node --test src/claude/hooks/tests/test-session-cache-builder.test.cjs` |
| Run all CJS hook tests | `npm run test:hooks` |
| Run all project tests | `npm run test:all` |

---

## 9. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Test data does not match real persona structure | Medium | High | Use excerpts from actual `persona-business-analyst.md` as test fixtures |
| String-based assertions are fragile to whitespace | Medium | Medium | Use `includes()` / `match()` for content checks, numeric assertions for reduction percentages |
| `rebuildSessionCache()` test depends on full project setup | Low | Medium | Reuse existing `createFullTestProject()` with extended persona/topic content |
| Fail-open path hard to trigger without mocking | Low | Low | Pass deliberately malformed input (non-string types, content with no section headings) |
