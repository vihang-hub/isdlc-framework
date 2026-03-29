# Module Design: REQ-GH-116 — Protocol Delivery and Compliance

**Source**: GitHub Issue #116
**Status**: Accepted

---

## Module Overview

| Module | Type | Responsibility |
|--------|------|----------------|
| `protocol-mapping.json` | New config | Maps CLAUDE.md section headers to phases and checkable signals |
| PROTOCOL INJECTION (STEP 3d) | New step in isdlc.md | Extract and inject protocol + user content into delegation prompts |
| `checkProtocolCompliance()` (STEP 3e-post) | New step in isdlc.md | Detect violations of checkable protocols after phase execution |
| `3f-protocol-violation` | New handler in isdlc.md | Re-delegate on violation, escalate after 2 retries |

---

## Module Design

### protocol-mapping.json

**Location**: `src/claude/hooks/config/protocol-mapping.json`

```json
{
  "version": "1.0.0",
  "source_file": {
    "claude": "CLAUDE.md",
    "codex": "AGENTS.md"
  },
  "protocol_section_start": "## Agent Framework Context",
  "protocol_section_end": "## Project Context",
  "protocols": [
    { "header": "### SKILL OBSERVABILITY Protocol", "phases": ["all"], "checkable": false },
    { "header": "### SUGGESTED PROMPTS — Phase Agent Protocol", "phases": ["all"], "checkable": false },
    { "header": "### CONSTITUTIONAL PRINCIPLES Preamble", "phases": ["all"], "checkable": false },
    { "header": "### Root Resolution Protocol", "phases": ["all"], "checkable": false },
    { "header": "### Monorepo Mode Protocol", "phases": ["all"], "checkable": false },
    { "header": "### Mandatory Iteration Enforcement Protocol", "phases": ["05-test-strategy", "06-implementation", "07-testing", "16-quality-loop"], "checkable": false },
    { "header": "### Hook Block Auto-Recovery Protocol", "phases": ["all"], "checkable": false },
    { "header": "### Git Commit Prohibition", "phases": ["01-requirements", "02-impact-analysis", "02-tracing", "03-architecture", "04-design", "05-test-strategy", "06-implementation", "16-quality-loop"], "checkable": true, "check_signal": "git_commit_detected" },
    { "header": "### Single-Line Bash Convention", "phases": ["all"], "checkable": false },
    { "header": "### Tool Call Efficiency", "phases": ["all"], "checkable": false }
  ],
  "user_content_extraction": {
    "exclude_markers": ["<!-- SECTION:", "<!-- /SECTION:"],
    "exclude_range": { "start": "## Agent Framework Context", "end": "## Project Context" }
  }
}
```

### PROTOCOL INJECTION (STEP 3d)

**Location**: Inline in `src/claude/commands/isdlc.md`, Phase-Loop Controller STEP 3d — after SKILL INJECTION, before GATE REQUIREMENTS INJECTION

**Logic**:
1. Read `protocol-mapping.json` from `src/claude/hooks/config/`
2. Determine source file: `CLAUDE.md` (claude) or `AGENTS.md` (codex) from `source_file` config
3. Read the source file content
4. Extract protocol section (between `protocol_section_start` and `protocol_section_end`)
5. For each protocol in mapping where `phases` includes current `phaseKey` or `"all"`:
   - Extract text from the header line to the next `###` header or end of protocol section
6. Join extracted sections as `PROTOCOLS:` block
7. Extract user content: source file content NOT inside `<!-- SECTION: -->` markers AND NOT inside the protocol range
8. Join user content as `USER INSTRUCTIONS:` block
9. Append both blocks to delegation prompt

**Error handling**: Any failure → return empty strings, log warning, continue (fail-open)

### checkProtocolCompliance(phaseKey, timing, mappingConfig)

**Location**: Inline in `src/claude/commands/isdlc.md`, Phase-Loop Controller — new step between STEP 3e and STEP 3f

**Logic**:
1. Filter protocols where `checkable: true` AND phase matches
2. For each, run the check signal:

| Signal | Logic |
|--------|-------|
| `git_commit_detected` | `git log --after="{timing.started_at}" --before="{timing.completed_at}" --oneline` — non-empty output = violation |

3. Return violations array: `[{ protocol_header, check_signal, evidence }]`

**Error handling**: Check failure → skip that protocol, log warning, continue

### 3f-protocol-violation

**Location**: Inline in `src/claude/commands/isdlc.md`, Phase-Loop Controller STEP 3f

**Trigger**: `checkProtocolCompliance()` returns non-empty violations

**Logic**:
1. Check retry counter (`protocol-violation:{phase_key}`) per 3f-retry-protocol. Max 2.
2. Re-delegate to same phase agent with:
```
PROTOCOL VIOLATION DETECTED — Retry {N} of 2

Violated protocols:
{for each violation:
  - {protocol_header}: {evidence}
}

Remediate these violations before the phase can advance.
```
3. After re-delegation, re-run compliance check. If clean, proceed. If not, retry or escalate.
4. After 2 retries: escalate to user with Skip/Retry/Cancel.

---

## Changes to Existing

| File | Change | Reason |
|------|--------|--------|
| `src/claude/commands/isdlc.md` | Add PROTOCOL INJECTION step in STEP 3d | Protocol delivery to subagents |
| `src/claude/commands/isdlc.md` | Add compliance check between STEP 3e and 3f | Violation detection |
| `src/claude/commands/isdlc.md` | Add `3f-protocol-violation` handler | Violation response |

---

## Wiring Summary

### Claude Provider
| File | Change |
|------|--------|
| `src/claude/hooks/config/protocol-mapping.json` | CREATE — protocol-to-phase mapping |
| `src/claude/commands/isdlc.md` | MODIFY — protocol injection, compliance check, violation handler |

### Codex Provider
| File | Change |
|------|--------|
| `src/claude/hooks/config/protocol-mapping.json` | Same config — `source_file.codex` reads AGENTS.md |
| Codex phase-loop equivalent | MODIFY — same injection logic |

### Dogfooding
| File | Change |
|------|--------|
| `.claude/hooks/config/protocol-mapping.json` | CREATE — copy of src config |

### Shared / Provider-Neutral
| File | Change |
|------|--------|
| No shared files affected | Injection is provider-specific (different source files) |
