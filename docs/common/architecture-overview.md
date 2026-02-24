# Architecture Overview: Custom Skill Management (REQ-0022)

**Version**: 1.0
**Created**: 2026-02-18
**Phase**: 03-architecture
**Status**: Accepted

---

## 1. System Context (C4 Level 1)

The iSDLC framework orchestrates software development workflows through specialized agents delegated by a phase-loop controller (`isdlc.md`). External skills are user-provided `.md` files containing domain-specific knowledge (e.g., NestJS conventions, company coding standards) that augment agent behavior during workflow execution. This feature adds a complete skill lifecycle (add, wire, list, remove) and runtime injection into agent Task prompts.

### External Actors

| Actor | Description | Interaction |
|-------|-------------|-------------|
| Developer | Framework user with domain-specific skills to register | Invokes skill management commands (CLI or natural language) |
| Phase-Loop Controller (isdlc.md) | Delegates each workflow phase to its agent | Injects matched external skill content into delegation prompts |
| Claude Code Runtime | Executes agent prompts via Task tool | Provides LLM inference; receives augmented prompts with skill content |
| Filesystem | Local project directory structure | Stores skill files (.md), manifest (JSON), state (JSON) |

### System Boundary

```
Developer --> "add a NestJS skill"
                |
         [Intent Detection] (CLAUDE.md)
                |
         [isdlc.md Command Dispatcher]
                |
    +-----------+------------+------------+
    |           |            |            |
skill add   skill wire   skill list   skill remove
    |           |            |            |
    v           v            v            v
[Validate]  [Skill-Manager  [Read        [Update
 .md file    Agent: wiring   manifest]    manifest,
 + copy]     session]                     optionally
    |           |                         delete file]
    v           v
[Write to external-skills-manifest.json]


--- During Workflow Execution ---

Phase-Loop Controller (STEP 3d)
    |
    v
[loadExternalManifest()]
    |
    v
[Match skills to current phase/agent]
    |
    v
[Read .md files, format injection blocks]
    |
    v
[Append to delegation prompt] --> Task tool --> Phase Agent
```

---

## 2. Container Diagram (C4 Level 2)

### Containers Affected

| Container | Type | Technology | Responsibility |
|-----------|------|------------|----------------|
| isdlc.md | Command (.md) | Markdown prompt | Dispatches `skill add/wire/list/remove` actions; injects skills in STEP 3d |
| CLAUDE.md | Config (.md) | Markdown prompt | Intent detection: routes natural language to skill commands |
| common.cjs | Hook library (.cjs) | CommonJS | Skill validation, content analysis, binding suggestion, manifest I/O |
| skill-manager.md | Agent (.md) | Markdown prompt | Interactive wiring session: agent/phase selection, delivery type |
| external-skills-manifest.json | Data (JSON) | JSON | Registry of all external skills with bindings |
| skills-manifest.json | Config (JSON) | JSON | Agent ownership registry (adds skill-manager entry) |

### Data Flow

```
SKILL REGISTRATION FLOW:
  User --> isdlc.md (skill add <path>)
    --> common.cjs: validateSkillFrontmatter(filePath)
    --> common.cjs: analyzeSkillContent(content)
    --> common.cjs: suggestBindings(analysis)
    --> Copy .md to external skills directory
    --> Delegate to skill-manager agent (wiring session)
    --> common.cjs: writeExternalManifest(skill, bindings)
    --> Confirmation to user

RUNTIME INJECTION FLOW (every phase delegation):
  isdlc.md STEP 3d
    --> common.cjs: loadExternalManifest()
    --> Filter: skills where phase/agent matches current delegation
    --> common.cjs: formatSkillInjectionBlock(skill, deliveryType)
    --> Append blocks to delegation prompt
    --> Task tool invocation (augmented prompt)
```

---

## 3. Architecture Pattern

**Pattern**: Plugin/Extension Point within existing CLI + Agents + Hooks architecture

This feature introduces a plugin model for injecting user-provided knowledge into the existing agent delegation pipeline. It does NOT change the fundamental architecture of the framework (CLI command dispatch, phase-loop controller, hook enforcement). Instead, it adds an extension point at the prompt construction boundary.

### Pattern Justification

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| New command actions | Add to existing `isdlc.md` dispatcher | `skill add/wire/list/remove` are parallel to existing `feature/fix/upgrade/test` actions. Same dispatch pattern. |
| Utility functions | Add to existing `common.cjs` | All hook/command utilities live in common.cjs. New functions follow existing patterns (path resolution, manifest loading). |
| Interactive wiring | New agent (`skill-manager.md`) | Wiring sessions are conversational, multi-step interactions. An agent (.md prompt) is the established pattern for this in iSDLC. |
| Runtime injection | Insert in STEP 3d prompt construction | The injection point is between prompt assembly and Task tool invocation. This is the only place in the pipeline where prompt content can be augmented without modifying agents. |
| Data storage | JSON manifest + .md files on filesystem | Consistent with all other iSDLC configuration (state.json, skills-manifest.json, workflows.json). No database. |

### Why This Pattern

The plugin/extension point pattern was chosen because:

1. **Minimal blast radius** -- Injection happens at one well-defined point (STEP 3d). Agent files are not modified.
2. **Fail-open by design** -- If injection fails, the original delegation prompt is used unchanged (NFR-003, Article X).
3. **Backward compatible** -- Projects without external skills experience zero change. The injection step is a no-op when no manifest exists (NFR-005).
4. **Decoupled from hook system** -- Skill injection operates at the prompt level, not the hook level. This avoids interference with the 26-hook dispatch system (CON-004).

**Requirement traceability**: NFR-003 (fail-open), NFR-004 (monorepo), NFR-005 (backward compat), CON-002 (existing infra), CON-004 (hook compat)

---

## 4. Component Design

### 4.1 Skill Command Actions (MODIFY: isdlc.md)

Four new action branches added to the isdlc.md command dispatcher, parallel to existing `feature`, `fix`, `upgrade`, `test` actions.

| Action | Trigger | Behavior |
|--------|---------|----------|
| `skill add <path>` | CLI or NL intent | Validate file, copy to external dir, suggest bindings, delegate to skill-manager for wiring |
| `skill wire <name>` | CLI or NL intent | Load existing bindings, delegate to skill-manager for re-wiring |
| `skill list` | CLI or NL intent | Read manifest, format and display registered skills |
| `skill remove <name>` | CLI or NL intent | Look up skill in manifest, prompt for file deletion, update manifest |

**Requirement traceability**: FR-001 (add), FR-003/FR-009 (wire), FR-006 (list), FR-007 (remove)

### 4.2 Runtime Injection Block (MODIFY: isdlc.md STEP 3d)

A new code block inserted in STEP 3d between prompt construction and Task tool invocation.

**Algorithm**:
```
1. TRY:
   a. manifest = loadExternalManifest()
   b. IF manifest is null OR manifest.skills is empty: SKIP (no-op)
   c. injectionBlocks = []
   d. FOR EACH skill IN manifest.skills:
      i.   IF skill.bindings is undefined: SKIP (backward compat - old entries without bindings)
      ii.  IF skill.bindings.injection_mode !== "always": SKIP
      iii. IF current_phase NOT IN skill.bindings.phases AND current_agent NOT IN skill.bindings.agents: SKIP
      iv.  filePath = resolveExternalSkillsPath() + "/" + skill.file
      v.   TRY: content = readFile(filePath)
      vi.  CATCH: log warning, SKIP this skill
      vii. IF content.length > 10000: truncate, switch to reference delivery
      viii. block = formatSkillInjectionBlock(skill.name, content, skill.bindings.delivery_type)
      ix.  injectionBlocks.push(block)
   e. IF injectionBlocks.length > 0: append to delegation prompt
2. CATCH (any error):
   a. Log warning: "External skill injection failed: {error}. Continuing without skill injection."
   b. Continue with unmodified delegation prompt
```

**Key design decisions**:
- Outer try/catch ensures entire injection block is fail-open (NFR-003)
- Inner try/catch per skill ensures one bad skill does not prevent others from injecting
- Backward compat: entries without `bindings` object are silently skipped (NFR-005)
- 10,000 character truncation prevents context window bloat (ASM-002)

**Requirement traceability**: FR-005, NFR-001 (performance), NFR-003 (fail-open), NFR-005 (backward compat)

### 4.3 Utility Functions (MODIFY: common.cjs)

Six new exported functions added to common.cjs, grouped in a new section after the existing external skill path resolution functions.

| Function | Signature | Responsibility |
|----------|-----------|----------------|
| `validateSkillFrontmatter(filePath)` | `(string) => { valid: bool, errors: string[], parsed: object }` | Parse YAML frontmatter, validate required fields (`name`, `description`), return structured result |
| `analyzeSkillContent(content)` | `(string) => { keywords: string[], suggestedPhases: string[], confidence: string }` | Scan skill body for phase-indicative keywords, return analysis |
| `suggestBindings(analysis, manifestAgents)` | `(object, object) => { agents: string[], phases: string[], delivery_type: string, confidence: string }` | Produce binding suggestion from content analysis |
| `writeExternalManifest(manifest, projectId)` | `(object, string?) => void` | Write manifest JSON atomically to correct path |
| `formatSkillInjectionBlock(name, content, deliveryType)` | `(string, string, string) => string` | Format skill content as context/instruction/reference block |
| `removeSkillFromManifest(skillName, projectId)` | `(string, string?) => { removed: bool, manifest: object }` | Remove skill entry by name, return updated manifest |

**Design principles**:
- All functions are synchronous (consistent with existing common.cjs patterns)
- All functions are pure where possible (no side effects except `writeExternalManifest`)
- All functions handle errors gracefully (return error objects, never throw)
- All functions support monorepo mode via optional `projectId` parameter

**Requirement traceability**: FR-001 (validate), FR-002 (analyze/suggest), FR-004 (write), FR-005 (format), FR-007 (remove)

### 4.4 Skill Manager Agent (NEW: skill-manager.md)

**File**: `src/claude/agents/skill-manager.md`
**Responsibility**: Conduct interactive wiring session for binding configuration
**Invoked by**: isdlc.md `skill add` and `skill wire` actions
**Input**: Skill name, suggested bindings, existing bindings (for re-wire)
**Output**: Confirmed bindings object

**Session flow**:
1. Display current suggestions or existing bindings
2. Present agent/phase list grouped by workflow category
3. User selects agents/phases (suggested defaults pre-checked)
4. User selects delivery type (context/instruction/reference)
5. Present confirmation: `[S] Save / [A] Adjust / [X] Cancel`
6. On save: return bindings object to isdlc.md for manifest write

**Agent design principles**:
- The agent is conversational (handles multi-step dialog)
- It does not write to the manifest directly (isdlc.md handles the write after the agent returns)
- It does not access state.json or trigger workflows (CON-003)
- It receives all needed context in its delegation prompt (skill name, suggestions, phase list)

**Requirement traceability**: FR-003, FR-009

### 4.5 Natural Language Intent Detection (MODIFY: CLAUDE.md)

One new row added to the intent detection table in CLAUDE.md.

```
| Skill mgmt | add a skill, register skill, list skills, show skills, wire skill, remove skill, delete skill | `/isdlc skill {subcommand}` |
```

**Requirement traceability**: FR-008

### 4.6 Skills Manifest Registration (MODIFY: skills-manifest.json)

New agent entry for skill-manager.

```json
"skill-manager": {
  "agent_id": "EXT",
  "phase": "skill-management",
  "skill_count": 0,
  "skills": []
}
```

The skill-manager does not own any framework skills. It is a utility agent for configuration, not a phase agent. The `agent_id` "EXT" indicates it is outside the standard phase numbering.

**Requirement traceability**: Agent registry completeness

---

## 5. Data Architecture

### 5.1 External Skills Manifest Schema

**File**: `external-skills-manifest.json`
**Location**: `docs/isdlc/external-skills-manifest.json` (single-project) or `docs/isdlc/projects/{id}/external-skills-manifest.json` (monorepo)

```json
{
  "version": "1.0.0",
  "skills": [
    {
      "name": "nestjs-conventions",
      "description": "NestJS framework conventions and patterns",
      "file": "nestjs-conventions.md",
      "added_at": "2026-02-18T12:00:00Z",
      "bindings": {
        "agents": ["software-developer", "solution-architect"],
        "phases": ["06-implementation", "03-architecture"],
        "injection_mode": "always",
        "delivery_type": "context"
      }
    }
  ]
}
```

**Schema rules**:
- `version`: Semver string. Currently "1.0.0".
- `skills`: Array of skill entries. Empty array when no skills registered.
- `skills[].name`: Unique identifier (string). Used for lookup in wire/remove commands.
- `skills[].description`: Human-readable description (string).
- `skills[].file`: Filename only (not path). Resolved via `resolveExternalSkillsPath() + "/" + file`.
- `skills[].added_at`: ISO 8601 timestamp.
- `skills[].bindings`: Optional object. Old entries without bindings are backward-compatible (skipped during injection).
- `skills[].bindings.agents`: Array of agent names (strings matching PHASE_AGENT_MAP values).
- `skills[].bindings.phases`: Array of phase keys (strings matching workflow phase keys).
- `skills[].bindings.injection_mode`: Currently only `"always"` supported.
- `skills[].bindings.delivery_type`: One of `"context"`, `"instruction"`, `"reference"`.

### 5.2 External Skill File Format

```yaml
---
name: nestjs-conventions
description: NestJS framework conventions and best practices
owner: software-developer
when_to_use: When implementing NestJS backend services
dependencies: []
---

# NestJS Conventions

## Module Structure
...
```

**Required frontmatter fields**: `name`, `description`
**Optional frontmatter fields**: `owner`, `when_to_use`, `dependencies`, `skill_id`
**Body**: Freeform markdown. Content is what gets injected into agent prompts.

### 5.3 File Layout

```
Single-project:
  .claude/skills/external/          <-- Skill .md files
  docs/isdlc/external-skills-manifest.json  <-- Manifest

Monorepo:
  .isdlc/projects/{id}/skills/external/     <-- Skill .md files
  docs/isdlc/projects/{id}/external-skills-manifest.json  <-- Manifest
```

These paths are already resolved by `resolveExternalSkillsPath()` and `resolveExternalManifestPath()` in common.cjs.

---

## 6. Scalability Strategy

| Dimension | Design | Limit | Rationale |
|-----------|--------|-------|-----------|
| Number of skills | Array scan on manifest | 50 skills (NFR-002) | Linear scan of 50 entries is <1ms. No index needed. |
| Skill file size | 10,000 char truncation | Per-skill cap | Prevents context window bloat. Large skills auto-switch to reference delivery. |
| Total injection size | Sum of matched skill blocks | Soft limit: 3 matched skills typical | Most users will have 2-5 skills. No hard cap needed. |
| Manifest file size | JSON with 50 entries | ~15KB max | Trivial for filesystem I/O. |
| Concurrent access | Single-user CLI tool | 1 concurrent writer | No locking needed. JSON write is atomic (write full file). |

---

## 7. Deployment Architecture

No infrastructure changes. All components are local filesystem artifacts:

1. **New files**:
   - `src/claude/agents/skill-manager.md` -- synced to `.claude/agents/` at implementation time
   - `docs/isdlc/external-skills-manifest.json` -- created on first `skill add` (not pre-existing)

2. **Modified files**:
   - `src/claude/commands/isdlc.md` -- new action branches + STEP 3d injection
   - `CLAUDE.md` -- new intent detection row
   - `src/claude/hooks/lib/common.cjs` -- new utility functions
   - `src/claude/hooks/config/skills-manifest.json` -- new agent entry

3. **Runtime sync**: `src/claude/` -> `.claude/` (existing mechanism)

---

## 8. Technology Radar

No new technologies introduced. All components use the existing stack:

| Layer | Technology | Status |
|-------|-----------|--------|
| Utility functions | CommonJS (common.cjs) | Existing -- extend |
| Command dispatch | Markdown prompt (isdlc.md) | Existing -- extend |
| Agent definition | Markdown prompt (.md) | Existing -- new file |
| Configuration | JSON (manifest) | Existing -- new file |
| Intent detection | Markdown table (CLAUDE.md) | Existing -- extend |
| Tests | Node.js `node:test` + `node:assert/strict` (CJS) | Existing -- new tests |

---

## 9. Design Decisions Summary

| # | Decision | Rationale | ADR |
|---|----------|-----------|-----|
| 1 | Plugin/extension point pattern at prompt boundary | Fail-open, backward compat, no agent modifications needed | ADR-0008 |
| 2 | Utility functions in common.cjs (not new module) | CON-002 requires extending existing functions; common.cjs is the established utility location | ADR-0009 |
| 3 | Skill-manager as standalone agent | Wiring sessions are multi-step conversational interactions; agents are the established pattern for this | ADR-0010 |
| 4 | JSON manifest on filesystem (not state.json) | Skills are project configuration, not runtime state. Separate manifest follows existing pattern (skills-manifest.json) | ADR-0009 |
| 5 | YAML frontmatter for skill files | Consistent with existing iSDLC skill file format; machine-readable metadata + human-readable body | ADR-0009 |
| 6 | Injection at STEP 3d (not hook level) | CON-004 requires no hook interference; STEP 3d is the natural prompt construction point | ADR-0008 |
| 7 | 10,000 char truncation with reference fallback | Prevents context window bloat while ensuring large skills are still accessible | ADR-0008 |

---

## 10. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| common.cjs regression (3122 lines, 26 dependents) | Low | High | New functions are additive. No existing exports modified. Test existing functions BEFORE adding new ones. |
| STEP 3d injection blocks workflow | Very Low | High | Outer try/catch around entire injection block. Fail-open per NFR-003 and Article X. |
| Frontmatter parsing edge cases | Medium | Low | Validate with multiple YAML parsers; test empty files, no frontmatter, malformed YAML. |
| Manifest corruption on write | Low | Medium | Write full JSON atomically. Validate JSON after write. |
| Token budget exceeded by injected skills | Medium | Medium | 10,000 char per-skill cap. Reference delivery fallback. Typical injection is 1-3 skills. |
| Monorepo path resolution wrong | Low | Medium | Reuse existing `resolveExternalSkillsPath()` and `resolveExternalManifestPath()`. Test both modes. |

---

## 11. Constitutional Compliance

| Article | Status | Evidence |
|---------|--------|----------|
| Article III (Security by Design) | Compliant | Path traversal prevention in validateSkillFrontmatter; no secrets in skill files; skill content is developer-authored local files only |
| Article IV (Explicit Over Implicit) | Compliant | All decisions documented with rationale; no [NEEDS CLARIFICATION] markers; manifest schema fully specified |
| Article V (Simplicity First) | Compliant | Extends existing patterns (common.cjs, isdlc.md dispatch, agent .md files). No new abstractions, no new runtime, no new dependencies. |
| Article VII (Artifact Traceability) | Compliant | Every component traces to FR/NFR identifiers in requirements-spec.md |
| Article IX (Quality Gate Integrity) | Compliant | All required architecture artifacts produced; GATE-03 checklist validated below |
| Article X (Fail-Safe Defaults) | Compliant | Fail-open injection (NFR-003); backward compat for entries without bindings (NFR-005); workflow never blocked by skill errors |
| Article XIII (Module System) | Compliant | New utility functions in common.cjs (CJS); new agent in .md; no ESM/CJS boundary violations |
| Article XIV (State Management) | Compliant | External skills manifest is separate from state.json; no state.json modifications for skill management |
