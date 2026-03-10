# REQ-0059: Architecture Overview — Workflow Interruption

## 1. Architecture Options

### Option A: State-level suspend/resume in existing scripts

Add `suspended_workflow` field to state.json. Modify `workflow-init.cjs` to suspend on `--interrupt`, `workflow-finalize.cjs` to restore on finalize. Phase reset reuses `workflow-retry.cjs` logic.

| Aspect | Assessment |
|--------|-----------|
| Pros | Zero new files. Reuses existing retry logic. Hooks unaffected (only read `active_workflow`). Minimal blast radius. |
| Cons | `workflow-init.cjs` grows more complex. Suspend/resume logic spread across two files. |
| Pattern alignment | Follows existing pattern — all workflow lifecycle in `src/antigravity/workflow-*.cjs` |
| Verdict | **Selected** |

### Option B: Dedicated suspend/resume scripts

Create `workflow-suspend.cjs` and `workflow-resume.cjs` as standalone scripts. `workflow-init` and `workflow-finalize` call them.

| Aspect | Assessment |
|--------|-----------|
| Pros | Clean separation of concerns. Easier to test independently. |
| Cons | More files. Indirection — init calls suspend, finalize calls resume. Harder to keep atomic. |
| Pattern alignment | Breaks the pattern of workflow lifecycle being in init/advance/finalize. |
| Verdict | Eliminated — over-engineered for depth-1 suspension |

## 2. Selected Architecture — ADR

### ADR-001: Inline suspend/resume in workflow-init and workflow-finalize

- **Status**: Accepted
- **Context**: Need to suspend an active workflow when a harness bug is detected, run a fix workflow, then resume. Max depth 1.
- **Decision**: Add `--interrupt` flag to `workflow-init.cjs`. When set with `--type fix` and `active_workflow` exists, move `active_workflow` → `suspended_workflow` before initializing the fix. On `workflow-finalize.cjs`, if `suspended_workflow` exists after clearing `active_workflow`, restore it with phase iteration reset.
- **Rationale**: Option A has the smallest blast radius (3 files modified, 0 new production files). The suspend/resume logic is <30 lines in each file. Hooks don't need changes — they only read `active_workflow` which continues to work normally for the fix workflow.
- **Consequences**: `workflow-init.cjs` has a new code path for `--interrupt`. `state.json` gains a new top-level field `suspended_workflow`. `validate-state.cjs` needs to validate it.

### ADR-002: Phase iteration reset on resume (reuse workflow-retry logic)

- **Status**: Accepted
- **Context**: When the suspended workflow resumes, the AI has lost conversation context. The current phase needs to restart cleanly.
- **Decision**: On restore, reset the current phase's iteration state (`test_iteration`, `constitutional_validation`, `interactive_elicitation`) — same logic as `workflow-retry.cjs`.
- **Rationale**: This is a solved pattern. `workflow-retry.cjs` already resets iteration state while preserving artifacts. No new logic needed, just reuse.
- **Consequences**: The resumed phase may redo some work (e.g., re-run tests that already passed), but artifacts from before suspension are preserved, limiting rework.

## 3. Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| New dependencies | None | Pure state manipulation in existing Node.js scripts |
| State schema change | Add `suspended_workflow` field | Same schema as `active_workflow` — no new types |
| Git branching | No changes | Fix uses `bugfix/*`, feature uses `feature/*` — no conflict |

## 4. Integration Architecture

### Data flow

```
Hook blocks → AI auto-recovery fails → AI detects harness bug
  → AI informs user ("framework issue, not your code")
  → User consents
  → workflow-init.cjs --type fix --interrupt --description "..."
    → active_workflow → suspended_workflow
    → new fix workflow → active_workflow
  → [fix phases run normally]
  → workflow-finalize.cjs
    → active_workflow → workflow_history
    → suspended_workflow → active_workflow (with phase reset)
    → delete suspended_workflow
```

### Files modified

| File | Change | FR |
|------|--------|-----|
| `src/antigravity/workflow-init.cjs` | Add `--interrupt` flag handling: suspend active workflow, check depth limit, type restriction | FR-002, FR-003, FR-004, FR-005 |
| `src/antigravity/workflow-finalize.cjs` | After clearing `active_workflow`, restore `suspended_workflow` with phase reset | FR-004, FR-006, FR-008 |
| `src/antigravity/validate-state.cjs` | Validate `suspended_workflow` schema if present | FR-006 |
| `CLAUDE.md` (Antigravity instructions) | Update Hook Block Auto-Recovery Protocol with harness bug detection flow | FR-001, FR-007 |

### Files NOT modified

- All hooks (`src/claude/hooks/*.cjs`) — they read `active_workflow` only, unaffected
- `phase-advance.cjs` — operates on `active_workflow`, unaffected
- `workflow-retry.cjs` / `workflow-rollback.cjs` — operate on `active_workflow`, unaffected

### State schema addition

```json
{
  "active_workflow": { ... },
  "suspended_workflow": { ... },
  "state_version": N
}
```

`suspended_workflow` has the exact same shape as `active_workflow`. It is absent (not present) when no suspension is active — not `null`.

## 5. Summary

| Metric | Value |
|--------|-------|
| Files modified | 4 (3 scripts + 1 doc) |
| New files | 0 production, 3 test files |
| New dependencies | 0 |
| Hooks affected | 0 |
| Risk level | Low — additive change, no existing behavior modified |

### Key decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Inline in existing scripts, not new files | Follows existing workflow lifecycle pattern, minimal blast radius |
| 2 | Phase reset on resume via retry logic | Solved pattern, handles context loss reliably |
| 3 | `--interrupt` as internal flag | User doesn't need to know mechanics; AI uses it after getting consent |
| 4 | Depth limit of 1, fix-only | Keeps implementation simple; escalate for edge cases |

## Pending Sections

None — all sections complete.
