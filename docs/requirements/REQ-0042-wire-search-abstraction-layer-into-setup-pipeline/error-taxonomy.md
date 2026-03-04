# Error Taxonomy: Wire Search Abstraction Layer into Setup Pipeline

**Status**: Draft
**Confidence**: High
**Last Updated**: 2026-03-03
**Coverage**: Setup Errors (high), Agent Errors (high)

---

## 1. Setup Pipeline Errors

All errors in step 8 are non-fatal. The outer try-catch ensures the installer always completes.

### ERR-SETUP-001: Detection Failure

| Field | Value |
|-------|-------|
| **Code** | `ERR-SETUP-001` |
| **Severity** | Warning |
| **Source** | `detectSearchCapabilities()` throws |
| **User Message** | "Search setup encountered an issue: {error.message}" |
| **Recovery** | Skip entire step 8; continue installer. No search config created. |
| **Downstream Impact** | Agents use Grep/Glob baseline. User can re-run detection later. |

### ERR-SETUP-002: Tool Installation Failure

| Field | Value |
|-------|-------|
| **Code** | `ERR-SETUP-002` |
| **Severity** | Warning |
| **Source** | `installTool()` returns `{ success: false }` |
| **User Message** | "Could not install {tool}: {error}" |
| **Recovery** | Continue to next recommendation. Write config with whatever succeeded. |
| **Downstream Impact** | Specific backend unavailable; others may still work. |

### ERR-SETUP-003: MCP Configuration Failure

| Field | Value |
|-------|-------|
| **Code** | `ERR-SETUP-003` |
| **Severity** | Warning |
| **Source** | `configureMcpServers()` returns errors |
| **User Message** | "MCP config: {error.message}" |
| **Recovery** | Continue to config write. Search config independent of MCP success. |
| **Downstream Impact** | Tool installed but MCP not configured; backend not usable via router. |

### ERR-SETUP-004: Config Write Failure

| Field | Value |
|-------|-------|
| **Code** | `ERR-SETUP-004` |
| **Severity** | Warning |
| **Source** | `writeSearchConfig()` throws |
| **User Message** | "Search setup encountered an issue: {error.message}" |
| **Recovery** | Caught by outer try-catch. Installer continues. |
| **Downstream Impact** | No search-config.json; router uses defaults (grep-glob only). |

### ERR-SETUP-005: Settings.json Corruption

| Field | Value |
|-------|-------|
| **Code** | `ERR-SETUP-005` |
| **Severity** | Warning |
| **Source** | `configureMcpServers()` finds invalid JSON in settings.json |
| **User Message** | "MCP config: settings.json contains invalid JSON, preserving original" |
| **Recovery** | MCP configuration skipped. Existing settings.json untouched. |
| **Downstream Impact** | Same as ERR-SETUP-003. |

## 2. Installation-Specific Errors (from lib/search/install.js)

These are already defined in REQ-0041. The setup pipeline maps them to user-facing warnings:

| Error Code | Meaning | User Message Prefix |
|------------|---------|---------------------|
| `INSTALL_PERMISSION_DENIED` | npm/cargo cannot write to install location | "Permission denied" |
| `INSTALL_NETWORK_FAILURE` | Download failed | "Network error" |
| `INSTALL_UNSUPPORTED_PLATFORM` | Tool not available for this OS | "Not available on this platform" |
| `INSTALL_VERSION_CONFLICT` | Dependency version conflict | "Version conflict" |
| `INSTALL_PACKAGE_MANAGER_MISSING` | Required package manager not found | "Package manager not found" |
| `INSTALL_UNKNOWN` | Unclassified error | "Installation failed" |
| `INSTALL_INVALID` | Invalid recommendation object | "Invalid recommendation" |

## 3. No Agent-Level Errors

Agent markdown changes do not introduce new error conditions. The search abstraction's error handling (fallback, degradation notifications) is already implemented in REQ-0041's `lib/search/router.js`. Agent instructions describe using the router; the router handles all errors internally.
