/**
 * Tests for bin/isdlc-embedding.js --incremental flag (T005, T014)
 * Traces: FR-004, FR-005, FR-006, AC-004-05, AC-005-02, AC-005-03, AC-005-04, AC-006-02, AC-006-03
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseIncrementalFlag,
  translateErrorCode,
  shouldPromptFullGenerate
} from '../../lib/embedding/incremental/cli-helpers.js';

describe('CLI --incremental flag parsing', () => {
  // AC-004-05: works without VCS (flag is agnostic)
  it('detects --incremental flag in argv', () => {
    assert.equal(parseIncrementalFlag(['generate']), false);
    assert.equal(parseIncrementalFlag(['generate', '--incremental']), true);
    assert.equal(parseIncrementalFlag(['--incremental', 'generate']), true);
  });

  it('returns false for empty argv', () => {
    assert.equal(parseIncrementalFlag([]), false);
  });
});

describe('CLI error code translation', () => {
  // AC-005-02: NO_PRIOR_PACKAGE translates to actionable prompt text
  it('translates NO_PRIOR_PACKAGE to user-friendly prompt', () => {
    const msg = translateErrorCode('NO_PRIOR_PACKAGE');
    assert.ok(msg.includes('No prior package'));
    assert.ok(msg.includes('Run full generate'));
  });

  // AC-006-03: DELETIONS_DETECTED message includes N files and instructions
  it('translates DELETIONS_DETECTED to user-friendly message with count', () => {
    const msg = translateErrorCode('DELETIONS_DETECTED', { deletedCount: 5 });
    assert.ok(msg.includes('deletions detected'));
    assert.ok(msg.includes('5'));
    assert.ok(msg.includes('isdlc embedding generate'));
  });

  // AC-004-08: LEGACY_PACKAGE_NO_HASHES message points to full rebuild
  it('translates LEGACY_PACKAGE_NO_HASHES to user-friendly message', () => {
    const msg = translateErrorCode('LEGACY_PACKAGE_NO_HASHES');
    assert.ok(msg.includes('legacy'));
    assert.ok(msg.toLowerCase().includes('full'));
  });

  it('falls back to unknown error message for unrecognized code', () => {
    const msg = translateErrorCode('UNKNOWN_ERROR_XYZ');
    assert.ok(msg.length > 0);
  });
});

describe('CLI interactive prompt', () => {
  // AC-005-03: on Y → run full generate; AC-005-04: on n → exit
  it('Y response triggers full generate flow', () => {
    assert.equal(shouldPromptFullGenerate('Y'), true);
    assert.equal(shouldPromptFullGenerate('y'), true);
    assert.equal(shouldPromptFullGenerate(''), true); // default Y
  });

  it('n response does not trigger full generate', () => {
    assert.equal(shouldPromptFullGenerate('n'), false);
    assert.equal(shouldPromptFullGenerate('N'), false);
    assert.equal(shouldPromptFullGenerate('no'), false);
  });
});
