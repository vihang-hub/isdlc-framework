---
source: github
source_id: GH-235
title: Rewrite roundtable-analyst.md for consistent roundtable UX
added_at: 2026-04-05
---

# GH-235: Rewrite roundtable-analyst.md for consistent roundtable UX

## Problem

`src/claude/agents/roundtable-analyst.md` has grown organically and now mixes behavior contract, runtime adapter notes, dormant future design, operational plumbing, and UX rendering rules in one 987-line prompt. This increases drift risk for both Claude Code and Codex.

Recent dogfooding surfaced concrete failures:
- the assistant can shortcut from initial clarification into artifact generation instead of staying in the roundtable discussion loop
- template authority is not always bound tightly enough to the active confirmation state
- on-screen task/traceability confirmations can drift from the intended template-shaped UX even when written artifacts are later validated
- repeated rules and distant instructions make the prompt harder to follow consistently

## Goal

Rewrite `roundtable-analyst.md` into a cleaner, preservation-driven prompt architecture that produces a consistent demo-style roundtable experience for both Claude Code and Codex.

## Must Preserve

- demo conversation quality and pacing
- staged on-screen confirmation flow (Requirements -> Architecture -> Design -> Tasks)
- Accept/Amend gating per applicable domain
- explicit persona participation and natural multi-perspective conversation
- tier behavior (trivial / light / standard / epic)
- early-exit behavior
- assumptions and inferences handling
- strict template authority by state
- distinction between on-screen tasks confirmation (`traceability.template.json`) and written `tasks.md` (`tasks.template.json`)
- known memory-rule / user-feedback behaviors already encoded in the current prompt

## Scope

- create a preservation inventory from the current prompt, demo conversation, and learned behaviors
- redesign the prompt structure around behavior-first execution
- move non-default runtime details and dormant Agent Teams design out of the main execution path
- reduce duplicated instructions and make state-local template rules explicit
- strengthen anti-shortcut rules so codebase analysis supports the roundtable instead of replacing it
- add prompt-verification coverage for the rewritten behavior contract

## Out of Scope

- changing the underlying analysis artifact set
- activating true multi-agent execution
- redesigning unrelated build/runtime hooks beyond prompt-verification support needed for the rewrite

## Success Criteria

- Codex and Claude both stay in the staged roundtable flow during analysis
- each confirmation state names its governing template directly
- on-screen task confirmation renders the expected traceability table shape instead of collapsing to bullets/prose
- artifact writing happens only after the required confirmation sequence completes, except for explicit early exit
- the rewritten file is materially smaller, more layered, and easier to reason about than the current prompt

## Validation

- snapshot current file before rewrite
- compare rewritten prompt against known-good demo conversation behavior
- add prompt-verification tests for anti-shortcut, state-local template binding, and confirmation sequencing
