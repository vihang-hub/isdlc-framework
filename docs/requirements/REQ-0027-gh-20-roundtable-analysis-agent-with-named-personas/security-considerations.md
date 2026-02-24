# Security Considerations: Roundtable Analysis Agent

**Feature ID**: REQ-ROUNDTABLE-ANALYST (GH-20)
**Phase**: 03-architecture
**Date**: 2026-02-19
**Constitutional Reference**: Article III (Security by Design), Article X (Fail-Safe Defaults)

---

## 1. Threat Model Summary

This feature has a **minimal threat surface** because it introduces no new trust boundaries, no network communication, no external service integration, and no authentication/authorization changes. All data flows are local file I/O within the user's filesystem.

---

## 2. Trust Boundaries

```
+----------------------------------------------------------+
|  User's local machine (single trust boundary)            |
|                                                          |
|  +--------------+   +------------------+   +-----------+ |
|  | isdlc.md     |-->| roundtable-      |-->| Step      | |
|  | (CLI handler)|   | analyst.md       |   | Files     | |
|  +--------------+   | (agent)          |   | (read-    | |
|                     +------------------+   | only)     | |
|                            |               +-----------+ |
|                            v                              |
|                     +------------------+                  |
|                     | meta.json        |                  |
|                     | (read/write)     |                  |
|                     +------------------+                  |
|                            |                              |
|                            v                              |
|                     +------------------+                  |
|                     | Artifact files   |                  |
|                     | (write)          |                  |
|                     +------------------+                  |
+----------------------------------------------------------+
```

**No cross-boundary data flows**. The roundtable agent operates entirely within the user's local filesystem with the user's own permissions.

---

## 3. STRIDE Analysis

| Threat | Applicability | Assessment |
|--------|--------------|------------|
| **S**poofing | N/A | No authentication involved. The agent is invoked by the local CLI. |
| **T**ampering | LOW | Step files could be tampered with if an attacker has filesystem access -- but if they have filesystem access, they already control the machine. No additional risk from this feature. |
| **R**epudiation | N/A | No audit trail is required for local analysis sessions. meta.json provides sufficient traceability for development purposes. |
| **I**nformation Disclosure | LOW | Artifact files may contain business domain information from user conversations. These files are already in local-only directories (docs/ is gitignored per existing conventions). No new disclosure risk. |
| **D**enial of Service | LOW | A malformed step file could cause the agent to fail on that step. Mitigation: skip malformed steps and log a warning. The system does not crash -- it degrades gracefully. |
| **E**levation of Privilege | N/A | The agent runs with the same permissions as the user's Claude Code process. No privilege escalation path exists. |

---

## 4. Data Flow Security

### 4.1 User Input Handling

User responses during interactive analysis are processed by the LLM (Claude) and used to update artifact files. There is no SQL injection, XSS, or command injection risk because:
- No database is involved
- No web rendering of user input
- Bash commands within step files follow the single-line convention (CON-004) and are part of the static step file content, not dynamically generated from user input

### 4.2 File Path Safety

The roundtable agent reads step files from a known directory (`src/claude/skills/analysis-steps/{phase_key}/`). The `phase_key` values are constrained to the ANALYSIS_PHASES constant. There is no path traversal risk because:
- Phase keys are validated against a fixed allowlist
- Step file discovery uses directory listing, not user-provided paths
- Artifact writes target a known artifact folder path provided by the isdlc.md handler

### 4.3 meta.json Integrity

meta.json is the only persistent state the roundtable agent modifies. Integrity is maintained by:
- Using `writeMetaJson()` which enforces schema consistency (derives analysis_status from phases_completed)
- Atomic writes via `fs.writeFileSync()` (not streaming)
- No concurrent access: only one analyze session runs at a time per item

---

## 5. Fail-Safe Defaults (Article X)

| Scenario | Default Behavior |
|----------|-----------------|
| Roundtable agent file missing | Fall back to existing phase agents (FR-009 AC-009-04) |
| Step file has invalid YAML frontmatter | Skip that step, log warning, continue to next |
| Step file directory is empty | Phase completes with no steps (no-op, phase still marked complete) |
| meta.json corrupt or missing | readMetaJson() returns null; handler creates fresh default |
| Unknown phase key in mapping | Fall back to Business Analyst persona (FR-003 AC-003-06) |
| No quick-scan output for depth | Default to "standard" depth (FR-006 AC-006-07) |
| steps_completed field missing | Default to empty array (start from beginning) |
| depth_overrides field missing | Default to empty object (no overrides) |
| User provides no menu selection | Treat as natural language input (FR-007 AC-007-04) |

---

## 6. Constraint Enforcement

### CON-003: No State.json Writes

The roundtable agent is explicitly prohibited from writing to `.isdlc/state.json`. This is enforced at the prompt level (ANALYSIS MODE instructions) and structurally by the fact that the agent has no reference to state.json in its instructions. The `state-file-guard` hook provides runtime enforcement as a safety net.

### Blast Radius Containment

The roundtable agent can only modify files in:
1. The artifact folder (`docs/requirements/{slug}/`) -- meta.json and artifact files
2. Common docs (`docs/common/`) -- only for NFR matrix

It cannot modify:
- `.isdlc/state.json` (CON-003)
- `src/` files (read-only during analysis)
- Other items' artifact folders (scoped by slug in delegation prompt)
- Git branches or commits (ANALYSIS MODE constraint)

---

## 7. Risk Summary

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Step file tampering | LOW | VERY LOW | Requires filesystem access (attacker already owns machine) |
| Persona context bleed | MEDIUM | LOW | Task tool isolation (separate invocation per phase) |
| meta.json corruption | LOW | LOW | Atomic writes, defensive defaults on read |
| Path traversal | LOW | VERY LOW | Fixed allowlist of phase keys, no user-provided paths |

**Overall security posture**: This feature does not change the security posture of the iSDLC framework. All new components operate within existing trust boundaries using existing access patterns.

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-19 | Solution Architect (Phase 03) | Initial security analysis |
