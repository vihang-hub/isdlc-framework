# Architecture Overview: Wire Search Abstraction Layer into Setup Pipeline

**Status**: Draft
**Confidence**: High
**Last Updated**: 2026-03-03
**Coverage**: Architecture Options (high), Selected Architecture (high), Technology Decisions (high), Integration Architecture (high)

---

## 1. Architecture Options

### Option A: Inline Integration (Add Code Directly to install())

Add the search setup logic directly inside the `install()` function in `lib/installer.js`, alongside existing steps.

| Aspect | Assessment |
|--------|------------|
| **Pros** | Simplest implementation; no new files; everything in one place |
| **Cons** | install() already ~900 lines; harder to test search setup in isolation; violates single responsibility |
| **Pattern** | Monolithic function |
| **Verdict** | Rejected -- install() is already large; adding 80+ lines inline reduces maintainability |

### Option B: Extracted Function in installer.js (Recommended)

Extract search setup as a dedicated `setupSearchCapabilities(projectRoot, options)` function within `lib/installer.js`. The main `install()` function calls it as step 8.

| Aspect | Assessment |
|--------|------------|
| **Pros** | Testable in isolation; install() stays clean with a single call; consistent with how other complex steps could be extracted; no new files needed |
| **Cons** | Still in installer.js (file grows); could argue for a separate module |
| **Pattern** | Extracted function, same module |
| **Verdict** | Selected -- best balance of simplicity and testability |

### Option C: Separate Pipeline Module

Create a new `lib/search-setup.js` module that exports the setup function. Installer imports and calls it.

| Aspect | Assessment |
|--------|------------|
| **Pros** | Clean separation; dedicated test file; installer stays thin |
| **Cons** | Adds a new module for what is essentially a thin orchestration over existing lib/search/ modules; over-abstraction |
| **Pattern** | Module extraction |
| **Verdict** | Deferred -- acceptable if installer.js grows further; not needed now |

## 2. Selected Architecture

### ADR-001: Extracted Function in installer.js

**Decision**: Implement search setup as an extracted `setupSearchCapabilities()` function within `lib/installer.js`. The function orchestrates calls to `detectSearchCapabilities()`, `installTool()`, `configureMcpServers()`, and `writeSearchConfig()`.

**Rationale**:
- The search setup step is an orchestration of existing, tested modules -- not new logic
- Extracting to a named function makes it testable and readable
- Keeping it in installer.js maintains the single-file pattern for the installation pipeline
- The function can be exported for unit testing without exposing it to external consumers

**Consequences**:
- installer.js gains ~80 lines (function definition + call site)
- The step is entirely wrapped in try-catch for fail-safe behavior
- Future extraction to a separate module is trivial if installer.js grows too large

### ADR-002: Agent Migration via Additive Markdown Sections

**Decision**: Migrate agents by adding new sections to their markdown files. Do not modify existing sections, frontmatter, or process steps.

**Rationale**:
- Agent files are parsed by hooks (skills-manifest, iteration-requirements) -- structural changes could break parsing
- Additive sections are zero-risk to existing behavior
- Agents' existing Grep/Glob instructions serve as the documented fallback path
- The new sections are guidance for when search abstraction is available, not a replacement

**Consequences**:
- Each migrated agent gains a 15-30 line section
- The section placement must not interfere with frontmatter or existing ## headings
- Future agents can follow the same pattern

### ADR-003: Fail-Open Search Setup

**Decision**: The entire search setup step is wrapped in a top-level try-catch. Any failure (detection, installation, MCP configuration, config write) logs a warning and continues. The installer always completes successfully.

**Rationale**:
- Search setup is an enhancement, not a requirement
- Users on restricted systems (air-gapped, corporate policies) must not be blocked
- Aligns with REQ-0041's ADR-003 (Auto-Detect with Opt-Out)
- The `--no-search-setup` flag provides explicit opt-out

**Consequences**:
- Search setup failures produce warnings, never errors
- The installer's exit code is unaffected by search setup issues
- Users may need to re-run detection if a transient failure occurred

## 3. Technology Decisions

### No New Dependencies

This requirement introduces zero new dependencies. All called modules are already implemented in `lib/search/`:

| Module | Already Exists | Tests Exist |
|--------|---------------|-------------|
| `lib/search/detection.js` | Yes | Yes |
| `lib/search/install.js` | Yes | Yes |
| `lib/search/config.js` | Yes | Yes |
| `lib/search/router.js` | Yes (not called during setup) | Yes |
| `lib/search/registry.js` | Yes (not called during setup) | Yes |

### Existing Prompt Utilities Reused

The installer already imports `confirm`, `select`, and `text` from `lib/utils/prompts.js`. The search setup step uses `confirm()` for consent (or auto-accept under `--force`).

## 4. Integration Architecture

### Setup Pipeline Flow (Step 8)

```
lib/installer.js install()
  |
  +-- Steps 1-7 (unchanged)
  |
  +-- Step 8: Search Setup
  |     |
  |     +-- Check: options.noSearchSetup?
  |     |     +-- true  -> skip entirely
  |     |     +-- false -> continue
  |     |
  |     +-- Check: options.dryRun?
  |     |     +-- true  -> detect only, report, no install
  |     |
  |     +-- detectSearchCapabilities(projectRoot)
  |     |     -> DetectionResult { scaleTier, fileCount, tools, recommendations }
  |     |
  |     +-- Display findings to user
  |     |     "Your project has ~{N} files ({tier} scale)."
  |     |     "Detected: {tool} {version}" (for each installed tool)
  |     |     "Recommended: {tool} -- {reason}" (for each recommendation)
  |     |
  |     +-- For each recommendation:
  |     |     +-- options.force? -> auto-accept
  |     |     +-- else -> confirm("Install {tool}? ({command})")
  |     |     |
  |     |     +-- accepted -> installTool(recommendation, consentCallback)
  |     |     |     +-- success -> record
  |     |     |     +-- failure -> warn, continue
  |     |
  |     +-- If any tools installed:
  |     |     +-- configureMcpServers(installed, settingsPath)
  |     |
  |     +-- writeSearchConfig(projectRoot, config)
  |     |
  |     +-- catch (error) -> logger.warning("Search setup failed: ...")
  |
  +-- Remaining steps (manifest, CLAUDE.md, etc.)
```

### CLI Flag Integration

```
lib/cli.js parseArgs()
  |
  +-- '--no-search-setup' flag detected
  |     -> options.noSearchSetup = true
  |
  +-- Passed to install(projectRoot, options)
  |     -> Step 8 checks options.noSearchSetup
```

### Agent Migration Pattern

```
// In agent .md file:

# ENHANCED SEARCH (Optional)

If the search abstraction layer is configured (via `isdlc init`), you can
use enhanced search capabilities:

## Structural Search (ast-grep)
Use when searching for code patterns (function definitions, class usage):
- Request modality: 'structural'
- Example: Find all async functions matching a pattern

## Enhanced Lexical Search (Probe)
Use when searching for text with relevance ranking:
- Request modality: 'lexical' (routes to Probe if available, Grep if not)
- Example: Find all references to a module with BM25 ranking

## Fallback
If enhanced search is not configured or unavailable, use the standard
Grep/Glob tools described in the main Process section above.
```

## 5. Summary

The architecture is intentionally minimal: one extracted function in the installer, one CLI flag, and additive markdown sections in 6 agent files. This approach:

- **Wires existing modules**: No new search logic; only calls to already-implemented, tested `lib/search/` functions
- **Preserves stability**: Fail-open design; existing steps untouched; agent fallback paths preserved
- **Enables incremental adoption**: Users opt in during setup; agents describe both enhanced and baseline paths
- **Keeps future options open**: Can extract to separate module later; can wire into `/discover` in a follow-on requirement
