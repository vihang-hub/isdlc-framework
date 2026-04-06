# Requirements Specification: REQ-GH-237

Replace CodeBERT with Jina v2 Base Code — unblock embedding pipeline

## 1. Business Context

The embedding pipeline (GH-224) cannot generate fresh embeddings on any project. Two independent blockers exist: the `tokenizers` npm dependency is phantom (v0.20.3 doesn't exist on npm), and CodeBERT has no canonical ONNX export on HuggingFace (404 URL). This blocks all local embedding functionality — semantic search, memory embeddings, and codebase indexing.

**Stakeholders**: Framework developers (primary), framework users installing iSDLC on new projects (secondary).

**Success Metric**: `node bin/isdlc-embedding.js generate` runs end-to-end on a fresh checkout without errors.

## 2. Stakeholders and Personas

### Framework Developer
- **Role**: Develops and maintains the iSDLC framework
- **Goals**: Working embedding pipeline for dogfooding semantic search
- **Pain Points**: Cannot generate embeddings on any project; pipeline is non-functional since GH-224 delivery

### Framework User
- **Role**: Installs iSDLC on their project
- **Goals**: Semantic search works out of the box after `/discover`
- **Pain Points**: Model download fails silently, embeddings never generated

## 3. User Journeys

### Fresh Install Journey
1. User runs `/discover` on a new project
2. Discover pre-warms Jina model (downloads ~162MB on first run)
3. User runs `isdlc embedding generate`
4. Jina adapter produces 768-dim embeddings for all source files
5. Embedding server starts and serves MCP search queries

### Existing Install Journey (with old .emb files)
1. User updates iSDLC framework
2. User runs embedding server
3. Server detects old .emb files (no model_id or wrong model_id)
4. Server logs warning: "Regenerate with: isdlc embedding generate"
5. User regenerates — new Jina embeddings replace old ones

## 4. Technical Context

- **Existing architecture**: `lib/embedding/engine/` has a pluggable adapter pattern with 3 providers (codebert, voyage-code-3, openai) routed via `resolveAdapter()` switch in `index.js`
- **Module system**: ESM (`import`/`export`) per Article XIII
- **Dependencies**: 6 prod deps currently; `onnxruntime-node` is the only native dep
- **Test infrastructure**: `node --test` with `node:assert`, ~60 embedding-related tests
- **Downstream consumers**: chunker, package builder, HNSW index, MCP server, aggregation layer — all dimension-agnostic (consume `Float32Array[]`)

## 5. Quality Attributes and Risks

| Attribute | Priority | Threshold |
|-----------|----------|-----------|
| Portability | Critical | Zero native build steps on macOS ARM |
| Performance | High | Full codebase embedding under 10 minutes |
| Latency | High | MCP search queries under 500ms (unchanged) |
| Reliability | High | Fail-open on missing deps (Article X) |
| Maintainability | Medium | Single adapter file, <100 lines |

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Transformers.js v4 has undocumented Node.js incompatibilities | Low | High | Verify on Node 20/22/24 during test phase |
| Jina model download fails in CI (no network) | Medium | Medium | Tests mock the adapter; CI doesn't need real model |
| Transformers.js bundles a different ONNX runtime version causing conflicts | Low | Medium | Removing direct onnxruntime-node dep eliminates version conflicts |

## 6. Functional Requirements

### FR-001: Jina Code Adapter
**Confidence**: High
**Priority**: Must Have

Create a new embedding adapter using `@huggingface/transformers` v4 with the `jinaai/jina-embeddings-v2-base-code` model. The adapter implements the existing adapter interface.

- **AC-001-01**: Given a fresh install, when `jina-code-adapter.js` is loaded, then `pipeline()` initializes and returns a valid adapter object
- **AC-001-02**: Given text input, when `embed(texts)` is called, then it returns an array of 768-dim Float32Array vectors, L2-normalized
- **AC-001-03**: Given the adapter is initialized, when `healthCheck()` is called, then it returns `{ healthy: true, dimensions: 768 }`
- **AC-001-04**: Given `@huggingface/transformers` is not installed, when the adapter is loaded, then it returns `null` (fail-open, Article X)

### FR-002: Engine Provider Routing
**Confidence**: High
**Priority**: Must Have

Update the embedding engine index to add `jina-code` as a provider, make it the default, and remove the `codebert` provider entirely.

- **AC-002-01**: Given `config.provider === 'jina-code'`, when `resolveAdapter()` is called, then it returns the Jina adapter
- **AC-002-02**: Given no provider specified, when the engine is invoked, then it defaults to `jina-code`
- **AC-002-03**: Given `config.provider === 'codebert'`, when `resolveAdapter()` is called, then it throws `Error('codebert provider has been removed. Use jina-code instead.')`

### FR-003: Dependency Cleanup
**Confidence**: High
**Priority**: Must Have

Remove `onnxruntime-node` from `dependencies`. Add `@huggingface/transformers@^4` as a regular dependency.

- **AC-003-01**: Given the updated `package.json`, when `npm install` runs on macOS ARM, then no native build steps execute
- **AC-003-02**: Given the updated `package.json`, when `npm ls` is run, then `onnxruntime-node` is absent and `@huggingface/transformers` is present

### FR-004: Dead Code Removal
**Confidence**: High
**Priority**: Must Have

Delete `codebert-adapter.js`, `codebert-adapter.test.js`, `model-downloader.js`, and `model-downloader.test.js`. Remove all CodeBERT imports and references from production code.

- **AC-004-01**: Given the codebase after cleanup, when searching for `codebert-adapter` or `model-downloader` imports, then zero matches in production code
- **AC-004-02**: Given the codebase after cleanup, when `npm test` runs, then no tests reference deleted files

### FR-005: Discover Pre-warm
**Confidence**: High
**Priority**: Should Have

Add a pre-warm step during `/discover` that triggers Jina model download so first real embedding usage is instant.

- **AC-005-01**: Given `/discover` runs on a fresh install, when the pre-warm step executes, then the Jina model is downloaded and cached
- **AC-005-02**: Given the pre-warm step fails (network error), when discover continues, then it logs a warning and completes normally (fail-open)

### FR-006: Stale Embedding Warning
**Confidence**: Medium
**Priority**: Should Have

When old `.emb` files lack a `model_id` metadata field or have a mismatched model, warn the user to regenerate.

- **AC-006-01**: Given `.emb` files exist without a `model_id` metadata field, when the embedding server loads them, then it logs a warning: "Embeddings were generated with a different model. Regenerate with: isdlc embedding generate"
- **AC-006-02**: Given fresh `.emb` files with `model_id: 'jina-code-v2-base'`, when the server loads them, then no warning is shown

### FR-007: Test and Reference Updates
**Confidence**: High
**Priority**: Must Have

Update all test fixtures and documentation referencing `codebert` provider to use `jina-code`.

- **AC-007-01**: Given `discover-integration.test.js`, when tests run, then all provider references use `jina-code`
- **AC-007-02**: Given `engine/index.test.js`, when tests run, then the default provider test asserts `jina-code`

## 7. Out of Scope

| Item | Reason |
|------|--------|
| Cloud provider activation (voyage-code-3, openai) | Separate concern — different activation path |
| Chunking performance (#230) | Different pipeline layer, separate issue |
| Memory/conversation embeddings | Separate provider, separate activation path |
| Embedding search UI improvements | Not related to model swap |
| `isdlc embedding migrate` command | No backward compat needed (user confirmed) |
| CodeBERT backward compatibility | No external consumers (user confirmed) |

## 8. MoSCoW Prioritization

| FR | Title | Priority | Rationale |
|----|-------|----------|-----------|
| FR-001 | Jina Code Adapter | Must Have | Core deliverable — the new adapter |
| FR-002 | Engine Provider Routing | Must Have | Required to wire the adapter in |
| FR-003 | Dependency Cleanup | Must Have | Remove broken deps, add working one |
| FR-004 | Dead Code Removal | Must Have | Clean up deleted adapter references |
| FR-007 | Test + Reference Updates | Must Have | Tests must pass after swap |
| FR-005 | Discover Pre-warm | Should Have | UX improvement for first-time users |
| FR-006 | Stale Embedding Warning | Should Have | Safety net for existing installs |
