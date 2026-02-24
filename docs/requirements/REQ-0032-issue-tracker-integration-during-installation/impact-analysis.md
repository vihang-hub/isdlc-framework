# Impact Analysis: REQ-0032 Issue Tracker Integration During Installation

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-02-22
**Coverage**: 100%

---

## 1. Blast Radius

### Tier 1: Direct Modifications

| # | File | Module | Change Type | Requirement Traces |
|---|------|--------|-------------|-------------------|
| 1 | `lib/installer.js` | Installer | Modify | FR-001, FR-002, FR-003, FR-004, FR-007 |
| 2 | `src/claude/CLAUDE.md.template` | CLAUDE.md template | Modify | FR-004 |
| 3 | `src/claude/commands/isdlc.md` | Command definition | Modify | FR-005 |
| 4 | `src/claude/hooks/lib/three-verb-utils.cjs` | Source detection | Modify | FR-005 |
| 5 | `lib/installer.test.js` | Installer tests | Modify | FR-001, FR-002, FR-003, FR-007 |

### Tier 2: Transitive Impact

| # | File | Module | Impact Description | Change Type Needed |
|---|------|--------|-------------------|-------------------|
| 1 | `lib/updater.js` | Updater | Must preserve the new CLAUDE.md section during updates | Modify (add section preservation logic) |
| 2 | `lib/updater.test.js` | Updater tests | Test cases for section preservation | Modify |
| 3 | `.claude/CLAUDE.md.template` | Runtime copy | Sync from `src/claude/CLAUDE.md.template` | Sync (copy) |
| 4 | `lib/cli.js` | CLI entry | May need to pass `issueTrackerMode` option through | Review (likely no change -- installer reads internally) |

### Tier 3: Side Effects

| # | Area | Potential Impact | Risk Level |
|---|------|-----------------|------------|
| 1 | Existing installations (CLAUDE.md) | Missing the new section; `detectSource()` falls back | Low |
| 2 | Monorepo installer flow | Issue tracker preference is project-wide, not per-project | Low |
| 3 | `src/claude/agents/00-sdlc-orchestrator.md` | MCP Prerequisite Check section already exists; may need alignment | Low |
| 4 | `src/claude/agents/01-requirements-analyst.md` | References Jira integration; no code change needed | None |

### Blast Radius Summary

| Metric | Count |
|--------|-------|
| Direct modifications | 5 |
| New files | 0 |
| Restructured files | 0 |
| Transitive modifications | 2-4 |
| **Total affected** | **7-9** |

---

## 2. Entry Points

### Recommended Starting Point: `lib/installer.js`

**Rationale**: The installer is the origin of the issue tracker selection. It follows an established pattern (provider selection) that can be replicated for the new prompt. All downstream changes (CLAUDE.md template, detectSource, updater) depend on the installer producing the preference value.

### Secondary Entry Point: `src/claude/CLAUDE.md.template`

**Rationale**: The template change is a prerequisite for the installer's interpolation logic. It should be done early so the installer can reference the template's section structure.

---

## 3. Implementation Order

| Order | Step | FRs | Description | Risk | Parallel? | Depends On |
|-------|------|-----|-------------|------|-----------|------------|
| 1 | Template section | FR-004 | Add `## Issue Tracker Configuration` section to CLAUDE.md.template | Low | Yes | -- |
| 2 | Installer prompt | FR-001 | Add `select()` prompt in `lib/installer.js` after provider selection | Low | Yes (with step 1) | -- |
| 3 | GitHub validation | FR-002 | Add `gh --version` check in installer | Low | No | Step 2 |
| 4 | Jira MCP validation | FR-003 | Add `claude mcp list` check + guided setup in installer | Medium | No | Step 2 |
| 5 | Template interpolation | FR-004 | Wire installer to interpolate values into CLAUDE.md | Low | No | Steps 1, 2, 3, 4 |
| 6 | detectSource enhancement | FR-005 | Add optional `options` parameter to `detectSource()` | Low | Yes (with steps 3-4) | Step 1 (needs format) |
| 7 | Command routing | FR-005 | Update `isdlc.md` add/analyze sections to pass preference | Low | No | Step 6 |
| 8 | Updater preservation | FR-006 | Add section preservation to `lib/updater.js` | Low | Yes (with steps 3-7) | Step 1 (needs section name) |
| 9 | Tests | FR-001-007 | Add test cases for installer prompt, validation, and detectSource | Low | No | Steps 2-8 |
| 10 | Dry run | FR-007 | Verify dry-run behavior (likely works by default) | Low | No | Step 2 |

---

## 4. Risk Zones

| ID | Risk | Area | Likelihood | Impact | Mitigation |
|----|------|------|-----------|--------|------------|
| RZ-001 | `claude mcp list` command format varies or is unavailable | `lib/installer.js` (Jira validation) | Medium | Medium | Use try/catch; parse output case-insensitively; fail-open to manual mode |
| RZ-002 | CLAUDE.md template interpolation breaks existing content | `lib/installer.js` (CLAUDE.md write) | Low | High | Use placeholder tokens (`{{ISSUE_TRACKER}}`) and string replacement; test with multiple template states |
| RZ-003 | `detectSource()` backward compatibility break | `three-verb-utils.cjs` | Low | High | Optional parameter with default; all existing callers pass no options; comprehensive test coverage |
| RZ-004 | Updater overwrites user's tracker preference | `lib/updater.js` | Medium | High | Add explicit section preservation (like existing user artifact preservation pattern) |
| RZ-005 | Monorepo: preference is global but projects may use different trackers | `lib/installer.js`, monorepo flow | Low | Low | Document as out-of-scope for v1; per-project tracker is a future enhancement |

### Test Coverage in Affected Areas

| Area | Current Coverage | Gap |
|------|-----------------|-----|
| `lib/installer.js` | 30 tests | No tests for issue tracker prompt (new code) |
| `lib/installer.test.js` | Covers provider selection flow | Need to replicate pattern for tracker selection |
| `three-verb-utils.cjs` `detectSource` | Full coverage (3 source types) | No tests for optional `options` parameter |
| `lib/updater.js` | 22 tests | No tests for section preservation of the new section |

### Overall Risk Assessment

- **Overall risk level**: Low-Medium
- **Key concern**: Jira MCP detection reliability (RZ-001) is the only area of genuine uncertainty. All other changes follow established patterns.
- **Go/no-go**: GO. The feature has clear boundaries, follows existing patterns, and all risks have actionable mitigations.

---

## 5. Summary

### Executive Summary

REQ-0032 adds an issue tracker selection step to `isdlc init` that persists the preference in CLAUDE.md. The blast radius is 5 direct files and 2-4 transitive files. No new files are created. The implementation follows the existing provider selection pattern in the installer (same prompt utilities, same flow position). Risk is Low-Medium with the primary concern being MCP detection reliability, mitigated by fail-open design.

### Decision Log

| Decision | Rationale |
|----------|-----------|
| Store preference in CLAUDE.md (not state.json) | CLAUDE.md is read by all agents automatically; state.json requires hook-based access. Preference is a project-wide config, not workflow state. |
| Use `select()` prompt (not `confirm()`) | Three options (GitHub, Jira, Manual) require a multi-choice prompt |
| `detectSource()` optional parameter (not global state) | Backward compatible; testable in isolation; no shared mutable state |
| Fail-open for MCP detection | Article X: Fail-Safe Defaults. Installation must complete even if MCP is unavailable. |
| Template interpolation (not regex injection) | Simpler, less error-prone than injecting into arbitrary CLAUDE.md content |

### Implementation Recommendations

1. Start with CLAUDE.md template and installer prompt (parallel, low risk)
2. Complete Jira MCP validation (highest complexity step)
3. Wire detectSource enhancement
4. Add tests throughout (not just at the end)
5. Updater preservation can be done in parallel with steps 2-3
