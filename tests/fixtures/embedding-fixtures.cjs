/**
 * Test fixtures for REQ-GH-252 Smooth Embeddings UX
 *
 * Provides test data factories for query classification, health probe,
 * tool-router semantic routing, and CLI preflight scenarios.
 *
 * Usage:
 *   const fixtures = require('./embedding-fixtures.cjs');
 *   const { queryClassifier, healthProbe, toolRouter, cliPreflight } = fixtures;
 */

'use strict';

// ---------------------------------------------------------------------------
// Query Classifier Fixtures
// ---------------------------------------------------------------------------

const queryClassifier = {
  semanticQueries: [
    { input: 'where is error handling', expected: { type: 'semantic', reason: 'natural_language' } },
    { input: 'how does authentication work', expected: { type: 'semantic', reason: 'natural_language' } },
    { input: 'find code that handles payments', expected: { type: 'semantic', reason: 'natural_language' } },
    { input: 'show me the retry logic', expected: { type: 'semantic', reason: 'natural_language' } },
    { input: 'what validates user input', expected: { type: 'semantic', reason: 'natural_language' } },
  ],

  lexicalQueries: {
    camelCase: [
      { input: 'inferEnvironmentRules', expected: { type: 'lexical', reason: 'camelCase' } },
      { input: 'matchContextCondition', expected: { type: 'lexical', reason: 'camelCase' } },
      { input: 'classifyQuery', expected: { type: 'lexical', reason: 'camelCase' } },
    ],
    PascalCase: [
      { input: 'HealthResult', expected: { type: 'lexical', reason: 'PascalCase' } },
      { input: 'ClassificationResult', expected: { type: 'lexical', reason: 'PascalCase' } },
    ],
    regexMetacharacters: [
      { input: 'log.*Error', expected: { type: 'lexical', reason: 'regex_metacharacters' } },
      { input: 'function\\s+\\w+', expected: { type: 'lexical', reason: 'regex_metacharacters' } },
      { input: '[A-Z]+_[A-Z]+', expected: { type: 'lexical', reason: 'regex_metacharacters' } },
    ],
    dottedPath: [
      { input: 'path.join', expected: { type: 'lexical', reason: 'dotted_path' } },
      { input: 'process.env', expected: { type: 'lexical', reason: 'dotted_path' } },
    ],
    snakeCase: [
      { input: 'tool_router', expected: { type: 'lexical', reason: 'snake_case' } },
      { input: 'health_probe', expected: { type: 'lexical', reason: 'snake_case' } },
    ],
    fileExtension: [
      { input: '.test.cjs', expected: { type: 'lexical', reason: 'file_extension' } },
      { input: 'package.json', expected: { type: 'lexical', reason: 'dotted_path' } },
    ],
    quotedString: [
      { input: '"Invalid credentials"', expected: { type: 'lexical', reason: 'quoted_string' } },
      { input: "'some string'", expected: { type: 'lexical', reason: 'quoted_string' } },
    ],
    wildcard: [
      { input: '*.test.js', expected: { type: 'lexical', reason: 'wildcard' } },
    ],
  },

  invalidInputs: [
    { input: '', expected: { type: 'lexical', reason: 'empty_pattern' } },
    { input: null, expected: { type: 'lexical', reason: 'empty_pattern' } },
    { input: undefined, expected: { type: 'lexical', reason: 'empty_pattern' } },
  ],

  boundaryInputs: {
    singleChar: { input: 'x', expected: { type: 'semantic', reason: 'natural_language' } },
    singleWildcard: { input: '*', expected: { type: 'lexical', reason: 'wildcard' } },
    veryLong: { input: 'a'.repeat(1000), expected: { type: 'semantic', reason: 'natural_language' } },
    maxSize: { input: 'a'.repeat(10000), expected: { type: 'semantic', reason: 'natural_language' } },
  },
};

// ---------------------------------------------------------------------------
// Health Probe Fixtures
// ---------------------------------------------------------------------------

const healthProbe = {
  noPidFile: {
    setup: (tmpDir) => {
      // No setup needed -- PID file does not exist
      return tmpDir;
    },
    expected: { status: 'inactive', error: 'no_pid_file' },
  },

  invalidPid: {
    pidContent: 'not-a-number',
    expected: { status: 'inactive', error: 'invalid_pid' },
  },

  alivePid: {
    // Use current process PID (guaranteed alive)
    getPid: () => process.pid,
    expected: (pid) => ({ status: 'active', pid }),
  },

  deadPid: {
    pid: 999999999,
    expected: { status: 'inactive', error: 'process_dead' },
  },

  emptyPidFile: {
    pidContent: '',
    expected: { status: 'inactive', error: 'invalid_pid' },
  },

  largePidFile: {
    pidContent: 'x'.repeat(1024 * 1024), // 1MB of junk
    expected: { status: 'inactive', error: 'invalid_pid' },
  },
};

// ---------------------------------------------------------------------------
// Tool Router Fixtures
// ---------------------------------------------------------------------------

const toolRouter = {
  settingsWithEmbeddingMcp: {
    mcpServers: {
      'code-index-mcp': { command: 'code-index-mcp', args: [] },
      'isdlc-embedding': { command: 'node', args: ['lib/embedding/mcp-server/index.js'] },
    },
  },

  settingsWithoutEmbeddingMcp: {
    mcpServers: {
      'code-index-mcp': { command: 'code-index-mcp', args: [] },
    },
  },

  settingsEmpty: {
    mcpServers: {},
  },

  expectedSemanticRule: {
    id: 'inferred-semantic-search',
    operation: 'semantic_search',
    intercept_tool: 'Grep',
    preferred_tool: 'mcp__isdlc-embedding__isdlc_embedding_semantic_search',
    enforcement: 'warn',
    source: 'inferred',
  },

  grepInputSemantic: {
    pattern: 'where is error handling',
  },

  grepInputLexicalCamelCase: {
    pattern: 'inferEnvironmentRules',
  },

  grepInputLexicalRegex: {
    pattern: 'log.*Error',
  },
};

// ---------------------------------------------------------------------------
// CLI Preflight Fixtures
// ---------------------------------------------------------------------------

const cliPreflight = {
  optedInConfig: {
    embeddings: { enabled: true },
  },

  optedOutConfig: {
    embeddings: { enabled: false },
  },

  exitCodes: {
    SUCCESS: 0,
    GENERATION_ERROR: 1,
    MISSING_DEPENDENCY: 2,
    INSUFFICIENT_RESOURCES: 3,
  },

  expectedStderrPatterns: {
    missingDep: '@huggingface/transformers',
    diskSpace: 'disk space',
    modelUnavailable: 'not available',
    emptyOutput: 'empty',
  },
};

module.exports = {
  queryClassifier,
  healthProbe,
  toolRouter,
  cliPreflight,
};
