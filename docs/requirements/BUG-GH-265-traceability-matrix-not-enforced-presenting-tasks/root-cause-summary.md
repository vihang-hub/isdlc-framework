# Root Cause Summary: BUG-GH-265

**Primary (high confidence)**: Three sub-defects in `src/core/roundtable/`:

1. `state-card-composer.js renderCard` (lines 111-200) emits `template_ref` as filename, never reads referenced template; emits `required_sections` as names, never inlines `content_guidance`; never reads `template.rendering_mandate` or `template.content_coverage` despite both being on source cards.
2. `task-card-composer.js renderTaskCard` + `renderSkillLine` (lines 188-276) emits skill IDs with `[FULL|RULES|REF]` labels but never inlines skill bodies.
3. `rolling-state.js create()` (lines 49-70) has no `accepted_payloads` field; later PRESENTING_* stages structurally cannot quote earlier accepted content.

**Refuted hypotheses**: Handler skipping `composeForTurn` (RFTD — bridge calls confirmed at `isdlc.md:685, 689, 757, 860, 864`). `migration_mode` misconfigured (RFTD — default is `'mechanism'`).

**Doc-touch (rides along)**: `isdlc.md:757, 905` description of card contents matches the broken renderer; needs one-line update once renderer inlines content.

**Pipeline mechanics that ARE correct (no change needed)**: `bridge/roundtable.cjs` composeForTurn, `state-machine.js`, `definition-loader.js`, `trailer-parser.js`, `markers/*.js`, `runtime-composer.js`, all source JSON (state-cards, task-cards, templates, core/analyze/bug-gather).
