/**
 * Tests for src/core/backlog/item-resolution.js
 * REQ-0083: Extract BacklogService
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { resolveItem, findDirForDescription } from '../../../src/core/backlog/item-resolution.js';

describe('resolveItem', () => {
  let tmpDir;
  let reqDir;
  let backlogPath;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'isdlc-test-'));
    reqDir = join(tmpDir, 'requirements');
    mkdirSync(reqDir, { recursive: true });
    backlogPath = join(tmpDir, 'BACKLOG.md');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null for empty input', () => {
    assert.strictEqual(resolveItem('', reqDir, backlogPath), null);
    assert.strictEqual(resolveItem(null, reqDir, backlogPath), null);
  });

  it('resolves exact slug match', () => {
    const slugDir = join(reqDir, 'my-feature');
    mkdirSync(slugDir);
    writeFileSync(join(slugDir, 'meta.json'), JSON.stringify({ description: 'My Feature' }));
    const result = resolveItem('my-feature', reqDir, backlogPath);
    assert.ok(result);
    assert.strictEqual(result.slug, 'my-feature');
  });

  it('resolves partial slug match', () => {
    const slugDir = join(reqDir, 'REQ-0001-my-feature');
    mkdirSync(slugDir);
    writeFileSync(join(slugDir, 'meta.json'), JSON.stringify({ description: 'My Feature' }));
    const result = resolveItem('my-feature', reqDir, backlogPath);
    assert.ok(result);
    assert.strictEqual(result.slug, 'REQ-0001-my-feature');
  });

  it('resolves by item number', () => {
    writeFileSync(backlogPath, '- 1.1 [ ] Add authentication\n');
    const result = resolveItem('1.1', reqDir, backlogPath);
    assert.ok(result);
    assert.strictEqual(result.itemNumber, '1.1');
  });

  it('returns null when nothing matches', () => {
    writeFileSync(backlogPath, '- 1.1 [ ] Add authentication\n');
    assert.strictEqual(resolveItem('completely-nonexistent-xyz', reqDir, backlogPath), null);
  });
});

describe('findDirForDescription', () => {
  let tmpDir;
  let reqDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'isdlc-test-'));
    reqDir = join(tmpDir, 'requirements');
    mkdirSync(reqDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null for non-existent dir', () => {
    assert.strictEqual(findDirForDescription('/nonexistent', 'test'), null);
  });

  it('finds exact match', () => {
    mkdirSync(join(reqDir, 'add-authentication'));
    const result = findDirForDescription(reqDir, 'Add Authentication');
    assert.ok(result);
    assert.ok(result.endsWith('add-authentication'));
  });

  it('finds suffix match', () => {
    mkdirSync(join(reqDir, 'REQ-0001-add-authentication'));
    const result = findDirForDescription(reqDir, 'Add Authentication');
    assert.ok(result);
  });
});
