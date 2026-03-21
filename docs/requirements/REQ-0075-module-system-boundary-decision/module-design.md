# Design Specification: Module System Boundary Decision

**Item**: REQ-0075 | **GitHub**: #139

---

## 1. Directory Layout

```
src/core/
  state/
    index.js              ← ESM: StateStore, readState, writeState
    state-store.js        ← ESM: StateStore class
  validators/
    index.js              ← ESM: ValidatorEngine
    gate-validator.js     ← ESM: gate validation logic
    constitution.js       ← ESM: constitutional validation
  workflow/
    index.js              ← ESM: WorkflowEngine, WorkflowRegistry
    engine.js             ← ESM: WorkflowEngine class
    registry.js           ← ESM: workflow loading/lookup
  teams/
    index.js              ← ESM: team specs and orchestration
  skills/
    index.js              ← ESM: skill manifest, injection planner
  search/
    index.js              ← ESM: search setup, knowledge services
  memory/
    index.js              ← ESM: memory service
  providers/
    index.js              ← ESM: provider routing
  content/
    index.js              ← ESM: role specs, projection rules
  bridge/
    state-store.cjs       ← CJS: thin async wrapper
    validators.cjs        ← CJS: thin async wrapper
    workflow.cjs           ← CJS: thin async wrapper
    config.cjs            ← CJS: thin async wrapper
```

## 2. Import Patterns by Consumer

### In-Repo ESM (lib/*.js)
```javascript
import { StateStore } from '../src/core/state/index.js';
import { WorkflowEngine } from '../src/core/workflow/index.js';
```

### In-Repo CJS (src/claude/hooks/*.cjs)
```javascript
const { readState, writeState } = require('../core/bridge/state-store.cjs');
const { validateGate } = require('../core/bridge/validators.cjs');
```

### External ESM (Codex, Antigravity via npm)
```javascript
import { StateStore } from 'isdlc/core/state';
import { WorkflowEngine } from 'isdlc/core/workflow';
```

### External CJS (if needed via npm)
```javascript
const { StateStore } = require('isdlc/core/bridge/state-store');
```

## 3. Bridge Implementation Rules

1. **One bridge file per core module** — `bridge/state-store.cjs` wraps `state/index.js`
2. **No business logic in bridge** — bridge files only import and re-export
3. **Async is acceptable** — hooks already use `async function main()`, so `await import()` works
4. **Bridge tests** — each bridge file gets a simple test verifying it re-exports the same API as the ESM module

## 4. Package.json Changes (for REQ-0079)

```json
{
  "type": "module",
  "exports": {
    ".": "./lib/index.js",
    "./core/state": "./src/core/state/index.js",
    "./core/workflow": "./src/core/workflow/index.js",
    "./core/validators": "./src/core/validators/index.js",
    "./core/teams": "./src/core/teams/index.js",
    "./core/skills": "./src/core/skills/index.js",
    "./core/search": "./src/core/search/index.js",
    "./core/memory": "./src/core/memory/index.js",
    "./core/providers": "./src/core/providers/index.js",
    "./core/content": "./src/core/content/index.js",
    "./core/bridge/*": "./src/core/bridge/*.cjs"
  }
}
```

## 5. Impact on Backlog Items

| Item | Impact |
|------|--------|
| REQ-0079 (core scaffold) | Creates the directory structure above |
| REQ-0080-0086 (core services) | All implemented as ESM modules |
| REQ-0087 (Claude adapter) | Hooks consume core via bridge |
| REQ-0085 (common.cjs decomposition) | Decomposed services land in ESM core; hooks get bridge access |
| REQ-0090-0091 (hook conversion) | Converted hooks move from CJS to ESM core; bridge surface shrinks |
