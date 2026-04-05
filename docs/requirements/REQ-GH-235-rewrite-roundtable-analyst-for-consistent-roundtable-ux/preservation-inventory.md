# Preservation Inventory: roundtable-analyst.md Rewrite

**Slug**: REQ-GH-235-rewrite-roundtable-analyst-for-consistent-roundtable-ux
**Purpose**: Preserve the known-good roundtable UX while rewriting the prompt structure for consistency, clarity, and stronger execution discipline.

---

## 1. Sources Of Truth

This inventory is derived from:

- the current [roundtable-analyst.md](/Users/vihang/projects/isdlc/isdlc-framework/src/claude/agents/roundtable-analyst.md)
- the preserved snapshot [roundtable-analyst.snapshot-2026-04-05.md](/Users/vihang/projects/isdlc/isdlc-framework/src/claude/agents/roundtable-analyst.snapshot-2026-04-05.md)
- the GH-216 demo conversation in [demo-conversation.md](/Users/vihang/projects/isdlc/isdlc-framework/docs/requirements/REQ-GH-216-make-atdd-the-default-mode-for-all-workflows-remov/demo-conversation.md)
- recent dogfooding failures surfaced during Codex and Claude comparisons
- the strict template enforcement work already landed for GH-234

## 2. User Experience Contract To Preserve

These are the behaviors the rewrite must preserve exactly or strengthen.

- The analysis experience is an interactive roundtable, not a direct artifact-generation routine.
- Maya opens the conversation and asks a single high-value scope-shaping question first.
- Alex contributes codebase evidence after the first user reply or as soon as evidence is ready.
- Jordan surfaces design consequences, tradeoffs, or interface implications before confirmations begin.
- The user sees a natural multi-perspective discussion, not a flat analyst monologue.
- The conversation progresses toward explicit staged confirmations rather than jumping directly to files.
- Configurable conversation rendering modes remain supported:
  - `bulleted`
  - `conversational`
  - `silent`
- Natural-language verbosity override remains supported during an active roundtable.
- Persona extensibility remains supported:
  - users can add new personas
  - users can disable or override existing personas
  - roster selection remains configurable
- Confirmations happen in sequence:
  - Requirements
  - Architecture
  - Design
  - Tasks
- Each confirmation ends with an Accept/Amend decision point and stops for user input.
- Amend restarts the confirmation flow from requirements after the amendment discussion resolves.
- Tier behavior remains intact:
  - standard/epic: requirements, architecture, design, tasks
  - light: requirements, design, tasks
  - trivial: brief mention only, no full Accept/Amend loop
- Early exit still works and writes the best available artifacts with gaps made explicit.

## 3. Behavioral Rules To Preserve

- Stop after every user-directed question or Accept/Amend prompt.
- Never simulate the user’s answer.
- Ask only one primary clarification per exchange.
- Ask only when uncertainty is blocking; infer otherwise and record it.
- Infer non-blocking gaps into `Assumptions and Inferences`.
- Keep the conversation natural:
  - no phase headers
  - no step headers
  - no numbered interview lists
  - no handoff announcements
  - no menu-style scaffolding in normal discussion
- Use codebase analysis as evidence for the roundtable, not as a substitute for it.
- Do not write analysis artifacts before the staged confirmation sequence completes, except on explicit early exit.
- Rendering mode changes affect presentation style only; they must not alter confirmation ordering, template authority, ask-vs-infer rules, or write timing.
- Persona additions change perspective coverage, not the underlying roundtable protocol, unless explicitly configured otherwise.

## 4. Template Authority To Preserve And Strengthen

- Requirements confirmation must use `requirements.template.json`.
- Architecture confirmation must use `architecture.template.json`.
- Design confirmation must use `design.template.json`.
- On-screen Tasks confirmation must use `traceability.template.json`.
- Written `tasks.md` must use `tasks.template.json`.
- `Assumptions and Inferences` is required wherever the active template defines it.
- Tasks confirmation must render the traceability table on screen rather than collapsing into bullets or a prose-only summary.
- Template authority should be local to each confirmation state, not only described elsewhere in the file.

## 5. Roundtable Content Expectations To Preserve

- Requirements confirmation must cover:
  - problem statement
  - user/stakeholder framing
  - FRs and critical ACs
  - assumptions/inferences
  - NFRs
  - out-of-scope
  - prioritization
- Architecture confirmation must cover:
  - options considered
  - selected architecture
  - technology decisions
  - integration architecture
  - assumptions/inferences
- Design confirmation must cover:
  - module overview
  - module design
  - changes to existing
  - wiring summary
  - assumptions/inferences
- Tasks confirmation must cover:
  - FR-to-design-to-task mapping
  - total task count and phase breakdown
  - coverage summary
  - orphan tasks when present
  - assumptions/inferences affecting the task plan

## 6. Rendering Modes To Preserve

- **Bulleted mode**
  - No persona-name attribution in output.
  - Conclusions grouped cleanly by domain or perspective when appropriate.
  - No visible cross-talk, but multi-perspective reasoning is still present.

- **Conversational mode**
  - Persona attributions are visible.
  - Cross-talk and persona-to-persona interplay are visible to the user.
  - This is the closest match to the demo-style roundtable experience.

- **Silent mode**
  - No persona names or visible roundtable framing.
  - Output is unified, but the same underlying roundtable protocol still governs progression.
  - No roster-proposal ceremony or visible persona join announcements.

- **Shared invariant across all rendering modes**
  - Rendering mode must never change:
    - staged confirmation order
    - Accept/Amend gating
    - template binding by confirmation state
    - anti-shortcut behavior
    - assumptions and inferences handling
    - artifact write timing
    - tier-based domain applicability

## 7. Persona Extensibility To Preserve

- Built-in personas remain configurable through roster selection.
- User-added personas remain supported.
- Persona overrides and disabled-persona behavior remain supported.
- Late join remains supported when a topic shift reveals a relevant available persona.
- The rewrite must make explicit that templates are state-owned, not persona-owned.

### Default rule for added personas

- A newly added persona should default to a **contributing persona** unless explicitly configured otherwise.
- Contributing personas:
  - add domain-specific observations
  - influence discussion and summary content
  - do not create new artifact files by default
  - do not add new confirmation stages by default
  - fold their output into the existing state-owned confirmations

### If a persona is promoted beyond contributing

- The rewrite should require explicit configuration for any persona that becomes a primary or domain-owning persona.
- That explicit configuration must define:
  - which domain/state the persona contributes to or owns
  - whether they change visible rendering only or actual domain ownership
  - which template governs that domain
  - whether a new confirmation stage is introduced or the persona folds into an existing one

### Shared invariants for all personas

- Persona changes must not implicitly alter:
  - staged confirmation order
  - Accept/Amend semantics
  - template binding
  - artifact write timing
  - ask-vs-infer rules
  - assumptions and inferences handling

## 8. Runtime And Workflow Invariants To Preserve

- Analysis remains inline execution through the analyze handler, not a separately spawned agent.
- Single-agent mode remains the default operating model.
- Agent Teams remains dormant future design, not active default behavior.
- Analysis does not write to `state.json`.
- Progress tracking remains via `meta.json`.
- Analysis does not create branches.
- Artifact writing still happens in a finalization batch after confirmations.
- `ROUNDTABLE_COMPLETE` remains the completion signal.

## 9. Internal Intelligence Behaviors To Preserve

- Deferred codebase scan: Maya can open before Alex’s scan is complete.
- Coverage steering remains invisible to the user.
- Dynamic depth sensing remains adaptive rather than fixed by explicit user flags.
- Inference logging feeds `Assumptions and Inferences`.
- Scope recommendation still happens before confirmation and can be confirmed or overridden by the user.
- Topic coverage and readiness still inform when the roundtable moves from discussion to confirmation.

## 10. Prompt Smells To Remove In The Rewrite

These are known structural problems that should not survive into the rewritten file.

- Repeated stop/wait instructions across multiple sections.
- Repeated no-write rules across multiple sections.
- Agent Teams details occupying main-path attention despite being dormant.
- Runtime adapter notes mixed into the behavior contract.
- Internal plumbing sections that overshadow user experience rules.
- Template instructions placed far away from the active confirmation state.
- Tasks on-screen format and written `tasks.md` format described together without a hard distinction.
- Qualitative language that leaves too much room for shortcutting when deterministic behavior is needed.

## 11. Behaviors That Conflict And Need Resolution

| Area | Current Behavior A | Current Behavior B | Conflict | Rewrite Decision Needed |
|---|---|---|---|---|
| Stop/wait semantics | `0.4 Turn Boundary Contract` defines stop-after-question behavior | `2.7 Conversation Loop Mechanic` restates the same contract | Duplicate authority creates drift risk | Choose one canonical source and demote the other to a reference or remove it |
| Single-agent vs agent-teams attention | `1.1` makes single-agent the default | `1.2` and `7.*` give extensive agent-teams detail in the main body | Non-default behavior gets disproportionate weight | Move agent-teams mechanics to appendix and keep one short main-path statement |
| Template authority location | `2.5.5` gives explicit template instructions | `2.5.1` state machine does not name the active template per state | State-local execution can drift from distant template guidance | Bind templates directly into each confirmation state |
| Task format authority | `2.5.5` defines on-screen traceability-table tasks summary | `5.6` and finalization rules imply written `tasks.md` output | On-screen and written formats are easy to conflate | Separate on-screen Tasks confirmation from written `tasks.md` artifact rules |
| No-write rule placement | `4.3` says no writes before finalization | `5.2` and `5.5` restate the same rule operationally | Repetition weakens priority | Keep one top-level non-negotiable and one finalization section only |
| UX contract vs adapter detail | `0.*` and `2.*` try to define user-visible behavior | `6`, `7`, `8`, and `ENHANCED SEARCH` mix in operational details | Main execution path is diluted by plumbing | Move adapter/runtime details to appendices |
| Rendering mode scope | `10.2` defines `bulleted`, `conversational`, and `silent` as rendering modes | The rest of the prompt rarely reinforces that these are presentation variants of the same protocol | Mode differences can be mistaken for protocol differences | Move rendering modes earlier and define them as style-only variants over one shared state machine |
| Persona extensibility authority | `10.*` supports configurable personas, overrides, and late joins | Template authority and confirmation ownership are defined elsewhere and not tied clearly to user-added personas | It is unclear what a new persona is allowed to change | Make state ownership and persona influence explicit; added personas default to contributing unless configured otherwise |

## 12. Behaviors Where The Current File And Memory Rules Disagree

These are known or suspected file-vs-dogfooding divergences that the rewrite must resolve explicitly.

| Area | Current File Says | Observed / Memory-Backed Expectation | Tension | Rewrite Decision Needed |
|---|---|---|---|---|
| Roundtable progression | The file allows movement toward confirmation once minimum blocking coverage is reached | Dogfooding expectation is the fuller demo-style roundtable with visible persona discussion before confirmations | Models can legally compress the conversation too early | Add explicit anti-shortcut and minimum pre-confirmation participation rules |
| Template adherence on screen | The file specifies exact templates, mostly in `2.5.5` | Dogfooding expectation is that templates appear on screen reliably at the exact state where they are used | Distant instructions are not reliably followed | Make per-state template authority local and non-negotiable |
| Tasks confirmation rendering | The file requires the traceability table in `2.5.5` | Dogfooding expectation is that tasks never collapse into bullets/prose on screen | Current prompt still permits behavioral compression in practice | Add a stronger “table-first, no substitute rendering” rule |
| File growth and authority | The file contains both current protocol and historical/runtime scaffolding | Dogfooding expectation is a cleaner prompt where the main path is easy to follow consistently | Structural clutter obscures which rule is primary | Rewrite into behavior-first core plus appendices |
| Agent Teams emphasis | The file treats Agent Teams as dormant future design | Dogfooding expectation is that users experience single-thread inline roundtable behavior and are not affected by future-design weight | Too much dormant content influences reading/execution | Move future design to appendix and keep inline model primary |
| Rendering mode semantics | The file treats verbosity modes as configurable late in the document | Dogfooding expectation is that these modes are first-class UX options that do not weaken the roundtable contract | Late placement makes them feel optional or secondary | Elevate rendering modes earlier in the rewritten prompt and define their invariants explicitly |
| Added persona scope | The file supports configurable personas but does not make it explicit whether a new persona can affect templates or confirmation stages | Expected behavior is that new personas add perspective but do not silently alter the protocol | Persona configurability can destabilize UX if ownership is ambiguous | Define added personas as contributing by default and require explicit configuration for domain/template ownership changes |

## 13. Sections Likely To Move To Appendices

- Future Agent Teams design
- file discovery abstraction details
- enhanced search wiring
- detailed `meta.json` field schemas
- low-level switchover/runtime adapter mechanics

These may remain documented, but they should not compete with the main UX contract.

## 14. New Hard Rules The Rewrite Should Add

- The roundtable experience itself is part of the contract, not optional style.
- Do not collapse from first clarification into artifact generation.
- Before first confirmation:
  - Maya must clarify scope
  - Alex must provide concrete codebase evidence
  - Jordan must surface at least one design implication or tradeoff
- Do not present the Tasks confirmation as bullets or narrative summary in place of the required traceability table.
- Do not write artifacts until the required staged confirmations are complete, except for explicit early exit.
- New personas do not create new templates, new domains, or new confirmation stages unless explicitly configured to do so.

## 15. Preserve / Simplify / Remove Matrix

### Preserve as-is

- staged confirmation sequence
- Accept/Amend semantics
- tier-based confirmation scope
- early-exit handling
- assumptions/inferences concept
- scope recommendation concept
- single-agent default
- final `ROUNDTABLE_COMPLETE` signal
- user-configurable personas and roster control

### Preserve but simplify

- ask-vs-infer policy
- dynamic depth sensing
- coverage tracker mechanics
- artifact readiness thresholds
- finalization batch protocol
- contributing personas and verbosity modes
- persona extensibility rules and late-join logic

### Remove from main execution path

- detailed Agent Teams spawn/merge protocol
- file discovery mode internals
- enhanced search explanation
- repeated runtime-resume wording
- low-level `meta.json` mapping tables

## 16. Validation Targets For The Rewrite

The rewritten prompt should be validated against these expectations:

- Codex does not shortcut from clarification to artifact generation.
- Claude and Codex both render the staged confirmation flow in order.
- Each confirmation state explicitly names the governing template.
- Tasks confirmation renders the expected traceability table on screen.
- Written artifact rules remain separate from on-screen confirmation rules.
- Amend restarts the confirmation flow correctly.
- Trivial/light/standard tier behavior still matches the current contract.
- Rendering mode changes do not alter the underlying confirmation protocol.
- Adding a persona does not silently change template ownership or confirmation sequencing.

## 17. Rewrite Brief

The rewrite is successful if it produces a materially cleaner prompt without losing the demo-style roundtable experience. The prompt should become easier to execute correctly, easier to test, and harder for either Claude or Codex to shortcut.
