# Module Design: REQ-GH-217

## task-formatter.js

**Location**: `src/core/tasks/task-formatter.js` (NEW)
**Responsibility**: Format task plan data into a human-readable phase summary string.
**Estimated size**: ~60 lines

### Public Interface

```javascript
/**
 * Format a phase summary table from parsed task plan data.
 * @param {Object} plan - Parsed task plan from readTaskPlan()
 * @param {string} phaseKey - Phase key (e.g., '06-implementation')
 * @returns {string} Formatted summary string
 */
export function formatPhaseSummary(plan, phaseKey)
```

### Output Format

```
┌──────────────────────────────────────────────────────────┐
│  Phase 06: Implementation Summary          18/20 (90%)   │
├──────────────────────────────────────────────────────────┤
│  Core modules                                            │
│  ✅ T001  Create plan-mode bridge module                 │
│  ✅ T002  Implement task-to-plan converter                │
│  ...                                                     │
│  Testing                                                 │
│  ◻️ T013  Add integration tests                          │
├──────────────────────────────────────────────────────────┤
│  ✅ 18 done   🔧 1 in progress   ◻️ 1 pending            │
└──────────────────────────────────────────────────────────┘
```

### Dependencies

- `src/core/tasks/task-reader.js` — `readTaskPlan()` for parsing tasks.md

### Data Structures

Input: the parsed plan object from `readTaskPlan()`, which contains tasks with `id`, `description`, `status`, `phase`, `category` fields.

Output: a plain string. No side effects. No file writes. No state.json access.
