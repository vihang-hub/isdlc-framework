---
name: skill-validation
description: Observe and log skill usage for visibility and audit purposes
skill_id: ORCH-010
owner: sdlc-orchestrator
collaborators: []
project: sdlc-framework
version: 3.0.0
when_to_use: During gate validation to review skill usage patterns, audit reviews
dependencies: []
---

# Skill Validation (Observability)

## Purpose
Observe and log agent delegation patterns for visibility and audit. Skill IDs serve as event identifiers — all delegations are allowed, with cross-phase usage flagged in logs.

## When to Use
- **Gate validation**: Review skill usage patterns at phase gates
- **Audit review**: Generate skill usage reports
- **Pattern analysis**: Identify cross-phase delegation patterns

## Prerequisites
- `.isdlc/state.json` exists with `skill_enforcement` configuration
- `config/skills-manifest.json` is accessible
- Agent has `owned_skills` defined in its YAML frontmatter

## Process

### Step 1: Load Observability Configuration
```
Read `.isdlc/state.json` → skill_enforcement:
- enabled: boolean
- mode: "observe" | "warn" | "audit" | "strict" (deprecated)
- manifest_version: string

If not enabled, skip observation.
```

### Step 2: Check Phase Match
```
Given:
- delegated_agent: string (e.g., "software-developer")
- current_phase: string (e.g., "06-implementation")

Lookup in skills-manifest.json:
- Find agent in ownership section
- Get agent_phase from mapping

Check:
- IF agent_phase == current_phase → same-phase match
- IF agent_phase == "all" → orchestrator (always matches)
- IF agent_phase == "setup" → setup agent (always matches)
- ELSE → cross-phase usage (allowed, flagged in log)
```

### Step 3: Log Usage
```
All delegations are logged — no blocking occurs.

Append to `.isdlc/state.json` → skill_usage_log:
{
  "timestamp": "ISO-8601",
  "agent": "delegated-agent-name",
  "agent_phase": "agent-designated-phase",
  "current_phase": "current-workflow-phase",
  "description": "task-description",
  "status": "executed" | "observed" | "warned" | "audited",
  "reason": "authorized-phase-match" | "authorized-orchestrator" | "cross-phase-usage",
  "enforcement_mode": "observe" | "warn" | "audit"
}
```

### Step 4: Return Summary (Gate Reviews)
```
At gate validation, summarize:
{
  "total_delegations": N,
  "same_phase": N,
  "cross_phase": N,
  "cross_phase_details": [
    {"agent": "...", "agent_phase": "...", "current_phase": "..."}
  ]
}
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| delegated_agent | string | Yes | Agent being delegated to |
| current_phase | string | Yes | Current SDLC phase |
| description | string | No | Task description |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| allowed | boolean | Always true (observability model) |
| reason | string | "authorized-phase-match", "authorized-orchestrator", or "cross-phase-usage" |
| log_entry | object | The log entry written to state.json |

## Observability Modes

### Observe Mode (Default)
- All access **allowed**
- Cross-phase logged with status `"observed"`, reason `"cross-phase-usage"`
- Use for: All projects

### Warn Mode
- All access **allowed**
- Cross-phase logged with status `"warned"`
- Use for: Projects wanting extra visibility

### Audit Mode
- All access **allowed**
- All usage logged for analysis
- Use for: Silent monitoring

### Strict Mode (Deprecated)
- Behaves same as observe mode in v3.0
- Kept for backward compatibility

## Gate Validation Integration

At each phase gate, the orchestrator should:

1. **Review skill_usage_log** for the completed phase
2. **Summarize patterns**: Same-phase vs cross-phase usage
3. **Include in gate report**:
   ```
   Skill Observability Summary:
   - Total delegations: 15
   - Same-phase: 12 (80%)
   - Cross-phase: 3 (flagged in log)
   ```
4. **Gate decision**: Cross-phase usage does NOT fail gates — informational only

## Examples

### Example 1: Same-Phase Usage
```
Input:
  delegated_agent: "software-developer"
  current_phase: "06-implementation"

Check:
  software-developer phase: "06-implementation" ✓ match

Log:
  status: "executed"
  reason: "authorized-phase-match"
```

### Example 2: Cross-Phase Usage
```
Input:
  delegated_agent: "requirements-analyst"
  current_phase: "06-implementation"

Check:
  requirements-analyst phase: "01-requirements" ≠ "06-implementation"

Log:
  status: "observed"
  reason: "cross-phase-usage"

Note: Delegation proceeds normally — not blocked.
```

## Integration Points

- **Orchestrator (Agent 00)**: Primary user for gate oversight
- **All Phase Agents**: Usage logged automatically by PostToolUse hook
- **Gate Validation**: Review skill usage at phase completion
- **Audit Reports**: Generate skill usage observability reports

## Related Resources

- **Manifest**: `config/skills-manifest.json`
- **State**: `.isdlc/state.json` → `skill_enforcement`, `skill_usage_log`
- **Orchestrator**: `.claude/agents/00-sdlc-orchestrator.md`
- **Documentation**: `docs/SKILL-ENFORCEMENT.md`

---

**Skill Version**: 3.0.0
**Last Updated**: 2026-02-05
**Author**: iSDLC Framework
