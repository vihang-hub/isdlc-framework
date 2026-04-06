# Architecture Overview: REQ-GH-237

Replace CodeBERT with Jina v2 Base Code

## 1. Architecture Options

| Option | Summary | Pros | Cons | Pattern Alignment | Verdict |
|--------|---------|------|------|-------------------|---------|
| A: Drop-in adapter swap | New jina-code-adapter.js follows identical interface, slots into resolveAdapter() switch | Minimal blast radius, clean boundary, zero downstream changes | None significant | Follows existing adapter pattern exactly | **Selected** |
| B: Abstract adapter factory | Generic `createTransformersAdapter(modelId, dims)` for any Transformers.js model | Future-proof for model swaps | Premature abstraction (Article V), only one local model today | Over-engineers existing pattern | Eliminated |

## 2. Selected Architecture

### ADR-001: Replace CodeBERT with Jina v2 via Transformers.js

- **Status**: Accepted
- **Context**: CodeBERT adapter has two fatal blockers (phantom tokenizer dep, missing ONNX on HuggingFace). The embedding pipeline is completely non-functional for fresh installs.
- **Decision**: Replace with `jinaai/jina-embeddings-v2-base-code` via `@huggingface/transformers` v4. Delete CodeBERT adapter and model-downloader entirely — no backward compatibility (confirmed by user: no external consumers).
- **Rationale**: Same 768 dimensions (zero schema changes to HNSW, aggregation, .emb format). Code-trained on 30 languages vs CodeBERT's 6. 8192-token context (16x CodeBERT). Tokenizer bundled with model. Prebuilt WASM/ONNX for ARM. Apache-2.0, actively maintained. Option B rejected per Article V (YAGNI — one local model).
- **Consequences**: `onnxruntime-node` removed from direct deps (Transformers.js bundles it internally). Model download handled by Transformers.js cache system (`~/.cache/huggingface/`). First-use latency mitigated by discover pre-warm step.

### ADR-002: No Backward Compatibility for CodeBERT

- **Status**: Accepted
- **Context**: The issue proposed keeping a deprecated CodeBERT compat path. User confirmed no external consumers exist.
- **Decision**: Delete CodeBERT adapter and model-downloader entirely. No deprecation cycle, no migration command.
- **Rationale**: Simplifies scope from ~20 files to ~14 files. Eliminates maintenance burden of dead code path. Old .emb files get a warning to regenerate (FR-006) but no compat loading.
- **Consequences**: Any existing `.emb` files must be regenerated. Old `.isdlc/models/codebert-base/` directories become orphaned (user can delete manually).

## 3. Technology Decisions

| Technology | Version | Rationale | Alternatives Considered |
|-----------|---------|-----------|------------------------|
| `@huggingface/transformers` | ^4 | Wraps ONNX runtime + model download + tokenizer. Prebuilt for Node.js server-side (March 2025 release). | Manual ONNX + custom tokenizer (current broken approach) |
| `jinaai/jina-embeddings-v2-base-code` | v2 | 768-dim code-trained, 8192 context, 162MB q8, Apache-2.0 | `Xenova/all-MiniLM-L6-v2` (384-dim — schema changes), `nomic-ai/nomic-embed-text-v1.5` (768-dim but not code-trained) |

- **Net dependency change**: remove 1 direct dep (`onnxruntime-node`), add 1 (`@huggingface/transformers`). Prod dep count stays at 6.
- **Zero new native deps**: Transformers.js bundles onnxruntime-node internally — same native dep, just wrapped.

## 4. Integration Architecture

### Integration Points

| ID | Source | Target | Interface | Data Format | Error Handling |
|----|--------|--------|-----------|-------------|----------------|
| I1 | `engine/index.js` | `jina-code-adapter.js` | `createJinaCodeAdapter(config)` | Adapter object or `null` | null → throw descriptive error |
| I2 | `jina-code-adapter.js` | `@huggingface/transformers` | `pipeline('feature-extraction', modelId)` | Float32Array per text | try/catch → return null |
| I3 | `setup-project-knowledge.js` | `jina-code-adapter.js` | Import + `pipeline()` call | Void (triggers download) | try/catch → log warning, continue |
| I4 | `package/reader.js` | `.emb` metadata | `model_id` field check | JSON metadata | Missing → warn, proceed |

### Data Flow

```
texts[] → jina-code-adapter.embed() → Float32Array[768][] → package builder → .emb file → HNSW index → search queries
```

Unchanged from CodeBERT flow — only the adapter implementation changes. All downstream consumers receive the same `Float32Array[]` of dimension 768.

### Synchronization

No concurrency concerns. The adapter uses a lazy singleton pattern (`ensureExtractor()`) — first call initializes, subsequent calls reuse. The Transformers.js pipeline is stateless for inference.

## 5. Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture approach | Drop-in adapter swap | Follows existing pattern, minimal blast radius |
| Backward compat | None | No external consumers confirmed |
| Model | Jina v2 Base Code | Same dims, code-trained, bundled tokenizer |
| Runtime | Transformers.js v4 | Wraps ONNX + download + tokenizer |
| Pre-warm | During /discover | Mitigates first-use model download latency |

**Trade-offs**: We trade the theoretical future flexibility of an abstract factory (Option B) for simplicity today (Option A). If a second local model is ever needed, the adapter pattern makes it trivial to add.
