# Test Cases: Wire Search Abstraction Layer into Setup Pipeline

**Requirement**: REQ-0042
**Phase**: 05 - Test Strategy & Design
**Last Updated**: 2026-03-03
**Total Test Cases**: 51

---

## Unit Tests: setupSearchCapabilities() -- lib/installer.js

### TC-U-001: Happy path -- detection finds tools, user accepts, config written
- **Requirement**: FR-001 (AC-001-01, AC-001-02, AC-001-03, AC-001-04, AC-001-05)
- **Test Type**: positive
- **Priority**: P0
- **Precondition**: Mocked `detectSearchCapabilities()` returns tools and recommendations; mocked `installTool()` returns success; mocked `configureMcpServers()` returns configured entries
- **Input**: `setupSearchCapabilities(tmpDir, {})`
- **Expected**: `detectSearchCapabilities()` called with projectRoot; `installTool()` called with consent callback; `configureMcpServers()` called with installed backends; `writeSearchConfig()` called with config containing installed backends
- **Verification**: Assert call sequence and arguments

### TC-U-002: Happy path -- detection finds no recommendations
- **Requirement**: FR-001 (AC-001-06)
- **Test Type**: positive
- **Priority**: P0
- **Precondition**: Mocked `detectSearchCapabilities()` returns empty recommendations
- **Input**: `setupSearchCapabilities(tmpDir, {})`
- **Expected**: `writeSearchConfig()` called with baseline config (activeBackends: ['grep-glob']); `installTool()` NOT called; `configureMcpServers()` NOT called
- **Verification**: Assert writeSearchConfig called with baseline config

### TC-U-003: Force mode -- auto-accept consent
- **Requirement**: FR-002 (AC-002-04)
- **Test Type**: positive
- **Priority**: P0
- **Precondition**: Mocked detection returns recommendations
- **Input**: `setupSearchCapabilities(tmpDir, { force: true })`
- **Expected**: Consent callback always returns true (no user prompt); `installTool()` called with auto-accept callback
- **Verification**: Assert consent callback is `async () => true`, not the interactive prompt

### TC-U-004: Dry-run mode -- no installations, no MCP config, no config write
- **Requirement**: FR-002 (AC-002-05)
- **Test Type**: positive
- **Priority**: P0
- **Precondition**: Mocked detection returns recommendations
- **Input**: `setupSearchCapabilities(tmpDir, { dryRun: true })`
- **Expected**: Detection called (read-only); recommendations logged with "Would recommend: ..."; `installTool()` NOT called; `configureMcpServers()` NOT called; `writeSearchConfig()` NOT called
- **Verification**: Assert no side-effect functions called

### TC-U-005: Detection failure -- outer try-catch catches, logs warning, returns
- **Requirement**: FR-001 (AC-001-07)
- **Test Type**: negative
- **Priority**: P0
- **Precondition**: Mocked `detectSearchCapabilities()` throws Error
- **Input**: `setupSearchCapabilities(tmpDir, {})`
- **Expected**: Warning logged ("Search setup encountered an issue: ..."); Info logged ("Continuing without enhanced search."); Function returns without throwing
- **Verification**: Assert function resolves (does not reject); assert logger.warning called

### TC-U-006: Tool installation failure -- continue to next recommendation
- **Requirement**: FR-001 (AC-001-07)
- **Test Type**: negative
- **Priority**: P1
- **Precondition**: Mocked detection returns 2 recommendations; first `installTool()` returns `{ success: false, error: 'npm EACCES' }`; second returns `{ success: true }`
- **Input**: `setupSearchCapabilities(tmpDir, {})`
- **Expected**: Warning logged for first tool; second tool installed successfully; `configureMcpServers()` called with second tool only; config includes only the successful tool
- **Verification**: Assert installTool called twice; assert configureMcpServers called with 1 backend

### TC-U-007: User declines tool installation -- no warning logged
- **Requirement**: FR-001 (AC-001-06)
- **Test Type**: positive
- **Priority**: P1
- **Precondition**: Mocked detection returns recommendation; `installTool()` returns `{ success: false, error: 'User declined installation' }`
- **Input**: `setupSearchCapabilities(tmpDir, {})`
- **Expected**: No warning logged (user decline is not an error); `writeSearchConfig()` called with baseline config
- **Verification**: Assert logger.warning NOT called for "Could not install"; assert writeSearchConfig called

### TC-U-008: MCP configuration failure -- continue to config write
- **Requirement**: FR-001 (AC-001-04, AC-001-07)
- **Test Type**: negative
- **Priority**: P1
- **Precondition**: Tool installation succeeds; `configureMcpServers()` returns errors
- **Input**: `setupSearchCapabilities(tmpDir, {})`
- **Expected**: Warning logged for MCP error; `writeSearchConfig()` still called with installed tool in active backends
- **Verification**: Assert logger.warning called; assert writeSearchConfig called

### TC-U-009: Config write failure -- caught by outer try-catch
- **Requirement**: FR-001 (AC-001-07)
- **Test Type**: negative
- **Priority**: P1
- **Precondition**: `writeSearchConfig()` throws Error
- **Input**: `setupSearchCapabilities(tmpDir, {})`
- **Expected**: Warning logged; function returns without throwing
- **Verification**: Assert function resolves; assert logger.warning called

### TC-U-010: Detection reports findings via logger
- **Requirement**: FR-001 (AC-001-02)
- **Test Type**: positive
- **Priority**: P1
- **Precondition**: Mocked detection returns scale tier and tool list
- **Input**: `setupSearchCapabilities(tmpDir, {})`
- **Expected**: `logger.labeled()` called with 'Project Scale' and scale tier; `logger.success()` called for each installed tool
- **Verification**: Assert logger calls with expected arguments

### TC-U-011: Multiple recommendations -- each gets consent callback
- **Requirement**: FR-001 (AC-001-03)
- **Test Type**: positive
- **Priority**: P1
- **Precondition**: Detection returns 3 recommendations
- **Input**: `setupSearchCapabilities(tmpDir, {})`
- **Expected**: `installTool()` called 3 times, each with a consent callback
- **Verification**: Assert installTool call count equals 3

### TC-U-012: Successful installation logged with version
- **Requirement**: FR-001 (AC-001-02)
- **Test Type**: positive
- **Priority**: P2
- **Precondition**: `installTool()` returns `{ success: true, tool: 'ast-grep', version: '0.25.0' }`
- **Input**: `setupSearchCapabilities(tmpDir, {})`
- **Expected**: `logger.success()` called with "Installed ast-grep (v0.25.0)"
- **Verification**: Assert logger.success call argument

---

## Unit Tests: buildConfig() -- lib/installer.js

### TC-U-013: Build config from detection and successful installs
- **Requirement**: FR-001 (AC-001-05)
- **Test Type**: positive
- **Priority**: P0
- **Input**: detection `{ scaleTier: 'medium' }`, installResults `[{ success: true, tool: 'ast-grep' }]`
- **Expected**: Config `{ enabled: true, activeBackends: ['grep-glob', 'ast-grep'], preferredModality: 'lexical', cloudAllowed: false, scaleTier: 'medium', backendConfigs: { 'ast-grep': { enabled: true } } }`
- **Verification**: Assert deep equality

### TC-U-014: Build config with no successful installs
- **Requirement**: FR-001 (AC-001-06)
- **Test Type**: positive
- **Priority**: P0
- **Input**: detection `{ scaleTier: 'small' }`, installResults `[{ success: false, tool: 'ast-grep' }]`
- **Expected**: Config `{ enabled: true, activeBackends: ['grep-glob'], preferredModality: 'lexical', cloudAllowed: false, scaleTier: 'small', backendConfigs: {} }`
- **Verification**: Assert activeBackends has only 'grep-glob'; assert backendConfigs is empty

### TC-U-015: Build config with multiple successful installs
- **Requirement**: FR-001 (AC-001-05)
- **Test Type**: positive
- **Priority**: P1
- **Input**: detection `{ scaleTier: 'large' }`, installResults `[{ success: true, tool: 'ast-grep' }, { success: true, tool: 'probe' }]`
- **Expected**: Config activeBackends `['grep-glob', 'ast-grep', 'probe']`; backendConfigs has entries for both
- **Verification**: Assert array length 3; assert both backend configs present

### TC-U-016: Build config always includes grep-glob as first backend
- **Requirement**: FR-001 (AC-001-05)
- **Test Type**: positive
- **Priority**: P1
- **Input**: Any valid detection and installResults
- **Expected**: activeBackends[0] is always 'grep-glob'
- **Verification**: Assert activeBackends[0] === 'grep-glob'

---

## Unit Tests: parseArgs() -- lib/cli.js

### TC-U-017: Recognize --no-search-setup flag
- **Requirement**: FR-002 (AC-002-01, AC-002-02)
- **Test Type**: positive
- **Priority**: P0
- **Input**: `parseArgs(['init', '--no-search-setup'])`
- **Expected**: `result.options.noSearchSetup === true`; `result.command === 'init'`
- **Verification**: Assert options property

### TC-U-018: Default noSearchSetup is false when flag absent
- **Requirement**: FR-002 (AC-002-01)
- **Test Type**: positive
- **Priority**: P0
- **Input**: `parseArgs(['init'])`
- **Expected**: `result.options.noSearchSetup` is undefined or false
- **Verification**: Assert falsy value

### TC-U-019: --no-search-setup combined with --force
- **Requirement**: FR-002 (AC-002-03)
- **Test Type**: positive
- **Priority**: P1
- **Input**: `parseArgs(['init', '--force', '--no-search-setup'])`
- **Expected**: `result.options.force === true`; `result.options.noSearchSetup === true`
- **Verification**: Assert both flags set

### TC-U-020: --no-search-setup combined with --dry-run
- **Requirement**: FR-002 (AC-002-03)
- **Test Type**: positive
- **Priority**: P1
- **Input**: `parseArgs(['init', '--dry-run', '--no-search-setup'])`
- **Expected**: `result.options.dryRun === true`; `result.options.noSearchSetup === true`
- **Verification**: Assert both flags set

### TC-U-021: Flag order does not matter
- **Requirement**: FR-002 (AC-002-01)
- **Test Type**: positive
- **Priority**: P2
- **Input**: `parseArgs(['--no-search-setup', 'init', '--force'])`
- **Expected**: `result.command === 'init'`; `result.options.noSearchSetup === true`; `result.options.force === true`
- **Verification**: Assert all values correct regardless of order

---

## Unit Tests: showHelp() -- lib/cli.js

### TC-U-022: Help text includes --no-search-setup
- **Requirement**: FR-007 (AC-007-01, AC-007-02)
- **Test Type**: positive
- **Priority**: P1
- **Input**: Call showHelp() and capture output
- **Expected**: Output contains "--no-search-setup" and a description mentioning search tool detection
- **Verification**: Assert output includes expected text

---

## Unit Tests: Installer Step Count -- lib/installer.js

### TC-U-023: Step 8 label is "8/8"
- **Requirement**: FR-006 (AC-006-02)
- **Test Type**: positive
- **Priority**: P0
- **Input**: `setupSearchCapabilities(tmpDir, {})`
- **Expected**: `logger.step()` called with '8/8' as first argument
- **Verification**: Assert logger.step call

### TC-U-024: Existing steps renumbered to X/8 denominator
- **Requirement**: FR-006 (AC-006-01, AC-006-03)
- **Test Type**: positive
- **Priority**: P0
- **Input**: Run full `install()` function
- **Expected**: logger.step calls use "1/8", "2/8", ..., "7/8", "8/8" (sequential, no gaps)
- **Verification**: Assert all step denominators are "8"

---

## Unit Tests: Installer opt-out -- lib/installer.js

### TC-U-025: noSearchSetup=true skips step 8 entirely
- **Requirement**: FR-002 (AC-002-03)
- **Test Type**: positive
- **Priority**: P0
- **Input**: `install(tmpDir, { noSearchSetup: true, force: true })`
- **Expected**: `setupSearchCapabilities()` NOT called; `detectSearchCapabilities()` NOT called; no search-config.json created
- **Verification**: Assert setupSearchCapabilities not invoked

---

## Unit Tests: Agent Migration -- Markdown Structure

### TC-U-026: quick-scan-agent.md contains Enhanced Search section
- **Requirement**: FR-003 (AC-003-01)
- **Test Type**: positive
- **Priority**: P1
- **Input**: Read `src/claude/agents/quick-scan/quick-scan-agent.md`
- **Expected**: File contains `# ENHANCED SEARCH` or `## Enhanced Search` heading
- **Verification**: Regex match on file content

### TC-U-027: quick-scan-agent.md Enhanced Search describes structural and lexical modalities
- **Requirement**: FR-003 (AC-003-02)
- **Test Type**: positive
- **Priority**: P1
- **Input**: Read Enhanced Search section content
- **Expected**: Section mentions "modality: 'structural'" and "modality: 'lexical'" with token budget
- **Verification**: Regex match for both modalities

### TC-U-028: quick-scan-agent.md preserves existing Grep/Glob instructions
- **Requirement**: FR-003 (AC-003-04)
- **Test Type**: positive
- **Priority**: P1
- **Input**: Read full file content
- **Expected**: File still contains Grep/Glob references in the Process section
- **Verification**: Assert Grep and Glob appear in sections before Enhanced Search

### TC-U-037: quick-scan-agent.md describes hasEnhancedSearch() check
- **Requirement**: FR-003 (AC-003-03)
- **Test Type**: positive
- **Priority**: P1
- **Input**: Read Enhanced Search section content of `quick-scan-agent.md`
- **Expected**: Section mentions checking whether enhanced search is available (e.g., `hasEnhancedSearch()` or `search-config.json` check) to decide between direct Grep/Glob and the search abstraction
- **Verification**: Regex match for availability check pattern

### TC-U-029: quick-scan-agent.md frontmatter unchanged
- **Requirement**: FR-003 (AC-003-05)
- **Test Type**: negative
- **Priority**: P1
- **Input**: Read first 15 lines of file (frontmatter)
- **Expected**: Frontmatter matches expected agent name, model, skills (unchanged from before migration)
- **Verification**: Store pre-migration frontmatter hash; compare after migration

### TC-U-030: impact-analyzer.md contains Enhanced Search section
- **Requirement**: FR-004 (AC-004-01, AC-004-04)
- **Test Type**: positive
- **Priority**: P1
- **Input**: Read `src/claude/agents/impact-analysis/impact-analyzer.md`
- **Expected**: File contains "Enhanced Search" heading; section does not modify existing process steps
- **Verification**: Section presence check

### TC-U-031: entry-point-finder.md contains Enhanced Search section
- **Requirement**: FR-004 (AC-004-02, AC-004-04)
- **Test Type**: positive
- **Priority**: P1
- **Input**: Read `src/claude/agents/impact-analysis/entry-point-finder.md`
- **Expected**: File contains "Enhanced Search" heading with structural search guidance for endpoints
- **Verification**: Section presence and content check

### TC-U-032: risk-assessor.md contains Enhanced Search section
- **Requirement**: FR-004 (AC-004-03, AC-004-04)
- **Test Type**: positive
- **Priority**: P1
- **Input**: Read `src/claude/agents/impact-analysis/risk-assessor.md`
- **Expected**: File contains "Enhanced Search" heading with enhanced lexical search guidance
- **Verification**: Section presence and content check

### TC-U-033: impact analysis agent frontmatter unchanged
- **Requirement**: FR-004 (AC-004-05)
- **Test Type**: negative
- **Priority**: P1
- **Input**: Read frontmatter of all 3 impact analysis agent files
- **Expected**: Frontmatter identical to pre-migration state
- **Verification**: Hash comparison

### TC-U-034: architecture-analyzer.md contains Enhanced Search section
- **Requirement**: FR-005 (AC-005-01, AC-005-03)
- **Test Type**: positive
- **Priority**: P2
- **Input**: Read `src/claude/agents/discover/architecture-analyzer.md`
- **Expected**: File contains "Enhanced Search" heading; existing `find` patterns remain as fallback
- **Verification**: Section presence; existing patterns preserved

### TC-U-035: feature-mapper.md contains Enhanced Search section
- **Requirement**: FR-005 (AC-005-02, AC-005-03)
- **Test Type**: positive
- **Priority**: P2
- **Input**: Read `src/claude/agents/discover/feature-mapper.md`
- **Expected**: File contains "Enhanced Search" heading; existing Grep patterns remain
- **Verification**: Section presence; existing patterns preserved

### TC-U-036: discovery agent frontmatter unchanged
- **Requirement**: FR-005 (AC-005-04)
- **Test Type**: negative
- **Priority**: P2
- **Input**: Read frontmatter of architecture-analyzer.md and feature-mapper.md
- **Expected**: Frontmatter identical to pre-migration state
- **Verification**: Hash comparison

---

## Integration Tests: Setup Pipeline

### TC-I-001: init --force completes with search setup step
- **Requirement**: FR-001 (AC-001-01), FR-006 (AC-006-01)
- **Test Type**: positive
- **Priority**: P0
- **Precondition**: Temp directory with package.json and git init
- **Input**: `node bin/isdlc.js init --force` in temp dir
- **Expected**: Installer completes without error; output contains step "8/8" with "search" keyword; `.isdlc/` directory created
- **Verification**: Assert exit code 0; assert output contains "8/8"

### TC-I-002: init --force --no-search-setup skips step 8
- **Requirement**: FR-002 (AC-002-03)
- **Test Type**: positive
- **Priority**: P0
- **Precondition**: Temp directory with package.json and git init
- **Input**: `node bin/isdlc.js init --force --no-search-setup`
- **Expected**: Installer completes; output does NOT contain "8/8" or "search capabilities"; no `search-config.json` in `.isdlc/`
- **Verification**: Assert exit code 0; assert no search-config.json

### TC-I-003: init --force --dry-run shows search recommendations without changes
- **Requirement**: FR-002 (AC-002-05)
- **Test Type**: positive
- **Priority**: P1
- **Precondition**: Temp directory with package.json and git init
- **Input**: `node bin/isdlc.js init --force --dry-run`
- **Expected**: Installer output mentions "Would recommend" or similar; no `search-config.json` in `.isdlc/`; no `.claude/settings.json` modified
- **Verification**: Assert exit code 0; assert no config files

### TC-I-004: init --force produces search-config.json with baseline
- **Requirement**: FR-001 (AC-001-05, AC-001-06)
- **Test Type**: positive
- **Priority**: P0
- **Precondition**: Temp directory with package.json and git init; no enhanced search tools available
- **Input**: `node bin/isdlc.js init --force`
- **Expected**: `.isdlc/search-config.json` exists; contains `{ enabled: true, activeBackends: ['grep-glob'] }`
- **Verification**: Read and parse search-config.json; assert baseline fields

### TC-I-005: Error in search detection does not crash installer
- **Requirement**: FR-001 (AC-001-07)
- **Test Type**: negative
- **Priority**: P0
- **Precondition**: Temp directory; detection module patched to throw
- **Input**: `node bin/isdlc.js init --force`
- **Expected**: Installer completes; output contains warning about search issue; steps 1-7 artifacts all present
- **Verification**: Assert exit code 0; assert all pre-step-8 artifacts exist

### TC-I-006: --no-search-setup takes precedence over --force
- **Requirement**: FR-002 (AC-002-03)
- **Test Type**: positive
- **Priority**: P1
- **Precondition**: Temp directory with package.json and git init
- **Input**: `node bin/isdlc.js init --force --no-search-setup`
- **Expected**: Step 8 skipped; no search-config.json; no MCP configuration
- **Verification**: Assert no search artifacts

### TC-I-007: Step numbering sequential with no gaps in full install
- **Requirement**: FR-006 (AC-006-01, AC-006-03)
- **Test Type**: positive
- **Priority**: P1
- **Precondition**: Temp directory with package.json and git init
- **Input**: `node bin/isdlc.js init --force`
- **Expected**: Output contains step numbers 1/8 through 8/8 in order
- **Verification**: Parse output for step patterns; assert sequential

### TC-I-008: Installer backward compatibility -- existing dirs and files unaffected
- **Requirement**: FR-001 (AC-001-07)
- **Test Type**: positive
- **Priority**: P1
- **Precondition**: Temp directory with pre-existing `.claude/settings.json` containing user entries
- **Input**: `node bin/isdlc.js init --force`
- **Expected**: Pre-existing settings.json entries preserved; new entries added (if any)
- **Verification**: Read settings.json; assert original entries still present

---

## E2E Tests: User Journeys

### TC-E-001: New installation with search setup (UJ-01)
- **Requirement**: FR-001, FR-002, FR-006
- **Test Type**: positive
- **Priority**: P0
- **Precondition**: Clean temp directory with package.json
- **Input**: Full `isdlc init --force` flow
- **Expected**: All 8 steps complete; `.isdlc/search-config.json` exists with valid JSON; `.isdlc/state.json` exists; `.claude/` directory exists
- **Verification**: Full artifact presence check

### TC-E-002: Opt-out during installation (UJ-03)
- **Requirement**: FR-002 (AC-002-03)
- **Test Type**: positive
- **Priority**: P0
- **Precondition**: Clean temp directory with package.json
- **Input**: `isdlc init --force --no-search-setup`
- **Expected**: Steps 1-7 complete; no search-config.json; agents use Grep/Glob baseline
- **Verification**: Assert absence of search artifacts

### TC-E-003: Agent markdown integrity after migration
- **Requirement**: FR-003, FR-004, FR-005
- **Test Type**: positive
- **Priority**: P1
- **Precondition**: All 6 agent markdown files have been migrated
- **Input**: Read all 6 agent files
- **Expected**: Each file is valid markdown; each contains Enhanced Search section; each preserves existing structure; no syntax errors in markdown headers
- **Verification**: Parse each file; validate structure

---

## Security Tests

### TC-S-001: Path traversal rejected in setupSearchCapabilities
- **Requirement**: Article III (Security by Design)
- **Test Type**: negative
- **Priority**: P1
- **Input**: `setupSearchCapabilities('/tmp/../../etc', {})`
- **Expected**: Function handles safely; does not write config outside intended directory tree
- **Verification**: Assert no file operations on `/etc`

### TC-S-002: MCP server command injection prevented
- **Requirement**: Article III (Security by Design)
- **Test Type**: negative
- **Priority**: P1
- **Input**: Crafted backend with `command: "rm -rf / #"` passed to `configureMcpServers()`
- **Expected**: Command is written to config as-is (not executed during configuration); execution safety is the responsibility of Claude Code MCP runtime
- **Verification**: Assert configureMcpServers does not execute commands

### TC-S-003: Search config sanitization
- **Requirement**: Article III (Security by Design)
- **Test Type**: negative
- **Priority**: P2
- **Input**: Config with JavaScript injection in field values (e.g., `scaleTier: "__proto__"`)
- **Expected**: Config written as plain JSON; no prototype pollution
- **Verification**: Assert JSON.parse of written config has no prototype chain modifications

---

## Performance Tests

### TC-P-001: Detection completes within timeout
- **Requirement**: QA (Usability threshold)
- **Test Type**: positive
- **Priority**: P1
- **Input**: `detectSearchCapabilities(tmpDir)` on a small temp project
- **Expected**: Resolves within 5000ms
- **Verification**: Measure elapsed time; assert < 5000ms

### TC-P-002: Step 8 adds minimal overhead
- **Requirement**: QA (Usability threshold: <30s)
- **Test Type**: positive
- **Priority**: P2
- **Input**: `setupSearchCapabilities(tmpDir, {})` with mocked (fast-returning) dependencies
- **Expected**: Completes within 2000ms
- **Verification**: Measure elapsed time; assert < 2000ms

---

## Summary by Requirement Coverage

| Requirement | Test Cases | IDs |
|-------------|-----------|-----|
| FR-001 | 14 | TC-U-001 through TC-U-016, TC-I-001, TC-I-004, TC-I-005, TC-I-008, TC-E-001 |
| FR-002 | 9 | TC-U-003, TC-U-004, TC-U-017 through TC-U-021, TC-U-025, TC-I-002, TC-I-003, TC-I-006, TC-E-002 |
| FR-003 | 5 | TC-U-026 through TC-U-029, TC-U-037 |
| FR-004 | 4 | TC-U-030 through TC-U-033 |
| FR-005 | 3 | TC-U-034 through TC-U-036 |
| FR-006 | 3 | TC-U-023, TC-U-024, TC-I-007 |
| FR-007 | 1 | TC-U-022 |
| Security | 3 | TC-S-001 through TC-S-003 |
| Performance | 2 | TC-P-001, TC-P-002 |
