# Architecture Overview: Roundtable Confirmation State Machine

**Item**: REQ-0109 | **GitHub**: #173 | **CODEX**: CODEX-040

---

## 1. Architecture Options

| Option | Summary | Pros | Cons | Verdict |
|--------|---------|------|------|---------|
| A: Frozen lookup table | Transition table as a frozen Map keyed by "state:event" | O(1) lookup, simple, testable | No graph traversal | **Selected** |
| B: Graph library | Use a state machine library (xstate, machina) | Visual tooling, formal verification | Overkill for 7 states, adds dependency | Eliminated |

## 2. Selected Architecture

### ADR-CODEX-015: Roundtable State Machine as Frozen Lookup Table

- **Status**: Accepted
- **Context**: The roundtable confirmation flow has 7 states and a small number of transitions. A formal FSM library adds unnecessary complexity.
- **Decision**: Create `src/core/analyze/state-machine.js` (~60 lines) with frozen enums for states and events, a frozen transition table, and tier path definitions.
- **Rationale**: The state space is small and well-defined. A lookup table is the simplest correct implementation. Frozen objects prevent accidental mutation.
- **Consequences**: Adding new states requires updating the frozen config. This is intentional — state changes should be deliberate.

## 3. Technology Decisions

| Technology | Rationale |
|-----------|----------|
| ES modules (`.js`) | Consistent with `src/core/` convention |
| `Object.freeze()` | Immutable state definitions |
| No external dependencies | Pure data module |

## 4. Integration Architecture

### File Location

```
src/core/analyze/
  state-machine.js   (NEW — this item)
```

### Integration Points

| Source | Target | Interface | Data Format |
|--------|--------|-----------|-------------|
| state-machine.js | roundtable-analyst.md | Import via bridge | Frozen enums + lookup |
| state-machine.js | test suite | Direct import | Frozen enums + lookup |
| state-machine.js | index.js barrel | Re-export | Named exports |

## 5. Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Module location | `src/core/analyze/state-machine.js` | Co-located with analyze modules |
| FSM style | Frozen lookup table | Simple, correct, no dependencies |
| Size estimate | ~60 lines | 7 states, 3 events, 3 tier paths |
