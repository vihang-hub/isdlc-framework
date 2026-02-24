/**
 * orchestrator-scope-overrun.test.js -- Structural validation that the
 * orchestrator agent prompt enforces MODE boundaries to prevent scope overrun.
 *
 * BUG-0016-orchestrator-scope-overrun (BUG-0017): 20 test cases (T01-T20)
 * covering MODE enforcement block at top, mode-aware guard in Section 4a,
 * step 7.5 in the advancement algorithm, return format compliance, backward
 * compatibility, and stop language strength.
 *
 * Follows the pattern established by lib/early-branch-creation.test.js.
 *
 * @module orchestrator-scope-overrun.test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');

// ---------------------------------------------------------------------------
// File Paths
// ---------------------------------------------------------------------------

const ORCHESTRATOR_PATH = resolve(__dirname, '..', 'src', 'claude', 'agents', '00-sdlc-orchestrator.md');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract content between a heading marker and the next heading of the same
 * or higher level.  Returns null if the marker heading is not found.
 *
 * @param {string} content  Full markdown text
 * @param {string} marker   The heading text (without leading ##)
 * @param {number} level    Heading level (default 2 for ##)
 * @returns {string|null}
 */
function extractSection(content, marker, level = 2) {
  const prefix = '#'.repeat(level) + ' ';
  const idx = content.indexOf(prefix + marker);
  if (idx === -1) return null;
  const rest = content.slice(idx + prefix.length + marker.length);
  const pattern = new RegExp(`\\n${'#'.repeat(level)} [^#]`);
  const nextH = rest.search(pattern);
  return nextH === -1 ? rest : rest.slice(0, nextH);
}

/**
 * Extract a section using a regex pattern for the heading.
 */
function extractSectionByPattern(content, headingPattern, level = 2) {
  const prefix = '#'.repeat(level) + ' ';
  const lines = content.split('\n');
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith(prefix) && headingPattern.test(lines[i])) {
      startIdx = i;
      break;
    }
  }
  if (startIdx === -1) return null;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].startsWith(prefix) && !lines[i].startsWith(prefix + '#')) {
      return lines.slice(startIdx, i).join('\n');
    }
  }
  return lines.slice(startIdx).join('\n');
}

/**
 * Extract the top-level MODE enforcement block. This block should appear
 * BEFORE the "# CORE MISSION" heading.
 */
function extractModeEnforcementBlock(content) {
  // Look for a heading containing "MODE ENFORCEMENT" at level 1 (#)
  const match = content.match(/^# MODE ENFORCEMENT[^\n]*/m);
  if (!match) return null;
  const startIdx = match.index;
  // Find the next level-1 heading after this one
  const rest = content.slice(startIdx + match[0].length);
  const nextH1 = rest.search(/\n# [^#]/);
  const block = nextH1 === -1 ? rest : rest.slice(0, nextH1);
  return match[0] + block;
}

/**
 * Extract Section 4a (Automatic Phase Transitions).
 */
function extractSection4a(content) {
  return extractSectionByPattern(content, /4a\.\s+Automatic Phase Transitions/i, 2);
}

/**
 * Extract Section 4 (Workflow Phase Advancement).
 */
function extractSection4(content) {
  return extractSectionByPattern(content, /4\.\s+Workflow Phase Advancement/i, 2);
}

/**
 * Extract Section 3c (Execution Modes).
 */
function extractSection3c(content) {
  return extractSectionByPattern(content, /3c\.\s+Execution Modes/i, 2);
}

/**
 * Extract the Return Format subsection within Section 3c.
 */
function extractReturnFormat(content) {
  const section3c = extractSection3c(content);
  if (!section3c) return null;
  const marker = '### Return Format';
  const idx = section3c.indexOf(marker);
  if (idx === -1) return null;
  const rest = section3c.slice(idx);
  const nextSection = rest.slice(marker.length).search(/\n### /);
  return nextSection === -1 ? rest : rest.slice(0, marker.length + nextSection);
}

/**
 * Extract the Mode Behavior subsection within Section 3c.
 */
function extractModeBehavior(content) {
  const section3c = extractSection3c(content);
  if (!section3c) return null;
  const marker = '### Mode Behavior';
  const idx = section3c.indexOf(marker);
  if (idx === -1) return null;
  const rest = section3c.slice(idx);
  const nextSection = rest.slice(marker.length).search(/\n### /);
  return nextSection === -1 ? rest : rest.slice(0, marker.length + nextSection);
}

// ---------------------------------------------------------------------------
// Read the file once for all tests
// ---------------------------------------------------------------------------

const orchestratorContent = readFileSync(ORCHESTRATOR_PATH, 'utf-8');

// Pre-extract sections
const modeEnforcementBlock = extractModeEnforcementBlock(orchestratorContent);
const section4a = extractSection4a(orchestratorContent);
const section4 = extractSection4(orchestratorContent);
const section3c = extractSection3c(orchestratorContent);
const returnFormat = extractReturnFormat(orchestratorContent);
const modeBehavior = extractModeBehavior(orchestratorContent);

// ===========================================================================
// Group 1: MODE Enforcement Instruction at Top (FR-02) -- T01-T04
// ===========================================================================

describe('Group 1: MODE Enforcement Instruction at Top (FR-02)', () => {

  it('T01: MODE enforcement block exists before CORE MISSION | traces: AC-02.1', () => {
    assert.ok(modeEnforcementBlock, 'A MODE ENFORCEMENT block (# heading) must exist in the orchestrator');
    // Verify its position is BEFORE "# CORE MISSION"
    const modeIdx = orchestratorContent.indexOf('# MODE ENFORCEMENT');
    const coreMissionIdx = orchestratorContent.indexOf('# CORE MISSION');
    assert.ok(coreMissionIdx !== -1, 'CORE MISSION heading must exist');
    assert.ok(modeIdx < coreMissionIdx,
      'MODE ENFORCEMENT block must appear BEFORE "# CORE MISSION"');
  });

  it('T02: MODE enforcement uses CRITICAL-level language | traces: AC-02.2', () => {
    assert.ok(modeEnforcementBlock, 'MODE ENFORCEMENT block must exist');
    // Must contain CRITICAL
    assert.ok(
      /CRITICAL/i.test(modeEnforcementBlock),
      'MODE ENFORCEMENT block must contain "CRITICAL"'
    );
    // Must contain imperative stop language
    const hasStopLanguage =
      /\bSTOP\b/.test(modeEnforcementBlock) ||
      /\bDO NOT\b/.test(modeEnforcementBlock) ||
      /\bMUST NOT\b/.test(modeEnforcementBlock) ||
      /\bIMMEDIATELY\b/.test(modeEnforcementBlock);
    assert.ok(hasStopLanguage,
      'MODE ENFORCEMENT block must contain imperative stop language (STOP, DO NOT, MUST NOT, or IMMEDIATELY)');
    // Must mention init-and-phase-01
    assert.ok(
      /init-and-phase-01/.test(modeEnforcementBlock),
      'MODE ENFORCEMENT block must mention "init-and-phase-01" mode'
    );
  });

  it('T03: MODE enforcement references JSON return format | traces: AC-02.3', () => {
    assert.ok(modeEnforcementBlock, 'MODE ENFORCEMENT block must exist');
    // Must mention JSON or structured result
    const hasReturnRef =
      /JSON/i.test(modeEnforcementBlock) ||
      /structured.*result/i.test(modeEnforcementBlock);
    assert.ok(hasReturnRef,
      'MODE ENFORCEMENT block must mention "JSON" or "structured result"');
    // Must mention terminate/return/stop after scope completion
    const hasTerminate =
      /terminate/i.test(modeEnforcementBlock) ||
      /return/i.test(modeEnforcementBlock) ||
      /\bSTOP\b/i.test(modeEnforcementBlock);
    assert.ok(hasTerminate,
      'MODE ENFORCEMENT block must mention termination after mode scope completes');
  });

  it('T04: MODE enforcement says DO NOT delegate to Phase 02 | traces: AC-02.4', () => {
    assert.ok(modeEnforcementBlock, 'MODE ENFORCEMENT block must exist');
    // Must contain "DO NOT delegate" or "DO NOT advance" or "DO NOT proceed"
    const hasForbidden =
      /DO NOT delegate/i.test(modeEnforcementBlock) ||
      /DO NOT advance/i.test(modeEnforcementBlock) ||
      /DO NOT proceed/i.test(modeEnforcementBlock);
    assert.ok(hasForbidden,
      'MODE ENFORCEMENT block must contain "DO NOT delegate/advance/proceed"');
    // Must reference Phase 02 or subsequent phase as the forbidden target
    const hasPhase02Ref =
      /Phase 02/i.test(modeEnforcementBlock) ||
      /subsequent phase/i.test(modeEnforcementBlock) ||
      /next phase/i.test(modeEnforcementBlock) ||
      /any subsequent/i.test(modeEnforcementBlock);
    assert.ok(hasPhase02Ref,
      'MODE ENFORCEMENT block must reference Phase 02 or subsequent phases as forbidden');
  });
});

// ===========================================================================
// Group 2: MODE Parameter Enforcement (FR-01) -- T05-T09
// ===========================================================================

describe('Group 2: MODE Parameter Enforcement (FR-01)', () => {

  it('T05: init-and-phase-01 scope limited to Phase 01 | traces: AC-01.1', () => {
    // Check in both MODE enforcement block and Section 3c
    const combined = (modeEnforcementBlock || '') + (section3c || '');
    // Scope includes: initialization + Phase 01 + GATE-01 + plan generation
    const hasScope =
      /init-and-phase-01/.test(combined) &&
      (/Phase 01/i.test(combined) || /GATE-01/i.test(combined));
    assert.ok(hasScope,
      'init-and-phase-01 scope must be defined in MODE enforcement or Section 3c');
    // No language suggesting Phase 02 is included in init-and-phase-01 scope
    // (We check the MODE enforcement block specifically since that defines boundaries)
    if (modeEnforcementBlock) {
      // The block should NOT say init-and-phase-01 includes Phase 02
      assert.ok(
        !/init-and-phase-01.*(?:include|run).*Phase 02/i.test(modeEnforcementBlock),
        'init-and-phase-01 mode must NOT include Phase 02 in its scope'
      );
    }
  });

  it('T06: init-and-phase-01 returns structured JSON after GATE-01 | traces: AC-01.2', () => {
    assert.ok(returnFormat, 'Return Format subsection must exist in Section 3c');
    // Must document init-and-phase-01 return with required fields
    assert.ok(
      /init-and-phase-01/.test(returnFormat),
      'Return Format must document init-and-phase-01'
    );
    const hasRequiredFields =
      /status/.test(returnFormat) &&
      /phases/.test(returnFormat) &&
      /artifact_folder/.test(returnFormat);
    assert.ok(hasRequiredFields,
      'Return Format for init-and-phase-01 must include status, phases, artifact_folder');
  });

  it('T07: single-phase mode limits to one phase | traces: AC-01.3', () => {
    const combined = (modeEnforcementBlock || '') + (section3c || '');
    // Must define single-phase as running only one phase
    assert.ok(
      /single-phase/.test(combined),
      'single-phase mode must be documented');
    // Must contain stop/return language
    const hasStopForSinglePhase =
      /single-phase.*(?:STOP|return|DO NOT)/is.test(combined) ||
      /(?:STOP|return|DO NOT).*single-phase/is.test(combined);
    assert.ok(hasStopForSinglePhase,
      'single-phase mode must contain stop/return language');
  });

  it('T08: finalize mode runs only merge logic | traces: AC-01.4', () => {
    const combined = (modeEnforcementBlock || '') + (section3c || '');
    // Must define finalize scope
    assert.ok(
      /finalize/.test(combined),
      'finalize mode must be documented');
    // Must contain "no phase transitions" or "merge only" or "no phases"
    const hasMergeOnly =
      /finalize.*(?:merge|no.*phase|ONLY.*merge)/is.test(combined) ||
      /(?:merge.*only|no.*phase.*transition).*finalize/is.test(combined);
    assert.ok(hasMergeOnly,
      'finalize mode must specify merge/completion only with no phase transitions');
  });

  it('T09: No-MODE backward compatibility preserved | traces: AC-01.5, NFR-01', () => {
    const combined = (modeEnforcementBlock || '') + (section3c || '');
    // Must mention "no MODE" or "none" or "full-workflow mode"
    const hasNoModeRef =
      /no MODE/i.test(combined) ||
      /full.workflow/i.test(combined) ||
      /backward compatible/i.test(combined) ||
      /original behavior/i.test(combined);
    assert.ok(hasNoModeRef,
      'Must document behavior when no MODE parameter is present');
    // Must explicitly state backward compatibility
    const hasBackwardCompat =
      /backward compatible/i.test(combined) ||
      /original behavior/i.test(combined) ||
      /full.workflow mode/i.test(combined);
    assert.ok(hasBackwardCompat,
      'Must explicitly state backward compatibility for no-MODE case');
    // Section 4a automatic transitions should NOT be disabled by default
    assert.ok(section4a, 'Section 4a must exist');
    assert.ok(
      /automatic/i.test(section4a),
      'Section 4a must still contain automatic phase transition instructions');
  });
});

// ===========================================================================
// Group 3: Mode-Aware Guard in Section 4a (FR-03) -- T10-T13
// ===========================================================================

describe('Group 3: Mode-Aware Guard in Section 4a (FR-03)', () => {

  it('T10: Section 4a contains a mode-aware guard | traces: AC-03.1', () => {
    assert.ok(section4a, 'Section 4a must exist');
    // Must contain MODE in the context of checking/guarding
    const hasModeGuard =
      /mode.aware/i.test(section4a) ||
      /mode.*guard/i.test(section4a) ||
      /check.*MODE/i.test(section4a) ||
      /MODE.*check/i.test(section4a) ||
      /guard.*mode/i.test(section4a);
    assert.ok(hasModeGuard,
      'Section 4a must contain a mode-aware guard or MODE check');
    // The guard should appear in the section (not just a passing reference)
    assert.ok(
      /init-and-phase-01/.test(section4a),
      'Section 4a guard must reference init-and-phase-01 mode');
  });

  it('T11: Mode guard blocks transition after Phase 01 in init-and-phase-01 | traces: AC-03.2', () => {
    assert.ok(section4a, 'Section 4a must exist');
    // Must have init-and-phase-01 with STOP/block/DO NOT language
    const hasBlock =
      /init-and-phase-01.*(?:STOP|DO NOT|block|return)/is.test(section4a) ||
      /(?:STOP|DO NOT|block|return).*init-and-phase-01/is.test(section4a);
    assert.ok(hasBlock,
      'Section 4a must block transitions for init-and-phase-01 mode');
    // Must reference Phase 01 or GATE-01 as the boundary
    const hasBoundary =
      /Phase 01/i.test(section4a) ||
      /GATE-01/i.test(section4a);
    assert.ok(hasBoundary,
      'Section 4a guard must reference Phase 01 or GATE-01 as the boundary');
  });

  it('T12: Mode guard blocks transition in single-phase mode | traces: AC-03.3', () => {
    assert.ok(section4a, 'Section 4a must exist');
    // Must have single-phase with stop/block language
    const hasBlock =
      /single-phase.*(?:STOP|DO NOT|block|return)/is.test(section4a) ||
      /(?:STOP|DO NOT|block|return).*single-phase/is.test(section4a);
    assert.ok(hasBlock,
      'Section 4a must block transitions for single-phase mode');
    // Must reference "specified phase" or "PHASE parameter"
    const hasPhaseBoundary =
      /specified phase/i.test(section4a) ||
      /PHASE param/i.test(section4a) ||
      /phase.*gate.*passed/i.test(section4a);
    assert.ok(hasPhaseBoundary,
      'Section 4a guard must reference the specified phase as the boundary');
  });

  it('T13: Mode guard prevents transitions in finalize mode | traces: AC-03.4', () => {
    assert.ok(section4a, 'Section 4a must exist');
    // Must have finalize with no transitions or merge only language
    const hasFinalizeGuard =
      /finalize.*(?:No.*transition|merge.*only|no.*phase)/is.test(section4a) ||
      /(?:No.*transition|merge.*only).*finalize/is.test(section4a);
    assert.ok(hasFinalizeGuard,
      'Section 4a must prevent phase transitions in finalize mode');
  });
});

// ===========================================================================
// Group 4: Section 4 Advancement Algorithm Mode Check (FR-03) -- T14
// ===========================================================================

describe('Group 4: Section 4 Advancement Algorithm Mode Check (FR-03)', () => {

  it('T14: Section 4 advancement algorithm contains a mode check before step 8 | traces: AC-03.1', () => {
    assert.ok(section4, 'Section 4 must exist');
    // Must contain a step 7.5 or a mode-check step before step 8
    const hasStep75 =
      /7\.5/i.test(section4) ||
      /CHECK MODE/i.test(section4) ||
      /mode.*boundary/i.test(section4);
    assert.ok(hasStep75,
      'Section 4 must contain a step 7.5 or MODE BOUNDARY check');
    // Must say to STOP/return if MODE boundary reached
    const hasStopOnBoundary =
      /STOP.*return/i.test(section4) ||
      /DO NOT.*step 8/i.test(section4) ||
      /DO NOT execute/i.test(section4);
    assert.ok(hasStopOnBoundary,
      'Mode check step must say to STOP or not execute step 8 when boundary reached');
    // The mode check must appear BEFORE "Delegate to the next phase" instruction
    const modeCheckIdx = section4.search(/7\.5|CHECK MODE BOUNDARY/i);
    const delegateIdx = section4.search(/Delegate to the next phase/i);
    if (modeCheckIdx !== -1 && delegateIdx !== -1) {
      assert.ok(modeCheckIdx < delegateIdx,
        'Mode check (step 7.5) must appear BEFORE "Delegate to the next phase" (step 8)');
    }
  });
});

// ===========================================================================
// Group 5: Return Format Compliance (FR-04) -- T15-T17
// ===========================================================================

describe('Group 5: Return Format Compliance (FR-04)', () => {

  it('T15: init-and-phase-01 return format documented | traces: AC-04.1', () => {
    assert.ok(returnFormat, 'Return Format subsection must exist');
    // Must contain init-and-phase-01 with required fields
    assert.ok(
      /init-and-phase-01/.test(returnFormat),
      'Return Format must document init-and-phase-01');
    const hasFields =
      /status/.test(returnFormat) &&
      /phases/.test(returnFormat) &&
      /artifact_folder/.test(returnFormat) &&
      /workflow_type/.test(returnFormat) &&
      /next_phase_index/.test(returnFormat);
    assert.ok(hasFields,
      'init-and-phase-01 return must include status, phases, artifact_folder, workflow_type, next_phase_index');
  });

  it('T16: single-phase return format documented | traces: AC-04.2', () => {
    assert.ok(returnFormat, 'Return Format subsection must exist');
    assert.ok(
      /single-phase/.test(returnFormat),
      'Return Format must document single-phase');
    const hasFields =
      /status/.test(returnFormat) &&
      /phase_completed/.test(returnFormat) &&
      /gate_result/.test(returnFormat) &&
      /blockers/.test(returnFormat);
    assert.ok(hasFields,
      'single-phase return must include status, phase_completed, gate_result, blockers');
  });

  it('T17: finalize return format documented | traces: AC-04.3', () => {
    assert.ok(returnFormat, 'Return Format subsection must exist');
    assert.ok(
      /finalize/.test(returnFormat),
      'Return Format must document finalize');
    const hasFields =
      /status/.test(returnFormat) &&
      /merged/.test(returnFormat) &&
      /workflow_id/.test(returnFormat) &&
      /metrics/.test(returnFormat);
    assert.ok(hasFields,
      'finalize return must include status, merged, workflow_id, metrics');
  });
});

// ===========================================================================
// Group 6: Non-Functional Requirements (NFR-01, NFR-02, NFR-03) -- T18-T20
// ===========================================================================

describe('Group 6: Non-Functional Requirements', () => {

  it('T18: Full-workflow mode regression guard -- Section 4a preserved | traces: NFR-01', () => {
    assert.ok(section4a, 'Section 4a must exist');
    // Still contains "AUTOMATIC" or "automatic" phase transitions
    assert.ok(
      /automatic/i.test(section4a),
      'Section 4a must still contain automatic phase transition instructions');
    // Still contains FORBIDDEN interaction patterns
    assert.ok(
      /FORBIDDEN/i.test(section4a) || /forbidden/i.test(section4a),
      'Section 4a must still contain FORBIDDEN interaction patterns');
    // Still contains Human Review Checkpoint exception
    assert.ok(
      /Human Review/i.test(section4a),
      'Section 4a must still contain Human Review Checkpoint exception');
    // Still contains Human Escalation exception
    assert.ok(
      /escalat/i.test(section4a),
      'Section 4a must still contain Human Escalation exception');
  });

  it('T19: MODE enforcement positioned before Section 3c, 4, and 4a | traces: NFR-02', () => {
    const modeIdx = orchestratorContent.indexOf('# MODE ENFORCEMENT');
    assert.ok(modeIdx !== -1, 'MODE ENFORCEMENT heading must exist');

    // Must be before Section 3c
    const sec3cIdx = orchestratorContent.search(/## 3c\./);
    if (sec3cIdx !== -1) {
      assert.ok(modeIdx < sec3cIdx,
        'MODE ENFORCEMENT must appear before Section 3c');
    }

    // Must be before Section 4
    const sec4Idx = orchestratorContent.search(/## 4\.\s+Workflow Phase Advancement/);
    if (sec4Idx !== -1) {
      assert.ok(modeIdx < sec4Idx,
        'MODE ENFORCEMENT must appear before Section 4');
    }

    // Must be before Section 4a
    const sec4aIdx = orchestratorContent.search(/## 4a\./);
    if (sec4aIdx !== -1) {
      assert.ok(modeIdx < sec4aIdx,
        'MODE ENFORCEMENT must appear before Section 4a');
    }
  });

  it('T20: Stop conditions use imperative language with emphasis | traces: NFR-03', () => {
    assert.ok(modeEnforcementBlock, 'MODE ENFORCEMENT block must exist');
    // Must contain at least 2 imperative stop phrases
    const stopPhrases = [
      /\bSTOP\b/,
      /DO NOT PROCEED/i,
      /RETURN.*IMMEDIATELY/i,
      /MUST NOT/i,
      /DO NOT delegate/i,
      /TERMINATE/i,
      /DO NOT advance/i,
    ];
    let matchCount = 0;
    for (const pattern of stopPhrases) {
      if (pattern.test(modeEnforcementBlock)) matchCount++;
    }
    assert.ok(matchCount >= 2,
      `MODE ENFORCEMENT must contain at least 2 imperative stop phrases (found ${matchCount})`);
    // Must use bold formatting or CAPS for emphasis
    const hasEmphasis =
      /\*\*CRITICAL\*\*/.test(modeEnforcementBlock) ||
      /CRITICAL/.test(modeEnforcementBlock);
    assert.ok(hasEmphasis,
      'MODE ENFORCEMENT must use bold or CAPS for emphasis');
    // Must explicitly say these boundaries OVERRIDE Section 4a
    const hasOverride =
      /OVERRIDE.*(?:Section 4a|automatic.*transition)/i.test(modeEnforcementBlock) ||
      /(?:Section 4a|automatic.*transition).*OVERRIDE/i.test(modeEnforcementBlock);
    assert.ok(hasOverride,
      'MODE ENFORCEMENT must explicitly say boundaries OVERRIDE Section 4a or automatic transitions');
  });
});
