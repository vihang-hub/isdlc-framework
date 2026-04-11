# Impact Analysis: REQ-GH-239

## Summary

| Metric | Value |
|---|---|
| Files affected | 12 |
| New files | 4 |
| Modules touched | 6 |
| Risk score | medium |
| Coupling | medium |
| Coverage gaps | low (existing tests cover most paths) |

## Files Affected

### New files (4)

| File | Purpose | Size estimate |
|---|---|---|
| `lib/embedding/engine/memory-calibrator.js` | Calibration implementation | ~250 lines |
| `lib/embedding/engine/memory-calibrator.test.js` | Calibration unit tests | ~200 lines |
| `src/core/finalize/refresh-code-embeddings.js` | F0009 handler | ~150 lines |
| `src/core/finalize/refresh-code-embeddings.test.js` | F0009 handler tests | ~180 lines |

### Modified files (10)

| File | Change | LOC delta |
|---|---|---|
| `lib/embedding/engine/index.js` | Remove outer batch loop, single adapter.embed call | ~-20/+10 |
| `lib/embedding/engine/jina-code-adapter.js` | Unify embed interface across in-process and pooled adapters | ~+40/-20 |
| `lib/embedding/engine/worker-pool.js` | Extend pool.embed with onProgress + throughput aggregator | ~+60 |
| `lib/embedding/engine/device-detector.js` | Read calibration cache before falling back to constants | ~+30 |
| `src/core/config/config-service.js` | Add hasUserEmbeddingsConfig() export | ~+15 |
| `src/core/finalize/finalize-utils.js` | Wire F0009 to refresh-code-embeddings handler | ~+25 |
| `bin/isdlc.js` | Install handler adds embeddings prompt | ~+30 |
| `bin/isdlc-embedding.js` | Calibration integration + throughput progress rendering | ~+40/-15 |
| `install.sh` | Matching embeddings prompt in bash | ~+20 |
| `.isdlc/config/finalize-steps.md` + `src/core/finalize/finalize-steps.default.md` | F0009 type: shell → type: internal | ~0 |

### Test files modified (5)

| File | Change |
|---|---|
| `lib/embedding/engine/worker-pool.test.js` | Concurrent dispatch tests, progress callback format tests |
| `lib/embedding/engine/jina-code-adapter.test.js` | Unified embed interface tests for both adapter variants |
| `lib/embedding/engine/index.test.js` | Single dispatch call verification |
| `lib/embedding/engine/device-detector.test.js` | Calibration cache read/fallback tests |
| `tests/core/config/config-defaults.test.js` OR `tests/core/config/config-service.test.js` | hasUserEmbeddingsConfig tests |

## Blast Radius

### Directly affected modules

- `lib/embedding/engine/` (5 files + 5 test files) — engine, adapter, pool, detector, new calibrator
- `src/core/config/` (1 file + 1 test file) — config-service extension
- `src/core/finalize/` (2 files + 2 test files) — utils + new handler
- `bin/` (2 files) — install CLI + embedding CLI
- `install.sh` — bash installer
- `.isdlc/config/finalize-steps.md` + shipped default — step metadata

### Transitively affected

- **Build workflow finalize sequence** — F0009 activation means every build workflow finalize now runs refresh-code-embeddings after F0008. All future build workflows on projects with embeddings configured will see this new step. Fail-open behavior ensures no regression risk.
- **Discover workflow** — The discover orchestrator's embedding generation step (Step 7.9 from GH-238) continues to work unchanged; it calls the same `isdlc-embedding generate` CLI which internally benefits from the calibration + unified interface changes.
- **Install flow** — New users get the opt-in prompt; legacy installs are unchanged (no retroactive migration).

### Not affected

- Claude agent definitions in `src/claude/agents/` — no changes
- Claude hooks in `src/claude/hooks/` — no changes
- Core orchestration (`src/core/orchestration/`) — no changes
- State management (`src/core/state/`) — no changes
- Other provider integrations (`src/providers/`) — no changes
- Phase agents (01-08) — no changes

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Concurrent dispatch introduces race conditions in pool | High | Low | Pool's round-robin + `Promise.all` pattern is already used internally; only new wiring is the progress callback. Unit tests for ordering. |
| Calibration produces wrong estimate (too high → OOM risk) | High | Low | 20% safety margin on calibrated value; hard ceiling via `max_memory_gb` enforced separately; RSS sampling uses standard Node API. |
| Calibration produces wrong estimate (too low → under-utilize) | Medium | Low | Not a correctness bug, just suboptimal. Can re-calibrate by changing config or deleting cache file. |
| F0009 hangs build finalize on long refreshes | Medium | Low | NFR-004 caps steady-state incremental at ≤30s / ≤3min. Fail-open contract ensures finalize never blocks. Child process can be killed by parent if needed. |
| Install prompt broken on non-interactive CI | Low | Medium | EOF / broken stdin defaults to NO (safe opt-out, FR-010 default). Tests cover this path. |
| Breaking change to adapter.embed() internal contract | Low | Certain | It IS a breaking change, but the exported `embed()` in engine/index.js keeps its signature. Only internal callers (adapters) change. No external consumers. |
| Progress callback out-of-order events confuse the CLI renderer | Low | Medium | Pool aggregates into a monotonic counter before firing. Out-of-order batches still produce monotonic `processed` values. |
| Worker_threads memory accounting doesn't match expectations | Medium | Low | Worker threads share parent heap, so parent RSS includes worker cost. Calibrating ONE worker in the parent and reading parent RSS is the correct measurement. Verified via GH-238 observations (1.9GB parent RSS with 1 worker). |

**Overall risk**: Medium. The largest individual risk is calibration producing a wrong estimate, mitigated by the safety margin and existing `max_memory_gb` ceiling.

## Coverage Gaps

| Gap | Addressed by |
|---|---|
| Concurrent dispatch across multiple workers | T005 (pool tests), T017 (full suite), T018 (benchmark) |
| Calibration timeout fallback | T002, T004, T017 |
| Calibration cache fingerprint invalidation | T002, T004 |
| F0009 opt-out and bootstrap paths | T003, T010 |
| Installer y/N handling in both CLI and bash | T003, T013, T014 |
| hasUserEmbeddingsConfig raw-vs-merged distinction | T003, T009 |
| Memory respect under parallelism > 1 (NFR-001) | T018 benchmark |
| Throughput improvement (NFR-002) | T018 benchmark |

## Estimated Tier

- File count: 12 (within standard range, 5 < count < 20)
- Module count: 6
- Risk: medium
- Coupling: medium
- Coverage gaps: low

**Recommended tier**: standard

## Recommended Scope

- **Scope**: standard
- **Rationale**: ~12 files affected, 4 new modules including a new calibration subsystem, engine/adapter/pool refactor, finalize integration, and installer changes. Medium complexity with clear module boundaries.
- **User confirmed**: yes (accepted Requirements + Architecture + Design + Tasks summaries)
