# Security Architecture: T6 Hook I/O Optimization

**REQ-0020** | Phase 03 - Architecture | 2026-02-16

---

## 1. Scope

This document addresses security considerations for the T6 Hook I/O Optimization. Since the optimization is purely internal (no new external boundaries, no new network calls, no new user inputs), the security surface is narrow. The primary concerns are: cache integrity, fail-open correctness, and preservation of existing security mechanisms.

---

## 2. Threat Model (STRIDE Analysis)

### 2.1 Spoofing

| Threat | Applicability | Assessment |
|--------|--------------|------------|
| Spoofed config file | LOW | Config files are local filesystem; attacker with filesystem access already has full control. mtime-based cache does not introduce new spoofing vectors. |
| Spoofed project root | LOW | `getProjectRoot()` caching does not change the resolution logic, only caches the result. An attacker who can modify `CLAUDE_PROJECT_DIR` already controls the project root. |

**Mitigation**: No new mitigation needed. Existing filesystem permissions are sufficient.

### 2.2 Tampering

| Threat | Applicability | Assessment |
|--------|--------------|------------|
| Config file modified between cache and use | MEDIUM (theoretical) | Within a single dispatcher process (~100ms), an external process could modify a config file. The mtime-based cache would serve the old version until the next invocation. |
| State file modified between read and validation | EXISTING | This is the same race condition that exists today without caching. Optimistic locking (BUG-0009) handles this for writes. |

**Mitigation**:
- mtime-based invalidation detects file changes across invocations (AC-001b)
- Within a single process invocation (~100ms), config files do not change in normal operation
- State file optimistic locking is preserved (NFR-003)

### 2.3 Repudiation

Not applicable. The optimization does not change logging or audit behavior. `logHookEvent()` continues to function. Debug cache hit/miss logging (NFR-004) adds observability.

### 2.4 Information Disclosure

| Threat | Applicability | Assessment |
|--------|--------------|------------|
| Cached config data in memory | LOW | Config files (skills-manifest, iteration-requirements, workflows) contain no secrets. They are framework configuration, not user data. |
| Cache hit/miss logs expose paths | LOW | Debug logs go to stderr (not visible to users unless `ISDLC_DEBUG=true`). Paths logged are the same paths already used in error messages. |

**Mitigation**: No secrets in cached data. Debug logging follows existing patterns.

### 2.5 Denial of Service

| Threat | Applicability | Assessment |
|--------|--------------|------------|
| Memory exhaustion from cache | NONE | Cache holds at most 3 entries (manifest ~50KB, requirements ~2KB, workflows ~3KB). Total <60KB. Process lifetime is <1 second. |
| Cache lock contention | NONE | Single-threaded Node.js process. No locks needed. |

**Mitigation**: Fixed cache size, per-process lifetime.

### 2.6 Elevation of Privilege

| Threat | Applicability | Assessment |
|--------|--------------|------------|
| Stale cache serves outdated permissions | LOW | The skills-manifest contains skill-to-agent mappings. A stale manifest could allow a skill delegation that should have been blocked. However, hooks run in observe mode (`fail_behavior: allow`), so this has no enforcement impact. |

**Mitigation**: mtime-based invalidation ensures fresh data across invocations. Within a single invocation (~100ms), config changes are not expected.

---

## 3. Security Principles Applied

### 3.1 Article III: Security by Design

The caching layer is designed with security constraints:
- Cache does NOT store secrets (config files only, no state.json caching)
- Cache does NOT persist across processes (no stale data risk across invocations)
- Cache invalidation is mtime-based, not time-based (no TTL expiry that could serve stale data)

### 3.2 Article X: Fail-Safe Defaults

All caching functions follow the existing fail-open pattern:

```javascript
function loadManifest() {
    try {
        // ... cache logic ...
    } catch (e) {
        // Cache error: fall through to direct read
        // Direct read error: return null
        return null;
    }
}
```

If the caching mechanism fails for any reason (statSync error, Map corruption, unexpected mtime format), the function falls back to reading from disk directly. If the disk read also fails, it returns null. This preserves the existing fail-open contract.

### 3.3 Article XIV: State Management Integrity

The optimization explicitly preserves:
- **Optimistic locking**: `writeState()` read-before-write is NOT cached (NFR-003)
- **Atomic writes**: Full JSON written in a single `writeFileSync` call (unchanged)
- **state_version increment**: Happens in `writeState()`, not affected by config caching
- **No shadow state**: Config cache is transient (in-memory, per-process) and does NOT constitute shadow state

---

## 4. Authentication / Authorization

Not applicable. The hook subsystem has no authentication or authorization mechanism -- hooks are invoked by Claude Code with full filesystem access. The config caching does not introduce any new access control requirements.

---

## 5. Data Protection

### 5.1 Encryption at Rest

Not applicable. Config files and state.json are not encrypted at rest (existing behavior, out of scope).

### 5.2 Encryption in Transit

Not applicable. No network communication. All I/O is local filesystem.

### 5.3 Secrets Management

The optimization explicitly avoids caching any files that could contain secrets:
- `state.json`: NOT cached (only state-write-validator reads it, and that read is consolidated, not cached)
- `settings.local.json`: NOT accessed by any hook in scope
- Environment variables: NOT cached (CLAUDE_PROJECT_DIR is checked fresh from `process.env` on every call, though the result of the function is cached)

---

## 6. Compliance

### 6.1 Constitution Compliance

| Article | Requirement | How T6 Complies |
|---------|-------------|-----------------|
| III (Security by Design) | Security precedes implementation | This document defines security constraints before coding |
| V (Simplicity First) | No unnecessary complexity | Module-level Map is the simplest caching mechanism |
| X (Fail-Safe Defaults) | Fail securely | All cache operations wrapped in try/catch with null fallback |
| XIV (State Management) | Reliable state, no shadow state | Config cache is transient; state.json I/O unchanged |

### 6.2 Regulatory Compliance

Not applicable. The iSDLC framework is a developer tool with no user data processing, no PII, and no regulatory scope.

---

## 7. Security Review Checklist

- [x] No new external dependencies introduced
- [x] No new network connections
- [x] No new file paths accessed (same configs, same state file)
- [x] No secrets in cached data
- [x] Cache lifetime bounded to process (no persistence)
- [x] Fail-open behavior preserved for all cached functions
- [x] Optimistic locking mechanism untouched
- [x] Debug logging does not expose sensitive data
- [x] mtime-based invalidation prevents stale data across invocations

---

## 8. Traceability

| Security Concern | Traces To |
|-----------------|-----------|
| Fail-open cache functions | Article X, NFR-003 |
| No secrets in cache | Article III |
| Optimistic locking preserved | NFR-003, Article XIV |
| No shadow state | Article XIV |
| mtime invalidation | AC-001b, AC-001c, NFR-003 |
| Bounded cache size | Article V |
