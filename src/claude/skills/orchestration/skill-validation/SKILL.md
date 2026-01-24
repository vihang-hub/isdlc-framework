---
name: skill-validation
description: Validate skill ownership before execution and log skill usage
skill_id: ORCH-010
owner: sdlc-orchestrator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Before any skill execution, during gate validation, audit reviews
dependencies: []
---

# Skill Validation

## Purpose
Validate that an agent owns a skill before allowing execution, and maintain an audit trail of all skill usage attempts in the project state.

## When to Use
- **Pre-execution check**: Before any agent uses a skill
- **Gate validation**: Review skill usage compliance at phase gates
- **Audit review**: Generate skill usage reports
- **Violation detection**: Identify and report unauthorized access attempts

## Prerequisites
- `.isdlc/state.json` exists with `skill_enforcement` configuration
- `src/isdlc/config/skills-manifest.yaml` is accessible
- Agent has `owned_skills` defined in its YAML frontmatter

## Process

### Step 1: Load Enforcement Configuration
```
Read `.isdlc/state.json` → skill_enforcement:
- enabled: boolean
- mode: "strict" | "warn" | "audit"
- manifest_version: string

If not enabled, skip validation (allow all).
```

### Step 2: Validate Skill Ownership
```
Given:
- requesting_agent: string (e.g., "software-developer")
- skill_id: string (e.g., "DEV-001")

Lookup in skills-manifest.yaml:
- Find skill_id in skill_lookup section
- Get owner_agent from mapping

Validate:
- IF requesting_agent == owner_agent → AUTHORIZED
- ELSE → UNAUTHORIZED
```

### Step 3: Apply Enforcement Mode
```
Based on mode:

STRICT:
- AUTHORIZED → Allow execution, log success
- UNAUTHORIZED → Block execution, log violation, escalate

WARN:
- AUTHORIZED → Allow execution, log success
- UNAUTHORIZED → Allow execution, log warning

AUDIT:
- AUTHORIZED → Allow execution, log success
- UNAUTHORIZED → Allow execution, log info only
```

### Step 4: Log Usage
```
Append to `.isdlc/state.json` → skill_usage_log:
{
  "timestamp": "ISO-8601",
  "agent": "requesting-agent-name",
  "skill_id": "SKILL-ID",
  "skill_name": "skill-name",
  "phase": "current-phase",
  "status": "executed" | "denied" | "warned",
  "reason": "owned" | "unauthorized",
  "enforcement_mode": "strict" | "warn" | "audit"
}
```

### Step 5: Return Result
```
Return validation result:
{
  "allowed": boolean,
  "reason": "owned" | "unauthorized",
  "owner": "actual-owner-agent",
  "action_taken": "executed" | "blocked" | "warned" | "logged"
}
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| requesting_agent | string | Yes | Agent attempting to use skill |
| skill_id | string | Yes | Skill ID (e.g., DEV-001) |
| skill_name | string | No | Human-readable skill name |
| phase | string | Yes | Current SDLC phase |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| allowed | boolean | Whether execution is permitted |
| reason | string | "owned" or "unauthorized" |
| owner | string | Actual skill owner agent |
| action_taken | string | What enforcement action was taken |
| log_entry | object | The log entry written to state.json |

## Enforcement Modes

### Strict Mode (Default)
- Unauthorized access is **blocked**
- Violation is logged with status `"denied"`
- Escalation to human may be triggered
- Use for: Production projects, compliance-critical work

### Warn Mode
- Unauthorized access is **allowed with warning**
- Logged with status `"warned"`
- No blocking, but flagged for review
- Use for: Migration period, testing enforcement

### Audit Mode
- All access is **allowed**
- All usage is logged for analysis
- No enforcement, observation only
- Use for: Initial rollout, usage pattern analysis

## Gate Validation Integration

At each phase gate, the orchestrator should:

1. **Review skill_usage_log** for the completed phase
2. **Count violations**: entries with `reason: "unauthorized"`
3. **Include in gate report**:
   ```
   Skill Enforcement Summary:
   - Total skills used: 15
   - Authorized: 14
   - Violations: 1 (DEV-015 used by software-developer, owned by qa-engineer)
   ```
4. **Gate decision**: In strict mode, violations may fail the gate

## Examples

### Example 1: Authorized Access
```
Input:
  requesting_agent: "software-developer"
  skill_id: "DEV-001"
  phase: "05-implementation"

Validation:
  DEV-001 owner: "software-developer" ✓

Output:
  allowed: true
  reason: "owned"
  action_taken: "executed"
```

### Example 2: Unauthorized Access (Strict Mode)
```
Input:
  requesting_agent: "software-developer"
  skill_id: "SEC-001"
  phase: "05-implementation"

Validation:
  SEC-001 owner: "security-compliance-auditor" ✗

Output:
  allowed: false
  reason: "unauthorized"
  owner: "security-compliance-auditor"
  action_taken: "blocked"

Log Entry:
  {
    "timestamp": "2026-01-17T14:30:00Z",
    "agent": "software-developer",
    "skill_id": "SEC-001",
    "skill_name": "security-architecture-review",
    "phase": "05-implementation",
    "status": "denied",
    "reason": "unauthorized",
    "enforcement_mode": "strict"
  }

Escalation Message:
  "SKILL ACCESS DENIED: SEC-001 (security-architecture-review) is owned by
   security-compliance-auditor. Software Developer cannot use this skill.

   Recommended action: Delegate security review tasks to Agent 08
   (Security & Compliance Auditor) via the orchestrator."
```

### Example 3: Unauthorized Access (Warn Mode)
```
Input:
  requesting_agent: "integration-tester"
  skill_id: "DEV-001"
  phase: "06-testing"

Validation:
  DEV-001 owner: "software-developer" ✗

Output:
  allowed: true  # Allowed in warn mode
  reason: "unauthorized"
  owner: "software-developer"
  action_taken: "warned"

Log Entry:
  {
    ...
    "status": "warned",
    "reason": "unauthorized",
    "enforcement_mode": "warn"
  }

Warning Message:
  "SKILL ACCESS WARNING: TEST-006 (integration-tester) using DEV-001
   (code-implementation) which is owned by software-developer.
   Execution allowed but flagged for review."
```

## Skill Manifest Lookup

The skill-validation skill uses `skills-manifest.yaml` for lookups:

```yaml
# Quick lookup by skill_id
skill_lookup:
  DEV-001: software-developer
  DEV-002: software-developer
  SEC-001: security-compliance-auditor
  ...

# Quick lookup by path
path_lookup:
  development/code-implementation: software-developer
  security/security-architecture-review: security-compliance-auditor
  ...
```

## Error Handling

### Skill Not Found
If skill_id is not in the manifest:
- Log warning: "Unknown skill_id: {skill_id}"
- In strict mode: Block and escalate
- In warn/audit mode: Allow with warning

### State File Missing
If `.isdlc/state.json` doesn't exist:
- Cannot validate or log
- Escalate: "Project not initialized. Run init-project.sh first."

### Manifest Missing
If `skills-manifest.yaml` not found:
- Cannot validate ownership
- Default to warn mode behavior
- Log: "Skills manifest not found. Enforcement disabled."

## Integration Points

- **Orchestrator (Agent 00)**: Primary user of this skill for oversight
- **All Phase Agents (01-13)**: Self-validate before skill execution
- **Gate Validation**: Review skill usage at phase completion
- **Audit Reports**: Generate skill usage compliance reports

## Metrics

Track these metrics for enforcement effectiveness:

- **Compliance Rate**: % of skill uses that are authorized
- **Violation Count**: Total unauthorized attempts
- **Violation by Agent**: Which agents attempt unauthorized access most
- **Violation by Skill**: Which skills are most commonly misused
- **Mode Distribution**: How often strict/warn/audit is used

## Related Resources

- **Manifest**: `src/isdlc/config/skills-manifest.yaml`
- **State**: `.isdlc/state.json` → `skill_enforcement`, `skill_usage_log`
- **Orchestrator**: `.claude/agents/00-sdlc-orchestrator.md`
- **Documentation**: `docs/SKILL-ENFORCEMENT.md`

---

**Skill Version**: 1.0.0
**Last Updated**: 2026-01-17
**Author**: iSDLC Framework
