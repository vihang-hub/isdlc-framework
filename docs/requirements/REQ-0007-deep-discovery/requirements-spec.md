# Requirements Specification: Deep Discovery

**ID**: REQ-0007
**Type**: Feature
**Status**: Draft
**Created**: 2026-02-09
**Artifact Folder**: REQ-0007-deep-discovery

---

## 1. Overview

Unify the `/discover` command under a single `--deep` flag that replaces both `--party` and `--classic`. Both new and existing project flows use the deep discovery model with multi-agent debate rounds. The classic sequential flow is removed entirely. Existing project discovery gains four new specialist agents (Security Auditor, Technical Debt Auditor, Performance Analyst, Ops Readiness Reviewer) and structured debate rounds for cross-domain validation. Two depth levels (`standard` and `full`) control the number of debate rounds.

---

## 2. Functional Requirements

### REQ-001: Unified --deep Flag

**Description**: Replace `--party` and `--classic` flags with a single `--deep` flag that accepts an optional depth level.

**Acceptance Criteria**:
- AC-1: `/discover --deep` runs standard depth (default)
- AC-2: `/discover --deep standard` runs standard depth explicitly
- AC-3: `/discover --deep full` runs full depth
- AC-4: `/discover --party` produces an error message: "The --party flag has been replaced by --deep. Use /discover --deep [standard|full]"
- AC-5: `/discover --classic` produces an error message: "The --classic flag has been removed. /discover now uses deep discovery by default."
- AC-6: `/discover` with no flags auto-detects project type and defaults to `--deep standard`

### REQ-002: Auto-Detection with Confirmation

**Description**: When `/discover` is invoked without `--new` or `--existing`, auto-detect the project type and confirm with the user before proceeding.

**Acceptance Criteria**:
- AC-7: Auto-detection checks for existing code indicators (src/, lib/, app/, package.json, requirements.txt, etc.)
- AC-8: Detected project type is presented to the user with a confirmation prompt: "Detected: [new/existing] project. Proceed? [Y/N/Switch]"
- AC-9: User can switch the detected type (e.g., override "existing" to "new" for a fresh start)
- AC-10: If `--new` or `--existing` is explicitly passed, skip auto-detection and confirmation

### REQ-003: Existing Project Agents (Standard Depth)

**Description**: Add Security Auditor and Technical Debt Auditor to the existing project discovery flow, running in parallel with D1-D6.

**Acceptance Criteria**:
- AC-11: Security Auditor agent (D16) runs in parallel with D1, D2, D5, D6 during Phase 1 analysis
- AC-12: Security Auditor scans for: dependency vulnerabilities, secret exposure, auth patterns, input validation gaps, OWASP Top 10 risks
- AC-13: Security Auditor outputs `security-posture.md` with severity-rated findings
- AC-14: Technical Debt Auditor agent (D17) runs in parallel with D1, D2, D5, D6 during Phase 1 analysis
- AC-15: Technical Debt Auditor scans for: code duplication, complexity hotspots, deprecated APIs, missing error handling, stale dependencies, anti-patterns
- AC-16: Technical Debt Auditor outputs `technical-debt-report.md` with prioritized remediation recommendations
- AC-17: Standard depth runs 8 agents in parallel: D1, D2, D5, D6, D16, D17 + (existing D3, D4 in later phases)

### REQ-004: Existing Project Agents (Full Depth)

**Description**: Add Performance Analyst and Ops Readiness Reviewer for full-depth discovery.

**Acceptance Criteria**:
- AC-18: Performance Analyst agent (D18) runs in parallel during Phase 1 analysis (full depth only)
- AC-19: Performance Analyst evaluates: response time patterns, memory/CPU profiling hooks, caching strategy, database query patterns, N+1 queries, bundle sizes
- AC-20: Performance Analyst outputs `performance-analysis.md` with optimization recommendations
- AC-21: Ops Readiness Reviewer agent (D19) runs in parallel during Phase 1 analysis (full depth only)
- AC-22: Ops Readiness Reviewer evaluates: logging adequacy, health check endpoints, graceful shutdown, configuration management, environment variable handling, monitoring hooks
- AC-23: Ops Readiness Reviewer outputs `ops-readiness-report.md` with readiness score and gap list
- AC-24: Full depth runs 10 agents in parallel: D1, D2, D5, D6, D16, D17, D18, D19 + (D3, D4 in later phases)

### REQ-005: Debate Rounds (Existing Project - Standard)

**Description**: After parallel analysis completes, run 3 structured debate rounds where agents cross-validate findings.

**Acceptance Criteria**:
- AC-25: Round 1 (Architecture + Security + Ops): D1, D16, D19 (or D1, D16 if standard) cross-review each other's findings. Architecture validates security recommendations are architecturally feasible; Security validates architecture has no security blind spots.
- AC-26: Round 2 (Data + Testability + Architecture): D5, D2, D1 cross-review. Data model validated against test coverage gaps; Test evaluator validates data access patterns are testable.
- AC-27: Round 3 (Behavior + Security + Coverage): D6, D16, D2 cross-review. Behavior extraction validated against security concerns; Security validates feature-level access control; Test coverage validated against extracted behaviors.
- AC-28: Each debate round produces a `debate-round-N-synthesis.md` artifact with agreements, disagreements, and resolutions
- AC-29: Debate rounds are sequential (round 1 must complete before round 2 begins)

### REQ-006: Debate Rounds (Existing Project - Full)

**Description**: Full depth adds 2 additional debate rounds plus cross-review.

**Acceptance Criteria**:
- AC-30: Round 4 (Constitution Alignment): All agents cross-check findings against constitution articles. Each agent identifies which constitutional articles their findings impact.
- AC-31: Round 5 (Artifact Completeness): All agents verify that the combined output covers all required discovery dimensions. Identify any blind spots not covered by any agent.
- AC-32: Cross-review: After round 5, each agent reviews one other agent's primary artifact for accuracy and completeness.
- AC-33: Full depth produces 5 debate synthesis artifacts plus a cross-review summary

### REQ-007: New Project Deep Discovery

**Description**: Rename existing `--party` mode to `--deep` for new projects. Same party mode flow (Nadia, Oscar, Tessa, Liam, Zara, Felix) with standard/full depth levels.

**Acceptance Criteria**:
- AC-34: `--deep standard` for new projects runs 3 debate phases (Vision Council, Stack Debate, Blueprint Assembly) -- same as current party mode phases 1-3
- AC-35: `--deep full` for new projects runs 5 debate phases (above 3 + Constitution Alignment + Artifact Completeness) -- same as party phases 1-5
- AC-36: Named personas (Nadia, Oscar, Tessa, Liam, Zara, Felix) are preserved for new projects
- AC-37: party-personas.json is reused as-is for new project deep discovery

### REQ-008: Existing Project Personas (Role-Only)

**Description**: Existing project agents use role-only identification (no character names).

**Acceptance Criteria**:
- AC-38: Security Auditor, Technical Debt Auditor, Performance Analyst, Ops Readiness Reviewer use title-only identification in all output
- AC-39: No persona `name` field in discovery config for existing-project agents (or name equals title)
- AC-40: Existing agents D1-D6 continue to use their existing agent names (architecture-analyzer, test-evaluator, etc.)

### REQ-009: Debate Visibility Control

**Description**: Default to final synthesis output. User can toggle to full transcript at runtime.

**Acceptance Criteria**:
- AC-41: By default, only the final synthesis of each debate round is shown to the user
- AC-42: User can request full transcript with `--verbose` flag or by typing "show transcript" during debate
- AC-43: Full transcript shows each agent's position, counter-arguments, and resolution path
- AC-44: Debate transcripts are always saved to disk regardless of visibility setting (for audit trail)

### REQ-010: Discovery Context Envelope Extensions

**Description**: Extend the discovery_context envelope in state.json with new fields from the additional agents.

**Acceptance Criteria**:
- AC-45: `discovery_context.security_posture` added with fields: `risk_level` (low/medium/high/critical), `findings_count`, `critical_count`, `owasp_coverage`
- AC-46: `discovery_context.technical_debt` added with fields: `debt_score` (0-100), `hotspot_count`, `deprecated_api_count`, `remediation_priority` (array of top 5)
- AC-47: `discovery_context.debate_summary` added with fields: `rounds_completed`, `agreements_count`, `disagreements_count`, `resolutions`
- AC-48: Existing envelope fields remain unchanged (additive only)

### REQ-011: Remove Classic Mode

**Description**: Remove the classic sequential flow entirely from both new and existing project paths.

**Acceptance Criteria**:
- AC-49: Mode Selection Menu in new project flow is REMOVED (no classic/party choice)
- AC-50: `--classic` flag parsing removed from discover.md command file
- AC-51: `--party` flag parsing removed from discover.md command file
- AC-52: Orchestrator Step 0 (Mode Selection) removed -- deep discovery is the only mode
- AC-53: All references to "classic mode" removed from orchestrator documentation

### REQ-012: No-Flag Default Behavior

**Description**: `/discover` with no flags auto-detects project type, confirms, and runs `--deep standard`.

**Acceptance Criteria**:
- AC-54: First-time menu still shows [1] New / [2] Existing / [3] Chat options (detection-based recommendation)
- AC-55: After user selects [1] or [2], deep standard runs automatically (no depth menu)
- AC-56: Returning project menu still shows Re-discover / Incremental / Chat options
- AC-57: Re-discover runs deep standard by default

---

## 3. Non-Functional Requirements

### NFR-001: Performance

- All parallel agents MUST complete within the same time as the current 4-agent parallel run (agents are additive, not sequential)
- Debate rounds MUST complete within 3 minutes each (standard) or 5 minutes each (full)
- Total discovery time increase: <=30% for standard depth, <=60% for full depth vs current baseline

### NFR-002: Backward Compatibility

- Not a concern (pre-release framework, no external users)
- Existing party-personas.json structure preserved for new projects
- discovery_context envelope changes are additive only

### NFR-003: Test Regression

- All existing 945 tests MUST continue to pass
- New tests MUST be added for: debate round orchestration, new agent config validation, flag deprecation error messages, discovery_context envelope extensions
- Total test count MUST NOT decrease

### NFR-004: Constitutional Compliance

- Article VIII (Documentation Currency): All agent .md files, AGENTS.md, README.md, discover.md command file MUST be updated
- Article XIII (Module System): New agents are markdown-only (no hook/code changes expected)
- Article XIV (State Management): discovery_context envelope extensions MUST be backward-compatible

---

## 4. User Stories

### US-001: Discover an Existing Project with Security Audit

**As a** developer with an existing codebase,
**I want to** run `/discover` and get security findings alongside architecture analysis,
**So that** I know my security posture before starting feature development.

**Acceptance Criteria**: AC-7, AC-8, AC-11, AC-12, AC-13, AC-25, AC-41

### US-002: Deep Discovery with Full Debate

**As a** tech lead for an existing project,
**I want to** run `/discover --deep full` to get comprehensive cross-validated analysis,
**So that** I have high confidence in the discovery findings before defining the constitution.

**Acceptance Criteria**: AC-3, AC-18, AC-19, AC-20, AC-21, AC-22, AC-23, AC-24, AC-30, AC-31, AC-32, AC-33

### US-003: New Project with Deep Discovery

**As a** developer starting a new project,
**I want to** run `/discover --new` and automatically get the party mode experience,
**So that** I get multi-perspective input without choosing between classic and party.

**Acceptance Criteria**: AC-6, AC-34, AC-35, AC-36, AC-49, AC-52

### US-004: Review Debate Transcripts

**As a** developer reviewing discovery output,
**I want to** toggle between synthesis and full transcript views,
**So that** I can drill into specific debate points when needed.

**Acceptance Criteria**: AC-41, AC-42, AC-43, AC-44

### US-005: Discover with Technical Debt Awareness

**As a** developer inheriting a codebase,
**I want to** see technical debt findings alongside functional analysis,
**So that** I can prioritize remediation alongside new feature development.

**Acceptance Criteria**: AC-14, AC-15, AC-16, AC-26, AC-46

---

## 5. Constraints

### C-001: No New Runtime Dependencies

All new agents are markdown-only definitions. No new npm packages or runtime code changes required for agent definitions.

### C-002: Existing Agent Behavior Unchanged

D1 (architecture-analyzer), D2 (test-evaluator), D5 (data-model-analyzer), D6 (feature-mapper) continue to produce the same outputs. New agents are additive.

### C-003: Party Personas Preserved

The named personas (Nadia, Oscar, Tessa, Liam, Zara, Felix) and party-personas.json are preserved for new project flows. No renaming or restructuring of existing persona config.

### C-004: Pre-Release Framework

This is a pre-release framework (0.1.0-alpha). No backward compatibility with external users is required.

---

## 6. Out of Scope

- Debate rounds for fix workflows (only discovery)
- Interactive debate participation by the user during rounds (user observes synthesis only)
- LLM-provider-specific debate optimizations
- Real-time streaming of debate messages to the user (batch synthesis only)
- Adding new agents to the SDLC phase workflow (this only affects /discover)

---

## 7. Glossary

| Term | Definition |
|------|-----------|
| Deep Discovery | Multi-agent analysis with structured debate rounds |
| Standard Depth | 3 debate rounds, 8 agents (existing) or 6 personas (new) |
| Full Depth | 5 debate rounds + cross-review, 10 agents (existing) or all personas (new) |
| Debate Round | Structured cross-validation where 2-3 agents review each other's findings |
| Synthesis | Merged summary of a debate round's agreements, disagreements, and resolutions |
| Transcript | Full unedited record of agent positions and counter-arguments in a debate |
| Role-Only Persona | Agent identified by title only (e.g., "Security Auditor") with no character name |
