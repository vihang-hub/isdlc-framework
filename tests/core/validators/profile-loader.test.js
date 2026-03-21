/**
 * Tests for src/core/validators/profile-loader.js
 * REQ-0081: Extract ValidatorEngine
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  levenshtein,
  findClosestMatch,
  getBuiltinProfilesDir,
  resolveProfileOverrides,
  loadAllProfiles,
  KNOWN_OVERRIDE_KEYS
} from '../../../src/core/validators/profile-loader.js';

import { existsSync } from 'node:fs';

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    assert.strictEqual(levenshtein('abc', 'abc'), 0);
  });

  it('returns correct distance for different strings', () => {
    assert.strictEqual(levenshtein('kitten', 'sitting'), 3);
  });

  it('handles empty strings', () => {
    assert.strictEqual(levenshtein('', 'abc'), 3);
    assert.strictEqual(levenshtein('abc', ''), 3);
  });
});

describe('findClosestMatch', () => {
  it('finds closest candidate within max distance', () => {
    assert.strictEqual(findClosestMatch('tset_iteration', ['test_iteration', 'other'], 3), 'test_iteration');
  });

  it('returns null when no match within distance', () => {
    assert.strictEqual(findClosestMatch('xyz', ['abc', 'def'], 1), null);
  });
});

describe('getBuiltinProfilesDir', () => {
  it('returns a valid directory path', () => {
    const dir = getBuiltinProfilesDir();
    assert.ok(existsSync(dir), `Expected ${dir} to exist`);
  });
});

describe('KNOWN_OVERRIDE_KEYS', () => {
  it('contains expected keys', () => {
    assert.ok(KNOWN_OVERRIDE_KEYS.includes('test_iteration'));
    assert.ok(KNOWN_OVERRIDE_KEYS.includes('constitutional_validation'));
    assert.ok(KNOWN_OVERRIDE_KEYS.includes('interactive_elicitation'));
  });
});

describe('loadAllProfiles', () => {
  it('loads builtin profiles from core/config/profiles', () => {
    const registry = loadAllProfiles();
    assert.ok(registry.profiles instanceof Map);
    // Should have at least rapid, standard, strict
    assert.ok(registry.profiles.size >= 3, `Expected at least 3 profiles, got ${registry.profiles.size}`);
  });
});

describe('resolveProfileOverrides', () => {
  it('returns null for non-existent profile', () => {
    assert.strictEqual(resolveProfileOverrides('nonexistent', '06-implementation'), null);
  });
});
