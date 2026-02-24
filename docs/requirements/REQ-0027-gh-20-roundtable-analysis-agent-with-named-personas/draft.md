# GH-20: Roundtable analysis agent with named personas

**Source**: GitHub Issue #20
**Source ID**: GH-20

## Feature Description

Single roundtable agent that wears BA, Architect, and Designer hats during the analyze verb, with named personas, communication styles, and adaptive depth.

## Problem

Current Phase A generates artifacts inline without user interaction. Phase 01-04 agents run in isolation with no conversational engagement. The user is passive during the most important decision-making phases.

## Design

### Three personas (single agent, multiple hats):

- **Business Analyst persona** (Phases 00-01) — leads requirements discovery, challenges assumptions, surfaces edge cases. Deep conversational engagement.
- **Solutions Architect persona** (Phases 02-03) — leads impact analysis and architecture decisions. Presents tradeoffs, consults user on risk appetite.
- **System Designer persona** (Phase 04) — leads design decisions. Presents module designs, interfaces, key decisions for user approval.

### Key patterns (inspired by BMAD):

- Each persona has a name, communication style, identity, and principles
- Adaptive depth: simple items get brief confirmation, complex items get full discussion
- Step-file architecture: each step is a self-contained `.md` file, progress tracked in `meta.json`, resumable across sessions
- Menu at each step: `[E] Elaboration Mode` / `[C] Continue` / natural conversation

## Files to Create

- `src/claude/agents/roundtable-analyst.md` — main agent
- `src/claude/skills/analysis-steps/` — step files for each persona phase
- Persona definitions (name, style, identity, principles)

## Dependencies

- #19 (three-verb model must exist first)

## Complexity

Medium

## Backlog Reference

Item 16.2
