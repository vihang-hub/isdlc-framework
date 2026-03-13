# Module Design: Roundtable Memory Layer

**Status**: Draft
**Confidence**: High
**Last Updated**: 2026-03-13
**Coverage**: Full

---

## 1. Module Overview

| Module | Responsibility | Owner |
|---|---|---|
| `lib/memory.js` | Core memory operations: read, write, compact, validate | New module |
| Analyze handler (in `isdlc.md`) | Orchestrates memory read → inject → write-back lifecycle | Existing — modified |
| Roundtable agent (in `roundtable-analyst.md`) | Consumes MEMORY_CONTEXT; produces session record | Existing — modified |
| `isdlc memory` CLI | User-facing compaction command | New subcommand |

## 2. Module: `lib/memory.js`

### 2.1 Responsibilities

- Read and validate user memory (`~/.isdlc/user-memory/profile.json`)
- Read and validate project memory (`.isdlc/roundtable-memory.json`)
- Merge user and project memory into a unified `MEMORY_CONTEXT` structure
- Write session records to both memory layers
- Compact raw session logs into summaries
- Detect and surface conflicts between user and project memory

### 2.2 Exported Functions

```javascript
/**
 * Read user memory profile. Returns null on missing/corrupted file.
 * @param {string} [userMemoryDir] - Override for testing (default: ~/.isdlc/user-memory)
 * @returns {Promise<UserProfile|null>}
 */
async function readUserProfile(userMemoryDir)

/**
 * Read project memory. Returns null on missing/corrupted file.
 * @param {string} projectRoot - Project root containing .isdlc/
 * @returns {Promise<ProjectMemory|null>}
 */
async function readProjectMemory(projectRoot)

/**
 * Merge user and project memory into MEMORY_CONTEXT block.
 * Detects per-topic conflicts between layers.
 * @param {UserProfile|null} userProfile
 * @param {ProjectMemory|null} projectMemory
 * @returns {MemoryContext}
 */
function mergeMemory(userProfile, projectMemory)

/**
 * Format MEMORY_CONTEXT for prompt injection.
 * @param {MemoryContext} memoryContext
 * @returns {string} - Formatted text block for prompt injection
 */
function formatMemoryContext(memoryContext)

/**
 * Write a session record to both memory layers.
 * Fail-safe: logs errors but never throws.
 * @param {SessionRecord} record
 * @param {string} projectRoot
 * @param {string} [userMemoryDir]
 * @returns {Promise<{userWritten: boolean, projectWritten: boolean}>}
 */
async function writeSessionRecord(record, projectRoot, userMemoryDir)

/**
 * Compact raw session logs into summaries.
 * @param {Object} options
 * @param {boolean} [options.user=true] - Compact user memory
 * @param {boolean} [options.project=true] - Compact project memory
 * @param {string} [options.projectRoot] - Project root (required if project=true)
 * @param {string} [options.userMemoryDir] - Override for testing
 * @returns {Promise<CompactionResult>}
 */
async function compact(options)
```

### 2.3 Data Structures

#### UserProfile (`~/.isdlc/user-memory/profile.json`)

```json
{
  "version": 1,
  "last_compacted": "2026-03-13T23:00:00Z",
  "topics": {
    "problem-discovery": {
      "preferred_depth": "standard",
      "weight": 0.8,
      "last_updated": "2026-03-13T23:00:00Z",
      "override_count": 2,
      "session_count": 15
    },
    "architecture": {
      "preferred_depth": "brief",
      "weight": 0.9,
      "last_updated": "2026-03-12T10:00:00Z",
      "override_count": 1,
      "session_count": 15
    }
  }
}
```

#### ProjectMemory (`.isdlc/roundtable-memory.json`)

```json
{
  "version": 1,
  "summary": {
    "total_sessions": 5,
    "last_session": "2026-03-13T23:00:00Z",
    "topics": {
      "security": {
        "avg_depth": "deep",
        "sessions_deep": 4,
        "sessions_brief": 1,
        "assumptions_total": 12,
        "assumptions_amended": 3
      }
    }
  },
  "sessions": [
    {
      "session_id": "sess_20260313_230000",
      "slug": "REQ-0063-roundtable-memory-layer",
      "timestamp": "2026-03-13T23:00:00Z",
      "topics": [
        {
          "topic_id": "problem-discovery",
          "depth_used": "standard",
          "acknowledged": true,
          "overridden": false,
          "assumptions_count": 2
        }
      ]
    }
  ]
}
```

#### SessionRecord (roundtable output → handler input)

```json
{
  "session_id": "sess_20260313_230000",
  "slug": "REQ-0063-roundtable-memory-layer",
  "timestamp": "2026-03-13T23:00:00Z",
  "topics": [
    {
      "topic_id": "problem-discovery",
      "depth_used": "standard",
      "acknowledged": true,
      "overridden": false,
      "assumptions_count": 2
    }
  ]
}
```

#### MemoryContext (merged, for prompt injection)

```json
{
  "topics": {
    "problem-discovery": {
      "user_preference": { "depth": "standard", "weight": 0.8 },
      "project_history": { "avg_depth": "standard", "sessions": 5 },
      "conflict": false
    },
    "security": {
      "user_preference": { "depth": "brief", "weight": 0.7 },
      "project_history": { "avg_depth": "deep", "sessions": 5 },
      "conflict": true
    }
  }
}
```

### 2.4 Compaction Algorithm

```
For each topic in all session records:
  1. Count sessions where each depth level was used
  2. preferred_depth = most frequent depth level
  3. weight = (sessions_at_preferred / total_sessions) * age_factor
     where age_factor decays older sessions (0.95^months_old)
  4. override_count = count of sessions where overridden=true
  5. session_count = total sessions
```

## 3. Module: Analyze Handler Changes

### 3.1 Pre-Roundtable (Memory Read + Inject)

Insert after persona/topic loading, before roundtable dispatch:

```
1. Call readUserProfile()
2. Call readProjectMemory(projectRoot)
3. Call mergeMemory(userProfile, projectMemory)
4. Call formatMemoryContext(memoryContext)
5. If non-empty: append MEMORY_CONTEXT block to dispatch prompt
6. If empty: omit MEMORY_CONTEXT (roundtable proceeds without memory)
```

### 3.2 Post-Roundtable (Session Write-Back)

Insert after ROUNDTABLE_COMPLETE is detected:

```
1. Parse session record from roundtable final output
2. Call writeSessionRecord(record, projectRoot)
3. Log success/failure internally (never shown to user)
```

## 4. Module: Roundtable Agent Prompt Changes

### 4.1 MEMORY_CONTEXT Parsing

Add to Section 2.1 (Opening), between steps 3 and 4:

```
3a. If MEMORY_CONTEXT is present in the dispatch prompt:
    - Parse per-topic entries
    - Store in internal memory map for consultation during conversation
    - Note any conflicts for surfacing
```

### 4.2 Acknowledgment at Topic Transitions

Add to Section 3.5 (Dynamic Depth Sensing):

```
Before calibrating depth for a topic:
1. Check internal memory map for this topic_id
2. If preference exists and no conflict:
   - Acknowledge: "From past sessions, you tend to [depth] on [topic] -- same here?"
   - Wait for user confirmation or override
3. If conflict exists:
   - Surface both: "Your usual preference is [user_depth] on [topic], but this project has used [project_depth] recently -- which way?"
   - Wait for user choice
4. Record outcome (acknowledged, overridden) in session log
```

### 4.3 Session Record Output

Add to roundtable finalization (after ROUNDTABLE_COMPLETE):

```
Output a SESSION_RECORD JSON block containing:
- session_id, slug, timestamp
- Per-topic: topic_id, depth_used, acknowledged, overridden, assumptions_count
```

## 5. Module: CLI Subcommand

### 5.1 Registration

In `bin/isdlc.js`, register `memory` as a subcommand with `compact` action.

### 5.2 CLI Interface

```
isdlc memory compact           # Compact both user and project memory
isdlc memory compact --user    # Compact user memory only
isdlc memory compact --project # Compact project memory only
```

### 5.3 Output

```
Compacting user memory...
  Read 47 session records
  Aggregated 6 topics
  Wrote ~/.isdlc/user-memory/profile.json

Compacting project memory...
  Read 12 session records
  Aggregated 6 topics
  Wrote .isdlc/roundtable-memory.json

Done.
```

## Pending Sections

(none -- all sections complete)
