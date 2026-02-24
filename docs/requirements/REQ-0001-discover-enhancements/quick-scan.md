# Quick Scan: REQ-0001-discover-enhancements

**Scanned**: 2026-02-07
**Scope Estimate**: LARGE
**Confidence**: HIGH (detailed requirements spec exists)

## Summary

5 enhancements to the `/discover` command affecting 12 files across 4 directories.
Existing partial implementation of DE-003 detected (DISCOVERY CONTEXT blocks in agents 01/02/03).

## File Impact Map

### Primary Changes (must modify)

| File | Lines | Enhancements | Risk |
|------|-------|-------------|------|
| `src/claude/agents/discover-orchestrator.md` | 1,283 | DE-001,002,003,004,005 | HIGH (all 5 touch this) |
| `src/claude/agents/discover/feature-mapper.md` | 578 | DE-001,004,005 | MEDIUM |
| `src/claude/commands/discover.md` | 175 | DE-004,002 | LOW |
| `src/claude/agents/00-sdlc-orchestrator.md` | 1,707 | DE-003 | MEDIUM |
| `src/claude/hooks/iteration-corridor.js` | 337 | DE-002 | HIGH (CJS hook) |
| `src/claude/hooks/test-watcher.js` | 545 | DE-002 | HIGH (CJS hook) |

### Secondary Changes (may need updates)

| File | Enhancements | Risk |
|------|-------------|------|
| `src/claude/commands/sdlc.md` | DE-004 (--shallow ref) | LOW |
| `src/claude/agents/discover/characterization-test-generator.md` | DE-004 (--shallow ref) | LOW |
| `docs/requirements/reverse-engineered/index.md` | DE-001,004 | LOW |

### New Artifacts

| File | Enhancement | Type |
|------|-------------|------|
| `docs/architecture/agent-catalog.md` | DE-001 | New output |
| `docs/requirements/reverse-engineered/domain-08-agent-orchestration.md` | DE-001 | New domain |

## Keyword Analysis

| Keyword | Files Found | Context |
|---------|------------|---------|
| `--shallow` | 5 files | DE-004 removal scope |
| `discovery_context` | 4 files | DE-003 partial (SDLC orch + agents 01,02,03) |
| `DISCOVERY CONTEXT` | 4 files | DE-003 partial (same files, text blocks) |
| `iteration_config` | 0 hook files | DE-002 new (hooks don't read it yet) |

## Risk Zones

1. **discover-orchestrator.md** (1,283 lines) -- touched by ALL 5 enhancements; largest single-file change
2. **Hook modifications** (iteration-corridor.js, test-watcher.js) -- CJS modules under Article XIII
3. **State schema** (iteration_config, discovery_context) -- backward compatibility under Article XIV

## Implementation Order (from spec)

```
DE-004 (remove --shallow)     -- Quick win, no dependencies
DE-001 (MD extraction)        -- Foundation for catalog + new domain
DE-005 (Presentation & UX)    -- Improves how DE-001 output is displayed
DE-002 (Post-discovery walkthrough) -- Builds on all above
DE-003 (Clean handover)       -- Uses walkthrough's user selection
```

## Existing Partial Work

DE-003 is partially implemented: DISCOVERY CONTEXT blocks exist in the SDLC orchestrator and agents 01/02/03, but they use a file-scan approach rather than the structured envelope from state.json specified in the requirements.
