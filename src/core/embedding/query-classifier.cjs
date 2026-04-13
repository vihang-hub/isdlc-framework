/**
 * Query classifier for semantic vs. lexical search routing.
 *
 * Classifies a search pattern as "semantic" (natural language, conceptual)
 * or "lexical" (exact match, code symbol, regex). The tool-router uses
 * this classification to decide whether to route Grep calls to the
 * semantic search MCP or let them pass through as lexical.
 *
 * Classification heuristic (first match wins):
 *   1. Empty/null/undefined           -> lexical (empty_pattern)
 *   2. Regex metacharacters           -> lexical (regex_metacharacters)
 *   3. File extensions (.js, .cjs)    -> lexical (file_extension)
 *   4. Wildcard patterns (*, ?)       -> lexical (wildcard)
 *   5. camelCase identifiers          -> lexical (camelCase)
 *   6. PascalCase identifiers         -> lexical (PascalCase)
 *   7. Dotted paths (a.b.c)           -> lexical (dotted_path)
 *   8. snake_case identifiers         -> lexical (snake_case)
 *   9. Quoted strings ("..." or '...') -> lexical (quoted_string)
 *  10. Everything else                -> semantic (natural_language)
 *
 * REQ-GH-252 FR-002, AC-002-01, AC-002-02
 * Constitutional: Article X (fail-open) -- invalid input returns lexical.
 *
 * @module src/core/embedding/query-classifier
 */

'use strict';

/**
 * Classify a search pattern as semantic or lexical.
 *
 * @param {string} pattern - The search query/pattern
 * @returns {{ type: 'semantic'|'lexical', reason: string }}
 */
function classifyQuery(pattern) {
  // Guard: null, undefined, non-string, empty
  if (pattern == null || typeof pattern !== 'string' || pattern.trim() === '') {
    return { type: 'lexical', reason: 'empty_pattern' };
  }

  const trimmed = pattern.trim();

  // 1. File extensions: starts with a dot followed by word chars (e.g., .test.cjs, .js)
  //    Must be a single token with no spaces. Checked before regex metacharacters
  //    because dots in file extensions are not regex intent.
  if (/^\.\w+/.test(trimmed) && /^[^\s]+$/.test(trimmed)) {
    return { type: 'lexical', reason: 'file_extension' };
  }

  // 2. Dotted paths: single token with dots (e.g., path.join, process.env.HOME)
  //    Checked before regex metacharacters because dots in code identifiers
  //    are not regex intent.
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*)+$/.test(trimmed)) {
    return { type: 'lexical', reason: 'dotted_path' };
  }

  // 3. Regex metacharacters: *+?^${}()|[\]
  //    Dots alone don't count (handled above). Match other regex syntax
  //    that wouldn't appear in natural language queries.
  if (/[*+?^${}()|[\]\\]/.test(trimmed)) {
    return { type: 'lexical', reason: 'regex_metacharacters' };
  }

  // 4. Wildcard patterns: contains * or ? (already caught by regex above,
  //    but kept as explicit category for cases that slip through)
  if (/[*?]/.test(trimmed)) {
    return { type: 'lexical', reason: 'wildcard' };
  }

  // 5. camelCase: lowercase letter followed by uppercase (e.g., inferEnvironmentRules)
  if (/^[a-z]+[A-Z]/.test(trimmed) && /^[a-zA-Z0-9]+$/.test(trimmed)) {
    return { type: 'lexical', reason: 'camelCase' };
  }

  // 6. PascalCase: starts with uppercase, has another uppercase after lowercase
  //    Must be a single token (no spaces)
  if (/^[A-Z][a-z]+[A-Z]/.test(trimmed) && /^[a-zA-Z0-9]+$/.test(trimmed)) {
    return { type: 'lexical', reason: 'PascalCase' };
  }

  // 7. snake_case: letters/digits with underscores, no spaces
  if (/^[a-zA-Z][a-zA-Z0-9]*(_[a-zA-Z0-9]+)+$/.test(trimmed)) {
    return { type: 'lexical', reason: 'snake_case' };
  }

  // 8. Quoted strings: wrapped in double or single quotes
  if (/^["'].*["']$/.test(trimmed)) {
    return { type: 'lexical', reason: 'quoted_string' };
  }

  // Default: semantic (natural language)
  return { type: 'semantic', reason: 'natural_language' };
}

module.exports = { classifyQuery };
