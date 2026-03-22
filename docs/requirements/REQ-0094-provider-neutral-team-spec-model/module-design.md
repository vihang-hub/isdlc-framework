# Module Design: REQ-0094 — Provider-Neutral Team Spec Model

## 1. Module: specs/implementation-review-loop.js

**Responsibility**: Define the implementation review loop team spec.
**Public interface**:

```javascript
export const implementationReviewLoopSpec = Object.freeze({
  team_type: 'implementation_review_loop',
  members: ['writer', 'reviewer', 'updater'],
  parallelism: 'sequential',
  merge_policy: 'last_wins',
  retry_policy: 'per_member',
  max_iterations: 3,
  state_owner: 'orchestrator'
});
```

**Dependencies**: None.
**Estimated size**: ~15 lines.

## 2. Module: specs/fan-out.js

**Responsibility**: Define the parallel fan-out team spec (used by Impact Analysis M1/M2/M3 and Tracing T1/T2/T3).
**Public interface**:

```javascript
export const fanOutSpec = Object.freeze({
  team_type: 'fan_out',
  members: ['orchestrator', 'sub_agent'],
  parallelism: 'full',
  merge_policy: 'consolidate',
  retry_policy: 'fail_open',
  max_iterations: 1,
  state_owner: 'orchestrator'
});
```

**Dependencies**: None.
**Estimated size**: ~15 lines.

## 3. Module: specs/dual-track.js

**Responsibility**: Define the dual-track team spec (used by Quality Loop Track A/Track B).
**Public interface**:

```javascript
export const dualTrackSpec = Object.freeze({
  team_type: 'dual_track',
  members: ['track_a', 'track_b'],
  parallelism: 'full',
  merge_policy: 'consolidate',
  retry_policy: 'per_track',
  max_iterations: 10,
  state_owner: 'orchestrator'
});
```

**Dependencies**: None.
**Estimated size**: ~15 lines.

## 4. Module: specs/debate.js

**Responsibility**: Define the debate team spec (used by requirements/architecture/design/test-strategy debate rounds).
**Public interface**:

```javascript
export const debateSpec = Object.freeze({
  team_type: 'debate',
  members: ['creator', 'critic', 'refiner'],
  parallelism: 'sequential',
  merge_policy: 'last_wins',
  retry_policy: 'per_round',
  max_iterations: 3,
  state_owner: 'orchestrator'
});
```

**Dependencies**: None.
**Estimated size**: ~15 lines.

## 5. Module: registry.js

**Responsibility**: Load all specs and provide lookup by team_type string.
**Public interface**:

```javascript
/**
 * Get the team spec for a given team type.
 * @param {string} teamType - One of the registered team types
 * @returns {Object} Frozen team spec object
 * @throws {Error} If teamType is not registered (ERR-TEAM-001)
 */
export function getTeamSpec(teamType) { ... }

/**
 * List all registered team type strings.
 * @returns {string[]} Array of team type identifiers
 */
export function listTeamTypes() { ... }
```

**Internal implementation**:
- Import all 4 spec objects at module load
- Build a `Map<string, TeamSpec>` from the imports
- `getTeamSpec` does a Map lookup, throws if not found
- `listTeamTypes` returns `[...map.keys()]`

**Dependencies**: specs/*.js
**Estimated size**: ~40 lines.

## 6. Module: bridge/team-specs.cjs

**Responsibility**: CJS bridge for hook/CommonJS consumers.
**Public interface**:

```javascript
function getTeamSpec(teamType) { ... }
function listTeamTypes() { ... }
module.exports = { getTeamSpec, listTeamTypes };
```

**Internal implementation**: Bridge-first-with-fallback pattern:
1. Lazy-load the ESM bridge at `src/core/bridge/team-specs-esm-loader.cjs` (or inline dynamic import)
2. If bridge loads: delegate to ESM registry
3. If bridge fails: return null / empty array (fail-open per Article X)

**Dependencies**: registry.js (via bridge)
**Estimated size**: ~30 lines.

## 7. Error Taxonomy

| Code | Description | Trigger | Severity | Recovery |
|------|-------------|---------|----------|----------|
| ERR-TEAM-001 | Unknown team type | `getTeamSpec('nonexistent')` | Error | Caller catches, logs available types |

## 8. Data Flow

```
Consumer calls getTeamSpec('fan_out')
  → registry.js: Map.get('fan_out')
    → specs/fan-out.js: return frozen object
  ← { team_type: 'fan_out', members: [...], ... }

Consumer calls listTeamTypes()
  → registry.js: [...map.keys()]
  ← ['implementation_review_loop', 'fan_out', 'dual_track', 'debate']
```

## 9. Design Summary

- 4 spec files (pure data, ~15 lines each)
- 1 registry (lookup + list, ~40 lines)
- 1 CJS bridge (~30 lines)
- Total new code: ~130 lines
- Modified existing code: 0 lines
- All specs frozen, no classes, no inheritance
- Ready for implementation
