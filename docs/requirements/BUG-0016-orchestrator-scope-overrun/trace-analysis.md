# Trace Analysis: Orchestrator Exceeds init-and-phase-01 Scope

**Generated**: 2026-02-14T16:05:00.000Z
**Bug**: BUG-0016 - The sdlc-orchestrator agent, when invoked with MODE: init-and-phase-01, runs all workflow phases instead of stopping after Phase 01
**External ID**: N/A (internal dogfooding observation)
**Workflow**: fix
**Phase**: 02-tracing

---

## Executive Summary

The orchestrator agent prompt (`src/claude/agents/00-sdlc-orchestrator.md`) defines MODE-based execution boundaries in Section 3c, but the mode enforcement is purely descriptive -- it states what each mode **should** do but never includes an explicit STOP instruction. Meanwhile, Section 4a ("Automatic Phase Transitions") uses CRITICAL-level imperative language commanding the orchestrator to automatically advance through phases whenever gates pass, with no mode-awareness guard. When the LLM processes these competing instructions, the stronger imperative in Section 4a overrides the weaker descriptive boundary in Section 3c, causing the orchestrator to run all phases regardless of the MODE parameter.

**Root Cause Confidence**: HIGH
**Severity**: HIGH
**Estimated Complexity**: LOW (prompt-only fix, no runtime code changes)

---

## Symptom Analysis

### Observed Symptoms

1. **Full workflow execution inside init-and-phase-01 mode**: During the BUG-0015/0016 fix workflow, the orchestrator was given `MODE: init-and-phase-01` but executed phases 01 -> 02 -> 05 -> 06 -> 16 -> 08 internally before returning.

2. **Phase-loop controller bypassed**: The phase-loop controller in `isdlc.md` (STEP 2 through STEP 3) never executed. STEP 2 creates visible foreground tasks, and STEP 3 runs phases one-at-a-time with per-phase state updates and hook enforcement. None of this occurred.

3. **Fabricated timestamps**: Phase snapshots recorded by the orchestrator had round-number timestamps (e.g., `15:05:00.000Z`, `15:08:00.000Z`, `15:10:00.000Z`) rather than precise millisecond timestamps that would result from actual sequential execution with real state.json writes.

4. **Missing per-phase task visibility**: Users could not see individual phase tasks in the terminal because the orchestrator ran in controlled mode (which correctly skips TaskCreate per line 1132) but then proceeded to run all phases anyway, so neither the orchestrator NOR the phase-loop controller created per-phase tasks.

5. **No hook enforcement between phases**: Pre-task and post-task hooks that fire between phase delegations in the phase-loop controller were never invoked.

### Error Source Analysis

No error messages or exceptions -- this is a **behavioral bug** where the orchestrator exceeds its authorized scope. The symptom is invisible unless you examine state.json and notice that phases ran out of order or that the phase-loop controller's state management patterns are absent.

### Triggering Conditions

- Workflow type: `fix` (or any workflow with `MODE: init-and-phase-01`)
- Orchestrator invoked via Task tool with `MODE: init-and-phase-01` in the prompt
- GATE-01 passes successfully (the overrun only happens when Phase 01 succeeds -- if it fails, the orchestrator stops naturally)

---

## Execution Path

### Expected Execution Path (MODE: init-and-phase-01)

```
isdlc.md STEP 1
  |
  v
Task → sdlc-orchestrator (MODE: init-and-phase-01)
  |
  ├── Section 3: Initialize workflow (validate constitution, write state)
  ├── Section 3a: Create git branch
  ├── Delegate to Phase 01 agent (requirements-analyst)
  ├── Validate GATE-01
  ├── Section 3b: Generate plan
  ├── STOP ← Mode boundary
  └── Return JSON: { status: "phase_01_complete", phases: [...], ... }
  |
  v
isdlc.md STEP 2: Create foreground task list
  |
  v
isdlc.md STEP 3: Phase loop (one phase at a time)
  ├── 3a: TaskUpdate in_progress
  ├── 3c-prime: Pre-delegation state update
  ├── 3d: Task → phase-agent (direct, not via orchestrator)
  ├── 3e: Post-phase state update
  └── 3f: TaskUpdate completed
```

### Actual Execution Path (Observed)

```
isdlc.md STEP 1
  |
  v
Task → sdlc-orchestrator (MODE: init-and-phase-01)
  |
  ├── Section 3: Initialize workflow
  ├── Section 3a: Create git branch
  ├── Delegate to Phase 01 agent
  ├── Validate GATE-01
  ├── Section 3b: Generate plan
  ├── Section 4a fires: "GATE passed → AUTOMATICALLY advance"
  ├── Delegate to Phase 02 agent           ← OVERRUN BEGINS
  ├── Validate GATE-02
  ├── Section 4a fires again
  ├── Delegate to Phase 05 agent
  ├── ... continues through ALL remaining phases ...
  ├── Delegate to Phase 08 agent
  ├── Validate GATE-08
  ├── Section 3a (merge): Merge to main
  └── Return (entire workflow completed)
  |
  v
isdlc.md: Receives result, but workflow is already done
  STEP 2: Creates tasks for phases that already ran
  STEP 3: Never executes (all phases completed)
```

### Call Chain Analysis

The key call chain that produces the overrun:

1. `isdlc.md` STEP 1 delegates to orchestrator with `MODE: init-and-phase-01`
2. Orchestrator reads Section 3c, sees mode definitions (lines 640-683)
3. Orchestrator processes Section 3 (init), Section 3a (branch), Phase 01 delegation
4. GATE-01 passes
5. Orchestrator processes Section 3b (plan generation)
6. **At this point, the orchestrator should STOP and return JSON**
7. Instead, Section 4 (Workflow Phase Advancement, line 685) activates
8. Section 4a (line 717) fires with CRITICAL-level imperative: "Phase transitions are AUTOMATIC when gates pass"
9. The orchestrator advances to Phase 02, then 05, then 06, etc.
10. Each gate pass triggers another automatic advancement via Section 4a
11. The loop continues until the final phase completes
12. Section 4 "Workflow Completion" (line 708) triggers merge

### Data Flow

- `MODE: init-and-phase-01` is passed as plain text in the Task prompt
- No programmatic enforcement of mode boundaries exists
- The mode parameter is only referenced in Section 3c (descriptive)
- Section 4/4a has no awareness of or reference to the MODE parameter

---

## Root Cause Analysis

### Primary Hypothesis (Confidence: HIGH)

**Missing explicit stop boundary + competing CRITICAL-level instructions**

The root cause is a **prompt architecture conflict** between two sections of the orchestrator agent:

| Section | Location | Instruction Level | Says |
|---------|----------|-------------------|------|
| 3c (Execution Modes) | Lines 640-683 | Descriptive (table + numbered list) | "init-and-phase-01: Run init + Phase 01 + GATE-01 + plan. Return phases array." |
| 4a (Automatic Transitions) | Lines 717-741 | **CRITICAL** (bold, imperative) | "Phase transitions are AUTOMATIC when gates pass. Do NOT ask for permission." |

When an LLM processes these two sections, Section 4a wins because:

1. **Stronger imperative language**: "CRITICAL", "AUTOMATIC", "FORBIDDEN" vs. descriptive table entries
2. **Positional authority**: Section 4a comes AFTER Section 3c, so the LLM's recency bias favors it
3. **Explicit anti-stopping instruction**: Section 4a explicitly forbids pausing ("Do NOT ask for permission to proceed"), which the LLM interprets as "never stop between phases"
4. **No mode-aware guard in Section 4a**: Section 4a never checks the MODE parameter before advancing

### Evidence

1. **No STOP instruction in Section 3c**: The mode behavior description (line 674) says "Return phases array" but never says "STOP", "DO NOT PROCEED", or "DO NOT delegate to Phase 02". Compare this to line 350 which uses "STOP" explicitly for constitution validation, or line 620 which says "STOP and wait for user input" for human review.

2. **Section 4a is unconditional**: Lines 717-741 apply to ALL phase transitions with no MODE check. The section title "Automatic Phase Transitions (NO PERMISSION PROMPTS)" is a blanket rule with no mode-based exception.

3. **Section 4a's exceptions are narrow**: Only two exceptions exist (lines 743-749): Human Review Checkpoint and Human Escalation. Neither mentions execution modes.

4. **Historical evidence from state.json**: The BUG-0015 workflow history (lines 1353-1470 in state.json) shows phase_snapshots with timestamps that are exactly 2-5 minutes apart (15:03, 15:05, 15:08, 15:10, 15:15, 15:16, 15:20) -- consistent with a single orchestrator running all phases rapidly in one call rather than the phase-loop controller managing them individually.

5. **Skill usage log confirms single orchestrator call**: Line 238 shows `"Init fix workflow BUG-0015-0016"` at 15:14, followed by phases running without separate phase-loop controller entries.

### Secondary Hypothesis (Confidence: MEDIUM)

**Section 4 (Phase Advancement) lacks mode awareness entirely**

Section 4 "Workflow Phase Advancement" (lines 685-715) describes the advancement algorithm with 8 steps. Step 8 is "Delegate to the next phase's agent." This section has no mode check at any of its 8 steps. Even if Section 3c's description were stronger, Section 4's algorithm would still advance because it unconditionally increments `current_phase_index` and delegates.

### Fix Approach

The fix requires changes to **one file**: `src/claude/agents/00-sdlc-orchestrator.md`

**Fix 1: Add explicit CRITICAL-level stop instruction at the top of the orchestrator**

Before Section 1 (or at the very beginning of the execution flow), add a MODE enforcement block that uses the same CRITICAL-level language as Section 4a:

```markdown
# MODE ENFORCEMENT (CRITICAL — READ BEFORE ANY PHASE WORK)

**CRITICAL**: If a MODE parameter is present in your Task prompt, you MUST obey these hard boundaries:

- **MODE: init-and-phase-01**: Run ONLY initialization + Phase 01 + GATE-01 + plan generation.
  After generating the plan, STOP IMMEDIATELY. DO NOT delegate to Phase 02 or any subsequent phase agent.
  Return the structured JSON result and terminate.

- **MODE: single-phase**: Run ONLY the specified PHASE. After that phase's gate passes, STOP IMMEDIATELY.
  DO NOT advance to any other phase. Return the structured JSON result and terminate.

- **MODE: finalize**: Run ONLY merge/completion logic. DO NOT run any phases.
  Return the structured JSON result and terminate.

These boundaries OVERRIDE Section 4a (Automatic Phase Transitions). When MODE is set,
automatic advancement is DISABLED after the mode's scope is complete.
```

**Fix 2: Add mode-aware guard to Section 4a**

In Section 4a, add a mode check before the automatic transition logic:

```markdown
### Mode-Aware Guard (CHECK BEFORE EVERY TRANSITION)

Before ANY automatic phase transition, check the MODE parameter:
- If MODE is `init-and-phase-01` AND Phase 01 + GATE-01 + plan are complete: STOP. Return JSON.
- If MODE is `single-phase` AND the specified phase's gate passed: STOP. Return JSON.
- If MODE is `finalize`: No transitions occur (merge logic only).
- If no MODE: Proceed with automatic transition (original behavior).
```

**Fix 3: Add mode-aware guard to Section 4 (Phase Advancement)**

In the 8-step advancement algorithm, add a mode check before step 8:

```
7.5. CHECK MODE: If MODE is set and the mode's scope has been fulfilled, STOP and return. DO NOT execute step 8.
```

### Complexity Assessment

- **Estimated complexity**: LOW
- **Files affected**: 1 (src/claude/agents/00-sdlc-orchestrator.md)
- **Risk**: LOW (prompt-only change, no runtime code affected)
- **Regression risk**: LOW (backward compatible -- no-mode behavior unchanged)
- **Testing approach**: Structural analysis of the prompt text (verify stop instructions exist, verify mode guards exist, verify instruction positioning)

---

## Tracing Metadata

```json
{
  "tracing_completed_at": "2026-02-14T16:10:00.000Z",
  "sub_agents": ["T1-symptom-analyzer", "T2-execution-path-tracer", "T3-root-cause-identifier"],
  "discovery_report_used": "docs/project-discovery-report.md",
  "bug_report_used": "docs/requirements/BUG-0016-orchestrator-scope-overrun/requirements-spec.md",
  "error_keywords": ["init-and-phase-01", "automatic phase transitions", "MODE enforcement", "scope overrun", "phase-loop controller bypass"],
  "files_traced": [
    "src/claude/agents/00-sdlc-orchestrator.md",
    "src/claude/commands/isdlc.md"
  ],
  "root_cause_file": "src/claude/agents/00-sdlc-orchestrator.md",
  "root_cause_sections": ["3c (Execution Modes)", "4 (Workflow Phase Advancement)", "4a (Automatic Phase Transitions)"],
  "fix_locations": [
    { "file": "src/claude/agents/00-sdlc-orchestrator.md", "action": "Add CRITICAL stop instruction before Section 1", "priority": "P0" },
    { "file": "src/claude/agents/00-sdlc-orchestrator.md", "action": "Add mode-aware guard to Section 4a", "priority": "P0" },
    { "file": "src/claude/agents/00-sdlc-orchestrator.md", "action": "Add mode check to Section 4 step 7.5", "priority": "P1" }
  ]
}
```
