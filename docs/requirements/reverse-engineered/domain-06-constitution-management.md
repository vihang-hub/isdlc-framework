# Domain 06: Constitution Management

**Source Files**: `src/claude/hooks/constitution-validator.js`, `lib/installer.js` (generateConstitution), `docs/isdlc/constitution.md`
**AC Count**: 8
**Priority**: 2 Critical, 4 High, 2 Medium

---

## AC-CM-001: Phase Completion Interception [CRITICAL]

**Given** a Task tool call contains phase completion keywords
**When** constitution-validator intercepts it
**Then** it detects completion attempts via 10 patterns:
  - "phase complete/done/finished"
  - "ready for gate", "gate validation"
  - "submit for review", "finalize artifacts"
  - "declare complete", "mark as complete"
  - "phase N complete", "implementation/testing/requirements complete"
**And** setup commands bypass the check entirely

**Source**: `src/claude/hooks/constitution-validator.js:31-108`

---

## AC-CM-002: Constitutional Validation Status Check [CRITICAL]

**Given** constitutional validation is enabled for the current phase
**When** a phase completion is attempted
**Then** it checks status in priority order:
  - not started -> block, require START_VALIDATION
  - in progress (iterating/pending/not completed) -> block, require CONTINUE_VALIDATION
  - escalated without approval -> block, require AWAIT_APPROVAL
  - escalated with approval -> allow
  - compliant and completed -> allow
  - unknown status -> block, require REVALIDATE

**Source**: `src/claude/hooks/constitution-validator.js:113-166`

---

## AC-CM-003: Constitutional Validation Loop Message [HIGH]

**Given** constitutional validation blocks a phase completion
**When** the blocking message is generated
**Then** it includes:
  - Current validation status
  - MANDATORY instructions for the agent to follow
  - Checklist of required articles with human-readable descriptions
  - JSON schema for updating state.json with results
  - Iteration count (used/max) and remaining attempts

**Source**: `src/claude/hooks/constitution-validator.js:279-312`

---

## AC-CM-004: Article Description Mapping [HIGH]

**Given** articles need human-readable descriptions
**When** getArticleDescriptions() is called
**Then** it maps 12 article numbers to descriptions:
  - I: Specification Primacy
  - II: Test-First Development
  - III: Security by Design
  - IV: Explicit Over Implicit
  - V: Simplicity First
  - VI: Code Review Required
  - VII: Artifact Traceability
  - VIII: Documentation Currency
  - IX: Quality Gate Integrity
  - X: Fail-Safe Defaults
  - XI: Integration Testing Integrity
  - XII: Domain-Specific Compliance

**Source**: `src/claude/hooks/constitution-validator.js:196-210`

---

## AC-CM-005: Starter Constitution Generation [HIGH]

**Given** the installer creates a new project
**When** generateConstitution() is called
**Then** it generates a starter template with:
  - CONSTITUTION_STATUS: STARTER_TEMPLATE marker
  - Status: "NEEDS CUSTOMIZATION" warning
  - 5 generic articles (I-V) and V (Quality Gate Integrity)
  - Customization notes for compliance, performance, accessibility
  - Constitution version 1.0.0

**Source**: `lib/installer.js:569-678`

---

## AC-CM-006: Constitution Path Resolution [HIGH]

**Given** a hook needs to find the constitution
**When** resolveConstitutionPath() is called
**Then** it checks locations in priority order:
  - Monorepo project-specific: docs/isdlc/projects/{id}/constitution.md
  - Monorepo legacy: .isdlc/projects/{id}/constitution.md
  - Single-project new: docs/isdlc/constitution.md
  - Single-project legacy: .isdlc/constitution.md
**And** defaults to the new location for creation

**Source**: `src/claude/hooks/lib/common.js:201-236`

---

## AC-CM-007: Constitution Staleness Detection [MEDIUM]

**Given** the doctor command checks constitution health
**When** it reads the constitution file
**Then** it checks for "STARTER_TEMPLATE" marker in the content
**And** warns "Needs customization (run /discover)" if the marker is present
**And** reports "Customized" if the marker is absent

**Source**: `lib/doctor.js:112-121`

---

## AC-CM-008: Constitutional Validation Tracking Initialization [MEDIUM]

**Given** a phase completion is blocked because validation has not started
**When** constitution-validator initializes tracking
**Then** it creates state at phases.{phase}.constitutional_validation with:
  - required: true, completed: false, status: "pending"
  - iterations_used: 0, max_iterations: from config
  - articles_required: from phase config
  - articles_checked: [], violations_found: [], history: []
  - started_at: ISO timestamp

**Source**: `src/claude/hooks/constitution-validator.js:171-191`
