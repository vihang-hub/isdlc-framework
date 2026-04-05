# Interface Specification — REQ-GH-235

**Slug**: REQ-GH-235-rewrite-roundtable-analyst-for-consistent-roundtable-ux
**Last Updated**: 2026-04-05

---

## 1. Runtime Composer Public API

**Module**: `src/core/roundtable/runtime-composer.js`

### composeEffectiveStateMachine

```javascript
/**
 * Compose effective state machine from defaults + persona declarations.
 * @param {StateMachine} defaultStateMachine - parsed from roundtable-analyst.md
 * @param {PersonaFile[]} personaFiles - loaded persona files with frontmatter
 * @returns {ComposeResult}
 */
export function composeEffectiveStateMachine(defaultStateMachine, personaFiles)
```

**Types**:
```typescript
type StateMachine = {
  states: State[];
  transitions: Transition[];
};

type State = {
  name: string;              // e.g. "PRESENTING_REQUIREMENTS"
  presenter: string;         // persona name
  template: string;          // e.g. "requirements.template.json"
  sections: string[];        // template section keys
  allowed_responses: string[]; // ["Accept", "Amend"]
};

type PersonaFile = {
  path: string;
  frontmatter: {
    name: string;
    role_type: "primary" | "contributing";
    domain?: string;
    owns_state?: string;
    template?: string;
    inserts_at?: string;
    rendering_contribution?: "ownership" | "rendering-only";
    triggers?: string[];
    owned_skills?: string[];
  };
  body: string;
};

type ComposeResult = {
  effectiveStateMachine: StateMachine;
  conflicts: Conflict[];
  warnings: Warning[];
};

type Conflict = {
  insertion_point: string;    // e.g. "after:architecture"
  personas: string[];         // names of personas targeting same point
  resolution: "first-wins";
  chosen: string;             // name of winning persona
};

type Warning = {
  persona: string;
  reason: string;             // "missing_owns_state" | "unknown_extension_point" | etc.
};
```

### validatePromotionFrontmatter

```javascript
/**
 * Validate that promoted persona frontmatter has required fields.
 * @param {object} frontmatter
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validatePromotionFrontmatter(frontmatter)
```

**Validation rules**:
- `role_type === "primary"` requires: `owns_state`, `template`, `inserts_at`
- `owns_state` must be non-empty string, matching `[a-z_]+`
- `template` must end with `.template.json`
- `inserts_at` must match `(before|after):(requirements|architecture|design|tasks)`
- `rendering_contribution` (optional) must be `"ownership"` or `"rendering-only"` (defaults to `"ownership"`)

### detectInsertionConflicts

```javascript
/**
 * Detect personas targeting the same insertion point.
 * @param {PersonaFile[]} personaFiles
 * @returns {Conflict[]}
 */
export function detectInsertionConflicts(personaFiles)
```

---

## 2. Hook Interfaces

All new hooks follow the standard iSDLC hook contract:

### Hook I/O contract
```
INPUT (stdin JSON):
{
  "tool_name": "Write|Edit|Task|Stop|...",
  "tool_input": { ... },
  "tool_response": { ... },       // PostToolUse only
  "transcript": [ ... ],          // last N messages
  "context": { ... }              // session context
}

OUTPUT (stdout, optional):
- empty string: silent pass
- "BLOCK: <reason>": block with reason (PreToolUse only, when authorized)
- "WARN: <reason>": warning, continue

EXIT CODE:
- 0: always (fail-open per Article X)
```

### tasks-as-table-validator.cjs
- **Matcher**: `PostToolUse` with `tool_name: "Write"|"Edit"`
- **Stdin context**: last assistant message, current confirmation state
- **Block condition**: confirmation state was `PRESENTING_TASKS` AND last message lacks traceability-table markers
- **Output**: `WARN: Tasks confirmation must render traceability table, not bullets/prose`

### participation-gate-enforcer.cjs
- **Matcher**: `Stop` hook
- **Stdin context**: conversation history, tracked participation flags
- **Block condition**: first confirmation reached without all 3 primary persona contributions
- **Output**: `WARN: Pre-confirmation participation gate not met (Maya scope + Alex evidence + Jordan design implication required)`

### persona-extension-composer-validator.cjs
- **Matcher**: `PreToolUse` with `tool_name: "Task"` and subagent analyzing
- **Stdin context**: persona files loaded for the analyze session
- **Block condition**: never blocks (fail-open)
- **Output**: `WARN: Persona '{name}' missing required promotion fields: {fields}` or `WARN: Insertion conflict at '{point}': first-wins -> {chosen}`

---

## 3. Persona Frontmatter Schema Contract

### Contributing persona (unchanged)
Required: `name`, `role_type: contributing`
Optional: `domain`, `triggers`, `owned_skills`, `version`

### Promoted persona (new schema)
Required: `name`, `role_type: primary`, `owns_state`, `template`, `inserts_at`
Optional: `domain`, `rendering_contribution` (defaults `ownership`), `triggers`, `owned_skills`, `version`

### Validation behavior
- Missing required promotion fields → warning, persona treated as contributing
- Invalid `inserts_at` format → warning, persona treated as contributing
- Unknown extension point → warning, persona treated as contributing
- Duplicate `owns_state` across personas → first-wins, others warned

---

## 4. Config Interface (future)

**Location**: `.isdlc/config.json`

**Namespace**: `sprawl_detection` (deferred to separate REQ, documented here for future reference)

```json
{
  "sprawl_detection": {
    "enabled": false,
    "thresholds": {
      "grep_hits_per_pattern": 10,
      "subsystems_touched": 3,
      "blast_radius_files": 20,
      "conditional_edit_ratio": 0.6
    }
  }
}
```

---

## 5. Examples

### Valid contributing persona (zero-touch, unchanged)
```yaml
---
name: persona-security-reviewer
role_type: contributing
domain: security
triggers: [auth, encryption, OWASP]
owned_skills: [SEC-001]
---
```

### Valid promoted persona
```yaml
---
name: persona-data-architect
role_type: primary
domain: data_architecture
owns_state: data_architecture
template: data-architecture.template.json
inserts_at: after:architecture
rendering_contribution: ownership
owned_skills: []
---
```

### Invalid promoted persona (missing fields)
```yaml
---
name: persona-broken
role_type: primary
domain: mystery
# MISSING: owns_state, template, inserts_at
---
```
Composer result: warning emitted, persona treated as contributing for this analyze session.
