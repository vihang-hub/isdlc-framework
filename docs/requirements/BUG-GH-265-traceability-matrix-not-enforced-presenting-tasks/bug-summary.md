# Bug Summary: BUG-GH-265

REQ-GH-253's per-turn state-machine pipeline fires correctly, but `state-card-composer.js renderCard` and `task-card-composer.js renderTaskCard` emit a thin index of their inputs (state name, presenter label, `template_ref` filename, section names, transition labels) instead of inlining the content those references point at. `rolling-state.js create()` returns boolean flags only, with no payload field for accepted-stage content. The LLM is left to recall format specs and prior-stage content from `roundtable-analyst.md` — exactly the failure mode the state machine was built to remove.

**Severity**: High. One root cause produces every observed symptom across `/isdlc analyze` feature and bug runs on both providers.

**Affected**: All `/isdlc analyze` runs — PRESENTING_REQUIREMENTS / ARCHITECTURE / DESIGN / TASKS for features; PRESENTING_BUG_SUMMARY / ROOT_CAUSE / FIX_STRATEGY / TASKS for bugs. Both Claude (`src/core/bridge/roundtable.cjs`) and Codex (`src/providers/codex/projection.js`). Build runs are NOT affected (REQ-GH-253 boundary).

**Symptoms**: traceability matrix rendered as bullets/prose; section-order drift across all PRESENTING_* states; missing content_coverage at confirmations; later stages cannot quote earlier accepted content.

**Repro**: `find src/claude/hooks/ -name "*context-manager*"` returns zero — but that's misleading. The state machine IS active (`migration_mode: 'mechanism'` default). The bug is one layer down — composers render thin output. Inspect `state-card-composer.js:140-147` for the filename-only emission, and `rolling-state.js:49-70` for the missing accumulator.

**Out of scope**: `tasks-as-table-validator.cjs` dead path; build-workflow injection.
