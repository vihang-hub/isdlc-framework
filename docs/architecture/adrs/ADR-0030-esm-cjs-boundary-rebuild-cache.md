# ADR-0030: ESM-CJS Boundary Handling for bin/rebuild-cache.js

## Status

Accepted

## Context

`bin/rebuild-cache.js` is a CLI script in the `bin/` directory, which uses ESM (the project's `package.json` has `"type": "module"`). It needs to call `rebuildSessionCache()` from `common.cjs`, which is CommonJS.

Node.js does not allow `require()` in ESM modules. Conversely, `import()` can load CJS modules but returns a module namespace object, not the module.exports directly.

## Decision

Use `import { createRequire } from 'module'` to bridge the ESM-CJS gap:

```javascript
#!/usr/bin/env node
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const common = require(path.join(__dirname, '..', 'src', 'claude', 'hooks', 'lib', 'common.cjs'));
const { rebuildSessionCache } = common;
```

## Consequences

**Positive:**
- `createRequire()` is a stable Node.js API (available since Node 12)
- Returns the CJS module.exports directly -- no wrapper object
- Maintains consistency with how other bin/ scripts handle CJS imports in this project
- No need to change common.cjs to dual ESM/CJS

**Negative:**
- Slightly verbose boilerplate (3 import lines + 2 lines for require creation)
- Cannot use top-level `await` for loading (not needed since `require()` is synchronous)

## Alternatives Considered

- **Dynamic `import()` of common.cjs**: `const common = await import('../src/claude/hooks/lib/common.cjs')`. This works but returns `{ default: { ...exports } }` -- an extra `.default` layer that is error-prone.
- **Make rebuild-cache.cjs**: Use `.cjs` extension so `require()` works directly. Rejected because bin/ scripts are expected to be ESM (consistent convention) and `.cjs` scripts cannot use `import.meta.url` for `__dirname` resolution.
- **Wrapper module**: Create a thin ESM wrapper around common.cjs. Rejected as unnecessary indirection.

## Traces

- **Requirements**: FR-004 (AC-004-01)
- **Impact Analysis**: "CJS/ESM boundary for bin/rebuild-cache.js" risk item
