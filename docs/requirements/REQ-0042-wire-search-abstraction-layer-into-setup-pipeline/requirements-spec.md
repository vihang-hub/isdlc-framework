# Requirements Specification: Wire Search Abstraction Layer into Setup Pipeline

**Status**: Draft
**Confidence**: High
**Last Updated**: 2026-03-03
**Coverage**: Problem Discovery (high), Requirements Definition (high), Technical Context (high)
**Source**: GitHub Issue #95 (GH-95)
**Slug**: REQ-0042-wire-search-abstraction-layer-into-setup-pipeline

---

## 1. Business Context

### Problem Statement

REQ-0041 implemented the complete search abstraction layer -- router, registry, ranker, backends, detection, installation, and config modules -- all with full test coverage. However, these modules sit unused in `lib/search/`. The framework's runtime does not invoke them:

1. **Setup pipeline gap**: The installer (`lib/installer.js`) and `/discover` command do not run search capability detection, tool installation, or MCP server configuration. Users who install iSDLC never receive search enhancement recommendations.
2. **Agent migration gap**: All 48 agents still reference Grep/Glob directly in their markdown instructions. None have been updated to describe using the search abstraction. The high-impact agents (quick-scan, impact analysis sub-agents, discovery analyzers) would benefit most from structural and enhanced search.
3. **MCP configuration gap**: `lib/search/install.js` has `configureMcpServers()` implemented and tested, but nothing in the framework calls it during setup.

The practical effect is that the entire search abstraction layer from REQ-0041 delivers zero user value until this wiring is completed.

### Success Criteria

- The setup pipeline (`isdlc init` / `/discover`) runs search detection and offers tool installation
- At least 3 high-impact agents are migrated to reference the search abstraction in their instructions
- MCP servers are auto-configured in `.claude/settings.json` for accepted tool installations
- Users can opt out of search setup with `--no-search-setup`
- Existing behavior is preserved when users opt out or when enhanced backends are unavailable

### Cost of Inaction

The REQ-0041 investment (8 modules, 8 test files, architecture, design) provides no user-facing benefit. The search abstraction layer remains dead code until wired in.

## 2. Stakeholders and Personas

### P1: iSDLC End User (New Installation)
- **Role**: Developer running `isdlc init` for the first time
- **Pain point**: Does not know enhanced search tools exist; misses configuration opportunity
- **Interest**: Automatic detection and guided installation during setup

### P2: iSDLC End User (Existing Installation)
- **Role**: Developer with existing iSDLC installation who runs `/discover` or upgrades
- **Pain point**: Cannot add search capabilities without manual configuration
- **Interest**: Discover-time search setup, re-detection after tool installation

### P3: Agent Developer (Framework Contributor)
- **Role**: Developer modifying or creating iSDLC agents
- **Pain point**: No migration pattern or reference implementation for using search abstraction
- **Interest**: Clear migration guide and reference agents to follow

## 3. User Journeys

### UJ-01: New Installation with Search Setup
**Entry**: User runs `isdlc init` on a new project.
**Happy path**:
1. Installer runs steps 1-7 as normal
2. New step 8 runs search capability detection (`detectSearchCapabilities()`)
3. Installer reports findings: tools available, project scale, recommendations
4. User accepts recommendations; tools are installed, MCP servers configured
5. Search config written to `.isdlc/search-config.json`
**Opt-out path**: User passes `--no-search-setup` flag; step 8 is skipped entirely.
**Decline path**: User declines at the recommendation prompt; search config records opt-out, installer continues.

### UJ-02: Agent Uses Search Abstraction During Analysis
**Entry**: User runs `/isdlc analyze` on a requirement.
**Happy path**:
1. Quick-scan agent's instructions now reference the search abstraction
2. Agent uses `search()` with `modality: 'structural'` for AST-aware pattern matching
3. Results include AST metadata, relevance scores, and are token-budget-bounded
**Fallback path**: Enhanced backend unavailable; agent receives degraded results from Grep/Glob with degradation notification.

### UJ-03: Opt-Out During Installation
**Entry**: User runs `isdlc init --no-search-setup`.
**Path**: Search detection, installation, and MCP configuration steps are completely skipped. All agents continue to function with Grep/Glob baseline. No search-config.json is created.

## 4. Technical Context

### Current State

- `lib/search/` contains 8 modules: `router.js`, `registry.js`, `ranker.js`, `config.js`, `detection.js`, `install.js`, `backends/lexical.js`, `backends/structural.js`, `backends/enhanced-lexical.js`
- All 8 modules have companion `.test.js` files with passing tests
- `lib/installer.js` exports `install(projectRoot, options)` with a 7-step pipeline
- `lib/cli.js` parses `--monorepo`, `--force`, `--dry-run`, `--backup` flags but not `--no-search-setup`
- 48 agents in `src/claude/agents/` reference Grep/Glob directly in their markdown
- `.claude/settings.json` has no `mcpServers` section for search backends

### Technical Constraints

- **Non-blocking**: Search setup must not block the installer if detection or installation fails
- **Additive only**: Existing installer steps 1-7 must not be modified (only new step added)
- **Backward compatible**: Projects installed without search setup must function identically to today
- **Agent markdown migration**: Agent files are markdown (not code); migration changes instructional text
- **Opt-out by flag**: `--no-search-setup` must completely bypass the search setup step

### Integration Points

| Integration Point | Current State | Required Change |
|-------------------|---------------|-----------------|
| `lib/installer.js` install() | 7-step pipeline | Add step 8: search setup |
| `lib/cli.js` parseArgs() | No `--no-search-setup` | Parse and pass to installer |
| `.claude/settings.json` | No mcpServers for search | `configureMcpServers()` writes entries |
| `quick-scan-agent.md` | References Grep/Glob directly | Add search abstraction guidance |
| `impact-analyzer.md` | No search guidance | Add search abstraction usage pattern |
| `entry-point-finder.md` | No search guidance | Add search abstraction usage pattern |
| `risk-assessor.md` | No search guidance | Add search abstraction usage pattern |
| `architecture-analyzer.md` | Uses `find` command | Add search abstraction reference |
| `feature-mapper.md` | Uses Grep patterns | Add search abstraction reference |

## 5. Quality Attributes and Risks

### Quality Attributes

| Attribute | Priority | Threshold |
|-----------|----------|-----------|
| Reliability | Must Have | Search setup failures never block `isdlc init` completion |
| Backward Compatibility | Must Have | Existing installations without search setup work identically |
| Usability | Should Have | Search setup adds at most 30 seconds to init flow |
| Transparency | Should Have | User sees what is being detected, installed, and configured |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| R-01: Tool installation fails on user's system | Medium | Low | Graceful fallback; never block init. Detection is fail-open. |
| R-02: MCP configuration conflicts with existing settings | Low | Medium | `configureMcpServers()` preserves existing entries (already implemented) |
| R-03: Agent migration instructions are unclear | Medium | Medium | Reference implementation in quick-scan-agent; migration guide in architecture doc |
| R-04: Detection step slows down init | Low | Low | Detection is already bounded at 5s timeout per tool check |
| R-05: Agent markdown changes break hook parsing | Low | High | Only add new sections; do not modify frontmatter or existing section structure |

## 6. Functional Requirements

### FR-001: Setup Pipeline Integration

**Description**: Add a search capability detection and setup step to the `lib/installer.js` install pipeline. This step runs after existing steps and calls `detectSearchCapabilities()`, presents recommendations to the user, installs accepted tools via `installTool()`, configures MCP servers via `configureMcpServers()`, and records configuration via `writeSearchConfig()`.

**Confidence**: High

**Priority**: Must Have

**Acceptance Criteria**:
- AC-001-01: The install function in `lib/installer.js` includes a new step (step 8) that calls `detectSearchCapabilities(projectRoot)` from `lib/search/detection.js`
- AC-001-02: Detection results (scale tier, tool availability, recommendations) are displayed to the user using the existing `logger` utilities
- AC-001-03: For each recommended tool, the installer calls `installTool()` with a consent callback that uses the existing `confirm()` prompt
- AC-001-04: After successful installations, `configureMcpServers()` is called to write MCP entries to `.claude/settings.json`
- AC-001-05: After all installations and MCP configuration, `writeSearchConfig()` is called to persist the search configuration to `.isdlc/search-config.json`
- AC-001-06: If the user declines all recommendations, `writeSearchConfig()` is still called with the baseline config (grep-glob only)
- AC-001-07: Detection and installation failures are logged as warnings but never throw or block the installer from completing

### FR-002: CLI Flag Support

**Description**: Add `--no-search-setup` flag parsing to `lib/cli.js` and pass it through to the installer options.

**Confidence**: High

**Priority**: Must Have

**Acceptance Criteria**:
- AC-002-01: `lib/cli.js` parseArgs function recognizes the `--no-search-setup` flag
- AC-002-02: When `--no-search-setup` is passed, `options.noSearchSetup` is set to `true`
- AC-002-03: When `options.noSearchSetup` is true, the installer skips step 8 entirely (no detection, no installation, no MCP configuration)
- AC-002-04: The `--force` flag causes step 8 to use auto-accept for recommendations (no interactive prompts)
- AC-002-05: The `--dry-run` flag causes step 8 to report what would be detected/installed without making changes
- AC-002-06: Help text in `showHelp()` includes documentation for the `--no-search-setup` flag

### FR-003: Quick-Scan Agent Migration

**Description**: Update the quick-scan agent's markdown instructions to describe using the search abstraction layer alongside or instead of direct Grep/Glob calls.

**Confidence**: High

**Priority**: Should Have

**Acceptance Criteria**:
- AC-003-01: `quick-scan-agent.md` includes a new section titled "Enhanced Search" that describes how to use the search abstraction when available
- AC-003-02: The enhanced search section includes example search requests with `modality: 'structural'` and `modality: 'lexical'` with token budget
- AC-003-03: The agent instructions describe checking `hasEnhancedSearch()` to decide between direct Grep/Glob and the search abstraction
- AC-003-04: Existing Grep/Glob instructions remain as the fallback path (not removed)
- AC-003-05: The agent's frontmatter (name, model, skills) is NOT modified

### FR-004: Impact Analysis Sub-Agent Migration

**Description**: Update the three impact analysis sub-agents (M1 impact-analyzer, M2 entry-point-finder, M3 risk-assessor) to reference the search abstraction for their codebase scanning operations.

**Confidence**: Medium

**Priority**: Should Have

**Acceptance Criteria**:
- AC-004-01: `impact-analyzer.md` includes guidance for using structural search to find files affected by breaking changes or requirements
- AC-004-02: `entry-point-finder.md` includes guidance for using structural search to locate API endpoints, UI components, and event handlers
- AC-004-03: `risk-assessor.md` includes guidance for using enhanced lexical search to assess test coverage gaps in affected areas
- AC-004-04: Each sub-agent's migration adds a new section without modifying existing process steps
- AC-004-05: Each sub-agent's frontmatter is NOT modified

### FR-005: Discovery Analyzer Migration

**Description**: Update the architecture-analyzer and feature-mapper discovery agents to reference the search abstraction for their codebase scanning operations.

**Confidence**: Medium

**Priority**: Could Have

**Acceptance Criteria**:
- AC-005-01: `architecture-analyzer.md` includes guidance for using structural search to identify architecture patterns, framework usage, and entry points
- AC-005-02: `feature-mapper.md` includes guidance for using structural search to catalog API endpoints, UI routes, and background jobs
- AC-005-03: Existing `find` and Grep patterns remain as fallback instructions
- AC-005-04: Agent frontmatter is NOT modified

### FR-006: Installer Step Count Update

**Description**: Update the installer step counter from "N/7" to "N/8" to accommodate the new search setup step. Ensure all existing step labels are renumbered if needed or the new step is added as step 8.

**Confidence**: High

**Priority**: Must Have

**Acceptance Criteria**:
- AC-006-01: All existing logger.step() calls use the correct denominator (reflecting the new total)
- AC-006-02: The new search setup step uses the correct step number in its logger.step() call
- AC-006-03: The step numbering is sequential with no gaps

### FR-007: Help Text and Documentation

**Description**: Update CLI help text and relevant documentation to describe the search setup feature and opt-out mechanism.

**Confidence**: High

**Priority**: Should Have

**Acceptance Criteria**:
- AC-007-01: `showHelp()` in cli.js includes `--no-search-setup` in the Options section
- AC-007-02: The option description explains that it skips search tool detection and installation during init

## 7. Out of Scope

- **Phase 2 backends**: Semantic search (CodeBERT), indexed search (Zoekt) are deferred per REQ-0041 decisions
- **Agent runtime code changes**: Agent migration is to markdown instructions only. No runtime adapter code is written in this requirement.
- **Search result caching**: Cross-agent result sharing is not in scope
- **Discover command search setup**: Wiring into `/discover` (discover-orchestrator) is a follow-on; this REQ focuses on `isdlc init`
- **MCP health monitoring**: Runtime health checks during sessions are handled by the router (already implemented in REQ-0041)
- **All 48 agents**: Only high-impact agents (quick-scan, 3 impact analysis, 2 discovery) are migrated. Remaining agents are deferred.

## 8. MoSCoW Prioritization

### Must Have
- FR-001: Setup Pipeline Integration
- FR-002: CLI Flag Support
- FR-006: Installer Step Count Update

### Should Have
- FR-003: Quick-Scan Agent Migration
- FR-004: Impact Analysis Sub-Agent Migration
- FR-007: Help Text and Documentation

### Could Have
- FR-005: Discovery Analyzer Migration

### Won't Have (This Iteration)
- (None -- all deferred items are out of scope)

## Pending Sections

None -- all sections covered.
