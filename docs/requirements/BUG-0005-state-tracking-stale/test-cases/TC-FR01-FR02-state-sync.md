# Test Cases: FR-01, FR-02 - STEP 3e State Sync

**Requirements:** FR-01 (AC-01a, AC-01b, AC-01c), FR-02 (AC-02a, AC-02b)
**Test Type:** Integration Tests
**Scope:** Validate that after a phase transition, all state fields are consistent
**File:** `src/claude/hooks/tests/test-state-sync-integration.test.cjs` (new)

---

## Context

STEP 3e is prompt text in `isdlc.md`, not executable hook code. We cannot directly test the prompt. Instead, we test the **expected outcome**: after STEP 3e runs, the state.json should have all fields correctly updated. We simulate this by:

1. Writing a "before transition" state
2. Applying the expected STEP 3e mutations (as a helper function)
3. Verifying the resulting state matches all ACs

This approach validates that the **specification is correct and complete**. The implementation phase will ensure the prompt text matches this specification.

---

## Test Data Fixtures

### Fixture: Fix workflow mid-transition (Phase 02 completing, Phase 05 starting)
```json
{
  "current_phase": "02-tracing",
  "active_agent": "trace-analyst",
  "active_workflow": {
    "type": "fix",
    "current_phase": "02-tracing",
    "current_phase_index": 1,
    "phases": ["01-requirements", "02-tracing", "05-test-strategy", "06-implementation", "16-quality-loop", "08-code-review"],
    "phase_status": {
      "01-requirements": "completed",
      "02-tracing": "in_progress",
      "05-test-strategy": "pending",
      "06-implementation": "pending",
      "16-quality-loop": "pending",
      "08-code-review": "pending"
    }
  },
  "phases": {
    "01-requirements": { "status": "completed" },
    "02-tracing": { "status": "in_progress" }
  }
}
```

### Fixture: Last phase completing (Phase 08 code-review, no next phase)
```json
{
  "current_phase": "08-code-review",
  "active_agent": "code-reviewer",
  "active_workflow": {
    "type": "fix",
    "current_phase": "08-code-review",
    "current_phase_index": 5,
    "phases": ["01-requirements", "02-tracing", "05-test-strategy", "06-implementation", "16-quality-loop", "08-code-review"],
    "phase_status": {
      "01-requirements": "completed",
      "02-tracing": "completed",
      "05-test-strategy": "completed",
      "06-implementation": "completed",
      "16-quality-loop": "completed",
      "08-code-review": "in_progress"
    }
  },
  "phases": {
    "08-code-review": { "status": "in_progress" }
  }
}
```

### Phase-to-Agent Mapping (for AC-02b)
```
01-requirements -> requirements-analyst
02-tracing -> trace-analyst
05-test-strategy -> test-design-engineer
06-implementation -> software-developer
16-quality-loop -> quality-assurance-engineer
08-code-review -> code-reviewer
```

---

## TC-01a: STEP 3e sets completed phase status

### TC-01a-01: phase_status updated to "completed" for finished phase
- **Given**: State where `active_workflow.current_phase` = `"02-tracing"` and `active_workflow.phase_status["02-tracing"]` = `"in_progress"`.
- **When**: STEP 3e transition logic executes for completing phase `"02-tracing"`.
- **Then**: `active_workflow.phase_status["02-tracing"]` = `"completed"`.

### TC-01a-02: top-level phases also updated
- **Given**: Same as TC-01a-01.
- **When**: STEP 3e completes.
- **Then**: `phases["02-tracing"].status` = `"completed"` (existing behavior, verify not broken).

---

## TC-01b: STEP 3e sets next phase status to in_progress

### TC-01b-01: Next phase marked in_progress in phase_status
- **Given**: State where next phase is `"05-test-strategy"` with `phase_status["05-test-strategy"]` = `"pending"`.
- **When**: STEP 3e transition logic advances from `"02-tracing"` to `"05-test-strategy"`.
- **Then**: `active_workflow.phase_status["05-test-strategy"]` = `"in_progress"`.

### TC-01b-02: No next phase update when completing final phase
- **Given**: State where `current_phase_index` = 5 (last phase `"08-code-review"`). No next phase exists.
- **When**: STEP 3e completes the final phase.
- **Then**: No new phase set to `"in_progress"`. All phases that were `"completed"` remain so. `"08-code-review"` is set to `"completed"`.

---

## TC-01c: phase_status reflects true state at every transition

### TC-01c-01: Multi-phase consistency check
- **Given**: A workflow that has completed phases 01 and 02, with phase 05 currently in_progress.
- **When**: STEP 3e completes phase 05 and advances to phase 06.
- **Then**:
  - `phase_status["01-requirements"]` = `"completed"`
  - `phase_status["02-tracing"]` = `"completed"`
  - `phase_status["05-test-strategy"]` = `"completed"`
  - `phase_status["06-implementation"]` = `"in_progress"`
  - `phase_status["16-quality-loop"]` = `"pending"`
  - `phase_status["08-code-review"]` = `"pending"`

### TC-01c-02: active_workflow.current_phase matches current_phase_index
- **Given**: After any transition.
- **Then**: `active_workflow.phases[active_workflow.current_phase_index]` === `active_workflow.current_phase`.

### TC-01c-03: top-level current_phase matches active_workflow.current_phase
- **Given**: After any transition.
- **Then**: `state.current_phase` === `state.active_workflow.current_phase`.

---

## TC-02a: STEP 3e updates top-level active_agent

### TC-02a-01: active_agent updated to next phase's agent
- **Given**: State transitioning from `"02-tracing"` to `"05-test-strategy"`.
- **When**: STEP 3e runs.
- **Then**: `state.active_agent` = `"test-design-engineer"`.

### TC-02a-02: active_agent reflects final phase agent
- **Given**: State transitioning to final phase `"08-code-review"`.
- **When**: STEP 3e runs.
- **Then**: `state.active_agent` = `"code-reviewer"`.

### TC-02a-03: active_agent not changed when completing final phase (no next)
- **Given**: Completing the final phase `"08-code-review"`. No next phase.
- **When**: STEP 3e runs.
- **Then**: `state.active_agent` remains `"code-reviewer"` (or is cleared -- verify spec).

---

## TC-02b: Agent name resolution uses phase-to-agent mapping

### TC-02b-01: Common phase keys resolve to correct agents
- **Given**: Phase-to-agent mapping.
- **When**: Resolving agent for each phase key.
- **Then**:
  - `"01-requirements"` -> `"requirements-analyst"`
  - `"02-tracing"` -> `"trace-analyst"` (or `"solution-architect"` for feature workflows -- check mapping)
  - `"05-test-strategy"` -> `"test-design-engineer"`
  - `"06-implementation"` -> `"software-developer"`
  - `"16-quality-loop"` -> `"quality-assurance-engineer"`
  - `"08-code-review"` -> `"code-reviewer"`

### TC-02b-02: Unknown phase key does not crash
- **Given**: An unrecognized phase key (e.g., `"99-unknown"`).
- **When**: Agent resolution runs.
- **Then**: Returns a safe default or keeps previous agent. Does NOT throw.

---

## Summary

| AC | Test Cases | Count |
|----|-----------|-------|
| AC-01a | TC-01a-01, TC-01a-02 | 2 |
| AC-01b | TC-01b-01, TC-01b-02 | 2 |
| AC-01c | TC-01c-01, TC-01c-02, TC-01c-03 | 3 |
| AC-02a | TC-02a-01, TC-02a-02, TC-02a-03 | 3 |
| AC-02b | TC-02b-01, TC-02b-02 | 2 |
| **Total** | | **12** |
