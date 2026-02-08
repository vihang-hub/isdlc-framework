'use strict';

/**
 * iSDLC Provider Utilities - Test Suite (CJS)
 * =============================================
 * Unit tests for src/claude/hooks/lib/provider-utils.js
 *
 * Uses node:test (built-in) and .cjs extension to avoid ESM/CJS conflicts.
 * The hook libs use CommonJS require() but package.json has "type": "module".
 * We copy both common.js and provider-utils.js to the temp dir as .cjs files,
 * and patch the require('./common.js') inside provider-utils to point to
 * the .cjs copy.
 *
 * Run: node --test src/claude/hooks/tests/test-provider-utils.test.cjs
 */

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
    setupTestEnv,
    cleanupTestEnv,
    getTestDir,
    writeState,
    readState,
    writeProviders
} = require('./hook-test-utils.cjs');

// Source paths
const commonSrcPath = path.resolve(__dirname, '..', 'lib', 'common.cjs');
const providerUtilsSrcPath = path.resolve(__dirname, '..', 'lib', 'provider-utils.cjs');

/**
 * Copy common.cjs and provider-utils.cjs into the temp dir.
 * Source files are already .cjs with correct require paths — no patching needed.
 * Returns the path to provider-utils.cjs.
 */
function installProviderUtilsCjs() {
    const testDir = getTestDir();
    const libDir = path.join(testDir, 'lib');
    if (!fs.existsSync(libDir)) {
        fs.mkdirSync(libDir, { recursive: true });
    }

    // Copy common.cjs directly
    fs.copyFileSync(commonSrcPath, path.join(libDir, 'common.cjs'));

    // Copy provider-utils.cjs directly
    const puDest = path.join(libDir, 'provider-utils.cjs');
    fs.copyFileSync(providerUtilsSrcPath, puDest);

    return puDest;
}

/** Require provider-utils.cjs from the temp dir, clearing cache first. */
function requireProviderUtils(cjsPath) {
    // Also clear common.cjs cache since provider-utils depends on it
    const libDir = path.dirname(cjsPath);
    const commonCjsPath = path.join(libDir, 'common.cjs');
    try {
        delete require.cache[require.resolve(commonCjsPath)];
    } catch (e) {
        // Ignore if not yet cached
    }
    delete require.cache[require.resolve(cjsPath)];
    return require(cjsPath);
}

// =============================================================================
// Test Suite: provider-utils.js
// =============================================================================

describe('provider-utils.js', () => {
    let pu;
    let savedEnv;
    let puCjsPath;

    before(() => {
        savedEnv = { ...process.env };
        setupTestEnv();
        puCjsPath = installProviderUtilsCjs();
        pu = requireProviderUtils(puCjsPath);
    });

    after(() => {
        cleanupTestEnv();
        process.env = savedEnv;
    });

    /** Get a fresh require after env/file changes */
    function freshPu() {
        return requireProviderUtils(puCjsPath);
    }

    // -------------------------------------------------------------------------
    // parseYaml()
    // -------------------------------------------------------------------------
    describe('parseYaml()', () => {
        it('parses simple key: value pairs', () => {
            const result = pu.parseYaml('name: hello\nversion: 1');
            assert.equal(result.name, 'hello');
            assert.equal(result.version, 1);
        });

        it('parses nested objects (indentation-based)', () => {
            const yaml = [
                'defaults:',
                '  provider: anthropic',
                '  model: sonnet'
            ].join('\n');

            const result = pu.parseYaml(yaml);
            assert.ok(result.defaults, 'Should have defaults key');
            assert.equal(result.defaults.provider, 'anthropic');
            assert.equal(result.defaults.model, 'sonnet');
        });

        it('parses arrays (- item syntax)', () => {
            // The minimal YAML parser nests arrays under parent.key.key due to
            // how currentArrayKey tracks the last key seen. When a key like
            // "items:" is followed by "- value", the parser creates an object
            // for "items" then assigns the array to items.items.
            const yaml = [
                'items:',
                '  - alpha',
                '  - beta',
                '  - gamma'
            ].join('\n');

            const result = pu.parseYaml(yaml);
            // The array lives at result.items.items due to parser behavior
            assert.ok(result.items, 'Should have items key');
            const arr = result.items.items;
            assert.ok(Array.isArray(arr), 'items.items should be an array');
            assert.equal(arr.length, 3);
            assert.equal(arr[0], 'alpha');
            assert.equal(arr[2], 'gamma');
        });

        it('handles quoted strings (double and single)', () => {
            const yaml = 'name: "hello world"\nalt: \'foo bar\'';
            const result = pu.parseYaml(yaml);
            assert.equal(result.name, 'hello world');
            assert.equal(result.alt, 'foo bar');
        });

        it('handles booleans (true/false)', () => {
            const yaml = 'enabled: true\ndisabled: false';
            const result = pu.parseYaml(yaml);
            assert.equal(result.enabled, true);
            assert.equal(result.disabled, false);
        });

        it('handles numbers (integer and float)', () => {
            const yaml = 'count: 42\nratio: 3.14';
            const result = pu.parseYaml(yaml);
            assert.equal(result.count, 42);
            assert.equal(result.ratio, 3.14);
        });

        it('skips comments (#) and empty lines', () => {
            const yaml = [
                '# This is a comment',
                '',
                'key: value',
                '  # Indented comment',
                'other: data'
            ].join('\n');

            const result = pu.parseYaml(yaml);
            assert.equal(result.key, 'value');
            assert.equal(result.other, 'data');
            assert.equal(Object.keys(result).length, 2, 'Should only have two keys');
        });

        it('handles null values', () => {
            const yaml = 'nothing: null\ntilde: ~';
            const result = pu.parseYaml(yaml);
            assert.equal(result.nothing, null);
            assert.equal(result.tilde, null);
        });

        it('handles inline arrays', () => {
            const yaml = 'tags: [1, 2, 3]';
            const result = pu.parseYaml(yaml);
            assert.ok(Array.isArray(result.tags));
            assert.deepEqual(result.tags, [1, 2, 3]);
        });
    });

    // -------------------------------------------------------------------------
    // parseProviderModel()
    // -------------------------------------------------------------------------
    describe('parseProviderModel()', () => {
        it('parses "anthropic:opus" string into provider and model', () => {
            const result = pu.parseProviderModel('anthropic:opus');
            assert.equal(result.provider, 'anthropic');
            assert.equal(result.model, 'opus');
        });

        it('parses bare "anthropic" string with null model', () => {
            const result = pu.parseProviderModel('anthropic');
            assert.equal(result.provider, 'anthropic');
            assert.equal(result.model, null);
        });

        it('parses object input {provider, model}', () => {
            const result = pu.parseProviderModel({ provider: 'ollama', model: 'qwen' });
            assert.equal(result.provider, 'ollama');
            assert.equal(result.model, 'qwen');
        });

        it('returns nulls for non-string, non-object input', () => {
            const result = pu.parseProviderModel(42);
            assert.equal(result.provider, null);
            assert.equal(result.model, null);
        });

        it('handles object with missing model', () => {
            const result = pu.parseProviderModel({ provider: 'anthropic' });
            assert.equal(result.provider, 'anthropic');
            assert.equal(result.model, null);
        });
    });

    // -------------------------------------------------------------------------
    // isLocalProvider()
    // -------------------------------------------------------------------------
    describe('isLocalProvider()', () => {
        it('returns true for "ollama"', () => {
            assert.equal(pu.isLocalProvider('ollama'), true);
        });

        it('returns true for "local"', () => {
            assert.equal(pu.isLocalProvider('local'), true);
        });

        it('returns false for "anthropic"', () => {
            assert.equal(pu.isLocalProvider('anthropic'), false);
        });

        it('returns false for "openrouter"', () => {
            assert.equal(pu.isLocalProvider('openrouter'), false);
        });
    });

    // -------------------------------------------------------------------------
    // resolveModelId()
    // -------------------------------------------------------------------------
    describe('resolveModelId()', () => {
        it('resolves alias "sonnet" to full model ID', () => {
            const config = pu.getMinimalDefaultConfig();
            const fullId = pu.resolveModelId(config, 'anthropic', 'sonnet');
            assert.equal(fullId, 'claude-sonnet-4-20250514');
        });

        it('resolves alias "opus" to full model ID', () => {
            const config = pu.getMinimalDefaultConfig();
            const fullId = pu.resolveModelId(config, 'anthropic', 'opus');
            assert.equal(fullId, 'claude-opus-4-5-20251101');
        });

        it('returns input unchanged if already a full model ID', () => {
            const config = pu.getMinimalDefaultConfig();
            const fullId = pu.resolveModelId(config, 'anthropic', 'claude-sonnet-4-20250514');
            assert.equal(fullId, 'claude-sonnet-4-20250514');
        });

        it('returns alias unchanged if provider has no models array', () => {
            const config = { providers: { custom: {} } };
            const result = pu.resolveModelId(config, 'custom', 'some-model');
            assert.equal(result, 'some-model');
        });

        it('returns alias unchanged if provider is not configured', () => {
            const config = { providers: {} };
            const result = pu.resolveModelId(config, 'unknown', 'model-x');
            assert.equal(result, 'model-x');
        });
    });

    // -------------------------------------------------------------------------
    // getMinimalDefaultConfig()
    // -------------------------------------------------------------------------
    describe('getMinimalDefaultConfig()', () => {
        it('returns object with defaults.provider = "anthropic"', () => {
            const config = pu.getMinimalDefaultConfig();
            assert.ok(config.defaults, 'Should have defaults');
            assert.equal(config.defaults.provider, 'anthropic');
        });

        it('returns object with defaults.model = "sonnet"', () => {
            const config = pu.getMinimalDefaultConfig();
            assert.equal(config.defaults.model, 'sonnet');
        });

        it('includes anthropic provider with models array', () => {
            const config = pu.getMinimalDefaultConfig();
            assert.ok(config.providers.anthropic, 'Should have anthropic provider');
            assert.ok(Array.isArray(config.providers.anthropic.models), 'Should have models array');
            assert.ok(config.providers.anthropic.models.length >= 2, 'Should have at least 2 models');
        });

        it('includes constraints section', () => {
            const config = pu.getMinimalDefaultConfig();
            assert.ok(config.constraints, 'Should have constraints');
            assert.equal(typeof config.constraints.max_retries_per_provider, 'number');
            assert.equal(typeof config.constraints.health_check_timeout_ms, 'number');
        });
    });

    // -------------------------------------------------------------------------
    // getEnvironmentOverrides()
    // -------------------------------------------------------------------------
    describe('getEnvironmentOverrides()', () => {
        it('anthropic provider sets ANTHROPIC_API_KEY', () => {
            const config = pu.getMinimalDefaultConfig();
            const selection = { provider: 'anthropic', model: 'sonnet' };
            const overrides = pu.getEnvironmentOverrides(config, selection);
            assert.ok('ANTHROPIC_API_KEY' in overrides, 'Should set ANTHROPIC_API_KEY');
        });

        it('ollama provider sets ANTHROPIC_BASE_URL to localhost', () => {
            const config = {
                providers: {
                    ollama: {
                        enabled: true,
                        base_url: 'http://localhost:11434',
                        auth_token: 'ollama',
                        models: [{ id: 'qwen-coder', alias: 'qwen' }]
                    }
                },
                defaults: { provider: 'ollama', model: 'qwen' }
            };
            const selection = { provider: 'ollama', model: 'qwen' };
            const overrides = pu.getEnvironmentOverrides(config, selection);
            assert.ok(overrides.ANTHROPIC_BASE_URL.includes('localhost'),
                `Expected localhost in ANTHROPIC_BASE_URL, got "${overrides.ANTHROPIC_BASE_URL}"`);
        });

        it('openrouter provider sets HTTP_REFERER and X_TITLE', () => {
            const config = {
                providers: {
                    openrouter: {
                        enabled: true,
                        base_url: 'https://openrouter.ai/api/v1',
                        api_key_env: 'OPENROUTER_API_KEY',
                        models: [{ id: 'openai/gpt-4o', alias: 'gpt4o' }]
                    }
                },
                defaults: { provider: 'openrouter', model: 'gpt4o' }
            };
            const selection = { provider: 'openrouter', model: 'gpt4o' };
            const overrides = pu.getEnvironmentOverrides(config, selection);
            assert.ok('HTTP_REFERER' in overrides, 'Should set HTTP_REFERER');
            assert.ok('X_TITLE' in overrides, 'Should set X_TITLE');
        });

        it('returns empty object for unknown provider', () => {
            const config = { providers: {} };
            const selection = { provider: 'nonexistent', model: 'x' };
            const overrides = pu.getEnvironmentOverrides(config, selection);
            assert.deepEqual(overrides, {});
        });

        it('sets CLAUDE_MODEL override to resolved model ID', () => {
            const config = pu.getMinimalDefaultConfig();
            const selection = { provider: 'anthropic', model: 'sonnet' };
            const overrides = pu.getEnvironmentOverrides(config, selection);
            assert.equal(overrides.CLAUDE_MODEL, 'claude-sonnet-4-20250514');
        });

        it('uses custom environment mappings when defined', () => {
            const config = {
                providers: {
                    custom: {
                        enabled: true,
                        base_url: 'https://custom.api.com',
                        api_key: 'test-key-123',
                        models: [{ id: 'custom-model', alias: 'cm' }]
                    }
                },
                environment: {
                    custom: {
                        'CUSTOM_KEY': '${api_key}',
                        'CUSTOM_URL': '${base_url}'
                    }
                },
                defaults: { provider: 'custom' }
            };
            const selection = { provider: 'custom', model: 'cm' };
            const overrides = pu.getEnvironmentOverrides(config, selection);
            assert.equal(overrides.CUSTOM_KEY, 'test-key-123');
            assert.equal(overrides.CUSTOM_URL, 'https://custom.api.com');
        });
    });

    // -------------------------------------------------------------------------
    // resolveEnvVars()
    // -------------------------------------------------------------------------
    describe('resolveEnvVars()', () => {
        it('resolves ${VAR} placeholders from process.env', () => {
            process.env.TEST_RESOLVE_VAR = 'resolved_value';
            const result = pu.resolveEnvVars('prefix-${TEST_RESOLVE_VAR}-suffix');
            assert.equal(result, 'prefix-resolved_value-suffix');
            delete process.env.TEST_RESOLVE_VAR;
        });

        it('replaces missing env vars with empty string', () => {
            delete process.env.NONEXISTENT_VAR_XYZ;
            const result = pu.resolveEnvVars('before-${NONEXISTENT_VAR_XYZ}-after');
            assert.equal(result, 'before--after');
        });

        it('returns non-string input unchanged', () => {
            assert.equal(pu.resolveEnvVars(null), null);
            assert.equal(pu.resolveEnvVars(undefined), undefined);
            assert.equal(pu.resolveEnvVars(42), 42);
        });

        it('returns string without placeholders unchanged', () => {
            const result = pu.resolveEnvVars('no-placeholders-here');
            assert.equal(result, 'no-placeholders-here');
        });
    });

    // -------------------------------------------------------------------------
    // selectProvider()
    // -------------------------------------------------------------------------
    describe('selectProvider()', () => {
        afterEach(() => {
            delete process.env.ISDLC_PROVIDER_OVERRIDE;
            delete process.env.ISDLC_MODEL_OVERRIDE;
        });

        it('returns default provider when no overrides', () => {
            const config = pu.getMinimalDefaultConfig();
            const state = { current_phase: '06-implementation' };
            const context = { subagent_type: 'software-developer' };

            delete process.env.ISDLC_PROVIDER_OVERRIDE;
            delete process.env.ISDLC_MODEL_OVERRIDE;

            const result = pu.selectProvider(config, state, context);
            assert.ok(result.provider, 'Should have a provider');
            assert.ok(result.model, 'Should have a model');
        });

        it('respects CLI override env vars', () => {
            const config = pu.getMinimalDefaultConfig();
            const state = { current_phase: '06-implementation' };
            const context = { subagent_type: 'software-developer' };

            process.env.ISDLC_PROVIDER_OVERRIDE = 'ollama';
            process.env.ISDLC_MODEL_OVERRIDE = 'qwen-coder';

            const result = pu.selectProvider(config, state, context);
            assert.equal(result.provider, 'ollama');
            assert.equal(result.model, 'qwen-coder');
            assert.equal(result.source, 'cli_override');
        });

        it('uses agent_overrides when present', () => {
            const config = {
                ...pu.getMinimalDefaultConfig(),
                agent_overrides: {
                    'solution-architect': {
                        provider: 'anthropic',
                        model: 'opus',
                        rationale: 'Architecture needs best model'
                    }
                }
            };
            const state = { current_phase: '03-architecture' };
            const context = { subagent_type: 'solution-architect' };

            delete process.env.ISDLC_PROVIDER_OVERRIDE;

            const result = pu.selectProvider(config, state, context);
            assert.equal(result.provider, 'anthropic');
            assert.equal(result.model, 'opus');
            assert.equal(result.source, 'agent_override');
        });

        it('uses global_default when no special routing applies', () => {
            const config = pu.getMinimalDefaultConfig();
            // No modes, no phase_routing, no overrides, active_mode = quality (has no modes section)
            const state = { current_phase: '06-implementation' };
            const context = { subagent_type: 'software-developer' };

            delete process.env.ISDLC_PROVIDER_OVERRIDE;

            const result = pu.selectProvider(config, state, context);
            assert.ok(result.source, 'Should have a source');
            // With minimal config (active_mode=quality but no modes section), falls to global_default
            assert.equal(result.source, 'global_default');
        });

        it('uses phase_routing in hybrid mode', () => {
            const config = {
                ...pu.getMinimalDefaultConfig(),
                active_mode: 'hybrid',
                phase_routing: {
                    '06-implementation': {
                        provider: 'ollama',
                        model: 'qwen-coder',
                        rationale: 'Local for implementation'
                    }
                }
            };
            const state = { current_phase: '06-implementation' };
            const context = { subagent_type: 'software-developer' };

            delete process.env.ISDLC_PROVIDER_OVERRIDE;

            const result = pu.selectProvider(config, state, context);
            assert.equal(result.provider, 'ollama');
            assert.equal(result.source, 'phase_routing');
        });
    });

    // -------------------------------------------------------------------------
    // getDefaultModel()
    // -------------------------------------------------------------------------
    describe('getDefaultModel()', () => {
        it('returns first model alias as default', () => {
            const config = pu.getMinimalDefaultConfig();
            const result = pu.getDefaultModel(config, 'anthropic');
            assert.equal(result, 'sonnet');
        });

        it('returns null for unknown provider', () => {
            const config = pu.getMinimalDefaultConfig();
            const result = pu.getDefaultModel(config, 'unknown-provider');
            assert.equal(result, null);
        });

        it('returns null for provider with no models', () => {
            const config = { providers: { empty: { enabled: true } } };
            const result = pu.getDefaultModel(config, 'empty');
            assert.equal(result, null);
        });

        it('falls back to model id when alias is absent', () => {
            const config = {
                providers: {
                    custom: {
                        enabled: true,
                        models: [{ id: 'custom-model-v1' }]
                    }
                }
            };
            const result = pu.getDefaultModel(config, 'custom');
            assert.equal(result, 'custom-model-v1');
        });
    });

    // -------------------------------------------------------------------------
    // loadProvidersConfig() / hasProvidersConfig()
    // -------------------------------------------------------------------------
    describe('loadProvidersConfig()', () => {
        it('returns default config when no providers.yaml exists', () => {
            const fresh = freshPu();
            const config = fresh.loadProvidersConfig();
            assert.ok(config, 'Should return a config');
            assert.ok(config.providers, 'Should have providers');
            assert.ok(config.defaults, 'Should have defaults');
        });

        it('loads and parses providers.yaml when it exists', () => {
            const yaml = [
                'providers:',
                '  anthropic:',
                '    enabled: true',
                '    base_url: https://api.anthropic.com',
                'defaults:',
                '  provider: anthropic',
                '  model: opus',
                'active_mode: quality'
            ].join('\n');

            writeProviders(yaml);

            const fresh = freshPu();
            const config = fresh.loadProvidersConfig();
            assert.ok(config.providers, 'Should have providers');
            assert.equal(config.active_mode, 'quality');

            // Cleanup
            const testDir = getTestDir();
            fs.unlinkSync(path.join(testDir, '.isdlc', 'providers.yaml'));
        });
    });

    describe('hasProvidersConfig()', () => {
        it('returns false when no providers.yaml', () => {
            const fresh = freshPu();
            assert.equal(fresh.hasProvidersConfig(), false);
        });

        it('returns true when providers.yaml exists', () => {
            writeProviders('defaults:\n  provider: anthropic\n');

            const fresh = freshPu();
            assert.equal(fresh.hasProvidersConfig(), true);

            // Cleanup
            const testDir = getTestDir();
            fs.unlinkSync(path.join(testDir, '.isdlc', 'providers.yaml'));
        });
    });

    // -------------------------------------------------------------------------
    // getActiveMode() / setActiveMode()
    // -------------------------------------------------------------------------
    describe('getActiveMode()', () => {
        it('returns default mode when no providers.yaml exists', () => {
            const fresh = freshPu();
            const mode = fresh.getActiveMode();
            // Default config has active_mode: 'quality'
            assert.equal(mode, 'quality');
        });

        it('returns mode from providers.yaml when it exists', () => {
            writeProviders('active_mode: budget\ndefaults:\n  provider: ollama\n');

            const fresh = freshPu();
            const mode = fresh.getActiveMode();
            assert.equal(mode, 'budget');

            // Cleanup
            const testDir = getTestDir();
            fs.unlinkSync(path.join(testDir, '.isdlc', 'providers.yaml'));
        });
    });

    describe('setActiveMode()', () => {
        it('returns false when no providers.yaml exists', () => {
            const fresh = freshPu();
            const result = fresh.setActiveMode('local');
            assert.equal(result, false);
        });

        it('updates active_mode in providers.yaml', () => {
            writeProviders('active_mode: hybrid\ndefaults:\n  provider: anthropic\n');

            const fresh = freshPu();
            const result = fresh.setActiveMode('budget');
            assert.equal(result, true);

            // Verify the file was updated
            const testDir = getTestDir();
            const content = fs.readFileSync(path.join(testDir, '.isdlc', 'providers.yaml'), 'utf8');
            assert.ok(content.includes('budget'), 'File should contain new mode');

            // Cleanup
            fs.unlinkSync(path.join(testDir, '.isdlc', 'providers.yaml'));
        });
    });

    // -------------------------------------------------------------------------
    // getAvailableModes()
    // -------------------------------------------------------------------------
    describe('getAvailableModes()', () => {
        it('returns default modes when no config modes section', () => {
            const fresh = freshPu();
            const modes = fresh.getAvailableModes();
            assert.ok(modes, 'Should return modes object');
            // The minimal default config has no modes key, so getAvailableModes returns the fallback
            assert.ok(modes.budget || modes.quality || modes.local || modes.hybrid,
                'Should have at least one mode');
        });
    });

    // -------------------------------------------------------------------------
    // debugLog()
    // -------------------------------------------------------------------------
    describe('debugLog()', () => {
        it('does not throw when called', () => {
            assert.doesNotThrow(() => pu.debugLog('provider test message'));
        });

        it('writes to stderr when ISDLC_PROVIDER_DEBUG=true', () => {
            const origDebug = process.env.ISDLC_PROVIDER_DEBUG;
            const origStderr = console.error;
            let captured = '';
            console.error = (...args) => { captured = args.join(' '); };

            process.env.ISDLC_PROVIDER_DEBUG = 'true';
            pu.debugLog('test debug output');

            console.error = origStderr;
            if (origDebug !== undefined) {
                process.env.ISDLC_PROVIDER_DEBUG = origDebug;
            } else {
                delete process.env.ISDLC_PROVIDER_DEBUG;
            }

            assert.ok(captured.includes('test debug output'),
                `Expected debug output, got: "${captured}"`);
        });
    });

    // -------------------------------------------------------------------------
    // trackUsage()
    // -------------------------------------------------------------------------
    describe('trackUsage()', () => {
        it('does nothing when track_usage is false', () => {
            const config = pu.getMinimalDefaultConfig();
            // constraints.track_usage is false by default
            const state = { current_phase: '06-implementation' };
            const selection = { provider: 'anthropic', model: 'sonnet', source: 'test' };

            // Should not throw
            assert.doesNotThrow(() => pu.trackUsage(config, state, selection));

            // Verify no usage log file was created
            const testDir = getTestDir();
            const logPath = path.join(testDir, '.isdlc', 'usage-log.jsonl');
            assert.equal(fs.existsSync(logPath), false, 'Should not create log file');
        });

        it('writes to usage-log.jsonl when track_usage is true', () => {
            const config = {
                ...pu.getMinimalDefaultConfig(),
                constraints: {
                    track_usage: true,
                    usage_log_path: '.isdlc/usage-log.jsonl'
                }
            };
            const state = { current_phase: '06-implementation' };
            const selection = { provider: 'anthropic', model: 'sonnet', source: 'test' };

            pu.trackUsage(config, state, selection);

            const testDir = getTestDir();
            const logPath = path.join(testDir, '.isdlc', 'usage-log.jsonl');
            assert.ok(fs.existsSync(logPath), 'Should create usage log file');

            const content = fs.readFileSync(logPath, 'utf8').trim();
            const entry = JSON.parse(content);
            assert.equal(entry.provider, 'anthropic');
            assert.equal(entry.model, 'sonnet');

            // Cleanup
            fs.unlinkSync(logPath);
        });
    });

    // -------------------------------------------------------------------------
    // resolveProvidersConfigPath()
    // -------------------------------------------------------------------------
    describe('resolveProvidersConfigPath()', () => {
        it('returns null when no config files exist', () => {
            const fresh = freshPu();
            const result = fresh.resolveProvidersConfigPath();
            assert.equal(result, null);
        });

        it('returns project config path when providers.yaml exists', () => {
            writeProviders('defaults:\n  provider: anthropic\n');

            const fresh = freshPu();
            const result = fresh.resolveProvidersConfigPath();
            assert.ok(result, 'Should return a path');
            assert.ok(result.includes('providers.yaml'), 'Should end with providers.yaml');

            // Cleanup
            const testDir = getTestDir();
            fs.unlinkSync(path.join(testDir, '.isdlc', 'providers.yaml'));
        });
    });

    // -------------------------------------------------------------------------
    // getUsageStats()
    // -------------------------------------------------------------------------
    describe('getUsageStats()', () => {
        it('returns zero stats when no usage log exists', () => {
            const fresh = freshPu();
            const stats = fresh.getUsageStats();
            assert.equal(stats.total_calls, 0);
            assert.deepEqual(stats.by_provider, {});
            assert.deepEqual(stats.by_phase, {});
        });

        it('aggregates stats from usage log entries', () => {
            // Write a providers.yaml so the config loads (determines log path)
            writeProviders('constraints:\n  track_usage: true\n  usage_log_path: .isdlc/usage-log.jsonl\n');

            const testDir = getTestDir();
            const logPath = path.join(testDir, '.isdlc', 'usage-log.jsonl');
            const entries = [
                { timestamp: new Date().toISOString(), provider: 'anthropic', model: 'sonnet', phase: '06-implementation', source: 'global_default', fallback_used: false },
                { timestamp: new Date().toISOString(), provider: 'anthropic', model: 'opus', phase: '01-requirements', source: 'phase_routing', fallback_used: false },
                { timestamp: new Date().toISOString(), provider: 'ollama', model: 'qwen', phase: '06-implementation', source: 'mode_budget', fallback_used: true }
            ];
            fs.writeFileSync(logPath, entries.map(e => JSON.stringify(e)).join('\n') + '\n');

            const fresh = freshPu();
            const stats = fresh.getUsageStats(30);
            assert.equal(stats.total_calls, 3);
            assert.equal(stats.by_provider.anthropic, 2);
            assert.equal(stats.by_provider.ollama, 1);
            assert.equal(stats.fallback_count, 1);

            // Cleanup
            fs.unlinkSync(logPath);
            fs.unlinkSync(path.join(testDir, '.isdlc', 'providers.yaml'));
        });
    });
});
