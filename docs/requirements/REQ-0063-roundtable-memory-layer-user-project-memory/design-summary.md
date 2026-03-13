# Design Summary: Roundtable Memory Layer

**Status**: Draft
**Confidence**: High
**Last Updated**: 2026-03-13
**Coverage**: Full

---

## 1. Module Responsibilities

| Module | Responsibility | Boundary |
|---|---|---|
| `lib/memory.js` | All memory I/O: read, write, merge, compact, validate | Pure data operations — no prompt formatting knowledge |
| Analyze handler | Lifecycle orchestration: read memory → inject → write-back | Coordinates timing; delegates data operations to memory.js |
| Roundtable agent | Consume MEMORY_CONTEXT; produce session record | Stateless with respect to memory files; reads prompt input only |
| `isdlc memory compact` CLI | User-facing compaction interface | Thin wrapper over memory.js compact() |

## 2. Key Design Decisions

- **Weighted signals, not rules**: Memory preferences inform but never dictate depth. The roundtable's real-time depth sensing is the final arbiter.
- **Brief acknowledgment**: The roundtable surfaces memory-backed preferences at topic transitions. The user always knows when memory is influencing behavior and can override.
- **Conflict surfacing**: When user and project memory disagree, both signals are presented. The user decides — no algorithmic blending.
- **User-triggered compaction**: No automatic background processing. The user controls when files are modified via `isdlc memory compact`.
- **Fail-open everywhere**: Missing or corrupted memory never blocks or degrades the roundtable. Write failures never block ROUNDTABLE_COMPLETE.

## 3. Interface Contracts Summary

| Interface | Input | Output | Error Contract |
|---|---|---|---|
| `readUserProfile()` | Optional dir path | `UserProfile \| null` | Never throws |
| `readProjectMemory()` | Project root path | `ProjectMemory \| null` | Never throws |
| `mergeMemory()` | Two nullable profiles | `MemoryContext` | Never throws; returns empty on null inputs |
| `writeSessionRecord()` | Session record + paths | `{ userWritten, projectWritten }` | Never throws; reports per-layer success |
| `compact()` | Options object | `CompactionResult` | Throws on CLI-facing errors only |

## 4. Sequence of Operations — Typical Session

1. User runs `isdlc analyze`
2. Handler reads user profile + project memory (parallel, fail-open)
3. Handler merges into MEMORY_CONTEXT, detects conflicts
4. Handler injects MEMORY_CONTEXT into roundtable dispatch prompt
5. Roundtable parses MEMORY_CONTEXT (if present)
6. At each topic transition: check memory → acknowledge/conflict → user confirms/overrides
7. Roundtable completes → emits SESSION_RECORD + ROUNDTABLE_COMPLETE
8. Handler parses session record → writes to both memory layers (fail-safe)

## Pending Sections

(none -- all sections complete)
