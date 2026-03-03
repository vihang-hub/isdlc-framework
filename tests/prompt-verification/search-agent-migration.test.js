/**
 * Agent Migration Validation Tests
 *
 * REQ-0042 / FR-003, FR-004, FR-005: Validates that agent markdown files
 * have been correctly migrated with Enhanced Search sections.
 *
 * These tests validate structural properties of agent markdown files:
 * - Section presence (Enhanced Search heading)
 * - Content validation (modalities, fallback, availability check)
 * - Frontmatter preservation (not modified by migration)
 * - Existing section preservation (Grep/Glob references intact)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const projectRoot = resolve(__dirname, '..', '..');

// Agent file paths
const AGENTS = {
  'quick-scan-agent': join(projectRoot, 'src', 'claude', 'agents', 'quick-scan', 'quick-scan-agent.md'),
  'impact-analyzer': join(projectRoot, 'src', 'claude', 'agents', 'impact-analysis', 'impact-analyzer.md'),
  'entry-point-finder': join(projectRoot, 'src', 'claude', 'agents', 'impact-analysis', 'entry-point-finder.md'),
  'risk-assessor': join(projectRoot, 'src', 'claude', 'agents', 'impact-analysis', 'risk-assessor.md'),
  'architecture-analyzer': join(projectRoot, 'src', 'claude', 'agents', 'discover', 'architecture-analyzer.md'),
  'feature-mapper': join(projectRoot, 'src', 'claude', 'agents', 'discover', 'feature-mapper.md'),
};

/**
 * Read an agent file and return its content.
 */
function readAgent(name) {
  return readFileSync(AGENTS[name], 'utf-8');
}

/**
 * Extract the YAML frontmatter from a markdown file.
 * Returns the raw frontmatter string (between --- markers).
 */
function extractFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  return match ? match[1] : '';
}

/**
 * Check if a section heading exists in the markdown content.
 * Looks for "# ENHANCED SEARCH" or "## Enhanced Search" (case-insensitive).
 */
function hasEnhancedSearchSection(content) {
  return /^#{1,2}\s+ENHANCED\s+SEARCH/im.test(content);
}

/**
 * Extract the Enhanced Search section content (everything between the heading
 * and the next heading of same or higher level).
 */
function extractEnhancedSearchSection(content) {
  // Find the Enhanced Search heading
  const headingMatch = content.match(/^(#{1,2})\s+ENHANCED\s+SEARCH[^\n]*/im);
  if (!headingMatch) return '';

  const headingLevel = headingMatch[1].length;
  const startIdx = headingMatch.index + headingMatch[0].length;
  const rest = content.substring(startIdx);

  // Find the next heading of same or higher level
  const nextHeadingPattern = new RegExp(`^#{1,${headingLevel}}\\s`, 'm');
  const nextMatch = rest.match(nextHeadingPattern);

  if (nextMatch) {
    return rest.substring(0, nextMatch.index);
  }
  return rest;
}

// ---------------------------------------------------------------------------
// TC-U-026: quick-scan-agent.md contains Enhanced Search section
// ---------------------------------------------------------------------------

describe('Quick Scan Agent migration (FR-003)', () => {
  it('TC-U-026: should contain Enhanced Search section', () => {
    const content = readAgent('quick-scan-agent');
    assert.ok(
      hasEnhancedSearchSection(content),
      'quick-scan-agent.md should contain an Enhanced Search section heading'
    );
  });

  // TC-U-027: Describes structural and lexical modalities
  it('TC-U-027: Enhanced Search section should describe structural and lexical modalities', () => {
    const content = readAgent('quick-scan-agent');
    const section = extractEnhancedSearchSection(content);

    assert.ok(
      /structural/i.test(section),
      'Enhanced Search section should mention structural modality'
    );
    assert.ok(
      /lexical/i.test(section),
      'Enhanced Search section should mention lexical modality'
    );
  });

  // TC-U-028: Preserves existing Grep/Glob instructions
  it('TC-U-028: should preserve existing Grep/Glob instructions', () => {
    const content = readAgent('quick-scan-agent');

    // Grep and Glob references should appear before the Enhanced Search section
    const enhancedIdx = content.search(/^#{1,2}\s+ENHANCED\s+SEARCH/im);
    const beforeEnhanced = content.substring(0, enhancedIdx > 0 ? enhancedIdx : content.length);

    assert.ok(
      /[Gg]rep/i.test(beforeEnhanced),
      'Grep references should exist before Enhanced Search section'
    );
    assert.ok(
      /[Gg]lob/i.test(beforeEnhanced),
      'Glob references should exist before Enhanced Search section'
    );
  });

  // TC-U-037: Describes hasEnhancedSearch() check
  it('TC-U-037: Enhanced Search section should describe availability check', () => {
    const content = readAgent('quick-scan-agent');
    const section = extractEnhancedSearchSection(content);

    assert.ok(
      /search-config\.json|hasEnhancedSearch|enhanced\s*search.*available|check.*search/i.test(section),
      'Enhanced Search section should describe how to check if enhanced search is available'
    );
  });

  // TC-U-029: Frontmatter unchanged
  it('TC-U-029: frontmatter should contain expected agent name and skills', () => {
    const content = readAgent('quick-scan-agent');
    const frontmatter = extractFrontmatter(content);

    assert.ok(
      frontmatter.includes('name: quick-scan-agent'),
      'Frontmatter should have name: quick-scan-agent'
    );
    assert.ok(
      frontmatter.includes('QS-001'),
      'Frontmatter should include QS-001 skill'
    );
    assert.ok(
      frontmatter.includes('QS-002'),
      'Frontmatter should include QS-002 skill'
    );
    assert.ok(
      frontmatter.includes('QS-003'),
      'Frontmatter should include QS-003 skill'
    );
  });
});

// ---------------------------------------------------------------------------
// TC-U-030: impact-analyzer.md
// ---------------------------------------------------------------------------

describe('Impact Analysis agent migration (FR-004)', () => {
  // TC-U-030: impact-analyzer.md contains Enhanced Search section
  it('TC-U-030: impact-analyzer.md should contain Enhanced Search section', () => {
    const content = readAgent('impact-analyzer');
    assert.ok(
      hasEnhancedSearchSection(content),
      'impact-analyzer.md should contain an Enhanced Search section'
    );
  });

  // TC-U-031: entry-point-finder.md contains Enhanced Search section
  it('TC-U-031: entry-point-finder.md should contain Enhanced Search section', () => {
    const content = readAgent('entry-point-finder');
    assert.ok(
      hasEnhancedSearchSection(content),
      'entry-point-finder.md should contain an Enhanced Search section'
    );
  });

  // TC-U-031 content: structural search guidance for endpoints
  it('TC-U-031: entry-point-finder.md Enhanced Search should reference structural search for endpoints', () => {
    const content = readAgent('entry-point-finder');
    const section = extractEnhancedSearchSection(content);

    assert.ok(
      /structural/i.test(section),
      'Entry point finder Enhanced Search should mention structural search'
    );
  });

  // TC-U-032: risk-assessor.md contains Enhanced Search section
  it('TC-U-032: risk-assessor.md should contain Enhanced Search section', () => {
    const content = readAgent('risk-assessor');
    assert.ok(
      hasEnhancedSearchSection(content),
      'risk-assessor.md should contain an Enhanced Search section'
    );
  });

  // TC-U-032 content: enhanced lexical search guidance
  it('TC-U-032: risk-assessor.md Enhanced Search should reference lexical search', () => {
    const content = readAgent('risk-assessor');
    const section = extractEnhancedSearchSection(content);

    assert.ok(
      /lexical/i.test(section),
      'Risk assessor Enhanced Search should mention lexical search'
    );
  });

  // TC-U-033: impact analysis agent frontmatter unchanged
  it('TC-U-033: impact-analyzer.md frontmatter should be unchanged', () => {
    const content = readAgent('impact-analyzer');
    const frontmatter = extractFrontmatter(content);

    assert.ok(frontmatter.includes('name: impact-analyzer'), 'Should have correct name');
    assert.ok(frontmatter.includes('IA-101'), 'Should include IA-101 skill');
    assert.ok(frontmatter.includes('IA-102'), 'Should include IA-102 skill');
  });

  it('TC-U-033: entry-point-finder.md frontmatter should be unchanged', () => {
    const content = readAgent('entry-point-finder');
    const frontmatter = extractFrontmatter(content);

    assert.ok(frontmatter.includes('name: entry-point-finder'), 'Should have correct name');
    assert.ok(frontmatter.includes('IA-201'), 'Should include IA-201 skill');
  });

  it('TC-U-033: risk-assessor.md frontmatter should be unchanged', () => {
    const content = readAgent('risk-assessor');
    const frontmatter = extractFrontmatter(content);

    assert.ok(frontmatter.includes('name: risk-assessor'), 'Should have correct name');
    assert.ok(frontmatter.includes('IA-301'), 'Should include IA-301 skill');
  });
});

// ---------------------------------------------------------------------------
// TC-U-034, TC-U-035, TC-U-036: Discovery agent migration (Could Have)
// ---------------------------------------------------------------------------

describe('Discovery agent migration (FR-005)', () => {
  // TC-U-034: architecture-analyzer.md contains Enhanced Search section
  it('TC-U-034: architecture-analyzer.md should contain Enhanced Search section', () => {
    const content = readAgent('architecture-analyzer');
    assert.ok(
      hasEnhancedSearchSection(content),
      'architecture-analyzer.md should contain an Enhanced Search section'
    );
  });

  it('TC-U-034: architecture-analyzer.md should preserve existing find patterns as fallback', () => {
    const content = readAgent('architecture-analyzer');
    assert.ok(
      /find\s|Grep|Glob/i.test(content),
      'architecture-analyzer.md should still contain existing search patterns'
    );
  });

  // TC-U-035: feature-mapper.md contains Enhanced Search section
  it('TC-U-035: feature-mapper.md should contain Enhanced Search section', () => {
    const content = readAgent('feature-mapper');
    assert.ok(
      hasEnhancedSearchSection(content),
      'feature-mapper.md should contain an Enhanced Search section'
    );
  });

  it('TC-U-035: feature-mapper.md should preserve existing Grep patterns', () => {
    const content = readAgent('feature-mapper');
    assert.ok(
      /Grep|grep/i.test(content),
      'feature-mapper.md should still contain Grep references'
    );
  });

  // TC-U-036: Discovery agent frontmatter unchanged
  it('TC-U-036: architecture-analyzer.md frontmatter should be unchanged', () => {
    const content = readAgent('architecture-analyzer');
    const frontmatter = extractFrontmatter(content);

    assert.ok(frontmatter.includes('name: architecture-analyzer'), 'Should have correct name');
    assert.ok(frontmatter.includes('DISC-101'), 'Should include DISC-101 skill');
  });

  it('TC-U-036: feature-mapper.md frontmatter should be unchanged', () => {
    const content = readAgent('feature-mapper');
    const frontmatter = extractFrontmatter(content);

    assert.ok(frontmatter.includes('name: feature-mapper'), 'Should have correct name');
    assert.ok(frontmatter.includes('DISC-601'), 'Should include DISC-601 skill');
  });
});
