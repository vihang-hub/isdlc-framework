# Module Design: Unified SessionStart Cache

**REQ-0001** | Phase 04 - Design | 2026-02-23

---

## 1. Scope

This document specifies code-level changes for 9 functional requirements across 7 core source files (2 new, 5 modified) plus trigger integration points. The changes introduce a session-wide cache for static framework content, a SessionStart hook to inject it into the LLM context, consumer changes to reference cached content with fail-open fallback, and manifest cleanup.

**Implementation order**: FR-001 -> FR-004 -> FR-002 + FR-003 -> FR-008 (getAgentSkillIndex refactor) -> FR-005 -> FR-006 -> FR-007 -> FR-009 -> FR-008 (manifest removal)

---

## 2. Module: common.cjs -- rebuildSessionCache() (FR-001)

**File**: `src/claude/hooks/lib/common.cjs`
**Change type**: ADD function (~200 lines)
**Traces to**: FR-001 (AC-001-01 through AC-001-05), NFR-004, NFR-006, NFR-007, NFR-009

### 2.1 New Module-Level Variables

Add after the existing `_configCache` declaration (near line 38), within the Per-Process Caching section:

```javascript
/**
 * Cached skill path index. Key: skillID (e.g., "DEV-001").
 * Value: relative path to SKILL.md (e.g., "src/claude/skills/development/code-implementation/SKILL.md").
 * Built by _buildSkillPathIndex(). Per-process lifetime.
 * @type {Map<string, string>|null}
 */
let _skillPathIndex = null;

/**
 * Timestamp (ms since epoch) when _skillPathIndex was last built.
 * Used for mtime-based invalidation against the skills directory.
 * @type {number}
 */
let _skillPathIndexBuiltAt = 0;
```

Update `_resetCaches()` (line 170) to also clear the new cache:

```javascript
function _resetCaches() {
    _cachedProjectRoot = null;
    _cachedProjectDirEnv = undefined;
    _configCache.clear();
    _skillPathIndex = null;
    _skillPathIndexBuiltAt = 0;
}
```

### 2.2 New Function: _buildSkillPathIndex() (private)

**Location**: Add before `getAgentSkillIndex()` (before line 1262).

**Purpose**: Scan the skills directory tree, extract `skill_id` from each SKILL.md frontmatter, and build a `Map<skillID, relativePath>` index. Cached per-process with mtime-based invalidation.

```javascript
/**
 * Build a skill path index: skillID -> relative path to SKILL.md.
 * Scans src/claude/skills/ (dev mode) and .claude/skills/ (installed mode)
 * for all SKILL.md files, extracting skill_id from YAML frontmatter.
 *
 * Per-process cached with invalidation based on skills directory mtime.
 * Falls back to empty Map on any error (fail-open).
 *
 * @returns {Map<string, string>} Map of skillID -> relativePath
 * @private
 * Traces to: ADR-0028
 */
function _buildSkillPathIndex() {
    const projectRoot = getProjectRoot();

    // Check if cached index is still valid (mtime-based invalidation)
    if (_skillPathIndex !== null) {
        try {
            // Check mtime of both skill directories
            const devDir = path.join(projectRoot, 'src', 'claude', 'skills');
            const installedDir = path.join(projectRoot, '.claude', 'skills');
            let latestMtime = 0;
            if (fs.existsSync(devDir)) {
                latestMtime = Math.max(latestMtime, fs.statSync(devDir).mtimeMs);
            }
            if (fs.existsSync(installedDir)) {
                latestMtime = Math.max(latestMtime, fs.statSync(installedDir).mtimeMs);
            }
            if (latestMtime <= _skillPathIndexBuiltAt) {
                return _skillPathIndex;
            }
        } catch (_) {
            // Invalidation check failed -- rebuild
        }
    }

    const index = new Map();

    // Scan function: recursively find SKILL.md files in a base directory
    function scanDir(baseDir, relativeBase) {
        if (!fs.existsSync(baseDir)) return;
        try {
            const entries = fs.readdirSync(baseDir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(baseDir, entry.name);
                if (entry.isDirectory()) {
                    // Skip hidden directories and node_modules
                    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
                    scanDir(fullPath, path.join(relativeBase, entry.name));
                } else if (entry.name === 'SKILL.md') {
                    try {
                        const content = fs.readFileSync(fullPath, 'utf8');
                        const skillIdMatch = content.match(/^skill_id:\s*(.+)$/m);
                        if (skillIdMatch) {
                            const skillId = skillIdMatch[1].trim();
                            const relativePath = path.join(relativeBase, 'SKILL.md');
                            // First found wins (dev mode takes precedence if both exist)
                            if (!index.has(skillId)) {
                                index.set(skillId, relativePath);
                            }
                        }
                    } catch (_) {
                        // Skip unreadable files
                    }
                }
            }
        } catch (_) {
            // Skip unreadable directories
        }
    }

    // Scan dev directory first (takes precedence in dogfooding mode)
    scanDir(
        path.join(projectRoot, 'src', 'claude', 'skills'),
        path.join('src', 'claude', 'skills')
    );
    // Then scan installed directory
    scanDir(
        path.join(projectRoot, '.claude', 'skills'),
        path.join('.claude', 'skills')
    );

    _skillPathIndex = index;
    _skillPathIndexBuiltAt = Date.now();
    return index;
}
```

**Complexity**: O(N) where N = number of files in skills directory (~242 SKILL.md files). Expected ~50-100ms on SSD. Cached after first call.

### 2.3 New Function: _collectSourceMtimes() (private)

**Location**: Add before `rebuildSessionCache()`.

**Purpose**: Collect mtimes from all source files used to build the cache. Returns an array of `{ path, mtimeMs }` objects and a hash string.

```javascript
/**
 * Collect mtimes of all source files for cache staleness detection.
 * Returns sorted array and a hash computed from mtime concatenation.
 *
 * @param {string} projectRoot - Project root directory
 * @returns {{ sources: Array<{path: string, mtimeMs: number}>, hash: string, count: number }}
 * @private
 * Traces to: NFR-006 (staleness detection)
 */
function _collectSourceMtimes(projectRoot) {
    const sources = [];

    // Helper: stat a file, skip if missing
    function addSource(filePath) {
        try {
            const stat = fs.statSync(filePath);
            sources.push({ path: filePath, mtimeMs: stat.mtimeMs });
        } catch (_) {
            // File missing -- skip
        }
    }

    // Config files
    const configFiles = [
        path.join(projectRoot, 'docs', 'isdlc', 'constitution.md'),
        path.join(projectRoot, 'src', 'isdlc', 'config', 'workflows.json'),
        path.join(projectRoot, 'src', 'claude', 'hooks', 'config', 'skills-manifest.json'),
        path.join(projectRoot, 'docs', 'isdlc', 'external-skills-manifest.json')
    ];

    // Resolve iteration-requirements.json and artifact-paths.json
    // These are in .claude/hooks/config/ (installed) or src/claude/hooks/config/ (dev)
    const hookConfigPaths = [
        path.join(projectRoot, '.claude', 'hooks', 'config', 'iteration-requirements.json'),
        path.join(projectRoot, '.claude', 'hooks', 'config', 'artifact-paths.json')
    ];

    for (const f of [...configFiles, ...hookConfigPaths]) {
        addSource(f);
    }

    // Skill files: use the skill path index to enumerate
    const skillIndex = _buildSkillPathIndex();
    for (const [, relPath] of skillIndex) {
        addSource(path.join(projectRoot, relPath));
    }

    // Persona files
    const personaDir = path.join(projectRoot, 'src', 'claude', 'agents');
    if (fs.existsSync(personaDir)) {
        try {
            const files = fs.readdirSync(personaDir);
            for (const f of files) {
                if (f.startsWith('persona-') && f.endsWith('.md')) {
                    addSource(path.join(personaDir, f));
                }
            }
        } catch (_) {}
    }

    // Topic files
    const topicDir = path.join(projectRoot, 'src', 'claude', 'skills', 'analysis-topics');
    if (fs.existsSync(topicDir)) {
        try {
            const categories = fs.readdirSync(topicDir, { withFileTypes: true });
            for (const cat of categories) {
                if (cat.isDirectory()) {
                    const catPath = path.join(topicDir, cat.name);
                    const topicFiles = fs.readdirSync(catPath);
                    for (const f of topicFiles) {
                        if (f.endsWith('.md')) {
                            addSource(path.join(catPath, f));
                        }
                    }
                }
            }
        } catch (_) {}
    }

    // Sort by path for deterministic hash
    sources.sort((a, b) => a.path.localeCompare(b.path));

    // Compute hash: simple numeric hash from concatenated mtimes
    let hashNum = 0;
    for (const s of sources) {
        // Use a simple rolling hash (good enough for staleness detection)
        hashNum = ((hashNum << 5) - hashNum + Math.round(s.mtimeMs)) | 0;
    }
    const hash = Math.abs(hashNum).toString(16).padStart(8, '0');

    return { sources, hash, count: sources.length };
}
```

### 2.4 New Function: rebuildSessionCache() (exported)

**Location**: Add near end of common.cjs, before the `module.exports` block (before line 3840).

**Purpose**: Core cache builder. Reads all static source files, assembles them into `.isdlc/session-cache.md` with section delimiters.

**Signature**:

```javascript
/**
 * Rebuild the session cache file (.isdlc/session-cache.md).
 * Reads all static framework content and assembles it into a single
 * delimited Markdown file for SessionStart hook injection.
 *
 * Each section is wrapped in HTML comment delimiters:
 *   <!-- SECTION: NAME -->
 *   {content}
 *   <!-- /SECTION: NAME -->
 *
 * Fail-open per section: if a source file is missing, the section is
 * skipped with a <!-- SECTION: NAME SKIPPED: reason --> marker.
 *
 * @param {object} [options] - Optional configuration
 * @param {string} [options.projectRoot] - Override project root (for testing)
 * @param {boolean} [options.verbose] - Log progress to stderr
 * @returns {{ path: string, size: number, hash: string, sections: string[], skipped: string[] }}
 * @throws {Error} Only if .isdlc/ directory does not exist (no project)
 *
 * Traces to: FR-001 (AC-001-01 through AC-001-05), NFR-004, NFR-006, NFR-007, NFR-009
 */
function rebuildSessionCache(options = {}) {
```

**Algorithm** (step-by-step):

1. **Resolve project root**: `options.projectRoot || getProjectRoot()`
2. **Validate .isdlc/ exists**: `fs.existsSync(path.join(root, '.isdlc'))` -- throw if not
3. **Collect source mtimes**: Call `_collectSourceMtimes(root)` for hash and count
4. **Build sections array**: For each section, try-catch independently

   **Section order** (matches cache file format from architecture overview):

   | # | Section Name | Source | Content Strategy |
   |---|-------------|--------|------------------|
   | 1 | CONSTITUTION | `docs/isdlc/constitution.md` | Raw file content |
   | 2 | WORKFLOW_CONFIG | `src/isdlc/config/workflows.json` | Raw file content |
   | 3 | ITERATION_REQUIREMENTS | `.claude/hooks/config/iteration-requirements.json` | Raw file content |
   | 4 | ARTIFACT_PATHS | `.claude/hooks/config/artifact-paths.json` | Raw file content |
   | 5 | SKILLS_MANIFEST | `src/claude/hooks/config/skills-manifest.json` | Filtered: exclude `path_lookup` and `skill_paths` keys from JSON before including |
   | 6 | SKILL_INDEX | Per-agent skill blocks | Pre-built via `getAgentSkillIndex()` + `formatSkillIndexBlock()` for each agent in manifest.ownership |
   | 7 | EXTERNAL_SKILLS | `docs/isdlc/external-skills-manifest.json` + skill files | Formatted external skill blocks (all-phase and phase-specific) |
   | 8 | ROUNDTABLE_CONTEXT | Persona + topic files | Raw file content with `### Persona: {name}` and `### Topic: {id}` sub-headings |

5. **Assemble output**:

   ```
   <!-- SESSION CACHE: Generated {ISO-8601} | Sources: {count} | Hash: {hash} -->
   \n
   {section 1}
   \n
   {section 2}
   ...
   ```

6. **Validate size**: If `output.length > 128000`, emit warning to stderr: `WARNING: Session cache exceeds 128K character budget ({size} chars)`
7. **Write file**: `fs.writeFileSync(path.join(root, '.isdlc', 'session-cache.md'), output, 'utf8')`
8. **Return metadata**: `{ path, size: output.length, hash, sections: [...included], skipped: [...skipped] }`

**Section building pseudocode** (for each section):

```javascript
function buildSection(name, contentFn) {
    try {
        const content = contentFn();
        if (!content || content.trim().length === 0) {
            return `<!-- SECTION: ${name} SKIPPED: empty content -->`;
        }
        return `<!-- SECTION: ${name} -->\n${content}\n<!-- /SECTION: ${name} -->`;
    } catch (err) {
        return `<!-- SECTION: ${name} SKIPPED: ${err.message} -->`;
    }
}
```

**SKILL_INDEX section detail**:

```javascript
// For section 6 (SKILL_INDEX):
function buildSkillIndexContent() {
    const manifest = loadManifest();
    if (!manifest || !manifest.ownership) return '';

    const blocks = [];
    for (const [agentName, agentEntry] of Object.entries(manifest.ownership)) {
        if (!agentEntry.skills || agentEntry.skills.length === 0) continue;
        const skillIndex = getAgentSkillIndex(agentName);
        if (skillIndex.length === 0) continue;
        const block = formatSkillIndexBlock(skillIndex);
        if (block) {
            blocks.push(`## Agent: ${agentName}\n${block}`);
        }
    }
    return blocks.join('\n\n');
}
```

**SKILLS_MANIFEST section detail** (filtered):

```javascript
// For section 5 (SKILLS_MANIFEST):
function buildFilteredManifest() {
    const manifestPath = getManifestPath();
    const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    // Remove large lookup tables that will be replaced by skill path index
    delete raw.path_lookup;
    delete raw.skill_paths;
    return JSON.stringify(raw, null, 2);
}
```

**EXTERNAL_SKILLS section detail**:

```javascript
// For section 7 (EXTERNAL_SKILLS):
function buildExternalSkillsContent() {
    const extManifest = loadExternalManifest();
    if (!extManifest || !extManifest.skills || extManifest.skills.length === 0) {
        return '';
    }
    const projectRoot = getProjectRoot();
    const blocks = [];
    for (const skill of extManifest.skills) {
        // Include skill metadata
        const meta = `### External Skill: ${skill.name || skill.file}`;
        const bindingInfo = skill.bindings
            ? `Phases: ${(skill.bindings.phases || []).join(', ') || 'all'}\nAgents: ${(skill.bindings.agents || []).join(', ') || 'all'}\nInjection: ${skill.bindings.injection_mode || 'manual'}\nDelivery: ${skill.bindings.delivery_type || 'reference'}`
            : 'Bindings: none';
        const source = skill.source || 'unknown';

        // Read skill file content if it exists
        let content = '';
        const skillDir = path.join(projectRoot, '.claude', 'skills', 'external');
        if (skill.file) {
            try {
                content = fs.readFileSync(
                    path.join(skillDir, skill.file), 'utf8'
                );
                // Truncate large files to save context budget
                if (content.length > 5000) {
                    content = content.substring(0, 5000) + '\n[... truncated for context budget ...]';
                }
            } catch (_) {
                content = '(file not readable)';
            }
        }

        blocks.push(`${meta}\nSource: ${source}\n${bindingInfo}\n\n${content}`);
    }
    return blocks.join('\n\n---\n\n');
}
```

**ROUNDTABLE_CONTEXT section detail**:

```javascript
// For section 8 (ROUNDTABLE_CONTEXT):
function buildRoundtableContext() {
    const projectRoot = getProjectRoot();
    const parts = [];

    // Persona files
    const personaDir = path.join(projectRoot, 'src', 'claude', 'agents');
    const personaFiles = ['persona-business-analyst.md', 'persona-solutions-architect.md', 'persona-system-designer.md'];
    for (const pf of personaFiles) {
        try {
            const content = fs.readFileSync(path.join(personaDir, pf), 'utf8');
            const name = pf.replace('persona-', '').replace('.md', '')
                .split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            parts.push(`### Persona: ${name}\n${content}`);
        } catch (_) {
            // Skip missing persona files
        }
    }

    // Topic files
    const topicDir = path.join(projectRoot, 'src', 'claude', 'skills', 'analysis-topics');
    if (fs.existsSync(topicDir)) {
        try {
            const categories = fs.readdirSync(topicDir, { withFileTypes: true });
            for (const cat of categories) {
                if (!cat.isDirectory()) continue;
                const catPath = path.join(topicDir, cat.name);
                const topicFiles = fs.readdirSync(catPath).filter(f => f.endsWith('.md')).sort();
                for (const tf of topicFiles) {
                    try {
                        const content = fs.readFileSync(path.join(catPath, tf), 'utf8');
                        const topicId = tf.replace('.md', '');
                        parts.push(`### Topic: ${topicId}\n${content}`);
                    } catch (_) {}
                }
            }
        } catch (_) {}
    }

    return parts.join('\n\n');
}
```

### 2.5 Export Addition

Add to `module.exports` (before the closing brace, approximately line 3901):

```javascript
    // Session cache (REQ-0001)
    rebuildSessionCache,
```

Add to the test-only exports (line 3905):

```javascript
if (process.env.NODE_ENV === 'test' || process.env.ISDLC_TEST_MODE === '1') {
    module.exports._resetCaches = _resetCaches;
    module.exports._getCacheStats = _getCacheStats;
    module.exports._loadConfigWithCache = _loadConfigWithCache;
    module.exports._buildSkillPathIndex = _buildSkillPathIndex;
    module.exports._collectSourceMtimes = _collectSourceMtimes;
}
```

### 2.6 Error Handling Pattern

Every section builder is independently try-caught. The overall function only throws if `.isdlc/` does not exist (indicating no project). All other errors result in skipped sections with explanatory markers in the cache file.

```
Error hierarchy:
  rebuildSessionCache()
    ├── .isdlc/ missing → throw Error("No .isdlc/ directory at {root}")
    ├── Section build failure → skip section, add SKIPPED marker
    ├── Size budget exceeded → stderr warning, still write file
    └── Write failure → throw (caller handles)
```

---

## 3. Module: common.cjs -- getAgentSkillIndex() Refactor (FR-008 prerequisite)

**File**: `src/claude/hooks/lib/common.cjs`
**Change type**: MODIFY function (lines 1262-1421)
**Traces to**: FR-008 (AC-008-01 through AC-008-03), ADR-0028

### 3.1 Current Behavior (path_lookup dependent)

The v5+ production schema branch (line 1289-1372) currently:

1. Reads `manifest.path_lookup` (246 entries: `category/skill-name` -> `agent-name`)
2. Iterates ALL entries to find paths owned by the queried agent
3. For each owned path, reads SKILL.md and extracts `skill_id` from frontmatter
4. Matches extracted skill IDs against the agent's skill ID list

This is O(P * R) where P = total path_lookup entries (246) and R = file reads per agent.

### 3.2 New Behavior (skill path index)

Replace path_lookup iteration with direct `_buildSkillPathIndex()` lookups:

```javascript
if (isStringSchema) {
    // Production schema: skills are flat string IDs like "DEV-001"
    // Use skill path index for direct ID-to-path resolution (ADR-0028)
    const skillPathIdx = _buildSkillPathIndex();

    for (const skillId of agentEntry.skills) {
        try {
            const relativePath = skillPathIdx.get(skillId);
            if (!relativePath) {
                // Skill ID not in index -- skip (fail-open)
                continue;
            }

            const absPath = path.join(projectRoot, relativePath);
            if (!fs.existsSync(absPath)) {
                continue;
            }

            const content = fs.readFileSync(absPath, 'utf8');

            // Extract name from the path (parent directory name)
            const pathParts = relativePath.split(path.sep);
            const skillName = pathParts[pathParts.length - 2] || skillId;

            // Extract description
            let description = _extractSkillDescription(content);
            if (!description) {
                description = skillName;
            }

            result.push({
                id: skillId,
                name: skillName,
                description: description,
                path: relativePath
            });
        } catch (_skillErr) {
            // Fail-open: skip individual skill on any error
            continue;
        }
    }
}
```

### 3.3 Behavioral Equivalence

The output format is identical: `Array<{ id, name, description, path }>`. The only behavioral difference is:

| Aspect | Before (path_lookup) | After (skill path index) |
|--------|---------------------|--------------------------|
| Path resolution | Iterate all path_lookup entries | Direct Map.get() per skill ID |
| Path format | `category/skill-name` (needs prefix) | Full relative path (e.g., `src/claude/skills/.../SKILL.md`) |
| First-call cost | Negligible (manifest already loaded) | ~50-100ms directory scan (cached afterward) |
| Subsequent calls | Same (manifest cached) | Near-zero (index cached) |
| Missing skill handling | Skipped silently | Skipped silently (identical) |
| Dual-path resolution | Explicit .claude/ then src/claude/ check | Built into index scan order (src/ first, then .claude/) |

### 3.4 Legacy Schema Branch

The legacy schema branch (lines 1373-1413) remains unchanged. It does not use `path_lookup` -- it reads paths directly from the skill objects.

### 3.5 Migration Safety

**CRITICAL**: The following sequence must be followed:

1. Write behavioral tests for `getAgentSkillIndex()` that capture current input/output pairs for at least 5 agents (sdlc-orchestrator, software-developer, requirements-analyst, qa-engineer, test-design-engineer)
2. Implement `_buildSkillPathIndex()` and wire it into `getAgentSkillIndex()`
3. Run behavioral tests -- all must pass
4. Only then proceed to remove `path_lookup` from skills-manifest.json (FR-008)

---

## 4. Module: inject-session-cache.cjs (FR-002)

**File**: `src/claude/hooks/inject-session-cache.cjs` (NEW)
**Traces to**: FR-002 (AC-002-01 through AC-002-05), ADR-0027, NFR-003, NFR-005, NFR-008

### 4.1 Complete Implementation

```javascript
/**
 * SessionStart Hook: inject-session-cache.cjs
 *
 * Reads the pre-built session cache file and outputs its content to stdout,
 * where Claude Code injects it into the LLM context window.
 *
 * Self-contained: NO dependency on common.cjs (ADR-0027).
 * Fail-open: Any error results in no output and exit code 0.
 *
 * Traces to: FR-002, AC-002-01 through AC-002-05, NFR-003, NFR-008
 */
'use strict';

const fs = require('fs');
const path = require('path');

try {
    const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const cachePath = path.join(projectDir, '.isdlc', 'session-cache.md');
    const content = fs.readFileSync(cachePath, 'utf8');
    process.stdout.write(content);
} catch (_) {
    // Fail-open: no output, no error, exit 0
    // Covers: file not found, permissions error, read error
}
```

### 4.2 Design Constraints

| Constraint | Implementation |
|-----------|---------------|
| Self-contained (ADR-0027) | No `require('./lib/common.cjs')` -- only `fs` and `path` |
| CommonJS (NFR-008) | `.cjs` extension, `require()` syntax |
| Fail-open (NFR-005) | Entire body in try-catch, catch does nothing |
| No staleness check | Outputs whatever is in the file; consumers check hash |
| Performance (NFR-003) | Single `readFileSync` + `stdout.write` -- expected <100ms |
| Matcher (CON-004) | Registered with startup/resume matchers, NOT compact |

### 4.3 File Size

Estimated: ~25 lines (including JSDoc header and blank lines).

---

## 5. Module: settings.json -- Hook Registration (FR-003)

**File**: `src/claude/settings.json`
**Change type**: ADD section
**Traces to**: FR-003 (AC-003-01 through AC-003-03)

### 5.1 Change Description

Add a `"SessionStart"` key to the `"hooks"` object. The new key sits at the same level as `"PreToolUse"`, `"PostToolUse"`, and `"Stop"`.

### 5.2 New Content

Insert after the `"Stop"` section (after line 304, before the closing `}` of `"hooks"`):

```json
    "SessionStart": [
      {
        "matcher": {
          "type": "event",
          "event": "startup"
        },
        "hooks": [
          {
            "type": "command",
            "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/inject-session-cache.cjs",
            "timeout": 5000
          }
        ]
      },
      {
        "matcher": {
          "type": "event",
          "event": "resume"
        },
        "hooks": [
          {
            "type": "command",
            "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/inject-session-cache.cjs",
            "timeout": 5000
          }
        ]
      }
    ]
```

### 5.3 Design Decisions

| Decision | Rationale |
|----------|-----------|
| Two separate matcher entries (startup + resume) | Avoids compact matcher bug #15174 (CON-004) |
| 5000ms timeout | Generous for single file read (~128KB); hook should complete in <100ms |
| `$CLAUDE_PROJECT_DIR` path | Standard hook path pattern consistent with all other hooks |
| Placed after Stop section | Logical grouping: lifecycle hooks at end |

### 5.4 Sync Requirement

After modifying `src/claude/settings.json`, run rsync to sync to `.claude/settings.json` for runtime activation. This is existing operational procedure documented in MEMORY.md.

---

## 6. Module: bin/rebuild-cache.js (FR-004)

**File**: `bin/rebuild-cache.js` (NEW)
**Traces to**: FR-004 (AC-004-01 through AC-004-03), ADR-0030

### 6.1 Complete Implementation

```javascript
#!/usr/bin/env node

/**
 * CLI: rebuild-cache.js
 *
 * Manual cache rebuild escape hatch. Calls rebuildSessionCache() from
 * common.cjs and reports results to stdout.
 *
 * ESM/CJS boundary handled via createRequire() (ADR-0030).
 *
 * Usage: node bin/rebuild-cache.js [--verbose]
 *
 * Traces to: FR-004, AC-004-01 through AC-004-03
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load common.cjs via createRequire bridge
const common = require(path.join(__dirname, '..', 'src', 'claude', 'hooks', 'lib', 'common.cjs'));
const { rebuildSessionCache } = common;

// Parse flags
const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');

try {
    const result = rebuildSessionCache({ verbose });
    console.log(`Session cache rebuilt successfully.`);
    console.log(`  Path: ${result.path}`);
    console.log(`  Size: ${result.size} characters`);
    console.log(`  Hash: ${result.hash}`);
    console.log(`  Sections: ${result.sections.join(', ')}`);
    if (result.skipped.length > 0) {
        console.log(`  Skipped: ${result.skipped.join(', ')}`);
    }
    process.exit(0);
} catch (err) {
    console.error(`Failed to rebuild session cache: ${err.message}`);
    process.exit(1);
}
```

### 6.2 Design Constraints

| Constraint | Implementation |
|-----------|---------------|
| ESM/CJS boundary (ADR-0030) | `createRequire(import.meta.url)` to load common.cjs |
| Error reporting | Success: stdout (path, size, hash, sections). Failure: stderr + exit 1 |
| No active workflow dependency | Can be run at any time, independent of workflow state |
| Verbose mode | `--verbose` flag passed through to `rebuildSessionCache({ verbose: true })` |

### 6.3 File Size

Estimated: ~40 lines.

---

## 7. Module: isdlc.md -- Phase-Loop Controller Consumer Changes (FR-005)

**File**: `src/claude/commands/isdlc.md`
**Change type**: MODIFY (STEP 3d delegation prompt + skill injection)
**Traces to**: FR-005 (AC-005-01 through AC-005-06), NFR-001, NFR-005, NFR-010

### 7.1 Overview of Changes

The phase-loop controller currently reads several files at every phase delegation. With the session cache loaded into the LLM context at session start, the controller should check session context first and fall back to disk reads only when the cache section is absent.

The changes affect:
1. **SKILL INJECTION STEP A** (lines 1554-1560): Replace Bash-based `getAgentSkillIndex()` call with session context lookup
2. **SKILL INJECTION STEP B** (lines 1562-1585): Replace external manifest Read call with session context lookup
3. **GATE REQUIREMENTS INJECTION** (lines 1766-1789): Replace `iteration-requirements.json` and `artifact-paths.json` Read calls with session context lookup
4. **Constitution read** (line 1774): Replace disk read with session context lookup

### 7.2 SKILL INJECTION STEP A -- Session Context Lookup

**Current** (lines 1554-1560):

```
SKILL INJECTION STEP A -- Built-In Skill Index:
1. Run this single-line Bash command: node -e "const c = require(...)..."
2. If succeeds: save as {built_in_skills_block}
3. If fails: set to empty
```

**New** (replace entirely):

```
SKILL INJECTION STEP A -- Built-In Skill Index:
1. Check if session context contains <!-- SECTION: SKILL_INDEX -->.
   If found:
     a. Extract the block for the current agent by searching for "## Agent: {agent_name}"
        within the SKILL_INDEX section.
     b. Extract from "## Agent: {agent_name}" up to the next "## Agent:" heading or the
        closing <!-- /SECTION: SKILL_INDEX --> delimiter.
     c. Save the extracted block as {built_in_skills_block}.
   If not found (cache absent or section missing):
     a. FALLBACK: Run this single-line Bash command (replace {agent_name} with the resolved
        agent name from the table above):
        node -e "const c = require('./src/claude/hooks/lib/common.cjs'); const r = c.getAgentSkillIndex('{agent_name}'); process.stdout.write(c.formatSkillIndexBlock(r));"
     b. If the Bash tool call succeeds and produces non-empty stdout: save the output as
        {built_in_skills_block}.
     c. If the Bash tool call fails or produces empty output: set {built_in_skills_block}
        to empty string.
2. Continue to Step B.
```

### 7.3 SKILL INJECTION STEP B -- Session Context Lookup

**Current** (lines 1562-1585): Reads external manifest from disk, filters, reads skill files.

**New** (replace step 1-2 with session context check, preserve steps 3-7):

```
SKILL INJECTION STEP B -- External Skills (fail-open -- if ANY step fails, set
{external_skills_blocks} to empty and skip to Step C):
1. Check if session context contains <!-- SECTION: EXTERNAL_SKILLS -->.
   If found AND the section contains skill entries matching the current {phase_key} or
   {agent_name}:
     a. Extract matching skill blocks from the EXTERNAL_SKILLS section.
     b. Format each block per the delivery_type rules (steps 5-7 below).
     c. Join as {external_skills_blocks}.
     d. SKIP to Step C.
   If not found (cache absent or section missing):
     a. FALLBACK: Continue with disk-based approach (existing steps 1-7 below).
2. [Existing step 1] Determine the external skills manifest path...
   [... rest of existing steps 2-7 unchanged ...]
```

### 7.4 GATE REQUIREMENTS INJECTION -- Session Context Lookup

**Current** (lines 1766-1789): Reads `iteration-requirements.json`, `artifact-paths.json`, and `constitution.md` from disk.

**New** (add session context check before each read):

For iteration-requirements.json (step 1):

```
1. Check if session context contains <!-- SECTION: ITERATION_REQUIREMENTS -->.
   If found: parse the JSON content from that section.
   If not found: Read src/claude/hooks/config/iteration-requirements.json using Read tool.
   If neither succeeds: SKIP injection entirely.
```

For artifact-paths.json (step 3):

```
3. Check if session context contains <!-- SECTION: ARTIFACT_PATHS -->.
   If found: parse the JSON content from that section.
   If not found: Read src/claude/hooks/config/artifact-paths.json using Read tool (optional).
```

For constitution.md (step 4):

```
4. If constitutional_validation is enabled for this phase:
   Check if session context contains <!-- SECTION: CONSTITUTION -->.
   If found: extract article titles from the cached constitution content.
   If not found: read docs/isdlc/constitution.md from disk.
```

### 7.5 Fail-Open Guarantee

Every session context check follows the pattern:

```
IF <!-- SECTION: {NAME} --> found in session context
  THEN use cached content
  ELSE fall back to disk read (identical to current behavior)
```

If the session cache was not loaded (first install, hook disabled, cache missing), the phase-loop controller behaves identically to its current implementation. This satisfies NFR-010 (backwards compatibility).

---

## 8. Module: isdlc.md -- Roundtable Consumer Changes (FR-006)

**File**: `src/claude/commands/isdlc.md`
**Change type**: MODIFY (analyze handler, steps 3a and 3b)
**Traces to**: FR-006 (AC-006-01 through AC-006-04), NFR-002, NFR-005, NFR-010

### 8.1 Overview of Changes

The analyze handler currently pre-reads persona and topic files from disk in Group 1 (step 3a) and step 3b. With the session cache, these reads can be skipped when the ROUNDTABLE_CONTEXT section is available in session context.

### 8.2 Persona Files -- Session Context Lookup

**Current** (line 653-656 in Group 1):

```
Read 3 persona files in parallel --> personaContent:
  - src/claude/agents/persona-business-analyst.md
  - src/claude/agents/persona-solutions-architect.md
  - src/claude/agents/persona-system-designer.md
```

**New**:

```
Check if session context contains <!-- SECTION: ROUNDTABLE_CONTEXT -->.
If found:
  Extract persona content from the section:
    - Search for "### Persona: Business Analyst" and extract content until next "###" heading
    - Search for "### Persona: Solutions Architect" and extract content until next "###" heading
    - Search for "### Persona: System Designer" and extract content until next "###" heading
  Set personaContent variables from extracted content.
If not found:
  FALLBACK: Read 3 persona files in parallel from disk (existing behavior):
    - src/claude/agents/persona-business-analyst.md
    - src/claude/agents/persona-solutions-architect.md
    - src/claude/agents/persona-system-designer.md
```

### 8.3 Topic Files -- Session Context Lookup

**Current** (line 657 + Group 2 line 662):

```
Glob src/claude/skills/analysis-topics/**/*.md --> topicPaths
[Group 2] Read all topic files from topicPaths in parallel --> topicContent
```

**New**:

```
Check if session context contains <!-- SECTION: ROUNDTABLE_CONTEXT -->.
If found:
  Extract topic content from the section:
    - Search for each "### Topic: {topic_id}" heading and extract content until next "###" heading
  Set topicContent from extracted content.
  SKIP the Glob and file reads in Group 2 for topics.
If not found:
  FALLBACK: Glob src/claude/skills/analysis-topics/**/*.md --> topicPaths
  [Group 2] Read all topic files from topicPaths in parallel --> topicContent
```

### 8.4 Non-External-Ref Path (step 3b)

Apply the same session context check pattern to the standard resolution path (lines 675-677) which also pre-reads persona and topic files.

### 8.5 Performance Impact

With session cache loaded:
- Eliminates 3 persona file Read calls per analyze invocation
- Eliminates 1 Glob + 6 topic file Read calls per analyze invocation
- Total: 10 fewer tool calls at roundtable cold-start
- Expected improvement: ~5 minutes -> <1 minute (SM-002)

---

## 9. Module: isdlc.md -- Trigger Integration (FR-007)

**File**: `src/claude/commands/isdlc.md`
**Change type**: MODIFY (skill management handlers, post-discover)
**Traces to**: FR-007 (AC-007-01 through AC-007-04)

### 9.1 Skill Management Triggers

After each skill mutation command (`/isdlc skill add`, `skill remove`, `skill wire`), add a cache rebuild instruction:

```
After the skill {add|remove|wire} operation completes successfully,
rebuild the session cache by running:
  node bin/rebuild-cache.js
If the rebuild fails, log a warning but do not fail the skill operation.
```

**Location**: Add after each skill management handler's success path in isdlc.md.

### 9.2 Post-Discover Trigger

**File**: `src/claude/commands/discover.md` (indirect modification via isdlc.md)
**Traces to**: FR-007 (AC-007-01)

Add to the discover completion handler:

```
After /discover completes successfully, rebuild the session cache by running:
  node bin/rebuild-cache.js
If the rebuild fails, log a warning but do not fail the discovery.
```

---

## 10. Module: installer.js -- Cache Rebuild Trigger (FR-007)

**File**: `lib/installer.js`
**Change type**: MODIFY (~10 lines)
**Traces to**: FR-007 (AC-007-05, AC-007-06)

### 10.1 Change Location

Add after the `state.json` initialization step (after the "Setup complete" log message, approximately line 790) and before the "Getting Started" output.

### 10.2 Implementation

```javascript
// Rebuild session cache (REQ-0001, FR-007)
try {
    const commonPath = path.join(projectRoot, 'src', 'claude', 'hooks', 'lib', 'common.cjs');
    if (fs.existsSync(commonPath)) {
        const { createRequire: cr } = await import('module');
        const req = cr(import.meta.url);
        const common = req(commonPath);
        if (typeof common.rebuildSessionCache === 'function') {
            const result = common.rebuildSessionCache({ projectRoot });
            logger.log(`Session cache built (${result.size} chars, ${result.sections.length} sections)`);
        }
    }
} catch (cacheErr) {
    // Fail-open: cache rebuild failure does not block installation
    logger.warning(`Session cache rebuild skipped: ${cacheErr.message}`);
}
```

### 10.3 ESM/CJS Boundary

`installer.js` is ESM. Uses `await import('module')` to get `createRequire`, then `createRequire(import.meta.url)` to load common.cjs. This is the same pattern as `bin/rebuild-cache.js` (ADR-0030).

### 10.4 updater.js Integration

**File**: `lib/updater.js`
**Change type**: MODIFY (~10 lines, same pattern as installer.js)
**Traces to**: FR-007 (AC-007-06)

Add the same cache rebuild block after the update operation completes successfully.

---

## 11. Module: skills-manifest.json -- Manifest Cleanup (FR-008)

**File**: `src/claude/hooks/config/skills-manifest.json`
**Change type**: MODIFY (remove two keys)
**Traces to**: FR-008 (AC-008-01 through AC-008-03)

### 11.1 Fields to Remove

| Field | Lines | Size | Reason |
|-------|-------|------|--------|
| `path_lookup` | 819-1065 | ~246 entries, ~250 lines | Replaced by `_buildSkillPathIndex()` |
| `skill_paths` | 1066-1068 | 1 entry, 3 lines | Unused by any runtime code |

### 11.2 Prerequisites

**CRITICAL**: `path_lookup` removal MUST NOT happen until:
1. `_buildSkillPathIndex()` is implemented and tested
2. `getAgentSkillIndex()` is refactored to use the skill path index
3. Behavioral tests confirm identical output

### 11.3 Post-Removal Verification

After removal, verify these consumers still work:
- `skill-validator.cjs` -- does not reference `path_lookup` or `skill_paths` (confirmed)
- `log-skill-usage.cjs` -- does not reference `path_lookup` or `skill_paths` (confirmed)
- `getAgentSkillIndex()` -- refactored to use `_buildSkillPathIndex()` (prerequisite)
- `rebuildSessionCache()` -- uses `getAgentSkillIndex()`, not `path_lookup` directly (confirmed)

### 11.4 Size Impact

Removing `path_lookup` (~250 lines) and `skill_paths` (~3 lines) reduces `skills-manifest.json` from ~1069 lines to ~816 lines (24% reduction).

---

## 12. Module: External Manifest -- Source Field (FR-009)

**File**: `docs/isdlc/external-skills-manifest.json`
**Change type**: MODIFY (schema addition)
**Traces to**: FR-009 (AC-009-01 through AC-009-04)

### 12.1 Schema Change

Add a `source` field to each skill entry in the external skills manifest:

```json
{
  "skills": [
    {
      "name": "my-skill",
      "file": "my-skill.md",
      "source": "discover",
      "bindings": { ... }
    }
  ]
}
```

### 12.2 Source Values

| Value | Set By | Description |
|-------|--------|-------------|
| `"discover"` | `/discover` command | Skill discovered from project analysis |
| `"skills.sh"` | `skills.sh` import script | Skill imported via legacy mechanism |
| `"user"` | `/isdlc skill add` | Skill manually registered by user |
| `"unknown"` | Default (backward compat) | Existing entries without source field |

### 12.3 Backward Compatibility

`rebuildSessionCache()` treats missing `source` field as `"unknown"` and does not fail. No existing code depends on the `source` field -- it is purely metadata for maintainability.

### 12.4 Integration Points

The `source` field is set at registration time:
- In `isdlc.md` skill add handler: set `"source": "user"`
- In `discover.md` skill registration: set `"source": "discover"`

---

## 13. Data Flow Summary

### 13.1 Cache Build Flow

```
rebuildSessionCache(options?)
  ├── getProjectRoot() → resolve project root
  ├── Validate .isdlc/ directory exists
  ├── _collectSourceMtimes(root) → { sources[], hash, count }
  ├── Build CONSTITUTION section → readFileSync(constitution.md)
  ├── Build WORKFLOW_CONFIG section → readFileSync(workflows.json)
  ├── Build ITERATION_REQUIREMENTS section → readFileSync(iteration-requirements.json)
  ├── Build ARTIFACT_PATHS section → readFileSync(artifact-paths.json)
  ├── Build SKILLS_MANIFEST section → readFileSync(skills-manifest.json), strip path_lookup/skill_paths
  ├── Build SKILL_INDEX section → for each agent: getAgentSkillIndex() + formatSkillIndexBlock()
  ├── Build EXTERNAL_SKILLS section → loadExternalManifest() + read skill files
  ├── Build ROUNDTABLE_CONTEXT section → read persona + topic files
  ├── Assemble header + all sections
  ├── Validate size <= 128K chars (warn if exceeded)
  └── writeFileSync(.isdlc/session-cache.md) → return metadata
```

### 13.2 Cache Consumption Flow

```
Session startup/resume
  └── inject-session-cache.cjs → readFileSync → stdout → LLM context

Phase delegation (STEP 3d)
  ├── Check session context for SKILL_INDEX section → extract agent block
  │   └── Fallback: node -e "...getAgentSkillIndex()..."
  ├── Check session context for EXTERNAL_SKILLS section → filter/format
  │   └── Fallback: read external manifest + skill files from disk
  ├── Check session context for ITERATION_REQUIREMENTS → parse JSON
  │   └── Fallback: read iteration-requirements.json from disk
  ├── Check session context for ARTIFACT_PATHS → parse JSON
  │   └── Fallback: read artifact-paths.json from disk
  └── Check session context for CONSTITUTION → extract article titles
      └── Fallback: read constitution.md from disk

Roundtable dispatch (analyze handler)
  ├── Check session context for ROUNDTABLE_CONTEXT → extract personas + topics
  │   └── Fallback: read 3 persona files + glob/read topic files from disk
  └── Dispatch to roundtable-analyst with PERSONA_CONTEXT + TOPIC_CONTEXT
```

---

## 14. Cache File Format Specification

### 14.1 Header

```
<!-- SESSION CACHE: Generated {ISO-8601} | Sources: {count} | Hash: {hex8} -->
```

Regex for parsing: `<!-- SESSION CACHE: Generated (.+) \| Sources: (\d+) \| Hash: ([0-9a-f]{8}) -->`

### 14.2 Section Delimiters (ADR-0029)

Opening: `<!-- SECTION: {NAME} -->`
Closing: `<!-- /SECTION: {NAME} -->`
Skipped: `<!-- SECTION: {NAME} SKIPPED: {reason} -->`

### 14.3 Section Names (UPPER_SNAKE_CASE)

| Name | Content Type | Approximate Size |
|------|-------------|------------------|
| `CONSTITUTION` | Markdown prose | ~15 KB |
| `WORKFLOW_CONFIG` | JSON | ~11 KB |
| `ITERATION_REQUIREMENTS` | JSON | ~18 KB |
| `ARTIFACT_PATHS` | JSON | ~800 B |
| `SKILLS_MANIFEST` | JSON (filtered) | ~20 KB (after removing path_lookup) |
| `SKILL_INDEX` | Formatted text blocks | ~25-30 KB |
| `EXTERNAL_SKILLS` | Formatted text blocks | Variable (0-10 KB typical) |
| `ROUNDTABLE_CONTEXT` | Markdown prose | ~47 KB (3 personas + 6 topics) |

**Estimated total**: ~142 KB -- slightly over the 128K char budget. Mitigation options (applied in order until under budget):
1. Truncate external skill file content to 3000 chars (saves ~5-10KB)
2. Omit SKILLS_MANIFEST section (consumers use SKILL_INDEX instead) -- saves ~20KB
3. Summarize topic files (first 2000 chars each) -- saves ~12KB

The builder applies these mitigations automatically if the assembled content exceeds 128K chars.

### 14.4 Section Extraction Regex

Consumers extract sections using:

```
/<!-- SECTION: CONSTITUTION -->([\s\S]*?)<!-- \/SECTION: CONSTITUTION -->/
```

Or programmatically:

```javascript
function extractSection(cacheContent, sectionName) {
    const startMarker = `<!-- SECTION: ${sectionName} -->`;
    const endMarker = `<!-- /SECTION: ${sectionName} -->`;
    const startIdx = cacheContent.indexOf(startMarker);
    if (startIdx === -1) return null;
    const contentStart = startIdx + startMarker.length;
    const endIdx = cacheContent.indexOf(endMarker, contentStart);
    if (endIdx === -1) return null;
    return cacheContent.substring(contentStart, endIdx).trim();
}
```

---

## 15. Implementation Dependency Graph

```
FR-001 (rebuildSessionCache)
  ├── Depends on: _buildSkillPathIndex(), _collectSourceMtimes()
  ├── Depends on: getAgentSkillIndex(), formatSkillIndexBlock()
  ├── Depends on: loadManifest(), loadExternalManifest()
  └── Output: .isdlc/session-cache.md

FR-004 (bin/rebuild-cache.js)
  └── Depends on: FR-001 (rebuildSessionCache export)

FR-002 (inject-session-cache.cjs)
  └── Depends on: FR-001 (cache file must exist)
  └── Independent: no common.cjs dependency

FR-003 (settings.json registration)
  └── Depends on: FR-002 (hook file must exist)

FR-008 prereq (getAgentSkillIndex refactor)
  └── Depends on: _buildSkillPathIndex()
  └── Required by: FR-008 (path_lookup removal)

FR-005 (phase-loop consumer changes)
  └── Depends on: FR-001 (cache file format for section extraction)
  └── Fail-open: works without cache

FR-006 (roundtable consumer changes)
  └── Depends on: FR-001 (cache file format for section extraction)
  └── Fail-open: works without cache

FR-007 (trigger integration)
  └── Depends on: FR-001 (rebuildSessionCache function)

FR-009 (external manifest source field)
  └── Independent: schema change only

FR-008 (manifest cleanup)
  └── Depends on: getAgentSkillIndex refactor (MUST complete first)
  └── Last in implementation order
```

---

## 16. Traceability Matrix

| Module/Change | FRs | NFRs | ADRs | Constraints |
|---------------|-----|------|------|-------------|
| `_buildSkillPathIndex()` | FR-008 | -- | ADR-0028 | -- |
| `_collectSourceMtimes()` | FR-001 | NFR-006 | -- | -- |
| `rebuildSessionCache()` | FR-001 | NFR-004, NFR-006, NFR-007, NFR-009 | ADR-0026, ADR-0029 | CON-001, CON-002 |
| `inject-session-cache.cjs` | FR-002 | NFR-003, NFR-005, NFR-008 | ADR-0027 | CON-003, CON-004 |
| `settings.json` SessionStart | FR-003 | NFR-008 | -- | CON-004 |
| `bin/rebuild-cache.js` | FR-004 | -- | ADR-0030 | -- |
| `isdlc.md` STEP 3d changes | FR-005 | NFR-001, NFR-005, NFR-010 | -- | CON-005 |
| `isdlc.md` analyze changes | FR-006 | NFR-002, NFR-005, NFR-010 | -- | CON-005 |
| `isdlc.md` trigger calls | FR-007 | -- | -- | -- |
| `installer.js` trigger | FR-007 | -- | ADR-0030 | -- |
| `updater.js` trigger | FR-007 | -- | ADR-0030 | -- |
| `skills-manifest.json` cleanup | FR-008 | -- | ADR-0028 | -- |
| `getAgentSkillIndex()` refactor | FR-008 | -- | ADR-0028 | -- |
| External manifest source field | FR-009 | -- | -- | -- |
