# Infrastructure Design: T6 Hook I/O Optimization

**REQ-0020** | Phase 03 - Architecture | 2026-02-16

---

## Scope

The T6 Hook I/O Optimization is a purely local, in-process performance optimization. It has **no infrastructure impact**. This document confirms that no infrastructure changes are required.

---

## No Infrastructure Changes

| Aspect | Current | After T6 | Change |
|--------|---------|----------|--------|
| Compute | Developer's local machine | Same | None |
| Storage | Local filesystem (.isdlc/, .claude/) | Same | None |
| Network | None (hooks are local processes) | Same | None |
| Containers | None | None | None |
| Cloud services | None | None | None |
| CI/CD | GitHub Actions (test matrix) | Same | None |
| Monitoring | stderr debug logs | Same + cache hit/miss logs | Minor addition |

---

## Environment Strategy

The optimization applies identically across all environments:

| Environment | Impact |
|------------|--------|
| Development (local) | Primary target -- reduces I/O during development |
| CI (GitHub Actions) | Tests run with optimization; no CI config change needed |
| Production | N/A (iSDLC is a development tool, not a deployed service) |

---

## Deployment

The optimization is deployed via the existing `isdlc update` mechanism:
1. Updated `.cjs` files are committed to `src/claude/hooks/`
2. `isdlc update` copies files from source to `.claude/hooks/` via the installer
3. No new files, no new directories, no configuration changes

---

## Observability

Cache hit/miss logging is added to stderr when `ISDLC_DEBUG=true`:
```
[debug] Cache HIT: skills-manifest.json
[debug] Cache MISS: iteration-requirements.json (first load)
[debug] getProjectRoot: cached /Users/dev/project
```

This uses the existing `debugLog()` function in `common.cjs`. No new logging infrastructure required.
