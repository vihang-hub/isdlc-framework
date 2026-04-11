# Module Design: REQ-GH-239

## Module 1: memory-calibrator (NEW)

**Path**: `lib/embedding/engine/memory-calibrator.js`

### Public API

```js
/**
 * Measure per-worker memory usage for a given config.
 * Spawns a one-shot worker, loads the model, processes a sample batch,
 * samples RSS, and returns the calibrated per-worker cost in GB.
 *
 * @param {Object} config - Resolved embeddings config
 * @param {string} config.device - ONNX execution provider
 * @param {string} config.dtype - Model precision
 * @param {string} config.model - HuggingFace model ID
 * @param {Object} config.session_options - ONNX session options
 * @param {Object} [options]
 * @param {string} [options.projectRoot] - For cache file location
 * @param {number} [options.timeoutMs=120000] - Hard ceiling, default 2 min
 * @param {number} [options.sampleCount=20] - Number of synthetic texts
 * @param {number} [options.sampleCharLength=2000] - Chars per sample text
 * @param {number} [options.samplingIntervalMs=500] - RSS sampling interval
 * @param {number} [options.safetyMargin=0.2] - Multiplier on measured peak (default +20%)
 * @returns {Promise<CalibrationResult|null>} null on timeout or error
 */
export async function calibratePerWorkerMemory(config, options = {}) { ... }

/**
 * Read cached calibration if fingerprint matches.
 * @returns {CalibrationResult|null}
 */
export function readCachedCalibration(projectRoot, fingerprint) { ... }

/**
 * Write calibration result to .isdlc/embedding-calibration.json
 */
export function writeCachedCalibration(projectRoot, result) { ... }

/**
 * Compute a fingerprint hash over (device, dtype, model).
 * SHA-256 first 16 hex chars.
 * @returns {string}
 */
export function computeFingerprint(config) { ... }
```

### Types

```js
/**
 * @typedef {Object} CalibrationResult
 * @property {number} perWorkerMemGB    - Final value (peak - baseline) × (1 + safetyMargin)
 * @property {number} baselineMemGB     - RSS before worker load
 * @property {number} peakMemGB         - Max RSS during sample inference
 * @property {number} sampleCount       - Number of texts processed
 * @property {number} durationMs        - Total calibration wall-clock
 * @property {string} measuredAt        - ISO-8601 timestamp
 * @property {string} fingerprint       - Hash of {device, dtype, model}
 * @property {string} device            - Resolved device
 * @property {string} dtype             - Resolved dtype
 * @property {string} model             - Model ID
 */
```

### Cache File Schema (`.isdlc/embedding-calibration.json`)

```json
{
  "perWorkerMemGB": 2.4,
  "baselineMemGB": 0.3,
  "peakMemGB": 2.0,
  "sampleCount": 20,
  "durationMs": 47320,
  "measuredAt": "2026-04-11T05:30:00.000Z",
  "fingerprint": "a3f8c9d1e2b45678",
  "device": "coreml",
  "dtype": "fp16",
  "model": "jinaai/jina-embeddings-v2-base-code"
}
```

### Internal Logic

1. **Early cache check**: read cache file; if fingerprint matches, return cached result immediately (zero-cost fast path).
2. **Record baseline**: `baselineMemGB = process.memoryUsage().rss / (1024 ** 3)`.
3. **Generate samples**: 20 synthetic strings of 2000 chars each, pseudo-randomly filled with code-like tokens (function/class/import keywords, identifiers, punctuation). Deterministic seed for reproducibility.
4. **Spawn worker**: use `createWorkerPool(workerPath, { poolSize: 1, workerData: {...config} })` — reuses existing pool infrastructure without duplicating worker spawning logic.
5. **Start sampling**: `setInterval(() => samples.push(process.memoryUsage().rss), samplingIntervalMs)`. Continue until inference completes or timeout.
6. **Run inference**: `await pool.embed(sampleTexts, 32, {})` — the pool dispatches the 20 texts as one batch; the worker loads the model (first inference) and processes the batch.
7. **Stop sampling**: clear interval, compute `peakMemGB = Math.max(...samples) / GB`.
8. **Compute cost**: `perWorkerMemGB = (peakMemGB - baselineMemGB) * (1 + safetyMargin)`.
9. **Timeout handling**: if total elapsed > `timeoutMs`, kill pool, log warning, return `null`.
10. **Write cache**: build `CalibrationResult`, stringify to JSON, write to `.isdlc/embedding-calibration.json`.
11. **Shutdown**: `await pool.shutdown()` before returning.

### Error Handling

| Error | Recovery |
|---|---|
| `createWorkerPool` throws | Return null (caller falls back to constants) |
| Worker load timeout | Kill pool, return null |
| `pool.embed` throws | Kill pool, log, return null |
| RSS sampling returns implausible value (< 0.05 GB or > 50 GB) | Discard, return null |
| Cache file write fails | Return result anyway (in-memory use); log warning |

---

## Module 2: refresh-code-embeddings (NEW)

**Path**: `src/core/finalize/refresh-code-embeddings.js`

### Public API

```js
/**
 * F0009 handler: refresh code embeddings as part of build finalize.
 * Checks opt-in, handles bootstrap gracefully, spawns incremental generation.
 *
 * @param {string} projectRoot
 * @param {Object} [options]
 * @returns {Promise<RefreshResult>} Never throws.
 */
export async function refreshCodeEmbeddings(projectRoot, options = {}) { ... }
```

### Types

```js
/**
 * @typedef {Object} RefreshResult
 * @property {'skipped'|'bootstrap_needed'|'success'|'failed'} status
 * @property {string} [reason]            - Human-readable reason
 * @property {number} [durationMs]        - Total wall-clock
 * @property {number} [chunksProcessed]   - Parsed from child output on success
 * @property {boolean} [serverReloaded]   - True if POST /reload succeeded
 * @property {string} [stderr]            - Last N lines of stderr on failure
 */
```

### Internal Logic

1. **Opt-in check**: `if (!hasUserEmbeddingsConfig(projectRoot)) return { status: 'skipped', reason: 'embeddings not configured' }`.
2. **Bootstrap check**: read `docs/.embeddings/*.emb` files; if none, return `{ status: 'bootstrap_needed', reason: 'no prior package — run isdlc-embedding generate manually to bootstrap' }`.
3. **Spawn child**:
   ```js
   const child = child_process.spawn('node', [
     path.join(projectRoot, 'bin', 'isdlc-embedding.js'),
     'generate', '.', '--incremental'
   ], {
     cwd: projectRoot,
     stdio: ['ignore', 'pipe', 'pipe']
   });
   ```
4. **Forward output**: pipe child stdout/stderr to parent stdout/stderr with `[F0009] ` line prefix.
5. **Parse chunks count**: regex-match child stdout for `Generated (\d+) embeddings` or `Refreshed (\d+) chunks`.
6. **Wait for exit**:
   ```js
   const exitCode = await new Promise(resolve => child.once('exit', resolve));
   ```
7. **Return result**:
   - `exitCode === 0` → `{ status: 'success', durationMs, chunksProcessed, serverReloaded: true }`
   - `exitCode !== 0` → `{ status: 'failed', reason: 'generate exited with code ' + code, stderr: tail }`
8. **Never throw**: wrap all operations in try/catch that returns `{ status: 'failed', reason: err.message }`.

---

## Module 3: jina-code-adapter (MODIFIED)

**Path**: `lib/embedding/engine/jina-code-adapter.js`

### Interface Change

**Before** (both adapters):
```js
async embed(texts) {
  // in-process: loop text-by-text, return all vectors
  // pooled: pool.embed(texts, batchSize, {})
}
```

**After** (unified):
```js
async embed(texts, options = {}) {
  const { batchSize = 32, onProgress, signal } = options;
  // ...
}
```

### In-process Adapter (parallelism=1)

```js
async embed(texts, options = {}) {
  const { batchSize = 32, onProgress, signal } = options;
  const ext = await ensureExtractor();
  const results = [];
  const startTime = Date.now();

  for (let i = 0; i < texts.length; i++) {
    if (signal?.aborted) throw new Error('Embedding cancelled');
    const output = await ext(texts[i], { pooling: 'mean', normalize: true });
    const vec = new Float32Array(output.tolist()[0]);
    normalize(vec);
    results.push(vec);
    try { output.dispose?.(); } catch {}  // tensor disposal fix from GH-238

    // Fire progress at batch boundaries
    if (onProgress && (i + 1) % batchSize === 0) {
      const processed = i + 1;
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = processed / elapsed;
      onProgress({
        processed,
        total: texts.length,
        chunks_per_sec: Math.round(rate * 10) / 10,
        eta_seconds: Math.round((texts.length - processed) / rate),
        active_workers: 1
      });
    }
  }

  // Final progress
  if (onProgress && texts.length > 0) {
    const elapsed = (Date.now() - startTime) / 1000;
    onProgress({
      processed: texts.length,
      total: texts.length,
      chunks_per_sec: Math.round((texts.length / elapsed) * 10) / 10,
      eta_seconds: 0,
      active_workers: 1
    });
  }

  return results;
}
```

### Pooled Adapter (parallelism>1)

```js
async embed(texts, options = {}) {
  const { batchSize = 32, onProgress, signal } = options;
  return pool.embed(texts, batchSize, { onProgress, signal });
}
```

---

## Module 4: worker-pool (MODIFIED)

**Path**: `lib/embedding/engine/worker-pool.js`

### Interface Change

**Before**:
```js
async embed(texts, batchSize = 32, pipelineOpts = {}) { ... }
```

**After**:
```js
async embed(texts, batchSize = 32, options = {}) {
  const { onProgress, signal, pipelineOpts = {} } = options;
  // ...
}
```

### Progress Aggregation

```js
// State
let completedChunks = 0;
const rateWindow = [];  // FIFO of last 10 batch events

// Called when a batch result arrives from any worker
function onBatchComplete(batchSize) {
  completedChunks += batchSize;
  const now = Date.now();
  rateWindow.push({ at: now, count: batchSize });
  if (rateWindow.length > 10) rateWindow.shift();

  // Compute rate from window span
  const windowCount = rateWindow.reduce((s, w) => s + w.count, 0);
  const windowSecs = (now - rateWindow[0].at) / 1000;
  const rate = windowSecs > 0 ? windowCount / windowSecs : 0;
  const remaining = texts.length - completedChunks;

  if (onProgress) {
    onProgress({
      processed: completedChunks,
      total: texts.length,
      chunks_per_sec: Math.round(rate * 10) / 10,
      eta_seconds: rate > 0 ? Math.round(remaining / rate) : 0,
      active_workers: workers.filter(w => w.busy).length
    });
  }
}
```

### Dispatch Loop (unchanged)

The existing round-robin dispatch in `createWorkerPool.embed()` is retained. `sendBatch()` fires without `await` in the tight loop, which is what enables concurrency. The only addition is that each `sendBatch` wraps the result handler to call `onBatchComplete(batch.length)` before resolving its promise.

---

## Module 5: engine/index.js (MODIFIED)

### Before

```js
export async function embed(texts, config, options = {}) {
  const { batchSize = 32, onProgress, signal } = options;
  const adapter = await createAdapter(config);
  const allVectors = [];
  let totalTokens = 0;

  for (let i = 0; i < texts.length; i += batchSize) {
    if (signal?.aborted) throw new Error('Embedding cancelled');
    const batch = texts.slice(i, i + batchSize);
    const vectors = await adapter.embed(batch);     // ← old: sliced batch
    allVectors.push(...vectors);
    totalTokens += batch.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0);
    if (onProgress) onProgress(Math.min(i + batchSize, texts.length), texts.length);
  }

  return { vectors: allVectors, dimensions, model, totalTokens };
}
```

### After

```js
export async function embed(texts, config, options = {}) {
  const { batchSize = 32, onProgress, signal } = options;
  const adapter = await createAdapter(config);

  // Single call; adapter handles batching + concurrency internally
  const vectors = await adapter.embed(texts, { batchSize, onProgress, signal });

  // Post-compute totalTokens in one pass
  const totalTokens = texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0);

  return { vectors, dimensions, model, totalTokens };
}
```

The exported signature is unchanged. Only the internal dispatch changes.

---

## Module 6: device-detector.js (MODIFIED)

### Calibration Integration

```js
import { readCachedCalibration, computeFingerprint } from './memory-calibrator.js';

function resolvePerWorkerMemGB(config, projectRoot) {
  const fingerprint = computeFingerprint(config);
  const cached = readCachedCalibration(projectRoot, fingerprint);
  if (cached) {
    return { source: 'calibrated', value: cached.perWorkerMemGB, measuredAt: cached.measuredAt };
  }
  const hardcoded = WORKER_MEMORY_ESTIMATE_GB[config.device] || WORKER_MEMORY_ESTIMATE_GB.cpu;
  return { source: 'hardcoded', value: hardcoded };
}

// Used in computeAutoParallelism:
const perWorker = resolvePerWorkerMemGB(config, projectRoot);
const byMemory = Math.max(1, Math.floor(availableMemGB / perWorker.value));
```

Calibration is triggered lazily from the CLI (`bin/isdlc-embedding.js runGenerate`) BEFORE pool creation on cache miss — it's not inline in `device-detector.js` itself because the calibrator needs a running worker pool infrastructure, which would be circular.

---

## Module 7: config-service.js (MODIFIED)

### New Export

```js
import fs from 'node:fs';
import path from 'node:path';

/**
 * Check whether the user has explicitly configured embeddings.
 * Reads the raw .isdlc/config.json, bypassing the defaults merge layer.
 * This is essential for opt-out to work — the merge layer always injects
 * an embeddings section from config-defaults.js.
 *
 * @param {string} projectRoot
 * @returns {boolean} true if user's raw config has an embeddings key (non-null)
 */
export function hasUserEmbeddingsConfig(projectRoot) {
  try {
    const configPath = path.join(projectRoot, '.isdlc', 'config.json');
    if (!fs.existsSync(configPath)) return false;
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed.embeddings != null;  // checks both null and undefined
  } catch {
    return false;
  }
}
```

---

## Module 8: finalize-utils.js (MODIFIED)

### New F0009 Handler

```js
import { refreshCodeEmbeddings } from './refresh-code-embeddings.js';

export async function F0009_refreshCodeEmbeddings(state, context) {
  const { projectRoot } = context;
  const started = Date.now();

  const result = await refreshCodeEmbeddings(projectRoot);

  return {
    step: 'F0009',
    name: 'Refresh code embeddings',
    status: result.status === 'success' ? 'passed'
          : result.status === 'failed' ? 'failed'
          : 'skipped',
    reason: result.reason,
    duration_ms: Date.now() - started
  };
}
```

The Phase-Loop Controller reads `type: internal` from `finalize-steps.md` and calls this function directly, matching the pattern used for F0001/F0002/F0003.

---

## Module 9: bin/isdlc.js init handler (MODIFIED)

### Install Prompt

```js
async function promptEmbeddings(rl) {
  console.log('');
  console.log('Code Embeddings (Optional)');
  console.log('Enables semantic code search, sprawl detection, duplication analysis.');
  console.log('First generation: ~30-60 min on medium codebases. Refresh: seconds-minutes.');
  console.log('');
  const answer = (await rl.question('Enable code embeddings for semantic search? [y/N]: ')).trim().toLowerCase();
  return answer === 'y' || answer === 'yes';
}

// In config builder:
function buildInitialConfig({ enableEmbeddings, ...rest }) {
  const config = { /* base sections */ };
  if (enableEmbeddings) {
    config.embeddings = {
      provider: 'jina-code',
      model: 'jinaai/jina-embeddings-v2-base-code',
      server: { port: 7777, host: 'localhost', auto_start: true },
      parallelism: 'auto',
      device: 'auto',
      dtype: 'auto',
      batch_size: 32,
      session_options: {},
      max_memory_gb: null,
      refresh_on_finalize: true
    };
  }
  // When enableEmbeddings === false, config.embeddings is intentionally omitted.
  return config;
}

// Post-install hint:
if (enableEmbeddings) {
  console.log('  → Embeddings enabled. Run `isdlc-embedding generate .` to bootstrap.');
} else {
  console.log('  → Embeddings disabled. Run `isdlc-embedding configure` at any time to enable.');
}
```

---

## Module 10: bin/isdlc-embedding.js runGenerate (MODIFIED)

### Calibration Integration

```js
async function runGenerate(args) {
  const config = await resolveConfig(projectRoot);

  // NEW: calibration check before pool creation
  const fingerprint = computeFingerprint(config);
  const cached = readCachedCalibration(projectRoot, fingerprint);
  if (!cached) {
    console.log('[calibrate] no cached calibration; running one-time measurement...');
    const result = await calibratePerWorkerMemory(config, { projectRoot });
    if (result) {
      console.log(`[calibrate] measured perWorkerMemGB=${result.perWorkerMemGB.toFixed(1)} (${result.durationMs}ms)`);
    } else {
      console.log('[calibrate] failed or timed out; falling back to hardcoded constants');
    }
  }

  // Existing pool creation, now reads calibration internally via device-detector
  const pool = await createPoolFromConfig(config, projectRoot);
  // ...
}
```

### Progress Rendering

```js
function renderProgress(update) {
  const { processed, total, chunks_per_sec, eta_seconds, active_workers } = update;
  const pct = Math.round((processed / total) * 100);
  const etaMin = Math.round(eta_seconds / 60);
  const line = `[generate] ${processed}/${total} (${pct}%) | ${chunks_per_sec} chunks/s | ETA ${etaMin}min | workers: ${active_workers}`;
  if (process.stdout.isTTY) {
    process.stdout.write(`\r${line}`);
  } else {
    console.log(line);
  }
}

// Pass to engine:
await embed(texts, config, { onProgress: renderProgress });
```

---

## Module 11: install.sh (MODIFIED)

### Bash Prompt

```bash
prompt_embeddings() {
  echo ""
  echo "Code Embeddings (Optional)"
  echo "Enables semantic code search, sprawl detection, duplication analysis."
  echo "First generation: ~30-60 min on medium codebases. Refresh: seconds-minutes."
  echo ""
  read -p "Enable code embeddings for semantic search? [y/N]: " answer
  case "${answer:-n}" in
    y|Y|yes|YES) echo "true" ;;
    *) echo "false" ;;
  esac
}

# In config generation:
if [ "$(prompt_embeddings)" = "true" ]; then
  # Include embeddings section in written config
  EMBEDDINGS_SECTION='"embeddings": { "provider": "jina-code", ... }'
  echo "  → Embeddings enabled. Run 'isdlc-embedding generate .' to bootstrap."
else
  EMBEDDINGS_SECTION=""
  echo "  → Embeddings disabled. Run 'isdlc-embedding configure' at any time to enable."
fi
```

---

## Wiring Summary

All module changes compose into three end-to-end flows:

### Flow 1: Install

```
install.sh | isdlc init
  → promptEmbeddings() → boolean
  → buildInitialConfig({ enableEmbeddings })
  → write .isdlc/config.json (with or without embeddings section)
  → print hint
```

### Flow 2: First embedding generation

```
isdlc-embedding generate .
  → resolveConfig()
  → readCachedCalibration(fingerprint)
      ├─ hit  → use cached perWorkerMemGB
      └─ miss → calibratePerWorkerMemory() → writeCachedCalibration()
  → device-detector resolvePerWorkerMemGB() → computePoolSize()
  → createWorkerPool(poolSize, perWorkerMemGB)
  → engine.embed(texts, config, { onProgress })
      → adapter.embed(texts, { batchSize, onProgress })
          → pool.embed(texts, batchSize, { onProgress })
              → fan out N batches concurrently across workers
              → fire onProgress({processed, total, chunks_per_sec, eta_seconds, active_workers})
  → buildPackage() → write .emb
  → POST /reload (or startServer)
```

### Flow 3: Build finalize

```
Phase-Loop Controller finalize checklist
  → F0001..F0008
  → F0009 F0009_refreshCodeEmbeddings(state, {projectRoot})
      → refreshCodeEmbeddings(projectRoot)
          ├─ !hasUserEmbeddingsConfig() → {status: skipped}
          ├─ no *.emb on disk → {status: bootstrap_needed}
          └─ spawn child: isdlc-embedding generate . --incremental
              → child runs Flow 2 internally
              → parent forwards stdout/stderr with [F0009] prefix
              → {status: success, chunksProcessed, durationMs}
      → step result recorded, finalize continues (fail-open)
```

## Assumptions and Inferences

- **A-DESIGN-1** — The calibration worker reuses `createWorkerPool(workerPath, { poolSize: 1 })` instead of spawning a raw `new Worker()`. This keeps worker lifecycle logic in one place and gets crash recovery for free.
- **A-DESIGN-2** — `computeFingerprint(config)` uses SHA-256 first 16 hex chars of `${device}|${dtype}|${model}`. Short enough to be readable, long enough to avoid collisions in practice.
- **A-DESIGN-3** — The 20% safety margin on calibrated RSS (`× 1.2`) is empirical — it accounts for measurement noise, GC timing, and any runtime drift. Can be tuned if real-world runs show it's insufficient.
- **A-DESIGN-4** — The rate window of 10 batches stabilizes `chunks_per_sec` and `eta_seconds` without being over-reactive. Early runs (first 10 batches) will show higher variance, which is acceptable since absolute numbers are small.
- **A-DESIGN-5** — In-process adapter fires progress at `%batchSize === 0` boundaries to match the pooled adapter's cadence. Synthesizes throughput from elapsed time.
- **A-DESIGN-6** — Spawning the existing `isdlc-embedding generate --incremental` CLI as a child process (in F0009) instead of reimplementing the flow inline provides isolation (failures don't crash the finalizer) and code reuse (one generation codepath).
- **A-DESIGN-7** — `hasUserEmbeddingsConfig()` reads the raw JSON file rather than going through `config-service.js`'s merge layer. The merge always injects defaults from `config-defaults.js`, making opt-out invisible through the merged view.
- **A-DESIGN-8** — Calibration cache file `.isdlc/embedding-calibration.json` is separate from `config.json` to keep user config clean. Both are gitignored via the `.isdlc/` exclusion.
- **A-DESIGN-9** — The installer default is NO (Enter key) because embeddings are an expensive opt-in. Users who want them explicitly type `y`.
- **A-DESIGN-10** — F0009 metadata changes from `type: shell` to `type: internal`. Both `.isdlc/config/finalize-steps.md` (the live config) and `src/core/finalize/finalize-steps.default.md` (the shipped default) need the update.
