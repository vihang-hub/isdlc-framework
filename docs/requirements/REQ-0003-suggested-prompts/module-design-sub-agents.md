# Module Design: Sub-Agent Minimal Prompt Sections

**Artifact ID:** REQ-0003-suggested-prompts
**Phase:** 04 - Design
**Components:** 17 Sub-Agent Markdown Files
**Created:** 2026-02-08
**Status:** Final

---

## 1. Overview

Sub-agents operate within a parent orchestrator's delegation context. They perform analysis and return structured results to their parent -- they do NOT interact directly with the user for workflow navigation. Per ADR-005, sub-agents emit a single-line STATUS message, not a multi-option prompt block.

### 1.1 Sub-Agent Classification

| Group | Parent Orchestrator | Agent Files | Count |
|-------|-------------------|-------------|-------|
| Discover sub-agents | discover-orchestrator | architecture-analyzer, test-evaluator, constitution-generator, skills-researcher, data-model-analyzer, product-analyst, architecture-designer, feature-mapper, characterization-test-generator, artifact-integration, atdd-bridge | 11 |
| Impact Analysis sub-agents | impact-analysis-orchestrator | impact-analyzer, entry-point-finder, risk-assessor | 3 |
| Tracing sub-agents | tracing-orchestrator | symptom-analyzer, execution-path-tracer, root-cause-identifier | 3 |
| **Total** | | | **17** |

---

## 2. Universal Sub-Agent Template

Every sub-agent's `# SUGGESTED PROMPTS` section uses this minimal template:

```markdown
# SUGGESTED PROMPTS

At the end of your work, emit a minimal status line. Do NOT emit workflow navigation
prompts -- you report to your parent orchestrator, not to the user.

## Output Format

---
STATUS: {task_description} complete. Returning results to {parent_orchestrator_name}.
---
```

### 2.1 Template Variables

| Variable | Description | Determined By |
|----------|-------------|---------------|
| `{task_description}` | Brief description of what the sub-agent did | Agent's primary purpose (static per agent) |
| `{parent_orchestrator_name}` | Name of the parent orchestrator | Agent's parent (static per agent) |

### 2.2 Key Constraints

1. **No numbered `[N]` items** -- sub-agents emit a STATUS line, not a selection menu
2. **No dynamic phase resolution** -- sub-agents do not read `active_workflow.phases`
3. **No workflow navigation** -- sub-agents never suggest "Continue to Phase X"
4. **Always the same format** -- regardless of whether the sub-agent is invoked within a workflow or directly

---

## 3. Per-Sub-Agent Customization

### 3.1 Discover Sub-Agents

| Agent File | Task Description | Parent Name |
|------------|-----------------|-------------|
| `discover/architecture-analyzer.md` | Architecture analysis | discover orchestrator |
| `discover/test-evaluator.md` | Test evaluation | discover orchestrator |
| `discover/constitution-generator.md` | Constitution generation | discover orchestrator |
| `discover/skills-researcher.md` | Skills research | discover orchestrator |
| `discover/data-model-analyzer.md` | Data model analysis | discover orchestrator |
| `discover/product-analyst.md` | Product analysis | discover orchestrator |
| `discover/architecture-designer.md` | Architecture design | discover orchestrator |
| `discover/feature-mapper.md` | Feature mapping and behavior extraction | discover orchestrator |
| `discover/characterization-test-generator.md` | Characterization test generation | discover orchestrator |
| `discover/artifact-integration.md` | Artifact integration | discover orchestrator |
| `discover/atdd-bridge.md` | ATDD bridge setup | discover orchestrator |

### 3.2 Impact Analysis Sub-Agents

| Agent File | Task Description | Parent Name |
|------------|-----------------|-------------|
| `impact-analysis/impact-analyzer.md` | Impact analysis | impact analysis orchestrator |
| `impact-analysis/entry-point-finder.md` | Entry point analysis | impact analysis orchestrator |
| `impact-analysis/risk-assessor.md` | Risk assessment | impact analysis orchestrator |

### 3.3 Tracing Sub-Agents

| Agent File | Task Description | Parent Name |
|------------|-----------------|-------------|
| `tracing/symptom-analyzer.md` | Symptom analysis | tracing orchestrator |
| `tracing/execution-path-tracer.md` | Execution path tracing | tracing orchestrator |
| `tracing/root-cause-identifier.md` | Root cause identification | tracing orchestrator |

---

## 4. Insertion Points

### 4.1 Discover Sub-Agents

Discover sub-agents all end with a `## Skills` table. The prompt section is appended after the skills table at the very end of the file.

| Agent File | Current Last Line | Insert At |
|------------|-------------------|-----------|
| `architecture-analyzer.md` | Skills table (line ~408) | End of file |
| `test-evaluator.md` | Skills table (line ~429) | End of file |
| `constitution-generator.md` | Skills table (line ~342) | End of file |
| `skills-researcher.md` | Skills table (line ~351) | End of file |
| `data-model-analyzer.md` | Skills table (line ~307) | End of file |
| `product-analyst.md` | Skills table (line ~412) | End of file |
| `architecture-designer.md` | Skills table (line ~398) | End of file |
| `feature-mapper.md` | (end of content, line ~804) | End of file |
| `characterization-test-generator.md` | (end of content, line ~476) | End of file |
| `artifact-integration.md` | (end of content, line ~313) | End of file |
| `atdd-bridge.md` | (end of content, line ~369) | End of file |

### 4.2 Impact Analysis Sub-Agents

These agents end with a self-validation section or an upgrade-specific section. The prompt section is appended after the last existing section.

| Agent File | Current Last Section | Insert At |
|------------|---------------------|-----------|
| `impact-analyzer.md` | "Upgrade Self-Validation" (line ~505) | End of file |
| `entry-point-finder.md` | "Upgrade Self-Validation" (line ~604) | End of file |
| `risk-assessor.md` | "Upgrade Self-Validation" (line ~633) | End of file |

### 4.3 Tracing Sub-Agents

These agents end with a self-validation section and a closing motivational line.

| Agent File | Current Last Content | Insert At |
|------------|---------------------|-----------|
| `symptom-analyzer.md` | Closing line: "You analyze symptoms thoroughly..." (line 315) | Before closing line |
| `execution-path-tracer.md` | Closing line: "You trace execution paths precisely..." (line 373) | Before closing line |
| `root-cause-identifier.md` | Closing line: "You identify root causes precisely..." (line 397) | Before closing line |

---

## 5. Example: Complete Section for `impact-analyzer.md`

```markdown
# SUGGESTED PROMPTS

At the end of your work, emit a minimal status line. Do NOT emit workflow navigation
prompts -- you report to your parent orchestrator, not to the user.

## Output Format

---
STATUS: Impact analysis complete. Returning results to impact analysis orchestrator.
---
```

---

## 6. Example: Complete Section for `symptom-analyzer.md`

```markdown
# SUGGESTED PROMPTS

At the end of your work, emit a minimal status line. Do NOT emit workflow navigation
prompts -- you report to your parent orchestrator, not to the user.

## Output Format

---
STATUS: Symptom analysis complete. Returning results to tracing orchestrator.
---
```

---

## 7. Estimated Line Impact

| Group | Files | Lines Per File | Total Lines |
|-------|-------|---------------|-------------|
| Discover sub-agents | 11 | ~10 | ~110 |
| Impact analysis sub-agents | 3 | ~10 | ~30 |
| Tracing sub-agents | 3 | ~10 | ~30 |
| **Total** | **17** | | **~170** |

---

## 8. Traceability

| Design Element | Requirements | ADRs | AC |
|----------------|-------------|------|-----|
| Minimal STATUS format | REQ-004 | ADR-005 | - |
| No navigation prompts | REQ-004 | ADR-005 | - |
| Consistent format | REQ-005 | ADR-004 | AC-003-01 |
| Backward compatible | CON-003 | ADR-001 | AC-005-03 |
| Parent orchestrator reference | REQ-004 | ADR-005 | - |
