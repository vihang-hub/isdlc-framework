/**
 * Tests for provider configuration validation
 *
 * Traces to: REQ-001, REQ-002, REQ-005, AC-003-01, AC-004-01
 * Module: M3 - Provider Configuration
 *
 * Test runner: node --test
 * 9 test cases covering provider-defaults.yaml content,
 * model validation, and context window thresholds.
 *
 * Note: These tests validate the YAML content directly rather than
 * relying on parseYaml() because the minimal YAML parser has known
 * limitations with deeply nested array-of-object structures.
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { parseYaml } = require('../lib/provider-utils.cjs');

// ============================================================================
// Test Setup: Load provider-defaults.yaml and extract model data
// ============================================================================

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'provider-defaults.yaml');
const PROVIDER_MD_PATH = path.join(__dirname, '..', '..', 'commands', 'provider.md');

let yamlContent;
let config;
let ollamaModels;
let providerMdContent;

/**
 * Extract Ollama model blocks from raw YAML content.
 * Works around parseYaml() limitations with complex nested arrays.
 * Uses simple string indexing for reliable extraction.
 * @param {string} yaml - Raw YAML content
 * @returns {Array<object>} Array of model objects with id, alias, context_window, capabilities, cost_tier, min_vram_gb
 */
function extractOllamaModels(yaml) {
    // Find the ollama section boundaries
    const ollamaStart = yaml.indexOf('  ollama:');
    if (ollamaStart === -1) return [];

    // Find next top-level provider section (2-space indent)
    const nextProviderStart = yaml.indexOf('\n  openrouter:', ollamaStart);
    const ollamaSection = nextProviderStart !== -1
        ? yaml.substring(ollamaStart, nextProviderStart)
        : yaml.substring(ollamaStart);

    // Extract from 'models:' to 'health_check:'
    const modelsStart = ollamaSection.indexOf('models:');
    if (modelsStart === -1) return [];
    const healthCheckStart = ollamaSection.indexOf('health_check:', modelsStart);
    const modelsSection = healthCheckStart !== -1
        ? ollamaSection.substring(modelsStart, healthCheckStart)
        : ollamaSection.substring(modelsStart);

    // Split into individual model blocks (each starts with "- id:")
    const modelBlocks = modelsSection.split(/(?=\s*- id:)/g).filter(b => b.includes('- id:'));

    return modelBlocks.map(block => {
        const id = block.match(/id:\s*"?([^"\n]+)"?/)?.[1]?.trim();
        const alias = block.match(/alias:\s*"?([^"\n]+)"?/)?.[1]?.trim();
        const contextWindow = parseInt(block.match(/context_window:\s*(\d+)/)?.[1] || '0', 10);
        const costTier = block.match(/cost_tier:\s*"?([^"\n]+)"?/)?.[1]?.trim();
        const minVramGb = parseInt(block.match(/min_vram_gb:\s*(\d+)/)?.[1] || '0', 10);

        // Extract capabilities array -- match lines like "          - coding"
        const capsMatch = block.match(/capabilities:\s*\n((?:\s+- .+\n?)*)/);
        const capabilities = capsMatch
            ? (capsMatch[1].match(/- (\w+)/g) || []).map(c => c.replace('- ', ''))
            : [];

        return { id, alias, context_window: contextWindow, capabilities, cost_tier: costTier, min_vram_gb: minVramGb };
    });
}

before(() => {
    yamlContent = fs.readFileSync(CONFIG_PATH, 'utf8');
    config = parseYaml(yamlContent);
    ollamaModels = extractOllamaModels(yamlContent);
    providerMdContent = fs.readFileSync(PROVIDER_MD_PATH, 'utf8');
});

// ============================================================================
// Tests
// ============================================================================

describe('Provider Configuration Validation', () => {

    // TC-M3-01: All Ollama models have context_window >= 65536
    it('TC-M3-01: all Ollama models have context_window >= 65536 (64k minimum)', () => {
        assert.ok(ollamaModels.length > 0, 'Should have at least one Ollama model');
        for (const model of ollamaModels) {
            assert.ok(
                model.context_window >= 65536,
                `Model ${model.id} has context_window ${model.context_window}, expected >= 65536`
            );
        }
    });

    // TC-M3-02: All Ollama models include 'coding' capability
    it('TC-M3-02: all Ollama models include coding capability', () => {
        for (const model of ollamaModels) {
            assert.ok(
                model.capabilities.includes('coding'),
                `Model ${model.id} should have 'coding' capability, has: ${JSON.stringify(model.capabilities)}`
            );
        }
    });

    // TC-M3-03: Model IDs are valid Ollama tags
    it('TC-M3-03: model IDs are valid Ollama tag format', () => {
        const validTagPattern = /^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/;
        for (const model of ollamaModels) {
            assert.ok(
                validTagPattern.test(model.id),
                `Model ID '${model.id}' does not match valid Ollama tag pattern`
            );
        }
    });

    // TC-M3-04: Model aliases are unique and valid format
    it('TC-M3-04: model aliases are unique and in valid format', () => {
        const validAliasPattern = /^[a-z0-9][a-z0-9-]*$/;
        const seen = new Set();

        for (const model of ollamaModels) {
            assert.ok(
                !seen.has(model.alias),
                `Duplicate alias '${model.alias}' found for model ${model.id}`
            );
            seen.add(model.alias);

            assert.ok(
                validAliasPattern.test(model.alias),
                `Ollama alias '${model.alias}' does not match valid format /^[a-z0-9][a-z0-9-]*$/`
            );
        }
    });

    // TC-M3-05: Ollama models have required fields
    it('TC-M3-05: all Ollama models have required fields (id, alias, context_window, capabilities, cost_tier, min_vram_gb)', () => {
        for (const model of ollamaModels) {
            assert.ok(model.id, `Model is missing 'id' field`);
            assert.ok(model.alias, `Model ${model.id} is missing 'alias' field`);
            assert.ok(model.context_window > 0, `Model ${model.id} is missing or has invalid 'context_window'`);
            assert.ok(model.capabilities.length > 0, `Model ${model.id} is missing 'capabilities'`);
            assert.ok(model.cost_tier, `Model ${model.id} is missing 'cost_tier'`);
            assert.ok(model.min_vram_gb > 0, `Model ${model.id} is missing or has invalid 'min_vram_gb'`);

            // cost_tier should be 'free' for all Ollama models
            assert.equal(
                model.cost_tier, 'free',
                `Model ${model.id} cost_tier should be 'free', got '${model.cost_tier}'`
            );
            // min_vram_gb should be a positive integer
            assert.ok(
                Number.isInteger(model.min_vram_gb) && model.min_vram_gb > 0,
                `Model ${model.id} min_vram_gb should be a positive integer, got ${model.min_vram_gb}`
            );
        }
    });

    // TC-M3-06: Recommended models are present, deprecated models removed
    it('TC-M3-06: recommended models present and deprecated models removed', () => {
        const modelIds = ollamaModels.map(m => m.id);

        // Required new models
        const requiredModels = ['qwen3-coder', 'glm-4.7', 'gpt-oss:20b', 'gpt-oss:120b'];
        for (const reqModel of requiredModels) {
            assert.ok(
                modelIds.includes(reqModel),
                `Required model '${reqModel}' not found in Ollama models. Found: ${JSON.stringify(modelIds)}`
            );
        }

        // Deprecated models should NOT be present
        const deprecatedModels = ['deepseek-coder-v2:16b', 'codellama:34b', 'qwen2.5-coder:14b'];
        for (const depModel of deprecatedModels) {
            assert.ok(
                !modelIds.includes(depModel),
                `Deprecated model '${depModel}' should not be in Ollama models`
            );
        }
    });

    // TC-M3-07: provider.md has user_invocable: true
    it('TC-M3-07: provider.md has user_invocable: true and no disabled note', () => {
        // Check user_invocable in frontmatter
        assert.ok(
            providerMdContent.includes('user_invocable: true'),
            'provider.md should have user_invocable: true'
        );
        assert.ok(
            !providerMdContent.includes('user_invocable: false'),
            'provider.md should NOT have user_invocable: false'
        );
        // Check description does NOT contain "(currently disabled)"
        assert.ok(
            !providerMdContent.includes('(currently disabled'),
            'provider.md description should not contain "(currently disabled)"'
        );
    });

    // TC-M3-08: Ollama health check config is correct
    it('TC-M3-08: Ollama health check has correct endpoint and timeout', () => {
        const ollamaConfig = config.providers?.ollama;
        assert.ok(ollamaConfig, 'Ollama provider should exist in config');
        assert.equal(
            ollamaConfig.health_check?.endpoint, '/api/tags',
            'Ollama health check endpoint should be /api/tags'
        );
        assert.equal(
            ollamaConfig.health_check?.timeout_ms, 2000,
            'Ollama health check timeout should be 2000ms'
        );
    });

    // TC-M3-09: Exactly 4 Ollama models configured (REQ-0007 spec)
    it('TC-M3-09: exactly 4 Ollama models are configured', () => {
        assert.equal(
            ollamaModels.length, 4,
            `Expected exactly 4 Ollama models, found ${ollamaModels.length}: ${ollamaModels.map(m => m.id).join(', ')}`
        );
    });
});
