/**
 * iSDLC Prompts Utility
 *
 * Cross-platform user input handling using the prompts library.
 */

import prompts from 'prompts';

/**
 * Ask a yes/no confirmation question
 * @param {string} message - Question to ask
 * @param {boolean} defaultValue - Default value (true = yes, false = no)
 * @returns {Promise<boolean>} User's answer
 */
export async function confirm(message, defaultValue = true) {
  const response = await prompts({
    type: 'confirm',
    name: 'value',
    message,
    initial: defaultValue,
  });

  // Handle Ctrl+C
  if (response.value === undefined) {
    process.exit(0);
  }

  return response.value;
}

/**
 * Ask for text input
 * @param {string} message - Question to ask
 * @param {string} defaultValue - Default value
 * @returns {Promise<string>} User's input
 */
export async function text(message, defaultValue = '') {
  const response = await prompts({
    type: 'text',
    name: 'value',
    message,
    initial: defaultValue,
  });

  if (response.value === undefined) {
    process.exit(0);
  }

  return response.value;
}

/**
 * Ask user to select from a list
 * @param {string} message - Question to ask
 * @param {Array<{title: string, value: any, description?: string}>} choices - Selection choices
 * @param {number} initial - Initial selection index
 * @returns {Promise<any>} Selected value
 */
export async function select(message, choices, initial = 0) {
  const response = await prompts({
    type: 'select',
    name: 'value',
    message,
    choices,
    initial,
  });

  if (response.value === undefined) {
    process.exit(0);
  }

  return response.value;
}

/**
 * Ask user to multi-select from a list
 * @param {string} message - Question to ask
 * @param {Array<{title: string, value: any, selected?: boolean}>} choices - Selection choices
 * @returns {Promise<any[]>} Selected values
 */
export async function multiselect(message, choices) {
  const response = await prompts({
    type: 'multiselect',
    name: 'value',
    message,
    choices,
    hint: '- Space to select. Return to submit',
  });

  if (response.value === undefined) {
    process.exit(0);
  }

  return response.value;
}

/**
 * Configure prompts to exit on Ctrl+C
 */
export function setupExitHandler() {
  prompts.override({ onCancel: () => process.exit(0) });
}

export default {
  confirm,
  text,
  select,
  multiselect,
  setupExitHandler,
};
