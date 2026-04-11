# Architecture Overview: REQ-GH-239

## Architecture Options

### Option A (SELECTED) — Push the batch loop into the pool

Engine calls `adapter.embed(allTexts, options)` exactly once. The pool's existing concurrent dispatch logic takes over. Unified interface across in-process and pooled paths.

**Pros**:
- Pool already has concurrent fan-out via round-robin (`createWorkerPool.embed` fires `sendBatch` without await)
- Progress callback semantics owned by one component
- Minimal change to pool internals (just add `onProgress` parameter)
- Unified adapter interface simplifies engine code

**Cons**:
- Breaking change to adapter.embed() internal contract (accepts full array, not slices)
- In-process path needs to synthesize batch cadence for progress consistency

### Option B (REJECTED) — Concurrent engine dispatch via Promise.all

Engine issues N concurrent `adapter.embed(batch_i)` calls (N = pool.size) via `Promise.all`, gathering results in order.

**Pros**:
- Smaller change to pool (no modifications)
- Engine retains batch slicing logic

**Cons**:
- Engine becomes pool-aware (must read `pool.size` to know how many concurrent calls to issue)
- Batch-splitting logic stays split between engine and pool
- Progress tracking split across two components (engine counts dispatched; pool counts completed)
- Doesn't scale cleanly if pool implementation changes

### Option C (REJECTED) — Direct worker_threads in engine, bypass pool

Engine spawns workers directly via `worker_threads`, managing lifecycle and dispatch.

**Pros**:
- Full control over dispatch strategy

**Cons**:
- Discards GH-238's crash recovery, shutdown, and respawn logic
- Regression risk on memory bounds (existing `max_memory_gb` enforcement is in device-detector + pool)
- Violates current separation of concerns (pool module loses its raison d'être)

## Selected Architecture

### Dispatch Chain (Unified)

```
engine.embed(texts, config, options)
  ↓
adapter.embed(texts, { batchSize, onProgress, signal })    ← single call, not a loop
  ├─ [pooled]     pool.embed(texts, batchSize, { onProgress }) → concurrent fan-out
  └─ [in-process] internal text-by-text loop (parallelism = 1)
```

### New Modules

**`lib/embedding/engine/memory-calibrator.js`**
- `calibratePerWorkerMemory(config, options) → CalibrationResult`
- Spawns a one-shot worker via existing `createWorkerPool(workerPath, { poolSize: 1 })`
- Samples `process.memoryUsage().rss` every 500ms during sample inference
- Computes `perWorkerMemGB = (peakMemGB - baselineMemGB) × 1.2` (20% safety margin)
- Writes `.isdlc/embedding-calibration.json` keyed by `{device, dtype, model}` fingerprint
- Falls back to hardcoded `WORKER_MEMORY_ESTIMATE_GB` on timeout (2 min) or error

**`src/core/finalize/refresh-code-embeddings.js`**
- `refreshCodeEmbeddings(projectRoot) → RefreshResult`
- F0009 handler: opt-in check → bootstrap check → spawn child process
- Spawns `isdlc-embedding generate . --incremental` via `child_process.spawn`
- Forwards stdout/stderr with `[F0009]` prefix
- Never throws (fail-open contract)

### Modified Modules

1. **`lib/embedding/engine/index.js`** — remove outer batch loop; single `adapter.embed(texts, ...)` call; post-compute totalTokens
2. **`lib/embedding/engine/jina-code-adapter.js`** — unified `embed(texts, options)` signature for both adapter variants
3. **`lib/embedding/engine/worker-pool.js`** — extend `pool.embed()` to accept `options.onProgress`; fire per-batch with throughput aggregator using 10-batch rate window
4. **`lib/embedding/engine/device-detector.js`** — read calibration cache before falling back to constants; fingerprint on `(device, dtype, model)`
5. **`src/core/config/config-service.js`** — new export `hasUserEmbeddingsConfig(projectRoot)` reading raw `.isdlc/config.json` (bypassing merge layer)
6. **`src/core/finalize/finalize-utils.js`** — wire F0009 to `refreshCodeEmbeddings` (type: internal, not shell)
7. **`bin/isdlc.js`** — install/init handler adds embeddings prompt; conditionally includes embeddings block in generated config
8. **`bin/isdlc-embedding.js`** — invoke calibration before pool creation on cache miss; update progress rendering to throughput+ETA format
9. **`install.sh`** — matching bash embeddings prompt (same wording, same default)
10. **`.isdlc/config/finalize-steps.md`** — F0009 metadata change from `type: shell` to `type: internal`

## Technology Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Concurrency primitive | Node.js `worker_threads` (unchanged) | Existing pool infrastructure, no new native deps |
| Memory measurement | `process.memoryUsage().rss` sampled @ 500ms | Cross-platform, no native deps, accurate enough for sizing |
| Calibration sample | 20 synthetic texts × ~2000 chars each | Matches real code chunk distribution measured in GH-238 |
| Calibration timeout | 2 minutes hard ceiling | Bounded startup cost; fallback is safe |
| Progress aggregation | Pool-level monotonic counter | Order-independent under concurrent dispatch |
| Rate smoothing | Moving average over last 10 batches | Stabilizes ETA without complex statistics |
| F0009 invocation | `child_process.spawn` existing CLI | Reuses generate/reload logic, isolates failures |
| Config presence check | Direct file read, bypass merge | Essential for opt-out to work correctly |
| Installer prompt | stdin `readline` (node) / `read` (bash) | Matches existing install flow, no TUI framework |
| Safety margin | 20% on calibrated RSS | Accounts for noise and runtime drift |

## Integration Architecture

### Build Finalize Flow

```
Phase-Loop Controller
  ↓
Phase 05 → 06 → 16 → 08 complete
  ↓
finalize-steps.md checklist
  ├─ F0001 merge to main
  ├─ F0002 sync external status (GitHub)
  ├─ F0003 clear active_workflow
  ├─ F0004..F0008 (cache, contracts, index, memory)
  └─ F0009 refreshCodeEmbeddings(projectRoot)    ← NEW
        ├─ !hasUserEmbeddingsConfig() → {status: skipped}
        ├─ no *.emb on disk → {status: bootstrap_needed}
        └─ spawn child: isdlc-embedding generate . --incremental
              ├─ stream throughput+ETA progress to parent
              ├─ generate .emb package
              ├─ POST /reload (or startServer if down)
              └─ return {status: success, chunksProcessed, durationMs}
        → fail-open: finalize never blocks on embedding issues
```

### Calibration Flow (First Run or Config Change)

```
isdlc-embedding generate .
  ↓
resolveConfig(userConfig, cliOverrides)
  ↓
readCachedCalibration(projectRoot, fingerprint)
  ├─ HIT → use cached perWorkerMemGB
  └─ MISS → calibratePerWorkerMemory(config)
        ├─ record baselineMemGB
        ├─ spawn 1 worker via pool infrastructure
        ├─ run 20-text sample batch
        ├─ sample RSS every 500ms, take peak
        ├─ compute perWorkerMemGB = (peak - baseline) × 1.2
        ├─ write .isdlc/embedding-calibration.json
        └─ return calibration result
  ↓
computePoolSize(availableMemGB, perWorkerMemGB)
  ↓
createWorkerPool(poolSize, perWorkerMemGB)
  ↓
engine.embed(texts, config, { onProgress })
```

### Install-Time Flow

```
./install.sh | isdlc init
  ↓
interactive setup prompts (existing)
  ↓
"Enable code embeddings for semantic search? [y/N]"  ← NEW
  ├─ y → .isdlc/config.json includes embeddings section with defaults
  └─ n → .isdlc/config.json OMITS embeddings key entirely
  ↓
write .isdlc/config.json
  ↓
print hint: "Run 'isdlc-embedding {generate|configure}' at any time."
```

## Assumptions and Inferences (architecture)

- **A-ARCH-1** — The worker pool's round-robin dispatch in `createWorkerPool.embed()` is already concurrent; the tight loop of `sendBatch()` calls without `await` confirms this. The bug is upstream (engine feeds one batch at a time), not in pool internals. Evidence: traced the code path in GH-238.
- **A-ARCH-2** — Calibrating with 20 texts × 2000 chars will exercise the same memory paths as real code chunks (attention buffers, tokenizer, model weights). Peak RSS stabilizes within ~30 seconds of first inference.
- **A-ARCH-3** — `process.memoryUsage().rss` reports the parent process RSS; worker threads share the parent's heap and count toward the parent's RSS. Calibrating ONE worker and comparing before/after gives an accurate per-worker cost.
- **A-ARCH-4** — Batches complete out-of-order under concurrent dispatch. The monotonic counter at the pool level is order-independent because we only accumulate total chunk count, not per-batch indices.
- **A-ARCH-5** — Moving average over 10 batches is sufficient to stabilize `chunks_per_sec` and `eta_seconds` without complex statistics; early runs will show higher variance, acceptable.
- **A-ARCH-6** — Spawning the existing CLI as a subprocess (rather than reimplementing generation inside `finalize-utils.js`) trades a process spawn for isolation, code reuse, and decoupled failure modes.
- **A-ARCH-7** — A single y/N installer prompt is sufficient for opt-in; advanced configuration (device, dtype, max_memory_gb) can be set later via `isdlc-embedding configure` or direct JSON edit.
- **A-ARCH-8** — Legacy installs with existing embeddings blocks stay enabled because `hasUserEmbeddingsConfig()` returns true when the key is present, regardless of when it was added.
- **A-ARCH-9** — F0009 metadata switching from `type: shell` to `type: internal` means `finalize-utils.js` exports a JS function called directly by the Phase-Loop Controller, matching F0001/F0002/F0003 pattern. `.isdlc/config/finalize-steps.md` and `src/core/finalize/finalize-steps.default.md` both need the metadata update.
- **A-ARCH-10** — Removing the outer loop from `engine/index.js` is internal refactoring; the exported `embed(texts, config, options)` signature stays the same, preserving backward compatibility for any external callers.
