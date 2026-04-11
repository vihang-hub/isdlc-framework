# Worker pool parallelism: engine's sequential batch loop defeats multi-worker speedup

**Source**: GitHub Issue #239
**Type**: Enhancement / Performance
**Labels**: enhancement, performance, embeddings

## Problem

Setting `embeddings.parallelism > 1` in `.isdlc/config.json` does not speed up end-to-end embedding generation via `bin/isdlc-embedding.js generate`. Benchmarks on real code chunks (24GB Mac, Jina v2 fp16 CoreML):

- `parallelism: 1` (in-process): ~2-5/s steady state
- `parallelism: 2` (worker pool, 2 CoreML workers): ~2.1/s — **no improvement**

## Root cause

`lib/embedding/engine/index.js` iterates batches sequentially:

```js
for (let i = 0; i < texts.length; i += batchSize) {
  const batch = texts.slice(i, i + batchSize);
  const vectors = await adapter.embed(batch);   // awaits before next iteration
  allVectors.push(...vectors);
}
```

Each call sends 32 texts to `pool.embed(32-texts, batchSize=32)`, which splits into 1 internal batch and routes it to one worker via round-robin. The engine then awaits before starting the next batch. With 2 workers, only 1 is ever active at a time.

## Proposed fix

Push the outer loop down into the worker pool. Option A (preferred): engine sends all texts at once, pool splits into N batches and runs them concurrently across workers:

```js
const vectors = await adapter.embed(texts, { batchSize, onProgress });
```

The pool already has batch-splitting and round-robin logic. The engine just needs to call it once with the full text array instead of slicing first.

## Acceptance

- Benchmark on >=1000 real chunks with `parallelism: 2`, `parallelism: 4` shows near-linear speedup vs `parallelism: 1`
- Progress callback still fires per-batch with correct counts
- Existing tests pass (worker-pool.test.js, jina-code-adapter.test.js, engine/index.test.js)
- No memory regression under the `max_memory_gb` cap

## Related

- REQ-GH-238 (original build) — left as out-of-scope follow-up
- `docs/isdlc/config-reference.md` currently documents `parallelism: 1` as the operational setting
