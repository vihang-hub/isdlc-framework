# Requirements Specification: REQ-0001 Discover Enhancements

**Feature ID**: REQ-0001
**Title**: Implement /discover Command Enhancements (DE-001 through DE-005)
**Created**: 2026-02-07
**Status**: Approved
**Source**: docs/requirements/discover-enhancements.md (pre-written specification)
**Priority**: High
**Complexity**: Large

---

## 1. Problem Statement

The `/discover` command is the universal entry point for setting up a project with iSDLC. During dogfooding, 5 gaps were identified:

1. **Missing coverage**: The entire agent orchestration layer (36 agents, 8 commands, 229 skills) is invisible to discovery -- only executable JS files are analyzed
2. **No guided experience**: After discovery dumps 6-8 output files, the user gets no walkthrough
3. **Context loss**: When transitioning from `/discover` to `/sdlc` workflows, agents re-analyze everything
4. **Degraded mode exists**: `--shallow` allows incomplete discovery, creating downstream problems
5. **Presentation quality**: Wall-of-text output without visual hierarchy or progress indicators

## 2. Stakeholders

| Stakeholder | Role | Interest |
|-------------|------|----------|
| Framework User | Primary | Better onboarding experience, complete analysis, smooth workflow transitions |
| Phase Agents (01-03) | Internal | Receive structured context without re-scanning |
| Hook System | Internal | Read user-configured iteration limits |

## 3. Enhancement Summary

| ID | Title | Priority | Complexity | Dependencies |
|----|-------|----------|-----------|--------------|
| DE-001 | Extend behavior extraction to markdown files | High | Large | None |
| DE-002 | Post-discovery walkthrough | High | Large | DE-001 |
| DE-003 | Clean handover to /sdlc workflows | Medium | Medium | DE-002 |
| DE-004 | Remove --shallow option | Low | Small | None |
| DE-005 | Review /discover presentation and UX | Medium | Medium | DE-001, DE-002 |

### Absorbed Enhancements

- Former Enhancement #4 (Permission Audit) absorbed into DE-002, Step 2.5
- Former Enhancement #7 (Iteration Awareness) absorbed into DE-002, Step 3.5

## 4. Functional Requirements

### 4.1 DE-004: Remove --shallow Option

**Rationale**: Discovery should always be thorough. Half-discovery creates incomplete picture.

| Req ID | Description | Priority |
|--------|-------------|----------|
| REQ-DE004-01 | Remove `--shallow` from discover.md command options table and examples | Must |
| REQ-DE004-02 | Remove `--shallow` conditional logic from discover-orchestrator.md | Must |
| REQ-DE004-03 | Remove shallow mode behavior from feature-mapper.md | Must |
| REQ-DE004-04 | Remove "(unless `--shallow`)" documentation references | Must |

### 4.2 DE-001: Extend Behavior Extraction to Markdown Files

**Rationale**: Agent orchestration layer is invisible to discovery -- 36 agents, 8 commands, 229 skills are not analyzed.

| Req ID | Description | Priority |
|--------|-------------|----------|
| REQ-DE001-01 | Feature mapper (D6) produces structured agent catalog with agents, commands, skills, delegation graph | Must |
| REQ-DE001-02 | D6 extracts Given/When/Then AC from deterministic markdown behavior (routing, options, sequences, gates, frontmatter) | Must |
| REQ-DE001-03 | New Domain 8 (Agent Orchestration & Command Routing) with ~60-80 AC | Must |
| REQ-DE001-04 | Analyze markdown files from commands/, agents/sdlc/, agents/discover/, agents/tracing/, agents/impact-analysis/, hooks/config/ | Must |
| REQ-DE001-05 | New AC integrated into traceability CSV with source file references | Must |

### 4.3 DE-005: Review /discover Presentation and UX

**Rationale**: Current output is functional but not well-structured for user consumption.

| Req ID | Description | Priority |
|--------|-------------|----------|
| REQ-DE005-01 | Live progress indicators during parallel analysis phase | Should |
| REQ-DE005-02 | Structured summary presentation (dashboard format, not prose) | Must |
| REQ-DE005-03 | AC quality rules: specific inputs, verifiable outputs, error paths, criticality hierarchy | Must |
| REQ-DE005-04 | Improved report structure: executive summary, table architecture, dashboard metrics, numbered action items | Should |

### 4.4 DE-002: Post-Discovery Walkthrough

**Rationale**: User needs guided tour of discovery outputs, not a file dump.

| Req ID | Description | Priority |
|--------|-------------|----------|
| REQ-DE002-01 | Walkthrough phase added to discover orchestrator after analysis/extraction phases | Must |
| REQ-DE002-02 | Step 1: Constitution Review (mandatory, article-by-article, modify/remove/add) | Must |
| REQ-DE002-03 | Step 2: Architecture & Tech Stack Review (opt-in) | Should |
| REQ-DE002-04 | Step 2.5: Permission Audit (opt-in, tech-stack-to-permissions mapping) | Should |
| REQ-DE002-05 | Step 3: Test Coverage Gaps Review (opt-in) | Should |
| REQ-DE002-06 | Step 3.5: Iteration Configuration (opt-in, stored in state.json iteration_config) | Should |
| REQ-DE002-07 | Step 4: Smart Next Steps (mandatory, context-aware menu based on project type and coverage) | Must |

### 4.5 DE-003: Clean Handover from /discover to /sdlc Workflows

**Rationale**: Context is lost when transitioning between commands.

| Req ID | Description | Priority |
|--------|-------------|----------|
| REQ-DE003-01 | Discovery writes discovery_context envelope to state.json on completion | Must |
| REQ-DE003-02 | SDLC orchestrator reads discovery_context and injects into phase agent delegations | Must |
| REQ-DE003-03 | Phase agents 01-04 receive pre-filled context from envelope | Must |
| REQ-DE003-04 | Staleness check: warn if discovery_context > 24 hours old | Must |
| REQ-DE003-05 | Graceful degradation: workflows proceed normally if no discovery_context | Must |

## 5. Non-Functional Requirements

| NFR ID | Category | Requirement | Threshold |
|--------|----------|-------------|-----------|
| NFR-001 | Compatibility | All changes must maintain Article XIII (ESM/CJS module boundaries) | No ESM in hooks |
| NFR-002 | State Integrity | State schema changes must be backward-compatible (Article XIV) | No breaking changes |
| NFR-003 | Fail-Open | Hooks must fail-open on errors (Article X) | exit 0 on error |
| NFR-004 | Testing Baseline | Total test count must not decrease below 555 (Article II) | >= 555 tests |
| NFR-005 | Cross-Platform | Hook changes must work on macOS, Linux, Windows (Article XII) | path.join() |

## 6. Acceptance Criteria (Complete)

### DE-004 (3 AC)
- AC-DE004-1: --shallow not listed in discover command options
- AC-DE004-2: Behavior extraction runs automatically without --shallow
- AC-DE004-3: No conditional logic references --shallow in orchestrator

### DE-001 (5 AC)
- AC-DE001-1: agent-catalog.md produced with all agents, commands, skills, relationships
- AC-DE001-2: Given/When/Then AC extracted for deterministic routing rules
- AC-DE001-3: AC extracted for agent YAML frontmatter (phase/skill mapping)
- AC-DE001-4: No AC extracted for pure prompt instructions
- AC-DE001-5: Domain 8 AC added to index and traceability CSV

### DE-005 (5 AC)
- AC-DE005-1: 1-line summary displayed per agent as analysis completes
- AC-DE005-2: Structured table/dashboard format for summary
- AC-DE005-3: Generic AC inputs rewritten with specifics
- AC-DE005-4: Report starts with <=5-line executive summary
- AC-DE005-5: Hook enforcement AC classified as Critical priority

### DE-002 (7 AC)
- AC-DE002-1: Constitution Review presented and cannot be skipped
- AC-DE002-2: Constitution.md updated in-place when user requests changes
- AC-DE002-3: Permission audit recommends npm/npx commands for Node.js
- AC-DE002-4: Iteration config saved to state.json with user values
- AC-DE002-5: Low coverage leads with test generation recommendation
- AC-DE002-6: /sdlc start NOT offered for existing projects
- AC-DE002-7: /sdlc start IS offered for new projects

### DE-003 (4 AC)
- AC-DE003-1: state.json contains discovery_context after discovery completes
- AC-DE003-2: Phase 01 receives tech stack from context without re-prompting
- AC-DE003-3: Staleness warning shown when context > 24 hours old
- AC-DE003-4: Workflow proceeds normally when no discovery_context exists

## 7. Implementation Order

```
DE-004 (Remove --shallow)          <- Quick win, no dependencies
    |
DE-001 (MD extraction)             <- Foundation for catalog + new domain
    |
DE-005 (Presentation & UX)         <- Improves how DE-001 output is displayed
    |
DE-002 (Post-discovery walkthrough) <- Builds on all above outputs
    |
DE-003 (Clean handover)            <- Uses walkthrough's user selection
```

## 8. Files Impacted

| File | Enhancements | Change Type |
|------|-------------|-------------|
| `src/claude/commands/discover.md` | DE-004, DE-002 | Modify |
| `src/claude/agents/discover-orchestrator.md` | DE-001,002,003,004,005 | Modify (major) |
| `src/claude/agents/discover/feature-mapper.md` | DE-001,004,005 | Modify |
| `src/claude/agents/00-sdlc-orchestrator.md` | DE-003 | Modify |
| `src/claude/hooks/iteration-corridor.js` | DE-002 | Modify |
| `src/claude/hooks/test-watcher.js` | DE-002 | Modify |
| `src/claude/commands/sdlc.md` | DE-004 | Modify (minor) |
| `src/claude/agents/discover/characterization-test-generator.md` | DE-004 | Modify (minor) |
| `docs/requirements/reverse-engineered/index.md` | DE-001,004 | Modify |
| `docs/architecture/agent-catalog.md` | DE-001 | New |
| `docs/requirements/reverse-engineered/domain-08-agent-orchestration.md` | DE-001 | New |

## 9. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Discover orchestrator too large after changes | Medium | Medium | Keep each enhancement's additions modular with clear section headers |
| Hook CJS changes break module boundary | High | Low | Test in temp dir per Article XIII |
| State schema backward compatibility | High | Low | Add new fields only, never remove/rename |
| --shallow removal breaks existing users | Low | Very Low | Flag existed for 1 day only |

## 10. Traceability

| Source | Target |
|--------|--------|
| docs/requirements/discover-enhancements.md | This spec (formalized) |
| This spec | Architecture (Phase 02) |
| Each AC | Test cases (Phase 05) |
| Each REQ | Implementation (Phase 06) |
