# Quick Scan: REQ-0038 External Manifest Source Field

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-02-24
**Coverage**: Full

---

## 1. Scope

**Classification**: Medium (6-15 files)
**Change Type**: Mixed (modifying existing behavior + new function)

The core change adds a `source` field to the external skills manifest schema and introduces a `reconcileSkillsBySource()` function in `common.cjs` that replaces the current delete-and-recreate approach with a smart merge strategy. The change touches runtime CJS code, two agent definition files, one command file, and existing tests.

---

## 2. Keywords

| Keyword | Hits | Key Files |
|---------|------|-----------|
| `writeExternalManifest` | 50 | `common.cjs`, `isdlc.md`, test files, prior REQ docs |
| `loadExternalManifest` | 50 | `common.cjs`, `isdlc.md`, test files, prior REQ docs |
| `removeSkillFromManifest` | 2 | `common.cjs` (definition + export) |
| `external-skills-manifest` | 76 | `common.cjs`, `discover-orchestrator.md`, `isdlc.md`, `install.sh`, test files |
| `rebuildSkillCache` | 6 | draft, backlog, prior REQ docs |
| `skill-cache` | 15 | draft, backlog, prior REQ docs, test files |
| `source.*discover` | 47 | `discover-orchestrator.md`, `skills-researcher.md`, `roundtable-analyst.md`, prior REQ docs |

---

## 3. File Count

| Type | Count | Files |
|------|-------|-------|
| Modify | 4 | `common.cjs`, `discover-orchestrator.md`, `skills-researcher.md`, `isdlc.md` |
| New | 0 | (no new files) |
| Test | 1 | `external-skill-management.test.cjs` (add new test cases) |
| Config | 0 | (manifest schema is implicit in code, not a separate config file) |
| Docs | 0 | (analysis artifacts only) |
| **Total** | **5** | |

**Confidence**: High -- well-understood codebase area with existing test coverage and prior REQ analysis (REQ-0022, REQ-0037).

---

## 4. Final Scope

**Medium** -- 5 files affected. The change is concentrated in `common.cjs` (new reconciliation function + schema handling) with ripple effects in two agent markdown files and one command file. Test file needs new cases but the test infrastructure is already in place. No new dependencies. No infrastructure changes.
