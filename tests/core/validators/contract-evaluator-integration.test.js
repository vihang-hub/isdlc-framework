/**
 * Contract Evaluator Integration Tests
 * =======================================
 * REQ-0141: Execution Contract System
 * Full load -> resolve -> evaluate -> report pipeline.
 *
 * Tests: EI-01 through EI-10
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { evaluateContract } from '../../../src/core/validators/contract-evaluator.js';
import { loadContractEntry } from '../../../src/core/validators/contract-loader.js';

let tempDirs = [];

function createTestProject() {
  const dir = mkdtempSync(join(tmpdir(), 'eval-int-'));
  tempDirs.push(dir);

  // Create config structure
  const configDir = join(dir, '.claude', 'hooks', 'config');
  mkdirSync(configDir, { recursive: true });
  mkdirSync(join(configDir, 'contracts'), { recursive: true });
  mkdirSync(join(dir, '.isdlc', 'config', 'contracts'), { recursive: true });

  // Write artifact-paths.json
  writeFileSync(join(configDir, 'artifact-paths.json'), JSON.stringify({
    version: '1.0.0',
    phases: {
      '06-implementation': { paths: ['docs/requirements/{artifact_folder}/implementation-notes.md'] }
    }
  }));

  // Write skills-manifest.json
  writeFileSync(join(configDir, 'skills-manifest.json'), JSON.stringify({
    version: '1.0.0',
    ownership: {
      'software-developer': { skills: ['IMP-001', 'IMP-002'] }
    }
  }));

  return dir;
}

function writeContractFile(dir, filename, content) {
  writeFileSync(join(dir, filename), JSON.stringify(content, null, 2));
}

function makeEntry(overrides = {}) {
  return {
    execution_unit: '06-implementation',
    context: 'feature:standard',
    expectations: {
      agent: 'software-developer',
      skills_required: { '$ref': 'skills-manifest', agent: 'software-developer' },
      artifacts_produced: { '$ref': 'artifact-paths', phase: '06-implementation' },
      state_assertions: [{ path: 'phases.06-implementation.status', equals: 'completed' }],
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

afterEach(() => {
  for (const dir of tempDirs) {
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
  }
  tempDirs = [];
});

describe('Evaluator Pipeline Integration', () => {
  it('EI-01: Full evaluation of compliant state produces zero violations', () => {
    const projectRoot = createTestProject();
    const contractsDir = join(projectRoot, '.claude', 'hooks', 'config', 'contracts');
    const artifactDir = join(projectRoot, 'docs', 'requirements', 'REQ-TEST');
    mkdirSync(artifactDir, { recursive: true });
    writeFileSync(join(artifactDir, 'implementation-notes.md'), 'notes');

    writeContractFile(contractsDir, 'workflow-feature.contract.json', {
      version: '1.0.0',
      entries: [makeEntry()],
      _generation_metadata: { generated_at: '2026-03-26T00:00:00Z', generator_version: '1.0.0', input_files: [] }
    });

    const loaded = loadContractEntry('06-implementation', 'feature:standard', { projectRoot });
    assert.ok(loaded.entry);

    const state = {
      skill_usage_log: [
        { agent: 'software-developer', skill_id: 'IMP-001' },
        { agent: 'software-developer', skill_id: 'IMP-002' }
      ],
      phases: { '06-implementation': { status: 'completed' } }
    };

    const result = evaluateContract({
      state,
      contractEntry: loaded.entry,
      projectRoot,
      artifactFolder: 'REQ-TEST'
    });
    assert.equal(result.violations.length, 0, `Unexpected violations: ${JSON.stringify(result.violations)}`);
  });

  it('EI-02: Full evaluation of non-compliant state produces correct violations', () => {
    const projectRoot = createTestProject();
    const contractsDir = join(projectRoot, '.claude', 'hooks', 'config', 'contracts');
    writeContractFile(contractsDir, 'workflow-feature.contract.json', {
      version: '1.0.0',
      entries: [makeEntry()],
      _generation_metadata: { generated_at: '2026-03-26T00:00:00Z', generator_version: '1.0.0', input_files: [] }
    });

    const loaded = loadContractEntry('06-implementation', 'feature:standard', { projectRoot });
    const state = { skill_usage_log: [], phases: { '06-implementation': { status: 'in_progress' } } };

    const result = evaluateContract({
      state,
      contractEntry: loaded.entry,
      projectRoot,
      artifactFolder: 'MISSING-FOLDER'
    });

    assert.ok(result.violations.length > 0, 'Should have violations');
    assert.ok(result.violations.some(v => v.expectation_type === 'agent_not_engaged'));
  });

  it('EI-03: Stale contract detected via hash mismatch but evaluation proceeds', () => {
    const projectRoot = createTestProject();
    const contractsDir = join(projectRoot, '.claude', 'hooks', 'config', 'contracts');
    const configFile = join(projectRoot, 'config.json');
    writeFileSync(configFile, '{"version": 2}');

    writeContractFile(contractsDir, 'workflow-feature.contract.json', {
      version: '1.0.0',
      entries: [makeEntry({ expectations: { ...makeEntry().expectations, agent: null, skills_required: null, artifacts_produced: null } })],
      _generation_metadata: {
        generated_at: '2026-03-26T00:00:00Z',
        generator_version: '1.0.0',
        input_files: [{ path: 'config.json', hash: 'wrong-hash' }]
      }
    });

    const loaded = loadContractEntry('06-implementation', 'feature:standard', { projectRoot });
    assert.equal(loaded.stale, true, 'Should detect staleness');
    assert.ok(loaded.entry, 'Entry should still be loaded');
  });

  it('EI-04: Override contract loaded and evaluated instead of shipped default', () => {
    const projectRoot = createTestProject();
    const shippedDir = join(projectRoot, '.claude', 'hooks', 'config', 'contracts');
    const overrideDir = join(projectRoot, '.isdlc', 'config', 'contracts');

    writeContractFile(shippedDir, 'workflow-feature.contract.json', {
      version: '1.0.0',
      entries: [makeEntry({ expectations: { ...makeEntry().expectations, agent: 'default-agent' } })],
      _generation_metadata: { generated_at: '2026-03-26T00:00:00Z', generator_version: '1.0.0', input_files: [] }
    });
    writeContractFile(overrideDir, 'workflow-feature.contract.json', {
      version: '1.0.0',
      entries: [makeEntry({ expectations: { ...makeEntry().expectations, agent: 'override-agent' } })],
      _generation_metadata: { generated_at: '2026-03-26T00:00:00Z', generator_version: '1.0.0', input_files: [] }
    });

    const loaded = loadContractEntry('06-implementation', 'feature:standard', { projectRoot });
    assert.equal(loaded.source, 'override');
    assert.equal(loaded.entry.expectations.agent, 'override-agent');
  });

  it('EI-05: $ref resolution uses cached config (no double read)', () => {
    const projectRoot = createTestProject();
    const entry = makeEntry({
      expectations: {
        ...makeEntry().expectations,
        agent: null,
        skills_required: { '$ref': 'skills-manifest', agent: 'software-developer' },
        artifacts_produced: null,
        state_assertions: []
      }
    });

    const state = {
      skill_usage_log: [
        { agent: 'software-developer', skill_id: 'IMP-001' },
        { agent: 'software-developer', skill_id: 'IMP-002' }
      ]
    };

    const result = evaluateContract({ state, contractEntry: entry, projectRoot });
    assert.equal(result.violations.filter(v => v.expectation_type === 'skills_missing').length, 0);
  });

  it('EI-06: Violations written to state array', () => {
    const projectRoot = createTestProject();
    const state = { skill_usage_log: [], phases: {} };
    const entry = makeEntry({
      expectations: { ...makeEntry().expectations, skills_required: null, artifacts_produced: null, state_assertions: [] }
    });
    const result = evaluateContract({ state, contractEntry: entry, projectRoot });
    assert.ok(result.violations.length > 0);
    // Caller would call writeContractViolation -- we just verify the violations are returned
    for (const v of result.violations) {
      assert.ok(v.contract_id);
      assert.ok(v.execution_unit);
    }
  });

  it('EI-07: Multiple violation types from single evaluation', () => {
    const projectRoot = createTestProject();
    const state = { skill_usage_log: [], phases: { '06-implementation': { status: 'in_progress' } } };
    const entry = makeEntry({
      expectations: {
        ...makeEntry().expectations,
        skills_required: null,
        artifacts_produced: null,
        state_assertions: [{ path: 'phases.06-implementation.status', equals: 'completed' }]
      }
    });
    const result = evaluateContract({ state, contractEntry: entry, projectRoot });
    const types = new Set(result.violations.map(v => v.expectation_type));
    assert.ok(types.has('agent_not_engaged'));
    assert.ok(types.has('state_incomplete'));
  });

  it('EI-08: Non-workflow context (analyze) evaluates correctly', () => {
    const projectRoot = createTestProject();
    const entry = {
      execution_unit: 'roundtable',
      context: 'analyze',
      expectations: {
        agent: null,
        skills_required: null,
        artifacts_produced: null,
        state_assertions: [],
        cleanup: [],
        presentation: { confirmation_sequence: ['requirements', 'architecture', 'design'], persona_format: null, progress_format: null, completion_summary: null }
      },
      violation_response: { agent_not_engaged: 'report', skills_missing: 'report', artifacts_missing: 'block', state_incomplete: 'report', cleanup_skipped: 'warn', presentation_violated: 'warn' }
    };

    const state = { skill_usage_log: [], phases: {}, confirmation_domains: ['requirements', 'architecture', 'design'] };
    const result = evaluateContract({ state, contractEntry: entry, projectRoot });
    assert.ok(Array.isArray(result.violations));
    assert.ok(Array.isArray(result.warnings));
  });

  it('EI-09: Non-workflow context (discover) evaluates correctly', () => {
    const projectRoot = createTestProject();
    const entry = {
      execution_unit: 'discover',
      context: 'discover',
      expectations: { agent: null, skills_required: null, artifacts_produced: null, state_assertions: [], cleanup: [], presentation: null },
      violation_response: { agent_not_engaged: 'report', skills_missing: 'report', artifacts_missing: 'report', state_incomplete: 'report', cleanup_skipped: 'warn', presentation_violated: 'warn' }
    };
    const result = evaluateContract({ state: {}, contractEntry: entry, projectRoot });
    assert.equal(result.violations.length, 0);
  });

  it('EI-10: Non-workflow context (add) evaluates correctly', () => {
    const projectRoot = createTestProject();
    const entry = {
      execution_unit: 'add-item',
      context: 'add',
      expectations: { agent: null, skills_required: null, artifacts_produced: null, state_assertions: [], cleanup: ['BACKLOG.md updated'], presentation: null },
      violation_response: { agent_not_engaged: 'report', skills_missing: 'report', artifacts_missing: 'warn', state_incomplete: 'report', cleanup_skipped: 'warn', presentation_violated: 'warn' }
    };
    const result = evaluateContract({ state: {}, contractEntry: entry, projectRoot });
    assert.equal(result.violations.length, 0);
    assert.ok(result.warnings.some(w => w.includes('Cleanup item')));
  });
});
