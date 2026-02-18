# Test Cases: BUG-0011-GH-15 — Skill Index Injection

> Built-in skills (243 SKILL.md files) never injected into agent Task prompts at runtime

**Test Framework**: node:test (built-in Node.js test runner)
**Test Style**: CJS (CommonJS) — matches existing hooks test pattern
**Test File**: `src/claude/hooks/tests/skill-injection.test.cjs`
**Traces to**: FR-01 through FR-05, AC-01 through AC-07, NFR-01 through NFR-05

---

## Test Strategy Summary

This is a TDD bug fix. Tests are designed to **FAIL before the fix** (functions do not exist yet) and **PASS after implementation**. The test file will be created in Phase 05 (this phase) and run in Phase 06 to verify the fix.

### Test Categories

| Category | Count | Priority | Type |
|----------|-------|----------|------|
| Unit: getAgentSkillIndex() | 11 | P0 | Unit |
| Unit: formatSkillIndexBlock() | 5 | P0 | Unit |
| Unit: Description extraction | 5 | P0 | Unit |
| Integration: End-to-end flow | 2 | P0 | Integration |
| Caching behavior | 3 | P1 | Unit |
| Fail-open resilience | 5 | P0 | Unit |
| Agent file validation | 3 | P1 | Content verification |
| NFR validation | 4 | P2 | Non-functional |
| **Total** | **38** | | |

### Existing Infrastructure Used

- **Test runner**: `node --test` (same as `npm run test:hooks`)
- **Assert module**: `node:assert/strict`
- **Test location**: `src/claude/hooks/tests/` (alongside other hooks tests)
- **Naming convention**: `skill-injection.test.cjs` (CJS, kebab-case)
- **Module loading**: `require()` from `../lib/common.cjs`
- **Test environment**: `process.env.CLAUDE_PROJECT_DIR` for project root override
- **Cache management**: `_resetCaches()` (test-only export via `NODE_ENV=test`)
- **Temp directories**: `os.tmpdir()` + `fs.mkdtempSync()` (existing pattern)

---

## TC-01: getAgentSkillIndex() — Happy Path

**Traces to**: FR-01, AC-01

### TC-01.1: Returns correct entries for known agent with skills

**Given**: A valid skills-manifest.json with `software-developer` owning 14 skills, and corresponding SKILL.md files exist
**When**: `getAgentSkillIndex("software-developer")` is called
**Then**: Returns an array of 14 entries

**Assertions**:
- Result is an array
- Length equals 14
- First entry has properties: `id`, `name`, `description`, `path`
- Entry IDs match DEV-001 through DEV-014

### TC-01.2: Returns correct entries for another agent

**Given**: A valid manifest with `sdlc-orchestrator` owning 12 skills
**When**: `getAgentSkillIndex("sdlc-orchestrator")` is called
**Then**: Returns 12 entries with IDs ORCH-001 through ORCH-012

### TC-01.3: Returns empty array for unknown agent

**Given**: A valid manifest
**When**: `getAgentSkillIndex("unknown-agent")` is called
**Then**: Returns `[]` (empty array)

### TC-01.4: Returns empty array for null input

**Given**: A valid manifest
**When**: `getAgentSkillIndex(null)` is called
**Then**: Returns `[]`

### TC-01.5: Returns empty array for undefined input

**Given**: A valid manifest
**When**: `getAgentSkillIndex(undefined)` is called
**Then**: Returns `[]`

### TC-01.6: Returns empty array for empty string

**Given**: A valid manifest
**When**: `getAgentSkillIndex("")` is called
**Then**: Returns `[]`

### TC-01.7: All descriptions are non-empty strings

**Given**: A valid manifest and SKILL.md files
**When**: `getAgentSkillIndex("software-developer")` is called
**Then**: Every entry's `description` is a non-empty string (typeof === 'string', length > 0)

### TC-01.8: All paths point to SKILL.md files

**Given**: A valid manifest and SKILL.md files
**When**: `getAgentSkillIndex("software-developer")` is called
**Then**: Every entry's `path` ends with `/SKILL.md`

### TC-01.9: Entry structure matches expected schema

**Given**: A valid manifest and SKILL.md files
**When**: `getAgentSkillIndex("software-developer")` is called
**Then**: Each entry has exactly `{ id: string, name: string, description: string, path: string }`

### TC-01.10: Agent with no skills returns empty array

**Given**: A manifest where an agent exists but has `skills: []`
**When**: `getAgentSkillIndex("agent-with-no-skills")` is called
**Then**: Returns `[]`

### TC-01.11: Handles agent name normalization

**Given**: A valid manifest
**When**: `getAgentSkillIndex("Software-Developer")` is called (mixed case)
**Then**: Returns the same result as `getAgentSkillIndex("software-developer")` (normalized)

---

## TC-02: formatSkillIndexBlock() — Output Formatting

**Traces to**: FR-02, AC-02

### TC-02.1: Empty input returns empty string

**Given**: An empty array `[]`
**When**: `formatSkillIndexBlock([])` is called
**Then**: Returns `""` (empty string)

### TC-02.2: Single entry formats correctly

**Given**: Array with one entry `[{ id: "DEV-001", name: "code-implementation", description: "Write production code following designs and best practices", path: "src/claude/skills/development/code-implementation/SKILL.md" }]`
**When**: `formatSkillIndexBlock(entries)` is called
**Then**: Output contains:
- `AVAILABLE SKILLS` header on first line
- `DEV-001: code-implementation` on a line
- The description text
- The file path

### TC-02.3: Multiple entries format with all entries present

**Given**: Array with 3 entries
**When**: `formatSkillIndexBlock(entries)` is called
**Then**: Output contains all 3 skill IDs, all 3 names, all 3 descriptions, and all 3 paths

### TC-02.4: Header includes usage instruction

**Given**: Non-empty input
**When**: `formatSkillIndexBlock(entries)` is called
**Then**: Header line mentions "consult" and "Read tool" (instruction for the agent)

### TC-02.5: Output does not exceed 30 lines for 14-entry input

**Given**: Array with 14 entries (worst case: software-developer)
**When**: `formatSkillIndexBlock(entries)` is called
**Then**: Output split by `\n` has at most 30 lines (NFR-01)

---

## TC-03: Description Extraction — Dual Format Support

**Traces to**: FR-05, AC-05

### TC-03.1: YAML frontmatter format extraction

**Given**: A SKILL.md file with YAML frontmatter containing `description: Write production code following designs and best practices`
**When**: Description is extracted for this skill
**Then**: Returns `"Write production code following designs and best practices"`

### TC-03.2: Markdown header format extraction

**Given**: A SKILL.md file with `## Description` header followed by `Execute linter and report findings`
**When**: Description is extracted for this skill
**Then**: Returns `"Execute linter and report findings"`

### TC-03.3: YAML description with quotes

**Given**: A SKILL.md file with `description: "Quoted description text"`
**When**: Description is extracted
**Then**: Returns `"Quoted description text"` (quotes stripped)

### TC-03.4: Malformed SKILL.md falls back to name

**Given**: A SKILL.md file with no `description:` field and no `## Description` header
**When**: Description is extracted for this skill
**Then**: Returns the skill's `name` from the manifest as fallback

### TC-03.5: Empty SKILL.md file falls back to name

**Given**: An empty SKILL.md file (0 bytes)
**When**: Description is extracted
**Then**: Returns the skill's `name` from the manifest as fallback

---

## TC-04: Integration — End-to-End Flow

**Traces to**: FR-01, FR-02, AC-01, AC-02

### TC-04.1: Agent name to formatted block (full pipeline)

**Given**: Valid manifest, valid SKILL.md files with YAML frontmatter
**When**: `getAgentSkillIndex(agent)` is called, then result passed to `formatSkillIndexBlock()`
**Then**: Output is a non-empty string starting with `AVAILABLE SKILLS` and containing skill entries with descriptions extracted from SKILL.md files

### TC-04.2: Unknown agent produces empty block

**Given**: Valid manifest
**When**: `getAgentSkillIndex("nonexistent")` is called, then result passed to `formatSkillIndexBlock()`
**Then**: Output is `""` (empty string, no block injected)

---

## TC-05: Caching Behavior

**Traces to**: AC-07, NFR-02

### TC-05.1: Second call uses cache (no re-read)

**Given**: Valid manifest and SKILL.md files
**When**: `getAgentSkillIndex("software-developer")` is called twice
**Then**: Both calls return identical results; cache stats show config cache size > 0 after first call

### TC-05.2: Cache invalidation on manifest mtime change

**Given**: Valid manifest loaded and cached
**When**: Manifest file is modified (touch/rewrite), then `getAgentSkillIndex()` is called again
**Then**: New data is loaded (cache miss), and the result reflects the updated manifest

### TC-05.3: Cache does not leak between different project roots

**Given**: Two temp directories each with their own manifest
**When**: `getAgentSkillIndex()` is called with different `CLAUDE_PROJECT_DIR` values
**Then**: Each returns data from its own manifest, not the other's

---

## TC-06: Fail-Open Resilience

**Traces to**: FR-01, AC-06, NFR-03

### TC-06.1: Missing manifest returns empty array, no error

**Given**: No skills-manifest.json exists at any search path
**When**: `getAgentSkillIndex("software-developer")` is called
**Then**: Returns `[]`, does not throw

### TC-06.2: Corrupt manifest returns empty array, no error

**Given**: skills-manifest.json contains invalid JSON
**When**: `getAgentSkillIndex("software-developer")` is called
**Then**: Returns `[]`, does not throw

### TC-06.3: Agent not in manifest returns empty array

**Given**: Valid manifest that does not contain the agent
**When**: `getAgentSkillIndex("agent-not-in-manifest")` is called
**Then**: Returns `[]`

### TC-06.4: Unreadable SKILL.md skips that skill

**Given**: Manifest with 3 skills for agent; SKILL.md for skill #2 does not exist or is unreadable
**When**: `getAgentSkillIndex(agent)` is called
**Then**: Returns 2 entries (skills #1 and #3), does not throw; the unreadable skill is silently skipped

### TC-06.5: All SKILL.md files unreadable returns empty array

**Given**: Manifest with 3 skills for agent; all 3 SKILL.md files are missing
**When**: `getAgentSkillIndex(agent)` is called
**Then**: Returns `[]` (all skipped), does not throw

---

## TC-07: Agent File Validation

**Traces to**: FR-04, AC-04

### TC-07.1: All agent files with owned_skills have ## Skills section

**Given**: The 59 agent .md files in `src/claude/agents/` that have `owned_skills:` in their frontmatter
**When**: Each file is read
**Then**: Contains `## Skills` section with instruction text about "AVAILABLE SKILLS" and "Read tool"

**Note**: This test verifies the content modification done in implementation. It will FAIL before the fix (no agent files have `## Skills` section) and PASS after.

### TC-07.2: Agents without owned_skills are unchanged

**Given**: Agent .md files that do NOT have `owned_skills:` in their frontmatter
**When**: Each file is read
**Then**: Does NOT contain `## Skills` section

### TC-07.3: ## Skills section text matches expected instruction

**Given**: An agent file with `## Skills` section
**When**: The section text is extracted
**Then**: Contains both "AVAILABLE SKILLS" and "Read tool" references

---

## TC-08: Non-Functional Requirements

**Traces to**: NFR-01 through NFR-05

### TC-08.1: Token efficiency — max 30 lines per agent (NFR-01)

**Given**: Agent with 14 skills (maximum: software-developer)
**When**: `formatSkillIndexBlock()` is called with 14 entries
**Then**: Output has at most 30 lines

### TC-08.2: Performance — getAgentSkillIndex under 100ms (NFR-02)

**Given**: Valid manifest and SKILL.md files
**When**: `getAgentSkillIndex("software-developer")` is called with timing
**Then**: Execution time is under 100ms

### TC-08.3: Backward compatibility — no new dependencies (NFR-05)

**Given**: The project's package.json
**When**: Dependencies are read
**Then**: No new runtime dependencies have been added (still: chalk, fs-extra, prompts, semver)

### TC-08.4: Backward compatibility — no new hooks (NFR-05)

**Given**: The hooks directory
**When**: `.cjs` files are counted
**Then**: Count matches pre-fix count (no new hooks added)

---

## Test Execution Commands

```bash
# Run all skill injection tests
NODE_ENV=test node --test src/claude/hooks/tests/skill-injection.test.cjs

# Run as part of full hooks test suite
npm run test:hooks

# Run with verbose output
NODE_ENV=test node --test --test-reporter=spec src/claude/hooks/tests/skill-injection.test.cjs
```

## Test Data Requirements

See `docs/common/test-data-plan.md` for detailed fixture specifications. Key data:

1. **Mock skills-manifest.json** — Minimal manifest with 2-3 agents, each owning 2-3 skills
2. **Mock SKILL.md files** — YAML format and Markdown format examples
3. **Malformed SKILL.md** — Missing description, empty file
4. **Corrupt manifest** — Invalid JSON content
5. **Temp directory structure** — Mimics installed project layout
