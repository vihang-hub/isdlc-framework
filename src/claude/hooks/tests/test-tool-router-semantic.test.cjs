/**
 * Unit tests for tool-router semantic search integration
 * REQ-GH-252 FR-002, AC-002-01, AC-002-02, AC-002-03, AC-002-04
 *
 * Phase 06 implementation -- tests unskipped and wired to production code.
 *
 * Test commands:
 *   node --test src/claude/hooks/tests/test-tool-router-semantic.test.cjs
 */

'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Module under test
const router = require('../tool-router.cjs');

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

const SETTINGS_WITH_EMBEDDING_MCP = {
  mcpServers: {
    'code-index-mcp': { command: 'code-index-mcp', args: [] },
    'isdlc-embedding': { command: 'node', args: ['lib/embedding/mcp-server/index.js'] }
  }
};

const SETTINGS_WITHOUT_EMBEDDING_MCP = {
  mcpServers: {
    'code-index-mcp': { command: 'code-index-mcp', args: [] }
  }
};

// ---------------------------------------------------------------------------
// Test Environment Helpers
// ---------------------------------------------------------------------------

function setupTestEnv(settingsOverride) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tool-router-semantic-'));
  const claudeDir = path.join(tmpDir, '.claude');
  const isdlcDir = path.join(tmpDir, '.isdlc');
  const configDir = path.join(tmpDir, 'src', 'claude', 'hooks', 'config');

  fs.mkdirSync(claudeDir, { recursive: true });
  fs.mkdirSync(isdlcDir, { recursive: true });
  fs.mkdirSync(configDir, { recursive: true });

  const settings = settingsOverride !== undefined ? settingsOverride : SETTINGS_WITH_EMBEDDING_MCP;
  fs.writeFileSync(path.join(claudeDir, 'settings.json'), JSON.stringify(settings, null, 2));

  // Write minimal tool-routing.json
  fs.writeFileSync(path.join(configDir, 'tool-routing.json'), JSON.stringify({
    version: '1.0.0',
    rules: [],
    user_overrides: []
  }, null, 2));

  return {
    tmpDir,
    settingsPath: path.join(claudeDir, 'settings.json'),
    configPath: path.join(configDir, 'tool-routing.json')
  };
}

function cleanupTestEnv(tmpDir) {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Tests: inferEnvironmentRules extensions
// ---------------------------------------------------------------------------

describe('tool-router semantic search integration', () => {
  let env;

  afterEach(() => {
    if (env) cleanupTestEnv(env.tmpDir);
  });

  describe('inferEnvironmentRules — isdlc-embedding MCP detection', () => {
    it('[P0] AC-002-01: Given isdlc-embedding MCP registered in settings.json, When inferEnvironmentRules() is called, Then returns a rule with id "inferred-semantic-search" and intercept_tool "Grep"', () => {
      // Given: isdlc-embedding MCP registered in settings.json
      env = setupTestEnv(SETTINGS_WITH_EMBEDDING_MCP);
      // When: inferEnvironmentRules() is called
      const rules = router.inferEnvironmentRules(env.settingsPath);
      // Then: returns a rule with id 'inferred-semantic-search'
      const semanticRule = rules.find(r => r.id === 'inferred-semantic-search');
      assert.ok(semanticRule, 'Expected inferred-semantic-search rule');
      assert.strictEqual(semanticRule.intercept_tool, 'Grep');
      assert.strictEqual(semanticRule.preferred_tool, 'mcp__isdlc-embedding__isdlc_embedding_semantic_search');
      assert.strictEqual(semanticRule.enforcement, 'warn');
      assert.strictEqual(semanticRule.source, 'inferred');
    });

    it('[P0] AC-002-01: Given isdlc-embedding MCP NOT registered in settings.json, When inferEnvironmentRules() is called, Then no semantic search rule is emitted', () => {
      // Given: isdlc-embedding MCP NOT registered
      env = setupTestEnv(SETTINGS_WITHOUT_EMBEDDING_MCP);
      // When: inferEnvironmentRules() is called
      const rules = router.inferEnvironmentRules(env.settingsPath);
      // Then: no semantic search rule emitted
      const semanticRule = rules.find(r => r.id === 'inferred-semantic-search');
      assert.strictEqual(semanticRule, undefined);
    });

    it('[P0] AC-002-01: Given isdlc-embedding MCP registered, When inferEnvironmentRules() returns, Then semantic rule has literal_pattern and server_unavailable exemptions', () => {
      // Given: isdlc-embedding MCP registered
      env = setupTestEnv(SETTINGS_WITH_EMBEDDING_MCP);
      // When
      const rules = router.inferEnvironmentRules(env.settingsPath);
      const semanticRule = rules.find(r => r.id === 'inferred-semantic-search');
      // Then: exemptions include literal_pattern and server_unavailable
      assert.ok(semanticRule.exemptions, 'Expected exemptions array');
      const conditions = semanticRule.exemptions.map(e => e.condition);
      assert.ok(conditions.includes('literal_pattern'), 'Expected literal_pattern exemption');
      assert.ok(conditions.includes('server_unavailable'), 'Expected server_unavailable exemption');
    });
  });

  describe('matchContextCondition — literal_pattern exemption', () => {
    it('[P0] AC-002-02: Given camelCase query "inferEnvironmentRules", When matchContextCondition("literal_pattern", ...) is called, Then returns true (exempt)', () => {
      // Given: camelCase query
      // When
      const result = router.matchContextCondition('literal_pattern', { pattern: 'inferEnvironmentRules' }, 'Grep');
      // Then: returns true (exempt -- pattern is lexical)
      assert.strictEqual(result, true);
    });

    it('[P0] AC-002-01: Given natural-language query "where is error handling", When matchContextCondition("literal_pattern", ...) is called, Then returns false (not exempt -- route to semantic)', () => {
      // Given: natural-language query
      // When
      const result = router.matchContextCondition('literal_pattern', { pattern: 'where is error handling' }, 'Grep');
      // Then: returns false (not exempt -- should route to semantic search)
      assert.strictEqual(result, false);
    });

    it('[P0] AC-002-02: Given regex pattern "log.*Error", When matchContextCondition("literal_pattern", ...) is called, Then returns true (exempt)', () => {
      const result = router.matchContextCondition('literal_pattern', { pattern: 'log.*Error' }, 'Grep');
      assert.strictEqual(result, true);
    });

    it('[P0] AC-002-02: Given empty pattern, When matchContextCondition("literal_pattern", ...) is called, Then returns true (exempt -- fail-open)', () => {
      const result = router.matchContextCondition('literal_pattern', { pattern: '' }, 'Grep');
      assert.strictEqual(result, true);
    });

    it('[P1] AC-002-02: Given snake_case pattern "tool_router", When matchContextCondition("literal_pattern", ...) is called, Then returns true (exempt)', () => {
      const result = router.matchContextCondition('literal_pattern', { pattern: 'tool_router' }, 'Grep');
      assert.strictEqual(result, true);
    });
  });

  describe('matchContextCondition — server_unavailable exemption', () => {
    it('[P0] AC-002-03: Given embedding server not running (no PID file), When matchContextCondition("server_unavailable", ...) is called, Then returns true (exempt -- fall back to lexical)', () => {
      // Given: embedding server not running (no PID file in the CLAUDE_PROJECT_DIR)
      // The default project dir won't have the PID file, so the probe returns inactive
      // When
      const result = router.matchContextCondition('server_unavailable', {}, 'Grep');
      // Then: returns true (exempt -- server unavailable)
      assert.strictEqual(result, true);
    });
  });

  describe('formatWarnMessage — routing messages', () => {
    const semanticRule = {
      id: 'inferred-semantic-search',
      operation: 'semantic_search',
      intercept_tool: 'Grep',
      preferred_tool: 'mcp__isdlc-embedding__isdlc_embedding_semantic_search',
      enforcement: 'warn',
      source: 'inferred'
    };

    it('[P1] AC-002-04: Given routing to semantic search (no exemption), When formatWarnMessage() is called, Then message contains "[Semantic search]"', () => {
      // Given: routing to semantic search (no exemption triggered)
      // When
      const msg = router.formatWarnMessage(semanticRule, { pattern: 'how does auth work' }, '/fake/config.json');
      // Then: message contains "[Semantic search]"
      assert.ok(msg.includes('[Semantic search]'), `Expected "[Semantic search]" in: ${msg}`);
      assert.ok(msg.includes('mcp__isdlc-embedding__isdlc_embedding_semantic_search'), 'Expected preferred tool in message');
    });

    it('[P1] AC-002-04: Given lexical fallback due to camelCase pattern, When formatWarnMessage() is called with exemption, Then message contains "[Lexical fallback: camelCase]"', () => {
      // Given: lexical fallback due to camelCase pattern
      const exemption = { type: 'context', condition: 'literal_pattern', signal: 'query_is_lexical' };
      // When
      const msg = router.formatWarnMessage(semanticRule, { pattern: 'inferEnvironmentRules' }, '/fake/config.json', exemption);
      // Then: message contains "[Lexical fallback: camelCase]"
      assert.ok(msg.includes('[Lexical fallback: camelCase]'), `Expected "[Lexical fallback: camelCase]" in: ${msg}`);
    });

    it('[P1] AC-002-04: Given lexical fallback due to server unavailable, When formatWarnMessage() is called with exemption, Then message contains "[Lexical fallback: server unavailable]"', () => {
      // Given: lexical fallback due to server unavailable
      const exemption = { type: 'context', condition: 'server_unavailable', signal: 'embedding_server_down' };
      // When
      const msg = router.formatWarnMessage(semanticRule, {}, '/fake/config.json', exemption);
      // Then: message contains "[Lexical fallback: server unavailable]"
      assert.ok(msg.includes('[Lexical fallback: server unavailable]'), `Expected "[Lexical fallback: server unavailable]" in: ${msg}`);
    });

    it('[P2] AC-002-04: Given non-semantic rule, When formatWarnMessage() is called, Then message uses default TOOL_ROUTER WARNING format', () => {
      const nonSemanticRule = {
        id: 'inferred-search-semantic',
        operation: 'codebase_search',
        intercept_tool: 'Grep',
        preferred_tool: 'mcp__code-index-mcp__search_code_advanced',
        enforcement: 'warn',
        source: 'inferred'
      };
      const msg = router.formatWarnMessage(nonSemanticRule, { pattern: 'test' }, '/fake/config.json');
      assert.ok(msg.includes('TOOL_ROUTER WARNING'), `Expected "TOOL_ROUTER WARNING" in: ${msg}`);
    });
  });

  describe('main() — end-to-end semantic routing', () => {
    it('[P0] AC-002-01: Given isdlc-embedding MCP available and natural-language Grep query, When main() evaluates, Then returns stderr with routing message (semantic or fallback)', () => {
      env = setupTestEnv(SETTINGS_WITH_EMBEDDING_MCP);
      const input = JSON.stringify({
        tool_name: 'Grep',
        tool_input: { pattern: 'where is error handling done' }
      });
      const result = router.main(input, {
        configPath: env.configPath,
        settingsPath: env.settingsPath,
        auditPath: path.join(env.tmpDir, '.isdlc', 'audit.jsonl')
      });
      // The inferred-semantic-search rule matches Grep.
      // If server is running: "[Semantic search]" warning
      // If server is down (test env): "[Lexical fallback: server unavailable]" exempt message
      // Either way, stderr should mention the preferred tool
      assert.ok(result.stderr, 'Expected stderr message');
      assert.ok(
        result.stderr.includes('[Semantic search]') || result.stderr.includes('[Lexical fallback:'),
        `Expected "[Semantic search]" or "[Lexical fallback:" in: ${result.stderr}`
      );
      assert.ok(result.stderr.includes('mcp__isdlc-embedding__isdlc_embedding_semantic_search'),
        'Expected preferred tool name in message');
      assert.strictEqual(result.stdout, null, 'Expected no stdout (warn, not block)');
    });

    it('[P0] AC-002-02: Given isdlc-embedding MCP available and camelCase Grep pattern, When main() evaluates, Then returns stderr with "[Lexical fallback:" message', () => {
      env = setupTestEnv(SETTINGS_WITH_EMBEDDING_MCP);
      const input = JSON.stringify({
        tool_name: 'Grep',
        tool_input: { pattern: 'inferEnvironmentRules' }
      });
      const result = router.main(input, {
        configPath: env.configPath,
        settingsPath: env.settingsPath,
        auditPath: path.join(env.tmpDir, '.isdlc', 'audit.jsonl')
      });
      // Should get a lexical fallback message
      assert.ok(result.stderr, 'Expected stderr fallback message');
      assert.ok(result.stderr.includes('[Lexical fallback:'), `Expected "[Lexical fallback:" in: ${result.stderr}`);
    });

    it('[P0] AC-002-01: Given isdlc-embedding MCP NOT available and natural-language Grep query, When main() evaluates, Then passes through (no routing)', () => {
      env = setupTestEnv(SETTINGS_WITHOUT_EMBEDDING_MCP);
      const input = JSON.stringify({
        tool_name: 'Grep',
        tool_input: { pattern: 'where is error handling done' }
      });
      const result = router.main(input, {
        configPath: env.configPath,
        settingsPath: env.settingsPath,
        auditPath: path.join(env.tmpDir, '.isdlc', 'audit.jsonl')
      });
      // code-index-mcp inferred rules may still fire for Grep, but no semantic search rule
      // The result depends on whether code-index-mcp's inferred rule fires
      // The key assertion: no "[Semantic search]" message
      if (result.stderr) {
        assert.ok(!result.stderr.includes('[Semantic search]'), 'Should not have semantic search when isdlc-embedding MCP absent');
      }
    });
  });
});
