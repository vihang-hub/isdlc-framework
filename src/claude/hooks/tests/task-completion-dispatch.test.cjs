/**
 * Integration tests for 3f-task-completion dispatch routing in isdlc.md
 * Tests: TC-3F-01..20 from test-cases.md (markdown-contract verification)
 * Traces: FR-003, FR-004, AC-003-01..05, AC-004-01, AC-004-02
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Read isdlc.md once for all tests
const isdlcMdPath = path.resolve(__dirname, '..', '..', 'commands', 'isdlc.md');
const isdlcContent = fs.readFileSync(isdlcMdPath, 'utf8');

describe('3f-task-completion dispatch (isdlc.md contract)', () => {

  // --- Section A: Dispatch table wiring (AC-004-01) ---

  // TC-3F-01: STEP 3f dispatch table contains TASKS INCOMPLETE entry
  it('STEP 3f dispatch table routes TASKS INCOMPLETE', () => {
    assert.ok(
      isdlcContent.includes('TASKS INCOMPLETE'),
      'isdlc.md should contain TASKS INCOMPLETE routing'
    );
  });

  // TC-3F-02: Entry points to 3f-task-completion handler
  it('dispatch entry points to 3f-task-completion', () => {
    assert.ok(
      isdlcContent.includes('3f-task-completion'),
      'isdlc.md should reference 3f-task-completion handler'
    );
  });

  // TC-3F-03: 3f-task-completion section exists
  it('3f-task-completion section exists in isdlc.md', () => {
    assert.ok(
      /\*\*3f-task-completion\.\*\*/.test(isdlcContent) || isdlcContent.includes('**3f-task-completion.**'),
      'isdlc.md should have a 3f-task-completion section header'
    );
  });

  // --- Section B: Re-delegation prompt (AC-004-02) ---

  // TC-3F-09: Re-delegation prompt names task IDs explicitly
  it('re-delegation prompt includes task ID naming', () => {
    // The section should contain reference to naming unfinished task IDs
    const section = extractSection(isdlcContent, '3f-task-completion');
    assert.ok(section, '3f-task-completion section should be extractable');
    assert.ok(
      /T\{id\}|task.id|task ID/i.test(section),
      're-delegation prompt should name task IDs'
    );
  });

  // TC-3F-10: Re-delegation prompt includes task descriptions
  it('re-delegation prompt includes descriptions', () => {
    const section = extractSection(isdlcContent, '3f-task-completion');
    assert.ok(section);
    assert.ok(
      /description/i.test(section),
      're-delegation prompt should reference descriptions'
    );
  });

  // --- Section C: Retry counter (AC-003-01) ---

  // TC-3F-17: Uses hook_block_retries with task-completion-gate key
  it('uses hook_block_retries with task-completion-gate key', () => {
    const section = extractSection(isdlcContent, '3f-task-completion');
    assert.ok(section);
    assert.ok(
      section.includes('task-completion-gate'),
      'should reference task-completion-gate retry key'
    );
  });

  // --- Section D: Max retries enforcement (AC-003-02) ---

  // TC-3F-22: Max retries is 3
  it('retry protocol table has task-completion entry with max 3', () => {
    assert.ok(
      /3f-task-completion\s*\|\s*3/.test(isdlcContent),
      'retry protocol table should have 3f-task-completion with max 3'
    );
  });

  // TC-3F-23: Escalation menu displayed at retries >= 3
  it('escalation menu is defined', () => {
    const section = extractSection(isdlcContent, '3f-task-completion');
    assert.ok(section);
    assert.ok(
      /\[M\]/.test(section) && /\[S\]/.test(section) && /\[C\]/.test(section),
      'escalation menu should have [M], [S], [C] options'
    );
  });

  // TC-3F-24: Escalation message includes task IDs
  it('escalation message includes "I have asked the orchestrator"', () => {
    const section = extractSection(isdlcContent, '3f-task-completion');
    assert.ok(section);
    assert.ok(
      section.includes('I have asked the orchestrator'),
      'escalation message should use the specified wording'
    );
  });

  // --- Section E: [M] Manually prompt (AC-003-03) ---

  // TC-3F-28: [M] resets counter
  it('[M] handler resets retry counter', () => {
    const section = extractSection(isdlcContent, '3f-task-completion');
    assert.ok(section);
    assert.ok(
      /Reset.*to 0|reset.*retries.*0|counter.*0/i.test(section),
      '[M] handler should reset retries to 0'
    );
  });

  // --- Section F: [S] Skip (AC-003-04) ---

  // TC-3F-34: [S] appends to skipped_tasks[]
  it('[S] handler appends to skipped_tasks', () => {
    const section = extractSection(isdlcContent, '3f-task-completion');
    assert.ok(section);
    assert.ok(
      section.includes('skipped_tasks'),
      '[S] handler should write to skipped_tasks'
    );
  });

  // TC-3F-35: [S] uses correct schema
  it('[S] handler uses { phase, tasks, skipped_at, reason } schema', () => {
    const section = extractSection(isdlcContent, '3f-task-completion');
    assert.ok(section);
    assert.ok(section.includes('phase'), 'schema should include phase');
    assert.ok(section.includes('tasks'), 'schema should include tasks');
    assert.ok(section.includes('skipped_at'), 'schema should include skipped_at');
    assert.ok(section.includes('user_skip_after_retries'), 'reason should be user_skip_after_retries');
  });

  // --- Section G: [C] Cancel (AC-003-05) ---

  // TC-3F-45: [C] delegates to existing cancellation
  it('[C] handler uses existing cancellation path', () => {
    const section = extractSection(isdlcContent, '3f-task-completion');
    assert.ok(section);
    assert.ok(
      /cancel/i.test(section),
      '[C] handler should reference cancellation'
    );
  });

  // --- Section H: Regression safety ---

  // TC-3F-49: Existing 3f-blast-radius section preserved
  it('existing 3f-blast-radius section is preserved', () => {
    assert.ok(
      isdlcContent.includes('3f-blast-radius'),
      'blast-radius handler should still exist'
    );
  });

  // TC-3F-50: Existing 3f-gate-blocker section preserved
  it('existing 3f-gate-blocker section is preserved', () => {
    assert.ok(
      isdlcContent.includes('3f-gate-blocker'),
      'gate-blocker handler should still exist'
    );
  });

  // TC-3F-51: Existing 3f-constitutional section preserved
  it('existing 3f-constitutional section is preserved', () => {
    assert.ok(
      isdlcContent.includes('3f-constitutional'),
      'constitutional handler should still exist'
    );
  });

  // TC-3F-52: Existing 3f-protocol-violation section preserved
  it('existing 3f-protocol-violation section is preserved', () => {
    assert.ok(
      isdlcContent.includes('3f-protocol-violation'),
      'protocol-violation handler should still exist'
    );
  });
});

/**
 * Extract the 3f-task-completion section from isdlc.md.
 * Returns text from the section header to the next section-level header.
 * Section headers match: **3f-XXX.** (with trailing period+bold close).
 * Does NOT match inline **3f-retry-protocol** references.
 */
function extractSection(content, sectionName) {
  const startIdx = content.indexOf(`**${sectionName}.**`);
  if (startIdx === -1) return null;
  // Find next section-level header or #### STEP after start
  const rest = content.slice(startIdx + 10);
  const nextSection = rest.search(/\n\*\*3[ef]-[a-z]+-?[a-z]*\.\*\*|\n#### STEP/);
  if (nextSection === -1) return content.slice(startIdx);
  return content.slice(startIdx, startIdx + 10 + nextSection);
}
