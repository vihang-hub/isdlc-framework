# Impact Analysis: REQ-0004 Advisory Behavior Hooks

**Generated**: 2026-02-08T23:20:00Z
**Feature**: Add 7 deterministic enforcement hooks to replace 7 advisory-only LLM prompt behaviors
**Based On**: Phase 01 Requirements (finalized)
**Phase**: 02-impact-analysis

---

## Scope Comparison

| Aspect | Original (CLAUDE.md Backlog) | Clarified (Phase 01 Requirements) |
|--------|------------------------------|-----------------------------------|
| Description | "Enforce advisory behaviors with hooks: 14 critical behaviors are prompt-only" | Phase 1 of 2: Add 7 CJS hooks for the 7 most critical advisory behaviors |
| Hook Count | 6 mentioned | 7 finalized (plan-surfacer added) |
| Keywords | phase-loop, discover-menu, sequential, branch, state-write, walkthrough | phase-loop-controller, plan-surfacer, phase-sequence-guard, branch-guard, state-write-validator, walkthrough-tracker, discover-menu-guard |
| Estimated Files | Not estimated | 24 files affected (7 new hooks + 7 test files + 10 existing files modified) |
| Scope Change | - | REFINED (same concept, explicit specs, added FR-02 plan-surfacer) |

---

## Executive Summary

This feature adds 7 new CJS hook files to the existing 11-hook infrastructure, increasing the hook count by 64%. The blast radius is **MEDIUM** -- while 7 brand-new files are created and 7 test files accompany them, modifications to existing files are limited to 3 key integration points: `settings.json` (hook registration), `uninstall.sh` (cleanup array), and `common.cjs` (shared utilities). The risk level is **MEDIUM** due to the interaction between 3 PreToolUse[Task] hooks (FR-01, FR-02, FR-03) that share detection logic for "phase delegation" patterns and could interfere with each other if matching heuristics conflict, plus the fact that FR-04 introduces the first PreToolUse[Bash] blocking hook (unlike review-reminder.cjs which is PostToolUse and observational). All 41 existing CJS tests must continue passing alongside the 70+ new tests.

**Blast Radius**: MEDIUM (24 new/modified files, 4 integration points)
**Risk Level**: MEDIUM
**Affected Files**: 24 total (14 new, 10 modified)
**Affected Modules**: hooks, installer, settings, uninstaller

---

## Impact Analysis

### M1: Direct Impact by Hook

#### FR-01: phase-loop-controller.cjs (PreToolUse[Task])

**New files:**
- `src/claude/hooks/phase-loop-controller.cjs` (NEW)
- `src/claude/hooks/tests/phase-loop-controller.test.cjs` (NEW)

**Existing files affected:**
- `src/claude/settings.json` -- Add to PreToolUse[Task] hooks array
- `src/claude/hooks/lib/common.cjs` -- May need new utility: `detectPhaseDelegation(input)` to share logic with FR-03

**Dependencies (reads):**
- `.isdlc/state.json` (reads `active_workflow`, `current_phase`)
- `.claude/hooks/config/skills-manifest.json` (reads agent names for phase detection)
- `common.cjs` (readState, readStdin, outputBlockResponse, loadManifest)

**Outward impact:**
- Interacts with existing PreToolUse[Task] hooks: `iteration-corridor.cjs`, `skill-validator.cjs`, `gate-blocker.cjs`, `constitution-validator.cjs` -- all fire on the same matcher
- Hook ordering matters: this hook should fire BEFORE gate-blocker (checks preconditions, not gate requirements)

#### FR-02: plan-surfacer.cjs (PreToolUse[Task])

**New files:**
- `src/claude/hooks/plan-surfacer.cjs` (NEW)
- `src/claude/hooks/tests/plan-surfacer.test.cjs` (NEW)

**Existing files affected:**
- `src/claude/settings.json` -- Add to PreToolUse[Task] hooks array

**Dependencies (reads):**
- `.isdlc/state.json` (reads `active_workflow.phases`, `active_workflow.current_phase`)
- `docs/isdlc/tasks.md` (existence check only)
- `common.cjs` (readState, readStdin, outputBlockResponse, resolveTasksPath)

**Outward impact:**
- `resolveTasksPath()` already exists in common.cjs (no new utility needed)
- Blocks implementation-phase Task calls -- must distinguish "implementation+" phases from early phases using the workflow array

#### FR-03: phase-sequence-guard.cjs (PreToolUse[Task])

**New files:**
- `src/claude/hooks/phase-sequence-guard.cjs` (NEW)
- `src/claude/hooks/tests/phase-sequence-guard.test.cjs` (NEW)

**Existing files affected:**
- `src/claude/settings.json` -- Add to PreToolUse[Task] hooks array
- `src/claude/hooks/lib/common.cjs` -- Shares phase-delegation detection with FR-01

**Dependencies (reads):**
- `.isdlc/state.json` (reads `active_workflow.phases`, `active_workflow.current_phase`)
- `.claude/hooks/config/skills-manifest.json` (reads agent-to-phase mapping)
- `common.cjs` (readState, readStdin, outputBlockResponse, loadManifest, normalizeAgentName)

**Outward impact:**
- Partially overlaps with `gate-blocker.cjs` which already validates workflow state mismatches (lines 457-469)
- Must not duplicate gate-blocker's sequence validation -- this hook blocks BEFORE delegation; gate-blocker blocks AFTER (at gate advancement)

#### FR-04: branch-guard.cjs (PreToolUse[Bash])

**New files:**
- `src/claude/hooks/branch-guard.cjs` (NEW)
- `src/claude/hooks/tests/branch-guard.test.cjs` (NEW)

**Existing files affected:**
- `src/claude/settings.json` -- Add NEW PreToolUse[Bash] matcher section (currently no PreToolUse[Bash] exists)

**Dependencies (reads):**
- `.isdlc/state.json` (reads `active_workflow.git_branch`)
- Git CLI: `git rev-parse --abbrev-ref HEAD` (subprocess call)
- `common.cjs` (readState, readStdin, outputBlockResponse)

**Outward impact:**
- First PreToolUse[Bash] hook in the framework -- creates a new matcher section in settings.json
- Must detect `git commit` in bash command strings (similar pattern to `review-reminder.cjs` line 57-59)
- Runs git subprocess inside a PreToolUse hook -- adds latency concern (git rev-parse is fast: ~5ms)
- Interacts with `review-reminder.cjs` (PostToolUse[Bash]) on same git commit commands, but at different lifecycle stages

#### FR-05: state-write-validator.cjs (PostToolUse[Write,Edit])

**New files:**
- `src/claude/hooks/state-write-validator.cjs` (NEW)
- `src/claude/hooks/tests/state-write-validator.test.cjs` (NEW)

**Existing files affected:**
- `src/claude/settings.json` -- Add NEW PostToolUse matcher for Write and Edit tools (currently no PostToolUse[Write] or PostToolUse[Edit] exists)
- `src/claude/hooks/config/iteration-requirements.json` -- Read for min_menu_interactions thresholds

**Dependencies (reads):**
- `.isdlc/state.json` (reads the file that was just written, validates structural integrity)
- `iteration-requirements.json` (reads min_menu_interactions per phase)
- `common.cjs` (readStdin, readState, debugLog)

**Outward impact:**
- Creates two new PostToolUse matchers (Write and Edit) -- significant settings.json structural change
- Must match file paths containing `state.json` in the tool output (not tool input)
- PostToolUse hooks receive `tool_result` in stdin, not `tool_input` for the file path -- need to verify the stdin protocol for Write/Edit tools
- Never blocks (PostToolUse is observational) -- outputs warnings only

#### FR-06: walkthrough-tracker.cjs (PostToolUse[Task])

**New files:**
- `src/claude/hooks/walkthrough-tracker.cjs` (NEW)
- `src/claude/hooks/tests/walkthrough-tracker.test.cjs` (NEW)

**Existing files affected:**
- `src/claude/settings.json` -- Add to existing PostToolUse[Task] hooks array

**Dependencies (reads):**
- `.isdlc/state.json` (reads `discovery_context.walkthrough_completed`)
- `common.cjs` (readStdin, readState, debugLog)

**Outward impact:**
- Fires alongside `log-skill-usage.cjs` and `menu-tracker.cjs` on PostToolUse[Task]
- Must detect /discover orchestrator completions from task output (pattern match)
- Observational only -- logs warnings via stderr

#### FR-07: discover-menu-guard.cjs (PostToolUse[Task])

**New files:**
- `src/claude/hooks/discover-menu-guard.cjs` (NEW)
- `src/claude/hooks/tests/discover-menu-guard.test.cjs` (NEW)

**Existing files affected:**
- `src/claude/settings.json` -- Add to existing PostToolUse[Task] hooks array

**Dependencies (reads):**
- stdin (PostToolUse task output -- checks for menu option text)
- `common.cjs` (readStdin, debugLog)

**Outward impact:**
- Fires alongside `log-skill-usage.cjs`, `menu-tracker.cjs`, and `walkthrough-tracker.cjs`
- Must scan task output for menu markers (string matching)
- Observational only

### M1: Integration Points Summary

| Integration Point | Current State | Change Required |
|---|---|---|
| `src/claude/settings.json` PreToolUse[Task] | 4 hooks registered | Add 3 more (FR-01, FR-02, FR-03) |
| `src/claude/settings.json` PreToolUse[Bash] | Does NOT exist | Create new section (FR-04) |
| `src/claude/settings.json` PostToolUse[Task] | 2 hooks registered | Add 2 more (FR-06, FR-07) |
| `src/claude/settings.json` PostToolUse[Bash] | 2 hooks registered | No change |
| `src/claude/settings.json` PostToolUse[Write] | Does NOT exist | Create new section (FR-05) |
| `src/claude/settings.json` PostToolUse[Edit] | Does NOT exist | Create new section (FR-05) |
| `src/claude/hooks/lib/common.cjs` | 1163 lines, 50+ exports | Add shared phase-delegation detection utility |
| `uninstall.sh` FRAMEWORK_HOOKS array | 7 entries | Add 7 more entries |
| `lib/installer.js` | Copies entire hooks/ dir | No change needed (bulk copy) |

### M1: Dependency Graph

```
New Hooks Dependencies:
  phase-loop-controller.cjs ──> common.cjs (readState, readStdin, outputBlockResponse, loadManifest)
                              ──> state.json (active_workflow)
                              ──> skills-manifest.json (agent names)

  plan-surfacer.cjs ──────────> common.cjs (readState, readStdin, outputBlockResponse, resolveTasksPath)
                              ──> state.json (active_workflow)
                              ──> docs/isdlc/tasks.md (existence check)

  phase-sequence-guard.cjs ──> common.cjs (readState, readStdin, outputBlockResponse, loadManifest)
                              ──> state.json (active_workflow)
                              ──> skills-manifest.json (agent-to-phase map)

  branch-guard.cjs ───────────> common.cjs (readState, readStdin, outputBlockResponse)
                              ──> state.json (active_workflow.git_branch)
                              ──> git CLI (git rev-parse)

  state-write-validator.cjs ──> common.cjs (readStdin, readState, debugLog)
                              ──> state.json (reads written file)
                              ──> iteration-requirements.json (thresholds)

  walkthrough-tracker.cjs ───> common.cjs (readStdin, readState, debugLog)
                              ──> state.json (discovery_context)

  discover-menu-guard.cjs ───> common.cjs (readStdin, debugLog)
```

---

## Entry Points

### M2: Implementation Entry Points by Priority

#### 1. common.cjs -- Shared Phase Delegation Detection (FIRST)

**Why first:** FR-01 and FR-03 both need to detect whether a Task tool call is a "phase delegation." Extracting this into a shared utility in common.cjs prevents duplication and inconsistency.

**Existing code to extend:**
- `normalizeAgentName()` (line 725) -- already maps agent name variations
- `getAgentPhase()` (line 712) -- maps agent to phase
- `loadManifest()` (line 681) -- loads skills-manifest.json

**New function needed:**
```
detectPhaseDelegation(parsedStdin) -> { isPhase: boolean, targetPhase: string|null, agentName: string|null }
```

This function would:
1. Extract task prompt/description from stdin JSON
2. Match against known agent names (from manifest) or phase keywords
3. Return whether this is a phase delegation and what phase is being targeted

**Files:** `src/claude/hooks/lib/common.cjs`
**Estimated additions:** ~40 lines (function + tests)

#### 2. branch-guard.cjs (SECOND -- Independent, Simple)

**Why second:** Completely independent of other hooks. Uses a different matcher (PreToolUse[Bash]). Simple logic: detect `git commit`, check branch.

**Entry point pattern:**
```javascript
readStdin() -> parse JSON -> check command for /\bgit\s+commit\b/
  -> readState() -> check active_workflow.git_branch
  -> exec git rev-parse --abbrev-ref HEAD
  -> if main/master: outputBlockResponse()
```

**Reference implementation:** `review-reminder.cjs` (same git commit detection pattern)

**Files:** `src/claude/hooks/branch-guard.cjs`, `src/claude/hooks/tests/branch-guard.test.cjs`

#### 3. plan-surfacer.cjs (THIRD -- Independent, Simple)

**Why third:** Independent of other PreToolUse[Task] hooks. Simple logic: check current phase index, check tasks.md existence.

**Entry point pattern:**
```javascript
readStdin() -> parse JSON -> readState() -> get active_workflow
  -> check if current_phase is implementation+ (index >= implementation phase index)
  -> resolveTasksPath() -> fs.existsSync()
  -> if missing: outputBlockResponse()
```

**Reference:** Uses existing `resolveTasksPath()` from common.cjs

**Files:** `src/claude/hooks/plan-surfacer.cjs`, `src/claude/hooks/tests/plan-surfacer.test.cjs`

#### 4. phase-loop-controller.cjs (FOURTH -- Depends on common.cjs utility)

**Entry point pattern:**
```javascript
readStdin() -> parse JSON -> detectPhaseDelegation()
  -> if phase delegation: readState() -> check TaskUpdate was called
  -> if not called: outputBlockResponse()
```

**Design question:** How to verify "TaskUpdate was called"? Options:
- (A) Track in state.json via a field like `phases[phase].task_marked_in_progress`
- (B) Check state.json `phases[phase].status === "in_progress"` (already written by orchestrator)
- Option (B) is simpler and leverages existing state writes

**Files:** `src/claude/hooks/phase-loop-controller.cjs`, `src/claude/hooks/tests/phase-loop-controller.test.cjs`

#### 5. phase-sequence-guard.cjs (FIFTH -- Depends on common.cjs utility)

**Entry point pattern:**
```javascript
readStdin() -> parse JSON -> detectPhaseDelegation()
  -> if phase delegation: extract target phase
  -> readState() -> compare target vs active_workflow.current_phase
  -> if mismatch: outputBlockResponse()
```

**Files:** `src/claude/hooks/phase-sequence-guard.cjs`, `src/claude/hooks/tests/phase-sequence-guard.test.cjs`

#### 6. state-write-validator.cjs (SIXTH -- PostToolUse, Observational)

**Entry point pattern:**
```javascript
readStdin() -> parse JSON -> check tool_result for state.json path
  -> if state.json write: read the file
  -> validate: completed + iterations_used, menu_interactions, etc.
  -> if invalid: console.error(warning)
```

**Design question:** PostToolUse stdin format for Write/Edit tools -- need to verify what fields are available. The stdin JSON for PostToolUse typically includes:
- `tool_name`: "Write" or "Edit"
- `tool_input`: includes `file_path`
- `tool_result`: includes result of the write

This hook can check `tool_input.file_path` for `state.json` pattern match.

**Files:** `src/claude/hooks/state-write-validator.cjs`, `src/claude/hooks/tests/state-write-validator.test.cjs`

#### 7. walkthrough-tracker.cjs and discover-menu-guard.cjs (SEVENTH -- PostToolUse, Observational)

**Entry point pattern (both):**
```javascript
readStdin() -> parse JSON -> check task output for discover patterns
  -> read state or scan output for expected content
  -> if issue: console.error(warning)
```

**Files:**
- `src/claude/hooks/walkthrough-tracker.cjs`, `src/claude/hooks/tests/walkthrough-tracker.test.cjs`
- `src/claude/hooks/discover-menu-guard.cjs`, `src/claude/hooks/tests/discover-menu-guard.test.cjs`

#### 8. settings.json Registration (EIGHTH -- After all hooks exist)

**Changes needed:**
```
PreToolUse:
  Task: append 3 hooks (phase-loop-controller, plan-surfacer, phase-sequence-guard)
  Bash: NEW section with 1 hook (branch-guard)

PostToolUse:
  Task: append 2 hooks (walkthrough-tracker, discover-menu-guard)
  Write: NEW section with 1 hook (state-write-validator)
  Edit: NEW section with 1 hook (state-write-validator)
```

**Files:** `src/claude/settings.json`

#### 9. uninstall.sh Update (NINTH -- Cleanup array)

**Changes needed:** Add 7 hook filenames to `FRAMEWORK_HOOKS` array.

**Files:** `uninstall.sh`

### M2: Recommended Implementation Order

```
1. common.cjs (shared utility)          -- unblocks FR-01 and FR-03
2. branch-guard.cjs + tests             -- independent, simple
3. plan-surfacer.cjs + tests            -- independent, simple
4. phase-loop-controller.cjs + tests    -- uses shared utility
5. phase-sequence-guard.cjs + tests     -- uses shared utility
6. state-write-validator.cjs + tests    -- PostToolUse, different matcher
7. walkthrough-tracker.cjs + tests      -- PostToolUse observational
8. discover-menu-guard.cjs + tests      -- PostToolUse observational
9. settings.json registration           -- register all hooks
10. uninstall.sh update                 -- cleanup array
```

---

## Risk Assessment

### M3: Risk Matrix

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|------------|
| PreToolUse[Task] hook ordering conflict | HIGH | MEDIUM | Define explicit ordering: iteration-corridor -> skill-validator -> phase-loop-controller -> plan-surfacer -> phase-sequence-guard -> gate-blocker -> constitution-validator |
| Phase delegation detection false positives | HIGH | MEDIUM | Test extensively with real task prompts; ensure setup commands (discover, init) are whitelisted |
| Phase delegation detection false negatives | MEDIUM | MEDIUM | Use comprehensive keyword + agent name matching from manifest |
| branch-guard.cjs git subprocess failure | LOW | LOW | Fail-open; git rev-parse is fast and reliable |
| state-write-validator PostToolUse stdin format | MEDIUM | MEDIUM | Verify Write/Edit PostToolUse stdin format before implementation |
| common.cjs growing too large (already 1163 lines) | LOW | HIGH | Currently 937+ lines; adding ~40 more is acceptable but flagged for future refactoring |
| New PreToolUse[Bash] section in settings.json | LOW | LOW | Standard JSON structure addition; installer handles bulk copy |
| Hook timeout cascade (7 PreToolUse[Task] hooks) | MEDIUM | LOW | Each hook has 10s timeout; worst case 70s for all Task hooks |
| Regression in existing 41 CJS tests | MEDIUM | LOW | Run full test suite after each hook implementation |
| Settings.json validity after 7 hook additions | LOW | LOW | JSON validation in tests; AC-08d covers this |

### M3: Test Coverage Analysis

**Current CJS test coverage:**
- `review-reminder.test.cjs`: 10 tests
- `common-code-review.test.cjs`: 6 tests
- `schema-validation.test.cjs`: 25 tests
- **Total: 41 CJS tests passing**

**Gaps in current test coverage for affected areas:**
- `gate-blocker.cjs`: NO dedicated test file (tested indirectly)
- `iteration-corridor.cjs`: NO dedicated test file
- `skill-validator.cjs`: NO dedicated test file
- `constitution-validator.cjs`: NO dedicated test file
- `common.cjs normalizeAgentName()`: covered in characterization tests but not CJS unit tests
- `common.cjs loadManifest()`: covered in characterization tests but not CJS unit tests

**Risk implication:** The existing PreToolUse[Task] hooks that will run alongside the new hooks have no dedicated unit tests. If the new hooks introduce interaction bugs, they may not be caught by the existing test suite.

**New test budget (per NFR-04: minimum 10 tests per hook):**
| Hook | Min Tests | Estimated Tests |
|------|-----------|-----------------|
| phase-loop-controller.cjs | 10 | 12 (4 AC + error paths + edge cases) |
| plan-surfacer.cjs | 10 | 10 (4 AC + error paths) |
| phase-sequence-guard.cjs | 10 | 12 (5 AC + error paths + edge cases) |
| branch-guard.cjs | 10 | 14 (6 AC + error paths + git error paths) |
| state-write-validator.cjs | 10 | 14 (6 AC + error paths + monorepo paths) |
| walkthrough-tracker.cjs | 10 | 10 (4 AC + error paths) |
| discover-menu-guard.cjs | 10 | 10 (4 AC + error paths) |
| **Total** | **70** | **82** |

### M3: Complexity Hotspots

1. **Phase delegation detection logic** (shared by FR-01 and FR-03)
   - Must parse free-text task prompts for agent names and phase keywords
   - Must handle variations: "requirements-analyst", "01-requirements-analyst", "requirements"
   - Must whitelist setup commands (discover, init, configure)
   - `normalizeAgentName()` already handles 30+ variations -- extend, don't duplicate

2. **settings.json structural changes** (FR-04 and FR-05)
   - Adding PreToolUse[Bash] is a new matcher type -- first in the framework
   - Adding PostToolUse[Write] and PostToolUse[Edit] are new matcher types
   - Must verify Claude Code supports these matchers

3. **state-write-validator PostToolUse protocol** (FR-05)
   - PostToolUse for Write/Edit tools may have different stdin format than Task/Bash
   - Must verify: does `tool_input.file_path` exist in PostToolUse[Write] stdin?
   - Fallback: scan `tool_result` for file path if `tool_input` is not available

4. **Hook execution order** (PreToolUse[Task])
   - 7 hooks will fire on every Task tool call (up from 4)
   - Claude Code executes hooks sequentially within a matcher
   - If any hook blocks, subsequent hooks do not fire
   - Order: iteration-corridor -> skill-validator -> phase-loop-controller -> plan-surfacer -> phase-sequence-guard -> gate-blocker -> constitution-validator

### M3: Technical Debt Markers

| File | Debt | Impact |
|------|------|--------|
| `common.cjs` | 1163 lines, growing | Adding ~40 more lines acceptable; split backlog item exists in CLAUDE.md |
| `uninstall.sh` FRAMEWORK_HOOKS | Hardcoded array | Must manually sync with actual hook files; no auto-discovery |
| `gate-blocker.cjs` | No dedicated tests | New hooks interact with it but cannot verify integration in CJS tests |
| `settings.json` | Increasingly complex | 246 lines -> ~300+ lines with new matchers; consider generating from template |

### M3: Recommendations

1. **Add tests BEFORE modifying gate-blocker.cjs or iteration-corridor.cjs** -- these hooks have no unit tests and the new hooks interact with them
2. **Verify PostToolUse stdin format** for Write/Edit tools before implementing FR-05 -- build a minimal test hook first
3. **Extract `detectPhaseDelegation()` into common.cjs first** -- prevents FR-01 and FR-03 from diverging
4. **Run the full test suite (41 CJS + ESM + characterization + E2E) after each hook** to catch regressions early
5. **Test hook ordering explicitly** -- create an integration test that simulates multiple PreToolUse[Task] hooks firing in sequence

---

## Implementation Recommendations

Based on the impact analysis:

1. **Suggested Order**: common.cjs utility -> branch-guard (independent) -> plan-surfacer (independent) -> phase-loop-controller (depends on utility) -> phase-sequence-guard (depends on utility) -> state-write-validator (different matcher) -> walkthrough-tracker -> discover-menu-guard -> settings.json -> uninstall.sh
2. **High-Risk Areas**: Phase delegation detection in Task prompts (shared logic), PreToolUse[Bash] (new matcher type), PostToolUse[Write/Edit] (new matcher type, unverified stdin format)
3. **Dependencies to Resolve**: Verify PostToolUse stdin format for Write/Edit tools; confirm Claude Code supports PreToolUse[Bash] matcher; decide hook execution order in settings.json
4. **Add Tests First**: gate-blocker.cjs and iteration-corridor.cjs have no unit tests but interact with the new hooks

---

## Impact Analysis Metadata

```json
{
  "analysis_completed_at": "2026-02-08T23:20:00Z",
  "sub_agents": ["M1", "M2", "M3"],
  "requirements_document": "docs/requirements/REQ-0004-advisory-behavior-hooks/requirements-spec.md",
  "quick_scan_used": null,
  "scope_change_from_original": "refined",
  "requirements_keywords": ["hooks", "PreToolUse", "PostToolUse", "CJS", "fail-open", "phase-delegation", "branch-guard", "state-validation", "walkthrough", "discover-menu"],
  "files_analyzed": {
    "existing_hooks": 11,
    "existing_hook_tests": 3,
    "existing_cjs_tests": 41,
    "settings_json_lines": 246,
    "common_cjs_lines": 1163,
    "new_files_planned": 14,
    "existing_files_modified": 3,
    "new_tests_planned": "70-82"
  }
}
```
