# BUG-0031: gate-blocker blocks /isdlc analyze and /isdlc add during active workflows

**Source**: GitHub Issue #65
**Type**: Bug
**Complexity**: Low

## Problem

`gate-blocker.cjs` fires on all `/isdlc` Skill invocations during an active workflow. It only exempts `advance` and `gate-check` actions plus setup commands. The `analyze` and `add` verbs — which are explicitly designed to run outside workflow machinery (no state.json writes, no branches) — get blocked if the current phase has unsatisfied gate requirements.

## Observed

`/isdlc analyze "#64 ..."` blocked with `GATE BLOCKED: Iteration requirements not satisfied for phase '16-quality-loop'` while BUG-0029 workflow was active in another session.

## Root Cause

`skill-delegation-enforcer.cjs` correctly exempts `analyze`/`add` (line 37: `EXEMPT_ACTIONS`), but `gate-blocker.cjs` in the `pre-skill-dispatcher` runs first and blocks before the delegation enforcer gets a chance to exempt.

## Fix

Add `analyze` and `add` to gate-blocker's Skill exemption check (around line 118-130). When the Skill is `isdlc` and the action is `analyze` or `add`, skip the gate check.

## Files

`src/claude/hooks/gate-blocker.cjs`

## Complexity

Low — 5-10 line change + tests
