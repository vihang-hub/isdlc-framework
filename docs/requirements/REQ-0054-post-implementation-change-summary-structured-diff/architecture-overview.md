# Architecture Overview: Post-Implementation Change Summary

**Requirement ID:** REQ-0054
**Phase:** 03-architecture
**Created:** 2026-03-09
**Status:** Draft

---

## 1. Architecture Pattern Selection

### 1.1 Options Evaluated

| Pattern | Description | Fit Assessment | Verdict |
|---------|-------------|----------------|---------|
| **Standalone CLI script** | Single CJS file invoked via `node script.cjs --folder <path>`. Follows existing antigravity pattern. | EXCELLENT -- identical pattern to analyze-finalize.cjs and workflow-finalize.cjs. Zero new infrastructure. | **SELECTED** |
| Embedded library module | Export functions from a shared module, called programmatically by the phase-loop controller. | POOR -- breaks the antigravity convention where scripts are invoked as child processes with JSON stdout. Would couple the generator to the orchestrator's runtime. |
| Hook-based trigger | Register as a PostToolUse hook that fires on phase completion. | POOR -- hooks observe tool calls, not phase transitions. Phase completion is managed by the orchestrator in isdlc.md, not by tool-call events. Also, hooks must fail-open (Article X) and exit within 10s, which conflicts with git operations on large repos. |
| Agent-delegated | Delegate change-summary generation to a sub-agent via Task. | POOR -- massive overhead (agent startup, context loading) for a deterministic data-collection script. Article V violation (simplicity). |

### 1.2 Rationale

The **standalone CLI script** pattern is the only viable option. It matches the established convention for post-phase scripts in the antigravity directory, requires no new infrastructure, and provides clean isolation between the generator and the orchestrator. The script runs as a child process (`execSync` or `node` invocation from isdlc.md step 3e-summary), receives its inputs via CLI arguments and filesystem reads, and returns structured JSON to stdout.

This is documented in ADR-0001 below.

---

## 2. System Architecture

### 2.1 System Context (C4 Level 1)

```
+-------------------+        +----------------------------+
|  Phase-Loop       |        |  change-summary-generator  |
|  Controller       |------->|  .cjs                      |
|  (isdlc.md)       |  exec  |  (src/antigravity/)        |
+-------------------+        +----------------------------+
                                    |         |         |
                              reads |   reads |   reads |
                                    v         v         v
                              +---------+ +--------+ +----------+
                              |  git    | | state  | | tasks.md |
                              |  repo   | | .json  | | req-spec |
                              +---------+ +--------+ +----------+
                                    |
                              writes|
                                    v
                              +------------------------------+
                              | change-summary.md            |
                              | change-summary.json          |
                              +------------------------------+
```

**Actors:**
- **Phase-Loop Controller** (isdlc.md): Invokes the generator after phase 06 completes. Consumes the stdout JSON result to display a brief inline summary.
- **change-summary-generator.cjs**: The new script. Reads from 4 sources, writes 2 output artifacts, returns JSON to stdout.
- **Git repository**: Source of file diff data (merge-base, diff --name-status, log per file).
- **state.json**: Source of test results from phase 06 iteration data.
- **tasks.md / requirements-spec.md**: Sources for requirement tracing (FR/AC identifiers and trace annotations).

### 2.2 Container Diagram (C4 Level 2)

```
+------------------------------------------------------------------+
|  Phase-Loop Controller (isdlc.md)                                |
|  Step 3e-summary: IF phase_key === '06-implementation'           |
|    exec: node src/antigravity/change-summary-generator.cjs       |
|           --folder "docs/requirements/{artifact_folder}"         |
|    parse: JSON stdout result                                     |
|    display: brief inline table from change-summary.md            |
+------------------------------------------------------------------+
        |
        | child_process (execSync, 30s timeout)
        v
+------------------------------------------------------------------+
|  change-summary-generator.cjs                                    |
|                                                                  |
|  +-------------------+  +-----------------------+                |
|  | parseArgs()       |  | main()                |                |
|  | FR-008            |  | orchestrates pipeline |                |
|  +-------------------+  +-----------------------+                |
|                                                                  |
|  +-------------------+  +-----------------------+                |
|  | collectGitDiff()  |  | classifyFiles()       |                |
|  | FR-001            |  | FR-002                |                |
|  +-------------------+  +-----------------------+                |
|                                                                  |
|  +-------------------+  +-----------------------+                |
|  | traceRequirements |  | extractTestResults()  |                |
|  | ()  FR-003        |  | FR-004                |                |
|  +-------------------+  +-----------------------+                |
|                                                                  |
|  +-------------------+  +-----------------------+                |
|  | generateMarkdown()|  | generateJSON()        |                |
|  | FR-005            |  | FR-006                |                |
|  +-------------------+  +-----------------------+                |
|                                                                  |
|  Graceful degradation wrappers around each (FR-007)              |
+------------------------------------------------------------------+
        |                    |                    |
   reads|               reads|               reads|
        v                    v                    v
  +----------+     +----------------+     +------------------+
  | git CLI  |     | .isdlc/        |     | docs/            |
  | merge-   |     | state.json     |     | requirements/    |
  | base,    |     | (read-only)    |     | {folder}/        |
  | diff,    |     |                |     | - req-spec.md    |
  | log      |     |                |     | - tasks.md (plan)|
  +----------+     +----------------+     +------------------+
        |
   writes|
        v
  +------------------------------+     +---------------------------+
  | docs/requirements/{folder}/  |     | .isdlc/                   |
  | change-summary.md            |     | change-summary.json       |
  | (human-readable)             |     | (machine-readable)        |
  +------------------------------+     +---------------------------+
```

### 2.3 Data Flow

```
1. Phase-loop controller detects phase_key === '06-implementation' completed
2. Reads artifact_folder from state.json active_workflow
3. Executes: node change-summary-generator.cjs --folder <path>
4. Generator pipeline:
   a. parseArgs() -> extract --folder path
   b. collectGitDiff() -> { merge_base, head, files: [{path, status}] }
   c. classifyFiles() -> [{path, status, rationale}]
   d. traceRequirements() -> [{path, ..., traced: [FR-NNN], source}]
   e. extractTestResults() -> { passing, total, failing, coverage }
   f. generateMarkdown() -> writes change-summary.md
   g. generateJSON() -> writes change-summary.json
   h. stdout JSON result -> { result, files_changed, ... }
5. Phase-loop reads stdout JSON
6. Displays brief inline table
7. Workflow continues to next phase
```

---

## 3. Technology Stack Decision

### 3.1 Runtime

| Choice | Decision | Rationale | Traces |
|--------|----------|-----------|--------|
| **Language** | Node.js (whatever version the host project uses) | Framework standard. All antigravity scripts use Node.js. | CON-001 |
| **Module system** | CommonJS (CJS) | Required by Article XIII. Antigravity scripts run as standalone Node.js processes outside package scope -- ESM `import` syntax does not work without `package.json` type:module in scope. | CON-001, NFR-008 |
| **Dependencies** | Zero new npm packages | CON-002. Use only Node.js built-ins (fs, path, child_process) and existing common.cjs exports. | CON-002, NFR-009 |

### 3.2 External Tools

| Tool | Usage | Fallback if Unavailable | Traces |
|------|-------|------------------------|--------|
| **git CLI** | `git merge-base`, `git diff --name-status`, `git log --format` | Emit warning, produce summary with empty file list and "git unavailable" warning. | FR-001, FR-007, ASM-001 |

### 3.3 Imports from Existing Modules

| Import | Source | Purpose | Stability |
|--------|--------|---------|-----------|
| `getProjectRoot()` | `src/claude/hooks/lib/common.cjs` | Resolve project root directory (handles CLAUDE_PROJECT_DIR, directory walking, caching). | Stable -- v3.0.0, used by 26+ hooks, per-process cached. |
| `readState()` | `src/claude/hooks/lib/common.cjs` | Read and parse `.isdlc/state.json`. Returns parsed object or null. | Stable -- v3.0.0, null-safe, handles missing/corrupt files. |

### 3.4 Technology Alternatives Considered

| Alternative | Why Rejected | Article |
|-------------|-------------|---------|
| Shell script (bash) | Not cross-platform (NFR-007, Article XII). Cannot produce structured JSON reliably. | V, XII |
| ESM module | Violates CON-001 / Article XIII. Antigravity scripts must be CJS. | XIII |
| TypeScript | Requires build step. Framework has no TS build pipeline for antigravity scripts. Over-engineering for a ~300-line script. | V |
| External JSON schema validator (ajv) | Adds npm dependency (violates CON-002). Schema is simple enough to validate with inline checks. | V |

---

## 4. Integration Architecture

### 4.1 Phase-Loop Integration (FR-008)

The generator integrates into the phase-loop controller at a new step **3e-summary**, positioned after `3e-refine` and before `3f`. This follows the established pattern of conditional post-phase steps.

**Existing step chain:**
```
3e (post-phase state update)
  -> 3e-timing (timing end + budget check)
  -> 3e-plan (plan generation, after phase 01 only)
  -> 3e-review (supervised review gate, conditional)
  -> 3e-sizing (sizing decision, after phase 02 only)
  -> 3e-refine (task refinement, after phase 04 only)
  -> [NEW] 3e-summary (change summary, after phase 06 only)
  -> 3f (result status check)
```

**Step 3e-summary specification:**

```
**3e-summary.** CHANGE SUMMARY GENERATION (conditional) -- After the post-phase
state update, generate a structured change summary.

**Trigger check**:
1. Read the phase key that was just completed from the state update in 3e
2. If `phase_key === '06-implementation'`:
   a. Read `active_workflow.artifact_folder` from state.json
   b. Execute:
      node src/antigravity/change-summary-generator.cjs \
        --folder "docs/requirements/{artifact_folder}"
   c. Parse JSON output from stdout
   d. If result === "OK":
      - Read change-summary.md from the artifact folder
      - Display brief inline table (first N lines or metrics header only)
   e. If result === "ERROR" or execution fails:
      - Display warning: "Change summary generation failed: {message}"
      - Continue to 3f (non-blocking per FR-007)
3. Otherwise (not phase 06): skip to 3f
```

**Non-blocking guarantee:** If the generator script fails, throws, or times out, the phase-loop MUST continue to step 3f. The change summary is observability, not a gate. This aligns with Article X (fail-safe defaults) and FR-007 (graceful degradation).

### 4.2 CLI Interface Contract

**Invocation:**
```
node src/antigravity/change-summary-generator.cjs --folder <artifact-folder-path>
```

**Arguments:**
| Argument | Required | Description |
|----------|----------|-------------|
| `--folder` | Yes | Path to the requirement artifact folder (absolute or relative to project root). Example: `docs/requirements/REQ-0054-post-implementation-change-summary-structured-diff` |

**Stdout (JSON):**

Success:
```json
{
  "result": "OK",
  "files_changed": 12,
  "files_traced": 10,
  "files_untraced": 2,
  "md_path": "docs/requirements/REQ-0054-.../change-summary.md",
  "json_path": ".isdlc/change-summary.json",
  "warnings": []
}
```

Error:
```json
{
  "result": "ERROR",
  "message": "Missing --folder argument"
}
```

Partial success (degraded):
```json
{
  "result": "OK",
  "files_changed": 0,
  "files_traced": 0,
  "files_untraced": 0,
  "md_path": "docs/requirements/REQ-0054-.../change-summary.md",
  "json_path": ".isdlc/change-summary.json",
  "warnings": ["git unavailable -- no file diff data", "tasks.md not found -- tracing degraded"]
}
```

**Exit codes:**
| Code | Meaning |
|------|---------|
| 0 | Success (full or partial/degraded) |
| 2 | Hard error (missing --folder argument) |

Note: The generator exits 0 even when degradation occurs. Only a missing `--folder` argument is a hard error. This ensures the phase-loop is never blocked by the generator (NFR-003, FR-007).

### 4.3 Output Artifacts

**change-summary.md** (FR-005):
- Location: `docs/requirements/{artifact_folder}/change-summary.md`
- Persists as a permanent artifact alongside requirements-spec.md and impact-analysis.md
- Format: metrics header, file table (path, type, rationale, traced FRs), test results, warnings

**change-summary.json** (FR-006):
- Location: `.isdlc/change-summary.json`
- Machine-readable, schema version 1.0
- Consumable by future user-space hooks (Issue #101)
- Overwritten on each generation (single active workflow at a time)

### 4.4 Dependency Map

```
change-summary-generator.cjs
  IMPORTS (Node.js built-ins):
    - fs (readFileSync, writeFileSync, existsSync)
    - path (join, basename, isAbsolute, posix)
    - child_process (execSync)

  IMPORTS (framework):
    - common.cjs -> getProjectRoot()
    - common.cjs -> readState()

  READS (filesystem):
    - .isdlc/state.json (via readState())
    - docs/isdlc/tasks.md (trace annotations)
    - docs/requirements/{folder}/requirements-spec.md (FR/AC set)

  READS (git CLI):
    - git merge-base HEAD <base-branch>
    - git diff --name-status <merge-base>..HEAD
    - git log --format="%s" -- <file> (per changed file)

  WRITES (filesystem):
    - docs/requirements/{folder}/change-summary.md
    - .isdlc/change-summary.json
```

---

## 5. Internal Module Design

### 5.1 Function Decomposition

The script follows a linear pipeline architecture. Each function handles one FR and returns data for the next stage. Graceful degradation (FR-007) wraps each function call in the main() orchestrator.

| Function | FR | Input | Output | Failure Mode |
|----------|-----|-------|--------|-------------|
| `parseArgs()` | FR-008 | `process.argv` | `{ folder }` | Exit 2 if --folder missing |
| `collectGitDiff(projectRoot, baseBranch)` | FR-001 | Project root, base branch name | `{ mergeBase, head, entries: [{path, status, oldPath?}] }` | Return `null`; emit warning |
| `classifyFiles(entries, projectRoot)` | FR-002 | Diff entries array | `[{path, status, oldPath?, rationale}]` | Return entries with rationale "Unable to determine" |
| `extractValidRequirements(reqSpecPath)` | FR-003 | Path to requirements-spec.md | `Set<string>` of valid FR-NNN / AC-NNN-NN IDs | Return empty Set; emit warning |
| `traceFromTasksMd(files, tasksPath)` | FR-003 | File list, path to tasks.md | Map of file -> traced requirements + source | Return empty Map (fall through to next source) |
| `traceFromCommits(files, projectRoot)` | FR-003 | Untraced files, project root | Map of file -> traced requirements + source | Return empty Map (fall through) |
| `traceFromCode(files, projectRoot)` | FR-003 | Still-untraced files, project root | Map of file -> traced requirements + source | Return empty Map (file marked "untraced") |
| `traceRequirements(files, tasksPath, reqSpecPath, projectRoot)` | FR-003 | All data sources | `[{path, ..., tracedRequirements, tracingSource}]` | All files marked "untraced"; emit warning |
| `extractTestResults(state)` | FR-004 | Parsed state.json object | `{ total, passing, failing, coverage } or null` | Return `null`; emit warning |
| `generateMarkdown(data, outputPath)` | FR-005 | Aggregated data, output path | Writes file, returns path | Return null; emit warning |
| `generateJSON(data, outputPath)` | FR-006 | Aggregated data, output path | Writes file, returns path | Return null; emit warning |
| `main()` | All | CLI invocation | Stdout JSON | Catch-all; exit 0 with error JSON |

### 5.2 Pipeline Flow

```
main()
  |
  +-- parseArgs() -----> { folder } or EXIT 2
  |
  +-- getProjectRoot() -> projectRoot
  +-- readState() -------> state (or null)
  +-- resolve baseBranch from state.active_workflow.base_branch || 'main'
  +-- resolve artifact_folder from state.active_workflow.artifact_folder
  |
  +-- TRY collectGitDiff(projectRoot, baseBranch)
  |     -> diffResult (or null + warning)
  |
  +-- TRY classifyFiles(diffResult.entries, projectRoot)
  |     -> classifiedFiles (or [] + warning)
  |
  +-- TRY extractValidRequirements(reqSpecPath)
  |     -> validReqSet (or empty Set + warning)
  |
  +-- TRY traceRequirements(classifiedFiles, tasksPath, reqSpecPath, projectRoot)
  |     |-- traceFromTasksMd()    -> partial traces
  |     |-- traceFromCommits()    -> more traces (untraced files only)
  |     |-- traceFromCode()       -> remaining traces (still-untraced only)
  |     +-> tracedFiles (all files, each with tracedRequirements + source)
  |
  +-- TRY extractTestResults(state)
  |     -> testResults (or null + warning)
  |
  +-- aggregate all data into summary object
  |
  +-- TRY generateMarkdown(summary, mdPath)
  +-- TRY generateJSON(summary, jsonPath)
  |
  +-- stdout JSON result { result: "OK", ... warnings }
  +-- EXIT 0
```

### 5.3 Requirement Tracing Fallback Chain (FR-003)

This is the highest-complexity component. The tracing algorithm processes files through a prioritized source chain with early exit per file.

```
For each changed file:
  1. CHECK tasks.md trace annotations
     - Parse lines matching: /\| traces:\s*(.+)/
     - Extract FR-NNN, AC-NNN-NN identifiers from the comma-separated value
     - Match file path against task context (task subject or files: sub-line)
     - If matched: record source = "tasks.md", STOP for this file

  2. CHECK commit messages (only if not traced in step 1)
     - Run: git log --format="%s" -- <file>
     - Scan each message for /FR-\d{3}|AC-\d{3}-\d{2}/g
     - If matched: record source = "commit", STOP for this file

  3. CHECK code comments (only if not traced in steps 1-2)
     - Read file content (skip binary files, skip files > 100KB)
     - Scan for /FR-\d{3}|AC-\d{3}-\d{2}/g in comment patterns
     - If matched: record source = "code-comment", STOP for this file

  4. MARK as untraced (if no source matched)
     - Record source = "untraced"
     - Rationale = "N/A" or inferred from change type
```

**Validation against valid requirement set:** All extracted FR-NNN / AC-NNN-NN identifiers are validated against the set parsed from requirements-spec.md. Identifiers not in the valid set are silently dropped (they may be references to other features' requirements). If the valid set is empty (requirements-spec.md missing/unparseable), all extracted identifiers are accepted as-is.

---

## 6. Security Architecture

### 6.1 Threat Model (STRIDE Analysis)

This feature has a minimal attack surface because it is a read-only data collection script that runs locally, not a networked service. The STRIDE analysis below confirms no significant threats.

| Threat | Category | Applies | Assessment |
|--------|----------|---------|------------|
| Spoofing | Identity | NO | No authentication. Script runs as the current OS user. |
| Tampering | Data integrity | LOW | Script reads git data and state.json. A malicious actor with filesystem access could tamper with inputs, but they already have full access to the codebase. The generator does not make trust decisions based on its inputs. |
| Repudiation | Audit | NO | Change summary is an informational artifact, not an audit log. Git history provides the authoritative record. |
| Information disclosure | Confidentiality | LOW | change-summary.md is committed to the repo (same visibility as code). change-summary.json is in .isdlc/ (gitignored). No secrets are read or emitted. |
| Denial of service | Availability | LOW | A malformed git repo or very large diff could cause slow execution. Mitigated by 30s timeout on the execSync call from the phase-loop, and per-command 5s timeouts on git operations. |
| Elevation of privilege | Authorization | NO | Script runs with the same permissions as the user. No privilege boundaries crossed. |

### 6.2 Security Design Decisions

| Decision | Rationale | Constitutional Article |
|----------|-----------|----------------------|
| **Read-only state.json access** | Generator is observability, not state management. CON-003 mandates no mutations. | III, X |
| **No secrets in output** | change-summary.md and .json contain file paths, requirement IDs, and test counts. No credentials, API keys, or sensitive data. | III |
| **Input validation on --folder argument** | Validate that the folder path exists and is within the project root. Prevents directory traversal. | III |
| **Sanitized git command construction** | Base branch name comes from state.json (trusted source, written by the orchestrator). No user-supplied strings are interpolated into shell commands. | III |
| **File content size limit for code scanning** | Skip files > 100KB when scanning for requirement references in code comments (FR-003 step 3). Prevents memory exhaustion on binary or generated files. | X |
| **Binary file detection** | Skip binary files (check for null bytes in first 8KB) in code comment scanning. | X |

### 6.3 Data Flow Security

```
INPUTS (all read-only):
  git CLI output       -> String parsing only, no eval/exec of content
  state.json           -> JSON.parse with try/catch (readState() handles corruption)
  tasks.md             -> Line-by-line regex parsing, no eval
  requirements-spec.md -> Regex extraction of FR-NNN / AC-NNN-NN patterns

OUTPUTS (write-only):
  change-summary.md    -> Markdown text, no executable content
  change-summary.json  -> JSON.stringify output, deterministic
  stdout               -> JSON.stringify output, consumed by phase-loop
```

No data flows cross trust boundaries. All inputs and outputs are local filesystem operations within the project directory.

---

## 7. Graceful Degradation Architecture (FR-007 / Article X)

### 7.1 Degradation Strategy

The generator uses a **section-independent degradation** pattern: each data collection step is wrapped in a try/catch that records a warning and allows the pipeline to continue with whatever data was successfully collected.

```
main()
  warnings = []

  diffResult = TRY collectGitDiff()
    CATCH -> diffResult = null; warnings.push("git unavailable")

  classifiedFiles = TRY classifyFiles(diffResult)
    CATCH -> classifiedFiles = []; warnings.push("file classification failed")

  tracedFiles = TRY traceRequirements(classifiedFiles)
    CATCH -> tracedFiles = classifiedFiles.map(f => ({...f, untraced}));
             warnings.push("requirement tracing failed")

  testResults = TRY extractTestResults(state)
    CATCH -> testResults = null; warnings.push("test results unavailable")

  TRY generateMarkdown(...)
    CATCH -> warnings.push("markdown generation failed")

  TRY generateJSON(...)
    CATCH -> warnings.push("JSON generation failed")

  // Always exit 0 with whatever we have
  stdout JSON { result: "OK", warnings }
```

### 7.2 Degradation Scenario Matrix

| Scenario | Cause | Degradation | Output Quality | Traces |
|----------|-------|-------------|---------------|--------|
| Git unavailable | No git binary, not a git repo | No file diff data. Summary has 0 files. | Minimal (test results only if state.json available) | FR-007, ASM-001 |
| Not on a feature branch | No merge-base found | Fall back to `HEAD~20` or empty diff | Partial (may have wrong file set) | FR-007, ASM-002 |
| requirements-spec.md missing | Phase 01 artifacts not present | All files marked "untraced" | Full file list, no tracing | FR-007, ASM-003 |
| tasks.md missing or no trace annotations | No plan generated, or plan lacks annotations | Fall through to commit messages, then code comments | File list with fallback tracing | FR-007, ASM-004 |
| state.json missing or no phase 06 data | state.json corrupt or phase 06 not tracked | Test results section omitted | File list + tracing, no test data | FR-007, ASM-005 |
| Large diff (> 50 files) | Major refactoring or framework-wide change | May exceed 5s NFR-001 target; per-file git log is O(n) | Full data but potentially slow | NFR-001 |
| File read error (permission, encoding) | OS-level issue | Skip the problematic file in code scanning | Partial tracing for that file | FR-007 |
| Output write error (disk full, permissions) | OS-level issue | Warning emitted, other output may still succeed | Partial outputs | FR-007 |

### 7.3 Invariants

Regardless of degradation level, the generator MUST:

1. **Always exit 0** (unless --folder is missing, which is exit 2)
2. **Always emit valid JSON to stdout** (even if `{ "result": "OK", "warnings": [...] }` with no data)
3. **Never write to state.json** (CON-003)
4. **Never throw an uncaught exception** (top-level try/catch in main())
5. **Never block the phase-loop** (non-blocking integration in 3e-summary)

---

## 8. Cross-Platform Architecture (Article XII / NFR-007)

### 8.1 Path Handling

| Context | Strategy | Implementation |
|---------|----------|----------------|
| Git command output | Forward slashes (git always uses `/` on all platforms) | Parse as-is |
| Filesystem reads/writes | `path.join()` for OS-native paths | Node.js path module handles platform differences |
| Output in change-summary.md/json | Forward slashes (for consistency and git compatibility) | Use `path.posix.join()` or manual `/` normalization for paths stored in output artifacts |
| --folder argument | Accept both `/` and `\` separators | `path.resolve()` normalizes to OS-native |

### 8.2 Git Command Compatibility

| Command | macOS/Linux | Windows | Notes |
|---------|-------------|---------|-------|
| `git merge-base HEAD main` | Works | Works | No path arguments |
| `git diff --name-status <sha>..HEAD` | Works | Works | Output uses `/` on all platforms |
| `git log --format="%s" -- <file>` | Works | Works with forward-slash paths | Use forward-slash paths for git commands |

---

## 9. Architecture Decision Records

### ADR-0001: Standalone CLI Script Pattern

**Status:** Accepted
**Context:** Need to choose the execution model for the change summary generator. Four patterns were evaluated: standalone CLI script, embedded library module, hook-based trigger, and agent-delegated.
**Decision:** Use the standalone CLI script pattern (`src/antigravity/change-summary-generator.cjs`), invoked via `node` from the phase-loop controller.
**Consequences:**
- Positive: Follows the established antigravity convention (analyze-finalize.cjs, workflow-finalize.cjs). Clean process isolation. JSON stdout interface. No coupling to orchestrator runtime.
- Positive: Easy to test in isolation (invoke with CLI args, assert stdout JSON and file outputs).
- Negative: Requires serializing/deserializing data through stdout (minor overhead, negligible for this use case).
**Alternatives Rejected:** Embedded module (breaks convention, couples to orchestrator), hook trigger (wrong abstraction -- hooks observe tool calls, not phase transitions), agent delegation (Article V violation -- massive overhead for deterministic script).
**Traces:** FR-008, NFR-009, CON-001, Article V

### ADR-0002: Zero New Dependencies

**Status:** Accepted
**Context:** The generator needs to parse git output, read JSON/markdown files, extract patterns via regex, and produce formatted output. External packages (e.g., `minimist` for arg parsing, `ajv` for JSON schema validation, `chalk` for colored output) could simplify some of this.
**Decision:** Use only Node.js built-ins (`fs`, `path`, `child_process`) and existing framework utilities (`common.cjs`). No new npm dependencies.
**Consequences:**
- Positive: No supply chain risk. No version conflicts. No install size increase. Framework stays lightweight.
- Positive: Aligns with existing antigravity scripts which all use only built-ins + common.cjs.
- Negative: Manual arg parsing instead of `minimist`. Manual JSON schema adherence instead of `ajv`. Acceptable given the script's simplicity (~300 lines, 1 arg, 1 fixed schema).
**Traces:** CON-002, NFR-009, Article V

### ADR-0003: Section-Independent Graceful Degradation

**Status:** Accepted
**Context:** FR-007 requires the generator to never crash and always produce partial output. Need to choose between (a) top-level try/catch only, (b) per-function try/catch with degradation, or (c) an error-accumulator pattern.
**Decision:** Use per-function try/catch with a shared warnings array (section-independent degradation). Each pipeline stage can fail independently without affecting other stages. Warnings are accumulated and included in both output artifacts.
**Consequences:**
- Positive: Maximum resilience. Git failure does not prevent test results from appearing. Tracing failure does not prevent file classification.
- Positive: Warnings array provides transparency about what degraded and why.
- Negative: More verbose error handling code (~15% of script is try/catch wrappers). Acceptable for the reliability guarantee.
**Traces:** FR-007, NFR-002, NFR-003, NFR-004, Article X

### ADR-0004: Read-Only State Access

**Status:** Accepted
**Context:** The generator needs test results from state.json. It could either (a) read state.json directly, or (b) receive test data as a CLI argument from the phase-loop.
**Decision:** Read state.json directly via `readState()` from common.cjs. The generator does not write to state.json under any circumstances.
**Consequences:**
- Positive: Simpler CLI interface (only --folder argument needed). Data freshness guaranteed.
- Positive: `readState()` handles missing/corrupt state.json gracefully (returns null).
- Negative: Tight coupling to state.json schema for test result paths. Mitigated by graceful degradation if the path changes.
**Traces:** CON-003, NFR-010, FR-004

### ADR-0005: Dual-Format Output (Markdown + JSON)

**Status:** Accepted
**Context:** The change summary serves two audiences: developers (human-readable review) and future hooks/automation (machine-readable data). Need to decide output format(s).
**Decision:** Generate both `change-summary.md` (human-readable, persisted in artifact folder) and `change-summary.json` (machine-readable, in `.isdlc/` directory).
**Consequences:**
- Positive: Human consumers get a formatted table they can review in PRs and audits.
- Positive: Machine consumers (future Issue #101 hooks) get stable JSON with schema versioning.
- Negative: Two output paths to maintain. Mitigated by generating both from the same internal data structure.
**Traces:** FR-005, FR-006, NFR-005, NFR-006

### ADR-0006: Phase-Loop Integration at Step 3e-summary

**Status:** Accepted
**Context:** Need to choose where in the phase-loop to invoke the generator. Options: (a) as part of step 3e post-phase update, (b) as a new step between 3e-refine and 3f, (c) as part of step 3f result handling.
**Decision:** Add a new step 3e-summary after 3e-refine and before 3f. The step fires conditionally when `phase_key === '06-implementation'`.
**Consequences:**
- Positive: Follows the established pattern of conditional post-phase steps (3e-sizing fires after 02, 3e-refine fires after 04).
- Positive: Non-blocking -- if generation fails, step 3f proceeds normally.
- Positive: Minimal change to isdlc.md (~15-20 lines, additive only).
- Negative: Adds one more conditional step to an already long step-chain. Acceptable given the pattern is established.
**Traces:** FR-008, CON-004

---

## 10. JSON Schema Architecture (FR-006)

### 10.1 Schema Design Principles

1. **Versioned from day one** (NFR-005): `schema_version: "1.0"` is a required top-level field.
2. **Backward-compatible evolution** (NFR-006): New fields can be added (minor version bump). Removed or renamed fields require a major version bump.
3. **Self-describing**: The schema includes workflow context (slug, branches, commits) so consumers do not need external context.
4. **Nullable sections**: `test_results` can be `null` when test data is unavailable (graceful degradation).

### 10.2 Schema v1.0

```json
{
  "schema_version": "1.0",
  "generated_at": "2026-03-09T12:00:00.000Z",
  "workflow_slug": "REQ-0054-post-implementation-change-summary-structured-diff",
  "base_branch": "main",
  "base_commit": "abc1234",
  "head_commit": "def5678",
  "summary": {
    "files_modified": 3,
    "files_added": 1,
    "files_deleted": 0,
    "files_renamed": 0,
    "total_files_changed": 4,
    "requirements_traced": 3,
    "requirements_untraced": 1,
    "tests_passing": true,
    "test_count": 42,
    "coverage_percent": 87
  },
  "files": [
    {
      "path": "src/antigravity/change-summary-generator.cjs",
      "change_type": "added",
      "old_path": null,
      "rationale": "New script implementing FR-001 through FR-007",
      "traced_requirements": ["FR-001", "FR-002", "FR-003", "FR-004", "FR-005", "FR-006", "FR-007"],
      "tracing_source": "tasks.md"
    }
  ],
  "test_results": {
    "total": 42,
    "passing": 42,
    "failing": 0,
    "coverage_percent": 87
  },
  "warnings": []
}
```

### 10.3 Schema Stability Contract

- **Adding fields**: Allowed without version bump (consumers MUST ignore unknown fields).
- **Removing fields**: Requires `schema_version` bump to `"2.0"`.
- **Renaming fields**: Requires `schema_version` bump to `"2.0"`.
- **Changing field types**: Requires `schema_version` bump to `"2.0"`.
- **Nullable fields**: `test_results` and `old_path` can be `null`. Consumers MUST handle null.

---

## 11. Performance Architecture (NFR-001)

### 11.1 Performance Budget

| Operation | Expected Time | Budget | Notes |
|-----------|--------------|--------|-------|
| `git merge-base` | < 100ms | 5s timeout | Single git command |
| `git diff --name-status` | < 200ms | 5s timeout | Single git command |
| `git log` per file | < 100ms each | 5s timeout per command | O(n) where n = changed files |
| tasks.md parsing | < 50ms | N/A | Single file read + regex |
| requirements-spec.md parsing | < 50ms | N/A | Single file read + regex |
| Code comment scanning | < 100ms per file | N/A | Only for untraced files, skip > 100KB |
| Markdown generation | < 50ms | N/A | String concatenation |
| JSON generation | < 10ms | N/A | JSON.stringify |
| **Total (50 files)** | **< 3s** | **< 5s** | Well within NFR-001 budget |

### 11.2 Performance Safeguards

| Safeguard | Purpose | Implementation |
|-----------|---------|----------------|
| 5s timeout per git command | Prevent hanging on large repos | `execSync({ timeout: 5000 })` |
| 30s timeout on the entire script | Prevent phase-loop blocking | Phase-loop `execSync({ timeout: 30000 })` |
| Skip files > 100KB in code scanning | Prevent memory exhaustion | `fs.statSync(file).size > 102400` check |
| Early exit in tracing chain | Avoid redundant work | Once a file is traced, skip remaining sources |

---

## 12. Deployment Architecture

### 12.1 File Locations

| File | Location | Type |
|------|----------|------|
| Generator script | `src/antigravity/change-summary-generator.cjs` | New file, ~250-350 lines |
| Phase-loop integration | `src/claude/commands/isdlc.md` step 3e-summary | Modified, ~15-20 lines added |
| Human-readable output | `docs/requirements/{artifact_folder}/change-summary.md` | Generated output |
| Machine-readable output | `.isdlc/change-summary.json` | Generated output (gitignored) |

### 12.2 No Infrastructure Changes

This feature requires:
- No new npm packages
- No new configuration files
- No new hooks
- No state.json schema changes
- No new environment variables
- No CI/CD changes

The generator is a pure addition: one new script file and one additive modification to an existing orchestrator file.

---

## 13. Constitutional Compliance Validation

| Article | Requirement | Compliance | Evidence |
|---------|-------------|------------|----------|
| III (Security by Design) | Security architecture defined before implementation | COMPLIANT | Section 6 (Security Architecture) covers STRIDE, input validation, no secrets in output, sanitized git commands. |
| IV (Explicit Over Implicit) | All assumptions documented, no ambiguity | COMPLIANT | All 5 assumptions from requirements-spec.md have degradation strategies. No `[NEEDS CLARIFICATION]` markers remain. |
| V (Simplicity First) | Simplest architecture that satisfies requirements | COMPLIANT | Single CJS file, zero new deps, follows existing pattern. ADR-0001 and ADR-0002 justify rejecting more complex alternatives. |
| VII (Artifact Traceability) | Architecture traces to requirements | COMPLIANT | All ADRs include Traces fields. Function decomposition maps each function to its FR. |
| IX (Quality Gate Integrity) | Required artifacts exist and are validated | COMPLIANT | This architecture-overview.md is the required Phase 03 artifact. Gate validation in Section 14. |
| X (Fail-Safe Defaults) | Fail-safe defaults designed into architecture | COMPLIANT | Section 7 (Graceful Degradation) covers all failure modes. Generator always exits 0 except for missing --folder. Phase-loop integration is non-blocking. |
| XII (Cross-Platform) | Works on macOS, Linux, Windows | COMPLIANT | Section 8 (Cross-Platform Architecture) covers path handling and git command compatibility. |
| XIII (CJS Only) | Antigravity scripts use CommonJS | COMPLIANT | ADR-0002 confirms CJS-only, no ESM imports. |

---

## 14. GATE-03 Validation

### Architecture Documentation
- [x] System context diagram (C4 Level 1) -- Section 2.1
- [x] Container diagram (C4 Level 2) -- Section 2.2
- [x] Architecture pattern documented and justified -- Section 1
- [x] All major components identified -- Section 5.1
- [x] Component responsibilities defined -- Section 5.1 function table

### Technology Stack
- [x] Runtime technology selected and justified -- Section 3.1 (Node.js CJS)
- [x] Dependencies selected and justified -- Section 3.2, 3.3 (zero new, common.cjs imports)
- [x] Evaluation criteria documented -- Section 3.4 (alternatives considered)

### Security Architecture
- [x] Threat model completed (STRIDE) -- Section 6.1
- [x] Data flow security analyzed -- Section 6.3
- [x] Security design decisions documented -- Section 6.2

### Integration Architecture
- [x] Phase-loop integration point defined -- Section 4.1 (step 3e-summary)
- [x] CLI interface contract specified -- Section 4.2
- [x] Output artifact locations defined -- Section 4.3

### Graceful Degradation
- [x] All failure modes enumerated -- Section 7.2 (8 scenarios)
- [x] Degradation strategy documented -- Section 7.1
- [x] Invariants defined -- Section 7.3

### Architecture Decision Records
- [x] ADR for architecture pattern (ADR-0001) -- Section 9
- [x] ADR for dependency strategy (ADR-0002) -- Section 9
- [x] ADR for degradation approach (ADR-0003) -- Section 9
- [x] ADR for state access (ADR-0004) -- Section 9
- [x] ADR for output format (ADR-0005) -- Section 9
- [x] ADR for integration point (ADR-0006) -- Section 9
- [x] All ADRs have status (Accepted) -- Confirmed

### NFR Coverage
- [x] Performance addressed (NFR-001) -- Section 11
- [x] Reliability addressed (NFR-002, NFR-003, NFR-004) -- Section 7
- [x] Schema stability addressed (NFR-005, NFR-006) -- Section 10
- [x] Cross-platform addressed (NFR-007) -- Section 8
- [x] CJS compliance addressed (NFR-008) -- Section 3.1, ADR-0002
- [x] Self-contained addressed (NFR-009) -- ADR-0002
- [x] Read-only state addressed (NFR-010) -- ADR-0004
- [x] Valid JSON output addressed (NFR-011) -- Section 10

**GATE-03 Result: PASS** -- All required architecture artifacts exist and are validated.

PHASE_TIMING_REPORT: { "debate_rounds_used": 0, "fan_out_chunks": 0 }
