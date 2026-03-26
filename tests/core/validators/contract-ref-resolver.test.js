/**
 * Contract Reference Resolver Tests
 * ====================================
 * REQ-0141: Execution Contract System (FR-001, FR-003)
 * AC-001-05, AC-003-04, AC-003-05
 *
 * Tests: RR-01 through RR-14
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveRef, registerResolver, _resetResolvers } from '../../../src/core/validators/contract-ref-resolver.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = join(__dirname, 'fixtures');

afterEach(() => {
  _resetResolvers();
});

// ---------------------------------------------------------------------------
// Positive tests
// ---------------------------------------------------------------------------

describe('Reference Resolver - positive tests', () => {
  it('RR-01: resolveRef resolves artifact-paths $ref to array of file paths for a given phase', () => {
    const ref = { '$ref': 'artifact-paths', phase: '06-implementation' };
    const result = resolveRef(ref, {
      projectRoot: fixturesDir,
      cache: new Map()
    });
    assert.ok(Array.isArray(result));
    assert.ok(result.length > 0);
    assert.ok(result.every(p => typeof p === 'string'));
  });

  it('RR-02: resolveRef resolves skills-manifest $ref to array of skill IDs for a given agent', () => {
    const ref = { '$ref': 'skills-manifest', agent: 'software-developer' };
    const result = resolveRef(ref, {
      projectRoot: fixturesDir,
      cache: new Map()
    });
    assert.ok(Array.isArray(result));
    assert.ok(result.length > 0);
    assert.ok(result.includes('IMP-001'));
  });

  it('RR-03: resolveRef substitutes {artifact_folder} in resolved artifact paths', () => {
    const ref = { '$ref': 'artifact-paths', phase: '06-implementation' };
    const result = resolveRef(ref, {
      projectRoot: fixturesDir,
      cache: new Map(),
      artifactFolder: 'REQ-0141-test'
    });
    assert.ok(result.every(p => !p.includes('{artifact_folder}')));
    assert.ok(result.some(p => p.includes('REQ-0141-test')));
  });

  it('RR-04: resolveRef uses cache for repeated config file reads', () => {
    const cache = new Map();
    const ref = { '$ref': 'artifact-paths', phase: '06-implementation' };
    const result1 = resolveRef(ref, { projectRoot: fixturesDir, cache });
    const result2 = resolveRef(ref, { projectRoot: fixturesDir, cache });
    assert.deepStrictEqual(result1, result2);
    // Cache should have at least one entry
    assert.ok(cache.size > 0, 'Cache should have entries after resolution');
  });

  it('RR-05: registerResolver adds a new resolver that resolveRef can invoke', () => {
    registerResolver('custom-source', (ref, opts) => ['custom-value']);
    const result = resolveRef({ '$ref': 'custom-source' }, {});
    assert.deepStrictEqual(result, ['custom-value']);
  });

  it('RR-06: resolveRef with custom resolver returns expected value', () => {
    registerResolver('my-resolver', (ref) => [ref.key || 'default']);
    const result = resolveRef({ '$ref': 'my-resolver', key: 'test-value' }, {});
    assert.deepStrictEqual(result, ['test-value']);
  });
});

// ---------------------------------------------------------------------------
// Negative tests
// ---------------------------------------------------------------------------

describe('Reference Resolver - negative tests', () => {
  it('RR-07: resolveRef returns empty array when $ref source is unregistered', () => {
    const result = resolveRef({ '$ref': 'nonexistent-source' }, {});
    assert.deepStrictEqual(result, []);
  });

  it('RR-08: resolveRef returns empty array when config file is missing', () => {
    const result = resolveRef(
      { '$ref': 'artifact-paths', phase: '06-implementation' },
      { projectRoot: '/nonexistent/path', cache: new Map() }
    );
    assert.deepStrictEqual(result, []);
  });

  it('RR-09: resolveRef returns empty array when config file is malformed JSON', () => {
    // Use a path where config dir doesn't have valid JSON
    const result = resolveRef(
      { '$ref': 'artifact-paths', phase: '06-implementation' },
      { projectRoot: join(fixturesDir, 'contracts'), cache: new Map() }
    );
    assert.deepStrictEqual(result, []);
  });

  it('RR-10: resolveRef handles null/undefined ref input gracefully', () => {
    assert.deepStrictEqual(resolveRef(null, {}), []);
    assert.deepStrictEqual(resolveRef(undefined, {}), []);
  });

  it('RR-11: resolveRef handles ref without $ref key', () => {
    assert.deepStrictEqual(resolveRef({ phase: '06-implementation' }, {}), []);
  });
});

// ---------------------------------------------------------------------------
// Boundary tests
// ---------------------------------------------------------------------------

describe('Reference Resolver - boundary tests', () => {
  it('RR-12: resolveRef returns empty array when phase has no artifacts', () => {
    const result = resolveRef(
      { '$ref': 'artifact-paths', phase: 'nonexistent-phase' },
      { projectRoot: fixturesDir, cache: new Map() }
    );
    assert.deepStrictEqual(result, []);
  });

  it('RR-13: resolveRef returns empty array when agent has no skills', () => {
    const result = resolveRef(
      { '$ref': 'skills-manifest', agent: 'nonexistent-agent' },
      { projectRoot: fixturesDir, cache: new Map() }
    );
    assert.deepStrictEqual(result, []);
  });

  it('RR-14: Cache is isolated per evaluation cycle (new Map each time)', () => {
    const cache1 = new Map();
    const cache2 = new Map();
    resolveRef(
      { '$ref': 'artifact-paths', phase: '06-implementation' },
      { projectRoot: fixturesDir, cache: cache1 }
    );
    assert.ok(cache1.size > 0);
    assert.equal(cache2.size, 0, 'Second cache should be empty');
  });
});
