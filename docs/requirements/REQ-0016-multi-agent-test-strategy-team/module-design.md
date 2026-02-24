# Module Design: Multi-agent Test Strategy Team (REQ-0016)

**Version**: 1.0
**Created**: 2026-02-15
**Phase**: 04-design
**Status**: Draft
**Traces**: FR-01 through FR-07, NFR-01 through NFR-04, C-01 through C-04

---

## Table of Contents

1. [Module 1: Test Strategy Critic Agent](#module-1-test-strategy-critic-agent)
2. [Module 2: Test Strategy Refiner Agent](#module-2-test-strategy-refiner-agent)
3. [Module 3: Creator Awareness in test-design-engineer](#module-3-creator-awareness-in-test-design-engineer)
4. [Module 4: Orchestrator DEBATE_ROUTING Extension](#module-4-orchestrator-debate_routing-extension)
5. [Module 5: Skills Manifest Update](#module-5-skills-manifest-update)
6. [Module 6: isdlc.md Documentation Update](#module-6-isdlcmd-documentation-update)
7. [Module 7: Test File Design](#module-7-test-file-design)
8. [Cross-Module Dependencies](#cross-module-dependencies)
9. [Implementation Order](#implementation-order)

---

## Module 1: Test Strategy Critic Agent

### Overview

| Attribute | Value |
|-----------|-------|
| File | `src/claude/agents/04-test-strategy-critic.md` |
| Type | CREATE (new file) |
| Responsibility | Review Phase 05 test strategy artifacts for defects using 8 mandatory checks |
| Invoked By | Orchestrator only (C-03) |
| Pattern Source | `src/claude/agents/03-design-critic.md` |
| Estimated Size | 300-400 lines |
| Traces | FR-01, FR-02, C-01, C-03, NFR-01, NFR-02 |

### Frontmatter Structure

The agent file must begin with YAML frontmatter matching the established critic pattern.

```yaml
---
name: test-strategy-critic
description: "Use this agent for reviewing Phase 05 test strategy artifacts
  during the debate loop. This agent acts as the Critic role, reviewing
  Creator output for untested acceptance criteria, incomplete test pyramids,
  missing negative tests, test data gaps, flaky test risk, untested error paths,
  missing performance tests, and orphan test cases.
  Produces a structured critique report with BLOCKING and WARNING findings.

  This agent is ONLY invoked by the orchestrator during debate mode.
  It should NOT be invoked directly by users."
model: opus
owned_skills:
  - TEST-002  # test-case-design
  - TEST-004  # traceability-management
  - TEST-005  # prioritization
---
```

**Design decisions**:
- `name`: Uses `test-strategy-critic` (kebab-case, matches pattern `{domain}-critic`)
- `model`: `opus` (all debate team agents use Opus for thoroughness per NFR-02)
- `owned_skills`: Subset of test-design-engineer's TEST-* skills (per ADR-0006). TEST-002 (test-case-design) for evaluating test case quality, TEST-004 (traceability-management) for checking AC-to-test mapping, TEST-005 (prioritization) for assessing test priority balance
- `description`: Mentions all 8 check categories and BLOCKING/WARNING findings
- File prefix `04-`: Matches Creator agent prefix per ADR-0005

### Agent Structure

The agent body follows the established Critic pattern from `03-design-critic.md`:

```
# TEST STRATEGY CRITIC -- REVIEW ROLE

## IDENTITY
> "I am a meticulous test strategy reviewer..."

## INPUT
- DEBATE_CONTEXT: { round: N }
- All Phase 05 artifacts (4 files)
- requirements-spec.md (for AC cross-reference)
- error-taxonomy.md (for TC-06)
- nfr-matrix.md (for TC-07)

## CRITIQUE PROCESS

### Step 1: Read All Artifacts
### Step 2: Mandatory Checks (8 Categories) -- TC-01 through TC-08
### Step 3: Constitutional Compliance Checks
### Step 4: Compute Test Strategy Metrics
### Step 5: Produce Critique Report

## OUTPUT FORMAT
round-{N}-critique.md

## RULES
```

### Step 2 Detail: 8 Mandatory Checks

Each check follows a consistent structure: Check ID, Category name, BLOCKING condition, artifact to examine, and an example finding.

#### TC-01: UNTESTED_ACCEPTANCE_CRITERION (BLOCKING)

**What the Critic does**:
1. Read `requirements-spec.md` and extract all AC identifiers (AC-NN.N pattern)
2. Read `traceability-matrix.csv` and extract all AC identifiers in the "Requirement" column
3. Compute: `untested_ACs = ACs_in_requirements - ACs_in_traceability_matrix`
4. For each untested AC, produce a BLOCKING finding

**Example finding**:
```
### B-001: Untested Acceptance Criterion AC-02.3

**Target:** traceability-matrix.csv
**Category:** TC-01: UNTESTED_ACCEPTANCE_CRITERION
**Issue:** AC-02.3 (Missing negative tests check) from requirements-spec.md
  has no corresponding test case in the traceability matrix.
**Recommendation:** Add a test case that validates: "Given test-cases/ are
  reviewed, When any requirement has only positive-path test cases, Then
  TC-03 finding is produced."
```

#### TC-02: INCOMPLETE_TEST_PYRAMID (BLOCKING)

**What the Critic does**:
1. Read `test-strategy.md` and identify the test pyramid section
2. Count distinct test levels mentioned (unit, integration, E2E, performance, security, etc.)
3. If fewer than 2 levels are present, produce a BLOCKING finding

**Example finding**:
```
### B-002: Incomplete Test Pyramid

**Target:** test-strategy.md, section "Test Pyramid"
**Category:** TC-02: INCOMPLETE_TEST_PYRAMID
**Issue:** The test pyramid defines only unit tests. No integration or E2E
  test level is specified. A single-level pyramid provides no validation of
  component interactions or end-to-end workflows.
**Recommendation:** Add at least one additional test level (integration
  recommended for component-interaction validation). Define proportions,
  e.g., 70% unit / 20% integration / 10% E2E.
```

#### TC-03: MISSING_NEGATIVE_TESTS (BLOCKING)

**What the Critic does**:
1. Read `test-cases/` directory and categorize each test case as positive or negative
2. Group test cases by requirement ID (from traceability matrix)
3. For each requirement that has ONLY positive-path test cases, produce a BLOCKING finding

**Positive test indicators**: "should succeed", "valid input", "happy path", "successful"
**Negative test indicators**: "should fail", "invalid input", "error", "reject", "boundary", "missing"

#### TC-04: TEST_DATA_GAPS (BLOCKING)

**What the Critic does**:
1. Read `test-data-plan.md` and identify data categories
2. For each validated field in the system (from validation-rules.json or requirements), check:
   - Boundary values defined (min, max, min+1, max-1)?
   - Empty/null inputs defined?
   - Invalid type inputs defined?
   - Maximum-size inputs defined?
3. For each gap found, produce a BLOCKING finding

#### TC-05: FLAKY_TEST_RISK (BLOCKING)

**What the Critic does**:
1. Read `test-strategy.md` and `test-cases/` for flaky test risk indicators
2. Check for:
   - Timing-dependent assertions (setTimeout, sleep, "wait for N ms")
   - External service calls without mocking or isolation strategy
   - Random data generation without seed control
   - Shared mutable state across test cases (global variables, shared DB)
3. For each unmitigated flaky risk, produce a BLOCKING finding
4. Mitigated risks (documented timeout strategy, retry logic, deterministic seeds) are NOT flagged

#### TC-06: UNTESTED_ERROR_PATHS (BLOCKING)

**What the Critic does**:
1. Read `error-taxonomy.md` (if present in `docs/common/`)
2. Extract all error codes/categories
3. Cross-reference with `test-cases/` to check for test coverage of each error path
4. For each untested error path, produce a BLOCKING finding
5. If `error-taxonomy.md` does not exist, document "TC-06: Not applicable (no error taxonomy present)" and do NOT produce a finding

#### TC-07: MISSING_PERFORMANCE_TESTS (BLOCKING)

**What the Critic does**:
1. Read `nfr-matrix.md` (if present in `docs/requirements/{artifact_folder}/`)
2. Extract NFRs with quantified metrics (response time, throughput, concurrency limits)
3. Check if `test-strategy.md` has a performance/load/benchmark test plan for each quantified NFR
4. For each NFR without a corresponding performance test plan, produce a BLOCKING finding
5. If `nfr-matrix.md` does not exist or has no quantified NFRs, document "TC-07: Not applicable (no quantified NFRs)" and do NOT produce a finding

#### TC-08: ORPHAN_TEST_CASE (WARNING)

**What the Critic does**:
1. Read `traceability-matrix.csv`
2. Find test cases where the "Requirement" column is empty, "N/A", or references a non-existent requirement
3. For each orphan test case, produce a WARNING finding (not BLOCKING per AC-02.8)

### Step 3: Constitutional Compliance Checks

The Critic also checks constitutional articles applicable to test strategy:

| Article | Check | Severity |
|---------|-------|----------|
| Article II (Test-First Development) | Tests designed before implementation | BLOCKING if no test strategy |
| Article VII (Artifact Traceability) | All tests trace to requirements | BLOCKING if orphan tests (overlaps TC-08 but at Article level) |
| Article IX (Quality Gate Integrity) | All required Phase 05 artifacts present | BLOCKING if missing |
| Article XI (Integration Testing Integrity) | Integration tests validate real behavior | BLOCKING if only mocked |

### Step 4: Test Strategy Metrics

Calculate and include in Summary:

| Metric | Definition |
|--------|-----------|
| AC Coverage Percent | (ACs with test cases / total ACs) * 100 |
| Test Pyramid Levels | Count of distinct test levels |
| Negative Test Ratio | Negative test cases / total test cases |
| Flaky Risk Count | Number of unmitigated flaky test risks |
| Error Path Coverage | (Error paths with tests / total error paths) * 100 |

### Output Format

```markdown
# Round {N} Critique Report

**Round:** {N}
**Phase:** 05-test-strategy
**Reviewed At:** {ISO timestamp}
**Artifacts Reviewed:**
- test-strategy.md (Round {N} Draft)
- test-cases/
- traceability-matrix.csv
- test-data-plan.md

## Summary

| Metric | Value |
|--------|-------|
| Total Findings | {X} |
| BLOCKING | {Y} |
| WARNING | {Z} |
| AC Coverage Percent | {P}% |
| Test Pyramid Levels | {L} |
| Negative Test Ratio | {R} |
| Flaky Risk Count | {F} |
| Error Path Coverage | {E}% |

## BLOCKING Findings

### B-{NNN}: {Short Title}
...

## WARNING Findings

### W-{NNN}: {Short Title}
...
```

### Rules

1. NEVER produce zero findings on Round 1. The Creator's first draft always has room for improvement.
2. NEVER inflate severity. WARNING stays WARNING.
3. ALWAYS reference specific artifacts and sections in findings.
4. ALWAYS provide concrete recommendations (not "fix this").
5. ALWAYS include summary counts AND test strategy metrics.
6. The critique report is the ONLY output -- do not modify input artifacts.
7. Cross-reference requirements-spec.md for Article I and Article VII checks.
8. TC-06 and TC-07 gracefully handle missing optional artifacts (error-taxonomy.md, nfr-matrix.md).

---

## Module 2: Test Strategy Refiner Agent

### Overview

| Attribute | Value |
|-----------|-------|
| File | `src/claude/agents/04-test-strategy-refiner.md` |
| Type | CREATE (new file) |
| Responsibility | Address Critic findings and produce improved Phase 05 artifacts |
| Invoked By | Orchestrator only (C-03) |
| Pattern Source | `src/claude/agents/03-design-refiner.md` |
| Estimated Size | 200-300 lines |
| Traces | FR-03, C-01, C-03, NFR-01 |

### Frontmatter Structure

```yaml
---
name: test-strategy-refiner
description: "Use this agent for refining Phase 05 test strategy artifacts
  during the debate loop. This agent acts as the Refiner role, taking
  Creator's artifacts and Critic's findings to produce improved artifacts
  with all BLOCKING findings addressed. Enforces complete AC coverage,
  balanced test pyramid, comprehensive negative tests, and thorough test data.

  This agent is ONLY invoked by the orchestrator during debate mode.
  It should NOT be invoked directly by users."
model: opus
owned_skills:
  - TEST-001  # test-strategy
  - TEST-002  # test-case-design
  - TEST-003  # test-data
  - TEST-004  # traceability-management
  - TEST-005  # prioritization
---
```

**Design decisions**:
- `owned_skills`: Broader subset than Critic (5 vs 3) because the Refiner actively modifies all artifact types (strategy, cases, data, traceability, prioritization)
- File prefix `04-`: Matches Creator prefix per ADR-0005

### Agent Structure

```
# TEST STRATEGY REFINER -- IMPROVEMENT ROLE

## IDENTITY
> "I am a precision test strategist..."

## INPUT
- DEBATE_CONTEXT: { round: N }
- All current Phase 05 artifacts
- Critic's findings: round-{N}-critique.md
- requirements-spec.md
- error-taxonomy.md (for TC-06 fixes)
- nfr-matrix.md (for TC-07 fixes)

## REFINEMENT PROCESS

### Step 1: Parse Critique
### Step 2: Address BLOCKING Findings (Mandatory)
### Step 3: Address WARNING Findings (Best Effort)
### Step 4: Escalation
### Step 5: Produce Updated Artifacts
### Step 6: Append Change Log

## RULES
```

### Step 2 Detail: Fix Strategies

| # | Finding Category | Fix Strategy | Target Artifact |
|---|-----------------|-------------|----------------|
| 1 | TC-01: Untested AC | Add test case for each untested AC using Given/When/Then format; update traceability matrix | test-cases/, traceability-matrix.csv |
| 2 | TC-02: Incomplete pyramid | Add missing test levels with rationale and proportions; define execution strategy per level | test-strategy.md |
| 3 | TC-03: Missing negative tests | Add negative/error test cases for each requirement; ensure at least 1 negative per requirement | test-cases/ |
| 4 | TC-04: Test data gaps | Add boundary values (min, max, min+1, max-1), empty inputs, invalid types, max-size inputs for each field | test-data-plan.md |
| 5 | TC-05: Flaky test risk | Add mitigation: deterministic seeds, test isolation, timeout strategies, mock external services in unit tests | test-strategy.md |
| 6 | TC-06: Untested error paths | Add error path test cases for each error code in error-taxonomy.md | test-cases/ |
| 7 | TC-07: Missing perf tests | Add performance test plan for each NFR with quantified metric; define load profiles and acceptance thresholds | test-strategy.md |
| 8 | TC-08: Orphan test case | Map to requirement if identifiable; mark as "exploratory" if not; update traceability matrix | traceability-matrix.csv |
| 9 | Constitutional violations | Trace orphan tests to requirements, add missing artifacts, resolve [UNKNOWN] markers | Various |

### Step 4: Escalation Protocol

When a BLOCKING finding CANNOT be resolved without user input:

1. Mark the affected section with `[NEEDS CLARIFICATION]`
2. Add the specific question: "[NEEDS CLARIFICATION] B-NNN: {question about what is needed}"
3. Document in change log: "B-NNN: Escalated -- requires user input on {question}"
4. This counts as "addressed" for convergence purposes (the debate loop does not loop forever on unresolvable findings)

### Change Log Format

Appended to the bottom of `test-strategy.md`:

```markdown
## Changes in Round {N}

**Round:** {N}
**Refiner Action:** {ISO timestamp}
**Findings Addressed:** {X} BLOCKING, {Y} WARNING

| Finding | Severity | Action | Target | Description |
|---------|----------|--------|--------|-------------|
| B-001 | BLOCKING | Added test case | test-cases/ | Added TC for AC-02.3 |
| B-002 | BLOCKING | Extended pyramid | test-strategy.md | Added integration level |
| W-001 | WARNING | Mapped to requirement | traceability-matrix.csv | Linked orphan TC-42 to FR-03 |
| W-003 | WARNING | Skipped | - | Exploratory test, no mapping needed |
```

### Rules

1. NEVER remove existing test cases or strategy decisions. Only add, modify, or clarify.
2. NEVER introduce new scope. Only address findings from the Critic's report.
3. ALWAYS preserve existing file structure (test-cases/ directory structure stays the same).
4. ALWAYS document every change in the change log.
5. EVERY untested AC (TC-01) must have a concrete test case in the output.
6. EVERY missing negative test (TC-03) must have a specific error/boundary test case.
7. EVERY test data gap (TC-04) must have explicit boundary values defined.
8. If in doubt, escalate with [NEEDS CLARIFICATION] rather than guessing (Article IV).

---

## Module 3: Creator Awareness in test-design-engineer

### Overview

| Attribute | Value |
|-----------|-------|
| File | `src/claude/agents/04-test-design-engineer.md` |
| Type | MODIFY (additive -- new section) |
| Responsibility | Add DEBATE_CONTEXT mode detection to existing agent |
| Pattern Source | `src/claude/agents/01-requirements-analyst.md` lines 28-98 |
| Estimated Lines Added | 40-60 lines |
| Traces | FR-05, AC-05.1 through AC-05.4 |

### Change Description

Insert two new sections into the existing `04-test-design-engineer.md` agent file:
1. An **Invocation Protocol** section (before the main agent content)
2. A **Debate Mode Behavior** section (after the Invocation Protocol)

These sections are modeled exactly on the `01-requirements-analyst.md` pattern.

### Section 1: Invocation Protocol (Insert at line ~17, after frontmatter)

```markdown
# INVOCATION PROTOCOL FOR ORCHESTRATOR

**IMPORTANT FOR ORCHESTRATOR/CALLER**: When invoking this agent, include these
instructions in the Task prompt to enforce debate behavior:

## Mode Detection

Check the Task prompt for a DEBATE_CONTEXT block:

IF DEBATE_CONTEXT is present:
  - You are the CREATOR in a multi-agent debate loop
  - Read DEBATE_CONTEXT.round for the current round number
  - Read DEBATE_CONTEXT.prior_critique for Refiner's improvements (round > 1)
  - Label all artifacts as "Round {N} Draft" in metadata
  - DO NOT present the final "Save artifacts" menu -- the orchestrator manages saving
  - Produce artifacts optimized for review: clear requirement IDs, explicit section
    markers matching TC-01..TC-08 check categories

IF DEBATE_CONTEXT is NOT present:
  - Single-agent mode (current behavior preserved exactly)
  - Proceed with standard Phase 05 workflow
```

### Section 2: Debate Mode Behavior (Insert after Invocation Protocol)

```markdown
# DEBATE MODE BEHAVIOR

When DEBATE_CONTEXT is present in the Task prompt:

## Round Labeling
- Add "Round {N} Draft" to the metadata header of each artifact:
  - test-strategy.md: `**Round:** {N} Draft`
  - test-cases/: Header comment `# Round {N} Draft` in each test case file
  - traceability-matrix.csv: Column header includes `Round-{N}-Draft`
  - test-data-plan.md: `**Round:** {N} Draft`

## Artifact Optimization for Review (Section Markers)
- test-strategy.md MUST include these section headers (matching Critic check IDs):
  - "## Test Pyramid" (for TC-02 review)
  - "## Flaky Test Mitigation" (for TC-05 review)
  - "## Performance Test Plan" (for TC-07 review)
- test-cases/ MUST tag each test case with:
  - Requirement ID (FR-NN, AC-NN.N) for TC-01 traceability
  - Test type: positive | negative (for TC-03 review)
- traceability-matrix.csv MUST include explicit columns:
  - Requirement, AC, Test Case, Test Type, Priority
- test-data-plan.md MUST include sections for:
  - "## Boundary Values" (for TC-04 review)
  - "## Invalid Inputs" (for TC-04 review)
  - "## Maximum-Size Inputs" (for TC-04 review)

## Skip Final Save Menu
- Do NOT present the final save/revise menu
- End with: "Round {N} artifacts produced. Awaiting review."

## Round > 1 Behavior
When DEBATE_CONTEXT.round > 1 and DEBATE_CONTEXT.prior_critique exists:
- Read the Refiner's updated artifacts as the baseline
- The user has NOT been re-consulted -- do not re-ask discovery questions
- Produce updated artifacts that build on the Refiner's improvements
- Maintain all prior round improvements
```

### Preservation of Single-Agent Mode

**Critical design constraint** (AC-05.3): When DEBATE_CONTEXT is NOT present, the agent MUST behave exactly as it does today. The entire DEBATE MODE BEHAVIOR section is guarded by the mode detection condition. No other sections of the agent are modified.

Sections that remain unchanged:
- PHASE OVERVIEW
- PRE-PHASE CHECK: EXISTING TEST INFRASTRUCTURE
- CONSTITUTIONAL PRINCIPLES
- CORE RESPONSIBILITIES
- SKILLS AVAILABLE
- REQUIRED ARTIFACTS
- PHASE GATE VALIDATION
- OUTPUT STRUCTURE
- ATDD MODE
- PARALLEL TEST CREATION
- AUTONOMOUS CONSTITUTIONAL ITERATION
- PROGRESS TRACKING
- PLAN INTEGRATION PROTOCOL
- SELF-VALIDATION
- SUGGESTED PROMPTS

### Risk Mitigation

This is the highest-risk modification (per impact analysis). Mitigation:
1. The new sections are additive (inserted, not replacing existing content)
2. Single-agent mode is the default fallback (no DEBATE_CONTEXT = no change)
3. The pattern is identical to `01-requirements-analyst.md` (proven)
4. Tests will validate both modes (AC-07.4)

---

## Module 4: Orchestrator DEBATE_ROUTING Extension

### Overview

| Attribute | Value |
|-----------|-------|
| File | `src/claude/agents/00-sdlc-orchestrator.md` |
| Type | MODIFY (1 row addition to markdown table) |
| Responsibility | Add Phase 05-test-strategy to DEBATE_ROUTING table |
| Lines Affected | ~3 lines (1 table row + note about Phase 05) |
| Location | Line ~1035 (after the existing 3 table rows) |
| Traces | FR-04, AC-04.1 through AC-04.4 |

### Exact Change

Add one row to the DEBATE_ROUTING table after the existing `04-design` row:

```
| 05-test-strategy | 04-test-design-engineer.md | 04-test-strategy-critic.md | 04-test-strategy-refiner.md | test-strategy.md, test-cases/, traceability-matrix.csv, test-data-plan.md | test-strategy.md |
```

### Resulting Table (4 rows)

```markdown
DEBATE_ROUTING:

| Phase Key | Creator Agent | Critic Agent | Refiner Agent | Phase Artifacts | Critical Artifact |
|-----------|--------------|-------------|--------------|----------------|------------------|
| 01-requirements | 01-requirements-analyst.md | 01-requirements-critic.md | 01-requirements-refiner.md | requirements-spec.md, user-stories.json, nfr-matrix.md, traceability-matrix.csv | requirements-spec.md |
| 03-architecture | 02-solution-architect.md | 02-architecture-critic.md | 02-architecture-refiner.md | architecture-overview.md, tech-stack-decision.md, database-design.md, security-architecture.md | architecture-overview.md |
| 04-design | 03-system-designer.md | 03-design-critic.md | 03-design-refiner.md | interface-spec.yaml, module-designs/, error-taxonomy.md, validation-rules.json | interface-spec.yaml |
| 05-test-strategy | 04-test-design-engineer.md | 04-test-strategy-critic.md | 04-test-strategy-refiner.md | test-strategy.md, test-cases/, traceability-matrix.csv, test-data-plan.md | test-strategy.md |
```

### Why No Code Changes

The orchestrator's existing lookup logic handles this automatically:
- `IF current_phase IN DEBATE_ROUTING` -- the lookup is a string match against the phase key
- Adding a new row with key `05-test-strategy` is sufficient
- No changes to the debate engine, convergence detection, round lifecycle, or escalation logic

### Additional Documentation Update

Update the line at the bottom of Section 7.5 that currently reads:
```
Phase 06 is ONLY in IMPLEMENTATION_ROUTING. Phases 01/03/04 are ONLY in DEBATE_ROUTING.
```
To:
```
Phase 06 is ONLY in IMPLEMENTATION_ROUTING. Phases 01/03/04/05 are ONLY in DEBATE_ROUTING.
```

---

## Module 5: Skills Manifest Update

### Overview

| Attribute | Value |
|-----------|-------|
| File | `src/claude/hooks/config/skills-manifest.json` |
| Type | MODIFY (add 2 agent entries) |
| Lines Added | ~20 lines (2 agent blocks) |
| Location | In the `agents` section, after the existing agent entries |
| Traces | FR-06, AC-06.1 through AC-06.4, C-02, ADR-0006, ADR-0007 |

### New Agent Entries

Insert the following two entries into the `agents` object in skills-manifest.json:

```json
"test-strategy-critic": {
  "agent_id": "04",
  "phase": "05-test-strategy",
  "skill_count": 3,
  "skills": ["TEST-002", "TEST-004", "TEST-005"]
},
"test-strategy-refiner": {
  "agent_id": "04",
  "phase": "05-test-strategy",
  "skill_count": 5,
  "skills": ["TEST-001", "TEST-002", "TEST-003", "TEST-004", "TEST-005"]
}
```

### Invariants to Maintain

| Property | Before | After | Change |
|----------|--------|-------|--------|
| total_skills | 242 | 242 | No change (ADR-0006) |
| total_agents | 20 | 22 | +2 |
| skill_owners map | Unchanged | Unchanged | No new entries (primary_owner stays test-design-engineer) |
| Skill IDs | TEST-001..TEST-017 | TEST-001..TEST-017 | No new IDs created |

### Placement Decision (ADR-0007)

Per ADR-0007, only the Phase 05 critic/refiner are added to the manifest. The existing 6 critic/refiner agents from Phases 01, 03, 04 are NOT retroactively added. This is a known consistency divergence, deferred to a separate backlog item.

### Validation

The `skill-validator` hook reads the manifest at runtime. Adding new agent entries is consumed automatically with no hook code changes needed. The existing test suite (`test-skill-validator.test.cjs`) validates agent registration format -- the new entries must conform to the existing schema:
- `agent_id`: 2-character string
- `phase`: valid phase key
- `skill_count`: integer matching skills array length
- `skills`: array of existing skill IDs

---

## Module 6: isdlc.md Documentation Update

### Overview

| Attribute | Value |
|-----------|-------|
| File | `src/claude/commands/isdlc.md` |
| Type | MODIFY (text update only) |
| Lines Affected | 2-3 lines (~line 276-279) |
| Traces | Implicit (documentation alignment) |

### Exact Change

Find the text:
```
The debate loop currently supports Phase 01 (Requirements), Phase 03 (Architecture), and Phase 04 (Design).
```

Replace with:
```
The debate loop currently supports Phase 01 (Requirements), Phase 03 (Architecture), Phase 04 (Design), and Phase 05 (Test Strategy).
```

### Impact

This is a documentation-only change with zero behavioral impact. It aligns the command documentation with the actual DEBATE_ROUTING table entries.

---

## Module 7: Test File Design

### Overview

| Attribute | Value |
|-----------|-------|
| File | `src/claude/hooks/tests/test-strategy-debate-team.test.cjs` |
| Type | CREATE (new file) |
| Framework | `node:test` + `node:assert/strict` (CJS) |
| Pattern Source | `src/claude/hooks/tests/tasks-format-validation.test.cjs` |
| Estimated Tests | 25-35 test cases |
| Traces | FR-07, AC-07.1 through AC-07.6 |

### File Structure

```javascript
/**
 * Tests for Multi-agent Test Strategy Team (REQ-0016)
 * Validates the debate team agents, orchestrator routing, and skills manifest.
 *
 * Traces: FR-01 through FR-07, NFR-01, NFR-04
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

// File paths
const AGENTS_DIR = join(__dirname, '..', '..', 'agents');
const CRITIC_FILE = join(AGENTS_DIR, '04-test-strategy-critic.md');
const REFINER_FILE = join(AGENTS_DIR, '04-test-strategy-refiner.md');
const CREATOR_FILE = join(AGENTS_DIR, '04-test-design-engineer.md');
const ORCHESTRATOR_FILE = join(AGENTS_DIR, '00-sdlc-orchestrator.md');
const MANIFEST_FILE = join(__dirname, '..', 'config', 'skills-manifest.json');
```

### Test Group 1: Critic Agent Validation (AC-07.1)

| # | Test Name | Assertion |
|---|-----------|-----------|
| 1 | `critic agent file exists` | File at CRITIC_FILE is readable |
| 2 | `critic frontmatter has name: test-strategy-critic` | YAML name field matches |
| 3 | `critic frontmatter has model: opus` | YAML model field matches |
| 4 | `critic frontmatter has owned_skills with TEST-* IDs` | owned_skills contains TEST-002, TEST-004, TEST-005 |
| 5 | `critic documents all 8 mandatory checks TC-01 through TC-08` | Content contains TC-01, TC-02, ..., TC-08 |
| 6 | `critic output format matches round-{N}-critique.md` | Content references `round-{N}-critique.md` pattern |
| 7 | `critic classifies TC-01 through TC-07 as BLOCKING` | Each TC-01..07 appears with BLOCKING label |
| 8 | `critic classifies TC-08 as WARNING` | TC-08 appears with WARNING label |
| 9 | `critic description mentions orchestrator-only invocation` | Description contains "ONLY invoked by the orchestrator" |

### Test Group 2: Refiner Agent Validation (AC-07.2)

| # | Test Name | Assertion |
|---|-----------|-----------|
| 10 | `refiner agent file exists` | File at REFINER_FILE is readable |
| 11 | `refiner frontmatter has name: test-strategy-refiner` | YAML name field matches |
| 12 | `refiner frontmatter has model: opus` | YAML model field matches |
| 13 | `refiner frontmatter has owned_skills with TEST-* IDs` | owned_skills contains TEST-001..005 |
| 14 | `refiner documents fix strategies for each TC-NN category` | Content references TC-01 through TC-08 fix strategies |
| 15 | `refiner documents change log format` | Content contains "Changes in Round" or "Change Log" |
| 16 | `refiner documents [NEEDS CLARIFICATION] escalation` | Content contains "[NEEDS CLARIFICATION]" |
| 17 | `refiner documents artifact update rules` | Content references in-place updates to Phase 05 artifacts |

### Test Group 3: Orchestrator DEBATE_ROUTING Validation (AC-07.3)

| # | Test Name | Assertion |
|---|-----------|-----------|
| 18 | `DEBATE_ROUTING table has 05-test-strategy row` | Line matching `\| 05-test-strategy` exists |
| 19 | `Phase 05 Creator maps to 04-test-design-engineer.md` | Same line contains `04-test-design-engineer.md` |
| 20 | `Phase 05 Critic maps to 04-test-strategy-critic.md` | Same line contains `04-test-strategy-critic.md` |
| 21 | `Phase 05 Refiner maps to 04-test-strategy-refiner.md` | Same line contains `04-test-strategy-refiner.md` |
| 22 | `Phase 05 artifacts include test-strategy.md and test-cases/` | Same line contains expected artifact list |
| 23 | `Phase 05 critical artifact is test-strategy.md` | Last column of Phase 05 row is `test-strategy.md` |

### Test Group 4: Creator Awareness Validation (AC-07.4)

| # | Test Name | Assertion |
|---|-----------|-----------|
| 24 | `test-design-engineer has DEBATE_CONTEXT mode detection` | Content contains "DEBATE_CONTEXT" |
| 25 | `test-design-engineer documents Round labeling` | Content contains "Round {N} Draft" or "Round labeling" |
| 26 | `test-design-engineer preserves single-agent fallback` | Content contains "single-agent mode" and "current behavior preserved" |
| 27 | `test-design-engineer documents section markers for Critic` | Content references section markers or check categories |

### Test Group 5: Skills Manifest Validation (AC-07.5)

| # | Test Name | Assertion |
|---|-----------|-----------|
| 28 | `manifest has test-strategy-critic agent entry` | JSON agents object has key "test-strategy-critic" |
| 29 | `manifest has test-strategy-refiner agent entry` | JSON agents object has key "test-strategy-refiner" |
| 30 | `critic skills are TEST-002, TEST-004, TEST-005` | Agent entry skills array matches |
| 31 | `refiner skills are TEST-001..TEST-005` | Agent entry skills array matches |
| 32 | `total_skills count unchanged` | meta.total_skills equals expected (242) |
| 33 | `no duplicate skill IDs in manifest` | All skill IDs across all agents are unique per agent |

### Test Group 6: Regression Validation (AC-07.6)

| # | Test Name | Assertion |
|---|-----------|-----------|
| 34 | `existing debate routing entries are unchanged` | 01-requirements, 03-architecture, 04-design rows still present |

### Implementation Notes

- All file reads use `readFileSync` with `utf-8` encoding (CJS pattern)
- Frontmatter parsing: Use regex `---\n([\s\S]*?)\n---` to extract YAML block, then pattern-match fields
- The test file does NOT parse YAML (no yaml dependency in CJS hooks) -- it uses regex for field extraction
- JSON manifest is parsed with `JSON.parse(readFileSync(...))`
- Test IDs follow the existing convention: describe group + sequential `it` blocks

---

## Cross-Module Dependencies

```
Module 4 (Orchestrator DEBATE_ROUTING)
    |
    |--> References Module 1 (Critic agent file)
    |--> References Module 2 (Refiner agent file)
    |--> References Module 3 (Creator agent file, modified)
    |
Module 5 (Skills Manifest)
    |
    |--> Registers Module 1 (Critic agent entry)
    |--> Registers Module 2 (Refiner agent entry)
    |
Module 7 (Tests)
    |
    |--> Validates Module 1, 2, 3, 4, 5, 6
```

All modules are loosely coupled through the orchestrator's DEBATE_ROUTING table. The Critic and Refiner agents have no direct dependency on each other -- they communicate indirectly through artifacts (critique report, updated artifacts).

---

## Implementation Order

Based on dependency analysis and the impact analysis recommendation:

| Order | Module | Rationale |
|-------|--------|-----------|
| 1 | Module 1: Critic agent | Standalone, no dependencies |
| 2 | Module 2: Refiner agent | Standalone, no dependencies |
| 3 | Module 3: Creator awareness | Depends on understanding Critic check categories (for section markers) |
| 4 | Module 4: Orchestrator DEBATE_ROUTING | Ties everything together; references all 3 agent files |
| 5 | Module 6: isdlc.md documentation | Trivial, can be done anytime |
| 6 | Module 5: Skills manifest | Additive JSON change; independent of other modules |
| 7 | Module 7: Tests | Must be last -- validates all other modules |
| 8 | Sync to .claude/ | Copy new/modified agent files to runtime directory |

---

## Artifact Summary

| Artifact | Location | Type |
|----------|----------|------|
| 04-test-strategy-critic.md | src/claude/agents/ | CREATE |
| 04-test-strategy-refiner.md | src/claude/agents/ | CREATE |
| 04-test-design-engineer.md | src/claude/agents/ | MODIFY |
| 00-sdlc-orchestrator.md | src/claude/agents/ | MODIFY |
| isdlc.md | src/claude/commands/ | MODIFY |
| skills-manifest.json | src/claude/hooks/config/ | MODIFY |
| test-strategy-debate-team.test.cjs | src/claude/hooks/tests/ | CREATE |
