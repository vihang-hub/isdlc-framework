'use strict';

/**
 * Multiline Bash Validation Tests
 * ================================
 * BUG-0029-GH-18: Validates that all agent/command markdown files
 * contain only single-line Bash code blocks, and that the Single-Line
 * Bash Convention documentation exists in CLAUDE.md and CLAUDE.md.template.
 *
 * Uses Node.js built-in test runner (node:test) + node:assert/strict.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

// BUG-0029: Files that were identified as containing multiline Bash blocks
const AFFECTED_FILES = [
  'src/claude/agents/05-software-developer.md',
  'src/claude/agents/06-integration-tester.md',
  'src/claude/commands/discover.md',
  'src/claude/commands/provider.md',
  'src/claude/commands/isdlc.md',
  'src/claude/agents/discover/data-model-analyzer.md',
  'src/claude/agents/discover/skills-researcher.md',
  'src/claude/agents/discover/test-evaluator.md',
];

// ---------------------------------------------------------------------------
// Detection utility
// ---------------------------------------------------------------------------

/**
 * Regex to find fenced Bash/sh code blocks in markdown.
 * Captures the content between the fences.
 */
const MULTILINE_BASH_REGEX = /```(?:bash|sh)\n([\s\S]*?)```/g;

/**
 * Returns true if the content contains any Bash/sh code block
 * with more than one non-empty line of actual commands.
 *
 * @param {string} content - Markdown file content
 * @returns {boolean}
 */
function hasMultilineBash(content) {
  const matches = [...content.matchAll(MULTILINE_BASH_REGEX)];
  return matches.some(m => {
    const lines = m[1].split('\n').filter(l => l.trim().length > 0);
    return lines.length > 1;
  });
}

/**
 * Returns details of every multiline Bash block found.
 *
 * @param {string} content - Markdown file content
 * @returns {Array<{lineNumber: number, preview: string}>}
 */
function findMultilineBashBlocks(content) {
  const results = [];
  const allLines = content.split('\n');
  let match;
  const regex = /```(?:bash|sh)\n([\s\S]*?)```/g;

  while ((match = regex.exec(content)) !== null) {
    const blockContent = match[1];
    const nonEmptyLines = blockContent.split('\n').filter(l => l.trim().length > 0);
    if (nonEmptyLines.length > 1) {
      // Find the line number of the opening fence
      const charIndex = match.index;
      const lineNumber = content.substring(0, charIndex).split('\n').length;
      results.push({
        lineNumber,
        preview: nonEmptyLines.slice(0, 3).join(' | '),
      });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// FR-001: No multiline Bash blocks in affected files
// ---------------------------------------------------------------------------

describe('FR-001: No multiline Bash blocks in affected files', () => {
  for (const relPath of AFFECTED_FILES) {
    it(`${relPath} should have no multiline Bash blocks`, () => {
      const absPath = path.join(PROJECT_ROOT, relPath);
      assert.ok(fs.existsSync(absPath), `File not found: ${absPath}`);

      const content = fs.readFileSync(absPath, 'utf8');
      const violations = findMultilineBashBlocks(content);

      assert.strictEqual(
        violations.length,
        0,
        `Found ${violations.length} multiline Bash block(s) in ${relPath}:\n` +
          violations.map(v => `  Line ${v.lineNumber}: ${v.preview}`).join('\n')
      );
    });
  }
});

// ---------------------------------------------------------------------------
// FR-002: Single-Line Bash Convention in CLAUDE.md
// ---------------------------------------------------------------------------

describe('FR-002: CLAUDE.md Single-Line Bash Convention section', () => {
  const claudeMdPath = path.join(PROJECT_ROOT, 'CLAUDE.md');

  it('CLAUDE.md should exist', () => {
    assert.ok(fs.existsSync(claudeMdPath), `CLAUDE.md not found at ${claudeMdPath}`);
  });

  it('should contain "### Single-Line Bash Convention" heading', () => {
    const content = fs.readFileSync(claudeMdPath, 'utf8');
    assert.ok(
      content.includes('### Single-Line Bash Convention'),
      'Missing "### Single-Line Bash Convention" section in CLAUDE.md'
    );
  });

  it('should explain the glob newline limitation', () => {
    const content = fs.readFileSync(claudeMdPath, 'utf8');
    assert.ok(
      content.includes('does not match newline') || content.includes('does not match newlines') || content.includes('do not match newlines'),
      'Convention section should explain that glob * does not match newlines'
    );
  });

  it('should provide transformation examples', () => {
    const content = fs.readFileSync(claudeMdPath, 'utf8');
    // Must mention at least the for-loop and && patterns
    assert.ok(
      content.includes('for-loop') || content.includes('for loop') || content.includes('find | xargs'),
      'Convention section should mention for-loop transformation pattern'
    );
    assert.ok(
      content.includes('&&'),
      'Convention section should mention && chaining pattern'
    );
  });

  it('should mention the bin/ escape hatch', () => {
    const content = fs.readFileSync(claudeMdPath, 'utf8');
    assert.ok(
      content.includes('bin/') || content.includes('script file'),
      'Convention section should mention extracting to bin/ scripts as escape hatch'
    );
  });

  it('should include the reference format', () => {
    const content = fs.readFileSync(claudeMdPath, 'utf8');
    assert.ok(
      content.includes('Single-Line Bash Convention'),
      'Convention section should include reference format for other agent files'
    );
  });
});

// ---------------------------------------------------------------------------
// FR-004: Single-Line Bash Convention in CLAUDE.md.template
// ---------------------------------------------------------------------------

describe('FR-004: CLAUDE.md.template Single-Line Bash Convention section', () => {
  const templatePath = path.join(PROJECT_ROOT, 'src', 'claude', 'CLAUDE.md.template');

  it('CLAUDE.md.template should exist', () => {
    assert.ok(fs.existsSync(templatePath), `Template not found at ${templatePath}`);
  });

  it('should contain "### Single-Line Bash Convention" heading', () => {
    const content = fs.readFileSync(templatePath, 'utf8');
    assert.ok(
      content.includes('### Single-Line Bash Convention'),
      'Missing "### Single-Line Bash Convention" section in CLAUDE.md.template'
    );
  });

  it('should explain the glob newline limitation', () => {
    const content = fs.readFileSync(templatePath, 'utf8');
    assert.ok(
      content.includes('does not match newline') || content.includes('does not match newlines') || content.includes('do not match newlines'),
      'Template convention section should explain that glob * does not match newlines'
    );
  });

  it('should provide transformation examples', () => {
    const content = fs.readFileSync(templatePath, 'utf8');
    assert.ok(
      content.includes('&&'),
      'Template convention section should mention && chaining pattern'
    );
  });
});

// ---------------------------------------------------------------------------
// Negative tests: detection regex catches known multiline patterns
// ---------------------------------------------------------------------------

describe('Negative tests: hasMultilineBash catches known patterns', () => {
  it('should detect for-loop spread across lines', () => {
    const content = '```bash\nfor f in $(find . -name "*.ts"); do\n  grep "import" "$f"\ndone\n```';
    assert.ok(hasMultilineBash(content), 'Should detect multiline for-loop');
  });

  it('should detect commands separated by newlines', () => {
    const content = '```bash\nnpm install\nnpm test\n```';
    assert.ok(hasMultilineBash(content), 'Should detect newline-separated commands');
  });

  it('should detect comment-interleaved commands', () => {
    const content = '```bash\n# Step 1\nnpm install\n# Step 2\nnpm test\n```';
    assert.ok(hasMultilineBash(content), 'Should detect comment-interleaved commands');
  });

  it('should detect pipe chains split across lines', () => {
    const content = '```bash\ncat file.json |\n  jq ".data" |\n  head -5\n```';
    assert.ok(hasMultilineBash(content), 'Should detect split pipe chains');
  });

  it('should detect multiline node -e', () => {
    const content = '```bash\nnode -e "\n  const x = 1;\n  console.log(x);\n"\n```';
    assert.ok(hasMultilineBash(content), 'Should detect multiline node -e');
  });

  it('should detect sh code blocks too', () => {
    const content = '```sh\necho hello\necho world\n```';
    assert.ok(hasMultilineBash(content), 'Should detect multiline sh blocks');
  });
});

// ---------------------------------------------------------------------------
// Regression tests: non-Bash code blocks should NOT be flagged
// ---------------------------------------------------------------------------

describe('Regression tests: non-Bash code blocks not flagged', () => {
  it('should NOT flag JSON code blocks', () => {
    const content = '```json\n{\n  "key": "value",\n  "num": 42\n}\n```';
    assert.ok(!hasMultilineBash(content), 'JSON blocks should not be flagged');
  });

  it('should NOT flag TypeScript code blocks', () => {
    const content = '```typescript\nconst x = 1;\nconst y = 2;\nconsole.log(x + y);\n```';
    assert.ok(!hasMultilineBash(content), 'TypeScript blocks should not be flagged');
  });

  it('should NOT flag YAML code blocks', () => {
    const content = '```yaml\nname: test\nversion: 1.0\ndescription: hello\n```';
    assert.ok(!hasMultilineBash(content), 'YAML blocks should not be flagged');
  });

  it('should NOT flag plain code blocks (no language)', () => {
    const content = '```\nsome text\nmore text\n```';
    assert.ok(!hasMultilineBash(content), 'Plain code blocks should not be flagged');
  });

  it('should NOT flag JavaScript code blocks', () => {
    const content = '```javascript\nconst a = 1;\nconst b = 2;\n```';
    assert.ok(!hasMultilineBash(content), 'JavaScript blocks should not be flagged');
  });

  it('should NOT flag single-line Bash blocks', () => {
    const content = '```bash\nnpm test\n```';
    assert.ok(!hasMultilineBash(content), 'Single-line Bash blocks should not be flagged');
  });

  it('should NOT flag Bash blocks with only empty lines besides one command', () => {
    const content = '```bash\n\nnpm test\n\n```';
    assert.ok(!hasMultilineBash(content), 'Bash blocks with blank padding should not be flagged');
  });

  it('should NOT flag markdown code blocks', () => {
    const content = '```markdown\n# Heading\nSome text\n## Another heading\n```';
    assert.ok(!hasMultilineBash(content), 'Markdown blocks should not be flagged');
  });
});
