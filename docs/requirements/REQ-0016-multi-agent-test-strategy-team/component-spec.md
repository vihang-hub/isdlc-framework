# Component Specifications: Multi-agent Test Strategy Team (REQ-0016)

**Version**: 1.0
**Created**: 2026-02-15
**Phase**: 04-design
**Traces**: FR-01 through FR-07

---

## 1. Reusable Patterns

This feature does not introduce new reusable components. Instead, it reuses existing patterns from the debate team infrastructure. This section documents which patterns are reused and how they are applied.

### 1.1 Critic Agent Pattern

**Source**: `src/claude/agents/03-design-critic.md`
**Reused by**: `04-test-strategy-critic.md`

| Pattern Element | Source | Application |
|----------------|--------|-------------|
| Frontmatter structure | design-critic | Same fields: name, description, model, owned_skills |
| Critique process (5 steps) | design-critic | Read artifacts -> Mandatory checks -> Constitutional checks -> Metrics -> Report |
| Output format (round-N-critique.md) | design-critic | Same template: header, summary table, BLOCKING findings, WARNING findings |
| Finding ID scheme (B-NNN, W-NNN) | design-critic | Same sequential numbering, per-round reset |
| Rules section | design-critic | Same 9 rules adapted to test strategy domain |

**Adaptation for test strategy domain**:
- DC-01..DC-08 (design checks) replaced with TC-01..TC-08 (test strategy checks)
- Design metrics replaced with test strategy metrics (AC coverage, pyramid levels, etc.)
- Artifact references changed from interface-spec.yaml to test-strategy.md etc.

### 1.2 Refiner Agent Pattern

**Source**: `src/claude/agents/03-design-refiner.md`
**Reused by**: `04-test-strategy-refiner.md`

| Pattern Element | Source | Application |
|----------------|--------|-------------|
| Frontmatter structure | design-refiner | Same fields |
| Refinement process (6 steps) | design-refiner | Parse critique -> Address BLOCKING -> Address WARNING -> Escalation -> Update artifacts -> Change log |
| Fix strategy table | design-refiner | Same structure: finding category -> fix action -> target artifact |
| Change log format | design-refiner | Same template: round, timestamp, findings addressed, table of changes |
| Rules section | design-refiner | Same 8 rules adapted to test strategy domain |
| Escalation protocol | design-refiner | Same [NEEDS CLARIFICATION] marker and convergence semantics |

### 1.3 Creator Awareness Pattern

**Source**: `src/claude/agents/01-requirements-analyst.md` (lines 28-98)
**Reused by**: `04-test-design-engineer.md` (modification)

| Pattern Element | Source | Application |
|----------------|--------|-------------|
| Mode Detection block | requirements-analyst | Same IF/ELSE structure for DEBATE_CONTEXT |
| Round labeling | requirements-analyst | Same "Round {N} Draft" metadata in each artifact |
| Skip final save menu | requirements-analyst | Same instruction to end with "Round {N} artifacts produced" |
| Round > 1 behavior | requirements-analyst | Same baseline-from-Refiner logic |

**Adaptation**:
- Artifact names changed (test-strategy.md instead of requirements-spec.md)
- Section markers added specific to TC-01..TC-08 check categories (not in requirements-analyst)

### 1.4 DEBATE_ROUTING Table Pattern

**Source**: Existing 3-row DEBATE_ROUTING table in orchestrator
**Reused by**: New row for 05-test-strategy

| Pattern Element | Source | Application |
|----------------|--------|-------------|
| Table columns | orchestrator | Same 6 columns: Phase Key, Creator, Critic, Refiner, Phase Artifacts, Critical Artifact |
| Lookup logic | orchestrator | Same string-match on phase key |
| Debate engine | orchestrator | Reused unchanged (no code modifications) |

### 1.5 CJS Test Pattern

**Source**: `src/claude/hooks/tests/tasks-format-validation.test.cjs`
**Reused by**: `test-strategy-debate-team.test.cjs`

| Pattern Element | Source | Application |
|----------------|--------|-------------|
| Module imports | tasks-format-validation | Same: node:test, node:assert/strict, node:fs |
| File reading pattern | tasks-format-validation | Same: readFileSync with utf-8 encoding |
| Regex-based validation | tasks-format-validation | Same: regex patterns for markdown content validation |
| describe/it structure | tasks-format-validation | Same: nested describe blocks with it test cases |
| Fixture generators | tasks-format-validation | Same approach: functions that return test data |

---

## 2. Agent File Naming Convention

All agent files follow the `{NN}-{role}.md` convention:

| Phase Key | File Prefix | Agents |
|-----------|-------------|--------|
| 01-requirements | `01-` | requirements-analyst, requirements-critic, requirements-refiner |
| 03-architecture | `02-` | solution-architect, architecture-critic, architecture-refiner |
| 04-design | `03-` | system-designer, design-critic, design-refiner |
| 05-test-strategy | `04-` | test-design-engineer, **test-strategy-critic**, **test-strategy-refiner** |
| 06-implementation | `05-` | software-developer, implementation-reviewer, implementation-updater |

The new agents use `04-` prefix per ADR-0005.

---

## 3. Critique Report Component

The critique report is a reusable document format used by all Critic agents. The format is identical across phases; only the domain-specific content changes.

### Template

```markdown
# Round {N} Critique Report

**Round:** {N}
**Phase:** {phase_key}
**Reviewed At:** {ISO timestamp}
**Artifacts Reviewed:**
- {artifact_1} (Round {N} Draft)
- {artifact_2}
- ...

## Summary

| Metric | Value |
|--------|-------|
| Total Findings | {X} |
| BLOCKING | {Y} |
| WARNING | {Z} |
| {domain_metric_1} | {value} |
| {domain_metric_2} | {value} |

## BLOCKING Findings

### B-{NNN}: {Short Title}

**Target:** {artifact, section, module}
**Category:** {check_id}
**Issue:** {description}
**Recommendation:** {fix recommendation}

## WARNING Findings

### W-{NNN}: {Short Title}

**Target:** {artifact, section, module}
**Category:** {check_id}
**Issue:** {description}
**Recommendation:** {improvement recommendation}
```

### Phase 05 Domain Metrics

| Metric | Definition | Used By |
|--------|-----------|---------|
| AC Coverage Percent | (ACs with test cases / total ACs) * 100 | TC-01 |
| Test Pyramid Levels | Count of distinct test levels | TC-02 |
| Negative Test Ratio | Negative tests / total tests | TC-03 |
| Flaky Risk Count | Unmitigated flaky risks | TC-05 |
| Error Path Coverage | (Error paths tested / total error paths) * 100 | TC-06 |

---

## 4. Change Log Component

The change log is a reusable section appended by all Refiner agents to the primary artifact.

### Template

```markdown
## Changes in Round {N}

**Round:** {N}
**Refiner Action:** {ISO timestamp}
**Findings Addressed:** {X} BLOCKING, {Y} WARNING

| Finding | Severity | Action | Target | Description |
|---------|----------|--------|--------|-------------|
| {id} | {severity} | {action} | {target} | {description} |
```

### Action Values

| Action | Meaning |
|--------|---------|
| Completed | Finding fully resolved |
| Added | New content added to address finding |
| Extended | Existing content expanded |
| Escalated | Marked [NEEDS CLARIFICATION] -- needs user input |
| Skipped | WARNING finding intentionally not addressed (with reason) |

---

## 5. Skills Manifest Agent Entry Component

Agent entries in skills-manifest.json follow a consistent JSON schema:

```json
{
  "agent_name": {
    "agent_id": "NN",
    "phase": "NN-phase-key",
    "skill_count": N,
    "skills": ["SKILL-NNN", "SKILL-NNN"]
  }
}
```

### Validation Rules for Agent Entries

| Field | Type | Constraint |
|-------|------|-----------|
| agent_id | string | 2-character numeric string matching file prefix |
| phase | string | Valid phase key from workflow phases list |
| skill_count | integer | Must equal skills array length |
| skills | array of strings | Each must be an existing skill ID in the manifest |
