# Test Cases: Regression Tests and Agent Documentation Validation

**Requirement**: FR-04, NFR-01, NFR-02, AC-10, AC-11
**Files**: Multiple

---

## Regression Tests

### TC-BUG20-REG01: All existing gate-blocker tests pass after fix

**Priority**: P0
**Traces**: NFR-02, AC-11

**Given** the fix has been applied (artifact-paths.json created, iteration-requirements.json updated, gate-blocker.cjs modified)
**When** `node --test src/claude/hooks/tests/test-gate-blocker-extended.test.cjs` is executed
**Then** all 36+ existing tests pass
**And** no test failures or errors
**And** the test count does not decrease

---

### TC-BUG20-REG02: Full test suite passes after fix

**Priority**: P0
**Traces**: NFR-02, AC-11

**Given** the fix has been applied
**When** `npm run test:all` is executed
**Then** all tests pass (ESM + CJS)
**And** total test count >= 555 baseline
**And** zero regressions

---

## Agent Documentation Tests

### TC-BUG20-DOC01: Agent 02 (solution-architect) references artifact-paths.json

**Priority**: P2
**Traces**: FR-04, AC-10

**Given** I read `src/claude/agents/02-solution-architect.md`
**When** I check the OUTPUT STRUCTURE section
**Then** it references `artifact-paths.json` as the canonical source for output paths
**And** the documented output path matches what artifact-paths.json defines for phase `03-architecture`

---

### TC-BUG20-DOC02: Agent 03 (system-designer) references artifact-paths.json

**Priority**: P2
**Traces**: FR-04, AC-10

**Given** I read `src/claude/agents/03-system-designer.md`
**When** I check the OUTPUT STRUCTURE section
**Then** it references `artifact-paths.json` as the canonical source for output paths
**And** the documented output path matches what artifact-paths.json defines for phase `04-design`

---

### TC-BUG20-DOC03: Agent 04 (test-design-engineer) references artifact-paths.json

**Priority**: P2
**Traces**: FR-04, AC-10

**Given** I read `src/claude/agents/04-test-design-engineer.md`
**When** I check the OUTPUT STRUCTURE section
**Then** it references `artifact-paths.json` as the canonical source for output paths
**And** the documented output path matches what artifact-paths.json defines for phase `05-test-strategy`

---

### TC-BUG20-DOC04: Agent 07 (qa-engineer) references artifact-paths.json

**Priority**: P2
**Traces**: FR-04, AC-10

**Given** I read `src/claude/agents/07-qa-engineer.md`
**When** I check the OUTPUT STRUCTURE section
**Then** it references `artifact-paths.json` as the canonical source for output paths
**And** the documented output path matches what artifact-paths.json defines for phase `08-code-review`

---

### TC-BUG20-DOC05: Agent 01 (requirements-analyst) references artifact-paths.json

**Priority**: P2
**Traces**: FR-04, AC-10

**Given** I read `src/claude/agents/01-requirements-analyst.md`
**When** I check the OUTPUT STRUCTURE section
**Then** it references `artifact-paths.json` as the canonical source for output paths
**And** the documented output path matches what artifact-paths.json defines for phase `01-requirements`

---

## Implementation Notes

### Regression Tests
- TC-BUG20-REG01 and TC-BUG20-REG02 are executed manually during Phase 06 (implementation) as part of the TDD GREEN step.
- They are validated by the quality-loop (Phase 16) test runner.

### Documentation Tests
- TC-BUG20-DOC01 through TC-BUG20-DOC05 are manual inspection tests validated during code review (Phase 08).
- Optionally, a simple grep-based test could be added to `artifact-path-consistency.test.cjs` that checks for `artifact-paths.json` references in agent files, but this is lower priority.
