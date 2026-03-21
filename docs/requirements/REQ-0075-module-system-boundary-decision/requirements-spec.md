# Requirements Specification: Module System Boundary Decision

**Item**: REQ-0075 | **GitHub**: #139
**Workstream**: A (Runtime & Governance) | **Phase**: 0
**Status**: Analyzed

---

## 1. Business Context

The shared core (`src/core/`) needs an explicit module format decision. This affects every Phase 2+ item — all core service imports depend on it. The decision must account for three consumer types: in-repo Claude hooks (CJS), in-repo lib code (ESM), and external framework consumers (Codex, Antigravity) via the npm package.

**Key correction**: Antigravity and Codex are separate framework projects that consume the iSDLC npm package externally. They are NOT in-repo consumers. The only in-repo CJS consumers are Claude hooks.

**Success metric**: ADR documented. Module format decided. CJS bridge pattern defined for Claude hooks.

## 2. Technical Context

### Current Module Split

| Location | Format | Reason |
|----------|--------|--------|
| `lib/*.js` | ESM | Modern Node.js library code |
| `bin/*.js` | ESM | CLI entry points |
| `src/claude/hooks/*.cjs` | CJS | Claude spawns hooks as standalone processes outside package scope |
| `src/antigravity/*.cjs` | CJS | Antigravity scripts (separate framework — will consume core as package) |
| `src/isdlc/*.cjs` | CJS | Config loaders |

### Consumer Types for src/core/

| Consumer | Format | Location | How They Access Core |
|----------|--------|----------|---------------------|
| Claude hooks | CJS | In-repo (`src/claude/hooks/`) | `require('../core/bridge/...')` |
| lib code | ESM | In-repo (`lib/`) | `import from '../core/...'` |
| Codex framework | ESM or CJS | External (`~/projects/isdlc-codex`) | `import/require` from npm package |
| Antigravity framework | ESM or CJS | External (separate project) | `import/require` from npm package |

## 3. Functional Requirements

### FR-001: Module Format Decision
**Confidence**: High
- **AC-001-01**: Given the decision, then an ADR documents ESM as the canonical format for `src/core/`.
- **AC-001-02**: Given CJS consumers exist in-repo, then a CJS bridge pattern is defined.

### FR-002: CJS Bridge Pattern
**Confidence**: High
- **AC-002-01**: Given Claude hooks need sync `require()`, then `src/core/bridge/*.cjs` wrappers are defined.
- **AC-002-02**: Given the bridge pattern, then an example wrapper is documented.

### FR-003: External Consumer Model
**Confidence**: High
- **AC-003-01**: Given Codex and Antigravity are external consumers, then the npm package export strategy is documented.

## 4. Out of Scope

| Item | Reason |
|------|--------|
| Creating src/core/ | That's REQ-0079 |
| Writing CJS bridges | Implementation, not decision |
| Modifying package.json exports | Implementation |

## 5. MoSCoW Prioritization

| FR | Title | Priority |
|----|-------|----------|
| FR-001 | Module format decision | Must Have |
| FR-002 | CJS bridge pattern | Must Have |
| FR-003 | External consumer model | Must Have |
