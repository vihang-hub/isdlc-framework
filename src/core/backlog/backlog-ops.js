/**
 * Backlog Operations
 * ===================
 * BACKLOG.md marker updates and item appending.
 *
 * Extracted from three-verb-utils.cjs (REQ-0083).
 * Traces: FR-007, FR-001
 *
 * @module src/core/backlog/backlog-ops
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

/**
 * Regex for parsing BACKLOG.md item lines.
 */
const MARKER_REGEX = /^(\s*-\s+)(\d+\.\d+)\s+\[([ ~Ax])\]\s+(.+)$/;

/**
 * Parses a single BACKLOG.md line.
 * @param {string} line
 * @returns {{ prefix: string, itemNumber: string, marker: string, description: string }|null}
 */
export function parseBacklogLine(line) {
  const match = line.match(MARKER_REGEX);
  if (!match) return null;
  return {
    prefix: match[1],
    itemNumber: match[2],
    marker: match[3],
    description: match[4]
  };
}

/**
 * Updates the marker character for a backlog item matching the given slug.
 * @param {string} backlogPath - Absolute path to BACKLOG.md
 * @param {string} slug - The item slug to match against
 * @param {string} newMarker - One of ' ', '~', 'A', 'x'
 * @returns {boolean} True if a marker was updated
 */
export function updateBacklogMarker(backlogPath, slug, newMarker) {
  if (!existsSync(backlogPath)) return false;

  const content = readFileSync(backlogPath, 'utf8');
  const lines = content.split('\n');
  let updated = false;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(MARKER_REGEX);
    if (match) {
      const lineText = match[4];
      if (lineText.toLowerCase().includes(slug.toLowerCase()) ||
          slug.toLowerCase().includes(lineText.toLowerCase().replace(/\s+/g, '-'))) {
        lines[i] = match[1] + match[2] + ' [' + newMarker + '] ' + match[4];
        updated = true;
        break;
      }
    }
  }

  if (updated) {
    writeFileSync(backlogPath, lines.join('\n'));
  }

  return updated;
}

/**
 * Appends a new item to the Open section of BACKLOG.md.
 * @param {string} backlogPath - Absolute path to BACKLOG.md
 * @param {string} itemNumber - Item number (e.g., "16.2")
 * @param {string} description - Item description
 * @param {string} [marker=' '] - Marker character
 */
export function appendToBacklog(backlogPath, itemNumber, description, marker = ' ') {
  let content;

  if (!existsSync(backlogPath)) {
    content = '# Backlog\n\n## Open\n\n## Completed\n';
    writeFileSync(backlogPath, content);
  }

  content = readFileSync(backlogPath, 'utf8');
  const lines = content.split('\n');

  const openIndex = lines.findIndex(l => /^##\s+Open/.test(l));
  if (openIndex === -1) {
    lines.push('', '## Open', '');
    const newOpenIndex = lines.length - 1;
    const newLine = `- ${itemNumber} [${marker}] ${description}`;
    lines.splice(newOpenIndex, 0, newLine);
    writeFileSync(backlogPath, lines.join('\n'));
    return;
  }

  let insertIndex = openIndex + 1;
  while (insertIndex < lines.length && !/^##\s/.test(lines[insertIndex])) {
    insertIndex++;
  }

  const newLine = `- ${itemNumber} [${marker}] ${description}`;
  lines.splice(insertIndex, 0, newLine);
  writeFileSync(backlogPath, lines.join('\n'));
}
