/**
 * iSDLC Monorepo Handler
 *
 * Detects and manages monorepo configurations.
 */

import path from 'path';
import { exists, readJson, readdir, isDirectory } from './utils/fs-helpers.js';

/**
 * Monorepo workspace configuration files
 */
const WORKSPACE_MARKERS = {
  'pnpm-workspace.yaml': 'pnpm',
  'lerna.json': 'lerna',
  'turbo.json': 'turbo',
  'nx.json': 'nx',
  'rush.json': 'rush',
};

/**
 * Common monorepo directory patterns
 */
const MONOREPO_DIRS = ['apps', 'packages', 'services', 'libs', 'modules'];

/**
 * Directories to skip when scanning for projects
 */
const SKIP_DIRS = ['.claude', '.isdlc', '.git', 'docs', 'node_modules', 'scripts', 'vendor', 'dist', 'build', 'target', '__pycache__', '.next', '.nuxt'];

/**
 * Detect if a directory is a monorepo
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<{isMonorepo: boolean, type: string|null}>}
 */
export async function detectMonorepo(projectRoot) {
  // Check for workspace configuration files
  for (const [file, type] of Object.entries(WORKSPACE_MARKERS)) {
    const filePath = path.join(projectRoot, file);
    if (await exists(filePath)) {
      return { isMonorepo: true, type };
    }
  }

  // Check for common monorepo directory patterns
  let projectCount = 0;
  for (const dir of MONOREPO_DIRS) {
    const dirPath = path.join(projectRoot, dir);
    if (await isDirectory(dirPath)) {
      const entries = await readdir(dirPath).catch(() => []);
      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry);
        if (await isDirectory(entryPath)) {
          // Check if it looks like a project
          if (await hasProjectMarkers(entryPath)) {
            projectCount++;
          }
        }
      }
    }
  }

  if (projectCount >= 2) {
    return { isMonorepo: true, type: 'directory-structure' };
  }

  // Check for root-level project directories (frontend/, backend/)
  const rootProjects = await detectRootLevelProjects(projectRoot);
  if (rootProjects.length >= 2) {
    return { isMonorepo: true, type: 'root-directories' };
  }

  return { isMonorepo: false, type: null };
}

/**
 * Check if a directory has project markers
 * @param {string} dirPath - Directory path
 * @returns {Promise<boolean>}
 */
async function hasProjectMarkers(dirPath) {
  const markers = ['package.json', 'go.mod', 'Cargo.toml', 'pyproject.toml', 'pom.xml', 'build.gradle'];

  for (const marker of markers) {
    if (await exists(path.join(dirPath, marker))) {
      return true;
    }
  }

  // Check for src directory
  if (await isDirectory(path.join(dirPath, 'src'))) {
    return true;
  }

  return false;
}

/**
 * Detect root-level project directories
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<Array<{name: string, path: string}>>}
 */
async function detectRootLevelProjects(projectRoot) {
  const projects = [];
  const entries = await readdir(projectRoot).catch(() => []);

  for (const entry of entries) {
    if (SKIP_DIRS.includes(entry)) continue;

    const entryPath = path.join(projectRoot, entry);
    if (!(await isDirectory(entryPath))) continue;

    if (await hasProjectMarkers(entryPath)) {
      projects.push({ name: entry, path: entry });
    }
  }

  return projects;
}

/**
 * Scan and discover all projects in a monorepo
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<Array<{name: string, path: string, discovered: boolean}>>}
 */
export async function discoverProjects(projectRoot) {
  const projects = [];
  const seen = new Set();

  // Scan standard monorepo directories
  for (const dir of MONOREPO_DIRS) {
    const dirPath = path.join(projectRoot, dir);
    if (!(await isDirectory(dirPath))) continue;

    const entries = await readdir(dirPath).catch(() => []);
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry);
      if (!(await isDirectory(entryPath))) continue;

      if (await hasProjectMarkers(entryPath)) {
        const relPath = `${dir}/${entry}`;
        if (!seen.has(entry)) {
          seen.add(entry);
          projects.push({
            name: entry,
            path: relPath,
            discovered: true,
          });
        }
      }
    }
  }

  // Scan root-level directories
  const rootProjects = await detectRootLevelProjects(projectRoot);
  for (const proj of rootProjects) {
    if (!seen.has(proj.name)) {
      seen.add(proj.name);
      projects.push({
        name: proj.name,
        path: proj.path,
        discovered: true,
      });
    }
  }

  return projects;
}

/**
 * Get scan paths for monorepo (parent directories of projects)
 * @param {Array<{name: string, path: string}>} projects - Discovered projects
 * @returns {string[]} Unique scan paths
 */
export function getScanPaths(projects) {
  const paths = new Set();

  for (const proj of projects) {
    if (proj.path.includes('/')) {
      // Nested path like apps/web - use parent dir
      const parent = proj.path.split('/')[0] + '/';
      paths.add(parent);
    } else {
      // Root-level path like frontend
      paths.add(proj.path);
    }
  }

  return Array.from(paths);
}

/**
 * Load existing monorepo configuration
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<object|null>} Monorepo config or null
 */
export async function loadMonorepoConfig(projectRoot) {
  const configPath = path.join(projectRoot, '.isdlc', 'monorepo.json');

  if (!(await exists(configPath))) {
    return null;
  }

  try {
    return await readJson(configPath);
  } catch {
    return null;
  }
}

/**
 * Generate monorepo configuration object
 * @param {Array<{name: string, path: string}>} projects - Projects
 * @param {object} options - Configuration options
 * @returns {object} Monorepo configuration
 */
export function generateMonorepoConfig(projects, options = {}) {
  const { docsLocation = 'root' } = options;

  const projectsMap = {};
  const timestamp = new Date().toISOString();

  for (const proj of projects) {
    projectsMap[proj.name] = {
      name: proj.name,
      path: proj.path,
      registered_at: timestamp,
      discovered: proj.discovered || true,
    };
  }

  return {
    version: '1.0.0',
    default_project: projects.length > 0 ? projects[0].name : null,
    docs_location: docsLocation,
    projects: projectsMap,
    scan_paths: getScanPaths(projects),
  };
}

export default {
  detectMonorepo,
  discoverProjects,
  getScanPaths,
  loadMonorepoConfig,
  generateMonorepoConfig,
};
