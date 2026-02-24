# ADR-0004: Dependency Annotation Format and Cycle Detection Approach

## Status

Accepted

## Context

FR-03 requires tasks to declare explicit dependencies (blocked_by, blocks) with cycle detection and critical path identification. Key decisions:

1. **Annotation format**: How dependencies appear in tasks.md
2. **Cycle detection**: Algorithm selection
3. **Critical path**: Computation and display

### Format Options

**Option A: Sub-line Annotations** -- Dependencies appear as indented lines below the task checkbox:
```
- [ ] T0005 Implement login endpoint | traces: FR-01, AC-01a
  blocked_by: [T0003, T0004]
  files: src/auth/login.js (CREATE)
```

**Option B: Section-Level Adjacency List** -- Dependencies only in the `## Dependency Graph` section:
```
## Dependency Graph
T0005 -> T0003, T0004
T0006 -> T0005
```

**Option C: Both** -- Inline sub-lines for per-task context + summary section for global view.

### Cycle Detection Options

**Algorithm A: Kahn's Algorithm (BFS topological sort)** -- Simple, well-known, O(V+E). Returns empty order if cycle exists.

**Algorithm B: DFS with coloring** -- Standard 3-color DFS. More complex but identifies the exact cycle path.

**Algorithm C: Agent-level validation only** -- The generate-plan skill instructs the LLM to "ensure no cycles" without a formal algorithm.

## Decision

### Format: Option C (Both)

Use inline sub-line annotations per task for local context, plus a `## Dependency Graph` section at the end for global visibility:

```markdown
- [ ] T0005 Implement login endpoint | traces: FR-01, AC-01a
  blocked_by: [T0003, T0004]
  blocks: [T0006]
  files: src/auth/login.js (CREATE)
```

And at the bottom:
```markdown
## Dependency Graph

### Critical Path
T0001 -> T0003 -> T0005 -> T0006 -> T0008
Length: 5 tasks

### All Dependencies
| Task | Blocked By | Blocks |
|------|-----------|--------|
| T0003 | T0001 | T0005 |
| T0005 | T0003, T0004 | T0006 |
```

### Cycle Detection: Algorithm C (Agent-level validation)

Since ORCH-012 is a markdown skill (not executable code), and the generate-plan skill is executed by an LLM agent (not a runtime function), formal algorithm implementation is not applicable. Instead:

1. The ORCH-012 skill specification instructs the generating agent to apply topological ordering when assigning dependencies
2. The skill includes a validation step: "After generating all dependencies, verify the graph is acyclic by tracing all dependency chains and confirming no task transitively depends on itself"
3. The plan-surfacer hook (runtime code) can optionally validate acyclicity using Kahn's algorithm on the parsed dependency graph
4. If a cycle is detected, the hook emits a warning (not a block, per AC-08c fail-open behavior)

### Critical Path: Longest Chain Identification

The generating agent computes the critical path by:
1. Identifying all tasks with no predecessors (roots)
2. For each root, tracing the longest dependency chain to a leaf
3. Reporting the longest chain as the critical path

This is computed at generation time and included as a static section in tasks.md. It does not need runtime recalculation.

## Consequences

**Positive:**
- Dual representation (inline + section) gives both local and global context
- Agent-level validation avoids adding complex graph algorithms to the hook layer
- Optional hook validation provides a runtime safety net
- Critical path computation is static and human-readable

**Negative:**
- Redundancy between inline blocked_by/blocks and the Dependency Graph section (could drift)
- Agent-level cycle detection depends on LLM accuracy (mitigated by optional hook validation)
- Critical path is a snapshot at generation time; manual task additions could invalidate it

## Traces

- FR-03 (Explicit Dependency Graph), AC-03a through AC-03e
- FR-06 (Enhanced Tasks.md Format), AC-06e
- NFR-01a (Hook performance -- validation must stay under 100ms budget)
