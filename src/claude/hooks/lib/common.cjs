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
// Pending Escalation Tracking
// =========================================================================

/**
 * Write a pending escalation entry to state.json.
 * Appends to state.pending_escalations[] array.
 * @param {object} entry - { type, hook, phase, detail, timestamp }
 */
function writePendingEscalation(entry) {
    const state = readState();
    if (!state) return;
    if (!Array.isArray(state.pending_escalations)) {
        state.pending_escalations = [];
    }
    state.pending_escalations.push(entry);
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
 * @param {Object} state - The state object
 * @returns {Object} The mutated state object
 */
function pruneCompletedPhases(state) {
    if (!state.phases || typeof state.phases !== 'object') return state;

    const STRIP_FIELDS = [
        'iteration_requirements',
        'constitutional_validation',
        'gate_validation',
        'testing_environment',
        'verification_summary',
        'atdd_validation'
    ];

    for (const [, phase] of Object.entries(state.phases)) {
        if (phase.status === 'completed' || phase.gate_passed) {
            for (const field of STRIP_FIELDS) {
                delete phase[field];
            }
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
    // State pruning (BUG-0004)
    pruneSkillUsageLog,
    pruneCompletedPhases,
    pruneHistory,
    pruneWorkflowHistory,
    resetPhasesForWorkflow
};
