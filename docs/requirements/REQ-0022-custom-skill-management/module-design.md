# Module Design: Custom Skill Management (REQ-0022)

**Phase**: 04-design
**Version**: 1.0
**Created**: 2026-02-18
**Traces to**: FR-001 through FR-009, NFR-001 through NFR-006, ADR-0008 through ADR-0011

---

## 1. Module Overview

Six files are affected by this feature (4 modified, 2 new). Each is designed as an independent module with clear responsibilities, interfaces, and dependencies.

| # | Module | File | Change | Responsibility |
|---|--------|------|--------|----------------|
| M1 | Skill Utilities | `src/claude/hooks/lib/common.cjs` | Modify | Validation, analysis, suggestion, formatting, manifest I/O |
| M2 | Command Dispatcher | `src/claude/commands/isdlc.md` | Modify | Skill add/wire/list/remove actions + STEP 3d injection |
| M3 | Skill Manager Agent | `src/claude/agents/skill-manager.md` | Create | Interactive wiring session |
| M4 | External Manifest | `docs/isdlc/external-skills-manifest.json` | Create | Skill registry data (created at runtime) |
| M5 | Intent Detection | `CLAUDE.md` | Modify | Natural language routing for skill commands |
| M6 | Agent Registry | `src/claude/hooks/config/skills-manifest.json` | Modify | Register skill-manager agent |

### Implementation Order (from Impact Analysis)

```
M1 (common.cjs utilities)
  |
  v
M4 (manifest schema -- defined by M1's write function)
  |
  v
M3 (skill-manager agent -- self-contained .md file)
  |
  v
M2 (isdlc.md -- skill actions + STEP 3d injection)
  |
  v
M5 (CLAUDE.md -- intent detection row)
  |
  v
M6 (skills-manifest.json -- register M3)
```

---

## 2. Module M1: Skill Utilities (common.cjs)

### 2.1 Responsibilities

Add six new exported functions to `src/claude/hooks/lib/common.cjs`. These functions provide the foundation layer that all other modules depend on. They follow existing common.cjs patterns: synchronous, CommonJS, error-returning (never throwing).

### 2.2 Placement

Insert the new section **after** `loadExternalManifest()` (line ~697) and **before** the "State Management" section (line ~699). Group them under a new section header:

```javascript
// =========================================================================
// External Skill Management (REQ-0022)
// =========================================================================
```

### 2.3 Function: validateSkillFrontmatter(filePath)

**Traces**: FR-001, Security Architecture 6.1

**Implementation approach**:

```javascript
function validateSkillFrontmatter(filePath) {
    const errors = [];

    // V-001: File exists
    if (!fs.existsSync(filePath)) {
        return { valid: false, errors: [`File not found: ${filePath}`], parsed: null, body: null };
    }

    // V-002: File extension
    if (!filePath.endsWith('.md')) {
        const ext = path.extname(filePath) || '(none)';
        return { valid: false, errors: [`Only .md files are supported. Got: ${ext}`], parsed: null, body: null };
    }

    const content = fs.readFileSync(filePath, 'utf8');

    // V-003: Frontmatter present
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) {
        return {
            valid: false,
            errors: ["No YAML frontmatter found. Expected file to start with '---'"],
            parsed: null,
            body: null
        };
    }

    // Parse frontmatter (simple key: value parser per ADR-0009)
    const parsed = {};
    const fmLines = fmMatch[1].split('\n');
    for (const line of fmLines) {
        const sepIdx = line.indexOf(': ');
        if (sepIdx > 0) {
            const key = line.substring(0, sepIdx).trim();
            const value = line.substring(sepIdx + 2).trim();
            parsed[key] = value;
        }
    }

    // V-004: name field required
    if (!parsed.name || !parsed.name.trim()) {
        errors.push('Missing required frontmatter field: name');
    }

    // V-005: description field required
    if (!parsed.description || !parsed.description.trim()) {
        errors.push('Missing required frontmatter field: description');
    }

    // V-006: name format (if name exists)
    if (parsed.name && parsed.name.trim()) {
        const namePattern = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
        if (!namePattern.test(parsed.name.trim())) {
            errors.push(
                "Skill name must be lowercase alphanumeric with hyphens, "
                + "2+ chars (e.g., 'nestjs-conventions')"
            );
        }
    }

    if (errors.length > 0) {
        return { valid: false, errors, parsed: null, body: null };
    }

    // Extract body (everything after frontmatter)
    const fmEnd = content.indexOf('---', 4);
    const body = content.substring(fmEnd + 3).trim();

    return { valid: true, errors: [], parsed, body };
}
```

**Key design decisions**:
- Uses simple regex + string split for YAML parsing (no js-yaml dependency per ADR-0009)
- Collects ALL errors before returning (not fail-fast) for better UX (NFR-006)
- Returns body content for use by analyzeSkillContent()

### 2.4 Function: analyzeSkillContent(content)

**Traces**: FR-002

**Implementation approach**:

```javascript
const SKILL_KEYWORD_MAP = {
    testing: {
        keywords: ['test', 'testing', 'coverage', 'assertion', 'mock', 'stub', 'jest', 'mocha'],
        phases: ['05-test-strategy', '06-implementation']
    },
    architecture: {
        keywords: ['architecture', 'design pattern', 'module', 'component', 'system design', 'microservice'],
        phases: ['03-architecture', '04-design']
    },
    devops: {
        keywords: ['deploy', 'ci/cd', 'pipeline', 'docker', 'kubernetes', 'infrastructure'],
        phases: ['10-cicd', '11-local-testing']
    },
    security: {
        keywords: ['security', 'auth', 'authentication', 'encryption', 'owasp', 'vulnerability'],
        phases: ['09-validation']
    },
    implementation: {
        keywords: ['implement', 'code', 'function', 'class', 'api', 'endpoint', 'controller', 'service'],
        phases: ['06-implementation']
    },
    requirements: {
        keywords: ['requirements', 'user story', 'acceptance criteria', 'specification'],
        phases: ['01-requirements']
    },
    review: {
        keywords: ['review', 'quality', 'lint', 'code review', 'static analysis'],
        phases: ['08-code-review']
    }
};

function analyzeSkillContent(content) {
    if (!content || typeof content !== 'string') {
        return { keywords: [], suggestedPhases: ['06-implementation'], confidence: 'low' };
    }

    const lowerContent = content.toLowerCase();
    const matchedKeywords = [];
    const phaseSet = new Set();

    for (const [category, config] of Object.entries(SKILL_KEYWORD_MAP)) {
        for (const kw of config.keywords) {
            if (lowerContent.includes(kw.toLowerCase())) {
                matchedKeywords.push(kw);
                config.phases.forEach(p => phaseSet.add(p));
            }
        }
    }

    const suggestedPhases = phaseSet.size > 0
        ? Array.from(phaseSet)
        : ['06-implementation'];

    let confidence;
    if (matchedKeywords.length >= 3) {
        confidence = 'high';
    } else if (matchedKeywords.length >= 1) {
        confidence = 'medium';
    } else {
        confidence = 'low';
    }

    return { keywords: matchedKeywords, suggestedPhases, confidence };
}
```

**Key design decisions**:
- Case-insensitive keyword matching
- Deduplicates phases via Set
- Falls back to `06-implementation` when no keywords match (most common use case per FR-002)
- The keyword map is a module-level constant (not inside the function) for testability

### 2.5 Function: suggestBindings(analysis, frontmatterHints)

**Traces**: FR-002

**Implementation approach**:

```javascript
const PHASE_TO_AGENT_MAP = {
    '01-requirements': 'requirements-analyst',
    '03-architecture': 'solution-architect',
    '04-design': 'system-designer',
    '05-test-strategy': 'test-design-engineer',
    '06-implementation': 'software-developer',
    '07-testing': 'integration-tester',
    '08-code-review': 'qa-engineer',
    '09-validation': 'security-compliance-auditor',
    '10-cicd': 'cicd-engineer',
    '11-local-testing': 'environment-builder',
    '16-quality-loop': 'quality-loop-engineer'
};

function suggestBindings(analysis, frontmatterHints) {
    const phases = (analysis && analysis.suggestedPhases) || ['06-implementation'];
    let confidence = (analysis && analysis.confidence) || 'low';

    // Map phases to agents
    const agentSet = new Set();
    for (const phase of phases) {
        const agent = PHASE_TO_AGENT_MAP[phase];
        if (agent) agentSet.add(agent);
    }

    // Enhance with frontmatter hints
    if (frontmatterHints && frontmatterHints.owner) {
        agentSet.add(frontmatterHints.owner);
        if (confidence === 'low') confidence = 'medium';
    }

    // Determine delivery type
    let delivery_type = 'context';
    if (frontmatterHints && frontmatterHints.when_to_use) {
        const hint = frontmatterHints.when_to_use.toLowerCase();
        if (hint.includes('must') || hint.includes('standard') || hint.includes('convention')) {
            delivery_type = 'instruction';
        }
    }
    // Large content hint (caller can pass content length as analysis.contentLength)
    if (analysis && analysis.contentLength && analysis.contentLength > 5000) {
        delivery_type = 'reference';
    }

    return {
        agents: Array.from(agentSet),
        phases,
        delivery_type,
        confidence
    };
}
```

**Key design decisions**:
- Uses PHASE_TO_AGENT_MAP to resolve agents from phases (consistent with STEP 3d table)
- Frontmatter `owner` field adds the agent directly (upgrades confidence)
- Content length > 5000 suggests `reference` delivery (prevents context bloat)
- `when_to_use` keywords suggest `instruction` delivery

### 2.6 Function: writeExternalManifest(manifest, projectId)

**Traces**: FR-004

**Implementation approach**:

```javascript
function writeExternalManifest(manifest, projectId) {
    try {
        const manifestPath = resolveExternalManifestPath(projectId);
        const dir = path.dirname(manifestPath);

        // Create parent directories
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Write with 2-space indentation + trailing newline
        const jsonStr = JSON.stringify(manifest, null, 2) + '\n';
        fs.writeFileSync(manifestPath, jsonStr, 'utf8');

        // Validate by re-reading
        const verify = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        if (!verify || !Array.isArray(verify.skills)) {
            return { success: false, error: 'Manifest validation failed after write', path: manifestPath };
        }

        return { success: true, error: null, path: manifestPath };
    } catch (e) {
        const manifestPath = resolveExternalManifestPath(projectId);
        return { success: false, error: e.message, path: manifestPath };
    }
}
```

**Key design decisions**:
- Creates directories recursively (handles first-time use)
- Re-reads and validates JSON after write (integrity check)
- Returns structured result (never throws)
- Uses `resolveExternalManifestPath()` for path (reuses existing infrastructure per CON-002)

### 2.7 Function: formatSkillInjectionBlock(name, content, deliveryType)

**Traces**: FR-005

**Implementation approach**:

```javascript
function formatSkillInjectionBlock(name, content, deliveryType) {
    switch (deliveryType) {
        case 'context':
            return `EXTERNAL SKILL CONTEXT: ${name}\n---\n${content}\n---`;
        case 'instruction':
            return `EXTERNAL SKILL INSTRUCTION (${name}): You MUST follow these guidelines:\n${content}`;
        case 'reference':
            // For reference, content is the file path
            return `EXTERNAL SKILL AVAILABLE: ${name} -- Read from ${content} if relevant to your current task`;
        default:
            return '';
    }
}
```

**Key design decisions**:
- Pure function, no I/O
- For `reference` type, the `content` parameter is repurposed as the file path
- Returns empty string on unknown delivery type (fail-safe)

### 2.8 Function: removeSkillFromManifest(skillName, manifest)

**Traces**: FR-007

**Implementation approach**:

```javascript
function removeSkillFromManifest(skillName, manifest) {
    if (!manifest || !Array.isArray(manifest.skills)) {
        return { removed: false, manifest: manifest || { version: '1.0.0', skills: [] } };
    }

    const initialLength = manifest.skills.length;
    const filtered = manifest.skills.filter(s => s.name !== skillName);

    return {
        removed: filtered.length < initialLength,
        manifest: { ...manifest, skills: filtered }
    };
}
```

**Key design decisions**:
- Pure function on the manifest object (does not write to disk)
- Returns the updated manifest for the caller to write
- Safe on null/undefined manifest

### 2.9 Exports

Add to the `module.exports` block in common.cjs:

```javascript
    // External skill management (REQ-0022)
    SKILL_KEYWORD_MAP,
    PHASE_TO_AGENT_MAP,
    validateSkillFrontmatter,
    analyzeSkillContent,
    suggestBindings,
    writeExternalManifest,
    formatSkillInjectionBlock,
    removeSkillFromManifest,
```

Export the constants (`SKILL_KEYWORD_MAP`, `PHASE_TO_AGENT_MAP`) for testability. Follow existing pattern where constants like `PHASE_KEY_ALIASES` and `SETUP_COMMAND_KEYWORDS` are exported.

---

## 3. Module M2: Command Dispatcher (isdlc.md)

### 3.1 Responsibilities

1. Add four new skill management action branches to the command dispatcher
2. Add STEP 3d runtime injection logic

### 3.2 Skill Action Dispatch

Add a new `skill` action branch to the existing action dispatch logic in isdlc.md. This is parallel to the existing `feature`, `fix`, `upgrade`, `test`, `cancel`, `status` branches.

**Action routing**:

```
IF action starts with "skill":
  Parse subcommand: add | wire | list | remove
  Route to appropriate handler below
```

#### 3.2.1 skill add <path>

**Full flow** (traces to FR-001, FR-002, FR-003):

```
1. Extract <path> from user input
2. Read file at <path> using Read tool
   - If file not found: display error, abort
3. Call validateSkillFrontmatter logic inline:
   - Check .md extension
   - Check frontmatter presence and required fields (name, description)
   - Check name format (lowercase, hyphens)
   - If validation fails: display all errors with correction guidance, abort
4. Check path traversal: filename must not contain /, \, or ..
5. Load manifest via loadExternalManifest()
   - If manifest is null: initialize as { version: "1.0.0", skills: [] }
6. Check for duplicate by name:
   - If duplicate found: prompt "Skill '{name}' already exists. Overwrite? [Y/N]"
   - On N: abort
   - On Y: continue (will update in place)
7. Copy file to external skills directory:
   - Resolve via resolveExternalSkillsPath()
   - Create directory if not exists (mkdir -p)
   - Copy file (preserving original name from frontmatter: {name}.md)
8. Analyze content for binding suggestions:
   - Scan body for phase-indicative keywords
   - Generate suggestions with confidence level
9. Delegate to skill-manager agent for wiring session:
   - Pass: skill name, description, suggestions, available phases
   - Receive: confirmed bindings object
10. Write manifest:
    - Add or update skill entry with:
      name, description, file, added_at (ISO 8601), bindings
    - Write via writeExternalManifest pattern
11. Display confirmation:
    "Skill '{name}' registered and wired to phases: {phases}
     Delivery: {delivery_type} | Mode: always"
```

#### 3.2.2 skill wire <name>

**Full flow** (traces to FR-003, FR-009):

```
1. Extract <name> from user input
2. Load manifest via loadExternalManifest()
3. Find skill by name in manifest.skills
   - If not found: display "Skill '{name}' not found. Run 'skill list' to see registered skills."
4. Load existing bindings (if any)
5. Delegate to skill-manager agent:
   - Pass: skill name, description, existing bindings, available phases
   - Receive: updated bindings object
6. Update skill entry in manifest with new bindings
7. Write manifest
8. Display confirmation with updated bindings
```

#### 3.2.3 skill list

**Full flow** (traces to FR-006):

```
1. Load manifest via loadExternalManifest()
2. If null or empty skills array:
   Display "No external skills registered. Use '/isdlc skill add <path>' to add one."
3. For each skill:
   Display formatted entry (name, phases, delivery type, mode)
```

#### 3.2.4 skill remove <name>

**Full flow** (traces to FR-007):

```
1. Extract <name> from user input
2. Load manifest via loadExternalManifest()
3. Find skill by name
   - If not found: display error with suggestion to list
4. Display prompt: "Remove '{name}'? [K] Keep file [D] Delete file [C] Cancel"
5. On K: Remove from manifest via removeSkillFromManifest(), write manifest
6. On D: Remove from manifest, delete .md file from external skills directory
7. On C: Abort
8. Display confirmation
```

### 3.3 STEP 3d Runtime Injection

**Location**: Insert a new block in STEP 3d, after the delegation prompt is constructed (after the `{SKILL INDEX BLOCK}` line and before the closing of the prompt template) but before `Use Task tool` invocation.

**New section header in isdlc.md**:

```markdown
**EXTERNAL SKILL INJECTION** (REQ-0022): After constructing the delegation prompt
above, inject any matched external skill content. This block is fail-open --
if anything fails, continue with the unmodified prompt.
```

**Injection pseudocode** (markdown instructions for the orchestrating agent):

```
1. Read the external skills manifest:
   - Use Read tool on the manifest file at docs/isdlc/external-skills-manifest.json
     (or monorepo equivalent)
   - If file does not exist or is empty: SKIP injection entirely (no-op)
   - Parse as JSON. If parse fails: SKIP injection (log warning)

2. Filter skills for current phase/agent:
   - For each skill in manifest.skills:
     a. If skill.bindings is missing: SKIP (backward compat)
     b. If skill.bindings.injection_mode !== "always": SKIP
     c. If current phase_key is NOT in skill.bindings.phases
        AND current agent name is NOT in skill.bindings.agents: SKIP
     d. This skill matches -- proceed to injection

3. For each matched skill, read and format:
   - Read the skill .md file from the external skills directory
   - If file not found: log warning, skip this skill
   - If content > 10,000 chars: truncate and switch to reference delivery
   - Format based on delivery_type:
     - "context": EXTERNAL SKILL CONTEXT: {name}\n---\n{content}\n---
     - "instruction": EXTERNAL SKILL INSTRUCTION ({name}): You MUST follow...\n{content}
     - "reference": EXTERNAL SKILL AVAILABLE: {name} -- Read from {path} if relevant

4. Append all formatted blocks to the delegation prompt:
   - Join blocks with double newline
   - Append after all other prompt components

5. Error handling:
   - If any error occurs in steps 1-4: continue with unmodified prompt
   - Log a warning but do not block the phase delegation
```

### 3.4 Dependencies

| Module M2 Depends On | For |
|----------------------|-----|
| common.cjs (M1) | validateSkillFrontmatter (conceptual -- logic inline in .md), loadExternalManifest, resolveExternalSkillsPath, resolveExternalManifestPath, formatSkillInjectionBlock |
| skill-manager.md (M3) | Interactive wiring session delegation |
| external-skills-manifest.json (M4) | Read/write manifest data |

---

## 4. Module M3: Skill Manager Agent (skill-manager.md)

### 4.1 Responsibilities

Conduct interactive wiring sessions for binding configuration. This is a conversational agent that guides users through selecting agent/phase bindings and delivery type.

### 4.2 Agent Definition

**File**: `src/claude/agents/skill-manager.md`

**Agent prompt structure**:

```markdown
# Skill Manager Agent

You are the Skill Manager, responsible for configuring how external skills
bind to agents and phases in the iSDLC workflow.

## Your Role

- You conduct interactive wiring sessions
- You do NOT write to the manifest directly (return bindings to caller)
- You do NOT access state.json or trigger workflows
- You do NOT create git branches or commits

## Session Flow

### Step 1: Display Context

Show the user what skill is being configured:

```
Wiring session for: {skill_name}
{skill_description}

{IF suggestions provided}
Suggested bindings (confidence: {confidence}):
  Phases: {suggested_phases}
  Agents: {suggested_agents}
  Delivery: {suggested_delivery_type}
{/IF}

{IF existing bindings provided}
Current bindings:
  Phases: {existing_phases}
  Agents: {existing_agents}
  Delivery: {existing_delivery_type}
{/IF}
```

### Step 2: Phase/Agent Selection

Present the available phases grouped by category, with suggested/existing
selections pre-checked:

```
Select phases to bind this skill to:

Requirements & Analysis:
  [ ] 01-requirements
  [ ] 02-impact-analysis
  [ ] 02-tracing

Architecture & Design:
  [ ] 03-architecture
  [ ] 04-design

Testing:
  [ ] 05-test-strategy
  [ ] 07-testing

Implementation:
  [x] 06-implementation  (suggested)

Quality & Security:
  [ ] 08-code-review
  [ ] 09-validation
  [ ] 16-quality-loop

DevOps:
  [ ] 10-cicd
  [ ] 11-local-testing
```

The user can select/deselect by naming phases. Accept natural language
(e.g., "add architecture and design", "remove testing").

### Step 3: Delivery Type Selection

Present delivery type options:

```
Select delivery type:
  [C] Context — Skill content appended as background knowledge
  [I] Instruction — Skill content injected as rules to follow
  [R] Reference — Skill referenced by name; agent reads on demand

Suggested: {suggested_delivery_type}
```

### Step 4: Confirmation

Display the final binding configuration and present the save menu:

```
Binding Summary for '{skill_name}':
  Phases: {selected_phases}
  Agents: {resolved_agents}
  Delivery: {delivery_type}
  Mode: always

  [S] Save  [A] Adjust  [X] Cancel
```

- On [S]: Return the bindings object
- On [A]: Go back to Step 2
- On [X]: Return cancellation signal

### Output Format

On save, output the bindings in a clearly parseable format:

```
BINDINGS_RESULT:
{
  "agents": ["software-developer"],
  "phases": ["06-implementation"],
  "injection_mode": "always",
  "delivery_type": "context"
}
```
```

### 4.3 Agent Constraints

| Constraint | Enforcement |
|-----------|-------------|
| No manifest writes | Agent returns bindings to isdlc.md; isdlc.md does the write |
| No state.json access | Agent has no reason to read/write workflow state |
| No git operations | CON-003: skill management commands do not create branches |
| No workflow triggers | CON-003: configuration operation only |
| No file system writes | Agent only reads skill file for display; writes are handled by caller |

### 4.4 Dependencies

| Module M3 Depends On | For |
|----------------------|-----|
| Nothing (self-contained) | Agent receives all context in delegation prompt |

---

## 5. Module M4: External Skills Manifest (external-skills-manifest.json)

### 5.1 Responsibilities

Persistent registry of all external skills and their bindings. Created on first `skill add`, not pre-existing.

### 5.2 File Location

| Mode | Path |
|------|------|
| Single-project | `docs/isdlc/external-skills-manifest.json` |
| Monorepo | `docs/isdlc/projects/{id}/external-skills-manifest.json` |

Resolved by `resolveExternalManifestPath()` in common.cjs.

### 5.3 Initial State (on creation)

```json
{
  "version": "1.0.0",
  "skills": []
}
```

### 5.4 Schema

See `docs/design/api/interface-spec-REQ-0022.yaml` section 6 (manifest_schema) for the complete JSON schema definition.

### 5.5 Constraints

- Maximum 50 skills (NFR-002)
- Skill names must be unique within the array
- `file` field stores filename only (path traversal prevention)
- `bindings` object is optional for backward compatibility (NFR-005)
- Written atomically by `writeExternalManifest()` (full JSON, not partial updates)

### 5.6 Dependencies

| Module M4 Depends On | For |
|----------------------|-----|
| common.cjs (M1) | Path resolution via resolveExternalManifestPath() |
| common.cjs (M1) | Read via loadExternalManifest(), write via writeExternalManifest() |

---

## 6. Module M5: Intent Detection (CLAUDE.md)

### 6.1 Responsibilities

Extend the natural language intent detection table to recognize skill management commands.

### 6.2 Change Description

Add one new row to the intent detection table in the "Step 1 -- Detect Intent" section:

**Current table** (6 rows: Feature, Fix, Upgrade, Test run, Test generate, Discovery)

**New row to add** (7th row):

| Intent | Signal Words / Patterns | Command (internal) |
|-------------|-----------------------------------------------|-------------------------------|
| **Skill mgmt** | add a skill, register skill, new skill, wire skill, bind skill, list skills, show skills, remove skill, delete skill | `/isdlc skill {subcommand}` |

### 6.3 Subcommand Detection Logic

The skill management intent is a multi-subcommand intent. After detecting the general "skill management" intent, the specific subcommand is determined:

- "add", "register", "new" in the same utterance -> `skill add` (prompt for path)
- "wire", "bind", "use X during Y" -> `skill wire` (prompt for name)
- "list", "show", "what skills" -> `skill list`
- "remove", "delete", "unregister" -> `skill remove` (prompt for name)

### 6.4 Consent Message Examples

- **skill add**: "Looks like you want to add a new skill. I'll validate the file and guide you through wiring it to the right phases. What's the path to the skill file?"
- **skill wire**: "I'll open a wiring session to configure which phases this skill applies to. Which skill would you like to wire?"
- **skill list**: "I'll show you all registered external skills with their current bindings."
- **skill remove**: "I'll help you remove that skill. Which one would you like to unregister?"

### 6.5 Dependencies

| Module M5 Depends On | For |
|----------------------|-----|
| isdlc.md (M2) | Routes to `/isdlc skill {subcommand}` actions |

---

## 7. Module M6: Agent Registry (skills-manifest.json)

### 7.1 Responsibilities

Register the new `skill-manager` agent in the framework's agent ownership registry.

### 7.2 Change Description

Add a new entry to the `ownership` section of `src/claude/hooks/config/skills-manifest.json`:

```json
"skill-manager": {
    "agent_id": "EXT",
    "phase": "skill-management",
    "skill_count": 0,
    "skills": []
}
```

### 7.3 Design Rationale

- `agent_id: "EXT"` -- The skill-manager is not a standard phase agent. "EXT" indicates it is an extension/utility agent outside the standard 01-16 phase numbering.
- `phase: "skill-management"` -- A descriptive phase name that does not conflict with existing phase keys.
- `skill_count: 0` and `skills: []` -- The skill-manager does not own any framework skills. It is a utility agent for configuration.

### 7.4 Dependencies

| Module M6 Depends On | For |
|----------------------|-----|
| skill-manager.md (M3) | References the agent this entry describes |

---

## 8. Cross-Module Data Flow

### 8.1 Skill Add Flow

```
User: "add a skill"
  |
  v
CLAUDE.md (M5) -- Intent detection -> /isdlc skill add
  |
  v
isdlc.md (M2) -- skill add action handler
  |
  |-- Read skill file
  |-- Validate frontmatter (inline, based on M1 validateSkillFrontmatter logic)
  |-- Copy to external skills directory
  |-- Analyze content (inline, based on M1 analyzeSkillContent logic)
  |-- Generate suggestions (inline, based on M1 suggestBindings logic)
  |
  v
skill-manager.md (M3) -- Interactive wiring session (Task delegation)
  |
  |-- Display suggestions
  |-- User selects phases/agents
  |-- User selects delivery type
  |-- User confirms
  |
  v
isdlc.md (M2) -- Receives bindings from skill-manager
  |
  |-- Write manifest (using M1 writeExternalManifest pattern)
  |-- Display confirmation
  |
  v
external-skills-manifest.json (M4) -- Updated on disk
```

### 8.2 Runtime Injection Flow

```
isdlc.md (M2) -- STEP 3d, during phase delegation
  |
  |-- Read manifest (M4) via loadExternalManifest()
  |-- Filter: match skills to current phase/agent
  |-- For each matched skill:
  |     |-- Read .md file from external skills dir
  |     |-- Truncate if > 10,000 chars
  |     |-- Format injection block (M1 formatSkillInjectionBlock)
  |-- Append blocks to delegation prompt
  |
  v
Phase Agent receives augmented prompt
```

### 8.3 Error Propagation

All errors are contained within their module. No error propagates upward to block workflow execution.

| Error Source | Handling | Propagation |
|-------------|----------|-------------|
| File not found (validateSkillFrontmatter) | Return error object | Displayed to user, skill add aborted |
| Invalid frontmatter | Return error object | Displayed to user, skill add aborted |
| Manifest read failure | Return null | Injection skipped (no-op) |
| Manifest write failure | Return error object | Displayed to user |
| Skill file missing at injection time | Log warning, skip skill | Other skills still injected |
| formatSkillInjectionBlock error | Return empty string | Skill skipped |
| Outer injection try/catch | Log warning | Unmodified prompt used |

---

## 9. Configuration

### 9.1 Constants

| Constant | Value | Location | Purpose |
|----------|-------|----------|---------|
| `SKILL_KEYWORD_MAP` | Object (7 categories) | common.cjs | Keyword-to-phase mapping |
| `PHASE_TO_AGENT_MAP` | Object (11 entries) | common.cjs | Phase-to-agent resolution |
| `MAX_SKILL_CONTENT_LENGTH` | 10000 | common.cjs / isdlc.md | Truncation threshold |
| `MAX_EXTERNAL_SKILLS` | 50 | common.cjs | Manifest skills array cap |
| Manifest version | "1.0.0" | external-skills-manifest.json | Schema version |
| Skill name pattern | `/^[a-z0-9][a-z0-9-]*[a-z0-9]$/` | common.cjs | Name validation regex |

### 9.2 Feature Flags

None. The feature is always enabled. When no manifest exists, all injection is a no-op (backward compatible per NFR-005).

---

## 10. Sync Requirements

After implementation, the following files must be synced from `src/claude/` to `.claude/`:

| Source | Destination | Mechanism |
|--------|-------------|-----------|
| `src/claude/hooks/lib/common.cjs` | `.claude/hooks/lib/common.cjs` | Runtime sync |
| `src/claude/commands/isdlc.md` | `.claude/commands/isdlc.md` | Symlink (existing) |
| `src/claude/agents/skill-manager.md` | `.claude/agents/skill-manager.md` | Runtime sync |
| `src/claude/hooks/config/skills-manifest.json` | `.claude/hooks/config/skills-manifest.json` | Runtime sync |

Note: `CLAUDE.md` lives at project root (not in `.claude/`). `external-skills-manifest.json` lives in `docs/isdlc/` (not in `.claude/`).
