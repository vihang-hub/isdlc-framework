# Fix Strategy Summary: BUG-GH-265

**Approach**: A1 — Inline references. Extend the existing renderers to load and inline content the cards already point at; add a payload accumulator to rolling state.

**Sequencing** (single PR, three commit boundaries):

1. **Renderers** — `state-card-composer.js renderCard` extracts `rendering_mandate` and `content_coverage`, loads `template_ref` body, inlines columns/rendering/content_guidance/examples. `task-card-composer.js renderTaskCard` inlines skill bodies per delivery_type. Soft per-section budget replaces 40-line hard cap. ~150 LOC, both composer test files updated.

2. **Rolling state + bridge plumbing** — `rolling-state.js create()` adds `accepted_payloads` (one entry per PRESENTING_* state, default null). `applyAcceptedPayload` writer captures accepted text. `bridge/roundtable.cjs composeForTurn` passes `rollingState.accepted_payloads` through `context`. New payload-propagation test + provider parity test.

3. **Doc touch** — `isdlc.md:757, 905` description of card contents updated to reflect inlined-content reality.

**Files affected**: `src/core/roundtable/{state-card-composer,task-card-composer,rolling-state}.js`, `src/core/bridge/roundtable.cjs`, `src/claude/commands/isdlc.md`. ~250 LOC additions.

**No source JSON changes**. Codex projection inherits via shared ESM imports.

**Risk**: token-budget blowups at later stages (mitigation: per-payload digest cap with `[truncated; see <ARTIFACT_FOLDER>/<file>.md]` pointer); rolling-state schema migration for in-flight sessions (mitigation: defensive init in `update()`); skill-body read performance (mitigation: existing module cache); Codex parity (mitigation: T008 parity test).

**Article X preservation**: every new file read wrapped in try/catch with `referenceFallback(name)` helper — fallback to current filename-only behavior on read failure. Composer never throws.

**Test additions**:
- Per-state golden-card snapshots asserting inlined content (9 state cards × 6 task cards)
- Payload-propagation test (Accept across all PRESENTING_*)
- Token-budget regression test (largest expected card stays within configured budget)
- Provider parity test (Claude bridge vs Codex projection)
- Article X fail-open test (induced read failure → reference fallback)
- Rolling-state migration test (legacy state → self-heal via `update()`)

**Out of scope (deferred)**: A3 Stop hook output enforcement; `tasks-as-table-validator.cjs` replacement; build-workflow injection.
