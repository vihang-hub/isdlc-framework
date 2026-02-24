# Error Taxonomy: Three-Verb Backlog Model (REQ-0023)

**Phase**: 04-design
**Feature**: Three-verb backlog model (add/analyze/build)
**Version**: 1.0.0
**Created**: 2026-02-18

---

## Error Code Format

All errors use the format: `ERR-{VERB}-{NNN}` where VERB is the action verb (ADD, ANALYZE, BUILD, RESOLVE, META, BACKLOG, HOOK) and NNN is a sequential number.

Errors are surfaced as user-facing text messages (not HTTP status codes -- this is a CLI tool). Each error includes: code, message, user-facing text, recovery action, and severity.

**Severity Levels**:
- **FATAL**: Operation cannot continue. User must take corrective action.
- **WARNING**: Operation continues with degraded behavior. User is informed.
- **INFO**: Informational message. No user action required.
- **SILENT**: Handled automatically with no user-visible output.

---

## 1. Add Verb Errors

| Code | Severity | Condition | User-Facing Message | Recovery Action | AC Trace |
|------|----------|-----------|---------------------|-----------------|----------|
| ERR-ADD-001 | WARNING | Slug directory already exists | "This item already has a folder at `docs/requirements/{slug}/`. Update it or choose a different name?" | Present: [U] Update draft, [R] Rename, [C] Cancel | AC-001-07 |
| ERR-ADD-002 | FATAL | BACKLOG.md cannot be created (permission error) | "Cannot create BACKLOG.md. Check directory permissions." | Verify file system permissions | AC-001-04 |
| ERR-ADD-003 | SILENT | state.json unreadable for counter peek | Automatic fallback: scan docs/requirements/ for highest REQ-NNNN | No user action -- fallback | AC-001-05 |
| ERR-ADD-004 | FATAL | Empty description provided | "Please provide a description for the backlog item." | Re-invoke with description | AC-001-01 |
| ERR-ADD-005 | SILENT | Git HEAD unavailable (codebase_hash) | Set codebase_hash to "unknown" | Automatic -- non-critical | - |
| ERR-ADD-006 | FATAL | Directory creation fails | "Cannot create `docs/requirements/{slug}/`. Check directory permissions." | Verify permissions | AC-001-01 |

---

## 2. Analyze Verb Errors

| Code | Severity | Condition | User-Facing Message | Recovery Action | AC Trace |
|------|----------|-----------|---------------------|-----------------|----------|
| ERR-ANALYZE-001 | WARNING | Item not found (no resolveItem match) | "No matching item found for '{input}'. Would you like to add it to the backlog first?" | If confirms: run `add`, continue. If declines: stop. | AC-002-08 |
| ERR-ANALYZE-002 | FATAL | meta.json corrupted (malformed JSON) | "Corrupted meta.json in `docs/requirements/{slug}/`. Cannot parse metadata." | Delete meta.json and re-run `add`, or fix JSON manually | AC-002-03 |
| ERR-ANALYZE-003 | INFO | Analysis complete, codebase unchanged | "Analysis is already complete and current for '{slug}'. Nothing to do." | Offer: [R] Re-analyze, [C] Cancel | AC-002-03 |
| ERR-ANALYZE-004 | WARNING | Codebase hash mismatch (staleness) | "Codebase has changed since analysis ({N} commits). Re-run analysis?" | Options: [R] Re-analyze from Phase 00, [C] Cancel | AC-002-09 |
| ERR-ANALYZE-005 | WARNING | Phase agent delegation fails | "Phase {NN} ({name}) failed. Error: {details}" | Retry the phase or skip | AC-002-01 |
| ERR-ANALYZE-006 | WARNING | meta.json write fails | "Cannot update meta.json in `docs/requirements/{slug}/`." | Check permissions; progress may be lost | AC-002-02 |
| ERR-ANALYZE-007 | INFO | Folder exists but no meta.json | "Found `docs/requirements/{slug}/` but no meta.json. Creating default metadata." | Automatic recovery: create default meta.json | AC-002-08 |

---

## 3. Build Verb Errors

| Code | Severity | Condition | User-Facing Message | Recovery Action | AC Trace |
|------|----------|-----------|---------------------|-----------------|----------|
| ERR-BUILD-001 | FATAL | Item not found (reference-type input) | "No prepared item found for '{input}'. Run add first." | `/isdlc add "{input}"` then retry build | AC-003-04 |
| ERR-BUILD-002 | FATAL | Active workflow exists | "A workflow is already active ({type}: {description}, Phase {NN}). Cancel first or continue existing." | `/isdlc cancel` then retry, or continue existing | AC-003-05 |
| ERR-BUILD-003 | FATAL | Constitution missing or template | "Project constitution not configured. Run `/discover` first." | Run `/discover` | AC-003-01 |
| ERR-BUILD-004 | FATAL | Orchestrator delegation fails | "Failed to initialize workflow: {error}" | Check state.json, verify constitution, retry | AC-003-01 |
| ERR-BUILD-005 | FATAL | Branch creation fails | "Cannot create branch `feature/REQ-{NNNN}-{slug}`. Check git status." | Clean working tree, resolve conflicts | AC-003-02 |
| ERR-BUILD-006 | WARNING | Item not found, description input | "No matching item found. Add to backlog and start building?" | If confirms: run `add` then `build`. If declines: stop. | AC-003-04 |

---

## 4. Item Resolution Errors

| Code | Severity | Condition | User-Facing Message | Recovery Action | AC Trace |
|------|----------|-----------|---------------------|-----------------|----------|
| ERR-RESOLVE-001 | FATAL | No match found (reference input) | "Cannot find item matching '{input}'." | Check BACKLOG.md or use a different reference | ADR-0015 |
| ERR-RESOLVE-002 | INFO | Multiple fuzzy matches | "Multiple items match '{input}'. Please select:" | Present numbered options | ADR-0015 |
| ERR-RESOLVE-003 | WARNING | BACKLOG.md unreadable | "Cannot read BACKLOG.md. Item number resolution unavailable." | Use slug or external ref instead | ADR-0015 |
| ERR-RESOLVE-004 | WARNING | meta.json scan fails | "Cannot scan meta.json files for external reference." | Use slug or item number instead | ADR-0015 |

---

## 5. meta.json Errors

| Code | Severity | Condition | User-Facing Message | Recovery Action | AC Trace |
|------|----------|-----------|---------------------|-----------------|----------|
| ERR-META-001 | SILENT | meta.json missing (expected) | Handled by caller | Caller creates default or reports | AC-009-04 |
| ERR-META-002 | FATAL | Malformed JSON | "Corrupted meta.json in `{path}`." | Delete and recreate, or fix manually | AC-009-03 |
| ERR-META-003 | SILENT | Legacy migration applied | Log: "Legacy meta.json detected, applying migration." | Automatic | AC-009-03, AC-009-04 |
| ERR-META-004 | WARNING | Write failure | "Cannot write meta.json to `{path}`." | Check permissions | AC-009-01 |

---

## 6. BACKLOG.md Marker Errors

| Code | Severity | Condition | User-Facing Message | Recovery Action | AC Trace |
|------|----------|-----------|---------------------|-----------------|----------|
| ERR-BACKLOG-001 | SILENT | BACKLOG.md missing during update | No marker to update | Non-blocking | AC-007-01 |
| ERR-BACKLOG-002 | SILENT | Item not found in BACKLOG (update) | Marker update skipped | meta.json is source of truth | AC-007-02 |
| ERR-BACKLOG-003 | SILENT | Unexpected marker character | Treat as raw `[ ]` | BACKLOG may be hand-edited | AC-007-05 |
| ERR-BACKLOG-004 | WARNING | Write failure | "Cannot update BACKLOG.md markers." | Check permissions | AC-007-02 |

---

## 7. Hook Enforcement Errors

| Code | Severity | Condition | Behavior | AC Trace |
|------|----------|-----------|----------|----------|
| ERR-HOOK-001 | SILENT | Unknown action in EXEMPT_ACTIONS check | Fail-open: allow through (Article X) | AC-008-01 |
| ERR-HOOK-002 | SILENT | Action regex parse fails | Fail-open: treat as non-exempt, require delegation | AC-008-02 |
| ERR-HOOK-003 | SILENT | state.json unavailable | Fail-open: skip enforcement | AC-008-03 |

---

## 8. Error Handling Principles

1. **File paths in errors**: Every file-related error includes the relative path to the affected file.
2. **Actionable recovery**: Every FATAL/WARNING error provides a specific command or action.
3. **Graceful degradation**: BACKLOG marker updates, codebase hash, and meta.json migrations fail silently (SILENT severity).
4. **Hooks fail-open**: Per Article X, all hook errors exit 0 with no output.
5. **No cascading failures**: A utility function failure (e.g., marker update) does not prevent the primary operation (e.g., meta.json write).
6. **Error messages never expose internal state**: No state.json content, no full stack traces in user messages.

---

## 9. Error-to-Requirement Traceability

| Error Code | Requirement | Acceptance Criteria |
|-----------|------------|---------------------|
| ERR-ADD-001 | FR-001 | AC-001-07 |
| ERR-ADD-004 | FR-001 | AC-001-01 |
| ERR-ANALYZE-001 | FR-002 | AC-002-08 |
| ERR-ANALYZE-003 | FR-002 | AC-002-03 |
| ERR-ANALYZE-004 | FR-002 | AC-002-09 |
| ERR-BUILD-001 | FR-003 | AC-003-04 |
| ERR-BUILD-002 | FR-003 | AC-003-05 |
| ERR-BUILD-003 | FR-003 | AC-003-01 |
| ERR-META-002 | FR-009 | AC-009-03, AC-009-04 |
| ERR-META-003 | FR-009 | AC-009-03, AC-009-04 |
| ERR-RESOLVE-002 | ADR-0015 | - |
| ERR-HOOK-001..003 | FR-008 | AC-008-01..03 |
