# Error Taxonomy: Roundtable Memory Layer

**Status**: Draft
**Confidence**: High
**Last Updated**: 2026-03-13
**Coverage**: Full

---

## 1. Error Categories

| Category | Scope | Strategy |
|---|---|---|
| Memory read errors | Pre-roundtable (dispatch) | Fail-open: skip memory, proceed without |
| Memory write errors | Post-roundtable (write-back) | Fail-safe: log internally, don't block |
| Compaction errors | CLI command | Fail-loud: report to user via CLI output |
| Schema errors | Read or compact | Lenient: accept partial data, skip malformed entries |

## 2. Error Taxonomy Table

| Error ID | Description | Category | Trigger | Recovery | User Visibility |
|---|---|---|---|---|---|
| MEM-001 | User profile file not found | Read | First run or deleted file | Return null; omit MEMORY_CONTEXT | None |
| MEM-002 | Project memory file not found | Read | First run or deleted file | Return null; omit MEMORY_CONTEXT | None |
| MEM-003 | Malformed JSON in profile.json | Read | Manual edit, corruption | Return null; omit MEMORY_CONTEXT | None |
| MEM-004 | Malformed JSON in roundtable-memory.json | Read | Merge conflict, corruption | Return null; omit MEMORY_CONTEXT | None |
| MEM-005 | Partial schema (missing fields) | Read | Schema evolution, partial write | Use defaults for missing fields; skip invalid entries | None |
| MEM-006 | User session write failure | Write | Permission denied, disk full | Log internally; return `userWritten: false` | None |
| MEM-007 | Project memory write failure | Write | Permission denied, disk full, .isdlc missing | Log internally; return `projectWritten: false` | None |
| MEM-008 | User memory dir creation failure | Write | Permission denied | Log internally; skip user write | None |
| MEM-009 | Compaction read failure (user sessions) | Compact | Missing dir, permission denied | Report to CLI user; skip user compaction | CLI error message |
| MEM-010 | Compaction read failure (project) | Compact | Missing file, permission denied | Report to CLI user; skip project compaction | CLI error message |
| MEM-011 | Compaction write failure | Compact | Permission denied, disk full | Report to CLI user; exit code 1 | CLI error message |
| MEM-012 | MEMORY_CONTEXT parse failure in agent | Agent | Malformed injection | Skip memory; proceed with real-time sensing only | None |

## 3. Error Propagation Strategy

### 3.1 Read Path (Dispatch Layer)

```
readUserProfile()
  └─ try: fs.readFile + JSON.parse + validate
     catch: return null (swallow all errors)

readProjectMemory()
  └─ try: fs.readFile + JSON.parse + validate
     catch: return null (swallow all errors)

mergeMemory(null, null) → { topics: {} } → empty MEMORY_CONTEXT → omitted from prompt
```

Every read function independently catches errors. A failure in user memory does not prevent project memory from being read, and vice versa.

### 3.2 Write Path (Post-Roundtable)

```
writeSessionRecord(record, projectRoot)
  ├─ try: ensureDir + writeFile (user session)
  │  catch: log("User session write failed: {error}"); userWritten = false
  ├─ try: readFile + JSON.parse + push + writeFile (project memory)
  │  catch: log("Project memory write failed: {error}"); projectWritten = false
  └─ return { userWritten, projectWritten }
```

User and project writes are independent. A failure in one does not affect the other.

### 3.3 Compaction Path (CLI)

```
compact(options)
  ├─ if user: readdir(sessions/) → aggregate → writeFile(profile.json)
  │  on error: console.error("User compaction failed: {error}")
  ├─ if project: readFile(roundtable-memory.json) → aggregate → writeFile(roundtable-memory.json)
  │  on error: console.error("Project compaction failed: {error}")
  └─ exit code: 0 if all succeeded, 1 if any failed
```

## 4. Graceful Degradation Matrix

| Scenario | Behavior |
|---|---|
| No memory files exist | Roundtable behaves exactly as today |
| User profile exists, project memory missing | User preferences applied; no project context |
| Project memory exists, user profile missing | Project history applied; no user preferences |
| Both files corrupted | Roundtable behaves exactly as today |
| Partial user profile (some topics valid) | Valid entries used; invalid entries skipped |
| Write-back fails for both layers | Session data lost; next session starts without this session's input |
| Compaction fails | Raw sessions retained; user can retry |

## Pending Sections

(none -- all sections complete)
