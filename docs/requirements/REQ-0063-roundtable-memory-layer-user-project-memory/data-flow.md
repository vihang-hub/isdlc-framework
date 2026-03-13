# Data Flow: Roundtable Memory Layer

**Status**: Draft
**Confidence**: High
**Last Updated**: 2026-03-13
**Coverage**: Full

---

## 1. Session Start — Memory Read Path

```
┌─────────────────┐
│  isdlc analyze   │
│  (handler)       │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌────────────────┐
│ Read   │ │ Read           │
│ User   │ │ Project        │
│ Profile│ │ Memory         │
│ (~/..) │ │ (.isdlc/..)    │
└───┬────┘ └───┬────────────┘
    │          │
    │  null?   │  null?
    │  skip    │  skip
    │          │
    ▼          ▼
┌─────────────────┐
│  mergeMemory()  │
│  Detect conflicts│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ formatMemory    │
│ Context()       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Inject into     │
│ dispatch prompt │
│ as MEMORY_      │
│ CONTEXT block   │
└─────────────────┘
```

## 2. During Conversation — Memory Consultation

```
┌─────────────────────────────────────────────┐
│           Roundtable Agent                   │
│                                              │
│  On topic transition:                        │
│  ┌─────────────────────────────────────┐    │
│  │ 1. Look up topic_id in MEMORY_      │    │
│  │    CONTEXT                           │    │
│  │ 2. If found and no conflict:         │    │
│  │    → Acknowledge preference          │    │
│  │    → "Brief on arch -- same here?"   │    │
│  │ 3. If found and conflict:            │    │
│  │    → Surface both signals            │    │
│  │    → Let user decide                 │    │
│  │ 4. If not found:                     │    │
│  │    → Proceed with real-time sensing  │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  Internal session log accumulates:           │
│  { topic_id, depth_used, acknowledged,       │
│    overridden, assumptions_count }           │
└─────────────────────────────────────────────┘
```

## 3. Session End — Write-Back Path

```
┌─────────────────┐
│ ROUNDTABLE_     │
│ COMPLETE        │
│ + SESSION_      │
│ RECORD JSON     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Analyze handler │
│ parses session  │
│ record          │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌────────────────┐
│ Write  │ │ Append to      │
│ User   │ │ Project        │
│ Session│ │ Memory         │
│ File   │ │ sessions[]     │
│(~/..)  │ │(.isdlc/..)     │
└───┬────┘ └───┬────────────┘
    │          │
    │ fail?    │ fail?
    │ log only │ log only
    │          │
    ▼          ▼
┌─────────────────┐
│ Continue with   │
│ normal post-    │
│ roundtable flow │
└─────────────────┘
```

## 4. Compaction — User-Triggered

```
┌─────────────────┐
│ isdlc memory    │
│ compact         │
└────────┬────────┘
         │
    ┌────┴─────────────────┐
    │ --user or default    │ --project or default
    │                      │
    ▼                      ▼
┌────────────────┐   ┌────────────────────┐
│ Read all files │   │ Read sessions[]    │
│ from sessions/ │   │ from roundtable-   │
│ directory      │   │ memory.json        │
└───────┬────────┘   └───────┬────────────┘
        │                    │
        ▼                    ▼
┌────────────────┐   ┌────────────────────┐
│ Aggregate per  │   │ Aggregate per      │
│ topic:         │   │ topic:             │
│ - depth counts │   │ - depth counts     │
│ - weight calc  │   │ - assumptions      │
│ - override cnt │   │ - amended count    │
└───────┬────────┘   └───────┬────────────┘
        │                    │
        ▼                    ▼
┌────────────────┐   ┌────────────────────┐
│ Write          │   │ Write summary      │
│ profile.json   │   │ section of         │
│ (replace)      │   │ roundtable-        │
│                │   │ memory.json        │
└────────────────┘   └────────────────────┘
```

## 5. State Mutation Points

| Point | What Mutates | When | Reversible? |
|---|---|---|---|
| Session write-back (user) | `~/.isdlc/user-memory/sessions/{ts}.json` created | After each roundtable | Yes — delete file |
| Session write-back (project) | `.isdlc/roundtable-memory.json` sessions array appended | After each roundtable | Yes — remove array entry |
| Compaction (user) | `~/.isdlc/user-memory/profile.json` replaced | On `isdlc memory compact` | No — previous profile overwritten (raw sessions retained) |
| Compaction (project) | `.isdlc/roundtable-memory.json` summary replaced | On `isdlc memory compact` | No — previous summary overwritten (sessions array retained) |

## 6. Persistence Boundaries

| Data | Location | Lifecycle | Shared? |
|---|---|---|---|
| User profile (compacted) | `~/.isdlc/user-memory/profile.json` | Persists until next compaction | No — local to user |
| User sessions (raw) | `~/.isdlc/user-memory/sessions/*.json` | Append-only; pruned on compaction | No — local to user |
| Project memory | `.isdlc/roundtable-memory.json` | Persists in project; version-controllable | Yes — shared via repo |
| MEMORY_CONTEXT | In-memory (prompt) | Single session only | No — ephemeral |
| Session log (in-agent) | In-memory (agent context) | Single session only | No — ephemeral |

## Pending Sections

(none -- all sections complete)
