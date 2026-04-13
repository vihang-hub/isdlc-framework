/**
 * Unit tests for query-classifier
 * REQ-GH-252 FR-002, AC-002-01, AC-002-02
 *
 * Test commands:
 *   node --test src/core/embedding/query-classifier.test.cjs
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { classifyQuery } = require('./query-classifier.cjs');

describe('query-classifier', () => {
  // ---- P0 Tests ----

  // Semantic (positive)
  it('[P0] AC-002-01: Given a natural language query "where is error handling", When classifyQuery() is called, Then returns { type: "semantic", reason: "natural_language" }', () => {
    const result = classifyQuery('where is error handling');
    assert.deepStrictEqual(result, { type: 'semantic', reason: 'natural_language' });
  });

  // Lexical - camelCase (positive)
  it('[P0] AC-002-02: Given a camelCase symbol "inferEnvironmentRules", When classifyQuery() is called, Then returns { type: "lexical", reason: "camelCase" }', () => {
    const result = classifyQuery('inferEnvironmentRules');
    assert.deepStrictEqual(result, { type: 'lexical', reason: 'camelCase' });
  });

  // Lexical - PascalCase (positive)
  it('[P0] AC-002-02: Given a PascalCase symbol "HealthResult", When classifyQuery() is called, Then returns { type: "lexical", reason: "PascalCase" }', () => {
    const result = classifyQuery('HealthResult');
    assert.deepStrictEqual(result, { type: 'lexical', reason: 'PascalCase' });
  });

  // Empty string (negative)
  it('[P0] AC-002-02: Given an empty string "", When classifyQuery() is called, Then returns { type: "lexical", reason: "empty_pattern" }', () => {
    const result = classifyQuery('');
    assert.deepStrictEqual(result, { type: 'lexical', reason: 'empty_pattern' });
  });

  // Null/undefined (negative)
  it('[P0] AC-002-02: Given null/undefined input, When classifyQuery() is called, Then returns { type: "lexical", reason: "empty_pattern" }', () => {
    assert.deepStrictEqual(classifyQuery(null), { type: 'lexical', reason: 'empty_pattern' });
    assert.deepStrictEqual(classifyQuery(undefined), { type: 'lexical', reason: 'empty_pattern' });
  });

  // ---- P1 Tests ----

  // Lexical - regex metacharacters (positive)
  it('[P1] AC-002-02: Given a regex pattern "log.*Error", When classifyQuery() is called, Then returns { type: "lexical", reason: "regex_metacharacters" }', () => {
    const result = classifyQuery('log.*Error');
    assert.deepStrictEqual(result, { type: 'lexical', reason: 'regex_metacharacters' });
  });

  // Lexical - dotted path (positive)
  it('[P1] AC-002-02: Given a dotted path "path.join", When classifyQuery() is called, Then returns { type: "lexical", reason: "dotted_path" }', () => {
    const result = classifyQuery('path.join');
    assert.deepStrictEqual(result, { type: 'lexical', reason: 'dotted_path' });
  });

  // Lexical - snake_case (positive)
  it('[P1] AC-002-02: Given a snake_case pattern "tool_router", When classifyQuery() is called, Then returns { type: "lexical", reason: "snake_case" }', () => {
    const result = classifyQuery('tool_router');
    assert.deepStrictEqual(result, { type: 'lexical', reason: 'snake_case' });
  });

  // Lexical - file extension (positive)
  it('[P1] AC-002-02: Given a file extension pattern ".test.cjs", When classifyQuery() is called, Then returns { type: "lexical", reason: "file_extension" }', () => {
    const result = classifyQuery('.test.cjs');
    assert.deepStrictEqual(result, { type: 'lexical', reason: 'file_extension' });
  });

  // ---- P2 Tests ----

  // Lexical - quoted string (positive)
  it('[P2] AC-002-02: Given a quoted string \'"Invalid credentials"\', When classifyQuery() is called, Then returns { type: "lexical", reason: "quoted_string" }', () => {
    const result = classifyQuery('"Invalid credentials"');
    assert.deepStrictEqual(result, { type: 'lexical', reason: 'quoted_string' });
  });

  // ---- Additional edge cases ----

  it('[P1] AC-002-01: Given a multi-word natural language query "how does authentication work", When classifyQuery() is called, Then returns semantic', () => {
    const result = classifyQuery('how does authentication work');
    assert.strictEqual(result.type, 'semantic');
    assert.strictEqual(result.reason, 'natural_language');
  });

  it('[P1] AC-002-02: Given whitespace-only input, When classifyQuery() is called, Then returns lexical empty_pattern', () => {
    const result = classifyQuery('   ');
    assert.deepStrictEqual(result, { type: 'lexical', reason: 'empty_pattern' });
  });

  it('[P2] AC-002-02: Given a regex with brackets "[a-z]+", When classifyQuery() is called, Then returns lexical regex_metacharacters', () => {
    const result = classifyQuery('[a-z]+');
    assert.deepStrictEqual(result, { type: 'lexical', reason: 'regex_metacharacters' });
  });

  it('[P2] AC-002-02: Given a deep dotted path "process.env.HOME", When classifyQuery() is called, Then returns lexical dotted_path', () => {
    const result = classifyQuery('process.env.HOME');
    assert.deepStrictEqual(result, { type: 'lexical', reason: 'dotted_path' });
  });

  it('[P2] AC-002-02: Given single-quoted string, When classifyQuery() is called, Then returns lexical quoted_string', () => {
    const result = classifyQuery("'some error message'");
    assert.deepStrictEqual(result, { type: 'lexical', reason: 'quoted_string' });
  });
});
