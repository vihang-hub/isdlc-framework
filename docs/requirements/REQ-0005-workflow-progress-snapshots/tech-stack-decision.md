# Tech Stack Decision: REQ-0005 — Workflow Progress Snapshots

**Version**: 1.0.0
**Date**: 2026-02-09
**Architect**: Solution Architect (Agent 02)

---

## 1. Decision Summary

**No new technology required.** This feature uses only existing project infrastructure:

| Dimension | Choice | Rationale |
|-----------|--------|-----------|
| Language | JavaScript (CommonJS) | `common.cjs` is a CJS module — Article XIII compliance |
| Module system | CommonJS (`require`/`module.exports`) | Hook files MUST use CJS (Article XIII) |
| Dependencies | None added | NFR-2 requires zero new packages |
| Test framework | `node:test` + `node:assert/strict` | Existing test infrastructure, no third-party test deps |
| Date handling | Built-in `Date.parse()` | No moment/luxon/dayjs needed — only ISO-8601 diff calculation |
| JSON manipulation | Native JS objects | No lodash/ramda — only simple property access and array iteration |

---

## 2. Technology Non-Decisions

### 2.1 No Schema Validation Library

The `phase_snapshots` and `metrics` objects are produced by a single function and consumed by a single consumer (the orchestrator). A formal JSON Schema validator (e.g., ajv) is not warranted. The existing inline `validateSchema()` in `common.cjs` could be used if needed in the future.

### 2.2 No Compression

The snapshot data is compact by design (~1.3-2.2KB). Compression (gzip, zlib) would add complexity for negligible savings. State.json is not transmitted over a network — it is a local file.

### 2.3 No Migration Script

Existing `workflow_history` entries are not retroactively updated (Constraint #3 from requirements). No migration logic needed. Consumers must handle entries with and without `phase_snapshots` (NFR-4).

---

## 3. Compatibility Matrix

| Component | Version | Compatible? | Notes |
|-----------|---------|-------------|-------|
| Node.js | 18+ | Yes | Uses only standard APIs (Date.parse, Object.entries, Array methods) |
| Node.js | 20, 22, 24 | Yes | No version-specific APIs used |
| macOS | Any | Yes | No platform-specific code |
| Linux | Any | Yes | No platform-specific code |
| Windows | Any | Yes | No path operations in this function (operates on in-memory objects) |
| `common.cjs` | v3.0.0 | Yes | New export added, no existing exports modified |
| `pruneCompletedPhases()` | Current | Yes | Runs AFTER snapshot collection — no interaction |
| `pruneWorkflowHistory()` | Current | Yes | Prunes descriptions/git_branch, does not touch phase_snapshots or metrics |

---

## 4. Risk Assessment

| Risk | Mitigation |
|------|------------|
| `Date.parse()` returns NaN for malformed timestamps | Function checks for NaN and returns `null` for duration |
| Future Node.js versions deprecate Date.parse | Date.parse is part of ECMAScript spec, not Node-specific — zero risk |
| CJS/ESM boundary issues | Function lives in `.cjs` file, same as all other hook utilities — no boundary crossing |
