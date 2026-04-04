# Tasks as User Contract

Source: GitHub #223
Type: REQ (Feature)

## Description

Redesign the task system so that:

1. **Analysis produces the authoritative task list** -- with quality gates (debate loop / coverage check) ensuring tasks cover all FRs, ACs, blast radius files, and risk mitigations
2. **Build consumes tasks via Claude Task tool** (and Codex equivalent) -- no regeneration at build start
3. **Phase agents add sub-tasks linked to parents** -- e.g., Phase 05 creates test case sub-tasks under the parent task, visible to user
4. **Traceability enforcement** -- build-phase hook blocks completion if any analysis artifact (FR, AC, blast radius entry) lacks a covering task

## Motivation

Tasks are a **contract with the user**. After the user confirms requirements, architecture, design, and task list during analysis, the task list becomes their mental model of what will be implemented. The framework must honour this contract by:

- Showing progress on the confirmed tasks (via Claude Task tool / Codex equivalent)
- Ensuring every analysis artifact maps to at least one task
- Generating tasks once (during analysis), not twice

## Current Problems

- Task granularity at analysis is too coarse (generic phase checkpoints, not actionable work items)
- Tasks are generated twice: once at analyze-finalize, again at build start via ORCH-012
- Claude Code's Task tool is not leveraged for real-time progress visibility
- Phase agents self-decompose rather than following the task plan

## Key Changes

- Kill ORCH-012 regeneration at build start -- build reads analysis tasks.md directly
- Task quality gate in analysis -- ensure tasks cover all FRs, ACs, blast radius, risks
- Sub-task model -- parent tasks from analysis, child tasks from phase agents
- Claude Task tool bridge -- build start hydrates Claude Task tool from tasks.md
- Traceability enforcement hook -- blocks build completion if uncovered artifacts exist
