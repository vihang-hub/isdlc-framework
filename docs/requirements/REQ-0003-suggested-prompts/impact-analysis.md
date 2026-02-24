# Impact Analysis: REQ-0003 - Framework-Controlled Suggested Prompts

**Artifact ID:** REQ-0003-suggested-prompts
**Phase:** 02 - Impact Analysis
**Created:** 2026-02-08
**Blast Radius:** MEDIUM
**Risk Level:** LOW

---

## 1. Executive Summary

This feature adds a `# SUGGESTED PROMPTS` section to all 36 agent markdown files and updates the orchestrator to emit contextual next-step prompts at phase boundaries. The change is purely additive -- no existing behavior is modified, no state schema changes, no new hooks, no new dependencies.

**Blast radius classification: MEDIUM** -- While the risk per file is low (append-only markdown), the breadth is wide: 36 agent files + 1 orchestrator + 1 command file = 38 files modified. However, the changes are uniform, template-driven, and backward-compatible.

---

## 2. Affected Areas

### 2.1 Direct Impact (Files That MUST Change)

#### Category A: Phase Agent Markdown Files (15 files)

Each file receives a new `# SUGGESTED PROMPTS` section appended at the end, before the final closing line. The section contains primary, alternative, and utility prompt templates.

| File | Lines | Change Type | Risk |
|------|-------|-------------|------|
| `src/claude/agents/01-requirements-analyst.md` | 1729 | Append section | LOW |
| `src/claude/agents/02-solution-architect.md` | 667 | Append section | LOW |
| `src/claude/agents/03-system-designer.md` | 342 | Append section | LOW |
| `src/claude/agents/04-test-design-engineer.md` | 569 | Append section | LOW |
| `src/claude/agents/05-software-developer.md` | 661 | Append section | LOW |
| `src/claude/agents/06-integration-tester.md` | 786 | Append section | LOW |
| `src/claude/agents/07-qa-engineer.md` | 206 | Append section | LOW |
| `src/claude/agents/08-security-compliance-auditor.md` | 235 | Append section | LOW |
| `src/claude/agents/09-cicd-engineer.md` | 214 | Append section | LOW |
| `src/claude/agents/10-dev-environment-engineer.md` | 302 | Append section | LOW |
| `src/claude/agents/11-deployment-engineer-staging.md` | 197 | Append section | LOW |
| `src/claude/agents/12-release-manager.md` | 223 | Append section | LOW |
| `src/claude/agents/13-site-reliability-engineer.md` | 311 | Append section | LOW |
| `src/claude/agents/14-upgrade-engineer.md` | 644 | Append section | LOW |
| `src/claude/agents/quick-scan/quick-scan-agent.md` | 318 | Append section | LOW |

#### Category B: Sub-Orchestrator Agent Files (5 files)

These agents coordinate sub-agents and need prompts for their completion points.

| File | Lines | Change Type | Risk |
|------|-------|-------------|------|
| `src/claude/agents/impact-analysis/impact-analysis-orchestrator.md` | 801 | Append section | LOW |
| `src/claude/agents/tracing/tracing-orchestrator.md` | 411 | Append section | LOW |
| `src/claude/agents/discover-orchestrator.md` | 1869 | Append section | LOW |

#### Category C: Sub-Agent Files (16 files)

Sub-agents within discover, impact-analysis, and tracing report to their orchestrators, not directly to the user. They will receive minimal prompts (status-report style).

| File | Lines | Change Type | Risk |
|------|-------|-------------|------|
| `src/claude/agents/discover/architecture-analyzer.md` | - | Append section | LOW |
| `src/claude/agents/discover/test-evaluator.md` | - | Append section | LOW |
| `src/claude/agents/discover/constitution-generator.md` | - | Append section | LOW |
| `src/claude/agents/discover/skills-researcher.md` | - | Append section | LOW |
| `src/claude/agents/discover/data-model-analyzer.md` | - | Append section | LOW |
| `src/claude/agents/discover/product-analyst.md` | - | Append section | LOW |
| `src/claude/agents/discover/architecture-designer.md` | - | Append section | LOW |
| `src/claude/agents/discover/feature-mapper.md` | - | Append section | LOW |
| `src/claude/agents/discover/characterization-test-generator.md` | - | Append section | LOW |
| `src/claude/agents/discover/artifact-integration.md` | - | Append section | LOW |
| `src/claude/agents/discover/atdd-bridge.md` | - | Append section | LOW |
| `src/claude/agents/impact-analysis/impact-analyzer.md` | - | Append section | LOW |
| `src/claude/agents/impact-analysis/entry-point-finder.md` | - | Append section | LOW |
| `src/claude/agents/impact-analysis/risk-assessor.md` | - | Append section | LOW |
| `src/claude/agents/tracing/symptom-analyzer.md` | - | Append section | LOW |
| `src/claude/agents/tracing/execution-path-tracer.md` | - | Append section | LOW |
| `src/claude/agents/tracing/root-cause-identifier.md` | - | Append section | LOW |

**Note:** The discover sub-agents total 11 files, but the combined count with impact-analysis (3) and tracing (3) sub-agents is 17. However, `discover-orchestrator.md` is counted in Category B, leaving 16 sub-agents.

#### Category D: Orchestrator (1 file)

| File | Lines | Change Type | Risk |
|------|-------|-------------|------|
| `src/claude/agents/00-sdlc-orchestrator.md` | 2158 | Add prompt emission sections at 5 trigger points | MEDIUM |

The orchestrator changes are more involved:
1. Add `# PROMPT EMISSION PROTOCOL` section defining the format
2. Add prompt blocks to workflow initialization output
3. Add prompt blocks to phase gate transition output
4. Add prompt blocks to workflow completion output
5. Add prompt blocks to workflow cancellation output
6. Update interactive menu scenarios to include prompt awareness

#### Category E: Command File (0-1 files)

| File | Lines | Change Type | Risk |
|------|-------|-------------|------|
| `src/claude/commands/sdlc.md` | ~300 | Potentially no change needed | NONE |

The command file routes to the orchestrator agent. Since prompt emission is defined within agent behavior (not command routing), the command file likely needs no changes. The orchestrator's own SUGGESTED PROMPTS section handles all emission.

### 2.2 Indirect Impact (Files That MAY Change)

#### Documentation Updates (Article VIII compliance)

| File | Change Type | Risk |
|------|-------------|------|
| `CLAUDE.md` | Update "Next Session" checklist | LOW |
| `README.md` | May need mention of suggested prompts feature | LOW |

#### No Hook Changes

Per REQ constraint CON-002, no new hooks are needed. Prompts are emitted as agent text output, not hook-mediated.

#### No Config Changes

| File | Change? | Reason |
|------|---------|--------|
| `.isdlc/config/workflows.json` | NO | Workflow definitions unchanged |
| `src/claude/hooks/config/skills-manifest.json` | NO | No new skills |
| `src/claude/hooks/config/iteration-requirements.json` | NO | No new iteration rules |
| `src/claude/settings.json` | NO | No new hooks or permissions |

#### No State Schema Changes

Per NFR-006, `state.json` schema remains unchanged. Prompts are ephemeral output, not persisted.

### 2.3 Zero-Impact Areas (Confirmed Safe)

| Area | Reason |
|------|--------|
| All 10 hook files (`.cjs`) | No hook behavior changes -- prompts are text in agent output |
| All lib/ files (ESM) | No library code changes |
| All test files | No test infrastructure changes (though new tests will be added) |
| `package.json` | No new dependencies (NFR-003) |
| `bin/isdlc.js` | CLI entry point unchanged |
| Installer scripts (install.sh, install.ps1, etc.) | Framework install logic unchanged |
| Skills manifest and skill `.md` files | No skill additions |

---

## 3. Entry Points

### 3.1 Primary Entry Points (Where Users Encounter Prompts)

| Entry Point | Trigger | Agent Responsible |
|-------------|---------|-------------------|
| Phase completion | Agent finishes its work and emits final response | Each phase agent (01-14) |
| Gate passage | Orchestrator validates gate and transitions to next phase | Orchestrator (00) |
| Workflow initialization | User runs `/sdlc feature`, `/sdlc fix`, etc. | Orchestrator (00) |
| Workflow completion | Last phase gate passes, merge completes | Orchestrator (00) |
| Workflow cancellation | User runs `/sdlc cancel` | Orchestrator (00) |
| Interactive menu | User runs `/sdlc` with no arguments | Orchestrator (00) |
| Interactive pause points | Agent presents A/R/C menu or asks for input | Requirements Analyst (01) |

### 3.2 Data Flow

```
state.json (active_workflow) → Agent reads workflow context
                              → Agent determines next phase from phases[]
                              → Agent formats SUGGESTED NEXT STEPS block
                              → Block appears in agent's text output
                              → Claude Code displays output to user
```

No new data flow paths are created. Agents already read `active_workflow` from state.json for phase awareness. The only addition is formatting this information into a prompt block at output time.

### 3.3 Agent File Insertion Point

For each agent, the `# SUGGESTED PROMPTS` section will be inserted:
- **After** the `# SELF-VALIDATION` section (or final section)
- **Before** the closing statement line (e.g., "You are the quality gatekeeper...")
- For agents without a clear closing line, append at the very end

Current file endings by agent (determines exact insertion point):

| Agent | Current Final Content | Insert Before |
|-------|----------------------|---------------|
| 01-requirements-analyst | `You are the foundation of the SDLC...` | Before final paragraph |
| 02-solution-architect | `You bridge the gap between...` | Before final paragraph |
| 03-system-designer | `You translate architecture into...` | Before final paragraph |
| 04-test-design-engineer | `You define the quality contract...` | Before final paragraph |
| 05-software-developer | `You bring designs to life...` | Before final paragraph |
| 06-integration-tester | `You validate that the system works...` | Before final paragraph |
| 07-qa-engineer | `You are the quality gatekeeper...` | Before final paragraph |
| 08-security-compliance-auditor | `You are the last line of defense...` | Before final paragraph |
| 09-cicd-engineer | `You automate the path from code to production.` | Before final paragraph |
| 10-dev-environment-engineer | `You create the foundation...` | Before final paragraph |
| 11-deployment-engineer-staging | `You are the final validator...` | Before final paragraph |
| 12-release-manager | `You coordinate the final delivery...` | Before final paragraph |
| 13-site-reliability-engineer | `You keep the system alive...` | Before final paragraph |
| 14-upgrade-engineer | After SELF-VALIDATION section | At end |

---

## 4. Risk Assessment

### 4.1 Risk Matrix

| Risk ID | Description | Likelihood | Impact | Severity | Mitigation |
|---------|-------------|------------|--------|----------|------------|
| R-001 | Agent context window pressure from added section | LOW | LOW | LOW | Section is ~20-40 lines per agent. Agent files range 197-2158 lines. Marginal increase. |
| R-002 | Inconsistent prompt format across agents | MEDIUM | LOW | LOW | Define format in orchestrator; agents reference the same template. Validate during code review. |
| R-003 | Prompts reference wrong next phase for non-standard workflows | MEDIUM | MEDIUM | MEDIUM | Prompts MUST be dynamically generated from `active_workflow.phases[]`, not hardcoded phase numbers. |
| R-004 | Sub-agents (discover, IA, tracing) emit prompts when they should not | LOW | LOW | LOW | Sub-agent prompts are reporting style ("Analysis complete, returning to orchestrator") not user-facing navigation prompts. |
| R-005 | Orchestrator prompt emission conflicts with existing banner formats | LOW | MEDIUM | LOW | Define prompt block format to be visually distinct from existing `=====` banners and `+----|` announcement boxes. Use `---` delimiters. |
| R-006 | Backward incompatibility if agent file lacks SUGGESTED PROMPTS section | NONE | NONE | NONE | CON-003 explicitly states this is backward compatible. Agents without the section simply do not emit prompts. |
| R-007 | Test regression from agent file modifications | LOW | MEDIUM | LOW | Agent files are markdown -- they are not executed as code. Existing tests test hook logic and lib code, not agent markdown content. |

### 4.2 Overall Risk Rating: LOW

- All changes are additive (append-only markdown sections)
- No runtime code changes (hooks, lib)
- No state schema changes
- No dependency changes
- Backward compatible by design (CON-003)
- Existing test suite unaffected (agent .md files are not unit-tested)

### 4.3 Highest-Risk Item: R-003 (Dynamic Phase References)

**Risk**: If prompts hardcode "Continue to Phase 03 - Design" instead of dynamically reading the next phase from `active_workflow.phases[current_phase_index + 1]`, they will be wrong for workflows that skip phases (e.g., fix workflow skips architecture).

**Mitigation**: The SUGGESTED PROMPTS section must contain template instructions, not literal phase names. Example:
```
Primary: "Continue to Phase {next_phase_number} - {next_phase_name}"
         where next_phase = active_workflow.phases[current_phase_index + 1]
```

---

## 5. Dependency Analysis

### 5.1 Upstream Dependencies (What This Feature Needs)

| Dependency | Status | Notes |
|------------|--------|-------|
| `state.json` `active_workflow` structure | EXISTS | Agents already read this for phase awareness |
| `workflows.json` phase definitions | EXISTS | Already used by orchestrator for phase sequencing |
| Agent markdown rendering by Claude Code | EXISTS | Claude Code already processes agent .md files |
| YAML frontmatter parsing | EXISTS | Already in all agent files |

No new upstream dependencies are introduced.

### 5.2 Downstream Dependencies (What Depends on This Feature)

| Dependent | Type | Notes |
|-----------|------|-------|
| None | - | This is a leaf feature with no downstream dependents |

### 5.3 Cross-Cutting Concerns

| Concern | Impact | Notes |
|---------|--------|-------|
| Article V (Simplicity) | Must ensure prompt system is not over-engineered | Prompts are text templates in markdown, not a config registry or runtime engine |
| Article VIII (Documentation) | Agent docs updated alongside behavior | The prompt section IS the documentation -- self-documenting |
| Article XII (Cross-Platform) | Prompt output must render on all terminals | NFR-005 requires ASCII-only formatting |
| Article XIII (Module System) | No ESM/CJS boundary issues | No code files modified |
| Article XIV (State Management) | No state schema changes | NFR-006 enforced |

---

## 6. Implementation Complexity Estimate

### 6.1 Work Breakdown

| Work Item | Effort | Files | Notes |
|-----------|--------|-------|-------|
| Define prompt format specification | Small | 1 (orchestrator) | One-time format definition |
| Add SUGGESTED PROMPTS to 15 phase agents | Medium | 15 | Template-driven, but each agent needs workflow-specific prompts |
| Add SUGGESTED PROMPTS to 5 orchestrator/sub-orchestrators | Small | 5 | Sub-orchestrators have simpler prompts |
| Add SUGGESTED PROMPTS to 16 sub-agents | Small | 16 | Minimal prompts (status reporting only) |
| Update orchestrator emission points | Medium | 1 | 5 trigger points within the 2158-line orchestrator |
| Write tests for prompt format validation | Small | 1-2 | Validate format consistency across agents |
| Documentation updates | Small | 1-2 | CLAUDE.md, possibly README.md |

### 6.2 Estimated Total: ~38 files modified, ~800-1200 lines added across all files

### 6.3 Implementation Order Recommendation

1. **Phase 03 (Architecture)**: Define the prompt format spec and orchestrator protocol
2. **Phase 04 (Design)**: Design per-agent prompt templates with dynamic placeholders
3. **Phase 05 (Test Strategy)**: Design validation tests for format consistency
4. **Phase 06 (Implementation)**: Implement in this order:
   a. Orchestrator prompt emission protocol (00-sdlc-orchestrator.md)
   b. Phase agents in workflow order (01, 02-IA, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14)
   c. Sub-orchestrators (impact-analysis, tracing, discover)
   d. Sub-agents (discover/*, impact-analysis/*, tracing/*)

---

## 7. File Change Summary

### Total Files Affected

| Category | Count | Change Type |
|----------|-------|-------------|
| Phase agent .md files | 15 | Append SUGGESTED PROMPTS section |
| Sub-orchestrator .md files | 3 | Append SUGGESTED PROMPTS section |
| Orchestrator .md file | 1 | Add prompt emission protocol + 5 trigger points |
| Sub-agent .md files | 17 | Append minimal SUGGESTED PROMPTS section |
| Command .md files | 0 | No changes needed |
| Hook .cjs files | 0 | No changes needed |
| Lib .js files | 0 | No changes needed |
| Config .json files | 0 | No changes needed |
| Documentation | 1-2 | CLAUDE.md update |
| **TOTAL** | **37-38** | **Additive markdown changes** |

### Files NOT Changed

| Category | Count | Reason |
|----------|-------|--------|
| Hook files (.cjs) | 12 | CON-002: No hook-based prompt injection |
| Lib files (.js) | 10+ | No runtime code changes |
| Test files | 12+ existing | Existing tests unaffected; new tests added |
| Config files | 3 | No config schema changes |
| Installer scripts | 6 | Framework install unchanged |
| Skill .md files | 229 | Skills are not affected |

---

## 8. Constitutional Compliance Assessment

| Article | Status | Notes |
|---------|--------|-------|
| I (Specification Primacy) | COMPLIANT | Requirements spec (REQ-001 to REQ-007) drives implementation |
| IV (Explicit Over Implicit) | COMPLIANT | No ambiguities in requirements; format spec is explicit |
| V (Simplicity First) | COMPLIANT | Text-only prompts, no runtime engine, no config registry |
| VII (Artifact Traceability) | COMPLIANT | All changes trace to REQ-001 through REQ-007 |
| VIII (Documentation Currency) | COMPLIANT | Prompt section is self-documenting in agent files |
| IX (Gate Integrity) | COMPLIANT | No gate changes; prompt emission is after gate pass |
| XII (Cross-Platform) | COMPLIANT | ASCII-only output (NFR-005) |
| XIII (Module System) | COMPLIANT | No code changes, only markdown |
| XIV (State Management) | COMPLIANT | No state schema changes (NFR-006) |

---

## 9. Recommendations

1. **Templatize the prompt section**: Create a single reference template that all agents follow, with dynamic placeholders for workflow-specific values. This prevents format drift.

2. **Sub-agents get minimal prompts**: Sub-agents (discover/*, impact-analysis/*, tracing/*) should emit simple status messages like "Analysis complete. Returning results to orchestrator." They should NOT emit workflow navigation prompts since they do not interact directly with the user.

3. **Test format consistency**: Add a validation test that scans all agent .md files for the `# SUGGESTED PROMPTS` section and verifies the format follows the specification (numbered prompts, `---` delimiters).

4. **Implement orchestrator first**: The orchestrator defines the canonical format and emission protocol. All other agents follow. Implement top-down.

5. **Dynamic over static**: Every prompt that references a phase name or number MUST read from `active_workflow` at runtime. No hardcoded phase references.
