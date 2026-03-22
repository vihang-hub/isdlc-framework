# Provider-neutral team spec model

## Source
- GitHub Issue: #158
- Codex Reference: CODEX-025 — REQ-0094
- Workstream: B (Core Extraction)
- Phase: 4

## Description

Define reusable provider-neutral team specification: team_type, members, parallelism, input_contract, output_schema, merge_policy, retry_policy, max_iterations, state_owner. Minimal and code-first — captures only the small number of team patterns iSDLC already uses.

## Dependencies
- REQ-0082 (WorkflowRegistry) — completed
- REQ-0081 (ValidatorEngine) — completed

## Context

The vertical spike (Phase 1) created `src/core/teams/implementation-loop.js` with a narrow `TeamSpec` typedef covering only the Writer/Reviewer/Updater loop. Phase 4 needs to generalize this into a model that covers all team patterns:

1. Implementation review loop (sequential Writer→Reviewer→Updater per file)
2. Impact analysis fan-out (parallel M1/M2/M3 + M4 verifier)
3. Tracing fan-out (parallel T1/T2/T3)
4. Quality dual-track (parallel Track A/Track B + fan-out chunks)
5. Debate team (sequential Creator→Critic→Refiner rounds)
6. Discovery program (multi-agent coordination)
7. Roundtable persona team (conversational multi-persona)

The spec must remain minimal and code-first — not a generic orchestration platform.
