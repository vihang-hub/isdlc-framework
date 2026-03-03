# Data Flow: Wire Search Abstraction Layer into Setup Pipeline

**Status**: Draft
**Confidence**: High
**Last Updated**: 2026-03-03
**Coverage**: Setup Flow (high), Agent Usage Flow (high), Opt-Out Flow (high)

---

## 1. Setup Pipeline Flow (Step 8)

```
User runs `isdlc init`
  |
  v
[lib/cli.js] parseArgs(argv)
  |
  +-- Check for '--no-search-setup' flag
  |     +-- Found -> options.noSearchSetup = true
  |     +-- Not found -> options.noSearchSetup = false (default)
  |
  v
[lib/installer.js] install(projectRoot, options)
  |
  +-- Steps 1-7 execute (unchanged)
  |
  +-- Step 8: Check options.noSearchSetup
  |     +-- true  -> logger.info('Search setup skipped.') -> DONE
  |     +-- false -> continue
  |
  v
[lib/installer.js] setupSearchCapabilities(projectRoot, { force, dryRun })
  |
  +-- try {
  |
  +-- [lib/search/detection.js] detectSearchCapabilities(projectRoot)
  |     |
  |     +-- detectPackageManagers() -> { npm: true, cargo: false, brew: true }
  |     +-- detectTool('ast-grep', ...) -> { installed: false, installMethods: [...] }
  |     +-- detectTool('probe', ...) -> { installed: false, installMethods: [...] }
  |     +-- assessProjectScale(projectRoot) -> { scaleTier: 'medium', fileCount: 45000 }
  |     +-- readExistingMcpServers(projectRoot) -> []
  |     +-- generateRecommendations(...) -> [rec1, rec2]
  |     |
  |     v
  |   DetectionResult {
  |     scaleTier: 'medium',
  |     fileCount: 45000,
  |     tools: [{ name: 'ast-grep', installed: false, ... }, ...],
  |     recommendations: [{ tool: {...}, reason: '...', priority: 'recommended', installMethod: {...} }],
  |     existingMcpServers: []
  |   }
  |
  +-- Display findings:
  |     logger.labeled('Project Scale', 'medium (~45000 files)')
  |     For each tool: logger.success/info
  |     For each recommendation: logger.info
  |
  +-- For each recommendation:
  |     |
  |     +-- options.dryRun?
  |     |     +-- true -> logger.info("Would recommend: ...") -> skip install
  |     |
  |     +-- Build consent callback:
  |     |     +-- options.force? -> async () => true
  |     |     +-- else -> async (name, reason, cmd) => confirm(...)
  |     |
  |     +-- [lib/search/install.js] installTool(recommendation, consentFn)
  |     |     |
  |     |     +-- consentFn(toolName, reason, command)
  |     |     |     +-- User accepts -> execSync(command) -> success/failure
  |     |     |     +-- User declines -> { success: false, error: 'User declined' }
  |     |     |
  |     |     v
  |     |   InstallResult { tool, success, version?, error?, fallbackAvailable }
  |     |
  |     +-- Accumulate in installResults[]
  |
  +-- Filter successful: installedBackends = installResults.filter(r => r.success)
  |
  +-- If installedBackends.length > 0 AND NOT dryRun:
  |     |
  |     +-- [lib/search/install.js] configureMcpServers(installedBackends, settingsPath, { projectRoot })
  |     |     |
  |     |     +-- Read .claude/settings.json
  |     |     +-- Merge new mcpServers entries (preserve existing)
  |     |     +-- Write updated .claude/settings.json
  |     |     |
  |     |     v
  |     |   { configured: ['ast-grep'], errors: [] }
  |
  +-- If NOT dryRun:
  |     |
  |     +-- buildConfig(detection, installResults)
  |     |     -> SearchConfig { enabled: true, activeBackends: ['grep-glob', 'ast-grep'], ... }
  |     |
  |     +-- [lib/search/config.js] writeSearchConfig(projectRoot, config)
  |           -> Writes .isdlc/search-config.json
  |
  +-- } catch (err) {
  |     logger.warning("Search setup encountered an issue: ...")
  |     logger.info("Continuing without enhanced search.")
  |   }
  |
  v
Installer continues (manifest, CLAUDE.md seeding, tour, etc.)
```

## 2. Agent Search Usage Flow (Post-Setup)

```
Agent is invoked (e.g., quick-scan-agent during /isdlc analyze)
  |
  v
Agent reads its markdown instructions
  |
  +-- Standard Process section: Grep/Glob patterns
  |
  +-- Enhanced Search section (new):
  |     "If search abstraction is configured..."
  |
  v
Agent decides search approach:
  |
  +-- Enhanced search available?
  |     |
  |     +-- Check: .isdlc/search-config.json exists AND enabled=true AND activeBackends.length > 1
  |     |
  |     +-- Yes -> Use search abstraction:
  |     |     |
  |     |     +-- [lib/search/router.js] createRouter({ registry, projectRoot })
  |     |     +-- router.search({ query, modality: 'structural', tokenBudget: 5000 })
  |     |     |
  |     |     +-- Router checks registry for best backend
  |     |     +-- Routes to ast-grep/Probe/Grep-Glob
  |     |     +-- Returns SearchResult { hits[], meta }
  |     |     |
  |     |     v
  |     |   Agent uses hits[] for analysis
  |     |
  |     +-- No -> Use direct Grep/Glob:
  |           |
  |           +-- Standard tool calls as documented in Process section
  |           |
  |           v
  |         Agent uses raw Grep/Glob results
  |
  v
Agent continues with results (either path)
```

## 3. Opt-Out Flow

```
User runs `isdlc init --no-search-setup`
  |
  v
[lib/cli.js] parseArgs(['init', '--no-search-setup'])
  -> options = { noSearchSetup: true }
  |
  v
[lib/installer.js] install(projectRoot, { noSearchSetup: true })
  |
  +-- Steps 1-7 execute normally
  |
  +-- Step 8:
  |     if (options.noSearchSetup) {
  |       logger.info('Search setup skipped (--no-search-setup)');
  |       return;  // Skip entire step
  |     }
  |
  +-- Remaining steps execute normally
  |
  v
Result:
  - No .isdlc/search-config.json created
  - No tools installed
  - No MCP servers configured
  - All agents use Grep/Glob baseline (existing behavior)
```

## 4. Force Mode Flow

```
User runs `isdlc init --force`
  |
  v
[lib/installer.js] install(projectRoot, { force: true })
  |
  +-- Steps 1-7 auto-accept all prompts
  |
  +-- Step 8: setupSearchCapabilities(projectRoot, { force: true })
  |     |
  |     +-- detectSearchCapabilities(projectRoot) -> detection
  |     |
  |     +-- For each recommendation:
  |     |     consentFn = async () => true  // Auto-accept
  |     |     installTool(rec, consentFn)   // Install without prompting
  |     |
  |     +-- configureMcpServers(...)
  |     +-- writeSearchConfig(...)
  |
  v
Result:
  - All recommended tools installed (if package managers available)
  - MCP servers configured
  - Search config written
  - No user interaction during step 8
```

## 5. Dry-Run Flow

```
User runs `isdlc init --dry-run`
  |
  v
[lib/installer.js] install(projectRoot, { dryRun: true })
  |
  +-- Steps 1-7 report without making changes
  |
  +-- Step 8: setupSearchCapabilities(projectRoot, { dryRun: true })
  |     |
  |     +-- detectSearchCapabilities(projectRoot) -> detection (reads only)
  |     |
  |     +-- For each recommendation:
  |     |     logger.info("Would recommend: ast-grep (npm install -g @ast-grep/cli)")
  |     |     // No installation
  |     |
  |     +-- // No MCP configuration
  |     +-- // No config write
  |
  v
Result:
  - Detection runs (read-only)
  - Recommendations displayed
  - No files modified
```

## 6. Error Recovery Flow

```
Step 8 encounters an error at any point:
  |
  +-- Detection fails (e.g., permission error counting files):
  |     catch (err) ->
  |       logger.warning("Search setup encountered an issue: permission denied")
  |       logger.info("Continuing without enhanced search.")
  |       -> Step 8 returns, installer continues
  |
  +-- Individual tool installation fails:
  |     installTool() returns { success: false, error: "npm EACCES" }
  |     -> logger.warning("Could not install ast-grep: npm EACCES")
  |     -> Continue to next recommendation
  |     -> Write config with whatever succeeded
  |
  +-- MCP configuration fails:
  |     configureMcpServers() returns { errors: [{ code: 'CONFIG_SETTINGS_CORRUPT' }] }
  |     -> logger.warning("MCP config: settings.json contains invalid JSON")
  |     -> Continue to config write (search config independent of MCP)
  |
  +-- Config write fails:
  |     writeSearchConfig() throws
  |     -> Caught by outer try-catch
  |     -> logger.warning("Search setup encountered an issue: ...")
  |     -> Installer continues
  |
  v
In ALL cases: installer.install() completes successfully
```
