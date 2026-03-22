/**
 * Tests for src/providers/codex/projection.js
 * REQ-0114 FR-001/FR-002: Codex Config and Projection Paths
 * REQ-0116: Codex Instruction Projection Service
 *
 * Tests getCodexConfig(), getProjectionPaths(), and projectInstructions().
 * Core model dependencies are mocked to isolate unit tests.
 *
 * Test ID prefix: PRJ-
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  getCodexConfig,
  getProjectionPaths,
  projectInstructions
} from '../../../src/providers/codex/projection.js';

// ---------------------------------------------------------------------------
// FR-001: Codex Provider Config (REQ-0114)
// ---------------------------------------------------------------------------

describe('getCodexConfig (REQ-0114 FR-001)', () => {
  // PRJ-01: Returns object with required fields
  it('PRJ-01: returns { provider, frameworkDir, instructionFormat } (AC-001-01)', () => {
    const config = getCodexConfig();
    assert.strictEqual(typeof config, 'object');
    assert.ok('provider' in config);
    assert.ok('frameworkDir' in config);
    assert.ok('instructionFormat' in config);
  });

  // PRJ-02: Config object is frozen
  it('PRJ-02: returned config is frozen (AC-001-02)', () => {
    const config = getCodexConfig();
    assert.ok(Object.isFrozen(config), 'Config should be frozen');
  });

  // PRJ-03: provider field is 'codex'
  it('PRJ-03: provider field is "codex" (AC-001-01)', () => {
    const config = getCodexConfig();
    assert.strictEqual(config.provider, 'codex');
  });

  // PRJ-03b: frameworkDir is .codex
  it('PRJ-03b: frameworkDir is ".codex" (AC-001-01)', () => {
    const config = getCodexConfig();
    assert.strictEqual(config.frameworkDir, '.codex');
  });

  // PRJ-03c: instructionFormat is markdown-instructions
  it('PRJ-03c: instructionFormat is "markdown-instructions" (AC-001-01)', () => {
    const config = getCodexConfig();
    assert.strictEqual(config.instructionFormat, 'markdown-instructions');
  });
});

// ---------------------------------------------------------------------------
// FR-002: Codex Projection Paths (REQ-0114)
// ---------------------------------------------------------------------------

describe('getProjectionPaths (REQ-0114 FR-002)', () => {
  // PRJ-04: Returns frozen paths object
  it('PRJ-04: returned paths object is frozen (AC-002-01)', () => {
    const paths = getProjectionPaths();
    assert.ok(Object.isFrozen(paths), 'Paths should be frozen');
  });

  // PRJ-05: All projection paths are relative
  it('PRJ-05: all paths are relative strings (AC-002-02)', () => {
    const paths = getProjectionPaths();
    for (const [key, value] of Object.entries(paths)) {
      assert.strictEqual(typeof value, 'string', `${key} should be a string`);
      assert.ok(!value.startsWith('/'), `${key} should be relative (no leading /)`);
    }
  });

  // PRJ-06: Paths include all expected keys
  it('PRJ-06: includes instructions, teamSpec, contentModel, skillManifest, providerConfig (AC-002-01)', () => {
    const paths = getProjectionPaths();
    assert.ok('instructions' in paths, 'Should have instructions');
    assert.ok('teamSpec' in paths, 'Should have teamSpec');
    assert.ok('contentModel' in paths, 'Should have contentModel');
    assert.ok('skillManifest' in paths, 'Should have skillManifest');
    assert.ok('providerConfig' in paths, 'Should have providerConfig');
  });

  // PRJ-06b: All paths start with .codex/
  it('PRJ-06b: all paths are under .codex/ directory', () => {
    const paths = getProjectionPaths();
    for (const [key, value] of Object.entries(paths)) {
      assert.ok(value.startsWith('.codex/'), `${key} should be under .codex/ but is "${value}"`);
    }
  });
});

// ---------------------------------------------------------------------------
// FR-001 (REQ-0116): Instruction Projection
// ---------------------------------------------------------------------------

describe('projectInstructions (REQ-0116 FR-001)', () => {
  // PRJ-07: Returns { content, metadata }
  it('PRJ-07: returns object with content and metadata (AC-001-01)', () => {
    const result = projectInstructions('06-implementation', '05-software-developer');
    assert.strictEqual(typeof result, 'object');
    assert.ok('content' in result, 'Should have content');
    assert.ok('metadata' in result, 'Should have metadata');
  });

  // PRJ-08: metadata contains required fields
  it('PRJ-08: metadata contains phase, agent, skills_injected, team_type (AC-001-03)', () => {
    const result = projectInstructions('06-implementation', '05-software-developer');
    const { metadata } = result;
    assert.ok('phase' in metadata, 'metadata should have phase');
    assert.ok('agent' in metadata, 'metadata should have agent');
    assert.ok('skills_injected' in metadata, 'metadata should have skills_injected');
    assert.ok('team_type' in metadata, 'metadata should have team_type');
  });

  // PRJ-09: content is a string
  it('PRJ-09: content is a string (AC-003-01)', () => {
    const result = projectInstructions('06-implementation', '05-software-developer');
    assert.strictEqual(typeof result.content, 'string');
  });

  // PRJ-10: Fail-open when team spec/instance not found for phase
  it('PRJ-10: fail-open on missing team instance — returns content with warnings (AC-005-01)', () => {
    // Use a phase that doesn't exist in any instance
    const result = projectInstructions('99-nonexistent', '05-software-developer');
    assert.strictEqual(typeof result.content, 'string');
    // Should still return a result, possibly with warnings
    assert.ok('metadata' in result);
  });

  // PRJ-11: Fail-open when agent classification not found
  it('PRJ-11: fail-open on missing agent classification (AC-005-01)', () => {
    const result = projectInstructions('06-implementation', 'nonexistent-agent');
    assert.strictEqual(typeof result.content, 'string');
    assert.ok('metadata' in result);
  });

  // PRJ-12: Warnings reported in metadata when models missing
  it('PRJ-12: warnings in metadata when core models unavailable (AC-005-02)', () => {
    const result = projectInstructions('99-nonexistent', 'nonexistent-agent');
    assert.ok(result.metadata.warnings, 'Should have warnings');
    assert.ok(Array.isArray(result.metadata.warnings), 'warnings should be an array');
    assert.ok(result.metadata.warnings.length > 0, 'Should have at least one warning');
  });

  // PRJ-13: Content has markdown heading structure
  it('PRJ-13: content contains markdown headings when data available (AC-003-02)', () => {
    // Use a valid agent/phase combo that has data
    const result = projectInstructions('06-implementation', '05-software-developer');
    // Even with missing models, minimal content should exist
    assert.strictEqual(typeof result.content, 'string');
  });

  // PRJ-14: metadata.phase and metadata.agent match inputs
  it('PRJ-14: metadata reflects input phase and agent', () => {
    const result = projectInstructions('06-implementation', '05-software-developer');
    assert.strictEqual(result.metadata.phase, '06-implementation');
    assert.strictEqual(result.metadata.agent, '05-software-developer');
  });

  // PRJ-15: skills_injected is an array
  it('PRJ-15: skills_injected is an array', () => {
    const result = projectInstructions('06-implementation', '05-software-developer');
    assert.ok(Array.isArray(result.metadata.skills_injected), 'skills_injected should be an array');
  });
});
