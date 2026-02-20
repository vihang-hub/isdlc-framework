'use strict';

/**
 * iSDLC Three-Verb Model Utilities (CommonJS)
 * =============================================
 * Extracted utility functions for the add/analyze/build backlog model.
 * These functions are used inline within isdlc.md and tested independently.
 *
 * REQ-0023: Three-verb backlog model
 * Traces: FR-001, FR-002, FR-003, FR-007, FR-009, ADR-0013, ADR-0014, ADR-0015
 *
 * Version: 1.0.0
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * The ordered sequence of analysis phases. Used to determine next phase
 * and derive analysis status.
 * Traces: FR-002, FR-009, VR-PHASE-001
 */
const ANALYSIS_PHASES = [
    '00-quick-scan',
    '01-requirements',
    '02-impact-analysis',
    '03-architecture',
    '04-design'
];

/**
 * Implementation phases that follow analysis in the feature workflow.
 * Used by computeStartPhase to identify the build-start boundary.
 *
 * REQ-0026: Build auto-detection
 * Traces: FR-002, FR-006
 */
const IMPLEMENTATION_PHASES = [
    '05-test-strategy',
    '06-implementation',
    '16-quality-loop',
    '08-code-review'
];

/**
 * Regex for parsing BACKLOG.md item lines.
 * Capture groups:
 *   1: Prefix (whitespace + dash + whitespace)
 *   2: Item number (e.g., "16.2")
 *   3: Marker character (space, ~, A, or x)
 *   4: Description text
 * Traces: FR-007, VR-MARKER-002, ADR-0014
 */
const MARKER_REGEX = /^(\s*-\s+)(\d+\.\d+)\s+\[([ ~Ax])\]\s+(.+)$/;

// ---------------------------------------------------------------------------
// generateSlug(description)
// ---------------------------------------------------------------------------

/**
 * Generates a URL-safe slug from a free-text description.
 *
 * Traces: FR-001 (AC-001-01), VR-SLUG-001..004
 *
 * @param {string} description - Free-text item description
 * @returns {string} Sanitized slug (max 50 chars)
 */
function generateSlug(description) {
    if (!description || typeof description !== 'string') {
        return 'untitled-item';
    }

    let slug = description
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')   // Remove non-alphanumeric (keep spaces, hyphens)
        .replace(/\s+/g, '-')            // Spaces to hyphens
        .replace(/-+/g, '-')             // Collapse multiple hyphens
        .replace(/^-|-$/g, '')           // Trim leading/trailing hyphens
        .substring(0, 50);               // Max 50 chars

    if (!slug) {
        slug = 'untitled-item';
    }

    return slug;
}

// ---------------------------------------------------------------------------
// detectSource(input)
// ---------------------------------------------------------------------------

/**
 * Detects the source type from add verb input.
 *
 * Traces: FR-001 (AC-001-03), VR-SOURCE-001..003
 *
 * @param {string} input - Raw user input
 * @returns {{ source: string, source_id: string|null, description: string }}
 */
function detectSource(input) {
    if (!input || typeof input !== 'string') {
        return { source: 'manual', source_id: null, description: '' };
    }

    const trimmed = input.trim();

    // GitHub issue: #N pattern
    const ghMatch = trimmed.match(/^#(\d+)$/);
    if (ghMatch) {
        return {
            source: 'github',
            source_id: `GH-${ghMatch[1]}`,
            description: trimmed
        };
    }

    // Jira ticket: PROJECT-N pattern (uppercase letters + dash + digits)
    const jiraMatch = trimmed.match(/^([A-Z]+-\d+)$/);
    if (jiraMatch) {
        return {
            source: 'jira',
            source_id: jiraMatch[1],
            description: trimmed
        };
    }

    // Manual description (everything else)
    return {
        source: 'manual',
        source_id: null,
        description: trimmed
    };
}

// ---------------------------------------------------------------------------
// deriveAnalysisStatus(phasesCompleted)
// ---------------------------------------------------------------------------

/**
 * Derives the analysis status string from the list of completed phases.
 *
 * Traces: FR-009 (AC-009-01), VR-PHASE-003
 *
 * @param {string[]} phasesCompleted - Array of completed phase keys
 * @returns {'raw'|'partial'|'analyzed'}
 */
function deriveAnalysisStatus(phasesCompleted) {
    if (!Array.isArray(phasesCompleted)) {
        return 'raw';
    }

    const completedCount = phasesCompleted.filter(
        p => ANALYSIS_PHASES.includes(p)
    ).length;

    if (completedCount === 0) return 'raw';
    if (completedCount < 5) return 'partial';
    return 'analyzed';
}

// ---------------------------------------------------------------------------
// deriveBacklogMarker(analysisStatus)
// ---------------------------------------------------------------------------

/**
 * Maps an analysis status to a BACKLOG.md marker character.
 *
 * Traces: FR-007 (AC-007-01..03), ADR-0014
 *
 * @param {string} analysisStatus - One of 'raw', 'partial', 'analyzed'
 * @returns {string} Marker character: ' ', '~', or 'A'
 */
function deriveBacklogMarker(analysisStatus) {
    switch (analysisStatus) {
        case 'raw':      return ' ';
        case 'partial':  return '~';
        case 'analyzed': return 'A';
        default:         return ' ';
    }
}

// ---------------------------------------------------------------------------
// readMetaJson(slugDir)
// ---------------------------------------------------------------------------

/**
 * Reads and normalizes meta.json from a slug directory.
 * Returns null if file doesn't exist or is corrupted.
 *
 * Defensive defaults applied:
 * - analysis_status: 'raw'
 * - phases_completed: []
 * - source: 'manual'
 * - created_at: current timestamp
 * - steps_completed: []           (REQ-ROUNDTABLE-ANALYST, GH-20)
 * - depth_overrides: {}           (REQ-ROUNDTABLE-ANALYST, GH-20)
 * - elaborations: []              (GH-21, elaboration tracking)
 * - elaboration_config: {}        (GH-21, elaboration config)
 *
 * Traces: FR-009 (AC-009-01..05), ADR-0013, FR-005, FR-006
 *
 * @param {string} slugDir - Absolute path to the slug directory
 * @returns {object|null} Parsed and migrated meta object, or null if missing/corrupt
 */
function readMetaJson(slugDir) {
    const metaPath = path.join(slugDir, 'meta.json');

    if (!fs.existsSync(metaPath)) {
        return null;
    }

    let raw;
    try {
        raw = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch (e) {
        // ERR-META-002: Corrupted meta.json
        return null;
    }

    // Legacy migration: phase_a_completed -> analysis_status + phases_completed
    // Traces: VR-MIGRATE-001..003
    if ('phase_a_completed' in raw && !('analysis_status' in raw)) {
        if (raw.phase_a_completed === true) {
            raw.analysis_status = 'analyzed';
            raw.phases_completed = [
                '00-quick-scan', '01-requirements',
                '02-impact-analysis', '03-architecture', '04-design'
            ];
        } else {
            raw.analysis_status = 'raw';
            raw.phases_completed = [];
        }
    }

    // Defensive defaults for missing fields
    if (!raw.analysis_status) {
        raw.analysis_status = 'raw';
    }
    if (!Array.isArray(raw.phases_completed)) {
        raw.phases_completed = [];
    }
    if (!raw.source) {
        raw.source = 'manual';
    }
    if (!raw.created_at) {
        raw.created_at = new Date().toISOString();
    }

    // Roundtable step-tracking defaults (REQ-ROUNDTABLE-ANALYST, GH-20)
    // Traces: FR-005 AC-005-04, FR-006 AC-006-06, NFR-005 AC-NFR-005-03
    if (!Array.isArray(raw.steps_completed)) {
        raw.steps_completed = [];
    }
    if (typeof raw.depth_overrides !== 'object' || raw.depth_overrides === null || Array.isArray(raw.depth_overrides)) {
        raw.depth_overrides = {};
    }

    // Elaboration tracking defaults (GH-21)
    // Traces: FR-009 AC-009-02, NFR-005 AC-NFR-005-01
    if (!Array.isArray(raw.elaborations)) {
        raw.elaborations = [];
    }
    // Traces: FR-007 AC-007-03
    if (typeof raw.elaboration_config !== 'object' || raw.elaboration_config === null || Array.isArray(raw.elaboration_config)) {
        raw.elaboration_config = {};
    }

    return raw;
}

// ---------------------------------------------------------------------------
// writeMetaJson(slugDir, meta)
// ---------------------------------------------------------------------------

/**
 * Writes meta.json to a slug directory, deriving analysis_status from
 * phases_completed for consistency. Removes legacy fields.
 *
 * Traces: FR-009 (AC-009-01, AC-009-02)
 *
 * @param {string} slugDir - Absolute path to the slug directory
 * @param {object} meta - The meta object to write
 */
function writeMetaJson(slugDir, meta) {
    const metaPath = path.join(slugDir, 'meta.json');

    // Never write legacy field
    delete meta.phase_a_completed;

    // Derive analysis_status from phases_completed for consistency
    const completedCount = (meta.phases_completed || []).filter(
        p => ANALYSIS_PHASES.includes(p)
    ).length;

    if (completedCount === 0) meta.analysis_status = 'raw';
    else if (completedCount < 5) meta.analysis_status = 'partial';
    else meta.analysis_status = 'analyzed';

    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
}

// ---------------------------------------------------------------------------
// validatePhasesCompleted(phasesCompleted, fullSequence)
// REQ-0026: Build auto-detection
// ---------------------------------------------------------------------------

/**
 * Validates and normalizes a phases_completed array.
 * Returns the contiguous prefix of recognized analysis phases.
 *
 * REQ-0026: Build auto-detection
 * Traces: FR-003 (AC-003-06), NFR-004 (AC-NFR-004-03)
 *
 * @param {string[]} phasesCompleted - Raw phases_completed from meta.json
 * @param {string[]} [fullSequence=ANALYSIS_PHASES] - The ordered phase sequence to validate against
 * @returns {{ valid: string[], warnings: string[] }}
 */
function validatePhasesCompleted(phasesCompleted, fullSequence) {
    if (fullSequence === undefined) {
        fullSequence = ANALYSIS_PHASES;
    }

    // Step 1: Check if input is an array
    if (!Array.isArray(phasesCompleted)) {
        return { valid: [], warnings: ['phases_completed is not an array'] };
    }

    // Step 2: Filter to recognized phase keys only
    const recognized = phasesCompleted.filter(p => fullSequence.includes(p));

    // Step 3-4: Build contiguous prefix
    const valid = [];
    for (const phase of fullSequence) {
        if (recognized.includes(phase)) {
            valid.push(phase);
        } else {
            break; // Stop at first missing phase (contiguous prefix)
        }
    }

    // Step 5-6: Generate warnings for non-contiguous phases
    const warnings = [];
    if (recognized.length > valid.length) {
        warnings.push(
            'Non-contiguous phases detected: found [' + recognized.join(', ') +
            '] but only [' + valid.join(', ') + '] form a contiguous prefix'
        );
    }

    // Step 7: Unknown keys are silently filtered (no warning per NFR-004 AC-NFR-004-03)

    return { valid, warnings };
}

// ---------------------------------------------------------------------------
// computeStartPhase(meta, workflowPhases)
// REQ-0026: Build auto-detection
// ---------------------------------------------------------------------------

/**
 * Computes the start phase for a build workflow based on analysis status.
 *
 * REQ-0026: Build auto-detection
 * Traces: FR-001, FR-002, FR-003, NFR-006 (AC-NFR-006-01)
 *
 * @param {object|null} meta - Parsed meta.json (from readMetaJson), or null if missing/corrupt
 * @param {string[]} workflowPhases - Full feature workflow phases from workflows.json
 * @returns {{
 *   status: 'analyzed'|'partial'|'raw',
 *   startPhase: string|null,
 *   completedPhases: string[],
 *   remainingPhases: string[],
 *   warnings: string[]
 * }}
 */
function computeStartPhase(meta, workflowPhases) {
    // Step 1: Handle null or non-object meta
    if (meta === null || meta === undefined || typeof meta !== 'object' || Array.isArray(meta)) {
        return {
            status: 'raw',
            startPhase: null,
            completedPhases: [],
            remainingPhases: [...workflowPhases],
            warnings: []
        };
    }

    // Step 2: Validate phases_completed
    const { valid, warnings } = validatePhasesCompleted(meta.phases_completed);

    // Step 3: No valid phases -> raw
    if (valid.length === 0) {
        return {
            status: 'raw',
            startPhase: null,
            completedPhases: [],
            remainingPhases: [...workflowPhases],
            warnings
        };
    }

    // Step 4: All analysis phases complete -> analyzed
    if (valid.length === ANALYSIS_PHASES.length) {
        const firstImplPhase = workflowPhases.find(p => !ANALYSIS_PHASES.includes(p));
        if (firstImplPhase === undefined) {
            // Defensive: workflow has no implementation phases
            return {
                status: 'analyzed',
                startPhase: null,
                completedPhases: valid,
                remainingPhases: [],
                warnings
            };
        }
        const remaining = workflowPhases.slice(workflowPhases.indexOf(firstImplPhase));
        return {
            status: 'analyzed',
            startPhase: firstImplPhase,
            completedPhases: valid,
            remainingPhases: remaining,
            warnings
        };
    }

    // Step 5: Partial analysis
    const nextAnalysisPhase = ANALYSIS_PHASES.find(p => !valid.includes(p));
    const phaseIndex = workflowPhases.indexOf(nextAnalysisPhase);
    const remaining = phaseIndex >= 0
        ? workflowPhases.slice(phaseIndex)
        : [...workflowPhases];

    return {
        status: 'partial',
        startPhase: nextAnalysisPhase,
        completedPhases: valid,
        remainingPhases: remaining,
        warnings
    };
}

// ---------------------------------------------------------------------------
// checkStaleness(meta, currentHash)
// REQ-0026: Build auto-detection
// ---------------------------------------------------------------------------

/**
 * Checks whether the codebase has changed since analysis was performed.
 * Pure comparison function -- does not execute git commands.
 *
 * REQ-0026: Build auto-detection
 * Traces: FR-004, NFR-002, NFR-004 (AC-NFR-004-02)
 *
 * @param {object|null} meta - Parsed meta.json (from readMetaJson)
 * @param {string} currentHash - Current git short hash (from `git rev-parse --short HEAD`)
 * @returns {{
 *   stale: boolean,
 *   originalHash: string|null,
 *   currentHash: string,
 *   commitsBehind: number|null
 * }}
 */
function checkStaleness(meta, currentHash) {
    // Step 1: No hash to compare (null meta or missing/falsy codebase_hash)
    if (meta === null || meta === undefined || !meta.codebase_hash) {
        return {
            stale: false,
            originalHash: null,
            currentHash: currentHash,
            commitsBehind: null
        };
    }

    // Step 2: Same hash -> not stale
    if (meta.codebase_hash === currentHash) {
        return {
            stale: false,
            originalHash: meta.codebase_hash,
            currentHash: currentHash,
            commitsBehind: null
        };
    }

    // Step 3: Different hash -> stale
    return {
        stale: true,
        originalHash: meta.codebase_hash,
        currentHash: currentHash,
        commitsBehind: null
    };
}

// ---------------------------------------------------------------------------
// parseBacklogLine(line)
// ---------------------------------------------------------------------------

/**
 * Parses a single BACKLOG.md line using the marker regex.
 *
 * Traces: FR-007, VR-MARKER-001..002
 *
 * @param {string} line - A single line from BACKLOG.md
 * @returns {{ prefix: string, itemNumber: string, marker: string, description: string }|null}
 */
function parseBacklogLine(line) {
    const match = line.match(MARKER_REGEX);
    if (!match) return null;
    return {
        prefix: match[1],
        itemNumber: match[2],
        marker: match[3],
        description: match[4]
    };
}

// ---------------------------------------------------------------------------
// updateBacklogMarker(backlogPath, slug, newMarker)
// ---------------------------------------------------------------------------

/**
 * Updates the marker character for a backlog item matching the given slug.
 *
 * Traces: FR-007 (AC-007-01..06), ADR-0014
 *
 * @param {string} backlogPath - Absolute path to BACKLOG.md
 * @param {string} slug - The item slug to match against
 * @param {string} newMarker - One of ' ', '~', 'A', 'x'
 * @returns {boolean} True if a marker was updated
 */
function updateBacklogMarker(backlogPath, slug, newMarker) {
    if (!fs.existsSync(backlogPath)) {
        return false; // ERR-BACKLOG-001: silent
    }

    const content = fs.readFileSync(backlogPath, 'utf8');
    const lines = content.split('\n');
    let updated = false;

    for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(MARKER_REGEX);
        if (match) {
            const lineText = match[4]; // description text
            // Check if this line references our slug (substring match)
            if (lineText.toLowerCase().includes(slug.toLowerCase()) ||
                slug.toLowerCase().includes(lineText.toLowerCase().replace(/\s+/g, '-'))) {
                lines[i] = match[1] + match[2] + ' [' + newMarker + '] ' + match[4];
                updated = true;
                break;
            }
        }
    }

    if (updated) {
        fs.writeFileSync(backlogPath, lines.join('\n'));
    }

    return updated;
}

// ---------------------------------------------------------------------------
// appendToBacklog(backlogPath, itemNumber, description, marker)
// ---------------------------------------------------------------------------

/**
 * Appends a new item to the Open section of BACKLOG.md.
 *
 * Traces: FR-001 (AC-001-04), FR-007 (AC-007-01)
 *
 * @param {string} backlogPath - Absolute path to BACKLOG.md
 * @param {string} itemNumber - Item number (e.g., "16.2")
 * @param {string} description - Item description
 * @param {string} [marker=' '] - Marker character
 */
function appendToBacklog(backlogPath, itemNumber, description, marker = ' ') {
    let content;

    if (!fs.existsSync(backlogPath)) {
        content = '# Backlog\n\n## Open\n\n## Completed\n';
        fs.writeFileSync(backlogPath, content);
    }

    content = fs.readFileSync(backlogPath, 'utf8');
    const lines = content.split('\n');

    // Find the ## Open section
    const openIndex = lines.findIndex(l => /^##\s+Open/.test(l));
    if (openIndex === -1) {
        // Append ## Open section
        lines.push('', '## Open', '');
        const newOpenIndex = lines.length - 1;
        const newLine = `- ${itemNumber} [${marker}] ${description}`;
        lines.splice(newOpenIndex, 0, newLine);
        fs.writeFileSync(backlogPath, lines.join('\n'));
        return;
    }

    // Find the end of the Open section (next ## heading or EOF)
    let insertIndex = openIndex + 1;
    while (insertIndex < lines.length && !/^##\s/.test(lines[insertIndex])) {
        insertIndex++;
    }

    // Insert new item before the next section
    const newLine = `- ${itemNumber} [${marker}] ${description}`;
    lines.splice(insertIndex, 0, newLine);

    fs.writeFileSync(backlogPath, lines.join('\n'));
}

// ---------------------------------------------------------------------------
// resolveItem(input, requirementsDir, backlogPath)
// ---------------------------------------------------------------------------

/**
 * Resolves a user input to a backlog item using the ADR-0015 priority chain.
 *
 * Priority chain:
 * 1. Exact slug match (directory with meta.json)
 * 2. Partial slug match (directory ending with -input)
 * 3. Item number match (N.N in BACKLOG.md)
 * 4. External reference match (#N or PROJECT-N in meta.json)
 * 5. Fuzzy description match (substring in BACKLOG.md)
 *
 * Traces: FR-002, FR-003, ADR-0015
 *
 * @param {string} input - User input (slug, number, ref, or text)
 * @param {string} requirementsDir - Absolute path to docs/requirements/
 * @param {string} backlogPath - Absolute path to BACKLOG.md
 * @returns {object|null} Resolved item or null
 */
function resolveItem(input, requirementsDir, backlogPath) {
    if (!input || typeof input !== 'string') {
        return null;
    }

    const trimmed = input.trim();
    if (!trimmed) return null;

    // Strategy 1: Exact slug match
    const slugDir = path.join(requirementsDir, trimmed);
    if (fs.existsSync(path.join(slugDir, 'meta.json'))) {
        return {
            slug: trimmed,
            dir: slugDir,
            meta: readMetaJson(slugDir)
        };
    }

    // Strategy 2: Partial slug match (directory ending with -input)
    if (fs.existsSync(requirementsDir)) {
        try {
            const dirs = fs.readdirSync(requirementsDir, { withFileTypes: true })
                .filter(d => d.isDirectory())
                .map(d => d.name);

            for (const dir of dirs) {
                if (dir.endsWith('-' + trimmed)) {
                    const dirPath = path.join(requirementsDir, dir);
                    if (fs.existsSync(path.join(dirPath, 'meta.json'))) {
                        return {
                            slug: dir,
                            dir: dirPath,
                            meta: readMetaJson(dirPath)
                        };
                    }
                }
            }
        } catch (e) {
            // ERR-RESOLVE-004: silent
        }
    }

    // Strategy 3: BACKLOG.md item number (N.N pattern)
    if (/^\d+\.\d+$/.test(trimmed)) {
        const item = findBacklogItemByNumber(backlogPath, trimmed, requirementsDir);
        if (item) return item;
    }

    // Strategy 4: External reference (#N or PROJECT-N)
    if (/^#\d+$/.test(trimmed) || /^[A-Z]+-\d+$/i.test(trimmed)) {
        const item = findByExternalRef(trimmed, requirementsDir);
        if (item) return item;
    }

    // Strategy 5: Fuzzy description match
    const matches = searchBacklogTitles(backlogPath, trimmed, requirementsDir);
    if (matches.length === 1) {
        return matches[0];
    }
    if (matches.length > 1) {
        // Return all matches -- caller handles disambiguation
        return { multiple: true, matches };
    }

    return null;
}

// ---------------------------------------------------------------------------
// Internal helpers for resolveItem
// ---------------------------------------------------------------------------

/**
 * Finds a backlog item by its N.N number in BACKLOG.md.
 * @param {string} backlogPath
 * @param {string} itemNumber
 * @param {string} requirementsDir
 * @returns {object|null}
 */
function findBacklogItemByNumber(backlogPath, itemNumber, requirementsDir) {
    if (!fs.existsSync(backlogPath)) return null;

    const content = fs.readFileSync(backlogPath, 'utf8');
    const lines = content.split('\n');

    for (const line of lines) {
        const parsed = parseBacklogLine(line);
        if (parsed && parsed.itemNumber === itemNumber) {
            // Try to find corresponding directory
            const slug = parsed.description.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            const dir = findDirForDescription(requirementsDir, parsed.description);
            return {
                slug: dir ? path.basename(dir) : slug,
                dir: dir || null,
                meta: dir ? readMetaJson(dir) : null,
                backlogLine: line,
                itemNumber: parsed.itemNumber
            };
        }
    }

    return null;
}

/**
 * Finds a backlog item by external reference in meta.json files.
 * @param {string} ref
 * @param {string} requirementsDir
 * @returns {object|null}
 */
function findByExternalRef(ref, requirementsDir) {
    if (!fs.existsSync(requirementsDir)) return null;

    // Normalize github ref for comparison
    const normalizedRef = ref.startsWith('#') ? `GH-${ref.substring(1)}` : ref;

    try {
        const dirs = fs.readdirSync(requirementsDir, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => d.name);

        for (const dir of dirs) {
            const dirPath = path.join(requirementsDir, dir);
            const meta = readMetaJson(dirPath);
            if (meta && meta.source_id) {
                if (meta.source_id === normalizedRef ||
                    meta.source_id === ref ||
                    meta.source_id.toLowerCase() === ref.toLowerCase()) {
                    return {
                        slug: dir,
                        dir: dirPath,
                        meta
                    };
                }
            }
        }
    } catch (e) {
        // ERR-RESOLVE-004: silent
    }

    return null;
}

/**
 * Searches BACKLOG.md titles for fuzzy substring matches.
 * @param {string} backlogPath
 * @param {string} query
 * @param {string} requirementsDir
 * @returns {object[]}
 */
function searchBacklogTitles(backlogPath, query, requirementsDir) {
    if (!fs.existsSync(backlogPath)) return [];

    const content = fs.readFileSync(backlogPath, 'utf8');
    const lines = content.split('\n');
    const matches = [];
    const queryLower = query.toLowerCase();

    for (const line of lines) {
        const parsed = parseBacklogLine(line);
        if (parsed && parsed.description.toLowerCase().includes(queryLower)) {
            const dir = findDirForDescription(requirementsDir, parsed.description);
            matches.push({
                slug: dir ? path.basename(dir) : parsed.description.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
                dir: dir || null,
                meta: dir ? readMetaJson(dir) : null,
                backlogLine: line,
                itemNumber: parsed.itemNumber,
                title: parsed.description
            });
        }
    }

    return matches;
}

/**
 * Tries to find a requirements directory matching a description.
 * @param {string} requirementsDir
 * @param {string} description
 * @returns {string|null}
 */
function findDirForDescription(requirementsDir, description) {
    if (!fs.existsSync(requirementsDir)) return null;

    const descSlug = description.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    try {
        const dirs = fs.readdirSync(requirementsDir, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => d.name);

        // Exact match
        if (dirs.includes(descSlug)) {
            return path.join(requirementsDir, descSlug);
        }

        // Suffix match
        for (const dir of dirs) {
            if (dir.endsWith('-' + descSlug) || dir.includes(descSlug)) {
                return path.join(requirementsDir, dir);
            }
        }
    } catch (e) {
        // silent
    }

    return null;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
    // Constants
    ANALYSIS_PHASES,
    IMPLEMENTATION_PHASES,      // REQ-0026: Build auto-detection
    MARKER_REGEX,

    // Core utilities
    generateSlug,
    detectSource,
    deriveAnalysisStatus,
    deriveBacklogMarker,
    readMetaJson,
    writeMetaJson,
    parseBacklogLine,
    updateBacklogMarker,
    appendToBacklog,
    resolveItem,

    // Build auto-detection utilities (REQ-0026)
    validatePhasesCompleted,
    computeStartPhase,
    checkStaleness,

    // Internal helpers (exported for testing)
    findBacklogItemByNumber,
    findByExternalRef,
    searchBacklogTitles,
    findDirForDescription
};
