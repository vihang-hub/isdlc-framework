# Requirements Specification: Multi-agent Test Strategy Team

**ID**: REQ-0016
**Version**: 1.0
**Created**: 2026-02-15
**Status**: Draft
**Workflow**: feature
**Backlog Reference**: BACKLOG.md item 4.1 Phase 05

---

## 1. Overview

### 1.1 Problem Statement

Phase 05 (Test Strategy & Design) currently runs as a single-agent phase -- the test-design-engineer produces test-strategy.md, test-cases/, traceability-matrix.csv, and test-data-plan.md without any review or challenge. This means test strategies pass through GATE-05 without adversarial scrutiny for:

- Missing edge cases in test cases
- Untested error paths (happy path bias)
- Over-reliance on unit tests (inadequate test pyramid)
- No performance or load test plan when needed
- Coverage gaps against requirements (AC-to-test mapping holes)
- Missing negative test cases (only positive scenarios tested)
- Test data gaps (insufficient data variety)
- Flaky test risk (non-deterministic test designs)

The Creator/Critic/Refiner debate pattern has proven effective in Phase 01 (requirements), Phase 03 (architecture), and Phase 04 (design). Extending it to Phase 05 will catch test strategy defects before they propagate to implementation (Phase 06) where they are more expensive to fix.

### 1.2 Proposed Solution

Add two new agents -- **Test Strategy Critic** and **Test Strategy Refiner** -- that collaborate with the existing test-design-engineer (Creator) via propose-critique-refine cycles. Add Phase `05-test-strategy` to the orchestrator's DEBATE_ROUTING table. Update the existing test-design-engineer with Creator-mode awareness (DEBATE_CONTEXT handling).

### 1.3 Quality Priority

- **Primary**: Completeness of the Critic's checklist (catching all possible test strategy gaps)
- **Secondary**: Convergence speed (resolving the debate loop in minimal rounds)

### 1.4 Prior Art

This feature follows the established pattern from:
- REQ-0014: Multi-agent Requirements Team (Phase 01) -- established the debate engine
- REQ-0015: Multi-agent Architecture Team (Phase 03) -- first DEBATE_ROUTING extension
- Phase 04 Design Team -- second DEBATE_ROUTING extension with 8 mandatory checks

---

## 2. Functional Requirements

### FR-01: Test Strategy Critic Agent Definition

Create a new agent definition (`04-test-strategy-critic.md`) in `src/claude/agents/` that reviews Phase 05 test strategy artifacts for defects.

**Acceptance Criteria:**
- AC-01.1: Given the agent file `src/claude/agents/04-test-strategy-critic.md` is created, When the file is read, Then it contains valid frontmatter with `name: test-strategy-critic`, `description`, `model: opus`, and `owned_skills` referencing TEST-* skill IDs
- AC-01.2: Given the Critic agent is invoked via Task, When DEBATE_CONTEXT with `round: N` is provided, Then the Critic reads all Phase 05 artifacts (test-strategy.md, test-cases/, traceability-matrix.csv, test-data-plan.md)
- AC-01.3: Given the Critic has read all artifacts, When it evaluates them, Then it applies all 8 mandatory checks (TC-01 through TC-08) defined in FR-02
- AC-01.4: Given the evaluation is complete, When findings are produced, Then each finding is categorized as BLOCKING or WARNING with a unique ID (B-NNN or W-NNN)
- AC-01.5: Given the evaluation is complete, When the output is produced, Then it follows the format `round-{N}-critique.md` consistent with the critique report format used by the requirements-critic and design-critic agents

### FR-02: Mandatory Critic Checks (8 Categories)

The Critic applies 8 mandatory checks to Phase 05 artifacts. These checks always produce BLOCKING findings if they fail.

**Acceptance Criteria:**
- AC-02.1: Given test-cases/ are reviewed, When any acceptance criterion (AC) from requirements-spec.md has no corresponding test case in the traceability matrix, Then it is flagged as BLOCKING finding `TC-01: UNTESTED_ACCEPTANCE_CRITERION`
- AC-02.2: Given test-strategy.md is reviewed, When the test pyramid has fewer than 2 levels (e.g., only unit tests, no integration or E2E), Then it is flagged as BLOCKING finding `TC-02: INCOMPLETE_TEST_PYRAMID`
- AC-02.3: Given test-cases/ are reviewed, When any requirement has only positive-path test cases and no negative/error test cases, Then it is flagged as BLOCKING finding `TC-03: MISSING_NEGATIVE_TESTS`
- AC-02.4: Given test-data-plan.md is reviewed, When test data does not cover boundary values, empty inputs, invalid types, or maximum-size inputs for any validated field, Then it is flagged as BLOCKING finding `TC-04: TEST_DATA_GAPS`
- AC-02.5: Given test-strategy.md is reviewed, When any test case relies on timing, external services, random data, or shared mutable state without mitigation, Then it is flagged as BLOCKING finding `TC-05: FLAKY_TEST_RISK`
- AC-02.6: Given test-cases/ are reviewed, When error paths documented in the error taxonomy (error-taxonomy.md, if present) have no corresponding test case, Then it is flagged as BLOCKING finding `TC-06: UNTESTED_ERROR_PATHS`
- AC-02.7: Given test-strategy.md is reviewed, When NFRs with quantified metrics (from nfr-matrix.md) have no corresponding performance, load, or benchmark test plan, Then it is flagged as BLOCKING finding `TC-07: MISSING_PERFORMANCE_TESTS`
- AC-02.8: Given traceability-matrix.csv is reviewed, When any test case does not trace back to at least one requirement (orphan test), Then it is flagged as WARNING finding `TC-08: ORPHAN_TEST_CASE`

### FR-03: Test Strategy Refiner Agent Definition

Create a new agent definition (`04-test-strategy-refiner.md`) in `src/claude/agents/` that addresses Critic findings and produces improved Phase 05 artifacts.

**Acceptance Criteria:**
- AC-03.1: Given the agent file `src/claude/agents/04-test-strategy-refiner.md` is created, When the file is read, Then it contains valid frontmatter with `name: test-strategy-refiner`, `description`, `model: opus`, and `owned_skills` referencing TEST-* skill IDs
- AC-03.2: Given the Refiner receives `round-{N}-critique.md` and current Phase 05 artifacts, When it processes BLOCKING findings, Then every BLOCKING finding is addressed with a documented fix strategy
- AC-03.3: Given the Refiner addresses findings, When the output is produced, Then updated artifacts include: complete test pyramid with rationale, Given/When/Then for every AC, explicit negative test cases, test data strategy, flaky-test mitigation plan, and coverage targets mapped to risk areas
- AC-03.4: Given the Refiner completes its work, When the change log is appended, Then it lists every finding addressed with finding ID, severity, action taken, and target artifact
- AC-03.5: Given a BLOCKING finding cannot be resolved without user input, When the Refiner encounters it, Then the affected item is marked with `[NEEDS CLARIFICATION]` and documented as escalated

### FR-04: DEBATE_ROUTING Table Extension

Add Phase `05-test-strategy` to the orchestrator's DEBATE_ROUTING table.

**Acceptance Criteria:**
- AC-04.1: Given the DEBATE_ROUTING table in `src/claude/agents/00-sdlc-orchestrator.md` exists, When a new row is added, Then it maps `05-test-strategy` to Creator (`04-test-design-engineer.md`), Critic (`04-test-strategy-critic.md`), Refiner (`04-test-strategy-refiner.md`)
- AC-04.2: Given the DEBATE_ROUTING row is added, When Phase Artifacts are specified, Then they list `test-strategy.md, test-cases/, traceability-matrix.csv, test-data-plan.md`
- AC-04.3: Given the DEBATE_ROUTING row is added, When the Critical Artifact is specified, Then it is `test-strategy.md`
- AC-04.4: Given the DEBATE_ROUTING table now has 4 entries, When the orchestrator reaches Phase `05-test-strategy` with `debate_mode == true`, Then it follows the Creator -> Critic -> Refiner loop using the Phase 05 routing entry

### FR-05: Creator Awareness in test-design-engineer

Update the existing `04-test-design-engineer.md` agent to handle DEBATE_CONTEXT when present.

**Acceptance Criteria:**
- AC-05.1: Given the test-design-engineer agent file is updated, When a `DEBATE_CONTEXT` block is present in the Task prompt, Then the agent operates in Creator mode (labels artifacts as "Round {N} Draft", produces artifacts optimized for Critic review)
- AC-05.2: Given DEBATE_CONTEXT is present with `round > 1`, When `prior_critique` field references the Refiner's output, Then the Creator reads the refined artifacts and produces an updated draft that maintains the Refiner's improvements
- AC-05.3: Given DEBATE_CONTEXT is NOT present, When the agent is invoked, Then it operates in single-agent mode (current behavior preserved exactly, no changes)
- AC-05.4: Given Creator mode is active, When artifacts are produced, Then they include explicit section markers that the Critic can reference (e.g., requirement IDs on each test case, section headers matching check categories)

### FR-06: Skills Manifest Update

Update the skills manifest to register the new Critic and Refiner agents and their skill assignments.

**Acceptance Criteria:**
- AC-06.1: Given `src/claude/hooks/config/skills-manifest.json` is updated, When the Critic agent `test-strategy-critic` is added, Then it is listed in the agents section with its owned TEST-* skills (subset of test-design-engineer's skills: TEST-002, TEST-004, TEST-005)
- AC-06.2: Given `src/claude/hooks/config/skills-manifest.json` is updated, When the Refiner agent `test-strategy-refiner` is added, Then it is listed in the agents section with its owned TEST-* skills (subset: TEST-001, TEST-002, TEST-003, TEST-004, TEST-005)
- AC-06.3: Given the skill_owners section is updated, When a skill is shared between Creator/Critic/Refiner, Then the primary_owner remains `test-design-engineer` and the Critic/Refiner are listed in the agent's owned_skills only
- AC-06.4: Given the total_skills count is checked, When no new skill IDs are created, Then the total_skills count remains unchanged (existing TEST-* skills are shared, not duplicated)

### FR-07: Test Coverage for New Agents

Create tests that validate the new agents and orchestrator changes follow the established debate team patterns.

**Acceptance Criteria:**
- AC-07.1: Given tests are created, When they validate the Critic agent file, Then they check: frontmatter structure, all 8 mandatory checks documented (TC-01 through TC-08), output format matches `round-{N}-critique.md` pattern, BLOCKING/WARNING severity classification
- AC-07.2: Given tests are created, When they validate the Refiner agent file, Then they check: frontmatter structure, fix strategies for each finding category, change log format, artifact update rules, `[NEEDS CLARIFICATION]` escalation
- AC-07.3: Given tests are created, When they validate the orchestrator DEBATE_ROUTING update, Then they check: Phase `05-test-strategy` row present, correct agent mapping, correct artifact list, correct critical artifact
- AC-07.4: Given tests are created, When they validate the Creator awareness update, Then they check: DEBATE_CONTEXT mode detection, round labeling, single-agent fallback preserved
- AC-07.5: Given tests are created, When they validate the skills manifest, Then they check: both new agents listed, skill assignments correct, total_skills count unchanged, no duplicate skill IDs
- AC-07.6: Given all tests pass, When the total test count is verified, Then zero pre-existing tests regress

---

## 3. Non-Functional Requirements

### NFR-01: Consistency with Existing Debate Teams

- All new artifacts MUST follow the structural patterns established by the requirements-critic, architecture-critic, and design-critic agents
- Critique report format, finding ID scheme (B-NNN, W-NNN), severity levels, and convergence detection logic MUST be identical
- Agent frontmatter structure MUST match the existing critic/refiner conventions

### NFR-02: Critic Completeness Over Speed

- The Critic's 8 mandatory checks (TC-01 through TC-08) MUST be exhaustive for the test strategy domain
- If a check takes longer but catches more defects, prefer thoroughness over speed
- Target: Critic catches >= 90% of test strategy defects that would be discovered in Phase 06 or later

### NFR-03: Convergence Within 3 Rounds

- The debate loop MUST converge within 3 rounds (same as existing debate teams)
- If round 3 still has unresolved BLOCKING findings, escalate to human
- Target: 80% of features converge in 2 rounds or fewer

### NFR-04: Zero Regression

- Adding new agents and modifying existing files MUST NOT break any existing tests
- Total test count MUST NOT decrease
- All existing debate team patterns (Phase 01, 03, 04) MUST continue to work unchanged

---

## 4. Constraints

### C-01: Agent File Naming
New agent files MUST follow the `{NN}-{role}.md` convention where `{NN}` is the phase number prefix (`04` for test strategy phase agents).

### C-02: No New Skill IDs
The Critic and Refiner agents share existing TEST-* skill IDs from the test-design-engineer. No new skill IDs should be created -- this follows the pattern where critic/refiner agents share a subset of the Creator's skills.

### C-03: Orchestrator-Only Invocation
The Critic and Refiner agents are ONLY invoked by the orchestrator during debate mode. They should NOT be invoked directly by users.

### C-04: CommonJS Hook Compatibility
Any hook changes MUST use `.cjs` extension and be compatible with Node 18+ CommonJS execution.

---

## 5. Out of Scope

- Debate mode for Phase 06 (implementation) -- this uses the separate IMPLEMENTATION_ROUTING with Writer/Reviewer/Updater
- Performance benchmarking of the debate loop itself
- Automated selection of debate vs. no-debate mode based on feature complexity (this is already handled by the existing `resolveDebateMode()` function)
- Changes to the existing 3 debate teams (Phase 01, 03, 04)

---

## 6. Dependencies

### Upstream
- Existing debate engine in the orchestrator (established by REQ-0014)
- DEBATE_ROUTING table with 3 existing entries (Phase 01, 03, 04)
- test-design-engineer agent (Creator role)
- Skills manifest with TEST-001 through TEST-017

### Downstream
- Phase 06 implementation will consume improved test artifacts
- Quality loop (Phase 16) validates test execution

---

## 7. Glossary

| Term | Definition |
|------|-----------|
| Creator | The primary agent that produces phase artifacts (test-design-engineer for Phase 05) |
| Critic | The review agent that identifies defects in Creator output |
| Refiner | The improvement agent that addresses Critic findings |
| DEBATE_ROUTING | Orchestrator lookup table mapping debate-enabled phases to their Creator/Critic/Refiner agents |
| TC-NN | Test Critic check identifiers (TC-01 through TC-08) |
| B-NNN | BLOCKING finding identifier in critique reports |
| W-NNN | WARNING finding identifier in critique reports |
| Test Pyramid | Testing strategy with layers (unit > integration > E2E) proportioned by cost and speed |
