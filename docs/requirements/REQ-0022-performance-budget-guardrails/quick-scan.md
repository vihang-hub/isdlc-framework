# Quick Scan: REQ-0022 Performance Budget and Guardrail System

## Scope Estimate

**Estimated files to modify**: 7-9
**Estimated files to create**: 1-2
**Estimated complexity**: Medium
**Estimated blast radius**: Low-medium (mostly additive instrumentation)

## Existing Infrastructure (What Already Exists)

### Phase-Level Timing (COMPLETE)
- `state.json` → `workflow_history[].phase_snapshots[]` already tracks:
  - `started` / `completed` / `duration_minutes` / `gate_passed` per phase
- `common.cjs` functions: `_computeDuration()`, `_computeMetrics()`, `collectPhaseSnapshots()`

### Workflow-Level Timing (COMPLETE)
- `active_workflow.started_at` / `completed_at` in state.json
- `workflow_history[].metrics.total_duration_minutes` already computed

### Sizing System (COMPLETE — REQ-0011)
- Three intensity tiers: light / standard / epic
- `active_workflow.sizing.effective_intensity` tracks actual intensity
- `workflows.json` has `sizing.thresholds` and `sizing.light_skip_phases`

### Degradation Hints (PARTIAL)
- `pre-task-dispatcher.cjs` line 134: emits `DEGRADATION_HINT` for phase timeouts
- Hints include: `reduce_debate_rounds`, `reduce_parallelism`, `skip_optional_steps`
- **Gap**: Hints are emitted but NOT acted on by agents

### Hook Dispatcher Timing (NOT INSTRUMENTED)
- 5 dispatchers (pre-task, post-task, pre-skill, post-bash, post-write-edit)
- No `performance.now()` or `console.time()` calls
- 9 hooks in pre-task run sequentially in a for-loop

### Completion Dashboard (NOT IMPLEMENTED)
- Metrics stored in `workflow_history[].metrics` but never displayed to user

## Key Files

### Must Modify
| File | Change |
|------|--------|
| `src/claude/commands/isdlc.md` | STEP 3c-prime (phase start timing), STEP 3e (phase end timing + budget check), STEP 4 finalize (dashboard output) |
| `src/claude/hooks/lib/common.cjs` | Add timing utilities, budget computation, rolling average comparison |
| `src/isdlc/config/workflows.json` | Add `performance_budgets` per intensity tier |
| `src/claude/hooks/dispatchers/pre-task-dispatcher.cjs` | Hook-level timing instrumentation |
| `src/claude/hooks/dispatchers/post-task-dispatcher.cjs` | Hook-level timing instrumentation |
| `src/claude/hooks/dispatchers/pre-skill-dispatcher.cjs` | Hook-level timing instrumentation |
| `src/claude/hooks/dispatchers/post-bash-dispatcher.cjs` | Hook-level timing instrumentation |
| `src/claude/hooks/dispatchers/post-write-edit-dispatcher.cjs` | Hook-level timing instrumentation |
| `src/claude/hooks/workflow-completion-enforcer.cjs` | Store timing summary in workflow_history |

### Must Create
| File | Purpose |
|------|---------|
| `src/claude/hooks/lib/performance-budget.cjs` | Budget computation, enforcement logic, rolling average comparison |

### Reference (Read-Only)
| File | Why |
|------|-----|
| `src/claude/skills/quality-loop/fan-out-engine/SKILL.md` | Fan-out chunk configuration (max_chunks = 8, strategies) |
| `src/claude/agents/00-sdlc-orchestrator.md` | Debate mode routing, finalize step |
| `docs/requirements/REQ-0011-adaptive-workflow-sizing/` | Sizing system reference |
| `src/claude/agents/discover/deep-discovery-config.json` | Debate round structure reference |

## Keyword Matches

| Keyword | Files Found |
|---------|-------------|
| `console.time` | 0 in dispatchers (not instrumented) |
| `duration_minutes` | common.cjs, state.json |
| `phase_snapshots` | common.cjs, workflow-completion-enforcer.cjs |
| `DEGRADATION_HINT` | pre-task-dispatcher.cjs |
| `max_rounds` | Not found (hardcoded in agent files) |
| `max_chunks` | SKILL.md (hardcoded = 8) |
| `performance_budget` | 0 files (does not exist yet) |
| `rolling_average` | 0 files (does not exist yet) |
| `effective_intensity` | common.cjs, state.json |

## Dependencies

- REQ-0005 (workflow_history): DONE
- REQ-0011 (adaptive sizing): DONE
- T1-T3 (dispatcher consolidation, prompt optimization, orchestrator bypass): DONE
- REQ-0014-0017 (debates, fan-out): DONE — these are the features governed by performance budgets

## Risk Assessment

- **Low risk**: Timing instrumentation is purely additive — no existing behavior changes
- **Medium risk**: Budget enforcement degradation logic (reducing debate rounds / fan-out) affects output quality
- **Mitigation**: Degradation is advisory (warnings + hints), never blocks workflow execution
- **Testing**: Need to verify timing accuracy, budget computation, and degradation hint propagation
