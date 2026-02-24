# Domain 03: Iteration Enforcement

**Source Files**: `src/claude/hooks/gate-blocker.js`, `src/claude/hooks/iteration-corridor.js`, `src/claude/hooks/test-watcher.js`, `src/claude/hooks/menu-tracker.js`
**AC Count**: 18
**Priority**: 7 Critical, 8 High, 3 Medium

---

## AC-IE-001: Gate Advancement Detection [CRITICAL]

**Given** a tool call is made (Task or Skill)
**When** gate-blocker intercepts it
**Then** it detects gate advancement attempts by:
  - Task calls to orchestrator with keywords: advance, gate, next phase, proceed, move to phase, progress to
  - Skill calls to "sdlc" with args containing "advance" or "gate"
**And** non-gate-related tool calls pass through without checks

**Source**: `src/claude/hooks/gate-blocker.js:112-161`

---

## AC-IE-002: Four-Check Gate Validation [CRITICAL]

**Given** a gate advancement attempt is detected
**When** gate-blocker validates requirements
**Then** it runs 4 checks in order:
  1. Test iteration requirement (tests must pass)
  2. Constitutional validation requirement (articles must be verified)
  3. Interactive elicitation requirement (A/R/C menu interactions required)
  4. Agent delegation requirement (phase agent must have been invoked)
**And** ALL checks must pass for gate to open
**And** blocking details are stored in state.json under phase.gate_validation

**Source**: `src/claude/hooks/gate-blocker.js:477-566`

---

## AC-IE-003: Test Iteration State Tracking [CRITICAL]

**Given** a Bash tool call contains a test command
**When** test-watcher processes the result
**Then** it creates/updates iteration state with:
  - current_iteration (incremented each run)
  - max_iterations (from config)
  - last_test_result: "passed" or "failed"
  - last_test_command: the actual command string
  - failures_count: cumulative failure count
  - history[]: entry per run with iteration, timestamp, command, result, failures, error
**And** marks completed=true with status="success" when tests pass

**Source**: `src/claude/hooks/test-watcher.js:398-529`

---

## AC-IE-004: Test Command Pattern Recognition [HIGH]

**Given** a Bash tool call is intercepted
**When** test-watcher checks the command
**Then** it recognizes 21 test command patterns:
  - npm test, npm run test, yarn test, pnpm test
  - pytest, python -m pytest
  - go test, cargo test
  - mvn test, gradle test, dotnet test
  - jest, mocha, vitest, phpunit, rspec
  - npm run test:unit, test:integration, test:e2e, e2e
  - cypress run, playwright test

**Source**: `src/claude/hooks/test-watcher.js:48-72`

---

## AC-IE-005: Test Result Parsing [HIGH]

**Given** a test command has executed
**When** test-watcher parses the output
**Then** it checks SUCCESS patterns: "All tests passed", "N passing", "PASSED", "0 failures"
**And** checks FAILURE patterns: "N failed", "FAIL", "Error:", "TypeError:", "npm ERR!"
**And** if both success and failure patterns match, verifies failure count is 0
**And** falls back to exit code if no patterns match
**And** defaults to failure if uncertain

**Source**: `src/claude/hooks/test-watcher.js:77-174`

---

## AC-IE-006: Circuit Breaker on Identical Failures [CRITICAL]

**Given** tests are failing during iteration
**When** the same error message repeats N times (configurable threshold, default 3)
**Then** test-watcher triggers the circuit breaker
**And** sets status="escalated", escalation_reason="circuit_breaker"
**And** outputs escalation message requiring human review
**And** iteration is completed (no further autonomous attempts)

**Source**: `src/claude/hooks/test-watcher.js:480-498`

---

## AC-IE-007: Max Iteration Escalation [CRITICAL]

**Given** tests have failed for N iterations
**When** current_iteration >= max_iterations
**Then** test-watcher escalates the iteration
**And** sets status="escalated", escalation_reason="max_iterations"
**And** outputs message that autonomous loop has exhausted all attempts

**Source**: `src/claude/hooks/test-watcher.js:500-510`

---

## AC-IE-008: TEST_CORRIDOR Enforcement [CRITICAL]

**Given** tests are failing (last_test_result="failed", not completed, not escalated)
**When** an agent attempts to delegate (Task) or advance gate (Skill)
**Then** iteration-corridor blocks the action
**And** outputs error with: current iteration count, max iterations, last error, last command
**And** allows all other tool calls (file edits, reads, etc.)

**Source**: `src/claude/hooks/iteration-corridor.js:93-117, 272-296`

---

## AC-IE-009: CONST_CORRIDOR Enforcement [HIGH]

**Given** tests have passed but constitutional validation is pending or in progress
**When** an agent attempts to delegate or advance
**Then** iteration-corridor blocks the action
**And** outputs error with: article list, validation status, iteration count
**And** allows non-advancement actions

**Source**: `src/claude/hooks/iteration-corridor.js:125-158, 299-324`

---

## AC-IE-010: Corridor State Determination [HIGH]

**Given** the iteration-corridor checks the current state
**When** determining which corridor is active
**Then** it evaluates in priority order:
  1. TEST_CORRIDOR: tests failing AND not completed AND not escalated
  2. CONST_CORRIDOR: tests satisfied AND constitutional validation is enabled AND (not started OR in progress AND not escalated)
  3. NONE: no active iteration
**And** CONST_CORRIDOR only activates after test requirement is fully satisfied

**Source**: `src/claude/hooks/iteration-corridor.js:93-158`

---

## AC-IE-011: Interactive Elicitation Requirement [HIGH]

**Given** Phase 01 has interactive_elicitation enabled
**When** gate advancement is checked
**Then** gate-blocker validates:
  - Elicitation state exists and is completed
  - If required_final_selection is configured, final selection matches one of the valid options
**And** blocks with "Interactive elicitation not started" if never initiated

**Source**: `src/claude/hooks/gate-blocker.js:275-313`

---

## AC-IE-012: Menu Interaction Tracking [HIGH]

**Given** a PostToolUse result contains A/R/C menu patterns
**When** menu-tracker processes it
**Then** it detects menu presentations (needs 2+ pattern matches)
**And** detects user selections: adjust, refine, continue, save, exit
**And** detects step completions: 7 numbered steps + named step patterns
**And** updates elicitation state in state.json with interaction counts

**Source**: `src/claude/hooks/menu-tracker.js:26-116, 118-261`

---

## AC-IE-013: Save Selection Completes Elicitation [HIGH]

**Given** the user selects "Save" during elicitation
**When** menu-tracker processes the selection
**Then** it sets completed=true, final_selection="save", completed_at timestamp
**And** outputs message: "INTERACTIVE ELICITATION COMPLETED" with interaction count

**Source**: `src/claude/hooks/menu-tracker.js:207-217`

---

## AC-IE-014: Agent Delegation Validation [HIGH]

**Given** a phase has agent_delegation_validation enabled
**When** gate advancement is checked
**Then** gate-blocker:
  - Loads the skills manifest to find which agent owns the current phase
  - Searches skill_usage_log for entries with that agent and phase
  - Blocks if no delegation was logged, with message naming the expected agent
**And** fails-open if manifest is missing or phase has no assigned agent

**Source**: `src/claude/hooks/gate-blocker.js:319-362`

---

## AC-IE-015: ATDD Skipped Test Detection [HIGH]

**Given** ATDD mode is active (state.active_workflow.atdd_mode=true)
**When** tests pass and test-watcher checks output
**Then** it detects skipped tests from: Jest "N skipped", pytest "N skipped", Mocha "N pending"
**And** extracts individual skipped test names from output
**And** warns that skipped tests are NOT allowed at gate in ATDD mode
**And** stores skip details in atdd_validation state

**Source**: `src/claude/hooks/test-watcher.js:243-290, 442-460`

---

## AC-IE-016: Post-Gate Cloud Config Trigger [MEDIUM]

**Given** a phase has on_gate_pass.trigger_cloud_config enabled
**When** all gate checks pass
**Then** gate-blocker checks if cloud provider is "undecided"
**And** if so, writes a pending_triggers entry for "cloud_configuration"
**And** the orchestrator picks up the trigger to prompt the user

**Source**: `src/claude/hooks/gate-blocker.js:521-544`

---

## AC-IE-017: Escalation Approval Gate [MEDIUM]

**Given** a test iteration or constitutional validation has been escalated
**When** gate advancement is checked
**Then** gate-blocker checks for escalation_approved flag
**And** blocks if escalated but not approved (requires human decision)
**And** allows if escalation_approved=true

**Source**: `src/claude/hooks/gate-blocker.js:202-215, 249-259`

---

## AC-IE-018: Constitutional Validation Initialization [MEDIUM]

**Given** constitution-validator detects a phase completion attempt
**When** constitutional validation has not been started
**Then** it initializes tracking state with:
  - required: true, completed: false, status: "pending"
  - iterations_used: 0, max_iterations from config
  - articles_required, articles_checked: [], violations_found: []
  - started_at timestamp
**And** blocks the completion with a checklist of required articles

**Source**: `src/claude/hooks/constitution-validator.js:171-191, 280-315`
