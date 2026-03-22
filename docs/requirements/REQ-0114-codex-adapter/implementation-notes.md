# Implementation Notes: Codex Provider Adapter (Batch)

**Items**: REQ-0114, REQ-0115, REQ-0116, REQ-0117
**Phase**: 06-implementation | **Date**: 2026-03-22

---

## 1. Files Created

### Production Code

| File | Lines | Purpose | Requirements |
|------|-------|---------|-------------|
| `src/providers/codex/index.js` | 20 | Barrel re-export | REQ-0114 FR-003 |
| `src/providers/codex/projection.js` | 158 | Config, paths, instruction projection | REQ-0114 FR-001/002, REQ-0116 |
| `src/providers/codex/installer.js` | 235 | Install/update/uninstall/doctor | REQ-0115 |
| `src/providers/codex/governance.js` | 193 | Governance model + checkpoint validation | REQ-0117 |

### Test Code

| File | Tests | Purpose |
|------|-------|---------|
| `tests/providers/codex/index.test.js` | 6 | Barrel exports verification |
| `tests/providers/codex/projection.test.js` | 18 | Config, paths, instruction projection |
| `tests/providers/codex/installer.test.js` | 22 | Install/update/uninstall/doctor with temp dirs |
| `tests/providers/codex/governance.test.js` | 21 | Governance model + checkpoint validation |

**Total**: 65 new tests, all passing.

## 2. Key Design Decisions

### 2.1 Simpler Than Claude Installer

The Codex installer is intentionally simpler than the Claude installer (535 lines vs 235 lines):
- No hooks directory management (Codex has no PreToolUse/PostToolUse hooks)
- No settings.json merge (Codex uses markdown instructions, not JSON config)
- No symlink creation (no .antigravity equivalent)
- No skills manifest YAML-to-JSON conversion
- Uses Node built-in `fs` directly instead of `fs-extra` wrappers (since operations are simpler)

### 2.2 Content Hash Tracking

User content preservation uses SHA-256 content hashing stored in `config.json`:
- On install: hash of generated content is stored
- On update: compare current file hash against stored hash; skip if different (user edited)
- On uninstall: compare current file hash against stored hash; preserve if different

### 2.3 Fail-Open Projection

`projectInstructions()` follows fail-open semantics per REQ-0116 AC-005-01:
- Each core model load is wrapped in try/catch
- Missing models produce warnings in `metadata.warnings` instead of throwing
- Minimal instruction content is always returned, even with zero available models

### 2.4 Governance Validation

`validateCheckpoint()` runs state-level validation only (not filesystem checks):
- State schema: checks `current_phase` and `phases` fields exist
- Phase transition: validates sequential ordering (cannot skip more than 1 phase)
- Artifact existence: deferred to runtime (requires `projectRoot`), not checked in pure function

### 2.5 No Existing Files Modified

Zero changes to existing files. All new code is additive:
- No modifications to `src/providers/claude/*`
- No modifications to `src/core/*`
- No modifications to `package.json` (test:providers glob already covers new files)

## 3. Test Results

```
tests 65 | pass 65 | fail 0
Provider suite: 93 total (28 existing + 65 new)
Core suite: 835 total, 0 regressions
```

## 4. Constitutional Compliance

| Article | Status | Evidence |
|---------|--------|----------|
| I (Specification Primacy) | Compliant | All ACs traced in test IDs |
| II (Test-First Development) | Compliant | Tests written before production code |
| III (Security by Design) | Compliant | Input validation in validateCheckpoint, fail-safe defaults |
| V (Simplicity First) | Compliant | Minimal implementation, no over-engineering |
| VII (Artifact Traceability) | Compliant | REQ-NNNN referenced in all file headers and test descriptions |
| IX (Quality Gate Integrity) | Compliant | All 65 tests passing, all artifacts exist |
| X (Fail-Safe Defaults) | Compliant | Frozen configs, fail-open on missing models, null checks |
| XIII (Provider Neutrality) | Compliant | Core models consumed via import, no duplication |
