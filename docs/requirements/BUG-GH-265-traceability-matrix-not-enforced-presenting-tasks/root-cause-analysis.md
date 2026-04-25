# Root Cause Analysis: BUG-GH-265

**Owner**: Alex (Solutions Architect)
**Source**: Tracing analysis (T1 symptom-analyzer + T2 execution-path-tracer + T3 root-cause-identifier in ANALYSIS_MODE)
**Confidence**: High

---

## Hypotheses (ranked)

### H1 — Composers under-render + rolling state lacks payload accumulator (PRIMARY, high confidence)

Three concrete sub-defects, all in `src/core/roundtable/`:

1. **`state-card-composer.js renderCard()` (lines 111-200)** — emits `template_ref` as a filename string; never reads the referenced template file. Emits `required_sections` as names; never inlines per-section `content_guidance`. Never reads `template.rendering_mandate` or `template.content_coverage` even though both are present on source cards.

2. **`task-card-composer.js renderTaskCard()` (lines 203-276) + `renderSkillLine` (lines 188-193)** — emits skill IDs with `[FULL|RULES|REF]` labels but never inlines skill bodies. The doc comment on lines 180-184 explicitly promises `[FULL]` means "full skill content injected" — promise kept on the label, broken on the content. Tools and output shape are emitted as identifiers only.

3. **`rolling-state.js create()` (lines 49-70)** — returns booleans, counters, and rotation order; no payload accumulator. `update()` (lines 84-113) has no path to merge accepted-stage content. Later PRESENTING_* stages structurally cannot quote earlier accepted content.

This single multi-part defect explains all four reported symptoms. Source JSON is rich and untouched (`src/isdlc/config/roundtable/state-cards/*.card.json` × 9, `src/isdlc/config/roundtable/task-cards/*.task-card.json` × 6, `src/isdlc/config/templates/*.template.json`). Fixing the renderers + accumulator turns existing source content from references into payloads; no schema or graph changes required.

### H2 — Handler skipping `composeForTurn` calls (REFUTED)

`src/claude/commands/isdlc.md` lines 685, 689, 757, 860, 864 explicitly call the bridge each turn for both feature and bug paths. `src/core/bridge/roundtable.cjs:180-234` confirms both composers are invoked when `composeForTurn` runs. The pipeline does fire — it just emits thin output.

### H3 — `migration_mode` misconfigured to `'prose'` (REFUTED)

Default is `'mechanism'` per `src/core/config/config-defaults.js:46` and `src/core/config/config-service.js:287`. No project override sets it to `'prose'`. `initializeRoundtable` returns null only on `'prose'`; mechanism path runs.

### H4 — Prose protocol description echoes the broken renderer (TERTIARY, doc-touch)

`isdlc.md:757` and `isdlc.md:905` describe the composed card as containing "the full template reference, required sections, presenter, and accept/amend prompt" — which matches what `renderCard` emits today. Prose protocol is consistent with the broken renderer; not a separate defect, but the wording will need a one-line update once the renderer inlines content. Rides along with the H1 fix.

---

## Affected Code Paths

### Per-turn call chain (Claude)

```
src/claude/commands/isdlc.md (STATE-MACHINE-DRIVEN COMPOSITION blocks @ 685, 689, 757, 860, 864)
  └─ require('src/core/bridge/roundtable.cjs')
       └─ composeForTurn(machine, rollingState, context, manifestContext)        [bridge.cjs:180]
            ├─ machine.getCurrentState() -> currentState                         [bridge.cjs:186]
            ├─ machine.currentSubTask() -> activeSubTask                         [bridge.cjs:188]
            ├─ composeStateCard(currentState, context)                           [bridge.cjs:195]
            │     ├─ loadCardTemplate -> reads state-cards/<state>.card.json     [scc:75-86]
            │     ├─ renderCard(template, renderContext)                         [scc:111-200]   <-- UNDER-RENDER
            │     │     emits: STATE header, Personas, Active, Rendering,
            │     │            Presenter, Template (FILENAME), Sections (NAMES),
            │     │            Invariants, Topic coverage, Amendment cycles,
            │     │            Preferred tools, accept_amend_prompt, Transitions
            │     │     does NOT emit: rendering_mandate, content_coverage,
            │     │            template body (columns/rendering/content_guidance/example),
            │     │            content_authority, post_table_sections details,
            │     │            accumulated prior-stage payloads
            │     └─ returns ~14-18 line text block
            └─ composeTaskCard(activeSubTask, manifestContext)                   [bridge.cjs:207]
                  ├─ loadTaskCardTemplate -> reads task-cards/<id>.task-card.json
                  ├─ computeInjectionPlan -> manifestSkills                      [tcc:331-341]
                  ├─ mergeAndSortSkills(templateSkills, manifestSkills)          [tcc:118-151]
                  └─ renderTaskCard(template, skills, activeSubTask)             [tcc:203-276]   <-- UNDER-RENDER
                        emits: TASK header, Purpose, Skills (ID + label only,
                               NO skill body), Tools (NAMES), Output (shape +
                               field NAMES), Completion (marker)
                        does NOT emit: skill body for delivery_type=context,
                               sub-task description from definition,
                               handoff content / preconditions / examples
```

### Per-turn call chain (Codex)

`src/providers/codex/projection.js` imports the same composers — identical under-rendering surface, identical bug surface.

### Exact lines where content drops

- `src/core/roundtable/state-card-composer.js:140-141` — `if (template.template_ref) { lines.push(`Template: ${template.template_ref}`); }` — emits filename, never reads the file or inlines its `format.columns`, `rendering`, `content_guidance`, or `example` blocks.
- `src/core/roundtable/state-card-composer.js:144-147` — `Sections: ${template.required_sections.join(', ')}` — emits names only; `content_guidance` per section is never inlined.
- `src/core/roundtable/state-card-composer.js:111-200` (whole `renderCard`) — no read of `template.rendering_mandate` or `template.content_coverage`.
- `src/core/roundtable/task-card-composer.js:188-193` — `renderSkillLine` emits `${skill.id} [${typeLabel}] (${skill.source})` only; no skill-body inlining.
- `src/core/roundtable/task-card-composer.js:225-258` — Tools as names; output shape as field-name list.
- `src/core/roundtable/rolling-state.js:49-70` — `create()` returns no payload accumulator field.

### Pipeline mechanics that are NOT broken (verified, ruled out)

- `src/core/bridge/roundtable.cjs:115-154` `initializeRoundtable` reads `migration_mode`; default is `'mechanism'`, pipeline is active. Refutes H3.
- `src/core/bridge/roundtable.cjs:180-234` `composeForTurn` correctly invokes both composers each turn.
- `src/claude/commands/isdlc.md` STATE-MACHINE-DRIVEN COMPOSITION blocks call the bridge per-turn. Refutes H2.

---

## Blast Radius

### Direct (must change)

- `src/core/roundtable/state-card-composer.js`
- `src/core/roundtable/task-card-composer.js`
- `src/core/roundtable/rolling-state.js`

Roughly 200-300 LOC across the three files, mostly inside `renderCard`, `renderTaskCard`, `renderSkillLine`, and the rolling-state `create`/`update` pair.

### Transitive (changes by inheritance)

- `src/core/bridge/roundtable.cjs` — `composeForTurn` signature may need an optional `acceptedPayloads` field on the `context` object; bridge body otherwise unchanged.
- `src/providers/codex/projection.js` — inherits the fix automatically because it imports the same ESM composers.

### Tests

- `tests/core/roundtable/composers/state-card-composer.test.js` (update)
- `tests/core/roundtable/composers/task-card-composer.test.js` (update)
- `tests/core/roundtable/rolling-state/rolling-state.test.js` (update)
- New payload-accumulation test (driving Accept across all PRESENTING_* states)
- New provider parity test (Claude bridge ↔ Codex projection)

### Doc touch

- `src/claude/commands/isdlc.md:757` and `:905` — one-line description update each.

### Untouched

- `state-machine.js`, `definition-loader.js`, `trailer-parser.js`, `markers/*.js`, `runtime-composer.js`, `bridge/roundtable.cjs` mechanics.
- All source JSON: `state-cards/*.card.json`, `task-cards/*.task-card.json`, `templates/*.template.json`, `core.json`, `analyze.json`, `bug-gather.json`.

### Out of scope (separate)

- `src/claude/hooks/tasks-as-table-validator.cjs` — pre-existing dead PostToolUse hook. Independent of #253's per-turn injection.
- Build-workflow injection — REQ-GH-253 boundary excludes build phases.
- Codex projection coupling beyond reusing the fixed composers.

---

## Evidence

- `presenting-tasks.card.json:16-21` carries `rendering_mandate.format = "4_column_traceability_table"`, `columns: [...]`, `style: "pipe_delimited"`, `bans: [...]`. None reach the LLM today.
- `presenting-requirements.card.json:23-29` carries `content_coverage` listing FRs-with-IDs-MoSCoW, key ACs, references, confidence levels. Never extracted.
- `traceability.template.json` carries `format.columns`, `rendering` (table_style: ascii_box, cell_wrap, row_separator, empty_cell), `content_guidance` per column with structured narrative+details examples. Never read by renderer.
- `state-card-composer.js:140-141` verbatim: emits filename only.
- `rolling-state.js:49-70` verbatim returned object: no accumulator field.
- Tracing T2 confirmed `composeForTurn` reaches both composers correctly each turn; bug is one layer down in the renderers themselves.
- `config-defaults.js:46`: `migration_mode: 'mechanism'` — pipeline active.
