# Test Cases: REQ-0042 Session Cache Markdown Tightening

| Field | Value |
|-------|-------|
| **Status** | Complete |
| **Phase** | 05 - Test Strategy |
| **Last Updated** | 2026-02-26 |
| **Total Test Cases** | 61 |
| **Framework** | Node.js built-in `node:test` + `node:assert/strict` |
| **Test File** | `src/claude/hooks/tests/test-session-cache-builder.test.cjs` |

---

## FR-001: SKILL_INDEX Banner Deduplication

### TC-FSI-01: Banner appears once at section level (positive)
- **AC**: AC-001-01
- **Type**: positive
- **Priority**: P0
- **Given**: A rebuilt session cache with multiple agent blocks in SKILL_INDEX
- **When**: The SKILL_INDEX section is assembled
- **Then**: The string "AVAILABLE SKILLS (consult when relevant using Read tool):" appears exactly once in the section
- **Assertion**: `sectionContent.split('AVAILABLE SKILLS').length === 2` (one occurrence + one split part)

### TC-FSI-02: Agent headings preserved in SKILL_INDEX (positive)
- **AC**: AC-001-02
- **Type**: positive
- **Priority**: P0
- **Given**: A rebuilt session cache with 3 agent blocks
- **When**: The SKILL_INDEX section is assembled
- **Then**: Each agent block retains its `## Agent: {name}` heading
- **Assertion**: `sectionContent.includes('## Agent: orchestrator')` and similar for each agent name

### TC-FSI-03: Banner deduplication saves at least 2000 chars (positive)
- **AC**: AC-001-03
- **Type**: positive
- **Priority**: P1
- **Given**: A verbose SKILL_INDEX section with N agent blocks each having the banner
- **When**: The tightened SKILL_INDEX is built
- **Then**: Character count difference (verbose - tightened) >= 2000
- **Assertion**: `verboseLength - tightenedLength >= 2000`

---

## FR-002: SKILL_INDEX Compact Skill Format

### TC-FSI-04: Single-line skill entry format (positive)
- **AC**: AC-002-01
- **Type**: positive
- **Priority**: P0
- **Given**: A skill entry `{id: 'DEV-001', name: 'code-implementation', description: 'Implement code', path: 'src/claude/skills/development/code-implementation/SKILL.md'}`
- **When**: `formatSkillIndexBlock()` formats the entry
- **Then**: Output contains `DEV-001: code-implementation | Implement code | development/code-implementation`
- **Assertion**: Exact single-line match with pipe separators

### TC-FSI-05: Base path in section header (positive)
- **AC**: AC-002-02
- **Type**: positive
- **Priority**: P0
- **Given**: A rebuilt session cache SKILL_INDEX section
- **When**: The section header is assembled
- **Then**: Header includes `Base path: src/claude/skills/{category}/{name}/SKILL.md`
- **Assertion**: `sectionContent.includes('Base path:')`

### TC-FSI-06: All skill entries preserved in compact format (positive)
- **AC**: AC-002-03
- **Type**: positive
- **Priority**: P0
- **Given**: An array of 5 skill entries with known IDs, names, descriptions, and paths
- **When**: `formatSkillIndexBlock()` formats them
- **Then**: All 5 IDs, names, descriptions appear in output; full path is reconstructable from base + relative
- **Assertion**: Each skill ID, name, description present in output

### TC-FSI-07: Combined FR-001 + FR-002 achieves 50% SKILL_INDEX reduction (positive)
- **AC**: AC-002-04
- **Type**: positive
- **Priority**: P1
- **Given**: A verbose SKILL_INDEX section matching real data (~39,866 chars)
- **When**: Both banner dedup and compact format are applied
- **Then**: Tightened section is at most 50% of verbose size (at least 20,000 chars saved)
- **Assertion**: `tightenedLength <= verboseLength * 0.50`

### TC-FSI-08: Empty skill index returns empty string (negative)
- **AC**: AC-002-01
- **Type**: negative
- **Priority**: P1
- **Given**: An empty array `[]` passed to `formatSkillIndexBlock()`
- **When**: The function executes
- **Then**: Returns empty string
- **Assertion**: `result === ''`

### TC-FSI-09: Non-array input returns empty string (negative)
- **AC**: AC-002-01
- **Type**: negative
- **Priority**: P2
- **Given**: Non-array inputs (`null`, `undefined`, `"string"`, `42`)
- **When**: Passed to `formatSkillIndexBlock()`
- **Then**: Returns empty string for each
- **Assertion**: `result === ''` for each input

### TC-FSI-10: Path shortening extracts last two segments (positive)
- **AC**: AC-002-03
- **Type**: positive
- **Priority**: P1
- **Given**: Path `src/claude/skills/testing/mutation-testing/SKILL.md`
- **When**: `formatSkillIndexBlock()` processes the entry
- **Then**: Output contains `testing/mutation-testing` (not the full path)
- **Assertion**: `result.includes('testing/mutation-testing')` and not `result.includes('src/claude/skills')`

---

## FR-003: ROUNDTABLE_CONTEXT Persona Section Stripping

### TC-TPC-01: Stripped sections absent from output (positive)
- **AC**: AC-003-01
- **Type**: positive
- **Priority**: P0
- **Given**: Realistic persona content with sections 1-10
- **When**: `tightenPersonaContent()` is called
- **Then**: Output does NOT contain "Analytical Approach", "Artifact Responsibilities", "Artifact Folder Convention", "Meta.json Protocol", or "Constraints"
- **Assertion**: `!result.includes('Analytical Approach')` etc. for each stripped section

### TC-TPC-02: Kept sections present in output (positive)
- **AC**: AC-003-02
- **Type**: positive
- **Priority**: P0
- **Given**: Realistic persona content with sections 1-10
- **When**: `tightenPersonaContent()` is called
- **Then**: Output DOES contain "Identity", "Principles", "Voice Integrity", "Interaction Style"
- **Assertion**: `result.includes('Identity')`, `result.includes('Principles')`, etc.

### TC-TPC-03: Persona heading delimiter preserved (positive)
- **AC**: AC-003-03
- **Type**: positive
- **Priority**: P0
- **Given**: ROUNDTABLE_CONTEXT section content with `### Persona:` headings
- **When**: Cache is rebuilt with tightened persona content
- **Then**: `### Persona:` heading delimiters are intact and parseable
- **Assertion**: Regex split on `### Persona:` yields same number of blocks as verbose version

### TC-TPC-04: YAML frontmatter stripped from persona (positive)
- **AC**: AC-003-04
- **Type**: positive
- **Priority**: P1
- **Given**: Persona content starting with `---\nname: ...\n---`
- **When**: `tightenPersonaContent()` is called
- **Then**: Output does NOT start with `---` and does NOT contain frontmatter key-value pairs
- **Assertion**: `!result.trimStart().startsWith('---')`

### TC-TPC-05: Null input returns empty string (negative)
- **AC**: AC-003-01
- **Type**: negative
- **Priority**: P1
- **Given**: `null` passed to `tightenPersonaContent()`
- **When**: The function executes
- **Then**: Returns empty string (not null, not undefined)
- **Assertion**: `result === ''`

### TC-TPC-06: Empty string input returns empty string (negative)
- **AC**: AC-003-01
- **Type**: negative
- **Priority**: P1
- **Given**: `''` passed to `tightenPersonaContent()`
- **When**: The function executes
- **Then**: Returns empty string
- **Assertion**: `result === ''`

### TC-TPC-07: Non-string input returns empty string (negative)
- **AC**: AC-003-01
- **Type**: negative
- **Priority**: P2
- **Given**: Non-string inputs (`42`, `true`, `{}`, `[]`)
- **When**: Passed to `tightenPersonaContent()`
- **Then**: Returns empty string for each
- **Assertion**: `result === ''`

### TC-TPC-08: Content with no section headings returns frontmatter-stripped content (negative)
- **AC**: AC-003-01
- **Type**: negative
- **Priority**: P2
- **Given**: Persona content with frontmatter but no `## ` section headings
- **When**: `tightenPersonaContent()` is called
- **Then**: Returns content with frontmatter stripped but body unchanged
- **Assertion**: `!result.includes('---')` and `result.includes(bodyContent)`

---

## FR-004: ROUNDTABLE_CONTEXT Self-Validation Compaction

### TC-TPC-09: Self-Validation present as single merged checklist (positive)
- **AC**: AC-004-01
- **Type**: positive
- **Priority**: P0
- **Given**: Persona content with section 7 containing "Before writing" and "Before finalization" subsections
- **When**: `tightenPersonaContent()` is called
- **Then**: Output contains section 7 content as a single merged checklist (one list, not two subsections)
- **Assertion**: Output does not contain both "Before writing" and "Before finalization" as separate headings; it contains a unified checklist

### TC-TPC-10: All validation criteria preserved in merged checklist (positive)
- **AC**: AC-004-02
- **Type**: positive
- **Priority**: P0
- **Given**: Persona content with 4 items in "Before writing" and 3 items in "Before finalization"
- **When**: `tightenPersonaContent()` is called
- **Then**: All 7 validation criteria are present in the merged output
- **Assertion**: Count of `- ` list items in section 7 output >= 7

### TC-TPC-11: Validation criteria remain within persona block (positive)
- **AC**: AC-004-03
- **Type**: positive
- **Priority**: P1
- **Given**: ROUNDTABLE_CONTEXT with multiple personas, each having section 7
- **When**: Cache is rebuilt with tightened persona content
- **Then**: Each persona block contains its own validation criteria (not merged across personas)
- **Assertion**: Each `### Persona:` block has its own section 7 content

### TC-TPC-12: Per-persona reduction at least 50% (positive)
- **AC**: AC-004-04
- **Type**: positive
- **Priority**: P1
- **Given**: Realistic persona content (~5,000 chars per persona)
- **When**: `tightenPersonaContent()` is called
- **Then**: Tightened content is at most 50% of original (at least 2,500 chars saved)
- **Assertion**: `tightenedLength <= originalLength * 0.50`

---

## FR-005: ROUNDTABLE_CONTEXT Topic File Tightening

### TC-TTC-01: Topic frontmatter stripped (positive)
- **AC**: AC-005-01
- **Type**: positive
- **Priority**: P0
- **Given**: Topic content with YAML frontmatter (`---` delimited block)
- **When**: `tightenTopicContent()` is called
- **Then**: Output does NOT contain YAML frontmatter
- **Assertion**: `!result.trimStart().startsWith('---')`

### TC-TTC-02: depth_guidance and source_step_files absent (positive)
- **AC**: AC-005-02
- **Type**: positive
- **Priority**: P0
- **Given**: Topic content with frontmatter containing `depth_guidance` and `source_step_files` keys
- **When**: `tightenTopicContent()` is called
- **Then**: Output does NOT contain `depth_guidance` or `source_step_files`
- **Assertion**: `!result.includes('depth_guidance')` and `!result.includes('source_step_files')`

### TC-TTC-03: Analytical Knowledge and Validation Criteria preserved (positive)
- **AC**: AC-005-03
- **Type**: positive
- **Priority**: P0
- **Given**: Topic content with sections "Analytical Knowledge", "Validation Criteria", "Artifact Instructions"
- **When**: `tightenTopicContent()` is called
- **Then**: All three section headings and their content are present
- **Assertion**: `result.includes('Analytical Knowledge')`, `result.includes('Validation Criteria')`, `result.includes('Artifact Instructions')`

### TC-TTC-04: Topic heading delimiter preserved (positive)
- **AC**: AC-005-04
- **Type**: positive
- **Priority**: P0
- **Given**: ROUNDTABLE_CONTEXT section with `### Topic:` headings
- **When**: Cache is rebuilt with tightened topic content
- **Then**: `### Topic:` heading delimiters are intact
- **Assertion**: Regex split on `### Topic:` yields same number of blocks as verbose version

### TC-TTC-05: ROUNDTABLE_CONTEXT total reduction at least 40% (positive)
- **AC**: AC-005-05
- **Type**: positive
- **Priority**: P1
- **Given**: Realistic ROUNDTABLE_CONTEXT section (~47,092 chars)
- **When**: All persona and topic tightening applied
- **Then**: Section reduced by at least 40% (at least 19,000 chars saved)
- **Assertion**: `tightenedLength <= verboseLength * 0.60`

### TC-TTC-06: Null/empty topic input returns empty string (negative)
- **AC**: AC-005-01
- **Type**: negative
- **Priority**: P1
- **Given**: `null` or `''` passed to `tightenTopicContent()`
- **When**: The function executes
- **Then**: Returns empty string
- **Assertion**: `result === ''`

### TC-TTC-07: Non-string topic input returns empty string (negative)
- **AC**: AC-005-01
- **Type**: negative
- **Priority**: P2
- **Given**: Non-string inputs passed to `tightenTopicContent()`
- **When**: The function executes
- **Then**: Returns empty string
- **Assertion**: `result === ''`

### TC-TTC-08: Topic content with no frontmatter returns unchanged (negative)
- **AC**: AC-005-01
- **Type**: negative
- **Priority**: P2
- **Given**: Topic content with no `---` frontmatter delimiters
- **When**: `tightenTopicContent()` is called
- **Then**: Returns content unchanged
- **Assertion**: `result === inputContent`

---

## FR-006: DISCOVERY_CONTEXT Aggressive Prose Stripping

### TC-CDC-01: Tables preserved verbatim (positive)
- **AC**: AC-006-01
- **Type**: positive
- **Priority**: P0
- **Given**: Discovery content with markdown tables (header row, separator row, data rows)
- **When**: `condenseDiscoveryContent()` is called
- **Then**: All table lines (starting with `|`) are present in output
- **Assertion**: Every line starting with `|` from input appears in output

### TC-CDC-02: Headings preserved verbatim (positive)
- **AC**: AC-006-02
- **Type**: positive
- **Priority**: P0
- **Given**: Discovery content with `##` and `###` headings
- **When**: `condenseDiscoveryContent()` is called
- **Then**: All heading lines are present in output
- **Assertion**: Every line starting with `#` from input appears in output

### TC-CDC-03: List items preserved (positive)
- **AC**: AC-006-03
- **Type**: positive
- **Priority**: P0
- **Given**: Discovery content with `- ` unordered and `1. ` numbered list items
- **When**: `condenseDiscoveryContent()` is called
- **Then**: All list item lines are present in output
- **Assertion**: Every line starting with `- `, `* `, or matching `^\d+\. ` from input appears in output

### TC-CDC-04: Prose paragraphs removed (positive)
- **AC**: AC-006-04
- **Type**: positive
- **Priority**: P0
- **Given**: Discovery content with known prose paragraph text "The iSDLC framework is a JavaScript/Node.js CLI tool"
- **When**: `condenseDiscoveryContent()` is called
- **Then**: Known prose text is NOT in output
- **Assertion**: `!result.includes('The iSDLC framework is a JavaScript/Node.js CLI tool')`

### TC-CDC-05: DISCOVERY_CONTEXT reduction at least 40% (positive)
- **AC**: AC-006-05
- **Type**: positive
- **Priority**: P1
- **Given**: Realistic discovery content (~22,814 chars)
- **When**: `condenseDiscoveryContent()` is called
- **Then**: Output is at most 60% of input size (at least 9,000 chars saved)
- **Assertion**: `result.length <= input.length * 0.60`

### TC-CDC-06: Consecutive blank lines collapsed (positive)
- **AC**: AC-006-04
- **Type**: positive
- **Priority**: P2
- **Given**: Content where prose removal creates 3+ consecutive blank lines
- **When**: `condenseDiscoveryContent()` is called
- **Then**: No more than 2 consecutive blank lines in output
- **Assertion**: `!result.includes('\n\n\n\n')`

### TC-CDC-07: Null/empty discovery input returns empty string (negative)
- **AC**: AC-006-01
- **Type**: negative
- **Priority**: P1
- **Given**: `null` or `''` passed to `condenseDiscoveryContent()`
- **When**: The function executes
- **Then**: Returns empty string
- **Assertion**: `result === ''`

### TC-CDC-08: Non-string discovery input returns empty string (negative)
- **AC**: AC-006-01
- **Type**: negative
- **Priority**: P2
- **Given**: Non-string inputs passed to `condenseDiscoveryContent()`
- **When**: The function executes
- **Then**: Returns empty string
- **Assertion**: `result === ''`

### TC-CDC-09: Content with no tables/lists strips all prose (negative)
- **AC**: AC-006-04
- **Type**: negative
- **Priority**: P2
- **Given**: Discovery content that is all prose paragraphs with headings but no tables or lists
- **When**: `condenseDiscoveryContent()` is called
- **Then**: Only headings and blank lines remain
- **Assertion**: All non-blank lines in result start with `#`

---

## FR-007: Fail-Open Tightening Safety

### TC-FO-01: tightenPersonaContent returns original on error (positive)
- **AC**: AC-007-01
- **Type**: positive
- **Priority**: P0
- **Given**: Content that triggers an internal processing error (e.g., malformed section boundaries)
- **When**: `tightenPersonaContent()` encounters the error
- **Then**: Returns the original `rawContent` unchanged (try/catch fires)
- **Assertion**: `result === rawContent`

### TC-FO-02: tightenTopicContent returns original on error (positive)
- **AC**: AC-007-01
- **Type**: positive
- **Priority**: P0
- **Given**: Content that triggers an internal processing error
- **When**: `tightenTopicContent()` encounters the error
- **Then**: Returns the original `rawContent` unchanged
- **Assertion**: `result === rawContent`

### TC-FO-03: condenseDiscoveryContent returns original on error (positive)
- **AC**: AC-007-01
- **Type**: positive
- **Priority**: P0
- **Given**: Content that triggers an internal processing error
- **When**: `condenseDiscoveryContent()` encounters the error
- **Then**: Returns the original `rawContent` unchanged
- **Assertion**: `result === rawContent`

### TC-FO-04: One section failure does not affect other sections (positive)
- **AC**: AC-007-02
- **Type**: positive
- **Priority**: P0
- **Given**: Cache rebuild where persona tightening fails but discovery tightening succeeds
- **When**: `rebuildSessionCache()` executes
- **Then**: ROUNDTABLE_CONTEXT uses verbose persona content; DISCOVERY_CONTEXT uses tightened content
- **Assertion**: ROUNDTABLE_CONTEXT section contains verbose persona; DISCOVERY_CONTEXT is tightened

### TC-FO-05: Verbose mode logs fallback warning (positive)
- **AC**: AC-007-03
- **Type**: positive
- **Priority**: P1
- **Given**: A tightening function that fails, with verbose mode enabled
- **When**: `rebuildSessionCache()` runs in verbose mode
- **Then**: A warning is written to stderr indicating the fallback
- **Assertion**: stderr output includes a warning string about tightening fallback

---

## FR-008: Reduction Reporting

### TC-REP-01: Per-section reduction reported in verbose mode (positive)
- **AC**: AC-008-01
- **Type**: positive
- **Priority**: P1
- **Given**: Verbose mode enabled during cache rebuild
- **When**: `rebuildSessionCache()` completes
- **Then**: stderr includes lines matching `TIGHTEN {section}: {before} -> {after} chars ({pct}% reduction)` for each tightened section
- **Assertion**: stderr matches regex `TIGHTEN SKILL_INDEX: \d+ -> \d+ chars \(\d+\.\d+% reduction\)`

### TC-REP-02: Total reduction summary in verbose mode (positive)
- **AC**: AC-008-02
- **Type**: positive
- **Priority**: P1
- **Given**: Verbose mode enabled during cache rebuild
- **When**: `rebuildSessionCache()` completes
- **Then**: stderr includes a total line: `TIGHTEN total: {before} -> {after} chars ({pct}% reduction across markdown sections)`
- **Assertion**: stderr matches regex `TIGHTEN total: \d+ -> \d+ chars`

### TC-REP-03: Reduction stats written to stderr not stdout (positive)
- **AC**: AC-008-03
- **Type**: positive
- **Priority**: P1
- **Given**: Verbose mode enabled during cache rebuild
- **When**: `rebuildSessionCache()` completes
- **Then**: "TIGHTEN" lines appear in stderr, NOT in the returned cache content string
- **Assertion**: `!cacheContent.includes('TIGHTEN')` and `stderr.includes('TIGHTEN')`

### TC-REP-04: Non-verbose mode does not output reduction stats (negative)
- **AC**: AC-008-01
- **Type**: negative
- **Priority**: P2
- **Given**: Verbose mode NOT enabled during cache rebuild
- **When**: `rebuildSessionCache()` completes
- **Then**: No "TIGHTEN" lines in stderr
- **Assertion**: `!stderr.includes('TIGHTEN')`

---

## Backward Compatibility Tests (Cross-Cutting)

### TC-BWC-01: Section delimiters preserved in full cache (positive)
- **AC**: AC-001-02, AC-003-03, AC-005-04
- **Type**: positive
- **Priority**: P0
- **Given**: A full session cache rebuilt with tightening
- **When**: Cache content is examined
- **Then**: `<!-- SECTION: SKILL_INDEX -->`, `<!-- SECTION: ROUNDTABLE_CONTEXT -->`, `<!-- SECTION: DISCOVERY_CONTEXT -->` delimiters are all present
- **Assertion**: Each delimiter string present in cache output

### TC-BWC-02: Orchestrator persona extraction works on tightened cache (positive)
- **AC**: AC-003-03
- **Type**: positive
- **Priority**: P0
- **Given**: A tightened ROUNDTABLE_CONTEXT section
- **When**: Split on `### Persona:` regex (matching orchestrator logic)
- **Then**: Same number of persona blocks as verbose version; each block has Identity content
- **Assertion**: Split count matches; each block contains persona identity info

### TC-BWC-03: Orchestrator topic extraction works on tightened cache (positive)
- **AC**: AC-005-04
- **Type**: positive
- **Priority**: P0
- **Given**: A tightened ROUNDTABLE_CONTEXT section
- **When**: Split on `### Topic:` regex (matching orchestrator logic)
- **Then**: Same number of topic blocks as verbose version; each block has Analytical Knowledge content
- **Assertion**: Split count matches; each block contains topic content

### TC-BWC-04: Skill ID and path extractable from compact format (positive)
- **AC**: AC-002-03
- **Type**: positive
- **Priority**: P0
- **Given**: A tightened SKILL_INDEX with compact single-line entries
- **When**: Parsing each line to extract skill ID and path
- **Then**: Skill ID and reconstructed full path match original data
- **Assertion**: Parse `{ID}: {name} | {desc} | {cat}/{name}` and verify ID, reconstructed path match input

### TC-BWC-05: Section start/end delimiters balanced (positive)
- **AC**: AC-001-02
- **Type**: positive
- **Priority**: P1
- **Given**: Full tightened cache output
- **When**: Counting section delimiters
- **Then**: Every `<!-- SECTION: X -->` has a matching `<!-- /SECTION: X -->`
- **Assertion**: Count of opening delimiters equals count of closing delimiters per section name

### TC-BWC-06: Cross-section independence under failure (positive)
- **AC**: AC-007-02
- **Type**: positive
- **Priority**: P1
- **Given**: One section's tightening function throws an error
- **When**: `rebuildSessionCache()` completes
- **Then**: Other sections are tightened normally; the failing section uses verbose content
- **Assertion**: Non-failing sections have reduced character counts; failing section has verbose content

---

## Summary

| FR | Test Cases | Positive | Negative | AC Coverage |
|----|-----------|----------|----------|-------------|
| FR-001 | TC-FSI-01 to TC-FSI-03 | 3 | 0 | AC-001-01, AC-001-02, AC-001-03 |
| FR-002 | TC-FSI-04 to TC-FSI-10 | 4 | 3 | AC-002-01, AC-002-02, AC-002-03, AC-002-04 |
| FR-003 | TC-TPC-01 to TC-TPC-08 | 4 | 4 | AC-003-01, AC-003-02, AC-003-03, AC-003-04 |
| FR-004 | TC-TPC-09 to TC-TPC-12 | 4 | 0 | AC-004-01, AC-004-02, AC-004-03, AC-004-04 |
| FR-005 | TC-TTC-01 to TC-TTC-08 | 5 | 3 | AC-005-01, AC-005-02, AC-005-03, AC-005-04, AC-005-05 |
| FR-006 | TC-CDC-01 to TC-CDC-09 | 6 | 3 | AC-006-01, AC-006-02, AC-006-03, AC-006-04, AC-006-05 |
| FR-007 | TC-FO-01 to TC-FO-05 | 5 | 0 | AC-007-01, AC-007-02, AC-007-03 |
| FR-008 | TC-REP-01 to TC-REP-04 | 3 | 1 | AC-008-01, AC-008-02, AC-008-03 |
| BWC | TC-BWC-01 to TC-BWC-06 | 6 | 0 | Cross-cutting |
| **Total** | **61** | **40** | **14** + **7 BWC** | **31/31 ACs covered** |
