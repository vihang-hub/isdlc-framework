# Module Design — REQ-GH-235

**Slug**: REQ-GH-235-rewrite-roundtable-analyst-for-consistent-roundtable-ux
**Last Updated**: 2026-04-05

---

## 1. Module Overview

The rewrite spans 4 module clusters:

1. **Prompt files** (2): full rewrites of roundtable prompts
2. **Persona schema** (8 existing + guide): frontmatter extensions for promotion
3. **Runtime composition** (1 new ESM module): composes effective state machine
4. **Enforcement** (3 new hooks + ~4 updated hooks + 16 prompt-verification tests)

**Data flow**: `persona-*.md frontmatter → analyze handler → runtime-composer → effective state machine → roundtable execution → hooks enforce contract`

---

## 2. Rewritten Prompt Structure

Target structure for `src/claude/agents/roundtable-analyst.md` (12-15 main sections + 3 appendices):

| § | Section | Responsibility |
|---|---|---|
| 1 | Purpose & Non-Negotiables | Top-level contract, anti-shortcut rules consolidated |
| 2 | Behavior Contract | Stop/wait, no-write-before-confirmations, single source of truth |
| 3 | Operating Model | Single-agent default (brief; Agent Teams in Appendix A) |
| 4 | Persona Model | Core + contributing + promotion schema (plugin model), all inline |
| 5 | Rendering Modes | bulleted/conversational/silent + shared invariants (first-class) |
| 6 | Conversation Rendering Rules | No phase headers, no menus, brevity, earn-each-question |
| 7 | Roundtable State Machine | State table WITH state-local template bindings inline |
| 8 | Domain Confirmation Contracts | Per-state: entry/presenter/template/response/transitions |
| 9 | Ask vs Infer + Depth Policy | Clarifying question gate, dynamic depth |
| 10 | Scope Recommendation + Tier Rules | Tier-based domain applicability |
| 11 | Early Exit Exception | Explicit early-exit contract |
| 12 | Finalization Rules | Batch write protocol, single no-write rule |
| A | Appendix A: Agent Teams | Dormant future design |
| B | Appendix B: Runtime Adapter Notes | Provider-specific transport details |
| C | Appendix C: Meta/Search Internal Data | Schemas, field mappings |

Each state in §7 binds its template inline:
```
State: PRESENTING_REQUIREMENTS
Entry:     coverage complete on requirements topics
Presenter: Maya
Template:  requirements.template.json   <-- STATE-LOCAL
Sections:  [functional_requirements, assumptions_and_inferences, nfr, out_of_scope, prioritization]
Response:  {Accept|Amend}
Next:      Accept -> PRESENTING_ARCHITECTURE (or PRESENTING_DESIGN if light tier)
           Amend  -> AMENDING
```

---

## 3. Runtime Composer Module

**Location**: `src/core/roundtable/runtime-composer.js` (ESM per Article XIII)

**Responsibility**: Compose the effective roundtable state machine from (a) default protocol defined in `roundtable-analyst.md` and (b) persona extension declarations from persona-*.md frontmatter.

**Public interface**:
```javascript
// runtime-composer.js
export function composeEffectiveStateMachine(defaultStateMachine, personaFiles) {
  // defaultStateMachine: array of state objects (from parsed roundtable-analyst.md)
  // personaFiles: array of { path, frontmatter, body }
  // returns: { effectiveStateMachine, conflicts[], warnings[] }
}

export function validatePromotionFrontmatter(frontmatter) {
  // returns: { valid: boolean, errors: string[] }
}

export function detectInsertionConflicts(personaFiles) {
  // returns: array of { insertion_point, personas: [...], resolution: 'first-wins' }
}
```

**Composition algorithm**:
1. Start with `defaultStateMachine` (ordered state list)
2. For each persona in `personaFiles`:
   - If `frontmatter.role_type !== "primary"`: skip (contributing folds into existing states)
   - Validate required promotion fields: `owns_state`, `template`, `inserts_at`
   - If invalid: record warning, skip
3. For each valid primary persona:
   - Parse `inserts_at` as `{before|after}:{state_name}`
   - Insert new state into effective list at declared position
   - Bind declared `template` to the new state
4. Detect conflicts: if two primaries target same `inserts_at`, first-declared wins, record warning
5. Return `{ effectiveStateMachine, conflicts, warnings }`

**Error handling**:
- Invalid frontmatter → warning, skip persona (fail-open per Article X)
- Conflicting insertion points → first-wins + warning
- Unknown extension point → warning, skip
- Never throws; analysis always proceeds

---

## 4. Persona Frontmatter Schema

**Contributing persona** (existing, unchanged):
```yaml
---
name: persona-security-reviewer
role_type: contributing
domain: security
triggers: [auth, encryption, OWASP, ...]
owned_skills: [SEC-001]
---
```

**Promoted persona** (NEW schema):
```yaml
---
name: persona-data-architect
role_type: primary                              # NEW: promoted
domain: data_architecture                        # existing
owns_state: data_architecture                    # NEW: state the persona owns
template: data-architecture.template.json        # NEW: governing template
inserts_at: after:architecture                   # NEW: extension point
rendering_contribution: ownership                # NEW: "ownership" | "rendering-only"
owned_skills: []
---
```

**Extension-point taxonomy** (named, stable):
- `before:requirements`
- `after:requirements`
- `after:architecture`
- `after:design`
- `after:tasks`

Additional points can be declared by personas (composer validates they map to known default states).

---

## 5. New Hooks

### tasks-as-table-validator.cjs
- **Trigger**: PostToolUse after any Write/Edit in artifact folder
- **Purpose**: When confirmation state was PRESENTING_TASKS, verify last assistant turn contained traceability table markers (pipe-delimited header, ≥4 columns)
- **Block on violation**: flag for re-render
- **Dependencies**: common.cjs

### participation-gate-enforcer.cjs
- **Trigger**: Stop hook (tracks conversation state)
- **Purpose**: Before PRESENTING_REQUIREMENTS, verify 3 primary persona contributions occurred (scope statement + codebase evidence + design implication)
- **Internal-only in silent mode**: checks for semantic markers, not persona-name attributions
- **Dependencies**: common.cjs

### persona-extension-composer-validator.cjs
- **Trigger**: PreToolUse on Task dispatch for analyze
- **Purpose**: Validates promoted persona frontmatter schemas; logs conflicts; never blocks
- **Dependencies**: common.cjs

---

## 6. Hook Updates (known drift)

| Hook | Drift | Update Required |
|---|---|---|
| conversational-compliance.cjs | Assertions reference current §2.2 conversation flow rules | Align with §6 (new section) |
| output-format-validator.cjs | Template refs point to centralized §2.5.5 | Update to state-local refs |
| menu-halt-enforcer.cjs | Rule location reference | Update to §6 (conversation rendering rules) |
| (audit-driven) | TBD | Discovered in T032 |

---

## 7. bug-roundtable-analyst.md Parallel Structure

Same 12-section skeleton as roundtable-analyst.md, with bug-specific confirmation states:

| Section | Contents |
|---|---|
| §7 State Machine | PRESENTING_BUG_SUMMARY, PRESENTING_ROOT_CAUSE, PRESENTING_FIX_STRATEGY, PRESENTING_TASKS |
| §8 Confirmation Contracts | bug-summary.template.json, root-cause.template.json, fix-strategy.template.json, traceability.template.json |

Reuses runtime composer from FR-005.

---

## 8. Module Dependencies

```
roundtable-analyst.md (prompt)
  └─ references: requirements.template.json, architecture.template.json,
                 design.template.json, traceability.template.json, tasks.template.json

bug-roundtable-analyst.md (prompt)
  └─ references: bug-summary.template.json, root-cause.template.json,
                 fix-strategy.template.json, traceability.template.json

runtime-composer.js (ESM)
  └─ imports: (none — pure function)
  └─ exported to: analyze handler via src/core/bridge/

persona-*.md (files)
  └─ read by: analyze handler at session-cache build + dispatch time

hooks (*.cjs)
  └─ require: common.cjs
  └─ registered: .claude/settings.json
```

**No circular dependencies.**

---

## 9. Estimated Complexity

| Module | Lines (est.) | Complexity |
|---|---|---|
| roundtable-analyst.md (rewritten) | ~500-600 (down from 987) | High |
| bug-roundtable-analyst.md (rewritten) | ~400-500 | High |
| runtime-composer.js | ~150-200 | Medium |
| runtime-composer.test.js | ~200-250 | Medium |
| 3 new hooks | ~100-150 each | Medium |
| 3 new hook tests | ~150-200 each | Low |
| 7 new prompt-verification tests | ~80-120 each | Low |
| 1 new bug prompt test | ~80-120 | Low |
| Hook updates (4 hooks) | ~20-50 delta each | Low |
| Doc updates | ~50-150 delta each | Low |
