# Requirements Specification: Unified SessionStart Cache

**Requirement ID**: REQ-0001
**Feature**: Unified SessionStart cache -- eliminate ~200+ static file reads per workflow
**Source**: GitHub Issue #91
**Absorbed Issues**: #86 (manifest cleanup), #89 (external manifest source field)
**Status**: Draft
**Priority**: Must Have
**Created**: 2026-02-23
**Phase**: 01-requirements

---

## 1. Project Overview

### 1.1 Problem Statement

A single 9-phase feature workflow triggers **200-340 reads of static files** that never change during execution. Skills, constitution, configuration, persona definitions, and topic definitions are re-read from disk at every phase transition and agent delegation, adding cumulative latency across the workflow.

| Static Content | Reads per Workflow | Approx. Size per File |
|---|---|---|
| SKILL.md files (index construction) | 94-114 | ~2-5 KB each |
| workflows.json | 25-30 | 11 KB |
| iteration-requirements.json | 19-20 | 18 KB |
| constitution.md | ~18 | 15 KB |
| skills-manifest.json | 9 | 36 KB |
| artifact-paths.json | 9 | 793 B |
| external-skills-manifest.json | 9 | varies |
| Persona files (3 agents) | 3-6 | ~23 KB total |
| Topic files (6 analysis topics) | 7-14 | ~24 KB total |

### 1.2 Proposed Solution

Create a **unified SessionStart cache** (`.isdlc/session-cache.md`) that pre-loads all static framework content into the LLM context at session start. A SessionStart hook reads this pre-assembled file and outputs it to stdout, where Claude Code automatically loads it into the model context. All downstream consumers (phase-loop controller, roundtable dispatch) reference the cached content from session context rather than reading individual files, failing open to disk reads when the cache is absent.

### 1.3 Success Metrics

- SM-001: Static file reads per 9-phase workflow reduced from ~200-340 to <10 (fallback-only)
- SM-002: Roundtable first-response time reduced from ~5 minutes to <1 minute
- SM-003: Zero regressions in existing workflow behavior (all phases produce identical artifacts)

### 1.4 Constraints

- CON-001: Context window budget must not exceed ~128K characters total for the cache file
- CON-002: Cache file must reside in `.isdlc/` (already gitignored -- no secrets or generated content in version control)
- CON-003: Hook must use CommonJS (`.cjs` extension) per project conventions (Node 24+ with `"type": "module"` in package.json)
- CON-004: SessionStart hook must use startup/resume matchers, NOT compact matchers (bug #15174 avoidance)
- CON-005: All consumer changes must fail-open to disk reads when cache is absent -- zero hard dependencies on the cache

### 1.5 Assumptions

- ASM-001: Claude Code's SessionStart hook mechanism writes stdout content into the LLM context window before any user interaction
- ASM-002: The ~128K character budget fits within the model's context window alongside other session content (CLAUDE.md, settings, etc.)
- ASM-003: Static files do not change during a single workflow execution (no mid-workflow config edits)
- ASM-004: The `path_lookup` and `skill_paths` fields in skills-manifest.json are unused by runtime hooks (safe to remove per #86)
- ASM-005: mtime-based staleness detection is sufficient for cache invalidation (no need for content hashing)

### 1.6 Out of Scope

- OOS-001: Dynamic content caching (state.json, per-workflow artifacts)
- OOS-002: Cache compression or binary format (plain Markdown is sufficient)
- OOS-003: Multi-project cache isolation in monorepo mode (future enhancement)
- OOS-004: Automatic cache rebuild on file change detection (file watchers)
- OOS-005: Cache encryption or access control

---

## 2. Stakeholders and Personas

### 2.1 Primary Persona: Framework Developer

- **Role**: Developer using the iSDLC framework for daily development workflows
- **Goals**: Fast phase transitions, minimal latency between phases, reliable workflow execution
- **Pain Points**: Noticeable delays at each phase transition from redundant file I/O; roundtable analysis cold-start takes ~5 minutes
- **Key Tasks**: Running feature workflows, fix workflows, roundtable analysis

### 2.2 Secondary Persona: Framework Maintainer

- **Role**: Developer maintaining and extending the iSDLC framework itself
- **Goals**: Clean architecture, easy debugging, reliable hook system
- **Pain Points**: Difficulty tracing which files are read when, debugging slow phases
- **Key Tasks**: Adding new skills, registering hooks, updating configuration, running `/discover`

---

## 3. Functional Requirements

### FR-001: Cache Builder Function

**Description**: Implement `rebuildSessionCache()` in `src/claude/hooks/lib/common.cjs` that assembles all static framework content into a single cache file.

**Priority**: Must Have

**Acceptance Criteria**:

- AC-001-01: Given the framework is installed with a valid `.isdlc/` directory, when `rebuildSessionCache()` is called, then it reads all static source files (constitution, workflows.json, iteration-requirements.json, artifact-paths.json, skills-manifest.json, external-skills-manifest.json, skill SKILL.md files, persona agent files, topic files) and assembles them into `.isdlc/session-cache.md`.

- AC-001-02: Given `rebuildSessionCache()` is assembling the cache, when it writes the output file, then the file contains clearly delimited sections: CONSTITUTION, WORKFLOW CONFIG, ITERATION REQUIREMENTS, ARTIFACT PATHS, SKILL INDEX BY AGENT (pre-built per-agent skill index blocks), EXTERNAL SKILLS (all-phase and phase-specific), and ROUNDTABLE CONTEXT (persona files and topic files).

- AC-001-03: Given `rebuildSessionCache()` is assembling the cache, when it writes the output file, then a header comment is included with: generation timestamp, source file count, and a source hash computed from input file mtimes for stale detection.

- AC-001-04: Given one or more source files are missing (e.g., no external-skills-manifest.json, no persona files), when `rebuildSessionCache()` runs, then it skips the missing section(s) gracefully and still produces a valid cache file containing the available sections.

- AC-001-05: Given `rebuildSessionCache()` completes successfully, when the cache file is measured, then the total size does not exceed ~128K characters (the context window budget).

### FR-002: SessionStart Hook

**Description**: Implement `inject-session-cache.cjs` as a SessionStart hook that reads the cache file and outputs its content to stdout for LLM context injection.

**Priority**: Must Have

**Acceptance Criteria**:

- AC-002-01: Given `.isdlc/session-cache.md` exists and is readable, when the SessionStart hook fires (on session startup or resume), then the hook reads the file and outputs its full content to stdout.

- AC-002-02: Given `.isdlc/session-cache.md` does NOT exist, when the SessionStart hook fires, then the hook produces no output, no error, and exits with code 0 (fail-open behavior).

- AC-002-03: Given `.isdlc/session-cache.md` exists but is unreadable (permissions error), when the SessionStart hook fires, then the hook produces no output, no error on stdout, and exits with code 0 (fail-open behavior).

- AC-002-04: Given the hook is registered in `settings.json`, when the registration entry is inspected, then the matcher uses startup/resume patterns (NOT the compact matcher) to avoid bug #15174.

- AC-002-05: Given the hook runs, when execution time is measured, then the hook completes within the configured timeout (5000ms).

### FR-003: Hook Registration

**Description**: Register the SessionStart hook in `src/claude/settings.json` so Claude Code invokes it automatically at session start.

**Priority**: Must Have

**Acceptance Criteria**:

- AC-003-01: Given `src/claude/settings.json` is inspected, when the SessionStart hook section is located, then it contains an entry for `inject-session-cache.cjs` with a command path of `node $CLAUDE_PROJECT_DIR/.claude/hooks/inject-session-cache.cjs`.

- AC-003-02: Given the hook registration, when the matcher configuration is inspected, then it uses startup/resume matchers (NOT compact matcher) per bug #15174 avoidance.

- AC-003-03: Given the hook registration, when the timeout value is inspected, then it is set to 5000ms.

### FR-004: CLI Cache Rebuild Escape Hatch

**Description**: Provide `bin/rebuild-cache.js` as a standalone CLI tool for manually triggering cache rebuilds outside of workflow triggers.

**Priority**: Must Have

**Acceptance Criteria**:

- AC-004-01: Given the developer runs `node bin/rebuild-cache.js` from the project root, when the script executes, then it calls `rebuildSessionCache()` and reports success or failure to stdout.

- AC-004-02: Given the developer runs the script outside a valid iSDLC project (no `.isdlc/` directory), when the script executes, then it prints an error message and exits with a non-zero exit code.

- AC-004-03: Given the developer runs the script, when `rebuildSessionCache()` completes, then the script prints the cache file path and size.

### FR-005: Phase-Loop Controller Consumer Changes

**Description**: Update the phase-loop controller (isdlc.md STEP 3d) to reference static content from the session context (injected at session start) instead of reading files from disk at each phase transition.

**Priority**: Must Have

**Acceptance Criteria**:

- AC-005-01: Given session context contains the CONSTITUTION section from the cache, when the phase-loop controller needs the constitution for delegation, then it references the constitution from session context (zero per-phase disk reads for constitution).

- AC-005-02: Given session context contains the WORKFLOW CONFIG section from the cache, when the phase-loop controller needs workflow definitions, then it references the workflow config from session context.

- AC-005-03: Given session context contains the ITERATION REQUIREMENTS section from the cache, when the phase-loop controller needs iteration requirements, then it references the iteration requirements from session context.

- AC-005-04: Given session context contains the SKILL INDEX BY AGENT section from the cache, when the phase-loop controller needs the pre-built skill index for the current phase agent, then it references the skill index from session context.

- AC-005-05: Given session context contains the EXTERNAL SKILLS sections from the cache, when the phase-loop controller needs external skills for the current phase, then it includes all-phase skills and any phase-specific skills matching the current phase_key from session context.

- AC-005-06: Given session context does NOT contain a cache section (cache was not loaded, or section is absent), when the phase-loop controller needs that content, then it falls back to reading the content from disk (fail-open behavior, identical to current behavior).

### FR-006: Roundtable Consumer Changes

**Description**: Update the roundtable dispatch logic (isdlc.md analyze handler) to reference persona and topic content from session context instead of reading files from disk.

**Priority**: Must Have

**Acceptance Criteria**:

- AC-006-01: Given session context contains the ROUNDTABLE CONTEXT section with persona file content, when the roundtable dispatch needs persona definitions, then it references persona content from session context (zero disk reads for personas).

- AC-006-02: Given session context contains the ROUNDTABLE CONTEXT section with topic file content, when the roundtable dispatch needs analysis topic definitions, then it references topic content from session context (zero disk reads for topics).

- AC-006-03: Given session context does NOT contain the ROUNDTABLE CONTEXT section, when the roundtable dispatch needs persona or topic content, then it falls back to reading files from disk (fail-open, identical to current behavior).

- AC-006-04: Given session context contains the ROUNDTABLE CONTEXT section, when roundtable cold-start time is measured, then first-response time is under 1 minute (down from ~5 minutes).

### FR-007: Cache Rebuild Triggers

**Description**: Integrate automatic cache rebuilds at key mutation points so the cache stays current after structural changes.

**Priority**: Must Have

**Acceptance Criteria**:

- AC-007-01: Given the user completes `/discover`, when discovery finishes successfully, then `rebuildSessionCache()` is called to regenerate the cache with updated content.

- AC-007-02: Given the user runs `/isdlc skill add`, when the skill is successfully registered, then `rebuildSessionCache()` is called to include the new skill in the cache.

- AC-007-03: Given the user runs `/isdlc skill remove`, when the skill is successfully removed, then `rebuildSessionCache()` is called to exclude the removed skill from the cache.

- AC-007-04: Given the user runs `/isdlc skill wire`, when the skill bindings are updated, then `rebuildSessionCache()` is called to reflect the new phase bindings in the cache.

- AC-007-05: Given the user runs `isdlc init` (framework installation), when initialization completes, then `rebuildSessionCache()` is called to build the initial cache.

- AC-007-06: Given the user runs `isdlc update` (framework update), when the update completes, then `rebuildSessionCache()` is called to rebuild the cache with updated framework content.

### FR-008: Manifest Cleanup (Absorbed #86)

**Description**: Remove the unused `path_lookup` and `skill_paths` fields from `src/claude/hooks/config/skills-manifest.json`.

**Priority**: Should Have

**Acceptance Criteria**:

- AC-008-01: Given `skills-manifest.json` is inspected after this change, when the `path_lookup` key is searched for, then it is not present in the file.

- AC-008-02: Given `skills-manifest.json` is inspected after this change, when the `skill_paths` key is searched for, then it is not present in the file.

- AC-008-03: Given the `path_lookup` and `skill_paths` fields are removed, when all existing hooks and validators that reference skills-manifest.json are executed, then they continue to function correctly (no runtime errors from missing fields).

### FR-009: External Manifest Source Field (Absorbed #89)

**Description**: Add a `source` field to external skill manifest entries to track the origin of each skill (discover, skills.sh, or user).

**Priority**: Should Have

**Acceptance Criteria**:

- AC-009-01: Given an external skill is registered via `/discover`, when the manifest entry is written, then it includes `"source": "discover"`.

- AC-009-02: Given an external skill is registered via `skills.sh`, when the manifest entry is written, then it includes `"source": "skills.sh"`.

- AC-009-03: Given an external skill is registered manually by the user, when the manifest entry is written, then it includes `"source": "user"`.

- AC-009-04: Given existing manifest entries without a `source` field, when `rebuildSessionCache()` processes them, then it treats the missing source as `"unknown"` and does not fail.

---

## 4. Non-Functional Requirements

### NFR-001: Performance -- File Read Reduction

**Category**: Performance
**Requirement**: Static file reads per 9-phase feature workflow must be reduced from ~200-340 to <10 (fallback-only reads).
**Metric**: Count of `readFileSync` / `readFile` calls for static content during a full workflow execution.
**Measurement Method**: Instrumented test run comparing before/after read counts.
**Priority**: Must Have

### NFR-002: Performance -- Roundtable Cold-Start

**Category**: Performance
**Requirement**: Roundtable analysis first-response time must be reduced from ~5 minutes to <1 minute.
**Metric**: Wall-clock time from roundtable dispatch to first substantive response.
**Measurement Method**: Timed execution of roundtable analysis with and without cache.
**Priority**: Must Have

### NFR-003: Performance -- Hook Execution Time

**Category**: Performance
**Requirement**: The SessionStart hook must complete within 5000ms.
**Metric**: Execution time of `inject-session-cache.cjs` from invocation to exit.
**Measurement Method**: Process timing via `Date.now()` instrumentation in tests.
**Priority**: Must Have

### NFR-004: Performance -- Cache Build Time

**Category**: Performance
**Requirement**: `rebuildSessionCache()` must complete within 10 seconds on a standard development machine.
**Metric**: Wall-clock time for cache assembly from all source files.
**Measurement Method**: Timed execution of `rebuildSessionCache()` in integration test.
**Priority**: Should Have

### NFR-005: Reliability -- Fail-Open Behavior

**Category**: Reliability
**Requirement**: Every consumer of the cache must fail-open to disk reads when the cache is absent, corrupt, or incomplete. The system must never hard-fail due to a missing cache.
**Metric**: Zero unhandled exceptions when cache file is deleted or corrupted.
**Measurement Method**: Fault injection tests (delete cache, corrupt cache, empty cache) during a full workflow.
**Priority**: Must Have

### NFR-006: Reliability -- Cache Staleness Detection

**Category**: Reliability
**Requirement**: The cache must include a source hash (computed from input file mtimes) so consumers can detect stale caches.
**Metric**: Stale cache is detectable by comparing stored hash against current source file mtimes.
**Measurement Method**: Unit test that modifies a source file and verifies hash mismatch.
**Priority**: Should Have

### NFR-007: Maintainability -- Section Delimiters

**Category**: Maintainability
**Requirement**: Cache sections must use clear, parseable delimiters so consumers can extract individual sections without parsing the entire file.
**Metric**: Each section is extractable via a simple regex or string search.
**Measurement Method**: Unit test that extracts each section by delimiter.
**Priority**: Must Have

### NFR-008: Compatibility -- CommonJS Convention

**Category**: Compatibility
**Requirement**: The SessionStart hook must use `.cjs` extension and CommonJS module format, consistent with all other hooks in the project.
**Metric**: File extension is `.cjs`; `require()` and `module.exports` are used.
**Measurement Method**: Code review and linting.
**Priority**: Must Have

### NFR-009: Context Window Budget

**Category**: Resource Constraint
**Requirement**: The assembled cache file must not exceed ~128K characters to stay within the context window budget.
**Metric**: `session-cache.md` file size in characters.
**Measurement Method**: Automated size check in `rebuildSessionCache()` with warning on threshold breach.
**Priority**: Must Have

### NFR-010: Backwards Compatibility

**Category**: Compatibility
**Requirement**: Existing workflows must continue to function identically when the cache is absent (e.g., on first install before discovery, or if cache build fails).
**Metric**: Full workflow completes successfully with cache file deleted.
**Measurement Method**: End-to-end workflow test with cache removed.
**Priority**: Must Have

---

## 5. Traceability Summary

| Requirement | User Stories | Priority | Epic |
|---|---|---|---|
| FR-001 | US-001, US-002, US-003 | Must Have | Cache Infrastructure |
| FR-002 | US-004, US-005 | Must Have | Cache Infrastructure |
| FR-003 | US-006 | Must Have | Cache Infrastructure |
| FR-004 | US-007 | Must Have | Cache Infrastructure |
| FR-005 | US-008, US-009, US-010, US-011, US-012 | Must Have | Consumer Changes |
| FR-006 | US-013, US-014 | Must Have | Consumer Changes |
| FR-007 | US-015, US-016, US-017 | Must Have | Cache Lifecycle |
| FR-008 | US-018 | Should Have | Manifest Cleanup |
| FR-009 | US-019 | Should Have | Manifest Cleanup |
| NFR-001 | -- | Must Have | Performance |
| NFR-002 | -- | Must Have | Performance |
| NFR-003 | -- | Must Have | Performance |
| NFR-004 | -- | Should Have | Performance |
| NFR-005 | -- | Must Have | Reliability |
| NFR-006 | -- | Should Have | Reliability |
| NFR-007 | -- | Must Have | Maintainability |
| NFR-008 | -- | Must Have | Compatibility |
| NFR-009 | -- | Must Have | Resource Constraint |
| NFR-010 | -- | Must Have | Compatibility |

---

## 6. Glossary

| Term | Definition |
|---|---|
| SessionStart hook | A Claude Code hook type that fires at session startup/resume; stdout is injected into the LLM context window |
| Session context | The LLM's active context window content, including content injected by SessionStart hooks |
| Fail-open | A failure mode where the system continues with degraded functionality (disk reads) rather than halting |
| Cache file | `.isdlc/session-cache.md` -- the pre-assembled static content file |
| Stale cache | A cache file whose source hash does not match the current source file mtimes |
| Source hash | A hash or fingerprint computed from the mtimes of all source files used to build the cache |
| Phase-loop controller | The main orchestration logic in `isdlc.md` that delegates work to phase agents |
| Roundtable dispatch | The analysis handler in `isdlc.md` that delegates to the roundtable-analyst agent with persona and topic context |
| Compact matcher | A SessionStart hook matcher pattern known to cause bug #15174; must be avoided |
| Context window budget | The maximum character count (~128K) allocated for the cache within the LLM context |

---

## 7. File Inventory

### New Files

| File | Purpose |
|---|---|
| `src/claude/hooks/inject-session-cache.cjs` | SessionStart hook -- reads cache, outputs to stdout |
| `bin/rebuild-cache.js` | CLI escape hatch for manual cache rebuilds |

### Modified Files

| File | Change Description |
|---|---|
| `src/claude/hooks/lib/common.cjs` | Add `rebuildSessionCache()` function |
| `src/claude/settings.json` | Register SessionStart hook |
| `src/claude/commands/isdlc.md` | STEP 3d: reference session context for constitution, workflow config, iteration requirements, skill index, external skills; analyze handler: reference persona/topic from session context |
| `src/claude/hooks/config/skills-manifest.json` | Remove `path_lookup` and `skill_paths` fields (#86) |
| `lib/installer.js` | Trigger `rebuildSessionCache()` on init/update |

### Reference Files (Cached Content Sources)

| File | Cache Section |
|---|---|
| `docs/isdlc/constitution.md` | CONSTITUTION |
| `src/isdlc/config/workflows.json` | WORKFLOW CONFIG |
| `.claude/hooks/config/iteration-requirements.json` | ITERATION REQUIREMENTS |
| `.claude/hooks/config/artifact-paths.json` | ARTIFACT PATHS |
| `src/claude/skills/**/SKILL.md` (all skill files) | SKILL INDEX BY AGENT |
| `docs/isdlc/external-skills-manifest.json` + skill files | EXTERNAL SKILLS |
| `src/claude/agents/persona-*.md` (3 files) | ROUNDTABLE CONTEXT (personas) |
| `src/claude/skills/analysis-topics/*/*.md` (6 files) | ROUNDTABLE CONTEXT (topics) |
