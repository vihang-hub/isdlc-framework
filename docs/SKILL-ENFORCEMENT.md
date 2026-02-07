# Skill Observability (formerly Skill Enforcement)

**Status**: Complete
**Date Implemented**: 2026-01-18 (v1.0), 2026-02-05 (v3.0 — Observability Model)
**Version**: 3.0.0

---

## Overview

Skill Observability provides visibility into agent delegation patterns. Each of the 229 skills has a **primary agent**, and all usage is logged for audit and visibility. Cross-phase delegations are allowed but flagged in logs.

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
          { "type": "command", "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/model-provider-router.js", "timeout": 10000 },
          { "type": "command", "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/iteration-corridor.js", "timeout": 10000 },
          { "type": "command", "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/skill-validator.js", "timeout": 10000 },
          { "type": "command", "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/gate-blocker.js", "timeout": 10000 },
          { "type": "command", "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/constitution-validator.js", "timeout": 10000 }
        ]
      },
      {
        "matcher": "Skill",
        "hooks": [
          { "type": "command", "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/iteration-corridor.js", "timeout": 10000 },
          { "type": "command", "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/gate-blocker.js", "timeout": 10000 }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Task",
        "hooks": [
          { "type": "command", "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/log-skill-usage.js", "timeout": 5000 },
          { "type": "command", "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/menu-tracker.js", "timeout": 5000 }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/test-watcher.js", "timeout": 10000 }
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
  "version": "4.0.0",
  "total_skills": 229,
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
    "manifest_version": "4.0.0"
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

### By Agent (229 skills across 36 agents)

| Group | Agent | Skills | Phase |
|-------|-------|--------|-------|
| Core | 00 - SDLC Orchestrator | 12 | all |
| Core | 01 - Requirements Analyst | 11 | 01-requirements |
| Core | 02 - Solution Architect | 13 | 03-architecture |
| Core | 03 - System Designer | 11 | 04-design |
| Core | 04 - Test Design Engineer | 9 | 05-test-strategy |
| Core | 05 - Software Developer | 14 | 06-implementation |
| Core | 06 - Integration Tester | 8 | 07-testing |
| Core | 07 - QA Engineer | 1 | 08-code-review |
| Core | 08 - Security & Compliance Auditor | 13 | 09-validation |
| Core | 09 - CI/CD Engineer | 6 | 10-cicd |
| Core | 10 - Environment Builder | 7 | 11-local-testing |
| Core | 11 - Deployment Engineer (Staging) | 4 | 12-test-deploy |
| Core | 12 - Release Manager | 5 | 13-production |
| Core | 13 - Site Reliability Engineer | 14 | 14-operations |
| Core | 14 - Upgrade Engineer | 6 | 15-upgrade |
| Discovery | D0 - Discover Orchestrator | 4 | setup |
| Discovery | D1 - Architecture Analyzer | 6 | setup |
| Discovery | D2 - Test Evaluator | 6 | setup |
| Discovery | D3 - Constitution Generator | 4 | setup |
| Discovery | D4 - Skills Researcher | 4 | setup |
| Discovery | D5 - Data Model Analyzer | 4 | setup |
| Discovery | D6 - Feature Mapper | 12 | setup |
| Discovery | D7 - Product Analyst | 4 | setup |
| Discovery | D8 - Architecture Designer | 4 | setup |
| Discovery | R2 - Characterization Test Generator | 7 | setup |
| Discovery | R3 - Artifact Integration | 3 | setup |
| Discovery | R4 - ATDD Bridge | 3 | setup |
| Utility | QS - Quick-Scan Agent | 3 | 00-quick-scan |
| Utility | IA0 - Impact Analysis Orchestrator | 3 | 02-impact-analysis |
| Utility | IA1 - Impact Analyzer | 4 | 02-impact-analysis |
| Utility | IA2 - Entry Point Finder | 4 | 02-impact-analysis |
| Utility | IA3 - Risk Assessor | 4 | 02-impact-analysis |
| Utility | T0 - Tracing Orchestrator | 3 | 02-tracing |
| Utility | T1 - Symptom Analyzer | 4 | 02-tracing |
| Utility | T2 - Execution Path Tracer | 5 | 02-tracing |
| Utility | T3 - Root Cause Identifier | 4 | 02-tracing |

---

## Files

### Hook Files (8 hooks, Node.js)

| File | Trigger | Purpose |
|------|---------|---------|
| `.claude/hooks/model-provider-router.js` | PreToolUse (Task) | Routes to configured LLM provider |
| `.claude/hooks/iteration-corridor.js` | PreToolUse (Task, Skill) | Enforces iteration limits per phase |
| `.claude/hooks/skill-validator.js` | PreToolUse (Task) | Observability hook — always allows |
| `.claude/hooks/gate-blocker.js` | PreToolUse (Task, Skill) | Blocks gate advancement if requirements unmet |
| `.claude/hooks/constitution-validator.js` | PreToolUse (Task) | Validates constitutional compliance |
| `.claude/hooks/log-skill-usage.js` | PostToolUse (Task) | Logs all Task tool delegations |
| `.claude/hooks/menu-tracker.js` | PostToolUse (Task) | Tracks menu/command usage |
| `.claude/hooks/test-watcher.js` | PostToolUse (Bash) | Monitors test execution results |

**Supporting files:**

| File | Purpose |
|------|---------|
| `.claude/hooks/lib/common.js` | Shared utilities (JSON parsing, manifest lookup) |
| `.claude/hooks/config/skills-manifest.json` | JSON manifest for runtime lookup |
| `.claude/hooks/config/iteration-requirements.json` | Phase iteration requirements |
| `.claude/hooks/tests/test-skill-validator.js` | Test suite (24 tests) |

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
| gate-blocker delegation | 4 |
| **Total** | **24** |

---

## Future: Skill Usage Enforcement at Gates

### Problem Statement

Today, skill observability logs which **agents** were delegated to, but there is no mechanism to verify that agents actually exercised their **skills**. An agent could be invoked, do nothing meaningful, and the gate would still pass. The `gate-blocker.js` hook checks three requirements (test iteration, constitutional validation, interactive elicitation) but does **not** check skill usage.

The gap is structural:
- The `skill_usage_log` records agent-level delegations (e.g., `software-developer` was invoked)
- No log entry records which specific skill IDs (e.g., DEV-001, DEV-007) were used
- The manifest maps agents to skill IDs, but this mapping is never validated at runtime
- An agent could be invoked and immediately return without performing any of its documented skills

**Intent**: Agents MUST use their skills. Cross-phase sharing is fine, but skipping skills is not.

### Candidate Approaches

#### Option A: Agent Self-Reporting to state.json

Each agent writes its used skill IDs to `state.json` after executing skills. The gate-blocker reads this data and compares it against the manifest.

**How it works:**
1. Agent instructions (markdown) are updated to include: "Before requesting gate advancement, write `phases[phase].skills_used` to state.json"
2. Agent writes an array like `["REQ-001", "REQ-004", "REQ-007"]` to state under the current phase
3. `gate-blocker.js` adds a 4th check: `checkSkillUsageRequirement()`
   - Reads `skills_used` from the phase state
   - Loads the manifest to get required skill IDs for the phase's agent
   - Compares the two sets and reports coverage percentage

**Config changes:**
```json
// .isdlc/state.json — new field per phase
{
  "phases": {
    "06-implementation": {
      "skills_used": ["DEV-001", "DEV-003", "DEV-007"],
      "skills_coverage": "3/14 (21%)"
    }
  }
}
```

**Hook changes:**
```javascript
// gate-blocker.js — new check function
function checkSkillUsageRequirement(state, phase) {
  const skillsUsed = state.phases?.[phase]?.skills_used || [];
  const manifest = loadManifest();
  const agent = manifest.phase_agents[phase];
  const required = manifest.agents[agent]?.skills || [];
  const missing = required.filter(s => !skillsUsed.includes(s));
  return { passed: missing.length === 0, used: skillsUsed, missing };
}
```

**Agent changes:** Add self-reporting instruction block to all 21 phase agents.

**Trade-offs:**
| Pro | Con |
|-----|-----|
| Simple to implement | Relies on agent compliance (AI follows instructions but could hallucinate) |
| No new hooks needed | Agent could report skills it didn't actually use |
| Clear per-phase audit trail | Requires updating 21 agent markdown files |
| Skill-level granularity | No independent verification of reported skills |

---

#### Option B: Orchestrator Validates on Delegation

The orchestrator already logs which agent it delegated to (via `skill_usage_log`). The gate check verifies that the expected agent was invoked at least once during the phase.

**How it works:**
1. No agent changes needed — the existing `log-skill-usage.js` PostToolUse hook already records every delegation
2. `gate-blocker.js` adds a check: scan `skill_usage_log` for entries where `agent_phase` matches the current phase
3. If at least one entry exists for the expected agent, the check passes
4. Gate assumes: if the correct agent ran for the phase, its skills were available and used

**Config changes:** None — existing `skill_usage_log` data is sufficient.

**Hook changes:**
```javascript
// gate-blocker.js — new check function
function checkAgentDelegationRequirement(state, phase) {
  const log = state.skill_usage_log || [];
  const phaseEntries = log.filter(e => e.agent_phase === phase);
  return { passed: phaseEntries.length > 0, delegations: phaseEntries.length };
}
```

**Agent changes:** None.

**Trade-offs:**
| Pro | Con |
|-----|-----|
| Zero agent changes needed | Coarsest check — agent-level, not skill-level |
| Data already exists in state.json | Doesn't verify individual skills were used |
| Can implement immediately | Agent could be invoked and do nothing meaningful |
| Minimal code changes | No skill-level audit trail |

---

#### Option C: Structured Skill Invocation Protocol

Agents explicitly report each skill invocation with evidence (artifact paths, line counts, etc.) to a structured array in state.json. The gate validates full skill-level coverage.

**How it works:**
1. Define a `/skill-report` mechanism or structured write to `skill_invocations` in state.json
2. Each agent, after performing a skill, writes an entry:
   ```json
   {
     "skill_id": "DEV-001",
     "agent": "software-developer",
     "phase": "06-implementation",
     "evidence": { "files_modified": ["src/auth.js"], "lines_changed": 142 },
     "timestamp": "2026-02-06T10:30:00Z"
   }
   ```
3. `gate-blocker.js` validates: all required skill IDs for the phase appear in `skill_invocations`
4. Optionally define `required_skills` vs `optional_skills` per phase in `iteration-requirements.json`

**Config changes:**
```json
// iteration-requirements.json — optional required/optional split
{
  "06-implementation": {
    "required_skills": ["DEV-001", "DEV-002", "DEV-003"],
    "optional_skills": ["DEV-004", "DEV-005"]
  }
}
```

```json
// .isdlc/state.json — new skill_invocations array
{
  "skill_invocations": [
    {
      "skill_id": "DEV-001",
      "agent": "software-developer",
      "phase": "06-implementation",
      "evidence": { "files_modified": ["src/auth.js"], "lines_changed": 142 },
      "timestamp": "2026-02-06T10:30:00Z"
    }
  ]
}
```

**Hook changes:**
```javascript
// gate-blocker.js — new check function
function checkSkillInvocationsRequirement(state, phase, iterReqs) {
  const invocations = state.skill_invocations || [];
  const phaseInvocations = invocations.filter(i => i.phase === phase);
  const invokedIds = [...new Set(phaseInvocations.map(i => i.skill_id))];
  const required = iterReqs[phase]?.required_skills || [];
  const missing = required.filter(s => !invokedIds.includes(s));
  return { passed: missing.length === 0, invoked: invokedIds, missing };
}
```

**Agent changes:** All 21 phase agents updated with skill invocation reporting protocol.

**Trade-offs:**
| Pro | Con |
|-----|-----|
| Most rigorous — true skill-level audit trail | Heaviest implementation (21 agents + hooks + config) |
| Evidence-based verification | Significant complexity increase |
| Supports required vs optional skill distinction | Agents must produce structured evidence per skill |
| Full traceability from skill to artifact | Highest risk of agent compliance issues |

---

### Recommendation

**Option B has been implemented as the baseline** (Enhancement #4d). The `gate-blocker.js` hook now includes a 4th check — `checkAgentDelegationRequirement()` — that verifies the expected phase agent was delegated to at least once before allowing gate advancement. This uses existing `skill_usage_log` data written by `log-skill-usage.js`, requiring zero agent changes.

The three options represent a spectrum from pragmatic to rigorous:

- **Option B** (Implemented) is the **baseline check** — was the right agent invoked at all? Zero agent changes, uses existing log data.
- **Option A** is the **simplest skill-level approach** — it provides skill-level granularity with moderate implementation effort, though it relies on agent self-reporting
- **Option C** is the **most rigorous** — it provides a true skill-level audit trail with evidence, but requires the largest implementation investment

Phased rollout:
1. **Complete**: Option B implemented as a baseline gate check
2. **Next iteration**: Layer Option A on top for skill-level visibility
3. **Future**: Evaluate whether Option C's evidence-based approach is warranted based on real-world agent compliance data from Options A and B

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
| #4d | Skill Usage Enforcement at Gates (Option B) | Complete |

---

## Migration from v2.0 (Enforcement) to v3.0 (Observability)

Projects upgrading from v2.0:
1. Update `skills-manifest.json` → `enforcement_mode: "observe"` (or leave as `strict` — it now behaves the same)
2. Update `state.json` → `skill_enforcement.mode: "observe"`
3. No code changes needed — hooks handle the transition automatically
4. Cross-phase usage that was previously blocked will now be allowed and logged

---

**Version**: 4.0.0
**Last Updated**: 2026-02-07
**Author**: iSDLC Framework
