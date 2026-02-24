# Technology Stack Decision: Custom Skill Management (REQ-0022)

**Version**: 1.0
**Created**: 2026-02-18
**Phase**: 03-architecture
**Status**: Accepted

---

## Decision Summary

This feature introduces no new technologies. All components use the existing iSDLC technology stack. The evaluation below confirms that the existing stack satisfies all requirements without additions.

---

## Utility Functions Layer

**Choice**: CommonJS in `common.cjs` (existing file, extend)
**Rationale**:
- CON-002 requires extending existing `resolveExternalSkillsPath()`, `resolveExternalManifestPath()`, `loadExternalManifest()` functions
- CON-005 requires any new utility functions to be CommonJS
- common.cjs is the established location for all hook/command utility functions (3122 lines, 100+ exports)
- All 26 hooks import common.cjs -- adding functions here makes them available to the entire hook system if needed in future

**Alternatives Considered**:
- New `external-skills.cjs` module: Would require new import in hooks that need it. Adds a new file to manage and sync. Rejected because CON-002 says "extend but not replace" existing functions, and the new functions logically belong next to the existing external skill path resolvers.
- ESM module in `lib/`: Would violate CON-005 (hooks are CJS) and Article XIII (module system consistency). Rejected.

**Requirement traceability**: CON-002, CON-005, Article XIII

---

## Command Layer

**Choice**: Markdown prompt in `isdlc.md` (existing file, extend)
**Rationale**:
- `isdlc.md` is the single command dispatcher for all `/isdlc` actions (feature, fix, upgrade, test, cancel, status)
- Adding `skill add/wire/list/remove` follows the same dispatch pattern
- No CLI code changes needed -- the markdown prompt guides Claude Code to handle the new actions

**Alternatives Considered**:
- Separate `skill.md` command file: Would split command dispatch across two files. Users would need to invoke `/skill` instead of `/isdlc skill`. Rejected for UX consistency.
- Node.js CLI subcommand (`bin/isdlc.js skill`): The skill management commands are interactive (wiring session), which requires LLM conversation. A traditional CLI subcommand cannot conduct multi-turn dialog. Rejected.

**Requirement traceability**: FR-001, FR-003, FR-006, FR-007

---

## Agent Layer

**Choice**: Markdown agent prompt (`skill-manager.md`, new file)
**Rationale**:
- The wiring session (FR-003) is a multi-step conversational interaction: present options, get user input, confirm, save
- Agents (.md prompts) are the established pattern for conversational multi-step interactions in iSDLC
- The skill-manager agent is delegated to by isdlc.md via the Task tool, consistent with all other agent invocations

**Alternatives Considered**:
- Inline wiring logic in isdlc.md: Would bloat the already-large command file (1407 lines) with conversational logic. Rejected for separation of concerns.
- Node.js interactive CLI (inquirer/prompts): Would require adding npm dependencies. The framework deliberately avoids runtime dependencies in hooks (Article XIII). Also cannot leverage LLM for smart defaults. Rejected.

**Requirement traceability**: FR-003, FR-009

---

## Data Layer

**Choice**: JSON manifest on filesystem (`external-skills-manifest.json`)
**Rationale**:
- Consistent with all other iSDLC configuration: state.json, skills-manifest.json, workflows.json, monorepo.json
- Already partially implemented: `resolveExternalManifestPath()` and `loadExternalManifest()` exist in common.cjs
- JSON is human-readable, easy to debug, and requires no dependencies to parse
- Filesystem storage is the only option (iSDLC has no database -- Article XIV, constitution preamble)

**Alternatives Considered**:
- Store bindings in state.json: state.json is runtime state (Article XIV). Skills are project configuration that persists across workflows. Mixing them would violate the separation established by the existing external-skills-manifest design. Rejected.
- YAML manifest: Would require a YAML parser dependency. JSON.parse is built-in. Rejected for simplicity (Article V).
- SQLite: Overkill for a list of up to 50 entries. Adds a dependency. Rejected (Article V).

**Requirement traceability**: FR-004, CON-002, Article XIV

---

## Skill File Format

**Choice**: Markdown with YAML frontmatter (`.md` files)
**Rationale**:
- CON-001 requires `.md` format
- YAML frontmatter provides machine-readable metadata (`name`, `description`, optional `owner`, `when_to_use`)
- Markdown body provides human-readable content that is injected into agent prompts
- This format is consistent with existing iSDLC skill files in `src/claude/skills/`

**Alternatives Considered**:
- JSON skill files: Harder for users to author domain knowledge as prose. Markdown is the natural format for instructions and guidelines. Rejected.
- Plain markdown (no frontmatter): Would require the user to separately provide skill name and description. Frontmatter is self-documenting. Rejected (Article IV -- explicit over implicit).

**Requirement traceability**: CON-001, FR-001, ASM-001

---

## YAML Frontmatter Parsing

**Choice**: Regex-based parser (inline in common.cjs)
**Rationale**:
- The frontmatter format is simple: delimited by `---` lines, contains `key: value` pairs
- Only 2 required fields (`name`, `description`) and 4 optional fields need parsing
- A regex-based parser avoids adding a YAML parsing dependency (js-yaml, yaml, etc.)
- Consistent with Article V (simplicity first) and the framework's zero-runtime-dependency philosophy for hooks

**Parser specification**:
```
1. Read file content
2. Match pattern: /^---\n([\s\S]*?)\n---/
3. Split matched group by newlines
4. For each line, split on first `: ` to get key-value pairs
5. Return { valid, errors, parsed } object
```

**Limitations**:
- Does not support multi-line YAML values
- Does not support YAML arrays (e.g., `dependencies: [a, b]`)
- These limitations are acceptable because skill frontmatter fields are all simple string values

**Alternatives Considered**:
- `js-yaml` npm package: Full YAML parser. Adds a dependency to hook runtime. Rejected (Article XIII -- hooks must use only require()-able built-in modules or dependencies already in node_modules).
- Node.js built-in: No built-in YAML parser exists in Node.js. Not an option.

**Requirement traceability**: FR-001, CON-005, Article V, Article XIII

---

## Intent Detection

**Choice**: Extend existing CLAUDE.md intent detection table
**Rationale**:
- CLAUDE.md already has a signal words / patterns table for feature, fix, upgrade, test, discovery
- Adding a "Skill mgmt" row follows the exact same pattern
- No code changes needed -- Claude Code reads the table and routes accordingly

**Alternatives Considered**:
- No alternative considered. This is the only mechanism for natural language intent detection in the framework.

**Requirement traceability**: FR-008

---

## Testing

**Choice**: Node.js `node:test` + `node:assert/strict` (CJS) for utility function tests
**Rationale**:
- All hook tests use this framework (existing convention, Article XIII)
- Tests will be in `src/claude/hooks/tests/` following existing naming pattern
- Focus: unit tests for the 6 new common.cjs functions + validation of injection behavior

**Requirement traceability**: Article II (test-first development)

---

## Evaluation Matrix

| Criterion | Weight | Decision | Score | Notes |
|-----------|--------|----------|-------|-------|
| Existing stack consistency | 30% | All existing | 10/10 | Zero new technologies |
| Runtime dependency count | 20% | Zero new deps | 10/10 | No npm additions |
| Team familiarity | 15% | Same stack | 10/10 | Dogfooding project, full expertise |
| Simplicity | 15% | Minimal additions | 9/10 | 6 new functions + 1 agent + 4 action branches |
| Performance | 10% | Filesystem I/O only | 9/10 | <100ms injection target (NFR-001) |
| Security | 10% | Local files only | 9/10 | No network, no secrets, no external services |
| **Weighted Total** | **100%** | | **9.7/10** | |
