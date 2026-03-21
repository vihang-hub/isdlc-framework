# Design Specification: Vertical Spike — Implementation Loop

**Item**: REQ-0076 | **GitHub**: #140

---

## 1. Module: src/core/teams/implementation-loop.js (ESM)

### Public Interface

```javascript
export class ImplementationLoop {
  constructor(teamSpec, loopState = null)

  // Initialize loop from task plan
  initFromPlan(files, options = {}) → LoopState

  // Get next action
  computeNextFile(loopState) → { file_path, file_number, total, is_test } | null

  // Build provider-neutral contracts
  buildWriterContext(loopState, fileInfo) → WriterContext
  buildReviewContext(loopState, fileInfo, cycle) → ReviewContext
  buildUpdateContext(loopState, findings) → UpdateContext

  // Process verdict and advance state
  processVerdict(loopState, verdict) → { action, loopState }
  // action: "next_file" | "update" | "fail" | "complete"

  // Query state
  isComplete(loopState) → boolean
  getSummary(loopState) → LoopSummary
}
```

### LoopState Schema

```javascript
{
  files: [{ path, type, order }],       // ordered file list
  current_file_index: 0,                // which file we're on
  cycle_per_file: { "path": 1 },        // cycle count per file
  max_cycles: 3,                        // max review cycles per file
  verdicts: [{ file, cycle, verdict }], // verdict history
  completed_files: [],                  // files that passed
  tdd_ordering: true                    // test-first ordering
}
```

### Team Spec

```json
{
  "team_type": "implementation_review_loop",
  "members": ["writer", "reviewer", "updater"],
  "parallelism": "sequential-loop",
  "max_iterations_per_file": 3,
  "state_owner": "core",
  "input_contract": "WriterContext",
  "output_schema": "ReviewContext | UpdateContext",
  "merge_policy": "verdict-based-routing"
}
```

## 2. Module: src/core/state/index.js (ESM)

### Public Interface

```javascript
export async function readState(projectRoot) → object
export async function writeState(projectRoot, state) → void
export function getProjectRoot(startDir = process.cwd()) → string
```

### Implementation Notes

- `readState`: reads `.isdlc/state.json`, parses JSON, returns object. Throws on missing file.
- `writeState`: atomic write — serialize full JSON, write to temp file, rename. No partial updates.
- `getProjectRoot`: walks up directories looking for `.isdlc/state.json` or `.isdlc/monorepo.json`.

This is the minimal StateStore for the spike. Full StateStore (schema validation, corruption recovery, receipts) comes in REQ-0080.

## 3. Module: src/core/teams/contracts/ (JSON Schemas)

### writer-context.json
```json
{
  "type": "object",
  "required": ["mode", "per_file_loop", "file_number", "total_files"],
  "properties": {
    "mode": { "const": "writer" },
    "per_file_loop": { "type": "boolean" },
    "tdd_ordering": { "type": "boolean" },
    "file_number": { "type": "integer", "minimum": 1 },
    "total_files": { "type": "integer", "minimum": 1 },
    "file_path": { "type": "string" },
    "completed_files": { "type": "array", "items": { "type": "string" } }
  }
}
```

### review-context.json
```json
{
  "type": "object",
  "required": ["file_path", "file_number", "cycle"],
  "properties": {
    "file_path": { "type": "string" },
    "file_number": { "type": "integer" },
    "cycle": { "type": "integer", "minimum": 1, "maximum": 3 },
    "tech_stack": { "type": "string" },
    "constitution_path": { "type": "string" }
  }
}
```

### update-context.json
```json
{
  "type": "object",
  "required": ["file_path", "cycle", "reviewer_verdict", "findings"],
  "properties": {
    "file_path": { "type": "string" },
    "cycle": { "type": "integer" },
    "reviewer_verdict": { "const": "REVISE" },
    "findings": {
      "type": "object",
      "properties": {
        "blocking": { "type": "array" },
        "warning": { "type": "array" }
      }
    }
  }
}
```

## 4. CJS Bridge: src/core/bridge/

### teams.cjs
```javascript
let _module;
async function load() {
  if (!_module) _module = await import('../teams/implementation-loop.js');
  return _module;
}
module.exports = {
  async createImplementationLoop(teamSpec, loopState) {
    const m = await load();
    return new m.ImplementationLoop(teamSpec, loopState);
  }
};
```

### state.cjs
```javascript
let _module;
async function load() {
  if (!_module) _module = await import('../state/index.js');
  return _module;
}
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

## 5. Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/core/state/index.js` | **Create** | Minimal StateStore (read/write/getProjectRoot) |
| `src/core/teams/implementation-loop.js` | **Create** | Loop orchestration (file ordering, cycles, verdicts) |
| `src/core/teams/contracts/writer-context.json` | **Create** | WRITER_CONTEXT schema |
| `src/core/teams/contracts/review-context.json` | **Create** | REVIEW_CONTEXT schema |
| `src/core/teams/contracts/update-context.json` | **Create** | UPDATE_CONTEXT schema |
| `src/core/bridge/state.cjs` | **Create** | CJS bridge for state |
| `src/core/bridge/teams.cjs` | **Create** | CJS bridge for teams |
| `package.json` | **Modify** | Add exports for core modules |
