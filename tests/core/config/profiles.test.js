/**
 * Tests for src/core/config/ profile loading
 * REQ-0125: Move gate profiles to src/core/config/
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadCoreProfile, listCoreProfiles } from '../../../src/core/config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const coreProfilesDir = join(__dirname, '..', '..', '..', 'src', 'core', 'config', 'profiles');

describe('core profile files exist', () => {
  it('rapid.json exists in src/core/config/profiles', () => {
    assert.ok(existsSync(join(coreProfilesDir, 'rapid.json')));
  });

  it('standard.json exists in src/core/config/profiles', () => {
    assert.ok(existsSync(join(coreProfilesDir, 'standard.json')));
  });

  it('strict.json exists in src/core/config/profiles', () => {
    assert.ok(existsSync(join(coreProfilesDir, 'strict.json')));
  });
});

describe('loadCoreProfile', () => {
  it('loads rapid profile', () => {
    const profile = loadCoreProfile('rapid');
    assert.ok(profile);
    assert.strictEqual(profile.name, 'rapid');
  });

  it('loads standard profile', () => {
    const profile = loadCoreProfile('standard');
    assert.ok(profile);
    assert.strictEqual(profile.name, 'standard');
  });

  it('returns null for non-existent profile', () => {
    assert.strictEqual(loadCoreProfile('nonexistent'), null);
  });
});

describe('listCoreProfiles', () => {
  it('lists at least 3 profiles', () => {
    const profiles = listCoreProfiles();
    assert.ok(profiles.length >= 3);
    assert.ok(profiles.includes('rapid'));
    assert.ok(profiles.includes('standard'));
    assert.ok(profiles.includes('strict'));
  });
});
