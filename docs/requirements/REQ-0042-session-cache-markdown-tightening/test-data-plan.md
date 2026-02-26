# Test Data Plan: REQ-0042 Session Cache Markdown Tightening

| Field | Value |
|-------|-------|
| **Status** | Complete |
| **Phase** | 05 - Test Strategy |
| **Last Updated** | 2026-02-26 |
| **Coverage** | Realistic fixtures, boundary values, invalid inputs, maximum-size inputs |

---

## 1. Realistic Test Fixtures

### 1.1 Persona Content Fixture

A representative persona file matching the actual structure of `persona-business-analyst.md`:

| Component | Details |
|-----------|---------|
| YAML frontmatter | `name`, `description`, `primary_domain`, `default_phase` keys |
| Section 1 (Identity) | 3-5 bullet points with name, title, background |
| Section 2 (Principles) | 5-8 numbered items |
| Section 3 (Voice Integrity) | 4-6 rules as bullet points |
| Section 4 (Analytical Approach) | Subsections 4.1-4.5, each with 5-8 bullets (STRIPPED) |
| Section 5 (Interaction Style) | 3-5 behavioral guidelines |
| Section 6 (Artifact Responsibilities) | Subsections 6.1-6.3 (STRIPPED) |
| Section 7 (Self-Validation) | "Before writing" checklist (4 items), "Before finalization" checklist (3 items) |
| Section 8 (Artifact Folder Convention) | 2-3 paragraphs (STRIPPED) |
| Section 9 (Meta.json Protocol) | JSON template + rules (STRIPPED) |
| Section 10 (Constraints) | 5-8 bullet constraints (STRIPPED) |
| **Approximate size** | 5,000 chars per persona |

### 1.2 Topic Content Fixture

A representative topic file matching actual topic structure:

| Component | Details |
|-----------|---------|
| YAML frontmatter | `topic_id`, `topic_name`, `primary_persona`, `coverage_criteria`, `depth_guidance`, `source_step_files` |
| Analytical Knowledge section | 10-15 bullet points of domain knowledge |
| Validation Criteria section | 5-8 criteria for evaluating topic coverage |
| Artifact Instructions section | 3-5 instructions for output format |
| **Approximate size** | 2,500 chars per topic |

### 1.3 Discovery Content Fixture

A representative discovery report with mixed content:

| Component | Details |
|-----------|---------|
| Executive Summary heading | `## 1. Executive Summary` followed by 3-4 lines of prose |
| Architecture Overview table | `## 2. Architecture Overview` followed by a 6-row markdown table |
| Key Concerns list | `## 3. Key Concerns` followed by 5-8 `- ` list items |
| Tech Stack table | `## 4. Tech Stack` followed by a 4-row table |
| Test Health narrative | `## 5. Test Health` followed by 2 paragraphs of prose plus 1 table |
| **Approximate size** | 4,000 chars (test fixture, not full 22K report) |

### 1.4 Skill Index Fixture

An array of skill entry objects matching real data:

| Entry | Details |
|-------|---------|
| Entry 1 | `{id: 'DEV-001', name: 'code-implementation', description: 'Implement production code from design specs', path: 'src/claude/skills/development/code-implementation/SKILL.md'}` |
| Entry 2 | `{id: 'TST-001', name: 'unit-testing', description: 'Write unit tests for modules', path: 'src/claude/skills/testing/unit-testing/SKILL.md'}` |
| Entry 3 | `{id: 'QA-001', name: 'code-review', description: 'Review code for quality and standards', path: 'src/claude/skills/quality/code-review/SKILL.md'}` |
| Entry 4 | `{id: 'DOC-001', name: 'api-documentation', description: 'Generate API docs from code', path: 'src/claude/skills/documentation/api-documentation/SKILL.md'}` |
| Entry 5 | `{id: 'SEC-001', name: 'security-audit', description: 'Audit code for vulnerabilities', path: 'src/claude/skills/security/security-audit/SKILL.md'}` |

---

## 2. Boundary Values

### 2.1 tightenPersonaContent Boundaries

| Boundary | Input | Expected |
|----------|-------|----------|
| Empty string | `''` | `''` |
| Only frontmatter, no body | `'---\nname: test\n---'` | `''` (frontmatter stripped, nothing left) |
| Only section 1 (Identity) | Frontmatter + section 1 only | Section 1 content, frontmatter stripped |
| Only stripped sections (4,6,8,9,10) | Content with only sections 4 and 6 | Empty body (all sections stripped) |
| Section 7 with only "Before writing" | No "Before finalization" subsection | Single checklist from "Before writing" items |
| Section 7 with only "Before finalization" | No "Before writing" subsection | Single checklist from "Before finalization" items |
| Section 7 with empty checklists | `## 7. Self-Validation Protocol` heading but no items | Section 7 heading only |
| Single persona (1 of 3 expected) | Only one persona in ROUNDTABLE_CONTEXT | One block processed, no cross-contamination |

### 2.2 tightenTopicContent Boundaries

| Boundary | Input | Expected |
|----------|-------|----------|
| Empty string | `''` | `''` |
| Frontmatter only, no content | `'---\ntopic_id: x\n---'` | `''` (frontmatter stripped, nothing left) |
| No frontmatter | Content without `---` delimiters | Input returned unchanged |
| Single `---` (malformed) | `'---\ntopic_id: x\nbody content'` | Input returned unchanged (no closing `---`) |
| Content immediately after closing `---` | `'---\nk: v\n---\ncontent'` (no blank line) | `'content'` |

### 2.3 condenseDiscoveryContent Boundaries

| Boundary | Input | Expected |
|----------|-------|----------|
| Empty string | `''` | `''` |
| Only headings | `'## H1\n## H2\n## H3'` | Same as input (nothing to strip) |
| Only tables | `'| a | b |\n| - | - |\n| 1 | 2 |'` | Same as input |
| Only prose | `'This is prose.\nMore prose here.'` | `''` (all stripped, blank lines collapsed to empty) |
| Only list items | `'- item1\n- item2\n* item3\n1. item4'` | Same as input |
| Mixed: table row followed by prose | `'| a | b |\nSome prose.'` | `'| a | b |'` |
| Numbered list item at line start | `'42. item at position 42'` | Preserved as list item |

### 2.4 formatSkillIndexBlock Boundaries

| Boundary | Input | Expected |
|----------|-------|----------|
| Empty array | `[]` | `''` |
| Single skill entry | Array with 1 entry | One formatted line |
| Skill with no description | `{id: 'X-001', name: 'x', description: '', path: '...'}` | `'  X-001: x |  | category/name'` |
| Path with unexpected structure | `{path: 'SKILL.md'}` (no directory segments) | Graceful handling (empty or minimal path segment) |
| Path with extra segments | `{path: 'a/b/c/d/e/SKILL.md'}` | Last two segments before SKILL.md used |

---

## 3. Invalid Inputs

### 3.1 Type Errors

| Function | Input | Expected |
|----------|-------|----------|
| `tightenPersonaContent(null)` | null | `''` |
| `tightenPersonaContent(undefined)` | undefined | `''` |
| `tightenPersonaContent(42)` | number | `''` |
| `tightenPersonaContent(true)` | boolean | `''` |
| `tightenPersonaContent({})` | object | `''` |
| `tightenPersonaContent([])` | array | `''` |
| `tightenTopicContent(null)` | null | `''` |
| `tightenTopicContent(42)` | number | `''` |
| `condenseDiscoveryContent(null)` | null | `''` |
| `condenseDiscoveryContent(42)` | number | `''` |
| `formatSkillIndexBlock(null)` | null | `''` |
| `formatSkillIndexBlock('string')` | string | `''` |
| `formatSkillIndexBlock(42)` | number | `''` |

### 3.2 Malformed Content

| Function | Input | Expected |
|----------|-------|----------|
| `tightenPersonaContent` | Content with `##` but no section numbers | Sections not matched for stripping; content returned with frontmatter stripped |
| `tightenPersonaContent` | Content with non-standard heading levels (`###` instead of `##`) | Content returned with frontmatter stripped (no `## ` sections to parse) |
| `tightenTopicContent` | Content with `---` inside body (not frontmatter) | Only first `---...---` block treated as frontmatter |
| `condenseDiscoveryContent` | Content with `|` in middle of prose line | Full line treated as prose (only leading `|` triggers table preservation) |

---

## 4. Maximum-Size Inputs

### 4.1 Performance Boundary Fixtures

| Fixture | Size | Purpose |
|---------|------|---------|
| Large persona | ~10,000 chars (2x typical) | Verify no performance degradation for oversized persona |
| Large discovery report | ~50,000 chars (~2.5x typical) | Verify condenseDiscoveryContent handles full-size discovery reports |
| Large skill index | 100 skills per agent, 5 agents (500 entries) | Verify formatSkillIndexBlock scales linearly |
| Full realistic cache | ~177,000 chars (matching real cache) | End-to-end integration test with real data sizes |

### 4.2 Performance Budget

| Function | Input Size | Budget |
|----------|-----------|--------|
| `tightenPersonaContent` | 5,000 chars | < 5ms |
| `tightenPersonaContent` | 10,000 chars | < 10ms |
| `tightenTopicContent` | 2,500 chars | < 2ms |
| `condenseDiscoveryContent` | 22,000 chars | < 10ms |
| `condenseDiscoveryContent` | 50,000 chars | < 25ms |
| `formatSkillIndexBlock` | 50 entries | < 5ms |
| `formatSkillIndexBlock` | 500 entries | < 20ms |
| Full `rebuildSessionCache()` | ~177,000 chars input | < 500ms |

---

## 5. Test Data Generation Strategy

All test data is generated inline within the test file using string template literals. No external fixture files are required.

### 5.1 Helper Functions

| Helper | Purpose |
|--------|---------|
| `buildPersonaFixture(sections)` | Assembles a realistic persona string from section content map |
| `buildTopicFixture(hasFrontmatter)` | Assembles a topic string with or without frontmatter |
| `buildDiscoveryFixture(components)` | Assembles a discovery report with specified components (tables, prose, lists) |
| `buildSkillEntries(count)` | Generates an array of N skill entry objects with unique IDs and paths |

### 5.2 Approach

- Test data defined as `const` at the top of each `describe` block
- Realistic data derived from actual file excerpts (persona-business-analyst.md, topic files, discovery report)
- Boundary and invalid inputs defined inline per test case
- No external file I/O for test data (everything in-memory)
- `createFullTestProject()` helper extended for integration tests requiring a full project directory
