# Impact Analysis: Wire Search Abstraction Layer into Setup Pipeline

**Status**: Draft
**Confidence**: High
**Last Updated**: 2026-03-03
**Coverage**: Blast Radius (high), Entry Points (high), Risk Assessment (high)

---

## Executive Summary

This requirement wires existing, tested `lib/search/` modules into the framework's runtime. The blast radius is moderate: the primary integration point is `lib/installer.js` (adding one new step), `lib/cli.js` (adding one flag), and 6 agent markdown files (adding new sections). No existing code is modified -- all changes are additive. The risk is low because the search modules are already implemented and tested; this requirement only calls them from the setup pipeline and references them from agent instructions.

**Blast Radius**: Medium (7 code files modified, 6 agent markdown files updated)
**Risk Level**: Low
**Affected Files**: ~13 files
**Affected Modules**: 3 (installer pipeline, CLI, agent instructions)

---

## Scope Comparison

| Aspect | Draft (GH-95) | Refined |
|--------|---------------|---------|
| Description | Wire search layer into setup + migrate agents | Wire into init pipeline + migrate 6 high-impact agents |
| Scope Change | - | Focused (init only, not /discover) |

---

## Impact Analysis

### Tier 1: Directly Modified Files

| File | Change Type | Complexity | Lines Changed (est.) |
|------|-------------|------------|---------------------|
| `lib/installer.js` | Add step 8 | Medium | ~80 lines (new function + call site) |
| `lib/cli.js` | Add flag parsing | Low | ~5 lines |
| `src/claude/agents/quick-scan/quick-scan-agent.md` | Add section | Low | ~30 lines (new Enhanced Search section) |
| `src/claude/agents/impact-analysis/impact-analyzer.md` | Add section | Low | ~20 lines |
| `src/claude/agents/impact-analysis/entry-point-finder.md` | Add section | Low | ~20 lines |
| `src/claude/agents/impact-analysis/risk-assessor.md` | Add section | Low | ~20 lines |
| `src/claude/agents/discover/architecture-analyzer.md` | Add section | Low | ~20 lines |
| `src/claude/agents/discover/feature-mapper.md` | Add section | Low | ~20 lines |

### Tier 2: Transitively Affected Files

| File | Reason | Impact |
|------|--------|--------|
| `lib/search/detection.js` | Called by new installer step | No changes needed (already implemented) |
| `lib/search/install.js` | Called by new installer step | No changes needed |
| `lib/search/config.js` | Called by new installer step | No changes needed |
| `.claude/settings.json` | Written to by `configureMcpServers()` | mcpServers section may gain entries |
| `.isdlc/search-config.json` | Written by `writeSearchConfig()` | New file created during setup |

### Tier 3: Side Effects

| Effect | Description | Risk |
|--------|-------------|------|
| Installer step count changes | Step labels change from N/7 to N/8 | Low -- cosmetic only |
| MCP servers added to settings | `.claude/settings.json` gains entries | Low -- preserves existing entries |
| New config file | `.isdlc/search-config.json` created | Low -- gitignored like state.json |
| Agent behavior guidance changes | Agents may use different search patterns | Low -- Grep/Glob fallback preserved |

---

## Entry Points

### EP-01: `lib/installer.js` install() function
- **Type**: Existing function, additive modification
- **Change**: Add call to new `setupSearchCapabilities()` function after step 7
- **Chain**: install() -> setupSearchCapabilities() -> detectSearchCapabilities() -> installTool() -> configureMcpServers() -> writeSearchConfig()

### EP-02: `lib/cli.js` parseArgs() function
- **Type**: Existing function, additive modification
- **Change**: Add `--no-search-setup` flag detection in options parsing
- **Chain**: parseArgs() -> options.noSearchSetup -> passed to install()

### EP-03: Agent markdown files (6 files)
- **Type**: Existing markdown, additive sections
- **Change**: New "Enhanced Search" or "Search Abstraction" sections added to each agent
- **Pattern**: New section after existing process steps, describing search abstraction usage

### Recommended Implementation Order

1. `lib/cli.js` -- add flag parsing (smallest change, enables testing)
2. `lib/installer.js` -- add step 8 function and call site (core integration)
3. `quick-scan-agent.md` -- reference migration (highest-impact agent)
4. `impact-analyzer.md`, `entry-point-finder.md`, `risk-assessor.md` -- impact analysis agents
5. `architecture-analyzer.md`, `feature-mapper.md` -- discovery agents (Could Have)

---

## Risk Assessment

### Risk Zones

| Zone | Files | Risk Level | Rationale |
|------|-------|------------|-----------|
| Installer pipeline | `lib/installer.js` | Low | Additive step only; existing steps untouched; entire step wrapped in try-catch |
| CLI flag parsing | `lib/cli.js` | Very Low | Single flag addition to existing parsing logic |
| Agent markdown | 6 .md files | Low | New sections only; frontmatter untouched; no behavioral changes to hook parsing |
| MCP configuration | `.claude/settings.json` | Low | `configureMcpServers()` already handles merge-not-overwrite |

### Coverage Gaps

- `lib/installer.js` install() function: No unit tests (integration-level function). Step 8 should be a separate extractable function to enable unit testing.
- Agent markdown changes: Validated by prompt-verification tests, not unit tests.

### Recommendations

1. Extract step 8 as a standalone `setupSearchCapabilities(projectRoot, options)` function for testability
2. Wrap entire step 8 in try-catch to ensure failures never block `isdlc init`
3. Add a prompt-verification test that validates agent markdown changes reference the search abstraction correctly

---

## Impact Analysis Metadata

```json
{
  "analysis_completed_at": "2026-03-03T00:00:00Z",
  "sub_agents": ["M1", "M2", "M3"],
  "verification_status": "PASS",
  "requirements_document": "docs/requirements/REQ-0042-wire-search-abstraction-layer-into-setup-pipeline/requirements-spec.md",
  "quick_scan_used": "docs/requirements/REQ-0042-wire-search-abstraction-layer-into-setup-pipeline/quick-scan.md",
  "scope_change_from_original": "refined",
  "requirements_keywords": ["search", "setup", "pipeline", "installer", "agent", "migration", "MCP", "detection"],
  "files_directly_affected": 8,
  "modules_affected": 3,
  "risk_level": "low",
  "blast_radius": "medium",
  "coverage_gaps": 1
}
```
