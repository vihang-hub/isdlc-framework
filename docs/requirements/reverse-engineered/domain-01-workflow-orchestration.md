# Domain 01: Workflow Orchestration

**Source Files**: `lib/cli.js`, `src/claude/agents/00-sdlc-orchestrator.md`
**AC Count**: 14
**Priority**: 5 Critical, 6 High, 3 Medium

---

## AC-WO-001: CLI Command Routing [CRITICAL]

**Given** a user invokes the `isdlc` CLI with a command argument
**When** the `run()` function processes the arguments
**Then** it routes to the correct handler:
  - `init` -> `install()`
  - `update` -> `update()`
  - `version` -> `showVersion()`
  - `doctor` -> `runDoctor()`
  - `uninstall` -> `uninstall()`
  - `help` or no command -> `showHelp()`
  - unknown command -> error message + help + exit code 1

**Source**: `lib/cli.js:168-231`

---

## AC-WO-002: CLI Argument Parsing [HIGH]

**Given** the CLI receives command-line arguments
**When** `parseArgs()` processes them
**Then** it correctly extracts:
  - The command (first non-flag argument)
  - Boolean flags: `--monorepo`, `--force`, `--dry-run`, `--backup`, `--purge-all`, `--purge-docs`
  - Value flags: `--provider-mode <value>`
  - Short flags: `-h` -> help, `-v` -> version
  - `--help` and `--version` as commands

**Source**: `lib/cli.js:103-162`

---

## AC-WO-003: Provider Mode Validation [HIGH]

**Given** the user passes `--provider-mode` with a value
**When** the `init` command processes it
**Then** it validates the value is one of: `free`, `budget`, `quality`, `local`, `hybrid`
**And** throws an error with the list of valid modes if invalid

**Source**: `lib/cli.js:178-183`

---

## AC-WO-004: Background Update Check [MEDIUM]

**Given** the CLI executes any command
**When** the command completes successfully
**Then** it checks for npm registry updates in the background (non-blocking)
**And** displays an update notification if a newer version is available
**And** does NOT show the notification for `update` or `version` commands

**Source**: `lib/cli.js:173, 220-223`

---

## AC-WO-005: State File Phase Tracking [CRITICAL]

**Given** the framework is installed with state.json
**When** the orchestrator manages workflow progression
**Then** state.json tracks 13 phases (01-requirements through 13-operations)
**And** each phase has: status, started, completed, gate_passed, artifacts[]
**And** phases 05 and 06 additionally track iteration_tracking with current, max, history, final_status

**Source**: `.isdlc/state.json:81-94`

---

## AC-WO-006: Workflow History Append-Only [HIGH]

**Given** any agent performs an action
**When** the action is recorded
**Then** it is appended to the `history[]` array in state.json
**And** each entry has: timestamp (ISO 8601), agent name, action description
**And** existing entries are never modified or removed

**Source**: `.isdlc/state.json:98-108`, Constitution Article XIV rule 6

---

## AC-WO-007: Active Workflow State [CRITICAL]

**Given** a workflow is started (feature, fix, test-run, etc.)
**When** the orchestrator sets active_workflow
**Then** it stores: type, current_phase, current_phase_index
**And** hooks read active_workflow.current_phase preferentially over state.current_phase
**And** workflow-specific phase overrides are applied from iteration-requirements.json

**Source**: `src/claude/hooks/gate-blocker.js:412-448`

---

## AC-WO-008: Workflow Phase Sequence Validation [CRITICAL]

**Given** a workflow definition has a fixed phase sequence
**When** gate advancement is attempted
**Then** the gate-blocker validates current_phase matches the expected position in the workflow
**And** blocks advancement with "Workflow state mismatch" if the phase at current_phase_index differs

**Source**: `src/claude/hooks/gate-blocker.js:428-439`

---

## AC-WO-009: Setup Command Bypass [HIGH]

**Given** a tool call contains setup-related keywords
**When** gate-blocker, iteration-corridor, or constitution-validator processes it
**Then** it is always allowed without gate checks
**And** the bypass keywords are: discover, constitution, init, setup, configure, configure-cloud, new project, project setup, install, status

**Source**: `src/claude/hooks/gate-blocker.js:96-107`, `iteration-corridor.js:35-46`, `constitution-validator.js:71-82`

---

## AC-WO-010: Workflow Override Merging [HIGH]

**Given** a workflow type has overrides in iteration-requirements.json
**When** phase requirements are loaded for gate checking
**Then** base phase requirements are deep-merged with workflow-specific overrides
**And** override values replace base values at the leaf level
**And** nested objects are recursively merged

**Source**: `src/claude/hooks/gate-blocker.js:75-90, 466-472`

---

## AC-WO-011: Counter Management [MEDIUM]

**Given** state.json tracks requirement and bug counters
**When** a new requirement or bug is created
**Then** `counters.next_req_id` or `counters.next_bug_id` is incremented
**And** IDs are monotonically increasing

**Source**: `.isdlc/state.json:76-79`

---

## AC-WO-012: Complexity Assessment Storage [MEDIUM]

**Given** a project's complexity is assessed
**When** the assessment is stored in state.json
**Then** it records: level, track, assessed_at, assessed_by
**And** dimension scores for: architectural, security, testing, deployment, team, timeline

**Source**: `.isdlc/state.json:19-32`

---

## AC-WO-013: Error Handling with Debug Mode [HIGH]

**Given** the CLI encounters an error during command execution
**When** the error is caught
**Then** it displays the error message to the user
**And** if `DEBUG` environment variable is set, also prints the full stack trace
**And** exits with code 1

**Source**: `lib/cli.js:224-229`

---

## AC-WO-014: Last Workflow Phase Detection [CRITICAL]

**Given** the active workflow is at the last phase in its sequence
**When** gate advancement is attempted
**Then** gate-blocker detects this is the final phase
**And** logs that advancement would complete the workflow
**And** applies all gate checks before allowing completion

**Source**: `src/claude/hooks/gate-blocker.js:442-445`
