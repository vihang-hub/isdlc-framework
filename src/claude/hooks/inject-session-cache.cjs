/**
 * SessionStart Hook: inject-session-cache.cjs
 *
 * Reads the pre-built session cache file and outputs its content to stdout,
 * where Claude Code injects it into the LLM context window.
 *
 * Self-contained: NO dependency on common.cjs (ADR-0027).
 * Fail-open: Any error results in no output and exit code 0.
 *
 * Traces to: FR-002, AC-002-01 through AC-002-05, NFR-003, NFR-008
 */
'use strict';

const fs = require('fs');
const path = require('path');

try {
    const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const cachePath = path.join(projectDir, '.isdlc', 'session-cache.md');
    const content = fs.readFileSync(cachePath, 'utf8');
    process.stdout.write(content);
} catch (_) {
    // Fail-open: no output, no error, exit 0
    // Covers: file not found, permissions error, read error
}
