# Module Design: STEP 3d Skill Injection Rewrite

**Requirement ID**: REQ-0033
**Artifact Folder**: REQ-0033-skill-index-injection-unify-blocks
**Phase**: 04-design
**Version**: 1.0.0
**Created**: 2026-02-23
**Status**: Accepted
**Traces**: FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, ADR-0001 through ADR-0004

---

## 1. Overview

This module design specifies the exact markdown text changes to `src/claude/commands/isdlc.md` STEP 3d and the corresponding test assertion updates in `src/claude/hooks/tests/skill-injection.test.cjs`. The design replaces two curly-brace comment blocks (lines 1724-1744) with imperative numbered instructions placed BEFORE the Task tool template literal, plus simplified reference placeholders inside the template.

**Design principle**: The GATE REQUIREMENTS INJECTION block (lines 1745-1768) and BUDGET DEGRADATION INJECTION block (lines 1769-1790) are operational and use curly-brace format. This design does NOT modify them (CON-006). Only the two skill injection blocks are rewritten.

---

## 2. Current State (Lines to Replace)

### 2.1 Lines 1724-1744 in isdlc.md (INSIDE the template literal)

The following text exists inside the backtick-fenced code block that starts at line 1717 (```` ``` ````):

```
   {SKILL INDEX BLOCK — look up target agent's owned skills from skills-manifest, format as AVAILABLE SKILLS block using getAgentSkillIndex() + formatSkillIndexBlock(). Include only if non-empty.}
   {EXTERNAL SKILL INJECTION (REQ-0022) — After constructing the delegation prompt above, inject any matched external skill content. This block is fail-open — if anything fails, continue with the unmodified prompt.
    1. Read docs/isdlc/external-skills-manifest.json (or monorepo equivalent) using Read tool.
       If file does not exist or is empty: SKIP injection entirely (no-op).
       Parse as JSON. If parse fails: SKIP injection (log warning).
    2. Filter skills for current phase/agent:
       For each skill in manifest.skills:
         - If skill.bindings is missing: SKIP (backward compat)
         - If skill.bindings.injection_mode !== "always": SKIP
         - If current phase_key is NOT in skill.bindings.phases AND current agent name is NOT in skill.bindings.agents: SKIP
         - This skill matches — proceed to injection
    3. For each matched skill, read and format:
       - Read the skill .md file from the external skills directory (.claude/skills/external/)
       - If file not found: log warning, skip this skill
       - If content > 10,000 chars: truncate and switch to reference delivery
       - Format based on delivery_type:
         "context": EXTERNAL SKILL CONTEXT: {name}\n---\n{content}\n---
         "instruction": EXTERNAL SKILL INSTRUCTION ({name}): You MUST follow these guidelines:\n{content}
         "reference": EXTERNAL SKILL AVAILABLE: {name} -- Read from {path} if relevant
    4. Append all formatted blocks to the delegation prompt, joined with double newlines.
    5. Error handling: If any error occurs in steps 1-4, continue with unmodified prompt. Log warning but never block.}
```

### 2.2 Problem

These curly-brace blocks are ambiguous to the Phase-Loop Controller (LLM). Curly braces in the template context are typically used for simple variable substitution (e.g., `{phase_key}`, `{agent_name}`). The multi-step procedural instructions inside the EXTERNAL SKILL INJECTION block do not fit this pattern. The LLM may:
- Treat the entire block as a placeholder to fill with a literal string
- Skip the block entirely, treating it as documentation
- Partially execute it but miss steps

The GATE REQUIREMENTS INJECTION and BUDGET DEGRADATION INJECTION blocks have the same format but are known to execute correctly because they contain more explicit imperative language and the LLM has learned their pattern through repeated exposure. The skill injection blocks are newer and have never been executed.

---

## 3. Target State: Exact Replacement Text

### 3.1 Instruction Block (BEFORE the template literal)

The following text is inserted between the discovery context paragraph (current line 1715) and the template literal opening (current line 1717). It replaces nothing -- it is NEW text inserted at this position.

**Insert after line 1715** (after the discovery context paragraph, before the ```` ``` ```` that opens the template):

```markdown
**Skill injection** (before constructing the Task tool prompt below, execute these steps to build skill context):

**SKILL INJECTION STEP A — Built-In Skill Index**:
1. Run this single-line Bash command (replace `{agent_name}` with the resolved agent name from the table above):
   ```
   node -e "const c = require('./src/claude/hooks/lib/common.cjs'); const r = c.getAgentSkillIndex('{agent_name}'); process.stdout.write(c.formatSkillIndexBlock(r));"
   ```
2. If the Bash tool call succeeds and produces non-empty stdout: save the output as `{built_in_skills_block}`.
3. If the Bash tool call fails or produces empty output: set `{built_in_skills_block}` to empty string. Continue to Step B.

**SKILL INJECTION STEP B — External Skills** (fail-open — if ANY step fails, set `{external_skills_blocks}` to empty and skip to Step C):
1. Determine the external skills manifest path:
   - If MONOREPO CONTEXT is present in the current delegation: `docs/isdlc/projects/{project-id}/external-skills-manifest.json`
   - Otherwise: `docs/isdlc/external-skills-manifest.json`
2. Read the manifest file using Read tool.
   - If file does not exist or Read fails: set `{external_skills_blocks}` to empty. SKIP to Step C.
3. Parse the content as JSON. If parse fails: set `{external_skills_blocks}` to empty. SKIP to Step C.
4. Filter `manifest.skills[]` array: keep only skills where ALL of these conditions are true:
   - `skill.bindings` exists (skip skills without bindings for backward compatibility)
   - `skill.bindings.injection_mode === "always"`
   - EITHER the current `{phase_key}` is in `skill.bindings.phases[]` OR the current `{agent_name}` is in `skill.bindings.agents[]`
5. If no skills match the filter: set `{external_skills_blocks}` to empty. SKIP to Step C.
6. For each matched skill:
   a. Determine the external skills directory:
      - If MONOREPO CONTEXT: `.isdlc/projects/{project-id}/skills/external/`
      - Otherwise: `.claude/skills/external/`
   b. Read `{skills_directory}/{skill.file}` using Read tool.
   c. If Read fails for this skill: skip this skill, continue with next matched skill.
   d. Let `content` = the file contents. If `content.length > 10000` characters: set `delivery_type` to `"reference"` regardless of `skill.bindings.delivery_type`.
   e. Format the skill block based on `delivery_type` (use `skill.bindings.delivery_type` unless overridden by step 6d):
      - `"context"`: `EXTERNAL SKILL CONTEXT: {skill.name}\n---\n{content}\n---`
      - `"instruction"`: `EXTERNAL SKILL INSTRUCTION ({skill.name}): You MUST follow these guidelines:\n{content}`
      - `"reference"`: `EXTERNAL SKILL AVAILABLE: {skill.name} -- Read from {skills_directory}/{skill.file} if relevant to your current task`
7. Join all formatted skill blocks with double newlines (`\n\n`) as `{external_skills_blocks}`.

**SKILL INJECTION STEP C — Assemble into delegation prompt**:
- If `{built_in_skills_block}` is non-empty: include it in the delegation prompt after DISCOVERY CONTEXT (or after WORKFLOW MODIFIERS if no discovery context).
- If `{external_skills_blocks}` is non-empty: include it after `{built_in_skills_block}`, separated by a blank line.
- If both are empty: include nothing — no skill-related content in the prompt.
```

### 3.2 Template Literal Changes (INSIDE the backtick-fenced code block)

**Replace lines 1724-1744** (the two curly-brace blocks) with these two short reference lines:

```
   {built_in_skills_block — from SKILL INJECTION STEP A above, omit if empty}
   {external_skills_blocks — from SKILL INJECTION STEP B above, omit if empty}
```

### 3.3 Complete STEP 3d After Changes

For clarity, here is the full STEP 3d text after the modifications (from the agent_modifiers paragraph through the end of the template literal). Unchanged lines are marked with `[UNCHANGED]`.

```markdown
Read `agent_modifiers` for this phase from `.isdlc/state.json` → `active_workflow.type`, then look up the workflow in `workflows.json` → `workflows[type].agent_modifiers[phase_key]`. If modifiers exist, include them as `WORKFLOW MODIFIERS: {json}` in the prompt.  [UNCHANGED]

**Discovery context** (phases 02 and 03 only): If `phase_key` starts with `02-` or `03-`, read `.isdlc/state.json` → `discovery_context`. If it exists and `completed_at` is within 24 hours, include as a `DISCOVERY CONTEXT` block. If older than 24h, include with a `⚠️ STALE` warning. Otherwise omit.  [UNCHANGED]

**Skill injection** (before constructing the Task tool prompt below, execute these steps to build skill context):  [NEW]

**SKILL INJECTION STEP A — Built-In Skill Index**:  [NEW — full text in Section 3.1]
1. Run this single-line Bash command ...
2. If succeeds and non-empty: save as {built_in_skills_block}.
3. If fails or empty: set to empty. Continue to Step B.

**SKILL INJECTION STEP B — External Skills** (fail-open ...):  [NEW — full text in Section 3.1]
1-7. [Steps as specified in Section 3.1]

**SKILL INJECTION STEP C — Assemble into delegation prompt**:  [NEW — full text in Section 3.1]
- [Assembly rules as specified in Section 3.1]

```                                                    [UNCHANGED — template literal opens]
Use Task tool → {agent_name} with:                     [UNCHANGED]
  "Execute Phase {NN} - {Phase Name} for {workflow_type} workflow.  [UNCHANGED]
   Artifact folder: {artifact_folder}                  [UNCHANGED]
   Phase key: {phase_key}                              [UNCHANGED]
   {WORKFLOW MODIFIERS: {json} — if applicable}        [UNCHANGED]
   {DISCOVERY CONTEXT: ... — if phase 02 or 03}       [UNCHANGED]
   {built_in_skills_block — from SKILL INJECTION STEP A above, omit if empty}  [CHANGED — was lines 1724]
   {external_skills_blocks — from SKILL INJECTION STEP B above, omit if empty}  [CHANGED — was lines 1725-1744]
   {GATE REQUIREMENTS INJECTION (REQ-0024) — ...}     [UNCHANGED — lines 1745-1768]
   {BUDGET DEGRADATION INJECTION (REQ-0022) — ...}    [UNCHANGED — lines 1769-1790]
   PHASE_TIMING_REPORT: Include { ... } in your result.  [UNCHANGED]
   Do NOT emit SUGGESTED NEXT STEPS ...                [UNCHANGED]
   Validate GATE-{NN} on completion."                  [UNCHANGED]
```                                                    [UNCHANGED — template literal closes]
```

---

## 4. AVAILABLE SKILLS Block Format

The `formatSkillIndexBlock()` function in `common.cjs` (lines 1438-1452) produces this exact format:

```
AVAILABLE SKILLS (consult when relevant using Read tool):
  DEV-001: code-implementation -- Description text
    -> src/claude/skills/development/code-implementation/SKILL.md
  DEV-002: code-review-prep -- Description text
    -> src/claude/skills/development/code-review-prep/SKILL.md
```

**Format rules** (from the function source):
- Header line: `AVAILABLE SKILLS (consult when relevant using Read tool):`
- Per skill: 2 lines
  - Line 1: `  {id}: {name} -- {description}` (2-space indent, em-dash between name and description)
  - Line 2: `    -> {path}` (4-space indent, right-arrow, relative path to SKILL.md)
- Lines joined with `\n`
- Empty array returns empty string (no block at all)
- Maximum ~30 lines for 14 entries (14 skills x 2 lines + 1 header = 29 lines)

**Note on character encoding**: The actual function uses Unicode em-dash (U+2014: `--`) and right-arrow (U+2192: `->`) characters. The implementation MUST NOT alter these -- the output of `formatSkillIndexBlock()` is used verbatim.

**Traces**: FR-001 (AC-001-01, AC-001-03), FR-003 (AC-003-02), NFR-001

---

## 5. External Skill Block Formats

The `formatSkillInjectionBlock()` function in `common.cjs` (lines 981-993) produces these formats:

### 5.1 Context delivery (`delivery_type: "context"`)

```
EXTERNAL SKILL CONTEXT: {name}
---
{content}
---
```

### 5.2 Instruction delivery (`delivery_type: "instruction"`)

```
EXTERNAL SKILL INSTRUCTION ({name}): You MUST follow these guidelines:
{content}
```

### 5.3 Reference delivery (`delivery_type: "reference"`)

```
EXTERNAL SKILL AVAILABLE: {name} -- Read from {path} if relevant to your current task
```

### 5.4 Truncation Override

When `content.length > 10000`, the delivery type is forced to `"reference"` regardless of the manifest's `delivery_type` value (AC-002-04, NFR-006). The reference format includes the file path so the agent can read it on demand.

**Traces**: FR-002 (AC-002-04 through AC-002-07), NFR-006

---

## 6. Unified Delegation Prompt Assembly

The final delegation prompt has this structure (skill-related sections highlighted):

```
Execute Phase {NN} - {Phase Name} for {workflow_type} workflow.
Artifact folder: {artifact_folder}
Phase key: {phase_key}
WORKFLOW MODIFIERS: {json}                         (if applicable)
DISCOVERY CONTEXT: ...                             (if phase 02 or 03)

AVAILABLE SKILLS (consult when relevant using Read tool):     <-- built-in skills
  DEV-001: code-implementation -- Description text
    -> src/claude/skills/development/code-implementation/SKILL.md
  ...

EXTERNAL SKILL CONTEXT: my-coding-standards                   <-- external skill #1
---
{content of my-coding-standards.md}
---

EXTERNAL SKILL INSTRUCTION (security-rules): You MUST ...     <-- external skill #2
{content of security-rules.md}

GATE REQUIREMENTS: ...                             (if applicable)
BUDGET_DEGRADATION: ...                            (if applicable)
PHASE_TIMING_REPORT: Include { ... } in your result.
Do NOT emit SUGGESTED NEXT STEPS ...
Validate GATE-{NN} on completion.
```

**Ordering rules** (FR-003, AC-003-02):
1. Built-in AVAILABLE SKILLS block appears first (after discovery context / workflow modifiers)
2. External skill blocks appear after, each separated by a blank line
3. Gate requirements and budget degradation follow after all skill blocks
4. If only built-in skills exist, only the AVAILABLE SKILLS block appears (AC-003-03)
5. If only external skills match, only external blocks appear (AC-003-04)
6. If neither produces output, no skill content is added -- the prompt flows directly from discovery context to gate requirements (AC-003-05)

**Traces**: FR-003 (AC-003-01 through AC-003-05)

---

## 7. Error Handling Design

### 7.1 Fail-Open Boundaries

Each injection step has an explicit error boundary. The design follows the pattern established by GATE REQUIREMENTS INJECTION:

| Stage | Error Condition | Behavior | AC |
|-------|----------------|----------|-----|
| Step A.1 | Bash tool call fails (node not found, require error, function throws) | Set `{built_in_skills_block}` to empty, continue to Step B | AC-006-01, AC-006-04 |
| Step A.1 | Bash tool returns empty stdout | Set `{built_in_skills_block}` to empty (no-op), continue to Step B | AC-001-02 |
| Step B.2 | Read tool fails (file not found) | Set `{external_skills_blocks}` to empty, skip to Step C | AC-002-02 |
| Step B.3 | JSON parse fails (malformed manifest) | Set `{external_skills_blocks}` to empty, skip to Step C | AC-006-02 |
| Step B.5 | No skills match filter | Set `{external_skills_blocks}` to empty, skip to Step C | AC-002-03 |
| Step B.6c | Individual skill file Read fails | Skip that skill, continue with next matched skill | AC-006-03 |
| Step B.6d | Content exceeds 10K chars | Override delivery_type to "reference" | AC-002-04 |
| Step C | Both blocks empty | No skill content in prompt (clean no-op) | AC-003-05 |

### 7.2 Error Propagation

Errors do NOT propagate between stages:
- A failure in Step A does not affect Step B
- A failure in Step B does not affect Step C (Step C always runs -- it just assembles whatever is available)
- A failure in Steps A or B does not affect GATE REQUIREMENTS INJECTION or BUDGET DEGRADATION INJECTION (they are independent downstream blocks)

### 7.3 No Logging Requirement

The current implementation does not have a logging mechanism within the isdlc.md execution context. The fail-open instructions tell the LLM to "skip" and "continue" rather than to log. This is consistent with how the GATE REQUIREMENTS INJECTION block handles errors (it says "continue with unmodified prompt" without specifying a log target).

**Traces**: FR-006 (AC-006-01 through AC-006-04), NFR-003

---

## 8. Monorepo Path Resolution

### 8.1 Detection

The Phase-Loop Controller detects monorepo mode by checking if a `MONOREPO CONTEXT` block is present in the current execution context. This block is set by the orchestrator when delegating to the Phase-Loop Controller in monorepo mode.

### 8.2 Path Resolution Table

| Resource | Single-Project Path | Monorepo Path |
|----------|-------------------|---------------|
| External skills manifest | `docs/isdlc/external-skills-manifest.json` | `docs/isdlc/projects/{project-id}/external-skills-manifest.json` |
| External skill files | `.claude/skills/external/` | `.isdlc/projects/{project-id}/skills/external/` |

### 8.3 Fallback

If in monorepo mode and the project-specific manifest does not exist, the Read tool will return a "file not found" error. Step B.2 catches this and sets `{external_skills_blocks}` to empty (AC-005-03).

The built-in skill index (Step A) does NOT need monorepo path resolution because `getAgentSkillIndex()` in common.cjs handles its own path resolution internally using `getProjectRoot()` and dual-path resolution.

**Traces**: FR-005 (AC-005-01, AC-005-02, AC-005-03)

---

## 9. External Skills Manifest Schema (Read-Only Reference)

The external-skills-manifest.json has this structure (referenced by Step B instructions):

```json
{
  "version": "1.0.0",
  "skills": [
    {
      "name": "my-coding-standards",
      "file": "my-coding-standards.md",
      "added_at": "2026-02-18T12:00:00Z",
      "bindings": {
        "agents": ["software-developer"],
        "phases": ["06-implementation"],
        "injection_mode": "always",
        "delivery_type": "context"
      }
    }
  ]
}
```

**Key fields for filtering** (Step B.4):
- `skill.bindings` -- must exist (skip skills without bindings)
- `skill.bindings.injection_mode` -- must equal `"always"` (only mode currently supported)
- `skill.bindings.phases[]` -- array of phase keys the skill applies to
- `skill.bindings.agents[]` -- array of agent names the skill applies to
- `skill.bindings.delivery_type` -- one of `"context"`, `"instruction"`, `"reference"`

**Key fields for reading** (Step B.6):
- `skill.name` -- display name used in formatted blocks
- `skill.file` -- filename in the external skills directory

---

## 10. Test Updates: TC-09 in skill-injection.test.cjs

### 10.1 Current TC-09 Tests (Lines 769-808)

Three tests validate the STEP 3d template structure:

| Test | Current Assertion | Passes Today? |
|------|------------------|---------------|
| TC-09.1 | `content.includes('SKILL INDEX BLOCK') \|\| content.includes('SKILL_INDEX_BLOCK') \|\| content.includes('AVAILABLE SKILLS')` | Yes (matches "SKILL INDEX BLOCK" on line 1724) |
| TC-09.2 | Skill block position > WORKFLOW MODIFIERS position | Yes (line 1724 > line 1722) |
| TC-09.3 | `content.includes('Validate GATE')` | Yes (line 1793) |

### 10.2 Required TC-09 Changes

After the rewrite, the text `SKILL INDEX BLOCK` will no longer appear in isdlc.md (it was part of the curly-brace comment that is being removed). The new text uses `SKILL INJECTION STEP A` and `getAgentSkillIndex`.

**TC-09.1** -- Update assertion to match new instruction wording:

```javascript
// BEFORE:
assert.ok(
    content.includes('SKILL INDEX BLOCK') || content.includes('SKILL_INDEX_BLOCK') ||
    content.includes('AVAILABLE SKILLS'),
    'STEP 3d template must include skill index block placeholder or instruction'
);

// AFTER:
assert.ok(
    content.includes('SKILL INJECTION STEP A') &&
    content.includes('getAgentSkillIndex') &&
    content.includes('formatSkillIndexBlock'),
    'STEP 3d must include SKILL INJECTION STEP A with getAgentSkillIndex and formatSkillIndexBlock instructions'
);
```

**TC-09.2** -- Update position check to use new text:

```javascript
// BEFORE:
const skillPos = content.indexOf('SKILL INDEX BLOCK') !== -1
    ? content.indexOf('SKILL INDEX BLOCK')
    : content.indexOf('AVAILABLE SKILLS');

// AFTER:
const skillPos = content.indexOf('SKILL INJECTION STEP A');
```

The assertion logic remains the same: `skillPos > modifiersPos`. The new instruction block is placed after the discovery context paragraph, which is after WORKFLOW MODIFIERS. This ordering is preserved.

**TC-09.3** -- No changes needed. The `Validate GATE` instruction remains in the template at line 1793 (now at a slightly different line number but same content).

### 10.3 New TC-09 Tests to Add

Three additional assertions to validate the external skill injection instructions:

**TC-09.4**: External skill injection instructions exist.

```javascript
it('TC-09.4: STEP 3d includes external skill injection instructions', () => {
    const content = fs.readFileSync(ISDLC_MD_PATH, 'utf8');
    assert.ok(
        content.includes('SKILL INJECTION STEP B') &&
        content.includes('external-skills-manifest.json'),
        'STEP 3d must include SKILL INJECTION STEP B with external manifest reference'
    );
});
```

**TC-09.5**: Fail-open language is present for both steps.

```javascript
it('TC-09.5: skill injection steps include fail-open language', () => {
    const content = fs.readFileSync(ISDLC_MD_PATH, 'utf8');
    // Step A: "If the Bash tool call fails"
    assert.ok(
        content.includes('Bash tool call fails') || content.includes('fails or produces empty'),
        'Step A must include fail-open handling for Bash failure'
    );
    // Step B: "fail-open" in the header
    assert.ok(
        content.includes('STEP B') && content.includes('fail-open'),
        'Step B header must include fail-open declaration'
    );
});
```

**TC-09.6**: Assembly step exists.

```javascript
it('TC-09.6: STEP 3d includes skill assembly step', () => {
    const content = fs.readFileSync(ISDLC_MD_PATH, 'utf8');
    assert.ok(
        content.includes('SKILL INJECTION STEP C'),
        'STEP 3d must include SKILL INJECTION STEP C for assembly'
    );
});
```

### 10.4 Test Count Impact

- Before: TC-09 has 3 tests (TC-09.1, TC-09.2, TC-09.3)
- After: TC-09 has 6 tests (TC-09.1 through TC-09.6)
- TC-09.1 and TC-09.2: modified assertions
- TC-09.3: unchanged
- TC-09.4, TC-09.5, TC-09.6: new tests
- Total test file count: 40 existing + 3 new = 43 tests

**Traces**: FR-004 (AC-004-01, AC-004-02)

---

## 11. Implementation Diff Summary

### 11.1 File: `src/claude/commands/isdlc.md`

| Operation | Location | Lines Changed | Description |
|-----------|----------|---------------|-------------|
| INSERT | After line 1715 (after discovery context paragraph) | +40 lines | Skill injection Steps A, B, C instruction block (Section 3.1) |
| REPLACE | Lines 1724-1744 (inside template literal) | -21 lines, +2 lines | Replace two curly-brace blocks with two short reference lines (Section 3.2) |
| Net change | | +21 lines | |

### 11.2 File: `src/claude/hooks/tests/skill-injection.test.cjs`

| Operation | Location | Lines Changed | Description |
|-----------|----------|---------------|-------------|
| MODIFY | TC-09.1 assertion (lines 774-780) | ~4 lines | Update assertion to match `SKILL INJECTION STEP A` + function names |
| MODIFY | TC-09.2 skillPos calculation (lines 787-789) | ~2 lines | Update to use `SKILL INJECTION STEP A` instead of `SKILL INDEX BLOCK` |
| INSERT | After TC-09.3 (after line 807) | +30 lines | Add TC-09.4, TC-09.5, TC-09.6 |
| Net change | | +30 lines | |

### 11.3 Files NOT Modified (Verified)

| File | Reason |
|------|--------|
| `src/claude/hooks/lib/common.cjs` | CON-002: Functions already work correctly |
| `src/claude/hooks/config/skills-manifest.json` | Read-only data source |
| `src/claude/agents/*.md` (51 files) | Consumers -- they reference "AVAILABLE SKILLS in your Task prompt" which now works |
| GATE REQUIREMENTS INJECTION (lines 1745-1768) | CON-006: Not in scope |
| BUDGET DEGRADATION INJECTION (lines 1769-1790) | CON-006: Not in scope |

---

## 12. Bash Command Specification

### 12.1 Exact Command

The Bash command for Step A is a single-line `node -e` expression per CON-004 (Single-Line Bash Convention):

```
node -e "const c = require('./src/claude/hooks/lib/common.cjs'); const r = c.getAgentSkillIndex('{agent_name}'); process.stdout.write(c.formatSkillIndexBlock(r));"
```

### 12.2 Variable Substitution

The Phase-Loop Controller replaces `{agent_name}` with the resolved agent name from the phase-to-agent mapping table (e.g., `software-developer`, `qa-engineer`, `solution-architect`).

### 12.3 Output Behavior

| Scenario | stdout | Action |
|----------|--------|--------|
| Agent has owned skills in manifest | AVAILABLE SKILLS block (multi-line text) | Save as `{built_in_skills_block}` |
| Agent has no owned skills | Empty string (0 bytes) | Set `{built_in_skills_block}` to empty |
| Manifest cannot be loaded | Empty string (getAgentSkillIndex returns []) | Set `{built_in_skills_block}` to empty |
| Node.js not available or script error | Bash tool returns error | Set `{built_in_skills_block}` to empty |

### 12.4 Why `process.stdout.write` Instead of `console.log`

`console.log()` appends a newline after the output. `process.stdout.write()` writes the exact string returned by `formatSkillIndexBlock()` without adding a trailing newline. This ensures the output can be inserted into the delegation prompt without extra whitespace.

**Traces**: FR-001 (AC-001-01, AC-001-02), FR-004 (AC-004-04), ADR-0002, CON-004

---

## 13. Validation Checklist (Pre-Implementation)

Before implementation begins, verify the design satisfies all requirements:

- [x] FR-001: Step A invokes getAgentSkillIndex + formatSkillIndexBlock via Bash tool (Section 3.1, 12.1)
- [x] FR-002: Step B reads external manifest, filters by bindings, reads skill files, formats by delivery_type (Section 3.1)
- [x] FR-003: Step C assembles built-in skills first, external skills second, with correct ordering (Section 6)
- [x] FR-004: Curly-brace blocks replaced with numbered imperative instructions (Section 3.1, 3.2)
- [x] FR-005: Monorepo path resolution addressed in Step B.1 and Step B.6a (Section 8)
- [x] FR-006: Every step has explicit fail-open error handling (Section 7)
- [x] NFR-001: formatSkillIndexBlock output stays within 30 lines (Section 4)
- [x] NFR-002: Total injection adds 2 tool calls maximum (1 Bash + 0-N Reads) within 5s budget
- [x] NFR-003: Zero delegation failures from skill injection errors (Section 7.1)
- [x] NFR-004: Instructions are self-documenting numbered steps (Section 3.1)
- [x] NFR-005: Both single-project and monorepo paths specified (Section 8.2)
- [x] NFR-006: 10K truncation rule in Step B.6d (Section 5.4)
- [x] CON-001: Primary change is markdown in isdlc.md (Section 11.1)
- [x] CON-002: common.cjs NOT modified (Section 11.3)
- [x] CON-004: Single-line Bash command (Section 12.1)
- [x] CON-006: GATE REQUIREMENTS and BUDGET DEGRADATION blocks untouched (Section 11.3)

---

## 14. Constitutional Compliance

| Article | Requirement | Status | Evidence |
|---------|------------|--------|----------|
| Article I (Specification Primacy) | Design implements architecture specs exactly | PASS | Section 3 implements ADR-0001 through ADR-0004 from architecture-overview.md exactly as specified |
| Article IV (Explicit Over Implicit) | No undocumented assumptions | PASS | All error paths documented in Section 7; all path resolution documented in Section 8; variable substitution rules in Section 12.2 |
| Article V (Simplicity First) | No over-engineering | PASS | Step A uses existing JS function via single Bash call; Step B uses LLM-native JSON parsing (no extra JS wrapper); no new files created |
| Article VII (Artifact Traceability) | All designs trace to requirements | PASS | Every section includes Traces references to FR-xxx, AC-xxx, NFR-xxx, CON-xxx |
| Article IX (Quality Gate Integrity) | Required artifacts exist and validated | PASS | This document satisfies module-design requirement for GATE-04 |

---

## 15. Metadata

```json
{
  "phase": "04-design",
  "requirement_id": "REQ-0033",
  "artifact_folder": "REQ-0033-skill-index-injection-unify-blocks",
  "module": "isdlc-md-step-3d",
  "files_modified": 2,
  "files_read_only": 5,
  "test_count_before": 40,
  "test_count_after": 43,
  "constitutional_compliance": "pass",
  "gate_04_status": "pass",
  "debate_rounds_used": 0,
  "fan_out_chunks": 0
}
```
