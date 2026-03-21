/**
 * GitHub Operations
 * ==================
 * GitHub CLI interactions for issue management.
 *
 * Extracted from three-verb-utils.cjs (REQ-0083).
 * Traces: REQ-0034 FR-001, FR-004, FR-006
 *
 * @module src/core/backlog/github
 */

import { execSync } from 'node:child_process';

/**
 * Checks whether the GitHub CLI (gh) is installed and authenticated.
 * @returns {{ available: boolean, reason?: string }}
 */
export function checkGhAvailability() {
  try {
    execSync('gh --version', { timeout: 2000, stdio: 'pipe' });
  } catch {
    return { available: false, reason: 'not_installed' };
  }

  try {
    execSync('gh auth status', { timeout: 2000, stdio: 'pipe' });
  } catch {
    return { available: false, reason: 'not_authenticated' };
  }

  return { available: true };
}

/**
 * Searches GitHub issues using the gh CLI.
 * @param {string} query
 * @param {{ limit?: number, timeout?: number }} [options]
 * @returns {{ matches: Array<{number: number, title: string, state: string}>, error?: string }}
 */
export function searchGitHubIssues(query, options) {
  const limit = (options && options.limit) || 5;
  const timeout = (options && options.timeout) || 3000;

  const sanitized = query
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$')
    .replace(/`/g, '\\`');

  const cmd = `gh issue list --search "${sanitized}" --json number,title,state --limit ${limit}`;

  let output;
  try {
    output = execSync(cmd, { timeout, encoding: 'utf8', stdio: 'pipe' });
  } catch (e) {
    if (e.killed) return { matches: [], error: 'timeout' };
    return { matches: [], error: 'command_error' };
  }

  try {
    const parsed = JSON.parse(output);
    return { matches: parsed };
  } catch {
    return { matches: [], error: 'parse_error' };
  }
}

/**
 * Creates a new GitHub issue using the gh CLI.
 * @param {string} title
 * @param {string} [body]
 * @returns {{ number: number, url: string }|null}
 */
export function createGitHubIssue(title, body) {
  const effectiveBody = body || 'Created via iSDLC framework';

  const sanitizedTitle = title
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$')
    .replace(/`/g, '\\`');
  const sanitizedBody = effectiveBody
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$')
    .replace(/`/g, '\\`');

  const cmd = `gh issue create --title "${sanitizedTitle}" --body "${sanitizedBody}"`;

  let output;
  try {
    output = execSync(cmd, { timeout: 5000, encoding: 'utf8', stdio: 'pipe' });
  } catch {
    return null;
  }

  const urlMatch = output.match(/\/issues\/(\d+)/);
  if (!urlMatch) return null;

  return { number: parseInt(urlMatch[1], 10), url: output.trim() };
}
