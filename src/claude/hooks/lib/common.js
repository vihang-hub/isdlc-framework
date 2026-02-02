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

/**
 * Get project root directory (where .isdlc/ folder exists)
 * @returns {string} Project root path
 */
function getProjectRoot() {
    // Use CLAUDE_PROJECT_DIR if available
    if (process.env.CLAUDE_PROJECT_DIR) {
        return process.env.CLAUDE_PROJECT_DIR;
    }

    // Fallback: traverse up to find .isdlc folder
    let dir = process.cwd();
    while (dir !== path.parse(dir).root) {
        if (fs.existsSync(path.join(dir, '.isdlc'))) {
            return dir;
        }
        dir = path.dirname(dir);
    }

    // Default to current directory
    return process.cwd();
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
 * Get the active project ID in monorepo mode.
 * Resolution order:
 *   1. ISDLC_PROJECT env var
 *   2. monorepo.json default_project
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

    // 2. default_project from monorepo.json
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
 * @param {string} [projectId] - Optional project ID override
 * @returns {string} Absolute path to the effective constitution.md
 */
function resolveConstitutionPath(projectId) {
    const projectRoot = getProjectRoot();

    if (isMonorepoMode()) {
        const id = projectId || getActiveProject();
        if (id) {
            const projectConstitution = path.join(projectRoot, '.isdlc', 'projects', id, 'constitution.md');
            if (fs.existsSync(projectConstitution)) {
                return projectConstitution;
            }
        }
    }

    // Shared/single-project constitution
    return path.join(projectRoot, '.isdlc', 'constitution.md');
}

/**
 * Resolve the docs base path for artifacts, accounting for monorepo mode.
 * - Single project: docs/
 * - Monorepo: docs/{project-id}/
 * @param {string} [projectId] - Optional project ID override
 * @returns {string} Absolute path to docs base directory
 */
function resolveDocsPath(projectId) {
    const projectRoot = getProjectRoot();

    if (isMonorepoMode()) {
        const id = projectId || getActiveProject();
        if (id) {
            return path.join(projectRoot, 'docs', id);
        }
    }

    return path.join(projectRoot, 'docs');
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
 * Write state.json
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
        fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Append entry to skill_usage_log array
 * @param {object} logEntry - Log entry to append
 * @returns {boolean} Success
 */
function appendSkillLog(logEntry) {
    const state = readState();
    if (!state) {
        return false;
    }

    if (!Array.isArray(state.skill_usage_log)) {
        state.skill_usage_log = [];
    }

    state.skill_usage_log.push(logEntry);
    return writeState(state);
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

    try {
        return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (e) {
        return null;
    }
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
        'arch-designer': 'architecture-designer'
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

/**
 * Debug log (only when SKILL_VALIDATOR_DEBUG=true)
 * @param {...any} args - Arguments to log
 */
function debugLog(...args) {
    if (process.env.SKILL_VALIDATOR_DEBUG === 'true') {
        console.error('[skill-validator]', ...args);
    }
}

module.exports = {
    getProjectRoot,
    // Monorepo support
    isMonorepoMode,
    readMonorepoConfig,
    writeMonorepoConfig,
    getActiveProject,
    resolveStatePath,
    resolveConstitutionPath,
    resolveDocsPath,
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
    debugLog
};
