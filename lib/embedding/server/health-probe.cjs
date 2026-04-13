/**
 * Embedding server health probe (PID-based, no HTTP).
 *
 * Reads the PID file written by lifecycle.js and checks whether the
 * process is alive using process.kill(pid, 0). This is a synchronous,
 * zero-latency check suitable for use inside the tool-router hook
 * where the total time budget is <100ms.
 *
 * REQ-GH-252 FR-002, AC-002-03, AC-002-05
 * Constitutional: Article X (fail-open) -- never throws, always returns a result.
 *
 * @module lib/embedding/server/health-probe
 */

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Probe whether the embedding server is alive by checking its PID file.
 *
 * @param {string} projectRoot - Absolute path to the project root
 * @returns {{ status: 'active'|'inactive'|'failed', pid?: number, error?: string }}
 */
function probeEmbeddingHealth(projectRoot) {
  try {
    if (!projectRoot || typeof projectRoot !== 'string') {
      return { status: 'failed', error: 'invalid_project_root' };
    }

    const pidFile = path.join(projectRoot, '.isdlc', 'logs', 'embedding-server.pid');

    // Check if PID file exists
    if (!fs.existsSync(pidFile)) {
      return { status: 'inactive', error: 'no_pid_file' };
    }

    // Read and parse PID
    const raw = fs.readFileSync(pidFile, 'utf8').trim();
    const pid = parseInt(raw, 10);

    if (isNaN(pid) || pid <= 0) {
      return { status: 'inactive', error: 'invalid_pid' };
    }

    // Check if process is alive (signal 0 = existence check)
    try {
      process.kill(pid, 0);
      return { status: 'active', pid };
    } catch (killErr) {
      // ESRCH = no such process, EPERM = process exists but no permission
      if (killErr.code === 'EPERM') {
        // Process exists but we lack permission -- treat as active
        return { status: 'active', pid };
      }
      return { status: 'inactive', error: 'process_dead' };
    }
  } catch (err) {
    // Article X: fail-open -- never throw, return a failed status
    return { status: 'failed', error: err.message || 'unknown_error' };
  }
}

module.exports = { probeEmbeddingHealth };
