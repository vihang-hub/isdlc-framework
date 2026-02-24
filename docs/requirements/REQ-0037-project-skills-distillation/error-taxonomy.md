# Error Taxonomy: Project Skills Distillation

**Status**: Draft
**Confidence**: High
**Last Updated**: 2026-02-24
**Coverage**: 90%
**Source**: GitHub #88
**Slug**: REQ-0037-project-skills-distillation

---

## Error Handling Philosophy

All errors in the distillation step follow **fail-open** semantics. No error prevents the discovery workflow from continuing. Errors are logged as warnings, and the distillation step produces whatever it can.

---

## Error Taxonomy

| Code | Description | Trigger Condition | Severity | Recovery Action |
|------|-------------|-------------------|----------|-----------------|
| DIST-001 | Manifest read failure | `loadExternalManifest()` returns null or throws | Warning | Proceed with empty manifest; all skills treated as new |
| DIST-002 | Source artifact not found | Source file for a skill does not exist on disk | Warning | Skip this skill; continue with remaining skills |
| DIST-003 | Source artifact unreadable | Source file exists but cannot be read (permissions, encoding) | Warning | Skip this skill; continue with remaining skills |
| DIST-004 | Distillation output exceeds limit | LLM-produced skill content exceeds 5,000 characters | Warning | Truncate or re-prompt with stricter constraint; if still over, skip skill |
| DIST-005 | Skill file write failure | Cannot write to `.claude/skills/external/` (permissions, disk) | Warning | Skip this skill; continue with remaining skills |
| DIST-006 | Skill file delete failure | Cannot delete old discover-sourced skill file during cleanup | Warning | Log and continue; old file may remain but manifest entry is removed |
| DIST-007 | Manifest write failure | `writeExternalManifest()` returns `{ success: false }` | Warning | Log warning; skill files exist on disk but manifest is stale |
| DIST-008 | Cache rebuild failure | `rebuildSessionCache()` throws or fails | Warning | Log warning; skills and manifest are valid but cache is stale until next rebuild |
| DIST-009 | External skills directory missing | `.claude/skills/external/` does not exist | Warning | Create directory; if creation fails, skip all skill writes |

---

## Error Propagation Strategy

```
Distillation Step
    │
    ├── DIST-001 (manifest read) ──→ Log warning, use empty manifest, CONTINUE
    │
    ├── For each source phase:
    │     ├── DIST-006 (delete old) ──→ Log warning, CONTINUE to distillation
    │     ├── DIST-002/003 (read source) ──→ Log warning, SKIP this skill
    │     ├── DIST-004 (size exceeded) ──→ Attempt truncation, if fails SKIP
    │     ├── DIST-005 (write skill) ──→ Log warning, SKIP this skill
    │     └── DIST-009 (dir missing) ──→ Attempt mkdir, if fails SKIP all writes
    │
    ├── DIST-007 (manifest write) ──→ Log warning, CONTINUE to cache rebuild
    │
    ├── DIST-008 (cache rebuild) ──→ Log warning, CONTINUE
    │
    └── Discovery workflow CONTINUES regardless of any errors above
```

### Key Principle

No error in the distillation step ever propagates to the parent discovery workflow as a failure. The distillation step always "succeeds" from the orchestrator's perspective -- it just may produce fewer skills than expected.

---

## Graceful Degradation Levels

| Level | Condition | Effect | User Impact |
|-------|-----------|--------|-------------|
| Full success | All 4 skills distilled, manifest updated, cache rebuilt | All agents see all 4 project skills in every session | None (ideal state) |
| Partial distillation | 1-3 skills distilled, others skipped | Agents see available skills; missing knowledge gaps | Minor -- agents lack some project context |
| No distillation | All 4 skills failed | No project skills in cache | Agents have no distilled project knowledge (same as before this feature) |
| Manifest failure | Skills written but manifest not updated | Skills exist on disk but cache builder can't find them | Skills invisible until manifest is manually fixed or next discovery run |
| Cache failure | Skills + manifest OK but cache not rebuilt | Skills registered but not in session cache until next `rebuildSessionCache()` call | Skills available next time cache is rebuilt (e.g., next discovery or manual rebuild) |

---

## Pending Sections

None -- all sections complete.
