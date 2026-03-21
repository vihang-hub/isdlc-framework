/**
 * Profile Loader — Core profile management
 * ==========================================
 * Discovers, loads, validates, and resolves gate profiles.
 *
 * Extracted from src/claude/hooks/lib/profile-loader.cjs (REQ-0081).
 *
 * @module src/core/validators/profile-loader
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { KNOWN_PHASE_KEYS } from '../config/phase-ids.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export { KNOWN_PHASE_KEYS };

export const KNOWN_OVERRIDE_KEYS = [
  'test_iteration', 'constitutional_validation', 'interactive_elicitation',
  'agent_delegation_validation', 'artifact_validation'
];

// -- Levenshtein distance --

export function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export function findClosestMatch(input, candidates, maxDistance) {
  let best = null;
  let bestDist = maxDistance + 1;
  for (const c of candidates) {
    const d = levenshtein(input.toLowerCase(), c.toLowerCase());
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return bestDist <= maxDistance ? best : null;
}

// -- Profile tier directories --

export function getBuiltinProfilesDir() {
  // Look in src/core/config/profiles first, then fall back to hooks/config/profiles
  const coreDir = resolve(__dirname, '..', 'config', 'profiles');
  if (existsSync(coreDir)) return coreDir;
  return resolve(__dirname, '..', '..', 'claude', 'hooks', 'config', 'profiles');
}

export function getProjectProfilesDir(projectRoot) {
  return join(projectRoot || getProjectRootSafe(), '.isdlc', 'profiles');
}

export function getPersonalProfilesDir() {
  return join(homedir(), '.isdlc', 'profiles');
}

function getProjectRootSafe() {
  try {
    if (process.env.CLAUDE_PROJECT_DIR) return process.env.CLAUDE_PROJECT_DIR;
    return process.cwd();
  } catch {
    return process.cwd();
  }
}

// -- File discovery --

function discoverProfileFiles(dir) {
  try {
    if (!existsSync(dir)) return [];
    const entries = readdirSync(dir).filter(f => f.endsWith('.json'));
    return entries.map(f => join(dir, f));
  } catch {
    return [];
  }
}

// -- validateProfile --

export function validateProfile(filePath) {
  const errors = [];
  const suggestions = [];

  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch (e) {
    return { valid: false, errors: [{ field: '_file', message: `Cannot read file: ${e.message}`, value: null }], suggestions: [] };
  }

  if (!content.trim()) {
    return { valid: false, errors: [{ field: '_file', message: 'Profile file is empty', value: '' }], suggestions: [] };
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    return { valid: false, errors: [{ field: '_file', message: `Invalid JSON: ${e.message}`, value: content }], suggestions: [] };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { valid: false, errors: [{ field: '_root', message: `Root must be a JSON object, got ${Array.isArray(parsed) ? 'array' : typeof parsed}`, value: parsed }], suggestions: [] };
  }

  if (!parsed.name || typeof parsed.name !== 'string') {
    errors.push({ field: 'name', message: 'Missing or invalid required field: name', value: parsed.name, expected_type: 'string' });
  }
  if (!parsed.description || typeof parsed.description !== 'string') {
    errors.push({ field: 'description', message: 'Missing or invalid required field: description', value: parsed.description, expected_type: 'string' });
  }
  if (!Array.isArray(parsed.triggers) || parsed.triggers.length === 0) {
    errors.push({ field: 'triggers', message: 'Missing or invalid required field: triggers (must be non-empty array of strings)', value: parsed.triggers, expected_type: 'string[]' });
  } else if (parsed.triggers.some(t => typeof t !== 'string')) {
    errors.push({ field: 'triggers', message: 'All triggers must be strings', value: parsed.triggers, expected_type: 'string[]' });
  }

  const knownTopLevel = ['name', 'description', 'triggers', 'overrides', 'global_overrides'];
  for (const key of Object.keys(parsed)) {
    if (!knownTopLevel.includes(key)) {
      const match = findClosestMatch(key, knownTopLevel, 3);
      if (match) {
        suggestions.push({ field: key, original: key, suggested: match, confidence: levenshtein(key, match) < 2 ? 'high' : 'medium' });
      }
      errors.push({ field: key, message: `Unknown field '${key}'${match ? `. Did you mean '${match}'?` : ' -- will be ignored'}`, value: parsed[key] });
    }
  }

  if (parsed.overrides && typeof parsed.overrides === 'object') {
    for (const phaseKey of Object.keys(parsed.overrides)) {
      if (!KNOWN_PHASE_KEYS.includes(phaseKey)) {
        const match = findClosestMatch(phaseKey, KNOWN_PHASE_KEYS, 3);
        if (match) {
          suggestions.push({ field: `overrides.${phaseKey}`, original: phaseKey, suggested: match, confidence: levenshtein(phaseKey, match) < 2 ? 'high' : 'medium' });
        }
        errors.push({ field: `overrides.${phaseKey}`, message: `Unknown phase key '${phaseKey}'${match ? `. Did you mean '${match}'?` : ''}`, value: parsed.overrides[phaseKey] });
      } else {
        validateOverrideBlock(parsed.overrides[phaseKey], `overrides.${phaseKey}`, errors, suggestions);
      }
    }
  }

  if (parsed.global_overrides && typeof parsed.global_overrides === 'object') {
    validateOverrideBlock(parsed.global_overrides, 'global_overrides', errors, suggestions);
  }

  return { valid: errors.length === 0, errors, suggestions };
}

function validateOverrideBlock(block, prefix, errors, suggestions) {
  if (typeof block !== 'object' || block === null) return;
  for (const key of Object.keys(block)) {
    if (!KNOWN_OVERRIDE_KEYS.includes(key)) {
      const match = findClosestMatch(key, KNOWN_OVERRIDE_KEYS, 3);
      if (match) {
        suggestions.push({ field: `${prefix}.${key}`, original: key, suggested: match, confidence: levenshtein(key, match) < 2 ? 'high' : 'medium' });
      }
      errors.push({ field: `${prefix}.${key}`, message: `Unknown override key '${key}'${match ? `. Did you mean '${match}'?` : ''}`, value: block[key] });
    }
  }
}

// -- healProfile --

export function healProfile(filePath, fixes) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(content);

    for (const fix of fixes) {
      const parts = fix.field.split('.');
      let target = parsed;
      for (let i = 0; i < parts.length - 1; i++) {
        target = target[parts[i]];
        if (!target) break;
      }
      if (target && parts.length > 0) {
        const oldKey = fix.original;
        const newKey = fix.suggested;
        if (target[oldKey] !== undefined) {
          target[newKey] = target[oldKey];
          delete target[oldKey];
        }
      }
    }

    writeFileSync(filePath, JSON.stringify(parsed, null, 2) + '\n');
    return true;
  } catch {
    return false;
  }
}

// -- loadAllProfiles --

export function loadAllProfiles(projectRoot) {
  const registry = {
    profiles: new Map(),
    sources: { builtin: [], project: [], personal: [] }
  };

  const tiers = [
    { dir: getBuiltinProfilesDir(), source: 'built-in', sourceKey: 'builtin' },
    { dir: getProjectProfilesDir(projectRoot), source: 'project', sourceKey: 'project' },
    { dir: getPersonalProfilesDir(), source: 'personal', sourceKey: 'personal' }
  ];

  for (const tier of tiers) {
    const files = discoverProfileFiles(tier.dir);
    for (const filePath of files) {
      const validation = validateProfile(filePath);
      if (!validation.valid) continue;

      try {
        const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
        const result = {
          profile: parsed,
          source: tier.source,
          source_path: filePath,
          warnings: [],
          was_healed: false
        };

        registry.profiles.set(parsed.name, result);
        if (!registry.sources[tier.sourceKey].includes(parsed.name)) {
          registry.sources[tier.sourceKey].push(parsed.name);
        }
      } catch { /* silent */ }
    }
  }

  return registry;
}

// -- resolveProfile --

export function resolveProfile(name, registry) {
  if (!name) return null;
  const reg = registry || loadAllProfiles();
  return reg.profiles.get(name) || null;
}

// -- matchProfileByTrigger --

export function matchProfileByTrigger(input, registry) {
  if (!input) return null;
  const reg = registry || loadAllProfiles();
  const normalizedInput = input.toLowerCase().trim();

  const matches = [];
  for (const [, result] of reg.profiles) {
    for (const trigger of result.profile.triggers) {
      if (normalizedInput.includes(trigger.toLowerCase())) {
        matches.push(result);
        break;
      }
    }
  }

  if (matches.length === 1) return matches[0];
  return null;
}

// -- resolveProfileOverrides --

export function resolveProfileOverrides(profileName, currentPhase, registry) {
  const result = resolveProfile(profileName, registry);
  if (!result) return null;

  const profile = result.profile;
  const rawGlobal = profile.global_overrides;
  const rawPhase = profile.overrides?.[currentPhase];
  const globalOverrides = (rawGlobal && typeof rawGlobal === 'object' && Object.keys(rawGlobal).length > 0) ? rawGlobal : null;
  const phaseOverrides = (rawPhase && typeof rawPhase === 'object' && Object.keys(rawPhase).length > 0) ? rawPhase : null;

  if (!globalOverrides && !phaseOverrides) return null;
  if (!globalOverrides) return phaseOverrides;
  if (!phaseOverrides) return globalOverrides;

  return deepMerge(globalOverrides, phaseOverrides);
}

// -- checkThresholdWarnings --

export function checkThresholdWarnings(profile) {
  const warnings = [];
  const name = profile.name || 'unknown';

  const g = profile.global_overrides;
  if (g) {
    if (g.constitutional_validation?.enabled === false) {
      warnings.push(`Profile '${name}' disables constitutional validation`);
    }
    if (g.test_iteration?.enabled === false) {
      warnings.push(`Profile '${name}' disables test iteration`);
    }
    const globalCov = g.test_iteration?.success_criteria?.min_coverage_percent;
    if (globalCov !== undefined) {
      if (typeof globalCov === 'number' && globalCov < 80) {
        warnings.push(`Profile '${name}' sets coverage to ${globalCov}% (recommended: 80%)`);
      } else if (typeof globalCov === 'object' && globalCov !== null && !Array.isArray(globalCov)) {
        const standardTier = globalCov.standard;
        if (standardTier !== undefined && standardTier < 80) {
          warnings.push(`Profile '${name}' sets coverage to ${standardTier}% (recommended: 80%)`);
        }
      }
    }
    if (g.test_iteration?.max_iterations !== undefined && g.test_iteration.max_iterations < 5) {
      warnings.push(`Profile '${name}' reduces max iterations to ${g.test_iteration.max_iterations} (recommended: 5+)`);
    }
    if (g.constitutional_validation?.enabled === false && g.test_iteration?.enabled === false &&
        g.interactive_elicitation?.enabled === false && g.agent_delegation_validation?.enabled === false &&
        g.artifact_validation?.enabled === false) {
      warnings.push(`Profile '${name}' disables all gate checks -- no quality validation will run`);
    }
  }

  if (profile.overrides) {
    for (const [phase, overrides] of Object.entries(profile.overrides)) {
      const phaseCov = overrides.test_iteration?.success_criteria?.min_coverage_percent;
      if (phaseCov !== undefined) {
        if (typeof phaseCov === 'number' && phaseCov < 80) {
          warnings.push(`Profile '${name}' sets coverage to ${phaseCov}% for phase ${phase} (recommended: 80%)`);
        } else if (typeof phaseCov === 'object' && phaseCov !== null && !Array.isArray(phaseCov)) {
          const standardTier = phaseCov.standard;
          if (standardTier !== undefined && standardTier < 80) {
            warnings.push(`Profile '${name}' sets coverage to ${standardTier}% for phase ${phase} (recommended: 80%)`);
          }
        }
      }
    }
  }

  return warnings;
}

// -- deepMerge --

function deepMerge(base, overrides) {
  if (!base) return overrides;
  if (!overrides) return base;
  const merged = JSON.parse(JSON.stringify(base));
  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      merged[key] = deepMerge(merged[key] || {}, value);
    } else {
      merged[key] = value;
    }
  }
  return merged;
}
