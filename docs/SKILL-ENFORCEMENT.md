# Skill Observability (formerly Skill Enforcement)

**Status**: Complete
**Date Implemented**: 2026-01-18 (v1.0), 2026-02-05 (v3.0 — Observability Model)
**Version**: 3.0.0

---

## Overview

Skill Observability provides visibility into agent delegation patterns. Each of the 233 skills has a **primary agent**, and all usage is logged for audit and visibility. Cross-phase delegations are allowed but flagged in logs.

**Key change in v3.0**: Skill IDs are now **event identifiers** for logging/visibility, not access-control tokens. The PreToolUse hook never blocks — it only observes.

---

## What Problem Does This Solve?

### Before Skill Observability (v1.0)
- Skills were documented but not tracked
- No audit trail of skill usage
- No visibility into cross-phase delegation patterns

### After Skill Observability (v3.0)
- Each skill has a **primary agent** (documented, not enforced)
- **Runtime observability via Claude Code hooks**
- All usage is logged to state.json automatically
- Cross-phase usage is allowed but flagged in logs
- Clear visibility and audit trail for gate reviews

---

## Runtime Hook Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    OBSERVABILITY FLOW                          │
├─────────────────────────────────────────────────────────────┤
│  1. Agent invokes Task tool to delegate to another agent     │
│  2. PreToolUse hook (skill-validator.js) observes            │
│  3. Hook script checks:                                      │
│     - Which agent is being invoked                           │
│     - Which phase is active                                  │
│     - Whether agent matches the current phase                │
│  4. Always allows — exit 0 with no output                    │
│  5. PostToolUse hook (log-skill-usage.js) logs all calls     │
│  6. Cross-phase usage flagged as "cross-phase-usage" in log  │
└─────────────────────────────────────────────────────────────┘
```

### Hook Files (Node.js - Cross-Platform)

| File | Purpose |
|------|---------|
| `.claude/hooks/skill-validator.js` | PreToolUse observability hook — always allows |
| `.claude/hooks/log-skill-usage.js` | PostToolUse hook — logs all Task tool usage |
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

### 1. Primary Agent Definition

Each agent's YAML frontmatter includes an `owned_skills` array (documenting primary skills):

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

Each skill's YAML frontmatter includes an `owner` field (primary agent):

```yaml
---
name: code-implementation
skill_id: DEV-001
owner: software-developer
---
```

### 2. Central Manifest

The `skills-manifest.json` provides authoritative skill-to-agent mappings:

```json
{
  "version": "3.0.0",
  "total_skills": 233,
  "enforcement_mode": "observe"
}
```

### 3. Observability Logging

All agent delegations are logged to `.isdlc/state.json`:

```json
{
  "skill_usage_log": [
    {
      "timestamp": "2026-02-05T10:15:00.000Z",
      "agent": "software-developer",
      "agent_phase": "06-implementation",
      "current_phase": "06-implementation",
      "description": "Implement feature",
      "status": "executed",
      "reason": "authorized-phase-match",
      "enforcement_mode": "observe"
    },
    {
      "timestamp": "2026-02-05T10:20:00.000Z",
      "agent": "requirements-analyst",
      "agent_phase": "01-requirements",
      "current_phase": "06-implementation",
      "description": "Clarify requirement",
      "status": "observed",
      "reason": "cross-phase-usage",
      "enforcement_mode": "observe"
    }
  ]
}
```

---

## Observability Modes

### Observe Mode (Default)
- All access is **allowed**
- Cross-phase usage logged with status `"observed"`, reason `"cross-phase-usage"`
- Same-phase usage logged with status `"executed"`, reason `"authorized-phase-match"`
- **Use for**: All projects (recommended default)

### Warn Mode
- All access is **allowed**
- Cross-phase usage logged with status `"warned"`
- Flagged for review at phase gate
- **Use for**: Projects wanting visibility into cross-phase patterns

### Audit Mode
- All access is **allowed**
- All usage logged for analysis only
- No warnings, observation only
- **Use for**: Silent monitoring

### Strict Mode (Deprecated)
- **Behaves same as observe mode** in v3.0
- Kept for backward compatibility — existing projects with `mode: 'strict'` will silently switch to observability behavior
- No blocking occurs

Configure in `.isdlc/state.json`:
```json
{
  "skill_enforcement": {
    "enabled": true,
    "mode": "observe",
    "fail_behavior": "allow",
    "manifest_version": "3.0.0"
  }
}
```

---

## Gate Integration

At each phase gate, skill usage is reviewed:

1. **Review skill_usage_log** for the completed phase
2. **Summarize patterns**: Same-phase vs cross-phase usage
3. **Include in gate report**:
   ```
   Skill Observability Summary:
   - Total delegations: 15
   - Same-phase: 12 (80%)
   - Cross-phase: 3 (flagged in log)
     - requirements-analyst used during 06-implementation
     - security-compliance-auditor used during 06-implementation
     - test-design-engineer used during 06-implementation
   ```
4. **Gate decision**: Cross-phase usage does NOT fail gates — it is informational

---

## Skill Distribution

### By Agent (233 skills across 37 agents)

| Agent | Skills | Categories |
|-------|--------|------------|
| 00 - SDLC Orchestrator | 12 | orchestration/ |
| 01 - Requirements Analyst | 11 | requirements/ |
| 02 - Solution Architect | 13 | architecture/, documentation/ |
| 03 - System Designer | 11 | design/, documentation/ |
| 04 - Test Design Engineer | 9 | testing/ (planning) |
| 05 - Software Developer | 14 | development/ |
| 06 - Integration Tester | 8 | testing/ (execution) |
| 07 - QA Engineer | 1 | development/ (code-review) |
| 08 - Security & Compliance Auditor | 13 | security/ |
| 09 - CI/CD Engineer | 6 | devops/ (pipelines) |
| 10 - Environment Builder | 7 | devops/, documentation/ |
| 11 - Deployment Engineer (Staging) | 4 | devops/, documentation/ |
| 12 - Release Manager | 5 | devops/, documentation/ |
| 13 - Site Reliability Engineer | 14 | operations/, documentation/ |
| 14 - Upgrade Engineer | 6 | upgrade/ |

---

## Files

### Hook Files (v3.0 - Observability, Node.js)

| File | Purpose | Lines |
|------|---------|-------|
| `.claude/hooks/skill-validator.js` | PreToolUse observability hook (Node.js) | ~170 |
| `.claude/hooks/log-skill-usage.js` | PostToolUse logging hook (Node.js) | ~130 |
| `.claude/hooks/lib/common.js` | Shared utilities (Node.js) | ~250 |
| `.claude/settings.json` | Hook configuration | ~25 |
| `config/skills-manifest.json` | JSON manifest for runtime | ~700 |
| `.claude/hooks/tests/test-skill-validator.js` | Test suite (Node.js) | ~470 |

---

## Usage Examples

### Example 1: Same-Phase Usage
```
Agent: software-developer
Phase: 06-implementation
Current Phase: 06-implementation

Result: ALLOWED (same-phase match)
Logged: status: "executed", reason: "authorized-phase-match"
```

### Example 2: Cross-Phase Usage
```
Agent: requirements-analyst
Phase: 01-requirements
Current Phase: 06-implementation

Result: ALLOWED (cross-phase — observed)
Logged: status: "observed", reason: "cross-phase-usage"
```

### Example 3: Orchestrator
```
Agent: sdlc-orchestrator
Phase: all
Current Phase: 06-implementation

Result: ALLOWED (orchestrator — always authorized)
Logged: status: "executed", reason: "authorized-orchestrator"
```

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
| skill-validator.js | 8 |
| log-skill-usage.js | 4 |
| Integration | 1 |
| **Total** | **20** |

---

## Enhancement History

| Enhancement | Description | Status |
|-------------|-------------|--------|
| #1 | Project Constitution | Complete |
| #2 | Scale-Adaptive Tracks | Complete |
| #3 | Autonomous Iteration | Complete |
| #4 | Skill Enforcement (Prompt-based) | Complete |
| #4b | Skill Enforcement (Runtime Hooks) | Complete |
| **#4c** | **Skill Observability (v3.0)** | **Complete** |

---

## Migration from v2.0 (Enforcement) to v3.0 (Observability)

Projects upgrading from v2.0:
1. Update `skills-manifest.json` → `enforcement_mode: "observe"` (or leave as `strict` — it now behaves the same)
2. Update `state.json` → `skill_enforcement.mode: "observe"`
3. No code changes needed — hooks handle the transition automatically
4. Cross-phase usage that was previously blocked will now be allowed and logged

---

**Version**: 3.0.0
**Last Updated**: 2026-02-05
**Author**: iSDLC Framework
