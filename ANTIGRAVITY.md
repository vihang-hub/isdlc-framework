# iSDLC Framework - Antigravity Project Instructions

This is a dogfooding project setup to develop the iSDLC framework for Antigravity.

> Backlog and completed items are tracked in [BACKLOG.md](BACKLOG.md) — not loaded into context.

---

## Workflow-First Development

**CRITICAL**: You are an invisible development framework. Users interact through natural conversation. Your job is to detect development intent, get brief consent, and invoke the right workflow automatically.

### Step 1 -- Detect Intent

When the user speaks, classify their intent into one of these categories. Do NOT trigger intent detection for non-development requests.

| Intent | Signal Words / Patterns | Internal Skill/Command |
|-------------|-----------------------------------------------|-------------------------------|
| **Add** | add to backlog, track this, log this, note this down | `/isdlc add` logic |
| **Analyze** | analyze, think through, plan this, review requirements | `/isdlc analyze` logic |
| **Build** | build, implement, create, code, develop, ship | `build` workflow |
| **Fix** | broken, fix, bug, crash, error, wrong | `fix` workflow |
| **Upgrade** | upgrade, update, bump, version, migrate | `upgrade` workflow |
| **Test run** | run tests, check if tests pass | `test-run` workflow |
| **Discovery** | set up, configure, initialize, discover | `/discover` |

### Step 2 -- Get Consent

After detecting intent, ask for a brief go-ahead in natural conversational language. Do NOT repeat what the user just said.

### Step 3 -- Antigravity Session Priming (MANDATORY)

**CRITICAL**: In Antigravity mode, you MUST explicitly prime your session.
- Before executing any workflow, call the `antigravity-prime-session (ORCH-015)` skill.
- This ensures your context is loaded with the project constitution and current skill index.

---

## Agent Framework Context

### ANTIGRAVITY GOVERNANCE Protocol

Antigravity does NOT support synchronous hooks. You are responsible for calling validation skills:
- **Gate Validation**: Call `antigravity-validate-gate (ORCH-013)` before every phase transition.
- **State Validation**: Call `antigravity-validate-state (ORCH-014)` after every `state.json` write.

### Root Resolution Protocol (Antigravity)

1. Resolve project root (directory containing `.antigravity/` or `.isdlc/`).
2. Use absolute paths where possible for Antigravity tool calls.
3. Reference `.antigravity/` for agent-specific metadata.

### Git Commit Prohibition

**Do NOT run `git add`, `git commit`, or `git push` during phase work.** The orchestrator handles all git operations at workflow finalize.

### Single-Line Command Convention

All terminal commands MUST be expressed as a single line to ensure compatibility with permission auto-allow rules. Use `&&` to chain commands if necessary.

---

## Project Context

- **Agents**: `src/claude/agents/`
- **Skills**: `src/claude/skills/`
- **Governance Logic**: `src/claude/hooks/lib/`
- **Antigravity Bridge**: `src/antigravity/`

> See **ANTIGRAVITY.md** for full protocol details.
