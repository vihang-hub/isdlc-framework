# Skill Enforcement (Enhancement #4)

**Status**: Complete
**Date Implemented**: 2026-01-18
**Version**: 2.0.0 (with Runtime Hooks)

---

## Overview

Skill Enforcement implements exclusive skill ownership where each of the 119 skills belongs to exactly one agent. This is now enforced at **runtime** using Claude Code hooks that intercept Task tool calls and validate agent authorization before execution.

---

## What Problem Does This Solve?

### Before Skill Enforcement (v1.0)
- Skills were documented but not enforced
- Any agent could theoretically use any skill
- No audit trail of skill usage
- No accountability for skill misuse
- Unclear ownership for troubleshooting
- Enforcement was purely prompt-based (honor system)

### After Skill Enforcement (v2.0)
- Each skill has exactly ONE owner agent
- **Runtime enforcement via Claude Code hooks**
- Ownership is validated before execution
- All usage is logged to state.json automatically
- Violations are blocked (strict mode) or flagged (warn/audit modes)
- Clear accountability and traceability

---

## Runtime Hook Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ENFORCEMENT FLOW                          │
├─────────────────────────────────────────────────────────────┤
│  1. Agent invokes Task tool to delegate to another agent     │
│  2. PreToolUse hook (skill-validator.sh) intercepts          │
│  3. Hook script validates:                                   │
│     - Which agent is being invoked                           │
│     - Which phase is active                                  │
│     - Whether agent owns skills for that phase               │
│  4. If unauthorized (strict): Block with JSON response       │
│  5. If authorized: Allow and proceed                         │
│  6. PostToolUse hook (log-skill-usage.sh) logs all calls     │
└─────────────────────────────────────────────────────────────┘
```

### Hook Files (Node.js - Cross-Platform)

| File | Purpose |
|------|---------|
| `.claude/hooks/skill-validator.js` | PreToolUse hook - validates agent authorization |
| `.claude/hooks/log-skill-usage.js` | PostToolUse hook - logs all Task tool usage |
| `.claude/hooks/lib/common.js` | Shared utilities (JSON parsing, manifest lookup) |
| `.claude/settings.json` | Hook configuration (matchers, timeouts) |
| `config/skills-manifest.json` | JSON manifest for runtime lookup |

**Note:** Hooks are written in Node.js for cross-platform compatibility (Windows, macOS, Linux).

### Hook Configuration

The hooks are configured in `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Task",
        "hooks": [
          {
            "type": "command",
            "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/skill-validator.js",
            "timeout": 10000
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Task",
        "hooks": [
          {
            "type": "command",
            "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/log-skill-usage.js",
            "timeout": 5000
          }
        ]
      }
    ]
  }
}
```

---

## How It Works

### 1. Ownership Definition

Each agent's YAML frontmatter includes an `owned_skills` array:

```yaml
---
name: software-developer
model: sonnet
owned_skills:
  - DEV-001  # code-implementation
  - DEV-002  # unit-testing
  - DEV-003  # api-implementation
  # ... (14 skills total)
---
```

Each skill's YAML frontmatter includes an `owner` field:

```yaml
---
name: code-implementation
skill_id: DEV-001
owner: software-developer
---
```

### 2. Central Manifest

The `skills-manifest.yaml` provides authoritative skill-to-agent mappings:

```yaml
# isdlc-framework/config/skills-manifest.yaml
version: "2.0.0"
total_skills: 119
enforcement_mode: strict

skill_lookup:
  DEV-001: software-developer
  DEV-002: software-developer
  SEC-001: security-compliance-auditor
  # ...
```

### 3. Validation Protocol

Before using any skill, agents must:

1. Check if the skill_id is in their `owned_skills` list
2. If NOT owned: Stop and report unauthorized access
3. If owned: Proceed and log usage

### 4. Usage Logging

All skill usage is logged to `.isdlc/state.json`:

```json
{
  "skill_usage_log": [
    {
      "timestamp": "2026-01-18T10:15:00Z",
      "agent": "software-developer",
      "skill_id": "DEV-001",
      "skill_name": "code-implementation",
      "phase": "05-implementation",
      "status": "executed",
      "reason": "owned"
    }
  ]
}
```

---

## Enforcement Modes

### Strict Mode (Default)
- Unauthorized access is **blocked**
- Violation logged with status `"denied"`
- Escalation to human triggered
- **Use for**: Production projects, compliance-critical work

### Warn Mode
- Unauthorized access is **allowed with warning**
- Violation logged with status `"warned"`
- Flagged for review at phase gate
- **Use for**: Migration period, testing enforcement

### Audit Mode
- All access is **allowed**
- All usage logged for analysis only
- No enforcement, observation only
- **Use for**: Initial rollout, usage pattern analysis

Configure in `.isdlc/state.json`:
```json
{
  "skill_enforcement": {
    "enabled": true,
    "mode": "strict",
    "fail_behavior": "allow",
    "manifest_version": "2.0.0"
  }
}
```

### Fail Behavior Configuration

The `fail_behavior` setting controls what happens when the hook encounters errors:

| Value | Behavior |
|-------|----------|
| **allow** | If hook errors or times out, allow the operation (prioritize workflow) |
| **block** | If hook errors or times out, block the operation (prioritize security) |

Default is `allow` to ensure workflow continuity.

---

## Skill Distribution

### By Agent (119 skills across 14 agents)

| Agent | Skills | Categories |
|-------|--------|------------|
| 00 - SDLC Orchestrator | 10 | orchestration/ |
| 01 - Requirements Analyst | 10 | requirements/ |
| 02 - Solution Architect | 13 | architecture/, documentation/ |
| 03 - System Designer | 11 | design/, documentation/ |
| 04 - Test Design Engineer | 5 | testing/ (planning) |
| 05 - Software Developer | 14 | development/ |
| 06 - Integration Tester | 8 | testing/ (execution) |
| 07 - QA Engineer | 1 | development/ (code-review) |
| 08 - Security & Compliance Auditor | 13 | security/ |
| 09 - CI/CD Engineer | 6 | devops/ (pipelines) |
| 10 - Dev Environment Engineer | 5 | devops/, documentation/ |
| 11 - Deployment Engineer (Staging) | 4 | devops/, documentation/ |
| 12 - Release Manager | 5 | devops/, documentation/ |
| 13 - Site Reliability Engineer | 14 | operations/, documentation/ |

### Skill ID Prefixes

| Prefix | Category | Owner Agents |
|--------|----------|--------------|
| ORCH-* | Orchestration | Agent 00 |
| REQ-* | Requirements | Agent 01 |
| ARCH-* | Architecture | Agent 02 |
| DES-* | Design | Agent 03 |
| TEST-* | Testing | Agents 04, 06 |
| DEV-* | Development | Agents 05, 07 |
| SEC-* | Security | Agent 08 |
| OPS-* | DevOps | Agents 09-12 |
| SRE-* | Operations | Agent 13 |
| DOC-* | Documentation | Agents 02, 03, 10-13 |

---

## Gate Integration

At each phase gate, skill enforcement is validated:

1. **Review skill_usage_log** for the completed phase
2. **Count violations**: Entries with `reason: "unauthorized"`
3. **Include in gate report**:
   ```
   Skill Enforcement Summary:
   - Total skills used: 15
   - Authorized: 14 (93.3%)
   - Violations: 1
     - DEV-015 used by software-developer (owned by qa-engineer)
   ```
4. **Gate decision**: In strict mode, violations may fail the gate

---

## Files Changed

### New Files (v2.0 - Runtime Hooks, Node.js)

| File | Purpose | Lines |
|------|---------|-------|
| `.claude/hooks/skill-validator.js` | PreToolUse validation hook (Node.js) | ~170 |
| `.claude/hooks/log-skill-usage.js` | PostToolUse logging hook (Node.js) | ~130 |
| `.claude/hooks/lib/common.js` | Shared utilities (Node.js) | ~250 |
| `.claude/settings.json` | Hook configuration | ~25 |
| `config/skills-manifest.json` | JSON manifest for runtime | ~250 |
| `scripts/convert-manifest.sh` | YAML→JSON converter | ~250 |
| `.claude/hooks/tests/test-skill-validator.js` | Test suite (Node.js) | ~350 |
| `.claude/hooks/tests/test-scenarios/*.json` | Test scenarios | ~50 |

### Original Files (v1.0)

- `config/skills-manifest.yaml` (~800 lines)
  - Central ownership manifest with skill_lookup and path_lookup
- `.claude/skills/orchestration/skill-validation/SKILL.md` (~300 lines)
  - Validation skill for orchestrator

### Modified Files

**Agent Files (14)**
All `.claude/agents/*.md` files updated with:
- `owned_skills` array in YAML frontmatter
- `SKILL ENFORCEMENT PROTOCOL` section

**Skill Files (118)**
All `.claude/skills/**/SKILL.md` files updated with:
- `owner` field set to actual agent name

**init-project.sh**
Added:
- Hook setup and copying
- Manifest JSON conversion
- `skill_enforcement.fail_behavior` configuration
- `skill_usage_log` array in state.json

---

## Usage Examples

### Example 1: Authorized Access
```
Agent: software-developer
Skill: DEV-001 (code-implementation)
Phase: 05-implementation

Result: AUTHORIZED
- DEV-001 is in software-developer's owned_skills
- Execution proceeds
- Logged with status: "executed", reason: "owned"
```

### Example 2: Unauthorized Access (Strict Mode)
```
Agent: software-developer
Skill: SEC-001 (security-architecture-review)
Phase: 05-implementation

Result: UNAUTHORIZED
- SEC-001 is owned by security-compliance-auditor
- Execution blocked
- Logged with status: "denied", reason: "unauthorized"
- Message: "SKILL ACCESS DENIED: SEC-001 is owned by
  security-compliance-auditor. Delegate via orchestrator."
```

### Example 3: Cross-Agent Delegation
When an agent needs functionality from a skill it doesn't own:

1. Agent recognizes need for skill outside its ownership
2. Agent requests orchestrator to delegate to owning agent
3. Orchestrator delegates task to correct agent
4. Owning agent executes skill, logs usage
5. Results returned to requesting agent

---

## Metrics

Track enforcement effectiveness:

| Metric | Description |
|--------|-------------|
| Compliance Rate | % of skill uses that are authorized |
| Violation Count | Total unauthorized attempts |
| Violations by Agent | Which agents attempt unauthorized access |
| Violations by Skill | Which skills are commonly misused |
| Mode Usage | Distribution of strict/warn/audit |

---

## Best Practices

### Do's
- **Do** check `owned_skills` before using any skill
- **Do** delegate to the correct agent for skills you don't own
- **Do** log all skill usage, even in audit mode
- **Do** review skill_usage_log at phase gates
- **Do** escalate violations in strict mode

### Don'ts
- **Don't** attempt to use skills you don't own
- **Don't** disable enforcement without project lead approval
- **Don't** modify skill ownership without updating manifest
- **Don't** skip logging in any enforcement mode
- **Don't** ignore violations flagged at gates

---

## Troubleshooting

### "Skill Not Found"
```
Error: Unknown skill_id: XYZ-999
```
- Check skills-manifest.yaml for correct skill_id
- Verify skill file exists in .claude/skills/

### "Enforcement Disabled"
```
Warning: skill_enforcement.enabled is false
```
- Check .isdlc/state.json configuration
- Enabled by default in new projects

### "Manifest Version Mismatch"
```
Warning: manifest_version mismatch (2.0.0 vs 1.0.0)
```
- Update project state.json to match current manifest
- Re-run init-project.sh if needed

---

## Testing

### Running Tests

```bash
# Run the test suite (Node.js - cross-platform)
node .claude/hooks/tests/test-skill-validator.js

# Run with verbose output
node .claude/hooks/tests/test-skill-validator.js --verbose
```

### Test Coverage

| Test Area | Tests |
|-----------|-------|
| common.js utilities | 7 |
| skill-validator.js | 7 |
| log-skill-usage.js | 4 |
| Integration | 1 |
| **Total** | **19** |

### Manual Testing

Test strict mode blocking:
```bash
# Set current phase to 05-implementation in state.json
# Then try to invoke requirements-analyst
# Should see: SKILL ENFORCEMENT: Agent 'requirements-analyst' not authorized...
```

Test warn mode:
```bash
# Update state.json: "mode": "warn"
# Unauthorized agents will be allowed but logged with status: "warned"
```

Test audit mode:
```bash
# Update state.json: "mode": "audit"
# All agents allowed, all usage logged with status: "audited"
```

---

## Related Resources

- **Skills Manifest (YAML)**: `config/skills-manifest.yaml`
- **Skills Manifest (JSON)**: `config/skills-manifest.json`
- **Hook Scripts**: `.claude/hooks/`
- **Hook Tests**: `.claude/hooks/tests/`
- **Validation Skill**: `.claude/skills/orchestration/skill-validation/SKILL.md`
- **Orchestrator**: `.claude/agents/00-sdlc-orchestrator.md`
- **Init Script**: `init-project.sh`

---

## Dependencies

| Dependency | Required | Purpose |
|------------|----------|---------|
| `Node.js` | Yes | Hook script execution (cross-platform) |
| `jq` | No | Used in init-project.sh for settings merge |
| `yq` or Python+PyYAML | No | YAML→JSON conversion (has fallback) |

### Platform Support

| Platform | Status |
|----------|--------|
| macOS | ✓ Full support |
| Linux | ✓ Full support |
| Windows | ✓ Full support (with Node.js) |
| WSL | ✓ Full support |

---

## Troubleshooting

### Hook Not Executing

1. Check `.claude/settings.json` exists and has correct hook configuration
2. Verify hook scripts are executable: `chmod +x .claude/hooks/*.sh`
3. Check `$CLAUDE_PROJECT_DIR` is set correctly

### Node.js Not Found

The hooks require Node.js. Install from https://nodejs.org/ or:

```bash
# macOS (via Homebrew)
brew install node

# Ubuntu/Debian
apt-get install nodejs

# Windows (via Chocolatey)
choco install nodejs
```

### Manifest Not Found

Run the converter script:
```bash
./scripts/convert-manifest.sh
```

### Unexpected Blocking

1. Check enforcement mode in `.isdlc/state.json`
2. Verify current phase matches agent's designated phase
3. Check `skill_usage_log` for recent entries

---

## Enhancement History

| Enhancement | Description | Status |
|-------------|-------------|--------|
| #1 | Project Constitution | Complete |
| #2 | Scale-Adaptive Tracks | Complete |
| #3 | Autonomous Iteration | Complete |
| #4 | Skill Enforcement (Prompt-based) | Complete |
| **#4b** | **Skill Enforcement (Runtime Hooks)** | **Complete** |

---

**Version**: 2.0.0
**Last Updated**: 2026-01-21
**Author**: iSDLC Framework
