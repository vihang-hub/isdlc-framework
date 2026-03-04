# Module Design: Wire Search Abstraction Layer into Setup Pipeline

**Status**: Draft
**Confidence**: High
**Last Updated**: 2026-03-03
**Coverage**: Module Boundaries (high), Data Structures (high), Dependencies (high)

---

## 1. Module Boundaries

### Module: `lib/installer.js` (Modified)

**Responsibility**: Cross-platform project installation pipeline. Gains a new search setup step.

**New Export (for testing)**:
```js
/**
 * Set up search capabilities: detect tools, offer installation, configure MCP.
 * Fail-open: any error is caught and logged as a warning.
 *
 * @param {string} projectRoot - Project root directory
 * @param {Object} options
 * @param {boolean} [options.force=false] - Auto-accept recommendations
 * @param {boolean} [options.dryRun=false] - Report without changes
 * @returns {Promise<void>}
 */
async function setupSearchCapabilities(projectRoot, options = {})
```

**Integration Point**: Called from `install()` as step 8 (after step 7 "Generating project state").

**Dependencies**: `lib/search/detection.js`, `lib/search/install.js`, `lib/search/config.js`, `lib/utils/logger.js`, `lib/utils/prompts.js`

---

### Module: `lib/cli.js` (Modified)

**Responsibility**: CLI command router and argument parsing.

**Change**: `parseArgs()` function gains recognition of `--no-search-setup` flag.

```js
// Added to option parsing:
if (arg === '--no-search-setup') {
  options.noSearchSetup = true;
}
```

**Change**: `showHelp()` function gains a new line in the Options section.

```js
logger.log('  --no-search-setup       Skip search tool detection and installation');
```

**Dependencies**: No new dependencies.

---

### Module: Agent Markdown Files (6 files modified)

These are not code modules but markdown instruction files parsed at agent invocation time.

**Files Modified**:
1. `src/claude/agents/quick-scan/quick-scan-agent.md`
2. `src/claude/agents/impact-analysis/impact-analyzer.md`
3. `src/claude/agents/impact-analysis/entry-point-finder.md`
4. `src/claude/agents/impact-analysis/risk-assessor.md`
5. `src/claude/agents/discover/architecture-analyzer.md`
6. `src/claude/agents/discover/feature-mapper.md`

**Change Pattern**: Each file gains a new section (15-30 lines) describing search abstraction usage. The section is placed after the existing PROCESS section and before ERROR HANDLING or SELF-VALIDATION.

**Constraints**:
- YAML frontmatter must NOT be modified
- Existing `## Step N:` headings must NOT be modified
- New section uses `# ENHANCED SEARCH` (h1) for quick-scan or `## Enhanced Search` (h2) for sub-agents

---

## 2. Data Structures

### setupSearchCapabilities() Internal Flow

```js
/**
 * Internal data flow within setupSearchCapabilities:
 *
 * 1. detectionResult: DetectionResult (from lib/search/detection.js)
 *    { scaleTier, fileCount, tools[], recommendations[], existingMcpServers[] }
 *
 * 2. installResults: InstallResult[] (accumulated from installTool() calls)
 *    [{ tool, success, version?, error?, fallbackAvailable }]
 *
 * 3. installedBackends: Object[] (filtered from installResults where success=true)
 *    [{ id: 'ast-grep', name: 'ast-grep' }]
 *
 * 4. searchConfig: SearchConfig (built from detection + installation results)
 *    { enabled, activeBackends[], preferredModality, cloudAllowed, scaleTier, backendConfigs }
 */
```

### CLI Options Extension

```js
/**
 * Extended options object passed from cli.js to installer.js:
 *
 * @typedef {Object} InstallOptions
 * @property {boolean} [monorepo=false] - Force monorepo mode
 * @property {boolean} [force=false] - Skip confirmation prompts
 * @property {boolean} [dryRun=false] - Preview without changes
 * @property {string} [providerMode] - LLM provider mode
 * @property {boolean} [noSearchSetup=false] - NEW: Skip search setup step
 */
```

### Agent Migration Section Template

```markdown
# ENHANCED SEARCH

> This section applies when the search abstraction layer is configured
> (via `isdlc init`). If not configured, use the standard Grep/Glob
> tools described in the Process section above.

When enhanced search backends are available, prefer them for higher
precision results:

**Structural Search** (modality: 'structural'):
- Use for: finding function definitions, class patterns, import statements
- Backend: ast-grep (AST-aware, ignores comments and strings)
- Example request: { query: "async function $NAME($$$)", modality: "structural" }

**Enhanced Lexical Search** (modality: 'lexical'):
- Use for: text search with relevance ranking and tree-sitter context
- Backend: Probe (BM25 ranking, better signal-to-noise than raw Grep)
- Example request: { query: "authentication", modality: "lexical", tokenBudget: 5000 }

**Fallback Behavior**:
If enhanced backends are unavailable, the search router automatically
falls back to Grep/Glob. No agent changes are needed for degraded mode.
```

## 3. Dependency Graph

```
lib/installer.js (modified)
  +-- lib/search/detection.js (existing, called by setupSearchCapabilities)
  +-- lib/search/install.js (existing, called by setupSearchCapabilities)
  +-- lib/search/config.js (existing, called by setupSearchCapabilities)
  +-- lib/utils/logger.js (existing)
  +-- lib/utils/prompts.js (existing)

lib/cli.js (modified)
  +-- lib/installer.js (existing dependency, unchanged)

Agent markdown files (modified -- no code dependencies)
  +-- No runtime dependencies (instruction text only)
```

No circular dependencies. No new modules. No new runtime dependencies.

## 4. Function Specification: setupSearchCapabilities

```js
async function setupSearchCapabilities(projectRoot, options = {}) {
  const { force = false, dryRun = false } = options;

  try {
    // 1. Detect capabilities
    const detection = await detectSearchCapabilities(projectRoot);

    // 2. Report findings
    logger.labeled('Project Scale', `${detection.scaleTier} (~${detection.fileCount} files)`);

    for (const tool of detection.tools) {
      if (tool.installed) {
        logger.success(`${tool.name} detected (v${tool.version})`);
      }
    }

    if (detection.recommendations.length === 0) {
      logger.info('No additional search tools recommended.');
      // Still write config to record detection was performed
      if (!dryRun) {
        writeSearchConfig(projectRoot, buildConfig(detection, []));
      }
      return;
    }

    // 3. Present recommendations and install
    const installResults = [];

    for (const rec of detection.recommendations) {
      if (dryRun) {
        logger.info(`Would recommend: ${rec.tool.name} (${rec.reason})`);
        continue;
      }

      const consentFn = force
        ? async () => true
        : async (name, reason, cmd) => {
            return confirm(`Install ${name}? (${cmd}) -- ${reason}`, true);
          };

      const result = await installTool(rec, consentFn);
      installResults.push(result);

      if (result.success) {
        logger.success(`Installed ${result.tool} (v${result.version})`);
      } else if (result.error !== 'User declined installation') {
        logger.warning(`Could not install ${result.tool}: ${result.error}`);
      }
    }

    // 4. Configure MCP servers for successful installations
    const installed = installResults
      .filter(r => r.success)
      .map(r => ({ id: r.tool, name: r.tool }));

    if (installed.length > 0 && !dryRun) {
      const settingsPath = path.join(projectRoot, '.claude', 'settings.json');
      const mcpResult = await configureMcpServers(installed, settingsPath, { projectRoot });

      for (const id of mcpResult.configured) {
        logger.success(`Configured MCP server: ${id}`);
      }
      for (const err of mcpResult.errors) {
        logger.warning(`MCP config: ${err.message}`);
      }
    }

    // 5. Write search config
    if (!dryRun) {
      const config = buildConfig(detection, installResults);
      writeSearchConfig(projectRoot, config);
      logger.success('Search configuration saved');
    }

  } catch (err) {
    logger.warning(`Search setup encountered an issue: ${err.message}`);
    logger.info('Continuing without enhanced search. You can re-run detection later.');
  }
}

function buildConfig(detection, installResults) {
  const activeBackends = ['grep-glob'];
  const backendConfigs = {};

  for (const result of installResults) {
    if (result.success) {
      activeBackends.push(result.tool);
      backendConfigs[result.tool] = { enabled: true };
    }
  }

  return {
    enabled: true,
    activeBackends,
    preferredModality: 'lexical',
    cloudAllowed: false,
    scaleTier: detection.scaleTier,
    backendConfigs,
  };
}
```

## 5. Agent Migration Specification

### Quick-Scan Agent Changes

**File**: `src/claude/agents/quick-scan/quick-scan-agent.md`
**Insertion point**: After `## Step 2: Quick Codebase Search` section, before `## Step 3: Estimate Scope`
**Content**: New `## Step 2b: Enhanced Search (When Available)` subsection that describes using structural search for more precise keyword matching.

### Impact Analysis Sub-Agent Changes

**Files**: `impact-analyzer.md`, `entry-point-finder.md`, `risk-assessor.md`
**Insertion point**: After the SKILLS AVAILABLE section, before PROCESS
**Content**: New `# ENHANCED SEARCH` section with the standard template from Section 2 above, customized per agent's search needs.

### Discovery Analyzer Changes

**Files**: `architecture-analyzer.md`, `feature-mapper.md`
**Insertion point**: After the last Process step, before "Return Results" step
**Content**: New `### Enhanced Search Alternative` subsection noting structural search can replace find/grep patterns.
