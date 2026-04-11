# Requirements Specification: REQ-GH-239

**Title**: Worker pool parallelism: engine's sequential batch loop defeats multi-worker speedup
**Source**: GitHub Issue #239
**Labels**: enhancement, performance, embeddings
**Status**: Analyzed (accepted 2026-04-11)

## Problem Statement

Setting `embeddings.parallelism > 1` in `.isdlc/config.json` does not speed up end-to-end embedding generation. Root cause: `lib/embedding/engine/index.js` iterates batches sequentially (`for` loop with `await adapter.embed(batch)`), so the worker pool only ever receives 1 batch of 32 texts at a time. With 2 workers configured, only 1 is ever active; the other sits idle.

Observed in the GH-238 dogfooding run on a 24GB Apple Silicon Mac:
- `parallelism: 1` (in-process): ~2-5 chunks/sec steady state
- `parallelism: 2` (worker pool, 2 CoreML workers): ~2.1 chunks/sec — no improvement
- 19811-chunk full run took ~1h40min with only one worker effectively utilized
- Peak node RSS stayed at ~1.9GB even though `max_memory_gb: 20` was configured, suggesting the hardcoded `WORKER_MEMORY_ESTIMATE_GB.coreml = 6` per-worker constant is ~3× too conservative

## Scope

This REQ delivers both the engine-loop fix AND memory calibration in a single build, plus makes embeddings an explicit opt-in at install time and wires F0009 to run incremental refreshes automatically on every build finalize.

## Functional Requirements

### FR-001 Concurrent batch dispatch
**Given** `parallelism > 1` and a pooled adapter
**When** `adapter.embed(allTexts, { batchSize, onProgress })` is called
**Then** the worker pool splits the text array into N batches and dispatches them across all workers concurrently (not sequentially)
**And** batches run in parallel, with total wall-clock latency approximately `(N_batches / N_workers) × per-batch-latency`

### FR-002 Unified adapter interface
**Given** both in-process and pooled adapters
**When** the engine calls `adapter.embed(texts, options)` with the full text array
**Then** both adapter implementations accept the same signature: `embed(texts: string[], options: { batchSize, onProgress, signal }) => Promise<Float32Array[]>`
**And** the engine issues exactly one `adapter.embed` call per generation run (no outer batch loop)

### FR-003 Memory calibration
**Given** no calibration file exists, OR the calibration fingerprint mismatches the current config
**When** the embedding pipeline is first invoked (e.g., via `isdlc-embedding generate`)
**Then** the framework spawns a one-shot calibration worker that loads the model and processes a sample batch
**And** it samples RSS every 500ms during processing, takes the peak, applies a 20% safety margin
**And** writes `.isdlc/embedding-calibration.json` with `{device, dtype, model, perWorkerMemGB, baselineMemGB, peakMemGB, sampleCount, durationMs, measuredAt, fingerprint}`
**And** uses the measured `perWorkerMemGB` as the primary source for parallelism calculation

### FR-004 Calibration cache invalidation
**Given** a valid calibration file exists with fingerprint X
**When** `embeddings.device`, `embeddings.dtype`, or `embeddings.model` is changed (new fingerprint Y)
**Then** the calibration is re-run and the file is overwritten with the new measurement
**And** no manual cache clearing is required by the user

### FR-005 Throughput + ETA progress callback
**Given** a generation run is in progress
**When** a batch completes in any worker
**Then** `onProgress({processed, total, chunks_per_sec, eta_seconds, active_workers})` fires
**And** `processed` is monotonic (even though batches may complete out-of-order)
**And** `chunks_per_sec` is computed from a 10-batch moving average for stability
**And** `eta_seconds` is `(total - processed) / chunks_per_sec`
**And** `active_workers` reflects the number of workers currently busy
**And** the CLI renders the callback as `[generate] 12487/19811 (63%) | 4.2 chunks/s | ETA 28min | workers: 4`

### FR-006 Opt-in via config presence
**Given** `.isdlc/config.json` has no `embeddings` block, OR `embeddings: null`
**When** any build finalize runs F0009
**Then** F0009 skips silently and no embedding work is triggered
**And** the presence check reads the RAW user-written `.isdlc/config.json` (not the merged view from `config-service.js`), because the merge layer always injects defaults from `config-defaults.js`
**And** the new `hasUserEmbeddingsConfig(projectRoot)` function in `config-service.js` provides this check

### FR-007 Refresh on finalize (F0009)
**Given** embeddings are configured (`hasUserEmbeddingsConfig() === true`)
**And** `embeddings.refresh_on_finalize !== false` (default `true`)
**When** F0009 runs during build finalize
**Then** the framework spawns `isdlc-embedding generate . --incremental` as a child process
**And** forwards stdout/stderr to parent (with `[F0009]` prefix) so progress is visible
**And** POSTs `/reload` to the running server on success (auto-starts the server if it's down)
**And** the step metadata is `type: internal` (not `shell`), reflecting that a JS function is invoked

### FR-008 First-time bootstrap safety
**Given** F0009 runs, embeddings are configured, but no `.emb` package exists in `docs/.embeddings/`
**When** F0009 would normally spawn `generate --incremental`
**Then** it instead skips with a one-line banner: `F0009 Code embeddings: skipped — run 'isdlc-embedding generate .' manually to bootstrap (one-time ~30-60 min)`
**And** the step returns `{status: 'bootstrap_needed', reason: '...'}` without running a multi-hour job
**And** the user sees exactly one skip notice per build until they manually bootstrap

### FR-009 Configurability preserved
**Given** the user has set any of `embeddings.parallelism`, `device`, `dtype`, `session_options`, `max_memory_gb`, or `batch_size`
**When** the pipeline runs
**Then** all user-set values are respected
**And** auto-resolution (`"auto"` or omitted fields) only applies to unset fields
**And** the calibration system respects `max_memory_gb` when computing pool size — measured `perWorkerMemGB` is used for the sizing math, but the total memory ceiling remains the user's `max_memory_gb` value

### FR-010 Install-time opt-in prompt
**Given** a user runs the install script (`isdlc init`, `install.sh`, or PowerShell equivalent)
**When** the setup reaches the configuration generation step
**Then** the installer displays:
```
Code Embeddings (Optional)
Enables semantic code search, sprawl detection, duplication analysis.
First generation: ~30-60 min on medium codebases. Refresh: seconds-minutes.

Enable code embeddings for semantic search? [y/N]:
```
**And** the default is **N** (Enter key → no embeddings)
**If** user answers `y`/`yes`: the generated `.isdlc/config.json` includes the `embeddings` block with sensible defaults
**If** user answers `n`/empty: the generated `.isdlc/config.json` omits the `embeddings` key entirely
**And** the installer prints one of:
- Enabled: `→ Embeddings enabled. Run 'isdlc-embedding generate .' to bootstrap.`
- Disabled: `→ Embeddings disabled. Run 'isdlc-embedding configure' at any time to enable.`

## Non-Functional Requirements

### NFR-001 Memory respect (critical)
Peak RSS of main process + all worker threads combined **MUST NOT** exceed `max_memory_gb`. Verified via RSS sampling during benchmark runs in Phase 16. Trade-off: under-utilization is acceptable, over-utilization is not.

### NFR-002 Throughput improvement
On a 24GB Apple Silicon Mac with `max_memory_gb: 20` and fp16 CoreML, observed end-to-end throughput on real code chunks MUST be at least **3× the parallelism-1 baseline** after calibration (current ~2 chunks/sec → ≥6 chunks/sec). Sub-linear scaling at high N is acceptable (CoreML EP serializes some ops internally).

### NFR-003 Calibration overhead
One-time calibration MUST complete in ≤2 minutes wall-clock. Cached result has zero overhead for subsequent runs. If calibration exceeds 2 minutes, it falls back to hardcoded `WORKER_MEMORY_ESTIMATE_GB` constants without blocking the pipeline.

### NFR-004 F0009 finalize latency
Steady-state incremental refresh (zero or few changed files) MUST complete in ≤30 seconds end-to-end. Typical deltas (5-20 changed files) MUST complete in ≤3 minutes.

### NFR-005 Progress update frequency
`onProgress` fires at least once per batch (~32 chunks). `chunks_per_sec` and `eta_seconds` stabilize within the first 30 seconds of a run (early volatility is acceptable).

### NFR-006 Fail-open behavior
- F0009 failures MUST NOT block build finalize (config enforces `critical: false, fail_open: true`)
- Memory calibration failures fall back to hardcoded constants with a one-line warning
- Server unreachability after generation logs a warning but does not fail the generate run
- Installer prompt failures (EOF, broken stdin) default to NO (safe opt-out)

### NFR-007 Test coverage
- Existing tests in `lib/embedding/engine/` (worker-pool, jina-code-adapter, embedding-worker, device-detector, index) MUST pass without regression
- New tests cover: memory calibrator happy path + timeout fallback + fingerprint invalidation; refresh-code-embeddings skipped/bootstrap/success/failed paths; hasUserEmbeddingsConfig raw vs merged; installer prompt y/N handling; concurrent dispatch ordering; progress callback throughput+ETA format
- Target: 100% of the modified files pass lint + tests

## Error Taxonomy

| Code | Condition | Severity | Recovery |
|---|---|---|---|
| ERR-CALIB-001 | Calibration worker spawn fails | warning | Fall back to hardcoded constants, log warning |
| ERR-CALIB-002 | Calibration exceeds 2-minute timeout | warning | Kill worker, fall back to constants |
| ERR-CALIB-003 | RSS sampling returns implausible value (< baseline or > 50GB) | warning | Discard, fall back to constants |
| ERR-POOL-CONC-001 | Worker crash during concurrent dispatch | error (recoverable) | Existing respawn logic retries the failed batch |
| ERR-F0009-001 | `hasUserEmbeddingsConfig()` throws (invalid JSON) | info | Treat as opted out, skip F0009 silently |
| ERR-F0009-002 | Child process `isdlc-embedding generate` exits non-zero | warning | Log stderr, F0009 marked failed (fail-open), finalize continues |
| ERR-F0009-003 | `/reload` POST fails after generation | warning | Log and continue; .emb is written, user can restart server manually |
| ERR-INSTALL-001 | Installer prompt receives EOF / broken stdin | info | Default to NO (omit embeddings block) |

## Assumptions and Inferences

- **A1**: Jina v2 CoreML fp16 per-worker steady-state RSS ≈ 2GB (measured in GH-238 dogfooding at 1.9GB). Calibration is expected to expose this and enable significantly higher parallelism than the current 6GB hardcoded constant allows.
- **A2**: ONNX Runtime CoreML EP may serialize some GPU/ANE operations internally; throughput scaling beyond 2-4 workers will likely be sub-linear. NFR-002 targets reflect this (3× baseline, not 6×).
- **A3**: The worker pool's existing round-robin dispatch in `createWorkerPool.embed()` is already concurrent (tight loop of `sendBatch()` without `await`). The bug is that it only receives 1 batch at a time, not that the pool lacks concurrency.
- **A4**: `isdlc-embedding generate --incremental` from GH-227/GH-229 already handles hash-diff correctly; F0009 just needs to invoke it properly.
- **A5**: Bootstrap deferral (FR-008) matches user intent — no surprise long-running jobs at build finalize.
- **A6**: Calibration runs once per `(device, dtype, model)` tuple per project; subsequent runs have zero calibration overhead.
- **A7**: Installer default `N` is correct — embeddings are an expensive opt-in feature; users who want them explicitly type `y`.
- **A8**: Legacy installs with an existing embeddings block stay enabled (no retroactive migration). Opt-in is presence-based and only new installs get the prompt.
- **A9**: `hasUserEmbeddingsConfig()` bypasses `config-service.js` merging because defaults always inject an `embeddings` section; raw-file check is essential for opt-out correctness.
- **A10**: Moving average over 10 batches is sufficient to stabilize `chunks_per_sec` and `eta_seconds` without requiring complex statistics.

## Out of Scope

- Apple Neural Engine investigation (#240)
- Runtime adaptive scaling (start N, measure, add more) — rejected in favor of one-time calibration
- File watcher / PostToolUse auto-refresh (#247)
- Staleness detection beyond what F0009 already covers (#242)
- CLI `status` command (#243)
- Claude Code status line integration (#244)
- Server crash recovery and launchd/systemd integration (#245, #246)
- Fixing the CLI auto-start false-success bug (#241) — independent bug, separate fix
- Retroactive migration of existing installs (manual re-configuration)
- GUI/TUI installer (staying with simple stdin prompts)

## Prioritization

**Must-Have (P0)**:
- FR-001 Concurrent batch dispatch
- FR-002 Unified adapter interface
- FR-003 Memory calibration
- FR-004 Calibration cache invalidation
- FR-005 Throughput + ETA progress
- FR-006 Opt-in via config presence
- FR-007 Refresh on finalize (F0009)
- FR-008 First-time bootstrap safety
- FR-009 Configurability preserved
- FR-010 Install-time opt-in prompt
- NFR-001 Memory respect
- NFR-002 Throughput ≥3× baseline
- NFR-006 Fail-open behavior
- NFR-007 Test coverage

**Should-Have (P1)**:
- NFR-003 Calibration overhead ≤2 min
- NFR-004 F0009 finalize latency

**Nice-to-Have (P2)**:
- NFR-005 Progress update frequency floor
