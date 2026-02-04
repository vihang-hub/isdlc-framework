#!/usr/bin/env node

/**
 * iSDLC Framework CLI
 *
 * Cross-platform CLI entry point for the iSDLC framework.
 *
 * Usage:
 *   npx isdlc init          # Initialize framework in current project
 *   npm install -g isdlc    # Install globally
 *   isdlc init              # Then use directly
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

// Get the directory of this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import and run CLI
const cliPath = join(__dirname, '..', 'lib', 'cli.js');

if (!existsSync(cliPath)) {
  console.error('Error: CLI module not found at', cliPath);
  console.error('This may indicate a corrupted installation.');
  console.error('Try reinstalling: npm install -g isdlc');
  process.exit(1);
}

// Dynamic import for ES modules
const { run } = await import(cliPath);
run(process.argv.slice(2));
