# Architecture Overview: REQ-0094 — Provider-Neutral Team Spec Model

## 1. Architecture Options

### Option A: Flat Spec Catalog + Simple Registry (Selected)
- **Summary**: Each team type is a frozen JS object in `src/core/teams/specs/`. A registry module loads them at import time and provides lookup.
- **Pros**: Minimal code, no abstraction overhead, follows existing patterns, zero risk to ImplementationLoop
- **Cons**: No runtime type validation (relies on Object.freeze + tests)
- **Pattern alignment**: Matches `src/core/config/` pattern (static config objects loaded at startup)
- **Verdict**: Selected

### Option B: Class Hierarchy with Base TeamSpec
- **Summary**: Abstract `TeamSpec` base class with `FanOutSpec extends TeamSpec`, etc.
- **Pros**: Runtime type checking via instanceof, extensible
- **Cons**: Over-engineered for 4 static objects, adds inheritance complexity, user explicitly rejected
- **Pattern alignment**: Breaks project convention (core uses plain objects, not class hierarchies)
- **Verdict**: Eliminated — user directive "keep as-is", Article V (Simplicity First)

## 2. Selected Architecture

### ADR-CODEX-008: Team Spec Model

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Context** | Codex needs to know team shapes without reading Claude agent markdown. 4 team types exist: implementation_review_loop, fan_out, dual_track, debate. |
| **Decision** | Pure-data spec catalog with lookup registry. No runtime engines for fan-out/dual-track/debate. |
| **Rationale** | User directive: keep what works for Claude, make it readable for Codex. Minimal new code, zero regression risk. Article V (Simplicity First). |
| **Consequences** | REQ-0095/0096/0097 consume specs as documentation. Codex adapter reads specs to know roles. No behavioral change to Claude workflows. |

## 3. Technology Decisions

| Technology | Version | Rationale | Alternatives Considered |
|------------|---------|-----------|------------------------|
| ESM exports | ES2022 | Core module convention (Article XIII) | CJS — rejected, core is ESM |
| Object.freeze | Native | Immutability without dependencies | deep-freeze package — rejected, YAGNI |
| Map | Native | Registry lookup, O(1) by type | Plain object — viable but Map is conventional for registries in this codebase |

**New dependencies**: None.

## 4. Integration Architecture

### Integration Points

| ID | Source | Target | Interface | Data Format | Error Handling |
|----|--------|--------|-----------|-------------|----------------|
| INT-001 | Provider adapter | `registry.js` | `getTeamSpec(type)` | Frozen JS object | Throws on unknown type |
| INT-002 | Hook consumers | `team-specs.cjs` | `getTeamSpec(type)` | Same frozen object | Returns null on bridge failure |
| INT-003 | Future team ports | `specs/*.js` | Direct import | Frozen JS object | N/A (compile-time) |

### Data Flow

```
Provider adapter / Hook
  → getTeamSpec('fan_out')
    → registry.js Map lookup
      → specs/fan-out.js (frozen object)
    ← { team_type, members, parallelism, merge_policy, ... }
```

### File Layout

```
src/core/teams/
  implementation-loop.js    (UNCHANGED)
  registry.js               (NEW — getTeamSpec, listTeamTypes)
  specs/
    implementation-review-loop.js  (NEW)
    fan-out.js                     (NEW)
    dual-track.js                  (NEW)
    debate.js                      (NEW)
  contracts/                (UNCHANGED)
    writer-context.json
    review-context.json
    update-context.json

src/core/bridge/
  teams.cjs                 (UNCHANGED)
  team-specs.cjs            (NEW — CJS bridge)
```

## 5. Summary

| Metric | Value |
|--------|-------|
| New files | 6 (4 specs + registry + bridge) |
| Modified files | 0 |
| Deleted files | 0 |
| New dependencies | 0 |
| Risk level | Low |
