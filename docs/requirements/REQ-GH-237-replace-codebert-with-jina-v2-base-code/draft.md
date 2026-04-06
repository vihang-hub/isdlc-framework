# Replace CodeBERT with Jina v2 Base Code — unblock embedding pipeline

**Source**: GitHub Issue #237
**Type**: Enhancement
**Labels**: enhancement

## Problem

The embedding pipeline (delivered in GH-224 and related issues) cannot generate fresh embeddings on any project today. Two independent blockers were discovered while attempting to activate the pipeline in the dogfooding repo:

### Blocker 1: `tokenizers` npm dependency is phantom

- `package.json` declares `tokenizers@^0.20.3` (aliased to `npm:null@*` in optionalDependencies)
- **Version 0.20.3 does not exist on npm.** The real `tokenizers` npm package (HuggingFace's Rust bindings for Node.js) peaked at `v0.13.3` in 2023 and has been abandoned since
- HuggingFace stopped shipping Node bindings from the Rust `tokenizers` repo ~2023
- The `0.20.x` version number came from the **Python** `tokenizers` package, not npm — someone mis-mapped versions when writing the adapter

### Blocker 2: CodeBERT has no canonical ONNX on HuggingFace

- The adapter expects to download from `https://huggingface.co/microsoft/codebert-base/resolve/main/onnx/model.onnx` — this URL returns 404
- Microsoft never uploaded an ONNX export of `codebert-base` to its HuggingFace repo
- There is no `Xenova/codebert-base` either (open feature request: transformers.js issue #1366)
- The ONNX file currently in `.isdlc/models/codebert-base/model.onnx` came from an unknown source (hand-converted, mirror, or silently failing download)
- Keeping CodeBERT would require shipping our own ONNX conversion pipeline (Python + Optimum), which violates the 'no exotic build steps' requirement

## Expected Behavior

Replace CodeBERT with **jinaai/jina-embeddings-v2-base-code** via `@huggingface/transformers` v4 (Transformers.js). This is the cleanest drop-in replacement:

- **Same 768 dimensions** as CodeBERT -> zero schema changes to HNSW index, aggregation layer, or stored `.emb` package format
- **Code-trained** on 30 programming languages (vs CodeBERT's 6)
- **8192-token context** (16x CodeBERT's 512)
- **162 MB quantized (q8) / 321 MB fp16** — under the 500 MB budget
- **Apache-2.0**, actively maintained by Jina AI
- **Tokenizer bundled with the model** — no separate `tokenizers` package needed
- **`@huggingface/transformers` v4 ships prebuilt WASM/ONNX runtime for Darwin ARM** — no native build steps
- Transformers.js wraps `onnxruntime-node` internally -> can drop that direct dep too

## Scope

### Dependencies
- Add `@huggingface/transformers@^4` as a regular dependency
- Remove `tokenizers` alias from `optionalDependencies` (no longer needed — tokenizer is bundled with Jina model)
- Remove `onnxruntime-node` from direct dependencies (Transformers.js bundles it)

### New adapter
- `lib/embedding/engine/jina-code-adapter.js` (NEW, ~40 lines)
- Uses `@huggingface/transformers`'s `pipeline('feature-extraction', 'jinaai/jina-embeddings-v2-base-code')` API
- Returns 768-dim Float32Array embeddings (same shape as CodeBERT)
- Built-in cache management via transformers.js `cache_dir` option

### Update existing adapters
- `lib/embedding/engine/index.js` — add `jina-code` provider case alongside `codebert`, `voyage-code-3`, `openai`
- `lib/embedding/engine/index.js` — make `jina-code` the **default provider** (replacing `codebert`)
- `lib/embedding/engine/codebert-adapter.js` — mark deprecated; keep compat path for users who already have CodeBERT ONNX (fail-open if ONNX/tokenizer missing, per BUG-0056)

### Model downloader
- `lib/embedding/installer/model-downloader.js` — replace or remove; Transformers.js handles model download + caching on first invocation
- Alternative: keep as a pre-warm step that calls `pipeline()` during `/discover` or post-install so first real usage is fast

### Migration for existing `.emb` packages
- Existing CodeBERT-generated `.emb` files become value-incompatible (different model -> different vectors) but size-compatible (same 768 dims)
- Add a `model_id` field to `.emb` package metadata to detect migration need
- On load, if `model_id !== 'jina-code-v2-base'`, warn user and suggest re-generation
- Add `isdlc embedding migrate` command that regenerates from scratch

### Configuration
- `.isdlc/config.json` -> `embeddings.provider` default changes from `codebert` to `jina-code`
- Document provider switching in `.isdlc/config/README.md`

### Documentation
- Update `docs/ARCHITECTURE.md` embedding section
- Update `docs/HOOKS.md` to reference Jina model
- Update REQ-GH-224 design documents with migration note
- Add ADR documenting the dependency investigation and switch

## Acceptance Criteria

- **AC-001** Given a fresh checkout with no embeddings, When `node bin/isdlc-embedding.js generate` runs, Then Jina model is downloaded, embeddings are generated, and no errors occur
- **AC-002** Given embeddings are generated, When the embedding server starts via `node bin/isdlc-embedding-server.js`, Then it loads `.emb` packages and serves search queries
- **AC-003** Given a user has existing CodeBERT `.emb` files, When they run the pipeline with the new default provider, Then a clear warning surfaces explaining the model change and how to regenerate
- **AC-004** Given macOS Darwin ARM (Apple Silicon), When dependencies install, Then no native build steps are required and all prebuilt binaries load successfully
- **AC-005** Given the adapter is swapped, When existing embedding-related tests run, Then they pass with minimal test updates (dimension constants unchanged)
- **AC-006** Given the embedding server is running, When MCP tools `mcp__isdlc-embedding__*` are invoked from Claude Code, Then they return search results within 500ms for typical queries

## Complexity

Medium-Large. Scope is bounded (adapter swap + dep cleanup + migration) but touches enough of the embedding pipeline that it warrants its own analysis cycle. Not a bundle candidate with #230 (chunking perf) — different concern.

## Out of Scope

- Adding cloud provider (`voyage-code-3`, `openai`) activation — separate concern
- Chunking performance optimization (covered by #230)
- Memory/conversation embeddings (separate provider, separate activation path)
- Embedding-based search UI improvements
