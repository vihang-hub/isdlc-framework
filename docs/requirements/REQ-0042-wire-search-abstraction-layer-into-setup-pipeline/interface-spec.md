# Interface Specification: Wire Search Abstraction Layer into Setup Pipeline

**Status**: Draft
**Confidence**: High
**Last Updated**: 2026-03-03
**Coverage**: Setup Interface (high), CLI Interface (high), Agent Interface (high)

---

## 1. Setup Pipeline Interface

### `setupSearchCapabilities(projectRoot, options?) -> Promise<void>`

The primary new function added to `lib/installer.js`. Orchestrates search detection, tool installation, MCP configuration, and config persistence.

```ts
/**
 * Set up search capabilities for a project.
 * Fail-open: any error is caught and logged as a warning.
 *
 * @param projectRoot - Absolute path to the project root directory
 * @param options - Configuration options
 * @param options.force - Auto-accept all recommendations without prompting (default: false)
 * @param options.dryRun - Report detection results without making changes (default: false)
 * @returns Promise<void> - Always resolves (never rejects)
 */
function setupSearchCapabilities(
  projectRoot: string,
  options?: {
    force?: boolean;
    dryRun?: boolean;
  }
): Promise<void>
```

### Error Contract

This function NEVER throws. All errors are caught internally and logged via `logger.warning()`. The caller (`install()`) does not need error handling for this step.

### Interaction with Existing Interfaces

The function calls these already-implemented interfaces from `lib/search/`:

| Function | Module | Already Implemented | Called How |
|----------|--------|---------------------|-----------|
| `detectSearchCapabilities(projectRoot)` | `lib/search/detection.js` | Yes | Direct import |
| `installTool(recommendation, consentFn)` | `lib/search/install.js` | Yes | Direct import |
| `configureMcpServers(backends, settingsPath, options)` | `lib/search/install.js` | Yes | Direct import |
| `writeSearchConfig(projectRoot, config)` | `lib/search/config.js` | Yes | Direct import |

No new interfaces are defined in `lib/search/` modules. All existing interfaces are used as-is.

## 2. CLI Interface

### Flag: `--no-search-setup`

```
Usage: isdlc init [--no-search-setup]

  --no-search-setup    Skip search tool detection and installation during init.
                       Projects will use Grep/Glob baseline search only.
```

### Options Object Extension

```ts
interface InstallOptions {
  monorepo?: boolean;      // Existing
  force?: boolean;         // Existing
  dryRun?: boolean;        // Existing
  providerMode?: string;   // Existing
  noSearchSetup?: boolean; // NEW: When true, step 8 is skipped entirely
}
```

### Flag Interaction Matrix

| Flag Combination | Step 8 Behavior |
|-----------------|-----------------|
| (no flags) | Interactive: detect, prompt for each tool, install accepted |
| `--force` | Auto-accept: detect, install all recommended, no prompts |
| `--dry-run` | Preview: detect, display recommendations, no installation |
| `--no-search-setup` | Skip: step 8 does not execute at all |
| `--force --no-search-setup` | Skip: --no-search-setup takes precedence |
| `--dry-run --no-search-setup` | Skip: --no-search-setup takes precedence |

## 3. Consent Callback Interface

The `installTool()` function from `lib/search/install.js` accepts a consent callback. The installer provides one that adapts to the `--force` flag:

```ts
/**
 * Consent callback passed to installTool().
 * Under --force, always returns true.
 * Under interactive mode, prompts the user via confirm().
 *
 * @param toolName - Name of the tool (e.g., "ast-grep")
 * @param reason - Why the tool is recommended
 * @param command - Installation command (e.g., "npm install -g @ast-grep/cli")
 * @returns Promise<boolean> - true to install, false to skip
 */
type ConsentCallback = (
  toolName: string,
  reason: string,
  command: string
) => Promise<boolean>;
```

### Interactive Mode Consent Prompt

```
Install ast-grep? (npm install -g @ast-grep/cli) -- Provides structural (AST-aware) search (y/N)
```

### Force Mode Consent

```ts
const autoAcceptConsent: ConsentCallback = async () => true;
```

## 4. Configuration Output Interface

After setup completes, `writeSearchConfig()` writes `.isdlc/search-config.json`:

```json
{
  "enabled": true,
  "activeBackends": ["grep-glob", "ast-grep"],
  "preferredModality": "lexical",
  "cloudAllowed": false,
  "scaleTier": "medium",
  "backendConfigs": {
    "ast-grep": { "enabled": true }
  }
}
```

If the user declines all tools:
```json
{
  "enabled": true,
  "activeBackends": ["grep-glob"],
  "preferredModality": "lexical",
  "cloudAllowed": false,
  "scaleTier": "medium",
  "backendConfigs": {}
}
```

If `--no-search-setup` is used, no `search-config.json` is created.

## 5. MCP Configuration Output Interface

After successful tool installation, `configureMcpServers()` adds entries to `.claude/settings.json`:

```json
{
  "mcpServers": {
    "ast-grep": {
      "command": "ast-grep",
      "args": ["lsp"],
      "env": {}
    },
    "probe": {
      "command": "probe-mcp",
      "args": ["--workspace", "/path/to/project"],
      "env": {}
    }
  }
}
```

Existing `mcpServers` entries are preserved. Conflicting entries (same key, different command) produce a warning and are skipped.

## 6. Logger Output Interface

The search setup step uses the existing `logger` API:

```js
// Step header
logger.step('8/8', 'Setting up search capabilities...');

// Detection results
logger.labeled('Project Scale', 'medium (~45,000 files)');
logger.success('ast-grep detected (v0.25.0)');
logger.info('No additional search tools recommended.');

// Installation results
logger.success('Installed ast-grep (v0.25.0)');
logger.warning('Could not install probe: cargo not found');

// MCP configuration
logger.success('Configured MCP server: ast-grep');

// Error handling
logger.warning('Search setup encountered an issue: ...');
logger.info('Continuing without enhanced search. You can re-run detection later.');
```

## 7. Agent Markdown Interface

The agent migration introduces a consistent section template. This is not a runtime interface but a documentation pattern:

### Section Header

For top-level agents (quick-scan):
```markdown
# ENHANCED SEARCH
```

For sub-agents (impact analysis, discovery):
```markdown
## Enhanced Search
```

### Section Body Structure

```markdown
> This section applies when the search abstraction layer is configured.
> If not configured, use the standard Grep/Glob tools in the Process section.

**Structural Search** (modality: 'structural'):
- Use for: {agent-specific use cases}
- Example: {agent-specific example}

**Enhanced Lexical Search** (modality: 'lexical'):
- Use for: {agent-specific use cases}
- Example: {agent-specific example}

**Fallback**: If enhanced backends are unavailable, the search router
falls back to Grep/Glob automatically.
```
