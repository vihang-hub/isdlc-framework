/**
 * Tests for src/core/backlog/slug.js
 * REQ-0083: Extract BacklogService
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { generateSlug } from '../../../src/core/backlog/slug.js';

describe('generateSlug', () => {
  it('converts description to lowercase kebab-case', () => {
    assert.strictEqual(generateSlug('Add User Authentication'), 'add-user-authentication');
  });

  it('removes special characters', () => {
    assert.strictEqual(generateSlug('Fix bug #42: crash on login'), 'fix-bug-42-crash-on-login');
  });

  it('collapses multiple hyphens', () => {
    assert.strictEqual(generateSlug('hello   world---test'), 'hello-world-test');
  });

  it('trims leading/trailing hyphens', () => {
    assert.strictEqual(generateSlug('-leading and trailing-'), 'leading-and-trailing');
  });

  it('truncates to 50 characters', () => {
    const long = 'a'.repeat(100);
    assert.ok(generateSlug(long).length <= 50);
  });

  it('returns untitled-item for empty input', () => {
    assert.strictEqual(generateSlug(''), 'untitled-item');
    assert.strictEqual(generateSlug(null), 'untitled-item');
    assert.strictEqual(generateSlug(undefined), 'untitled-item');
  });

  it('returns untitled-item for all-special-char input', () => {
    assert.strictEqual(generateSlug('!!!@@@###'), 'untitled-item');
  });
});
