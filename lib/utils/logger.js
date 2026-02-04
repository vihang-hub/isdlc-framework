/**
 * iSDLC Logger Utility
 *
 * Cross-platform colored console output with consistent styling.
 */

import chalk from 'chalk';

/**
 * Print a styled header box
 * @param {string} title - Header title text
 */
export function header(title) {
  const line = '═'.repeat(60);
  console.log('');
  console.log(chalk.cyan(`╔${line}╗`));
  console.log(chalk.cyan(`║${title.padStart(30 + title.length / 2).padEnd(60)}║`));
  console.log(chalk.cyan(`╚${line}╝`));
  console.log('');
}

/**
 * Print a step indicator
 * @param {string} step - Step number/total (e.g., "1/5")
 * @param {string} message - Step description
 */
export function step(step, message) {
  console.log(chalk.blue(`[${step}]`) + ` ${message}`);
}

/**
 * Print a success message with checkmark
 * @param {string} message - Success message
 */
export function success(message) {
  console.log(chalk.green(`  ✓ ${message}`));
}

/**
 * Print a warning message
 * @param {string} message - Warning message
 */
export function warning(message) {
  console.log(chalk.yellow(`  ⚠ ${message}`));
}

/**
 * Print an error message
 * @param {string} message - Error message
 */
export function error(message) {
  console.log(chalk.red(`  ✗ ${message}`));
}

/**
 * Print an info message (indented)
 * @param {string} message - Info message
 */
export function info(message) {
  console.log(`  ${message}`);
}

/**
 * Print a labeled value
 * @param {string} label - Label text
 * @param {string} value - Value text
 */
export function labeled(label, value) {
  console.log(chalk.blue(`${label}:`) + ` ${value}`);
}

/**
 * Print a section header
 * @param {string} title - Section title
 */
export function section(title) {
  console.log('');
  console.log(chalk.cyan(title));
}

/**
 * Print a boxed notification (like update available)
 * @param {string[]} lines - Lines to display in the box
 */
export function box(lines) {
  const maxLen = Math.max(...lines.map((l) => l.length));
  const width = maxLen + 4;
  const line = '─'.repeat(width);

  console.log('');
  console.log(chalk.yellow(`╭${line}╮`));
  for (const text of lines) {
    console.log(chalk.yellow('│') + `  ${text.padEnd(width - 2)}` + chalk.yellow('│'));
  }
  console.log(chalk.yellow(`╰${line}╯`));
  console.log('');
}

/**
 * Print a list item
 * @param {string} item - List item text
 * @param {number} indent - Indentation level (default 1)
 */
export function listItem(item, indent = 1) {
  const spaces = '  '.repeat(indent);
  console.log(`${spaces}- ${item}`);
}

/**
 * Print plain text
 * @param {string} message - Message to print
 */
export function log(message) {
  console.log(message);
}

/**
 * Print an empty line
 */
export function newline() {
  console.log('');
}

export default {
  header,
  step,
  success,
  warning,
  error,
  info,
  labeled,
  section,
  box,
  listItem,
  log,
  newline,
};
