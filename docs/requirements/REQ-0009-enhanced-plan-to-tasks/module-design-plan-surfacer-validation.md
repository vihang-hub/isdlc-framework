# Module Design: plan-surfacer.cjs Format Validation

**Version**: 1.0.0
**Date**: 2026-02-11
**Author**: System Designer (Agent 03)
**Phase**: 04-design
**Traces**: FR-08, AC-08a through AC-08c

---

## 1. Module Overview

The plan-surfacer hook (`src/claude/hooks/plan-surfacer.cjs`) is an existing PreToolUse[Task] hook that blocks the Task tool when `docs/isdlc/tasks.md` does not exist during implementation and later phases. This design adds an optional format validation step that emits warnings (never blocks) when the v2.0 format is expected but missing.

### Design Principles

1. **Warning only**: Format validation NEVER blocks (AC-08c, Article X fail-open)
2. **Opt-in activation**: Only runs when `Format: v2.0` header is detected
3. **Performance budget**: Must complete within 100ms total (existing check + new validation)
4. **Additive**: Existing existence check is completely unchanged

---

## 2. Current Hook Structure (Preserved)

```javascript
function check(ctx) {
  // 1. Not Task tool -> allow
  // 2. No state or no active workflow -> allow
  // 3. Early phase (EARLY_PHASES set) -> allow
  // 4. tasks.md missing -> BLOCK
  // 5. tasks.md exists -> allow
}
```

Steps 1-5 are completely unchanged. The new validation inserts at step 5, AFTER confirming tasks.md exists but BEFORE returning allow.

---

## 3. Enhanced check() Function Specification

### 3.1 Pseudocode

```javascript
function check(ctx) {
  try {
    const input = ctx.input;
    if (!input) return { decision: 'allow' };
    if (input.tool_name !== 'Task') return { decision: 'allow' };

    const state = ctx.state;
    if (!state) return { decision: 'allow' };
    if (!state.active_workflow) return { decision: 'allow' };

    const currentPhase = state.active_workflow.current_phase;
    if (!currentPhase) return { decision: 'allow' };
    if (EARLY_PHASES.has(currentPhase)) return { decision: 'allow' };

    // Check if tasks.md exists
    const tasksPath = resolveTasksPath();
    if (!fs.existsSync(tasksPath)) {
      // BLOCK: existing behavior, unchanged
      logHookEvent('plan-surfacer', 'block', { ... });
      return { decision: 'block', stopReason: '...' };
    }

    // === NEW: Optional format validation (warning only) ===
    if (currentPhase === '06-implementation') {
      const warnings = validateTasksFormat(tasksPath, state);
      if (warnings.length > 0) {
        const warningText = warnings.join('\n');
        debugLog('Format validation warnings:', warningText);
        logHookEvent('plan-surfacer', 'format-validation-warning', {
          phase: currentPhase,
          warnings: warnings
        });
        // Return allow WITH stderr warning (never block)
        return {
          decision: 'allow',
          stderr: `[plan-surfacer] Format warnings:\n${warningText}`
        };
      }
    }
    // === END NEW ===

    return { decision: 'allow' };

  } catch (error) {
    debugLog('Error in plan-surfacer:', error.message);
    return { decision: 'allow' };  // Fail-open
  }
}
```

### 3.2 validateTasksFormat() Function

```javascript
/**
 * Optional format validation for tasks.md v2.0.
 * Returns an array of warning strings (empty = no issues).
 * NEVER throws -- all errors are caught and logged.
 *
 * @param {string} tasksPath - Absolute path to tasks.md
 * @param {object} state - Parsed state.json
 * @returns {string[]} Array of warning messages
 */
function validateTasksFormat(tasksPath, state) {
  const warnings = [];

  try {
    const content = fs.readFileSync(tasksPath, 'utf8');

    // Check 1: Is this a v2.0 format file?
    const hasV2Header = /^Format:\s*v2\.0/m.test(content);
    if (!hasV2Header) {
      // Not a v2.0 file -- skip all format validation
      // This ensures backward compatibility: v1.0 files are never warned about
      return [];
    }

    // Check 2: Does Phase 06 section exist?
    const phase06Match = content.match(
      /^## Phase \d+:.*Implementation/m
    );
    if (!phase06Match) {
      warnings.push(
        'Phase 06 (Implementation) section not found in tasks.md'
      );
      return warnings;
    }

    // Check 3: Do Phase 06 tasks have file-level annotations?
    // Extract Phase 06 section content
    const phase06Start = content.indexOf(phase06Match[0]);
    const nextPhaseMatch = content.substring(phase06Start + 1).match(/^## Phase/m);
    const phase06End = nextPhaseMatch
      ? phase06Start + 1 + nextPhaseMatch.index
      : content.length;
    const phase06Content = content.substring(phase06Start, phase06End);

    // Check for files: sub-lines
    const hasFileAnnotations = /^\s{2}files:/m.test(phase06Content);
    if (!hasFileAnnotations) {
      warnings.push(
        'Phase 06 tasks lack file-level annotations (files: sub-lines). ' +
        'The task refinement step may not have run. ' +
        'The software-developer agent will self-decompose work.'
      );
    }

    // Check 4: Do Phase 06 tasks have traceability annotations?
    const taskLines = phase06Content.match(/^- \[[ X]\] T\d{4}/gm) || [];
    const tracedTasks = phase06Content.match(/\| traces:/gm) || [];
    if (taskLines.length > 0 && tracedTasks.length === 0) {
      warnings.push(
        'Phase 06 tasks have no traceability annotations (| traces:). ' +
        'Traceability will be limited.'
      );
    }

    // Check 5: Optional -- dependency cycle detection
    // Only if Dependency Graph section exists
    if (content.includes('## Dependency Graph')) {
      const cycleWarning = detectCyclesInDependencyGraph(content);
      if (cycleWarning) {
        warnings.push(cycleWarning);
      }
    }

  } catch (error) {
    // Fail-open: log error but return no warnings
    debugLog('Format validation error:', error.message);
  }

  return warnings;
}
```

### 3.3 detectCyclesInDependencyGraph() Function

```javascript
/**
 * Optional cycle detection on the dependency graph.
 * Parses blocked_by sub-lines and runs Kahn's algorithm.
 * Returns a warning string if cycle detected, null otherwise.
 *
 * Performance: O(V+E) where V = tasks, E = dependency edges.
 * For typical projects (< 50 tasks, < 100 edges): < 5ms.
 *
 * @param {string} content - Full tasks.md content
 * @returns {string|null} Warning message or null
 */
function detectCyclesInDependencyGraph(content) {
  try {
    // Parse all tasks and their blocked_by annotations
    const taskPattern = /^- \[[ X]\] (T\d{4})/gm;
    const tasks = new Set();
    let match;
    while ((match = taskPattern.exec(content)) !== null) {
      tasks.add(match[1]);
    }

    // Parse blocked_by sub-lines
    const edges = [];  // [from, to] = [blocker, dependent]
    const blockedByPattern = /^- \[[ X]\] (T\d{4})[\s\S]*?(?=^- \[|^##)/gm;
    const taskBlocks = content.match(
      /^- \[[ XBLOCKED]*\] (T\d{4}).*(?:\n  .*?)*/gm
    ) || [];

    const inDegree = {};
    const graph = {};
    for (const tid of tasks) {
      inDegree[tid] = 0;
      graph[tid] = [];
    }

    for (const block of taskBlocks) {
      const tidMatch = block.match(/^- \[[ XBLOCKED]*\] (T\d{4})/);
      if (!tidMatch) continue;
      const tid = tidMatch[1];

      const bbMatch = block.match(/^\s{2}blocked_by:\s*\[([^\]]+)\]/m);
      if (!bbMatch) continue;

      const blockers = bbMatch[1].split(',').map(s => s.trim());
      for (const blocker of blockers) {
        if (tasks.has(blocker)) {
          graph[blocker].push(tid);
          inDegree[tid] = (inDegree[tid] || 0) + 1;
        }
      }
    }

    // Kahn's algorithm
    const queue = [];
    for (const tid of tasks) {
      if (inDegree[tid] === 0) queue.push(tid);
    }

    let processed = 0;
    while (queue.length > 0) {
      const current = queue.shift();
      processed++;
      for (const dep of (graph[current] || [])) {
        inDegree[dep]--;
        if (inDegree[dep] === 0) queue.push(dep);
      }
    }

    if (processed < tasks.size) {
      const cycleNodes = [...tasks].filter(t => inDegree[t] > 0);
      return `Dependency cycle detected involving tasks: ${cycleNodes.join(', ')}. ` +
        'The dependency graph may have been generated incorrectly.';
    }

    return null;  // No cycle

  } catch (error) {
    debugLog('Cycle detection error:', error.message);
    return null;  // Fail-open
  }
}
```

---

## 4. Activation Conditions

| Condition | Validation Runs? | Reason |
|-----------|-----------------|--------|
| `current_phase === '06-implementation'` | YES | Only validates during implementation phase |
| `current_phase === '05-test-strategy'` | NO | Test strategy does not need file-level tasks |
| `current_phase === '16-quality-loop'` | NO | Quality loop does not consume tasks.md annotations |
| tasks.md has `Format: v2.0` header | YES (full checks) | v2.0 format expected |
| tasks.md lacks `Format: v2.0` header | NO (skips all checks) | Legacy format -- no expectations |
| tasks.md missing entirely | N/A | Existence check blocks before validation runs |

---

## 5. Warning vs Block Decision Matrix

| Check | Result | Action |
|-------|--------|--------|
| tasks.md missing | FAIL | **BLOCK** (existing behavior, unchanged) |
| v2.0 header missing | INFO | No warning, no block (legacy format is valid) |
| Phase 06 section missing | WARN | Warning to stderr, **ALLOW** |
| No file-level annotations | WARN | Warning to stderr, **ALLOW** |
| No traceability annotations | WARN | Warning to stderr, **ALLOW** |
| Dependency cycle detected | WARN | Warning to stderr, **ALLOW** |

Key principle: **Format validation warnings NEVER block.** This is mandated by AC-08c and Article X (fail-safe defaults).

---

## 6. Performance Analysis

| Operation | Estimated Time | Notes |
|-----------|---------------|-------|
| Existing existence check | < 1ms | `fs.existsSync()` |
| Read tasks.md content | < 5ms | Typical file size 10-50KB |
| v2.0 header regex | < 1ms | Single line match |
| Phase 06 section extraction | < 2ms | String search + slice |
| File annotation check | < 1ms | Regex on section substring |
| Traceability annotation check | < 1ms | Regex count |
| Cycle detection (Kahn's) | < 5ms | O(V+E), typical V<50, E<100 |
| **Total** | **< 15ms** | Well within 100ms budget (NFR-01a) |

---

## 7. Test Specifications

Add the following test cases to `src/claude/hooks/tests/plan-surfacer.test.cjs`:

### 7.1 New Test Cases

| Test ID | Description | Input | Expected |
|---------|-------------|-------|----------|
| TC-PS-11 | v2.0 format with file-level tasks -- no warnings | tasks.md with `Format: v2.0`, Phase 06 with `files:` sub-lines | allow, no stderr |
| TC-PS-12 | v2.0 format without file-level tasks -- warning | tasks.md with `Format: v2.0`, Phase 06 without `files:` sub-lines | allow, stderr contains warning |
| TC-PS-13 | v2.0 format without traceability -- warning | tasks.md with `Format: v2.0`, Phase 06 without `\| traces:` | allow, stderr contains warning |
| TC-PS-14 | v1.0 format (no Format header) -- no validation | Legacy tasks.md without `Format: v2.0` | allow, no stderr (validation skipped) |
| TC-PS-15 | Dependency cycle detected -- warning | tasks.md with circular blocked_by references | allow, stderr contains cycle warning |
| TC-PS-16 | Validation during non-implementation phase -- skipped | `current_phase: '05-test-strategy'` with v2.0 tasks.md | allow, no stderr (phase check skips) |
| TC-PS-17 | Validation error in format check -- fail-open | tasks.md with malformed content | allow, no stderr (error caught) |

### 7.2 Existing Tests (Unchanged)

All 10 existing test cases for plan-surfacer.cjs remain unchanged. The new tests are additive.

| Existing Test Range | Coverage |
|--------------------|----------|
| TC-PS-01 through TC-PS-10 | Existence check, early phases, missing file, fail-open |

---

## 8. Module Exports

The enhanced plan-surfacer.cjs exports:

```javascript
// Primary export (dispatcher-compatible)
module.exports = { check };

// Internal functions (not exported, but testable via wrapper)
// - validateTasksFormat(tasksPath, state)
// - detectCyclesInDependencyGraph(content)
```

For testing, the internal validation functions can be extracted to a separate helper or tested indirectly through the `check()` function with appropriate fixture files.

---

## 9. Traces

| Requirement | How Addressed |
|-------------|---------------|
| AC-08a | Existing blocking behavior preserved (steps 1-4 unchanged) |
| AC-08b | `validateTasksFormat()` checks for file-level tasks in Phase 06 section |
| AC-08c | All validation results are warnings only (never block); `decision: 'allow'` always |
| FR-08 | Complete hook enhancement with format validation, cycle detection, and 7 new test cases |
| NFR-01a | Performance budget: < 15ms total, well within 100ms limit |
| Article X | Fail-open: errors in validation caught and silenced; only warnings emitted |
| Article XIII | Hook remains CJS (.cjs extension); uses only `require()` imports |
