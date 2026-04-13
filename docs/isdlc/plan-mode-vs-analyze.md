# Plan Mode vs `/isdlc analyze`

Claude Code ships with a built-in **plan mode** (toggled by the user, backed by `ExitPlanMode`). iSDLC ships with **`/isdlc analyze`** — a multi-phase roundtable discovery workflow. They are both "think before acting" mechanisms, but they operate at different altitudes and solve different problems.

This doc explains when each applies, what each produces, and why they are deliberately kept separate.

---

## TL;DR

| | **Plan Mode** | **`/isdlc analyze`** |
|---|---|---|
| **Altitude** | Tactical — this edit session, right now | Strategic — what's the problem, scope, approach |
| **Time horizon** | One turn | One feature |
| **Produces** | An ephemeral plan in chat | Durable specs on disk (`docs/requirements/{slug}/`) |
| **Persona** | None — Claude thinks as itself | Maya (BA) → Alex (Architect) → Jordan (Designer) roundtable |
| **Persistence** | Nothing if rejected | `meta.json`, `draft.md`, acceptance record always written |
| **Exit** | Single yes/no approval | Four-domain sequential confirmation |
| **Codebase scans** | Ad-hoc Read/Grep | MCP code-index, impact analysis, blast radius, tracing |
| **Sizing output** | None | Tier recommendation (trivial/light/standard/epic) |
| **Invoked by** | User keypress | `/isdlc analyze` or natural-language intent detection |
| **Scope** | "Before I touch these 6 files, here's my approach" | "Before we build this thing, here's the spec a later build will execute against" |

---

## The altitude difference

**Plan mode is tactical.** It answers: *"I'm about to make a set of edits in this session. Here's the plan — approve before I touch anything."* It assumes the problem is already understood and the only question is the approach to *this specific edit pass*. It runs in the main conversation, leaves no artifacts, and ends with a single user approval.

**`/isdlc analyze` is strategic.** It answers: *"We have a problem. What exactly is it, what's the blast radius, what architecture does it need, what are the design trade-offs, and what tasks does it decompose into?"* It runs as a multi-persona roundtable, scans the codebase, produces durable specifications, recommends a workflow tier, and feeds directly into `/isdlc build`. Its output lives on disk and is consumed by later phases.

A good mental image: plan mode is "what do I do in the next 10 minutes?"; analyze is "what do we build over the next few days?"

---

## What each produces

### Plan mode produces
- A plan presented in chat
- Nothing persistent
- No state changes, no folder creation, no git operations

If the user rejects the plan, the session continues as if it never happened.

### `/isdlc analyze` produces

Always written to `docs/requirements/{slug}/`:
- `meta.json` — analysis status, phases completed, codebase hash, acceptance record
- `draft.md` — original problem statement (copied from GitHub/Jira or user input)

Written for non-trivial items after the roundtable:
- `requirements-spec.md` — functional requirements, acceptance criteria, NFRs
- `impact-analysis.md` — blast radius, affected files, risk, coupling, coverage gaps
- `architecture-overview.md` — high-level design, key decisions
- `design-spec.md` — module and interface specifications
- `tasks.md` — file-level task breakdown with dependencies and traces to AC

Plus: `BACKLOG.md` marker update, `meta.recommended_tier`, optional GitHub label sync, roundtable memory session record.

---

## When to use which

### Use plan mode when
- You're already inside an implementation session and want to sanity-check an edit approach before touching files
- The problem is well-understood and you just want Claude to show its work
- The change is exploratory and you may reject the whole direction
- You want a one-turn interaction, not a structured phase

### Use `/isdlc analyze` when
- You have a new backlog item that hasn't been analyzed yet
- You need a durable specification that a later build workflow can consume
- You want multiple perspectives (business, architecture, design) on the problem
- You need impact analysis, blast radius, or root-cause tracing (for bugs)
- The work is big enough that you'll want a task plan and traceability matrix

### Stack them when
- You've finished `/isdlc analyze` and `/isdlc build` is running — during the implementation phase, plan mode is still useful for per-file or per-chunk "before I edit these, here's my approach" moments. Analyze doesn't make plan mode redundant inside implementation.

---

## Why they are kept separate

Plan mode is **explicitly prohibited** for workflow commands. See `src/claude/hooks/skill-delegation-enforcer.cjs:101`:

> *"For workflow commands, begin by delegating to "{requiredAgent}" for initialization (STEP 1 of the Phase-Loop Controller). Do NOT implement the request directly. **Do NOT enter plan mode.** Do NOT write code yourself."*

The reason is structural: the Phase-Loop Controller is its own planning system. It dispatches phases, manages iteration loops, enforces gates via hooks, and maintains a task list visible to the user. Entering plan mode mid-workflow would create two planning systems trying to drive the same conversation — the harness-level plan and the framework-level phase loop. The framework opts out of plan mode so the Phase-Loop Controller owns workflow execution end-to-end.

In short:
- **Before a workflow starts**: plan mode is the right primitive for ad-hoc edits
- **Once `/isdlc analyze` or `/isdlc build` runs**: the framework owns the planning surface; plan mode is not used

---

## The one place they overlap

Plan mode has a native "maybe we shouldn't do this at all" escape hatch — the user can reject the plan and the session ends with no work done.

`/isdlc analyze` currently has no graceful equivalent. The roundtable always runs the full four-domain confirmation sequence, even when the honest answer is "this is a 5-line fix, skip the roundtable" or "the premise is flawed, close without work."

This gap is tracked as **GH-255: Roundtable escape hatches — licensed persona dissent + trivial-scope sanity gate**. Once landed, Maya/Alex/Jordan will be licensed to propose `close_without_work`, `skip_to_trivial`, or `defer` as conversation moves when they have specific evidence, and Alex's first-scan will deterministically surface a trivial-tier bypass when metrics are clearly below thresholds.

After GH-255, the split becomes cleaner:
- **Plan mode**: "show me your approach for this edit session"
- **Analyze**: "let's understand the problem, and if it turns out to be trivial or wrong-headed, say so out loud"

The two mechanisms complement each other by altitude, not by feature overlap.
