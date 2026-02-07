/**
 * Tests for lib/monorepo-handler.js
 *
 * Uses REAL temp filesystem (not mocks) to verify all monorepo detection functions.
 * Each describe block manages its own temp directory for isolation.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTempDir, cleanupTempDir, createProjectDir } from './utils/test-helpers.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  detectMonorepo,
  discoverProjects,
  getScanPaths,
  loadMonorepoConfig,
  generateMonorepoConfig,
} from './monorepo-handler.js';
import defaultExport from './monorepo-handler.js';

// ---------------------------------------------------------------------------
// detectMonorepo
// ---------------------------------------------------------------------------

describe('detectMonorepo()', () => {
  describe('pnpm workspace', () => {
    let dir;

    before(() => {
      dir = createTempDir();
      writeFileSync(
        join(dir, 'pnpm-workspace.yaml'),
        'packages:\n  - "packages/*"\n',
        'utf-8'
      );
    });

    after(() => cleanupTempDir(dir));

    it('should detect pnpm monorepo', async () => {
      const result = await detectMonorepo(dir);
      assert.equal(result.isMonorepo, true);
      assert.equal(result.type, 'pnpm');
    });
  });

  describe('lerna workspace', () => {
    let dir;

    before(() => {
      dir = createTempDir();
      writeFileSync(
        join(dir, 'lerna.json'),
        JSON.stringify({ version: '1.0.0', packages: ['packages/*'] }),
        'utf-8'
      );
    });

    after(() => cleanupTempDir(dir));

    it('should detect lerna monorepo', async () => {
      const result = await detectMonorepo(dir);
      assert.equal(result.isMonorepo, true);
      assert.equal(result.type, 'lerna');
    });
  });

  describe('turbo workspace', () => {
    let dir;

    before(() => {
      dir = createTempDir();
      writeFileSync(
        join(dir, 'turbo.json'),
        JSON.stringify({ pipeline: {} }),
        'utf-8'
      );
    });

    after(() => cleanupTempDir(dir));

    it('should detect turbo monorepo', async () => {
      const result = await detectMonorepo(dir);
      assert.equal(result.isMonorepo, true);
      assert.equal(result.type, 'turbo');
    });
  });

  describe('nx workspace', () => {
    let dir;

    before(() => {
      dir = createTempDir();
      writeFileSync(
        join(dir, 'nx.json'),
        JSON.stringify({ targetDefaults: {} }),
        'utf-8'
      );
    });

    after(() => cleanupTempDir(dir));

    it('should detect nx monorepo', async () => {
      const result = await detectMonorepo(dir);
      assert.equal(result.isMonorepo, true);
      assert.equal(result.type, 'nx');
    });
  });

  describe('rush workspace', () => {
    let dir;

    before(() => {
      dir = createTempDir();
      writeFileSync(
        join(dir, 'rush.json'),
        JSON.stringify({ rushVersion: '5.0.0' }),
        'utf-8'
      );
    });

    after(() => cleanupTempDir(dir));

    it('should detect rush monorepo', async () => {
      const result = await detectMonorepo(dir);
      assert.equal(result.isMonorepo, true);
      assert.equal(result.type, 'rush');
    });
  });

  describe('directory structure with 2+ projects in apps/', () => {
    let dir;

    before(() => {
      dir = createTempDir();
      // Create apps/ with two sub-projects each having a package.json
      mkdirSync(join(dir, 'apps', 'web'), { recursive: true });
      mkdirSync(join(dir, 'apps', 'api'), { recursive: true });
      writeFileSync(
        join(dir, 'apps', 'web', 'package.json'),
        JSON.stringify({ name: 'web' }),
        'utf-8'
      );
      writeFileSync(
        join(dir, 'apps', 'api', 'package.json'),
        JSON.stringify({ name: 'api' }),
        'utf-8'
      );
    });

    after(() => cleanupTempDir(dir));

    it('should detect monorepo via directory-structure', async () => {
      const result = await detectMonorepo(dir);
      assert.equal(result.isMonorepo, true);
      assert.equal(result.type, 'directory-structure');
    });
  });

  describe('directory structure with 2+ projects in packages/', () => {
    let dir;

    before(() => {
      dir = createTempDir();
      mkdirSync(join(dir, 'packages', 'core'), { recursive: true });
      mkdirSync(join(dir, 'packages', 'utils'), { recursive: true });
      writeFileSync(
        join(dir, 'packages', 'core', 'package.json'),
        JSON.stringify({ name: 'core' }),
        'utf-8'
      );
      writeFileSync(
        join(dir, 'packages', 'utils', 'package.json'),
        JSON.stringify({ name: 'utils' }),
        'utf-8'
      );
    });

    after(() => cleanupTempDir(dir));

    it('should detect monorepo via directory-structure in packages/', async () => {
      const result = await detectMonorepo(dir);
      assert.equal(result.isMonorepo, true);
      assert.equal(result.type, 'directory-structure');
    });
  });

  describe('directory structure with projects having src/ (no manifest)', () => {
    let dir;

    before(() => {
      dir = createTempDir();
      mkdirSync(join(dir, 'apps', 'alpha', 'src'), { recursive: true });
      mkdirSync(join(dir, 'apps', 'beta', 'src'), { recursive: true });
    });

    after(() => cleanupTempDir(dir));

    it('should detect monorepo via src/ directories in sub-projects', async () => {
      const result = await detectMonorepo(dir);
      assert.equal(result.isMonorepo, true);
      assert.equal(result.type, 'directory-structure');
    });
  });

  describe('root-level project directories (frontend + backend)', () => {
    let dir;

    before(() => {
      dir = createTempDir();
      mkdirSync(join(dir, 'frontend'), { recursive: true });
      mkdirSync(join(dir, 'backend'), { recursive: true });
      writeFileSync(
        join(dir, 'frontend', 'package.json'),
        JSON.stringify({ name: 'frontend' }),
        'utf-8'
      );
      writeFileSync(
        join(dir, 'backend', 'package.json'),
        JSON.stringify({ name: 'backend' }),
        'utf-8'
      );
    });

    after(() => cleanupTempDir(dir));

    it('should detect monorepo via root-directories type', async () => {
      const result = await detectMonorepo(dir);
      assert.equal(result.isMonorepo, true);
      assert.equal(result.type, 'root-directories');
    });
  });

  describe('single project directory (not a monorepo)', () => {
    let dir;

    before(() => {
      dir = createTempDir();
      writeFileSync(
        join(dir, 'package.json'),
        JSON.stringify({ name: 'single-project' }),
        'utf-8'
      );
      mkdirSync(join(dir, 'src'));
    });

    after(() => cleanupTempDir(dir));

    it('should return isMonorepo false', async () => {
      const result = await detectMonorepo(dir);
      assert.equal(result.isMonorepo, false);
      assert.equal(result.type, null);
    });
  });

  describe('empty directory', () => {
    let dir;

    before(() => {
      dir = createTempDir();
    });

    after(() => cleanupTempDir(dir));

    it('should return isMonorepo false', async () => {
      const result = await detectMonorepo(dir);
      assert.equal(result.isMonorepo, false);
      assert.equal(result.type, null);
    });
  });

  describe('only one project in apps/ (below threshold)', () => {
    let dir;

    before(() => {
      dir = createTempDir();
      mkdirSync(join(dir, 'apps', 'web'), { recursive: true });
      writeFileSync(
        join(dir, 'apps', 'web', 'package.json'),
        JSON.stringify({ name: 'web' }),
        'utf-8'
      );
    });

    after(() => cleanupTempDir(dir));

    it('should return isMonorepo false with only 1 project', async () => {
      const result = await detectMonorepo(dir);
      assert.equal(result.isMonorepo, false);
      assert.equal(result.type, null);
    });
  });

  describe('workspace marker takes priority over directory scan', () => {
    let dir;

    before(() => {
      dir = createTempDir();
      // Both a pnpm-workspace.yaml and directory structure
      writeFileSync(
        join(dir, 'pnpm-workspace.yaml'),
        'packages:\n  - "packages/*"\n',
        'utf-8'
      );
      mkdirSync(join(dir, 'apps', 'web'), { recursive: true });
      mkdirSync(join(dir, 'apps', 'api'), { recursive: true });
      writeFileSync(
        join(dir, 'apps', 'web', 'package.json'),
        JSON.stringify({ name: 'web' }),
        'utf-8'
      );
      writeFileSync(
        join(dir, 'apps', 'api', 'package.json'),
        JSON.stringify({ name: 'api' }),
        'utf-8'
      );
    });

    after(() => cleanupTempDir(dir));

    it('should return pnpm type (workspace marker checked first)', async () => {
      const result = await detectMonorepo(dir);
      assert.equal(result.isMonorepo, true);
      assert.equal(result.type, 'pnpm');
    });
  });

  describe('skipped directories are ignored for root-level detection', () => {
    let dir;

    before(() => {
      dir = createTempDir();
      // Create node_modules and .git with project markers - these should be skipped
      mkdirSync(join(dir, 'node_modules', 'some-pkg'), { recursive: true });
      mkdirSync(join(dir, '.git', 'hooks'), { recursive: true });
      writeFileSync(
        join(dir, 'node_modules', 'some-pkg', 'package.json'),
        JSON.stringify({ name: 'some-pkg' }),
        'utf-8'
      );
      // Only one real project at root level
      mkdirSync(join(dir, 'frontend'), { recursive: true });
      writeFileSync(
        join(dir, 'frontend', 'package.json'),
        JSON.stringify({ name: 'frontend' }),
        'utf-8'
      );
    });

    after(() => cleanupTempDir(dir));

    it('should not count node_modules/.git as projects', async () => {
      const result = await detectMonorepo(dir);
      assert.equal(result.isMonorepo, false);
    });
  });

  describe('projects across multiple monorepo dirs', () => {
    let dir;

    before(() => {
      dir = createTempDir();
      // One project in apps/, one in packages/ => total 2
      mkdirSync(join(dir, 'apps', 'web'), { recursive: true });
      mkdirSync(join(dir, 'packages', 'utils'), { recursive: true });
      writeFileSync(
        join(dir, 'apps', 'web', 'package.json'),
        JSON.stringify({ name: 'web' }),
        'utf-8'
      );
      writeFileSync(
        join(dir, 'packages', 'utils', 'package.json'),
        JSON.stringify({ name: 'utils' }),
        'utf-8'
      );
    });

    after(() => cleanupTempDir(dir));

    it('should count projects across apps/ and packages/', async () => {
      const result = await detectMonorepo(dir);
      assert.equal(result.isMonorepo, true);
      assert.equal(result.type, 'directory-structure');
    });
  });
});

// ---------------------------------------------------------------------------
// discoverProjects
// ---------------------------------------------------------------------------

describe('discoverProjects()', () => {
  describe('projects in apps/ directory', () => {
    let dir;

    before(() => {
      dir = createTempDir();
      mkdirSync(join(dir, 'apps', 'web'), { recursive: true });
      mkdirSync(join(dir, 'apps', 'api'), { recursive: true });
      writeFileSync(
        join(dir, 'apps', 'web', 'package.json'),
        JSON.stringify({ name: 'web' }),
        'utf-8'
      );
      writeFileSync(
        join(dir, 'apps', 'api', 'package.json'),
        JSON.stringify({ name: 'api' }),
        'utf-8'
      );
    });

    after(() => cleanupTempDir(dir));

    it('should discover projects in apps/', async () => {
      const projects = await discoverProjects(dir);
      const names = projects.map((p) => p.name);
      assert.ok(names.includes('web'));
      assert.ok(names.includes('api'));
    });

    it('should set relative path for each project', async () => {
      const projects = await discoverProjects(dir);
      const web = projects.find((p) => p.name === 'web');
      assert.equal(web.path, 'apps/web');
    });

    it('should mark projects as discovered', async () => {
      const projects = await discoverProjects(dir);
      for (const proj of projects) {
        assert.equal(proj.discovered, true);
      }
    });
  });

  describe('projects in packages/ directory', () => {
    let dir;

    before(() => {
      dir = createTempDir();
      mkdirSync(join(dir, 'packages', 'core'), { recursive: true });
      mkdirSync(join(dir, 'packages', 'ui'), { recursive: true });
      writeFileSync(
        join(dir, 'packages', 'core', 'package.json'),
        JSON.stringify({ name: 'core' }),
        'utf-8'
      );
      writeFileSync(
        join(dir, 'packages', 'ui', 'package.json'),
        JSON.stringify({ name: 'ui' }),
        'utf-8'
      );
    });

    after(() => cleanupTempDir(dir));

    it('should discover projects in packages/', async () => {
      const projects = await discoverProjects(dir);
      const names = projects.map((p) => p.name);
      assert.ok(names.includes('core'));
      assert.ok(names.includes('ui'));
    });

    it('should set packages/ relative paths', async () => {
      const projects = await discoverProjects(dir);
      const core = projects.find((p) => p.name === 'core');
      assert.equal(core.path, 'packages/core');
    });
  });

  describe('projects in services/ directory', () => {
    let dir;

    before(() => {
      dir = createTempDir();
      mkdirSync(join(dir, 'services', 'auth'), { recursive: true });
      writeFileSync(
        join(dir, 'services', 'auth', 'package.json'),
        JSON.stringify({ name: 'auth' }),
        'utf-8'
      );
    });

    after(() => cleanupTempDir(dir));

    it('should discover projects in services/', async () => {
      const projects = await discoverProjects(dir);
      const auth = projects.find((p) => p.name === 'auth');
      assert.ok(auth, 'auth project should be discovered');
      assert.equal(auth.path, 'services/auth');
    });
  });

  describe('root-level project directories', () => {
    let dir;

    before(() => {
      dir = createTempDir();
      mkdirSync(join(dir, 'frontend'), { recursive: true });
      mkdirSync(join(dir, 'backend'), { recursive: true });
      writeFileSync(
        join(dir, 'frontend', 'package.json'),
        JSON.stringify({ name: 'frontend' }),
        'utf-8'
      );
      writeFileSync(
        join(dir, 'backend', 'package.json'),
        JSON.stringify({ name: 'backend' }),
        'utf-8'
      );
    });

    after(() => cleanupTempDir(dir));

    it('should discover root-level projects', async () => {
      const projects = await discoverProjects(dir);
      const names = projects.map((p) => p.name);
      assert.ok(names.includes('frontend'));
      assert.ok(names.includes('backend'));
    });

    it('should use simple name as path for root-level projects', async () => {
      const projects = await discoverProjects(dir);
      const frontend = projects.find((p) => p.name === 'frontend');
      assert.equal(frontend.path, 'frontend');
    });
  });

  describe('skips .git and node_modules directories', () => {
    let dir;

    before(() => {
      dir = createTempDir();
      // Create .git and node_modules with project-like contents
      mkdirSync(join(dir, '.git'), { recursive: true });
      mkdirSync(join(dir, 'node_modules', 'pkg'), { recursive: true });
      writeFileSync(
        join(dir, 'node_modules', 'pkg', 'package.json'),
        JSON.stringify({ name: 'pkg' }),
        'utf-8'
      );
      // One real project
      mkdirSync(join(dir, 'myapp'), { recursive: true });
      writeFileSync(
        join(dir, 'myapp', 'package.json'),
        JSON.stringify({ name: 'myapp' }),
        'utf-8'
      );
    });

    after(() => cleanupTempDir(dir));

    it('should not include .git or node_modules in discovered projects', async () => {
      const projects = await discoverProjects(dir);
      const names = projects.map((p) => p.name);
      assert.ok(!names.includes('.git'), '.git should be skipped');
      assert.ok(!names.includes('node_modules'), 'node_modules should be skipped');
      assert.ok(!names.includes('pkg'), 'packages inside node_modules should be skipped');
      assert.ok(names.includes('myapp'), 'real project should be found');
    });
  });

  describe('deduplication of projects', () => {
    let dir;

    before(() => {
      dir = createTempDir();
      // Same-named project in both apps/ and packages/
      mkdirSync(join(dir, 'apps', 'shared'), { recursive: true });
      mkdirSync(join(dir, 'packages', 'shared'), { recursive: true });
      writeFileSync(
        join(dir, 'apps', 'shared', 'package.json'),
        JSON.stringify({ name: 'shared' }),
        'utf-8'
      );
      writeFileSync(
        join(dir, 'packages', 'shared', 'package.json'),
        JSON.stringify({ name: 'shared' }),
        'utf-8'
      );
    });

    after(() => cleanupTempDir(dir));

    it('should deduplicate by name (first occurrence wins)', async () => {
      const projects = await discoverProjects(dir);
      const sharedProjects = projects.filter((p) => p.name === 'shared');
      assert.equal(sharedProjects.length, 1, 'Should only have one "shared" project');
      // apps/ is scanned before packages/ in MONOREPO_DIRS
      assert.equal(sharedProjects[0].path, 'apps/shared');
    });
  });

  describe('empty directory', () => {
    let dir;

    before(() => {
      dir = createTempDir();
    });

    after(() => cleanupTempDir(dir));

    it('should return empty array', async () => {
      const projects = await discoverProjects(dir);
      assert.deepEqual(projects, []);
    });
  });

  describe('directories without project markers are skipped', () => {
    let dir;

    before(() => {
      dir = createTempDir();
      mkdirSync(join(dir, 'apps', 'empty-dir'), { recursive: true });
      mkdirSync(join(dir, 'apps', 'valid'), { recursive: true });
      writeFileSync(
        join(dir, 'apps', 'valid', 'package.json'),
        JSON.stringify({ name: 'valid' }),
        'utf-8'
      );
    });

    after(() => cleanupTempDir(dir));

    it('should only discover directories with project markers', async () => {
      const projects = await discoverProjects(dir);
      const names = projects.map((p) => p.name);
      assert.ok(!names.includes('empty-dir'), 'empty-dir should not be discovered');
      assert.ok(names.includes('valid'), 'valid should be discovered');
    });
  });

  describe('files in monorepo dirs are skipped (only directories scanned)', () => {
    let dir;

    before(() => {
      dir = createTempDir();
      mkdirSync(join(dir, 'apps'), { recursive: true });
      // A file (not directory) inside apps/
      writeFileSync(join(dir, 'apps', 'README.md'), '# Apps', 'utf-8');
      mkdirSync(join(dir, 'apps', 'web'), { recursive: true });
      writeFileSync(
        join(dir, 'apps', 'web', 'package.json'),
        JSON.stringify({ name: 'web' }),
        'utf-8'
      );
    });

    after(() => cleanupTempDir(dir));

    it('should ignore files inside monorepo dirs', async () => {
      const projects = await discoverProjects(dir);
      assert.equal(projects.length, 1);
      assert.equal(projects[0].name, 'web');
    });
  });

  describe('Go project markers in monorepo dir', () => {
    let dir;

    before(() => {
      dir = createTempDir();
      mkdirSync(join(dir, 'services', 'gateway'), { recursive: true });
      writeFileSync(
        join(dir, 'services', 'gateway', 'go.mod'),
        'module example.com/gateway\n\ngo 1.21\n',
        'utf-8'
      );
    });

    after(() => cleanupTempDir(dir));

    it('should discover Go projects via go.mod marker', async () => {
      const projects = await discoverProjects(dir);
      const gateway = projects.find((p) => p.name === 'gateway');
      assert.ok(gateway, 'Go project should be discovered');
      assert.equal(gateway.path, 'services/gateway');
    });
  });
});

// ---------------------------------------------------------------------------
// getScanPaths
// ---------------------------------------------------------------------------

describe('getScanPaths()', () => {
  it('should extract parent directories from nested paths', () => {
    const projects = [
      { name: 'web', path: 'apps/web' },
      { name: 'api', path: 'apps/api' },
    ];
    const paths = getScanPaths(projects);
    assert.deepEqual(paths, ['apps/']);
  });

  it('should return root-level paths as-is', () => {
    const projects = [
      { name: 'frontend', path: 'frontend' },
      { name: 'backend', path: 'backend' },
    ];
    const paths = getScanPaths(projects);
    assert.ok(paths.includes('frontend'));
    assert.ok(paths.includes('backend'));
    assert.equal(paths.length, 2);
  });

  it('should deduplicate parent directories', () => {
    const projects = [
      { name: 'web', path: 'apps/web' },
      { name: 'api', path: 'apps/api' },
      { name: 'utils', path: 'packages/utils' },
    ];
    const paths = getScanPaths(projects);
    assert.ok(paths.includes('apps/'));
    assert.ok(paths.includes('packages/'));
    assert.equal(paths.length, 2);
  });

  it('should handle mixed nested and root-level paths', () => {
    const projects = [
      { name: 'web', path: 'apps/web' },
      { name: 'frontend', path: 'frontend' },
    ];
    const paths = getScanPaths(projects);
    assert.ok(paths.includes('apps/'));
    assert.ok(paths.includes('frontend'));
    assert.equal(paths.length, 2);
  });

  it('should return empty array for empty input', () => {
    const paths = getScanPaths([]);
    assert.deepEqual(paths, []);
  });

  it('should handle single project', () => {
    const paths = getScanPaths([{ name: 'core', path: 'packages/core' }]);
    assert.deepEqual(paths, ['packages/']);
  });

  it('is a pure function (no filesystem access needed)', () => {
    // Call twice with same input, verify deterministic output
    const input = [{ name: 'a', path: 'libs/a' }];
    const result1 = getScanPaths(input);
    const result2 = getScanPaths(input);
    assert.deepEqual(result1, result2);
  });
});

// ---------------------------------------------------------------------------
// generateMonorepoConfig
// ---------------------------------------------------------------------------

describe('generateMonorepoConfig()', () => {
  it('should generate config with projects map', () => {
    const projects = [
      { name: 'web', path: 'apps/web', discovered: true },
      { name: 'api', path: 'apps/api', discovered: true },
    ];
    const config = generateMonorepoConfig(projects);

    assert.equal(config.version, '1.0.0');
    assert.ok(config.projects.web);
    assert.ok(config.projects.api);
    assert.equal(config.projects.web.name, 'web');
    assert.equal(config.projects.web.path, 'apps/web');
    assert.equal(config.projects.api.name, 'api');
    assert.equal(config.projects.api.path, 'apps/api');
  });

  it('should use first project as default_project', () => {
    const projects = [
      { name: 'alpha', path: 'packages/alpha', discovered: true },
      { name: 'beta', path: 'packages/beta', discovered: true },
    ];
    const config = generateMonorepoConfig(projects);
    assert.equal(config.default_project, 'alpha');
  });

  it('should set default_project to null for empty projects', () => {
    const config = generateMonorepoConfig([]);
    assert.equal(config.default_project, null);
  });

  it('should include scan_paths from getScanPaths', () => {
    const projects = [
      { name: 'web', path: 'apps/web', discovered: true },
      { name: 'core', path: 'packages/core', discovered: true },
    ];
    const config = generateMonorepoConfig(projects);
    assert.ok(config.scan_paths.includes('apps/'));
    assert.ok(config.scan_paths.includes('packages/'));
  });

  it('should set docs_location from options', () => {
    const projects = [{ name: 'web', path: 'apps/web', discovered: true }];
    const config = generateMonorepoConfig(projects, { docsLocation: 'per-project' });
    assert.equal(config.docs_location, 'per-project');
  });

  it('should default docs_location to root', () => {
    const projects = [{ name: 'web', path: 'apps/web', discovered: true }];
    const config = generateMonorepoConfig(projects);
    assert.equal(config.docs_location, 'root');
  });

  it('should include registered_at timestamp in each project', () => {
    const projects = [{ name: 'web', path: 'apps/web', discovered: true }];
    const config = generateMonorepoConfig(projects);
    assert.ok(config.projects.web.registered_at, 'Should have registered_at');
    // Verify it is an ISO date string
    const date = new Date(config.projects.web.registered_at);
    assert.ok(!isNaN(date.getTime()), 'registered_at should be a valid ISO date');
  });

  it('should include discovered flag in each project', () => {
    const projects = [{ name: 'web', path: 'apps/web', discovered: true }];
    const config = generateMonorepoConfig(projects);
    assert.equal(config.projects.web.discovered, true);
  });

  it('is a pure function (no filesystem access needed)', () => {
    const projects = [{ name: 'x', path: 'apps/x', discovered: true }];
    const config1 = generateMonorepoConfig(projects);
    const config2 = generateMonorepoConfig(projects);
    // Structure should be identical (timestamps may differ by a few ms)
    assert.equal(config1.version, config2.version);
    assert.equal(config1.default_project, config2.default_project);
    assert.deepEqual(config1.scan_paths, config2.scan_paths);
  });

  it('should handle projects without discovered flag', () => {
    const projects = [{ name: 'manual', path: 'apps/manual' }];
    const config = generateMonorepoConfig(projects);
    // Code does: proj.discovered || true, so discovered should be true
    assert.equal(config.projects.manual.discovered, true);
  });
});

// ---------------------------------------------------------------------------
// loadMonorepoConfig
// ---------------------------------------------------------------------------

describe('loadMonorepoConfig()', () => {
  describe('config file exists', () => {
    let dir;

    before(() => {
      dir = createTempDir();
      mkdirSync(join(dir, '.isdlc'), { recursive: true });
      const config = {
        version: '1.0.0',
        default_project: 'web',
        projects: { web: { name: 'web', path: 'apps/web' } },
      };
      writeFileSync(
        join(dir, '.isdlc', 'monorepo.json'),
        JSON.stringify(config, null, 2),
        'utf-8'
      );
    });

    after(() => cleanupTempDir(dir));

    it('should return parsed config', async () => {
      const config = await loadMonorepoConfig(dir);
      assert.ok(config);
      assert.equal(config.version, '1.0.0');
      assert.equal(config.default_project, 'web');
      assert.ok(config.projects.web);
    });
  });

  describe('config file does not exist', () => {
    let dir;

    before(() => {
      dir = createTempDir();
    });

    after(() => cleanupTempDir(dir));

    it('should return null when monorepo.json does not exist', async () => {
      const config = await loadMonorepoConfig(dir);
      assert.equal(config, null);
    });
  });

  describe('.isdlc directory exists but no monorepo.json', () => {
    let dir;

    before(() => {
      dir = createTempDir();
      mkdirSync(join(dir, '.isdlc'), { recursive: true });
    });

    after(() => cleanupTempDir(dir));

    it('should return null', async () => {
      const config = await loadMonorepoConfig(dir);
      assert.equal(config, null);
    });
  });

  describe('invalid JSON in monorepo.json', () => {
    let dir;

    before(() => {
      dir = createTempDir();
      mkdirSync(join(dir, '.isdlc'), { recursive: true });
      writeFileSync(
        join(dir, '.isdlc', 'monorepo.json'),
        '{invalid json!!!',
        'utf-8'
      );
    });

    after(() => cleanupTempDir(dir));

    it('should return null on parse error', async () => {
      const config = await loadMonorepoConfig(dir);
      assert.equal(config, null);
    });
  });
});

// ---------------------------------------------------------------------------
// default export
// ---------------------------------------------------------------------------

describe('monorepo-handler default export', () => {
  it('should export an object containing all 5 functions', () => {
    const expectedFunctions = [
      'detectMonorepo',
      'discoverProjects',
      'getScanPaths',
      'loadMonorepoConfig',
      'generateMonorepoConfig',
    ];

    for (const name of expectedFunctions) {
      assert.equal(
        typeof defaultExport[name],
        'function',
        `default.${name} should be a function`
      );
    }

    assert.equal(
      Object.keys(defaultExport).length,
      expectedFunctions.length,
      `Default export should have exactly ${expectedFunctions.length} keys`
    );
  });
});
