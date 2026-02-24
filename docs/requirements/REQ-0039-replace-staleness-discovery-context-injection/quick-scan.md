# Quick Scan: Replace 24h staleness discovery context injection with project skills

**Generated**: 2026-02-24T21:25:00Z
**Feature**: Replace 24h staleness discovery context injection with project skills (#90)
**Phase**: 00-quick-scan

---

## Scope Estimate

**Estimated Scope**: Medium
**File Count Estimate**: ~11 files
**Confidence**: High

---

## Keyword Matches

### Primary Keywords
| Keyword | File Matches | Total References |
|---------|--------------|------------------|
| `discovery_context` | 11 files | 44 references |
| `DISCOVERY CONTEXT` | 5 files | 8 references |
| `24h` / `staleness` | 2 files | Multiple |

### Files by Category

**Core Command/Agent Files** (4 files):
- `src/claude/commands/isdlc.md` - 3 references (primary: STEP 3d injection block)
- `src/claude/agents/discover-orchestrator.md` - 10 references (envelope documentation)
- `src/claude/agents/00-sdlc-orchestrator.md` - 7 references (context passing)
- `src/claude/agents/01-requirements-analyst.md` - 3 references (context consumption)

**Secondary Agent Files** (2 files):
- `src/claude/agents/02-solution-architect.md` - 3 references (context consumption)
- `src/claude/agents/03-system-designer.md` - 3 references (context consumption)

**Hook/Infrastructure Files** (3 files):
- `src/claude/hooks/walkthrough-tracker.cjs` - 4 references (envelope writing)
- `src/claude/hooks/test-adequacy-blocker.cjs` - 2 references (envelope reading)
- `src/claude/hooks/tests/walkthrough-tracker.test.cjs` - 7 references (test fixtures)

**Command Files** (2 files):
- `src/claude/commands/discover.md` - 1 reference (envelope documentation)
- `src/claude/commands/tour.md` - 1 reference (envelope documentation)

---

## Impact Analysis

### Primary Edit Targets

1. **`src/claude/commands/isdlc.md`** (HIGH PRIORITY)
   - Line ~1566: Discovery context injection block ("Check if session context contains...")
   - Remove the fallback logic that reads `.isdlc/state.json` → `discovery_context`
   - Keep session cache check if needed for backward compatibility
   - **Action**: Remove STEP 3d discovery context injection block entirely

2. **`src/claude/agents/discover-orchestrator.md`** (HIGH PRIORITY)
   - Lines ~670-680: `discovery_context` envelope assembly
   - Lines ~1175-1195: Sequential mode envelope writing
   - Lines ~2539-2575: Walkthrough mode envelope writing
   - **Action**: Update documentation to reflect `discovery_context` is now audit-only metadata
   - Keep envelope writing for provenance, remove expiry semantics

### Secondary Updates (Documentation Clarification)

3. **Phase Agent Files** (00-sdlc-orchestrator, 01-requirements-analyst, 02-solution-architect, 03-system-designer)
   - References are primarily in context delegation sections
   - **Action**: Update to clarify that discovery context is passed via project skills, not legacy discovery_context block
   - No structural changes needed if already using updated SKILL INJECTION mechanism

4. **Hook Files** (walkthrough-tracker.cjs, test-adequacy-blocker.cjs)
   - Envelope writing/reading logic
   - **Action**: Keep envelope writing for audit purposes; remove any staleness checking logic
   - Verify tests still pass after removal

---

## Known Dependencies

**Blocks On**:
- REQ-0037 (project skills distillation) - DONE
- REQ-0038 (external manifest source field) - DONE
- REQ-0033 (skill index injection wiring) - DONE

**Enables**:
- Unified skill-based knowledge delivery across all workflow phases
- Removal of arbitrary 24h staleness logic
- Fail-open behavior for projects without project skills

---

## Fail-Open Strategy

**Backward Compatibility**: Existing projects without project skills will:
1. Not read `discovery_context` from state.json during phase delegation
2. Proceed normally without discovery context block injection
3. Receive project knowledge only through AVAILABLE SKILLS (if project has run discover)
4. No breakage - graceful degradation

---

## Questions for Requirements Phase

1. Should `discovery_context` field be completely removed from state.json or retained as audit metadata?
2. Do any hooks or reporting tools depend on reading `discovery_context.completed_at` for audit trails?
3. Should migration guide be added to CHANGELOG for operators running this update?

---

## Quick Scan Metadata

```json
{
  "scan_completed_at": "2026-02-24T21:25:00Z",
  "search_duration_ms": 8500,
  "keywords_searched": 6,
  "files_matched": 11,
  "scope_estimate": "medium",
  "file_count_estimate": 11,
  "confidence": "high",
  "search_keywords": [
    "discovery_context",
    "DISCOVERY CONTEXT",
    "24h",
    "staleness",
    "stale",
    "discovery context"
  ],
  "files_by_impact": {
    "high_priority": 2,
    "secondary": 4,
    "infrastructure": 5
  },
  "total_references": 44
}
```

---

## Scan Summary

This is a **Medium scope** refactoring that removes legacy discovery context injection logic in favor of project skills-based knowledge delivery. The changes are localized to:
- 1 primary command file (isdlc.md)
- 1 primary agent file (discover-orchestrator.md)
- 4 secondary agent files (for documentation updates)
- 5 infrastructure files (hooks/tests)

All changes are **removals or clarifications** — no new functionality is being added. The fail-open design ensures backward compatibility with existing projects.
