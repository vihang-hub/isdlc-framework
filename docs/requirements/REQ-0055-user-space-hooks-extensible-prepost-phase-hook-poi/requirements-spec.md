# Requirements Specification: User-Space Hooks

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-03-08
**Coverage**: 100%

---

## 1. Business Context

### 1.1 Problem Statement

The iSDLC framework cannot anticipate every domain-specific need. Teams working with proprietary formats, internal compliance tools, or notification systems have no way to plug their tooling into the workflow lifecycle. The framework's 26 hooks are internal enforcement mechanisms -- not user-extensible.

This limits the framework's value as a platform. Without user-extensible hook points, teams must either work outside the framework or request framework changes for every domain-specific need.

### 1.2 Success Criteria

- A developer can drop a script into `.isdlc/hooks/{hook-point}/` and it executes automatically at the right moment -- no registration, no config, no framework changes
- The framework remains stable regardless of what user hooks do (isolation)
- Users retain full control over hook outcomes (bypass, skip, override decisions)

### 1.3 Strategic Context

Part of the Hackability & Extensibility Roadmap -- Tier 2 (Extension Points), Layer 3 (Extend). Tier 1 (Foundation) is complete: gate profiles, workflow recovery, roundtable depth, and contributing personas are all shipped.

---

## 2. Stakeholders and Personas

### 2.1 Primary: Framework Developer

- **Role**: Developer using iSDLC to build software
- **Interest**: Plug domain-specific tooling into the workflow without modifying the framework
- **Pain point**: Must work outside the framework for domain-specific validation, notifications, and compliance checks

### 2.2 Secondary: Team Lead / DevOps

- **Role**: Sets up project conventions for a team
- **Interest**: Enforce team-specific quality gates and notifications across all team members' workflows
- **Pain point**: No mechanism to add team-level automation to the workflow lifecycle

---

## 3. User Journeys

### 3.1 Drop-in Hook

1. Developer creates `.isdlc/hooks/post-implementation/my-validator.sh`
2. Developer runs a workflow that reaches the implementation phase
3. After implementation completes, the framework discovers and executes `my-validator.sh`
4. Developer sees the script's stdout output
5. If the script exits non-zero, the framework surfaces the result to the user

### 3.2 Blocking Hook

1. Developer creates a pre-gate hook that runs a SAST scanner
2. Scanner finds a critical vulnerability, exits with code 2
3. Framework reports the block to the user
4. User decides: fix the issue, skip the hook, or override the block

### 3.3 Friendly Alias

1. Developer creates `.isdlc/hooks/post-implementation/` (friendly name)
2. Framework resolves `post-implementation` to `post-06-implementation` internally
3. Hook runs at the correct trigger point

---

## 4. Technical Context

### 4.1 Existing Infrastructure

- **Framework hooks**: 26 hooks in `src/claude/hooks/` using Claude Code's JSON stdin/stdout protocol
- **Phase advancement**: `src/antigravity/phase-advance.cjs` runs gate validation before advancing
- **Workflow lifecycle**: `workflow-init.cjs` (start), `workflow-finalize.cjs` (end)
- **Phase identifiers**: String-based (e.g., `00-quick-scan`, `01-requirements`, `06-implementation`)

### 4.2 Constraints

- User hooks execute as child processes (shell commands) -- any language
- User hooks must not modify `.isdlc/state.json` directly
- Hook timeout is configurable (default 60 seconds)
- Hook execution must not crash the framework on failure

---

## 5. Quality Attributes and Risks

### 5.1 Quality Attributes

| Attribute | Priority | Threshold |
|-----------|----------|-----------|
| Discoverability | Must | Drop a file, it works -- no registration |
| Isolation | Must | Bad hook cannot corrupt framework state |
| Transparency | Must | User sees what ran, what passed, what failed |
| User control | Must | User can bypass or override any hook outcome |
| Performance | Should | Hook execution adds < 5s to typical workflow (excluding user script time) |

### 5.2 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Broken hook stalls all workflows | Medium | High | User bypass mechanism -- framework presents options when hook fails |
| Hook modifies state.json directly | Low | High | State.json is managed by framework; hooks receive context via env vars, not direct access |
| Hook timeout blocks workflow indefinitely | Low | Medium | Configurable timeout with kill-after enforcement |
| Ambiguous phase name resolution | Low | Low | Document both forms; framework logs which resolved name was used |

---

## 6. Functional Requirements

### FR-001: Hook Discovery
**Priority**: Must Have
**Confidence**: High

The framework SHALL discover user-space hooks by scanning the `.isdlc/hooks/` directory tree at each trigger point. No registration file, manifest, or configuration is required.

**AC-001-01**: Given a script exists at `.isdlc/hooks/{hook-point}/{script-name}`, when the corresponding trigger point fires, then the script is discovered and queued for execution.

**AC-001-02**: Given no `.isdlc/hooks/` directory exists, when any trigger point fires, then the framework proceeds normally with no errors.

**AC-001-03**: Given multiple scripts exist in the same hook-point directory, when the trigger fires, then scripts execute in alphabetical order by filename.

### FR-002: Hook Execution
**Priority**: Must Have
**Confidence**: High

The framework SHALL execute discovered hooks as child processes using the system shell, capturing stdout and stderr.

**AC-002-01**: Given a hook script at a valid hook point, when executed, then its stdout is captured and shown to the developer.

**AC-002-02**: Given a hook script, when it exceeds the configured timeout, then the process is killed and the framework reports a timeout to the user.

**AC-002-03**: Given a hook script, when it throws an unhandled error or crashes, then the framework catches the failure and reports it without crashing itself.

### FR-003: Exit Code Protocol
**Priority**: Must Have
**Confidence**: High

The framework SHALL interpret hook exit codes as follows: 0 = pass, 1 = warning, 2 = block.

**AC-003-01**: Given a hook exits with code 0, when processing results, then the framework records success and continues.

**AC-003-02**: Given a hook exits with code 1, when processing results, then the framework shows the warning to the user and continues.

**AC-003-03**: Given a hook exits with code 2, when processing results, then the framework reports a block to the user and halts the current operation (gate advancement or phase transition), presenting the user with options to proceed.

**AC-003-04**: Given a hook exits with any other code (3+), when processing results, then the framework treats it as a warning (same as exit 1).

### FR-004: Hook Points (General Pattern)
**Priority**: Must Have
**Confidence**: High

The framework SHALL support hook points following a general naming pattern rather than a fixed list.

**AC-004-01**: The framework SHALL support `pre-workflow` hooks, executed before workflow initialization completes.

**AC-004-02**: The framework SHALL support `pre-{phase-name}` hooks, executed before the named phase begins.

**AC-004-03**: The framework SHALL support `post-{phase-name}` hooks, executed after the named phase completes.

**AC-004-04**: The framework SHALL support `pre-gate` hooks, executed before gate validation in `phase-advance.cjs`.

**AC-004-05**: The framework SHALL support `post-workflow` hooks, executed after workflow finalization completes.

### FR-005: Phase Name Resolution
**Priority**: Must Have
**Confidence**: High

The framework SHALL accept both internal phase identifiers and friendly aliases for hook point directories.

**AC-005-01**: Given a hook directory named `post-implementation`, when resolving, then the framework maps it to `post-06-implementation`.

**AC-005-02**: Given a hook directory named `post-06-implementation`, when resolving, then the framework uses the name directly.

**AC-005-03**: Given a hook directory with an unrecognized phase name, when resolving, then the framework logs a warning and skips the directory.

**AC-005-04**: The framework SHALL maintain a phase alias map that resolves friendly names (e.g., `implementation`, `requirements`, `code-review`) to internal identifiers (e.g., `06-implementation`, `01-requirements`, `08-code-review`).

### FR-006: User Override on Block
**Priority**: Must Have
**Confidence**: High

When a hook exits with code 2 (block), the framework SHALL present the situation to the user and Claude, allowing them to decide how to proceed.

**AC-006-01**: Given a hook blocks, when presenting to the user, then the framework shows the hook name, exit code, and captured output.

**AC-006-02**: The interaction for resolving a blocked hook is between the harness (framework), Claude, and the user -- the user retains final authority over whether to proceed, skip, or fix.

### FR-007: Timeout Configuration
**Priority**: Should Have
**Confidence**: High

The framework SHALL allow hook timeout configuration via `.isdlc/config.json`.

**AC-007-01**: Given `hook_timeout_ms` is set in `.isdlc/config.json`, when executing hooks, then the framework uses the configured timeout.

**AC-007-02**: Given no timeout is configured, when executing hooks, then the framework uses a default of 60 seconds.

### FR-008: Context Passing
**Priority**: Should Have
**Confidence**: Medium

The framework SHALL pass workflow context to hooks via environment variables.

**AC-008-01**: The framework SHALL set `ISDLC_PHASE` to the current phase identifier.

**AC-008-02**: The framework SHALL set `ISDLC_WORKFLOW_TYPE` to the workflow type (feature, fix, upgrade, etc.).

**AC-008-03**: The framework SHALL set `ISDLC_SLUG` to the workflow slug.

**AC-008-04**: The framework SHALL set `ISDLC_PROJECT_ROOT` to the project root directory.

**AC-008-05**: The framework SHALL set `ISDLC_ARTIFACT_FOLDER` to the artifact folder path (if applicable).

### FR-009: Hook Authoring Guide
**Priority**: Should Have
**Confidence**: High

A documentation file SHALL be created at `docs/isdlc/user-hooks.md` covering hook creation, available hook points, exit code protocol, context variables, and examples.

**AC-009-01**: The guide documents all available hook point patterns with examples.

**AC-009-02**: The guide includes a quick-start example that a developer can copy and adapt.

**AC-009-03**: The guide documents the phase alias map (friendly names to internal identifiers).

### FR-010: Update Safety
**Priority**: Must Have
**Confidence**: High

The user's hook scripts in `.isdlc/hooks/` SHALL be preserved when the framework is updated via `update.sh` or `isdlc update`.

**AC-010-01**: Given user hook scripts exist in `.isdlc/hooks/`, when the framework is updated, then the scripts are not modified, overwritten, or deleted.

**AC-010-02**: The update scripts (`update.sh` and `lib/updater.js`) SHALL document `.isdlc/hooks/` in their "preserved" (never touched) list.

### FR-011: Hook Execution Logging
**Priority**: Could Have
**Confidence**: Medium

The framework SHOULD log hook execution results for observability.

**AC-011-01**: Given hooks execute, when logging, then each hook's name, exit code, duration, and output summary are recorded.

**AC-011-02**: Log entries are accessible for debugging but do not clutter normal workflow output.

---

## 7. Out of Scope

- **Hook marketplace or sharing mechanism**: Hooks are project-local files. Sharing is via normal file distribution (git, copy).
- **GUI for hook management**: Hooks are managed by file system operations.
- **Framework hook extensibility**: The 26 existing Claude Code hooks remain framework-internal. This feature adds a separate user-space hook system.
- **Hook dependency ordering**: Hooks execute alphabetically. If a developer needs ordering, they use filename prefixes (e.g., `01-lint.sh`, `02-test.sh`).
- **Hook-to-hook communication**: Each hook runs independently. No shared state between hooks in the same hook point.

---

## 8. MoSCoW Prioritization

| Priority | Requirements |
|----------|-------------|
| **Must Have** | FR-001 (Discovery), FR-002 (Execution), FR-003 (Exit Codes), FR-004 (Hook Points), FR-005 (Phase Name Resolution), FR-006 (User Override), FR-010 (Update Safety) |
| **Should Have** | FR-007 (Timeout Config), FR-008 (Context Passing), FR-009 (Authoring Guide) |
| **Could Have** | FR-011 (Execution Logging) |
| **Won't Have** | Hook marketplace, GUI management, framework hook extensibility, hook dependencies, hook-to-hook communication |
