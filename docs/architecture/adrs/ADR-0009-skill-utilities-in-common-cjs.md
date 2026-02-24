# ADR-0009: Skill Utility Functions in common.cjs

## Status

Accepted

## Context

Six new utility functions are needed for custom skill management (REQ-0022):
- `validateSkillFrontmatter()` - Parse and validate skill file frontmatter
- `analyzeSkillContent()` - Scan skill body for phase-indicative keywords
- `suggestBindings()` - Produce binding suggestions from content analysis
- `writeExternalManifest()` - Write manifest JSON to correct path
- `formatSkillInjectionBlock()` - Format skill content based on delivery type
- `removeSkillFromManifest()` - Remove skill entry by name

These functions must be CommonJS (CON-005) and must use existing path resolution functions (CON-002).

Options for where to place them:
1. **common.cjs** (existing file): Add to the existing utility library
2. **New external-skills.cjs** module: Create a dedicated module
3. **Inline in isdlc.md**: Embed logic in the command prompt

## Decision

Add all six functions to `common.cjs`, grouped in a new section near the existing external skill path resolution functions (lines 424-697).

## Consequences

**Positive:**
- Consistent with existing pattern: all hook/command utilities live in common.cjs
- Functions are immediately available to all 26 hooks if needed in future
- Reuses existing `resolveExternalSkillsPath()`, `resolveExternalManifestPath()`, `loadExternalManifest()` without cross-module imports
- Unit-testable via existing `common.test.cjs` test infrastructure
- Single import for any consumer

**Negative:**
- common.cjs grows by ~200-300 lines (from 3122 to ~3400 lines)
- High coupling: all 26 hooks load common.cjs, so any syntax error in new functions could theoretically affect all hooks
- Risk mitigated by: new functions are additive (no existing exports modified), and hooks only call functions they explicitly reference

## Alternatives Considered

### New external-skills.cjs (Rejected)
- Would require new `require('./lib/external-skills.cjs')` in any consumer
- Splits related functions across files (path resolution in common.cjs, skill operations in external-skills.cjs)
- CON-002 says "extend but not replace" existing functions

### Inline in isdlc.md (Rejected)
- Markdown prompt files cannot export functions for testing
- Would duplicate logic between isdlc.md (for skill commands) and any future consumer

## Data Storage Decision

The external skills manifest (`external-skills-manifest.json`) is stored as a separate JSON file, not in `state.json`. Rationale:

- `state.json` is runtime state (Article XIV). External skills are project configuration.
- The manifest has its own lifecycle (persists across workflows, updated by skill commands, not by phase agents).
- Separation follows the existing pattern: `skills-manifest.json` (built-in skills) is separate from `state.json`.
- The manifest path is already resolved by `resolveExternalManifestPath()` in common.cjs.

## YAML Frontmatter Parsing Decision

A simple regex-based parser is used instead of a full YAML library:

- Pattern: `/^---\n([\s\S]*?)\n---/`
- Splits on newlines, then on first `: ` per line
- Handles the simple `key: value` format used in skill frontmatter
- Avoids adding `js-yaml` or similar dependency (Article V, Article XIII)
- Limitation: does not support multi-line values or nested structures. This is acceptable because skill frontmatter fields are all simple strings.

## Requirement Traceability

- FR-001 (Skill Acquisition): `validateSkillFrontmatter()`
- FR-002 (Smart Binding): `analyzeSkillContent()`, `suggestBindings()`
- FR-004 (Manifest Registration): `writeExternalManifest()`
- FR-005 (Runtime Injection): `formatSkillInjectionBlock()`
- FR-007 (Skill Removal): `removeSkillFromManifest()`
- CON-002 (Existing Infrastructure)
- CON-005 (Module System)
- Article V (Simplicity First)
- Article XIII (Module System Consistency)
