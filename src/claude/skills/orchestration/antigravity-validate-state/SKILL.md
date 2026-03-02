---
name: antigravity-validate-state
description: Antigravity-native state validation for iSDLC integrity
skill_id: ORCH-014
owner: sdlc-orchestrator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: After state-modifying actions in Antigravity to verify integrity.
dependencies: []
---

# Antigravity Validate State

## Purpose
This skill ensures the structural integrity and logical consistency of `state.json` in an Antigravity environment. It detects suspicious writes, phase regressions, and version conflicts.

## Usage
Calling this skill will perform a deterministic audit of the `state.json` file. It should be invoked after any tool that modifies the state to ensure the changes are valid.

## Process
1. Load shared `state-logic.cjs`.
2. Analyze the current `state.json` on disk.
3. Compare against versioning rules and phase transition logic.
4. Return a result indicating if the state is VALID or if WARNINGS/BLOCKS are necessary.
