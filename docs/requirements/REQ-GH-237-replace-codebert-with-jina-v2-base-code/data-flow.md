# Data Flow: REQ-GH-237

## Embedding Generation Flow

```
Source files
  → chunker (tree-sitter or fallback)
    → text chunks[]
      → engine/index.js embed()
        → resolveAdapter({ provider: 'jina-code' })
          → jina-code-adapter.js createJinaCodeAdapter()
            → @huggingface/transformers pipeline('feature-extraction', 'jinaai/jina-embeddings-v2-base-code')
              → Float32Array[768] per text (L2-normalized)
        → EmbeddingResult { vectors, dimensions: 768, model: 'jina-code', totalTokens }
      → package/builder.js
        → .emb file (with model_id: 'jina-code-v2-base' in metadata)
          → HNSW index
```

## Search Query Flow (unchanged)

```
MCP search query
  → mcp-server/server.js
    → store-manager.js loads .emb packages
      → reader.js checks model_id (warns if mismatch)
    → HNSW index nearest neighbor search
      → ranked results (< 500ms)
```

## Model Download Flow (new)

```
First pipeline() call (or discover pre-warm)
  → @huggingface/transformers checks ~/.cache/huggingface/
    → Cache miss: downloads jinaai/jina-embeddings-v2-base-code (~162MB q8)
    → Cache hit: loads from disk
  → ONNX session initialized
  → Ready for inference
```

## State Mutations

| Component | State | Readers |
|-----------|-------|---------|
| `jina-code-adapter.js` → `extractor` | Lazy singleton pipeline instance | `embed()`, `healthCheck()` |
| `~/.cache/huggingface/` | Model files (managed by Transformers.js) | All adapter instances |
| `.emb` metadata → `model_id` | Written by builder, read by reader | `reader.js` on load |

## Persistence Boundaries

- **Transient**: Pipeline instance (in-memory, released on `dispose()`)
- **Persistent**: Model cache (`~/.cache/huggingface/`), .emb packages (project-local)
- **Session**: No session state — adapter is stateless for inference
