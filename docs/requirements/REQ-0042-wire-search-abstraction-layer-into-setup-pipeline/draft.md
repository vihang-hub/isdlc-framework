# Wire Search Abstraction Layer into Setup Pipeline and Migrate High-Impact Agents

**Source**: GitHub Issue #95
**Type**: Feature / Requirement

## Problem Statement

REQ-0041 implemented the search abstraction layer (router, registry, ranker, backends, detection, installation, config modules) with full test coverage. However, the modules are not yet wired into the framework's runtime:

1. The setup pipeline (`lib/installer.js`, `/discover`) does not run search capability detection or tool installation
2. No agents have been migrated to use the search abstraction — they still call Grep/Glob directly
3. MCP server auto-configuration is not triggered during setup

## Scope

### Setup Pipeline Integration
- Integrate `lib/search/detection.js` into the setup pipeline (init / discover)
- Add search capability detection step after existing setup steps
- Present tool recommendations to user with opt-out
- Call `lib/search/install.js` for accepted recommendations
- Configure MCP servers via `lib/search/install.js` → `configureMcpServers()`
- Record search config via `lib/search/config.js`
- Support `--no-search-setup` flag for opt-out

### Agent Migration (High-Impact First)
- Migrate `quick-scan-agent` to use search abstraction for codebase scanning
- Migrate impact analysis sub-agents (M1-M3) to use structural/enhanced search
- Migrate discovery analyzers (architecture-analyzer, feature-mapper) to use search
- Maintain backward compatibility — non-migrated agents continue using Grep/Glob directly
- Migration pattern: replace direct Grep/Glob calls with `search()` calls specifying modality

### MCP Auto-Configuration
- Wire detected/installed tools into `.claude/settings.json` mcpServers
- Support ast-grep and Probe MCP server configurations
- Validate MCP server health after configuration

## References

- REQ-0041: Search abstraction layer implementation (completed)
- Architecture: `docs/requirements/REQ-0041-improve-search-capabilities-for-claude-effectiveness/architecture-overview.md`
- Interface spec: `docs/requirements/REQ-0041-improve-search-capabilities-for-claude-effectiveness/interface-spec.md`
- Module design: `docs/requirements/REQ-0041-improve-search-capabilities-for-claude-effectiveness/module-design.md`
