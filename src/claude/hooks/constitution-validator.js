#!/usr/bin/env node
/**
 * iSDLC Constitution Validator - PreToolUse Hook
 * ===============================================
 * Intercepts phase completion declarations and validates constitutional compliance.
 *
 * Triggers when:
 * - Agent declares phase complete
 * - Gate validation is requested
 * - Artifact finalization occurs
 *
 * Version: 1.0.0
 */

const {
    readState,
    writeState,
    readStdin,
    outputBlockResponse,
    debugLog,
    getProjectRoot,
    getTimestamp
} = require('./lib/common.js');

const fs = require('fs');
const path = require('path');

/**
 * Patterns indicating phase completion intent
 */
const COMPLETION_PATTERNS = [
    /phase\s+(complete|done|finished)/i,
    /ready\s+for\s+gate/i,
    /gate\s+validation/i,
    /submit\s+for\s+review/i,
    /finalize\s+artifacts/i,
    /declare\s+complete/i,
    /mark\s+as\s+complete/i,
    /phase\s+\d+\s+complete/i,
    /implementation\s+complete/i,
    /testing\s+complete/i,
    /requirements\s+complete/i
];

/**
 * Load iteration requirements
 */
function loadIterationRequirements() {
    const projectRoot = getProjectRoot();
    const configPaths = [
        path.join(projectRoot, '.claude', 'hooks', 'config', 'iteration-requirements.json'),
        path.join(projectRoot, '.isdlc', 'config', 'iteration-requirements.json')
    ];

    for (const configPath of configPaths) {
        if (fs.existsSync(configPath)) {
            try {
                return JSON.parse(fs.readFileSync(configPath, 'utf8'));
            } catch (e) {
                return null;
            }
        }
    }
    return null;
}

/**
 * Setup commands that should NEVER be blocked.
 * These run BEFORE workflows start or are configuration commands.
 */
const SETUP_COMMAND_KEYWORDS = [
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
];

/**
 * Detect if this is a phase completion attempt
 */
function isPhaseCompletionAttempt(input) {
    const toolName = input.tool_name;
    const toolInput = input.tool_input || {};

    if (toolName === 'Task') {
        const prompt = (toolInput.prompt || '');
        const description = (toolInput.description || '');
        const combined = (prompt + ' ' + description).toLowerCase();

        // FIRST: Check if this is a setup/configuration command - NEVER block these
        for (const setupKeyword of SETUP_COMMAND_KEYWORDS) {
            if (combined.includes(setupKeyword)) {
                debugLog(`Setup command detected (${setupKeyword}), skipping phase completion check`);
                return false;
            }
        }

        return COMPLETION_PATTERNS.some(pattern => pattern.test(combined));
    }

    return false;
}

/**
 * Check constitutional validation status
 */
function checkConstitutionalStatus(phaseState, phaseReq) {
    const constReq = phaseReq?.constitutional_validation;
    if (!constReq || !constReq.enabled) {
        return { satisfied: true, reason: 'not_required' };
    }

    const constState = phaseState?.constitutional_validation;

    // Not started
    if (!constState) {
        return {
            satisfied: false,
            reason: 'not_started',
            message: `Constitutional validation not started. Required articles: ${constReq.articles.join(', ')}`,
            action: 'START_VALIDATION'
        };
    }

    // In progress
    if (constState.status === 'iterating' || constState.status === 'pending' || !constState.completed) {
        return {
            satisfied: false,
            reason: 'in_progress',
            message: `Constitutional validation in progress (iteration ${constState.iterations_used || 0}/${constState.max_iterations}).`,
            action: 'CONTINUE_VALIDATION'
        };
    }

    // Escalated
    if (constState.status === 'escalated') {
        if (constState.escalation_approved) {
            return { satisfied: true, reason: 'escalation_approved' };
        }
        return {
            satisfied: false,
            reason: 'escalated_pending',
            message: 'Constitutional validation escalated. Human approval required.',
            unresolved: constState.unresolved_violations,
            action: 'AWAIT_APPROVAL'
        };
    }

    // Compliant
    if (constState.status === 'compliant' && constState.completed) {
        return { satisfied: true, reason: 'compliant' };
    }

    return {
        satisfied: false,
        reason: 'unknown',
        message: `Invalid constitutional validation status: ${constState.status}`,
        action: 'REVALIDATE'
    };
}

/**
 * Initialize constitutional validation tracking
 */
function initializeConstitutionalValidation(state, currentPhase, phaseReq) {
    if (!state.phases) state.phases = {};
    if (!state.phases[currentPhase]) state.phases[currentPhase] = { status: 'in_progress' };

    const constReq = phaseReq.constitutional_validation;

    state.phases[currentPhase].constitutional_validation = {
        required: true,
        completed: false,
        status: 'pending',
        iterations_used: 0,
        max_iterations: constReq.max_iterations || 5,
        articles_required: constReq.articles,
        articles_checked: [],
        violations_found: [],
        history: [],
        started_at: getTimestamp()
    };

    return state;
}

/**
 * Get human-readable article descriptions
 */
function getArticleDescriptions() {
    return {
        'I': 'Specification Primacy - Code implements specifications exactly',
        'II': 'Test-First Development - Tests written before/with implementation',
        'III': 'Library-First Design - Custom code justified over libraries',
        'IV': 'Security by Design - Security considerations documented',
        'V': 'Explicit Over Implicit - No vague requirements or assumptions',
        'VI': 'Simplicity First - No over-engineering',
        'VII': 'Artifact Traceability - All artifacts have IDs and links',
        'VIII': 'Documentation Currency - Docs match current code',
        'IX': 'Quality Gate Integrity - Gates validated, not skipped',
        'X': 'Fail-Safe Defaults - Secure defaults implemented',
        'XI': 'Artifact Completeness - All required artifacts exist',
        'XII': 'Compliance Requirements - Regulatory compliance addressed'
    };
}

async function main() {
    try {
        const inputStr = await readStdin();

        if (!inputStr || !inputStr.trim()) {
            process.exit(0);
        }

        let input;
        try {
            input = JSON.parse(inputStr);
        } catch (e) {
            process.exit(0);
        }

        // Only check phase completion attempts
        if (!isPhaseCompletionAttempt(input)) {
            process.exit(0);
        }

        debugLog('Phase completion attempt detected');

        // Load state
        let state = readState();
        if (!state) {
            debugLog('No state.json, allowing');
            process.exit(0);
        }

        // Check if enforcement is enabled
        if (state.iteration_enforcement?.enabled === false) {
            process.exit(0);
        }

        const currentPhase = state.current_phase;
        if (!currentPhase) {
            process.exit(0);
        }

        // Load requirements
        const requirements = loadIterationRequirements();
        const phaseReq = requirements?.phase_requirements?.[currentPhase];

        if (!phaseReq?.constitutional_validation?.enabled) {
            debugLog('Constitutional validation not enabled for phase:', currentPhase);
            process.exit(0);
        }

        // Get phase state
        const phaseState = state.phases?.[currentPhase];

        // Check constitutional status
        const status = checkConstitutionalStatus(phaseState, phaseReq);

        if (status.satisfied) {
            debugLog('Constitutional validation satisfied');
            process.exit(0);
        }

        // Initialize tracking if not started
        if (status.reason === 'not_started') {
            state = initializeConstitutionalValidation(state, currentPhase, phaseReq);
            writeState(state);
        }

        // Build article descriptions
        const articleDescriptions = getArticleDescriptions();
        const requiredArticles = phaseReq.constitutional_validation.articles;
        const articleList = requiredArticles
            .map(a => `  - Article ${a}: ${articleDescriptions[a] || 'Unknown'}`)
            .join('\n');

        // Block completion until constitutional validation is done
        const stopReason = `PHASE COMPLETION BLOCKED: Constitutional validation required.

Status: ${status.reason}
${status.message}

Required Articles for ${currentPhase}:
${articleList}

Action Required: ${status.action}

Before declaring phase complete, you MUST:
1. Read the constitution at .isdlc/constitution.md
2. Validate all artifacts against the required articles listed above
3. For each article, check if your artifacts comply
4. If violations found, fix them and re-validate
5. Update state.json with validation results
6. Continue iterating until status is 'compliant' or max iterations reached

Use the autonomous-constitution-validate skill (ORCH-011) protocol:
- Max iterations: ${phaseReq.constitutional_validation.max_iterations}
- Track each iteration in state.json → phases.${currentPhase}.constitutional_validation

Example state update after validation:
{
  "constitutional_validation": {
    "completed": true,
    "status": "compliant",
    "iterations_used": N,
    "articles_checked": ${JSON.stringify(requiredArticles)}
  }
}`;

        outputBlockResponse(stopReason);
        process.exit(0);

    } catch (error) {
        debugLog('Error in constitution-validator:', error.message);
        process.exit(0);
    }
}

main();
