/**
 * Test helper: Calls postVerify() from bin/isdlc-embedding.js
 * in a way that avoids the top-level CLI code.
 *
 * Usage: node tests/bin/_postverify-helper.mjs <projectDir>
 * Output: JSON result of postVerify() on stdout
 *
 * The CLI top-level code reads process.argv[2] as the command.
 * By not passing a recognized command, it prints help and exits.
 * We override process.exit to prevent that, then call the export.
 */

import { resolve } from 'node:path';

// Override process.exit to prevent the CLI top-level code from exiting
const originalExit = process.exit;
let exitCalled = false;
process.exit = (code) => {
  exitCalled = true;
  // Don't actually exit
};

// Override argv to make the CLI think --help was passed (no side effects)
const originalArgv = process.argv;
process.argv = ['node', 'isdlc-embedding.js', '--help'];

// Dynamic import to load the module
const mod = await import('../../bin/isdlc-embedding.js');

// Restore
process.exit = originalExit;
process.argv = originalArgv;

// Now call postVerify with the project dir from our real argv
const projectDir = process.argv[2];
if (!projectDir) {
  process.stderr.write('Usage: node _postverify-helper.mjs <projectDir>\n');
  process.exit(1);
}

const result = mod.postVerify(projectDir);
process.stdout.write(JSON.stringify(result));
