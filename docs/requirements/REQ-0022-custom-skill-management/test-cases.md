# Test Cases: Custom Skill Management (REQ-0022)

**Phase**: 05-test-strategy
**Version**: 1.0
**Created**: 2026-02-18
**Test File**: `src/claude/hooks/tests/external-skill-management.test.cjs`
**Framework**: Node.js built-in `node:test` + `node:assert/strict`
**Module System**: CommonJS (`.cjs`)

---

## Shared Test Infrastructure

### loadCommon(projectRoot) Helper

Follows the pattern established in `skill-injection.test.cjs`:

```javascript
const COMMON_PATH = path.join(__dirname, '..', 'lib', 'common.cjs');

function loadCommon(projectRoot) {
    delete require.cache[require.resolve(COMMON_PATH)];
    process.env.CLAUDE_PROJECT_DIR = projectRoot;
    process.env.NODE_ENV = 'test';
    process.env.ISDLC_TEST_MODE = '1';
    const common = require(COMMON_PATH);
    if (common._resetCaches) common._resetCaches();
    return common;
}
```

### Fixture Factories

See `docs/common/test-data-plan.md` for complete fixture definitions. Key factories:

- `createValidSkillFile(dir, name, description, body)` -- creates a well-formed `.md` with YAML frontmatter
- `createManifest(skills)` -- creates an `external-skills-manifest.json`
- `createTestProject(opts)` -- sets up a full temp directory with `.isdlc/`, `.claude/`, and optional manifest/skill files

---

## TC-01: validateSkillFrontmatter() -- Happy Path

**Requirement**: FR-001 (Skill Acquisition)
**Test Type**: positive (unit)
**Priority**: P0

| ID | Test Name | Input | Expected Output | Traces |
|----|-----------|-------|-----------------|--------|
| TC-01.01 | Valid skill file with minimal frontmatter | `.md` file with `name` and `description` | `{ valid: true, errors: [], parsed: { name, description }, body: "..." }` | FR-001, V-004, V-005 |
| TC-01.02 | Valid skill file with all optional fields | File with `name`, `description`, `owner`, `when_to_use`, `skill_id`, `dependencies` | `{ valid: true, parsed: { name, description, owner, when_to_use, skill_id, dependencies } }` | FR-001, FR-002 |
| TC-01.03 | Body content extracted correctly | File with frontmatter + markdown body | `body` field contains everything after closing `---` | FR-001, FR-002 |
| TC-01.04 | Name with hyphens and numbers is valid | `name: nestjs-v3-conventions` | `valid: true` | SV-006 |
| TC-01.05 | Two-character name is valid (minimum length) | `name: a1` | `valid: true` | SV-006 |

---

## TC-02: validateSkillFrontmatter() -- Negative / Error Cases

**Requirement**: FR-001, NFR-006
**Test Type**: negative (unit)
**Priority**: P0

| ID | Test Name | Input | Expected Output | Traces |
|----|-----------|-------|-----------------|--------|
| TC-02.01 | File not found | Non-existent path | `{ valid: false, errors: ["File not found: ..."] }` | V-001, SKL-E001 |
| TC-02.02 | Non-.md extension (.txt) | Path to a `.txt` file | `{ valid: false, errors: ["Only .md files are supported. Got: .txt"] }` | V-002, SKL-E002 |
| TC-02.03 | Non-.md extension (.json) | Path to a `.json` file | `{ valid: false, errors: [...".json"] }` | V-002, SKL-E002 |
| TC-02.04 | No extension at all | Path to file without extension | `errors: ["Only .md files are supported. Got: (none)"]` | V-002, SKL-E002 |
| TC-02.05 | No YAML frontmatter | `.md` file without `---` delimiters | `errors: ["No YAML frontmatter found..."]` | V-003, SKL-E003 |
| TC-02.06 | Empty file | Zero-byte `.md` file | `{ valid: false }` with frontmatter error | V-003, SKL-E003 |
| TC-02.07 | Missing `name` field | Frontmatter with only `description` | `errors` includes "Missing required frontmatter field: name" | V-004, SKL-E004 |
| TC-02.08 | Missing `description` field | Frontmatter with only `name` | `errors` includes "Missing required frontmatter field: description" | V-005, SKL-E005 |
| TC-02.09 | Both `name` and `description` missing | Frontmatter with only `owner` | `errors` has length >= 2, includes both missing field messages | V-004, V-005, NFR-006 |
| TC-02.10 | Name with uppercase chars | `name: NestJS-Conventions` | `errors` includes name format error | V-006, SKL-E006 |
| TC-02.11 | Name with underscores | `name: my_skill` | `errors` includes name format error | V-006, SKL-E006 |
| TC-02.12 | Name with spaces | `name: my skill` | `errors` includes name format error | V-006, SKL-E006 |
| TC-02.13 | Name starting with hyphen | `name: -bad-name` | `errors` includes name format error | V-006, SKL-E006 |
| TC-02.14 | Name ending with hyphen | `name: bad-name-` | `errors` includes name format error | V-006, SKL-E006 |
| TC-02.15 | Single character name | `name: a` | `errors` includes name format error | V-006, SKL-E006 |
| TC-02.16 | Empty `name` (whitespace only) | `name:   ` | `errors` includes "Missing required frontmatter field: name" | V-004, SKL-E004 |
| TC-02.17 | Empty `description` (whitespace only) | `description:   ` | `errors` includes "Missing required frontmatter field: description" | V-005, SKL-E005 |
| TC-02.18 | All errors collected (not fail-fast) | File missing name + bad description | `errors.length >= 2` -- all validation errors reported together | NFR-006 |

---

## TC-03: analyzeSkillContent() -- Keyword Analysis

**Requirement**: FR-002
**Test Type**: positive (unit)
**Priority**: P1

| ID | Test Name | Input Content | Expected | Traces |
|----|-----------|---------------|----------|--------|
| TC-03.01 | Testing keywords detected | "This skill covers testing, mock setup, and coverage" | `keywords` includes "testing", "mock", "coverage"; `suggestedPhases` includes "05-test-strategy" | FR-002 |
| TC-03.02 | Architecture keywords detected | "Design patterns for microservice architecture" | `keywords` includes "architecture", "design pattern", "microservice"; `suggestedPhases` includes "03-architecture" | FR-002 |
| TC-03.03 | DevOps keywords detected | "Docker deployment pipeline with CI/CD" | `keywords` includes "deploy", "docker", "ci/cd"; `suggestedPhases` includes "10-cicd" | FR-002 |
| TC-03.04 | Security keywords detected | "OWASP security authentication encryption" | `suggestedPhases` includes "09-validation" | FR-002 |
| TC-03.05 | Implementation keywords detected | "Implement controller API endpoint service" | `suggestedPhases` includes "06-implementation" | FR-002 |
| TC-03.06 | Requirements keywords detected | "User story acceptance criteria specification" | `suggestedPhases` includes "01-requirements" | FR-002 |
| TC-03.07 | Review keywords detected | "Code review quality lint static analysis" | `suggestedPhases` includes "08-code-review" | FR-002 |
| TC-03.08 | Mixed categories (cross-cutting) | "Testing the API endpoint implementation" | `suggestedPhases` includes both "05-test-strategy" and "06-implementation" | FR-002 |
| TC-03.09 | Case insensitive matching | "DOCKER deployment with TESTING" | Keywords detected regardless of case | FR-002 |
| TC-03.10 | High confidence (3+ keywords) | Content with 4 testing keywords | `confidence: 'high'` | FR-002 |
| TC-03.11 | Medium confidence (1-2 keywords) | Content with 1 testing keyword | `confidence: 'medium'` | FR-002 |
| TC-03.12 | Low confidence (no keywords) | "Random content with no matching terms" | `confidence: 'low'`, `suggestedPhases: ['06-implementation']` | FR-002 |

---

## TC-04: analyzeSkillContent() -- Edge Cases

**Requirement**: FR-002
**Test Type**: negative (unit)
**Priority**: P1

| ID | Test Name | Input | Expected | Traces |
|----|-----------|-------|----------|--------|
| TC-04.01 | Null input | `null` | `{ keywords: [], suggestedPhases: ['06-implementation'], confidence: 'low' }` | FR-002 |
| TC-04.02 | Undefined input | `undefined` | Same as null | FR-002 |
| TC-04.03 | Empty string | `""` | Same as null (low confidence, default phase) | FR-002 |
| TC-04.04 | Non-string input (number) | `42` | Default fallback (no crash) | FR-002 |
| TC-04.05 | Phases deduplicated | Content matching "test" and "testing" (same category) | `suggestedPhases` has no duplicate entries | FR-002 |

---

## TC-05: suggestBindings() -- Binding Suggestions

**Requirement**: FR-002
**Test Type**: positive (unit)
**Priority**: P1

| ID | Test Name | Input | Expected | Traces |
|----|-----------|-------|----------|--------|
| TC-05.01 | Maps phases to agents correctly | `analysis: { suggestedPhases: ['06-implementation'] }` | `agents` includes "software-developer" | FR-002, PHASE_TO_AGENT_MAP |
| TC-05.02 | Multiple phases map to multiple agents | `suggestedPhases: ['03-architecture', '04-design']` | `agents` includes "solution-architect" and "system-designer" | FR-002 |
| TC-05.03 | Default delivery type is 'context' | No special hints | `delivery_type: 'context'` | FR-002 |
| TC-05.04 | Frontmatter owner adds agent | `frontmatterHints: { owner: 'qa-engineer' }` | `agents` includes "qa-engineer" | FR-002 |
| TC-05.05 | Owner upgrades confidence from low | `analysis.confidence: 'low'`, `hints.owner: 'x'` | `confidence: 'medium'` | FR-002 |
| TC-05.06 | when_to_use with "must" suggests instruction | `hints: { when_to_use: 'You must follow these conventions' }` | `delivery_type: 'instruction'` | FR-002 |
| TC-05.07 | when_to_use with "standard" suggests instruction | `hints: { when_to_use: 'Company standard coding rules' }` | `delivery_type: 'instruction'` | FR-002 |
| TC-05.08 | Large content suggests reference | `analysis.contentLength: 6000` | `delivery_type: 'reference'` | FR-002 |
| TC-05.09 | Null analysis uses defaults | `analysis: null` | `phases: ['06-implementation']`, `confidence: 'low'` | FR-002 |
| TC-05.10 | Null frontmatterHints is safe | `frontmatterHints: null` | No crash, defaults used | FR-002 |

---

## TC-06: writeExternalManifest() -- Manifest I/O

**Requirement**: FR-004
**Test Type**: positive (unit)
**Priority**: P0

| ID | Test Name | Input | Expected | Traces |
|----|-----------|-------|----------|--------|
| TC-06.01 | Writes valid manifest to disk | `{ version: '1.0.0', skills: [] }` | `{ success: true }`, file exists on disk, parseable JSON | FR-004 |
| TC-06.02 | Creates parent directories | Target directory does not exist | Directories created recursively, file written | FR-004 |
| TC-06.03 | Writes with 2-space indentation | Any valid manifest | File content is JSON with 2-space indent + trailing newline | FR-004 |
| TC-06.04 | Overwrites existing manifest | Existing manifest on disk | Updated content written, old content replaced | FR-004, FR-009 |
| TC-06.05 | Validates JSON after write (re-read) | Valid manifest | Returns `success: true`, re-read parses successfully | FR-004, MV-001 |
| TC-06.06 | Returns path in result | Any call | `result.path` is an absolute path string | FR-004 |
| TC-06.07 | Manifest with single skill | One skill entry | Written correctly, re-read matches | FR-004 |
| TC-06.08 | Manifest with 50 skills (max) | 50 skill entries | Written correctly (NFR-002 limit) | FR-004, NFR-002 |

---

## TC-07: writeExternalManifest() -- Error Cases

**Requirement**: FR-004
**Test Type**: negative (unit)
**Priority**: P0

| ID | Test Name | Input | Expected | Traces |
|----|-----------|-------|----------|--------|
| TC-07.01 | Returns error on write failure | Read-only directory | `{ success: false, error: '...' }` (never throws) | FR-004, SKL-E012 |
| TC-07.02 | Returns error on verification failure | Manifest with non-array skills | `{ success: false }` if re-read validation fails | FR-004, SKL-E013 |

---

## TC-08: formatSkillInjectionBlock() -- Formatting

**Requirement**: FR-005
**Test Type**: positive (unit)
**Priority**: P0

| ID | Test Name | Input | Expected Output | Traces |
|----|-----------|-------|-----------------|--------|
| TC-08.01 | Context delivery format | `('my-skill', 'content here', 'context')` | `"EXTERNAL SKILL CONTEXT: my-skill\n---\ncontent here\n---"` | FR-005 |
| TC-08.02 | Instruction delivery format | `('my-skill', 'rules here', 'instruction')` | `"EXTERNAL SKILL INSTRUCTION (my-skill): You MUST follow these guidelines:\nrules here"` | FR-005 |
| TC-08.03 | Reference delivery format | `('my-skill', '/path/to/file', 'reference')` | `"EXTERNAL SKILL AVAILABLE: my-skill -- Read from /path/to/file if relevant to your current task"` | FR-005 |
| TC-08.04 | Unknown delivery type returns empty | `('x', 'y', 'unknown')` | `""` | FR-005, fail-safe |
| TC-08.05 | Empty content handled | `('my-skill', '', 'context')` | Context block with empty body | FR-005 |
| TC-08.06 | Content with special characters | Content with backticks, newlines, markdown | Correctly wrapped without escaping | FR-005 |
| TC-08.07 | Long skill name handled | 100-char skill name | Correctly formatted header | FR-005 |
| TC-08.08 | Multiline content preserved | Content with multiple paragraphs | All paragraphs present in output | FR-005 |

---

## TC-09: removeSkillFromManifest() -- Removal

**Requirement**: FR-007
**Test Type**: positive/negative (unit)
**Priority**: P2

| ID | Test Name | Input | Expected | Traces |
|----|-----------|-------|----------|--------|
| TC-09.01 | Removes existing skill by name | Manifest with 3 skills, remove middle one | `{ removed: true, manifest }` with 2 skills | FR-007 |
| TC-09.02 | Name not found returns removed: false | Manifest with 3 skills, remove non-existent | `{ removed: false }`, manifest unchanged | FR-007, SKL-E011 |
| TC-09.03 | Null manifest handled safely | `manifest: null` | `{ removed: false, manifest: { version: '1.0.0', skills: [] } }` | FR-007 |
| TC-09.04 | Manifest without skills array | `manifest: { version: '1.0.0' }` | `{ removed: false }` | FR-007 |
| TC-09.05 | Case-sensitive name matching | Remove "My-Skill" when manifest has "my-skill" | `removed: false` (exact match required) | FR-007 |
| TC-09.06 | Removes only the named skill | Manifest with skills A, B, C; remove B | A and C remain | FR-007 |

---

## TC-10: Existing Functions -- Coverage Gap Fill

**Requirement**: NFR-004 (Monorepo Compatibility), CON-002
**Test Type**: positive/negative (unit)
**Priority**: P0

| ID | Test Name | Function | Expected | Traces |
|----|-----------|----------|----------|--------|
| TC-10.01 | resolveExternalSkillsPath -- single project | No monorepo | Returns `{root}/.claude/skills/external/` | CON-002, NFR-004 |
| TC-10.02 | resolveExternalManifestPath -- single project | No monorepo | Returns `{root}/docs/isdlc/external-skills-manifest.json` | CON-002, NFR-004 |
| TC-10.03 | loadExternalManifest -- no manifest file | No manifest on disk | Returns `null` | NFR-005 |
| TC-10.04 | loadExternalManifest -- valid manifest | Valid JSON on disk | Returns parsed object | FR-005 |
| TC-10.05 | loadExternalManifest -- corrupt JSON | Invalid JSON on disk | Returns `null` (fail-open) | NFR-003, NFR-005 |
| TC-10.06 | resolveExternalSkillsPath -- with projectId | Explicit project ID | Returns monorepo-scoped path | NFR-004 |

---

## TC-11: Integration -- Skill Add Pipeline

**Requirement**: FR-001, FR-002, FR-004
**Test Type**: positive (integration)
**Priority**: P0

| ID | Test Name | Flow | Expected | Traces |
|----|-----------|------|----------|--------|
| TC-11.01 | Full validate -> analyze -> suggest -> write | Valid skill file with testing keywords | Manifest written with correct bindings suggested | FR-001, FR-002, FR-004 |
| TC-11.02 | Full pipeline with architecture skill | Valid skill with architecture content | Suggests 03-architecture, 04-design | FR-001, FR-002 |
| TC-11.03 | Pipeline with no keyword matches | Valid skill with generic content | Falls back to 06-implementation | FR-001, FR-002 |
| TC-11.04 | Pipeline with large content | Valid skill > 5000 chars | Suggests reference delivery | FR-002 |

---

## TC-12: Integration -- Runtime Injection Pipeline

**Requirement**: FR-005, NFR-001, NFR-003
**Test Type**: positive/negative (integration)
**Priority**: P0

| ID | Test Name | Setup | Expected | Traces |
|----|-----------|-------|----------|--------|
| TC-12.01 | Load manifest + format injection for matching phase | Manifest with skill bound to phase `06-implementation`, current phase `06-implementation` | Injection block generated | FR-005 |
| TC-12.02 | No match when phase does not match | Manifest skill bound to `03-architecture`, current phase `06-implementation` | No injection (empty result) | FR-005 |
| TC-12.03 | Missing skill file at injection time | Manifest references non-existent `.md` file | Skill skipped, no crash (fail-open) | NFR-003, SKL-W004 |
| TC-12.04 | Malformed manifest at injection time | Corrupt JSON in manifest path | Returns null, injection skipped | NFR-003, SKL-W001 |

---

## TC-13: Integration -- Skill Removal Pipeline

**Requirement**: FR-007, FR-004
**Test Type**: positive (integration)
**Priority**: P1

| ID | Test Name | Flow | Expected | Traces |
|----|-----------|------|----------|--------|
| TC-13.01 | Remove and rewrite manifest | removeSkillFromManifest -> writeExternalManifest | Manifest on disk has skill removed | FR-007, FR-004 |
| TC-13.02 | Remove last skill leaves empty array | Remove only skill from manifest | `{ version: '1.0.0', skills: [] }` on disk | FR-007 |
| TC-13.03 | Remove non-existent skill, manifest unchanged | Remove "ghost-skill" | Manifest on disk unchanged | FR-007, SKL-E011 |

---

## TC-14: Fail-Open Behavior (NFR-003)

**Requirement**: NFR-003, NFR-005
**Test Type**: negative (unit/integration)
**Priority**: P0

| ID | Test Name | Scenario | Expected | Traces |
|----|-----------|----------|----------|--------|
| TC-14.01 | No manifest file -- injection skipped | No `external-skills-manifest.json` | `loadExternalManifest()` returns null, no injection | NFR-003, NFR-005, SKL-W001 |
| TC-14.02 | Manifest exists but skills array empty | `{ version: '1.0.0', skills: [] }` | No injection (empty loop) | NFR-003, SKL-W002 |
| TC-14.03 | Skill entry without bindings | Skill has no `bindings` object | Skill skipped (backward compat) | NFR-005, SKL-W003 |
| TC-14.04 | Skill file missing from disk | Manifest references file that does not exist | Skill skipped, others still injected | NFR-003, SKL-W004 |
| TC-14.05 | Entire injection pipeline error | Simulate error in manifest loading | Fall through with no injection, no crash | NFR-003, SKL-W007 |

---

## TC-15: Backward Compatibility (NFR-005)

**Requirement**: NFR-005
**Test Type**: positive (unit)
**Priority**: P1

| ID | Test Name | Scenario | Expected | Traces |
|----|-----------|----------|----------|--------|
| TC-15.01 | No manifest file, no external dir | Clean project with no skill infrastructure | All functions handle gracefully (null returns, empty arrays) | NFR-005 |
| TC-15.02 | loadExternalManifest returns null | No manifest file | Returns null, not an error | NFR-005 |
| TC-15.03 | Manifest entry without bindings object | Legacy skill entry `{ name, file, added_at }` | Entry silently skipped during injection | NFR-005, BV-001 |

---

## TC-16: Path Security (Security Architecture)

**Requirement**: Security T1, PS-001 through PS-003
**Test Type**: negative (unit)
**Priority**: P0

| ID | Test Name | Input | Expected | Traces |
|----|-----------|-------|----------|--------|
| TC-16.01 | Filename with forward slash rejected | `skill.file: "../../etc/passwd"` | Rejected by validation | PS-001, PS-003, SKL-E007 |
| TC-16.02 | Filename with backslash rejected | `skill.file: "..\\windows\\system"` | Rejected by validation | PS-002, SKL-E007 |
| TC-16.03 | Filename with `..` rejected | `skill.file: "../parent.md"` | Rejected by validation | PS-003, SKL-E007 |
| TC-16.04 | Clean filename accepted | `skill.file: "my-skill.md"` | Accepted | PS-004 |

---

## TC-17: Performance (NFR-001, NFR-002)

**Requirement**: NFR-001, NFR-002
**Test Type**: positive (performance)
**Priority**: P1

| ID | Test Name | Setup | Threshold | Traces |
|----|-----------|-------|-----------|--------|
| TC-17.01 | Single skill injection under 100ms | 1-skill manifest + format | <100ms | NFR-001 |
| TC-17.02 | 50-skill manifest parse under 500ms | 50-skill manifest | <500ms | NFR-002 |
| TC-17.03 | analyzeSkillContent under 10ms | Typical 2000-char content | <10ms | NFR-001 |

---

## TC-18: SKILL_KEYWORD_MAP and PHASE_TO_AGENT_MAP Constants

**Requirement**: FR-002
**Test Type**: positive (unit)
**Priority**: P2

| ID | Test Name | Check | Expected | Traces |
|----|-----------|-------|----------|--------|
| TC-18.01 | SKILL_KEYWORD_MAP exported | `typeof common.SKILL_KEYWORD_MAP === 'object'` | truthy | FR-002 |
| TC-18.02 | SKILL_KEYWORD_MAP has 7 categories | `Object.keys(map).length === 7` | testing, architecture, devops, security, implementation, requirements, review | FR-002 |
| TC-18.03 | PHASE_TO_AGENT_MAP exported | `typeof common.PHASE_TO_AGENT_MAP === 'object'` | truthy | FR-002 |
| TC-18.04 | PHASE_TO_AGENT_MAP has 11 entries | `Object.keys(map).length === 11` | All standard phases mapped | FR-002 |
| TC-18.05 | All keyword entries have phases array | Each category has non-empty `phases` array | Validated | FR-002 |

---

## Summary

| Test Group | Test Count | Type | Priority |
|------------|-----------|------|----------|
| TC-01: validateSkillFrontmatter (happy path) | 5 | positive/unit | P0 |
| TC-02: validateSkillFrontmatter (errors) | 18 | negative/unit | P0 |
| TC-03: analyzeSkillContent (keywords) | 12 | positive/unit | P1 |
| TC-04: analyzeSkillContent (edge cases) | 5 | negative/unit | P1 |
| TC-05: suggestBindings | 10 | positive/unit | P1 |
| TC-06: writeExternalManifest (happy path) | 8 | positive/unit | P0 |
| TC-07: writeExternalManifest (errors) | 2 | negative/unit | P0 |
| TC-08: formatSkillInjectionBlock | 8 | positive/unit | P0 |
| TC-09: removeSkillFromManifest | 6 | positive+negative/unit | P2 |
| TC-10: Existing functions (gap fill) | 6 | positive+negative/unit | P0 |
| TC-11: Skill add pipeline (integration) | 4 | positive/integration | P0 |
| TC-12: Runtime injection pipeline (integration) | 4 | positive+negative/integration | P0 |
| TC-13: Skill removal pipeline (integration) | 3 | positive/integration | P1 |
| TC-14: Fail-open behavior | 5 | negative/unit+integration | P0 |
| TC-15: Backward compatibility | 3 | positive/unit | P1 |
| TC-16: Path security | 4 | negative/unit | P0 |
| TC-17: Performance | 3 | positive/performance | P1 |
| TC-18: Constants validation | 5 | positive/unit | P2 |

**Grand Total: 111 test cases**
