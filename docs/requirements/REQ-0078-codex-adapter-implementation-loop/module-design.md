# Design Specification: Codex Adapter for Implementation Loop

**Item**: REQ-0078 | **GitHub**: #142

---

## 1. Module: codex-adapter/implementation-loop-runner.js

Located in the isdlc-codex repo. Consumes core as npm package.

### Public Interface

```javascript
import { ImplementationLoop } from 'isdlc/core/teams';
import { readState, writeState } from 'isdlc/core/state';

export async function runImplementationLoop(projectRoot, files, options) {
  const loop = new ImplementationLoop(teamSpec);
  const loopState = loop.initFromPlan(files, options);

  while (!loop.isComplete(loopState)) {
    const fileInfo = loop.computeNextFile(loopState);
    if (!fileInfo) break;

    // Writer phase
    const writerCtx = loop.buildWriterContext(loopState, fileInfo);
    const writerResult = await spawnCodexAgent('writer', writerCtx);

    // Reviewer phase
    const reviewCtx = loop.buildReviewContext(loopState, fileInfo, loopState.cycle_per_file[fileInfo.path] || 1);
    const reviewResult = await spawnCodexAgent('reviewer', reviewCtx);

    // Process verdict
    const { action, loopState: newState } = loop.processVerdict(loopState, reviewResult.verdict);
    loopState = newState;

    if (action === 'update') {
      // Updater phase
      const updateCtx = loop.buildUpdateContext(loopState, reviewResult.findings);
      await spawnCodexAgent('updater', updateCtx);
      // Re-review happens on next iteration (cycle incremented)
    }

    // Persist state
    const state = await readState(projectRoot);
    state.implementation_loop = loopState;
    await writeState(projectRoot, state);
  }

  return loop.getSummary(loopState);
}
```

### spawnCodexAgent (Codex-specific)

```javascript
async function spawnCodexAgent(role, context) {
  // Uses Codex CLI sub-agent API
  // Spawns a named agent with role-specific instructions
  // Passes context as structured input
  // Collects structured output
  // Returns parsed result
}
```

This function is the Codex-specific adapter glue. Everything else is core.

## 2. Codex Role Instructions

Each role needs Codex-packaged instructions (equivalent to the Claude agent .md files but for AGENTS.md style):

### Writer Instructions (Codex)
- Produce exactly one file per invocation
- Return: `{ file_produced: "path", content_summary: "..." }`
- Follow TDD ordering if specified in context

### Reviewer Instructions (Codex)
- Review the file against 8 categories
- Return: `{ verdict: "PASS" | "REVISE", findings: { blocking: [...], warning: [...] } }`

### Updater Instructions (Codex)
- Fix all BLOCKING findings
- Return: `{ fixes_applied: [...], tests_passed: boolean }`

## 3. Parity Verification

The same fixtures from REQ-0077 are used:
- Feed the same file list and mock verdict sequence to the Codex adapter
- Compare loop state at each checkpoint against expected state
- Verify same file count, same cycle counts, same final state

## 4. Files Created (in isdlc-codex repo)

| File | Description |
|------|-------------|
| `codex-adapter/implementation-loop-runner.js` | Loop runner consuming core |
| `codex-adapter/instructions/writer.md` | Codex-packaged writer instructions |
| `codex-adapter/instructions/reviewer.md` | Codex-packaged reviewer instructions |
| `codex-adapter/instructions/updater.md` | Codex-packaged updater instructions |
| `tests/codex-adapter/implementation-loop.test.js` | Parity tests against fixtures |
