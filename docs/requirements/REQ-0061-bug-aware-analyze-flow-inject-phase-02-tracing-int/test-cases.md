# Test Cases: Bug-Aware Analyze Flow

**Status**: Complete
**Requirement**: REQ-0061 / GH-119
**Last Updated**: 2026-03-11
**Total Test Cases**: 27 (8 integration + 19 behavioral)

---

## FR-001: LLM-Based Bug Detection in Analyze Handler

### TC-001: Bug-like description detected as bug (positive)

- **Requirement**: FR-001, AC-001-01
- **Test Type**: positive, behavioral
- **Priority**: P0
- **Preconditions**: User invokes `analyze #N` where issue #N has description containing error messages, unexpected behavior, or regression language
- **Input**: Issue description: "The `/isdlc fix` command returns a 500 error when the artifact folder contains spaces. Expected: workflow starts normally. Actual: crash with stack trace pointing to path.resolve() in three-verb-utils.cjs."
- **Expected Result**: System infers classification as "bug" and presents reasoning to the user: "This looks like a bug because [describes symptoms/error]. Use the bug analysis flow?"
- **Pass Criteria**: Classification is "bug"; reasoning references specific symptoms from the description; user is asked for confirmation

### TC-002: Feature-like description detected as feature (positive)

- **Requirement**: FR-001, AC-001-02
- **Test Type**: positive, behavioral
- **Priority**: P0
- **Preconditions**: User invokes `analyze #N` where issue #N describes a new capability
- **Input**: Issue description: "Add support for custom workflow definitions via YAML files in .isdlc/workflows/. Users should be able to define their own phase sequences."
- **Expected Result**: System infers classification as "feature" and routes directly to the roundtable (Maya/Alex/Jordan) without presenting the bug confirmation prompt
- **Pass Criteria**: No bug confirmation prompt; roundtable dispatch occurs

### TC-003: Labels supplementary, not overriding -- bug label on feature (negative)

- **Requirement**: FR-001, AC-001-03
- **Test Type**: negative, behavioral
- **Priority**: P1
- **Preconditions**: Issue has label "bug" but description describes a feature request
- **Input**: Issue with label "bug", description: "It would be great if the framework supported Python projects in addition to Node.js. Currently only Node.js is detected."
- **Expected Result**: System classifies as "feature" based on description content despite the "bug" label; routes to roundtable
- **Pass Criteria**: Description content overrides label; classification is "feature"

### TC-004: Labels supplementary, not overriding -- enhancement label on bug (negative)

- **Requirement**: FR-001, AC-001-03
- **Test Type**: negative, behavioral
- **Priority**: P1
- **Preconditions**: Issue has label "enhancement" but description describes a crash/error
- **Input**: Issue with label "enhancement", description: "The installer crashes with ENOENT when the target directory doesn't exist. Stack trace: Error: ENOENT: no such file or directory, symlink..."
- **Expected Result**: System classifies as "bug" based on description content despite the "enhancement" label; presents bug confirmation
- **Pass Criteria**: Description content overrides label; classification is "bug"

### TC-005: User overrides bug classification to feature (positive)

- **Requirement**: FR-001, AC-001-04
- **Test Type**: positive, behavioral
- **Priority**: P0
- **Preconditions**: System has classified an item as "bug" and presented confirmation
- **Input**: User responds: "No, that's actually a feature request"
- **Expected Result**: System accepts override and routes to roundtable for feature analysis
- **Pass Criteria**: Roundtable dispatched; no bug-gather agent invoked; no bug artifacts produced

---

## FR-002: Bug-Gather Agent for Bug Analysis

### TC-006: Agent extracts symptoms and error messages (positive)

- **Requirement**: FR-002, AC-002-01
- **Test Type**: positive, behavioral
- **Priority**: P0
- **Preconditions**: Bug confirmed; bug-gather agent dispatched with issue description containing symptoms and error messages
- **Input**: Issue description with "TypeError: Cannot read properties of undefined (reading 'phases')" and description of when it occurs
- **Expected Result**: Agent extracts: symptoms ("crash when reading phases"), error message ("TypeError: Cannot read properties..."), expected vs actual behavior
- **Pass Criteria**: Structured playback includes extracted symptoms and error messages

### TC-007: Agent scans codebase for relevant files (positive)

- **Requirement**: FR-002, AC-002-02
- **Test Type**: positive, behavioral
- **Priority**: P0
- **Preconditions**: Bug-gather agent has extracted keywords from bug description
- **Input**: Bug description mentioning "state.json", "phases", "gate-blocker"
- **Expected Result**: Agent uses Grep/Glob to search codebase and identifies relevant files (e.g., state.json references, gate-blocker.js)
- **Pass Criteria**: Agent reports specific files and code areas in its playback

### TC-008: Agent presents structured playback (positive)

- **Requirement**: FR-002, AC-002-03
- **Test Type**: positive, behavioral
- **Priority**: P0
- **Preconditions**: Agent has completed parsing and codebase scan
- **Input**: Completed gather phase
- **Expected Result**: Agent presents structured understanding with: (1) what's broken, (2) where it likely lives in the code, (3) what's affected, (4) reproduction steps if available
- **Pass Criteria**: All four sections present in playback output; information is specific (not generic)

### TC-009: Agent asks for additional context (positive)

- **Requirement**: FR-002, AC-002-04
- **Test Type**: positive, behavioral
- **Priority**: P1
- **Preconditions**: Agent has presented structured playback
- **Input**: Playback complete
- **Expected Result**: Agent asks user: "Is there anything you'd like to add?" or equivalent
- **Pass Criteria**: Explicit prompt for additional context before proceeding to artifact production

### TC-010: Agent incorporates user additions (positive)

- **Requirement**: FR-002, AC-002-05
- **Test Type**: positive, behavioral
- **Priority**: P1
- **Preconditions**: Agent has asked for additional context
- **Input**: User provides: "It only happens when the project has a monorepo setup with 3+ sub-projects"
- **Expected Result**: Agent incorporates this into its understanding and updates the affected area analysis
- **Pass Criteria**: Subsequent artifact production includes the user-provided context

---

## FR-003: Artifact Production by Bug-Gather Agent

### TC-011: bug-report.md produced with required sections (positive)

- **Requirement**: FR-003, AC-003-01
- **Test Type**: positive, integration
- **Priority**: P0
- **Preconditions**: Bug-gather agent has completed gather + user confirmation
- **Input**: Completed bug understanding
- **Expected Result**: `bug-report.md` written to artifact folder with sections: Expected Behavior, Actual Behavior, Symptoms, Error Messages (if available), Reproduction Steps (if available), Affected Area, Severity
- **Pass Criteria**: File exists at `docs/requirements/{slug}/bug-report.md`; Expected Behavior and Actual Behavior sections are non-empty
- **Validation**: `grep -c '## Expected Behavior' bug-report.md` returns 1; `grep -c '## Actual Behavior' bug-report.md` returns 1

### TC-012: requirements-spec.md produced with FR/AC structure (positive)

- **Requirement**: FR-003, AC-003-02
- **Test Type**: positive, integration
- **Priority**: P0
- **Preconditions**: Bug-gather agent has completed gather + user confirmation
- **Input**: Completed bug understanding
- **Expected Result**: Lightweight `requirements-spec.md` written with: Problem Statement section, single FR describing the bug fix, at least 1 AC for the fix
- **Pass Criteria**: File exists at `docs/requirements/{slug}/requirements-spec.md`; contains at least 1 FR header; contains at least 1 AC
- **Validation**: `grep -c 'FR-' requirements-spec.md` >= 1; `grep -c 'AC-' requirements-spec.md` >= 1

### TC-013: Artifacts written to correct folder (positive)

- **Requirement**: FR-003, AC-003-03
- **Test Type**: positive, integration
- **Priority**: P0
- **Preconditions**: ARTIFACT_FOLDER provided in dispatch prompt
- **Input**: ARTIFACT_FOLDER = `docs/requirements/BUG-0042-some-bug/`
- **Expected Result**: Both `bug-report.md` and `requirements-spec.md` written to `docs/requirements/BUG-0042-some-bug/`
- **Pass Criteria**: Both files exist at the specified path

### TC-014: Artifacts satisfy tracing orchestrator pre-phase check (positive)

- **Requirement**: FR-003, AC-003-04
- **Test Type**: positive, integration
- **Priority**: P0
- **Preconditions**: Artifacts produced by bug-gather agent
- **Input**: bug-report.md with all required sections
- **Expected Result**: Tracing orchestrator pre-phase check would pass (bug-report.md exists with expected vs actual behavior sections; requirements-spec.md exists)
- **Pass Criteria**: bug-report.md has "Expected Behavior" and "Actual Behavior" sections; requirements-spec.md has at least 1 FR; both are valid markdown
- **Validation**: Format validation test verifies section headers and non-empty content

---

## FR-004: Explicit Fix Handoff Gate

### TC-015: "Should I fix it?" presented after artifacts (positive)

- **Requirement**: FR-004, AC-004-01
- **Test Type**: positive, behavioral
- **Priority**: P0
- **Preconditions**: Bug-gather agent has produced artifacts
- **Input**: Artifact production complete
- **Expected Result**: System presents "Should I fix it?" (or equivalent consent gate) to the user
- **Pass Criteria**: Explicit question about proceeding to fix; no automatic workflow creation

### TC-016: User confirms fix -- workflow starts at Phase 02 (positive)

- **Requirement**: FR-004, AC-004-02, AC-004-04
- **Test Type**: positive, behavioral
- **Priority**: P0
- **Preconditions**: "Should I fix it?" presented; bug-report.md and requirements-spec.md exist; meta.json updated
- **Input**: User responds: "Yes" / "Go ahead" / "Fix it"
- **Expected Result**: Fix workflow invoked for the item; computeStartPhase detects Phase 01 artifacts; workflow starts at Phase 02 (tracing)
- **Pass Criteria**: Fix workflow created; first phase is 02-tracing (not 01-requirements)

### TC-017: User declines fix -- artifacts preserved (positive)

- **Requirement**: FR-004, AC-004-03
- **Test Type**: positive, behavioral
- **Priority**: P0
- **Preconditions**: "Should I fix it?" presented
- **Input**: User responds: "No" / "Not now" / "I just wanted to understand it"
- **Expected Result**: No workflow created; artifacts (bug-report.md, requirements-spec.md) remain on disk; user regains control
- **Pass Criteria**: No state.json workflow entry created; files exist in artifact folder; user can later invoke `/isdlc fix {slug}` manually

---

## FR-005: Feature Fallback on User Override

### TC-018: Override routes to roundtable (positive)

- **Requirement**: FR-005, AC-005-01, AC-005-03
- **Test Type**: positive, behavioral
- **Priority**: P0
- **Preconditions**: System classified item as bug; user overrides
- **Input**: User says: "No, it's a feature" / "Treat this as a feature request"
- **Expected Result**: System dispatches to roundtable-analyst (Maya/Alex/Jordan) for standard feature analysis; conversation proceeds identically to current feature analysis behavior
- **Pass Criteria**: Roundtable-analyst dispatched via Task tool; roundtable personas appear

### TC-019: No bug artifacts on override (negative)

- **Requirement**: FR-005, AC-005-02
- **Test Type**: negative, behavioral
- **Priority**: P1
- **Preconditions**: User overrides bug classification to feature
- **Input**: Override to feature
- **Expected Result**: No `bug-report.md` is produced; no bug-gather agent is dispatched
- **Pass Criteria**: No `bug-report.md` in artifact folder; bug-gather agent not invoked

---

## FR-006: Live Progress During Autonomous Fix Execution

### TC-020: Phase transitions visible (positive)

- **Requirement**: FR-006, AC-006-01, AC-006-02, AC-006-03
- **Test Type**: positive, behavioral
- **Priority**: P2
- **Preconditions**: User confirmed fix; fix workflow running autonomously
- **Input**: Fix workflow in progress
- **Expected Result**: Each phase transition is visible (tracing -> test strategy -> implementation -> quality loop -> code review); tracing T1/T2/T3 parallel status visible; no "continue" prompts between phases
- **Pass Criteria**: Phase transitions displayed; no user interaction required during autonomous execution
- **Note**: Largely validated by existing Phase-Loop Controller behavior. This test confirms the expectation for the bug-aware flow specifically.

---

## Error Scenario Tests

### TC-021: Ambiguous classification asks user directly (ERR-BGA-001)

- **Requirement**: FR-001, AC-001-04
- **Test Type**: negative, behavioral
- **Priority**: P1
- **Preconditions**: Issue description is genuinely ambiguous (could be bug or feature)
- **Input**: Issue: "The search results page shows 10 results per page. It should show 20." (could be bug if spec says 20, or feature if requesting a change)
- **Expected Result**: System asks user directly: "I'm not sure if this is a bug or a feature. Which analysis flow should I use?"
- **Pass Criteria**: Direct question to user; no assumption made

### TC-022: Codebase scan returns no results (ERR-BGA-002)

- **Requirement**: FR-002, AC-002-02
- **Test Type**: negative, behavioral
- **Priority**: P2
- **Preconditions**: Bug-gather agent scanning codebase; no keyword matches found
- **Input**: Bug description with terms not found in codebase
- **Expected Result**: Agent reports: "Could not find related code. Can you point me to the area of the codebase where this bug occurs?"
- **Pass Criteria**: Agent asks for more context instead of producing empty playback

### TC-023: Vague description triggers clarification (ERR-BGA-003)

- **Requirement**: FR-002, AC-002-01
- **Test Type**: negative, behavioral
- **Priority**: P2
- **Preconditions**: Issue description lacks symptoms, error messages, or reproduction steps
- **Input**: Issue description: "Something is wrong with the installer"
- **Expected Result**: Agent asks for more detail: "The bug description is sparse. Can you describe what you're seeing?"
- **Pass Criteria**: Agent asks for clarification before attempting codebase scan

### TC-024: Artifact write failure fallback (ERR-BGA-004)

- **Requirement**: FR-003, AC-003-01
- **Test Type**: negative, behavioral
- **Priority**: P2
- **Preconditions**: Bug-gather agent attempts to write artifacts; write fails
- **Input**: Disk error during write
- **Expected Result**: Error reported to user; retry once; if persistent, agent reports failure
- **Pass Criteria**: User informed of failure; artifacts not silently lost

### TC-025: Fix handoff failure (ERR-BGA-005)

- **Requirement**: FR-004, AC-004-02
- **Test Type**: negative, behavioral
- **Priority**: P2
- **Preconditions**: User confirms fix; fix handler invocation fails
- **Input**: Fix handler cannot resolve item or state conflict
- **Expected Result**: Error reported; artifacts preserved; user told they can retry with `/isdlc fix {slug}`
- **Pass Criteria**: Artifacts on disk; user informed of manual recovery option

### TC-026: Tracing orchestrator rejects artifacts (ERR-BGA-006)

- **Requirement**: FR-003, AC-003-04
- **Test Type**: negative, integration
- **Priority**: P1
- **Preconditions**: bug-report.md missing required sections
- **Input**: bug-report.md without "Expected Behavior" section
- **Expected Result**: Tracing orchestrator pre-phase check fails with clear error message
- **Pass Criteria**: Validation detects missing section; error message identifies the gap
- **Validation**: Format validation test with intentionally incomplete artifact

### TC-027: computeStartPhase detection failure (ERR-BGA-007)

- **Requirement**: FR-004, AC-004-04
- **Test Type**: negative, integration
- **Priority**: P1
- **Preconditions**: meta.json phases_completed not updated by bug-gather agent
- **Input**: meta.json without Phase 01 indicators in phases_completed
- **Expected Result**: computeStartPhase returns status 'raw'; fix workflow starts from Phase 01 (redundant but safe)
- **Pass Criteria**: computeStartPhase({}, fixPhases) returns startPhase null
- **Validation**: Call computeStartPhase with empty meta and verify it returns raw status
