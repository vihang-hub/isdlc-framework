# Architecture Overview: BACKLOG.md Scaffolding

**REQ ID**: REQ-0014
**Phase**: 03-architecture
**Created**: 2026-02-14
**Status**: Approved

---

## 1. System Context

This feature adds BACKLOG.md file scaffolding to the existing installer flow. It introduces no new modules, dependencies, or architectural patterns. The change is a single additive code block within the `install()` function in `lib/installer.js`, following the identical pattern already used for CLAUDE.md creation.

### C4 Level 1 -- System Context

No change to the system context. The iSDLC CLI installer already creates project-root files (CLAUDE.md, docs/README.md, docs/isdlc/constitution.md). This feature adds one more: BACKLOG.md.

```
[Developer] --runs--> [isdlc init CLI]
                          |
                          +--> creates .claude/       (agents, skills, hooks)
                          +--> creates .isdlc/        (state, config, templates)
                          +--> creates docs/           (documentation scaffolding)
                          +--> creates CLAUDE.md       (project instructions)
                          +--> creates BACKLOG.md      (NEW -- project backlog)
```

### C4 Level 2 -- Container Diagram

No new containers. The change is entirely within the `lib/installer.js` module:

```
lib/installer.js
  install()
    |- Step 1: Detect project type
    |- Step 2: Check for monorepo
    |- Step 3: Claude Code detection
    |- Step 4: Copy framework files
    |- Step 5: Setup .isdlc directory
    |- Step 6: Setup docs
    |- Create CLAUDE.md (if missing)
    |- Create BACKLOG.md (if missing)   <-- NEW (insertion point)
    |- Step 7: Generate state
    |- Done!
```

## 2. Architecture Pattern

**Pattern**: Additive insertion into existing sequential installer flow.

No new architecture pattern is introduced. This feature replicates the established "create-if-missing" pattern used for CLAUDE.md (lines 557-569 of installer.js):

```javascript
// Existing pattern (CLAUDE.md):
const claudeMdPath = path.join(projectRoot, 'CLAUDE.md');
if (!(await exists(claudeMdPath))) {
  if (!dryRun) {
    // ... create file
  }
  logger.warning('CLAUDE.md was missing - created from template in project root');
}

// New pattern (BACKLOG.md) -- identical structure:
const backlogPath = path.join(projectRoot, 'BACKLOG.md');
if (!(await exists(backlogPath))) {
  if (!dryRun) {
    await writeFile(backlogPath, generateBacklogMd());
  }
  logger.success('Created BACKLOG.md');
} else {
  logger.info('BACKLOG.md already exists -- skipping');
}
```

## 3. Major Components

### 3.1 generateBacklogMd() -- New Helper Function

A pure function returning the BACKLOG.md template string. Follows the same pattern as `generateDocsReadme()` and `generateConstitution()` already in installer.js.

**Responsibilities:**
- Return a static markdown string with the correct format convention
- Include `## Open` and `## Completed` section headers
- Include a brief preamble explaining the file's purpose
- Match the format convention defined in CLAUDE.md.template

**No parameters, no side effects, no I/O.**

### 3.2 BACKLOG.md Creation Block -- New Code Block in install()

A 10-15 line code block inserted after the CLAUDE.md creation block (line 569) and before the "Done!" section (line 572).

**Responsibilities:**
- Check if BACKLOG.md already exists (FR-02: skip if exists)
- Respect --dry-run mode (FR-03: no file written)
- Call generateBacklogMd() for content
- Log appropriate messages (success on create, info on skip)

### 3.3 Uninstaller -- No Changes

The uninstaller already has zero references to BACKLOG.md (verified in impact analysis). BACKLOG.md is user data and must never be removed. This is the correct architectural decision: the installer creates scaffolding, but the uninstaller only removes framework-owned files.

**Preservation mechanism**: The uninstaller operates from an installed-files manifest. Since BACKLOG.md is not tracked in the manifest, it is automatically preserved. Even `--purge-all` only removes the `.isdlc/` directory, not project-root files.

## 4. Data Flow

```
install(projectRoot, { dryRun, force }) called
  |
  v
[After Step 6 and CLAUDE.md creation]
  |
  v
exists(projectRoot + '/BACKLOG.md') ----YES----> logger.info('already exists -- skipping')
  |                                                    |
  NO                                                   v
  |                                                 [continue to Step 7]
  v
dryRun? ----YES----> logger.success('Created BACKLOG.md') --> [continue to Step 7]
  |
  NO
  |
  v
writeFile(backlogPath, generateBacklogMd())
  |
  v
logger.success('Created BACKLOG.md')
  |
  v
[continue to Step 7]
```

## 5. Technology Stack

No new technologies. Uses only already-imported utilities:
- `exists()` from `lib/utils/fs-helpers.js`
- `writeFile()` from `lib/utils/fs-helpers.js`
- `logger` from `lib/utils/logger.js`
- `path.join()` from Node.js `path` module

## 6. Scalability and Performance

Not applicable. This is a one-time file creation during installation. The overhead is a single `stat()` call (exists check) plus optionally a single `writeFile()` call -- negligible.

## 7. Security Considerations

- **No secrets**: BACKLOG.md contains only static template text at creation time
- **No user input**: The file content is generated from a hardcoded template string
- **Path safety**: Uses `path.join(projectRoot, 'BACKLOG.md')` -- no directory traversal risk
- **Preservation**: BACKLOG.md becomes user data immediately after creation and is never touched by the framework again

## 8. Deployment Architecture

No deployment changes. The feature ships as part of the `lib/installer.js` module in the npm package.

## 9. Traceability

| Requirement | Architecture Component | Rationale |
|------------|----------------------|-----------|
| FR-01 (Create BACKLOG.md) | generateBacklogMd() + writeFile block | Follows established CLAUDE.md creation pattern |
| FR-02 (Skip if exists) | exists() check before write | Identical to CLAUDE.md skip-if-exists pattern |
| FR-03 (Respect dry-run) | `if (!dryRun)` guard | Identical to all other dry-run guards in installer |
| FR-04 (Uninstaller ignores) | No change to uninstaller | BACKLOG.md not in manifest, not in any removal path |
| NFR-01 (Format consistency) | generateBacklogMd() returns CLAUDE.md.template-compliant format | Template string matches documented convention |
| NFR-02 (Placement consistency) | Insertion after CLAUDE.md block | Same logical section for project-root file creation |
