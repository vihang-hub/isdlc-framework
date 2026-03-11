# Test Strategy: Bug-Aware Analyze Flow

**Status**: Complete
**Requirement**: REQ-0061 / GH-119
**Last Updated**: 2026-03-11
**Coverage Target**: 100% AC coverage (behavioral validation)
**Constitutional Articles**: II (Test-First), VII (Traceability), IX (Gate Integrity), XI (Integration Testing)

---

## 1. Overview

This document defines the test strategy for the Bug-Aware Analyze Flow feature (REQ-0061). The feature adds bug detection and routing to the analyze handler, a new bug-gather agent, artifact production for tracing compatibility, and an explicit fix handoff gate.

### Modules Under Test

| Module | Responsibility | Testability | Test Approach |
|--------|---------------|-------------|---------------|
| M1: Bug Classification Gate | LLM-based bug vs feature detection in analyze handler | **Behavior-only** (markdown prompt) | Behavioral validation via structured scenarios |
| M2: Bug-Gather Agent | Gather, playback, confirm loop for bugs | **Behavior-only** (markdown agent) | AC validation via integration scenarios |
| M3: Fix Handoff Logic | "Should I fix it?" gate + fix invocation | **Behavior-only** (markdown prompt) | AC validation via integration scenarios |

### Critical Architectural Observation

All three modules are **prompt-level markdown instructions** -- not coded JavaScript modules. There is no new `.js` or `.cjs` code to unit test. The implementation consists of:
- ~40 lines added to `src/claude/commands/isdlc.md` (M1 + M3)
- ~200-300 lines in a new `src/claude/agents/bug-gather-analyst.md` (M2)

This means:
- **No unit tests are applicable** -- there are no functions, classes, or modules to test in isolation
- **No code coverage metrics apply** -- markdown files have no executable code paths
- **All testing is behavioral** -- validating that the LLM follows the instructions correctly given specific inputs

### Existing Infrastructure (from test evaluation)

- **Framework**: Node.js built-in test runner (`node:test`)
- **Assertion library**: `node:assert/strict`
- **Test pattern**: `*.test.cjs` for hook/CJS tests
- **Test utilities**: `src/claude/hooks/tests/hook-test-utils.cjs`
- **Current project tests**: ~1300+ tests across lib/ and hooks/
- **Existing integration patterns**: CLI smoke tests in CI, hook process spawning

### Strategy for This Requirement

- **Approach**: Behavioral test specification (no automated test files for prompt-level changes)
- **Validation method**: Structured scenario walkthroughs with expected outcomes documented
- **Artifact compatibility**: Validated via format checks against tracing orchestrator expectations
- **Regression**: Existing roundtable tests continue to pass (feature analysis path unchanged)

---

## 2. Test Pyramid

### Why This Feature Inverts the Pyramid

The standard test pyramid (many unit tests, fewer integration, fewest E2E) does not apply to prompt-level features. Since there is no executable code, the pyramid is inverted:

| Level | Proportion | Rationale |
|-------|------------|-----------|
| Unit Tests | 0% (0 tests) | No coded functions exist to unit test |
| Integration Tests | 30% (8 tests) | Artifact format validation, computeStartPhase compatibility |
| Behavioral/E2E Tests | 70% (19 tests) | Scenario-based validation of LLM behavior given specific inputs |

### Level 1: Unit Tests (0 tests)

No unit tests. All changes are to markdown prompt files. There are no JavaScript functions, no CJS modules, no importable code.

### Level 2: Integration Tests (8 tests)

Integration tests validate that artifacts produced by the bug-gather agent are compatible with downstream consumers.

| Integration Scope | Test Count | What's Validated |
|-------------------|------------|------------------|
| Bug-report.md format compatibility with tracing orchestrator | 3 | Required sections present, non-empty, valid markdown |
| Requirements-spec.md format compatibility with computeStartPhase | 3 | phases_completed detection, FR/AC structure, artifact folder path |
| meta.json update for computeStartPhase detection | 2 | phases_completed array includes Phase 01 indicators |
| **Total** | **8** | |

These are implemented as **format validation tests** that can be run against sample artifacts:

```javascript
// tests/integration/bug-gather-artifact-format.test.cjs
// Validates bug-report.md has required sections for tracing orchestrator
// Validates requirements-spec.md has FR/AC structure for computeStartPhase
// Validates meta.json phases_completed for Phase 01 detection
```

### Level 3: Behavioral/E2E Tests (19 tests)

Behavioral tests are documented as structured scenarios with expected outcomes. These are validated during quality loop (Phase 16) by observing agent behavior.

| Scenario Group | Test Count | What's Validated |
|----------------|------------|------------------|
| Bug classification (FR-001) | 5 | LLM classifies correctly, confirms with user, handles labels |
| Bug-gather agent flow (FR-002) | 5 | Reads ticket, scans codebase, plays back, accepts additions |
| Artifact production (FR-003) | 3 | Correct format, correct location, tracing compatibility |
| Fix handoff gate (FR-004) | 3 | Asks question, handles yes/no, fix workflow starts at Phase 02 |
| Feature fallback (FR-005) | 2 | Override routes to roundtable, no bug artifacts produced |
| Live progress (FR-006) | 1 | Phase transitions visible during autonomous fix |
| **Total** | **19** | |

**Total test count: 27** (8 integration + 19 behavioral)

---

## 3. Test Approach by Module

### Module 1: Bug Classification Gate (FR-001, FR-005)

The bug classification gate is a prompt-level instruction in the analyze handler. Testing validates that the LLM's behavior matches the expected classification logic.

**Test approach**: Provide crafted issue descriptions and verify classification + reasoning.

| Test ID | Input | Expected Classification | Validates |
|---------|-------|------------------------|-----------|
| TC-M1-01 | Issue with "returns 500 error", "expected 200" | Bug | AC-001-01: Bug-like content detected |
| TC-M1-02 | Issue with "add dark mode support" | Feature | AC-001-02: Feature-like content detected |
| TC-M1-03 | Issue labeled "bug" but describes feature request | Feature (content overrides label) | AC-001-03: Labels don't override inference |
| TC-M1-04 | Issue labeled "enhancement" but describes crash | Bug (content overrides label) | AC-001-03: Labels don't override inference |
| TC-M1-05 | User says "no, it's a feature" after bug classification | Routes to roundtable | AC-001-04, AC-005-01 |

### Module 2: Bug-Gather Agent (FR-002)

The bug-gather agent is a standalone markdown agent file. Testing validates the gather-playback-confirm loop.

**Test approach**: Provide crafted dispatch prompts and verify structured playback output.

| Test ID | Scenario | Expected Behavior | Validates |
|---------|----------|-------------------|-----------|
| TC-M2-01 | Issue with clear symptoms + error messages | Agent extracts symptoms, identifies code areas | AC-002-01, AC-002-02 |
| TC-M2-02 | Issue with reproduction steps | Agent includes repro steps in playback | AC-002-01, AC-002-03 |
| TC-M2-03 | Agent presents structured playback | Output has: what's broken, where, what's affected | AC-002-03 |
| TC-M2-04 | Agent asks "anything to add?" | Prompt for additional context appears | AC-002-04 |
| TC-M2-05 | User provides additional context | Agent incorporates it into understanding | AC-002-05 |

### Module 3: Fix Handoff Logic (FR-003, FR-004, FR-006)

The fix handoff is the final stage of the bug-gather flow. Testing validates artifact production and the consent gate.

| Test ID | Scenario | Expected Behavior | Validates |
|---------|----------|-------------------|-----------|
| TC-M3-01 | Bug-gather completes, produces bug-report.md | File written with required sections | AC-003-01 |
| TC-M3-02 | Bug-gather completes, produces requirements-spec.md | File written with FR + AC structure | AC-003-02, AC-003-03 |
| TC-M3-03 | Artifacts satisfy tracing orchestrator format | Sections match expected format | AC-003-04 |
| TC-M3-04 | Agent asks "Should I fix it?" | Consent gate presented after artifacts | AC-004-01 |
| TC-M3-05 | User confirms fix | Fix workflow invoked, starts at Phase 02 | AC-004-02, AC-004-04 |
| TC-M3-06 | User declines fix | Artifacts preserved, no workflow created | AC-004-03 |
| TC-M3-07 | Fix workflow shows live progress | Phase transitions visible | AC-006-01, AC-006-02, AC-006-03 |

---

## 4. Flaky Test Mitigation

| Risk | Mitigation |
|------|------------|
| LLM classification non-determinism | Test descriptions are crafted to be unambiguous; borderline cases tested separately with user override as the safety net |
| Codebase scan returns different results as code changes | Behavioral tests document expected behavior patterns, not exact file lists |
| Artifact format drift | Integration tests validate required sections exist (not exact content) |
| computeStartPhase detection changes | Integration test validates against actual function with crafted meta.json |

---

## 5. Performance Test Plan

| Metric | Target | How Measured |
|--------|--------|--------------|
| Bug classification latency | < 5 seconds | Time from issue fetch to classification presentation |
| Bug-gather total flow | < 60 seconds (excluding user interaction) | Time from dispatch to artifact production |
| Fix handoff response | < 2 seconds | Time from user confirmation to fix workflow invocation |

Performance testing is observational -- measured during behavioral validation, not via automated benchmarks. The targets align with the requirements-spec quality attribute: "Bug detection confirmation takes 1 exchange; gather+playback completes in under 60 seconds."

---

## 6. Security Considerations

| Concern | Mitigation | Test |
|---------|------------|------|
| Issue description may contain malicious content | Agent processes description as text only; no eval/exec | Behavioral: verify agent does not execute code from descriptions |
| Artifact path traversal | Artifact folder path is derived from slug (validated by existing infrastructure) | Existing tests cover path validation |
| Sensitive data in bug reports | Agent should not include credentials/secrets from codebase scans | Behavioral: verify agent redacts sensitive patterns |

---

## 7. Regression Strategy

| Existing Capability | Regression Risk | Validation |
|--------------------|-----------------|-----------|
| Feature analysis via roundtable | Low -- roundtable dispatch path unchanged; bug classification gate is additive | Run existing roundtable scenarios; verify feature-classified items still route to roundtable |
| Fix workflow phase sequence | None -- no changes to workflows.json or phase definitions | Existing fix workflow tests |
| computeStartPhase auto-detection | Low -- existing function unchanged; new artifacts must be compatible | Integration test: crafted meta.json with bug-gather phases_completed |
| Analyze handler for non-GitHub items | None -- bug classification only triggers when issue description is available | Verify slug/description inputs still route to roundtable |

---

## 8. Test Data Requirements

See `test-data-plan.md` for complete test data specifications.

Summary:
- 5 crafted GitHub issue descriptions (bug, feature, mislabeled bug, mislabeled feature, ambiguous)
- 3 sample codebase scan result sets (hits found, no hits, partial hits)
- 2 bug-report.md templates (complete, minimal)
- 2 requirements-spec.md templates (bug variant, feature variant for comparison)
- 3 meta.json variants (with phases_completed, without, partial)

---

## 9. Coverage Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| AC coverage | 100% (24/24 ACs) | Every acceptance criterion has at least one test case (Article VII) |
| FR coverage | 100% (6/6 FRs) | Every functional requirement is tested (Article VII) |
| Error scenario coverage | 100% (7/7 error codes) | Every error from error-taxonomy.md has a test scenario |
| Integration point coverage | 100% (4/4 interfaces) | Every interface from interface-spec.md is validated |
| Code coverage (line/branch) | N/A | No executable code exists for this feature |
| Mutation testing | N/A | No executable code to mutate |

**Note on Article XI (Integration Testing Integrity)**: Mutation testing and code coverage thresholds do not apply to this feature since all changes are prompt-level markdown. Integration testing integrity is satisfied through artifact format validation tests that verify real system behavior (artifact compatibility with tracing orchestrator and computeStartPhase).

---

## 10. Test Commands

```bash
# Integration tests (artifact format validation)
node --test src/claude/hooks/tests/bug-gather-artifact-format.test.cjs

# Full project test suite (regression)
npm test

# Behavioral tests: validated during Phase 16 (quality loop) via scenario walkthrough
```

---

## 11. GATE-04 Checklist

- [x] Test strategy covers unit, integration, E2E, security, performance
- [x] Test cases exist for all requirements (27 test cases across 6 FRs)
- [x] Traceability matrix complete (100% requirement coverage -- 24/24 ACs mapped)
- [x] Coverage targets defined (100% AC, 100% FR, 100% error scenarios)
- [x] Test data strategy documented (test-data-plan.md)
- [x] Critical paths identified (bug classification, artifact compatibility, fix handoff)
