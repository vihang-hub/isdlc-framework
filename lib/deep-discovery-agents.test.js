/**
 * deep-discovery-agents.test.js -- Structural validation for new deep discovery agents
 *
 * REQ-0007-deep-discovery: Validates D16-D19 agent .md files have correct
 * YAML frontmatter, required sections, and follow established patterns.
 *
 * Test cases TC-B01 through TC-B16.
 *
 * @module deep-discovery-agents.test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const DISCOVER_DIR = join(__dirname, '..', 'src', 'claude', 'agents', 'discover');

const NEW_AGENTS = [
  { file: 'security-auditor.md', id: 'D16', prefix: 'DISC-16' },
  { file: 'technical-debt-auditor.md', id: 'D17', prefix: 'DISC-17' },
  { file: 'performance-analyst.md', id: 'D18', prefix: 'DISC-18' },
  { file: 'ops-readiness-reviewer.md', id: 'D19', prefix: 'DISC-19' },
];

describe('new agent structural validation (REQ-0007)', () => {
  // TC-B01 to TC-B04: Each new agent file exists
  it('TC-B01: security-auditor.md exists', () => {
    assert.ok(existsSync(join(DISCOVER_DIR, 'security-auditor.md')));
  });

  it('TC-B02: technical-debt-auditor.md exists', () => {
    assert.ok(existsSync(join(DISCOVER_DIR, 'technical-debt-auditor.md')));
  });

  it('TC-B03: performance-analyst.md exists', () => {
    assert.ok(existsSync(join(DISCOVER_DIR, 'performance-analyst.md')));
  });

  it('TC-B04: ops-readiness-reviewer.md exists', () => {
    assert.ok(existsSync(join(DISCOVER_DIR, 'ops-readiness-reviewer.md')));
  });

  // TC-B05: Each new agent has valid YAML frontmatter
  it('TC-B05: each new agent has valid YAML frontmatter (--- delimiters)', () => {
    for (const agent of NEW_AGENTS) {
      const content = readFileSync(join(DISCOVER_DIR, agent.file), 'utf-8');
      assert.ok(content.startsWith('---\n'), `${agent.file} missing frontmatter start`);
      const secondDash = content.indexOf('---', 4);
      assert.ok(secondDash > 0, `${agent.file} missing frontmatter end`);
    }
  });

  // TC-B06: Each agent frontmatter has name, description, model, owned_skills
  it('TC-B06: each agent frontmatter has name, description, model, owned_skills', () => {
    for (const agent of NEW_AGENTS) {
      const content = readFileSync(join(DISCOVER_DIR, agent.file), 'utf-8');
      const endIdx = content.indexOf('---', 4);
      const frontmatter = content.slice(4, endIdx);
      assert.ok(frontmatter.includes('name:'), `${agent.file} missing name field`);
      assert.ok(frontmatter.includes('description:'), `${agent.file} missing description field`);
      assert.ok(frontmatter.includes('model:'), `${agent.file} missing model field`);
      assert.ok(frontmatter.includes('owned_skills:'), `${agent.file} missing owned_skills field`);
    }
  });

  // TC-B07: Each agent has "Agent ID: D{N}" line with correct ID
  it('TC-B07: each agent has correct Agent ID line', () => {
    for (const agent of NEW_AGENTS) {
      const content = readFileSync(join(DISCOVER_DIR, agent.file), 'utf-8');
      assert.ok(
        content.includes(`**Agent ID:** ${agent.id}`),
        `${agent.file} missing "Agent ID: ${agent.id}"`
      );
    }
  });

  // TC-B08: Each agent has "Parent: discover-orchestrator" line
  it('TC-B08: each agent has Parent: discover-orchestrator', () => {
    for (const agent of NEW_AGENTS) {
      const content = readFileSync(join(DISCOVER_DIR, agent.file), 'utf-8');
      assert.ok(
        content.includes('**Parent:** discover-orchestrator'),
        `${agent.file} missing Parent: discover-orchestrator`
      );
    }
  });

  // TC-B09: Each agent has "## Role" section
  it('TC-B09: each agent has ## Role section', () => {
    for (const agent of NEW_AGENTS) {
      const content = readFileSync(join(DISCOVER_DIR, agent.file), 'utf-8');
      assert.ok(content.includes('## Role'), `${agent.file} missing ## Role`);
    }
  });

  // TC-B10: Each agent has "## When Invoked" section
  it('TC-B10: each agent has ## When Invoked section', () => {
    for (const agent of NEW_AGENTS) {
      const content = readFileSync(join(DISCOVER_DIR, agent.file), 'utf-8');
      assert.ok(content.includes('## When Invoked'), `${agent.file} missing ## When Invoked`);
    }
  });

  // TC-B11: Each agent has "## Process" section with numbered steps
  it('TC-B11: each agent has ## Process section with numbered steps', () => {
    for (const agent of NEW_AGENTS) {
      const content = readFileSync(join(DISCOVER_DIR, agent.file), 'utf-8');
      assert.ok(content.includes('## Process'), `${agent.file} missing ## Process`);
      assert.ok(content.includes('### Step 1:'), `${agent.file} missing ### Step 1:`);
    }
  });

  // TC-B12: Each agent has "## Output Contract" section
  it('TC-B12: each agent has ## Output Contract section', () => {
    for (const agent of NEW_AGENTS) {
      const content = readFileSync(join(DISCOVER_DIR, agent.file), 'utf-8');
      assert.ok(content.includes('## Output Contract'), `${agent.file} missing ## Output Contract`);
    }
  });

  // TC-B13: Each agent has "## Debate Round Participation" section
  it('TC-B13: each agent has ## Debate Round Participation section', () => {
    for (const agent of NEW_AGENTS) {
      const content = readFileSync(join(DISCOVER_DIR, agent.file), 'utf-8');
      assert.ok(
        content.includes('## Debate Round Participation'),
        `${agent.file} missing ## Debate Round Participation`
      );
    }
  });

  // TC-B14: D16 owned_skills start with DISC-16 prefix
  it('TC-B14: D16 owned_skills start with DISC-16 prefix', () => {
    const content = readFileSync(join(DISCOVER_DIR, 'security-auditor.md'), 'utf-8');
    assert.ok(content.includes('DISC-1601'), 'D16 missing DISC-1601 skill');
  });

  // TC-B15: D17 owned_skills start with DISC-17 prefix
  it('TC-B15: D17 owned_skills start with DISC-17 prefix', () => {
    const content = readFileSync(join(DISCOVER_DIR, 'technical-debt-auditor.md'), 'utf-8');
    assert.ok(content.includes('DISC-1701'), 'D17 missing DISC-1701 skill');
  });

  // TC-B16: No agent references "party mode" or "classic mode"
  it('TC-B16: no new agent references party mode or classic mode', () => {
    for (const agent of NEW_AGENTS) {
      const content = readFileSync(join(DISCOVER_DIR, agent.file), 'utf-8').toLowerCase();
      assert.ok(!content.includes('party mode'), `${agent.file} contains "party mode"`);
      assert.ok(!content.includes('classic mode'), `${agent.file} contains "classic mode"`);
    }
  });
});
