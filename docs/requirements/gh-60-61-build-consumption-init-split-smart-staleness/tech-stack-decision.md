# Technology Stack Decision: Build Consumption -- Init Split & Smart Staleness

**Feature**: GH-60 + GH-61 (Feature B: Build Consumption)
**Phase**: 03-architecture
**Status**: Draft
**Created**: 2026-02-20

---

## Summary

No new technologies are introduced by this feature. All changes are within the existing technology stack.

---

## Existing Stack (Unchanged)

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Runtime | Node.js | 18+ (LTS) | Framework target runtime |
| Module System | CommonJS (.cjs) | N/A | Hook files use .cjs extension for explicit CommonJS (package.json has "type": "module") |
| Testing | node:test + node:assert/strict | Built-in | No external test dependencies |
| Version Control | Git | 2.x+ | Required for branch management and diff operations |
| CLI | Claude Code | Current | Host platform for agent execution |
| Configuration | JSON | N/A | state.json, meta.json, workflows.json |
| Agent Definitions | Markdown | N/A | .md files define agent behavior |

---

## Technology Decisions for This Feature

### 1. Git CLI (git diff --name-only)

**Usage**: Blast-radius staleness check invokes `git diff --name-only {hash}..HEAD` to determine which files changed since analysis.

**Decision**: Use `child_process.execSync` (already used throughout the framework for git operations in hooks and the orchestrator).

**Rationale**:
- `execSync` is the existing pattern in the codebase (blast-radius-validator, branch-guard, orchestrator all use it)
- The operation is fast (<100ms for typical repos) and synchronous execution is acceptable
- No new npm dependencies required
- The framework already assumes git availability (CON-004)

**Alternative considered**: Using a JavaScript git library (e.g., isomorphic-git). Rejected -- adds a dependency for a single lightweight operation that the existing git CLI handles perfectly.

### 2. Regex-Based Markdown Parsing

**Usage**: `extractFilesFromImpactAnalysis()` parses a markdown table using regex.

**Decision**: Continue using regex-based line-by-line parsing, consistent with `parseImpactAnalysis()` in blast-radius-validator.cjs and `parseSizingFromImpactAnalysis()` in common.cjs.

**Rationale**:
- The framework already uses this pattern in two other modules
- The table format is simple and predictable (pipe-delimited with backtick-wrapped paths)
- A full markdown parser (e.g., remark) would be overkill for extracting file paths from a single table section
- Regex parsing is fast (sub-millisecond for typical inputs)

**Alternative considered**: Using a markdown AST parser (remark/unified). Rejected -- massive dependency tree for a 10-line regex operation.

### 3. Set-Based Intersection

**Usage**: Computing the overlap between changed files and blast radius files.

**Decision**: Use native JavaScript `Set` for O(1) membership checks.

**Rationale**:
- No library needed -- Set is built into Node.js
- Performance is O(n + m) where n = blast radius size, m = changed file count
- Clean, readable code

---

## Dependencies

No new dependencies (npm packages, system tools, or external services) are added by this feature.

| Existing Dependency | Used By This Feature | New Usage? |
|--------------------|-----------------------|-----------|
| `child_process.execSync` | checkBlastRadiusStaleness() -- git diff | No (already used by hooks/orchestrator) |
| `fs.readFileSync` | Reading impact-analysis.md in isdlc.md Step 4b | No (already used throughout) |
| `path.normalize` | Path normalization in extractFilesFromImpactAnalysis() | No (already used) |

---

## Conclusion

This feature is a pure refactor and enhancement within the existing technology boundaries. The architectural decisions prioritize consistency with existing patterns (regex parsing, execSync for git, CommonJS modules) and avoid introducing new dependencies.
