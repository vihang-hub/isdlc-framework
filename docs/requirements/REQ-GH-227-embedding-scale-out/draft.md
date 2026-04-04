# Embedding Scale-Out: ANN Search (HNSW) + Incremental Indexing (VCS Diff)

**Sources**: GH-227 (primary), GH-229 (linked)
**Created**: 2026-04-04
**Scope**: Combined analysis — two embedding scale-out concerns analyzed as one unit

---

## Summary

Two related scale-out concerns in the embedding subsystem (`lib/embedding/`), both targeting large codebases (500K-1M+ lines, 50K+ chunks):

1. **GH-227**: Query-side — replace brute-force linear scan in `findNearest()` with approximate nearest neighbor search (HNSW/FAISS/usearch)
2. **GH-229**: Index-side — wire existing VCS diff adapters into `isdlc embedding generate --incremental` to re-embed only changed files

Together, they form an "embedding scale-out" story: fast queries over large indexes, plus fast incremental updates to those indexes.

---

## GH-227: Approximate Nearest Neighbor Search (HNSW)

### Summary
Current embedding search is brute-force cosine similarity over all vectors. For 1M+ line codebases generating 50K+ chunks, this will be too slow. Implement HNSW or another ANN index.

### Context
- Existing backlog item #133 covers memory-layer scale-out (HNSW, remote vector store)
- This issue is specifically about the code embedding search path, not memory
- `lib/embedding/mcp-server/store-manager.js` does linear scan in `findNearest()`
- Options: HNSW via hnswlib-node, FAISS via faiss-node (already optional dep), or usearch
- Should be transparent to the MCP server API — same `semantic_search` tool, faster backend

### Related
#133 (memory scale-out — overlapping but different scope)

### Tier
Tier 3 — Scale for large codebases

---

## GH-229: Incremental Embedding Indexing via VCS Diff

### Summary
For large codebases (500K-1M lines), full re-embedding on every change is impractical. The VCS adapters (`lib/embedding/vcs/git-adapter.js`, `svn-adapter.js`) already support diff detection. Wire this into `isdlc embedding generate --incremental` to re-embed only changed files.

### Context
- Git adapter can detect changed files between commits
- The `.emb` package format supports incremental updates
- CLI line 40 mentions "AC-014-03: Incremental mode re-embeds only changed files via VCS adapter" but it's not implemented
- Critical for repos where full embedding takes minutes

### Depends on
Second GH issue in this batch (CLI must produce .emb packages first)

### Tier
Tier 3 — Scale for large codebases

---

## Why Combined Analysis

- **Same subsystem**: Both touch `lib/embedding/` — store-manager, VCS adapters, CLI
- **Shared architecture constraints**: Both must preserve the `.emb` package format, stay transparent to MCP server API consumers
- **Related performance story**: Fast queries over large indexes + fast incremental updates = coherent scale-out narrative
- **Build sequencing**: Likely shippable as one workflow (or two tightly sequenced ones)
