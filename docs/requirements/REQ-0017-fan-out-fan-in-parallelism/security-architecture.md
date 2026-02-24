# Security Architecture: Fan-Out/Fan-In Parallelism

**REQ ID**: REQ-0017
**Phase**: 03-architecture
**Created**: 2026-02-15
**Author**: Solution Architect (Agent 03)

---

## 1. Overview

The fan-out/fan-in parallelism feature operates entirely within a single Claude Code session on the developer's local machine. There are no network boundaries, no authentication flows, no multi-tenant concerns, and no external service integrations. The security architecture focuses on:

1. **State Integrity**: Preventing concurrent state.json corruption from parallel agents
2. **Fail-Safe Defaults**: Ensuring the system degrades gracefully on error
3. **Input Validation**: Validating configuration values before use
4. **Isolation**: Ensuring chunk agents do not interfere with each other
5. **Information Leakage Prevention**: Ensuring error messages do not expose sensitive data

---

## 2. Threat Model (STRIDE Analysis)

### 2.1 Scope

The threat model covers the fan-out engine components only. The existing iSDLC threat model covers the broader framework (hooks, state management, CLI). This analysis identifies threats specific to parallel agent execution.

### 2.2 STRIDE Analysis

| Threat | Category | Description | Likelihood | Impact | Mitigation |
|--------|----------|-------------|-----------|--------|------------|
| T-001 | Tampering | Parallel chunk agents write conflicting data to state.json simultaneously | Medium | High | Chunk agents MUST NOT write to state.json. Only the parent phase agent (orchestrator) writes merged results after all chunks complete. |
| T-002 | Denial of Service | A chunk agent enters an infinite loop, consuming resources and blocking the fan-out completion | Low | Medium | Timeout per chunk (default: 10 minutes). Timed-out chunks are marked as failed; remaining chunks are collected. |
| T-003 | Information Disclosure | A chunk agent's error message includes sensitive file contents or environment variables | Low | Low | Error messages from chunk agents are truncated to 500 characters in the merged failure report. No raw file contents in error messages. |
| T-004 | Tampering | A chunk agent modifies files outside its assigned chunk scope (e.g., reviewing files not in its chunk) | Low | Low | Each chunk agent's prompt includes ONLY its assigned files/tests. The agent has no instruction to access other chunks' files. This is prompt-level isolation, not runtime enforcement. |
| T-005 | Denial of Service | Fan-out configuration is set to unreasonable values (max_agents=1000, timeout=0) | Low | Medium | Configuration validation at read-time: max_agents capped at 8, timeout minimum 60000ms. Invalid values replaced with defaults. |
| T-006 | Tampering | A malicious state.json configuration disables fan-out for specific phases to degrade performance | Low | Low | Not a security concern -- state.json is local and under developer control. Disabling fan-out degrades performance but does not compromise security. |
| T-007 | Elevation of Privilege | Chunk agents could theoretically execute arbitrary code via the Task tool | Low | Low | The Task tool is sandboxed by Claude Code. Chunk agents operate within the same sandbox as the parent agent. No privilege escalation is possible. |

### 2.3 Risk Summary

| Risk Level | Count | Threats |
|-----------|-------|---------|
| High | 0 | - |
| Medium | 2 | T-001 (state corruption), T-002 (infinite loop) |
| Low | 5 | T-003, T-004, T-005, T-006, T-007 |

The overall security risk of the fan-out feature is **LOW**. The primary concern (T-001: state corruption) is mitigated architecturally by ensuring chunk agents never write to state.json.

---

## 3. State Integrity: Concurrent Write Prevention

### 3.1 Architecture Decision

**Chunk agents MUST NOT write to state.json.**

Only the parent phase agent (the Quality Loop Engineer or QA Engineer) writes to state.json, and only AFTER all chunk results have been collected and merged. This eliminates the possibility of concurrent writes.

### 3.2 Write Sequence

```
Time -->

Chunk Agent 0: [read state.json] ---> [run tests] ---> [return JSON result to parent]
Chunk Agent 1: [read state.json] ---> [run tests] ---> [return JSON result to parent]
Chunk Agent 2: [read state.json] ---> [run tests] ---> [return JSON result to parent]

                                                        All chunks complete
                                                              |
                                                              v
Parent Agent:                                         [Merge results]
                                                              |
                                                              v
                                                     [Write state.json]
                                                       (single writer)
```

### 3.3 Chunk Agent Constraints

Each chunk agent prompt includes:
- `DO NOT write to .isdlc/state.json`
- `DO NOT run git add, git commit, or git push`
- `Return your results as a JSON object in your response`

These constraints are enforced at the prompt level (instruction-based), consistent with how the existing Track A/B dual-track model prevents sub-agents from writing state.

### 3.4 State Read Safety

Chunk agents MAY read state.json to understand workflow context (artifact folder, phase, constitutional requirements). Read operations are safe because:
- JSON file reads are atomic (the file is small enough to be read in a single operation)
- The parent agent does not modify state.json while chunks are running
- Chunks only need static configuration (fan_out section, active_workflow metadata)

---

## 4. Fail-Safe Defaults (Article X)

### 4.1 Configuration Fail-Safes

| Scenario | Default Behavior |
|----------|-----------------|
| `fan_out` section missing from state.json | Fan-out enabled with all defaults |
| `fan_out.enabled` is not a boolean | Treat as `true` (enabled) |
| `max_agents` > 8 or < 1 | Clamp to 8 or 1 respectively |
| `timeout_per_chunk_ms` < 60000 | Use 60000ms (1 minute minimum) |
| `strategy` is unrecognized value | Use phase-specific default (round-robin for tests, group-by-directory for files) |
| `tests_per_agent` or `files_per_agent` < 1 | Use default (250 or 7) |
| `--no-fan-out` flag set | Fan-out disabled; single-agent execution |

### 4.2 Execution Fail-Safes

| Scenario | Default Behavior |
|----------|-----------------|
| Chunk splitter produces 0 chunks | Use single-agent path (no fan-out) |
| 1 of N agents fails | Collect N-1 results; report degraded |
| All N agents fail | Report phase failure; enter iteration loop |
| Chunk agent exceeds timeout | Mark as timed out; collect available results |
| Result merger encounters invalid chunk result | Skip invalid result; report as degraded; log warning |
| Coverage data missing from a chunk | Exclude that chunk from coverage aggregation; report partial coverage |

### 4.3 Deny by Default

- Fan-out does NOT run for below-threshold workloads (< 250 tests, < 5 files). This prevents unnecessary overhead for small projects.
- Chunk agents have NO write permissions to state.json or git operations.
- Configuration values have hard caps (max_agents = 8) that cannot be overridden.

---

## 5. Input Validation

### 5.1 Configuration Validation

When the phase agent reads the `fan_out` section from state.json:

```
1. IF typeof fan_out !== 'object': ignore, use defaults
2. IF typeof fan_out.enabled !== 'boolean': log warning, use true
3. IF typeof fan_out.defaults.max_agents !== 'number' OR max_agents < 1 OR max_agents > 8: clamp to [1, 8]
4. IF typeof fan_out.defaults.timeout_per_chunk_ms !== 'number' OR timeout < 60000: use 600000
5. FOR each phase_overrides[key]:
     IF strategy not in ['round-robin', 'group-by-directory']: use phase default
     IF tests_per_agent < 1: use 250
     IF files_per_agent < 1: use 7
     IF min_tests_threshold < 1: use 250
     IF min_files_threshold < 1: use 5
```

### 5.2 Work Item Validation

Before chunk splitting:

```
1. IF items is not an array: abort fan-out, use single-agent path
2. IF items.length == 0: abort fan-out, report empty work list
3. IF any item is not a string: filter non-strings, log warning
4. Remove duplicate items (dedup by string equality)
5. Sort items alphabetically (determinism)
```

### 5.3 Chunk Result Validation

When collecting chunk results:

```
1. IF result is null or undefined: mark chunk as failed
2. IF result.chunk_index does not match expected index: log warning, use expected index
3. IF result.status is not 'completed' or 'failed': treat as 'failed'
4. IF result.test_results is null AND status == 'completed': log warning, mark as degraded
5. IF result.elapsed_ms is not a number: set to -1 (unknown)
```

---

## 6. Isolation Model

### 6.1 Prompt-Level Isolation

Each chunk agent receives a scoped prompt that includes ONLY:
- Its chunk index and assigned items
- The phase context (artifact folder, phase key, constitutional requirements)
- The return format specification
- Explicit constraints (no state.json writes, no git operations)

Chunk agents do not receive:
- Other chunks' item lists
- Other chunks' results
- The full work item list
- Fan-out configuration (they do not need to know about fan-out)

### 6.2 File System Isolation

Chunk agents CAN read any file on disk (this is inherent to Claude Code). However:
- Test chunk agents only run tests in their assigned list
- Review chunk agents only review files in their assigned list
- This is enforced by the prompt instructions, not by filesystem permissions

### 6.3 No Shared Mutable State

- Chunk agents do not share any mutable state
- Each agent returns its result as a JSON object in its Task response
- Results are collected by the parent agent after all Tasks complete
- The parent agent is the single point of merge and state write

---

## 7. Compliance Mapping

### Article III: Security by Design

| Requirement | How Addressed |
|-------------|--------------|
| No secrets in code | Fan-out engine is markdown protocol -- no code, no secrets |
| All inputs validated | Configuration validation (Section 5.1), work item validation (Section 5.2) |
| All outputs sanitized | Error messages truncated (T-003 mitigation) |
| Dependencies scanned | No new dependencies introduced |
| Least privilege | Chunk agents have no write permissions to state.json |

### Article X: Fail-Safe Defaults

| Requirement | How Addressed |
|-------------|--------------|
| Deny by default | Below-threshold workloads skip fan-out; chunk agents have no write permissions |
| Validate all inputs | Configuration and work item validation at read-time |
| Fail securely | Partial failure collects N-1 results; invalid config uses defaults |
| Least privilege | Chunk agents are read-only; parent agent is single writer |
| Failures leave system in safe state | Failed fan-out falls back to single-agent execution; state.json is not corrupted |

---

## 8. Secret Management

Not applicable. The fan-out feature does not handle secrets, credentials, or sensitive data. Configuration is stored in the local `.isdlc/state.json` file which is already gitignored. Chunk agents do not access API keys, tokens, or credentials beyond what the parent Claude Code session already has access to.

---

## 9. Authentication and Authorization

Not applicable. The fan-out feature operates within a single Claude Code session. There are no network boundaries, no multi-user access, and no API endpoints. All chunk agents run with the same permissions as the parent agent.

---

## 10. Encryption

Not applicable. All data is local to the developer's machine. There is no data at rest that requires encryption beyond the operating system's filesystem encryption, and no data in transit (no network communication between agents).
