# Design Summary: REQ-0042

## Module Responsibilities

| Module | Responsibility | Change Type |
|--------|---------------|-------------|
| `lib/installer.js` | Setup pipeline; gains `setupSearchCapabilities()` | Modified (additive function) |
| `lib/cli.js` | CLI routing; gains `--no-search-setup` flag | Modified (flag parsing) |
| 6 agent .md files | Agent instructions; gain Enhanced Search sections | Modified (additive sections) |

## Data Flow

1. **Setup**: `isdlc init` -> `install()` -> `setupSearchCapabilities()` -> `detectSearchCapabilities()` -> `installTool()` -> `configureMcpServers()` -> `writeSearchConfig()`
2. **Agent use**: Agent invoked -> reads markdown instructions -> checks search config -> uses router or Grep/Glob
3. **Opt-out**: `--no-search-setup` -> step 8 skipped -> no config created -> Grep/Glob baseline

## Key Workflows

- **Happy path**: Detection finds tools to recommend -> user accepts -> tools installed -> MCP configured -> config saved
- **Opt-out**: Flag skips entire step -> zero side effects
- **Failure**: Any error caught -> warning logged -> installer continues normally

## Interface Contracts

- `setupSearchCapabilities(projectRoot, options)` -> Promise<void> (never rejects)
- Consent callback: `(name, reason, command) => Promise<boolean>`
- Config output: `.isdlc/search-config.json` with `SearchConfig` schema
- MCP output: `.claude/settings.json` `mcpServers` entries

## Error Taxonomy

5 error codes (ERR-SETUP-001 through ERR-SETUP-005), all severity Warning, all non-fatal. Maps to 7 installation-specific error codes from REQ-0041.
