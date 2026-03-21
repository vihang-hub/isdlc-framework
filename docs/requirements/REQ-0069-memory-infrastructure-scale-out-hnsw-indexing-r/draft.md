# REQ-0069: Memory Infrastructure Scale-Out — HNSW Indexing, Remote Vector Store, Incremental Indexing

**Source**: GitHub Issue #133
**Created**: 2026-03-21

## Description

The current memory infrastructure uses linear-scan cosine similarity over flat file stores (SQLite BLOBs + .emb binary packages). This works for small-to-medium projects (~5K vectors, 1-5 developers) but breaks at enterprise scale (millions of LOC, 100+ developers).

## Proposed Capabilities

### 1. HNSW/ANN Index Backend
- Replace linear scan with approximate nearest neighbor (hnswlib-node or usearch)
- Drop-in MemoryStore implementation — same interface, different backend
- Handles codebase index size (sub-ms search over millions of vectors)

### 2. Remote Vector Store Backend
- MemoryStore implementation backed by pgvector, Qdrant, or Weaviate over HTTP
- Project memory moves from committed .emb file to shared team service
- Solves git binary merge conflicts with 100+ concurrent developers

### 3. Incremental Indexing
- Track file hashes in the knowledge pipeline
- Only re-embed changed files, not the entire codebase
- Independent of store backend

## Dependencies

- REQ-0064 (vector DB migration) — provides the MemoryStore interface
- REQ-0066 (team continuity) — provides hybrid search, link traversal
- BUG-0056 (CodeBERT end-to-end) — provides working local embedding path
