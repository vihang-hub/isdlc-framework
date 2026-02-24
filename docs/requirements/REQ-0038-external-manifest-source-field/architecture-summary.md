# Architecture Summary: REQ-0038 External Manifest Source Field

**Accepted**: 2026-02-24
**Domain**: Architecture
**Owner**: Alex Rivera (Solutions Architect)

---

## Key Architecture Decisions

| ADR | Decision | Rationale |
|-----|----------|-----------|
| ADR-001 | Merge reconciliation over delete-and-recreate | Only approach that preserves user binding customizations. Enables detailed change reporting. |
| ADR-002 | Single reconciliation function in common.cjs | Follows existing pattern. Shared by both consumers. Pure function, no disk I/O. |
| ADR-003 | Read-time defaults for backward compatibility | No migration system exists. Zero-risk approach following existing defensive patterns. |

## Technology Tradeoffs

- Merge reconciliation adds ~60-80 lines of complexity but is the only option that preserves user bindings
- Single module (common.cjs) over new file maintains pattern consistency
- Read-time defaults over migration avoids deployment risk

## Integration Points

| Source | Target | Interface |
|--------|--------|-----------|
| Discover orchestrator | reconcileSkillsBySource() | Primary consumer |
| Skills-researcher | reconcileSkillsBySource() | Secondary consumer |
| isdlc.md skill add | writeExternalManifest() | Unchanged, sets source: "user" |
| Reconciliation return | Cache rebuild | Gated by changed boolean |
| Session cache builder | loadExternalManifest() | Reads source with defaults applied |

## Risk Assessment

Low overall risk. No new dependencies. Additive and backward compatible. Well-understood codebase area. Go recommendation.

## Detailed Artifact

- architecture-overview.md (5 sections with full ADRs, options tables, integration points)
