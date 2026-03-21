/**
 * Core Config — Re-exports
 *
 * REQ-0125: Move gate profiles, schemas, phase IDs to src/core/config/
 *
 * @module src/core/config
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export {
  KNOWN_PHASE_KEYS,
  PHASE_KEY_ALIASES,
  ANALYSIS_PHASES,
  IMPLEMENTATION_PHASES,
  PHASE_NAME_MAP,
  normalizePhaseKey
} from './phase-ids.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load a gate profile JSON by name from src/core/config/profiles/.
 * @param {string} name - Profile name (e.g., 'rapid', 'standard', 'strict')
 * @returns {object|null} Parsed profile object or null
 */
export function loadCoreProfile(name) {
  try {
    const filePath = join(__dirname, 'profiles', `${name}.json`);
    if (!existsSync(filePath)) return null;
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Load a schema JSON by ID from src/core/config/schemas/.
 * @param {string} schemaId - Schema ID (e.g., 'test-iteration')
 * @returns {object|null} Parsed schema object or null
 */
export function loadCoreSchema(schemaId) {
  try {
    const filePath = join(__dirname, 'schemas', `${schemaId}.schema.json`);
    if (!existsSync(filePath)) return null;
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * List all available core profile names.
 * @returns {string[]} Profile names (without .json extension)
 */
export function listCoreProfiles() {
  try {
    const dir = join(__dirname, 'profiles');
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  } catch {
    return [];
  }
}

/**
 * List all available core schema IDs.
 * @returns {string[]} Schema IDs (without .schema.json suffix)
 */
export function listCoreSchemas() {
  try {
    const dir = join(__dirname, 'schemas');
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter(f => f.endsWith('.schema.json'))
      .map(f => f.replace('.schema.json', ''));
  } catch {
    return [];
  }
}
