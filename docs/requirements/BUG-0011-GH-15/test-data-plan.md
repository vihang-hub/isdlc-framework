# Test Data Plan: BUG-0011-GH-15 — Skill Index Injection

**Traces to**: FR-01 through FR-05, AC-01 through AC-07

---

## Strategy

All test data is generated at runtime via the `createTestProject()` factory function in the test file. Each test creates an isolated temp directory mimicking an installed iSDLC project. No static fixture files are committed.

### Factory Function: `createTestProject(opts)`

Creates a minimal temp directory at `os.tmpdir()` with this structure:

```
tmpDir/
  .claude/
    hooks/
      config/
        skills-manifest.json    <-- Test manifest (configurable)
  .isdlc/
    state.json                  <-- Minimal state
  src/
    claude/
      skills/
        testing/
          skill-one/SKILL.md    <-- YAML format
          skill-two/SKILL.md    <-- YAML format (or missing/malformed)
          skill-three/SKILL.md  <-- Markdown format
        beta/
          beta-skill-one/SKILL.md
          beta-skill-two/SKILL.md
```

### Configuration Options

| Option | Effect | Used By |
|--------|--------|---------|
| `noManifest: true` | Omits skills-manifest.json entirely | TC-06.1 |
| `corruptManifest: true` | Writes invalid JSON as manifest | TC-06.2 |
| `noSkillFiles: true` | Omits all SKILL.md files | TC-06.5 |
| `removeSkillFile: true` | Removes skill-two/SKILL.md after creation | TC-06.4 |
| `createMalformedSkill: true` | Overwrites skill-two with no description | TC-03.3 |
| `createEmptySkill: true` | Overwrites skill-two as 0-byte file | TC-03.4 |
| `manifest: {...}` | Custom manifest object (overrides default) | TC-05.3 |

### Default Manifest

Three test agents:
- `test-agent-alpha`: 3 skills (TEST-001, TEST-002, TEST-003) -- 2 YAML + 1 Markdown format
- `test-agent-beta`: 2 skills (BETA-001, BETA-002) -- 2 YAML format
- `test-agent-empty`: 0 skills (empty skills array)

### SKILL.md Formats

**Format A (YAML frontmatter)**:
```yaml
---
name: skill-one
description: Execute the first test skill
skill_id: TEST-001
owner: test-agent
collaborators: []
project: test-project
version: 1.0.0
---

# skill-one

## Purpose
Execute the first test skill.
```

**Format B (Markdown headers)**:
```markdown
# TEST-003: skill-three

## Description
Execute the third test skill using markdown format

## Owner
- **Agent**: test-agent
- **Phase**: test-phase

## Usage
This skill is used for testing.
```

### Cleanup

Every test cleans up its temp directory in `after()` or at the end of the test case via `cleanupTestProject(tmpDir)`.

---

## Data Categories

| Category | Data Type | Generation Method |
|----------|-----------|-------------------|
| Valid manifest | JSON | Inline object in factory |
| Valid SKILL.md (YAML) | Text | Template string in `createSkillFile()` |
| Valid SKILL.md (Markdown) | Text | Template string in `createSkillFile()` |
| Corrupt manifest | Text | Literal invalid JSON string |
| Malformed SKILL.md | Text | Overwrite with title-only content |
| Empty SKILL.md | Empty file | 0-byte write |
| Missing SKILL.md | N/A | File deletion after creation |
| Custom manifest | JSON | `opts.manifest` override |

## Edge Cases Covered

1. Agent with 0 skills (empty array)
2. Agent not in manifest at all
3. Manifest doesn't exist
4. Manifest is corrupt JSON
5. SKILL.md missing for one skill (partial failure)
6. All SKILL.md files missing
7. SKILL.md with no description field
8. SKILL.md that is empty (0 bytes)
9. YAML description in quotes
10. Mixed YAML and Markdown formats for same agent
11. Different project roots (cache isolation)
