# Interface Specification: Roundtable Memory Layer

**Status**: Draft
**Confidence**: High
**Last Updated**: 2026-03-13
**Coverage**: Full

---

## 1. Memory Module API (`lib/memory.js`)

### 1.1 readUserProfile

```typescript
async function readUserProfile(
  userMemoryDir?: string  // Default: path.join(os.homedir(), '.isdlc', 'user-memory')
): Promise<UserProfile | null>
```

**Preconditions**: None (handles missing files gracefully)
**Postconditions**: Returns parsed UserProfile or null on any failure
**Error handling**: Catches all exceptions; returns null; never throws

### 1.2 readProjectMemory

```typescript
async function readProjectMemory(
  projectRoot: string  // Project root containing .isdlc/
): Promise<ProjectMemory | null>
```

**Preconditions**: `projectRoot` is a valid directory path
**Postconditions**: Returns parsed ProjectMemory or null on any failure
**Error handling**: Catches all exceptions; returns null; never throws

### 1.3 mergeMemory

```typescript
function mergeMemory(
  userProfile: UserProfile | null,
  projectMemory: ProjectMemory | null
): MemoryContext
```

**Preconditions**: Either or both inputs may be null
**Postconditions**: Returns MemoryContext with per-topic entries and conflict flags
**Invariants**:
- If both inputs are null, returns `{ topics: {} }` (empty context)
- If only one input is present, no conflicts are possible
- Conflict flag is set when user preferred_depth differs from project avg_depth

### 1.4 formatMemoryContext

```typescript
function formatMemoryContext(
  memoryContext: MemoryContext
): string
```

**Preconditions**: Valid MemoryContext object
**Postconditions**: Returns formatted text block suitable for prompt injection, or empty string if no topics
**Format**:
```
MEMORY_CONTEXT:
--- topic: problem-discovery ---
user_preference: standard (weight: 0.8)
project_history: standard (5 sessions)
conflict: false

--- topic: security ---
user_preference: brief (weight: 0.7)
project_history: deep (5 sessions, 4 deep)
conflict: true
```

### 1.5 writeSessionRecord

```typescript
async function writeSessionRecord(
  record: SessionRecord,
  projectRoot: string,
  userMemoryDir?: string
): Promise<{ userWritten: boolean; projectWritten: boolean }>
```

**Preconditions**: `record` has valid session_id, slug, timestamp, and topics array
**Postconditions**: Returns write success status for each layer; never throws
**Error handling**: Catches all exceptions per layer independently; logs failures

### 1.6 compact

```typescript
async function compact(options: {
  user?: boolean;       // Default: true
  project?: boolean;    // Default: true
  projectRoot?: string; // Required if project=true
  userMemoryDir?: string;
}): Promise<CompactionResult>
```

**Preconditions**: At least one of `user` or `project` is true
**Postconditions**: Returns counts of sessions read, topics aggregated, files written
**Error handling**: Throws on unrecoverable errors (user-facing CLI command)

```typescript
interface CompactionResult {
  user?: { sessionsRead: number; topicsAggregated: number; profileWritten: boolean };
  project?: { sessionsRead: number; topicsAggregated: number; memoryWritten: boolean };
}
```

## 2. Data Type Definitions

### 2.1 UserProfile

```typescript
interface UserProfile {
  version: number;           // Schema version (currently 1)
  last_compacted: string;    // ISO timestamp
  topics: Record<string, TopicPreference>;
}

interface TopicPreference {
  preferred_depth: 'brief' | 'standard' | 'deep';
  weight: number;            // 0.0 to 1.0 — strength of preference
  last_updated: string;      // ISO timestamp
  override_count: number;    // Times user overrode this preference
  session_count: number;     // Total sessions where this topic was covered
}
```

### 2.2 ProjectMemory

```typescript
interface ProjectMemory {
  version: number;
  summary: ProjectSummary;
  sessions: SessionRecord[];
}

interface ProjectSummary {
  total_sessions: number;
  last_session: string;      // ISO timestamp
  topics: Record<string, ProjectTopicSummary>;
}

interface ProjectTopicSummary {
  avg_depth: 'brief' | 'standard' | 'deep';
  sessions_deep: number;
  sessions_standard: number;
  sessions_brief: number;
  assumptions_total: number;
  assumptions_amended: number;
}
```

### 2.3 SessionRecord

```typescript
interface SessionRecord {
  session_id: string;        // Format: sess_{YYYYMMDD}_{HHMMSS}
  slug: string;              // Analysis slug (e.g., "REQ-0063-roundtable-memory-layer")
  timestamp: string;         // ISO timestamp
  topics: TopicOutcome[];
}

interface TopicOutcome {
  topic_id: string;          // Matches topic file topic_id
  depth_used: 'brief' | 'standard' | 'deep';
  acknowledged: boolean;     // Was a memory-backed preference surfaced?
  overridden: boolean;       // Did the user override the preference?
  assumptions_count: number; // Number of inferences made for this topic
}
```

### 2.4 MemoryContext

```typescript
interface MemoryContext {
  topics: Record<string, MergedTopicEntry>;
}

interface MergedTopicEntry {
  user_preference: { depth: string; weight: number } | null;
  project_history: { avg_depth: string; sessions: number } | null;
  conflict: boolean;
}
```

## 3. CLI Interface

### 3.1 `isdlc memory compact`

```
Usage: isdlc memory compact [options]

Options:
  --user      Compact user memory only
  --project   Compact project memory only
  (default)   Compact both

Exit codes:
  0  Success
  1  Error during compaction
```

### 3.2 Dispatch Prompt Injection

The analyze handler appends the following to the roundtable dispatch prompt when memory is available:

```
MEMORY_CONTEXT:
{formatted memory context from formatMemoryContext()}
```

When memory is not available (missing files, corrupted, empty), the `MEMORY_CONTEXT:` section is omitted entirely from the dispatch prompt.

## 4. Validation Rules

### 4.1 Schema Validation (Lenient)

| Field | Required? | Default if Missing |
|---|---|---|
| `version` | No | Assume version 1 |
| `topics` | No | Empty object `{}` |
| `topics.*.preferred_depth` | No | Skip entry |
| `topics.*.weight` | No | Default 0.5 |
| `topics.*.last_updated` | No | Epoch |
| `sessions` | No | Empty array `[]` |
| `sessions.*.topics` | No | Skip record |

### 4.2 Conflict Detection

A conflict is flagged when:
- Both user_preference and project_history exist for a topic
- `user_preference.depth !== project_history.avg_depth`
- `user_preference.weight >= 0.5` (weak preferences don't trigger conflicts)

## Pending Sections

(none -- all sections complete)
