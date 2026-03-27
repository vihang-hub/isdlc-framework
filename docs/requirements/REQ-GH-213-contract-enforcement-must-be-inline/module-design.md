# Module Design: Inline Contract Enforcement

**REQ-GH-213** | Status: Proposed

---

## 1. Module Overview

| Module | Path | Responsibility | Dependencies |
|--------|------|---------------|-------------|
| **Contract Checks** | `src/core/validators/contract-checks.js` | Pure stateless check functions for each decision point (7 total) | `contract-schema.js` (validation only) |
| **Template Loader** | `src/core/validators/template-loader.js` | Load and resolve presentation templates with override precedence | `node:fs`, `node:path` |
| **ContractViolationError** | `src/core/validators/contract-checks.js` | Error class thrown on contract violations | None |

No circular dependencies. All modules are pure ESM.

## 2. Contract Checks Module

### `src/core/validators/contract-checks.js`

**Responsibility**: Pure check functions for each of the 7 decision points. Every function takes pre-loaded data as arguments (no file I/O, no side effects). Throws `ContractViolationError` on violation, returns void on pass.

### Error Class

```js
export class ContractViolationError extends Error {
  constructor({ decisionPoint, expected, actual, contractId }) {
    super(`CONTRACT VIOLATION [${decisionPoint}]: expected ${expected}, got ${actual}`);
    this.name = 'ContractViolationError';
    this.decisionPoint = decisionPoint;
    this.expected = expected;
    this.actual = actual;
    this.contractId = contractId || null;
  }
}
```

### Check Functions

#### `checkDomainTransition(contractData, domain, domainIndex)`

Validates that the roundtable is presenting confirmation domains in the expected order.

```js
/**
 * @param {Object} contractData - Parsed contract entry (from session cache or loadContractEntry)
 * @param {string} domain - Domain about to be presented ("requirements", "architecture", "design")
 * @param {number} domainIndex - Zero-based index in the confirmation sequence
 * @throws {ContractViolationError} if domain doesn't match expected sequence position
 */
export function checkDomainTransition(contractData, domain, domainIndex)
```

- Reads `contractData.expectations.presentation.confirmation_sequence[domainIndex]`
- If domain !== expected: throw
- If confirmation_sequence is missing/null: no-op (fail-open)

#### `checkBatchWrite(contractData, artifactPaths, artifactFolder)`

Validates that all expected artifacts are in the write set before batch write executes.

```js
/**
 * @param {Object} contractData - Parsed contract entry
 * @param {string[]} artifactPaths - Paths about to be written
 * @param {string} artifactFolder - Artifact folder name for path substitution
 * @throws {ContractViolationError} if expected artifacts are missing from write set
 */
export function checkBatchWrite(contractData, artifactPaths, artifactFolder)
```

- Reads `contractData.expectations.artifacts_produced` (may be `$ref` — caller must resolve refs before calling)
- Compares expected set against actual write set
- If any expected artifact not in write set: throw with list of missing artifacts

#### `checkPersonaFormat(templateData, output)`

Validates that persona output matches the active presentation template.

```js
/**
 * @param {Object} templateData - Parsed template for this confirmation domain
 * @param {string} output - The persona output text to validate
 * @throws {ContractViolationError} if format deviates from template
 */
export function checkPersonaFormat(templateData, output)
```

- Checks against template rules:
  - `format_type`: "bulleted" → output must use `- ` or `* ` prefixes, not numbered lists or tables
  - `section_order`: if specified, sections must appear in order
  - `assumptions_placement`: "inline" → assumptions must appear per-FR, "batched" → assumptions in separate section
- Template missing/null: no-op (fail-open)

#### `checkPersonaContribution(configuredPersonas, contributedPersonas)`

Validates that all configured personas have contributed before advancing.

```js
/**
 * @param {string[]} configuredPersonas - From roundtable.yaml default_personas
 * @param {string[]} contributedPersonas - Personas that have actually contributed output
 * @throws {ContractViolationError} if any configured persona is missing from contributions
 */
export function checkPersonaContribution(configuredPersonas, contributedPersonas)
```

- Computes set difference: `configuredPersonas - contributedPersonas`
- If any missing: throw with list of silent personas
- Empty configuredPersonas: no-op

#### `checkDelegation(contractData, phaseKey, agentName)`

Validates correct agent is being delegated to for a phase.

```js
/**
 * @param {Object} contractData - Parsed contract entry
 * @param {string} phaseKey - Phase key (e.g., "01-requirements")
 * @param {string} agentName - Agent about to be delegated to
 * @throws {ContractViolationError} if agent doesn't match expected agent for phase
 */
export function checkDelegation(contractData, phaseKey, agentName)
```

- Reads `contractData.expectations.agent`
- If agent !== expected: throw
- If agent expectation is null: no-op

#### `checkArtifacts(contractData, artifactFolder, projectRoot)`

Validates required artifacts exist on disk before phase completion.

```js
/**
 * @param {Object} contractData - Parsed contract entry
 * @param {string} artifactFolder - Artifact folder name
 * @param {string} projectRoot - Project root for path resolution
 * @throws {ContractViolationError} if required artifacts missing from disk
 */
export function checkArtifacts(contractData, artifactFolder, projectRoot)
```

- Reads `contractData.expectations.artifacts_produced` (resolved paths)
- Checks `existsSync()` for each path (substituting `{artifact_folder}`)
- If any missing: throw with list
- This is the only check function with I/O (disk existence check) — acceptable because it runs once at phase completion, not per-decision-point

#### `checkTaskList(templateData, taskPlan)`

Validates that the task list presented at the "tasks" confirmation domain includes all required task categories and per-task metadata.

```js
/**
 * @param {Object} templateData - Parsed tasks template
 * @param {Object} taskPlan - Parsed task plan structure
 * @throws {ContractViolationError} if required categories or metadata are missing
 */
export function checkTaskList(templateData, taskPlan)
```

- Checks against template rules:
  - `required_phases`: all listed phases must have a section in the task plan (e.g., "05", "06", "16", "08")
  - `required_task_categories`: each phase must contain the required task types (e.g., Phase 06 must have "setup", "core_implementation", "unit_tests", "wiring", "cleanup")
  - `required_task_metadata`: every task must have `traces` (FR/AC refs), `files` (with CREATE/MODIFY), and `blocked_by`/`blocks` annotations
  - `required_sections`: task plan must include progress summary, dependency graph, and traceability matrix
- Template missing/null: no-op (fail-open)

## 3. Template Loader Module

### `src/core/validators/template-loader.js`

**Responsibility**: Load presentation templates with override resolution. Used at build time (by `rebuild-cache.js` for SessionStart cache) and at runtime (by Codex `runtime.js`).

```js
/**
 * Load a presentation template with override resolution.
 * @param {string} domain - "requirements" | "architecture" | "design"
 * @param {Object} options
 * @param {string} options.shippedPath - Path to shipped templates dir
 * @param {string} options.overridePath - Path to user override templates dir
 * @returns {Object|null} Parsed template or null if not found
 */
export function loadTemplate(domain, options)
```

- Checks override dir first, shipped dir second (same as contract loader)
- Returns null if not found (fail-open)

```js
/**
 * Load all templates for all domains.
 * @param {Object} options - Same as loadTemplate
 * @returns {Object} Map of domain -> template
 */
export function loadAllTemplates(options)
```

### Template Schema

```json
{
  "domain": "requirements",
  "version": "1.0.0",
  "format": {
    "format_type": "bulleted",
    "section_order": [
      "functional_requirements",
      "assumptions",
      "non_functional_requirements",
      "out_of_scope",
      "prioritization"
    ],
    "assumptions_placement": "inline",
    "required_sections": [
      "functional_requirements",
      "assumptions",
      "prioritization"
    ]
  }
}
```

Fields:
- `domain`: which confirmation domain this template applies to
- `format_type`: "bulleted" | "numbered" | "table" — how items are formatted
- `section_order`: ordered list of section identifiers — output must follow this order
- `assumptions_placement`: "inline" (per-FR) | "batched" (separate section)
- `required_sections`: sections that must appear — missing sections cause violation

### Tasks Template Schema

```json
{
  "domain": "tasks",
  "version": "1.0.0",
  "format": {
    "format_type": "table",
    "required_phases": ["05", "06", "16", "08"],
    "required_task_categories": {
      "05": ["test_case_design"],
      "06": ["setup", "core_implementation", "unit_tests", "wiring_claude", "wiring_codex", "cleanup"],
      "16": ["test_execution", "parity_verification"],
      "08": ["constitutional_review", "dual_file_check"]
    },
    "required_task_metadata": [
      "traces",
      "files",
      "blocked_by",
      "blocks"
    ],
    "required_sections": [
      "progress_summary",
      "dependency_graph",
      "traceability_matrix"
    ]
  }
}
```

Fields:
- `required_phases`: phase numbers that must have sections in the task plan
- `required_task_categories`: per-phase, the task type groupings that must be present. Each category represents a distinct type of work (test design vs implementation vs wiring vs cleanup). Ensures no category is silently dropped between runs
- `required_task_metadata`: metadata fields every task entry must include
- `required_sections`: structural sections the task plan document must contain

## 4. Changes to Existing Modules

### `src/core/validators/contract-evaluator.js` — Refactored

- **Remove**: `evaluateContract()` batch function, `formatViolationBanner()`, `checkAgentEngagement()`, `checkSkillsUsed()`, `checkPresentation()`
- **Keep**: `getByPath()` helper (moved to contract-checks.js if needed), `createViolation()` (replaced by `ContractViolationError`)
- **Outcome**: File either becomes empty (delete) or retains only shared helpers

### `src/claude/commands/isdlc.md` — Analyze Handler

- Wire `checkDomainTransition()` before each confirmation state transition
- Wire `checkBatchWrite()` before artifact batch write
- Wire `checkPersonaFormat()` when composing persona output
- Wire `checkPersonaContribution()` before advancing past a topic
- Extract contract data and template data from session cache sections
- Wrap all checks in try/catch with self-correction logic

### `src/claude/commands/isdlc.md` — Phase-Loop Controller

- **Remove**: `STEP 3e-contract` (post-phase contract evaluation)
- Wire `checkDelegation()` in STEP 3d before agent delegation
- Wire `checkArtifacts()` in STEP 3e after phase agent returns
- Extract contract data from session cache

### `src/claude/agents/roundtable-analyst.md`

- Reference inline contract checks at each protocol transition point
- Document that persona contribution is checked against roundtable.yaml config

### `src/providers/codex/governance.js`

- Update `execution-contract` checkpoint to reference `contract-checks.js` functions instead of `evaluateContract()`

### `src/providers/codex/runtime.js`

- Replace `evaluateContract()` call in `validatePhaseGate()` with individual check function calls
- Add template loading alongside contract loading

### `bin/rebuild-cache.js`

- Add template files to SessionStart cache as a new `<!-- SECTION: PRESENTATION_TEMPLATES -->` block

### `bin/generate-contracts.js`

- Add template generation alongside contract generation

## 5. Wiring Summary

| Decision Point | Where | Check Function | Data Source (Claude) | Data Source (Codex) |
|---------------|-------|----------------|---------------------|---------------------|
| Domain transition | Analyze handler, before confirmation | `checkDomainTransition()` | Session cache contract section | `loadContractEntry()` |
| Batch write | Analyze handler, before write | `checkBatchWrite()` | Session cache contract section | `loadContractEntry()` |
| Persona format | Analyze handler, composing output | `checkPersonaFormat()` | Session cache template section | `loadTemplate()` |
| Persona contribution | Analyze handler, before advancing | `checkPersonaContribution()` | Session cache roundtable section | `readRoundtableConfig()` |
| Agent delegation | Phase-loop STEP 3d | `checkDelegation()` | Session cache contract section | `loadContractEntry()` |
| Artifact completion | Phase-loop STEP 3e | `checkArtifacts()` | Session cache contract section | `loadContractEntry()` |
| Task list confirmation | Analyze handler, before tasks confirmation | `checkTaskList()` | Session cache template section | `loadTemplate()` |

## 6. Error Flow

```
Check function throws ContractViolationError
  └→ Caller catches (analyze handler or phase-loop controller)
       └→ Logs: "CONTRACT VIOLATION [{decisionPoint}]: {message}"
       └→ Self-corrects based on decisionPoint type:
            - domain_transition: present the correct domain
            - batch_write: add missing artifacts to write set
            - persona_format: reformat output per template
            - persona_contribution: prompt silent personas
            - delegation: use correct agent
            - artifacts: produce missing artifacts
       └→ Retries the operation
  └→ If self-correction fails after 2 attempts:
       └→ Fail-open: log warning, proceed (Article X)
```

## 7. Open Questions

None — all design decisions resolved during roundtable.
