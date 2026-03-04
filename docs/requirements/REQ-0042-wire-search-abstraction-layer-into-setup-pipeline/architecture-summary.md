# Architecture Summary: REQ-0042

## Key Decisions

| ADR | Decision | Rationale |
|-----|----------|-----------|
| ADR-001 | Extracted function in installer.js | Testable isolation without new files; consistent with existing pattern |
| ADR-002 | Agent migration via additive markdown sections | Zero-risk to hook parsing; preserves fallback path |
| ADR-003 | Fail-open search setup | Enhancement cannot block core installer; respects restricted environments |

## Technology Decisions

No new dependencies. All called modules (`lib/search/detection.js`, `lib/search/install.js`, `lib/search/config.js`) are already implemented and tested from REQ-0041.

## Integration Points

- **lib/installer.js**: New step 8 function `setupSearchCapabilities()` orchestrates detection -> installation -> MCP config -> config persistence
- **lib/cli.js**: `--no-search-setup` flag parsed and passed through options
- **.claude/settings.json**: MCP server entries added via `configureMcpServers()`
- **6 agent markdown files**: New "Enhanced Search" sections added without modifying existing content

## Risk Assessment

All risks are Low. The highest-risk change is adding step 8 to the installer, mitigated by:
1. Top-level try-catch (fail-open)
2. Existing module tests covering all called functions
3. Additive-only changes to installer (no existing code modified)
