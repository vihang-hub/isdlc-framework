# Module Design: Gate Requirements Pre-Injection

**REQ ID:** REQ-0024
**Phase:** 04-design
**Created:** 2026-02-18
**Status:** Draft
**Architecture Reference:** `docs/requirements/REQ-0024-gate-requirements-pre-injection/architecture-overview.md`

---

## 1. Module Overview

**File:** `src/claude/hooks/lib/gate-requirements-injector.cjs`
**Pattern:** CommonJS utility module (matches `three-verb-utils.cjs`, `provider-utils.cjs`, `common.cjs`)
**Responsibility:** Read gate criteria configuration files, assemble them into a formatted text block, and return it for injection into phase agent delegation prompts.

### 1.1 Exports

```javascript
module.exports = { buildGateRequirementsBlock };
```

Single export. No class, no state, no side effects.

### 1.2 Dependencies

| Dependency | Type | Usage |
|-----------|------|-------|
| `fs` | Node.js built-in | `readFileSync` for config files |
| `path` | Node.js built-in | `path.join` for cross-platform path construction |

No dependency on `common.cjs`. The module resolves project root from its `projectRoot` parameter (with `process.cwd()` as default). This avoids coupling to the hooks runtime environment and keeps the module independently testable.

---

## 2. Function Specifications

### 2.1 `buildGateRequirementsBlock(phaseKey, artifactFolder, workflowType, projectRoot)` -- EXPORTED

**Purpose:** Top-level entry point. Orchestrates the data pipeline: load configs, resolve templates, parse constitution, merge overrides, format output.

**Signature:**

```javascript
/**
 * Build a formatted GATE REQUIREMENTS text block for a given phase.
 *
 * @param {string} phaseKey       - Phase identifier, e.g., "06-implementation"
 * @param {string} artifactFolder - Artifact folder name, e.g., "REQ-0024-gate-requirements-pre-injection"
 * @param {string} [workflowType] - Workflow type, e.g., "feature", "fix". Optional.
 * @param {string} [projectRoot]  - Absolute path to project root. Defaults to process.cwd().
 * @returns {string} Formatted text block, or "" on any error (fail-open).
 */
function buildGateRequirementsBlock(phaseKey, artifactFolder, workflowType, projectRoot)
```

**Pseudocode:**

```
function buildGateRequirementsBlock(phaseKey, artifactFolder, workflowType, projectRoot):
    TRY:
        // Input validation (fail-open)
        IF phaseKey is not a non-empty string: RETURN ""
        IF artifactFolder is not a non-empty string: RETURN ""

        root = projectRoot OR process.cwd()

        // Step 1: Load iteration requirements
        iterReq = loadIterationRequirements(root)
        IF iterReq is null: RETURN ""

        // Step 2: Get base phase requirements
        phaseReq = iterReq.phase_requirements[phaseKey]
        IF phaseReq is undefined/null: RETURN ""

        // Step 3: Merge workflow overrides (if workflowType provided)
        IF workflowType is a non-empty string:
            overrides = iterReq.workflow_overrides?.[workflowType]?.[phaseKey]
            IF overrides exists:
                phaseReq = deepMerge(phaseReq, overrides)

        // Step 4: Load artifact paths
        artifactPaths = loadArtifactPaths(root)
        resolvedPaths = []
        IF artifactPaths is not null:
            rawPaths = artifactPaths.phases?.[phaseKey]?.paths OR []
            FOR each pathStr in rawPaths:
                resolvedPaths.push(resolveTemplateVars(pathStr, { artifact_folder: artifactFolder }))

        // Step 5: Parse constitutional articles (only if constitutional_validation enabled)
        articleMap = {}
        IF phaseReq.constitutional_validation?.enabled AND phaseReq.constitutional_validation?.articles:
            articleMap = parseConstitutionArticles(root)

        // Step 6: Load workflow agent modifiers (only if workflowType provided)
        workflowModifiers = null
        IF workflowType is a non-empty string:
            workflowModifiers = loadWorkflowModifiers(root, workflowType, phaseKey)

        // Step 7: Format and return
        RETURN formatBlock(phaseKey, phaseReq, resolvedPaths, articleMap, workflowModifiers)

    CATCH (any error):
        RETURN ""  // fail-open: never throw
```

**Traceability:** FR-01, FR-02, FR-03, FR-04, FR-05, NFR-01

---

### 2.2 `loadIterationRequirements(projectRoot)` -- INTERNAL

**Purpose:** Read and parse `iteration-requirements.json` from the project.

**Signature:**

```javascript
/**
 * @param {string} projectRoot - Absolute path to project root
 * @returns {object|null} Parsed JSON, or null on any error
 */
function loadIterationRequirements(projectRoot)
```

**Pseudocode:**

```
function loadIterationRequirements(projectRoot):
    TRY:
        configPaths = [
            path.join(projectRoot, 'src', 'claude', 'hooks', 'config', 'iteration-requirements.json'),
            path.join(projectRoot, '.claude', 'hooks', 'config', 'iteration-requirements.json')
        ]
        FOR each configPath in configPaths:
            IF fs.existsSync(configPath):
                content = fs.readFileSync(configPath, 'utf8')
                RETURN JSON.parse(content)
        RETURN null
    CATCH (any error):
        RETURN null
```

**Design notes:**
- Dual-path lookup matches `gate-blocker.cjs` lines 35-53 (source-first, then runtime copy).
- Source path (`src/claude/hooks/config/`) is checked first per NFR-03 (single source of truth).
- Returns the full JSON object (including `phase_requirements` and `workflow_overrides`).

**Traceability:** FR-01 (AC-01-01, AC-01-05), NFR-03

---

### 2.3 `loadArtifactPaths(projectRoot)` -- INTERNAL

**Purpose:** Read and parse `artifact-paths.json` from the project.

**Signature:**

```javascript
/**
 * @param {string} projectRoot - Absolute path to project root
 * @returns {object|null} Parsed JSON, or null on any error
 */
function loadArtifactPaths(projectRoot)
```

**Pseudocode:**

```
function loadArtifactPaths(projectRoot):
    TRY:
        configPaths = [
            path.join(projectRoot, 'src', 'claude', 'hooks', 'config', 'artifact-paths.json'),
            path.join(projectRoot, '.claude', 'hooks', 'config', 'artifact-paths.json')
        ]
        FOR each configPath in configPaths:
            IF fs.existsSync(configPath):
                content = fs.readFileSync(configPath, 'utf8')
                RETURN JSON.parse(content)
        RETURN null
    CATCH (any error):
        RETURN null
```

**Design notes:**
- Same dual-path pattern as `loadIterationRequirements`.
- Matches `gate-blocker.cjs::loadArtifactPaths()` lines 444-462.

**Traceability:** FR-01 (AC-01-02, AC-01-06), NFR-03

---

### 2.4 `parseConstitutionArticles(projectRoot)` -- INTERNAL

**Purpose:** Read `constitution.md` and extract a map of article IDs to titles.

**Signature:**

```javascript
/**
 * @param {string} projectRoot - Absolute path to project root
 * @returns {Object<string, string>} Map of article ID to title, e.g., { "I": "Specification Primacy" }. Empty object on error.
 */
function parseConstitutionArticles(projectRoot)
```

**Pseudocode:**

```
function parseConstitutionArticles(projectRoot):
    TRY:
        constitutionPath = path.join(projectRoot, 'docs', 'isdlc', 'constitution.md')
        IF NOT fs.existsSync(constitutionPath):
            RETURN {}
        content = fs.readFileSync(constitutionPath, 'utf8')
        lines = content.split('\n')
        articleMap = {}
        regex = /^### Article ([IVXLC]+):\s*(.+)$/
        FOR each line in lines:
            match = regex.exec(line)
            IF match:
                articleId = match[1]       // e.g., "VII"
                articleTitle = match[2].trim()  // e.g., "Artifact Traceability"
                articleMap[articleId] = articleTitle
        RETURN articleMap
    CATCH (any error):
        RETURN {}
```

**Design notes:**
- Regex `/^### Article ([IVXLC]+):\s*(.+)$/` matches all 14 articles in the current constitution.
- The character class `[IVXLC]` covers Roman numerals up to hundreds (I=1, V=5, X=10, L=50, C=100), which is sufficient for any foreseeable article count.
- If constitution format changes, regex silently finds no matches, and the fallback (raw IDs) in `formatBlock` handles it.
- Single file path (no dual-path) because constitution.md has one canonical location.

**Traceability:** FR-03 (AC-03-01 through AC-03-04), ADR-0002

---

### 2.5 `loadWorkflowModifiers(projectRoot, workflowType, phaseKey)` -- INTERNAL

**Purpose:** Read `workflows.json` and extract agent_modifiers for the given workflow type and phase.

**Signature:**

```javascript
/**
 * @param {string} projectRoot  - Absolute path to project root
 * @param {string} workflowType - Workflow type, e.g., "feature"
 * @param {string} phaseKey     - Phase key, e.g., "06-implementation"
 * @returns {object|null} Agent modifiers object, or null if not found/error
 */
function loadWorkflowModifiers(projectRoot, workflowType, phaseKey)
```

**Pseudocode:**

```
function loadWorkflowModifiers(projectRoot, workflowType, phaseKey):
    TRY:
        workflowsPath = path.join(projectRoot, '.isdlc', 'config', 'workflows.json')
        IF NOT fs.existsSync(workflowsPath):
            RETURN null
        content = fs.readFileSync(workflowsPath, 'utf8')
        parsed = JSON.parse(content)
        modifiers = parsed?.workflows?.[workflowType]?.agent_modifiers?.[phaseKey]
        IF modifiers is an object (not null, not array):
            RETURN modifiers
        RETURN null
    CATCH (any error):
        RETURN null
```

**Design notes:**
- Reads from `.isdlc/config/workflows.json` (single location, per architecture).
- Returns `null` for any missing path in the object chain (workflow type not found, phase not found, no agent_modifiers).
- Validates that the result is a plain object (not null, not array) before returning.

**Traceability:** FR-04 (AC-04-01 through AC-04-05)

---

### 2.6 `resolveTemplateVars(pathStr, vars)` -- INTERNAL

**Purpose:** Replace template variables in a path string with concrete values.

**Signature:**

```javascript
/**
 * @param {string} pathStr - Path string potentially containing {variable_name} placeholders
 * @param {Object<string, string>} vars - Map of variable names to values, e.g., { artifact_folder: "REQ-0024-..." }
 * @returns {string} Resolved path string. Unrecognized variables are left as-is.
 */
function resolveTemplateVars(pathStr, vars)
```

**Pseudocode:**

```
function resolveTemplateVars(pathStr, vars):
    IF typeof pathStr !== 'string': RETURN pathStr
    result = pathStr
    FOR each [key, value] in Object.entries(vars):
        IF typeof value === 'string':
            regex = new RegExp('\\{' + key + '\\}', 'g')
            result = result.replace(regex, value)
    RETURN result
```

**Design notes:**
- Only replaces known variables from the `vars` map. Unknown placeholders (e.g., `{unknown}`) remain as-is per AC-02-03.
- Uses RegExp constructor to create pattern dynamically from the key name.
- No escaping of key names is needed because variable names are controlled strings (no regex special characters in "artifact_folder").
- The function is pure (no I/O, no side effects).

**Traceability:** FR-02 (AC-02-01 through AC-02-03)

---

### 2.7 `deepMerge(base, overrides)` -- INTERNAL

**Purpose:** Deep-merge two objects. Overrides replace base values for leaf properties. Object properties are recursively merged.

**Signature:**

```javascript
/**
 * @param {object} base      - Base object
 * @param {object} overrides - Override object (takes precedence)
 * @returns {object} New merged object (neither input is mutated)
 */
function deepMerge(base, overrides)
```

**Pseudocode:**

```
function deepMerge(base, overrides):
    IF base is null/undefined: RETURN overrides
    IF overrides is null/undefined: RETURN base
    merged = JSON.parse(JSON.stringify(base))  // deep clone
    FOR each [key, value] in Object.entries(overrides):
        IF value is a plain object (not null, not array):
            merged[key] = deepMerge(merged[key] OR {}, value)
        ELSE:
            merged[key] = value
    RETURN merged
```

**Design notes:**
- Same pattern as `gate-blocker.cjs::mergeRequirements()` lines 81-96.
- Deep clone via JSON round-trip is safe here because all config values are JSON-serializable.
- Arrays are replaced entirely (not merged), consistent with existing behavior.

**Traceability:** FR-04 (override merging for workflow-specific requirements)

---

### 2.8 `formatBlock(phaseKey, phaseReq, resolvedPaths, articleMap, workflowModifiers)` -- INTERNAL

**Purpose:** Assemble all data into the formatted GATE REQUIREMENTS text block.

**Signature:**

```javascript
/**
 * @param {string} phaseKey          - Phase identifier
 * @param {object} phaseReq          - Merged phase requirements from iteration-requirements.json
 * @param {string[]} resolvedPaths   - Resolved artifact paths (may be empty)
 * @param {Object<string, string>} articleMap - Article ID to title map (may be empty)
 * @param {object|null} workflowModifiers - Agent modifiers from workflows.json, or null
 * @returns {string} Formatted text block. Never returns null/undefined.
 */
function formatBlock(phaseKey, phaseReq, resolvedPaths, articleMap, workflowModifiers)
```

**Pseudocode:**

```
function formatBlock(phaseKey, phaseReq, resolvedPaths, articleMap, workflowModifiers):
    lines = []
    lines.push("GATE REQUIREMENTS (Phase: " + phaseKey + "):")

    // -- Section 1: Iteration Requirements --
    lines.push("  Iteration Requirements:")

    // test_iteration
    testReq = phaseReq.test_iteration
    IF testReq AND testReq.enabled:
        line = "    - test_iteration: enabled"
        lines.push(line)
        subParts = []
        IF testReq.max_iterations:
            subParts.push("max_iterations: " + testReq.max_iterations)
        IF testReq.circuit_breaker_threshold:
            subParts.push("circuit_breaker: " + testReq.circuit_breaker_threshold)
        IF testReq.success_criteria?.min_coverage_percent:
            subParts.push("min_coverage: " + testReq.success_criteria.min_coverage_percent + "%")
        IF subParts.length > 0:
            lines.push("      " + subParts.join(", "))
    ELSE:
        lines.push("    - test_iteration: disabled")

    // constitutional_validation
    constReq = phaseReq.constitutional_validation
    IF constReq AND constReq.enabled:
        lines.push("    - constitutional_validation: enabled")
        IF constReq.max_iterations:
            lines.push("      max_iterations: " + constReq.max_iterations)
    ELSE:
        lines.push("    - constitutional_validation: disabled")

    // artifact_validation
    artifactReq = phaseReq.artifact_validation
    IF artifactReq AND artifactReq.enabled:
        lines.push("    - artifact_validation: enabled")
    ELSE:
        lines.push("    - artifact_validation: disabled")

    // interactive_elicitation
    elicitReq = phaseReq.interactive_elicitation
    IF elicitReq AND elicitReq.enabled:
        lines.push("    - interactive_elicitation: enabled")
        IF elicitReq.min_menu_interactions:
            lines.push("      min_menu_interactions: " + elicitReq.min_menu_interactions)
    ELSE:
        lines.push("    - interactive_elicitation: disabled")

    // agent_delegation_validation
    delegationReq = phaseReq.agent_delegation_validation
    IF delegationReq AND delegationReq.enabled:
        lines.push("    - agent_delegation_validation: enabled")
    ELSE:
        lines.push("    - agent_delegation_validation: disabled")

    // atdd_validation
    atddReq = phaseReq.atdd_validation
    IF atddReq AND atddReq.enabled:
        condText = ""
        IF atddReq.when:
            condText = " (conditional: when " + atddReq.when + ")"
        lines.push("    - atdd_validation: enabled" + condText)
        IF atddReq.requires AND Array.isArray(atddReq.requires):
            lines.push("      requires: " + atddReq.requires.join(", "))
    ELSE:
        lines.push("    - atdd_validation: disabled")

    // -- Section 2: Required Artifacts --
    lines.push("  Required Artifacts:")
    IF resolvedPaths.length > 0:
        FOR each artifactPath in resolvedPaths:
            lines.push("    - " + artifactPath)
    ELSE:
        lines.push("    (none for this phase)")

    // -- Section 3: Constitutional Articles --
    constArticles = phaseReq.constitutional_validation?.articles
    IF constArticles AND Array.isArray(constArticles) AND constArticles.length > 0:
        lines.push("  Constitutional Articles:")
        FOR each articleId in constArticles:
            title = articleMap[articleId]
            IF title:
                lines.push("    - Article " + articleId + ": " + title)
            ELSE:
                lines.push("    - Article " + articleId + " (unknown)")
    // ELSE: omit section entirely (no constitutional validation)

    // -- Section 4: Workflow Overrides --
    IF workflowModifiers is not null:
        lines.push("  Workflow Overrides:")
        FOR each [key, value] in Object.entries(workflowModifiers):
            IF typeof value === 'object' AND value is not null:
                lines.push("    " + key + ": " + JSON.stringify(value))
            ELSE:
                lines.push("    " + key + ": " + String(value))
    // ELSE: omit section entirely (no overrides)

    RETURN lines.join("\n")
```

**Design notes:**
- Each section is always present (Iteration Requirements, Required Artifacts) or conditionally present (Constitutional Articles, Workflow Overrides). This keeps the block compact -- agents do not see empty headers for irrelevant sections.
- Indentation uses 2-space increments: header (0), section headers (2), items (4), sub-items (6). This matches the indentation style in the architecture examples.
- The order of iteration requirement items is fixed (not alphabetical) to match the checking order in `gate-blocker.cjs::check()`: test_iteration, constitutional_validation, artifact_validation (as artifact_presence), interactive_elicitation, agent_delegation_validation. The `atdd_validation` is appended last.
- Workflow overrides with nested objects (like `_when_atdd_mode`) are serialized as compact JSON to preserve structure.

**Traceability:** FR-05 (AC-05-01 through AC-05-06)

---

## 3. Output Format Specification

### 3.1 Block Structure

The GATE REQUIREMENTS block has four sections. Sections 1 and 2 are always present. Sections 3 and 4 are conditional.

```
GATE REQUIREMENTS (Phase: {phase_key}):
  Iteration Requirements:
    - test_iteration: {enabled|disabled}
      {sub-parameters if enabled}
    - constitutional_validation: {enabled|disabled}
      {sub-parameters if enabled}
    - artifact_validation: {enabled|disabled}
    - interactive_elicitation: {enabled|disabled}
      {sub-parameters if enabled}
    - agent_delegation_validation: {enabled|disabled}
    - atdd_validation: {enabled|disabled}
      {sub-parameters if enabled}
  Required Artifacts:
    - {resolved path}
    ...OR...
    (none for this phase)
  Constitutional Articles:                     <-- only if constitutional_validation enabled with articles
    - Article {ID}: {Title}
  Workflow Overrides:                           <-- only if workflow modifiers exist for this phase
    {key}: {value}
```

### 3.2 Indentation Rules

| Level | Spaces | Content |
|-------|--------|---------|
| 0 | 0 | Block header: `GATE REQUIREMENTS (Phase: ...)` |
| 1 | 2 | Section headers: `Iteration Requirements:`, `Required Artifacts:`, etc. |
| 2 | 4 | Items: `- test_iteration: enabled`, `- docs/requirements/...` |
| 3 | 6 | Sub-parameters: `max_iterations: 10, circuit_breaker: 3, min_coverage: 80%` |

### 3.3 Exact Examples

#### Example A: Phase 06-implementation, feature workflow

**Input:**
- phaseKey: `"06-implementation"`
- artifactFolder: `"REQ-0024-gate-requirements-pre-injection"`
- workflowType: `"feature"`

**Output:**

```
GATE REQUIREMENTS (Phase: 06-implementation):
  Iteration Requirements:
    - test_iteration: enabled
      max_iterations: 10, circuit_breaker: 3, min_coverage: 80%
    - constitutional_validation: enabled
      max_iterations: 5
    - artifact_validation: disabled
    - interactive_elicitation: disabled
    - agent_delegation_validation: enabled
    - atdd_validation: enabled (conditional: when atdd_mode)
      requires: all_priority_tests_passing, no_orphan_skips, red_green_transitions_recorded
  Required Artifacts:
    (none for this phase)
  Constitutional Articles:
    - Article I: Specification Primacy
    - Article II: Test-First Development
    - Article III: Security by Design
    - Article V: Simplicity First
    - Article VI: Code Review Required
    - Article VII: Artifact Traceability
    - Article VIII: Documentation Currency
    - Article IX: Quality Gate Integrity
    - Article X: Fail-Safe Defaults
  Workflow Overrides:
    _when_atdd_mode: {"track_red_green_transitions":true,"require_priority_order":true,"all_priorities_must_pass":true}
```

**Reasoning:** Phase 06-implementation has test_iteration enabled with detailed parameters, constitutional validation with 10 articles, atdd_validation conditional, no artifact_validation, no interactive_elicitation. The feature workflow's `agent_modifiers["06-implementation"]` contains `_when_atdd_mode` conditionals, which appear in the Workflow Overrides section.

#### Example B: Phase 01-requirements, feature workflow

**Input:**
- phaseKey: `"01-requirements"`
- artifactFolder: `"REQ-0024-gate-requirements-pre-injection"`
- workflowType: `"feature"`

**Output:**

```
GATE REQUIREMENTS (Phase: 01-requirements):
  Iteration Requirements:
    - test_iteration: disabled
    - constitutional_validation: enabled
      max_iterations: 5
    - artifact_validation: enabled
    - interactive_elicitation: enabled
      min_menu_interactions: 3
    - agent_delegation_validation: enabled
    - atdd_validation: disabled
  Required Artifacts:
    - docs/requirements/REQ-0024-gate-requirements-pre-injection/requirements-spec.md
  Constitutional Articles:
    - Article I: Specification Primacy
    - Article IV: Explicit Over Implicit
    - Article VII: Artifact Traceability
    - Article IX: Quality Gate Integrity
    - Article XII: Cross-Platform Compatibility
  Workflow Overrides:
    scope: feature
    artifact_prefix: REQ
    read_quick_scan: true
```

#### Example C: Phase 04-design, feature workflow (current phase for REQ-0024)

**Input:**
- phaseKey: `"04-design"`
- artifactFolder: `"REQ-0024-gate-requirements-pre-injection"`
- workflowType: `"feature"`

**Output:**

```
GATE REQUIREMENTS (Phase: 04-design):
  Iteration Requirements:
    - test_iteration: disabled
    - constitutional_validation: enabled
      max_iterations: 5
    - artifact_validation: enabled
    - interactive_elicitation: disabled
    - agent_delegation_validation: enabled
    - atdd_validation: disabled
  Required Artifacts:
    - docs/requirements/REQ-0024-gate-requirements-pre-injection/module-design.md
  Constitutional Articles:
    - Article I: Specification Primacy
    - Article IV: Explicit Over Implicit
    - Article V: Simplicity First
    - Article VII: Artifact Traceability
    - Article IX: Quality Gate Integrity
```

**Reasoning:** Phase 04-design has no workflow overrides in the feature workflow's `agent_modifiers` (there is no `04-design` key), so the Workflow Overrides section is omitted entirely.

#### Example D: Phase 08-code-review, feature workflow (with iteration-requirements override)

**Input:**
- phaseKey: `"08-code-review"`
- artifactFolder: `"REQ-0024-gate-requirements-pre-injection"`
- workflowType: `"feature"`

**Output:**

```
GATE REQUIREMENTS (Phase: 08-code-review):
  Iteration Requirements:
    - test_iteration: disabled
    - constitutional_validation: enabled
      max_iterations: 5
    - artifact_validation: enabled
    - interactive_elicitation: disabled
    - agent_delegation_validation: enabled
    - atdd_validation: disabled
  Required Artifacts:
    - docs/requirements/REQ-0024-gate-requirements-pre-injection/code-review-report.md
  Constitutional Articles:
    - Article VI: Code Review Required
    - Article IX: Quality Gate Integrity
  Workflow Overrides:
    scope: human-review-only
```

**Reasoning:** The feature workflow has `workflow_overrides["feature"]["08-code-review"]` in iteration-requirements.json that sets `test_iteration.enabled = false` and overrides `constitutional_validation.articles` to `["VI", "IX"]`. These are deep-merged into the base 08-code-review requirements. The agent_modifiers for `08-code-review` in workflows.json provide the Workflow Overrides section.

#### Example E: Phase 00-quick-scan, feature workflow (minimal)

**Input:**
- phaseKey: `"00-quick-scan"`
- artifactFolder: `"REQ-0024-gate-requirements-pre-injection"`
- workflowType: `"feature"`

**Output:**

```
GATE REQUIREMENTS (Phase: 00-quick-scan):
  Iteration Requirements:
    - test_iteration: disabled
    - constitutional_validation: disabled
    - artifact_validation: disabled
    - interactive_elicitation: disabled
    - agent_delegation_validation: disabled
    - atdd_validation: disabled
  Required Artifacts:
    (none for this phase)
  Workflow Overrides:
    scope: lightweight-scan
    generate_scope_estimate: true
    output: ["estimated_scope","keyword_matches","file_count_estimate"]
```

**Reasoning:** Phase 00-quick-scan has all iteration requirements disabled. No constitutional articles section is emitted. No artifacts are configured in artifact-paths.json. But agent_modifiers exist, so Workflow Overrides section appears.

#### Example F: Phase key not in config (fail-open)

**Input:**
- phaseKey: `"99-unknown"`
- artifactFolder: `"REQ-0024-gate-requirements-pre-injection"`
- workflowType: `"feature"`

**Output:** `""` (empty string)

**Reasoning:** Phase key `"99-unknown"` does not exist in `iteration-requirements.json`. The function returns empty string per AC-01-04.

---

## 4. Error Taxonomy and Edge Case Catalog

### 4.1 Error Categories

All errors result in the function returning `""` (empty string). No errors propagate to the caller. No errors are logged (per architecture ADR -- no logging in the utility).

| Category | Error Code | Scenario | Return |
|----------|-----------|----------|--------|
| INVALID_INPUT | E-INP-001 | `phaseKey` is null/undefined/empty/non-string | `""` |
| INVALID_INPUT | E-INP-002 | `artifactFolder` is null/undefined/empty/non-string | `""` |
| INVALID_INPUT | E-INP-003 | `workflowType` is not a string (number, object, etc.) | Treated as absent; proceeds without workflow overrides |
| INVALID_INPUT | E-INP-004 | `projectRoot` is not a string | Falls back to `process.cwd()` |
| FILE_MISSING | E-FILE-001 | `iteration-requirements.json` not found at either path | `""` |
| FILE_MISSING | E-FILE-002 | `artifact-paths.json` not found at either path | Block generated without Required Artifacts content |
| FILE_MISSING | E-FILE-003 | `constitution.md` not found | Article IDs shown as fallback: `"Article VII (unknown)"` |
| FILE_MISSING | E-FILE-004 | `workflows.json` not found | Block generated without Workflow Overrides section |
| PARSE_ERROR | E-PARSE-001 | `iteration-requirements.json` contains invalid JSON | `""` |
| PARSE_ERROR | E-PARSE-002 | `artifact-paths.json` contains invalid JSON | Block generated without Required Artifacts content |
| PARSE_ERROR | E-PARSE-003 | `constitution.md` has changed format (no regex matches) | Article IDs shown as fallback |
| PARSE_ERROR | E-PARSE-004 | `workflows.json` contains invalid JSON | Block generated without Workflow Overrides section |
| SCHEMA_MISMATCH | E-SCHEMA-001 | Phase key exists but has no `phase_requirements` wrapper | `""` (cannot find phase config) |
| SCHEMA_MISMATCH | E-SCHEMA-002 | Phase config missing expected fields (e.g., no `test_iteration`) | Missing fields treated as disabled |
| SCHEMA_MISMATCH | E-SCHEMA-003 | `artifact-paths.json` has no `phases` property | Treated as no artifact paths |
| RUNTIME | E-RT-001 | `fs.readFileSync` throws (permissions, disk error) | Caught by try/catch; returns safe default |
| RUNTIME | E-RT-002 | `JSON.parse` throws on valid file with BOM or encoding issue | Caught; returns safe default |

### 4.2 Edge Case Input/Output Pairs

| # | phaseKey | artifactFolder | workflowType | projectRoot | Expected Output |
|---|---------|---------------|-------------|-------------|-----------------|
| EC-01 | `null` | `"REQ-0024-..."` | `"feature"` | valid | `""` |
| EC-02 | `""` | `"REQ-0024-..."` | `"feature"` | valid | `""` |
| EC-03 | `42` | `"REQ-0024-..."` | `"feature"` | valid | `""` |
| EC-04 | `"04-design"` | `null` | `"feature"` | valid | `""` |
| EC-05 | `"04-design"` | `""` | `"feature"` | valid | `""` |
| EC-06 | `"04-design"` | `"REQ-..."` | `null` | valid | Block without workflow overrides |
| EC-07 | `"04-design"` | `"REQ-..."` | `42` | valid | Block without workflow overrides |
| EC-08 | `"04-design"` | `"REQ-..."` | `"feature"` | `null` | Block using `process.cwd()` as root |
| EC-09 | `"04-design"` | `"REQ-..."` | `"feature"` | `"/nonexistent"` | `""` (config files not found) |
| EC-10 | `"99-unknown"` | `"REQ-..."` | `"feature"` | valid | `""` (phase not in config) |
| EC-11 | `"04-design"` | `"REQ-..."` | `"unknown-workflow"` | valid | Block without workflow overrides (workflow type not in overrides or agent_modifiers) |
| EC-12 | `"12-remote-build"` | `"REQ-..."` | `"feature"` | valid | Block with all disabled (12-remote-build has everything disabled) |

### 4.3 Defensive Coding Rules

1. **Every internal function** wraps its body in try/catch and returns its documented default (null, {}, or same-type safe value).
2. **The top-level function** has an outer try/catch returning `""`.
3. **Optional chaining** (`?.`) is used for all property access on loaded JSON objects.
4. **Type checks** use `typeof x === 'string' && x.length > 0` for required string parameters.
5. **No assertions**, no `throw`, no `process.exit`.

**Traceability:** NFR-01 (AC-01-04 through AC-01-07)

---

## 5. STEP 3d Integration Specification

### 5.1 Insertion Point

The GATE REQUIREMENTS injection block is added to STEP 3d of `src/claude/commands/isdlc.md`, inside the delegation prompt template. It goes **after** the EXTERNAL SKILL INJECTION block and **before** the final `Validate GATE-{NN} on completion.` line.

### 5.2 Current Template (lines 1073-1101 of isdlc.md)

```markdown
Use Task tool -> {agent_name} with:
  "Execute Phase {NN} - {Phase Name} for {workflow_type} workflow.
   Artifact folder: {artifact_folder}
   Phase key: {phase_key}
   {WORKFLOW MODIFIERS: {json} -- if applicable}
   {DISCOVERY CONTEXT: ... -- if phase 02 or 03}
   {SKILL INDEX BLOCK -- ...}
   {EXTERNAL SKILL INJECTION (REQ-0022) -- ...}
   Validate GATE-{NN} on completion."
```

### 5.3 Modified Template

```markdown
Use Task tool -> {agent_name} with:
  "Execute Phase {NN} - {Phase Name} for {workflow_type} workflow.
   Artifact folder: {artifact_folder}
   Phase key: {phase_key}
   {WORKFLOW MODIFIERS: {json} -- if applicable}
   {DISCOVERY CONTEXT: ... -- if phase 02 or 03}
   {SKILL INDEX BLOCK -- ...}
   {EXTERNAL SKILL INJECTION (REQ-0022) -- ...}
   {GATE REQUIREMENTS PRE-INJECTION (REQ-0024) -- ...}
   Validate GATE-{NN} on completion."
```

### 5.4 Exact Text to Add

The following prose block should be inserted into STEP 3d's delegation prompt template, after the EXTERNAL SKILL INJECTION block and before the `Validate GATE-{NN} on completion.` line. It follows the same pattern (prose instruction with fail-open semantics):

```markdown
   {GATE REQUIREMENTS PRE-INJECTION (REQ-0024) -- After constructing the delegation prompt above, inject gate pass criteria so the phase agent knows what hooks will check before it starts. This block is fail-open -- if anything fails, continue with the unmodified prompt.
    1. Read the gate requirements for the current phase by calling:
       buildGateRequirementsBlock(phase_key, artifact_folder, workflow_type, projectRoot)
       from src/claude/hooks/lib/gate-requirements-injector.cjs
       (where workflow_type = active_workflow.type from state.json,
        projectRoot = the resolved project root directory).
    2. If the function returns a non-empty string:
       - Append the returned text block to the delegation prompt (after existing blocks, before "Validate GATE-{NN}").
    3. If the function returns an empty string (fail-open):
       - Do nothing. Continue with the unmodified prompt.
    4. Error handling: If the require() call fails, the function throws, or any other error occurs -- skip injection entirely. Log nothing. Continue with the unmodified prompt.}
```

### 5.5 Integration Semantics

| Property | Value |
|----------|-------|
| Position in prompt | After EXTERNAL SKILL INJECTION, before "Validate GATE-{NN}" |
| Fail behavior | Silent skip (empty block, no prompt modification) |
| Existing content modified | None |
| New dependency | `src/claude/hooks/lib/gate-requirements-injector.cjs` |
| Backward compatible | Yes -- if utility is missing/broken, prompt is unchanged |

### 5.6 How the Phase-Loop Controller Executes This

The phase-loop controller is implemented as a markdown instruction file (`isdlc.md`), not executable code. The LLM orchestrator interprets these instructions. At delegation time, the orchestrator:

1. Reads the instruction block in STEP 3d
2. Recognizes it needs to call `buildGateRequirementsBlock()`
3. Uses the Bash tool or inline JavaScript evaluation to call the function
4. Appends the result to the prompt being constructed

This is the same execution pattern as EXTERNAL SKILL INJECTION (steps 1-5 in the existing block) where the orchestrator reads files and formats content based on prose instructions. The key difference is that GATE REQUIREMENTS calls a utility function rather than reading files directly, which encapsulates the assembly logic.

**Important:** The orchestrator may choose to read the four config files directly and format the block inline (following the prose instruction) rather than literally calling a CJS function. The utility module exists as both:
- A callable function for programmatic use (tests, future hooks)
- A reference implementation that the orchestrator's prose instruction describes

Both paths produce the same output. The utility function is the canonical specification of the format.

**Traceability:** FR-06 (AC-06-01 through AC-06-05)

---

## 6. Validation Rules

### 6.1 Input Parameter Validation

| Parameter | Type | Required | Validation Rule | On Failure |
|-----------|------|----------|----------------|------------|
| `phaseKey` | string | Yes | `typeof phaseKey === 'string' && phaseKey.length > 0` | Return `""` |
| `artifactFolder` | string | Yes | `typeof artifactFolder === 'string' && artifactFolder.length > 0` | Return `""` |
| `workflowType` | string | No | `typeof workflowType === 'string' && workflowType.length > 0` | Skip workflow overrides/modifiers |
| `projectRoot` | string | No | `typeof projectRoot === 'string' && projectRoot.length > 0` | Use `process.cwd()` |

### 6.2 Config File Validation

Config files are validated implicitly by `JSON.parse()` and property access. No schema validation is performed (schemas are enforced by the hooks at runtime, not by this utility). The utility reads what it can and degrades gracefully.

| File | Validation | On Invalid |
|------|-----------|------------|
| `iteration-requirements.json` | `JSON.parse()` succeeds, `phase_requirements` property exists | Return `null` from loader |
| `artifact-paths.json` | `JSON.parse()` succeeds, `phases` property exists | Return `null` from loader |
| `constitution.md` | File readable as UTF-8 text | Return `{}` from parser |
| `workflows.json` | `JSON.parse()` succeeds, `workflows` property exists | Return `null` from loader |

### 6.3 Output Validation

The output is always a string. The function guarantees:
- Return type is `string` (never null, undefined, object)
- Either a non-empty formatted block or exactly `""` (empty string)
- The formatted block always starts with `GATE REQUIREMENTS (Phase: `
- The formatted block never contains raw error messages or stack traces

---

## 7. Data Structures

### 7.1 Internal Config Object (assembled in buildGateRequirementsBlock)

No explicit intermediate data structure is needed. The function passes individual values to `formatBlock`. However, for clarity, here is the conceptual shape of the data flowing into `formatBlock`:

```typescript
// Conceptual -- not actual TypeScript; CJS module uses plain objects
interface FormatBlockInput {
    phaseKey: string;                    // "06-implementation"
    phaseReq: {                          // From iteration-requirements.json (possibly merged with overrides)
        test_iteration?: {
            enabled: boolean;
            max_iterations?: number;
            circuit_breaker_threshold?: number;
            success_criteria?: {
                all_tests_passing?: boolean;
                min_coverage_percent?: number;
            };
        };
        constitutional_validation?: {
            enabled: boolean;
            max_iterations?: number;
            articles?: string[];         // ["I", "IV", "VII"]
        };
        artifact_validation?: {
            enabled: boolean;
            paths?: string[];            // template paths (read from iteration-req, but artifact-paths.json takes priority)
        };
        interactive_elicitation?: {
            enabled: boolean;
            min_menu_interactions?: number;
        };
        agent_delegation_validation?: {
            enabled: boolean;
        };
        atdd_validation?: {
            enabled: boolean;
            when?: string;               // "atdd_mode"
            requires?: string[];
        };
    };
    resolvedPaths: string[];             // Resolved artifact paths from artifact-paths.json
    articleMap: Record<string, string>;   // { "I": "Specification Primacy", ... }
    workflowModifiers: object | null;    // Agent modifiers from workflows.json
}
```

### 7.2 Article Map Shape

```javascript
// From parseConstitutionArticles()
{
    "I": "Specification Primacy",
    "II": "Test-First Development",
    "III": "Security by Design",
    "IV": "Explicit Over Implicit",
    "V": "Simplicity First",
    "VI": "Code Review Required",
    "VII": "Artifact Traceability",
    "VIII": "Documentation Currency",
    "IX": "Quality Gate Integrity",
    "X": "Fail-Safe Defaults",
    "XI": "Integration Testing Integrity",
    "XII": "Cross-Platform Compatibility",
    "XIII": "Module System Consistency",
    "XIV": "State Management Integrity"
}
```

---

## 8. File-Level Structure

The module file follows the existing pattern in `three-verb-utils.cjs`:

```javascript
'use strict';

/**
 * iSDLC Gate Requirements Injector (CommonJS)
 * =============================================
 * Reads gate criteria configuration files and formats them as a
 * GATE REQUIREMENTS text block for injection into phase agent
 * delegation prompts.
 *
 * REQ-0024: Gate Requirements Pre-Injection
 * Traces: FR-01 through FR-06, NFR-01 through NFR-05
 *
 * Version: 1.0.0
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Internal: Config Loaders
// ---------------------------------------------------------------------------

function loadIterationRequirements(projectRoot) { ... }
function loadArtifactPaths(projectRoot) { ... }
function parseConstitutionArticles(projectRoot) { ... }
function loadWorkflowModifiers(projectRoot, workflowType, phaseKey) { ... }

// ---------------------------------------------------------------------------
// Internal: Helpers
// ---------------------------------------------------------------------------

function resolveTemplateVars(pathStr, vars) { ... }
function deepMerge(base, overrides) { ... }
function formatBlock(phaseKey, phaseReq, resolvedPaths, articleMap, workflowModifiers) { ... }

// ---------------------------------------------------------------------------
// Exported: Main API
// ---------------------------------------------------------------------------

function buildGateRequirementsBlock(phaseKey, artifactFolder, workflowType, projectRoot) { ... }

module.exports = { buildGateRequirementsBlock };
```

---

## 9. Traceability Matrix

| Design Element | Requirement | Architecture Section |
|---------------|-------------|---------------------|
| `buildGateRequirementsBlock` signature | FR-01, NFR-01, NFR-05 | Arch 2.1 |
| `loadIterationRequirements` | FR-01 (AC-01-01, AC-01-05), NFR-03 | Arch 2.2, 3.3 |
| `loadArtifactPaths` | FR-01 (AC-01-02, AC-01-06), NFR-03 | Arch 2.2, 3.3 |
| `parseConstitutionArticles` | FR-03 (AC-03-01 through AC-03-04) | Arch 2.2, ADR-0002 |
| `loadWorkflowModifiers` | FR-04 (AC-04-01 through AC-04-05) | Arch 2.2, 3.3 |
| `resolveTemplateVars` | FR-02 (AC-02-01 through AC-02-03) | Arch 2.2, 3.2 |
| `deepMerge` | FR-04 (override merging) | Arch 3.2 step 1 |
| `formatBlock` | FR-05 (AC-05-01 through AC-05-06) | Arch 4, ADR-0003 |
| Output format (Section 3) | FR-05 | Arch 4.1, 4.2, 4.3 |
| Error taxonomy (Section 4) | NFR-01 | Arch 6 |
| STEP 3d integration (Section 5) | FR-06 (AC-06-01 through AC-06-05) | Arch 5 |
| Validation rules (Section 6) | NFR-01, Article III | Arch 7.2 |
| CJS module pattern | NFR-05, CON-001, Article XIII | Arch 9.3 |
| No caching | NFR-02, Article V | Arch ADR-0001 |
| Fail-open contract | NFR-01, Article X, CON-004 | Arch 6.1 |
| Input validation | Article III, Article IV | Arch 7.2 |

---

## 10. Constitutional Compliance

| Article | How This Design Complies |
|---------|------------------------|
| I (Specification Primacy) | Design implements the architecture specification exactly: same function signatures, same file paths, same error handling contract, same output format. |
| IV (Explicit Over Implicit) | All error scenarios documented with exact behavior (Section 4). All conditional sections documented with inclusion/exclusion criteria (Section 3.1). No undocumented assumptions. |
| V (Simplicity First) | Single file, 7 internal functions, no dependencies beyond `fs` and `path`. No caching, no complex state management, no abstraction layers. |
| VII (Artifact Traceability) | Every function traces to specific FRs and ACs (Section 9). Every output section traces to a formatting requirement. |
| IX (Quality Gate Integrity) | The utility's output directly describes gate requirements. Hooks remain the enforcement mechanism (CON-004). The utility is informational, not authoritative. |

---

## 11. Open Design Decisions

None. All decisions were made during the architecture phase and are documented in ADRs 0001-0003 of the architecture overview. This design is a direct implementation specification with no remaining ambiguities.
