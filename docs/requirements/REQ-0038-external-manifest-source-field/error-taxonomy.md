# Error Taxonomy: REQ-0038 External Manifest Source Field

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-02-24
**Coverage**: Full

---

## 1. Error Codes

| Code | Description | Trigger Condition | Severity | Recovery Action |
|------|-------------|-------------------|----------|-----------------|
| ERR-REC-001 | Invalid source parameter | `reconcileSkillsBySource()` called with source other than "discover" or "skills.sh" | Warning | Return unchanged manifest, log warning |
| ERR-REC-002 | Invalid incomingSkills parameter | `incomingSkills` is not an array | Warning | Return unchanged manifest, log warning |
| ERR-REC-003 | Incoming skill missing name | An entry in `incomingSkills` has no `name` field | Warning | Skip entry, continue processing others |
| ERR-REC-004 | Manifest write failure | `writeExternalManifest()` fails after reconciliation | Error | Log error, report to user. Manifest in memory is correct but not persisted. Retry on next operation. |
| ERR-REC-005 | Cache rebuild failure | `node bin/rebuild-cache.js` exits non-zero after manifest write | Warning | Log warning, continue. Cache will be stale until next rebuild trigger. Existing behavior per isdlc.md. |
| ERR-REC-006 | Manifest load failure | `loadExternalManifest()` returns null (file missing or corrupt) | Info | Treat as empty manifest `{ version: "1.0.0", skills: [] }`. Normal for first run. |

---

## 2. Error Propagation Strategy

| Layer | Strategy | Rationale |
|-------|----------|-----------|
| `reconcileSkillsBySource()` | Return safe default (unchanged manifest) on invalid input | Pure function should never throw. Callers depend on a valid return. |
| `writeExternalManifest()` | Return `{ success: false, error: message }` | Existing pattern. Caller decides how to handle. |
| Cache rebuild | Log warning, continue | Existing pattern in isdlc.md. Cache staleness is non-fatal. |
| Discover orchestrator | Log warning, continue workflow | Fail-open pattern from REQ-0037. Skill distillation failure should not block discovery. |

---

## 3. Graceful Degradation

| Failure | What Still Works | What Degrades |
|---------|-----------------|---------------|
| Reconciliation returns unchanged (invalid input) | All existing skills remain, workflow continues | New/updated skills not applied until next valid run |
| Manifest write fails | In-memory state is correct, session cache has previous version | Skills not persisted. Next discover run will re-reconcile. |
| Cache rebuild fails | Manifest is persisted correctly | Session injection uses stale cache until next successful rebuild |
| Legacy manifest (no source field) | Read-time defaults applied, all features work | Source labels show as "user" for legacy entries until touched |

---

## 4. User-Facing Error Messages

| Condition | Message |
|-----------|---------|
| Cache rebuild failure | "Warning: Session cache rebuild failed. Skills are saved but may not appear in the next session until cache is rebuilt." |
| Manifest write failure | "Error: Could not save skill manifest. Your changes were not persisted. Please try again." |
| No skills distilled | "Project skills distillation: no skills produced for the phases that ran." (informational, not error) |
