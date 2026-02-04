/**
 * iSDLC Project Detector
 *
 * Detects project type, existing frameworks, and project characteristics.
 */

import path from 'path';
import { exists, readJson, readdir, isDirectory } from './utils/fs-helpers.js';

/**
 * Project manifest files and their associated ecosystems
 */
const PROJECT_MARKERS = {
  // JavaScript/TypeScript
  'package.json': 'node',
  'tsconfig.json': 'typescript',
  'deno.json': 'deno',
  'bun.lockb': 'bun',

  // Python
  'requirements.txt': 'python',
  'pyproject.toml': 'python',
  'setup.py': 'python',
  'Pipfile': 'python',
  'poetry.lock': 'python',

  // Go
  'go.mod': 'go',
  'go.sum': 'go',

  // Rust
  'Cargo.toml': 'rust',
  'Cargo.lock': 'rust',

  // Java/Kotlin
  'pom.xml': 'maven',
  'build.gradle': 'gradle',
  'build.gradle.kts': 'gradle',

  // Ruby
  Gemfile: 'ruby',
  'Gemfile.lock': 'ruby',

  // PHP
  'composer.json': 'php',
  'composer.lock': 'php',

  // .NET
  '*.csproj': 'dotnet',
  '*.fsproj': 'dotnet',
  '*.sln': 'dotnet',

  // Other
  Makefile: 'make',
  CMakeLists: 'cmake',
};

/**
 * Source code directories
 */
const SOURCE_DIRS = ['src', 'lib', 'app', 'pkg', 'cmd', 'internal', 'source'];

/**
 * Source file extensions
 */
const SOURCE_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.rs', '.java', '.rb', '.php', '.cs', '.c', '.cpp', '.h'];

/**
 * Detect if a directory is an existing project with code
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<{isExisting: boolean, ecosystem: string|null, markers: string[]}>}
 */
export async function detectExistingProject(projectRoot) {
  const markers = [];
  let ecosystem = null;

  // Check for project manifest files
  for (const [file, eco] of Object.entries(PROJECT_MARKERS)) {
    if (file.includes('*')) {
      // Glob pattern - check directory
      const entries = await readdir(projectRoot).catch(() => []);
      const pattern = file.replace('*', '');
      if (entries.some((e) => e.endsWith(pattern))) {
        markers.push(file);
        if (!ecosystem) ecosystem = eco;
      }
    } else {
      const filePath = path.join(projectRoot, file);
      if (await exists(filePath)) {
        markers.push(file);
        if (!ecosystem) ecosystem = eco;
      }
    }
  }

  // Check for source directories
  for (const dir of SOURCE_DIRS) {
    const dirPath = path.join(projectRoot, dir);
    if (await isDirectory(dirPath)) {
      markers.push(`${dir}/`);
    }
  }

  // Check for source files at root level (limited depth)
  const entries = await readdir(projectRoot).catch(() => []);
  for (const entry of entries) {
    if (SOURCE_EXTENSIONS.some((ext) => entry.endsWith(ext))) {
      markers.push(entry);
      break; // Only need one to confirm
    }
  }

  return {
    isExisting: markers.length > 0,
    ecosystem,
    markers,
  };
}

/**
 * Detect project name from directory or package file
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<string>} Project name
 */
export async function detectProjectName(projectRoot) {
  // Try package.json first
  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (await exists(packageJsonPath)) {
    try {
      const pkg = await readJson(packageJsonPath);
      if (pkg.name) return pkg.name;
    } catch {
      // Ignore parse errors
    }
  }

  // Try pyproject.toml
  const pyprojectPath = path.join(projectRoot, 'pyproject.toml');
  if (await exists(pyprojectPath)) {
    try {
      const { readFile } = await import('./utils/fs-helpers.js');
      const content = await readFile(pyprojectPath);
      const nameMatch = content.match(/name\s*=\s*["']([^"']+)["']/);
      if (nameMatch) return nameMatch[1];
    } catch {
      // Ignore errors
    }
  }

  // Try Cargo.toml
  const cargoPath = path.join(projectRoot, 'Cargo.toml');
  if (await exists(cargoPath)) {
    try {
      const { readFile } = await import('./utils/fs-helpers.js');
      const content = await readFile(cargoPath);
      const nameMatch = content.match(/name\s*=\s*["']([^"']+)["']/);
      if (nameMatch) return nameMatch[1];
    } catch {
      // Ignore errors
    }
  }

  // Fall back to directory name
  return path.basename(projectRoot);
}

/**
 * Detect existing iSDLC installation
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<{installed: boolean, version: string|null, hasManifest: boolean}>}
 */
export async function detectExistingIsdlc(projectRoot) {
  const isdlcDir = path.join(projectRoot, '.isdlc');
  const claudeDir = path.join(projectRoot, '.claude');
  const stateFile = path.join(isdlcDir, 'state.json');
  const manifestFile = path.join(isdlcDir, 'installed-files.json');

  const hasIsdlc = await exists(isdlcDir);
  const hasClaude = await exists(claudeDir);
  const hasManifest = await exists(manifestFile);

  if (!hasIsdlc && !hasClaude) {
    return { installed: false, version: null, hasManifest: false };
  }

  // Try to get version from state.json
  let version = null;
  if (await exists(stateFile)) {
    try {
      const state = await readJson(stateFile);
      version = state.framework_version || null;
    } catch {
      // Ignore parse errors
    }
  }

  return {
    installed: true,
    version,
    hasManifest,
  };
}

/**
 * Detect tech stack from project markers
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<{primary: string|null, frameworks: string[], languages: string[]}>}
 */
export async function detectTechStack(projectRoot) {
  const result = {
    primary: null,
    frameworks: [],
    languages: [],
  };

  // Check package.json for JS frameworks
  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (await exists(packageJsonPath)) {
    try {
      const pkg = await readJson(packageJsonPath);
      const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

      // Detect frameworks
      if (allDeps.react || allDeps['react-dom']) result.frameworks.push('react');
      if (allDeps.vue) result.frameworks.push('vue');
      if (allDeps.angular || allDeps['@angular/core']) result.frameworks.push('angular');
      if (allDeps.svelte) result.frameworks.push('svelte');
      if (allDeps.next) result.frameworks.push('next.js');
      if (allDeps.nuxt) result.frameworks.push('nuxt');
      if (allDeps.express) result.frameworks.push('express');
      if (allDeps.fastify) result.frameworks.push('fastify');
      if (allDeps.nestjs || allDeps['@nestjs/core']) result.frameworks.push('nestjs');
      if (allDeps.jest) result.frameworks.push('jest');
      if (allDeps.vitest) result.frameworks.push('vitest');
      if (allDeps.mocha) result.frameworks.push('mocha');
      if (allDeps.typescript) result.languages.push('typescript');

      result.languages.push('javascript');
    } catch {
      // Ignore errors
    }
  }

  // Check for Python
  if ((await exists(path.join(projectRoot, 'requirements.txt'))) || (await exists(path.join(projectRoot, 'pyproject.toml')))) {
    result.languages.push('python');
  }

  // Check for Go
  if (await exists(path.join(projectRoot, 'go.mod'))) {
    result.languages.push('go');
  }

  // Check for Rust
  if (await exists(path.join(projectRoot, 'Cargo.toml'))) {
    result.languages.push('rust');
  }

  // Check for Java
  if ((await exists(path.join(projectRoot, 'pom.xml'))) || (await exists(path.join(projectRoot, 'build.gradle')))) {
    result.languages.push('java');
  }

  // Set primary language
  if (result.languages.length > 0) {
    result.primary = result.languages[0];
  }

  return result;
}

export default {
  detectExistingProject,
  detectProjectName,
  detectExistingIsdlc,
  detectTechStack,
};
