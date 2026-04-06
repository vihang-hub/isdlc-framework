# Error Taxonomy: REQ-GH-237

| Code | Description | Trigger | Severity | Recovery |
|------|-------------|---------|----------|----------|
| ERR-JINA-001 | Transformers.js not installed | `import('@huggingface/transformers')` fails | Warning | `createJinaCodeAdapter()` returns `null`; `resolveAdapter()` throws descriptive install instructions |
| ERR-JINA-002 | Model download failed | Network error during first `pipeline()` call | Error | Retry on next call; pre-warm logs warning and continues |
| ERR-JINA-003 | ONNX inference failed | Corrupted model cache or runtime error | Error | Throw with message; caller retries or falls back |
| ERR-JINA-004 | Removed provider requested | `config.provider === 'codebert'` | Error | Throw `Error('codebert provider has been removed. Use jina-code instead.')` |
| ERR-JINA-005 | Stale embeddings detected | `.emb` metadata missing `model_id` or mismatched | Info | Log warning with regeneration instructions; continue loading |

## Graceful Degradation

| Failure | What Still Works |
|---------|-----------------|
| Jina adapter returns null (deps missing) | Cloud providers (Voyage, OpenAI) still available |
| Model download fails during discover | Discover completes; model downloads on first real use |
| .emb files are stale | Search still works with old vectors; results may be less accurate |
