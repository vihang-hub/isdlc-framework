# Test Cases: REQ-0012 Invisible Framework

**Phase**: 05-test-strategy
**Feature**: CLAUDE.md rewrite for auto-intent-detection
**Created**: 2026-02-13
**Total Test Cases**: 49
**AC Coverage**: 27/27 (100%)
**NFR Coverage**: 4/4 (100%)

---

## Test File: `lib/invisible-framework.test.js`

All tests read CLAUDE.md and/or src/claude/CLAUDE.md.template using `readFileSync` and validate content structure using string matching and regex. Tests follow the existing `lib/prompt-format.test.js` pattern.

---

## Group 1: Section Structure (T01-T05)

### T01: Workflow-First Development section exists in CLAUDE.md
- **AC**: Structural prerequisite (all ACs)
- **Priority**: P0
- **Input**: Read `CLAUDE.md`
- **Expected**: File contains `## Workflow-First Development` heading
- **Validation**: `content.includes('## Workflow-First Development')`

### T02: Workflow-First Development section exists in template
- **AC**: NFR-04
- **Priority**: P0
- **Input**: Read `src/claude/CLAUDE.md.template`
- **Expected**: File contains `## Workflow-First Development` heading
- **Validation**: `content.includes('## Workflow-First Development')`

### T03: Intent Detection subsection exists
- **AC**: FR-01 (prerequisite)
- **Priority**: P0
- **Input**: Read `CLAUDE.md`
- **Expected**: Workflow-First section contains intent detection instructions (subsection or identifiable block)
- **Validation**: Content between `## Workflow-First Development` and next `## ` heading contains intent-related keywords (`intent`, `detect`, `feature`, `fix`, `upgrade`)

### T04: Consent Protocol subsection exists
- **AC**: FR-02 (prerequisite)
- **Priority**: P0
- **Input**: Read `CLAUDE.md`
- **Expected**: Workflow-First section contains consent protocol instructions
- **Validation**: Workflow-First section content contains consent-related keywords (`consent`, `confirm`, `approval`, or `permission`)

### T05: Edge Case handling subsection exists
- **AC**: FR-04 (prerequisite)
- **Priority**: P0
- **Input**: Read `CLAUDE.md`
- **Expected**: Workflow-First section contains edge case or ambiguity handling
- **Validation**: Workflow-First section content contains edge-case keywords (`ambiguous`, `clarif`, or `active workflow`)

---

## Group 2: Intent Detection -- Feature (T06-T07)

### T06: Feature intent keywords present
- **AC**: AC-01.1
- **Priority**: P0
- **Input**: Read `CLAUDE.md`, extract Workflow-First section
- **Expected**: Section contains feature intent signal words or phrases (e.g., "add", "build", "implement", "create", "feature")
- **Validation**: At least 3 of these keywords present in the section: `add`, `build`, `implement`, `create`, `feature`

### T07: Feature intent example phrases present
- **AC**: AC-01.1
- **Priority**: P1
- **Input**: Read `CLAUDE.md`, extract Workflow-First section
- **Expected**: Section contains example phrases demonstrating feature intent (or describes the pattern)
- **Validation**: Section references feature-type conversational patterns

---

## Group 3: Intent Detection -- Fix (T08-T09)

### T08: Fix intent keywords present
- **AC**: AC-01.2
- **Priority**: P0
- **Input**: Read `CLAUDE.md`, extract Workflow-First section
- **Expected**: Section contains fix intent signal words (e.g., "broken", "fix", "bug", "crash", "error", "500")
- **Validation**: At least 3 of: `broken`, `fix`, `bug`, `crash`, `error`

### T09: Fix intent maps to fix workflow
- **AC**: AC-01.2
- **Priority**: P0
- **Input**: Read `CLAUDE.md`, extract Workflow-First section
- **Expected**: Fix intent is associated with fix/bug workflow, not feature
- **Validation**: Section contains mapping from fix-type intent to `/isdlc fix` or equivalent reference

---

## Group 4: Intent Detection -- Upgrade (T10-T11)

### T10: Upgrade intent keywords present
- **AC**: AC-01.3
- **Priority**: P0
- **Input**: Read `CLAUDE.md`, extract Workflow-First section
- **Expected**: Section contains upgrade intent signal words (e.g., "upgrade", "update", "bump", "dependency", "version")
- **Validation**: At least 2 of: `upgrade`, `update`, `bump`, `version`

### T11: Upgrade intent maps to upgrade workflow
- **AC**: AC-01.3
- **Priority**: P1
- **Input**: Read `CLAUDE.md`, extract Workflow-First section
- **Expected**: Upgrade intent is associated with `/isdlc upgrade` or equivalent
- **Validation**: Section contains mapping from upgrade-type intent to upgrade workflow

---

## Group 5: Intent Detection -- Test Run (T12-T13)

### T12: Test run intent keywords present
- **AC**: AC-01.4
- **Priority**: P0
- **Input**: Read `CLAUDE.md`, extract Workflow-First section
- **Expected**: Section contains test run signal words (e.g., "run tests", "check if tests pass", "test suite")
- **Validation**: Section contains test-run-related phrases

### T13: Test run intent maps to test run command
- **AC**: AC-01.4
- **Priority**: P1
- **Input**: Read `CLAUDE.md`, extract Workflow-First section
- **Expected**: Test run intent maps to `/isdlc test run` or equivalent
- **Validation**: Section contains mapping from test-run intent to appropriate command

---

## Group 6: Intent Detection -- Test Generate (T14-T15)

### T14: Test generate intent keywords present
- **AC**: AC-01.5
- **Priority**: P0
- **Input**: Read `CLAUDE.md`, extract Workflow-First section
- **Expected**: Section contains test generation signal words (e.g., "write tests", "add tests", "generate tests", "test coverage")
- **Validation**: Section contains test-generation-related phrases

### T15: Test generate intent maps to test generate command
- **AC**: AC-01.5
- **Priority**: P1
- **Input**: Read `CLAUDE.md`, extract Workflow-First section
- **Expected**: Test generate intent maps to `/isdlc test generate` or equivalent
- **Validation**: Section contains mapping from test-generate intent to appropriate command

---

## Group 7: Intent Detection -- Discovery (T16-T17)

### T16: Discovery intent keywords present
- **AC**: AC-01.6
- **Priority**: P0
- **Input**: Read `CLAUDE.md`, extract Workflow-First section
- **Expected**: Section contains discovery/setup signal words (e.g., "set up", "configure", "initialize", "discover")
- **Validation**: At least 2 of: `set up`, `configure`, `initialize`, `discover`

### T17: Discovery intent maps to discover command
- **AC**: AC-01.6
- **Priority**: P1
- **Input**: Read `CLAUDE.md`, extract Workflow-First section
- **Expected**: Discovery intent maps to `/discover` or equivalent
- **Validation**: Section contains mapping from setup/discover intent to `/discover`

---

## Group 8: Consent Protocol (T18-T24)

### T18: Consent inform step described
- **AC**: AC-02.1
- **Priority**: P0
- **Input**: Read `CLAUDE.md`, extract Workflow-First section
- **Expected**: Section instructs Claude to inform the user what was detected and what command will run before executing
- **Validation**: Section contains words related to informing (`inform`, `tell`, `present`, `explain what`, `detected`)

### T19: No jargon in consent messages
- **AC**: AC-02.2
- **Priority**: P0
- **Input**: Read `CLAUDE.md`, extract Workflow-First section
- **Expected**: Section instructs Claude to avoid framework jargon in user-facing messages
- **Validation**: Section contains instruction to avoid jargon or use plain language (e.g., `plain language`, `no jargon`, `don't mention phases`, `don't say Phase 01`)

### T20: Confirmation handling described
- **AC**: AC-02.3
- **Priority**: P0
- **Input**: Read `CLAUDE.md`, extract Workflow-First section
- **Expected**: Section describes what to do when user confirms (invoke the command)
- **Validation**: Section contains instructions for handling positive confirmation (`confirms`, `yes`, `go ahead`, `invoke`, `proceed`)

### T21: Decline handling described
- **AC**: AC-02.4
- **Priority**: P0
- **Input**: Read `CLAUDE.md`, extract Workflow-First section
- **Expected**: Section describes what to do when user declines (do not invoke, ask what they want)
- **Validation**: Section contains instructions for handling decline (`declines`, `no`, `don't`, `not invoke`, `ask what`)

### T22: Consent message brevity requirement
- **AC**: AC-02.5
- **Priority**: P1
- **Input**: Read `CLAUDE.md`, extract Workflow-First section
- **Expected**: Section specifies consent should be brief/concise (not multi-paragraph)
- **Validation**: Section contains brevity instruction (`short`, `concise`, `brief`, `single`, `one`)

### T23: Consent uses user-friendly language
- **AC**: AC-05.2, AC-05.3
- **Priority**: P0
- **Input**: Read `CLAUDE.md`, extract Workflow-First section
- **Expected**: Section instructs Claude to describe actions in user terms, not framework terms
- **Validation**: Section contains user-terms instruction (e.g., `user terms`, `user-friendly`, or negative instruction like `don't say /isdlc`)

### T24: No slash command suggestions to users
- **AC**: AC-05.1
- **Priority**: P0
- **Input**: Read `CLAUDE.md`, extract Workflow-First section
- **Expected**: Section instructs Claude to NOT suggest slash commands to users
- **Validation**: Section contains instruction to not mention/suggest slash commands (`don't suggest`, `never mention`, `not suggest`, `slash command`)

---

## Group 9: Intent-to-Command Mapping Table (T25-T31)

### T25: Feature maps to /isdlc feature
- **AC**: AC-03.1
- **Priority**: P0
- **Input**: Read `CLAUDE.md`, extract Workflow-First section
- **Expected**: Feature intent maps to `/isdlc feature`
- **Validation**: Section contains `/isdlc feature` command reference in mapping context

### T26: Fix maps to /isdlc fix
- **AC**: AC-03.2
- **Priority**: P0
- **Input**: Read `CLAUDE.md`, extract Workflow-First section
- **Expected**: Fix intent maps to `/isdlc fix`
- **Validation**: Section contains `/isdlc fix` command reference in mapping context

### T27: Upgrade maps to /isdlc upgrade
- **AC**: AC-03.3
- **Priority**: P0
- **Input**: Read `CLAUDE.md`, extract Workflow-First section
- **Expected**: Upgrade intent maps to `/isdlc upgrade`
- **Validation**: Section contains `/isdlc upgrade` command reference in mapping context

### T28: Test run maps to /isdlc test run
- **AC**: AC-03.4
- **Priority**: P0
- **Input**: Read `CLAUDE.md`, extract Workflow-First section
- **Expected**: Test run intent maps to `/isdlc test run`
- **Validation**: Section contains `/isdlc test run` command reference

### T29: Test generate maps to /isdlc test generate
- **AC**: AC-03.5
- **Priority**: P0
- **Input**: Read `CLAUDE.md`, extract Workflow-First section
- **Expected**: Test generate intent maps to `/isdlc test generate`
- **Validation**: Section contains `/isdlc test generate` command reference

### T30: Discovery maps to /discover
- **AC**: AC-03.6
- **Priority**: P0
- **Input**: Read `CLAUDE.md`, extract Workflow-First section
- **Expected**: Discovery/setup intent maps to `/discover`
- **Validation**: Section contains `/discover` command reference in mapping context

### T31: Slash command passthrough preserved
- **AC**: AC-03.7
- **Priority**: P0
- **Input**: Read `CLAUDE.md`, extract Workflow-First section
- **Expected**: Section instructs Claude to execute explicit slash commands immediately without re-asking
- **Validation**: Section contains passthrough instruction (`immediately`, `execute`, `directly`, `without re-asking`, `already invoked`)

---

## Group 10: Edge Cases (T32-T36)

### T32: Ambiguous intent handling described
- **AC**: AC-04.1
- **Priority**: P0
- **Input**: Read `CLAUDE.md`, extract Workflow-First section
- **Expected**: Section instructs Claude to ask clarifying questions when intent is ambiguous
- **Validation**: Section contains ambiguity-handling instruction (`ambiguous`, `clarif`, `ask`, `unclear`)

### T33: Non-development passthrough described
- **AC**: AC-04.2
- **Priority**: P0
- **Input**: Read `CLAUDE.md`, extract Workflow-First section
- **Expected**: Section instructs Claude to respond normally to non-dev conversations without triggering workflow detection
- **Validation**: Section contains passthrough instruction for questions/exploration (`question`, `explore`, `explain`, `normally`, `not trigger`)

### T34: Active workflow protection described
- **AC**: AC-04.3
- **Priority**: P0
- **Input**: Read `CLAUDE.md`, extract Workflow-First section
- **Expected**: Section instructs Claude to not start new workflow when one is active
- **Validation**: Section contains active-workflow guard (`active workflow`, `in progress`, `already running`, `cancel`)

### T35: Refactoring treated as feature
- **AC**: AC-04.4
- **Priority**: P1
- **Input**: Read `CLAUDE.md`, extract Workflow-First section
- **Expected**: Section instructs Claude to treat refactoring requests as feature intent
- **Validation**: Section contains refactor-to-feature mapping (`refactor`, `feature`)

### T36: Non-dev requests passthrough
- **AC**: AC-04.5
- **Priority**: P1
- **Input**: Read `CLAUDE.md`, extract Workflow-First section
- **Expected**: Section explicitly excludes explanation/understanding requests from intent detection
- **Validation**: Section contains exclusion for explanation-type requests (`explain`, `understand`, `what does`, `help me`)

---

## Group 11: Invisible Framework Principle (T37-T40)

### T37: Progress updates remain visible
- **AC**: AC-05.4
- **Priority**: P1
- **Input**: Read `CLAUDE.md`, extract Workflow-First section
- **Expected**: Section clarifies that progress updates, phase transitions, and quality checks remain visible to the user
- **Validation**: Section contains visibility instruction (`progress`, `visible`, `transition`, `quality`)

### T38: Framework explainable on request
- **AC**: AC-05.5
- **Priority**: P2
- **Input**: Read `CLAUDE.md`, extract Workflow-First section
- **Expected**: Section allows Claude to explain slash commands if user explicitly asks
- **Validation**: Section contains discoverability instruction (`asks about`, `explain`, `not secret`, `request`)

### T39: No framework jargon in consent example language
- **AC**: AC-05.2, AC-05.3
- **Priority**: P1
- **Input**: Read `CLAUDE.md`, extract Workflow-First section
- **Expected**: Any example consent messages in the section use user-friendly language (e.g., "I'll track this as a new feature" not "I'll run /isdlc feature")
- **Validation**: If example consent messages exist, verify they use user-terms

### T40: Section does not expose slash commands as primary interaction
- **AC**: AC-05.1
- **Priority**: P0
- **Input**: Read `CLAUDE.md`, extract Workflow-First section
- **Expected**: The section does not instruct Claude to suggest slash commands as the default way to interact
- **Validation**: Section does not contain instruction to "offer" or "suggest" slash commands to users as the primary interaction

---

## Group 12: Template Consistency Integration Tests (T41-T43)

### T41: Workflow-First section present in both files
- **AC**: NFR-04
- **Priority**: P0
- **Input**: Read both `CLAUDE.md` and `src/claude/CLAUDE.md.template`
- **Expected**: Both files contain `## Workflow-First Development` heading
- **Validation**: Both files pass heading check

### T42: Intent detection content present in both files
- **AC**: NFR-04
- **Priority**: P0
- **Input**: Read Workflow-First section from both files
- **Expected**: Both files contain the 6 intent category keywords (feature, fix, upgrade, test run, test generate, discover)
- **Validation**: All 6 intent categories present in both files' sections

### T43: Template Workflow-First section is subset of CLAUDE.md section
- **AC**: NFR-04
- **Priority**: P1
- **Input**: Read both files, extract Workflow-First sections
- **Expected**: The template's Workflow-First section content is fully contained within CLAUDE.md's section (CLAUDE.md may have project-specific additions)
- **Validation**: Key content paragraphs from template appear in CLAUDE.md

---

## Group 13: Regression Tests -- Unchanged Sections (T44-T46)

### T44: Agent Framework Context section unchanged
- **AC**: NFR-02
- **Priority**: P0
- **Input**: Read `CLAUDE.md`
- **Expected**: `## Agent Framework Context` heading exists and section contains key subheadings (`### SKILL OBSERVABILITY Protocol`, `### SUGGESTED PROMPTS`, `### CONSTITUTIONAL PRINCIPLES`)
- **Validation**: All 3 subheadings present

### T45: SKILL OBSERVABILITY content preserved
- **AC**: NFR-02
- **Priority**: P1
- **Input**: Read `CLAUDE.md`
- **Expected**: SKILL OBSERVABILITY section contains expected key phrases ("logged for visibility", "cross-phase usage")
- **Validation**: Key phrases present

### T46: SUGGESTED PROMPTS content preserved
- **AC**: NFR-02
- **Priority**: P1
- **Input**: Read `CLAUDE.md`
- **Expected**: SUGGESTED PROMPTS section contains expected key phrases ("SUGGESTED NEXT STEPS", "primary_prompt")
- **Validation**: Key phrases present

---

## Group 14: NFR Validation (T47-T49)

### T47: All 6 mapping commands referenced
- **AC**: NFR-03 (maintainability -- single mapping table)
- **Priority**: P0
- **Input**: Read `CLAUDE.md`, extract Workflow-First section
- **Expected**: All 6 commands appear: `/isdlc feature`, `/isdlc fix`, `/isdlc upgrade`, `/isdlc test run`, `/isdlc test generate`, `/discover`
- **Validation**: Count of unique command references equals 6

### T48: Mapping table is consolidated (maintainability)
- **AC**: NFR-03
- **Priority**: P2
- **Input**: Read `CLAUDE.md`, extract Workflow-First section
- **Expected**: Commands appear in a structured mapping (table or list), not scattered across prose
- **Validation**: Section contains a table (pipe `|` characters) or structured list with all commands in close proximity (within 20 lines of each other)

### T49: All 6 intent categories have distinct signal words
- **AC**: NFR-01 (reliability -- distinct categories reduce false positives)
- **Priority**: P1
- **Input**: Read `CLAUDE.md`, extract Workflow-First section
- **Expected**: Each of the 6 intent categories has at least 2 distinct signal words/phrases
- **Validation**: Each category's keyword set does not fully overlap with another category's set

---

## Priority Summary

| Priority | Count | Description |
|----------|-------|-------------|
| P0 | 25 | Critical path: section existence, all intent categories, consent, mapping, edge cases |
| P1 | 16 | Important: examples, brevity, template consistency, regression guards |
| P2 | 3 | Nice-to-have: discoverability, table structure, distinct signals |
| **Total** | **49** | |
