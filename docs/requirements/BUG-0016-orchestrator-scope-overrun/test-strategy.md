# Test Strategy: BUG-0016 -- Orchestrator Scope Overrun

**Phase**: 05-test-strategy
**Bug ID**: BUG-0016
**Generated**: 2026-02-14
**Artifact Folder**: BUG-0016-orchestrator-scope-overrun

---

## 1. Existing Infrastructure (from test evaluation)

- **Framework**: `node:test` + `node:assert/strict` (Node 18+ built-in)
- **Coverage Tool**: c8 / istanbul
- **Current Test Baseline**: ~1280 CJS + ~560 ESM tests
- **Existing Prompt-Test Pattern**: `lib/early-branch-creation.test.js` (BUG-0014, 22 tests) and `lib/invisible-framework.test.js` (REQ-0012, 49 tests)
- **Convention**: ESM test files in `lib/*.test.js`; CJS hook tests in `src/claude/hooks/tests/*.test.cjs`
- **Naming**: `{feature-slug}.test.js` for prompt-level structural validation tests

## 2. Strategy for This Requirement

### 2.1 Approach: Extend Existing Prompt-Test Pattern

This is a **prompt-only fix** -- the orchestrator agent file (`src/claude/agents/00-sdlc-orchestrator.md`) is a markdown prompt, not executable code. Traditional unit/integration testing of runtime behavior is not applicable.

The test strategy follows the established pattern from BUG-0014 and REQ-0012:
- Read the orchestrator `.md` file as a string
- Extract relevant sections (Section 3c, Section 4, Section 4a, top-level MODE enforcement)
- Validate the presence, positioning, and content of required instructions using regex assertions
- Validate the absence of conflicting or stale instructions

### 2.2 Why Structural Prompt Testing Is Appropriate

| Factor | Rationale |
|--------|-----------|
| **Fix type** | Prompt-only -- no `.cjs`/`.js` files modified |
| **Root cause** | Competing instructions at different priority levels |
| **Fix mechanism** | Adding CRITICAL-level stop instructions + mode guards |
| **Validation** | Instruction presence, positioning, and language strength |
| **Regression** | Ensure automatic transitions still work when no MODE is set |
| **Precedent** | BUG-0014 used identical approach (22 tests, merged to main) |

### 2.3 Test Types Required

| Test Type | Applicable? | Rationale |
|-----------|-------------|-----------|
| **Structural validation (prompt)** | YES | Primary test type -- validates prompt text patterns |
| **Regression** | YES | Ensures backward compatibility (no-MODE behavior unchanged) |
| **Integration** | NO | No runtime code changes to integrate |
| **E2E / Behavioral** | NO | Cannot programmatically invoke the orchestrator agent and check its behavior in a unit test -- this is an LLM agent |
| **Security** | NO | No security-relevant changes |
| **Performance** | NO | No performance-relevant changes |
| **Mutation testing** | PARTIAL | Not applicable to markdown content, but existing CJS tests should still pass |

## 3. Test File Structure

Following existing conventions, tests will be created at:

```
lib/orchestrator-scope-overrun.test.js    (NEW -- structural prompt validation)
```

This follows the pattern of `lib/early-branch-creation.test.js` and `lib/invisible-framework.test.js`.

## 4. Coverage Targets

| Metric | Target | Notes |
|--------|--------|-------|
| AC coverage | 100% (17/17) | All acceptance criteria mapped to tests |
| NFR coverage | 100% (3/3) | All non-functional requirements validated |
| FR coverage | 100% (4/4) | All functional requirements have test groups |
| Regression | 0 failures | Existing 1280 CJS + 560 ESM tests must still pass |
| New test count | 20 tests | T01-T20 covering all ACs and NFRs |

## 5. Critical Paths

The following are the critical paths that must pass for the fix to be validated:

1. **MODE enforcement instruction exists at top of orchestrator** -- before Section 1
2. **MODE enforcement uses CRITICAL-level language** -- matching or exceeding Section 4a strength
3. **Section 4a has a mode-aware guard** -- checks MODE before automatic transition
4. **Section 4 advancement algorithm has mode check** -- before step 8 delegation
5. **Backward compatibility preserved** -- no-MODE behavior is unchanged

## 6. Test Commands (use existing)

- **ESM tests**: `npm test` (runs `node --test lib/*.test.js lib/utils/*.test.js`)
- **CJS hook tests**: `npm run test:hooks`
- **All tests**: `npm run test:all`

## 7. Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Regex patterns too strict (break on benign rewording) | LOW | Use flexible patterns that match semantic intent, not exact wording |
| Regex patterns too loose (pass without real fix) | MEDIUM | Each test validates both positive (instruction present) and negative (conflicting instruction absent) |
| Section restructuring breaks extractors | LOW | Use robust section-finding helpers with fallback patterns |
| New orchestrator changes invalidate tests | LOW | Tests validate semantic requirements, not exact line counts |
