/**
 * Tests for autoDetectProvider() function in provider-utils.cjs
 *
 * Traces to: REQ-006, NFR-001, NFR-002, NFR-003, ADR-0001, ADR-0004
 * Module: M1 - Provider Auto-Detection
 *
 * Test runner: node --test
 * 18 test cases covering tiered detection, env var priority,
 * health probe mocking, fail-open behavior.
 */

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Load the module under test
const providerUtils = require('../lib/provider-utils.cjs');
const { autoDetectProvider, hasProvidersConfig } = providerUtils;

// ============================================================================
// Test Setup: Environment variable isolation and mock HTTP server
// ============================================================================

// Env var keys we manipulate
const ENV_KEYS = ['ANTHROPIC_BASE_URL', 'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN'];

let savedEnv = {};
let mockServer = null;
let mockPort = 0;

/**
 * Create a mock HTTP server that returns configurable responses.
 * @param {number} statusCode - HTTP status code to return
 * @param {number} [delayMs=0] - Delay before responding (for timeout tests)
 * @returns {Promise<{server: http.Server, port: number}>}
 */
function createMockServer(statusCode = 200, delayMs = 0) {
    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            if (delayMs > 0) {
                setTimeout(() => {
                    res.writeHead(statusCode);
                    res.end('{}');
                }, delayMs);
            } else {
                res.writeHead(statusCode);
                res.end('{}');
            }
        });
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            resolve({ server, port });
        });
        server.on('error', reject);
    });
}

/**
 * Build a config object pointing to mock server.
 * @param {string} provider - defaults.provider value
 * @param {number} port - Mock server port
 * @returns {object} Provider config object
 */
function makeConfig(provider, port) {
    return {
        providers: {
            anthropic: {
                enabled: true,
                base_url: 'https://api.anthropic.com',
                api_key_env: 'ANTHROPIC_API_KEY',
                health_check: {
                    endpoint: '/v1/messages',
                    timeout_ms: 5000
                }
            },
            ollama: {
                enabled: true,
                base_url: `http://127.0.0.1:${port}`,
                api_key: 'ollama',
                auth_token: 'ollama',
                health_check: {
                    endpoint: '/api/tags',
                    timeout_ms: 2000
                }
            }
        },
        defaults: {
            provider: provider,
            model: 'sonnet'
        }
    };
}

// ============================================================================
// Tests
// ============================================================================

describe('autoDetectProvider()', () => {

    beforeEach(() => {
        // Save current env vars
        savedEnv = {};
        for (const key of ENV_KEYS) {
            savedEnv[key] = process.env[key];
        }
        // Clear env vars for clean test state
        for (const key of ENV_KEYS) {
            delete process.env[key];
        }
    });

    afterEach(() => {
        // Restore env vars
        for (const key of ENV_KEYS) {
            if (savedEnv[key] !== undefined) {
                process.env[key] = savedEnv[key];
            } else {
                delete process.env[key];
            }
        }
    });

    // TC-M1-01: Tier 1 -- Env var ANTHROPIC_BASE_URL with localhost:11434
    it('TC-M1-01: returns ollama when ANTHROPIC_BASE_URL points to localhost:11434', async () => {
        process.env.ANTHROPIC_BASE_URL = 'http://localhost:11434';
        const result = await autoDetectProvider({});
        assert.equal(result.provider, 'ollama');
        assert.equal(result.healthy, true);
        assert.equal(result.source, 'env_var');
    });

    // TC-M1-02: Tier 1 -- Env var ANTHROPIC_API_KEY set (no custom base URL)
    it('TC-M1-02: returns anthropic when ANTHROPIC_API_KEY set without base URL', async () => {
        process.env.ANTHROPIC_API_KEY = 'sk-ant-test123';
        const result = await autoDetectProvider({});
        assert.equal(result.provider, 'anthropic');
        assert.equal(result.healthy, true);
        assert.equal(result.source, 'env_var');
    });

    // TC-M1-03: Tier 1 -- Both env vars set (base URL overrides)
    it('TC-M1-03: base URL takes priority when both env vars are set', async () => {
        process.env.ANTHROPIC_BASE_URL = 'http://localhost:11434';
        process.env.ANTHROPIC_API_KEY = 'sk-ant-test123';
        const result = await autoDetectProvider({});
        assert.equal(result.provider, 'ollama');
        assert.equal(result.source, 'env_var');
    });

    // TC-M1-04: Tier 2 -- Config says 'ollama', Ollama is healthy
    it('TC-M1-04: returns ollama healthy when config says ollama and server responds', async () => {
        const { server, port } = await createMockServer(200);
        try {
            const config = makeConfig('ollama', port);
            const result = await autoDetectProvider(config);
            assert.equal(result.provider, 'ollama');
            assert.equal(result.healthy, true);
            assert.equal(result.source, 'config_file');
        } finally {
            server.close();
        }
    });

    // TC-M1-05: Tier 2 -- Config says 'ollama', Ollama is not running
    it('TC-M1-05: returns ollama unhealthy when config says ollama but server is down', async () => {
        // Use a port that nothing is listening on
        const config = makeConfig('ollama', 1);
        // Point to a port that will refuse connections
        config.providers.ollama.base_url = 'http://127.0.0.1:19999';
        config.providers.ollama.health_check.timeout_ms = 1000;
        const result = await autoDetectProvider(config);
        assert.equal(result.provider, 'ollama');
        assert.equal(result.healthy, false);
        assert.equal(result.source, 'config_file');
        assert.ok(result.reason, 'reason should be present when unhealthy');
    });

    // TC-M1-06: Tier 2 -- Config says 'anthropic'
    it('TC-M1-06: returns anthropic from config when config says anthropic', async () => {
        const config = makeConfig('anthropic', 0);
        const result = await autoDetectProvider(config);
        assert.equal(result.provider, 'anthropic');
        assert.equal(result.healthy, true);
        assert.equal(result.source, 'config_file');
    });

    // TC-M1-07: Tier 4 -- No env vars, no config provider set
    it('TC-M1-07: falls back to anthropic when config.defaults.provider is undefined', async () => {
        const config = { defaults: {} };
        const result = await autoDetectProvider(config);
        assert.equal(result.provider, 'anthropic');
        assert.equal(result.healthy, true);
        assert.equal(result.source, 'default_fallback');
    });

    // TC-M1-08: Tier 4 -- Empty config object
    it('TC-M1-08: falls back to anthropic with empty config object', async () => {
        const result = await autoDetectProvider({});
        assert.equal(result.provider, 'anthropic');
        assert.equal(result.healthy, true);
        assert.equal(result.source, 'default_fallback');
    });

    // TC-M1-09: Health probe timeout (2000ms)
    it('TC-M1-09: returns unhealthy when health probe times out', async () => {
        // Create server that delays 5 seconds (well beyond 2s timeout)
        const { server, port } = await createMockServer(200, 5000);
        try {
            const config = makeConfig('ollama', port);
            config.providers.ollama.health_check.timeout_ms = 500; // Short timeout for test speed
            const startTime = Date.now();
            const result = await autoDetectProvider(config);
            const elapsed = Date.now() - startTime;
            assert.equal(result.provider, 'ollama');
            assert.equal(result.healthy, false);
            assert.equal(result.source, 'config_file');
            assert.ok(result.reason, 'reason should be present on timeout');
            // Should complete in bounded time (timeout + buffer)
            assert.ok(elapsed < 3000, `Should complete within bounded time, took ${elapsed}ms`);
        } finally {
            server.close();
        }
    });

    // TC-M1-10: Health probe HTTP error (500)
    it('TC-M1-10: returns unhealthy when health probe returns HTTP 500', async () => {
        const { server, port } = await createMockServer(500);
        try {
            const config = makeConfig('ollama', port);
            const result = await autoDetectProvider(config);
            assert.equal(result.provider, 'ollama');
            assert.equal(result.healthy, false);
            assert.equal(result.source, 'config_file');
        } finally {
            server.close();
        }
    });

    // TC-M1-11: Exception in autoDetectProvider -- catch-all
    it('TC-M1-11: returns anthropic default when config is null (catch-all)', async () => {
        const result = await autoDetectProvider(null);
        assert.equal(result.provider, 'anthropic');
        assert.equal(result.healthy, true);
        assert.equal(result.source, 'default_fallback');
    });

    // TC-M1-12: Backward compatibility -- hasProvidersConfig() guard (no file)
    it('TC-M1-12: hasProvidersConfig() returns false when no providers.yaml exists', () => {
        // hasProvidersConfig checks the real project root, which should not have
        // a .isdlc/providers.yaml unless one was created by a test
        // We use a temp dir approach to be safe
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autodetect-test-'));
        const origEnv = process.env.CLAUDE_PROJECT_DIR;
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            const result = hasProvidersConfig();
            assert.equal(result, false);
        } finally {
            process.env.CLAUDE_PROJECT_DIR = origEnv || '';
            if (!origEnv) delete process.env.CLAUDE_PROJECT_DIR;
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    // TC-M1-13: Backward compatibility -- hasProvidersConfig() returns true
    it('TC-M1-13: hasProvidersConfig() returns true when providers.yaml exists', () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autodetect-test-'));
        const isdlcDir = path.join(tmpDir, '.isdlc');
        fs.mkdirSync(isdlcDir, { recursive: true });
        fs.writeFileSync(path.join(isdlcDir, 'providers.yaml'), 'defaults:\n  provider: "ollama"\n');
        const origEnv = process.env.CLAUDE_PROJECT_DIR;
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        try {
            const result = hasProvidersConfig();
            assert.equal(result, true);
        } finally {
            process.env.CLAUDE_PROJECT_DIR = origEnv || '';
            if (!origEnv) delete process.env.CLAUDE_PROJECT_DIR;
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    // TC-M1-14: Health probe targets only localhost
    it('TC-M1-14: health probe URL is constructed from config base_url', async () => {
        const { server, port } = await createMockServer(200);
        try {
            const config = makeConfig('ollama', port);
            // Verify the config base_url points to localhost
            assert.ok(
                config.providers.ollama.base_url.includes('127.0.0.1'),
                'Ollama base_url should target localhost'
            );
            const result = await autoDetectProvider(config);
            assert.equal(result.provider, 'ollama');
            assert.equal(result.healthy, true);
        } finally {
            server.close();
        }
    });

    // TC-M1-15: Tier 1-2 detection performance (no I/O)
    it('TC-M1-15: tier 1 detection (env var) completes in < 50ms', async () => {
        process.env.ANTHROPIC_BASE_URL = 'http://localhost:11434';
        const start = Date.now();
        const result = await autoDetectProvider({});
        const elapsed = Date.now() - start;
        assert.equal(result.provider, 'ollama');
        assert.ok(elapsed < 50, `Tier 1 detection should be fast, took ${elapsed}ms`);
    });

    // TC-M1-16: Env var with uppercase/mixed case localhost
    it('TC-M1-16: detects ollama from ANTHROPIC_BASE_URL with mixed case localhost', async () => {
        process.env.ANTHROPIC_BASE_URL = 'http://LOCALHOST:11434';
        const result = await autoDetectProvider({});
        assert.equal(result.provider, 'ollama');
        assert.equal(result.source, 'env_var');
    });

    // TC-M1-17: Return value shape validation
    it('TC-M1-17: return value has correct shape (provider, healthy, source)', async () => {
        // Test with env var path
        process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
        const result = await autoDetectProvider({});
        assert.equal(typeof result.provider, 'string');
        assert.equal(typeof result.healthy, 'boolean');
        assert.equal(typeof result.source, 'string');
        assert.ok(
            ['env_var', 'config_file', 'default_fallback'].includes(result.source),
            `source should be one of the valid values, got: ${result.source}`
        );
        // reason should not be present when healthy
        if (result.healthy) {
            assert.equal(result.reason, undefined, 'reason should not be present when healthy');
        }
    });

    // TC-M1-18: autoDetectProvider is exported from provider-utils.cjs
    it('TC-M1-18: autoDetectProvider is exported as a function', () => {
        assert.equal(typeof autoDetectProvider, 'function');
        assert.ok(
            providerUtils.autoDetectProvider === autoDetectProvider,
            'autoDetectProvider should be on module.exports'
        );
    });
});
