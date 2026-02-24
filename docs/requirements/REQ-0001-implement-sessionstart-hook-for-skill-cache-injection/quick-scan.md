# Quick Scan: SessionStart Hook for Skill Cache Injection

**Generated**: 2026-02-23T19:45:00Z
**Feature**: Unified SessionStart cache — eliminate ~200+ static file reads per workflow (GH #91)
**Phase**: 00-quick-scan
**Status**: Complete

---

## Scope Estimate

**Estimated Scope**: MEDIUM
**File Count Estimate**: ~12-18 files
**Confidence**: HIGH

**Rationale**: This feature involves:
- Creating one new hook file (`inject-skill-cache.cjs`)
- Modifying 4 core files (common.cjs, settings.json, isdlc.md, installer.js)
- Potential updates to 6-8 trigger locations (discover, skill add/remove/wire commands)
- Test files and integration updates
- Well-defined scope with clear input/output boundaries

---

## Keyword Matches

### Domain Keywords

| Keyword | File Matches | Line Count |
|---------|--------------|-----------|
| cache | 7 files | REQ-0020 discovery report, common.cjs, ADR docs |
| session | 1 file | draft.md (feature spec) |
| skill-cache | 1 file | REQ-0001 draft.md (design spec) |
| inject | 3 files | isdlc.md (phase-loop controller), draft.md |
| static file reads | 1 file | draft.md (problem statement) |
| external-skills | 7 files | common.cjs, settings.json, gate-blocker, gate-requirements-injector |
| manifest | 6 files | skills-manifest.json, common.cjs, gate-requirements-injector |

### Technical Keywords

| Keyword | File Matches | Notes |
|---------|--------------|-------|
| readFileSync | 10+ files | Current bottleneck in hooks (non-test files only) |
| rebuildCache | 0 files | New function to be added |
| SessionStart hook | 0 files | New hook type to be registered |
| .isdlc/skill-cache.md | 1 file | draft.md (target cache file) |
| settings.json hook registration | 1 file | src/claude/settings.json (306 lines) |
| isdlc.md STEP 3d | 1 file | STEP 3d external skill injection (lines 1716-1735) |

---

## File Impact Analysis

### New Files to Create
1. `src/claude/hooks/inject-skill-cache.cjs` (estimated 50-80 lines)
2. `bin/rebuild-cache.js` (optional CLI escape hatch, ~40 lines)

### Files to Modify (High Impact)

| File | Current Size | Modification Scope | Risk Level |
|------|--------------|-------------------|-----------|
| `src/claude/hooks/lib/common.cjs` | 3,909 lines | Add `rebuildSkillCache()` function | MEDIUM |
| `src/claude/commands/isdlc.md` | 2,315 lines | Update STEP 3d external skill injection block (3-5 lines) | LOW |
| `src/claude/settings.json` | 306 lines | Register SessionStart hook dispatcher | LOW |
| `lib/installer.js` | ~845 lines | Add cache rebuild trigger on init/update | LOW |

### Files to Modify (Medium Impact)

| File | Current Size | Modification Scope | Triggering Location |
|------|--------------|-------------------|-------------------|
| `src/claude/hooks/config/skills-manifest.json` | 1,069 lines | Cleanup unused fields (path_lookup, skill_paths) | Manifest cleanup section |
| `.claude/commands/skill-management.md` | Varies | Add cache rebuild trigger to `/isdlc skill add/remove/wire` | Skill management commands |
| `src/isdlc/config/workflows.json` | 383 lines | No direct changes, but cached by rebuildSessionCache() | Reference only |

### Files to Reference (Cache Content)

These files will be pre-loaded into the session cache:

| File | Size | Cached By | Purpose |
|------|------|-----------|---------|
| `docs/isdlc/constitution.md` | 367 lines | `rebuildSessionCache()` | Constitutional context |
| `.claude/hooks/config/iteration-requirements.json` | 781 lines | `rebuildSessionCache()` | Iteration enforcement rules |
| `.claude/hooks/config/artifact-paths.json` | 31 lines | `rebuildSessionCache()` | Artifact path mappings |
| `src/isdlc/config/workflows.json` | 383 lines | `rebuildSessionCache()` | Phase definitions |
| `src/claude/agents/` | 64 agent files | `rebuildSessionCache()` (persona files) | Agent personas |
| `src/claude/skills/analysis-topics/` | 6 topic files | `rebuildSessionCache()` (topic files) | Analysis topics |
| `external-skills-manifest.json` | varies | Referenced (not cached) | Skill registry |

---

## Relevant Modules

Based on discovery report and codebase analysis:

### Affected Systems

1. **Hook Runtime System**
   - File: `src/claude/hooks/lib/common.cjs`
   - Status: Will add `rebuildSkillCache()` function
   - Existing: Per-process config caching (line 15-38, REQ-0020 T6 optimization)
   - Integration: Leverage existing cache infrastructure

2. **Settings & Hook Registration**
   - File: `src/claude/settings.json`
   - Status: Will add SessionStart hook dispatcher registration
   - Impact: Extends hook system with new hook type
   - Complexity: Low — straightforward JSON addition

3. **Phase-Loop Controller**
   - File: `src/claude/commands/isdlc.md`
   - Status: STEP 3d will reference cached skills instead of file reads
   - Current: Lines 1716-1735 (external skill injection)
   - Change: Replace file-read logic with context lookup

4. **Installation & Initialization**
   - File: `lib/installer.js`
   - Status: Will trigger cache rebuild on init/update
   - Existing: `initState()`, `createIsdlcStructure()`
   - Integration: Add `rebuildSkillCache()` call after framework copy

5. **Skill Management Commands** (via delegated skills)
   - Status: Cache rebuild triggered on skill add/remove/wire
   - Pattern: Each skill management command calls `rebuildSkillCache()` before returning control

### Dependency Graph

```
rebuildSkillCache() (new)
├── Reads: external-skills-manifest.json
├── Reads: .claude/skills/external/{skill-files}
├── Reads: constitution.md
├── Reads: workflows.json
├── Reads: iteration-requirements.json
├── Reads: artifact-paths.json
├── Reads: agent persona files
├── Reads: topic files
└── Writes: .isdlc/session-cache.md (or skill-cache.md variant)

inject-skill-cache.cjs (new hook)
├── Reads: .isdlc/session-cache.md
└── Outputs: stdout (loaded to LLM context)

isdlc.md STEP 3d (modified)
├── References: session context (no file reads)
└── Depends on: inject-skill-cache.cjs pre-execution
```

---

## Notes for Requirements Analysis

The following questions may help clarify scope and design decisions:

1. **Cache Structure**: Should the cache file be unified (all framework content + skills in one file) or split (separate skill-cache.md and framework-cache.md)? Draft suggests unified approach.

2. **Cache Freshness**: What triggers cache invalidation? Draft proposes mtime-based comparison against manifest and source files. Should there be a TTL or manual invalidation command?

3. **Session Binding**: Does "SessionStart" mean:
   - At shell initialization (before any commands)?
   - At workflow init (when `/isdlc feature` or `/isdlc fix` starts)?
   - At each phase delegation?
   - Need clarification from requirements phase.

4. **Fallback Behavior**: Draft says "fail-open" if cache is missing. Should there be:
   - Warning logs on miss?
   - Cache auto-rebuild on miss?
   - Or silent skip?

5. **External Skills**: Current draft focuses on skill injection. Should `rebuildSessionCache()` also pre-load:
   - Agent persona files (64 files)?
   - Analysis topic files (6 files)?
   - Or keep those separate?

6. **Manifest Cleanup**: Feature description mentions cleanup of `path_lookup` and `skill_paths` from skills-manifest.json. Are these fields currently used by any hooks or just dead code?

7. **Backwards Compatibility**: If cache rebuild fails (corrupt manifest, missing files), should older workflows still work by falling back to per-phase file reads?

8. **Performance Target**: Goal is "~200+ static file reads per workflow" → 0 per-phase reads. Are there specific latency targets (e.g., <100ms per phase delegation)?

---

## Quick Scan Metadata

```json
{
  "scan_completed_at": "2026-02-23T19:45:00Z",
  "search_duration_ms": 28000,
  "keywords_searched": 15,
  "files_matched": 45,
  "scope_estimate": "medium",
  "file_count_estimate": 15,
  "new_files": 1,
  "modified_files": 4,
  "config_files": 6,
  "confidence_level": "high",
  "discovery_artifacts_used": true,
  "phase_gate": "GATE-00-QUICK-SCAN"
}
```

---

## Summary for Phase 01: Requirements

This feature has **medium scope** with **high confidence** in the estimate. Key areas for requirements clarification:

- **Scope**: 1 new hook + 4 core files + 6-8 trigger points = ~12-18 files total
- **Complexity**: Medium (leverages existing caching pattern from REQ-0020)
- **Risk**: Low (isolated to hook system, clear rollback path via file reads)
- **Dependencies**: Depends on REQ-0020 (T6 I/O optimization) already completed
- **Timeline**: Estimated 2-3 implementation days once requirements finalized

Proceed to Phase 01 for detailed requirements gathering.
