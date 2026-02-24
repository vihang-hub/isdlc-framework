# Requirements Specification: BACKLOG.md Scaffolding in Installer

**REQ ID**: REQ-0014
**Feature**: Add BACKLOG.md scaffolding to installer
**Created**: 2026-02-14
**Status**: Approved

---

## 1. Overview

During `isdlc init`, the installer should create an empty `BACKLOG.md` file at the project root with the expected section headers matching the format convention defined in `CLAUDE.md.template`. The uninstaller must NOT touch `BACKLOG.md` because it contains user data.

## 2. Functional Requirements

### FR-01: Create BACKLOG.md during installation

**Description**: When the installer runs (`isdlc init`), it MUST create a `BACKLOG.md` file at the project root with the correct section headers and format preamble.

**Acceptance Criteria**:
- AC-01: `BACKLOG.md` is created at `{projectRoot}/BACKLOG.md` during installation
- AC-02: The file contains a `## Open` section header
- AC-03: The file contains a `## Completed` section header
- AC-04: The file includes a brief preamble explaining its purpose (consistent with existing BACKLOG.md in this project)
- AC-05: The `## Open` section appears before the `## Completed` section

### FR-02: Skip creation if BACKLOG.md already exists

**Description**: If `BACKLOG.md` already exists at the project root, the installer MUST NOT overwrite it.

**Acceptance Criteria**:
- AC-06: If `BACKLOG.md` already exists, the installer skips creation
- AC-07: A log message is emitted when skipping (e.g., "BACKLOG.md already exists -- skipping")

### FR-03: Respect dry-run mode

**Description**: When the installer runs with `--dry-run`, `BACKLOG.md` MUST NOT be created on disk.

**Acceptance Criteria**:
- AC-08: In dry-run mode, no `BACKLOG.md` file is written
- AC-09: The success log message is still emitted (consistent with other dry-run behavior in installer)

### FR-04: Uninstaller must NOT remove BACKLOG.md

**Description**: The uninstaller MUST NOT delete, modify, or reference `BACKLOG.md` in any removal path. It is user data.

**Acceptance Criteria**:
- AC-10: `BACKLOG.md` is not listed in any uninstaller removal path (manifest, pattern, or explicit)
- AC-11: After uninstall (including `--purge-all`), `BACKLOG.md` remains untouched at the project root
- AC-12: The uninstaller does not reference `BACKLOG.md` in any code path

## 3. Non-Functional Requirements

### NFR-01: Format consistency

The generated `BACKLOG.md` content MUST match the format convention documented in `CLAUDE.md.template` (section "Backlog Management > BACKLOG.md Format Convention"). Specifically:
- Section headers use `## Open` and `## Completed` (not `## Open Items`)
- Item line format: `- {N.N} [{status}] {Title} -- {Description}`

### NFR-02: Placement consistency

The `BACKLOG.md` creation MUST happen at the same logical point in the installer as `CLAUDE.md` creation (after Step 6/docs setup, before Step 7/state generation), following the existing pattern for project-root file creation.

## 4. Out of Scope

- Populating BACKLOG.md with any initial items
- Jira/Confluence integration (already handled separately)
- Modifying the uninstaller to explicitly preserve it (it already does not touch it)

## 5. Files Impacted

| File | Change Type | Description |
|------|------------|-------------|
| `lib/installer.js` | Modified | Add BACKLOG.md creation logic after CLAUDE.md creation |
| `src/claude/CLAUDE.md.template` | None | Reference only -- format convention source of truth |
| `lib/uninstaller.js` | Verified | Confirm no BACKLOG.md references exist (should be clean) |
| `lib/installer.test.js` | Modified | Add tests for BACKLOG.md creation, skip-if-exists, dry-run |

## 6. Traceability

| Requirement | User Story | Test Case |
|------------|-----------|-----------|
| FR-01 (AC-01 to AC-05) | US-01 | TC-01 to TC-05 |
| FR-02 (AC-06 to AC-07) | US-02 | TC-06 to TC-07 |
| FR-03 (AC-08 to AC-09) | US-03 | TC-08 to TC-09 |
| FR-04 (AC-10 to AC-12) | US-04 | TC-10 to TC-12 |
