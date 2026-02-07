/**
 * Tests for lib/utils/prompts.js
 *
 * Since we cannot mock the `prompts` module in Node 18 (mock.module is not
 * available), these tests verify the module's export structure and non-interactive
 * behaviors. Interactive prompt behavior is tested indirectly through
 * installer/updater integration tests that use --force to skip prompts.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as promptsModule from './prompts.js';
import defaultExport from './prompts.js';

const EXPECTED_EXPORTS = ['confirm', 'text', 'select', 'multiselect', 'setupExitHandler'];

describe('prompts', () => {
  describe('named exports', () => {
    it('should export exactly 5 named functions plus default', () => {
      const namedExports = Object.keys(promptsModule).filter((k) => k !== 'default');
      assert.equal(
        namedExports.length,
        EXPECTED_EXPORTS.length,
        `Expected ${EXPECTED_EXPORTS.length} named exports, got ${namedExports.length}: ${namedExports.join(', ')}`
      );
    });

    for (const name of EXPECTED_EXPORTS) {
      it(`should export "${name}" as a function`, () => {
        assert.equal(
          typeof promptsModule[name],
          'function',
          `${name} should be a function`
        );
      });
    }
  });

  describe('default export', () => {
    it('should have all 5 functions on the default export object', () => {
      for (const name of EXPECTED_EXPORTS) {
        assert.equal(
          typeof defaultExport[name],
          'function',
          `default.${name} should be a function`
        );
      }
    });

    it('should have exactly 5 keys on the default export', () => {
      assert.equal(
        Object.keys(defaultExport).length,
        EXPECTED_EXPORTS.length,
        'Default export should have exactly 5 keys'
      );
    });
  });

  describe('setupExitHandler()', () => {
    it('should not throw when called', () => {
      assert.doesNotThrow(() => {
        promptsModule.setupExitHandler();
      });
    });
  });
});
