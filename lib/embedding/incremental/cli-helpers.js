/**
 * CLI helpers for `isdlc embedding generate --incremental`.
 *
 * REQ-GH-227 / FR-004, FR-005, FR-006 / AC-004-05, AC-005-02..04, AC-006-02..03
 * @module lib/embedding/incremental/cli-helpers
 */

/**
 * Detect the --incremental flag in argv.
 * @param {string[]} argv - Command-line args (post binary + script)
 * @returns {boolean}
 */
export function parseIncrementalFlag(argv) {
  if (!Array.isArray(argv)) return false;
  return argv.includes('--incremental');
}

/**
 * Translate an incremental error code to a user-friendly message.
 * @param {string} code
 * @param {{ deletedCount?: number }} [ctx]
 * @returns {string}
 */
export function translateErrorCode(code, ctx = {}) {
  switch (code) {
    case 'NO_PRIOR_PACKAGE':
      return 'No prior package to diff against. Run full generate now? [Y/n]';

    case 'LEGACY_PACKAGE_NO_HASHES':
      return 'Prior package is legacy (missing file_hashes manifest). Incremental cannot diff against it. Run full `isdlc embedding generate` to rebuild.';

    case 'DELETIONS_DETECTED': {
      const n = ctx.deletedCount || 0;
      return `File deletions detected (${n} files). Incremental cannot clean orphan vectors — search would return dead paths. Run full \`isdlc embedding generate\` to rebuild.`;
    }

    default:
      return `Incremental embedding failed: ${code}`;
  }
}

/**
 * Decide whether user response to the "Run full generate now?" prompt means Yes.
 * Default (empty) = Yes per convention [Y/n].
 * @param {string} response - Raw user input (trimmed)
 * @returns {boolean}
 */
export function shouldPromptFullGenerate(response) {
  if (response == null) return true;
  const r = String(response).trim().toLowerCase();
  if (r === '' || r === 'y' || r === 'yes') return true;
  return false;
}
