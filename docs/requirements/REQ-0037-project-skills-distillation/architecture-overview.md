# Architecture Overview: Project Skills Distillation

**Status**: Draft
**Confidence**: High
**Last Updated**: 2026-02-24
**Coverage**: 95%
**Source**: GitHub #88
**Slug**: REQ-0037-project-skills-distillation

---

## Architecture Options

### ADR-001: Distillation Execution Model

**Context**: The distillation step needs to read discovery artifacts and produce concise skill files. This could be implemented as a new sub-agent, as inline orchestrator logic, or as a programmatic extraction module.

#### Option A: New Sub-Agent (D20)
- **Summary**: Create a dedicated `project-skills-distiller` sub-agent delegated via Task tool
- **Pros**: Consistent with orchestrator's delegation pattern; isolated scope; can be tested independently
- **Cons**: Over-engineering for a transform-and-write operation; adds agent management overhead; no new analysis involved
- **Existing Pattern Alignment**: Follows D1-D19 pattern
- **Verdict**: Eliminated

#### Option B: Inline Orchestrator Logic (Selected)
- **Summary**: Add distillation instructions directly in `discover-orchestrator.md` as a new step
- **Pros**: Simple; no delegation overhead; no new agent file; distillation is just "read artifact, summarize, write file"
- **Cons**: Makes the orchestrator file larger; distillation quality depends on orchestrator instruction clarity
- **Existing Pattern Alignment**: Orchestrator already handles Step 3 (tech stack selection) and Step 7.5 (walkthrough) inline
- **Verdict**: Selected

#### Option C: Programmatic Extraction Module
- **Summary**: Write a Node.js module that programmatically parses discovery artifacts and extracts structured content
- **Pros**: Deterministic output; testable; no LLM variability
- **Cons**: Brittle against format changes in discovery reports; high implementation cost; loses the ability to intelligently summarize
- **Existing Pattern Alignment**: None -- discovery artifacts are free-form markdown
- **Verdict**: Eliminated

**ADR Record**:
- **Status**: Accepted
- **Decision**: Inline orchestrator logic with LLM summarization
- **Rationale**: Distillation is a summarization task, not an analysis task. The LLM is the right tool for condensing free-form markdown into structured skill files. Inline execution avoids unnecessary agent management overhead.
- **Consequences**: Orchestrator markdown grows by ~200-300 lines. Distillation quality depends on instruction clarity. No programmatic tests possible for distillation output quality.

---

### ADR-002: Skill Lifecycle Scope on Re-Discovery

**Context**: When discovery re-runs (full or incremental), existing discover-sourced skills need to be managed. The question is whether to wipe all discover-sourced skills or scope the cleanup to the phases that actually ran.

#### Option A: Global Clean-Slate
- **Summary**: Remove all `source: "discover"` entries and files, then re-distill whatever succeeds
- **Pros**: Simple logic; no need to track which phase produced which skill
- **Cons**: Incremental discovery would lose skills for phases that didn't run (e.g., if D2 is skipped, `project-test-landscape` disappears)
- **Verdict**: Eliminated

#### Option B: Per-Source-Phase Clean-Slate (Selected)
- **Summary**: Each skill is mapped to a source phase. Only skills whose source phase ran in this discovery get the clean-slate treatment. Skipped phases leave their skills intact.
- **Pros**: Incremental discovery preserves skills for skipped phases; each skill's lifecycle tied to its data source; more predictable behavior
- **Cons**: Requires maintaining a mapping of skill -> source phase; slightly more complex logic
- **Verdict**: Selected

**ADR Record**:
- **Status**: Accepted
- **Decision**: Per-source-phase clean-slate
- **Rationale**: Skills should reflect their source data. If the source data wasn't refreshed, the skill shouldn't change. This preserves useful knowledge during incremental re-discovery.
- **Consequences**: The distillation step needs a hardcoded mapping: D1 -> [PROJ-001, PROJ-002], D2 -> [PROJ-004], D6 -> [PROJ-003]. Each phase's distillation logic checks whether that phase ran before cleaning and re-distilling.

**Skill-to-Phase Mapping**:

| Skill | Skill ID | Source Phase | Source Agent |
|-------|----------|-------------|-------------|
| `project-architecture.md` | PROJ-001 | Phase 1 (D1) | architecture-analyzer |
| `project-conventions.md` | PROJ-002 | Phase 1 (D1) | architecture-analyzer |
| `project-domain.md` | PROJ-003 | Phase 1 (D6) | feature-mapper |
| `project-test-landscape.md` | PROJ-004 | Phase 1 (D2) | test-evaluator |

---

### ADR-003: Section 9 Removal Strategy

**Context**: `rebuildSessionCache()` includes Section 9 (DISCOVERY_CONTEXT) that loads raw discovery reports into the cache. With project skills providing distilled versions, Section 9 becomes redundant.

#### Option A: Remove Section 9 in This REQ
- **Summary**: Delete Section 9 code and update tests as part of this work
- **Pros**: Clean removal of redundancy; immediate context budget savings; ships together with the replacement mechanism
- **Cons**: Must coordinate with distillation landing -- if distillation is delayed, there's a gap where no discovery content is in the cache
- **Verdict**: Selected

#### Option B: Deprecate Section 9 Separately
- **Summary**: Leave Section 9 in place, remove later after project skills are validated
- **Pros**: Safety net; no gap in discovery content availability
- **Cons**: Redundant content in cache during transition; extra cleanup work later
- **Verdict**: Eliminated

**ADR Record**:
- **Status**: Accepted
- **Decision**: Remove Section 9 as part of this REQ
- **Rationale**: The distillation step and Section 9 removal should ship together. If the distillation step exists, Section 9 is redundant. If the distillation step doesn't exist yet, Section 9 is still useful -- but that's the pre-implementation state, not a state we'd ship.
- **Consequences**: `common.cjs` modified: Section 9 code removed (lines ~4114-4131). Test file `test-session-cache-builder.test.cjs` updated. Net context budget reduction.

---

## Selected Architecture

### System Flow

```
Discovery Run (full or incremental)
    │
    ├── Phase 1: Parallel Analysis (D1, D2, D5, D6)
    │       │
    │       ├── D1 completes ──→ Distill PROJ-001 (architecture) + PROJ-002 (conventions)
    │       ├── D2 completes ──→ Distill PROJ-004 (test-landscape)
    │       └── D6 completes ──→ Distill PROJ-003 (domain)
    │
    ├── Phase 2-3: Report + Constitution
    │
    ├── Phase 4: Skills (D4) + Testing Gaps
    │
    ├── Manifest Update (write all distilled entries)
    │
    ├── rebuildSessionCache() (single call)
    │
    ├── Walkthrough
    │
    └── Finalize
```

### Distillation Step Internal Flow

```
For each source phase that ran:
    1. Identify skills mapped to this phase
    2. Remove existing discover-sourced entries for these skills from manifest
    3. Delete corresponding skill files from .claude/skills/external/
    4. Read source artifact(s)
    5. Distill content (LLM summarization with structural template)
    6. Write skill file to .claude/skills/external/
    7. Add entry to manifest with source: "discover"
    8. Log success or warning

After all phases processed:
    9. Write updated manifest (single write)
    10. Call rebuildSessionCache() (single call)
```

---

## Technology Decisions

### No New Dependencies
- No new npm packages, modules, or external tools required
- Leverages existing: `writeExternalManifest()`, `rebuildSessionCache()`, `loadExternalManifest()`
- Skill files are plain markdown with YAML frontmatter -- no new parsers needed

### No New Executable Code
- Distillation logic is LLM-driven via orchestrator markdown instructions
- The only code change is the Section 9 removal from `common.cjs` (a deletion)
- Runtime artifacts (skill files, manifest entries) are written by the orchestrator agent at discovery time

---

## Integration Architecture

### Integration Points

| Source | Target | Interface Type | Data Format | Error Handling |
|--------|--------|---------------|-------------|----------------|
| D1 output (architecture-analyzer) | Distillation step | File read | Markdown | Fail-open: skip skill on read error |
| D2 output (test-evaluator) | Distillation step | File read | Markdown | Fail-open: skip skill on read error |
| D6 output (feature-mapper) | Distillation step | File read | Markdown | Fail-open: skip skill on read error |
| Distillation step | `.claude/skills/external/` | File write | Markdown + YAML frontmatter | Fail-open: skip skill on write error |
| Distillation step | `external-skills-manifest.json` | JSON write | JSON (via `writeExternalManifest()`) | Fail-open: log warning, continue |
| Distillation step | `rebuildSessionCache()` | Function call | N/A | Fail-open: log warning, continue |
| `rebuildSessionCache()` Section 7 | Session cache | File read + concat | Markdown | Existing truncation at 5,000 chars |
| `inject-session-cache.cjs` | Agent context | Stdout | Markdown | Existing fail-open |

### Data Flow

```
Discovery Artifacts                    Project Skills                   Agent Context
┌──────────────────────┐              ┌───────────────────────┐        ┌─────────────────┐
│ D1: architecture     │──distill──→  │ project-architecture  │──┐     │                 │
│     analysis output  │              │ project-conventions   │  │     │  SessionStart    │
├──────────────────────┤              ├───────────────────────┤  ├──→  │  Hook injects   │
│ D2: test evaluation  │──distill──→  │ project-test-landscape│  │     │  session cache   │
│     output           │              ├───────────────────────┤  │     │  into context    │
├──────────────────────┤              │ project-domain        │──┘     │  window          │
│ D6: feature mapping  │──distill──→  │                       │        │                 │
│     output           │              └───────┬───────────────┘        └─────────────────┘
└──────────────────────┘                      │
                                              ▼
                                    external-skills-manifest.json
                                              │
                                              ▼
                                    rebuildSessionCache()
                                    Section 7: EXTERNAL_SKILLS
                                              │
                                              ▼
                                    .isdlc/session-cache.md
```

### Synchronization Model

- **Sequential within discovery**: Distillation runs after source phase completion, not concurrently
- **Single manifest write**: All skill entries accumulated, single `writeExternalManifest()` call
- **Single cache rebuild**: One `rebuildSessionCache()` call after all distillation and manifest work
- **No concurrency concerns**: Discovery is single-threaded; no race conditions on skill files or manifest

---

## Summary

The architecture is minimal and leverages existing infrastructure:

- **2 source files modified**: `discover-orchestrator.md` (add distillation instructions), `common.cjs` (remove Section 9)
- **1 test file updated**: `test-session-cache-builder.test.cjs`
- **4 runtime artifacts created**: Project skill files in `.claude/skills/external/`
- **1 runtime artifact updated**: `external-skills-manifest.json`
- **0 new dependencies**: All existing infrastructure reused
- **0 new executable code files**: Distillation is LLM-driven

Key architectural decisions: inline orchestrator logic (not sub-agent), per-source-phase clean-slate (not global), Section 9 removal (not deprecation).
