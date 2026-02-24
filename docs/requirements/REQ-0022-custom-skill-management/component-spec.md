# Component Specification: Custom Skill Management (REQ-0022)

**Phase**: 04-design
**Version**: 1.0
**Created**: 2026-02-18
**Traces to**: FR-001 through FR-009

---

## 1. Reusable Components

### 1.1 Frontmatter Parser

**Component ID**: C-001
**Location**: `common.cjs` (within `validateSkillFrontmatter`)
**Reusable by**: Any future feature needing YAML frontmatter parsing

**Interface**:
- Input: Raw file content string
- Output: `{ parsed: { key: value, ... }, body: string }`

**Pattern**: Simple regex + line split parser per ADR-0009. Does not use js-yaml. Handles `key: value` pairs on individual lines. Does not support multi-line values, nested objects, or YAML arrays (not needed for skill frontmatter).

**Parsing rules**:
1. Match frontmatter block: `/^---\n([\s\S]*?)\n---/`
2. Split matched content on `\n`
3. For each line, split on first `: ` (colon-space) occurrence
4. Left side = key (trimmed), right side = value (trimmed)
5. Body = everything after the closing `---`

### 1.2 Keyword Analyzer

**Component ID**: C-002
**Location**: `common.cjs` (within `analyzeSkillContent`)
**Reusable by**: Any future feature needing content-based phase routing

**Interface**:
- Input: Text content string
- Output: `{ keywords: string[], suggestedPhases: string[], confidence: string }`

**Configuration**: Driven by `SKILL_KEYWORD_MAP` constant. Adding new keyword categories requires only adding entries to this map.

### 1.3 Binding Suggester

**Component ID**: C-003
**Location**: `common.cjs` (within `suggestBindings`)
**Reusable by**: Any future feature needing phase-to-agent resolution

**Interface**:
- Input: Analysis result + optional frontmatter hints
- Output: `{ agents: string[], phases: string[], delivery_type: string, confidence: string }`

**Configuration**: Driven by `PHASE_TO_AGENT_MAP` constant. Adding new phase-agent mappings requires only adding entries to this map.

### 1.4 Injection Block Formatter

**Component ID**: C-004
**Location**: `common.cjs` (within `formatSkillInjectionBlock`)
**Reusable by**: Any future feature needing formatted content blocks in prompts

**Interface**:
- Input: name, content, deliveryType
- Output: Formatted string block

**Delivery templates**:
| Type | Template |
|------|----------|
| context | `EXTERNAL SKILL CONTEXT: {name}\n---\n{content}\n---` |
| instruction | `EXTERNAL SKILL INSTRUCTION ({name}): You MUST follow these guidelines:\n{content}` |
| reference | `EXTERNAL SKILL AVAILABLE: {name} -- Read from {content} if relevant to your current task` |

### 1.5 Wiring Session UI

**Component ID**: C-005
**Location**: `skill-manager.md`
**Reusable by**: Not reusable (agent-specific)

**UI pattern**: Menu-driven conversational interface with:
1. Grouped multi-select list (phases grouped by workflow category)
2. Single-select radio (delivery type: C/I/R)
3. Confirmation menu (S/A/X)

---

## 2. Component Interaction Diagram

```
                    User Input
                        |
                        v
                  [CLAUDE.md]          (C-005 not directly invoked)
                  Intent Detection
                        |
                        v
                  [isdlc.md]
                  Command Dispatcher
                     /    \
                    /      \
                   v        v
          [skill actions]  [STEP 3d injection]
                |                  |
                |                  v
                |          [loadExternalManifest]
                |                  |
                |                  v
                |          [C-004: formatSkillInjectionBlock]
                |                  |
                v                  v
        [C-001: Parser]    [Delegation Prompt + Skill Blocks]
                |
                v
        [C-002: Analyzer]
                |
                v
        [C-003: Suggester]
                |
                v
        [C-005: Wiring Session]
                |
                v
        [writeExternalManifest]
```

---

## 3. Component Test Requirements

Each component has specific test requirements documented in the test strategy phase. Summary:

| Component | Unit Testable | Test Approach |
|-----------|--------------|---------------|
| C-001 (Parser) | Yes | Test via common.test.cjs: valid files, missing fields, malformed YAML, empty files |
| C-002 (Analyzer) | Yes | Test via common.test.cjs: various content patterns, empty content, no matches |
| C-003 (Suggester) | Yes | Test via common.test.cjs: analysis results, frontmatter hints, edge cases |
| C-004 (Formatter) | Yes | Test via common.test.cjs: each delivery type, unknown type, empty content |
| C-005 (Wiring UI) | No (agent) | Integration test only: full wiring session flow |
