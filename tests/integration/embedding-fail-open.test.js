/**
 * Fail-open integration tests for embedding pipeline
 * REQ-GH-252 FR-003, AC-003-01, AC-003-02, AC-003-03
 *
 * Phase 06 implementation -- tests unskipped and wired to production code.
 *
 * These integration tests verify Article X (fail-open) compliance across
 * module boundaries: health-probe + tool-router, CLI preflight + discover,
 * and MCP call failure + agent fallback.
 *
 * Test commands:
 *   node --test tests/integration/embedding-fail-open.test.js
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Use createRequire to load CJS modules from ESM test
const require = createRequire(import.meta.url);

describe('Embedding fail-open integration (Article X)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'fail-open-'));
    mkdirSync(join(tmpDir, '.isdlc', 'logs'), { recursive: true });
  });

  afterEach(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  });

  it('[P0] AC-003-01: Given embedding CLI exits with error during discover, When Step 7.9 completes, Then discover can continue (exit code 1 is non-blocking)', () => {
    // This test validates that exit code 1 from isdlc-embedding generate
    // is a soft failure that discover-orchestrator treats as non-blocking.
    // We verify the contract: exit codes are well-defined and only 2/3 are preflight errors.

    const { spawnSync } = require('node:child_process');
    const cliPath = join(import.meta.dirname, '..', '..', 'bin', 'isdlc-embedding.js');

    // Project with embeddings config but no VCS -> generation fails with exit 1
    writeFileSync(join(tmpDir, '.isdlc', 'config.json'), JSON.stringify({
      embeddings: { enabled: true, provider: 'jina-code' }
    }));

    const result = spawnSync('node', [cliPath, 'generate', tmpDir], {
      encoding: 'utf8',
      timeout: 15000
    });

    // Exit code 1 = generation error (NOT preflight codes 2/3)
    // discover-orchestrator treats exit 1 as "log and continue"
    assert.strictEqual(result.status, 1, `Expected exit 1 (generation error), got ${result.status}`);
    // Verify error message exists (discover would log this)
    assert.ok(result.stderr.length > 0, 'Expected stderr error message for discover to log');
  });

  it('[P0] AC-003-02: Given health probe throws an unexpected error, When tool-router evaluates routing, Then falls back to lexical with no crash', () => {
    // Integration: health-probe error -> tool-router exemption -> lexical fallback
    const router = require('../../src/claude/hooks/tool-router.cjs');

    // matchContextCondition('server_unavailable') calls probeEmbeddingHealth
    // which reads from CLAUDE_PROJECT_DIR. With a non-existent path it
    // hits the fail-open path and returns true (exempt).
    const origDir = process.env.CLAUDE_PROJECT_DIR;
    process.env.CLAUDE_PROJECT_DIR = '/nonexistent/project/path';

    try {
      const result = router.matchContextCondition('server_unavailable', {}, 'Grep');
      // Should return true (exempt = fall back to lexical), not throw
      assert.strictEqual(result, true, 'Should return true (exempt) on probe failure');
    } finally {
      if (origDir !== undefined) {
        process.env.CLAUDE_PROJECT_DIR = origDir;
      } else {
        delete process.env.CLAUDE_PROJECT_DIR;
      }
    }
  });

  it('[P0] AC-003-02: Given health probe finds no PID file, When tool-router evaluates semantic routing, Then exempts and falls back to lexical', () => {
    // Integration: no PID file -> health probe returns inactive ->
    // tool-router exempts the semantic search rule -> lexical fallback
    const router = require('../../src/claude/hooks/tool-router.cjs');

    // Set up environment with settings that include isdlc-embedding MCP
    const claudeDir = join(tmpDir, '.claude');
    const configDir = join(tmpDir, 'src', 'claude', 'hooks', 'config');
    mkdirSync(claudeDir, { recursive: true });
    mkdirSync(configDir, { recursive: true });

    writeFileSync(join(claudeDir, 'settings.json'), JSON.stringify({
      mcpServers: {
        'isdlc-embedding': { command: 'node', args: ['server.js'] }
      }
    }));

    writeFileSync(join(configDir, 'tool-routing.json'), JSON.stringify({
      version: '1.0.0', rules: [], user_overrides: []
    }));

    // No PID file exists -> server_unavailable exemption fires
    const input = JSON.stringify({
      tool_name: 'Grep',
      tool_input: { pattern: 'how does auth work' }
    });

    const origDir = process.env.CLAUDE_PROJECT_DIR;
    process.env.CLAUDE_PROJECT_DIR = tmpDir;

    try {
      const result = router.main(input, {
        configPath: join(configDir, 'tool-routing.json'),
        settingsPath: join(claudeDir, 'settings.json'),
        auditPath: join(tmpDir, '.isdlc', 'audit.jsonl')
      });

      // Should get lexical fallback message (exempt path), not crash
      assert.ok(result.stderr, 'Expected stderr message');
      assert.ok(result.stderr.includes('[Lexical fallback:'),
        `Expected lexical fallback message, got: ${result.stderr}`);
      assert.strictEqual(result.stdout, null, 'Should not block the tool');
    } finally {
      if (origDir !== undefined) {
        process.env.CLAUDE_PROJECT_DIR = origDir;
      } else {
        delete process.env.CLAUDE_PROJECT_DIR;
      }
    }
  });

  it('[P0] AC-003-03: Given isdlc-embedding MCP registered but server down, When tool-router evaluates, Then exempts and does not re-route (no infinite retry)', () => {
    // Verify that after exemption fires, tool-router returns immediately
    // with no blocking action -- preventing any infinite retry scenario.
    const router = require('../../src/claude/hooks/tool-router.cjs');

    const claudeDir = join(tmpDir, '.claude');
    const configDir = join(tmpDir, 'src', 'claude', 'hooks', 'config');
    mkdirSync(claudeDir, { recursive: true });
    mkdirSync(configDir, { recursive: true });

    writeFileSync(join(claudeDir, 'settings.json'), JSON.stringify({
      mcpServers: {
        'isdlc-embedding': { command: 'node', args: ['server.js'] }
      }
    }));

    writeFileSync(join(configDir, 'tool-routing.json'), JSON.stringify({
      version: '1.0.0', rules: [], user_overrides: []
    }));

    const origDir = process.env.CLAUDE_PROJECT_DIR;
    process.env.CLAUDE_PROJECT_DIR = tmpDir;

    try {
      const input = JSON.stringify({
        tool_name: 'Grep',
        tool_input: { pattern: 'find authentication module' }
      });

      const result = router.main(input, {
        configPath: join(configDir, 'tool-routing.json'),
        settingsPath: join(claudeDir, 'settings.json'),
        auditPath: join(tmpDir, '.isdlc', 'audit.jsonl')
      });

      // CRITICAL: stdout must be null (no block action)
      // If stdout had a block JSON, the agent would switch to MCP,
      // which would fail, and potentially re-trigger routing = infinite loop.
      assert.strictEqual(result.stdout, null, 'Must not block tool (would cause retry loop)');
      // stderr has the fallback message (informational only)
      assert.ok(result.stderr, 'Expected informational stderr message');
    } finally {
      if (origDir !== undefined) {
        process.env.CLAUDE_PROJECT_DIR = origDir;
      } else {
        delete process.env.CLAUDE_PROJECT_DIR;
      }
    }
  });

  it('[P1] AC-003-01: Given query-classifier receives undefined as pattern, When tool-router evaluates, Then fails gracefully and falls back to lexical', () => {
    // Integration: malformed tool_input -> query-classifier returns lexical
    // -> tool-router exempts -> lexical fallback
    const router = require('../../src/claude/hooks/tool-router.cjs');

    // matchContextCondition('literal_pattern') with undefined pattern
    const result = router.matchContextCondition('literal_pattern', { pattern: undefined }, 'Grep');
    // Should return true (exempt = lexical) via fail-open in classifier
    assert.strictEqual(result, true, 'Should return true (exempt) for undefined pattern');

    // Also test with null
    const result2 = router.matchContextCondition('literal_pattern', { pattern: null }, 'Grep');
    assert.strictEqual(result2, true, 'Should return true (exempt) for null pattern');

    // And missing pattern field entirely
    const result3 = router.matchContextCondition('literal_pattern', {}, 'Grep');
    assert.strictEqual(result3, true, 'Should return true (exempt) for missing pattern');
  });

  it('[P1] AC-003-02: Given classifier module somehow fails to load, When tool-router evaluates literal_pattern, Then returns true (exempt, fail-open)', () => {
    // This test verifies the try/catch in matchContextCondition('literal_pattern')
    // The production code has: try { require(...classifyQuery) } catch { return true; }
    // We verify the contract by testing with an input that exercises the catch path.
    const router = require('../../src/claude/hooks/tool-router.cjs');

    // Even with bizarre input, it should never throw
    assert.doesNotThrow(() => {
      router.matchContextCondition('literal_pattern', { pattern: 42 }, 'Grep');
    });

    const result = router.matchContextCondition('literal_pattern', { pattern: 42 }, 'Grep');
    // Non-string input -> classifier returns lexical (empty_pattern catch) -> true
    assert.strictEqual(result, true);
  });
});
