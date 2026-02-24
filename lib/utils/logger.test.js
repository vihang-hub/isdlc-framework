/**
 * Tests for lib/utils/logger.js
 *
 * Verifies all 12 exported logger functions produce the expected console output.
 * Uses captureConsole() from test-helpers to intercept console.log calls.
 * Chalk wraps strings with ANSI codes, so assertions use .includes() rather
 * than strict equality.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { captureConsole } from './test-helpers.js';
import * as logger from './logger.js';
import defaultExport from './logger.js';

let capture;

beforeEach(() => {
  capture = captureConsole();
});

afterEach(() => {
  capture.restore();
});

describe('logger', () => {
  describe('header(title)', () => {
    it('should call console.log 5 times (blank, top border, title, bottom border, blank)', () => {
      logger.header('Test Title');
      assert.equal(capture.calls.length, 5, `Expected 5 calls, got ${capture.calls.length}`);
    });

    it('should include the title text in the third call', () => {
      logger.header('My Header');
      const titleLine = String(capture.calls[2][0]);
      assert.ok(titleLine.includes('My Header'), 'Title line should contain the header text');
    });
  });

  describe('step(step, message)', () => {
    it('should output the step number in brackets and the message', () => {
      logger.step('1/5', 'Installing');
      const output = String(capture.calls[0][0]);
      assert.ok(output.includes('[1/5]'), 'Output should contain [1/5]');
      assert.ok(output.includes('Installing'), 'Output should contain the message');
    });
  });

  describe('success(msg)', () => {
    it('should output a checkmark and the message', () => {
      logger.success('Done');
      const output = String(capture.calls[0][0]);
      assert.ok(output.includes('\u2713'), 'Output should contain checkmark');
      assert.ok(output.includes('Done'), 'Output should contain the message');
    });
  });

  describe('warning(msg)', () => {
    it('should output a warning symbol and the message', () => {
      logger.warning('Caution');
      const output = String(capture.calls[0][0]);
      assert.ok(output.includes('\u26A0'), 'Output should contain warning symbol');
      assert.ok(output.includes('Caution'), 'Output should contain the message');
    });
  });

  describe('error(msg)', () => {
    it('should output an X mark and the message', () => {
      logger.error('Failed');
      const output = String(capture.calls[0][0]);
      assert.ok(output.includes('\u2717'), 'Output should contain X mark');
      assert.ok(output.includes('Failed'), 'Output should contain the message');
    });
  });

  describe('info(msg)', () => {
    it('should output the message with indentation', () => {
      logger.info('Some info');
      const output = String(capture.calls[0][0]);
      assert.ok(output.includes('Some info'), 'Output should contain the message');
      assert.ok(output.startsWith('  '), 'Output should be indented');
    });
  });

  describe('labeled(label, value)', () => {
    it('should output the label with colon and value', () => {
      logger.labeled('Version', '1.0.0');
      const output = String(capture.calls[0][0]);
      assert.ok(output.includes('Version:'), 'Output should contain label with colon');
      assert.ok(output.includes('1.0.0'), 'Output should contain the value');
    });
  });

  describe('section(title)', () => {
    it('should call console.log twice (blank line, then title)', () => {
      logger.section('Config');
      assert.equal(capture.calls.length, 2, 'section() should produce 2 console.log calls');
    });

    it('should include the section title in the second call', () => {
      logger.section('Config');
      const titleOutput = String(capture.calls[1][0]);
      assert.ok(titleOutput.includes('Config'), 'Second call should contain the section title');
    });
  });

  describe('box(lines)', () => {
    it('should call console.log at least 5 times for 2 content lines', () => {
      logger.box(['line1', 'line2']);
      // blank + top border + line1 + line2 + bottom border + blank = 6
      assert.ok(
        capture.calls.length >= 5,
        `Expected at least 5 calls, got ${capture.calls.length}`
      );
    });

    it('should include the content lines in the output', () => {
      logger.box(['hello', 'world']);
      const allOutput = capture.calls.map((c) => String(c[0])).join('\n');
      assert.ok(allOutput.includes('hello'), 'Output should contain first line');
      assert.ok(allOutput.includes('world'), 'Output should contain second line');
    });
  });

  describe('listItem(item)', () => {
    it('should output a dash followed by the item text', () => {
      logger.listItem('item one');
      const output = String(capture.calls[0][0]);
      assert.ok(output.includes('- item one'), 'Output should contain "- item one"');
    });

    it('should increase indentation when indent level is specified', () => {
      logger.listItem('deep item', 2);
      const output = String(capture.calls[0][0]);
      // indent=2 means '  '.repeat(2) = 4 spaces before the dash
      assert.ok(output.startsWith('    '), 'Output should have 4 leading spaces for indent=2');
      assert.ok(output.includes('- deep item'), 'Output should contain the item text');
    });
  });

  describe('log(msg)', () => {
    it('should output the message directly', () => {
      logger.log('raw message');
      assert.equal(capture.calls.length, 1);
      assert.equal(capture.calls[0][0], 'raw message');
    });
  });

  describe('newline()', () => {
    it('should output an empty string', () => {
      logger.newline();
      assert.equal(capture.calls.length, 1);
      assert.equal(capture.calls[0][0], '');
    });
  });

  describe('default export', () => {
    it('should export an object containing all 12 functions', () => {
      const expectedFunctions = [
        'header',
        'step',
        'success',
        'warning',
        'error',
        'info',
        'labeled',
        'section',
        'box',
        'listItem',
        'log',
        'newline',
      ];

      for (const name of expectedFunctions) {
        assert.equal(typeof defaultExport[name], 'function', `default.${name} should be a function`);
      }

      assert.equal(
        Object.keys(defaultExport).length,
        expectedFunctions.length,
        'Default export should have exactly 12 keys'
      );
    });
  });
});
