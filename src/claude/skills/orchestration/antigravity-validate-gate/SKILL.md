---
name: antigravity-validate-gate
description: Antigravity-native gate validation enforcing hard governance
skill_id: ORCH-013
owner: sdlc-orchestrator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Before phase transitions in Antigravity to ensure hard-coded requirements are met.
dependencies: [ORCH-004]
---

# Antigravity Validate Gate

## Purpose
This skill provides the same "Hard Enforcement" as the Claude Code Hook system, but implemented as an Antigravity Skill. It must be called by the Orchestrator before any phase transition to ensure that all iteration requirements are met.

## Usage
Calling this skill will perform a deterministic check of the current phase gates. If requirements are missing, the skill returns a failure, which the Orchestrator must respect by blocking advancement.

## Process
1. Load shared `gate-logic.cjs`.
2. Determine current phase from `state.json`.
3. Execute all requirement checks (Tests, Constitution, Artifacts, etc.).
4. Return a structured result that indicates PASS or BLOCK.
