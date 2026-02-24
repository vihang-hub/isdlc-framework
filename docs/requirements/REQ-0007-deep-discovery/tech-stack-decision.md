# Tech Stack Decision: REQ-0007 Deep Discovery

**Feature**: Unify /discover under --deep flag with debate rounds
**Date**: 2026-02-09

---

## 1. Summary

No new runtime dependencies or technology changes. This feature is implemented entirely within the existing iSDLC framework stack. All changes are to markdown agent definitions, JSON configuration files, and documentation.

---

## 2. Technology Decisions

### Decision 1: Agent Definition Format

**Choice**: Markdown (.md) with YAML frontmatter

**Rationale**: All existing discover agents (D1-D15) use this format. D16-D19 follow the same pattern for consistency. No alternative considered -- this is the established framework convention (Article XIII: Module System).

### Decision 2: Configuration Format

**Choice**: JSON (deep-discovery-config.json)

**Rationale**: party-personas.json already uses JSON for persona configuration. Using the same format for debate round configuration maintains consistency. JSON is natively parseable by the orchestrator without additional dependencies.

### Decision 3: Debate Orchestration Pattern

**Choice**: Serial Task delegation (not TeamCreate/SendMessage)

**Rationale**:
- Existing project debate rounds are a structured cross-review, not a real-time conversation
- Task delegation is simpler, more predictable, and doesn't require team lifecycle management
- New project deep discovery (formerly party mode) KEEPS its TeamCreate/SendMessage pattern because it involves interactive user-facing conversation
- Two different patterns for two different interaction types

### Decision 4: Transcript Storage

**Choice**: Markdown files in `docs/requirements/reverse-engineered/debates/`

**Rationale**:
- Markdown is the standard artifact format throughout iSDLC
- Location under `reverse-engineered/` aligns with existing behavior extraction artifacts
- Files are always written regardless of --verbose setting (audit trail)

---

## 3. What Does NOT Change

| Component | Current | Change |
|-----------|---------|--------|
| Runtime | Node.js 18+ | None |
| Module system | ESM (lib/) + CJS (hooks/) | None |
| Test framework | node:test + node:assert/strict | None |
| CI/CD | GitHub Actions | None |
| Hooks | 10 .cjs hooks | None (0-1 minor update) |
| Package dependencies | 0 external deps | None |
| Package version | 0.1.0-alpha | None |

---

## 4. Compatibility

- **Node.js**: No version requirement changes (18+ remains)
- **Claude Code**: No changes to CLI integration
- **Hooks**: All fail-open, additive discovery_context fields ignored by existing hooks
- **State.json**: Additive envelope changes only, backward-compatible
- **Tests**: All 945 existing tests must continue to pass (NFR-003)
