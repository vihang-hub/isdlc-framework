# Database / State Design: T6 Hook I/O Optimization

**REQ-0020** | Phase 03 - Architecture | 2026-02-16

---

## Context

The iSDLC framework has no traditional database. All persistent state is managed via JSON files on the filesystem (Article XIV: State Management Integrity). This document covers the state I/O optimization design, which is the "database design" equivalent for this project.

---

## 1. State Files Affected

| File | Role | Current I/O | Optimized I/O |
|------|------|------------|---------------|
| `.isdlc/state.json` | Runtime state (single source of truth) | Read once by dispatcher, 3x by state-write-validator | Read once by dispatcher; 1x by state-write-validator |
| `.claude/hooks/config/skills-manifest.json` | Skill ownership mapping (~50KB) | Read 1-3x per dispatcher run | Read 1x, cached by mtime |
| `.claude/hooks/config/iteration-requirements.json` | Iteration limits (~2KB) | Read 1-3x per dispatcher run | Read 1x, cached by mtime |
| `.isdlc/config/workflows.json` | Workflow phase definitions (~3KB) | Read 1x per dispatcher run | Read 1x, cached by mtime |

---

## 2. Cache Data Model

### 2.1 Config Cache Structure

```javascript
// Module-level in common.cjs
let _cachedProjectRoot = null;

// Map<string, { mtimeMs: number, data: object }>
const _configCache = new Map();
```

**Cache entry schema**:
```
{
  key: string,         // "{projectRoot}:{configFileName}" e.g. "/Users/dev/project:skills-manifest.json"
  mtimeMs: number,     // fs.statSync(path).mtimeMs at time of caching
  data: object|null    // Parsed JSON content (null if file not found)
}
```

**Constraints**:
- Maximum 3 entries (manifest, requirements, workflows) -- no eviction needed
- Cache lifetime: process lifetime (typically <1 second for hooks)
- No serialization to disk -- purely in-memory

### 2.2 getProjectRoot Cache Structure

```javascript
// Module-level in common.cjs
let _cachedProjectRoot = null;
```

**Constraints**:
- Single value (string or null)
- Set once per process, never invalidated within a process
- CLAUDE_PROJECT_DIR env var bypasses cache entirely (already optimal path)

---

## 3. State Read Consolidation (state-write-validator.cjs)

### 3.1 Current Schema Access Pattern

The `check()` function currently reads state.json from disk at three points:

```
check(ctx)
  |
  +-- checkVersionLock(filePath, toolInput, toolName)
  |     fs.existsSync(filePath)     -- syscall 1
  |     fs.readFileSync(filePath)   -- syscall 2
  |     JSON.parse(content)         -- CPU
  |     -> extracts diskState.state_version
  |
  +-- checkPhaseFieldProtection(filePath, toolInput, toolName)
  |     fs.existsSync(filePath)     -- syscall 3
  |     fs.readFileSync(filePath)   -- syscall 4
  |     JSON.parse(content)         -- CPU
  |     -> extracts diskState.active_workflow
  |
  +-- (V1-V3 phase scan)
        fs.readFileSync(filePath)   -- syscall 5 (ONLY if incomingState has phases)
        JSON.parse(content)         -- CPU
        -> validates phase data consistency
```

Total: up to 5 filesystem syscalls + 3 JSON.parse for one state.json file.

### 3.2 Optimized Schema Access Pattern

```
check(ctx)
  |
  +-- readDiskStateOnce(filePath)
  |     fs.existsSync(filePath)     -- syscall 1
  |     fs.readFileSync(filePath)   -- syscall 2
  |     JSON.parse(content)         -- CPU
  |     -> diskState (shared reference)
  |
  +-- checkVersionLock(filePath, toolInput, toolName, diskState)
  |     -> uses diskState.state_version (no disk access)
  |
  +-- checkPhaseFieldProtection(filePath, toolInput, toolName, diskState)
  |     -> uses diskState.active_workflow (no disk access)
  |
  +-- (V1-V3 phase scan)
        -> uses incomingState from toolInput.content (already parsed)
        -> no disk read needed (V1-V3 validate incoming content, not disk)
```

Total: 2 filesystem syscalls + 1 JSON.parse. Reduction: 60%.

### 3.3 Function Signature Changes

```javascript
// BEFORE
function checkVersionLock(filePath, toolInput, toolName)
function checkPhaseFieldProtection(filePath, toolInput, toolName)

// AFTER
function checkVersionLock(filePath, toolInput, toolName, diskState)
function checkPhaseFieldProtection(filePath, toolInput, toolName, diskState)
```

Both functions handle `diskState === null` gracefully (fail-open, return null). This preserves backward compatibility for any direct callers (none exist -- these are internal functions, but the pattern is defensive).

---

## 4. Write Pattern (No Change)

The `writeState()` function in `common.cjs` performs a read-before-write for optimistic locking:

```javascript
function writeState(state, projectId) {
    // 1. Read current disk state to get state_version
    // 2. Increment state_version
    // 3. Write entire state to disk atomically
}
```

This read-before-write CANNOT be cached or eliminated:
- It ensures concurrent writes from different processes detect conflicts
- It is the implementation of the optimistic locking pattern (BUG-0009)
- The dispatchers already call `writeState()` at most once per invocation (FR-005 verified)

---

## 5. Migration Strategy

No migration needed. The optimization is purely internal:
- Cache variables are initialized to `null` / empty Map on process start
- No schema changes to state.json or config files
- No new files created
- Backward compatible: if caching code fails, fallback to direct reads

---

## 6. Backup / Recovery

Not applicable -- the optimization adds no persistent state. Cache is in-memory only, scoped to process lifetime. If the process crashes, cache is simply lost (no impact).

---

## 7. Traceability

| Design Element | Traces To |
|---------------|-----------|
| Config cache Map in common.cjs | FR-001, AC-001a-e |
| getProjectRoot cache variable | FR-002, AC-002a-c |
| State read consolidation | FR-003, AC-003a-d |
| diskState parameter injection | AC-003b, NFR-003 |
| writeState preservation | FR-005, NFR-003, Article XIV |
| No migration needed | NFR-002 (backward compatibility) |
