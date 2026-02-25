# Blast Radius Coverage: REQ-0040 TOON Format Integration

**Generated:** 2026-02-25
**Phase:** 06-implementation

## Coverage Checklist

| File | Change Type | Status | Rationale |
|------|-------------|--------|-----------|
| `package.json` | MODIFY | deferred | ADR-0040-01 selected native CJS encoder with zero npm dependencies. The original impact analysis assumed an `npm install toon` step (REQ-001), but the architecture phase chose to implement TOON encoding natively in pure CJS. No package.json modification is required. |
| `src/claude/hooks/lib/common.cjs` | MODIFY | covered | Modified `rebuildSessionCache()` to use TOON encoding for SKILLS_MANIFEST section with `[TOON]` marker and fail-open JSON fallback (ADR-0040-03). |
| `bin/rebuild-cache.js` | MODIFY | deferred | This file is a thin CLI wrapper that delegates entirely to `common.cjs::rebuildSessionCache()` (line 32). Since `rebuildSessionCache()` now produces TOON output internally, `rebuild-cache.js` automatically inherits the change with zero code modifications. Impact analysis line 91-93 confirms: "no direct changes needed if rebuildSessionCache() handles TOON internally." |

## Summary

- **Covered:** 1 (common.cjs — directly modified)
- **Deferred:** 2 (package.json — no dependency needed per ADR; rebuild-cache.js — auto-inherits via delegation)
- **Unaddressed:** 0

## New Files Created

| File | Requirement |
|------|-------------|
| `src/claude/hooks/lib/toon-encoder.cjs` | FR-001, FR-004 (NEW module) |
| `src/claude/hooks/tests/toon-encoder.test.cjs` | 44 unit tests for toon-encoder |
