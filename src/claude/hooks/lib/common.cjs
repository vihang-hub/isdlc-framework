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
    // Pending delegation tracking
    readPendingDelegation,
    writePendingDelegation,
    clearPendingDelegation,
    // Code review configuration
    readCodeReviewConfig,
    debugLog
};
