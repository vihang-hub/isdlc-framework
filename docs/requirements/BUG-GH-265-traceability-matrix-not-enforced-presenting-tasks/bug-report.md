# Bug Report: BUG-GH-265

**Source**: GitHub #265
**Reported**: 2026-04-26
**Reporter**: vihang (during analyze conversation about #253 effectiveness)

---

## Severity

**High**. The state-machine pipeline that REQ-GH-253 introduced fires correctly per turn, but the composers it drives emit a thin index — state name, presenter, filename references, section/transition labels — instead of the content each stage actually needs. The LLM is left to reconstruct format specs, content-coverage requirements, and prior-stage accepted content from `roundtable-analyst.md` recall. This is the very LLM-recall failure mode the state machine was built to remove.

Severity is High because the gap is one root cause behind every observed symptom — table-format drift at PRESENTING_TASKS, section-order drift across all PRESENTING_* states, missing prior-stage context at later stages — across both `/isdlc analyze` feature runs and `/isdlc analyze` bug runs. Both providers (Claude + Codex) inherit the same composer logic, so both inherit the same gap.

The state-machine architecture itself is correct: PreToolUse hooks fire only on tool calls, not on every assistant turn, so a state-machine consulted from the prose protocol is the only viable per-turn injection carrier. The architecture is not the bug.

## Reproduction Steps

1. Run `/isdlc analyze` on any item in either feature or bug mode; drive the conversation through to any PRESENTING_* stage.
2. Inspect the composed card the LLM receives at that turn (e.g., enable bridge logging or trace `composeForTurn` output).
3. Observe the card content for PRESENTING_TASKS:
   ```
   --- STATE: PRESENTING_TASKS ---
   Personas: Maya, Alex, Jordan
   Rendering: bulleted
   Presenter: Lead (Facilitator)
   Template: traceability.template.json
   Sections: traceability_table, assumptions_and_inferences
   Invariants: ...
   Preferred tools: ...
   **Accept** these tasks or **Amend** to discuss changes?
   Transitions: accept->FINALIZING, amend->AMENDING
   --- END STATE CARD ---
   ```
4. Confirm the gaps:
   - `Template: traceability.template.json` is a filename string. The columns / rendering / content_guidance / examples in `src/isdlc/config/templates/traceability.template.json` are not inlined.
   - `Sections: traceability_table, assumptions_and_inferences` is a list of section names, not section content requirements.
   - The card never includes `presenting-tasks.card.json:rendering_mandate` (`format: "4_column_traceability_table"`, `columns: [...]`, `bans: ["bullets", "prose_only", ...]`), even though the source card carries it.
   - The card carries no accumulated content from prior accepted stages (rolling state has only boolean flags).
5. Observe the LLM's PRESENTING_TASKS output: format depends on what the LLM recalls from `roundtable-analyst.md`, not on what the card communicates.

## Affected Users

- All users running `/isdlc analyze` on **feature items** — PRESENTING_REQUIREMENTS / PRESENTING_ARCHITECTURE / PRESENTING_DESIGN / PRESENTING_TASKS confirmations are all driven by the same under-rendering composer.
- All users running `/isdlc analyze` on **bug items** — PRESENTING_BUG_SUMMARY / PRESENTING_ROOT_CAUSE / PRESENTING_FIX_STRATEGY / PRESENTING_TASKS confirmations share the same composer.
- Both providers — Claude (state machine reached via `src/core/bridge/roundtable.cjs`) and Codex (state machine reached via `src/providers/codex/projection.js`) call the same ESM composers. Same gap, same symptom.

Build runs are **not** affected — REQ-GH-253 is bounded to analyze (FR-006).

## Symptoms

Direct symptoms of composers under-rendering:
- Traceability matrix at PRESENTING_TASKS rendered as bullets/prose/wrong-shape table — the original surfaced symptom — because the 4-column mandate, columns array, and rendering style live in `presenting-tasks.card.json:rendering_mandate` and `traceability.template.json` but never reach the LLM.
- Section-order drift in PRESENTING_REQUIREMENTS / PRESENTING_ARCHITECTURE / PRESENTING_DESIGN / PRESENTING_BUG_SUMMARY / PRESENTING_ROOT_CAUSE / PRESENTING_FIX_STRATEGY — section names are listed but section structure (narrative-then-details, content_guidance, examples) is not inlined.
- Confirmations missing required content coverage — `presenting-requirements.card.json:content_coverage` lists FRs-with-IDs-MoSCoW, key ACs, confidence levels, etc., but never reaches the LLM.

Indirect symptom of rolling-state having no payload accumulator:
- Later stages cannot quote earlier accepted content — PRESENTING_TASKS cannot embed the FRs accepted at PRESENTING_REQUIREMENTS or the design accepted at PRESENTING_DESIGN, because rolling state only carries boolean flags. The LLM must recall it from the conversation transcript, where it competes with everything else.

## Affected Area

### Where the bug lives

| File | Issue |
|---|---|
| `src/core/roundtable/state-card-composer.js` | `renderCard()` emits filename references and section names instead of inlined content. Does not read `template_ref`. Does not extract `rendering_mandate` / `content_coverage` from card source. |
| `src/core/roundtable/task-card-composer.js` | `renderTaskCard()` emits skill IDs, tool names, output-shape field names, and completion marker. Does not inline skill content (delivery_type labels are present but content is not). Does not include sub-task `description` or any handoff content. |
| `src/core/roundtable/rolling-state.js` | `create()` returns `{coverage_by_topic, scan_complete, scope_accepted, current_persona_rotation, rendering_mode, amendment_cycles, participation_markers, sub_task_completion}`. No payload field for accumulated accepted content. |

### What stays as-is

| File | Why |
|---|---|
| `src/core/bridge/roundtable.cjs` | Pipeline is wired correctly. `composeForTurn` and `processAfterTurn` orchestrate the right calls. |
| `src/core/roundtable/state-machine.js`, `definition-loader.js`, `trailer-parser.js`, `markers/*.js` | Mechanism is sound; transition logic, marker extraction, definition loading work as designed. |
| `src/isdlc/config/roundtable/state-cards/*.card.json` (9 files) | Source content is rich (rendering_mandate, content_coverage, sections, transitions). Not the bug. |
| `src/isdlc/config/roundtable/task-cards/*.task-card.json` (6 files) | Source content is rich. Not the bug. |
| `src/isdlc/config/templates/*.template.json` | Format specs (columns, rendering, content_guidance, examples) are correct. Not the bug. |
| `src/isdlc/config/roundtable/{core,analyze,bug-gather}.json` | State graphs, persona model, tier rules, accept/amend vocab. Not the bug. |
| `src/claude/commands/isdlc.md` STATE-MACHINE-DRIVEN COMPOSITION blocks | Calling the bridge correctly. Prose protocol is fine. |

### What's out of scope (separate follow-up)

- `src/claude/hooks/tasks-as-table-validator.cjs` — pre-existing dead PostToolUse[Write|Edit] hook. Independent of #253's per-turn injection. Possible follow-up ticket if output-side enforcement is wanted on top of better pre-injection.
- Any build-workflow injection (`/isdlc build`) — REQ-GH-253 boundary excludes build phases.
- Codex projection coupling beyond reusing the fixed composers — `src/providers/codex/projection.js` already imports them; once the composers render properly, projection inherits the fix.

## Reporter Notes

Identified during conversation about why a recent analyze run rendered the tasks confirmation as bullets despite #253 being merged. Initial root-cause hypothesis was "missing PreToolUse context-manager hooks" — incorrect: PreToolUse fires on tool calls only, not on every assistant turn, so the state-machine pattern is the right architecture. The actual root cause is the composers under-rendering: they emit a table-of-contents (state name, filename references, section names) instead of the chapters (template content, mandates, accumulated context).

The architecture summary in `docs/requirements/REQ-GH-253-context-manager-hooks-inject-before-delegation/architecture-summary.md` records the design choice "JSON state machine definitions in src/isdlc/config/roundtable/" and "skill manifest reused at sub-task granularity with additive bindings.sub_tasks[] field". The decision was correct. The implementation of `renderCard` / `renderTaskCard` did not follow through on inlining the content the LLM needs.
