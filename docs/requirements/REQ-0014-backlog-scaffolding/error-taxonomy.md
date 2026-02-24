# Error Taxonomy: BACKLOG.md Scaffolding

**REQ ID**: REQ-0014
**Phase**: 04-design
**Created**: 2026-02-14
**Status**: Approved

---

## 1. Error Classification

This feature has a deliberately minimal error surface. The BACKLOG.md creation block follows the identical pattern used for CLAUDE.md creation (lines 557-569 of installer.js), which has zero error handling -- file system errors propagate to the caller as unhandled exceptions, causing the installer to fail with a clear error message.

### Error Response Format

The installer uses logger-based messaging (not HTTP responses or structured error objects). Errors from the BACKLOG.md block manifest as:
- **Fatal errors**: Unhandled exceptions that terminate the install() function
- **Non-fatal outcomes**: Log messages (success, info, warning) that indicate skip or dry-run behavior

---

## 2. Error Catalog

### ERR-BL-001: File System Write Failure

| Field | Value |
|-------|-------|
| Code | ERR-BL-001 |
| Category | File System |
| Severity | FATAL |
| Source | `writeFile(backlogPath, generateBacklogMd())` |
| Trigger | Disk full, read-only filesystem, insufficient permissions, path too long |
| Behavior | Exception propagates from `writeFile()` to `install()` caller |
| User-visible | Node.js error message (e.g., `EACCES: permission denied, open '/path/BACKLOG.md'`) |
| Recovery | User resolves filesystem issue, re-runs `isdlc init` |
| Handling | **No try/catch** -- intentional (matches CLAUDE.md pattern) |
| Rationale | A filesystem write failure during installation is a fatal condition. The installer should fail loudly so the user knows the installation is incomplete. Silently swallowing the error would leave the project in a partial state. |

### ERR-BL-002: File Existence Check Failure

| Field | Value |
|-------|-------|
| Code | ERR-BL-002 |
| Category | File System |
| Severity | FATAL |
| Source | `exists(backlogPath)` |
| Trigger | Invalid path characters, path too long, filesystem error during stat() |
| Behavior | Exception propagates from `exists()` to `install()` caller |
| User-visible | Node.js error message |
| Recovery | User resolves path issue, re-runs `isdlc init` |
| Handling | **No try/catch** -- intentional |
| Rationale | The `exists()` utility (from fs-helpers.js) wraps `fs.access()`. If it throws, the filesystem is in an unusual state. Failing loudly is the correct response. |

### ERR-BL-003: Path Construction Error

| Field | Value |
|-------|-------|
| Code | ERR-BL-003 |
| Category | Input Validation |
| Severity | FATAL |
| Source | `path.join(projectRoot, 'BACKLOG.md')` |
| Trigger | `projectRoot` is null, undefined, or not a string |
| Behavior | TypeError from `path.join()` |
| User-visible | Node.js error message |
| Recovery | Fix calling code -- this indicates a programming error |
| Handling | **Not caught here** -- validated upstream by CLI argument parsing |
| Rationale | The `projectRoot` parameter is validated before `install()` is called. If it reaches this point as null/undefined, that is a bug in the CLI layer, not an expected runtime error. |

---

## 3. Non-Error Outcomes

These are normal code paths that do NOT represent errors:

### INFO-BL-001: BACKLOG.md Already Exists (Skip)

| Field | Value |
|-------|-------|
| Code | INFO-BL-001 |
| Category | Normal Operation |
| Severity | INFO |
| Source | `exists(backlogPath)` returns true |
| Log | `logger.info('BACKLOG.md already exists -- skipping')` |
| File Impact | None -- existing file is preserved |
| Rationale | This is the correct behavior per FR-02. An existing BACKLOG.md contains user data and must never be overwritten. |

### INFO-BL-002: Dry-Run Mode (No Write)

| Field | Value |
|-------|-------|
| Code | INFO-BL-002 |
| Category | Normal Operation |
| Severity | INFO |
| Source | `dryRun === true` |
| Log | `logger.success('Created BACKLOG.md')` (same message as real creation) |
| File Impact | None -- no file written to disk |
| Rationale | Consistent with all other dry-run behavior in the installer. The success log is emitted even in dry-run mode to show what *would* happen. |

---

## 4. Error Handling Strategy

### 4.1 Design Philosophy

The BACKLOG.md creation block intentionally does NOT add error handling beyond what the existing code already provides. This is a conscious design decision, not an oversight.

**Why no try/catch:**
1. **Pattern consistency**: The CLAUDE.md creation block (the template being replicated) has no try/catch. Adding one to BACKLOG.md would be inconsistent.
2. **Fail-loud for installation**: Installation is a one-time operation. If a file cannot be created, the user needs to know immediately. A silent failure would leave the installation incomplete with no indication of what went wrong.
3. **Simplicity first** (Article V): Adding error handling for a case that the existing code doesn't handle would be unnecessary complexity. The only realistic failure mode (filesystem errors) is already handled correctly by exception propagation.

### 4.2 Error Propagation Path

```
writeFile() throws
  |
  v
install() does not catch (no try/catch around this block)
  |
  v
handleInit() in cli.js catches via its top-level try/catch
  |
  v
logger.error(err.message) is called
  |
  v
process.exit(1)
```

### 4.3 When to Reconsider

If a future requirement adds the ability to **partially succeed** during installation (create some files but skip others on error), then individual try/catch blocks should be added to each file creation step, including BACKLOG.md. Until then, the current fail-fast approach is correct.

---

## 5. Traceability

| Error/Outcome | Requirement | Rationale |
|--------------|-------------|-----------|
| ERR-BL-001 (write failure) | FR-01 | Installation must create the file; failure is fatal |
| ERR-BL-002 (exists check failure) | FR-02 | Cannot determine if file exists; fail rather than overwrite |
| ERR-BL-003 (path error) | FR-01 | Programming error, not a runtime scenario |
| INFO-BL-001 (skip) | FR-02, AC-06, AC-07 | Existing file preserved, user informed |
| INFO-BL-002 (dry-run) | FR-03, AC-08, AC-09 | No write, log emitted |
