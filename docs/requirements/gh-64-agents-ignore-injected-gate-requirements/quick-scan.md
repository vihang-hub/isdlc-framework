# Quick Scan: Agents Ignore Injected Gate Requirements

**Generated**: 2026-02-20
**Issue**: GH-64
**Type**: Bug
**Phase**: 00-quick-scan

---

## Executive Summary

This issue addresses agents ignoring injected gate requirements (constraint information added to their prompts by the hook system), causing wasted iterations when hooks later block the attempted actions. The problem manifests when agents attempt actions explicitly marked as forbidden (e.g., `git commit` during intermediate phases) despite receiving clear gate requirement text.

---

## Scope Estimate

**Estimated Scope**: Medium
**File Count Estimate**: ~12-18 files
**Confidence**: Medium

**Rationale**: The issue spans the injection mechanism (1-2 files), enforcement hooks (3-4 files), agent files that receive constraints (8-10 agents), and prompt engineering strategy. However, the fix is primarily prompt/format engineering rather than deep architectural changes.

---

## Keyword Matches

### Domain Keywords

| Keyword | Files Matched | Context |
|---------|--------------|---------|
| gate-requirements | 22 files | Injection mechanism, tests, hook-related files |
| constraint | 8 files | Agent instructions, hook messages |
| commit/git | 61 agent files | Competing instructions in agent descriptions |
| iteration | 35+ files | Iteration enforcement, wasted cycles |
| blocking/blocked | 12 hook files | Hook safety net catching violations |

### Technical Keywords

| Keyword | Files Matched | Context |
|---------|--------------|---------|
| buildGateRequirementsBlock | 2 files | `gate-requirements-injector.cjs`, test file |
| outputBlockResponse | 22 hook files | Hook-blocking response mechanism |
| pre-task dispatcher | 3 files | Hook injection point in workflow |
| branch-guard | 1 file | Example hook that caught violation during BUG-0029 |
| prompt injection/augmentation | 6+ files | Delegation prompts, agent task templates |

---

## Affected Components

### 1. Gate Requirements Injection (Core)

**File**: `src/claude/hooks/lib/gate-requirements-injector.cjs` (370 lines)

- Builds formatted text block summarizing gate requirements
- Loads iteration-requirements.json, artifact-paths.json, constitution
- Handles workflow modifiers from .isdlc/config/workflows.json
- **Issue relevance**: This is the SOURCE of injected requirements. Current format uses wall-of-text approach that may lack salience.

### 2. Hook Enforcement & Blocking

**Files**:
- `src/claude/hooks/branch-guard.cjs` (226 lines) — blocks git commits during intermediate phases
- `src/claude/hooks/lib/common.cjs` — outputBlockResponse() function
- 20+ other hook files that use gate requirements

**Issue relevance**: Hooks provide the safety net (catching violations) but also the frustration (wasted iterations).

### 3. Agent Files Receiving Constraints

**Impact**: 8-10 agents in `src/claude/agents/` that receive injected requirements

Examples:
- `05-software-developer.md` — Observed running `git commit` despite constraint in BUG-0029
- `16-quality-loop-engineer.md` — Implements loop logic that may conflict with commit constraints
- `06-code-reviewer.md` — Needs clear guidance on when review artifacts can be saved

**Issue relevance**: These agents contain task descriptions that may compete with injected constraints (e.g., "save your work", "commit changes").

### 4. Orchestrator & Delegation

**File**: `src/claude/commands/isdlc.md` (STEP 3d where injection happens)

**Issue relevance**: This is where gate requirements are injected into the delegation prompt to phase agents.

### 5. Constraint Definitions

**Files**:
- `src/claude/hooks/config/iteration-requirements.json` — Phase requirements
- `.claude/` runtime copies of above
- `CLAUDE.md` — Git Commit Prohibition section (master reference)

---

## Root Causes (From Backlog Analysis)

1. **Context Dilution**: Injected requirements text gets buried in long agent prompts
2. **Competing Instructions**: Agent files contain patterns that contradict gate requirements (e.g., "save your work")
3. **Non-Obligatory Perception**: Agents treat injected constraints as suggestions vs. hard rules
4. **Low Salience**: Wall-of-text format lacks visual emphasis

---

## Potential Solutions (Identified in Backlog)

### High-Priority

1. **Strengthen Injection Format**
   - Add `CRITICAL CONSTRAINT:` or `[BLOCKED ACTIONS]` prefix
   - Shorter, more scannable text
   - Repeat critical constraints at end of prompt
   - Possible visual markers (e.g., `!!!` or box format)

2. **Audit Agent Files**
   - Search for competing instructions (save, commit, stash)
   - Rewrite to align with gate requirements
   - Add explicit acknowledgment that constraints are enforced by hooks

### Medium-Priority

3. **Constraint Acknowledgment Step**
   - Agent echoes back constraints before starting work
   - Ensures constraints registered and understood

4. **Post-Hook Feedback Loop**
   - When a hook blocks, inject block reason into agent's next turn
   - Creates corrective feedback cycle

### Technical

5. **Prompt Engineering**
   - Restructure gate requirements block for maximum salience
   - Use structured format (YAML, JSON-like) instead of prose
   - Separate "MUST AVOID" actions from "ITERATION REQUIREMENTS"

---

## Files Likely to Change

Based on keyword analysis and backlog, expect changes to:

1. **Gate Requirements Injector**: `src/claude/hooks/lib/gate-requirements-injector.cjs`
   - Restructure `formatBlock()` function to use stronger format
   - Add "BLOCKED ACTIONS" section
   - Repeat critical constraints at end

2. **Agent Files** (sample):
   - `src/claude/agents/05-software-developer.md`
   - `src/claude/agents/06-code-reviewer.md`
   - `src/claude/agents/16-quality-loop-engineer.md`
   - `src/claude/agents/04-system-designer.md`
   - ~4-6 additional agents

3. **Orchestrator**: `src/claude/commands/isdlc.md`
   - Possibly adjust delegation prompt structure
   - Consider placement and formatting of injected block

4. **Tests**: `src/claude/hooks/tests/gate-requirements-injector.test.cjs`
   - Update snapshots for new injection format
   - Add test cases for "constraint salience" (agent understanding)

5. **Hook Files** (possibly):
   - `src/claude/hooks/branch-guard.cjs` — possibly add clearer block message
   - Hook test files that validate blocking behavior

---

## Discovery Context

**Note**: This project completed `/discover`. Key findings:

- **Tech Stack**: JavaScript/Node.js (48 agents, 240 skills, 26 hooks)
- **Test Framework**: Node.js built-in (`node:test`, `node:assert/strict`)
- **Key Architecture**: Hooks are `.cjs` (CommonJS) for Node 24+ compatibility; agents are `.md` (markdown with frontmatter)
- **Related Requirements**: REQ-0024 (gate requirements pre-injection), REQ-0025 (performance budget)

---

## Estimated Impact

### What Stays the Same
- Gate enforcement mechanism (branch-guard, gate-blocker hooks work correctly)
- Hook system architecture
- State management and workflow orchestration

### What Changes
- **Prompt/Format**: Injection text structure and salience
- **Agent Instructions**: Clear prohibition language in 8-10 agent files
- **Tests**: Snapshots for new injection format

### Performance Impact
- **Positive**: Fewer wasted iterations = better performance budgets (REQ-0025)
- **No regression**: Existing workflows unaffected; only improving agent constraint adherence

---

## Questions for Requirements Phase

1. **Salience Priority**: Should we use visual separators (boxes, color), text markers (!!!), or structured format (YAML)?

2. **Acknowledgment Requirement**: Do agents need to echo back constraints explicitly, or is better format salience sufficient?

3. **Feedback Loop**: Should we implement post-hook feedback (re-inject block message in next turn), or design better up-front constraints?

4. **Agent File Coverage**: Should we audit ALL 48 agents for competing instructions, or focus on the 8-10 that directly receive constraints?

5. **Format Standardization**: Should gate requirements use a machine-readable format (JSON, YAML) in addition to prose?

6. **Testing Strategy**: How do we verify agents understand constraints? Unit tests? Integration tests with simulated hook blocks?

---

## Complexity Assessment

**Low Complexity Elements**:
- Format string changes in `gate-requirements-injector.cjs`
- Text rewrites in agent files

**Medium Complexity Elements**:
- Prompt engineering to maximize salience
- Determining best visual/structural format
- Test snapshot updates

**High Complexity Elements** (if pursued):
- Implementing post-hook feedback loop (requires state.json augmentation)
- Constraint acknowledgment step (adds new interaction pattern)

---

## Quick Scan Metadata

```json
{
  "scan_completed_at": "2026-02-20T00:00:00Z",
  "phase": "00-quick-scan",
  "issue_id": "GH-64",
  "scan_type": "bug",
  "total_files_in_codebase": 433,
  "hook_files_matched": 22,
  "agent_files_matched": 8,
  "files_estimated_to_change": "12-18",
  "scope_estimate": "medium",
  "confidence": "medium",
  "primary_components": [
    "gate-requirements-injector.cjs",
    "branch-guard.cjs",
    "agent instruction files (5-10)",
    "isdlc.md orchestrator"
  ],
  "root_cause_categories": [
    "context-dilution",
    "competing-instructions",
    "low-format-salience",
    "agent-training-habits"
  ]
}
```

---

## Phase Gate Summary

- [x] Keywords extracted from issue description
- [x] Codebase search completed (gate-requirements, constraint, commit patterns)
- [x] Scope estimated at MEDIUM (~12-18 files)
- [x] Root causes identified from backlog and source analysis
- [x] Affected components mapped to file locations
- [x] Potential solutions synthesized from backlog and code review

**Status**: GATE-00-QUICK-SCAN READY FOR ADVANCEMENT

---

## Next Phase Recommendation

Proceed to **Phase 01: Requirements** with focus on:

1. Clarify injection format preferences (visual, textual, structured)
2. Scope agent file audit (all vs. sample)
3. Decide on feedback loop implementation
4. Define test strategy for constraint adherence
5. Estimate delivery timeline and effort

**Suggested Acceptance Criteria for Phase 01**:
- Gate requirements block reaches >=80% salience (agents demonstrate constraint awareness)
- Agent files have no competing instructions
- Constraint acknowledgment mechanism designed (if needed)
- Test plan for validation defined
