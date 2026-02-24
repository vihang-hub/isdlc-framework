# Component Specification: Fan-Out/Fan-In Engine

**REQ ID**: REQ-0017
**Phase**: 04-design
**Created**: 2026-02-15
**Author**: System Designer (Agent 04)
**Traces**: FR-001 through FR-007, NFR-001 through NFR-004

---

## 1. Component Inventory

| # | Component | Type | File | Status |
|---|-----------|------|------|--------|
| 1 | Fan-Out Engine Protocol | Skill (markdown) | `src/claude/skills/quality-loop/fan-out-engine/SKILL.md` | NEW |
| 2 | Phase 16 Fan-Out Integration | Agent section | `src/claude/agents/16-quality-loop-engineer.md` | MODIFY |
| 3 | Phase 08 Fan-Out Integration | Agent section | `src/claude/agents/07-qa-engineer.md` | MODIFY |
| 4 | CLI --no-fan-out Flag | Command section | `src/claude/commands/isdlc.md` | MODIFY |
| 5 | Skills Manifest Registration | Config | `src/claude/hooks/config/skills-manifest.json` | MODIFY |
| 6 | State.json Fan-Out Config | Schema | `.isdlc/state.json` | SCHEMA EXTEND |

---

## 2. Component 1: Fan-Out Engine Protocol (SKILL.md)

### Purpose
The canonical definition of the fan-out/fan-in protocol. Contains the three sub-components (chunk splitter, parallel spawner, result merger) as sections within a single skill file. Consumer agents reference this skill for the protocol specification.

### Location
`src/claude/skills/quality-loop/fan-out-engine/SKILL.md`

### Structure

```markdown
# QL-012: fan-out-orchestration

## Description
Reusable fan-out/fan-in protocol for splitting work across N parallel Task agents.

## Owner
- **Agent**: quality-loop-engineer
- **Phase**: 16-quality-loop (primary), 08-code-review (secondary consumer)

## Protocol Version
1.0.0

## Sub-Components

### Chunk Splitter
[Full algorithm + JSON contracts from interface-spec.md Section 3]

### Parallel Spawner
[Spawn pattern + constraints from interface-spec.md Section 4]

### Result Merger
[Merge algorithms from interface-spec.md Sections 5.2 and 5.3]

## Configuration Resolution
[Resolution algorithm from interface-spec.md Section 6.2]

## Error Handling
[Error taxonomy reference: error-taxonomy.md]

## Observability
Skill usage is logged for observability. Cross-phase usage is recorded but never blocked.
```

### Dependencies
- None (self-contained protocol definition)

### Consumers
- `16-quality-loop-engineer.md` (Track A test fan-out)
- `07-qa-engineer.md` (file review fan-out)

---

## 3. Component 2: Phase 16 Fan-Out Integration

### Purpose
Extends the existing Phase 16 Quality Loop agent to use the fan-out protocol within Track A for large test suites.

### File
`src/claude/agents/16-quality-loop-engineer.md`

### Changes Summary

| Section | Change | Lines (est.) |
|---------|--------|-------------|
| Frontmatter | Add QL-012 to owned_skills | +1 |
| New: Fan-Out Protocol | Decision tree, config resolution, chunk prompt, merging | +120 |
| Grouping Strategy | Add conditional note about fan-out replacement | +5 |
| Parallel Execution State | Extend schema with fan_out nested object | +15 |
| Consolidated Result Merging | Add note about fan-out merged results | +5 |
| Skill Observability table | Add QL-012 row | +1 |

Estimated net change: +147 lines.

### Key Design Decisions
- Fan-out replaces A1/A2/A3 grouping when active (ADR-0003)
- Each chunk agent runs the full Track A pipeline (build+lint+type+tests+coverage)
- Mutation testing runs AFTER fan-out merging (not within chunks)
- Track B is NOT affected by fan-out
- Nesting depth: Phase Loop -> quality-loop-engineer -> Track A -> Chunk Agents (3 levels)

### Detailed Design
See: `module-design-phase16.md`

---

## 4. Component 3: Phase 08 Fan-Out Integration

### Purpose
Extends the existing Phase 08 QA Engineer agent to use the fan-out protocol for parallel file review on large changesets.

### File
`src/claude/agents/07-qa-engineer.md`

### Changes Summary

| Section | Change | Lines (est.) |
|---------|--------|-------------|
| New: Fan-Out Protocol | Decision tree, config resolution, reviewer prompt, merging, cross-cutting | +130 |
| Output Artifacts | Note about extended report format | +10 |
| New: File Type Filtering | Include/exclude patterns | +15 |

Estimated net change: +155 lines.

### Key Design Decisions
- Group-by-directory strategy keeps related files together
- File type filtering excludes lock files, binaries, generated files
- Cross-cutting concerns detected both within-chunk and across-chunk
- GATE-07 validation unchanged (report format extended, not changed)
- Nesting depth: Phase Loop -> qa-engineer -> Chunk Reviewers (2 levels)

### Detailed Design
See: `module-design-phase08.md`

---

## 5. Component 4: CLI --no-fan-out Flag

### Purpose
Allow users to disable fan-out for a single workflow run via a command-line flag.

### File
`src/claude/commands/isdlc.md`

### Changes Summary

| Section | Change | Lines (est.) |
|---------|--------|-------------|
| Usage examples | Add --no-fan-out examples | +2 |
| Flag parsing (Step 3) | Add --no-fan-out parsing rule | +1 |
| Flag documentation table | Add --no-fan-out row | +1 |

Estimated net change: +4 lines.

### Detailed Design
See: `module-design-config.md`

---

## 6. Component 5: Skills Manifest Registration

### Purpose
Register QL-012 in the skills manifest for observability tracking.

### File
`src/claude/hooks/config/skills-manifest.json`

### Changes Summary

Three locations to modify:
1. `ownership.quality-loop-engineer.skills[]` -- add "QL-012", increment skill_count to 12
2. `skill_lookup` -- add `"QL-012": "quality-loop-engineer"`
3. `path_lookup` -- add `"quality-loop/fan-out-engine": "quality-loop-engineer"`

### Registration Details

```json
{
  "ownership": {
    "quality-loop-engineer": {
      "skill_count": 12,
      "skills": ["QL-001", "...", "QL-011", "QL-012"]
    }
  },
  "skill_lookup": {
    "QL-012": "quality-loop-engineer"
  },
  "path_lookup": {
    "quality-loop/fan-out-engine": "quality-loop-engineer"
  }
}
```

Also update the top-level `total_skills` from 242 to 243.

---

## 7. Component 6: State.json Fan-Out Configuration

### Purpose
Provide configurable fan-out parameters that persist across sessions.

### File
`.isdlc/state.json` (runtime, gitignored)

### Schema Extension
New optional top-level `fan_out` section. See `database-design.md` Section 2 for full schema.

### Default Behavior
When the section is absent, all parameters use hardcoded defaults. No migration needed.

### Detailed Design
See: `module-design-config.md`

---

## 8. Cross-Component Data Flow

```
[isdlc.md]
  |-- Parse --no-fan-out flag
  |-- Store in state.json: active_workflow.flags.no_fan_out
  v
[Phase Agent (16 or 08)]
  |-- Read state.json: fan_out config + flags
  |-- Resolve configuration (precedence: flag > per-phase > global > defaults)
  |-- Count work items (T or F)
  |-- Decision tree: fan-out or single-agent?
  v
[Fan-Out Engine Protocol] (if fan-out active)
  |-- Chunk Splitter: items -> N chunks
  |-- Parallel Spawner: N Task calls in single response
  |-- Wait for all N results
  |-- Result Merger: N results -> 1 unified result
  v
[Phase Agent]
  |-- Produce output in existing format (quality-report.md or code-review-report.md)
  |-- Add Parallelism Summary section
  |-- Append fan_out metadata to skill_usage_log
  v
[Gate Validation]
  |-- Read existing schema fields (unchanged)
  |-- Ignore fan_out_summary (additive, backward-compatible)
  v
[GATE-16 or GATE-07]: PASS/FAIL (unchanged logic)
```

---

## 9. Files Not Modified (Verification)

Per ADR-0004 and the architecture, these files are explicitly NOT modified:

| File | Reason |
|------|--------|
| `src/claude/hooks/gate-blocker.cjs` | Merged output uses identical schema. No code changes needed. |
| `src/claude/hooks/config/iteration-requirements.json` | Existing validation fields are sufficient. fan_out_summary is additive and ignored. |
| `src/claude/hooks/iteration-corridor.cjs` | Fan-out chunks are spawned within a phase agent's task context. No corridor impact. |
| `src/claude/hooks/skill-validator.cjs` | New QL-012 is registered in manifest. Existing validation logic handles it. |
| `src/claude/hooks/log-skill-usage.cjs` | Existing log format handles the fan_out_metadata field (additive JSON). |
| `src/claude/hooks/lib/common.cjs` | No loadFanOutConfig() needed -- config resolution is in the agent markdown protocol, not executable code. |

---

## 10. Implementation Priority Order

Based on dependency analysis:

| Priority | Component | Rationale |
|----------|-----------|-----------|
| 1 | Skills manifest registration (QL-012) | Required before any agent references the skill |
| 2 | Fan-out engine SKILL.md | Protocol definition must exist before consumers reference it |
| 3 | Phase 16 fan-out integration | Primary use case, highest value |
| 4 | Phase 08 fan-out integration | Secondary use case, follows same pattern |
| 5 | CLI --no-fan-out flag | Configuration feature, can be added last |

Steps 1-2 are foundational. Steps 3-4 are independent and could be done in parallel. Step 5 is additive.

---

## 11. Traceability Matrix

| Component | Requirements | Acceptance Criteria | ADRs |
|-----------|-------------|---------------------|------|
| Fan-Out Engine Protocol | FR-001, FR-002, FR-003, FR-004 | AC-001-01 to AC-001-05, AC-002-01 to AC-002-05, AC-003-01 to AC-003-05, AC-004-01 to AC-004-05 | ADR-0001 |
| Phase 16 Integration | FR-005 | AC-005-01 to AC-005-07 | ADR-0003 |
| Phase 08 Integration | FR-006 | AC-006-01 to AC-006-07 | ADR-0001 |
| CLI Flag | FR-007 | AC-007-03 | ADR-0002 |
| Skills Manifest | FR-001 | AC-001-04 | ADR-0001 |
| State.json Config | FR-007 | AC-007-01, AC-007-02, AC-007-04 | ADR-0002 |
