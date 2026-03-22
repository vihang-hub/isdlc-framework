# Design Specification: Roundtable Confirmation State Machine

**Item**: REQ-0109 | **GitHub**: #173 | **CODEX**: CODEX-040

---

## 1. Module: `src/core/analyze/state-machine.js` (~60 lines)

### Exports

#### `STATES` (frozen enum)
```js
Object.freeze({
  IDLE:                      'IDLE',
  PRESENTING_REQUIREMENTS:   'PRESENTING_REQUIREMENTS',
  PRESENTING_ARCHITECTURE:   'PRESENTING_ARCHITECTURE',
  PRESENTING_DESIGN:         'PRESENTING_DESIGN',
  AMENDING:                  'AMENDING',
  FINALIZING:                'FINALIZING',
  COMPLETE:                  'COMPLETE'
})
```

#### `EVENTS` (frozen enum)
```js
Object.freeze({
  ACCEPT:            'accept',
  AMEND:             'amend',
  FINALIZE_COMPLETE: 'finalize_complete'
})
```

#### `transitionTable` (frozen Map-like object)

Keyed by `"state:event"` → `next_state`.

```js
Object.freeze({
  'IDLE:accept':                          'PRESENTING_REQUIREMENTS',
  'PRESENTING_REQUIREMENTS:accept':       'PRESENTING_ARCHITECTURE',
  'PRESENTING_REQUIREMENTS:amend':        'AMENDING',
  'PRESENTING_ARCHITECTURE:accept':       'PRESENTING_DESIGN',
  'PRESENTING_ARCHITECTURE:amend':        'AMENDING',
  'PRESENTING_DESIGN:accept':             'FINALIZING',
  'PRESENTING_DESIGN:amend':              'AMENDING',
  'AMENDING:accept':                      null,  // returns to the domain that was being amended (resolved at runtime)
  'FINALIZING:finalize_complete':         'COMPLETE'
})
```

Note: `AMENDING:accept` maps to `null` because the return-to state depends on which domain triggered the amendment. The runtime agent resolves this contextually.

#### `tierPaths` (frozen object)
```js
Object.freeze({
  standard: Object.freeze(['PRESENTING_REQUIREMENTS', 'PRESENTING_ARCHITECTURE', 'PRESENTING_DESIGN']),
  light:    Object.freeze(['PRESENTING_REQUIREMENTS', 'PRESENTING_DESIGN']),
  trivial:  Object.freeze(['FINALIZING'])  // brief mention, no per-domain confirmation
})
```

### Registry Functions

- `getStateMachine()` — returns `{ STATES, EVENTS, transitionTable }`
- `getTransition(state, event)` — returns `transitionTable[state + ':' + event]` or `null`
- `getTierPath(tier)` — returns `tierPaths[tier]` or `null`

---

## 2. Open Questions

None — the FSM is a direct extraction of the existing implicit flow in `roundtable-analyst.md`.
