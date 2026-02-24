# Infrastructure Design: Custom Skill Management (REQ-0022)

**Version**: 1.0
**Created**: 2026-02-18
**Phase**: 03-architecture
**Status**: Accepted
**Traces to**: NFR-001, NFR-004, CON-002, CON-004

---

## 1. Overview

The custom skill management feature requires no cloud infrastructure, no new services, and no deployment changes. All components are local filesystem artifacts (markdown files, JSON configuration) that are part of the iSDLC framework installation. This document describes the file layout, environment strategy, and monorepo path architecture.

---

## 2. File Layout

### 2.1 Single-Project Mode

```
project-root/
  .claude/
    skills/
      external/                    <-- NEW: Skill .md files copied here
        nestjs-conventions.md
        company-coding-standards.md
    agents/
      skill-manager.md             <-- NEW: Synced from src/
    commands/
      isdlc.md                     <-- MODIFIED: New action branches + injection
  docs/
    isdlc/
      external-skills-manifest.json  <-- NEW: Created on first skill add
  src/
    claude/
      agents/
        skill-manager.md           <-- NEW: Source of truth
      commands/
        isdlc.md                   <-- MODIFIED: Source of truth
      hooks/
        lib/
          common.cjs               <-- MODIFIED: New utility functions
        config/
          skills-manifest.json     <-- MODIFIED: New agent entry
  CLAUDE.md                        <-- MODIFIED: New intent row
```

### 2.2 Monorepo Mode

```
project-root/
  .isdlc/
    projects/
      {project-id}/
        skills/
          external/                <-- NEW: Project-scoped skill files
            nestjs-conventions.md
        state.json
  docs/
    isdlc/
      projects/
        {project-id}/
          external-skills-manifest.json  <-- NEW: Project-scoped manifest
  src/
    claude/
      (same structure as single-project)
```

### 2.3 Path Resolution

All paths are resolved by existing functions in `common.cjs`:

| Path | Function | Single-Project | Monorepo |
|------|----------|----------------|----------|
| Skill files directory | `resolveExternalSkillsPath(projectId)` | `.claude/skills/external/` | `.isdlc/projects/{id}/skills/external/` |
| Manifest file | `resolveExternalManifestPath(projectId)` | `docs/isdlc/external-skills-manifest.json` | `docs/isdlc/projects/{id}/external-skills-manifest.json` |

These functions already handle the legacy fallback paths (`.isdlc/external-skills-manifest.json`). No changes to path resolution logic are needed (CON-002).

---

## 3. Environment Strategy

The iSDLC framework is a local development tool. There are no dev/staging/production environments in the traditional sense. However, there are three contexts:

| Context | Description | Skill Management Behavior |
|---------|-------------|--------------------------|
| **Development** (dogfooding) | The iSDLC project itself, developing this feature | Skills are registered in `.claude/skills/external/` of the iSDLC repo |
| **User project** | A project that has `isdlc init` installed | Skills are registered in the project's own `.claude/skills/external/` |
| **Test environment** | CJS tests in `src/claude/hooks/tests/` | Tests create temp directories, mock skill files and manifests |

### Test Environment Details

Tests for the new utility functions will:
1. Create temporary directories (using existing `setupTestEnv()` from `hook-test-utils.cjs`)
2. Write mock skill `.md` files with valid/invalid frontmatter
3. Write mock `external-skills-manifest.json` with various entry configurations
4. Call utility functions and assert correct behavior
5. Clean up temp directories after tests

---

## 4. Compute Resources

**None required.** All skill management operations are:
- File reads (manifest, skill files): <1ms per file
- File writes (manifest, skill copy): <5ms per operation
- String operations (frontmatter parsing, keyword analysis, content formatting): <1ms
- Total injection overhead target: <100ms (NFR-001)

---

## 5. Networking Architecture

**None.** All operations are local filesystem I/O. No network connections are made during skill add, wire, list, remove, or injection.

---

## 6. Storage

| Storage Item | Size | Growth Rate | Retention |
|-------------|------|-------------|-----------|
| Skill `.md` files | 1-10KB each | User adds ~5 per project | Indefinite (until user removes) |
| `external-skills-manifest.json` | 0.5-15KB | Grows with skill count | Indefinite |
| Total per project | 10-150KB | Negligible | Indefinite |

---

## 7. Monitoring and Logging

### 7.1 Injection Logging

During STEP 3d injection, log events to stderr (consistent with hook logging convention):

| Event | Level | Message |
|-------|-------|---------|
| Injection start | Debug | `"External skill injection: checking manifest"` |
| No manifest | Debug | `"External skill injection: no manifest found, skipping"` |
| Skills matched | Info | `"External skill injection: {N} skills matched for phase {phase}"` |
| Skill file missing | Warning | `"External skill injection: file not found for '{name}', skipping"` |
| Skill truncated | Warning | `"External skill injection: '{name}' truncated to 10000 chars, switched to reference delivery"` |
| Injection complete | Debug | `"External skill injection: {N} blocks appended to delegation prompt"` |
| Injection error | Warning | `"External skill injection failed: {error}. Continuing without skill injection."` |

### 7.2 Skill Usage Logging

After successful injection, append to the existing `skill_usage_log` in state.json:

```json
{
  "agent": "software-developer",
  "skill_id": "EXT:nestjs-conventions",
  "phase": "06-implementation",
  "timestamp": "2026-02-18T12:00:00Z",
  "observed": true,
  "cross_phase_usage": false,
  "external_skill": true
}
```

The `EXT:` prefix distinguishes external skills from built-in skills in the usage log.

---

## 8. Disaster Recovery

| Scenario | Recovery |
|----------|----------|
| Manifest deleted | Re-add skills with `skill add`. No data loss beyond binding configuration. |
| Manifest corrupted | `loadExternalManifest()` returns null. Injection is skipped (fail-open). Delete manifest and re-add. |
| Skill file deleted | Injection skips missing files. Re-add skill file to restore injection. |
| External skills directory deleted | Framework creates directory on next `skill add`. Existing manifest entries point to missing files (skipped at injection time). |
| All files deleted | Start fresh. No state corruption possible. |

---

## 9. Runtime Sync

The src/claude -> .claude sync mechanism (existing) must handle:

1. **New file**: `src/claude/agents/skill-manager.md` -> `.claude/agents/skill-manager.md`
2. **Modified files**: `src/claude/commands/isdlc.md`, `src/claude/hooks/lib/common.cjs`, `src/claude/hooks/config/skills-manifest.json` -> respective `.claude/` targets

This sync is performed manually during development (dogfooding) and automatically during `isdlc init` / `isdlc update` for user projects.

### Updater Preservation

The iSDLC updater must preserve:
- `.claude/skills/external/` (user-authored skill files)
- `docs/isdlc/external-skills-manifest.json` (user-configured bindings)

These should be added to the updater's preservation list (same category as state.json, constitution.md, CLAUDE.md).
