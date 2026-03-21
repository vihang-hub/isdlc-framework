/**
 * Source Detection
 * =================
 * Detects the source type from user input (GitHub, Jira, manual).
 *
 * Extracted from three-verb-utils.cjs (REQ-0083).
 * Traces: FR-001 (AC-001-03), VR-SOURCE-001..003, REQ-0032 FR-005
 *
 * @module src/core/backlog/source-detection
 */

/**
 * Detects the source type from add verb input.
 * @param {string} input - Raw user input
 * @param {object} [options] - Optional issue tracker preference
 * @returns {{ source: string, source_id: string|null, description: string }}
 */
export function detectSource(input, options) {
  if (!input || typeof input !== 'string') {
    return { source: 'manual', source_id: null, description: '' };
  }

  const trimmed = input.trim();

  const ghMatch = trimmed.match(/^#(\d+)$/);
  if (ghMatch) {
    return { source: 'github', source_id: `GH-${ghMatch[1]}`, description: trimmed };
  }

  const jiraMatch = trimmed.match(/^([A-Z]+-\d+)$/);
  if (jiraMatch) {
    return { source: 'jira', source_id: jiraMatch[1], description: trimmed };
  }

  if (options && typeof options === 'object' && /^\d+$/.test(trimmed)) {
    const tracker = options.issueTracker;

    if (tracker === 'jira' && options.jiraProjectKey) {
      const composedId = `${options.jiraProjectKey}-${trimmed}`;
      return { source: 'jira', source_id: composedId, description: composedId };
    }

    if (tracker === 'github') {
      return { source: 'github', source_id: `GH-${trimmed}`, description: `#${trimmed}` };
    }
  }

  return { source: 'manual', source_id: null, description: trimmed };
}
