# Fix Strategy: BUG-GH-265

**Owner**: Jordan (System Designer)
**Recommended Approach**: A1 — Inline references

---

## Approaches

### A1 — Inline references (RECOMMENDED)

Extend the existing renderers to load and inline the content the cards already point at, plus add a payload accumulator to rolling state.

**What changes**:

- **`state-card-composer.js renderCard`** — extract `template.rendering_mandate` and `template.content_coverage` (already present on source cards). Load the file referenced by `template.template_ref` from `src/isdlc/config/templates/`. Inline its `format.columns`, `rendering`, per-section `content_guidance`, and `example`. Read `context.acceptedPayloads[<priorState>]` and inline prior accepted content into PRESENTING_* cards. Convert the strict 40-line cap to a soft per-section budget so rich content isn't tail-dropped.

- **`task-card-composer.js renderTaskCard` + `renderSkillLine`** — for `delivery_type=context` entries, load the skill body via the same path `injection-planner.js` uses and inline it. For `delivery_type=instruction`, inline a key-rules extract. Surface sub-task `description` even when template is missing. Keep `[REF]` as the only true pointer-only mode.

- **`rolling-state.js create`** — add `accepted_payloads: { PRESENTING_REQUIREMENTS: null, PRESENTING_ARCHITECTURE: null, PRESENTING_DESIGN: null, PRESENTING_TASKS: null, PRESENTING_BUG_SUMMARY: null, PRESENTING_ROOT_CAUSE: null, PRESENTING_FIX_STRATEGY: null }`. Add an `applyAcceptedPayload(state, stateName, payload)` writer or extend `update()` to accept it. `processAfterTurn` captures the accepted payload on the relevant Accept transition.

- **`bridge/roundtable.cjs composeForTurn`** — pass `rollingState.accepted_payloads` through `context.acceptedPayloads` to the state-card composer.

- **`isdlc.md:757, 905`** — one-line update to the prose description of card contents (rides along with the renderer fix).

**Files affected**: 3 in `src/core/roundtable/`, 1 in `src/core/bridge/`, 1 in `src/claude/commands/`. ~250 LOC of net additions. 3 test files updated, 2 added.

**Pros**:
- Matches T3 H1 hypothesis exactly
- No schema change to source JSON
- No provider-specific code (Codex inherits via shared ESM imports)
- No architectural shift, additive surface area
- Fail-open behavior preserved (renderers still emit minimal cards on any error)

**Cons**:
- Card size grows — current `MAX_TOTAL_LINES = 40` is too tight; the soft-budget conversion must avoid blowing token budgets at PRESENTING_TASKS (which would inline both template content AND three prior accepted payloads).
- Mitigation: per-payload digest size cap with explicit `[truncated, see ARTIFACT_FOLDER/<file>.md]` pointer fallback when over budget.

### A2 — Restructure source: collapse template_ref into card body (REJECTED)

Move the format spec from `templates/*.template.json` into each `state-cards/*.card.json` so the renderer reads only one file per stage.

Rejected during the analyze conversation — the user picked option (a) "keep it clean", preserving the indirection between state-cards and templates. A2 would duplicate format content (e.g., `traceability.template.json` is referenced by both PRESENTING_TASKS state cards in analyze + bug); de-normalization bites at maintenance.

### A3 — Output-side enforcement (Stop hook) (DEFERRED)

Add a Stop hook that intercepts assistant turns at PRESENTING_* states, validates output against the relevant template, blocks (forces re-render) on violation. Independent of state-machine; would close the format-drift symptom regardless of card thinness.

Deferred because:
- Doesn't address the root cause (LLM still recalling format from `roundtable-analyst.md`)
- Doesn't help with content-coverage gaps or accumulated-context gaps
- Adds latency on every PRESENTING_* turn

Worth doing later as defense-in-depth on top of A1, but as the primary fix it would leave the root cause unfixed. Tracked as out-of-scope follow-up alongside replacement of the dead `tasks-as-table-validator.cjs`.

---

## Recommended Approach

**A1 — Inline references.** Only approach that fixes the root cause T3 identified. A2 was rejected during the analyze conversation. A3 is band-aid (already noted as out-of-scope follow-up in the bug report).

The fix shape lines up with what user already chose: "option a, keep it clean" — preserve the indirection between state-cards and templates, just make the renderer actually traverse it.

### Sequencing within A1

Single PR, three commit boundaries:

1. **Extend renderers (composer changes)** — `state-card-composer.js renderCard` and `task-card-composer.js renderTaskCard` updated to inline `rendering_mandate`, `content_coverage`, `template_ref` body, skill body for delivery_type=context, sub-task description. Convert hard 40-line cap to soft budget. Tests for both composers updated to assert inlined content.

2. **Add rolling-state accumulator + bridge plumbing** — `rolling-state.js create()` + `update()` extended; `bridge/roundtable.cjs composeForTurn` passes payloads through context. New test driving Accept across all PRESENTING_* and asserting payload propagation.

3. **Doc touch** — `isdlc.md:757, 905` description of card contents updated to reflect the inlined-content reality.

Each commit ships green tests independently.

---

## Regression Risk

### Token-budget blowup at later stages

PRESENTING_TASKS would inline its own template content (~80-120 lines from `traceability.template.json`) plus three prior accepted payloads (REQUIREMENTS, ARCHITECTURE, DESIGN). Without per-payload digest caps, a card could exceed sane prompt-budget targets.

**Mitigation**: per-payload soft cap (e.g., 200 lines), truncation with explicit pointer `[truncated; full text at <ARTIFACT_FOLDER>/<file>.md after Accept]`. The full content is already on disk after `processAfterTurn` — composer only needs a digest.

### Rolling-state schema migration

Sessions started before the fix have no `accepted_payloads` field.

**Mitigation**: `rolling-state.update()` defensively initializes the field if missing. No persistence change needed (rolling state is in-memory, not persisted to disk per `rolling-state.js:1-6` "Not persisted; meta.json remains the persistent progress handle").

### Skill-body inlining performance

For `delivery_type=context` skills, inlining at every turn re-reads the skill file. Most sub-tasks have ≤2 context skills; files are small; performance impact is negligible.

**Mitigation**: bridge module cache already exists for ESM composers; if hot-spot emerges, add per-skill content cache scoped to the rolling-state lifetime.

### Codex projection

`src/providers/codex/projection.js` imports the ESM composers directly. Larger card output flows through to projection bundles automatically; needs verification that projection doesn't truncate to a smaller-than-Claude budget.

**Mitigation**: parity test driving the same composer call from both Claude and Codex paths, asserting composed string matches.

### Flaky tests during the change

Golden-card snapshot tests for the 9 state cards × 6 task cards are sensitive to formatting.

**Mitigation**: snapshots assert structural content (presence of columns, mandate, etc.), not exact string match.

### Article X preservation

Current renderers are wrapped in try/catch with `buildMinimalCard` / `buildMinimalTaskCard` fallbacks. New inlining must preserve this — every new file read must be inside a try/catch with graceful degradation to `[reference: <filename>]` fallback.

---

## Test Gaps

- **Per-state golden-card snapshots** — current composer tests assert `Template: <filename>` is present (which IS the bug). Need new snapshots for each of 9 state cards asserting inlined columns/rendering_mandate/content_coverage are present. Per-task-card golden snapshots for the 6 task cards asserting skill body present for `delivery_type=context`.

- **Payload-propagation test** — drive Accept across all four feature PRESENTING_* states and assert each later stage's card contains the prior stage's accepted text. Same for the four bug PRESENTING_* states.

- **Token-budget regression test** — render the largest expected card (PRESENTING_TASKS with three prior payloads) and assert it stays within a configured budget; assert truncation with pointer fallback when over.

- **Provider parity test** — invoke `composeStateCard` and `composeTaskCard` from both Claude bridge and Codex projection paths; assert identical output. Currently no test covers this.

- **Article X fail-open test** — corrupt `traceability.template.json` (or simulate read failure), assert composer falls back to a minimal card with reference fallback, never throws.

- **Rolling-state migration test** — initialize rolling state without `accepted_payloads`, call `applyAcceptedPayload`, assert it self-heals.
