/**
 * iSDLC Version Checker & Update Notifier
 *
 * Checks npm registry for newer versions and displays notifications.
 * Uses a 24-hour cache to avoid excessive network requests.
 */

import https from 'https';
import path from 'path';
import os from 'os';
import semver from 'semver';
import { readJson, writeJson, exists } from './utils/fs-helpers.js';
import logger from './utils/logger.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache file location (in user's home directory)
const CACHE_FILE = path.join(os.homedir(), '.isdlc-update-check.json');

// Cache duration: 24 hours
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

/**
 * Get current installed version from package.json
 * @returns {Promise<string>} Current version
 */
async function getCurrentVersion() {
  const packagePath = path.resolve(__dirname, '..', 'package.json');
  try {
    const pkg = await readJson(packagePath);
    return pkg.version;
  } catch {
    return '0.0.0';
  }
}

/**
 * Fetch latest version from npm registry
 * @param {string} packageName - Package name
 * @returns {Promise<string|null>} Latest version or null on error
 */
function fetchLatestVersion(packageName) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'registry.npmjs.org',
      path: `/${packageName}/latest`,
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      timeout: 5000, // 5 second timeout
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.version || null);
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', () => {
      resolve(null);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });

    req.end();
  });
}

/**
 * Check if cache is still valid
 * @returns {Promise<{valid: boolean, data: object|null}>}
 */
async function checkCache() {
  try {
    if (!(await exists(CACHE_FILE))) {
      return { valid: false, data: null };
    }

    const cache = await readJson(CACHE_FILE);
    const now = Date.now();

    if (cache.timestamp && now - cache.timestamp < CACHE_DURATION_MS) {
      return { valid: true, data: cache };
    }

    return { valid: false, data: null };
  } catch {
    return { valid: false, data: null };
  }
}

/**
 * Update the cache file
 * @param {string} currentVersion - Current installed version
 * @param {string} latestVersion - Latest available version
 */
async function updateCache(currentVersion, latestVersion) {
  try {
    await writeJson(CACHE_FILE, {
      timestamp: Date.now(),
      currentVersion,
      latestVersion,
    });
  } catch {
    // Ignore cache write errors
  }
}

/**
 * Check for available updates
 * @returns {Promise<{current: string, latest: string}|null>}
 *          Returns update info if newer version available, null otherwise
 */
export async function checkForUpdates() {
  try {
    // Check cache first
    const { valid, data } = await checkCache();
    const currentVersion = await getCurrentVersion();

    if (valid && data) {
      // Use cached result
      if (semver.gt(data.latestVersion, currentVersion)) {
        return { current: currentVersion, latest: data.latestVersion };
      }
      return null;
    }

    // Fetch from npm registry
    const latestVersion = await fetchLatestVersion('isdlc');

    if (!latestVersion) {
      return null;
    }

    // Update cache
    await updateCache(currentVersion, latestVersion);

    // Compare versions
    if (semver.gt(latestVersion, currentVersion)) {
      return { current: currentVersion, latest: latestVersion };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Display update notification to user
 * @param {string} currentVersion - Current installed version
 * @param {string} latestVersion - Latest available version
 */
export function displayUpdateNotification(currentVersion, latestVersion) {
  logger.box([
    `Update available: ${currentVersion} → ${latestVersion}`,
    '',
    'Run one of the following to update:',
    '  npm update -g isdlc',
    '  npx isdlc@latest init',
  ]);
}

/**
 * Get version from package.json (for external use)
 * @returns {Promise<string>} Current version
 */
export async function getVersion() {
  return getCurrentVersion();
}

export default {
  checkForUpdates,
  displayUpdateNotification,
  getVersion,
};
