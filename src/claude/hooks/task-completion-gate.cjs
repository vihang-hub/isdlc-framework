#!/usr/bin/env node
/**
 * iSDLC Task Completion Gate - PreToolUse Hook
 * =============================================
 * Blocks phase advancement when docs/isdlc/tasks.md has unfinished
 * top-level tasks for the completing phase. Enforces Article I.5
 * ("User-confirmed task plans are binding specifications").
 *
 * Event:   PreToolUse on Edit|Write to .isdlc/state.json
 * Scope:   build workflows only (fail-open for all others)
 * Article: X (fail-safe defaults — all error paths exit 0)
 *
 * Traces: FR-001, FR-002, REQ-GH-232
 * @version 1.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { check } = require('./lib/task-completion-logic.cjs');
const {
  readStdin,
  readState,
  getProjectRoot,
  outputBlockResponse,
  debugLog
} = require('./lib/common.cjs');

if (require.main === module) {
  (async () => {
    try {
      // TCG-001: Read stdin
      const inputStr = await readStdin();
      if (!inputStr || !inputStr.trim()) process.exit(0);

      let input;
      try { input = JSON.parse(inputStr); } catch { process.exit(0); }

      // Quick filter: only Edit/Write on state.json
      const toolInput = input.tool_input || {};
      const filePath = toolInput.file_path || '';
      if (!filePath.endsWith('.isdlc/state.json') && !filePath.endsWith('.isdlc\\state.json')) {
        process.exit(0);
      }

      // Load current state
      const state = readState();

      // Load task plan via bridge (async)
      const projectRoot = getProjectRoot();
      const tasksPath = projectRoot
        ? path.resolve(projectRoot, 'docs', 'isdlc', 'tasks.md')
        : null;

      let taskPlan = null;
      if (tasksPath) {
        try {
          const bridgePath = path.resolve(__dirname, '..', '..', 'core', 'bridge', 'tasks.cjs');
          if (fs.existsSync(bridgePath)) {
            const bridge = require(bridgePath);
            taskPlan = await bridge.readTaskPlan(tasksPath);
          }
        } catch {
          // TCG-006: Bridge load failure → fail-open
          debugLog('[task-completion-gate] Bridge load failed, proceeding without task plan');
        }
      }

      // Run pure logic
      const result = check({ input, state, taskPlan });

      if (result.decision === 'block') {
        if (result.stderr) console.error(result.stderr);
        if (result.stopReason) outputBlockResponse(result.stopReason);
      }

      process.exit(0);
    } catch {
      // TCG-009: Top-level catch → fail-open
      process.exit(0);
    }
  })();
}
