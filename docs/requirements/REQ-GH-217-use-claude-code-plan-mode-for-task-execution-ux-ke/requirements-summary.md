# Requirements Summary: REQ-GH-217

Replace raw tasks.md diff output with TaskCreate entries for individual main tasks during phase execution. Tasks persist through the phase and are cleaned up at the phase boundary, where a formatted summary table prints showing all tasks in stable order with status icons and progress counts.

## Functional Requirements

- **FR-001** (Must): TaskCreate entries for main tasks during dispatch (not sub-tasks)
- **FR-002** (Must): Persist entries through phase, cleanup at boundary
- **FR-003** (Must): Formatted phase summary at boundary with stable order
- **FR-004** (Should): File upstream issue for stable task ordering on anthropics/claude-code

## Key Decisions

- Plan Mode (EnterPlanMode) evaluated and rejected — designed for planning, not execution tracking
- Sub-task detail in phase summary only, not in task bar
- Accept platform reordering in task bar (numbering preserves logical order)

## Scope: Light
~5-8 file modifications, no new architectural patterns, no new dependencies.
