# Test Cases: TC-13 - Agent Inventory Validation

**Validation Rules:** Meta (supports all VRs)
**Priority:** Critical
**Traced Requirements:** REQ-003 (all 36 agent files)

---

## TC-13-01: Exactly 36 agent markdown files exist

**Description:** The `src/claude/agents/` directory tree contains exactly 36 `.md` files.

**Preconditions:** Repository checked out.

**Steps:**
1. Glob for `**/*.md` files within `src/claude/agents/`
2. Count results

**Expected Result:** Exactly 36 files.

**File list for verification:**
```
src/claude/agents/00-sdlc-orchestrator.md
src/claude/agents/01-requirements-analyst.md
src/claude/agents/02-solution-architect.md
src/claude/agents/03-system-designer.md
src/claude/agents/04-test-design-engineer.md
src/claude/agents/05-software-developer.md
src/claude/agents/06-integration-tester.md
src/claude/agents/07-qa-engineer.md
src/claude/agents/08-security-compliance-auditor.md
src/claude/agents/09-cicd-engineer.md
src/claude/agents/10-dev-environment-engineer.md
src/claude/agents/11-deployment-engineer-staging.md
src/claude/agents/12-release-manager.md
src/claude/agents/13-site-reliability-engineer.md
src/claude/agents/14-upgrade-engineer.md
src/claude/agents/quick-scan/quick-scan-agent.md
src/claude/agents/discover-orchestrator.md
src/claude/agents/discover/architecture-analyzer.md
src/claude/agents/discover/architecture-designer.md
src/claude/agents/discover/artifact-integration.md
src/claude/agents/discover/atdd-bridge.md
src/claude/agents/discover/characterization-test-generator.md
src/claude/agents/discover/constitution-generator.md
src/claude/agents/discover/data-model-analyzer.md
src/claude/agents/discover/feature-mapper.md
src/claude/agents/discover/product-analyst.md
src/claude/agents/discover/skills-researcher.md
src/claude/agents/discover/test-evaluator.md
src/claude/agents/impact-analysis/impact-analysis-orchestrator.md
src/claude/agents/impact-analysis/impact-analyzer.md
src/claude/agents/impact-analysis/entry-point-finder.md
src/claude/agents/impact-analysis/risk-assessor.md
src/claude/agents/tracing/tracing-orchestrator.md
src/claude/agents/tracing/symptom-analyzer.md
src/claude/agents/tracing/execution-path-tracer.md
src/claude/agents/tracing/root-cause-identifier.md
```

---

## TC-13-02: Classification counts match expected

**Description:** When all 36 files are classified, the counts match the expected distribution.

**Steps:**
1. Apply the `classifyAgentFile()` function to all 36 files
2. Count results per classification

**Expected Result:**
| Classification | Expected Count |
|---------------|---------------|
| orchestrator | 1 |
| sub-orchestrator | 3 |
| phase-agent | 15 (numbered agents, excluding orchestrator) + 1 (quick-scan) = 16 |
| sub-agent | 17 (11 discover + 3 IA + 3 tracing) |
| **Total unique files** | **36** |
| **Total classifications** | **37** (orchestrator is also counted for prompt section validation) |

**Note:** The orchestrator (00-sdlc-orchestrator) is classified as `orchestrator` and gets special treatment (PROMPT EMISSION PROTOCOL instead of SUGGESTED PROMPTS). The 15 remaining numbered phase agents + quick-scan = 16 `phase-agent` files.
