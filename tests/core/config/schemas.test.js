/**
 * Tests for src/core/config/ schema loading
 * REQ-0125: Move schemas to src/core/config/
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadCoreSchema, listCoreSchemas } from '../../../src/core/config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const coreSchemasDir = join(__dirname, '..', '..', '..', 'src', 'core', 'config', 'schemas');

describe('core schema files exist', () => {
  const expectedSchemas = [
    'constitutional-validation',
    'hook-stdin-posttooluse',
    'hook-stdin-pretooluse',
    'hook-stdin-stop',
    'interactive-elicitation',
    'skill-usage-entry',
    'test-iteration',
    'pending-delegation'
  ];

  for (const schemaId of expectedSchemas) {
    it(`${schemaId}.schema.json exists`, () => {
      assert.ok(existsSync(join(coreSchemasDir, `${schemaId}.schema.json`)));
    });
  }
});

describe('loadCoreSchema', () => {
  it('loads test-iteration schema', () => {
    const schema = loadCoreSchema('test-iteration');
    assert.ok(schema);
    assert.ok(schema.type || schema.properties || schema.$schema);
  });

  it('loads constitutional-validation schema', () => {
    const schema = loadCoreSchema('constitutional-validation');
    assert.ok(schema);
  });

  it('returns null for non-existent schema', () => {
    assert.strictEqual(loadCoreSchema('nonexistent'), null);
  });
});

describe('listCoreSchemas', () => {
  it('lists at least 8 schemas', () => {
    const schemas = listCoreSchemas();
    assert.ok(schemas.length >= 8, `Expected at least 8 schemas, got ${schemas.length}`);
    assert.ok(schemas.includes('test-iteration'));
    assert.ok(schemas.includes('constitutional-validation'));
  });
});
