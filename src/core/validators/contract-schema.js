/**
 * Contract Schema Validator
 * ==========================
 * REQ-0141: Execution Contract System (FR-001)
 * AC-001-01 through AC-001-05
 *
 * Defines and validates the JSON schema for execution contract files.
 * Pure validation -- no I/O.
 *
 * @module src/core/validators/contract-schema
 */

// ---------------------------------------------------------------------------
// Valid enum values
// ---------------------------------------------------------------------------

const VALID_RESPONSES = new Set(['block', 'warn', 'report']);

const VIOLATION_RESPONSE_KEYS = [
  'agent_not_engaged',
  'skills_missing',
  'artifacts_missing',
  'state_incomplete',
  'cleanup_skipped',
  'presentation_violated'
];

// ---------------------------------------------------------------------------
// Internal validators
// ---------------------------------------------------------------------------

/**
 * Validate a state_assertions entry: must have path (string) and equals (any).
 * @param {*} assertion
 * @returns {string|null} Error message or null if valid
 */
function validateStateAssertion(assertion) {
  if (!assertion || typeof assertion !== 'object') {
    return 'state_assertion must be an object';
  }
  if (typeof assertion.path !== 'string' || assertion.path.length === 0) {
    return 'state_assertion.path must be a non-empty string';
  }
  if (!('equals' in assertion)) {
    return 'state_assertion must have an equals field';
  }
  return null;
}

/**
 * Validate expectations.presentation section.
 * All fields are optional (nullable).
 * @param {*} presentation
 * @returns {string[]} Error messages
 */
function validatePresentation(presentation) {
  if (presentation === null || presentation === undefined) return [];
  if (typeof presentation !== 'object' || Array.isArray(presentation)) {
    return ['expectations.presentation must be an object or null'];
  }
  const errors = [];
  if ('confirmation_sequence' in presentation && presentation.confirmation_sequence !== null) {
    if (!Array.isArray(presentation.confirmation_sequence)) {
      errors.push('expectations.presentation.confirmation_sequence must be an array or null');
    }
  }
  if ('persona_format' in presentation && presentation.persona_format !== null) {
    if (typeof presentation.persona_format !== 'string') {
      errors.push('expectations.presentation.persona_format must be a string or null');
    }
  }
  if ('progress_format' in presentation && presentation.progress_format !== null) {
    if (typeof presentation.progress_format !== 'string') {
      errors.push('expectations.presentation.progress_format must be a string or null');
    }
  }
  if ('completion_summary' in presentation && presentation.completion_summary !== null) {
    if (typeof presentation.completion_summary !== 'boolean') {
      errors.push('expectations.presentation.completion_summary must be a boolean or null');
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate a parsed contract object against the schema.
 * A contract must have version (string), entries (array), and optionally _generation_metadata.
 *
 * @param {*} contract - Parsed JSON contract
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateContract(contract) {
  const errors = [];

  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    return { valid: false, errors: ['Contract must be a non-null object'] };
  }

  if (typeof contract.version !== 'string' || contract.version.length === 0) {
    errors.push('Contract must have a non-empty version string');
  }

  if (!Array.isArray(contract.entries)) {
    errors.push('Contract must have an entries array');
  } else {
    for (let i = 0; i < contract.entries.length; i++) {
      const entryResult = validateContractEntry(contract.entries[i]);
      if (!entryResult.valid) {
        for (const err of entryResult.errors) {
          errors.push(`entries[${i}]: ${err}`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a single contract entry.
 * Must have: execution_unit (string), context (string), expectations (object), violation_response (object).
 *
 * @param {*} entry - Single execution_unit entry
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateContractEntry(entry) {
  const errors = [];

  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return { valid: false, errors: ['Entry must be a non-null object'] };
  }

  // Required: execution_unit
  if (typeof entry.execution_unit !== 'string' || entry.execution_unit.length === 0) {
    errors.push('Entry must have a non-empty execution_unit string');
  }

  // Required: context
  if (typeof entry.context !== 'string' || entry.context.length === 0) {
    errors.push('Entry must have a non-empty context string');
  }

  // Required: expectations
  if (!entry.expectations || typeof entry.expectations !== 'object' || Array.isArray(entry.expectations)) {
    errors.push('Entry must have an expectations object');
  } else {
    // Validate state_assertions if present
    if ('state_assertions' in entry.expectations && entry.expectations.state_assertions !== null) {
      if (!Array.isArray(entry.expectations.state_assertions)) {
        errors.push('expectations.state_assertions must be an array');
      } else {
        for (let i = 0; i < entry.expectations.state_assertions.length; i++) {
          const assertErr = validateStateAssertion(entry.expectations.state_assertions[i]);
          if (assertErr) {
            errors.push(`expectations.state_assertions[${i}]: ${assertErr}`);
          }
        }
      }
    }

    // Validate cleanup if present
    if ('cleanup' in entry.expectations && entry.expectations.cleanup !== null) {
      if (!Array.isArray(entry.expectations.cleanup)) {
        errors.push('expectations.cleanup must be an array');
      }
    }

    // Validate presentation if present
    const presErrors = validatePresentation(entry.expectations.presentation);
    errors.push(...presErrors);
  }

  // Required: violation_response
  if (!entry.violation_response || typeof entry.violation_response !== 'object' || Array.isArray(entry.violation_response)) {
    errors.push('Entry must have a violation_response object');
  } else {
    // Validate that all values are valid response levels
    for (const [key, value] of Object.entries(entry.violation_response)) {
      if (!VALID_RESPONSES.has(value)) {
        errors.push(`violation_response.${key} must be one of: block, warn, report (got: ${JSON.stringify(value)})`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
