# ADR-0020: Dispatcher Timing via performance.now() with Date.now() Fallback

## Status
Accepted

## Context
FR-008 requires hook dispatchers to measure and report their own execution time. Two timing APIs are available in Node.js:

| API | Resolution | Availability | Monotonic |
|-----|-----------|-------------|-----------|
| `performance.now()` | Microsecond | Node 16+ (global) | Yes |
| `Date.now()` | Millisecond | All Node versions | No (clock adjustments) |

The project requires Node 18+ (per package.json engines field and state.json runtime: "node-20+").

## Decision
Use `performance.now()` as primary with `Date.now()` as fallback:

```javascript
const _now = typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? () => performance.now()
    : () => Date.now();
```

## Rationale
- `performance.now()` is monotonic -- not affected by system clock changes during dispatcher execution
- Available as a global in Node 16+, well within our Node 18+ requirement
- The fallback ensures fail-open behavior if some edge environment lacks `performance`
- Dispatcher execution is typically 5-200ms; millisecond resolution from `Date.now()` is adequate as fallback
- `performance.now()` provides better precision for sub-10ms dispatchers

## Consequences
**Positive:**
- Best available precision for timing measurement
- Monotonic clock prevents negative duration artifacts
- Fail-open fallback (AC-008a)

**Negative:**
- Minor code complexity for the fallback (2 lines)
- Mitigation: the `_now` helper is defined once and tested once

## Traces
- FR-008, AC-008a through AC-008c
- NFR-002 (Timing Accuracy)
- Article X (Fail-Safe Defaults): Graceful fallback to Date.now()
