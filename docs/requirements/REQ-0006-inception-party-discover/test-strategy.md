# Test Strategy — REQ-0006: Inception Party

**Feature**: BMAD-inspired role-based party mode for `/discover --new`
**Version**: 1.0.0
**Created**: 2026-02-09
**Traces to**: requirements-spec.md (20 AC), interface-spec.md, error-taxonomy.md

---

## 1. Testing Philosophy

### 1.1 Nature of the Deliverables

REQ-0006 produces **zero JavaScript runtime code**. All deliverables are:
- 7 new markdown agent files (D9-D15)
- 1 modified markdown agent file (discover-orchestrator.md)
- 1 modified markdown command file (discover.md)
- 1 new JSON configuration file (party-personas.json)

This shapes the test strategy fundamentally:
- **No unit tests** for business logic (there is no `.js`/`.cjs` code to test)
- **JSON schema validation** is the primary automated test target
- **Static structural analysis** of markdown files verifies conventions
- **Classic mode regression** via the existing 917-test suite confirms zero breakage
- **Integration verification** must be manual/observational (agent behavior is non-deterministic)

### 1.2 Test Pyramid for This Feature

```
                    /\
                   /  \
                  / E2E \       Manual: full party mode walkthrough
                 /  (4)   \     with a real new project
                /----------\
               / Integration \   Manual: per-phase verification
              /    (10)       \  of agent spawning and messaging
             /----------------\
            / Static Analysis   \  Automated: JSON schema, markdown
           /      (18)           \ structure, agent file conventions
          /----------------------\
         / Regression              \  Automated: existing 917 tests
        /         (917)              \ confirm no classic mode breakage
       /------------------------------\
```

### 1.3 Key Principle

The existing 917-test suite is the primary safety net. Since REQ-0006 adds files and modifies markdown (not runtime code), the risk of regressing existing functionality is near zero. The test strategy focuses on **validating the new artifacts are well-formed** and **verifying that nothing existing broke**.

---

## 2. Test Categories

### Category 1: JSON Schema Validation (Automated — party-personas.json)

| TC-ID | Test Case | AC | Type | Priority |
|-------|-----------|-----|------|----------|
| TC-001 | party-personas.json is valid JSON (parseable) | AC-17 | Unit | P0 |
| TC-002 | party-personas.json has "version" field matching semver pattern | AC-17 | Unit | P1 |
| TC-003 | party-personas.json has "personas" object with exactly 9 entries | AC-17 | Unit | P0 |
| TC-004 | Each persona has all required fields: name, title, agent_type, agent_id, phase, is_existing_agent, communication_style, expertise, question_domains, debate_focus | AC-17 | Unit | P0 |
| TC-005 | persona.phase is 1, 2, or 3 for all personas | AC-17 | Unit | P0 |
| TC-006 | persona.agent_id matches D{N} pattern for all personas | AC-17 | Unit | P1 |
| TC-007 | persona.question_domains is array (empty for Phase 2/3 personas) | AC-17 | Unit | P1 |
| TC-008 | Phase 1 personas (nadia, oscar, tessa) all have non-empty question_domains | AC-5 | Unit | P0 |
| TC-009 | party-personas.json has "phases" object with exactly 5 entries (1-5) | AC-17 | Unit | P0 |
| TC-010 | Each phase has: name, type, personas, max_messages, interaction, output | AC-17 | Unit | P0 |
| TC-011 | Phases 1-3 have type "parallel", phases 4-5 have type "sequential" | AC-4 | Unit | P0 |
| TC-012 | Each parallel phase (1-3) has exactly 3 personas | AC-4, AC-8, AC-11 | Unit | P0 |
| TC-013 | Sequential phases (4-5) have empty personas arrays | — | Unit | P1 |
| TC-014 | max_messages is 10 for parallel phases, 0 for sequential phases | NFR-002 | Unit | P0 |
| TC-015 | All persona keys in phases.personas[] exist in the personas object | AC-17 | Unit | P0 |
| TC-016 | persona.agent_type values match expected agent filenames (product-analyst, domain-researcher, etc.) | AC-17 | Unit | P0 |
| TC-017 | is_existing_agent is true for nadia (D7) and architect (D8), false for all others | — | Unit | P1 |
| TC-018 | No duplicate agent_id values across all personas | — | Unit | P0 |

**Implementation**: New file `lib/party-personas.test.js` (~70 lines). Uses `node:test` + `node:assert/strict`. Reads `src/claude/agents/discover/party-personas.json` and validates structure.

### Category 2: Agent File Structural Analysis (Automated)

| TC-ID | Test Case | AC | Type | Priority |
|-------|-----------|-----|------|----------|
| TC-019 | All 7 new agent .md files exist at expected paths | — | Structural | P0 |
| TC-020 | Each new agent .md has valid YAML frontmatter (name, description, model, owned_skills) | Art-XIII | Structural | P0 |
| TC-021 | Each new agent frontmatter name matches expected agent_type from party-personas.json | AC-17 | Structural | P0 |
| TC-022 | Each new agent has "# SUGGESTED PROMPTS" section | Art-VIII | Structural | P1 |
| TC-023 | Each new agent has "## Role" section | Art-VIII | Structural | P1 |
| TC-024 | Each new agent has "## Process" or "## Communication Protocol" section | Art-VIII | Structural | P1 |
| TC-025 | discover-orchestrator.md contains "PARTY MODE FLOW" section | REQ-001 | Structural | P0 |
| TC-026 | discover-orchestrator.md contains "Step 0: Mode Selection" section | AC-1 | Structural | P0 |
| TC-027 | discover.md Options table contains --party and --classic flags | AC-2, AC-3 | Structural | P0 |
| TC-028 | discover.md Examples section contains party/classic examples | — | Structural | P1 |

**Implementation**: Extend `lib/prompt-format.test.js` to add the new agent files to the `SUB_AGENTS` array, plus add a new describe block for party-mode structural checks.

### Category 3: Classic Mode Regression (Automated — Existing Suite)

| TC-ID | Test Case | AC | Type | Priority |
|-------|-----------|-----|------|----------|
| TC-029 | All 362 ESM tests pass (`npm test`) | AC-15 | Regression | P0 |
| TC-030 | All 555 CJS hook tests pass (`npm run test:hooks`) | AC-15 | Regression | P0 |
| TC-031 | prompt-format.test.js passes with new agents added to classification | — | Regression | P0 |
| TC-032 | No existing test file references are broken | AC-15 | Regression | P0 |

**Implementation**: Run `npm run test:all`. The existing 917 tests validate that all hooks, CLI code, and agent structural checks still pass. Since REQ-0006 adds no JavaScript code, these tests should pass unchanged (modulo the prompt-format.test.js update to include new agents).

### Category 4: Integration Verification (Manual — Agent Behavior)

These tests verify the actual runtime behavior of party mode. They are manual because agent behavior depends on Claude's responses, which are non-deterministic.

| TC-ID | Test Case | AC | Verification Method | Priority |
|-------|-----------|-----|---------------------|----------|
| TC-033 | `/discover --new` without flags shows mode selection menu with [1] Party and [2] Classic | AC-1 | Manual: invoke command, verify menu appears | P0 |
| TC-034 | `/discover --new --party` enters party mode without menu | AC-2 | Manual: invoke, verify no menu, party starts | P0 |
| TC-035 | `/discover --new --classic` enters classic mode without menu | AC-3 | Manual: invoke, verify classic Steps 1-10 | P0 |
| TC-036 | Party Phase 1 spawns 3 agents (verify TaskCreate spinner shows) | AC-4 | Manual: observe task spinner | P0 |
| TC-037 | Phase 1 agents each ask at least 1 question from their domain | AC-5 | Manual: read merged question output | P0 |
| TC-038 | User response is broadcast to all 3 Phase 1 agents | AC-6 | Manual: verify all agents reference response | P0 |
| TC-039 | Phase 1 produces a merged Project Brief at docs/project-brief.md | AC-7 | Manual: verify file exists and content | P0 |
| TC-040 | Party Phase 2 spawns 3 agents on same team | AC-8 | Manual: observe task spinner, no new TeamCreate | P0 |
| TC-041 | Phase 2 includes at least 1 critique round | AC-9 | Manual: observe debate messages | P0 |
| TC-042 | Phase 2 presents tech stack recommendation with [Y]/[C] menu | AC-10 | Manual: verify menu appears | P0 |
| TC-043 | Party Phase 3 produces 3 artifacts (architecture, data model, test strategy) | AC-11 | Manual: verify files exist | P0 |
| TC-044 | Phase 3 agents cross-review at least 1 other artifact | AC-12 | Manual: observe review messages | P1 |
| TC-045 | Phase 4 invokes constitution generator and skills researcher sequentially | AC-13 | Manual: verify sequential execution | P0 |
| TC-046 | Phase 5 presents structured walkthrough | AC-14 | Manual: verify walkthrough steps | P0 |
| TC-047 | After party mode, discovery_context envelope exists in state.json | AC-16 | Manual: read state.json | P0 |
| TC-048 | discovery_context from party has same fields as classic mode | AC-16 | Manual: field comparison | P0 |
| TC-049 | party-personas.json is read (not hardcoded persona values in orchestrator) | AC-17 | Manual: verify orchestrator reads file | P1 |
| TC-050 | Agent failure in Phase 1 results in graceful degradation | AC-18 | Manual: simulate by using invalid agent type | P1 |
| TC-051 | TaskCreate shows progress for each party phase | AC-19 | Manual: observe task list | P0 |
| TC-052 | Team is cleaned up after Phase 5 (TeamDelete called) | AC-20 | Manual: verify no lingering team | P1 |

### Category 5: Error Path Verification (Manual)

| TC-ID | Test Case | Error | Verification Method | Priority |
|-------|-----------|-------|---------------------|----------|
| TC-053 | `--party --classic` together produces mutual exclusion error | E-009 | Manual: invoke and verify error | P0 |
| TC-054 | --party flag is ignored during --existing flow | — | Manual: invoke --existing --party, verify existing flow runs | P1 |
| TC-055 | Phase fallback to classic works when all agents fail | E-005 | Manual: difficult to trigger; verify menu code exists in orchestrator | P2 |
| TC-056 | Message limit (10) causes debate cutoff | E-006, NFR-002 | Manual: observe if debate exceeds 10 | P2 |

---

## 3. Test Implementation Plan

### 3.1 New Test File: `lib/party-personas.test.js`

```javascript
/**
 * party-personas.test.js — Schema validation for party-personas.json
 *
 * REQ-0006-inception-party-discover: Validates persona config structure,
 * phase definitions, agent type references, and constraint compliance.
 *
 * @module party-personas.test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const PERSONAS_PATH = join(__dirname, '..', 'src', 'claude', 'agents', 'discover', 'party-personas.json');

// Test cases TC-001 through TC-018
```

**Estimated test count**: 18 tests
**Estimated file size**: ~180 lines

### 3.2 Existing File Updates: `lib/prompt-format.test.js`

Add 7 new agent files to the `SUB_AGENTS` array:

```javascript
const SUB_AGENTS = [
  // ...existing entries...
  join('discover', 'domain-researcher.md'),
  join('discover', 'technical-scout.md'),
  join('discover', 'solution-architect-party.md'),
  join('discover', 'security-advisor.md'),
  join('discover', 'devops-pragmatist.md'),
  join('discover', 'data-model-designer.md'),
  join('discover', 'test-strategist.md'),
];
```

Add a new describe block for party mode structural checks:

```javascript
describe('Party Mode Structural Checks', () => {
  // TC-025: orchestrator has PARTY MODE FLOW section
  // TC-026: orchestrator has Step 0 Mode Selection
  // TC-027: discover.md has --party/--classic flags
  // TC-028: discover.md has party/classic examples
});
```

**Estimated new tests**: 10 (7 agent file checks from existing patterns + 4 structural checks)
**Estimated lines added**: ~50

### 3.3 No Hook Test Changes

Since REQ-0006 adds no `.cjs` hook files and modifies no existing hooks:
- No changes to `src/claude/hooks/tests/*.test.cjs`
- The 555 CJS tests run unchanged as regression

---

## 4. Test Data Strategy

### 4.1 party-personas.json as Test Fixture

The `party-personas.json` file IS the test data for Category 1 tests. The test reads the actual file from disk (no mock data needed). This is the same pattern used by `prompt-format.test.js` which reads actual agent `.md` files.

### 4.2 No Mock Data Required

Since:
- Category 1 tests validate a static JSON file
- Category 2 tests validate static markdown file structure
- Category 3 tests run the existing suite (own test data)
- Categories 4-5 are manual

There is no need for mock data, test fixtures, or test doubles.

### 4.3 Agent File Paths as Constants

Define the expected agent file paths as constants in the test file for clear failure messages:

```javascript
const EXPECTED_NEW_AGENTS = [
  'discover/domain-researcher.md',
  'discover/technical-scout.md',
  'discover/solution-architect-party.md',
  'discover/security-advisor.md',
  'discover/devops-pragmatist.md',
  'discover/data-model-designer.md',
  'discover/test-strategist.md',
];

const EXPECTED_AGENT_TYPES = {
  'domain-researcher': 'D9',
  'technical-scout': 'D10',
  'solution-architect-party': 'D11',
  'security-advisor': 'D12',
  'devops-pragmatist': 'D13',
  'data-model-designer': 'D14',
  'test-strategist': 'D15',
};
```

---

## 5. Acceptance Criteria Coverage Matrix

| AC | Test Cases | Category | Automated? |
|----|-----------|----------|------------|
| AC-1 | TC-033 | Integration | Manual |
| AC-2 | TC-027, TC-034 | Structural + Integration | Partial |
| AC-3 | TC-027, TC-035 | Structural + Integration | Partial |
| AC-4 | TC-011, TC-012, TC-036 | Schema + Integration | Partial |
| AC-5 | TC-008, TC-037 | Schema + Integration | Partial |
| AC-6 | TC-038 | Integration | Manual |
| AC-7 | TC-039 | Integration | Manual |
| AC-8 | TC-012, TC-040 | Schema + Integration | Partial |
| AC-9 | TC-041 | Integration | Manual |
| AC-10 | TC-042 | Integration | Manual |
| AC-11 | TC-012, TC-043 | Schema + Integration | Partial |
| AC-12 | TC-044 | Integration | Manual |
| AC-13 | TC-045 | Integration | Manual |
| AC-14 | TC-046 | Integration | Manual |
| AC-15 | TC-029, TC-030, TC-031, TC-032 | Regression | Automated |
| AC-16 | TC-047, TC-048 | Integration | Manual |
| AC-17 | TC-001 to TC-018, TC-021, TC-049 | Schema + Structural | Automated |
| AC-18 | TC-050 | Integration | Manual |
| AC-19 | TC-051 | Integration | Manual |
| AC-20 | TC-052 | Integration | Manual |

**Coverage summary**: All 20 AC are covered. 18 automated schema tests + 10 automated structural tests + 917 regression tests + 20 manual integration tests + 4 manual error path tests.

---

## 6. NFR Verification

| NFR | How Verified | Test Cases |
|-----|-------------|-----------|
| NFR-001 (Wall-clock < 80% classic) | Manual timing comparison during integration testing. Run party mode and classic mode on same project description, compare elapsed time. | TC-036 through TC-046 (aggregate) |
| NFR-002 (Max 10 messages/phase) | Automated: TC-014 validates max_messages config is 10. Manual: TC-056 observes actual message count. | TC-014, TC-056 |
| NFR-003 (Declarative config) | Automated: TC-001 through TC-018 validate JSON structure. Manual: TC-049 verifies config is read at runtime. | TC-001-TC-018, TC-049 |
| NFR-004 (Same quality gates) | Manual: verify party mode artifacts pass the same validation as classic mode artifacts during SDLC workflow. | TC-047, TC-048 |

---

## 7. Test Execution Plan

### 7.1 Phase 06 (Implementation) — Run During Development

| Step | Command | Expected |
|------|---------|----------|
| 1 | Create party-personas.json | File exists |
| 2 | Run `node --test lib/party-personas.test.js` | 18 tests pass |
| 3 | Create 7 agent .md files | Files exist with frontmatter |
| 4 | Run `node --test lib/prompt-format.test.js` | Existing + new tests pass |
| 5 | Modify discover-orchestrator.md and discover.md | Sections added |
| 6 | Run `npm run test:all` | 917+ tests pass (all existing + ~28 new) |

### 7.2 Phase 07 (Integration Testing) — After Implementation

| Step | Action | Expected |
|------|--------|----------|
| 1 | Run `npm run test:all` | 945+ tests pass (917 existing + ~28 new) |
| 2 | Execute TC-033: `/discover --new` | Mode selection menu appears |
| 3 | Execute TC-034: `/discover --new --party` | Party mode starts, 5 tasks created |
| 4 | Observe Phase 1 (TC-036 through TC-039) | 3 agents, questions, broadcast, brief |
| 5 | Observe Phase 2 (TC-040 through TC-042) | 3 agents, debate, recommendation |
| 6 | Observe Phase 3 (TC-043, TC-044) | 3 artifacts, cross-review |
| 7 | Observe Phase 4-5 (TC-045, TC-046) | Constitution, walkthrough |
| 8 | Verify AC-16 (TC-047, TC-048) | discovery_context matches classic schema |
| 9 | Execute TC-035: `/discover --new --classic` | Classic flow runs unchanged |
| 10 | Execute TC-053: `--party --classic` | Error message displayed |

### 7.3 Regression Gate

**Mandatory before GATE-07**:
- `npm run test:all` passes with zero failures
- Test count >= 945 (917 existing + 28 new)
- No existing test modified in a way that reduces coverage

---

## 8. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Party mode breaks classic mode | Very Low | High | Existing 917 tests + classic mode is structurally untouched |
| party-personas.json invalid | Low | Medium | TC-001 through TC-018 catch at test time |
| New agent files missing sections | Low | Low | TC-019 through TC-024 catch at test time |
| Agent behavior non-deterministic | Certain | Low | Expected — test strategy focuses on structural correctness, not output quality |
| TeamCreate API unavailable | Low | High | Error E-001 with classic fallback documented; manual test TC-055 |

---

## 9. Test Artifact Summary

| Artifact | Path | Type | Tests |
|----------|------|------|-------|
| party-personas.test.js | `lib/party-personas.test.js` | New file | 18 tests |
| prompt-format.test.js | `lib/prompt-format.test.js` | Modified | +10 tests |
| Existing test suite | `lib/*.test.js` + `src/claude/hooks/tests/*.test.cjs` | Unchanged | 917 tests |
| **Total automated** | | | **945 tests** |
| Manual integration checklist | This document, Section 7.2 | Reference | 20 checks |
| Manual error path checklist | This document, Section 2 Category 5 | Reference | 4 checks |

---

## 10. Traceability

| Requirement | Test Cases | Coverage |
|------------|-----------|----------|
| REQ-001 | TC-025, TC-026, TC-033 | Full |
| REQ-002 | TC-008, TC-036-TC-039 | Full |
| REQ-003 | TC-012, TC-040-TC-042 | Full |
| REQ-004 | TC-012, TC-043-TC-044 | Full |
| REQ-005 | TC-013, TC-045 | Full |
| REQ-006 | TC-046 | Full |
| REQ-007 | TC-029-TC-032, TC-035 | Full |
| REQ-008 | TC-047, TC-048 | Full |
| REQ-009 | TC-001-TC-018, TC-021 | Full |
| REQ-010 | TC-012, TC-036, TC-040, TC-051, TC-052 | Full |
| REQ-011 | TC-050, TC-055 | Full |
| REQ-012 | TC-027, TC-034, TC-035, TC-053 | Full |
