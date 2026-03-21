/**
 * Tests for src/core/backlog/backlog-ops.js
 * REQ-0083: Extract BacklogService
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  parseBacklogLine,
  updateBacklogMarker,
  appendToBacklog
} from '../../../src/core/backlog/backlog-ops.js';

describe('parseBacklogLine', () => {
  it('parses a valid backlog line', () => {
    const result = parseBacklogLine('- 1.1 [ ] Add user authentication');
    assert.ok(result);
    assert.strictEqual(result.itemNumber, '1.1');
    assert.strictEqual(result.marker, ' ');
    assert.strictEqual(result.description, 'Add user authentication');
  });

  it('parses line with analyzed marker', () => {
    const result = parseBacklogLine('- 2.3 [A] Complete feature');
    assert.ok(result);
    assert.strictEqual(result.marker, 'A');
  });

  it('returns null for non-matching lines', () => {
    assert.strictEqual(parseBacklogLine('# Header'), null);
    assert.strictEqual(parseBacklogLine('Random text'), null);
  });
});

describe('updateBacklogMarker', () => {
  let tmpDir;
  let backlogPath;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'isdlc-test-'));
    backlogPath = join(tmpDir, 'BACKLOG.md');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns false for non-existent file', () => {
    assert.strictEqual(updateBacklogMarker(backlogPath, 'test', 'A'), false);
  });

  it('updates marker for matching slug', () => {
    writeFileSync(backlogPath, '- 1.1 [ ] Add user authentication\n- 2.1 [ ] Other item\n');
    const result = updateBacklogMarker(backlogPath, 'add-user-authentication', 'A');
    assert.strictEqual(result, true);
    const content = readFileSync(backlogPath, 'utf8');
    assert.ok(content.includes('[A]'));
  });

  it('returns false when no slug matches', () => {
    writeFileSync(backlogPath, '- 1.1 [ ] Add user authentication\n');
    assert.strictEqual(updateBacklogMarker(backlogPath, 'nonexistent-slug', 'A'), false);
  });
});

describe('appendToBacklog', () => {
  let tmpDir;
  let backlogPath;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'isdlc-test-'));
    backlogPath = join(tmpDir, 'BACKLOG.md');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates backlog file if missing', () => {
    appendToBacklog(backlogPath, '1.1', 'New feature');
    const content = readFileSync(backlogPath, 'utf8');
    assert.ok(content.includes('1.1'));
    assert.ok(content.includes('New feature'));
  });

  it('appends to existing Open section', () => {
    writeFileSync(backlogPath, '# Backlog\n\n## Open\n\n- 1.1 [ ] Existing\n\n## Completed\n');
    appendToBacklog(backlogPath, '1.2', 'New item', 'A');
    const content = readFileSync(backlogPath, 'utf8');
    assert.ok(content.includes('1.2 [A] New item'));
  });
});
