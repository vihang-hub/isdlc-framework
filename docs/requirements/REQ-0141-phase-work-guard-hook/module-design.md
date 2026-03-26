# Module Design: Execution Contract System

**Slug**: REQ-0141-phase-work-guard-hook
**Version**: 1.0.0

---

## 1. Module Overview

| Module | Location | Responsibility | Dependencies |
|---|---|---|---|
| **Contract Schema** | `src/core/validators/contract-schema.js` | JSON schema definition and validation for contract files | None |
| **Contract Loader** | `src/core/validators/contract-loader.js` | Load contracts from shipped + override paths, resolve precedence, detect staleness | Contract Schema |
| **Reference Resolver** | `src/core/validators/contract-ref-resolver.js` | Resolve `$ref` objects in contracts to concrete values | artifact-paths.json, skills-manifest.json |
| **Contract Evaluator** | `src/core/validators/contract-evaluator.js` | Evaluate actual execution against contract expectations, return violations | Contract Loader, Reference Resolver |
| **State Helpers** | `.claude/hooks/lib/common.cjs` (additions) | `writeContractViolation`, `readContractViolations`, `clearContractViolations` | None (pure in-memory) |
| **Contract Generator** | `bin/generate-contracts.js` | CLI tool to generate contracts from config surfaces | PHASE_AGENT_MAP, config files |
| **Claude Adapter** | `isdlc.md` STEP 3e addition | Call core evaluator after phase completion, dispatch remediation | Contract Evaluator, State Helpers |
| **Codex Adapter** | `src/providers/codex/runtime.js` addition | Call core evaluator from `validatePhaseGate()` | Contract Evaluator |
| **Codex Governance** | `src/providers/codex/governance.js` update | Register contract evaluator as enforceable checkpoint | None |
| **Installer** | `lib/installer.js` update | Add `contract_violations: []` to initial state schema | None |

---

## 2. Contract Schema (`src/core/validators/contract-schema.js`)

### Responsibility
Define and validate the JSON schema for contract files. Pure validation — no I/O.

### Public Interface

```js
/**
 * Validate a parsed contract object against the schema.
 * @param {Object} contract - Parsed JSON contract
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateContract(contract)

/**
 * Validate a single contract entry.
 * @param {Object} entry - Single execution_unit entry
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateContractEntry(entry)
```

### Contract Entry Schema

```json
{
  "execution_unit": "string (required) — phase key or context name",
  "context": "string (required) — workflow_type:intensity or context name",
  "expectations": {
    "agent": "string | null — expected agent name from PHASE_AGENT_MAP",
    "skills_required": "{ $ref, agent, filter } | null — resolved to skill ID array",
    "artifacts_produced": "{ $ref, phase } | null — resolved to file path array",
    "state_assertions": [
      { "path": "string — dot-notation JSON path", "equals": "any — expected value" }
    ],
    "cleanup": ["string — description of cleanup activity"],
    "presentation": {
      "confirmation_sequence": ["string[] | null — ordered domain confirmations"],
      "persona_format": "string | null — e.g. 'bulleted'",
      "progress_format": "string | null — e.g. 'task-list'",
      "completion_summary": "boolean | null — whether a structured summary is expected"
    }
  },
  "violation_response": {
    "agent_not_engaged": "block | warn | report",
    "skills_missing": "block | warn | report",
    "artifacts_missing": "block | warn | report",
    "state_incomplete": "block | warn | report",
    "cleanup_skipped": "block | warn | report",
    "presentation_violated": "block | warn | report"
  },
  "_generation_metadata": {
    "generated_at": "ISO-8601",
    "input_files": [{ "path": "string", "hash": "string (SHA-256)" }],
    "generator_version": "string"
  }
}
```

### Contract File Shape

A contract file is a JSON object with a top-level `entries` array:

```json
{
  "version": "1.0.0",
  "entries": [
    { "execution_unit": "...", "context": "...", ... },
    { "execution_unit": "...", "context": "...", ... }
  ],
  "_generation_metadata": { ... }
}
```

---

## 3. Contract Loader (`src/core/validators/contract-loader.js`)

### Responsibility
Load contract files from shipped and override paths. Apply override precedence (full replacement per ADR-007). Detect staleness via generation-time hashes.

### Public Interface

```js
/**
 * Load the contract entry for a given execution unit and context.
 * Override resolution: .isdlc/config/contracts/ wins over .claude/hooks/config/contracts/
 * for the same execution_unit + context key.
 *
 * @param {string} executionUnit - Phase key or context name
 * @param {string} context - Workflow type:intensity or context name
 * @param {Object} options
 * @param {string} options.projectRoot - Project root path
 * @param {string} [options.shippedPath] - Override shipped contracts path (testing)
 * @param {string} [options.overridePath] - Override user contracts path (testing)
 * @returns {{ entry: Object|null, stale: boolean, staleReason: string|null, source: 'shipped'|'override'|null }}
 */
export function loadContractEntry(executionUnit, context, options)

/**
 * Check if a contract file is stale by re-hashing its declared input files.
 * Only hashes files listed in _generation_metadata.input_files[].
 *
 * @param {Object} metadata - _generation_metadata from contract file
 * @param {string} projectRoot - Project root for resolving paths
 * @returns {{ stale: boolean, reason: string|null, changedFiles: string[] }}
 */
export function checkStaleness(metadata, projectRoot)
```

### Override Resolution
1. Scan `.isdlc/config/contracts/*.json` for entries matching `{executionUnit, context}`
2. Scan `.claude/hooks/config/contracts/*.json` for entries matching `{executionUnit, context}`
3. If override found: return override entry (full replacement, ADR-007)
4. If only shipped found: return shipped entry
5. If neither found: return `{ entry: null }` — caller handles gracefully

### File Organization
Contract files are organized by context type:
- `workflow-feature.contract.json` — all feature workflow phase entries
- `workflow-fix.contract.json` — all fix workflow phase entries
- `analyze.contract.json` — roundtable and analyze entries
- `discover.contract.json` — discover entries
- `add.contract.json` — add-item entries

---

## 4. Reference Resolver (`src/core/validators/contract-ref-resolver.js`)

### Responsibility
Resolve `$ref` objects in contract entries to concrete values. Extensible via registered resolvers.

### Public Interface

```js
/**
 * Resolve a $ref object to concrete values.
 * Caches config file reads per evaluation cycle.
 *
 * @param {Object} ref - Reference object: { "$ref": "source", ...params }
 * @param {Object} options
 * @param {string} options.projectRoot - Project root
 * @param {Map} [options.cache] - Shared cache for this evaluation cycle
 * @returns {any} Resolved value (array of paths, array of skill IDs, etc.)
 */
export function resolveRef(ref, options)

/**
 * Register a custom resolver for a new $ref source.
 * @param {string} source - Source name (e.g., "artifact-paths")
 * @param {Function} resolver - (ref, options) => resolvedValue
 */
export function registerResolver(source, resolver)
```

### Built-in Resolvers

| Source | Params | Resolves To | Config File |
|---|---|---|---|
| `artifact-paths` | `{ phase }` | Array of file paths (with `{artifact_folder}` substituted) | `.claude/hooks/config/artifact-paths.json` |
| `skills-manifest` | `{ agent, filter }` | Array of skill IDs owned by the agent | `.claude/hooks/config/skills-manifest.json` |

### Caching
Config files are read once per evaluation cycle and cached in a `Map` passed via `options.cache`. The caller creates the cache at the start of evaluation and discards it after.

---

## 5. Contract Evaluator (`src/core/validators/contract-evaluator.js`)

### Responsibility
Evaluate actual execution against a contract entry. Pure function — takes inputs, returns structured result. No state mutation, no I/O beyond reference resolution.

### Public Interface

```js
/**
 * Evaluate a completed execution unit against its contract.
 *
 * @param {Object} params
 * @param {Object} params.state - Current state.json content
 * @param {Object} params.contractEntry - Loaded contract entry
 * @param {string} params.projectRoot - Project root for artifact checks
 * @param {string} [params.artifactFolder] - Artifact folder name for path substitution
 * @returns {{ violations: Violation[], warnings: string[], stale_contract: boolean }}
 */
export function evaluateContract(params)
```

### Violation Shape

```js
{
  contract_id: "string — execution_unit:context",
  execution_unit: "string",
  expectation_type: "agent_not_engaged | skills_missing | artifacts_missing | state_incomplete | cleanup_skipped | presentation_violated",
  expected: "string — what was expected",
  actual: "string — what was found",
  severity: "block | warn | report — from violation_response",
  configured_response: "block | warn | report"
}
```

### Evaluation Checks (in order)

1. **Agent engagement**: Read `skill_usage_log` from state. Check for a delegation matching `expectations.agent` in the current execution unit's phase. If not found → `agent_not_engaged` violation.

2. **Skills required**: Resolve `expectations.skills_required` via `resolveRef()`. For each required skill ID, check `skill_usage_log` for a matching entry. Missing skills → `skills_missing` violation (one violation per missing skill).

3. **Artifacts produced**: Resolve `expectations.artifacts_produced` via `resolveRef()`. Substitute `{artifact_folder}` in paths. Check disk for file existence. Missing files → `artifacts_missing` violation.

4. **State assertions**: For each `{ path, equals }` in `expectations.state_assertions`, read the value at `path` from state using dot-notation traversal. If value !== `equals` → `state_incomplete` violation.

5. **Presentation** (when `expectations.presentation` is non-null): Check is context-dependent:
   - `confirmation_sequence`: Verify `state.phases[execution_unit].confirmation_domains` or equivalent tracking matches the declared sequence
   - `persona_format`: Verify against conversational-compliance records in state (if available)
   - `completion_summary`: Verify a summary was produced (presence check in artifacts or state)
   - Missing presentation data → `presentation_violated` violation

6. **Cleanup**: String-described for now. Evaluator checks what it can (e.g., "tasks.md phase section marked COMPLETE" → read tasks.md, check section). Uncheckable cleanup items → warning (not violation).

### Error Handling
- Malformed contract entry → return `{ violations: [], warnings: ["Contract entry malformed: ..."], stale_contract: false }`
- Missing config file during `$ref` resolution → skip that check, add warning
- State missing expected fields → skip that assertion, add warning
- Any thrown exception → catch, return empty violations with warning (fail-open, Article X)

---

## 6. State Helpers (`.claude/hooks/lib/common.cjs` additions)

### New Exports

```js
/**
 * Append a contract violation entry to state.contract_violations[].
 * Deduplicates by contract_id + expectation_type. FIFO cap: 20.
 * Pure in-memory mutator — caller persists.
 *
 * @param {Object} state - State object (mutated in place)
 * @param {Object} entry - Violation entry (shape from evaluator)
 */
function writeContractViolation(state, entry)

/**
 * Read contract_violations from state.
 * Returns empty array if missing or malformed.
 *
 * @param {Object} state - State object
 * @returns {Array} Contract violations array
 */
function readContractViolations(state)

/**
 * Clear all contract violations from state.
 * Pure in-memory mutator — caller persists.
 *
 * @param {Object} state - State object (mutated in place)
 */
function clearContractViolations(state)
```

### Dedup Key
`${entry.contract_id}:${entry.expectation_type}` — same execution_unit + expectation type won't duplicate.

### FIFO Cap
20 entries (matching `pending_escalations` cap at `common.cjs:2559`).

---

## 7. Contract Generator (`bin/generate-contracts.js`)

### Responsibility
CLI tool that reads all config surfaces and generates contract files. Deterministic: same inputs → same output.

### Usage
```
node bin/generate-contracts.js [--output <path>]
```
- Default output: `.claude/hooks/config/contracts/`
- `--output`: Override output directory (for user overrides or testing)

### Generation Algorithm

1. **Load config sources**:
   - `PHASE_AGENT_MAP` from `.claude/hooks/lib/common.cjs`
   - `workflows.json` from `.isdlc/config/` or `.claude/hooks/config/`
   - `artifact-paths.json` from `.claude/hooks/config/`
   - `skills-manifest.json` from `.claude/hooks/config/`
   - `external-skills-manifest.json` from `docs/isdlc/` or `.isdlc/`
   - `roundtable.yaml` from `.isdlc/` or `docs/isdlc/`
   - `iteration-requirements.json` from `.claude/hooks/config/` (for gate requirement references, NOT artifact data)

2. **For each workflow type** (feature, fix, upgrade, test-run, test-generate):
   - Read phase sequence from `workflows.json`
   - For each phase:
     - Look up agent from `PHASE_AGENT_MAP`
     - Look up artifacts from `artifact-paths.json`
     - Look up required skills from `skills-manifest.json` (agent's owned skills)
     - Look up gate requirements from `iteration-requirements.json`
     - Build `state_assertions` from gate requirements (constitutional, elicitation, test iteration)
     - Set default `violation_response` per expectation type
   - Write `workflow-{type}.contract.json`

3. **For analyze context**:
   - Read `roundtable.yaml` for configured personas, topics, depth, verbosity
   - Build `presentation` expectations from roundtable config
   - Build `expectations.agent` as null (no single agent — roundtable is inline)
   - Build persona participation expectations from configured persona list
   - Write `analyze.contract.json`

4. **For discover context**:
   - Read `external-skills-manifest.json` for user-added skills with bindings
   - Build expectations for skill injection verification
   - Write `discover.contract.json`

5. **For add context**:
   - Static contract: folder creation, draft.md, meta.json, BACKLOG.md update
   - Write `add.contract.json`

6. **Compute generation metadata**:
   - Hash each input file (SHA-256)
   - Record `generated_at`, `input_files`, `generator_version`
   - Embed in each contract file as `_generation_metadata`

### Determinism Guarantee
- Input files are read in a fixed order
- Entries are sorted by `execution_unit` + `context`
- JSON.stringify with sorted keys
- No timestamps in entry content (only in `_generation_metadata`)

---

## 8. Claude Adapter (isdlc.md STEP 3e addition)

### Location
Phase-loop controller in `src/claude/commands/isdlc.md`, after STEP 3e post-phase state update (after timing, before sizing/review).

### New Step: 3e-contract

```
After STEP 3e-timing completes:

1. Load contract entry:
   - Call loadContractEntry(phase_key, workflow_context, { projectRoot })
   - workflow_context = `${active_workflow.type}:${active_workflow.sizing?.effective_intensity || "standard"}`
   - If entry is null: skip contract evaluation (no contract for this phase)

2. Evaluate:
   - Call evaluateContract({ state, contractEntry: entry, projectRoot, artifactFolder })
   - Receive { violations, warnings, stale_contract }

3. Handle stale contract:
   - If stale_contract: emit stderr warning, continue (fail-open)

4. Handle warnings:
   - Log each warning to stderr (non-blocking)

5. Handle violations:
   - For each violation: call writeContractViolation(state, violation)
   - Persist state.json

6. Dispatch remediation (reads contract_violations in STEP 3f):
   - "block" violations: treated like gate-blocker — retry protocol (max 3)
   - "warn" violations: display banner, continue
   - "report" violations: logged, orchestrator may act or continue
```

### Non-workflow Adapter

For analyze, discover, add — inline evaluation at handler completion:
- Same `loadContractEntry` + `evaluateContract` pattern
- Violations logged but not blocking (these contexts have no retry loop)
- Warnings emitted to stderr

---

## 9. Codex Adapter

### runtime.js Update
Add contract evaluation call inside `validatePhaseGate()`:

```js
export async function validatePhaseGate(phaseKey, inputs, options = {}) {
  try {
    // Existing phase validation
    const phaseResult = await validatePhase(phaseKey, inputs, options);

    // Contract evaluation (additive)
    const contractResult = evaluateContractForPhase(phaseKey, inputs, options);

    // Merge results
    return {
      pass: phaseResult.pass && contractResult.violations.filter(v => v.severity === 'block').length === 0,
      failures: [...phaseResult.failures, ...contractResult.violations.filter(v => v.severity === 'block')],
      details: { ...phaseResult.details, contract: contractResult },
      warnings: [...(phaseResult.warnings || []), ...contractResult.warnings]
    };
  } catch (err) {
    // Fail-open (ADR-004 from Codex integration)
    return { pass: true, failures: [], details: {}, validator_errors: [...] };
  }
}
```

### governance.js Update
Add contract evaluator to `enforceable` array:

```js
{
  checkpoint: 'execution-contract',
  claude_hook: 'contract-evaluator (STEP 3e-contract)',
  codex_equivalent: 'core-contract-evaluator',
  status: 'enforceable',
  mitigation: 'Contract evaluated at phase gate via core evaluator'
}
```

### projection.js Update (Advisory-Only, ADR-008)
Inject contract summary into agent instructions as informational text:

```js
// In projectInstructions(), after skill injection:
const contractSummary = loadContractSummary(phase, workflow);
if (contractSummary) {
  content += `\n\n## Expected Outputs (Advisory)\n\n${contractSummary}`;
}
```

This is guidance only — runtime evaluation is the sole enforcement authority.

---

## 10. Dependency Diagram

```
bin/generate-contracts.js
  → reads: PHASE_AGENT_MAP (common.cjs)
  → reads: workflows.json, artifact-paths.json, skills-manifest.json,
           external-skills-manifest.json, roundtable.yaml, iteration-requirements.json
  → writes: .claude/hooks/config/contracts/*.json

src/core/validators/contract-evaluator.js
  ← called by: isdlc.md STEP 3e-contract (Claude)
  ← called by: runtime.js validatePhaseGate (Codex)
  → uses: contract-loader.js (load + staleness)
  → uses: contract-ref-resolver.js ($ref resolution)
  → reads: state.json (passed in), artifact files (disk check)

src/core/validators/contract-loader.js
  → reads: .isdlc/config/contracts/ (override)
  → reads: .claude/hooks/config/contracts/ (shipped)

.claude/hooks/lib/common.cjs
  + writeContractViolation(state, entry)
  + readContractViolations(state)
  + clearContractViolations(state)
  + PHASE_AGENT_MAP (exported as stable API with guarding test)
```

No circular dependencies. Core evaluator depends only on core modules and passed-in state. Provider adapters depend on core evaluator.

---

## 11. Estimated Size

| Module | Estimated LOC | Complexity |
|---|---|---|
| Contract Schema | ~80 | Low — JSON schema validation |
| Contract Loader | ~120 | Low — file reads, override resolution, hash comparison |
| Reference Resolver | ~100 | Low — config reads, caching, resolver registry |
| Contract Evaluator | ~200 | Medium — multi-check evaluation, error handling |
| State Helpers | ~60 | Low — append/read/clear with dedup/FIFO |
| Contract Generator | ~300 | Medium — multi-source reads, entry assembly, metadata |
| Claude Adapter (isdlc.md) | ~40 lines of spec | Low — call evaluator, dispatch violations |
| Codex Adapter (runtime.js) | ~30 | Low — call evaluator, merge results |
| **Total** | ~930 | Medium overall |
