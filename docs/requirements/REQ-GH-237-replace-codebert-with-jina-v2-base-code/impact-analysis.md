# Impact Analysis: REQ-GH-237

Replace CodeBERT with Jina v2 Base Code

## 1. Blast Radius

### Tier 1: Direct Changes

| File | Module | Change Type | Traces |
|------|--------|------------|--------|
| `lib/embedding/engine/jina-code-adapter.js` | engine | NEW | FR-001 |
| `lib/embedding/engine/index.js` | engine | MODIFY | FR-002 |
| `package.json` | root | MODIFY | FR-003 |
| `lib/embedding/engine/codebert-adapter.js` | engine | DELETE | FR-004 |
| `lib/embedding/installer/model-downloader.js` | installer | DELETE | FR-004 |
| `lib/setup-project-knowledge.js` | setup | MODIFY | FR-005 |
| `lib/embedding/package/builder.js` | package | MODIFY | FR-006 |
| `lib/embedding/package/reader.js` | package | MODIFY | FR-006 |

### Tier 2: Transitive Impact

| File | Module | Impact | Change Needed |
|------|--------|--------|---------------|
| `lib/embedding/engine/jina-code-adapter.test.js` | engine | NEW test file | NEW |
| `lib/embedding/engine/index.test.js` | engine | Provider references | MODIFY |
| `lib/embedding/engine/codebert-adapter.test.js` | engine | Test for deleted adapter | DELETE |
| `lib/embedding/installer/model-downloader.test.js` | installer | Test for deleted downloader | DELETE |
| `lib/embedding/discover-integration.test.js` | discover | Provider fixtures | MODIFY |
| `lib/embedding/installer/lifecycle.test.js` | installer | May reference model download | INSPECT |

### Tier 3: Side Effects

| Area | Potential Impact | Risk Level |
|------|-----------------|------------|
| `docs/PROJECT-KNOWLEDGE.md` | References CodeBERT in provider table | Low |
| `docs/project-discovery-report.md` | Lists CodeBERT as embedding engine | Low |
| `.isdlc/models/codebert-base/` | Orphaned model directory on existing installs | Low |

## 2. Entry Points

**Recommended start**: FR-003 (dependency swap in package.json) → FR-001 (new adapter) → FR-002 (wire into index) → FR-004 (delete old files) → FR-005/FR-006 (enhancements) → FR-007 (test updates)

**Rationale**: Dependencies must be available before the adapter can be written. Adapter must exist before routing. Old code can be deleted once new code is wired. Enhancements and test updates are independent.

## 3. Implementation Order

| Order | FRs | Description | Risk | Parallel | Depends On |
|-------|-----|-------------|------|----------|------------|
| 1 | FR-003 | Update package.json deps | Low | No | — |
| 2 | FR-001 | Create jina-code-adapter.js | Low | No | FR-003 |
| 3 | FR-002 | Update engine index routing | Low | No | FR-001 |
| 4 | FR-004 | Delete CodeBERT files | Low | Yes | FR-002 |
| 5 | FR-005, FR-006 | Discover pre-warm, stale warning | Low | Yes | FR-001 |
| 6 | FR-007 | Update test fixtures | Low | Yes | FR-002 |

## 4. Risk Zones

| ID | Risk | Area | Likelihood | Impact | Mitigation |
|----|------|------|-----------|--------|------------|
| R1 | Transformers.js Node.js compat | engine | Low | High | Test on Node 20/22/24 |
| R2 | Model download in CI | tests | Medium | Medium | Mock adapter in tests |
| R3 | ONNX runtime version conflict | deps | Low | Medium | Removing direct dep eliminates conflicts |
| R4 | lifecycle.test.js has non-CodeBERT tests | installer | Low | Low | Inspect before deleting |

## 5. Summary

| Metric | Count |
|--------|-------|
| Direct modifications | 6 |
| New files | 2 |
| Deleted files | 4 |
| Transitive modifications | 4 |
| **Total affected** | **14** (+ 2 docs) |

**Overall risk**: Low. Clean adapter boundary, same dimensionality, well-defined interface.
**Go/No-go**: Go.
