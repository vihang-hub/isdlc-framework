# Interface Specification: BUG-0031 -- gate-blocker blocks /isdlc analyze and /isdlc add

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-02-22
**Coverage**: Interface contracts, validation rules, examples

---

## Interface 1: isGateAdvancementAttempt(input) -- Updated

### Signature

```javascript
/**
 * Detect if this is a gate advancement attempt.
 * @param {Object} input - Parsed stdin JSON from Claude Code hook protocol
 * @param {string} input.tool_name - "Task" | "Skill" | other
 * @param {Object} input.tool_input - Tool-specific input
 * @param {string} [input.tool_input.skill] - Skill name (for Skill tool)
 * @param {string} [input.tool_input.args] - Skill args (for Skill tool)
 * @param {string} [input.tool_input.prompt] - Task prompt (for Task tool)
 * @param {string} [input.tool_input.description] - Task description (for Task tool)
 * @param {string} [input.tool_input.subagent_type] - Subagent type (for Task tool)
 * @returns {boolean} true if this is a gate advancement attempt, false otherwise
 */
function isGateAdvancementAttempt(input)
```

### Behavior Contract

**Preconditions**:
- `input` is a non-null object

**Postconditions**:
- Returns `false` for Skill tool calls where action verb is in EXEMPT_ACTIONS (`analyze`, `add`)
- Returns `false` for setup commands (SETUP_COMMAND_KEYWORDS matches)
- Returns `false` for Task tool calls that are phase delegations (detectPhaseDelegation)
- Returns `true` for Skill tool calls with `skill: 'isdlc'` and args containing `advance` or `gate` (when action verb is NOT exempt)
- Returns `true` for Task tool calls to orchestrator with gate keywords
- Returns `false` for all other tool calls

### Examples

**Exempt analyze verb (NEW)**:
```javascript
// Input
{ tool_name: 'Skill', tool_input: { skill: 'isdlc', args: 'analyze "gate-blocker blocks..."' } }
// Returns: false (action 'analyze' is exempt)
```

**Exempt add verb (NEW)**:
```javascript
// Input
{ tool_name: 'Skill', tool_input: { skill: 'isdlc', args: 'add "fix gate issue"' } }
// Returns: false (action 'add' is exempt)
```

**Exempt analyze with flags (NEW)**:
```javascript
// Input
{ tool_name: 'Skill', tool_input: { skill: 'isdlc', args: '--verbose analyze "#64 gate issue"' } }
// Returns: false (action 'analyze' extracted after flags, exempt)
```

**Non-exempt advance verb (UNCHANGED)**:
```javascript
// Input
{ tool_name: 'Skill', tool_input: { skill: 'isdlc', args: 'advance to next phase' } }
// Returns: true (action 'advance' is not exempt, args.includes('advance') matches)
```

**Non-exempt build verb (UNCHANGED)**:
```javascript
// Input
{ tool_name: 'Skill', tool_input: { skill: 'isdlc', args: 'build "something"' } }
// Returns: false (action 'build' is not exempt, args does not include 'advance' or 'gate')
```

**Non-exempt build with gate description**:
```javascript
// Input
{ tool_name: 'Skill', tool_input: { skill: 'isdlc', args: 'build "fix gate-blocker"' } }
// Returns: true (action 'build' is not exempt, args.includes('gate') matches)
// NOTE: This is existing behavior. build verb is intentionally NOT exempt.
```

---

## Interface 2: skillIsAdvanceAttempt(toolInput) -- Updated

### Signature

```javascript
/**
 * Check if a Skill tool call is an advance attempt.
 * @param {Object} toolInput - The tool_input from parsed stdin
 * @param {string} [toolInput.skill] - Skill name
 * @param {string} [toolInput.args] - Skill args
 * @returns {boolean} true if this is an advance attempt, false otherwise
 */
function skillIsAdvanceAttempt(toolInput)
```

### Behavior Contract

Same as `isGateAdvancementAttempt` for the Skill tool branch. Returns `false` for exempt actions (`analyze`, `add`), `false` for setup commands, `true` for advance/gate keywords when action is not exempt, `false` for all other cases.

---

## Data Structure: EXEMPT_ACTIONS

### Definition

```javascript
const EXEMPT_ACTIONS = new Set(['analyze', 'add']);
```

### Constraints

| Field | Type | Required | Default | Validation |
|-------|------|----------|---------|------------|
| (set elements) | `string` | Yes | N/A | Lowercase action verbs. Must match values used in isdlc.md command routing. |

### Invariants

- `EXEMPT_ACTIONS` is immutable (const Set, never modified at runtime)
- Elements match the `EXEMPT_ACTIONS` set in `skill-delegation-enforcer.cjs` line 37
- The `build` verb is explicitly NOT included

---

## Validation Rules

### Action Verb Extraction

```javascript
const action = (args.match(/^(?:--?\w+\s+)*(\w+)/) || [])[1] || '';
```

| Input | Extracted Action | Notes |
|-------|-----------------|-------|
| `'analyze "desc"'` | `'analyze'` | Standard case |
| `'add "item"'` | `'add'` | Standard case |
| `'advance'` | `'advance'` | Not exempt |
| `'build "desc"'` | `'build'` | Not exempt |
| `'--verbose analyze "desc"'` | `'analyze'` | Flags skipped |
| `'-v analyze "desc"'` | `'analyze'` | Short flags skipped |
| `''` | `''` | Empty args, not exempt |
| `'gate-check'` | `'gate'` | Not exempt (hyphenated, regex captures first word) |
| `'status'` | `'status'` | Not exempt via EXEMPT_ACTIONS, but caught by SETUP_COMMAND_KEYWORDS earlier |

---

## Error Communication

No new error paths. The change only adds early-return `false` paths (allow) to existing detection functions. No error messages, no state modifications, no escalations.
