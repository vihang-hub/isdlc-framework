/**
 * Codex Adapter — Verb Resolver
 * ==============================
 * Resolves reserved verbs (add, analyze, build) from user prompts
 * against the canonical verb spec (REQ-0139).
 *
 * Pure function — no side effects. Verb spec loaded once at import
 * via readFileSync. Both prompt-prepend (projection.js) and runtime
 * guard (runtime.js) call resolveVerb() — single parser, no drift.
 *
 * Requirements: FR-001, FR-006
 * Source: GitHub #205 (REQ-0139)
 *
 * @module src/providers/codex/verb-resolver
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Verb Spec Loading
// ---------------------------------------------------------------------------

/** @type {Object|null} Cached verb spec */
let cachedSpec = null;

/** @type {string} Default path to reserved-verbs.json */
const DEFAULT_SPEC_PATH = join(__dirname, '..', '..', 'isdlc', 'config', 'reserved-verbs.json');

/**
 * Load and return the parsed verb spec.
 * Returns cached copy on subsequent calls (unless specPath differs from default).
 *
 * @param {string} [specPath] - Override path to reserved-verbs.json
 * @returns {Object|null} Parsed verb spec or null if file missing/malformed
 */
export function loadVerbSpec(specPath) {
  // If custom path provided, always load fresh (for testing)
  if (specPath) {
    try {
      const raw = readFileSync(specPath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  // Return cached default spec
  if (cachedSpec) return cachedSpec;

  try {
    const raw = readFileSync(DEFAULT_SPEC_PATH, 'utf-8');
    cachedSpec = JSON.parse(raw);
    return cachedSpec;
  } catch {
    return null;
  }
}

// Pre-load at import time (fail-open: cachedSpec stays null)
loadVerbSpec();

// ---------------------------------------------------------------------------
// Default (not-detected) result
// ---------------------------------------------------------------------------

/**
 * Build a not-detected result.
 *
 * @param {string|null} reason
 * @returns {Object} VerbResult
 */
function notDetected(reason = null) {
  return {
    detected: false,
    verb: null,
    command: null,
    confirmation_required: false,
    ambiguity: false,
    ambiguous_verbs: [],
    source_phrase: null,
    blocked_by: null,
    reason
  };
}

// ---------------------------------------------------------------------------
// resolveVerb — FR-006
// ---------------------------------------------------------------------------

/**
 * Resolve reserved verbs from a user prompt.
 *
 * Algorithm:
 * 1. Guard: empty/null prompt → empty_input
 * 2. Guard: isSlashCommand → slash_command
 * 3. Guard: verb spec not loaded → spec_missing
 * 4. Normalize prompt
 * 5. Check exclusions
 * 6. Match verbs by phrases and imperative_forms
 * 7. Disambiguate if multiple matches
 * 8. Set blocked_by if activeWorkflow
 *
 * @param {string} prompt - Raw user prompt text
 * @param {Object} [options]
 * @param {boolean} [options.activeWorkflow] - Whether a workflow is currently active
 * @param {boolean} [options.isSlashCommand] - Whether the prompt starts with /
 * @returns {Object} VerbResult
 */
export function resolveVerb(prompt, options = {}) {
  // 1. Guard: empty/null/non-string prompt
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return notDetected('empty_input');
  }

  // 2. Guard: slash command
  if (options.isSlashCommand) {
    return notDetected('slash_command');
  }

  // 3. Guard: verb spec not loaded
  const spec = cachedSpec || loadVerbSpec();
  if (!spec || !spec.verbs) {
    return notDetected('spec_missing');
  }

  // 4. Normalize
  const normalized = prompt.toLowerCase().trim();

  // 5. Check exclusions — if any exclusion pattern is found, bail out
  if (spec.exclusions && Array.isArray(spec.exclusions)) {
    for (const exclusion of spec.exclusions) {
      if (normalized.includes(exclusion.toLowerCase())) {
        return notDetected('excluded');
      }
    }
  }

  // 6. Match verbs — ordered by precedence ascending (highest priority first)
  const verbEntries = Object.entries(spec.verbs)
    .sort(([, a], [, b]) => a.precedence - b.precedence);

  const matches = []; // { verb, phrase }

  for (const [verbName, verbDef] of verbEntries) {
    let matched = false;
    let matchedPhrase = null;

    // Check phrases (substring match)
    if (verbDef.phrases && Array.isArray(verbDef.phrases)) {
      for (const phrase of verbDef.phrases) {
        if (normalized.includes(phrase.toLowerCase())) {
          matched = true;
          matchedPhrase = phrase;
          break;
        }
      }
    }

    // Check imperative_forms (substring match — broader to catch natural language)
    if (!matched && verbDef.imperative_forms && Array.isArray(verbDef.imperative_forms)) {
      for (const form of verbDef.imperative_forms) {
        if (normalized.includes(form.toLowerCase())) {
          matched = true;
          matchedPhrase = form;
          break;
        }
      }
    }

    if (matched) {
      matches.push({ verb: verbName, phrase: matchedPhrase, def: verbDef });
    }
  }

  // 7. No matches
  if (matches.length === 0) {
    return notDetected(null);
  }

  // 8. Single match
  if (matches.length === 1) {
    const m = matches[0];
    return {
      detected: true,
      verb: m.verb,
      command: m.def.command,
      confirmation_required: true,
      ambiguity: false,
      ambiguous_verbs: [],
      source_phrase: m.phrase,
      blocked_by: options.activeWorkflow ? 'active_workflow' : null,
      reason: null
    };
  }

  // 9. Multiple matches — disambiguate
  const matchedVerbNames = matches.map(m => m.verb).sort();
  const disambigKey = matchedVerbNames.join('+');
  let resolvedVerb;

  if (spec.disambiguation && spec.disambiguation[disambigKey]) {
    resolvedVerb = spec.disambiguation[disambigKey];
  } else {
    // Fallback: use highest precedence (lowest number)
    resolvedVerb = matches[0].verb;
  }

  const resolvedMatch = matches.find(m => m.verb === resolvedVerb) || matches[0];

  return {
    detected: true,
    verb: resolvedVerb,
    command: resolvedMatch.def.command,
    confirmation_required: true,
    ambiguity: true,
    ambiguous_verbs: matchedVerbNames,
    source_phrase: resolvedMatch.phrase,
    blocked_by: options.activeWorkflow ? 'active_workflow' : null,
    reason: null
  };
}
