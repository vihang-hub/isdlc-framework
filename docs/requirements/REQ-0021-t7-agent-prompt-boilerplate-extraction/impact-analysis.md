# Impact Analysis: T7 Agent Prompt Boilerplate Extraction

**Generated**: 2026-02-17T09:30:00Z
**Feature**: Extract duplicated ROOT RESOLUTION, MONOREPO, ITERATION, and GIT COMMIT protocols from agent files to CLAUDE.md
**Based On**: Phase 01 Requirements (finalized) - REQ-0021
**Phase**: 02-impact-analysis

---

## Scope Comparison

| Aspect | Original (Phase 00 Quick-Scan) | Clarified (Phase 01 Requirements) |
|--------|-------------------------------|-----------------------------------|
| Description | Extract duplicated protocols from 17 agents | Extract 4 boilerplate categories from 28 files, with 3 monorepo variants and agent-specific iteration customization |
| Agents Affected | 17 agents | 28 files (26 agents + CLAUDE.md + quality-loop separate listing) |
| Monorepo Variants | None detected (all identical) | 3 variants: full delegation (18), short analysis (7), orchestrator-specific (2) |
| Iteration Agents | 4 agents (identical sections) | 7 agents with agent-specific success criteria and max iteration counts |
| Git Commit Warning | 2 agents (05, 06) | 2 agents (05, 16) -- corrected target |
| CLAUDE.md Size Budget | Not specified | Max +120 lines (NFR-006) |
| Estimated Duplicated Lines | ~250+ | ~255+ (verified via grep) |
| Scope Change | -- | EXPANDED |

---

## Executive Summary

This feature is a **pure refactoring task** affecting **29 files** (1 CLAUDE.md + 28 agent markdown files) with **zero functional behavior change**. The blast radius is contained entirely within `src/claude/agents/` and the project root `CLAUDE.md` -- no hooks, skills, CLI, config, or test files are modified. The refactoring extracts 4 categories of duplicated boilerplate (monorepo mode guidance, iteration enforcement, git commit prohibition, root/project context resolution) into shared sections in CLAUDE.md, replacing inline copies with 1-line references. The primary risk is content equivalence: ensuring every agent retains access to semantically identical protocol content via CLAUDE.md inheritance. Since Claude Code automatically loads CLAUDE.md into every agent context, the extraction pattern is proven (T2 already did this for 3 protocols).

**Blast Radius**: MEDIUM (29 files, but all markdown -- no executable code changes)
**Risk Level**: LOW (proven extraction pattern, pure refactoring, no hooks/tests/CLI affected)
**Affected Files**: 29 total (1 CLAUDE.md + 28 agent .md files)
**Affected Modules**: 2 (CLAUDE.md shared protocols section, src/claude/agents/)

---

## Impact Analysis (M1)

### Direct File Impact by Requirement

#### FR-001 + FR-002: Monorepo Mode Protocol -- Full Delegation Variant (18 files)

**CLAUDE.md** receives a new "Monorepo Mode Protocol" subsection (~6-8 lines).

**18 agent files** have their inline blockquote removed and replaced with a 1-line reference:

| File | Current Lines | Lines Removed | Lines Added | Net Change |
|------|--------------|---------------|-------------|------------|
| `src/claude/agents/02-solution-architect.md` (744 lines) | 1 blockquote (3 lines wrapped) | 3 | 1 | -2 |
| `src/claude/agents/03-system-designer.md` (419 lines) | 1 blockquote | 3 | 1 | -2 |
| `src/claude/agents/04-test-design-engineer.md` (677 lines) | 1 blockquote | 3 | 1 | -2 |
| `src/claude/agents/05-software-developer.md` (932 lines) | 1 blockquote | 3 | 1 | -2 |
| `src/claude/agents/06-integration-tester.md` (847 lines) | 1 blockquote | 3 | 1 | -2 |
| `src/claude/agents/07-qa-engineer.md` (376 lines) | 1 blockquote | 3 | 1 | -2 |
| `src/claude/agents/08-security-compliance-auditor.md` (240 lines) | 1 blockquote | 3 | 1 | -2 |
| `src/claude/agents/09-cicd-engineer.md` (219 lines) | 1 blockquote | 3 | 1 | -2 |
| `src/claude/agents/10-dev-environment-engineer.md` (331 lines) | 1 blockquote | 3 | 1 | -2 |
| `src/claude/agents/11-deployment-engineer-staging.md` (202 lines) | 1 blockquote | 3 | 1 | -2 |
| `src/claude/agents/12-release-manager.md` (228 lines) | 1 blockquote | 3 | 1 | -2 |
| `src/claude/agents/13-site-reliability-engineer.md` (316 lines) | 1 blockquote | 3 | 1 | -2 |
| `src/claude/agents/14-upgrade-engineer.md` (651 lines) | 1 blockquote | 3 | 1 | -2 |
| `src/claude/agents/discover/characterization-test-generator.md` (477 lines) | 1 blockquote | 3 | 1 | -2 |
| `src/claude/agents/discover/artifact-integration.md` (314 lines) | 1 blockquote | 3 | 1 | -2 |
| `src/claude/agents/discover/atdd-bridge.md` (370 lines) | 1 blockquote | 3 | 1 | -2 |
| `src/claude/agents/impact-analysis/impact-analysis-orchestrator.md` (889 lines) | 1 blockquote | 3 | 1 | -2 |
| `src/claude/agents/tracing/tracing-orchestrator.md` (416 lines) | 1 blockquote | 3 | 1 | -2 |

**Subtotal**: 18 files x 2 lines net = **-36 lines** from agents, **+8 lines** to CLAUDE.md = **-28 net**

#### FR-003: Monorepo Mode -- Short Analysis Variant (7 files)

| File | Lines Removed | Lines Added | Net Change |
|------|---------------|-------------|------------|
| `src/claude/agents/impact-analysis/impact-analyzer.md` (516 lines) | 1 | 1 | 0 (replace in-place) |
| `src/claude/agents/impact-analysis/entry-point-finder.md` (615 lines) | 1 | 1 | 0 |
| `src/claude/agents/impact-analysis/cross-validation-verifier.md` (460 lines) | 1 | 1 | 0 |
| `src/claude/agents/impact-analysis/risk-assessor.md` (644 lines) | 1 | 1 | 0 |
| `src/claude/agents/tracing/execution-path-tracer.md` (384 lines) | 1 | 1 | 0 |
| `src/claude/agents/tracing/root-cause-identifier.md` (408 lines) | 1 | 1 | 0 |
| `src/claude/agents/tracing/symptom-analyzer.md` (326 lines) | 1 | 1 | 0 |

**Note**: The short-form blockquote is essentially the same length as the reference. Net line savings is ~0 for these files, but the benefit is single source of truth and consistency.

#### FR-004: Monorepo Mode -- Orchestrator-Specific (2 files)

| File | Lines Removed | Lines Added | Net Change |
|------|---------------|-------------|------------|
| `src/claude/agents/quick-scan/quick-scan-agent.md` (314 lines) | 1 | 1 | 0 |
| `src/claude/agents/impact-analysis/impact-analysis-orchestrator.md` | Already counted in FR-002 | -- | -- |

#### FR-005 + FR-006: Iteration Enforcement (7 files)

**CLAUDE.md** receives a new "Mandatory Iteration Enforcement Protocol" subsection (~15 lines for the common structure).

**7 agent files** have their full iteration section replaced with reference + agent-specific customization:

| File | Current Section Size | Lines Removed | Lines Added (ref + custom) | Net Change |
|------|---------------------|---------------|---------------------------|------------|
| `05-software-developer.md` | 12 lines | 12 | 3 | -9 |
| `06-integration-tester.md` | 12 lines | 12 | 3 | -9 |
| `14-upgrade-engineer.md` | 12 lines | 12 | 3 | -9 |
| `16-quality-loop-engineer.md` | 8 lines | 8 | 3 | -5 |
| `discover/characterization-test-generator.md` | 10 lines | 10 | 3 | -7 |
| `discover/artifact-integration.md` | 9 lines | 9 | 3 | -6 |
| `discover/atdd-bridge.md` | 8 lines | 8 | 3 | -5 |

**Subtotal**: **-50 lines** from agents, **+15 lines** to CLAUDE.md = **-35 net**

**Agent-Specific Customizations Preserved**:
- `05-software-developer.md`: "ALL UNIT TESTS PASS WITH >=80% COVERAGE", max iterations: 10
- `06-integration-tester.md`: "ALL TESTS PASS", max iterations: 10
- `14-upgrade-engineer.md`: "ALL regression tests pass or iteration limit reached", max iterations: 10, circuit breaker: 3
- `16-quality-loop-engineer.md`: "iterate until BOTH tracks pass", max iterations: not specified (uses default)
- `discover/characterization-test-generator.md`: "ALL CHARACTERIZATION TESTS ARE GENERATED AND VALIDATED", max iterations: 10
- `discover/artifact-integration.md`: "ALL ARTIFACTS ARE PROPERLY LINKED AND TRACEABLE", max iterations: 5
- `discover/atdd-bridge.md`: "ATDD ARTIFACTS ARE PROPERLY GENERATED", max iterations: 5

#### FR-007 + FR-008: Git Commit Prohibition (2 files)

**CLAUDE.md** receives a new "Git Commit Prohibition" subsection (~6 lines).

| File | Lines Removed | Lines Added | Net Change |
|------|---------------|-------------|------------|
| `05-software-developer.md` | 6 lines | 1 | -5 |
| `16-quality-loop-engineer.md` | 4 lines | 1 | -3 |

**Subtotal**: **-8 lines** from agents, **+6 lines** to CLAUDE.md = **-2 net**

#### FR-009 + FR-010 + FR-011: Root Resolution + Project Context Resolution (2 files)

**CLAUDE.md** receives two new subsections:
- "Root Resolution Protocol" (~10 lines)
- "Project Context Resolution (Monorepo)" (~60 lines)

| File | Section | Lines Removed | Lines Added | Net Change |
|------|---------|---------------|-------------|------------|
| `00-sdlc-orchestrator.md` (1752 lines) | ROOT RESOLUTION (9 lines) | 9 | 1 | -8 |
| `00-sdlc-orchestrator.md` | SECTION 0: PROJECT CONTEXT (58 lines) | 58 | 1 | -57 |
| `discover-orchestrator.md` (2529 lines) | ROOT RESOLUTION (10 lines) | 10 | 1 | -9 |
| `discover-orchestrator.md` | MONOREPO PREAMBLE (33 lines) | 33 | 1 | -32 |

**Subtotal**: **-106 lines** from agents, **+70 lines** to CLAUDE.md = **-36 net**

**Note**: The discover-orchestrator MONOREPO PREAMBLE (33 lines) is shorter than the sdlc-orchestrator SECTION 0 (58 lines) because it excludes the path routing table and workflow independence sections. The CLAUDE.md version must contain the superset (sdlc-orchestrator version), and the discover-orchestrator will reference it. This means the discover-orchestrator effectively gains access to content it previously did not have (path routing table details), but this is informational and does not change behavior.

### Dependency Analysis

#### Outward Dependencies (what depends on modified files)

The modified files are **markdown prompt files** loaded by Claude Code at agent delegation time. They have no runtime code dependencies. However:

1. **Hooks that reference agent behavior**: The `test-watcher` hook monitors test execution and is referenced in the iteration enforcement section. The hook itself is NOT modified -- only the agent prompt text that references it changes location (from inline to CLAUDE.md). The hook continues to function identically.

2. **Skills manifest**: Maps skills to agents. Not affected -- no skill assignments change.

3. **`.claude/agents/` sync**: The `src/claude/agents/` directory must be synced to `.claude/agents/` at deploy time. This is an existing convention. The sync mechanism itself is unaffected.

4. **State.json schema**: No changes to state schema. The iteration enforcement references `max_iterations` and `circuit_breaker_threshold` from state.json -- these references simply move from agent files to CLAUDE.md + agent customization lines.

#### Inward Dependencies (what modified files depend on)

1. **CLAUDE.md auto-inclusion**: All modified agents depend on Claude Code loading CLAUDE.md into their context window. This is a platform behavior, not something this feature controls. **Assumption ASM-001** covers this.

2. **Agent frontmatter**: YAML frontmatter in each agent file defines `name`, `model`, `owned_skills`. Not modified by this feature.

3. **Hook enforcement**: Hooks like `test-watcher`, `iteration-corridor`, `skill-delegation-enforcer` read state.json and agent behavior -- they do NOT parse agent markdown files. Unaffected.

### Change Propagation Paths

```
CLAUDE.md (5 new subsections added)
  |
  +-- Inherited by ALL 48 agents (Claude Code auto-includes CLAUDE.md)
  |     |
  |     +-- Agents that previously had inline content: now see identical content from CLAUDE.md
  |     |
  |     +-- Agents that never had this content: now see it in their context
  |           (e.g., 01-requirements-analyst now sees iteration enforcement protocol)
  |           This is informational only -- agents without iteration enforcement
  |           sections never invoke that protocol.
  |
  +-- 28 agent files modified (content removed, references added)
        |
        +-- .claude/agents/ must be synced after changes (existing convention)
```

**Key Propagation Risk**: Adding content to CLAUDE.md means ALL 48 agents see the new sections, not just the 28 that previously had them. This increases baseline context for non-affected agents by ~100 lines. NFR-006 caps CLAUDE.md growth at +120 lines to mitigate this.

---

## Entry Points (M2)

### Implementation Entry Points

Since this is a pure refactoring of markdown prompt files, there are no traditional API/UI entry points. The "entry points" are the files to modify and the order of modification.

### Recommended Implementation Order

The implementation should follow a dependency-first approach:

#### Phase 1: Add Shared Sections to CLAUDE.md (Foundation)
**File**: `/Users/vihangshah/enactor-code/isdlc/CLAUDE.md`

Add 5 new subsections under "## Agent Framework Context" in this order:
1. **Root Resolution Protocol** (~10 lines) -- source: `00-sdlc-orchestrator.md` lines 45-53
2. **Project Context Resolution (Monorepo)** (~60 lines) -- source: `00-sdlc-orchestrator.md` lines 55-112
3. **Monorepo Mode Protocol** (~8 lines) -- source: agent blockquote patterns (3 variants)
4. **Mandatory Iteration Enforcement Protocol** (~15 lines) -- source: common structure from 7 agents
5. **Git Commit Prohibition** (~6 lines) -- source: `05-software-developer.md` lines 38-43

**Rationale**: CLAUDE.md must contain the extracted content BEFORE removing it from agent files. This ensures agents never lose access to protocols during partial implementation.

#### Phase 2: Remove from Orchestrator Agents (Highest Line Savings)
**Files** (2):
1. `src/claude/agents/00-sdlc-orchestrator.md` -- remove ROOT RESOLUTION + SECTION 0 (~67 lines)
2. `src/claude/agents/discover-orchestrator.md` -- remove ROOT RESOLUTION + MONOREPO PREAMBLE (~43 lines)

**Rationale**: These have the largest per-file line savings (~110 lines combined) and are the most complex extractions. Do them early to validate the pattern.

#### Phase 3: Remove from Multi-Boilerplate Agents (Complex)
**Files** (4):
1. `src/claude/agents/05-software-developer.md` -- remove monorepo + iteration + git warning (~21 lines)
2. `src/claude/agents/06-integration-tester.md` -- remove monorepo + iteration (~15 lines)
3. `src/claude/agents/14-upgrade-engineer.md` -- remove monorepo + iteration (~15 lines)
4. `src/claude/agents/16-quality-loop-engineer.md` -- remove iteration + git warning (~12 lines)

**Rationale**: These agents have multiple sections to remove. Careful editing needed to maintain document flow.

#### Phase 4: Remove from Discover Sub-Agents (Iteration + Monorepo)
**Files** (3):
1. `src/claude/agents/discover/characterization-test-generator.md` -- remove monorepo + iteration
2. `src/claude/agents/discover/artifact-integration.md` -- remove monorepo + iteration
3. `src/claude/agents/discover/atdd-bridge.md` -- remove monorepo + iteration

#### Phase 5: Remove from Single-Boilerplate Phase Agents (Simple, Repetitive)
**Files** (9):
1. `src/claude/agents/02-solution-architect.md`
2. `src/claude/agents/03-system-designer.md`
3. `src/claude/agents/04-test-design-engineer.md`
4. `src/claude/agents/07-qa-engineer.md`
5. `src/claude/agents/08-security-compliance-auditor.md`
6. `src/claude/agents/09-cicd-engineer.md`
7. `src/claude/agents/10-dev-environment-engineer.md`
8. `src/claude/agents/11-deployment-engineer-staging.md`
9. `src/claude/agents/12-release-manager.md`
10. `src/claude/agents/13-site-reliability-engineer.md`

**Rationale**: Simple 3-line blockquote removal. Batch these for efficiency.

#### Phase 6: Remove from Analysis Sub-Agents (Short Form)
**Files** (7):
1. `src/claude/agents/impact-analysis/impact-analyzer.md`
2. `src/claude/agents/impact-analysis/entry-point-finder.md`
3. `src/claude/agents/impact-analysis/cross-validation-verifier.md`
4. `src/claude/agents/impact-analysis/risk-assessor.md`
5. `src/claude/agents/tracing/execution-path-tracer.md`
6. `src/claude/agents/tracing/root-cause-identifier.md`
7. `src/claude/agents/tracing/symptom-analyzer.md`

#### Phase 7: Remove from Remaining Agents
**Files** (2):
1. `src/claude/agents/tracing/tracing-orchestrator.md`
2. `src/claude/agents/quick-scan/quick-scan-agent.md`
3. `src/claude/agents/impact-analysis/impact-analysis-orchestrator.md`

#### Phase 8: Verification
1. Run `grep` verification (V-002) -- ensure no full copies remain
2. Run `wc -l` verification (V-001) -- confirm line savings
3. Run `npm run test:hooks` -- confirm hook tests pass (V-004)
4. Run `npm test` -- confirm ESM tests pass (V-004)

### Implementation Chain

```
CLAUDE.md additions (Phase 1)
    |
    v
Orchestrator removals (Phase 2) -- validates extraction pattern
    |
    v
Multi-section agent removals (Phase 3-4) -- validates iteration customization pattern
    |
    v
Single-section agent removals (Phase 5-7) -- batch, repetitive
    |
    v
Verification sweep (Phase 8) -- grep, wc -l, test suites
```

---

## Risk Assessment (M3)

### Risk Matrix

| Risk ID | Description | Likelihood | Impact | Severity | Mitigation |
|---------|-------------|------------|--------|----------|------------|
| R-001 | Content drift: CLAUDE.md version differs from what was inline | Low | High | MEDIUM | Side-by-side diff during implementation; grep verification (V-002) |
| R-002 | Iteration customization lost: agent-specific criteria not preserved | Low | High | MEDIUM | Explicit checklist of 7 agents with their criteria; V-003 content equivalence check |
| R-003 | CLAUDE.md size budget exceeded (>120 lines added) | Medium | Medium | MEDIUM | Measure after Phase 1; consolidate content if over budget |
| R-004 | Non-affected agents confused by new CLAUDE.md content | Very Low | Low | LOW | Protocols are clearly labeled; agents follow their own instructions |
| R-005 | Monorepo variant mismatch: wrong variant referenced by agent | Low | Medium | LOW | 3 variants clearly defined in requirements; implementation checklist |
| R-006 | Sync to .claude/agents/ forgotten after changes | Low | High | MEDIUM | Add sync step to verification checklist |
| R-007 | Discover-orchestrator MONOREPO PREAMBLE differs from sdlc-orchestrator SECTION 0 | Medium | Medium | MEDIUM | Document the superset decision; the discover-orchestrator gains informational access to the path routing table |
| R-008 | Hook tests fail due to agent prompt changes | Very Low | High | LOW | Hooks do not parse agent markdown; they read state.json. No test impact expected. |

### Test Coverage Analysis

| Module | Relevant Tests | Coverage | Risk Level |
|--------|---------------|----------|------------|
| CLAUDE.md | No automated tests (markdown) | N/A | LOW (manual verification only) |
| Agent files (src/claude/agents/) | No automated tests on markdown content | N/A | LOW (grep verification serves as automated check) |
| Hooks (src/claude/hooks/) | 18 test files, 555+ tests | High | VERY LOW (not modified) |
| CLI (lib/) | ESM test suite | High | VERY LOW (not modified) |

**Key Finding**: There are no automated tests for agent markdown content. The verification approach (Section 9 of requirements) defines 5 verification checks (V-001 through V-005) that serve as the test plan for this refactoring.

### Complexity Assessment

| File Category | Files | Complexity | Notes |
|---------------|-------|------------|-------|
| CLAUDE.md | 1 | MEDIUM | Must carefully integrate 5 new subsections under existing "Agent Framework Context" heading. Must respect section ordering (FR-012). Must stay within 120-line budget. |
| Orchestrator agents | 2 | HIGH | Largest sections to extract. `00-sdlc-orchestrator.md` has Section 0 with path routing table (58 lines), delegation context template, workflow independence rules. `discover-orchestrator.md` has a different structure (MONOREPO PREAMBLE vs SECTION 0). Must ensure the CLAUDE.md version captures the superset. |
| Multi-boilerplate agents | 4 | MEDIUM | Multiple sections to remove from same file. Must maintain document flow and heading hierarchy. |
| Discover sub-agents | 3 | LOW-MEDIUM | Iteration section has agent-specific first line and max iterations. Must preserve those as customization. |
| Single-boilerplate agents | 10 | LOW | Simple blockquote removal. Repetitive but straightforward. |
| Analysis sub-agents | 7 | LOW | Short blockquote replacement. Nearly 1:1 substitution. |
| Remaining agents | 3 | LOW | One variant each. |

### Technical Debt Markers

1. **Inconsistent monorepo blockquote wording**: 3 variants evolved organically. The CLAUDE.md extraction unifies them, which is a debt reduction.

2. **Iteration enforcement structural drift**: Some agents use `# ⚠️ MANDATORY ITERATION ENFORCEMENT` heading, others use `# MANDATORY ITERATION ENFORCEMENT` (no emoji), and `16-quality-loop-engineer` uses `## MANDATORY ITERATION ENFORCEMENT` (H2 not H1). The extraction normalizes this.

3. **Discover-orchestrator MONOREPO PREAMBLE vs sdlc-orchestrator SECTION 0**: These are not identical despite serving the same purpose. The discover-orchestrator version is shorter (missing path routing table, workflow independence). The CLAUDE.md version should contain the complete superset from sdlc-orchestrator.

### Recommendations

1. **Add tests before modifying**: Not applicable -- no executable code is being modified. The verification approach in the requirements (V-001 through V-005) is the appropriate test strategy.

2. **High-risk area -- CLAUDE.md budget**: Calculate exact line count needed for all 5 sections BEFORE writing them. The budget is tight: 120 lines for ~100 lines of actual content plus headings and blank lines.

3. **High-risk area -- Orchestrator extractions**: The sdlc-orchestrator SECTION 0 (58 lines) and discover-orchestrator MONOREPO PREAMBLE (33 lines) overlap but differ. Document the merge decision clearly.

4. **Smoke test recommended**: After deployment, manually test `00-sdlc-orchestrator` and `05-software-developer` in a real workflow to confirm agent behavior is unchanged.

---

## Implementation Recommendations

Based on the impact analysis:

1. **Suggested Order**: Foundation-first (CLAUDE.md additions) then orchestrator agents (complex, highest savings) then multi-section agents then batch single-section agents then verification. See Entry Points section for detailed 8-phase ordering.

2. **High-Risk Areas**:
   - CLAUDE.md size budget management (NFR-006: max +120 lines)
   - Orchestrator MONOREPO/ROOT RESOLUTION merge (R-007: content differs between sdlc and discover orchestrators)
   - Iteration enforcement customization preservation (R-002: 7 agents, each with unique criteria)

3. **Dependencies to Resolve**:
   - CLAUDE.md must have all 5 new subsections BEFORE any agent file is modified
   - `.claude/agents/` sync must happen after all `src/claude/agents/` changes are complete
   - Hook test suite (`npm run test:hooks`) should be run as final verification to confirm no unexpected regressions

4. **Line Budget Estimate**:
   - CLAUDE.md current: 148 lines
   - Root Resolution Protocol: ~12 lines (heading + blank + 6 steps + blank)
   - Project Context Resolution: ~65 lines (heading + 6 subsections from sdlc-orchestrator)
   - Monorepo Mode Protocol: ~10 lines (heading + 3 variant descriptions)
   - Iteration Enforcement Protocol: ~18 lines (heading + common rules + parameterization note)
   - Git Commit Prohibition: ~8 lines (heading + prohibition + rationale)
   - **Total addition estimate: ~113 lines** (within 120-line budget but tight)
   - **CLAUDE.md post-refactor estimate: ~261 lines** (within 280-line ceiling from NFR-006)

5. **Net Line Savings Estimate**:
   - Lines removed from agents: ~200 lines
   - Lines added to agents (references): ~58 lines (29 files x ~2 lines average)
   - Lines added to CLAUDE.md: ~113 lines
   - **Net reduction: ~200 - 58 - 113 = ~29 lines** (actual token savings are higher because the 113 lines in CLAUDE.md were previously duplicated across 28 files)
   - **Token savings**: Each agent delegation that previously loaded both CLAUDE.md + agent-inline content now loads only CLAUDE.md (shared) + shorter agent file. For the 18 monorepo agents, each saves ~2 lines of context. For the 7 iteration agents, each saves ~9-12 lines. For the 2 orchestrators, each saves ~40-65 lines.

---

## Impact Analysis Metadata

```json
{
  "analysis_completed_at": "2026-02-17T09:30:00Z",
  "sub_agents": ["M1-impact-analyzer", "M2-entry-point-finder", "M3-risk-assessor"],
  "requirements_document": "docs/requirements/REQ-0021-t7-agent-prompt-boilerplate-extraction/requirements.md",
  "quick_scan_used": "docs/requirements/REQ-0021-t7-agent-prompt-boilerplate-extraction/quick-scan.md",
  "scope_change_from_original": "expanded",
  "requirements_keywords": ["monorepo", "iteration", "enforcement", "root resolution", "project context", "git commit", "boilerplate", "extraction", "CLAUDE.md", "agent prompt"],
  "files_analyzed": 29,
  "blast_radius": "medium",
  "risk_level": "low",
  "verified_counts": {
    "monorepo_full_delegation": 18,
    "monorepo_short_analysis": 7,
    "monorepo_orchestrator_specific": 2,
    "iteration_enforcement": 7,
    "git_commit_warning": 2,
    "root_resolution": 2,
    "project_context_resolution": 2
  }
}
```
