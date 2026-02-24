# Impact Analysis: Custom Skill Management

**Generated**: 2026-02-18T13:00:00Z
**Feature**: Custom skill management -- add, wire, and inject user-provided skills into workflows (GH-14)
**Based On**: Phase 01 Requirements (finalized) -- requirements-spec.md v1.0.0
**Phase**: 02-impact-analysis

---

## Scope Comparison

| Aspect | Original (Phase 00) | Clarified (Phase 01) |
|--------|---------------------|----------------------|
| Description | "skill add/wire/inject" | Full skill lifecycle: add, wire, list, remove, re-wire, NL detection, smart binding, runtime injection |
| Keywords | skill, add, wire, inject | skill, add, wire, list, remove, re-wire, manifest, binding, injection, frontmatter, monorepo, delivery-type |
| Estimated Files | ~15 | 6 primary (2 new, 4 modified) + tests |
| Scope Change | - | EXPANDED (added listing, removal, re-wiring, NL intent detection, smart binding suggestions) |

---

## Executive Summary

This feature extends the iSDLC framework with a complete external skill management lifecycle. The blast radius is **medium** -- 4 existing files require modification (`isdlc.md`, `CLAUDE.md`, `common.cjs`, `skills-manifest.json`) and 2 new files must be created (`skill-manager.md`, `external-skills-manifest.json`). The highest risk area is `common.cjs` (3122 lines, imported by all 26 hooks) where 3 existing external-skill utility functions have zero test coverage. The runtime injection point in STEP 3d of `isdlc.md` is in the hot path of every workflow execution and must implement fail-open semantics per NFR-003 and Article X. Cross-validation confirms all findings are consistent across impact, entry-point, and risk analyses.

**Blast Radius**: MEDIUM (6 files, 4 modules)
**Risk Level**: MEDIUM
**Affected Files**: 6 (4 modified, 2 new)
**Affected Modules**: 4 (command layer, hook utilities, agent registry, project instructions)

---

## Impact Analysis

### Files Directly Affected

| # | File | Change Type | Lines | FR Coverage |
|---|------|-------------|-------|-------------|
| 1 | `src/claude/commands/isdlc.md` | MODIFY | 1407 | FR-001, FR-003, FR-005, FR-006, FR-007, FR-009 |
| 2 | `CLAUDE.md` | MODIFY | 252 | FR-008 |
| 3 | `src/claude/hooks/lib/common.cjs` | MODIFY | 3122 | FR-001, FR-002, FR-004, FR-005 |
| 4 | `src/claude/hooks/config/skills-manifest.json` | MODIFY | 1056 | Agent registry |
| 5 | `src/claude/agents/skill-manager.md` | CREATE | ~200 est. | FR-003, FR-009 |
| 6 | `docs/isdlc/external-skills-manifest.json` | CREATE | ~20 est. | FR-004 |

### Outward Dependencies (What Depends on Affected Files)

**common.cjs** (HIGHEST COUPLING):
- Imported by all 26 hook files in `src/claude/hooks/`
- Imported by 5 dispatcher files: `pre-task-dispatcher.cjs`, `pre-skill-dispatcher.cjs`, `post-task-dispatcher.cjs`, `post-bash-dispatcher.cjs`, `post-write-edit-dispatcher.cjs`
- Imported by standalone hooks: `branch-guard.cjs`, `state-file-guard.cjs`, `explore-readonly-enforcer.cjs`, `skill-delegation-enforcer.cjs`, `delegation-gate.cjs`
- Functions referenced by agent prompts (via delegation): `resolveExternalSkillsPath()`, `resolveExternalManifestPath()`, `loadExternalManifest()`

**isdlc.md** (MEDIUM COUPLING):
- Entry point for all `/isdlc` commands (feature, fix, upgrade, test, cancel, status)
- Referenced by CLAUDE.md intent detection (natural language routing)
- Phase-loop controller delegates to all phase agents via STEP 3d

**CLAUDE.md** (MEDIUM COUPLING):
- Loaded as project instructions for every Claude Code session
- Intent detection table affects all natural language routing

**skills-manifest.json** (LOW COUPLING):
- Read by `skill-validator.cjs` (13 tests), `log-skill-usage.cjs` (13 tests), `skill-delegation-enforcer.cjs` (11 tests)
- Cached via `_loadConfigWithCache()` in common.cjs

### Inward Dependencies (What Affected Files Depend On)

**common.cjs**:
- Node.js built-ins: `fs`, `path` (no external packages)
- No runtime dependencies on other iSDLC files

**isdlc.md**:
- References common.cjs functions via agent delegation prompts (not direct import)
- References skills-manifest.json for skill index blocks
- References state.json for workflow state
- References workflows.json for workflow definitions

**skills-manifest.json**:
- Static config file, no dependencies
- Schema is self-contained JSON

### Change Propagation Paths

1. **common.cjs new exports** -> All hooks that `require('./lib/common.cjs')` get new functions available. No breaking change since existing exports unchanged. Additive only.
2. **isdlc.md new action branch** -> New `skill` action parallel to existing `feature`, `fix`, `upgrade`, `test`, `cancel`, `status`. No existing action modified.
3. **isdlc.md STEP 3d injection** -> Inserted between prompt construction and Task tool invocation. Fail-open design means injection errors do not propagate to phase delegation.
4. **CLAUDE.md new intent row** -> Additive table row. Existing intent patterns unchanged.
5. **skills-manifest.json new agent entry** -> New `skill-manager` ownership block parallel to existing agents. No existing entries modified.

---

## Entry Points

### Existing Entry Points (Reused)

| Entry Point | Location | FR |
|-------------|----------|-----|
| `/isdlc` command dispatcher | `isdlc.md` line 5 | FR-001, FR-003, FR-006, FR-007 |
| Intent detection table | `CLAUDE.md` line 17-24 | FR-008 |
| `resolveExternalSkillsPath()` | `common.cjs` line 424 | FR-001, FR-005 |
| `resolveExternalManifestPath()` | `common.cjs` line 446 | FR-004, FR-005 |
| `loadExternalManifest()` | `common.cjs` line 685 | FR-005, FR-006 |

### New Entry Points (To Be Created)

| Entry Point | Location | FR | Description |
|-------------|----------|-----|-------------|
| `skill add <path>` action | `isdlc.md` (new section) | FR-001 | Validates and copies skill file to external skills directory |
| `skill wire <name>` action | `isdlc.md` (new section) | FR-003, FR-009 | Delegates to skill-manager agent for interactive wiring |
| `skill list` action | `isdlc.md` (new section) | FR-006 | Lists registered skills with bindings |
| `skill remove <name>` action | `isdlc.md` (new section) | FR-007 | Removes skill from manifest, optionally deletes file |
| Skill injection block | `isdlc.md` STEP 3d (after prompt, before Task) | FR-005 | Reads manifest, matches phase, injects content |
| `validateSkillFrontmatter()` | `common.cjs` (new function) | FR-001 | Validates `.md` file has required YAML frontmatter fields |
| `analyzeSkillContent()` | `common.cjs` (new function) | FR-002 | Scans skill body for phase-indicative keywords |
| `suggestBindings()` | `common.cjs` (new function) | FR-002 | Returns binding suggestions with confidence levels |
| `writeExternalManifest()` | `common.cjs` (new function) | FR-004 | Writes/updates manifest JSON with new skill entry |
| `formatSkillInjectionBlock()` | `common.cjs` (new function) | FR-005 | Formats skill content based on delivery type |
| `removeSkillFromManifest()` | `common.cjs` (new function) | FR-007 | Removes skill entry from manifest by name |
| `skill-manager.md` agent | `src/claude/agents/skill-manager.md` (new file) | FR-003, FR-009 | Interactive wiring session agent |
| Skill management intent patterns | `CLAUDE.md` intent table (new row) | FR-008 | NL patterns for add/wire/list/remove |

### Implementation Chain (Recommended Order)

| Order | Component | Rationale |
|-------|-----------|-----------|
| 1 | `common.cjs` -- new utility functions | Foundation layer. All other components depend on these utilities. |
| 2 | `external-skills-manifest.json` schema | Data layer. Define the schema that utilities read/write. |
| 3 | `skill-manager.md` agent | Agent layer. Self-contained agent file, no dependencies on isdlc.md changes. |
| 4 | `isdlc.md` -- skill action handlers | Command layer. Uses utilities from step 1, delegates to agent from step 3. |
| 5 | `isdlc.md` -- STEP 3d injection | Integration layer. Uses `loadExternalManifest()` and `formatSkillInjectionBlock()`. |
| 6 | `CLAUDE.md` -- intent detection | UX layer. Routes natural language to commands from step 4. |
| 7 | `skills-manifest.json` -- register agent | Registry layer. Registers skill-manager agent created in step 3. |

---

## Risk Assessment

### Test Coverage Analysis

| File | Existing Tests | Test File | Coverage of Affected Area |
|------|---------------|-----------|--------------------------|
| `common.cjs` | 61 tests (common.test.cjs, 142 lines) | `src/claude/hooks/tests/common.test.cjs` | **0%** -- no tests for `resolveExternalSkillsPath()`, `resolveExternalManifestPath()`, `loadExternalManifest()` |
| `isdlc.md` | 0 tests (command file) | None | **0%** -- markdown command, tested via integration only |
| `CLAUDE.md` | 0 tests (instructions) | None | N/A -- not testable |
| `skills-manifest.json` | 13 tests (skill-validator.test.cjs) | `src/claude/hooks/tests/skill-validator.test.cjs` | **HIGH** -- schema validation tested, but new agent entry not yet covered |
| `skill-manager.md` | 0 (new file) | None | **0%** -- needs integration tests |
| `external-skills-manifest.json` | 0 (new file) | None | **0%** -- needs validation tests |

### Complexity Hotspots

| File | Lines | Complexity | Risk |
|------|-------|-----------|------|
| `common.cjs` | 3122 | HIGH -- 100+ exported functions, per-process caching, monorepo routing | Adding 6+ new functions increases surface area. Must not break existing exports. |
| `isdlc.md` | 1407 | HIGH -- complex multi-step workflow orchestration, 15+ action handlers | Adding 4 new action handlers and injection logic into the hot path. |
| `skills-manifest.json` | 1056 | LOW -- static JSON, well-structured | Additive change only. |
| `CLAUDE.md` | 252 | LOW -- simple markdown table | Additive row only. |

### Technical Debt Markers

1. `loadExternalManifest()` (line 694-695): Returns null on parse error with **no logging**. Should log warning for debugging.
2. `resolveExternalManifestPath()`: Dual legacy/new path resolution but no migration utility. Both paths must be tested.
3. Zero test coverage for all 3 existing external skill functions -- testing gap predates this feature.
4. `isdlc.md` has no unit test suite -- only tested via full integration runs.

### Risk Zones (Intersection of High Coupling + Low Coverage)

| Zone | Files | Risk Level | Mitigation |
|------|-------|-----------|------------|
| External skill utilities | `common.cjs` lines 424-697 | **HIGH** | Add unit tests for existing functions BEFORE adding new ones |
| STEP 3d injection path | `isdlc.md` STEP 3d | **MEDIUM** | Implement strict fail-open: any injection error must not propagate to Task delegation |
| Frontmatter parsing | New `validateSkillFrontmatter()` | **MEDIUM** | Test edge cases: missing fields, malformed YAML, encoding issues, empty files |
| Manifest write operations | New `writeExternalManifest()` | **MEDIUM** | Test concurrent writes, JSON validity after write, atomic write pattern |

### Risk Recommendations Per FR

| FR | Risk | Recommendation |
|----|------|----------------|
| FR-001 (Skill Acquisition) | MEDIUM | Test frontmatter validation edge cases; test file copy to both single/monorepo paths |
| FR-002 (Smart Binding) | LOW | Keyword matching is self-contained; test with various skill content patterns |
| FR-003 (Wiring Session) | MEDIUM | skill-manager agent is new; test delegation and menu flow |
| FR-004 (Manifest Registration) | MEDIUM | Test create-if-not-exists, update-in-place, JSON validity after write |
| FR-005 (Runtime Injection) | **HIGH** | Hot path of all workflows; must be fail-open; test with missing files, malformed manifest, large files, empty manifest |
| FR-006 (Skill Listing) | LOW | Read-only operation on manifest |
| FR-007 (Skill Removal) | MEDIUM | Test manifest update + optional file deletion; test "not found" case |
| FR-008 (NL Intent) | LOW | Additive table row, no existing patterns affected |
| FR-009 (Re-wiring) | LOW | Reuses FR-003 wiring session with pre-filled data |

---

## Cross-Validation

### File List Consistency (M1 vs M2)

M1 identifies 6 files (4 modified, 2 new). M2 confirms all 6 files plus 13 new entry points within those files. **CONSISTENT** -- no files identified by M2 that M1 missed, and vice versa.

### Risk-Coupling Alignment (M1 coupling vs M3 risk)

| File | M1 Coupling | M3 Risk | Alignment |
|------|------------|---------|-----------|
| `common.cjs` | HIGHEST (26 hooks depend) | HIGH (0% coverage on affected area) | CONSISTENT |
| `isdlc.md` | MEDIUM (all workflows use) | MEDIUM (no unit tests, hot path injection) | CONSISTENT |
| `CLAUDE.md` | MEDIUM (all sessions) | LOW (additive change) | CONSISTENT -- coupling is high but change risk is low |
| `skills-manifest.json` | LOW (3 validators) | LOW (additive schema) | CONSISTENT |
| `skill-manager.md` | N/A (new) | MEDIUM (new agent needs testing) | N/A |
| `external-skills-manifest.json` | N/A (new) | LOW (runtime created) | N/A |

### Completeness Check

- All 9 FRs mapped to at least one file: YES
- All 6 NFRs have corresponding risk entries: YES
- All 5 constraints acknowledged in analysis: YES
- Implementation order covers all entry points: YES

### Verification Status: **PASS**

No discrepancies found. All three analyses are internally consistent and complete.

---

## Implementation Recommendations

Based on the impact analysis:

1. **Suggested Order**: common.cjs utilities -> manifest schema -> skill-manager agent -> isdlc.md action handlers -> isdlc.md STEP 3d injection -> CLAUDE.md intent detection -> skills-manifest.json registration
2. **High-Risk Areas**: Add tests for `resolveExternalSkillsPath()`, `resolveExternalManifestPath()`, `loadExternalManifest()` BEFORE modifying common.cjs. Test STEP 3d injection with fail-open scenarios.
3. **Dependencies to Resolve**: common.cjs utility functions must be implemented first (all other components depend on them). The skill-manager agent and isdlc.md action handlers can be developed in parallel once utilities are ready.
4. **Key Design Decision**: The injection in STEP 3d must be strictly fail-open. Use try/catch around the entire injection block. If any step fails (manifest read, file read, format), log a warning and continue with the unmodified delegation prompt.

---

## Impact Analysis Metadata

The following JSON block is required for automated sizing analysis (REQ-0011).
All fields are required. The `parseSizingFromImpactAnalysis()` function reads
the LAST JSON block in the file to extract sizing metrics.

```json
{
  "analysis_completed_at": "2026-02-18T13:00:00Z",
  "sub_agents": ["M1", "M2", "M3", "M4"],
  "verification_status": "PASS",
  "requirements_document": "docs/requirements/REQ-0022-custom-skill-management/requirements-spec.md",
  "quick_scan_used": "none",
  "scope_change_from_original": "expanded",
  "requirements_keywords": ["skill", "add", "wire", "list", "remove", "re-wire", "manifest", "binding", "injection", "frontmatter", "monorepo", "delivery-type"],
  "files_directly_affected": 6,
  "modules_affected": 4,
  "risk_level": "medium",
  "blast_radius": "medium",
  "coverage_gaps": 3
}
```
