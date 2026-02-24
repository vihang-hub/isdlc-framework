# Tech Stack Decision — REQ-0006: Inception Party

**Feature**: BMAD-inspired role-based party mode for `/discover --new`
**Created**: 2026-02-09

---

## 1. Technology Choices

This feature is implemented entirely within the existing iSDLC framework technology stack. No new runtime dependencies, build tools, or libraries are introduced.

| Component | Technology | Justification |
|-----------|-----------|---------------|
| Agent definitions | Markdown (.md) with YAML frontmatter | Existing convention for all 36 agents. Article XIII compliance. |
| Persona configuration | JSON (.json) | Existing convention for all config files (state.json, workflows.json, settings.json, skills-manifest.json). ADR-008. |
| Agent coordination | Claude Code built-in tools (TeamCreate, SendMessage, TaskCreate, TaskUpdate) | Constraint #1: no new npm dependencies. These are native Claude Code capabilities. |
| Sub-agent invocation | Claude Code Task tool | Existing pattern used by discover-orchestrator for D1-D8. |
| Command routing | Markdown (.md) command file | Existing pattern for all commands (discover.md, sdlc.md, tour.md). |
| State tracking | JSON via state.json | Existing pattern. Article XIV compliance. |

---

## 2. No New Dependencies

| Category | Current | After REQ-0006 | Delta |
|----------|---------|----------------|-------|
| npm production dependencies | 0 | 0 | 0 |
| npm dev dependencies | 0 | 0 | 0 |
| Runtime requirements | Node 18+, Claude Code CLI | Node 18+, Claude Code CLI | 0 |
| Agent files | 36 | 42 (+6 new) | +6 |
| Config files | 5 | 6 (+1 persona config) | +1 |
| Hook files | 10 | 10 | 0 |
| Skill count | 229 | 229 | 0 (no new skills defined) |

---

## 3. Agent File Conventions (Article XIII)

All new agent files follow the established pattern:

```yaml
---
name: {agent-name}
description: "{description}"
model: opus
owned_skills:
  - DISC-NNN  # skill-name
---

# {Agent Title}

**Agent ID:** D{N}
**Phase:** Setup (new projects only)
**Parent:** discover-orchestrator
**Purpose:** {purpose}

---

## Role
{role description}

---

## When Invoked
{invocation context}

---

## Process
{step-by-step process}

---

## Skills
{skill table}

# SUGGESTED PROMPTS
{minimal status format — reports to parent orchestrator}
```

---

## 4. Team API Usage

Party mode uses the following Claude Code team tools:

| Tool | Usage | Phase |
|------|-------|-------|
| TeamCreate | Create "inception-party" team (once per party mode invocation) | Phase 1 start |
| SendMessage (type: message) | Inter-agent debate, cross-review comments | Phases 1, 2, 3 |
| SendMessage (type: broadcast) | Broadcast user response to all Phase 1 agents | Phase 1 |
| SendMessage (type: shutdown_request) | Graceful agent shutdown between phases | Phases 1, 2, 3, 5 |
| TaskCreate | Create progress-tracking tasks for each party phase | All phases |
| TaskUpdate | Mark tasks in_progress / completed | All phases |
| TeamDelete | Clean up team at end of party mode | Phase 5 end |
| Task (sub-agent) | Invoke D3, D4 for constitution and skills (non-team) | Phase 4 |

---

## 5. Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| TeamCreate API not available | Detect failure, offer classic mode fallback |
| SendMessage delivery failure | Orchestrator monitors idle notifications, retries once |
| Agent fails to produce artifact | Proceed with remaining agents' output (AC-18) |
| Message volume exceeds NFR-002 | Personas.json declares max_messages=10 per phase; orchestrator enforces |
