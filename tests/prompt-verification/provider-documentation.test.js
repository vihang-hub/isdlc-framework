/**
 * Prompt Content Verification Tests: REQ-0007 Documentation
 *
 * These tests verify that CLAUDE.md.template contains the required
 * Ollama/provider documentation sections per the requirements specification.
 *
 * Test runner: node:test (Article II)
 * Test approach: Read .md template file, assert content patterns
 *
 * Traces to: REQ-0007-ollama-local-llm-support
 * Module: M4 - Documentation
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ============================================================================
// Test Setup
// ============================================================================

const PROJECT_ROOT = join(import.meta.dirname, '..', '..');
const TEMPLATE_PATH = join(PROJECT_ROOT, 'src', 'claude', 'CLAUDE.md.template');

let templateContent;

before(() => {
    templateContent = readFileSync(TEMPLATE_PATH, 'utf-8');
});

// ============================================================================
// Tests
// ============================================================================

describe('TC-M4: CLAUDE.md.template Documentation Content', () => {

    // TC-M4-01: Contains Ollama quick-start section
    it('TC-M4-01: contains Ollama quick-start instructions', () => {
        assert.ok(
            templateContent.includes('ollama serve'),
            'Template should contain "ollama serve" instruction'
        );
        assert.ok(
            templateContent.includes('ollama pull'),
            'Template should contain "ollama pull" instruction'
        );
        // At least one recommended model name
        const hasRecommendedModel =
            templateContent.includes('qwen3-coder') ||
            templateContent.includes('glm-4.7');
        assert.ok(
            hasRecommendedModel,
            'Template should mention at least one recommended model (qwen3-coder or glm-4.7)'
        );
    });

    // TC-M4-02: Contains environment variable examples
    it('TC-M4-02: contains environment variable documentation', () => {
        assert.ok(
            templateContent.includes('ANTHROPIC_BASE_URL'),
            'Template should document ANTHROPIC_BASE_URL env var'
        );
        assert.ok(
            templateContent.includes('http://localhost:11434'),
            'Template should document Ollama localhost URL'
        );
        assert.ok(
            templateContent.includes('ANTHROPIC_AUTH_TOKEN'),
            'Template should document ANTHROPIC_AUTH_TOKEN env var'
        );
        assert.ok(
            templateContent.includes('ANTHROPIC_API_KEY'),
            'Template should document ANTHROPIC_API_KEY env var'
        );
    });

    // TC-M4-03: Contains recommended models table
    it('TC-M4-03: contains recommended models table with all 4 models', () => {
        assert.ok(
            templateContent.includes('qwen3-coder'),
            'Template should list qwen3-coder model'
        );
        assert.ok(
            templateContent.includes('glm-4.7'),
            'Template should list glm-4.7 model'
        );
        assert.ok(
            templateContent.includes('gpt-oss'),
            'Template should list gpt-oss models'
        );
        // Minimum context reference
        const hasContextRef =
            templateContent.includes('64k') ||
            templateContent.includes('65536') ||
            templateContent.includes('64,000');
        assert.ok(
            hasContextRef,
            'Template should reference 64k minimum context'
        );
    });

    // TC-M4-04: Contains known limitations section
    it('TC-M4-04: contains known limitations section', () => {
        assert.ok(
            templateContent.includes('multi-agent') || templateContent.includes('multi-phase'),
            'Template should mention multi-agent/multi-phase workflow limitations'
        );
        assert.ok(
            templateContent.includes('tool call') || templateContent.includes('Tool calling'),
            'Template should mention tool calling variability'
        );
        assert.ok(
            templateContent.includes('context') && (templateContent.includes('64k') || templateContent.includes('truncate')),
            'Template should mention context window requirements'
        );
        assert.ok(
            templateContent.includes('structured output') || templateContent.includes('JSON schema'),
            'Template should mention structured output reliability'
        );
    });

    // TC-M4-05: Contains auto-detection documentation
    it('TC-M4-05: contains auto-detection documentation', () => {
        const hasAutoDetect =
            templateContent.includes('auto-detect') ||
            templateContent.includes('Auto-detect') ||
            templateContent.includes('auto detect');
        assert.ok(
            hasAutoDetect,
            'Template should mention auto-detection'
        );
        // Should mention at least 2 of: environment variables, configuration, health probe
        let mentionCount = 0;
        if (templateContent.includes('Environment variable') || templateContent.includes('environment variable')) mentionCount++;
        if (templateContent.includes('configuration') || templateContent.includes('providers.yaml')) mentionCount++;
        if (templateContent.includes('Health probe') || templateContent.includes('health probe') || templateContent.includes('localhost:11434')) mentionCount++;
        assert.ok(
            mentionCount >= 2,
            `Template should mention at least 2 detection methods, found ${mentionCount}`
        );
    });

    // TC-M4-06: Mentions /provider command
    it('TC-M4-06: mentions /provider command', () => {
        assert.ok(
            templateContent.includes('/provider'),
            'Template should mention /provider command'
        );
    });
});
