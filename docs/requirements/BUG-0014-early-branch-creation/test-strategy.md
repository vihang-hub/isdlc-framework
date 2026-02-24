# Test Strategy: BUG-0014 Early Branch Creation

**Phase**: 05-test-strategy
**Bug**: BUG-0014 -- Branch creation happens after GATE-01 instead of before any phases run
**Created**: 2026-02-13
**Author**: test-design-engineer

---

## 1. Existing Infrastructure

- **Framework**: Node.js built-in `node:test` + `node:assert/strict` (Node 18+)
- **Test Pattern for Documentation Fixes**: ESM test file reads markdown source files and asserts on content patterns (established by REQ-0012 `lib/invisible-framework.test.js`)
- **Test Runner**: `npm test` (ESM stream)
- **Coverage Tool**: None explicit for content-based tests (assertion-based verification)
- **Existing Coverage**: No tests currently verify branch creation timing documentation in `00-sdlc-orchestrator.md` or `isdlc.md`

### Relevant Existing Tests

| File | Tests | Relevance |
|------|-------|-----------|
| `lib/invisible-framework.test.js` | 49 | Established pattern: ESM test reads markdown, extracts sections, asserts content patterns |
| `src/claude/hooks/tests/branch-guard.test.cjs` | ~31 | Tests branch-guard hook behavior (not documentation content) |

### Gap Analysis

No existing tests verify:
1. Branch creation timing documentation in the orchestrator agent file
2. Branch creation references in the phase-loop controller (isdlc.md)
3. Generate-plan skill documentation regarding branch prerequisites
4. Absence of "after GATE-01" references for branch creation
5. Preservation of branch naming conventions across all workflow types

---

## 2. Strategy: New ESM Content Verification Test Suite

**Approach**: Create a new ESM test file `lib/early-branch-creation.test.js` following the pattern established by `lib/invisible-framework.test.js`. The test file reads the three target markdown files and asserts that:

1. Branch creation is documented as happening during initialization (not post-GATE-01)
2. No remaining references to "after GATE-01" for branch creation exist
3. Branch naming conventions are preserved
4. Plan generation remains documented as post-GATE-01
5. Pre-flight checks are documented at init time
6. State recording (git_branch) is documented at init time

**Why this approach**:
- The fix is documentation/prompt-only (markdown agent files)
- Runtime JavaScript code is unchanged
- Content verification tests are the correct strategy for verifying documentation changes
- This is the established pattern in the project (REQ-0012)

### Test Mode: TDD Red Baseline

Per Article II (Test-First Development), these tests are written BEFORE the fix is implemented. The expected behavior:

- **Tests for new timing (T01-T08)**: Will FAIL initially (they assert content that does not exist yet)
- **Tests for removed references (T09-T13)**: Will FAIL initially (they assert "after GATE-01" references are gone)
- **Tests for preserved content (T14-T20)**: Will PASS (they assert content that should remain unchanged)
- **Tests for generate-plan skill (T21-T22)**: Will FAIL initially (they assert updated prerequisite text)

After implementation in Phase 06, ALL tests should pass.

---

## 3. Test Types

### 3.1 Unit Tests (Primary)

Content verification tests that read markdown files and assert on string patterns. Each test reads the target file, extracts a relevant section, and verifies the presence or absence of specific text patterns.

**Test approach**: Read markdown files with `readFileSync`, search for section markers, assert on content using `String.includes()`, `String.match()`, and regex patterns.

### 3.2 Integration Tests (Implicit)

Not applicable -- this is a documentation-only fix. The "integration" between the three files is verified by cross-file consistency checks (e.g., T18-T20 verify that all three files agree on the new timing).

### 3.3 Regression Tests

Tests T14-T17 verify that content that must NOT change (branch naming conventions, plan generation timing, workflow type prefixes) is preserved. These are regression guards.

### 3.4 Security Tests

Not applicable -- documentation content has no security surface.

### 3.5 Performance Tests

Not applicable -- reading markdown files for content verification has negligible performance overhead.

---

## 4. Target Files

| File | Role | Change Type |
|------|------|-------------|
| `src/claude/agents/00-sdlc-orchestrator.md` | Primary: Orchestrator agent docs with Section 3a | 9 locations modified |
| `src/claude/commands/isdlc.md` | Phase-loop controller with STEP 1 | 3 locations modified |
| `src/claude/skills/orchestration/generate-plan/SKILL.md` | Generate-plan skill prerequisites | 2 locations modified |

---

## 5. Coverage Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Acceptance Criteria Coverage | 100% (17/17 ACs) | Every AC has at least one test case |
| Orchestrator content tests | 13 tests | Section 3a, init-and-phase-01, workflow types |
| isdlc.md content tests | 5 tests | STEP 1, feature/fix action docs |
| generate-plan skill tests | 2 tests | when_to_use, prerequisites |
| Regression guards | 4 tests | Naming conventions, plan timing |
| **Total new tests** | **22** (T01-T22) | New file: `lib/early-branch-creation.test.js` |

---

## 6. Test Data Strategy

### File Paths

All tests read from source-of-truth paths:
- `src/claude/agents/00-sdlc-orchestrator.md`
- `src/claude/commands/isdlc.md`
- `src/claude/skills/orchestration/generate-plan/SKILL.md`

### Content Patterns

Tests use two categories of assertions:

**Positive patterns** (must be present after fix):
- "Branch Creation (At Initialization)" or "Branch Creation (At Init)" in orchestrator Section 3a header
- "initializing a workflow" in orchestrator Section 3a trigger condition
- "create branch" before "Phase 01" in init-and-phase-01 mode description
- "branch already created" or "branch already exists" in generate-plan skill

**Negative patterns** (must NOT be present after fix):
- "Branch Creation (Post-GATE-01)" in orchestrator Section 3a header
- "after GATE-01" near "create branch" in any file (except for plan generation)
- "When GATE-01 passes" as the trigger for branch creation in orchestrator

**Preserved patterns** (must remain unchanged):
- `feature/{artifact_folder}` naming pattern
- `bugfix/{artifact_folder}` naming pattern
- "Plan Generation (Post-GATE-01)" header (plan timing unchanged)
- `git checkout -b` command in Section 3a

---

## 7. Test Execution

```bash
# Run only the early-branch-creation tests
node --test lib/early-branch-creation.test.js

# Run all ESM tests (includes this file)
npm test

# Run full suite
npm run test:all
```

### TDD Verification Commands

```bash
# Phase 05 (test strategy): Run tests, expect T01-T13 and T21-T22 to FAIL
node --test lib/early-branch-creation.test.js

# Phase 06 (implementation): After fix, ALL tests should PASS
node --test lib/early-branch-creation.test.js
```

---

## 8. Critical Paths

1. **Orchestrator Section 3a timing** (FR-02): Tests T01-T04 verify the header, trigger condition, and init-and-phase-01 mode description. This is the core fix location.
2. **isdlc.md STEP 1 timing** (FR-03): Tests T05-T08 verify the phase-loop controller describes branch creation at init time.
3. **No stale references** (FR-01, FR-03): Tests T09-T13 verify no "after GATE-01" branch creation references remain.
4. **Naming preservation** (FR-03, NFR-01): Tests T14-T15 verify branch naming conventions are untouched.
5. **Plan generation preserved** (NFR-03): Tests T16-T17 verify plan generation still references post-GATE-01.

---

## 9. Risk Assessment

| Risk | Mitigation |
|------|------------|
| Regex too strict -- fails on minor wording variations | Use `includes()` for key phrases, regex only for structural patterns |
| Test reads stale cached file | Tests read fresh from disk at test start using `readFileSync` |
| False positive -- test passes but content is wrong | Multiple overlapping tests per requirement provide cross-validation |
| Branch naming test too broad | Tests use exact prefix patterns (`feature/`, `bugfix/`) |
| Plan generation accidentally moved | T16-T17 explicitly verify "Post-GATE-01" remains in plan section |

---

## 10. Constitutional Compliance

- **Article II (Test-First)**: Tests written before implementation. TDD red baseline established with 18 tests expected to FAIL.
- **Article VII (Traceability)**: Every test traces to at least one AC. Traceability matrix provided with 100% AC coverage.
- **Article VIII (Documentation Currency)**: Tests verify that documentation matches the intended behavior change.
- **Article IX (Gate Integrity)**: GATE-05 checklist validates all artifacts.
- **Article XI (Integration Testing)**: Not directly applicable (documentation-only fix), but cross-file consistency checks (T18-T20) provide integration-level verification.
