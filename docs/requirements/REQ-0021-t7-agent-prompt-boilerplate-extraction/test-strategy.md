# Test Strategy: T7 Agent Prompt Boilerplate Extraction

**Requirement ID**: REQ-0021
**Phase**: 05-test-strategy
**Created**: 2026-02-17
**Status**: Draft

---

## 1. Strategy Overview

### 1.1 Context

REQ-0021 is a **pure markdown refactoring** that modifies 29 files (1 CLAUDE.md + 28 agent .md files). No executable code (hooks, CLI, config, test files) is changed. Therefore, traditional unit testing and integration testing of new code is not applicable.

The test strategy for this feature is a **verification approach** consisting of automated grep-based content validation, line count verification, content equivalence checks, regression testing of the existing test suite, and structural integrity validation.

### 1.2 Existing Test Infrastructure

**Framework**: Node.js built-in `node:test` + `node:assert/strict` (Node 18+)
**Test Streams**:
- **ESM tests** (`npm test`): `lib/*.test.js` and `lib/utils/*.test.js` -- 632 tests (629 pass, 3 pre-existing failures)
- **CJS hook tests** (`npm run test:hooks`): `src/claude/hooks/tests/*.test.cjs` -- 1608 tests (1607 pass, 1 pre-existing failure)
**Coverage Tool**: None configured (no istanbul/c8 integration)
**Current Coverage**: ~66.7% of reverse-engineered acceptance criteria

### 1.3 Pre-Existing Test Failures (Baseline)

These failures exist BEFORE any REQ-0021 changes and are unrelated to this feature:

| Test | Failure | Suite |
|------|---------|-------|
| TC-E09: README.md contains updated agent count | Expected "48 agents" in README | ESM |
| T43: Template Workflow-First section is subset of CLAUDE.md section | Template consistency check | ESM |
| TC-13-01: Exactly 48 agent markdown files exist | Agent inventory count mismatch | ESM |
| logs info when supervised_review is in reviewing status | Assertion on stderr output | CJS (gate-blocker-extended) |

**Baseline counts**:
- ESM: 632 total, 629 pass, 3 fail
- CJS: 1608 total, 1607 pass, 1 fail
- Combined: 2240 total, 2236 pass, 4 fail

### 1.4 Strategy Adaptation (Markdown-Only Refactoring)

Since **zero executable code** is modified by REQ-0021:

| Standard Test Type | Applicability | Adaptation |
|--------------------|---------------|------------|
| Unit tests | Not applicable | No new code to unit test |
| Integration tests | Not applicable | No new component interactions |
| E2E tests | Not applicable | No new user workflows |
| Security tests | Not applicable | No new attack surface (see architecture Section 8) |
| Performance tests | Replaced by V-001 | Line count / token reduction verification |
| Regression tests | V-004 | Run existing ESM + CJS suites unchanged |
| Content validation | V-002, V-003 | Grep-based duplication and equivalence checks |
| Structural validation | V-005 | Markdown heading hierarchy verification |

---

## 2. Verification Checks (V-001 through V-005)

These are the 5 primary verification checks defined in the requirements (Section 9) and refined in the design spec (Section 4). Each check has exact commands, expected results, and pass/fail criteria.

### 2.1 V-001: Line Count Verification

**Purpose**: Confirm CLAUDE.md stayed within the 120-line growth budget (NFR-006) and that agent files are shorter by the expected amounts (NFR-001).

**Priority**: P0 (Critical) -- confirms the core metric of the feature.

**Pre-refactor baselines** (from design-spec.md Section 5):

| File | Baseline Lines |
|------|---------------|
| `CLAUDE.md` | 148 |
| `00-sdlc-orchestrator.md` | 1752 |
| `discover-orchestrator.md` | 2529 |
| `05-software-developer.md` | 932 |
| `06-integration-tester.md` | 847 |
| `14-upgrade-engineer.md` | 651 |
| `16-quality-loop-engineer.md` | 508 |
| `discover/characterization-test-generator.md` | 477 |
| `discover/artifact-integration.md` | 314 |
| `discover/atdd-bridge.md` | 370 |

**Commands**:
```bash
# CLAUDE.md budget check
wc -l CLAUDE.md
# Expected: ~261 (148 + 113), MUST be <= 268 (148 + 120)

# Agent files -- spot check the largest savings
wc -l src/claude/agents/00-sdlc-orchestrator.md
# Expected: ~1685 (was 1752, removed ~67 lines)

wc -l src/claude/agents/discover-orchestrator.md
# Expected: ~2487 (was 2529, removed ~42 lines)

wc -l src/claude/agents/05-software-developer.md
# Expected: ~915 (was 932, removed ~17 lines)

wc -l src/claude/agents/06-integration-tester.md
# Expected: ~836 (was 847, removed ~11 lines)

wc -l src/claude/agents/14-upgrade-engineer.md
# Expected: ~641 (was 651, removed ~10 lines)

wc -l src/claude/agents/16-quality-loop-engineer.md
# Expected: ~500 (was 508, removed ~8 lines)

wc -l src/claude/agents/discover/characterization-test-generator.md
# Expected: ~468 (was 477, removed ~9 lines)

wc -l src/claude/agents/discover/artifact-integration.md
# Expected: ~305 (was 314, removed ~9 lines)

wc -l src/claude/agents/discover/atdd-bridge.md
# Expected: ~363 (was 370, removed ~7 lines)
```

**Pass criteria**:
- CLAUDE.md: 148 < new_count <= 268
- Each agent file: new_count <= original_count
- Net reduction: sum of all agent reductions minus CLAUDE.md increase >= 29 lines (design spec calculates 67 net)
- CLAUDE.md post-refactor <= 280 lines total (NFR-006 ceiling)

**Traces to**: NFR-001, NFR-006, SM-002

---

### 2.2 V-002: No Remaining Duplication (Grep Sweep)

**Purpose**: Confirm no full copies of extracted content remain in agent files. Only 1-line references should exist. This validates the "single source of truth" property.

**Priority**: P0 (Critical) -- core safety check for the refactoring.

**Negative checks** (must return 0 matches):

```bash
# 1. Full delegation form monorepo blockquote -- expect 0 in agents
grep -r "all file paths are project-scoped. The orchestrator provides project context (project ID" src/claude/agents/
# Expected: 0 results

# 2. Short analysis form monorepo blockquote -- expect 0 in agents
grep -r "scope your analysis to the project path provided in the delegation context" src/claude/agents/
# Expected: 0 results

# 3. Iteration enforcement "never declare task complete while failing" -- expect 0
grep -r "NEVER.*declare.*task complete.*while.*failing" src/claude/agents/
# Expected: 0 results

# 4. Iteration enforcement "never declare task complete while incomplete" -- expect 0
grep -r "NEVER.*declare.*task complete.*while.*incomplete" src/claude/agents/
# Expected: 0 results

# 5. Git commit warning full section -- expect 0
grep -r "Do NOT run.*git add.*git commit.*git push.*during" src/claude/agents/
# Expected: 0 results

# 6. ROOT RESOLUTION full section header -- expect 0
grep -r "ROOT RESOLUTION (Before anything else)" src/claude/agents/
# Expected: 0 results

# 7. SECTION 0 header -- expect 0
grep -r "SECTION 0: PROJECT CONTEXT RESOLUTION" src/claude/agents/
# Expected: 0 results

# 8. MONOREPO PREAMBLE header -- expect 0
grep -r "MONOREPO PREAMBLE (Before fast path check)" src/claude/agents/
# Expected: 0 results
```

**Positive checks** (must return expected counts):

```bash
# 9. Monorepo Mode Protocol references -- expect 20
grep -r "See \*\*Monorepo Mode Protocol\*\*" src/claude/agents/ | wc -l
# Expected: 20 (13 phase + 3 discover + 1 tracing-orch + 1 quick-scan + 1 impact-orch + 1 for overlap)

# 10. Monorepo analysis-scoped references -- expect 7
grep -r "Monorepo Mode Protocol.*analysis-scoped" src/claude/agents/ | wc -l
# Expected: 7

# 11. Iteration Enforcement references -- expect 7
grep -r "Mandatory Iteration Enforcement Protocol" src/claude/agents/ | wc -l
# Expected: 7

# 12. Git Commit Prohibition references -- expect 2
grep -r "Git Commit Prohibition" src/claude/agents/ | wc -l
# Expected: 2

# 13. Root Resolution Protocol references -- expect 2
grep -r "Root Resolution Protocol" src/claude/agents/ | wc -l
# Expected: 2
```

**Pass criteria**: All 8 negative checks return 0 results. All 5 positive checks return expected counts (+/- 0).

**Traces to**: NFR-003, SM-003, SM-004, FR-002, FR-003, FR-004, FR-006, FR-008, FR-011

---

### 2.3 V-003: Content Equivalence

**Purpose**: Confirm every agent still has access to semantically identical protocol content after extraction. Agent-specific criteria (iteration success criteria, max iterations, circuit breaker values) must be preserved.

**Priority**: P0 (Critical) -- behavioral regression prevention.

**Agent-specific checks**:

```bash
# 1. 05-software-developer still sees >=80% COVERAGE
grep "80%" src/claude/agents/05-software-developer.md
# Expected: >= 1 match (in the completion criteria line)

# 2. 06-integration-tester still sees ALL TESTS PASS
grep "ALL TESTS PASS" src/claude/agents/06-integration-tester.md
# Expected: >= 1 match

# 3. 14-upgrade-engineer still sees circuit breaker: 3
grep -i "circuit breaker.*3" src/claude/agents/14-upgrade-engineer.md
# Expected: >= 1 match

# 4. discover/artifact-integration still sees max iterations 5
grep "Max iterations.*5" src/claude/agents/discover/artifact-integration.md
# Expected: >= 1 match

# 5. discover/atdd-bridge still sees max iterations 5
grep "Max iterations.*5" src/claude/agents/discover/atdd-bridge.md
# Expected: >= 1 match

# 6. 16-quality-loop-engineer still sees BOTH tracks pass
grep "BOTH tracks pass" src/claude/agents/16-quality-loop-engineer.md
# Expected: >= 1 match

# 7. characterization-test-generator still sees ALL CHARACTERIZATION TESTS
grep "CHARACTERIZATION TESTS" src/claude/agents/discover/characterization-test-generator.md
# Expected: >= 1 match
```

**CLAUDE.md content checks**:

```bash
# 8. CLAUDE.md contains the root resolution algorithm (walk up parents)
grep -i "walk up parent directories" CLAUDE.md
# Expected: >= 1 match

# 9. CLAUDE.md contains the path routing table
grep "Monorepo Path Routing" CLAUDE.md
# Expected: >= 1 match

# 10. CLAUDE.md contains delegation context template
grep "MONOREPO CONTEXT" CLAUDE.md
# Expected: >= 1 match

# 11. CLAUDE.md contains test-watcher hook reference
grep "test-watcher" CLAUDE.md
# Expected: >= 1 match

# 12. CLAUDE.md contains git commit prohibition
grep "Do NOT run.*git add" CLAUDE.md
# Expected: >= 1 match

# 13. CLAUDE.md contains monorepo full delegation form
grep "all file paths are project-scoped" CLAUDE.md
# Expected: >= 1 match

# 14. CLAUDE.md contains monorepo analysis-scoped form
grep "scope your analysis to the project path" CLAUDE.md
# Expected: >= 1 match

# 15. CLAUDE.md contains iterate-fix-retry structure
grep "NEVER.*declare.*task complete.*phase complete.*while.*failing" CLAUDE.md
# Expected: >= 1 match

# 16. CLAUDE.md contains iteration config hierarchy reference
grep "iteration-requirements.json" CLAUDE.md
# Expected: >= 1 match
```

**Pass criteria**: All 16 checks return >= 1 match.

**Traces to**: NFR-002, SM-001, FR-005 (AC-005-02), FR-006 (AC-006-03, AC-006-04, AC-006-05), FR-009 (AC-009-02), FR-010 (AC-010-02)

---

### 2.4 V-004: Hook Test Suite (Regression)

**Purpose**: Confirm no unexpected regressions in executable code. Since no executable code is modified, the test suite should produce identical results to the pre-refactor baseline.

**Priority**: P0 (Critical) -- safety net for any accidental changes.

**Commands**:
```bash
npm run test:hooks
# Expected: 1608 tests, 1607 pass, 1 fail (pre-existing gate-blocker-extended failure)

npm test
# Expected: 632 tests, 629 pass, 3 fail (pre-existing TC-E09, T43, TC-13-01)
```

**Pass criteria**:
- CJS hook tests: pass count >= 1607, fail count = 1 (the pre-existing gate-blocker-extended failure only)
- ESM tests: pass count >= 629, fail count <= 3 (the pre-existing failures only)
- **No new failures** introduced -- any failure not in the pre-existing list is a regression
- **No new skips** introduced -- skip count must not increase

**Pre-existing failures (known safe)**:
1. `TC-E09: README.md contains updated agent count` (ESM)
2. `T43: Template Workflow-First section is subset of CLAUDE.md section` (ESM)
3. `TC-13-01: Exactly 48 agent markdown files exist` (ESM)
4. `logs info when supervised_review is in reviewing status` (CJS, gate-blocker-extended)

**IMPORTANT NOTE on T43**: The test `T43: Template Workflow-First section is subset of CLAUDE.md section` checks template consistency against CLAUDE.md. Since REQ-0021 adds new sections to CLAUDE.md, this pre-existing failure may change behavior (it might pass or produce a different failure message). If T43 changes, this is expected and not a regression caused by REQ-0021 -- the test was already failing before the refactoring.

**Traces to**: NFR-005, SM-001

---

### 2.5 V-005: Structural Integrity

**Purpose**: Confirm markdown structure is valid after all modifications.

**Priority**: P1 (High) -- ensures readability and correct section hierarchy.

**CLAUDE.md heading hierarchy check**:

```bash
# Extract all headings from CLAUDE.md, verify hierarchy
grep "^#" CLAUDE.md
```

**Expected heading order under `## Agent Framework Context`**:
1. `### SKILL OBSERVABILITY Protocol` (existing)
2. `### SUGGESTED PROMPTS` (existing)
3. `### CONSTITUTIONAL PRINCIPLES Preamble` (existing)
4. `### Root Resolution Protocol` (new)
5. `### Project Context Resolution (Monorepo)` (new)
   - `#### Detection`
   - `#### Project Resolution (Monorepo Mode)`
   - `#### Monorepo Path Routing`
   - `#### Project Context in Delegation`
   - `#### Workflow Independence`
6. `### Monorepo Mode Protocol` (new)
7. `### Mandatory Iteration Enforcement Protocol` (new)
8. `### Git Commit Prohibition` (new)

**Agent file heading hierarchy check**:
```bash
# Verify no orphaned sub-headings in orchestrator files
# (parent headings ROOT RESOLUTION and SECTION 0 were removed)
grep "^##" src/claude/agents/00-sdlc-orchestrator.md | head -10
grep "^##" src/claude/agents/discover-orchestrator.md | head -10
```

**Reference brevity check** (NFR-004):
```bash
# All reference lines should be <= 120 characters
grep -r "See \*\*.*\*\* in CLAUDE.md" src/claude/agents/ | awk -F: '{print length($2), $0}' | sort -rn | head -5
grep -r "Follow the \*\*.*\*\* in CLAUDE.md" src/claude/agents/ | awk -F: '{print length($2), $0}' | sort -rn | head -5
# Expected: all line lengths <= 120
```

**Pass criteria**:
- CLAUDE.md headings are properly nested (no H4 without H3 parent, no H3 without H2 parent)
- New sections appear under `## Agent Framework Context` in the specified order (FR-012, AC-012-01)
- No orphaned sub-headings in modified orchestrator files
- All reference lines <= 120 characters (NFR-004)

**Traces to**: FR-012 (AC-012-01, AC-012-02), NFR-004

---

## 3. Test Case Specifications

### 3.1 Category 1: CLAUDE.md Additions (FR-001, FR-005, FR-007, FR-009, FR-010, FR-012)

| Test ID | Description | Verification | Expected Result | Priority |
|---------|-------------|--------------|-----------------|----------|
| TC-001 | CLAUDE.md contains "Root Resolution Protocol" subsection | V-003 #8 | grep returns >= 1 match | P0 |
| TC-002 | CLAUDE.md contains 5-step root resolution algorithm | V-003 #8 | "walk up parent directories" found | P0 |
| TC-003 | CLAUDE.md contains "Project Context Resolution (Monorepo)" subsection | V-003 #9 | "Monorepo Path Routing" found | P0 |
| TC-004 | CLAUDE.md contains delegation context template | V-003 #10 | "MONOREPO CONTEXT" found | P0 |
| TC-005 | CLAUDE.md contains "Monorepo Mode Protocol" with full form | V-003 #13 | "all file paths are project-scoped" found | P0 |
| TC-006 | CLAUDE.md contains "Monorepo Mode Protocol" with analysis form | V-003 #14 | "scope your analysis to the project path" found | P0 |
| TC-007 | CLAUDE.md contains "Mandatory Iteration Enforcement Protocol" with core rules | V-003 #15 | "NEVER declare" phrase found | P0 |
| TC-008 | CLAUDE.md contains test-watcher hook reference | V-003 #11 | "test-watcher" found | P0 |
| TC-009 | CLAUDE.md contains iteration config hierarchy | V-003 #16 | "iteration-requirements.json" found | P1 |
| TC-010 | CLAUDE.md iteration section has NO agent-specific criteria | grep "80%" CLAUDE.md (iteration section only) | 0 matches in iteration section | P0 |
| TC-011 | CLAUDE.md contains "Git Commit Prohibition" with prohibition text | V-003 #12 | "Do NOT run" + "git add" found | P0 |
| TC-012 | CLAUDE.md line count within budget | V-001 | <= 268 lines (148 + 120) | P0 |
| TC-013 | CLAUDE.md section order matches FR-012 specification | V-005 heading check | Headings in specified order | P1 |

### 3.2 Category 2: Monorepo Blockquote Removal (FR-002, FR-003, FR-004)

| Test ID | Description | Verification | Expected Result | Priority |
|---------|-------------|--------------|-----------------|----------|
| TC-020 | No agent file contains full delegation monorepo blockquote | V-002 #1 | 0 matches | P0 |
| TC-021 | No agent file contains short analysis monorepo blockquote | V-002 #2 | 0 matches | P0 |
| TC-022 | 17+ agents contain full-form Monorepo Mode Protocol reference | V-002 #9 | count ~20 | P0 |
| TC-023 | 7 agents contain analysis-scoped reference | V-002 #10 | count = 7 | P0 |
| TC-024 | quick-scan-agent contains reference | grep in quick-scan-agent.md | 1 match | P1 |
| TC-025 | impact-analysis-orchestrator contains reference | grep in impact-analysis-orchestrator.md | 1 match | P1 |

### 3.3 Category 3: Iteration Enforcement Extraction (FR-005, FR-006)

| Test ID | Description | Verification | Expected Result | Priority |
|---------|-------------|--------------|-----------------|----------|
| TC-030 | No agent file contains full iteration enforcement "never declare while failing" | V-002 #3 | 0 matches | P0 |
| TC-031 | No agent file contains "never declare while incomplete" | V-002 #4 | 0 matches | P0 |
| TC-032 | 7 agents contain Mandatory Iteration Enforcement Protocol reference | V-002 #11 | count = 7 | P0 |
| TC-033 | 05-software-developer retains ">=80% COVERAGE" criteria | V-003 #1 | >= 1 match | P0 |
| TC-034 | 06-integration-tester retains "ALL TESTS PASS" criteria | V-003 #2 | >= 1 match | P0 |
| TC-035 | 14-upgrade-engineer retains "circuit breaker: 3" | V-003 #3 | >= 1 match | P0 |
| TC-036 | discover/artifact-integration retains "max iterations 5" | V-003 #4 | >= 1 match | P0 |
| TC-037 | discover/atdd-bridge retains "max iterations 5" | V-003 #5 | >= 1 match | P0 |
| TC-038 | 16-quality-loop-engineer retains "BOTH tracks pass" | V-003 #6 | >= 1 match | P0 |
| TC-039 | characterization-test-generator retains "CHARACTERIZATION TESTS" | V-003 #7 | >= 1 match | P0 |

### 3.4 Category 4: Git Commit Warning Extraction (FR-007, FR-008)

| Test ID | Description | Verification | Expected Result | Priority |
|---------|-------------|--------------|-----------------|----------|
| TC-040 | No agent file contains full git commit warning section | V-002 #5 | 0 matches | P0 |
| TC-041 | 2 agents contain Git Commit Prohibition reference | V-002 #12 | count = 2 | P0 |
| TC-042 | 05-software-developer has git commit reference | grep in file | 1 match | P1 |
| TC-043 | 16-quality-loop-engineer has git commit reference | grep in file | 1 match | P1 |

### 3.5 Category 5: ROOT RESOLUTION + PROJECT CONTEXT Extraction (FR-009, FR-010, FR-011)

| Test ID | Description | Verification | Expected Result | Priority |
|---------|-------------|--------------|-----------------|----------|
| TC-050 | No agent file contains "ROOT RESOLUTION (Before anything else)" | V-002 #6 | 0 matches | P0 |
| TC-051 | No agent file contains "SECTION 0: PROJECT CONTEXT RESOLUTION" | V-002 #7 | 0 matches | P0 |
| TC-052 | No agent file contains "MONOREPO PREAMBLE" header | V-002 #8 | 0 matches | P0 |
| TC-053 | 2 orchestrators contain Root Resolution Protocol reference | V-002 #13 | count = 2 | P0 |
| TC-054 | 00-sdlc-orchestrator.md has reduced line count (~1685 vs 1752) | V-001 | count < 1752 | P0 |
| TC-055 | discover-orchestrator.md has reduced line count (~2487 vs 2529) | V-001 | count < 2529 | P0 |

### 3.6 Category 6: Regression (NFR-002, NFR-005)

| Test ID | Description | Verification | Expected Result | Priority |
|---------|-------------|--------------|-----------------|----------|
| TC-060 | CJS hook test suite passes with no new failures | V-004 | pass >= 1607, fail = 1 | P0 |
| TC-061 | ESM test suite passes with no new failures | V-004 | pass >= 629, fail <= 3 | P0 |
| TC-062 | No new test skips introduced | V-004 | skip count unchanged | P1 |

### 3.7 Category 7: Section Organization (FR-012)

| Test ID | Description | Verification | Expected Result | Priority |
|---------|-------------|--------------|-----------------|----------|
| TC-070 | CLAUDE.md "Agent Framework Context" contains all 8 subsections | V-005 | All 8 H3 headings present | P0 |
| TC-071 | New sections appear after existing T2 sections | V-005 | Order: existing first, new after | P1 |
| TC-072 | CLAUDE.md total line increase <= 120 | V-001 | new_lines - 148 <= 120 | P0 |
| TC-073 | Reference lines are all <= 120 characters | V-005 brevity check | All lines <= 120 chars | P2 |

---

## 4. Traceability Matrix

### 4.1 Requirements to Test Cases

| Requirement | Test Cases | Coverage |
|-------------|-----------|----------|
| FR-001 (Extract Monorepo Mode to CLAUDE.md) | TC-005, TC-006, TC-013 | Full |
| FR-002 (Remove monorepo from 17 phase agents) | TC-020, TC-022 | Full |
| FR-003 (Remove monorepo from 7 analysis agents) | TC-021, TC-023 | Full |
| FR-004 (Remove monorepo from 2 remaining agents) | TC-020, TC-024, TC-025 | Full |
| FR-005 (Extract Iteration Enforcement to CLAUDE.md) | TC-007, TC-008, TC-009, TC-010 | Full |
| FR-006 (Replace iteration in 7 agents) | TC-030, TC-031, TC-032, TC-033, TC-034, TC-035, TC-036, TC-037, TC-038, TC-039 | Full |
| FR-007 (Extract Git Commit Warning to CLAUDE.md) | TC-011 | Full |
| FR-008 (Remove git commit from 2 agents) | TC-040, TC-041, TC-042, TC-043 | Full |
| FR-009 (Extract ROOT RESOLUTION to CLAUDE.md) | TC-001, TC-002 | Full |
| FR-010 (Extract PROJECT CONTEXT to CLAUDE.md) | TC-003, TC-004 | Full |
| FR-011 (Remove ROOT RESOLUTION + CONTEXT from orchestrators) | TC-050, TC-051, TC-052, TC-053, TC-054, TC-055 | Full |
| FR-012 (Preserve CLAUDE.md section organization) | TC-013, TC-070, TC-071, TC-072 | Full |

### 4.2 NFRs to Test Cases

| NFR | Test Cases | Coverage |
|-----|-----------|----------|
| NFR-001 (Token reduction) | TC-012, TC-054, TC-055, TC-072 | Full |
| NFR-002 (Zero behavioral regression) | TC-033-TC-039, TC-060, TC-061 | Full |
| NFR-003 (Single source of truth) | TC-020, TC-021, TC-030, TC-031, TC-040, TC-050, TC-051, TC-052 | Full |
| NFR-004 (Reference brevity) | TC-073 | Full |
| NFR-005 (Backward compatibility) | TC-060, TC-061, TC-062 | Full |
| NFR-006 (CLAUDE.md size budget) | TC-012, TC-072 | Full |

### 4.3 Success Metrics to Test Cases

| Metric | Test Cases | Coverage |
|--------|-----------|----------|
| SM-001 (Zero behavioral regression) | TC-033-TC-039, TC-060, TC-061 | Full |
| SM-002 (Duplicated lines removed >= 250) | TC-054, TC-055, V-001 aggregate | Full |
| SM-003 (Shared protocols in exactly one location) | TC-020, TC-021, TC-030, TC-040, TC-050, TC-051, TC-052 | Full |
| SM-004 (No full copy of extracted section remains) | TC-020, TC-021, TC-030, TC-031, TC-040, TC-050, TC-051, TC-052 | Full |

### 4.4 Acceptance Criteria to Test Cases

| AC ID | Test Case(s) |
|-------|-------------|
| AC-001-01 | TC-013, TC-070 |
| AC-001-02 | TC-005 |
| AC-001-03 | TC-006 |
| AC-002-01 | TC-020 |
| AC-002-02 | TC-022 |
| AC-003-01 | TC-021 |
| AC-003-02 | TC-023 |
| AC-004-01 | TC-020, TC-024, TC-025 |
| AC-004-02 | TC-024, TC-025 |
| AC-005-01 | TC-007, TC-013, TC-070 |
| AC-005-02 | TC-007, TC-008, TC-009 |
| AC-005-03 | TC-010 |
| AC-006-01 | TC-030, TC-031 |
| AC-006-02 | TC-032 |
| AC-006-03 | TC-033, TC-034, TC-035, TC-036, TC-037, TC-038, TC-039 |
| AC-006-04 | TC-033 |
| AC-006-05 | TC-036 |
| AC-007-01 | TC-011, TC-013, TC-070 |
| AC-007-02 | TC-011 |
| AC-008-01 | TC-040 |
| AC-008-02 | TC-041, TC-042, TC-043 |
| AC-009-01 | TC-001, TC-013, TC-070 |
| AC-009-02 | TC-002 |
| AC-010-01 | TC-003, TC-013, TC-070 |
| AC-010-02 | TC-003, TC-004 |
| AC-011-01 | TC-050, TC-051 |
| AC-011-02 | TC-051 |
| AC-011-03 | TC-050, TC-052 |
| AC-011-04 | TC-052 |
| AC-011-05 | TC-053 |
| AC-012-01 | TC-013, TC-070, TC-071 |
| AC-012-02 | TC-012, TC-072 |

---

## 5. Risk-Based Test Priorities

### 5.1 Priority Classification

| Priority | Count | Criteria |
|----------|-------|----------|
| P0 (Critical) | 36 | Core behavioral regression, single-source-of-truth, content equivalence, regression suite |
| P1 (High) | 8 | Section ordering, individual file spot-checks, skip count stability |
| P2 (Medium) | 1 | Reference brevity |

### 5.2 Risk Assessment

| Risk | Impact | Likelihood | Mitigation Test(s) |
|------|--------|-----------|-------------------|
| Agent loses iteration criteria after extraction | High | Medium | TC-033 through TC-039 |
| CLAUDE.md exceeds size budget | Medium | Low | TC-012, TC-072 |
| Full inline copies remain after refactoring | High | Low | TC-020, TC-021, TC-030, TC-031, TC-040, TC-050-TC-052 |
| Existing test suite regresses | High | Very Low | TC-060, TC-061 |
| ROOT RESOLUTION content lost from CLAUDE.md | High | Very Low | TC-001, TC-002 |
| Heading hierarchy broken in CLAUDE.md | Medium | Low | TC-070, TC-071 |
| Orchestrator agent structure broken | High | Low | TC-050, TC-051, TC-054, TC-055 |
| Git commit prohibition lost | Medium | Low | TC-011, TC-040, TC-041 |

### 5.3 Execution Order

Verification checks should be executed in this order during the quality loop:

1. **V-004 first** -- Run regression suite to confirm no accidental code changes
2. **V-002 second** -- Grep sweep to confirm all removals are complete
3. **V-003 third** -- Content equivalence to confirm all agent-specific criteria preserved
4. **V-001 fourth** -- Line count verification for budget compliance
5. **V-005 last** -- Structural integrity (lowest risk, mostly cosmetic)

---

## 6. Regression Test Plan

### 6.1 Existing Test Suite (No Modifications Required)

Since REQ-0021 modifies zero executable code, the existing test suites require zero modifications and should pass identically to the baseline.

| Suite | Command | Expected | Pre-existing Failures |
|-------|---------|----------|-----------------------|
| CJS Hooks | `npm run test:hooks` | 1607/1608 pass | 1 (gate-blocker-extended) |
| ESM Lib | `npm test` | 629/632 pass | 3 (TC-E09, T43, TC-13-01) |

### 6.2 When to Run Regression

- **After Phase 1 (CLAUDE.md additions)**: Run full suite to confirm no accidental changes
- **After Phase 7 (all agents modified)**: Run full suite as final regression check
- **After Phase 8 (verification)**: Final confirmation

### 6.3 Failure Analysis Protocol

If any NEW test failure appears (not in the pre-existing list):

1. Check if the failing test reads agent .md files directly (some ESM tests like TC-13-01 count agent files)
2. Check if the failing test greps for content that was moved to CLAUDE.md
3. If the failure is caused by content movement, document it as an expected consequence and determine if the test itself needs updating
4. If the failure is caused by accidental code changes, investigate and fix immediately

---

## 7. Test Data Plan

### 7.1 Pre-Refactor Baselines

The following data must be captured BEFORE any implementation changes:

| Data Item | Capture Method | Storage |
|-----------|---------------|---------|
| CLAUDE.md line count | `wc -l CLAUDE.md` | Implementation notes |
| All 28 agent file line counts | `wc -l` on each file | design-spec.md Section 5 (already captured) |
| ESM test pass/fail counts | `npm test` summary | This document Section 1.3 |
| CJS test pass/fail counts | `npm run test:hooks` summary | This document Section 1.3 |
| ESM test skip count | `npm test` summary | Capture during V-004 |
| CJS test skip count | `npm run test:hooks` summary | Capture during V-004 |

### 7.2 Post-Refactor Measurements

| Data Item | Capture Method | Comparison |
|-----------|---------------|-----------|
| CLAUDE.md new line count | `wc -l CLAUDE.md` | Must be <= 268 |
| Agent file new line counts | `wc -l` on each file | Must be <= baseline |
| Net line reduction | Sum of (baseline - new) for all files | Must be >= 29 |
| Grep sweep results | V-002 commands | All negative checks = 0 |
| ESM test results | `npm test` summary | pass >= 629, fail <= 3 |
| CJS test results | `npm run test:hooks` summary | pass >= 1607, fail = 1 |

### 7.3 Test Data Dependencies

This feature requires NO external test data, test databases, or mock services. All verification is performed against the filesystem using grep, wc, and the existing test runners.

---

## 8. Manual Smoke Tests (Post-Deployment)

After implementation is complete and `.claude/agents/` is synced from `src/claude/agents/`, these manual smoke tests validate real agent behavior:

| Smoke Test | Agent | Action | Expected |
|------------|-------|--------|----------|
| SM-01 | 00-sdlc-orchestrator | Run `/isdlc status` | Root resolution works, status displayed |
| SM-02 | 05-software-developer | Start implementation phase | Iteration enforcement triggers |
| SM-03 | 06-integration-tester | Start testing phase | Iteration enforcement triggers |
| SM-04 | 02-solution-architect | Start architecture phase | Monorepo mode guidance accessible |
| SM-05 | discover-orchestrator | Run `/discover` | Root resolution and monorepo preamble work |

These are recommended but not gating -- they require actual workflow execution and are best performed as part of normal development after deployment.

---

## 9. Constitutional Compliance

| Article | Status | Evidence |
|---------|--------|----------|
| Article II (Test-First Development) | Compliant | Test strategy designed during Phase 05, before implementation (Phase 06). 46 test cases defined covering all 12 FRs, 6 NFRs, and 32 ACs. Verification approach adapted for markdown-only refactoring per constitutional requirements. |
| Article VII (Artifact Traceability) | Compliant | Traceability matrix in Section 4 maps every FR, NFR, AC, and success metric to specific test cases. 100% requirement coverage achieved. No orphan tests -- every test case traces to at least one requirement. |
| Article IX (Quality Gate Integrity) | Compliant | GATE-04 checklist validated in Section 10. All required artifacts present and complete. |
| Article XI (Integration Testing Integrity) | Compliant (adapted) | No new component interactions introduced (markdown-only refactoring). Existing integration tests (V-004) validate that component interactions remain unchanged. The "integration" concern here is the CLAUDE.md + agent file concatenation, verified by V-003 content equivalence. |

---

## 10. GATE-04 Validation

### Test Strategy Gate Checklist

- [X] Test strategy covers unit, integration, E2E, security, performance: **Adapted** -- unit/integration/E2E/security are N/A for markdown-only refactoring (documented in Section 1.4). Performance verified via V-001 line count. All verification categories (V-001 through V-005) are covered.
- [X] Test cases exist for all requirements: 46 test cases covering all 12 FRs, 6 NFRs, 4 SMs, and 32 ACs. See Sections 3 and 4.
- [X] Traceability matrix complete (100% requirement coverage): Section 4 provides 4 traceability tables. Every FR, NFR, SM, and AC maps to at least one test case.
- [X] Coverage targets defined: Regression suite must maintain baseline (1607/1608 CJS, 629/632 ESM). No new failures permitted. Line reduction >= 29 net. CLAUDE.md <= 268 lines.
- [X] Test data strategy documented: Section 7 defines pre-refactor baselines, post-refactor measurements, and confirms no external test data dependencies.
- [X] Critical paths identified: Section 5.2 risk assessment identifies 8 risks with corresponding test mitigations. Execution order specified in Section 5.3.

---

## Appendix A: Verification Check Quick Reference

| Check | What It Validates | Commands | Priority |
|-------|-------------------|----------|----------|
| V-001 | Line count budget and reduction | `wc -l` on 10 files | P0 |
| V-002 | No remaining duplication | 8 negative greps + 5 positive greps | P0 |
| V-003 | Content equivalence preserved | 16 targeted greps | P0 |
| V-004 | Regression suite unchanged | `npm run test:hooks` + `npm test` | P0 |
| V-005 | Structural integrity | Heading hierarchy + reference brevity | P1 |

## Appendix B: Complete File Inventory for Verification

### Files to verify (29 total)

**CLAUDE.md** (additions, V-001 + V-003 + V-005):
- `/Users/vihangshah/enactor-code/isdlc/CLAUDE.md`

**Orchestrator agents** (V-001 + V-002 + V-003):
- `src/claude/agents/00-sdlc-orchestrator.md`
- `src/claude/agents/discover-orchestrator.md`

**Multi-boilerplate agents** (V-002 + V-003):
- `src/claude/agents/05-software-developer.md`
- `src/claude/agents/06-integration-tester.md`
- `src/claude/agents/14-upgrade-engineer.md`
- `src/claude/agents/16-quality-loop-engineer.md`

**Discover sub-agents** (V-002 + V-003):
- `src/claude/agents/discover/characterization-test-generator.md`
- `src/claude/agents/discover/artifact-integration.md`
- `src/claude/agents/discover/atdd-bridge.md`

**Single-boilerplate phase agents** (V-002):
- `src/claude/agents/02-solution-architect.md`
- `src/claude/agents/03-system-designer.md`
- `src/claude/agents/04-test-design-engineer.md`
- `src/claude/agents/07-qa-engineer.md`
- `src/claude/agents/08-security-compliance-auditor.md`
- `src/claude/agents/09-cicd-engineer.md`
- `src/claude/agents/10-dev-environment-engineer.md`
- `src/claude/agents/11-deployment-engineer-staging.md`
- `src/claude/agents/12-release-manager.md`
- `src/claude/agents/13-site-reliability-engineer.md`

**Analysis sub-agents** (V-002):
- `src/claude/agents/tracing/execution-path-tracer.md`
- `src/claude/agents/tracing/root-cause-identifier.md`
- `src/claude/agents/tracing/symptom-analyzer.md`
- `src/claude/agents/impact-analysis/impact-analyzer.md`
- `src/claude/agents/impact-analysis/entry-point-finder.md`
- `src/claude/agents/impact-analysis/cross-validation-verifier.md`
- `src/claude/agents/impact-analysis/risk-assessor.md`

**Remaining agents** (V-002):
- `src/claude/agents/tracing/tracing-orchestrator.md`
- `src/claude/agents/quick-scan/quick-scan-agent.md`
- `src/claude/agents/impact-analysis/impact-analysis-orchestrator.md`
