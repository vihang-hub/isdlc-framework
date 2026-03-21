# Architecture Overview: Module System Boundary Decision

**Item**: REQ-0075 | **GitHub**: #139

---

## 1. Architecture Options

| Option | Summary | Pros | Cons | Verdict |
|--------|---------|------|------|---------|
| A: Core in ESM only | No CJS support | Clean, modern, no dual maintenance | Claude hooks can't `require()` without async bridging | Eliminated |
| B: Core in CJS only | No ESM | All consumers work with `require()` | Against Node.js direction; ESM lib code becomes awkward | Eliminated |
| C: Dual-publish (ESM + CJS builds) | Build step generates both | Both formats natively | Build complexity, potential divergence, maintenance overhead | Eliminated |
| D: Core in ESM with thin CJS bridge | ESM canonical, CJS wrappers for hooks | Modern core, hooks still work, minimal bridge code | Small bridge maintenance | **Selected** |

## 2. Selected Architecture

### ADR-CODEX-006: Core in ESM with CJS Bridge for Claude Hooks

- **Status**: Accepted
- **Context**: `src/core/` needs a module format. In-repo consumers are split: `lib/` is ESM, Claude hooks are CJS. External consumers (Codex, Antigravity) access core via the npm package.
- **Decision**: `src/core/` is ESM (canonical). `src/core/bridge/` provides thin CJS wrappers for in-repo Claude hook consumers. The npm package exports ESM primary with CJS bridge entry points if needed.
- **Rationale**:
  1. ESM is the Node.js standard direction
  2. The project already uses this dual pattern (lib=ESM, hooks=CJS)
  3. CJS bridge is only needed for in-repo Claude hooks — a bounded, shrinking consumer set
  4. External consumers (Codex, Antigravity) use the npm package — format is controlled by package.json `exports`
  5. As Claude hooks are converted to core validators (REQ-0090-0091), the CJS bridge surface shrinks
- **Consequences**:
  - `src/core/` files use `import`/`export`
  - Claude hooks use `require('../core/bridge/...')`
  - Bridge files are thin — they import ESM and re-export for CJS
  - Package.json `exports` field defines external access

## 3. Module Architecture

```
src/core/
  state/
    index.js          ← ESM (canonical)
    state-store.js    ← ESM
  validators/
    index.js          ← ESM
  workflow/
    index.js          ← ESM
  bridge/
    state-store.cjs   ← CJS wrapper for hooks
    validators.cjs    ← CJS wrapper for hooks
    workflow.cjs       ← CJS wrapper for hooks
```

### CJS Bridge Pattern

```javascript
// src/core/bridge/state-store.cjs
// Thin CJS wrapper — delegates to ESM core
let _module;
async function load() {
  if (!_module) _module = await import('../state/index.js');
  return _module;
}
// Sync facade for hook consumers
module.exports = {
  async readState(projectRoot) {
    const m = await load();
    return m.readState(projectRoot);
  },
  async writeState(projectRoot, state) {
    const m = await load();
    return m.writeState(projectRoot, state);
  }
};
```

**Note**: Hooks already run as async processes (`async function main()`), so the async bridge is compatible. No sync bridging needed.

### ESM Consumer Pattern (lib, external)

```javascript
// lib/installer.js or external Codex/Antigravity code
import { StateStore } from 'isdlc/core/state';
import { WorkflowEngine } from 'isdlc/core/workflow';
```

### Package.json Exports

```json
{
  "exports": {
    "./core/state": "./src/core/state/index.js",
    "./core/workflow": "./src/core/workflow/index.js",
    "./core/validators": "./src/core/validators/index.js",
    "./core/bridge/*": "./src/core/bridge/*.cjs"
  }
}
```

## 4. CJS Bridge Lifecycle

The CJS bridge is a **transitional** layer:

1. **Phase 2-3**: Bridge created. Claude hooks consume core via bridge.
2. **Phase 3 (hook conversion)**: As hooks become core validators (REQ-0090-0091), they move from CJS hook files to ESM core modules. Bridge surface shrinks.
3. **Long-term**: Remaining Claude-only hooks (Tier 3 file-protection, Tier 5 context injection) are the only CJS bridge consumers. Small, stable surface.

## 5. Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Core format | ESM | Node.js standard, matches lib/ |
| CJS access | Thin bridge wrappers | Only for in-repo Claude hooks |
| External access | npm package exports | Codex and Antigravity consume as package |
| Bridge lifecycle | Transitional, shrinks over time | Hook conversion reduces CJS surface |
