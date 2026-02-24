# Security Architecture: REQ-0023 Three-Verb Backlog Model

**Phase**: 03-architecture
**Created**: 2026-02-18
**Author**: Solution Architect (Agent 03)
**Traces**: FR-001 through FR-009, NFR-002, Articles III, X, XIV

---

## 1. Security Context

This feature operates entirely on the local filesystem with no network components, no authentication flows, and no user-facing APIs. The security architecture focuses on:

1. **State integrity** -- preventing add/analyze from corrupting workflow state
2. **Input validation** -- sanitizing user descriptions used as file paths (slug generation)
3. **Hook enforcement** -- ensuring the delegation enforcement chain works correctly with new exempt actions
4. **Fail-safe defaults** -- ensuring errors in new code paths do not block the developer

---

## 2. Threat Model (STRIDE)

### 2.1 Spoofing

| Threat | Applicability | Mitigation |
|--------|--------------|------------|
| Malicious user spoofs slash commands | N/A -- single-user CLI tool | No mitigation needed; user is the operator |
| Spoofed meta.json with false analysis_status | LOW -- user can edit local files | Derive status from phases_completed at read time; never trust analysis_status alone |

### 2.2 Tampering

| Threat | Applicability | Mitigation |
|--------|--------------|------------|
| `add` verb tampers with state.json | MEDIUM -- coding error | Design constraint: add handler MUST NOT call writeState() or any state.json write function. Code review enforces this. NFR-002. |
| `analyze` verb tampers with state.json | MEDIUM -- coding error | Same as above. Analyze handler MUST NOT modify state.json. |
| Malformed slug creates directory traversal | MEDIUM -- user input | Slug sanitization: strip non-alphanumeric chars, enforce `^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$` pattern, reject paths containing `..` or `/` |
| BACKLOG.md marker update corrupts file | LOW -- regex replacement | Line-by-line replacement preserves all other content. Regex is anchored to specific item numbers. |

### 2.3 Repudiation

| Threat | Applicability | Mitigation |
|--------|--------------|------------|
| Analysis phases run without tracking | LOW | phases_completed is append-only; each phase appends before offering the next |
| meta.json timestamp manipulation | N/A -- local tool | No audit trail needed for local developer tooling |

### 2.4 Information Disclosure

| Threat | Applicability | Mitigation |
|--------|--------------|------------|
| Secrets in draft.md | LOW -- user-provided content | Framework does not inspect content for secrets. User responsibility. |
| State.json exposed via add/analyze | N/A | add/analyze do not read sensitive fields; only peek at counter |

### 2.5 Denial of Service

| Threat | Applicability | Mitigation |
|--------|--------------|------------|
| Infinite loop in analyze phase sequencing | LOW -- bounded at 5 phases | Analysis sequence is finite (exactly 5 phases: 00-04). Loop terminates when phases_completed includes all 5. |
| Hook false-block prevents developer work | MEDIUM -- EXEMPT_ACTIONS change | `add` and `analyze` are in EXEMPT_ACTIONS; hooks skip enforcement for these actions. If EXEMPT_ACTIONS is wrong, hooks fail-open (Article X). |
| BACKLOG.md parsing hangs on large file | LOW | Line-by-line O(n) parsing with no backtracking regex. Performance target: < 5s even for very large files. |

### 2.6 Elevation of Privilege

| Threat | Applicability | Mitigation |
|--------|--------------|------------|
| `analyze` escapes to create a workflow | MEDIUM -- coding error | Design constraint: analyze handler MUST NOT set active_workflow. Hook enforcement (delegation-gate) auto-clears analyze markers. |
| `add` increments the counter | LOW -- coding error | Design constraint: add reads counters.next_req_id but MUST NOT increment. Build verb (via orchestrator) increments. |

---

## 3. Input Validation

### 3.1 Slug Generation (add verb)

**Input**: User-provided description string
**Risk**: Directory traversal, filesystem-unsafe characters

**Sanitization Algorithm**:
```javascript
function generateSlug(description) {
    let slug = description
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')  // Remove non-alphanumeric
        .replace(/\s+/g, '-')           // Spaces to hyphens
        .replace(/-+/g, '-')            // Collapse multiple hyphens
        .replace(/^-|-$/g, '');          // Trim leading/trailing hyphens

    // Enforce max length
    if (slug.length > 50) {
        slug = slug.substring(0, 50).replace(/-$/, '');
    }

    // Reject dangerous patterns
    if (slug.includes('..') || slug.includes('/') || slug.includes('\\')) {
        throw new Error('Invalid slug: path traversal detected');
    }

    // Ensure non-empty
    if (slug.length === 0) {
        throw new Error('Invalid slug: empty after sanitization');
    }

    return slug;
}
```

### 3.2 External Reference Parsing

**Input**: User-provided reference string (e.g., "#42", "JIRA-1250")
**Risk**: Injection into source_id field of meta.json

**Validation**:
```javascript
function parseExternalRef(input) {
    // GitHub issue: #N or GH-N
    const ghMatch = input.match(/^#?(\d+)$/);
    if (ghMatch) return { source: 'github', source_id: `GH-${ghMatch[1]}` };

    // Jira ticket: PROJECT-N
    const jiraMatch = input.match(/^([A-Z]+-\d+)$/i);
    if (jiraMatch) return { source: 'jira', source_id: jiraMatch[1].toUpperCase() };

    // Default: manual
    return { source: 'manual', source_id: null };
}
```

### 3.3 BACKLOG.md Item Number

**Input**: User-provided item reference (e.g., "3.2")
**Risk**: Regex injection, wrong item matched

**Validation**: Exact match against parsed BACKLOG items. No regex constructed from user input.

---

## 4. Hook Security

### 4.1 EXEMPT_ACTIONS Update

**Current**: `EXEMPT_ACTIONS = new Set(['analyze'])`
**New**: `EXEMPT_ACTIONS = new Set(['add', 'analyze'])`

**Security Analysis**:

| Action | Exempt? | Rationale |
|--------|---------|-----------|
| `add` | YES | Runs inline, no orchestrator needed, no state.json writes. Exempting prevents false delegation blocks. |
| `analyze` | YES | Runs inline (same as current Phase A carve-out). No orchestrator needed. |
| `build` | **NO** | Creates workflows, writes state.json, creates branches. MUST go through orchestrator delegation. |
| `feature` | **NO** | Alias for build. Same requirements. |
| `fix` | **NO** | Creates workflows. Same requirements. |

**Invariant**: Only actions that run inline without workflow creation are exempt. Any action that writes to `state.json.active_workflow` MUST NOT be exempt.

### 4.2 Defense-in-Depth (delegation-gate.cjs)

The delegation-gate provides a second layer of enforcement:
- If `pending_delegation` marker exists for an exempt action, auto-clear without blocking
- If `pending_delegation` marker exists for a non-exempt action (build, feature, fix), verify delegation occurred
- This two-layer approach (enforcer writes marker, gate verifies) continues to work with the expanded EXEMPT_ACTIONS set

### 4.3 Fail-Open Behavior (Article X)

All hooks maintain fail-open behavior:
- If EXEMPT_ACTIONS check throws an error, exit 0 (allow)
- If meta.json is unreadable, treat as "raw" (safe default)
- If BACKLOG.md is missing, create it (safe default)
- If state.json is corrupt, skip enforcement (safe default)

---

## 5. Data Protection

### 5.1 State.json Write Protection (NFR-002)

**Enforcement layers**:

1. **Architectural constraint**: The `add` and `analyze` handlers in isdlc.md are defined as inline actions. They do not call the orchestrator, which is the only component that writes to state.json.

2. **Hook enforcement**: `skill-delegation-enforcer` does not write `pending_delegation` for exempt actions (`add`, `analyze`). Without the marker, `delegation-gate` has nothing to enforce.

3. **Code review**: FR-008 AC-008-01/AC-008-02 require verification that add/analyze do not write state.json.

4. **Testing**: Integration test verifies state.json checksum before/after add and analyze operations.

### 5.2 meta.json Integrity

- meta.json is written atomically (full JSON.stringify, then writeFileSync)
- phases_completed is append-only (never remove entries)
- analysis_status is derived from phases_completed (computed, not independent)
- codebase_hash is updated at creation and after each analysis phase

### 5.3 BACKLOG.md Integrity

- Line-level updates (only the specific item line changes)
- Full file read -> modify -> write (atomic replacement)
- Regex is anchored and captures the full line structure
- Backup: Git provides version history

---

## 6. Secrets Management

No secrets are introduced by this feature. No API keys, tokens, or credentials are involved.

| Secret Type | Presence | Notes |
|-------------|----------|-------|
| API keys | None | External MCP integration (Jira/GitHub) deferred to future item |
| Tokens | None | No authentication flows |
| Credentials | None | Local file operations only |
| PII | None | Backlog items contain developer-written descriptions, not user PII |

---

## 7. Compliance Requirements

No compliance requirements (GDPR, HIPAA, PCI-DSS) apply to this feature. The framework is a local developer tool with no user data, no network services, and no data storage beyond the local filesystem.

---

## 8. Security Review Checklist

| Check | Status | Notes |
|-------|--------|-------|
| add verb cannot write to state.json | DESIGNED | Architectural constraint: inline handler, no orchestrator call |
| analyze verb cannot write to state.json | DESIGNED | Same as above |
| Slug generation prevents path traversal | DESIGNED | Sanitization strips `..`, `/`, `\`, enforces pattern |
| EXEMPT_ACTIONS does not include build | DESIGNED | Only add and analyze are exempt |
| Hook fail-open preserved | DESIGNED | All hooks exit 0 on error |
| meta.json read-time migration handles all edge cases | DESIGNED | Defensive defaults for missing/malformed fields |
| BACKLOG.md marker update does not corrupt file | DESIGNED | Line-level replacement, anchored regex |
| No new secrets introduced | CONFIRMED | Zero secrets in this feature |
