/**
 * Contract Loader Tests
 * =======================
 * REQ-0141: Execution Contract System (FR-002, FR-006, FR-008)
 * AC-002-01 through AC-002-06, AC-006-01 through AC-006-04, AC-008-03
 *
 * Tests: CL-01 through CL-20
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { loadContractEntry, checkStaleness } from '../../../src/core/validators/contract-loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = join(__dirname, 'fixtures');

// ---------------------------------------------------------------------------
// Temp dir helper
// ---------------------------------------------------------------------------

let tempDirs = [];

function createTempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'contract-loader-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs) {
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
  }
  tempDirs = [];
});

function writeContractFile(dir, filename, content) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), JSON.stringify(content, null, 2));
}

function makeContract(entries, metadata = {}) {
  return {
    version: '1.0.0',
    entries,
    _generation_metadata: {
      generated_at: '2026-03-26T00:00:00.000Z',
      generator_version: '1.0.0',
      input_files: [],
      ...metadata
    }
  };
}

function makeEntry(overrides = {}) {
  return {
    execution_unit: '06-implementation',
    context: 'feature:standard',
    expectations: {
      agent: 'software-developer',
      skills_required: null,
      artifacts_produced: null,
      state_assertions: [],
      cleanup: [],
      presentation: null
    },
    violation_response: {
      agent_not_engaged: 'block',
      skills_missing: 'report',
      artifacts_missing: 'block',
      state_incomplete: 'report',
      cleanup_skipped: 'warn',
      presentation_violated: 'warn'
    },
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// Positive tests
// ---------------------------------------------------------------------------

describe('Contract Loader - positive tests', () => {
  it('CL-01: loadContractEntry returns entry from shipped contracts when no override exists', () => {
    const tempDir = createTempDir();
    const shippedDir = join(tempDir, 'shipped');
    writeContractFile(shippedDir, 'workflow-feature.contract.json', makeContract([makeEntry()]));

    const result = loadContractEntry('06-implementation', 'feature:standard', {
      projectRoot: tempDir,
      shippedPath: shippedDir,
      overridePath: join(tempDir, 'override-nonexistent')
    });

    assert.ok(result.entry);
    assert.equal(result.entry.execution_unit, '06-implementation');
  });

  it('CL-02: loadContractEntry returns entry from override contracts when override exists', () => {
    const tempDir = createTempDir();
    const shippedDir = join(tempDir, 'shipped');
    const overrideDir = join(tempDir, 'override');
    writeContractFile(shippedDir, 'workflow-feature.contract.json', makeContract([makeEntry()]));
    writeContractFile(overrideDir, 'workflow-feature.contract.json',
      makeContract([makeEntry({ expectations: { ...makeEntry().expectations, agent: 'custom-agent' } })])
    );

    const result = loadContractEntry('06-implementation', 'feature:standard', {
      projectRoot: tempDir,
      shippedPath: shippedDir,
      overridePath: overrideDir
    });

    assert.ok(result.entry);
    assert.equal(result.entry.expectations.agent, 'custom-agent');
  });

  it('CL-03: loadContractEntry returns source: shipped for shipped contracts', () => {
    const tempDir = createTempDir();
    const shippedDir = join(tempDir, 'shipped');
    writeContractFile(shippedDir, 'workflow-feature.contract.json', makeContract([makeEntry()]));

    const result = loadContractEntry('06-implementation', 'feature:standard', {
      projectRoot: tempDir,
      shippedPath: shippedDir,
      overridePath: join(tempDir, 'none')
    });
    assert.equal(result.source, 'shipped');
  });

  it('CL-04: loadContractEntry returns source: override for override contracts', () => {
    const tempDir = createTempDir();
    const overrideDir = join(tempDir, 'override');
    writeContractFile(overrideDir, 'workflow-feature.contract.json', makeContract([makeEntry()]));

    const result = loadContractEntry('06-implementation', 'feature:standard', {
      projectRoot: tempDir,
      shippedPath: join(tempDir, 'none'),
      overridePath: overrideDir
    });
    assert.equal(result.source, 'override');
  });

  it('CL-05: loadContractEntry matches by execution_unit + context key', () => {
    const tempDir = createTempDir();
    const shippedDir = join(tempDir, 'shipped');
    writeContractFile(shippedDir, 'workflow-feature.contract.json', makeContract([
      makeEntry({ execution_unit: '01-requirements', context: 'feature:standard' }),
      makeEntry({ execution_unit: '06-implementation', context: 'feature:standard' })
    ]));

    const result = loadContractEntry('06-implementation', 'feature:standard', {
      projectRoot: tempDir,
      shippedPath: shippedDir,
      overridePath: join(tempDir, 'none')
    });
    assert.ok(result.entry);
    assert.equal(result.entry.execution_unit, '06-implementation');
  });

  it('CL-06: checkStaleness returns stale: false when hashes match', () => {
    const tempDir = createTempDir();
    const testFile = join(tempDir, 'test-config.json');
    writeFileSync(testFile, '{"key": "value"}');
    const hash = createHash('sha256').update('{"key": "value"}').digest('hex');

    const result = checkStaleness(
      { input_files: [{ path: 'test-config.json', hash }] },
      tempDir
    );
    assert.equal(result.stale, false);
  });

  it('CL-07: checkStaleness returns stale: true with changed file list when hashes differ', () => {
    const tempDir = createTempDir();
    const testFile = join(tempDir, 'test-config.json');
    writeFileSync(testFile, '{"key": "changed"}');
    const wrongHash = createHash('sha256').update('{"key": "original"}').digest('hex');

    const result = checkStaleness(
      { input_files: [{ path: 'test-config.json', hash: wrongHash }] },
      tempDir
    );
    assert.equal(result.stale, true);
    assert.ok(result.changedFiles.includes('test-config.json'));
  });

  it('CL-08: loadContractEntry detects staleness and sets stale: true', () => {
    const tempDir = createTempDir();
    const shippedDir = join(tempDir, 'shipped');
    const testFile = join(tempDir, 'some-config.json');
    writeFileSync(testFile, '{"changed": true}');

    writeContractFile(shippedDir, 'workflow-feature.contract.json', makeContract(
      [makeEntry()],
      { input_files: [{ path: 'some-config.json', hash: 'wrong-hash' }] }
    ));

    const result = loadContractEntry('06-implementation', 'feature:standard', {
      projectRoot: tempDir,
      shippedPath: shippedDir,
      overridePath: join(tempDir, 'none')
    });
    assert.equal(result.stale, true);
  });

  it('CL-09: loadContractEntry reads _generation_metadata.input_files for hash check', () => {
    const tempDir = createTempDir();
    const shippedDir = join(tempDir, 'shipped');
    const testFile = join(tempDir, 'config.json');
    writeFileSync(testFile, '{"ok": true}');
    const hash = createHash('sha256').update('{"ok": true}').digest('hex');

    writeContractFile(shippedDir, 'workflow-feature.contract.json', makeContract(
      [makeEntry()],
      { input_files: [{ path: 'config.json', hash }] }
    ));

    const result = loadContractEntry('06-implementation', 'feature:standard', {
      projectRoot: tempDir,
      shippedPath: shippedDir,
      overridePath: join(tempDir, 'none')
    });
    assert.equal(result.stale, false);
  });
});

// ---------------------------------------------------------------------------
// Negative tests
// ---------------------------------------------------------------------------

describe('Contract Loader - negative tests', () => {
  it('CL-10: loadContractEntry returns { entry: null, source: null } when no contract found', () => {
    const result = loadContractEntry('nonexistent-phase', 'nonexistent:context', {
      projectRoot: '/nonexistent',
      shippedPath: '/nonexistent/shipped',
      overridePath: '/nonexistent/override'
    });
    assert.equal(result.entry, null);
    assert.equal(result.source, null);
  });

  it('CL-11: loadContractEntry handles malformed JSON in contract file gracefully', () => {
    const tempDir = createTempDir();
    const shippedDir = join(tempDir, 'shipped');
    mkdirSync(shippedDir, { recursive: true });
    writeFileSync(join(shippedDir, 'bad.contract.json'), '{not valid json');

    const result = loadContractEntry('06-implementation', 'feature:standard', {
      projectRoot: tempDir,
      shippedPath: shippedDir,
      overridePath: join(tempDir, 'none')
    });
    assert.equal(result.entry, null);
  });

  it('CL-12: loadContractEntry handles missing shipped contracts directory', () => {
    const result = loadContractEntry('06-implementation', 'feature:standard', {
      projectRoot: '/nonexistent',
      shippedPath: '/nonexistent/shipped',
      overridePath: '/nonexistent/override'
    });
    assert.equal(result.entry, null);
  });

  it('CL-13: loadContractEntry handles missing override contracts directory', () => {
    const tempDir = createTempDir();
    const shippedDir = join(tempDir, 'shipped');
    writeContractFile(shippedDir, 'workflow-feature.contract.json', makeContract([makeEntry()]));

    const result = loadContractEntry('06-implementation', 'feature:standard', {
      projectRoot: tempDir,
      shippedPath: shippedDir,
      overridePath: join(tempDir, 'nonexistent-override')
    });
    assert.ok(result.entry);
    assert.equal(result.source, 'shipped');
  });

  it('CL-14: checkStaleness handles missing input file (file deleted after generation)', () => {
    const result = checkStaleness(
      { input_files: [{ path: 'deleted-file.json', hash: 'abc123' }] },
      '/nonexistent'
    );
    assert.equal(result.stale, true);
    assert.ok(result.changedFiles.includes('deleted-file.json'));
  });

  it('CL-15: checkStaleness handles unreadable input file', () => {
    const result = checkStaleness(
      { input_files: [{ path: '/dev/null/impossible', hash: 'abc' }] },
      '/'
    );
    // Should treat unreadable as changed
    assert.equal(result.stale, true);
  });
});

// ---------------------------------------------------------------------------
// Override resolution tests (ADR-007)
// ---------------------------------------------------------------------------

describe('Contract Loader - override resolution (ADR-007)', () => {
  it('CL-16: Override replaces shipped entry completely (full replacement, not deep merge)', () => {
    const tempDir = createTempDir();
    const shippedDir = join(tempDir, 'shipped');
    const overrideDir = join(tempDir, 'override');

    const shippedEntry = makeEntry({
      violation_response: { ...makeEntry().violation_response, skills_missing: 'block' }
    });
    const overrideEntry = makeEntry({
      violation_response: { agent_not_engaged: 'warn', skills_missing: 'report', artifacts_missing: 'report', state_incomplete: 'report', cleanup_skipped: 'report', presentation_violated: 'report' }
    });

    writeContractFile(shippedDir, 'workflow-feature.contract.json', makeContract([shippedEntry]));
    writeContractFile(overrideDir, 'workflow-feature.contract.json', makeContract([overrideEntry]));

    const result = loadContractEntry('06-implementation', 'feature:standard', {
      projectRoot: tempDir,
      shippedPath: shippedDir,
      overridePath: overrideDir
    });

    // Override should be used (full replacement)
    assert.equal(result.entry.violation_response.agent_not_engaged, 'warn');
    assert.equal(result.source, 'override');
  });

  it('CL-17: Override for one execution_unit does not affect other execution_units', () => {
    const tempDir = createTempDir();
    const shippedDir = join(tempDir, 'shipped');
    const overrideDir = join(tempDir, 'override');

    writeContractFile(shippedDir, 'workflow-feature.contract.json', makeContract([
      makeEntry({ execution_unit: '01-requirements' }),
      makeEntry({ execution_unit: '06-implementation' })
    ]));
    writeContractFile(overrideDir, 'workflow-feature.contract.json', makeContract([
      makeEntry({ execution_unit: '06-implementation', expectations: { ...makeEntry().expectations, agent: 'custom' } })
    ]));

    // 01-requirements should come from shipped
    const req = loadContractEntry('01-requirements', 'feature:standard', {
      projectRoot: tempDir, shippedPath: shippedDir, overridePath: overrideDir
    });
    assert.equal(req.source, 'shipped');

    // 06-implementation should come from override
    const impl = loadContractEntry('06-implementation', 'feature:standard', {
      projectRoot: tempDir, shippedPath: shippedDir, overridePath: overrideDir
    });
    assert.equal(impl.source, 'override');
  });

  it('CL-18: Shipped entry used when override file exists but has no matching entry', () => {
    const tempDir = createTempDir();
    const shippedDir = join(tempDir, 'shipped');
    const overrideDir = join(tempDir, 'override');

    writeContractFile(shippedDir, 'workflow-feature.contract.json', makeContract([makeEntry()]));
    writeContractFile(overrideDir, 'workflow-feature.contract.json', makeContract([
      makeEntry({ execution_unit: 'other-phase', context: 'other:context' })
    ]));

    const result = loadContractEntry('06-implementation', 'feature:standard', {
      projectRoot: tempDir, shippedPath: shippedDir, overridePath: overrideDir
    });
    assert.equal(result.source, 'shipped');
  });

  it('CL-19: Multiple contract files scanned correctly', () => {
    const tempDir = createTempDir();
    const shippedDir = join(tempDir, 'shipped');

    writeContractFile(shippedDir, 'workflow-feature.contract.json',
      makeContract([makeEntry({ execution_unit: '06-implementation', context: 'feature:standard' })])
    );
    writeContractFile(shippedDir, 'analyze.contract.json',
      makeContract([makeEntry({ execution_unit: 'roundtable', context: 'analyze' })])
    );

    const feature = loadContractEntry('06-implementation', 'feature:standard', {
      projectRoot: tempDir, shippedPath: shippedDir, overridePath: join(tempDir, 'none')
    });
    assert.ok(feature.entry);

    const analyze = loadContractEntry('roundtable', 'analyze', {
      projectRoot: tempDir, shippedPath: shippedDir, overridePath: join(tempDir, 'none')
    });
    assert.ok(analyze.entry);
  });
});

// ---------------------------------------------------------------------------
// Performance tests
// ---------------------------------------------------------------------------

describe('Contract Loader - performance', () => {
  it('CL-20: checkStaleness completes in under 100ms for typical input set', () => {
    const tempDir = createTempDir();
    const files = [];
    for (let i = 0; i < 7; i++) {
      const path = `config-${i}.json`;
      writeFileSync(join(tempDir, path), JSON.stringify({ index: i }));
      const hash = createHash('sha256').update(JSON.stringify({ index: i })).digest('hex');
      files.push({ path, hash });
    }

    const start = performance.now();
    checkStaleness({ input_files: files }, tempDir);
    const elapsed = performance.now() - start;

    assert.ok(elapsed < 100, `Staleness check took ${elapsed}ms, budget is 100ms`);
  });
});
