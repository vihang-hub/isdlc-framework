# Test Data Plan: Wire Search Abstraction Layer into Setup Pipeline

**Requirement**: REQ-0042
**Phase**: 05 - Test Strategy & Design
**Last Updated**: 2026-03-03

---

## 1. Test Data Categories

### 1.1 Detection Results (mocked)

The `detectSearchCapabilities()` function returns a `DetectionResult` object. Tests need these variants:

**Valid detection results**:
```js
// Full detection with tools and recommendations
const fullDetection = {
  scaleTier: 'medium',
  fileCount: 45000,
  tools: [
    { name: 'ast-grep', installed: true, version: '0.25.0', installMethods: [] },
    { name: 'probe', installed: false, installMethods: [{ method: 'cargo', command: 'cargo install probe-mcp', available: true }] },
  ],
  recommendations: [
    {
      tool: { name: 'probe', installed: false, installMethods: [{ method: 'cargo', command: 'cargo install probe-mcp', available: true }] },
      reason: 'Provides enhanced lexical search with BM25 ranking',
      priority: 'recommended',
      installMethod: { method: 'cargo', command: 'cargo install probe-mcp', available: true },
    },
  ],
  existingMcpServers: [],
};

// Detection with no recommendations
const noRecsDetection = {
  scaleTier: 'small',
  fileCount: 500,
  tools: [],
  recommendations: [],
  existingMcpServers: [],
};

// Detection with multiple recommendations
const multiRecDetection = {
  scaleTier: 'large',
  fileCount: 200000,
  tools: [
    { name: 'ast-grep', installed: false, installMethods: [{ method: 'npm', command: 'npm install -g @ast-grep/cli', available: true }] },
    { name: 'probe', installed: false, installMethods: [{ method: 'cargo', command: 'cargo install probe-mcp', available: true }] },
  ],
  recommendations: [
    { tool: { name: 'ast-grep' }, reason: 'Structural search', priority: 'recommended', installMethod: { method: 'npm', command: 'npm install -g @ast-grep/cli', available: true } },
    { tool: { name: 'probe' }, reason: 'Enhanced lexical search', priority: 'recommended', installMethod: { method: 'cargo', command: 'cargo install probe-mcp', available: true } },
  ],
  existingMcpServers: [],
};
```

### 1.2 Installation Results (mocked)

```js
// Successful installation
const successInstall = { tool: 'ast-grep', success: true, version: '0.25.0', fallbackAvailable: true };

// Failed installation (system error)
const failedInstall = { tool: 'ast-grep', success: false, error: 'npm EACCES: permission denied', fallbackAvailable: true };

// User declined
const declinedInstall = { tool: 'probe', success: false, error: 'User declined installation', fallbackAvailable: true };
```

### 1.3 MCP Configuration Results (mocked)

```js
// Successful MCP config
const successMcp = { configured: ['ast-grep'], errors: [] };

// Partial success
const partialMcp = { configured: ['ast-grep'], errors: [{ tool: 'probe', code: 'CONFIG_SETTINGS_CORRUPT', message: 'settings.json contains invalid JSON' }] };

// Complete failure
const failedMcp = { configured: [], errors: [{ tool: 'ast-grep', code: 'CONFIG_WRITE_FAILED', message: 'Permission denied' }] };
```

### 1.4 CLI Arguments

```js
// Normal init
['init']

// With flags
['init', '--force']
['init', '--dry-run']
['init', '--no-search-setup']
['init', '--force', '--no-search-setup']
['init', '--dry-run', '--no-search-setup']
['--no-search-setup', 'init', '--force']  // Order independence

// Help
['help']
['--help']
['-h']
```

---

## Boundary Values

### Scale Tier Boundaries

| Input | Scale Tier | Notes |
|-------|-----------|-------|
| fileCount: 0 | 'tiny' | Empty project |
| fileCount: 1 | 'tiny' | Minimum non-empty |
| fileCount: 999 | 'tiny' | Upper bound of tiny |
| fileCount: 1000 | 'small' | Lower bound of small |
| fileCount: 9999 | 'small' | Upper bound of small |
| fileCount: 10000 | 'medium' | Lower bound of medium |
| fileCount: 99999 | 'medium' | Upper bound of medium |
| fileCount: 100000 | 'large' | Lower bound of large |
| fileCount: 1000000 | 'large' | Very large project |

### Recommendation Count Boundaries

| Count | Test Behavior |
|-------|--------------|
| 0 | No tools recommended; write baseline config |
| 1 | Single recommendation; one consent callback |
| 2 | Multiple recommendations; iterate all |
| 10 | Stress test (unlikely but validates loop) |

### Active Backends Boundaries

| Count | Test Behavior |
|-------|--------------|
| 1 | Baseline only (grep-glob) |
| 2 | One enhanced backend installed |
| 3 | Two enhanced backends installed |

### Path Length Boundaries

| Path | Test Behavior |
|------|--------------|
| `/tmp/a` | Short path (valid) |
| `/tmp/` + 'a'.repeat(200) | Long path (filesystem limit depends on OS; should handle gracefully) |
| `/tmp/path with spaces/project` | Spaces in path (common on macOS/Windows) |
| `/tmp/path-with-unicode-/project` | Unicode characters |

---

## Invalid Inputs

### setupSearchCapabilities Invalid Arguments

| Input | Expected Behavior |
|-------|-------------------|
| `projectRoot = null` | Caught by outer try-catch; warning logged |
| `projectRoot = undefined` | Caught by outer try-catch; warning logged |
| `projectRoot = ''` | Caught by outer try-catch; warning logged |
| `projectRoot = '/nonexistent/path'` | Detection fails; caught by outer try-catch |
| `options = null` | Destructuring defaults apply (force=false, dryRun=false) |
| `options = { force: 'yes' }` | Truthy string treated as true (JavaScript coercion) |

### parseArgs Invalid Arguments

| Input | Expected Behavior |
|-------|-------------------|
| `['--no-search-setup']` without command | `command: null`; `noSearchSetup: true` |
| `['--no-search-setup', '--no-search-setup']` | Duplicate flag; idempotent (still true) |
| `['--nosearchsetup']` | Unknown flag; ignored (noSearchSetup remains false/undefined) |
| `['--no_search_setup']` | Unknown flag; ignored (underscore vs hyphen) |
| `[]` | Empty args; command null; all options default |

### Detection Result Edge Cases

| Input | Expected Behavior |
|-------|-------------------|
| Detection returns `undefined` | Caught by outer try-catch |
| Detection returns `null` | Caught by outer try-catch |
| Detection returns `{ tools: null }` | TypeError caught by outer try-catch |
| Detection returns `{ recommendations: [] }` with missing scaleTier | buildConfig uses undefined scaleTier; written to config |

### Install Result Edge Cases

| Input | Expected Behavior |
|-------|-------------------|
| installTool returns `undefined` | Push undefined to results; caught later |
| installTool returns `{ success: undefined }` | Falsy; treated as failed |
| installTool throws Error | Caught by outer try-catch (entire step fails gracefully) |

---

## Maximum-Size Inputs

### Large Detection Results

```js
// Many tools detected (stress test)
const manyTools = {
  scaleTier: 'large',
  fileCount: 500000,
  tools: Array.from({ length: 50 }, (_, i) => ({
    name: `tool-${i}`,
    installed: i % 2 === 0,
    version: i % 2 === 0 ? '1.0.0' : null,
    installMethods: [{ method: 'npm', command: `npm install -g tool-${i}`, available: true }],
  })),
  recommendations: Array.from({ length: 25 }, (_, i) => ({
    tool: { name: `tool-${i * 2 + 1}` },
    reason: `Reason for tool-${i * 2 + 1}`,
    priority: 'recommended',
    installMethod: { method: 'npm', command: `npm install -g tool-${i * 2 + 1}`, available: true },
  })),
  existingMcpServers: [],
};
```

### Large Settings.json

```js
// settings.json with many existing MCP servers
const largeSettings = {
  mcpServers: Object.fromEntries(
    Array.from({ length: 100 }, (_, i) => [`server-${i}`, { command: `cmd-${i}`, args: [], env: {} }])
  ),
  otherSettings: { /* ... */ },
};
```

### Long Tool Names

```js
// Tool name at maximum practical length
const longToolName = 'a'.repeat(256);
// Recommendation with long tool name
const longNameRec = { tool: { name: longToolName }, reason: 'test', installMethod: { method: 'npm', command: `npm install -g ${longToolName}`, available: true } };
```

---

## 2. Test Environment Setup

### Temp Directory Setup

Every test creates an isolated temp directory using the existing `createTempDir()` / `cleanupTempDir()` helpers from `lib/utils/test-helpers.js`. The temp directory contains:

```
{tmpDir}/
  package.json          # Minimal: { "name": "test-project", "version": "1.0.0" }
  .git/                 # From `git init`
```

For integration tests that verify search-config.json output:
```
{tmpDir}/
  package.json
  .git/
  .isdlc/               # Created by installer
    search-config.json   # Created by step 8
  .claude/
    settings.json        # May be created/modified by configureMcpServers
```

### Mock Factory Functions

```js
// Create mocked detection module
function createDetectionMock(result) {
  return { detectSearchCapabilities: async () => result };
}

// Create mocked install module
function createInstallMock(results) {
  let callIndex = 0;
  return {
    installTool: async () => results[callIndex++] || { success: false, error: 'No more results' },
    configureMcpServers: async () => ({ configured: [], errors: [] }),
  };
}

// Create mocked config module
function createConfigMock() {
  let written = null;
  return {
    writeSearchConfig: (root, config) => { written = config; },
    getWritten: () => written,
  };
}

// Create mocked logger
function createLoggerMock() {
  const calls = { step: [], labeled: [], success: [], info: [], warning: [] };
  return {
    step: (...args) => calls.step.push(args),
    labeled: (...args) => calls.labeled.push(args),
    success: (...args) => calls.success.push(args),
    info: (...args) => calls.info.push(args),
    warning: (...args) => calls.warning.push(args),
    getCalls: () => calls,
  };
}
```

---

## 3. Test Data Generation Strategy

| Category | Generation Method | Rationale |
|----------|-------------------|-----------|
| Detection results | Hand-crafted fixtures | Small, well-defined shape; boundary cases need explicit values |
| Install results | Hand-crafted fixtures | Only 3 variants needed (success, failure, decline) |
| MCP config results | Hand-crafted fixtures | Only 3 variants needed |
| CLI arguments | Enumerated combinations | Flag set is small and finite |
| Temp directories | Dynamic (createTempDir) | Ensures filesystem isolation |
| Agent markdown files | Read from source tree | Tests validate actual files, not copies |
| Large inputs | Programmatic generation | Array.from() for stress test data |

No external test data files needed. All test data is defined inline in test files or via the factory functions above.
