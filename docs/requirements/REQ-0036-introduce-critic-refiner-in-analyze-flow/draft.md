# Introduce Critic/Refiner Pass in Analyze Flow Before Confirmation Summaries

**Source**: GitHub #79
**Type**: Enhancement
**Dependencies**: GH-22 (Transparent Confirmation at Analysis Boundaries)

## Context

During analysis of GH-22 (Transparent Critic/Refiner at Step Boundaries), the roundtable team identified an enhancement opportunity: running the existing Critic/Refiner agents against the analysis artifacts *before* presenting confirmation summaries to the user.

## Problem

The roundtable analysis flow produces artifacts through conversation, but does not apply the same rigorous quality checks that the build flow's debate loop does. The Critic agents check for mechanical quality issues (e.g., ACs not in Given/When/Then format, orphan requirements, unquantified NFRs, incomplete STRIDE coverage) that the conversational flow naturally skips.

## Proposed Design

After the roundtable conversation completes and before entering the confirmation sequence (GH-22):

1. Run the requirements Critic (`01-requirements-critic.md`) against `requirements-spec.md`
2. Run the architecture Critic (`02-architecture-critic.md`) against `architecture-overview.md`
3. Run the design Critic (`03-design-critic.md`) against design artifacts
4. For each domain with BLOCKING findings, run the corresponding Refiner
5. All three critic/refiner passes can run concurrently (no dependencies between domains)
6. Present the *refined* output in the confirmation summaries

The user sees the improved version and is told "my team reviewed this and tightened a few things" -- maintaining the roundtable transparency principle.

## Constraints

- Critic/Refiner agents must work without `state.json` (analyze flow has no workflow state)
- Must respect the no-branch-creation constraint of the analyze flow
- Concurrent execution to avoid adding significant latency before confirmation

## Backlog Reference

Follow-on from item 16.4 in BACKLOG.md
