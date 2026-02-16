/**
 * iSDLC Skill Enforcement - Common Utilities
 * ===========================================
 * Shared functions for skill validation hooks
 * Cross-platform Node.js implementation
 *
 * Version: 3.0.0
 * Monorepo support: state routing, project isolation
 */

const fs = require('fs');
const path = require('path');

// =========================================================================
// Per-Process Caching (REQ-0020: T6 Hook I/O Optimization)
// =========================================================================

/**
 * Cached project root path. Set on first getProjectRoot() call.
 * Per-process lifetime -- garbage-collected when process exits.
 * @type {string|null}
 */
let _cachedProjectRoot = null;

/**
 * The CLAUDE_PROJECT_DIR value at the time of caching.
 * Used to detect env var changes (important for test environments).
 * @type {string|undefined}
 */
let _cachedProjectDirEnv = undefined;

/**
 * Config file cache. Key: "{projectRoot}:{configFileName}".
 * Value: { mtimeMs: number, data: object }.
 * Per-process lifetime -- garbage-collected when process exits.
 * @type {Map<string, { mtimeMs: number, data: object }>}
 */
const _configCache = new Map();

// =========================================================================
// Phase Prefixes (BUG-0009 item 0.13)
// =========================================================================

/**
 * Centralized phase prefix constants used across hook files.
 * Replaces scattered inline string literals to reduce copy-paste errors
 * when phase naming changes.
 * @type {Readonly<{UPGRADE: string, IMPLEMENTATION: string, REQUIREMENTS: string}>}
 */
const PHASE_PREFIXES = Object.freeze({
    UPGRADE: '15-upgrade',
    IMPLEMENTATION: '06-implementation',
    REQUIREMENTS: '01-requirements'
});

// =========================================================================
// Protected State Fields & Patterns (REQ-HARDENING)
// =========================================================================

/**
 * Regex to match state.json paths (single-project and monorepo, cross-platform).
 * Consolidated from state-write-validator and explore-readonly-enforcer.
 */
const STATE_JSON_PATTERN = /\.isdlc[/\\](?:projects[/\\][^/\\]+[/\\])?state\.json$/;

/**
 * State fields that must NEVER be modified by agents directly.
 * These are governance-critical fields whose values are set by hooks only.
 * @type {ReadonlyArray<string>}
 */
const PROTECTED_STATE_FIELDS = Object.freeze([
    'iteration_enforcement.enabled',
    'iteration_enforcement',
    'chat_explore_active',
    'iteration_config.testing_max',
    'iteration_config.circuit_breaker_threshold',
    'gate_validation.status'
]);

/**
 * Check if a state.json file physically exists on disk (regardless of parse-ability).
 * Differentiates "missing file" (legitimate no-state) from "corrupt file" (exists but unparseable).
 * @param {string} [projectId] - Optional project ID for monorepo mode
 * @returns {boolean} True if the file exists on disk
 */
function stateFileExistsOnDisk(projectId) {
    const stateFile = resolveStatePath(projectId);
    return fs.existsSync(stateFile);
}

/**
 * Get project root directory (where .isdlc/ folder exists)
 * @returns {string} Project root path
 */
function getProjectRoot() {
    // FR-002: Return cached value if available (AC-002a, AC-002c)
    // Invalidate cache if CLAUDE_PROJECT_DIR changed since last caching
    if (_cachedProjectRoot !== null) {
        const currentEnv = process.env.CLAUDE_PROJECT_DIR;
        if (currentEnv === _cachedProjectDirEnv) {
            return _cachedProjectRoot;
        }
        // Env changed -- invalidate and re-resolve
        _cachedProjectRoot = null;
        _cachedProjectDirEnv = undefined;
    }

    // AC-002b: CLAUDE_PROJECT_DIR shortcut (existing behavior preserved)
    if (process.env.CLAUDE_PROJECT_DIR) {
        _cachedProjectRoot = process.env.CLAUDE_PROJECT_DIR;
        _cachedProjectDirEnv = process.env.CLAUDE_PROJECT_DIR;
        return _cachedProjectRoot;
    }

    // Fallback: traverse up to find .isdlc folder
    let dir = process.cwd();
    while (dir !== path.parse(dir).root) {
        if (fs.existsSync(path.join(dir, '.isdlc'))) {
            _cachedProjectRoot = dir;
            _cachedProjectDirEnv = process.env.CLAUDE_PROJECT_DIR;
            return _cachedProjectRoot;
        }
        dir = path.dirname(dir);
    }

    // Default to current directory
    _cachedProjectRoot = process.cwd();
    _cachedProjectDirEnv = process.env.CLAUDE_PROJECT_DIR;
    return _cachedProjectRoot;
}

/**
 * Load a JSON config file with mtime-based caching (FR-001).
 * Cache key: "{projectRoot}:{configName}" for monorepo isolation (AC-001e).
 *
 * @param {string} configPath - Absolute path to the config file
 * @param {string} configName - Short name for cache key (e.g., 'skills-manifest')
 * @returns {object|null} Parsed JSON data or null if file missing/invalid
 */
function _loadConfigWithCache(configPath, configName) {
    const cacheKey = `${getProjectRoot()}:${configName}`;

    try {
        const stat = fs.statSync(configPath);
        const currentMtime = stat.mtimeMs;

        const cached = _configCache.get(cacheKey);
        if (cached && cached.mtimeMs === currentMtime) {
            // AC-001c: mtime unchanged, return cached copy
            debugLog(`Config cache HIT: ${configName}`);
            return cached.data;
        }

        // AC-001a (first load) or AC-001b (mtime changed): read from disk
        const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        _configCache.set(cacheKey, { mtimeMs: currentMtime, data });
        debugLog(`Config cache MISS: ${configName} (${cached ? 'mtime changed' : 'first load'})`);
        return data;
    } catch (e) {
        // AC-001d: file does not exist or read error -- return null, do NOT cache
        debugLog(`Config cache ERROR: ${configName} -- ${e.code || e.message}`);
        return null;
    }
}

/**
 * Reset all caches. For testing only.
 * @private
 */
function _resetCaches() {
    _cachedProjectRoot = null;
    _cachedProjectDirEnv = undefined;
    _configCache.clear();
}

/**
 * Get cache statistics. For testing only.
 * @private
 * @returns {{ projectRootCached: boolean, configCacheSize: number }}
 */
function _getCacheStats() {
    return {
        projectRootCached: _cachedProjectRoot !== null,
        configCacheSize: _configCache.size
    };
}

// =========================================================================
// Monorepo Support
// =========================================================================

/**
 * Check if this installation is in monorepo mode.
 * Monorepo mode is active when .isdlc/monorepo.json exists.
 * @returns {boolean} True if monorepo mode is active
 */
function isMonorepoMode() {
    const projectRoot = getProjectRoot();
    return fs.existsSync(path.join(projectRoot, '.isdlc', 'monorepo.json'));
}

/**
 * Read and parse monorepo.json
 * @returns {object|null} Parsed monorepo config or null
 */
function readMonorepoConfig() {
    const projectRoot = getProjectRoot();
    const configFile = path.join(projectRoot, '.isdlc', 'monorepo.json');

    if (!fs.existsSync(configFile)) {
        return null;
    }

    try {
        return JSON.parse(fs.readFileSync(configFile, 'utf8'));
    } catch (e) {
        return null;
    }
}

/**
 * Write monorepo.json
 * @param {object} config - Monorepo config to write
 * @returns {boolean} Success
 */
function writeMonorepoConfig(config) {
    const projectRoot = getProjectRoot();
    const configFile = path.join(projectRoot, '.isdlc', 'monorepo.json');

    try {
        fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Resolve project ID from current working directory.
 * Matches CWD against registered project paths (longest prefix match).
 * @returns {string|null} Project ID or null if no match
 */
function resolveProjectFromCwd() {
    if (!isMonorepoMode()) {
        return null;
    }

    const config = readMonorepoConfig();
    if (!config || !config.projects) {
        return null;
    }

    const projectRoot = getProjectRoot();
    const cwd = process.cwd();

    // Compute relative path from project root to CWD
    const relativeCwd = path.relative(projectRoot, cwd);
    if (relativeCwd.startsWith('..')) {
        // CWD is outside the project root
        return null;
    }

    // Find longest prefix match among registered project paths
    let bestMatch = null;
    let bestMatchLength = -1;

    for (const [projectId, projectConfig] of Object.entries(config.projects)) {
        const projectPath = projectConfig.path;
        if (!projectPath) continue;

        // Normalize: remove trailing slashes
        const normalizedProjectPath = projectPath.replace(/\/+$/, '');

        // Check if CWD is at or under this project path
        if (relativeCwd === normalizedProjectPath ||
            relativeCwd.startsWith(normalizedProjectPath + '/')) {
            if (normalizedProjectPath.length > bestMatchLength) {
                bestMatch = projectId;
                bestMatchLength = normalizedProjectPath.length;
            }
        }
    }

    return bestMatch;
}

/**
 * Get the active project ID in monorepo mode.
 * Resolution order:
 *   1. ISDLC_PROJECT env var
 *   2. CWD-based project detection
 *   3. monorepo.json default_project
 * @returns {string|null} Project ID or null if not in monorepo mode
 */
function getActiveProject() {
    if (!isMonorepoMode()) {
        return null;
    }

    // 1. Environment variable override
    if (process.env.ISDLC_PROJECT) {
        return process.env.ISDLC_PROJECT;
    }

    // 2. CWD-based project detection
    const cwdProject = resolveProjectFromCwd();
    if (cwdProject) {
        return cwdProject;
    }

    // 3. default_project from monorepo.json
    const config = readMonorepoConfig();
    if (config && config.default_project) {
        return config.default_project;
    }

    return null;
}

/**
 * Resolve the path to state.json, accounting for monorepo mode.
 * - Single project: .isdlc/state.json
 * - Monorepo: .isdlc/projects/{project-id}/state.json
 * @param {string} [projectId] - Optional project ID override
 * @returns {string} Absolute path to state.json
 */
function resolveStatePath(projectId) {
    const projectRoot = getProjectRoot();

    if (isMonorepoMode()) {
        const id = projectId || getActiveProject();
        if (id) {
            return path.join(projectRoot, '.isdlc', 'projects', id, 'state.json');
        }
    }

    // Default: single-project mode
    return path.join(projectRoot, '.isdlc', 'state.json');
}

/**
 * Resolve the path to the constitution file, accounting for monorepo mode.
 * In monorepo mode, returns the project-specific override if it exists,
 * otherwise falls back to the shared constitution.
 *
 * New location: docs/isdlc/constitution.md (v3.1.0+)
 * Legacy location: .isdlc/constitution.md (fallback for migration)
 *
 * @param {string} [projectId] - Optional project ID override
 * @returns {string} Absolute path to the effective constitution.md
 */
function resolveConstitutionPath(projectId) {
    const projectRoot = getProjectRoot();

    if (isMonorepoMode()) {
        const id = projectId || getActiveProject();
        if (id) {
            // New location (preferred)
            const newProjectConstitution = path.join(projectRoot, 'docs', 'isdlc', 'projects', id, 'constitution.md');
            if (fs.existsSync(newProjectConstitution)) {
                return newProjectConstitution;
            }
            // Legacy location (fallback)
            const legacyProjectConstitution = path.join(projectRoot, '.isdlc', 'projects', id, 'constitution.md');
            if (fs.existsSync(legacyProjectConstitution)) {
                return legacyProjectConstitution;
            }
            // Default to new location for creation
            return newProjectConstitution;
        }
    }

    // New location (preferred)
    const newPath = path.join(projectRoot, 'docs', 'isdlc', 'constitution.md');
    if (fs.existsSync(newPath)) {
        return newPath;
    }

    // Legacy location (fallback)
    const legacyPath = path.join(projectRoot, '.isdlc', 'constitution.md');
    if (fs.existsSync(legacyPath)) {
        return legacyPath;
    }

    // Default to new location for creation
    return newPath;
}

/**
 * Resolve the docs base path for artifacts, accounting for monorepo mode.
 * - Single project: docs/
 * - Monorepo (docs_location="root" or absent): docs/{project-id}/
 * - Monorepo (docs_location="project"): {project-path}/docs/
 * @param {string} [projectId] - Optional project ID override
 * @returns {string} Absolute path to docs base directory
 */
function resolveDocsPath(projectId) {
    const projectRoot = getProjectRoot();

    if (isMonorepoMode()) {
        const id = projectId || getActiveProject();
        if (id) {
            const config = readMonorepoConfig();
            if (config && config.docs_location === 'project') {
                const project = config.projects && config.projects[id];
                if (project && project.path) {
                    return path.join(projectRoot, project.path, 'docs');
                }
            }
            return path.join(projectRoot, 'docs', id);
        }
    }

    return path.join(projectRoot, 'docs');
}

/**
 * Resolve the path to the external skills directory, accounting for monorepo mode.
 * - Single project: .claude/skills/external/
 * - Monorepo: .isdlc/projects/{project-id}/skills/external/
 * @param {string} [projectId] - Optional project ID override
 * @returns {string} Absolute path to external skills directory
 */
function resolveExternalSkillsPath(projectId) {
    const projectRoot = getProjectRoot();

    if (isMonorepoMode()) {
        const id = projectId || getActiveProject();
        if (id) {
            return path.join(projectRoot, '.isdlc', 'projects', id, 'skills', 'external');
        }
    }

    return path.join(projectRoot, '.claude', 'skills', 'external');
}

/**
 * Resolve the path to the external skills manifest, accounting for monorepo mode.
 *
 * New location: docs/isdlc/external-skills-manifest.json (v3.1.0+)
 * Legacy location: .isdlc/external-skills-manifest.json (fallback for migration)
 *
 * @param {string} [projectId] - Optional project ID override
 * @returns {string} Absolute path to external skills manifest
 */
function resolveExternalManifestPath(projectId) {
    const projectRoot = getProjectRoot();

    if (isMonorepoMode()) {
        const id = projectId || getActiveProject();
        if (id) {
            // New location (preferred)
            const newPath = path.join(projectRoot, 'docs', 'isdlc', 'projects', id, 'external-skills-manifest.json');
            if (fs.existsSync(newPath)) {
                return newPath;
            }
            // Legacy location (fallback)
            const legacyPath = path.join(projectRoot, '.isdlc', 'projects', id, 'external-skills-manifest.json');
            if (fs.existsSync(legacyPath)) {
                return legacyPath;
            }
            return newPath;
        }
    }

    // New location (preferred)
    const newPath = path.join(projectRoot, 'docs', 'isdlc', 'external-skills-manifest.json');
    if (fs.existsSync(newPath)) {
        return newPath;
    }

    // Legacy location (fallback)
    const legacyPath = path.join(projectRoot, '.isdlc', 'external-skills-manifest.json');
    if (fs.existsSync(legacyPath)) {
        return legacyPath;
    }

    return newPath;
}

/**
 * Resolve the path to the skill customization report, accounting for monorepo mode.
 *
 * New location: docs/isdlc/skill-customization-report.md (v3.1.0+)
 * Legacy location: .isdlc/skill-customization-report.md (fallback for migration)
 *
 * @param {string} [projectId] - Optional project ID override
 * @returns {string} Absolute path to skill customization report
 */
function resolveSkillReportPath(projectId) {
    const projectRoot = getProjectRoot();

    if (isMonorepoMode()) {
        const id = projectId || getActiveProject();
        if (id) {
            // New location (preferred)
            const newPath = path.join(projectRoot, 'docs', 'isdlc', 'projects', id, 'skill-customization-report.md');
            if (fs.existsSync(newPath)) {
                return newPath;
            }
            // Legacy location (fallback)
            const legacyPath = path.join(projectRoot, '.isdlc', 'projects', id, 'skill-customization-report.md');
            if (fs.existsSync(legacyPath)) {
                return legacyPath;
            }
            return newPath;
        }
    }

    // New location (preferred)
    const newPath = path.join(projectRoot, 'docs', 'isdlc', 'skill-customization-report.md');
    if (fs.existsSync(newPath)) {
        return newPath;
    }

    // Legacy location (fallback)
    const legacyPath = path.join(projectRoot, '.isdlc', 'skill-customization-report.md');
    if (fs.existsSync(legacyPath)) {
        return legacyPath;
    }

    return newPath;
}

/**
 * Resolve the path to the tasks plan file, accounting for monorepo mode.
 *
 * New location: docs/isdlc/tasks.md (v3.1.0+)
 * Legacy location: .isdlc/tasks.md (fallback for migration)
 *
 * @param {string} [projectId] - Optional project ID override
 * @returns {string} Absolute path to tasks.md
 */
function resolveTasksPath(projectId) {
    const projectRoot = getProjectRoot();

    if (isMonorepoMode()) {
        const id = projectId || getActiveProject();
        if (id) {
            const newPath = path.join(projectRoot, 'docs', 'isdlc', 'projects', id, 'tasks.md');
            if (fs.existsSync(newPath)) {
                return newPath;
            }
            const legacyPath = path.join(projectRoot, '.isdlc', 'projects', id, 'tasks.md');
            if (fs.existsSync(legacyPath)) {
                return legacyPath;
            }
            return newPath;
        }
    }

    const newPath = path.join(projectRoot, 'docs', 'isdlc', 'tasks.md');
    if (fs.existsSync(newPath)) {
        return newPath;
    }

    const legacyPath = path.join(projectRoot, '.isdlc', 'tasks.md');
    if (fs.existsSync(legacyPath)) {
        return legacyPath;
    }

    return newPath;
}

/**
 * Resolve the path to the test evaluation report, accounting for monorepo mode.
 *
 * New location: docs/isdlc/test-evaluation-report.md (v3.1.0+)
 * Legacy location: .isdlc/test-evaluation-report.md (fallback for migration)
 *
 * @param {string} [projectId] - Optional project ID override
 * @returns {string} Absolute path to test-evaluation-report.md
 */
function resolveTestEvaluationPath(projectId) {
    const projectRoot = getProjectRoot();

    if (isMonorepoMode()) {
        const id = projectId || getActiveProject();
        if (id) {
            const newPath = path.join(projectRoot, 'docs', 'isdlc', 'projects', id, 'test-evaluation-report.md');
            if (fs.existsSync(newPath)) {
                return newPath;
            }
            const legacyPath = path.join(projectRoot, '.isdlc', 'projects', id, 'test-evaluation-report.md');
            if (fs.existsSync(legacyPath)) {
                return legacyPath;
            }
            return newPath;
        }
    }

    const newPath = path.join(projectRoot, 'docs', 'isdlc', 'test-evaluation-report.md');
    if (fs.existsSync(newPath)) {
        return newPath;
    }

    const legacyPath = path.join(projectRoot, '.isdlc', 'test-evaluation-report.md');
    if (fs.existsSync(legacyPath)) {
        return legacyPath;
    }

    return newPath;
}

/**
 * Resolve the path to the ATDD checklist, accounting for monorepo mode.
 *
 * New location: docs/isdlc/atdd-checklist.json (v3.1.0+)
 * Legacy location: .isdlc/atdd-checklist.json (fallback for migration)
 *
 * @param {string} [projectId] - Optional project ID override
 * @param {string} [domain] - Optional domain suffix (e.g., "inventory" for atdd-checklist-inventory.json)
 * @returns {string} Absolute path to atdd-checklist.json
 */
function resolveAtddChecklistPath(projectId, domain) {
    const projectRoot = getProjectRoot();
    const filename = domain ? `atdd-checklist-${domain}.json` : 'atdd-checklist.json';

    if (isMonorepoMode()) {
        const id = projectId || getActiveProject();
        if (id) {
            const newPath = path.join(projectRoot, 'docs', 'isdlc', 'projects', id, filename);
            if (fs.existsSync(newPath)) {
                return newPath;
            }
            const legacyPath = path.join(projectRoot, '.isdlc', 'projects', id, filename);
            if (fs.existsSync(legacyPath)) {
                return legacyPath;
            }
            return newPath;
        }
    }

    const newPath = path.join(projectRoot, 'docs', 'isdlc', filename);
    if (fs.existsSync(newPath)) {
        return newPath;
    }

    const legacyPath = path.join(projectRoot, '.isdlc', filename);
    if (fs.existsSync(legacyPath)) {
        return legacyPath;
    }

    return newPath;
}

/**
 * Resolve the path to the iSDLC docs folder, accounting for monorepo mode.
 * This is the base folder for all iSDLC-generated documents.
 *
 * @param {string} [projectId] - Optional project ID override
 * @returns {string} Absolute path to docs/isdlc/ or docs/isdlc/projects/{id}/
 */
function resolveIsdlcDocsPath(projectId) {
    const projectRoot = getProjectRoot();

    if (isMonorepoMode()) {
        const id = projectId || getActiveProject();
        if (id) {
            return path.join(projectRoot, 'docs', 'isdlc', 'projects', id);
        }
    }

    return path.join(projectRoot, 'docs', 'isdlc');
}

/**
 * Check if migration from .isdlc/ to docs/isdlc/ is needed.
 * Returns true if legacy files exist but new location doesn't.
 * @returns {boolean} True if migration is needed
 */
function isMigrationNeeded() {
    const projectRoot = getProjectRoot();
    const legacyConstitution = path.join(projectRoot, '.isdlc', 'constitution.md');
    const newConstitution = path.join(projectRoot, 'docs', 'isdlc', 'constitution.md');

    return fs.existsSync(legacyConstitution) && !fs.existsSync(newConstitution);
}

/**
 * Load and parse the external skills manifest.
 * @param {string} [projectId] - Optional project ID for monorepo mode
 * @returns {object|null} Parsed external manifest or null if not found
 */
function loadExternalManifest(projectId) {
    const manifestPath = resolveExternalManifestPath(projectId);

    if (!fs.existsSync(manifestPath)) {
        return null;
    }

    try {
        return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (e) {
        return null;
    }
}

// =========================================================================
// State Management (monorepo-aware)
// =========================================================================

/**
 * Read JSON value from state.json
 * @param {string} jsonPath - Dot-notation path (e.g., "skill_enforcement.mode")
 * @param {string} [projectId] - Optional project ID for monorepo mode
 * @returns {any} Value at path or undefined
 */
function readStateValue(jsonPath, projectId) {
    const stateFile = resolveStatePath(projectId);

    if (!fs.existsSync(stateFile)) {
        return undefined;
    }

    try {
        const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
        return getNestedValue(state, jsonPath);
    } catch (e) {
        return undefined;
    }
}

/**
 * Get nested value from object using dot notation
 * @param {object} obj - Object to traverse
 * @param {string} path - Dot-notation path
 * @returns {any} Value at path or undefined
 */
function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
}

/**
 * Read and parse state.json
 * @param {string} [projectId] - Optional project ID for monorepo mode
 * @returns {object|null} Parsed state or null
 */
function readState(projectId) {
    const stateFile = resolveStatePath(projectId);

    if (!fs.existsSync(stateFile)) {
        return null;
    }

    try {
        return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    } catch (e) {
        return null;
    }
}

/**
 * Write state.json with automatic state_version increment (BUG-0009).
 *
 * Before writing, reads the current state_version from the existing file on disk.
 * Sets state_version = current_version + 1 on a COPY of the state object
 * (does NOT mutate the caller's object).
 * If no existing file or no state_version on disk, initializes to 1.
 *
 * @param {object} state - State object to write
 * @param {string} [projectId] - Optional project ID for monorepo mode
 * @returns {boolean} Success
 */
function writeState(state, projectId) {
    const stateFile = resolveStatePath(projectId);

    // Ensure directory exists (for monorepo project directories)
    const dir = path.dirname(stateFile);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    try {
        // BUG-0009: Read current version from disk and auto-increment
        let currentVersion = 0;
        try {
            if (fs.existsSync(stateFile)) {
                const diskContent = fs.readFileSync(stateFile, 'utf8');
                const diskState = JSON.parse(diskContent);
                if (typeof diskState.state_version === 'number' && diskState.state_version > 0) {
                    currentVersion = diskState.state_version;
                }
            }
        } catch (e) {
            // Fail-open: if we can't read the disk file, start from 0
            currentVersion = 0;
        }

        // Create a shallow copy to avoid mutating the caller's object
        const stateCopy = Object.assign({}, state);
        stateCopy.state_version = currentVersion + 1;

        fs.writeFileSync(stateFile, JSON.stringify(stateCopy, null, 2));
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Append entry to skill_usage_log array
 * @param {object} logEntry - Log entry to append
 * @param {string} [projectId] - Optional project ID for monorepo mode
 * @returns {boolean} Success
 */
function appendSkillLog(logEntry, projectId) {
    const state = readState(projectId);
    if (!state) {
        return false;
    }

    if (!Array.isArray(state.skill_usage_log)) {
        state.skill_usage_log = [];
    }

    state.skill_usage_log.push(logEntry);
    return writeState(state, projectId);
}

/**
 * Get timestamp in ISO 8601 format
 * @returns {string} ISO timestamp
 */
function getTimestamp() {
    return new Date().toISOString();
}

/**
 * Get path to skills manifest JSON
 * @returns {string|null} Path to manifest or null if not found
 */
function getManifestPath() {
    const projectRoot = getProjectRoot();

    // Primary location: .claude/hooks/config/ (hooks config lives with hooks)
    const hooksConfigPath = path.join(projectRoot, '.claude', 'hooks', 'config', 'skills-manifest.json');
    if (fs.existsSync(hooksConfigPath)) {
        return hooksConfigPath;
    }

    // Fallback to .isdlc location (framework config)
    const isdlcPath = path.join(projectRoot, '.isdlc', 'config', 'skills-manifest.json');
    if (fs.existsSync(isdlcPath)) {
        return isdlcPath;
    }

    return null;
}

/**
 * Load and parse skills manifest
 * @returns {object|null} Manifest object or null
 */
function loadManifest() {
    const manifestPath = getManifestPath();
    if (!manifestPath) {
        return null;
    }
    return _loadConfigWithCache(manifestPath, 'skills-manifest');
}

/**
 * Get the owning agent for a skill ID from manifest
 * @param {string} skillId - Skill ID (e.g., "DEV-001")
 * @returns {string|null} Agent name or null
 */
function getSkillOwner(skillId) {
    const manifest = loadManifest();
    if (!manifest || !manifest.skill_lookup) {
        return null;
    }
    return manifest.skill_lookup[skillId] || null;
}

/**
 * Get the phase for an agent from manifest
 * @param {string} agentName - Agent name
 * @returns {string|null} Phase or null
 */
function getAgentPhase(agentName) {
    const manifest = loadManifest();
    if (!manifest || !manifest.ownership || !manifest.ownership[agentName]) {
        return null;
    }
    return manifest.ownership[agentName].phase || null;
}

/**
 * Normalize agent name (handle variations)
 * @param {string} input - Raw agent name
 * @returns {string} Normalized agent name
 */
function normalizeAgentName(input) {
    if (!input) return '';

    // Convert to lowercase and replace underscores with hyphens
    let normalized = input.toLowerCase().replace(/_/g, '-');

    // Map common variations
    const mappings = {
        'orchestrator': 'sdlc-orchestrator',
        '00-sdlc-orchestrator': 'sdlc-orchestrator',
        'requirements': 'requirements-analyst',
        '01-requirements-analyst': 'requirements-analyst',
        'architect': 'solution-architect',
        '02-solution-architect': 'solution-architect',
        'designer': 'system-designer',
        '03-system-designer': 'system-designer',
        'test-design': 'test-design-engineer',
        '04-test-design-engineer': 'test-design-engineer',
        'developer': 'software-developer',
        '05-software-developer': 'software-developer',
        'tester': 'integration-tester',
        '06-integration-tester': 'integration-tester',
        'qa': 'qa-engineer',
        '07-qa-engineer': 'qa-engineer',
        'security': 'security-compliance-auditor',
        '08-security-compliance-auditor': 'security-compliance-auditor',
        'cicd': 'cicd-engineer',
        '09-cicd-engineer': 'cicd-engineer',
        'dev-env': 'environment-builder',
        '10-dev-environment-engineer': 'environment-builder',
        'environment-builder': 'environment-builder',
        'staging': 'deployment-engineer-staging',
        '11-deployment-engineer-staging': 'deployment-engineer-staging',
        'release': 'release-manager',
        '12-release-manager': 'release-manager',
        'sre': 'site-reliability-engineer',
        '13-site-reliability-engineer': 'site-reliability-engineer',

        // Discover agents (D0-D8)
        'd0': 'discover-orchestrator',
        'd0-discover-orchestrator': 'discover-orchestrator',
        'discovery': 'discover-orchestrator',
        'd1': 'architecture-analyzer',
        'd1-architecture-analyzer': 'architecture-analyzer',
        'arch-analyzer': 'architecture-analyzer',
        'd2': 'test-evaluator',
        'd2-test-evaluator': 'test-evaluator',
        'd3': 'constitution-generator',
        'd3-constitution-generator': 'constitution-generator',
        'd4': 'skills-researcher',
        'd4-skills-researcher': 'skills-researcher',
        'd5': 'data-model-analyzer',
        'd5-data-model-analyzer': 'data-model-analyzer',
        'd6': 'feature-mapper',
        'd6-feature-mapper': 'feature-mapper',
        'd7': 'product-analyst',
        'd7-product-analyst': 'product-analyst',
        'd8': 'architecture-designer',
        'd8-architecture-designer': 'architecture-designer',
        'arch-designer': 'architecture-designer',
        // Quality Loop
        'quality-loop': 'quality-loop-engineer',
        '16-quality-loop-engineer': 'quality-loop-engineer',
        'ql': 'quality-loop-engineer'
    };

    return mappings[normalized] || normalized;
}

/**
 * Check if agent is authorized for a given phase
 * @param {string} agentName - Agent name
 * @param {string} currentPhase - Current project phase
 * @returns {boolean} True if authorized
 */
function isAgentAuthorizedForPhase(agentName, currentPhase) {
    const agentPhase = getAgentPhase(agentName);

    // No manifest or agent not found - allow by default (fail open)
    if (!agentPhase) {
        return true;
    }

    // Orchestrator (phase "all") is always authorized
    if (agentPhase === 'all') {
        return true;
    }

    // Setup agents (discover agents) are always authorized
    if (agentPhase === 'setup') {
        return true;
    }

    // Check if agent's designated phase matches current phase
    return agentPhase === currentPhase;
}

/**
 * Read all input from stdin
 * @returns {Promise<string>} stdin content
 */
function readStdin() {
    return new Promise((resolve, reject) => {
        let data = '';

        process.stdin.setEncoding('utf8');

        process.stdin.on('data', (chunk) => {
            data += chunk;
        });

        process.stdin.on('end', () => {
            resolve(data);
        });

        process.stdin.on('error', (err) => {
            reject(err);
        });
    });
}

/**
 * Output JSON response for hook (to block)
 * @param {string} stopReason - Reason for blocking
 */
function outputBlockResponse(stopReason) {
    console.log(JSON.stringify({
        continue: false,
        stopReason: stopReason
    }));
}

// =========================================================================
// Pending Escalation Tracking
// =========================================================================

/**
 * Write a pending escalation entry to state.json.
 * Appends to state.pending_escalations[] array with dedup and FIFO cap.
 *
 * Dedup: Skips if same hook+phase+type was written within ESCALATION_DEDUP_WINDOW_MS.
 * Cap: FIFO eviction at MAX_ESCALATIONS entries.
 *
 * @param {object} entry - { type, hook, phase, detail, timestamp }
 */
function writePendingEscalation(entry) {
    const state = readState();
    if (!state) return;
    if (!Array.isArray(state.pending_escalations)) {
        state.pending_escalations = [];
    }

    // Dedup: skip if same hook+phase+type within window
    const now = entry.timestamp ? Date.parse(entry.timestamp) : Date.now();
    const isDuplicate = state.pending_escalations.some(existing => {
        if (existing.hook !== entry.hook || existing.phase !== entry.phase || existing.type !== entry.type) {
            return false;
        }
        const existingTime = existing.timestamp ? Date.parse(existing.timestamp) : 0;
        return (now - existingTime) < ESCALATION_DEDUP_WINDOW_MS;
    });

    if (isDuplicate) {
        return; // Skip duplicate within window
    }

    state.pending_escalations.push(entry);

    // FIFO cap: keep only the newest MAX_ESCALATIONS entries
    if (state.pending_escalations.length > MAX_ESCALATIONS) {
        state.pending_escalations = state.pending_escalations.slice(-MAX_ESCALATIONS);
    }

    writeState(state);
}

/**
 * Read pending_escalations from state.json.
 * @returns {Array|null} The pending_escalations array, or null if none/empty
 */
function readPendingEscalations() {
    const state = readState();
    if (!state) return null;
    const escalations = state.pending_escalations;
    if (!Array.isArray(escalations) || escalations.length === 0) return null;
    return escalations;
}

/**
 * Clear pending_escalations from state.json (set to empty array).
 */
function clearPendingEscalations() {
    const state = readState();
    if (!state) return;
    state.pending_escalations = [];
    writeState(state);
}

// =========================================================================
// Pending Delegation Tracking
// =========================================================================

/**
 * Read pending_delegation from state.json.
 * @returns {object|null} The pending_delegation entry, or null if none
 */
function readPendingDelegation() {
    const state = readState();
    if (!state) return null;
    return state.pending_delegation || null;
}

/**
 * Write a pending_delegation entry to state.json.
 * @param {object} entry - The delegation entry { skill, invoked_at, args }
 */
function writePendingDelegation(entry) {
    const state = readState();
    if (!state) return;
    state.pending_delegation = entry;
    writeState(state);
}

/**
 * Clear pending_delegation from state.json (set to null).
 */
function clearPendingDelegation() {
    const state = readState();
    if (!state) return;
    state.pending_delegation = null;
    writeState(state);
}

/**
 * Read code_review configuration from state.json.
 * Returns safe defaults if section is missing, state is unreadable, or fields are invalid.
 * @param {string} [projectId] - Optional project ID for monorepo mode
 * @returns {{ enabled: boolean, team_size: number }}
 */
function readCodeReviewConfig(projectId) {
    try {
        const state = readState(projectId);
        if (state && state.code_review) {
            return {
                enabled: state.code_review.enabled === true,
                team_size: typeof state.code_review.team_size === 'number'
                    ? state.code_review.team_size
                    : 1
            };
        }
    } catch (e) {
        // Fail-open: return disabled defaults
    }
    return { enabled: false, team_size: 1 };
}

// =========================================================================
// Phase Delegation Detection (REQ-0004)
// =========================================================================

/**
 * Setup commands that should NEVER be blocked by enforcement hooks.
 * These run BEFORE workflows start or are configuration/status commands.
 *
 * Used by: gate-blocker, iteration-corridor, phase-loop-controller,
 *          phase-sequence-guard, detectPhaseDelegation
 *
 * @type {ReadonlyArray<string>}
 */
const SETUP_COMMAND_KEYWORDS = Object.freeze([
    'discover',
    'constitution',
    'init',
    'setup',
    'configure',
    'configure-cloud',
    'new project',
    'project setup',
    'install',
    'status'
]);

/**
 * Check if text contains any setup command keyword.
 * Setup commands should never be blocked by enforcement hooks.
 *
 * @param {string} text - Text to search (case-insensitive)
 * @returns {boolean} True if text contains a setup command keyword
 *
 * @example
 *   isSetupCommand('discover the project')     // true
 *   isSetupCommand('delegate to developer')     // false
 *   isSetupCommand('')                          // false
 *   isSetupCommand(null)                        // false
 */
function isSetupCommand(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    return SETUP_COMMAND_KEYWORDS.some(keyword => lower.includes(keyword));
}

/**
 * Detect if a Task tool call is a phase delegation.
 *
 * Detection algorithm (ordered by reliability):
 *   1. If tool_name !== 'Task', return not-a-delegation.
 *   2. If combined prompt/description text contains setup keywords, return not-a-delegation.
 *   3. If subagent_type matches a known agent name (via normalizeAgentName + getAgentPhase),
 *      return the detected phase. Skip agents with phase 'all' or 'setup'.
 *   4. If subagent_type did not match, scan combined text for exact agent names from the
 *      skills-manifest ownership map.
 *   5. If still no match, scan for phase name patterns like "01-requirements" or "phase 01".
 *   6. If no match, return not-a-delegation.
 *
 * Edge cases:
 *   - Non-Task tool calls (Read, Write, Bash, etc.) always return NOT_DELEGATION immediately.
 *   - Setup commands (containing keywords like "initialize", "configure") are excluded
 *     even when the tool_name is 'Task', to avoid false positives on setup sub-agents.
 *   - Agents whose phase is 'all' or 'setup' are excluded from delegation detection
 *     because they are not phase-specific (e.g., sdlc-orchestrator).
 *   - If the skills-manifest file is missing or unreadable, the manifest-based agent
 *     scanning step (Step 4) is silently skipped (fail-safe).
 *   - The phase pattern regex fallback (Step 5) matches patterns like "01-requirements"
 *     or "phase 06-implementation" in the combined prompt/description text.
 *   - Null or undefined parsedInput returns NOT_DELEGATION (no throw).
 *
 * @param {object} parsedInput - Parsed stdin JSON from Claude Code hook protocol
 * @param {string} parsedInput.tool_name - The tool being invoked (must be 'Task')
 * @param {object} [parsedInput.tool_input] - Tool input parameters
 * @param {string} [parsedInput.tool_input.subagent_type] - The sub-agent type
 * @param {string} [parsedInput.tool_input.prompt] - The task prompt
 * @param {string} [parsedInput.tool_input.description] - The task description
 *
 * @returns {{
 *   isDelegation: boolean,
 *   targetPhase: string|null,
 *   agentName: string|null
 * }}
 *
 * @throws {never} Never throws -- returns NOT_DELEGATION on all error paths
 *   (null input, missing fields, manifest read failures, etc.)
 *
 * @example
 * // Typical usage in a PreToolUse hook:
 * const delegation = detectPhaseDelegation(parsedInput);
 * if (delegation.isDelegation) {
 *     console.log(`Delegation to phase: ${delegation.targetPhase}`);
 *     console.log(`Agent: ${delegation.agentName}`);
 * }
 *
 * @example
 * // Non-Task tool call returns NOT_DELEGATION:
 * detectPhaseDelegation({ tool_name: 'Read', tool_input: {} });
 * // => { isDelegation: false, targetPhase: null, agentName: null }
 *
 * @see gate-blocker.cjs - Uses detectPhaseDelegation to identify gate advancement attempts
 * @see constitution-validator.cjs - Uses detectPhaseDelegation to scope constitutional checks
 * @see phase-loop-controller.cjs - Uses detectPhaseDelegation to track phase progress
 * @see test-adequacy-blocker.cjs - Uses detectPhaseDelegation to identify upgrade delegations
 * @see phase-sequence-guard.cjs - Uses detectPhaseDelegation to enforce phase ordering
 * @see iteration-corridor.cjs - Uses detectPhaseDelegation to scope iteration enforcement
 */
function detectPhaseDelegation(parsedInput) {
    const NOT_DELEGATION = { isDelegation: false, targetPhase: null, agentName: null };

    // Guard: must be a Task tool call
    if (!parsedInput || parsedInput.tool_name !== 'Task') {
        return NOT_DELEGATION;
    }

    const toolInput = parsedInput.tool_input || {};
    const subagentType = (toolInput.subagent_type || '').trim();
    const prompt = toolInput.prompt || '';
    const description = toolInput.description || '';
    const combined = (prompt + ' ' + description).toLowerCase();

    // Step 1: Check setup command whitelist
    if (isSetupCommand(combined)) {
        return NOT_DELEGATION;
    }

    // Also check subagent_type for setup agent names
    if (subagentType) {
        const normalizedSubagent = normalizeAgentName(subagentType);
        const subagentPhase = getAgentPhase(normalizedSubagent);
        if (subagentPhase === 'all' || subagentPhase === 'setup') {
            return NOT_DELEGATION;
        }
    }

    // Step 2: Match subagent_type against known agent names
    if (subagentType) {
        const normalized = normalizeAgentName(subagentType);
        const phase = getAgentPhase(normalized);
        if (phase) {
            return { isDelegation: true, targetPhase: phase, agentName: normalized };
        }
    }

    // Step 3: Scan prompt/description for exact agent names from manifest
    const manifest = loadManifest();
    if (manifest && manifest.ownership) {
        for (const [agentName, info] of Object.entries(manifest.ownership)) {
            if (info.phase === 'all' || info.phase === 'setup') continue;
            if (combined.includes(agentName.toLowerCase())) {
                return { isDelegation: true, targetPhase: info.phase, agentName };
            }
        }
    }

    // Step 4: Match phase name patterns (e.g., "01-requirements", "phase 06")
    const phasePattern = /(?:phase\s+)?(\d{2})-([a-z][a-z-]*)/i;
    const phaseMatch = combined.match(phasePattern);
    if (phaseMatch) {
        const phaseName = `${phaseMatch[1]}-${phaseMatch[2]}`;
        return { isDelegation: true, targetPhase: phaseName, agentName: null };
    }

    return NOT_DELEGATION;
}

// =========================================================================
// Schema Validation
// =========================================================================

/**
 * Schema cache to avoid re-reading schema files on every call.
 * @type {Map<string, object|null>}
 */
const _schemaCache = new Map();

/**
 * Load a JSON schema file by ID from the config/schemas/ directory.
 * Returns the parsed schema object or null if the file is missing/invalid.
 * Results are cached after first load.
 *
 * @param {string} schemaId - Schema ID (filename without .schema.json)
 * @returns {object|null} Parsed schema or null
 */
function loadSchema(schemaId) {
    if (_schemaCache.has(schemaId)) {
        return _schemaCache.get(schemaId);
    }

    const projectRoot = getProjectRoot();
    const schemaPaths = [
        path.join(projectRoot, '.claude', 'hooks', 'config', 'schemas', `${schemaId}.schema.json`),
        path.join(projectRoot, '.isdlc', 'config', 'schemas', `${schemaId}.schema.json`)
    ];

    for (const schemaPath of schemaPaths) {
        if (fs.existsSync(schemaPath)) {
            try {
                const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
                _schemaCache.set(schemaId, schema);
                return schema;
            } catch (e) {
                debugLog(`Schema parse error for ${schemaId}:`, e.message);
                _schemaCache.set(schemaId, null);
                return null;
            }
        }
    }

    _schemaCache.set(schemaId, null);
    return null;
}

/**
 * Validate data against a JSON schema (lightweight inline validator).
 * Supports: type checking, required fields, enum values, minimum for integers.
 * Does NOT support: $ref, allOf, oneOf, anyOf, patternProperties, format.
 *
 * Fail-open: returns { valid: true } if schema is missing or validation errors occur.
 *
 * @param {*} data - The data to validate
 * @param {string} schemaId - Schema ID to validate against
 * @returns {{ valid: boolean, errors?: string[] }}
 */
function validateSchema(data, schemaId) {
    try {
        const schema = loadSchema(schemaId);
        if (!schema) {
            // Fail-open: missing schema means validation passes
            return { valid: true };
        }

        const errors = [];
        _validateObject(data, schema, '', errors);

        if (errors.length === 0) {
            return { valid: true };
        }
        return { valid: false, errors };
    } catch (e) {
        // Fail-open: validation errors mean pass
        debugLog(`Schema validation error for ${schemaId}:`, e.message);
        return { valid: true };
    }
}

/**
 * Internal recursive validator for a single object against a schema.
 * @param {*} data
 * @param {object} schema
 * @param {string} path - JSON path for error messages
 * @param {string[]} errors - accumulator
 */
function _validateObject(data, schema, jsonPath, errors) {
    // Type check
    if (schema.type) {
        const actualType = _getJsonType(data);
        if (schema.type === 'integer') {
            if (typeof data !== 'number' || !Number.isInteger(data)) {
                errors.push(`${jsonPath || '(root)'}: expected integer, got ${actualType}`);
                return; // stop checking further if type is wrong
            }
        } else if (actualType !== schema.type) {
            errors.push(`${jsonPath || '(root)'}: expected ${schema.type}, got ${actualType}`);
            return;
        }
    }

    // Required fields
    if (schema.required && Array.isArray(schema.required) && typeof data === 'object' && data !== null) {
        for (const field of schema.required) {
            if (!(field in data)) {
                errors.push(`${jsonPath || '(root)'}: missing required field '${field}'`);
            }
        }
    }

    // Enum check
    if (schema.enum && Array.isArray(schema.enum)) {
        if (!schema.enum.includes(data)) {
            errors.push(`${jsonPath || '(root)'}: value '${data}' not in enum [${schema.enum.join(', ')}]`);
        }
    }

    // Minimum check for numbers
    if (schema.minimum !== undefined && typeof data === 'number') {
        if (data < schema.minimum) {
            errors.push(`${jsonPath || '(root)'}: value ${data} is below minimum ${schema.minimum}`);
        }
    }

    // Properties check (recurse into object properties)
    if (schema.properties && typeof data === 'object' && data !== null) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
            if (key in data) {
                _validateObject(data[key], propSchema, `${jsonPath}.${key}`, errors);
            }
        }
    }

    // Array items check
    if (schema.items && Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
            _validateObject(data[i], schema.items, `${jsonPath}[${i}]`, errors);
        }
    }
}

/**
 * Get JSON type name for a value.
 * @param {*} value
 * @returns {string}
 */
function _getJsonType(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
}

/**
 * Debug log (only when SKILL_VALIDATOR_DEBUG=true)
 * @param {...any} args - Arguments to log
 */
function debugLog(...args) {
    if (process.env.SKILL_VALIDATOR_DEBUG === 'true') {
        console.error('[skill-validator]', ...args);
    }
}

// =========================================================================
// Hook Activity Logging (REQ-0005)
// =========================================================================

const HOOK_LOG_MAX_BYTES = 1024 * 1024; // 1MB
const HOOK_LOG_KEEP_LINES = 500;

/**
 * Get the path to the hook activity log file.
 * @returns {string} Absolute path to hook-activity.log
 */
function getHookLogPath() {
    const projectRoot = getProjectRoot();
    return path.join(projectRoot, '.isdlc', 'hook-activity.log');
}

/**
 * Log a structured hook event to the centralized activity log.
 * Appends one JSONL line per event. Rotates when file exceeds 1MB.
 * NEVER throws or crashes -- all errors are silently swallowed.
 *
 * @param {string} hookName - Name of the hook (e.g., 'branch-guard')
 * @param {string} eventType - Event type: 'block', 'allow', 'warn', 'error', 'skip'
 * @param {object} [details={}] - Additional details (phase, agent, reason)
 */
function logHookEvent(hookName, eventType, details = {}) {
    try {
        const logPath = getHookLogPath();
        const entry = {
            ts: new Date().toISOString(),
            hook: hookName,
            event: eventType,
            phase: details.phase || null,
            agent: details.agent || null,
            reason: details.reason || null
        };
        const line = JSON.stringify(entry) + '\n';

        // Ensure .isdlc directory exists
        const dir = path.dirname(logPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Append the log entry
        fs.appendFileSync(logPath, line, 'utf8');

        // Check file size for rotation
        try {
            const stat = fs.statSync(logPath);
            if (stat.size > HOOK_LOG_MAX_BYTES) {
                rotateHookLog(logPath);
            }
        } catch (e) {
            // Stat failed, skip rotation
        }
    } catch (e) {
        // Logging must never fail -- silently swallow all errors
    }
}

/**
 * Rotate the hook activity log by keeping only the newest N lines.
 * @param {string} logPath - Path to the log file
 */
function rotateHookLog(logPath) {
    try {
        const content = fs.readFileSync(logPath, 'utf8');
        const lines = content.split('\n').filter(l => l.trim());
        const kept = lines.slice(-HOOK_LOG_KEEP_LINES);
        fs.writeFileSync(logPath, kept.join('\n') + '\n', 'utf8');
    } catch (e) {
        // Rotation failed, not critical
    }
}

// ---------------------------------------------------------------------------
// Workflow progress snapshots (REQ-0005)
// ---------------------------------------------------------------------------

/**
 * Phase-key-to-agent-name map for history[] fallback summary extraction.
 * @type {Object<string, string>}
 */
const PHASE_AGENT_MAP = {
    '01-requirements': 'requirements-analyst',
    '02-impact-analysis': 'impact-analysis-orchestrator',
    '02-tracing': 'tracing-orchestrator',
    '03-architecture': 'solution-architect',
    '04-design': 'system-designer',
    '05-test-strategy': 'test-design-engineer',
    '06-implementation': 'software-developer',
    '07-testing': 'integration-tester',
    '08-code-review': 'qa-engineer',
    '09-validation': 'security-compliance-auditor',
    '10-cicd': 'cicd-engineer',
    '11-local-testing': 'environment-builder',
    '12-remote-build': 'environment-builder',
    '12-test-deploy': 'deployment-engineer-staging',
    '13-production': 'release-manager',
    '14-operations': 'site-reliability-engineer',
    '15-upgrade-plan': 'upgrade-engineer',
    '15-upgrade-execute': 'upgrade-engineer',
    '16-quality-loop': 'quality-loop-engineer'
};

// ---------------------------------------------------------------------------
// Phase key normalization (self-healing)
// ---------------------------------------------------------------------------

/**
 * Known phase key aliases that map to canonical keys.
 * Catches drift between workflows.json and iteration-requirements.json.
 * @type {Object<string, string>}
 */
const PHASE_KEY_ALIASES = Object.freeze({
    // Legacy workflows.json keys → canonical iteration-requirements.json keys
    '13-test-deploy': '12-test-deploy',
    '14-production': '13-production',
    '15-operations': '14-operations',
    '16-upgrade-plan': '15-upgrade-plan',
    '16-upgrade-execute': '15-upgrade-execute'
});

/**
 * Normalize a phase key using the alias map.
 * Returns the canonical key if an alias exists, otherwise returns the input unchanged.
 * @param {string} key - Phase key (e.g., '13-test-deploy' or '12-test-deploy')
 * @returns {string} Canonical phase key
 */
function normalizePhaseKey(key) {
    if (!key || typeof key !== 'string') return key;
    return PHASE_KEY_ALIASES[key] || key;
}

// ---------------------------------------------------------------------------
// Self-healing diagnosis
// ---------------------------------------------------------------------------

/** Maximum pending_escalations entries (FIFO ring buffer) */
const MAX_ESCALATIONS = 20;
/** Dedup window for pending_escalations in milliseconds (60 seconds) */
const ESCALATION_DEDUP_WINDOW_MS = 60000;

/**
 * Diagnose why a hook is about to block.
 * Distinguishes genuine requirement failures from infrastructure issues.
 *
 * @param {string} hookName - Name of the blocking hook
 * @param {string} phase - Current phase key
 * @param {string} requirement - Which requirement failed (e.g., 'test_iteration')
 * @param {object} state - Current state.json
 * @returns {{ cause: string, detail: string, remediation: string|null }}
 *   cause: 'genuine' | 'infrastructure' | 'stale'
 */
function diagnoseBlockCause(hookName, phase, requirement, state) {
    // Check 1: Was the phase key an alias? (already normalized by caller, but check if original differed)
    const canonical = normalizePhaseKey(phase);
    if (canonical !== phase) {
        return {
            cause: 'infrastructure',
            detail: `Phase key '${phase}' is an alias for '${canonical}'`,
            remediation: `normalized_phase_key`
        };
    }

    // Check 2: Is there a stale workflow? (workflow completed/cancelled but active_workflow still present)
    const aw = state && state.active_workflow;
    if (aw && (aw.status === 'completed' || aw.status === 'cancelled')) {
        return {
            cause: 'stale',
            detail: `active_workflow has status '${aw.status}' but is still present in state`,
            remediation: `stale_workflow_detected`
        };
    }

    // Check 3: Phase not initialized in state.phases — only infrastructure if active workflow expects it
    if (state && state.phases && !state.phases[phase]) {
        // Only treat as infrastructure if an active workflow references this phase
        // (meaning the phase SHOULD have been initialized but wasn't).
        // Without an active workflow, missing phase state is a genuine "not started" condition.
        const aw2 = state.active_workflow;
        if (aw2 && aw2.current_phase === phase) {
            return {
                cause: 'infrastructure',
                detail: `Phase '${phase}' has no entry in state.phases — may not be initialized`,
                remediation: `missing_phase_state`
            };
        }
    }

    // Default: genuine failure — the requirement is truly not met
    return {
        cause: 'genuine',
        detail: `Requirement '${requirement}' not satisfied for phase '${phase}'`,
        remediation: null
    };
}

/**
 * Output a self-heal notification to stderr (not stdout, which is reserved for hook protocol JSON).
 * Format: [SELF-HEAL] {hook}: {message}
 * Also logs to hook-activity.log via logHookEvent.
 *
 * @param {string} hookName - Name of the hook performing the self-heal
 * @param {string} message - Human-readable description of what happened
 */
function outputSelfHealNotification(hookName, message) {
    const formatted = `[SELF-HEAL] ${hookName}: ${message}`;
    console.error(formatted);
    logHookEvent(hookName, 'self-heal', { reason: message });
}

/**
 * Compute duration in minutes between two ISO-8601 timestamps.
 * Returns null if either timestamp is missing, invalid, or duration is negative.
 * @param {string|null} started
 * @param {string|null} completed
 * @returns {number|null} Minutes rounded to nearest integer, or null
 */
function _computeDuration(started, completed) {
    if (!started || !completed) return null;
    const diff = Date.parse(completed) - Date.parse(started);
    if (isNaN(diff) || diff < 0) return null;
    return Math.round(diff / 60000);
}

/**
 * Extract summary string for a phase snapshot.
 * Primary: phases[key].summary. Fallback: last matching history[] entry.
 * @param {object} phaseData - The phase object from state.phases
 * @param {Array|undefined} history - state.history array
 * @param {string} phaseKey - Phase key for agent lookup
 * @returns {string|null} Summary truncated to 150 chars, or null
 */
function _extractSummary(phaseData, history, phaseKey) {
    // Primary: phases[key].summary
    if (phaseData.summary && typeof phaseData.summary === 'string') {
        return phaseData.summary.substring(0, 150);
    }

    // Fallback: last history[] entry matching agent + timestamp range
    if (!history || !Array.isArray(history)) return null;

    const expectedAgent = PHASE_AGENT_MAP[phaseKey];
    if (!expectedAgent) return null;

    const phaseStart = Date.parse(phaseData.started);
    const phaseEnd = Date.parse(phaseData.completed || phaseData.gate_passed);

    for (let i = history.length - 1; i >= 0; i--) {
        const entry = history[i];
        if (entry.agent !== expectedAgent) continue;
        const entryTime = Date.parse(entry.timestamp);
        if (!isNaN(phaseStart) && !isNaN(phaseEnd)) {
            if (entryTime >= phaseStart && entryTime <= phaseEnd + 60000) {
                const action = (entry.action || '').substring(0, 150);
                return action || null;
            }
        } else {
            // No timestamp range — accept last matching agent entry
            const action = (entry.action || '').substring(0, 150);
            return action || null;
        }
    }

    return null;
}

/**
 * Extract test iteration data from a phase's iteration_requirements.
 * Returns null if no meaningful iteration data exists.
 * @param {object} phaseData - The phase object from state.phases
 * @returns {{ count: number, result: string, escalated: boolean }|null}
 */
function _extractTestIterations(phaseData) {
    const testIter = phaseData?.iteration_requirements?.test_iteration;
    if (!testIter) return null;

    const count = testIter.current_iteration ?? testIter.current ?? 0;
    if (count === 0 && !testIter.completed && !testIter.escalated) {
        return null; // No iteration data — omit field
    }

    return {
        count: count,
        result: testIter.completed === true ? 'passed' :
                testIter.escalated === true ? 'escalated' : 'unknown',
        escalated: testIter.escalated === true
    };
}

/**
 * Compute workflow-level metrics from snapshots and active_workflow.
 * @param {Array} snapshots - Array of phase snapshot objects
 * @param {object} activeWorkflow - state.active_workflow
 * @returns {object} Metrics object
 */
function _computeMetrics(snapshots, activeWorkflow) {
    const phasesCompleted = snapshots.filter(s => s.status === 'completed').length;

    // Duration from workflow timestamps
    let totalDuration = null;
    const startedAt = activeWorkflow.started_at;
    const completedAt = activeWorkflow.completed_at || activeWorkflow.cancelled_at;
    if (startedAt && completedAt) {
        const diff = Date.parse(completedAt) - Date.parse(startedAt);
        if (!isNaN(diff) && diff >= 0) {
            totalDuration = Math.round(diff / 60000);
        }
    }

    // Iteration counts
    let testIterTotal = 0;
    let gatesFirstTry = 0;
    let gatesIteration = 0;
    for (const snapshot of snapshots) {
        if (snapshot.test_iterations) {
            testIterTotal += snapshot.test_iterations.count;
        }
        if (snapshot.gate_passed) {
            if (snapshot.test_iterations && snapshot.test_iterations.count > 1) {
                gatesIteration++;
            } else {
                gatesFirstTry++;
            }
        }
    }

    return {
        total_phases: (activeWorkflow.phases && activeWorkflow.phases.length) || 0,
        phases_completed: phasesCompleted,
        total_duration_minutes: totalDuration,
        test_iterations_total: testIterTotal,
        gates_passed_first_try: gatesFirstTry,
        gates_required_iteration: gatesIteration
    };
}

/**
 * Collect phase snapshots and workflow metrics from pre-prune state.
 * Pure function — does not mutate state.
 *
 * @param {Object} state - Full state.json object (pre-prune)
 * @returns {{ phase_snapshots: Array, metrics: Object }}
 */
function collectPhaseSnapshots(state) {
    const DEFAULT_METRICS = {
        total_phases: 0,
        phases_completed: 0,
        total_duration_minutes: null,
        test_iterations_total: 0,
        gates_passed_first_try: 0,
        gates_required_iteration: 0
    };

    // Guard: require both active_workflow and phases
    if (!state || !state.active_workflow || !state.phases) {
        return { phase_snapshots: [], metrics: DEFAULT_METRICS };
    }

    const activeWorkflow = state.active_workflow;
    const workflowPhases = activeWorkflow.phases;
    if (!Array.isArray(workflowPhases) || workflowPhases.length === 0) {
        return { phase_snapshots: [], metrics: _computeMetrics([], activeWorkflow) };
    }

    const allPhases = state.phases;
    const history = state.history;
    const snapshots = [];

    for (const phaseKey of workflowPhases) {
        const phaseData = allPhases[phaseKey];
        if (!phaseData) continue; // Phase not initialized — skip

        const snapshot = {
            key: phaseKey,
            status: phaseData.status || 'pending',
            started: phaseData.started || null,
            completed: phaseData.completed || null,
            gate_passed: phaseData.gate_passed || null,
            duration_minutes: _computeDuration(phaseData.started, phaseData.completed),
            summary: _extractSummary(phaseData, history, phaseKey)
        };

        // Conditional: artifacts (omit if empty — ADR-007)
        if (phaseData.artifacts && Array.isArray(phaseData.artifacts) && phaseData.artifacts.length > 0) {
            snapshot.artifacts = phaseData.artifacts;
        }

        // Conditional: test_iterations (omit if no data — ADR-004)
        const testIter = _extractTestIterations(phaseData);
        if (testIter) {
            snapshot.test_iterations = testIter;
        }

        snapshots.push(snapshot);
    }

    const metrics = _computeMetrics(snapshots, activeWorkflow);

    return { phase_snapshots: snapshots, metrics };
}

// ---------------------------------------------------------------------------
// State pruning functions (BUG-0004)
// ---------------------------------------------------------------------------

/**
 * Prune skill_usage_log to keep only the last N entries.
 * @param {Object} state - The state object
 * @param {number} maxEntries - Maximum entries to keep (default 20)
 * @returns {Object} The mutated state object
 */
function pruneSkillUsageLog(state, maxEntries = 20) {
    if (!state.skill_usage_log || !Array.isArray(state.skill_usage_log)) return state;
    if (state.skill_usage_log.length > maxEntries) {
        state.skill_usage_log = state.skill_usage_log.slice(-maxEntries);
    }
    return state;
}

/**
 * Strip verbose sub-objects from completed/gate-passed phases.
 * Preserves: status, started, completed, gate_passed, artifacts, and any unknown fields.
 * Strips: iteration_requirements, constitutional_validation, gate_validation,
 *         testing_environment, verification_summary, atdd_validation.
 * Only strips from phases that have status=completed OR gate_passed is truthy.
 * Skips phases listed in protectedPhases (e.g., remaining workflow phases).
 * Adds _pruned_at timestamp to stripped phases for diagnosis.
 *
 * @param {Object} state - The state object
 * @param {string[]} [protectedPhases=[]] - Phase keys to skip (never prune)
 * @returns {Object} The mutated state object
 */
function pruneCompletedPhases(state, protectedPhases = []) {
    if (!state.phases || typeof state.phases !== 'object') return state;

    const protectedSet = new Set(protectedPhases);

    const STRIP_FIELDS = [
        'iteration_requirements',
        'constitutional_validation',
        'gate_validation',
        'testing_environment',
        'verification_summary',
        'atdd_validation'
    ];

    for (const [phaseKey, phase] of Object.entries(state.phases)) {
        if (protectedSet.has(phaseKey)) continue;
        if (phase.status === 'completed' || phase.gate_passed) {
            for (const field of STRIP_FIELDS) {
                delete phase[field];
            }
            phase._pruned_at = new Date().toISOString();
        }
    }
    return state;
}

/**
 * Prune history[] with FIFO cap and action string truncation.
 * @param {Object} state - The state object
 * @param {number} maxEntries - Maximum entries to keep (default 50)
 * @param {number} maxCharLen - Maximum action string length before truncation (default 200)
 * @returns {Object} The mutated state object
 */
function pruneHistory(state, maxEntries = 50, maxCharLen = 200) {
    if (!state.history || !Array.isArray(state.history)) return state;

    // FIFO: keep last N
    if (state.history.length > maxEntries) {
        state.history = state.history.slice(-maxEntries);
    }

    // Truncate long action strings
    for (const entry of state.history) {
        if (entry.action && typeof entry.action === 'string' && entry.action.length > maxCharLen) {
            entry.action = entry.action.substring(0, maxCharLen) + '...';
        }
    }
    return state;
}

/**
 * Prune workflow_history[] with FIFO cap, description truncation, and git_branch compaction.
 * @param {Object} state - The state object
 * @param {number} maxEntries - Maximum entries to keep (default 50)
 * @param {number} maxCharLen - Maximum description string length before truncation (default 200)
 * @returns {Object} The mutated state object
 */
function pruneWorkflowHistory(state, maxEntries = 50, maxCharLen = 200) {
    if (!state.workflow_history || !Array.isArray(state.workflow_history)) return state;

    // FIFO: keep last N
    if (state.workflow_history.length > maxEntries) {
        state.workflow_history = state.workflow_history.slice(-maxEntries);
    }

    for (const entry of state.workflow_history) {
        // Truncate long descriptions
        if (entry.description && typeof entry.description === 'string' && entry.description.length > maxCharLen) {
            entry.description = entry.description.substring(0, maxCharLen) + '...';
        }
        // Compact git_branch to name only
        if (entry.git_branch && typeof entry.git_branch === 'object') {
            const name = entry.git_branch.name;
            entry.git_branch = { name };
        }
    }
    return state;
}

/**
 * Reset phases for a new workflow. Clears all existing phase data and creates
 * fresh skeleton entries for the specified workflow phases.
 * @param {Object} state - The state object
 * @param {string[]} workflowPhases - Array of phase keys for the new workflow
 * @returns {Object} The mutated state object
 */
function resetPhasesForWorkflow(state, workflowPhases) {
    state.phases = {};
    for (const phaseKey of workflowPhases) {
        state.phases[phaseKey] = {
            status: 'pending',
            started: null,
            completed: null,
            gate_passed: null,
            artifacts: []
        };
    }
    return state;
}

// =========================================================================
// Dispatcher helpers (REQ-0010 Tier 1)
// =========================================================================

/**
 * Add a pending escalation entry to an in-memory state object.
 * Same dedup + FIFO cap logic as writePendingEscalation() but operates
 * on the passed state object without any disk I/O.
 *
 * @param {object} state - The state object to mutate
 * @param {object} entry - { type, hook, phase, detail, timestamp }
 * @returns {boolean} True if the entry was added (not a dedup)
 */
function addPendingEscalation(state, entry) {
    if (!state) return false;
    if (!Array.isArray(state.pending_escalations)) {
        state.pending_escalations = [];
    }

    // Dedup: skip if same hook+phase+type within window
    const now = entry.timestamp ? Date.parse(entry.timestamp) : Date.now();
    const isDuplicate = state.pending_escalations.some(existing => {
        if (existing.hook !== entry.hook || existing.phase !== entry.phase || existing.type !== entry.type) {
            return false;
        }
        const existingTime = existing.timestamp ? Date.parse(existing.timestamp) : 0;
        return (now - existingTime) < ESCALATION_DEDUP_WINDOW_MS;
    });

    if (isDuplicate) {
        return false;
    }

    state.pending_escalations.push(entry);

    // FIFO cap: keep only the newest MAX_ESCALATIONS entries
    if (state.pending_escalations.length > MAX_ESCALATIONS) {
        state.pending_escalations = state.pending_escalations.slice(-MAX_ESCALATIONS);
    }

    return true;
}

/**
 * Append a skill usage log entry to an in-memory state object.
 * Operates on the passed state object without any disk I/O.
 *
 * @param {object} state - The state object to mutate
 * @param {object} entry - The log entry to append
 * @returns {boolean} True if the entry was added
 */
function addSkillLogEntry(state, entry) {
    if (!state) return false;
    if (!Array.isArray(state.skill_usage_log)) {
        state.skill_usage_log = [];
    }
    state.skill_usage_log.push(entry);
    return true;
}

/**
 * Load iteration requirements config from the project's config directory.
 * Checks .claude/hooks/config/ first, then .isdlc/config/ as fallback.
 *
 * Consolidated from 4 hooks (gate-blocker, iteration-corridor,
 * constitution-validator, test-watcher) into common.cjs.
 *
 * @returns {object|null} Parsed iteration requirements or null
 */
function loadIterationRequirements() {
    const projectRoot = getProjectRoot();
    const configPaths = [
        path.join(projectRoot, '.claude', 'hooks', 'config', 'iteration-requirements.json'),
        path.join(projectRoot, '.isdlc', 'config', 'iteration-requirements.json')
    ];

    for (const configPath of configPaths) {
        // FR-001: Use statSync inside _loadConfigWithCache to check existence + cache
        const result = _loadConfigWithCache(configPath, 'iteration-requirements');
        if (result !== null) {
            return result;
        }
    }
    return null;
}

/**
 * Load workflow definitions config from the project's config directory.
 * Checks .isdlc/config/ first, then .claude/hooks/config/ as fallback.
 *
 * Consolidated from gate-blocker into common.cjs.
 *
 * @returns {object|null} Parsed workflow definitions or null
 */
function loadWorkflowDefinitions() {
    const projectRoot = getProjectRoot();
    const configPaths = [
        path.join(projectRoot, '.isdlc', 'config', 'workflows.json'),
        path.join(projectRoot, '.claude', 'hooks', 'config', 'workflows.json')
    ];

    for (const configPath of configPaths) {
        // FR-001: Use _loadConfigWithCache for mtime-based caching
        const result = _loadConfigWithCache(configPath, 'workflows');
        if (result !== null) {
            return result;
        }
    }
    return null;
}

/**
 * Check if the current phase has exceeded its timeout.
 * Reads started_at from phase state and timeout_minutes from requirements.
 * @param {object} state - Parsed state.json
 * @param {object} requirements - Parsed iteration-requirements.json
 * @returns {{ exceeded: boolean, elapsed?: number, limit?: number, phase?: string }}
 */
function checkPhaseTimeout(state, requirements) {
    if (!state || !requirements) {
        return { exceeded: false };
    }

    const activeWorkflow = state.active_workflow;
    const currentPhase = activeWorkflow?.current_phase || state.current_phase;
    if (!currentPhase) {
        return { exceeded: false };
    }

    const phaseReq = requirements.phase_requirements?.[currentPhase];
    if (!phaseReq) {
        return { exceeded: false };
    }

    // Look for timeout_minutes in various config locations
    const timeoutMinutes = phaseReq.interactive_elicitation?.timeout_minutes
        || phaseReq.timeout_minutes
        || null;

    if (!timeoutMinutes) {
        return { exceeded: false };
    }

    // Find phase start time from state
    const phaseState = state.phases?.[currentPhase];
    const startedAt = phaseState?.started_at
        || phaseState?.iteration_requirements?.test_iteration?.started_at
        || phaseState?.iteration_requirements?.interactive_elicitation?.started_at
        || null;

    if (!startedAt) {
        return { exceeded: false };
    }

    const startTime = new Date(startedAt).getTime();
    if (isNaN(startTime)) {
        return { exceeded: false };
    }

    const elapsedMs = Date.now() - startTime;
    const elapsedMinutes = Math.round(elapsedMs / 60000);

    if (elapsedMinutes > timeoutMinutes) {
        return {
            exceeded: true,
            elapsed: elapsedMinutes,
            limit: timeoutMinutes,
            phase: currentPhase
        };
    }

    return { exceeded: false };
}

// =========================================================================
// Sizing Utilities (REQ-0011: Adaptive Workflow Sizing)
// =========================================================================

/**
 * Safely parse a non-negative integer. Returns defaultVal on failure.
 * @param {*} val - Value to parse
 * @param {number} defaultVal - Default value
 * @returns {number}
 * @private
 */
function _safeNonNegInt(val, defaultVal) {
    if (typeof val === 'number' && Number.isInteger(val) && val >= 0) return val;
    const parsed = parseInt(val, 10);
    return (!isNaN(parsed) && parsed >= 0) ? parsed : defaultVal;
}

/**
 * Validate and normalize a parsed JSON object into SizingMetrics.
 * Invalid fields are replaced with safe defaults.
 *
 * @param {object} parsed - Raw parsed JSON from metadata block
 * @returns {{ file_count: number, module_count: number, risk_score: string,
 *             coupling: string, coverage_gaps: number }}
 * @private
 */
function _validateAndNormalizeSizingMetrics(parsed) {
    const VALID_LEVELS = ['low', 'medium', 'high'];

    const file_count = _safeNonNegInt(parsed.files_directly_affected, 0);
    const module_count = _safeNonNegInt(parsed.modules_affected, 0);
    const risk_score = VALID_LEVELS.includes(String(parsed.risk_level).toLowerCase())
        ? String(parsed.risk_level).toLowerCase()
        : 'medium';
    const coupling = VALID_LEVELS.includes(String(parsed.blast_radius).toLowerCase())
        ? String(parsed.blast_radius).toLowerCase()
        : 'medium';
    const coverage_gaps = _safeNonNegInt(parsed.coverage_gaps, 0);

    return { file_count, module_count, risk_score, coupling, coverage_gaps };
}

/**
 * Parse sizing metrics from impact-analysis.md content.
 *
 * Strategy (ADR-0003):
 *   1. Primary: Parse last JSON metadata block (```json ... ```)
 *   2. Fallback: Regex on Executive Summary prose
 *   3. Default: Return null (caller defaults to standard)
 *
 * @param {string} content - Raw markdown content of impact-analysis.md
 * @returns {{ file_count: number, module_count: number, risk_score: string,
 *             coupling: string, coverage_gaps: number } | null}
 */
function parseSizingFromImpactAnalysis(content) {
    // Guard: empty or non-string content
    if (!content || typeof content !== 'string') {
        return null;
    }

    // --- Primary: JSON metadata block ---
    const jsonBlockRegex = /```json\s*\n([\s\S]*?)\n```/g;
    let lastMatch = null;
    let match;
    while ((match = jsonBlockRegex.exec(content)) !== null) {
        lastMatch = match[1];
    }

    if (lastMatch) {
        try {
            const parsed = JSON.parse(lastMatch);
            return _validateAndNormalizeSizingMetrics(parsed);
        } catch (e) {
            // JSON parse failed -- fall through to fallback
        }
    }

    // --- Fallback: Executive Summary prose ---
    const fileMatch = content.match(/\*\*Affected Files\*\*:\s*(\d+)/i);
    const moduleMatch = content.match(/\*\*Modules? Affected\*\*:\s*(\d+)/i);
    const riskMatch = content.match(/\*\*Risk(?:\s*Level)?\*\*:\s*(low|medium|high)/i);
    const couplingMatch = content.match(/\*\*Blast\s*Radius\*\*:\s*(low|medium|high)/i);
    const coverageMatch = content.match(/\*\*Coverage\s*Gaps?\*\*:\s*(\d+)/i);

    // Require at least file_count and risk_score for fallback to succeed
    if (fileMatch && riskMatch) {
        return {
            file_count: parseInt(fileMatch[1], 10),
            module_count: moduleMatch ? parseInt(moduleMatch[1], 10) : 0,
            risk_score: riskMatch[1].toLowerCase(),
            coupling: couplingMatch ? couplingMatch[1].toLowerCase() : 'medium',
            coverage_gaps: coverageMatch ? parseInt(coverageMatch[1], 10) : 0
        };
    }

    // --- Default: parsing failed ---
    return null;
}

/**
 * Compute a sizing recommendation from impact analysis metrics.
 *
 * Pure function: no I/O, no side effects. Deterministic given same inputs.
 *
 * Algorithm:
 *   1. If metrics is null -> standard (parsing failure)
 *   2. If file_count <= light_max_files AND risk != high -> light
 *   3. If file_count >= epic_min_files OR risk == high -> epic
 *   4. Otherwise -> standard
 *
 * @param {{ file_count: number, module_count: number, risk_score: string,
 *           coupling: string, coverage_gaps: number } | null} metrics
 * @param {{ light_max_files: number, epic_min_files: number }} thresholds
 * @returns {{ intensity: string, rationale: string, metrics: object | null }}
 */
function computeSizingRecommendation(metrics, thresholds) {
    // Step 1: Validate and sanitize thresholds
    const t = { ...thresholds };
    if (typeof t.light_max_files !== 'number' || t.light_max_files < 1) {
        t.light_max_files = 5;
    }
    if (typeof t.epic_min_files !== 'number' || t.epic_min_files < 2) {
        t.epic_min_files = 20;
    }
    if (t.light_max_files >= t.epic_min_files) {
        t.light_max_files = 5;
        t.epic_min_files = 20;
    }

    // Step 2: Null metrics guard
    if (metrics === null || metrics === undefined) {
        return {
            intensity: 'standard',
            rationale: 'Unable to parse impact analysis metrics. Defaulting to standard workflow.',
            metrics: null
        };
    }

    // Step 3: Apply sizing algorithm
    const highRisk = metrics.risk_score === 'high';

    let intensity;
    let rationale;

    if (metrics.file_count <= t.light_max_files && !highRisk) {
        intensity = 'light';
        rationale = `Low scope (${metrics.file_count} files, ${metrics.risk_score} risk). ` +
                    `Architecture and Design phases can be skipped.`;
    } else if (metrics.file_count >= t.epic_min_files || highRisk) {
        intensity = 'epic';
        rationale = `Large scope (${metrics.file_count} files, ${metrics.risk_score} risk). ` +
                    `Epic decomposition recommended.`;
    } else {
        intensity = 'standard';
        rationale = `Medium scope (${metrics.file_count} files, ${metrics.risk_score} risk). ` +
                    `Full workflow recommended.`;
    }

    return { intensity, rationale, metrics };
}

/**
 * Validate post-mutation state invariants for sizing.
 *
 * @param {object} state - The state object after mutation
 * @returns {string|null} Error description if invariant failed, null if all pass
 * @private
 */
function _checkSizingInvariants(state) {
    const aw = state.active_workflow;

    // INV-01: Minimum 3 phases
    if (!Array.isArray(aw.phases) || aw.phases.length < 3) {
        return `INV-01: phases.length=${aw.phases?.length || 0} < 3`;
    }

    // INV-02: Index within bounds
    if (aw.current_phase_index >= aw.phases.length) {
        return `INV-02: current_phase_index=${aw.current_phase_index} >= phases.length=${aw.phases.length}`;
    }

    // INV-03: Every phase_status key exists in phases array
    const phasesSet = new Set(aw.phases);
    for (const key of Object.keys(aw.phase_status)) {
        if (!phasesSet.has(key)) {
            return `INV-03: phase_status key "${key}" not in phases array`;
        }
    }

    // INV-04: Next phase is pending
    const nextPhase = aw.phases[aw.current_phase_index];
    if (aw.phase_status[nextPhase] !== 'pending') {
        return `INV-04: next phase "${nextPhase}" has status "${aw.phase_status[nextPhase]}", expected "pending"`;
    }

    return null; // All invariants pass
}

/**
 * Apply a sizing decision to the in-memory state object.
 *
 * For 'light' intensity:
 *   - Removes phases listed in light_skip_phases from active_workflow.phases
 *   - Removes corresponding entries from phase_status and top-level phases
 *   - Recalculates current_phase_index
 *   - Writes sizing record to active_workflow.sizing
 *   - On invariant failure: rolls back all changes, falls back to standard
 *
 * For 'standard' and 'epic':
 *   - No phase modifications
 *   - Writes sizing record only
 *   - For epic: sets effective_intensity to 'standard', epic_deferred to true
 *
 * Follows the same mutation-in-place pattern as resetPhasesForWorkflow().
 *
 * @param {object} state - The state.json object (mutated in place)
 * @param {string} intensity - 'light' | 'standard' | 'epic'
 * @param {object} sizingData - { metrics, forced_by_flag, overridden,
 *                               overridden_to, recommended_intensity, config }
 * @returns {object} The mutated state object (same reference)
 */
function applySizingDecision(state, intensity, sizingData = {}) {
    // Step 0: Validate intensity
    const VALID_INTENSITIES = ['light', 'standard', 'epic'];
    if (!VALID_INTENSITIES.includes(intensity)) {
        process.stderr.write(`[sizing] Invalid intensity "${intensity}", defaulting to standard\n`);
        intensity = 'standard';
    }

    // Step 1: Guard - require active_workflow
    if (!state || !state.active_workflow) {
        process.stderr.write('[sizing] No active_workflow in state, skipping sizing\n');
        return state;
    }

    const aw = state.active_workflow;
    const metrics = sizingData.metrics || null;
    const now = new Date().toISOString();

    // Step 2: Compute effective intensity
    let effective_intensity = intensity;
    let epic_deferred = false;
    if (intensity === 'epic') {
        effective_intensity = 'standard';
        epic_deferred = true;
    }

    // Step 3: Build sizing record
    const sizingRecord = {
        intensity,
        effective_intensity,
        file_count: metrics ? (metrics.file_count || 0) : 0,
        module_count: metrics ? (metrics.module_count || 0) : 0,
        risk_score: metrics ? (metrics.risk_score || 'unknown') : 'unknown',
        coupling: metrics ? (metrics.coupling || 'unknown') : 'unknown',
        coverage_gaps: metrics ? (metrics.coverage_gaps || 0) : 0,
        recommended_by: sizingData.forced_by_flag ? 'user' : 'framework',
        overridden: !!sizingData.overridden,
        overridden_to: sizingData.overridden_to || null,
        decided_at: now,
        forced_by_flag: !!sizingData.forced_by_flag,
        epic_deferred
    };

    // Step 4: For standard/epic, just write record and return
    if (effective_intensity !== 'light') {
        aw.sizing = sizingRecord;
        return state;
    }

    // Step 5: Light intensity -- modify phase arrays
    // 5a. Determine which phases to skip
    const config = sizingData.config || {};
    const skipPhases = Array.isArray(config.light_skip_phases)
        ? config.light_skip_phases
        : ['03-architecture', '04-design'];

    // 5b. Snapshot for rollback
    const snapshot = {
        phases: [...aw.phases],
        phase_status: { ...aw.phase_status },
        current_phase_index: aw.current_phase_index,
        top_phases: state.phases ? { ...state.phases } : {}
    };

    // 5c. Filter phases array
    aw.phases = aw.phases.filter(p => !skipPhases.includes(p));

    // 5d. Remove from phase_status
    for (const p of skipPhases) {
        delete aw.phase_status[p];
    }

    // 5e. Remove from top-level phases
    if (state.phases) {
        for (const p of skipPhases) {
            delete state.phases[p];
        }
    }

    // 5f. Recalculate current_phase_index
    // Find the last completed phase (02-impact-analysis) and set index to next
    const lastCompleted = '02-impact-analysis';
    const lastCompletedIdx = aw.phases.indexOf(lastCompleted);
    if (lastCompletedIdx >= 0) {
        aw.current_phase_index = lastCompletedIdx + 1;
    }
    // If 02-impact-analysis not found, try to find the highest-indexed completed phase
    else {
        let highestCompleted = -1;
        for (let i = 0; i < aw.phases.length; i++) {
            if (aw.phase_status[aw.phases[i]] === 'completed') {
                highestCompleted = i;
            }
        }
        aw.current_phase_index = highestCompleted + 1;
    }

    // Step 6: Invariant checks
    const invariantsFailed = _checkSizingInvariants(state);

    if (invariantsFailed) {
        // Rollback
        process.stderr.write(`[sizing] Invariant check failed: ${invariantsFailed}. Rolling back to standard.\n`);
        aw.phases = snapshot.phases;
        aw.phase_status = snapshot.phase_status;
        aw.current_phase_index = snapshot.current_phase_index;
        state.phases = snapshot.top_phases;

        sizingRecord.intensity = intensity; // preserve original for audit
        sizingRecord.effective_intensity = 'standard';
        sizingRecord.fallback_reason = 'invariant_check_failed';
    }

    // Step 7: Write sizing record
    aw.sizing = sizingRecord;

    return state;
}

// =========================================================================
// Supervised Mode Utilities (REQ-0013: Supervised Mode)
// =========================================================================

/**
 * Map a phase key to a human-readable display name.
 * @param {string} phaseKey - e.g., '03-architecture'
 * @returns {string} Display name, e.g., 'Architecture'
 * @private
 */
function _resolvePhaseDisplayName(phaseKey) {
    const PHASE_NAMES = {
        '00-quick-scan': 'Quick Scan',
        '01-requirements': 'Requirements',
        '02-impact-analysis': 'Impact Analysis',
        '02-tracing': 'Root Cause Tracing',
        '03-architecture': 'Architecture',
        '04-design': 'Design & Specifications',
        '05-test-strategy': 'Test Strategy',
        '06-implementation': 'Implementation',
        '07-testing': 'Testing',
        '08-code-review': 'Code Review & QA',
        '09-validation': 'Security & Compliance',
        '10-cicd': 'CI/CD Pipeline',
        '11-local-testing': 'Local Testing',
        '12-test-deploy': 'Staging Deployment',
        '13-production': 'Production Deployment',
        '14-operations': 'Operations & Monitoring',
        '15-upgrade-plan': 'Upgrade Planning',
        '15-upgrade-execute': 'Upgrade Execution',
        '16-quality-loop': 'Quality Loop'
    };

    if (PHASE_NAMES[phaseKey]) {
        return PHASE_NAMES[phaseKey];
    }

    // Fallback: derive from phase key (remove number prefix, title case)
    const parts = phaseKey.split('-').slice(1);
    return parts.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || phaseKey;
}

/**
 * Extract key decision bullet points from a phase summary string.
 * Splits on commas and semicolons. Returns up to 5 entries.
 * @param {string} summaryText - Phase summary text
 * @returns {string[]} Array of decision strings (max 5)
 * @private
 */
function _extractDecisions(summaryText) {
    if (!summaryText || typeof summaryText !== 'string') {
        return [];
    }

    // Split on comma or semicolon boundaries
    const parts = summaryText.split(/[,;]/).map(s => s.trim()).filter(s => s.length > 0);
    return parts.slice(0, 5);
}

/**
 * Get git diff --name-status output for the current working tree.
 * Returns null if git is unavailable or fails (ASM-013-03).
 * @param {string} projectRoot - Absolute path to project root
 * @returns {string|null} Diff output or null
 * @private
 */
function _getGitDiffNameStatus(projectRoot) {
    try {
        const { execSync } = require('child_process');
        const output = execSync('git diff --name-status HEAD', {
            cwd: projectRoot,
            encoding: 'utf8',
            timeout: 5000,      // 5s timeout for safety
            stdio: ['pipe', 'pipe', 'pipe']
        });
        return output;
    } catch (e) {
        // Git unavailable or command failed -- degrade gracefully
        return null;
    }
}

/**
 * Read and normalize supervised_mode configuration from state.json.
 *
 * Follows the readCodeReviewConfig() fail-open pattern:
 * - Missing supervised_mode block: returns { enabled: false }
 * - Invalid or corrupt block: returns { enabled: false }
 * - Invalid field values: replaced with safe defaults
 *
 * Traces to: FR-01 (AC-01a, AC-01b, AC-01c, AC-01f), NFR-013-02
 *
 * @param {object} state - Parsed state.json content (already loaded by caller)
 * @returns {{ enabled: boolean, review_phases: 'all'|string[], parallel_summary: boolean, auto_advance_timeout: number|null }}
 */
function readSupervisedModeConfig(state) {
    const defaults = { enabled: false, review_phases: 'all', parallel_summary: true, auto_advance_timeout: null };

    // Guard: no state or no supervised_mode block
    if (!state || typeof state !== 'object') {
        return defaults;
    }

    const sm = state.supervised_mode;

    // Guard: supervised_mode missing or not an object
    if (!sm || typeof sm !== 'object' || Array.isArray(sm)) {
        return defaults;
    }

    // Normalize enabled (must be boolean true to enable)
    const enabled = sm.enabled === true;

    // Normalize review_phases
    let review_phases = 'all';
    if (sm.review_phases === 'all') {
        review_phases = 'all';
    } else if (Array.isArray(sm.review_phases)) {
        // Filter to valid phase number strings (2-digit prefixes like "01", "03", "06")
        review_phases = sm.review_phases.filter(
            p => typeof p === 'string' && /^\d{2}$/.test(p)
        );
        // If all entries were invalid, fall back to 'all'
        if (review_phases.length === 0) {
            review_phases = 'all';
        }
    }
    // Any other type: default to 'all'

    // Normalize parallel_summary (default true)
    const parallel_summary = typeof sm.parallel_summary === 'boolean'
        ? sm.parallel_summary
        : true;

    // auto_advance_timeout: reserved, not implemented (always null)
    const auto_advance_timeout = null;

    return { enabled, review_phases, parallel_summary, auto_advance_timeout };
}

/**
 * Determine if a review gate should fire for the given phase.
 *
 * Traces to: FR-01 (AC-01d, AC-01e, AC-01f), FR-03 (AC-03e, AC-03f)
 *
 * @param {{ enabled: boolean, review_phases: 'all'|string[] }} config - Normalized config from readSupervisedModeConfig()
 * @param {string} phaseKey - Phase key (e.g., '03-architecture', '04-design')
 * @returns {boolean} True if review gate should fire
 */
function shouldReviewPhase(config, phaseKey) {
    // Guard: config not valid or not enabled
    if (!config || config.enabled !== true) {
        return false;
    }

    // Guard: invalid phase key
    if (!phaseKey || typeof phaseKey !== 'string') {
        return false;
    }

    // review_phases = 'all' means every phase triggers review
    if (config.review_phases === 'all') {
        return true;
    }

    // review_phases is an array of 2-digit phase prefixes
    if (Array.isArray(config.review_phases)) {
        // Extract the 2-digit prefix from phaseKey (e.g., '03' from '03-architecture')
        const phaseNumber = phaseKey.split('-')[0];
        return config.review_phases.includes(phaseNumber);
    }

    // Unexpected review_phases type: fail-open (no review)
    return false;
}

/**
 * Generate a phase summary markdown file after phase completion.
 *
 * Output: .isdlc/reviews/phase-{NN}-summary.md
 * Overwrites any existing summary for the same phase (redo support).
 *
 * Traces to: FR-02 (AC-02a through AC-02e), NFR-013-03, NFR-013-06
 *
 * @param {object} state - Parsed state.json content
 * @param {string} phaseKey - Phase key (e.g., '03-architecture')
 * @param {string} projectRoot - Absolute path to project root
 * @param {{ minimal?: boolean }} [options={}] - Options
 *   - minimal: If true, generate minimal summary (no diffs, no decisions)
 * @returns {string|null} Absolute path to generated summary file, or null on failure
 */
function generatePhaseSummary(state, phaseKey, projectRoot, options = {}) {
    try {
        // --- Extract phase metadata from state ---
        const phaseData = state?.phases?.[phaseKey] || {};
        const phaseNumber = phaseKey.split('-')[0];               // '03'
        const phaseName = _resolvePhaseDisplayName(phaseKey);     // 'Architecture'

        // Duration calculation
        const started = phaseData.started || null;
        const completed = phaseData.completed || null;
        let durationStr = 'N/A';
        if (started && completed) {
            const ms = new Date(completed) - new Date(started);
            if (!isNaN(ms) && ms >= 0) {
                const minutes = Math.round(ms / 60000);
                durationStr = `${minutes}m`;
            }
        }

        // Artifact list from phase state
        const artifacts = Array.isArray(phaseData.artifacts)
            ? phaseData.artifacts
            : [];

        // Summary text from phase state
        const summaryText = phaseData.summary || 'No summary available';

        // --- Build markdown ---
        let md = '';
        md += `# Phase ${phaseNumber} Summary: ${phaseName}\n\n`;
        md += `**Status**: Completed\n`;
        md += `**Duration**: ${durationStr}`;
        if (started && completed && durationStr !== 'N/A') {
            md += ` (${started} to ${completed})`;
        }
        md += `\n`;
        md += `**Artifacts**: ${artifacts.length} files\n\n`;

        // Key decisions (full summary only)
        if (!options.minimal) {
            md += `## Key Decisions\n`;
            const decisions = _extractDecisions(summaryText);
            if (decisions.length === 0) {
                md += `- ${summaryText}\n`;
            } else {
                for (const d of decisions) {
                    md += `- ${d}\n`;
                }
            }
            md += `\n`;
        }

        // Artifacts table
        md += `## Artifacts Created/Modified\n`;
        if (artifacts.length === 0) {
            md += `No file changes recorded in phase state.\n`;
        } else {
            md += `| File | Status |\n`;
            md += `|------|--------|\n`;
            for (const a of artifacts) {
                md += `| ${a} | Created/Modified |\n`;
            }
        }
        md += `\n`;

        // Git diff section (full summary only)
        if (!options.minimal) {
            md += `## File Changes (git diff)\n`;
            const diffOutput = _getGitDiffNameStatus(projectRoot);
            if (diffOutput !== null) {
                if (diffOutput.trim() === '') {
                    md += `No uncommitted file changes detected.\n`;
                } else {
                    md += '```\n' + diffOutput + '\n```\n';
                }
            } else {
                md += `Git diff unavailable.\n`;
            }
            md += `\n`;
        }

        // Links section
        if (artifacts.length > 0) {
            md += `## Links\n`;
            for (const a of artifacts) {
                md += `- [${a}](${a})\n`;
            }
            md += `\n`;
        }

        // --- Write to file ---
        const reviewsDir = path.join(projectRoot, '.isdlc', 'reviews');
        fs.mkdirSync(reviewsDir, { recursive: true });     // AC-02c

        const summaryPath = path.join(reviewsDir, `phase-${phaseNumber}-summary.md`);
        fs.writeFileSync(summaryPath, md, 'utf8');          // AC-02d: overwrites

        return summaryPath;

    } catch (e) {
        // Fail-safe: never throw, log to stderr and return null
        try {
            process.stderr.write(`[supervised-mode] Summary generation failed: ${e.message}\n`);
        } catch (_) { /* swallow */ }
        return null;
    }
}

/**
 * Record a review gate action in the workflow's review history.
 *
 * Appends to active_workflow.review_history[] (initializes if missing).
 * Does NOT write state to disk -- caller must call writeState() after.
 *
 * Traces to: FR-08 (AC-08a, AC-08b)
 *
 * @param {object} state - Parsed state.json content (mutated in place)
 * @param {string} phaseKey - Phase key (e.g., '03-architecture')
 * @param {'continue'|'review'|'redo'} action - The user's choice
 * @param {object} [details={}] - Additional fields to include in the entry
 *   - For 'continue': { timestamp }
 *   - For 'review': { paused_at, resumed_at }
 *   - For 'redo': { redo_count, guidance, timestamp }
 * @returns {boolean} True if recorded successfully, false if state is invalid
 */
function recordReviewAction(state, phaseKey, action, details = {}) {
    // Guard: state and active_workflow must exist
    if (!state || !state.active_workflow) {
        return false;
    }

    const aw = state.active_workflow;

    // Initialize review_history if missing or not an array
    if (!Array.isArray(aw.review_history)) {
        aw.review_history = [];
    }

    // Build entry (spread details to avoid mutating the original)
    const entry = {
        phase: phaseKey,
        action: action,
        timestamp: details.timestamp || getTimestamp(),
        ...details
    };

    // Ensure timestamp is present (not duplicated if already in details)
    if (!entry.timestamp) {
        entry.timestamp = getTimestamp();
    }

    aw.review_history.push(entry);

    return true;
}

module.exports = {
    getProjectRoot,
    // Phase prefixes (BUG-0009 item 0.13)
    PHASE_PREFIXES,
    // Protected state fields & patterns (REQ-HARDENING)
    STATE_JSON_PATTERN,
    PROTECTED_STATE_FIELDS,
    stateFileExistsOnDisk,
    // Monorepo support
    isMonorepoMode,
    readMonorepoConfig,
    writeMonorepoConfig,
    resolveProjectFromCwd,
    getActiveProject,
    resolveStatePath,
    resolveConstitutionPath,
    resolveDocsPath,
    resolveExternalSkillsPath,
    resolveExternalManifestPath,
    resolveSkillReportPath,
    resolveTasksPath,
    resolveTestEvaluationPath,
    resolveAtddChecklistPath,
    resolveIsdlcDocsPath,
    isMigrationNeeded,
    loadExternalManifest,
    // State management (monorepo-aware)
    readStateValue,
    readState,
    writeState,
    appendSkillLog,
    getTimestamp,
    getManifestPath,
    loadManifest,
    getSkillOwner,
    getAgentPhase,
    normalizeAgentName,
    isAgentAuthorizedForPhase,
    readStdin,
    outputBlockResponse,
    // Pending escalation tracking
    writePendingEscalation,
    readPendingEscalations,
    clearPendingEscalations,
    // Pending delegation tracking
    readPendingDelegation,
    writePendingDelegation,
    clearPendingDelegation,
    // Code review configuration
    readCodeReviewConfig,
    // Schema validation
    loadSchema,
    validateSchema,
    debugLog,
    // Phase delegation detection (REQ-0004)
    SETUP_COMMAND_KEYWORDS,
    isSetupCommand,
    detectPhaseDelegation,
    // Hook activity logging (REQ-0005)
    logHookEvent,
    getHookLogPath,
    HOOK_LOG_MAX_BYTES,
    HOOK_LOG_KEEP_LINES,
    // Workflow progress snapshots (REQ-0005)
    collectPhaseSnapshots,
    // Phase key normalization (self-healing)
    PHASE_KEY_ALIASES,
    normalizePhaseKey,
    MAX_ESCALATIONS,
    ESCALATION_DEDUP_WINDOW_MS,
    diagnoseBlockCause,
    outputSelfHealNotification,
    // State pruning (BUG-0004)
    pruneSkillUsageLog,
    pruneCompletedPhases,
    pruneHistory,
    pruneWorkflowHistory,
    resetPhasesForWorkflow,
    // Dispatcher helpers (REQ-0010)
    addPendingEscalation,
    addSkillLogEntry,
    loadIterationRequirements,
    loadWorkflowDefinitions,
    // Phase timeout detection
    checkPhaseTimeout,
    // Sizing utilities (REQ-0011)
    parseSizingFromImpactAnalysis,
    computeSizingRecommendation,
    applySizingDecision,
    // Supervised mode (REQ-0013)
    readSupervisedModeConfig,
    shouldReviewPhase,
    generatePhaseSummary,
    recordReviewAction
};

// Test-only exports (not part of public API) -- REQ-0020 FR-001/FR-002
if (process.env.NODE_ENV === 'test' || process.env.ISDLC_TEST_MODE === '1') {
    module.exports._resetCaches = _resetCaches;
    module.exports._getCacheStats = _getCacheStats;
    module.exports._loadConfigWithCache = _loadConfigWithCache;
}
