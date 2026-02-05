---
name: autonomous-constitution-validate
description: Enable agents to autonomously iterate on artifacts until constitutional compliance is achieved
skill_id: ORCH-011
owner: sdlc-orchestrator
collaborators: [requirements-analyst, solution-architect, system-designer, test-design-engineer, software-developer, integration-tester, qa-engineer, security-compliance-auditor, cicd-engineer, environment-builder, deployment-engineer-staging, release-manager, site-reliability-engineer]
project: sdlc-framework
version: 1.0.0
when_to_use: Gate validation, constitutional compliance checking
dependencies: []
---

# Autonomous Constitution Validation

**Category**: Orchestration
**Agents**: All 14 agents (Orchestrator enforces, Phase agents iterate)
**Phases**: All phases with quality gates (GATE-01 through GATE-13)
**Purpose**: Enable agents to autonomously iterate on artifacts until constitutional compliance is achieved

---

## Skill Description

This skill extends the autonomous iteration mechanism to **constitutional compliance validation**. When artifacts violate constitutional principles at a gate check, the responsible agent automatically:

1. Analyzes which constitutional articles were violated
2. Identifies the specific violations in artifacts
3. Fixes the artifacts to comply
4. Re-validates until compliance is achieved OR max iterations reached

This prevents immediate gate failure and enables self-correcting behavior for constitutional compliance.

---

## When to Use

### At Every Quality Gate (GATE-01 through GATE-13)

After an agent completes their phase work:
1. Agent performs self-validation including constitutional compliance
2. If violations found: iterate and fix
3. Report to orchestrator only when compliant OR max iterations exceeded

### During Artifact Creation

Agents should proactively validate constitutional compliance as they create artifacts, not just at the gate.

---

## Constitutional Articles Reference

The constitution at `docs/isdlc/constitution.md` typically contains these articles (project-specific):

| Article | Principle | Primary Validators |
|---------|-----------|-------------------|
| **I** | Specification Primacy | Agents 01, 03, 05 |
| **II** | Test-First Development | Agents 04, 05, 06 |
| **III** | Security by Design | Agents 02, 05, 08 |
| **IV** | Explicit Over Implicit | Agents 01, 02, 03 |
| **V** | Simplicity First | Agents 02, 03, 05, 07 |
| **VI** | Code Review Required | Agents 05, 07 |
| **VII** | Artifact Traceability | All agents |
| **VIII** | Documentation Currency | Agents 05, 07, 10, 13 |
| **IX** | Quality Gate Integrity | Orchestrator, all agents |
| **X** | Fail-Safe Defaults | Agents 02, 05, 08 |
| **XI** | Integration Testing Integrity | Agents 04, 06 |
| **XII** | Domain-Specific Compliance | Agents 01, 08, 13 |

---

## Iteration Protocol

### 1. Initialization

```
iteration_count = 0
max_iterations = 5  # Constitutional iterations are separate from test iterations
articles_to_validate = [articles applicable to this phase]
violations_found = []
```

### 2. Validation Loop

**Step 1: Validate Against Constitution**
- Read constitution from `docs/isdlc/constitution.md`
- Check each applicable article against phase artifacts
- Compile list of violations with specific details

**Step 2: Evaluate Results**
- No violations: Exit loop (COMPLIANT)
- Violations found: Proceed to Step 3
- Max iterations reached: Exit loop (ESCALATE)

**Step 3: Analyze Violations**
For each violation, document:
- Which article was violated
- What specific artifact/content violated it
- Why it's a violation
- What needs to change

**Step 4: Fix Violations**
- Make targeted changes to artifacts
- Document changes made
- Increment iteration count

**Step 5: Re-validate**
- Return to Step 1

### 3. Exit Conditions

**Compliant**: All articles pass validation
- Update state.json with compliance status
- Proceed to gate validation
- Document iterations used

**Max Iterations Exceeded**: `iteration_count >= max_iterations`
- Update state.json with failure status
- Document all iteration attempts
- Escalate to human with detailed violation report

---

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| phase_artifacts | Array | Yes | List of artifacts to validate |
| constitution_path | String | No | Path to constitution (default: docs/isdlc/constitution.md) |
| applicable_articles | Array | No | Specific articles to check |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| compliant | Boolean | Whether all articles pass |
| iterations_used | Integer | Number of iterations taken |
| violations_fixed | Array | List of violations that were fixed |
| remaining_violations | Array | Any violations that couldn't be fixed |

---

## Integration with Gates

Each gate validates constitutional compliance before passing:

```yaml
gate_criteria:
  - phase_artifacts_complete: true
  - constitutional_compliance: true  # This skill
  - quality_standards_met: true
```

---

## Safety Mechanisms

### 1. Iteration Limits
- **Max iterations**: 5 (separate from test iterations)
- **Timeout**: 10 minutes total for constitution validation

### 2. Escalation Triggers
- Same violation 3+ times: architectural issue
- Multiple articles violated: scope problem
- Contradictory requirements: needs human review

---

## Related Skills

- **gate-validation** (ORCH-004) - Uses this skill during gate checks
- **autonomous-iterate** (DEV-014) - Similar pattern for test iteration

---

**Skill Version**: 1.0.0
**Last Updated**: 2026-02-05
