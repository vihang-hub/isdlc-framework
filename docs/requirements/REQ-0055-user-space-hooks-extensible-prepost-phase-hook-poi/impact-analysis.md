# Impact Analysis: User-Space Hooks

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-03-08
**Coverage**: 100%

---

## 1. Blast Radius

### Tier 1: Direct Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `src/antigravity/phase-advance.cjs` | Modify | Add user-space hook execution before gate validation (pre-gate) and after phase completion (post-phase) |
| `src/antigravity/workflow-init.cjs` | Modify | Add pre-workflow hook execution after initialization |
| `src/antigravity/workflow-finalize.cjs` | Modify | Add post-workflow hook execution before finalization completes |
| `src/claude/hooks/lib/user-hooks.cjs` | **New** | Hook discovery, resolution, and execution engine (harness infrastructure) |
| `docs/isdlc/user-hooks.md` | **New** | Hook authoring guide |

### Tier 2: Transitive Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `src/antigravity/ANTIGRAVITY.md.template` | Modify | Document user-space hook mechanism in orchestrator template |
| `src/claude/hooks/lib/common.cjs` | No change | `getProjectRoot()` imported directly by co-located user-hooks.cjs |
| `update.sh` / `lib/updater.js` | Modify (docs only) | Add `.isdlc/hooks/` to the documented "preserved" list in header comments |

### Tier 3: Side Effects

| Area | Risk | Description |
|------|------|-------------|
| Workflow execution time | Low | Each hook point adds discovery scan + execution time. Mitigated by timeout enforcement. |
| Existing framework hooks | None | User-space hooks are architecturally separate. No interaction with the 26 existing Claude Code hooks. |
| State.json integrity | None | User hooks do not read or write state.json. Context passed via environment variables. |

---

## 2. Entry Points

| Entry Point | Integration Method |
|-------------|-------------------|
| `phase-advance.cjs` main() | Insert `runUserHooks('pre-gate', context)` before gate validation logic (line ~69). Insert `runUserHooks('post-{phase}', context)` after successful advancement. |
| `workflow-init.cjs` main() | Insert `runUserHooks('pre-workflow', context)` after state initialization, before output. |
| `workflow-finalize.cjs` main() | Insert `runUserHooks('post-workflow', context)` after merge/finalize, before final output. |

---

## 3. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Hook execution failure crashes phase-advance | Medium | High | Wrap hook execution in try/catch; report failure but never throw from hook runner |
| Slow hooks delay workflow | Medium | Medium | Timeout enforcement (default 60s, configurable). Kill after timeout. |
| Hook blocks gate incorrectly | Low | Medium | User override mechanism -- framework presents block to user, user decides |
| Phase alias collision | Low | Low | Aliases are one-to-one; log resolved name for debugging |

---

## 4. Implementation Order

1. **`src/claude/hooks/lib/user-hooks.cjs`** -- Core engine: discovery, resolution, execution, timeout, exit code handling
2. **`phase-advance.cjs`** integration -- pre-gate and post-phase hooks
3. **`workflow-init.cjs`** integration -- pre-workflow hooks
4. **`workflow-finalize.cjs`** integration -- post-workflow hooks
5. **`ANTIGRAVITY.md.template`** update -- Document in orchestrator template
6. **`docs/isdlc/user-hooks.md`** -- Authoring guide
7. **Tests** -- Unit tests for user-hooks.cjs (discovery, resolution, execution, timeout, exit codes)

---

## 5. File Count

- **Modified**: 3 files (phase-advance.cjs, workflow-init.cjs, workflow-finalize.cjs)
- **New**: 2 files (src/claude/hooks/lib/user-hooks.cjs, docs/isdlc/user-hooks.md)
- **Docs-only modified**: 2 files (update.sh header, lib/updater.js header -- add .isdlc/hooks/ to preserved list)
- **Possibly modified**: 1 file (ANTIGRAVITY.md.template)
- **Total**: 7-8 files
