# Execution observability — surface workflow trace as structured report

**Source**: GitHub Issue #128
**Labels**: hackability, user-experience

## Problem

iSDLC tracks extensive execution data in state.json and hook logs (phases run, hooks blocked, iterations used, artifacts produced, coverage metrics), but none of it is surfaced to the user. Understanding what happened during a workflow requires reading raw JSON.

## Proposal

Add a `/isdlc status` or similar command that renders workflow execution as a structured trace:

- Which phases ran, with duration
- What hooks blocked and why
- How many iterations per phase
- What artifacts were produced
- Coverage metrics and gate pass/fail history
- Constitutional compliance status

## Inspiration

Arcturus "Runs" — execution graph showing agent tasks, intermediate outputs, and orchestration state.

## Value

The data already exists — this is a presentation layer. Helps teams tune gate profiles and analysis depth with data instead of intuition. Makes the harness transparent rather than opaque.
