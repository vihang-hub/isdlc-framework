/**
 * Unit tests for health-probe
 * REQ-GH-252 FR-002, AC-002-03, AC-002-05
 *
 * Test commands:
 *   node --test lib/embedding/server/health-probe.test.cjs
 */

'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { probeEmbeddingHealth } = require('./health-probe.cjs');

describe('health-probe', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'health-probe-test-'));
  });

  afterEach(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  });

  // ---- P0 Tests ----

  it('[P0] AC-002-03: Given no PID file exists, When probeEmbeddingHealth() is called, Then returns { status: "inactive", error: "no_pid_file" }', () => {
    const result = probeEmbeddingHealth(tmpDir);
    assert.strictEqual(result.status, 'inactive');
    assert.strictEqual(result.error, 'no_pid_file');
  });

  it('[P0] AC-002-03: Given PID file exists with non-numeric content, When probeEmbeddingHealth() is called, Then returns { status: "inactive", error: "invalid_pid" }', () => {
    const logsDir = path.join(tmpDir, '.isdlc', 'logs');
    fs.mkdirSync(logsDir, { recursive: true });
    fs.writeFileSync(path.join(logsDir, 'embedding-server.pid'), 'not-a-number');
    const result = probeEmbeddingHealth(tmpDir);
    assert.strictEqual(result.status, 'inactive');
    assert.strictEqual(result.error, 'invalid_pid');
  });

  it('[P0] AC-002-03: Given PID file exists and process is alive (current process PID), When probeEmbeddingHealth() is called, Then returns { status: "active", pid: N }', () => {
    const logsDir = path.join(tmpDir, '.isdlc', 'logs');
    fs.mkdirSync(logsDir, { recursive: true });
    fs.writeFileSync(path.join(logsDir, 'embedding-server.pid'), String(process.pid));
    const result = probeEmbeddingHealth(tmpDir);
    assert.strictEqual(result.status, 'active');
    assert.strictEqual(result.pid, process.pid);
  });

  it('[P0] AC-002-03: Given PID file exists but process is dead, When probeEmbeddingHealth() is called, Then returns { status: "inactive", error: "process_dead" }', () => {
    const logsDir = path.join(tmpDir, '.isdlc', 'logs');
    fs.mkdirSync(logsDir, { recursive: true });
    fs.writeFileSync(path.join(logsDir, 'embedding-server.pid'), '999999999');
    const result = probeEmbeddingHealth(tmpDir);
    assert.strictEqual(result.status, 'inactive');
    assert.strictEqual(result.error, 'process_dead');
  });

  // ---- P1 Tests ----

  it('[P1] AC-002-03: Given PID file directory does not exist, When probeEmbeddingHealth() is called, Then returns { status: "inactive", error: "no_pid_file" }', () => {
    const result = probeEmbeddingHealth(path.join(tmpDir, 'nonexistent'));
    assert.strictEqual(result.status, 'inactive');
    assert.strictEqual(result.error, 'no_pid_file');
  });

  it('[P1] AC-002-05: Given health probe encounters unexpected error, When probeEmbeddingHealth() is called, Then returns { status: "failed", error: <message> } and never throws', () => {
    // Passing null should trigger the fail-open path
    assert.doesNotThrow(() => { probeEmbeddingHealth(null); });
    const result = probeEmbeddingHealth(null);
    assert.strictEqual(result.status, 'failed');
    assert.ok(result.error);
  });

  it('[P1] AC-002-05: Given PID file with negative number, When probeEmbeddingHealth() is called, Then returns inactive with invalid_pid', () => {
    const logsDir = path.join(tmpDir, '.isdlc', 'logs');
    fs.mkdirSync(logsDir, { recursive: true });
    fs.writeFileSync(path.join(logsDir, 'embedding-server.pid'), '-5');
    const result = probeEmbeddingHealth(tmpDir);
    assert.strictEqual(result.status, 'inactive');
    assert.strictEqual(result.error, 'invalid_pid');
  });

  it('[P1] AC-002-05: Given PID file with zero, When probeEmbeddingHealth() is called, Then returns inactive with invalid_pid', () => {
    const logsDir = path.join(tmpDir, '.isdlc', 'logs');
    fs.mkdirSync(logsDir, { recursive: true });
    fs.writeFileSync(path.join(logsDir, 'embedding-server.pid'), '0');
    const result = probeEmbeddingHealth(tmpDir);
    assert.strictEqual(result.status, 'inactive');
    assert.strictEqual(result.error, 'invalid_pid');
  });

  it('[P2] AC-002-03: Given PID file with whitespace-padded valid PID, When probeEmbeddingHealth() is called, Then correctly parses PID', () => {
    const logsDir = path.join(tmpDir, '.isdlc', 'logs');
    fs.mkdirSync(logsDir, { recursive: true });
    fs.writeFileSync(path.join(logsDir, 'embedding-server.pid'), `  ${process.pid}  \n`);
    const result = probeEmbeddingHealth(tmpDir);
    assert.strictEqual(result.status, 'active');
    assert.strictEqual(result.pid, process.pid);
  });
});
