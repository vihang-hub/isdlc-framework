# Data Flow: REQ-0038 External Manifest Source Field

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-02-24
**Coverage**: Full

---

## 1. Discover Orchestrator Reconciliation Flow

```
Discover Orchestrator (Step 2a)
    |
    | Inputs: distilled skills[], phasesExecuted[]
    |
    v
loadExternalManifest(projectId)
    |
    | Returns: manifest object (with source defaults applied)
    |
    v
reconcileSkillsBySource(manifest, "discover", distilledSkills, phasesExecuted)
    |
    | Internal:
    |   1. Partition existing: discover-sourced vs other-sourced
    |   2. Match incoming by name against discover-sourced
    |   3. Update matched: file, description, updated_at (preserve bindings, added_at)
    |   4. Remove unmatched where sourcePhase in phasesExecuted
    |   5. Preserve unmatched where sourcePhase NOT in phasesExecuted
    |   6. Add new incoming with full fields + default bindings
    |
    | Returns: { manifest, changed, added[], removed[], updated[] }
    |
    v
[changed === true?]
    |
    |-- Yes --> writeExternalManifest(manifest, projectId)
    |               |
    |               v
    |           node bin/rebuild-cache.js
    |               |
    |               v
    |           Display diff summary (using added/removed/updated)
    |
    |-- No --> Display "No manifest changes" (skip write and cache rebuild)
    |
    v
Done
```

---

## 2. Skills Researcher Reconciliation Flow

```
Skills Researcher (after skills.sh installation)
    |
    | Inputs: installed skills[], phasesExecuted[]
    |
    v
loadExternalManifest(projectId)
    |
    v
reconcileSkillsBySource(manifest, "skills.sh", installedSkills, phasesExecuted)
    |
    | (Same internal logic as discover flow)
    |
    | Returns: { manifest, changed, added[], removed[], updated[] }
    |
    v
[changed === true?]
    |
    |-- Yes --> writeExternalManifest(manifest, projectId) --> rebuild cache
    |-- No --> skip
    v
Done
```

---

## 3. User Skill Management Flow (unchanged)

```
/isdlc skill add <path>
    |
    v
loadExternalManifest(projectId)
    |
    v
Create entry: { name, file, source: "user", description, added_at: now, updated_at: now, bindings }
    |
    v
Append to manifest.skills[]
    |
    v
writeExternalManifest(manifest, projectId)
    |
    v
node bin/rebuild-cache.js (always -- user operations always change manifest)
    |
    v
Done
```

```
/isdlc skill remove <name>
    |
    v
loadExternalManifest(projectId)
    |
    v
removeSkillFromManifest(name, manifest)  // name-based, source-agnostic
    |
    v
writeExternalManifest(manifest, projectId)
    |
    v
node bin/rebuild-cache.js (always)
    |
    v
Done
```

---

## 4. Session Cache Builder Read Flow (minimal change)

```
buildSessionCache()
    |
    v
loadExternalManifest()  // now returns entries with source defaults applied
    |
    v
For each skill in manifest.skills:
    |
    | Read skill.source (always present after normalization)
    | Read skill.file, skill.bindings
    | Format injection block
    |
    v
Include "Source: {source}" in cache output  // already does this (line 4066)
    |
    v
Done
```

---

## 5. State Mutation Points

| Mutation | Trigger | Data Changed | Readers |
|----------|---------|-------------|---------|
| Manifest write (reconciliation) | Discover or skills-researcher completes | Skill entries: source-owned fields updated, entries added/removed | Session cache builder, skill list command |
| Manifest write (user add) | `/isdlc skill add` | New entry with `source: "user"` | Session cache builder, skill list command |
| Manifest write (user remove) | `/isdlc skill remove` | Entry removed by name | Session cache builder, skill list command |
| Manifest write (user wire) | `/isdlc skill wire` | `bindings` field updated on existing entry | Session cache builder |
| Cache rebuild | After any manifest write that changed content | `.isdlc/skill-cache.md` regenerated | SessionStart hook (reads cache for injection) |

---

## 6. Persistence Boundaries

| Data | Storage | Lifetime | Written By |
|------|---------|----------|-----------|
| External skills manifest | `docs/isdlc/external-skills-manifest.json` (or monorepo-scoped path) | Persistent, committed to repo | `writeExternalManifest()` |
| Skill files | `.claude/skills/external/*.md` | Persistent, committed to repo | Discover distillation, skills-researcher, user |
| Session cache | `.isdlc/skill-cache.md` | Persistent, gitignored | `node bin/rebuild-cache.js` |
| Reconciliation result | In-memory only | Single function call | `reconcileSkillsBySource()` return value |

---

## 7. Concurrency Considerations

No concurrent access to the manifest is expected:

- Discover orchestrator and skills-researcher run sequentially within the same discover workflow
- User commands (`skill add`, `skill remove`, `skill wire`) run in separate interactive sessions
- No locking mechanism needed
- If future parallel execution is introduced, `writeExternalManifest()` already does an atomic write + verify pattern that would catch corruption
