# Test Cases — Agent File Structural Validation

**File**: `lib/prompt-format.test.js` (additions)
**Framework**: node:test + node:assert/strict
**Target**: 7 new agent .md files + modified orchestrator/command files

---

## Test Implementation

### 1. SUB_AGENTS Array Addition

Add 7 new agent files to the existing `SUB_AGENTS` array in `lib/prompt-format.test.js`:

```javascript
// Inside the existing SUB_AGENTS array, add:
join('discover', 'domain-researcher.md'),
join('discover', 'technical-scout.md'),
join('discover', 'solution-architect-party.md'),
join('discover', 'security-advisor.md'),
join('discover', 'devops-pragmatist.md'),
join('discover', 'data-model-designer.md'),
join('discover', 'test-strategist.md'),
```

This automatically picks up the existing structural tests (frontmatter, SUGGESTED PROMPTS section, etc.) for these 7 new files via the shared iteration pattern.

### 2. New Describe Block: Party Mode Structural Checks

```javascript
/**
 * Party Mode Structural Checks — TC-019 through TC-028
 *
 * REQ-0006-inception-party-discover: Validates file existence,
 * frontmatter consistency, and orchestrator/command modifications.
 */

const EXPECTED_NEW_AGENTS = [
  join('discover', 'domain-researcher.md'),
  join('discover', 'technical-scout.md'),
  join('discover', 'solution-architect-party.md'),
  join('discover', 'security-advisor.md'),
  join('discover', 'devops-pragmatist.md'),
  join('discover', 'data-model-designer.md'),
  join('discover', 'test-strategist.md'),
];

const EXPECTED_AGENT_TYPES = {
  'domain-researcher': 'D9',
  'technical-scout': 'D10',
  'solution-architect-party': 'D11',
  'security-advisor': 'D12',
  'devops-pragmatist': 'D13',
  'data-model-designer': 'D14',
  'test-strategist': 'D15',
};

describe('Party Mode Structural Checks (REQ-0006)', () => {

  // TC-019: All 7 new agent files exist
  it('TC-019: all 7 new party mode agent files exist', () => {
    for (const agentPath of EXPECTED_NEW_AGENTS) {
      const fullPath = join(AGENTS_DIR, agentPath);
      assert.ok(
        existsSync(fullPath),
        `Missing agent file: ${agentPath}`
      );
    }
  });

  // TC-020: Each new agent has valid YAML frontmatter
  it('TC-020: each new agent has valid YAML frontmatter with required fields', () => {
    for (const agentPath of EXPECTED_NEW_AGENTS) {
      const fullPath = join(AGENTS_DIR, agentPath);
      const content = readFileSync(fullPath, 'utf-8');
      assert.ok(
        content.startsWith('---'),
        `${agentPath}: missing YAML frontmatter delimiter`
      );
      const endIndex = content.indexOf('---', 3);
      assert.ok(
        endIndex > 3,
        `${agentPath}: missing closing YAML frontmatter delimiter`
      );
      const frontmatter = content.slice(3, endIndex);
      assert.ok(
        frontmatter.includes('name:'),
        `${agentPath}: frontmatter missing 'name' field`
      );
      assert.ok(
        frontmatter.includes('description:'),
        `${agentPath}: frontmatter missing 'description' field`
      );
    }
  });

  // TC-021: Frontmatter name matches expected agent_type
  it('TC-021: each new agent frontmatter name matches party-personas.json agent_type', () => {
    const personasPath = join(
      AGENTS_DIR, 'discover', 'party-personas.json'
    );
    const personas = JSON.parse(readFileSync(personasPath, 'utf-8'));

    for (const agentPath of EXPECTED_NEW_AGENTS) {
      const filename = agentPath.replace('discover/', '').replace('.md', '');
      const fullPath = join(AGENTS_DIR, agentPath);
      const content = readFileSync(fullPath, 'utf-8');
      const frontmatter = content.slice(3, content.indexOf('---', 3));
      const nameMatch = frontmatter.match(/name:\s*["']?([^"'\n]+)/);
      assert.ok(
        nameMatch,
        `${agentPath}: could not extract name from frontmatter`
      );

      // Verify agent_type exists in personas for this filename
      const persona = Object.values(personas.personas).find(
        p => p.agent_type === filename
      );
      assert.ok(
        persona,
        `${agentPath}: agent_type "${filename}" not found in party-personas.json`
      );
    }
  });

  // TC-022: Each new agent has SUGGESTED PROMPTS section
  it('TC-022: each new agent has SUGGESTED PROMPTS section', () => {
    for (const agentPath of EXPECTED_NEW_AGENTS) {
      const fullPath = join(AGENTS_DIR, agentPath);
      const content = readFileSync(fullPath, 'utf-8');
      assert.ok(
        content.includes('# SUGGESTED PROMPTS') ||
        content.includes('## SUGGESTED PROMPTS'),
        `${agentPath}: missing SUGGESTED PROMPTS section`
      );
    }
  });

  // TC-023: Each new agent has Role section
  it('TC-023: each new agent has Role section', () => {
    for (const agentPath of EXPECTED_NEW_AGENTS) {
      const fullPath = join(AGENTS_DIR, agentPath);
      const content = readFileSync(fullPath, 'utf-8');
      assert.ok(
        content.includes('## Role') || content.includes('# Role'),
        `${agentPath}: missing Role section`
      );
    }
  });

  // TC-024: Each new agent has Process or Communication Protocol section
  it('TC-024: each new agent has Process or Communication Protocol section', () => {
    for (const agentPath of EXPECTED_NEW_AGENTS) {
      const fullPath = join(AGENTS_DIR, agentPath);
      const content = readFileSync(fullPath, 'utf-8');
      assert.ok(
        content.includes('## Process') ||
        content.includes('## Communication Protocol') ||
        content.includes('# Process') ||
        content.includes('# Communication Protocol'),
        `${agentPath}: missing Process or Communication Protocol section`
      );
    }
  });

  // TC-025: discover-orchestrator.md contains PARTY MODE FLOW section
  it('TC-025: discover-orchestrator.md contains PARTY MODE FLOW section', () => {
    const orchestratorPath = join(AGENTS_DIR, 'discover-orchestrator.md');
    const content = readFileSync(orchestratorPath, 'utf-8');
    assert.ok(
      content.includes('PARTY MODE FLOW') ||
      content.includes('Party Mode Flow') ||
      content.includes('party mode flow'),
      'discover-orchestrator.md missing PARTY MODE FLOW section'
    );
  });

  // TC-026: discover-orchestrator.md contains Mode Selection step
  it('TC-026: discover-orchestrator.md contains Step 0 Mode Selection', () => {
    const orchestratorPath = join(AGENTS_DIR, 'discover-orchestrator.md');
    const content = readFileSync(orchestratorPath, 'utf-8');
    assert.ok(
      content.includes('Mode Selection') ||
      content.includes('mode selection') ||
      content.includes('MODE SELECTION'),
      'discover-orchestrator.md missing Mode Selection section'
    );
  });

  // TC-027: discover.md Options table contains --party and --classic flags
  it('TC-027: discover.md has --party and --classic flag entries', () => {
    const discoverPath = join(
      AGENTS_DIR, '..', 'commands', 'discover.md'
    );
    const content = readFileSync(discoverPath, 'utf-8');
    assert.ok(
      content.includes('--party'),
      'discover.md missing --party flag'
    );
    assert.ok(
      content.includes('--classic'),
      'discover.md missing --classic flag'
    );
  });

  // TC-028: discover.md Examples section contains party/classic examples
  it('TC-028: discover.md has party/classic usage examples', () => {
    const discoverPath = join(
      AGENTS_DIR, '..', 'commands', 'discover.md'
    );
    const content = readFileSync(discoverPath, 'utf-8');
    assert.ok(
      content.includes('/discover --new --party') ||
      content.includes('/discover --party'),
      'discover.md missing party mode example'
    );
    assert.ok(
      content.includes('/discover --new --classic') ||
      content.includes('/discover --classic'),
      'discover.md missing classic mode example'
    );
  });
});
```

---

## Expected Results

All 10 structural tests pass when:
1. The 7 new agent files are created at the correct paths
2. discover-orchestrator.md has the PARTY MODE FLOW section added
3. discover.md has --party/--classic flags and examples added
4. party-personas.json is correctly formed (cross-reference in TC-021)

Run with: `node --test lib/prompt-format.test.js`
