# Quick Scan: REQ-GH-237

## 1. Scope

**Classification**: Medium
**Rationale**: Bounded adapter swap within the embedding engine layer. Clean adapter interface means downstream layers (chunker, HNSW, server, package) are unaffected. ~10 files directly touched, 61 files in `lib/embedding/` total but most are dimension-agnostic.

## 2. Keywords

| Keyword | Hits | Key Files |
|---------|------|-----------|
| `codebert` | 143 | `engine/codebert-adapter.js`, `engine/index.js`, `installer/model-downloader.js`, `discover-integration.test.js` |
| `onnxruntime-node` | 45 | `package.json`, `engine/codebert-adapter.js`, `setup-project-knowledge.js` |
| `tokenizers` | 62 | `codebert-adapter.js` (BPE tokenizer), quality docs |
| `embedding.*provider` | 4 | `engine/index.js`, `setup-project-knowledge.js` |

## 3. File Count

| Type | Count |
|------|-------|
| New | 2 (jina-code-adapter.js, jina-code-adapter.test.js) |
| Modify | 5 (engine/index.js, engine/index.test.js, package.json, setup-project-knowledge.js, discover-integration.test.js) |
| Delete | 4 (codebert-adapter.js, codebert-adapter.test.js, model-downloader.js, model-downloader.test.js) |
| Config | 0 |
| Docs | 3 (PROJECT-KNOWLEDGE.md, ARCHITECTURE.md, project-discovery-report.md) |
| **Total** | **14** |

## 4. Final Scope

**Medium** — 14 files affected, clean adapter boundary, zero schema changes downstream. Risk is low: the adapter interface is well-defined and the swap is mechanical.
