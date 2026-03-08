# User-space hooks — extensible pre/post phase hook points

## Context

Part of the [Hackability & Extensibility Roadmap](docs/isdlc/hackability-roadmap.md) — Tier 2 (Extension Points), Layer 3 (Extend).

## Problem

The framework can't anticipate every domain-specific need. Teams working with proprietary formats (XML workflows, custom DSLs, visual editors), internal compliance tools, or notification systems have no way to plug their tooling into the iSDLC workflow.

Claude Code solved this with hooks — "people could get pinged on Slack for anything." iSDLC's hooks are framework-internal only, not user-extensible.

## Design

New directory convention: `.isdlc/hooks/` (distinct from framework hooks in `src/claude/hooks/`)

```
.isdlc/hooks/
  pre-workflow/              ← before workflow starts
  post-implementation/       ← after phase 06 completes
  post-code-review/          ← after phase 08
  pre-gate/                  ← before any gate advancement
  post-workflow/             ← after workflow finalize
```

Execution model:
- Scripts are shell commands (any language — bash, node, python)
- Executed sequentially in alphabetical order within each hook point
- Exit codes: 0 = pass, 1 = warning (shown to user), 2 = block (prevents gate advancement)
- stdout captured and shown to developer
- Timeout: 60 seconds per hook (configurable in `.isdlc/config.json`)
- Discovery: framework scans `.isdlc/hooks/` at trigger points. No registration needed.

Example use cases:
- Domain-specific XML validation (Enactor process flows, BPMN, config schemas)
- SAST/DAST security scanning after implementation
- Slack/Teams notification after code review
- Jira/Linear status update after workflow completion
- Custom linting rules before gate advancement
- API contract validation (OpenAPI schema diff)

## Files to change

- `src/antigravity/phase-advance.cjs` — execute user-space hooks before gate validation
- `ANTIGRAVITY.md` + template — document hook mechanism
- `docs/isdlc/user-hooks.md` — **New** — hook authoring guide

## Effort

Medium

**Labels**: enhancement, hackability