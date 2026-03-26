/**
 * Contract Reference Resolver
 * ============================
 * REQ-0141: Execution Contract System (FR-001, FR-003)
 * AC-001-05, AC-003-04, AC-003-05
 *
 * Resolves $ref objects in contract entries to concrete values.
 * Extensible via registered resolver functions.
 * Per-cycle caching via options.cache Map.
 *
 * @module src/core/validators/contract-ref-resolver
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Resolver registry
// ---------------------------------------------------------------------------

/** @type {Map<string, Function>} */
const resolverRegistry = new Map();

// ---------------------------------------------------------------------------
// Built-in resolvers
// ---------------------------------------------------------------------------

/**
 * Read and parse a JSON file, using cache if available.
 * @param {string} filePath
 * @param {Map} [cache]
 * @returns {*} Parsed JSON or null on error
 */
function readJsonCached(filePath, cache) {
  if (cache && cache.has(filePath)) {
    return cache.get(filePath);
  }
  try {
    if (!existsSync(filePath)) {
      if (cache) cache.set(filePath, null);
      return null;
    }
    const content = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(content);
    if (cache) cache.set(filePath, parsed);
    return parsed;
  } catch {
    if (cache) cache.set(filePath, null);
    return null;
  }
}

/**
 * Built-in resolver: artifact-paths
 * Resolves to array of file paths for a given phase.
 * Substitutes {artifact_folder} in paths.
 *
 * @param {Object} ref - { "$ref": "artifact-paths", "phase": "06-implementation" }
 * @param {Object} options - { projectRoot, cache, artifactFolder }
 * @returns {string[]} Resolved artifact paths
 */
function resolveArtifactPaths(ref, options) {
  const configPath = join(
    options.projectRoot,
    '.claude', 'hooks', 'config', 'artifact-paths.json'
  );
  const config = readJsonCached(configPath, options.cache);
  if (!config || !config.phases) return [];

  const phase = ref.phase;
  if (!phase || !config.phases[phase]) return [];

  const paths = config.phases[phase].paths || [];
  const artifactFolder = options.artifactFolder || '{artifact_folder}';

  return paths.map(p => p.replace(/\{artifact_folder\}/g, artifactFolder));
}

/**
 * Built-in resolver: skills-manifest
 * Resolves to array of skill IDs owned by a given agent.
 *
 * @param {Object} ref - { "$ref": "skills-manifest", "agent": "software-developer", "filter": ... }
 * @param {Object} options - { projectRoot, cache }
 * @returns {string[]} Resolved skill IDs
 */
function resolveSkillsManifest(ref, options) {
  const configPath = join(
    options.projectRoot,
    '.claude', 'hooks', 'config', 'skills-manifest.json'
  );
  const config = readJsonCached(configPath, options.cache);
  if (!config || !config.ownership) return [];

  const agent = ref.agent;
  if (!agent || !config.ownership[agent]) return [];

  return config.ownership[agent].skills || [];
}

// Register built-in resolvers
resolverRegistry.set('artifact-paths', resolveArtifactPaths);
resolverRegistry.set('skills-manifest', resolveSkillsManifest);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve a $ref object to concrete values.
 * Caches config file reads per evaluation cycle via options.cache.
 *
 * @param {*} ref - Reference object: { "$ref": "source", ...params }
 * @param {Object} options
 * @param {string} options.projectRoot - Project root path
 * @param {Map} [options.cache] - Shared cache for this evaluation cycle
 * @param {string} [options.artifactFolder] - Artifact folder for path substitution
 * @returns {*} Resolved value (array of paths, array of skill IDs, etc.)
 */
export function resolveRef(ref, options) {
  // Guard: null/undefined/non-object ref
  if (!ref || typeof ref !== 'object' || Array.isArray(ref)) {
    return [];
  }

  // Guard: no $ref key
  const source = ref['$ref'];
  if (!source || typeof source !== 'string') {
    return [];
  }

  const resolver = resolverRegistry.get(source);
  if (!resolver) {
    return [];
  }

  try {
    return resolver(ref, options || {});
  } catch {
    // Fail-open: return empty on any resolver error
    return [];
  }
}

/**
 * Register a custom resolver for a new $ref source.
 *
 * @param {string} source - Source name (e.g., "artifact-paths")
 * @param {Function} resolver - (ref, options) => resolvedValue
 */
export function registerResolver(source, resolver) {
  if (typeof source === 'string' && typeof resolver === 'function') {
    resolverRegistry.set(source, resolver);
  }
}

/**
 * Reset the resolver registry to built-in resolvers only.
 * Intended for test cleanup.
 */
export function _resetResolvers() {
  resolverRegistry.clear();
  resolverRegistry.set('artifact-paths', resolveArtifactPaths);
  resolverRegistry.set('skills-manifest', resolveSkillsManifest);
}
