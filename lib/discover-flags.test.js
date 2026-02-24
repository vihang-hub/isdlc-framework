/**
 * discover-flags.test.js -- Command/flag text validation for discover.md
 *
 * REQ-0007-deep-discovery: Validates that discover.md contains correct
 * flag documentation after the --party/--classic to --deep migration.
 *
 * Test cases TC-D01 through TC-D08.
 *
 * @module discover-flags.test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const DISCOVER_CMD_PATH = join(__dirname, '..', 'src', 'claude', 'commands', 'discover.md');

describe('discover.md flag validation (REQ-0007)', () => {
  let content;

  function getContent() {
    if (!content) content = readFileSync(DISCOVER_CMD_PATH, 'utf-8');
    return content;
  }

  // TC-D01: options table does NOT contain --party as active option
  it('TC-D01: options table does not contain --party as active option', () => {
    const c = getContent();
    // Extract the Options table section specifically
    const optionsMatch = c.split('### Options');
    if (optionsMatch.length > 1) {
      const optionsSection = optionsMatch[1].split('###')[0] || '';
      const optionLines = optionsSection.split('\n').filter(l => l.startsWith('|'));
      const partyOption = optionLines.find(l => l.includes('`--party`'));
      assert.equal(partyOption, undefined, 'Options table still contains --party as active option');
    }
  });

  // TC-D02: options table does NOT contain --classic as active option
  it('TC-D02: options table does not contain --classic as active option', () => {
    const c = getContent();
    const optionsMatch = c.split('### Options');
    if (optionsMatch.length > 1) {
      const optionsSection = optionsMatch[1].split('###')[0] || '';
      const optionLines = optionsSection.split('\n').filter(l => l.startsWith('|'));
      const classicOption = optionLines.find(l => l.includes('`--classic`'));
      assert.equal(classicOption, undefined, 'Options table still contains --classic as active option');
    }
  });

  // TC-D03: options table contains --deep
  it('TC-D03: options table contains --deep', () => {
    const c = getContent();
    assert.ok(c.includes('`--deep'), 'discover.md missing --deep option');
  });

  // TC-D04: options table contains --verbose
  it('TC-D04: options table contains --verbose', () => {
    const c = getContent();
    assert.ok(c.includes('`--verbose`'), 'discover.md missing --verbose option');
  });

  // TC-D05: contains deprecated --party error message text
  it('TC-D05: contains deprecated --party error message', () => {
    const c = getContent();
    assert.ok(
      c.includes('--party flag has been replaced by --deep'),
      'Missing --party deprecation error message'
    );
  });

  // TC-D06: contains deprecated --classic error message text
  it('TC-D06: contains deprecated --classic error message', () => {
    const c = getContent();
    assert.ok(
      c.includes('--classic flag has been removed'),
      'Missing --classic deprecation error message'
    );
  });

  // TC-D07: examples section contains /discover --deep full
  it('TC-D07: examples section contains /discover --deep full', () => {
    const c = getContent();
    assert.ok(
      c.includes('/discover --deep full'),
      'Missing /discover --deep full example'
    );
  });

  // TC-D08: examples section does NOT contain /discover --party or /discover --classic
  it('TC-D08: examples do not contain /discover --party or /discover --classic', () => {
    const c = getContent();
    assert.ok(
      !c.includes('/discover --new --party'),
      'Examples still contain /discover --new --party'
    );
    assert.ok(
      !c.includes('/discover --new --classic'),
      'Examples still contain /discover --new --classic'
    );
    assert.ok(
      !c.includes('/discover --party'),
      'Examples still contain /discover --party'
    );
  });
});
