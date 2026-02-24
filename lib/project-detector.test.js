/**
 * Tests for lib/project-detector.js
 *
 * Uses REAL temp filesystem (not mocks) to verify all project detection functions.
 * Each describe block manages its own temp directory for isolation.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTempDir, cleanupTempDir, createProjectDir } from './utils/test-helpers.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import {
  detectExistingProject,
  detectProjectName,
  detectExistingIsdlc,
  detectTechStack,
} from './project-detector.js';
import defaultExport from './project-detector.js';

// ---------------------------------------------------------------------------
// detectExistingProject
// ---------------------------------------------------------------------------

describe('detectExistingProject()', () => {
  describe('Node.js project', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'node-app',
        packageJson: { name: 'node-app', version: '1.0.0' },
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should detect as existing project', async () => {
      const result = await detectExistingProject(projectDir);
      assert.equal(result.isExisting, true);
    });

    it('should identify node ecosystem', async () => {
      const result = await detectExistingProject(projectDir);
      assert.equal(result.ecosystem, 'node');
    });

    it('should include package.json in markers', async () => {
      const result = await detectExistingProject(projectDir);
      assert.ok(result.markers.includes('package.json'), 'markers should contain package.json');
    });
  });

  describe('Python project', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'python-app',
        files: { 'requirements.txt': 'flask>=2.0\nrequests\n' },
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should detect as existing project with python ecosystem', async () => {
      const result = await detectExistingProject(projectDir);
      assert.equal(result.isExisting, true);
      assert.equal(result.ecosystem, 'python');
      assert.ok(result.markers.includes('requirements.txt'));
    });
  });

  describe('Go project', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'go-app',
        goMod: true,
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should detect as existing project with go ecosystem', async () => {
      const result = await detectExistingProject(projectDir);
      assert.equal(result.isExisting, true);
      assert.equal(result.ecosystem, 'go');
      assert.ok(result.markers.includes('go.mod'));
    });
  });

  describe('Rust project', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'rust-app',
        cargoToml: true,
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should detect as existing project with rust ecosystem', async () => {
      const result = await detectExistingProject(projectDir);
      assert.equal(result.isExisting, true);
      assert.equal(result.ecosystem, 'rust');
      assert.ok(result.markers.includes('Cargo.toml'));
    });
  });

  describe('Java/Maven project', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'java-app',
        files: { 'pom.xml': '<project><modelVersion>4.0.0</modelVersion></project>' },
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should detect as existing project with maven ecosystem', async () => {
      const result = await detectExistingProject(projectDir);
      assert.equal(result.isExisting, true);
      assert.equal(result.ecosystem, 'maven');
      assert.ok(result.markers.includes('pom.xml'));
    });
  });

  describe('Gradle project', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'gradle-app',
        files: { 'build.gradle': 'plugins { id "java" }' },
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should detect as existing project with gradle ecosystem', async () => {
      const result = await detectExistingProject(projectDir);
      assert.equal(result.isExisting, true);
      assert.equal(result.ecosystem, 'gradle');
      assert.ok(result.markers.includes('build.gradle'));
    });
  });

  describe('Ruby project', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'ruby-app',
        files: { Gemfile: 'source "https://rubygems.org"\ngem "rails"\n' },
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should detect as existing project with ruby ecosystem', async () => {
      const result = await detectExistingProject(projectDir);
      assert.equal(result.isExisting, true);
      assert.equal(result.ecosystem, 'ruby');
      assert.ok(result.markers.includes('Gemfile'));
    });
  });

  describe('PHP project', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'php-app',
        files: { 'composer.json': '{"require":{}}' },
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should detect as existing project with php ecosystem', async () => {
      const result = await detectExistingProject(projectDir);
      assert.equal(result.isExisting, true);
      assert.equal(result.ecosystem, 'php');
      assert.ok(result.markers.includes('composer.json'));
    });
  });

  describe('TypeScript project', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'ts-app',
        packageJson: { name: 'ts-app' },
        files: { 'tsconfig.json': '{"compilerOptions":{}}' },
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should detect node as primary ecosystem (package.json checked first)', async () => {
      const result = await detectExistingProject(projectDir);
      assert.equal(result.isExisting, true);
      // package.json is checked first in PROJECT_MARKERS, so ecosystem = 'node'
      assert.equal(result.ecosystem, 'node');
      assert.ok(result.markers.includes('package.json'));
      assert.ok(result.markers.includes('tsconfig.json'));
    });
  });

  describe('Deno project', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'deno-app',
        files: { 'deno.json': '{"tasks":{}}' },
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should detect as existing project with deno ecosystem', async () => {
      const result = await detectExistingProject(projectDir);
      assert.equal(result.isExisting, true);
      assert.equal(result.ecosystem, 'deno');
    });
  });

  describe('Python pyproject.toml project', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'py-toml-app',
        pyprojectToml: true,
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should detect as existing python project', async () => {
      const result = await detectExistingProject(projectDir);
      assert.equal(result.isExisting, true);
      assert.equal(result.ecosystem, 'python');
      assert.ok(result.markers.includes('pyproject.toml'));
    });
  });

  describe('empty directory', () => {
    let dir;

    before(() => {
      dir = createTempDir();
    });

    after(() => cleanupTempDir(dir));

    it('should return isExisting false with no markers', async () => {
      const result = await detectExistingProject(dir);
      assert.equal(result.isExisting, false);
      assert.equal(result.ecosystem, null);
      assert.deepEqual(result.markers, []);
    });
  });

  describe('directory with src/ folder', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'src-only',
        srcDir: true,
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should detect as existing project via source directory', async () => {
      const result = await detectExistingProject(projectDir);
      assert.equal(result.isExisting, true);
      assert.ok(result.markers.includes('src/'), 'markers should include src/');
    });
  });

  describe('directory with other source directories', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'lib-only',
        files: {},
      });
      mkdirSync(join(projectDir, 'lib'), { recursive: true });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should detect lib/ as a source directory marker', async () => {
      const result = await detectExistingProject(projectDir);
      assert.equal(result.isExisting, true);
      assert.ok(result.markers.includes('lib/'));
    });
  });

  describe('directory with .js files at root level', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'js-files',
        files: { 'index.js': 'console.log("hello");' },
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should detect as existing project via source file extension', async () => {
      const result = await detectExistingProject(projectDir);
      assert.equal(result.isExisting, true);
      assert.ok(
        result.markers.some((m) => m.endsWith('.js')),
        'markers should include a .js file'
      );
    });
  });

  describe('directory with .py files at root level', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'py-files',
        files: { 'main.py': 'print("hello")' },
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should detect as existing project via .py source file', async () => {
      const result = await detectExistingProject(projectDir);
      assert.equal(result.isExisting, true);
      assert.ok(
        result.markers.some((m) => m.endsWith('.py')),
        'markers should include a .py file'
      );
    });
  });

  describe('multiple ecosystems present', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'multi-eco',
        packageJson: { name: 'multi-eco' },
        goMod: true,
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should set ecosystem to the first marker found (node before go)', async () => {
      const result = await detectExistingProject(projectDir);
      assert.equal(result.isExisting, true);
      // package.json is iterated first, so ecosystem should be 'node'
      assert.equal(result.ecosystem, 'node');
      assert.ok(result.markers.includes('package.json'));
      assert.ok(result.markers.includes('go.mod'));
    });
  });

  describe('Makefile project', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'make-app',
        files: { Makefile: 'all:\n\t@echo "build"' },
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should detect as existing project with make ecosystem', async () => {
      const result = await detectExistingProject(projectDir);
      assert.equal(result.isExisting, true);
      assert.equal(result.ecosystem, 'make');
      assert.ok(result.markers.includes('Makefile'));
    });
  });

  describe('.csproj glob pattern detection', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'dotnet-app',
        files: { 'MyApp.csproj': '<Project />' },
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should detect .csproj files via glob pattern as dotnet ecosystem', async () => {
      const result = await detectExistingProject(projectDir);
      assert.equal(result.isExisting, true);
      assert.equal(result.ecosystem, 'dotnet');
      assert.ok(result.markers.includes('*.csproj'));
    });
  });

  describe('only source file at root (no manifest)', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'bare-source',
        files: { 'app.tsx': 'export default () => null;' },
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should detect via source file extension with null ecosystem', async () => {
      const result = await detectExistingProject(projectDir);
      assert.equal(result.isExisting, true);
      // No manifest file found, so ecosystem remains null
      assert.equal(result.ecosystem, null);
      assert.ok(result.markers.some((m) => m.endsWith('.tsx')));
    });
  });
});

// ---------------------------------------------------------------------------
// detectProjectName
// ---------------------------------------------------------------------------

describe('detectProjectName()', () => {
  describe('reads name from package.json', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'pkg-name-test',
        packageJson: { name: 'my-awesome-app', version: '2.0.0' },
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should return the name field from package.json', async () => {
      const name = await detectProjectName(projectDir);
      assert.equal(name, 'my-awesome-app');
    });
  });

  describe('reads name from pyproject.toml', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'py-name-test',
        pyprojectToml: '[project]\nname = "flask-api"\nversion = "0.1.0"\n',
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should return the name from pyproject.toml', async () => {
      const name = await detectProjectName(projectDir);
      assert.equal(name, 'flask-api');
    });
  });

  describe('reads name from Cargo.toml', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'cargo-name-test',
        cargoToml: '[package]\nname = "my-crate"\nversion = "0.1.0"\n',
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should return the name from Cargo.toml', async () => {
      const name = await detectProjectName(projectDir);
      assert.equal(name, 'my-crate');
    });
  });

  describe('falls back to directory name', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'fallback-dir-name',
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should return the directory basename when no manifest files exist', async () => {
      const name = await detectProjectName(projectDir);
      assert.equal(name, 'fallback-dir-name');
    });
  });

  describe('package.json without name field', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'no-name-field',
        packageJson: { version: '1.0.0', description: 'no name' },
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should fall back to directory name when package.json has no name', async () => {
      const name = await detectProjectName(projectDir);
      assert.equal(name, 'no-name-field');
    });
  });

  describe('invalid package.json', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'bad-json',
        files: { 'package.json': '{not valid json!!!' },
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should fall back to directory name when package.json is invalid', async () => {
      const name = await detectProjectName(projectDir);
      assert.equal(name, 'bad-json');
    });
  });

  describe('package.json takes priority over pyproject.toml', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'priority-test',
        packageJson: { name: 'from-package-json' },
        pyprojectToml: '[project]\nname = "from-pyproject"\n',
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should return name from package.json when both exist', async () => {
      const name = await detectProjectName(projectDir);
      assert.equal(name, 'from-package-json');
    });
  });

  describe('pyproject.toml with single-quoted name', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'single-quote',
        pyprojectToml: "[project]\nname = 'single-quoted-app'\n",
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should parse single-quoted names in pyproject.toml', async () => {
      const name = await detectProjectName(projectDir);
      assert.equal(name, 'single-quoted-app');
    });
  });

  describe('pyproject.toml without name field', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'no-toml-name',
        pyprojectToml: '[project]\nversion = "0.1.0"\n',
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should fall back to directory name when pyproject.toml has no name', async () => {
      const name = await detectProjectName(projectDir);
      assert.equal(name, 'no-toml-name');
    });
  });
});

// ---------------------------------------------------------------------------
// detectExistingIsdlc
// ---------------------------------------------------------------------------

describe('detectExistingIsdlc()', () => {
  describe('full installation present', () => {
    let dir;

    before(() => {
      dir = createTempDir();
      mkdirSync(join(dir, '.isdlc'), { recursive: true });
      mkdirSync(join(dir, '.claude'), { recursive: true });
      writeFileSync(
        join(dir, '.isdlc', 'state.json'),
        JSON.stringify({ framework_version: '0.1.0', iteration: {} }),
        'utf-8'
      );
      writeFileSync(
        join(dir, '.isdlc', 'installed-files.json'),
        JSON.stringify({ files: [] }),
        'utf-8'
      );
    });

    after(() => cleanupTempDir(dir));

    it('should return installed true with version', async () => {
      const result = await detectExistingIsdlc(dir);
      assert.equal(result.installed, true);
      assert.equal(result.version, '0.1.0');
    });

    it('should detect installed-files.json manifest', async () => {
      const result = await detectExistingIsdlc(dir);
      assert.equal(result.hasManifest, true);
    });
  });

  describe('no iSDLC installation', () => {
    let dir;

    before(() => {
      dir = createTempDir();
    });

    after(() => cleanupTempDir(dir));

    it('should return installed false when neither .isdlc nor .claude exist', async () => {
      const result = await detectExistingIsdlc(dir);
      assert.equal(result.installed, false);
      assert.equal(result.version, null);
      assert.equal(result.hasManifest, false);
    });
  });

  describe('only .isdlc directory (no state.json)', () => {
    let dir;

    before(() => {
      dir = createTempDir();
      mkdirSync(join(dir, '.isdlc'), { recursive: true });
    });

    after(() => cleanupTempDir(dir));

    it('should return installed true with null version', async () => {
      const result = await detectExistingIsdlc(dir);
      assert.equal(result.installed, true);
      assert.equal(result.version, null);
      assert.equal(result.hasManifest, false);
    });
  });

  describe('only .claude directory present', () => {
    let dir;

    before(() => {
      dir = createTempDir();
      mkdirSync(join(dir, '.claude'), { recursive: true });
    });

    after(() => cleanupTempDir(dir));

    it('should return installed true (either directory suffices)', async () => {
      const result = await detectExistingIsdlc(dir);
      assert.equal(result.installed, true);
      assert.equal(result.version, null);
    });
  });

  describe('state.json with invalid JSON', () => {
    let dir;

    before(() => {
      dir = createTempDir();
      mkdirSync(join(dir, '.isdlc'), { recursive: true });
      writeFileSync(join(dir, '.isdlc', 'state.json'), '{broken json!!!', 'utf-8');
    });

    after(() => cleanupTempDir(dir));

    it('should return installed true with null version on parse error', async () => {
      const result = await detectExistingIsdlc(dir);
      assert.equal(result.installed, true);
      assert.equal(result.version, null);
    });
  });

  describe('state.json without framework_version field', () => {
    let dir;

    before(() => {
      dir = createTempDir();
      mkdirSync(join(dir, '.isdlc'), { recursive: true });
      writeFileSync(
        join(dir, '.isdlc', 'state.json'),
        JSON.stringify({ iteration: {} }),
        'utf-8'
      );
    });

    after(() => cleanupTempDir(dir));

    it('should return null version when field is missing', async () => {
      const result = await detectExistingIsdlc(dir);
      assert.equal(result.installed, true);
      assert.equal(result.version, null);
    });
  });

  describe('installed-files.json present', () => {
    let dir;

    before(() => {
      dir = createTempDir();
      mkdirSync(join(dir, '.isdlc'), { recursive: true });
      writeFileSync(
        join(dir, '.isdlc', 'installed-files.json'),
        JSON.stringify({ files: ['a.txt'] }),
        'utf-8'
      );
    });

    after(() => cleanupTempDir(dir));

    it('should return hasManifest true', async () => {
      const result = await detectExistingIsdlc(dir);
      assert.equal(result.installed, true);
      assert.equal(result.hasManifest, true);
    });
  });
});

// ---------------------------------------------------------------------------
// detectTechStack
// ---------------------------------------------------------------------------

describe('detectTechStack()', () => {
  describe('React project', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'react-app',
        packageJson: {
          name: 'react-app',
          dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' },
        },
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should detect React framework', async () => {
      const result = await detectTechStack(projectDir);
      assert.ok(result.frameworks.includes('react'));
    });

    it('should include javascript in languages', async () => {
      const result = await detectTechStack(projectDir);
      assert.ok(result.languages.includes('javascript'));
    });

    it('should set primary to javascript', async () => {
      const result = await detectTechStack(projectDir);
      assert.equal(result.primary, 'javascript');
    });
  });

  describe('Vue.js project', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'vue-app',
        packageJson: {
          name: 'vue-app',
          dependencies: { vue: '^3.0.0' },
        },
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should detect Vue framework', async () => {
      const result = await detectTechStack(projectDir);
      assert.ok(result.frameworks.includes('vue'));
    });
  });

  describe('Angular project', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'angular-app',
        packageJson: {
          name: 'angular-app',
          dependencies: { '@angular/core': '^16.0.0' },
        },
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should detect Angular framework', async () => {
      const result = await detectTechStack(projectDir);
      assert.ok(result.frameworks.includes('angular'));
    });
  });

  describe('Svelte project', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'svelte-app',
        packageJson: {
          name: 'svelte-app',
          devDependencies: { svelte: '^4.0.0' },
        },
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should detect Svelte framework from devDependencies', async () => {
      const result = await detectTechStack(projectDir);
      assert.ok(result.frameworks.includes('svelte'));
    });
  });

  describe('Next.js project', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'next-app',
        packageJson: {
          name: 'next-app',
          dependencies: { next: '^14.0.0', react: '^18.0.0' },
        },
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should detect both Next.js and React frameworks', async () => {
      const result = await detectTechStack(projectDir);
      assert.ok(result.frameworks.includes('next.js'));
      assert.ok(result.frameworks.includes('react'));
    });
  });

  describe('Nuxt project', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'nuxt-app',
        packageJson: {
          name: 'nuxt-app',
          dependencies: { nuxt: '^3.0.0', vue: '^3.0.0' },
        },
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should detect both Nuxt and Vue frameworks', async () => {
      const result = await detectTechStack(projectDir);
      assert.ok(result.frameworks.includes('nuxt'));
      assert.ok(result.frameworks.includes('vue'));
    });
  });

  describe('Express project', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'express-app',
        packageJson: {
          name: 'express-app',
          dependencies: { express: '^4.18.0' },
        },
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should detect Express framework', async () => {
      const result = await detectTechStack(projectDir);
      assert.ok(result.frameworks.includes('express'));
    });
  });

  describe('Fastify project', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'fastify-app',
        packageJson: {
          name: 'fastify-app',
          dependencies: { fastify: '^4.0.0' },
        },
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should detect Fastify framework', async () => {
      const result = await detectTechStack(projectDir);
      assert.ok(result.frameworks.includes('fastify'));
    });
  });

  describe('NestJS project', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'nestjs-app',
        packageJson: {
          name: 'nestjs-app',
          dependencies: { '@nestjs/core': '^10.0.0' },
        },
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should detect NestJS framework', async () => {
      const result = await detectTechStack(projectDir);
      assert.ok(result.frameworks.includes('nestjs'));
    });
  });

  describe('Jest testing framework', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'jest-app',
        packageJson: {
          name: 'jest-app',
          devDependencies: { jest: '^29.0.0' },
        },
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should detect Jest as a framework', async () => {
      const result = await detectTechStack(projectDir);
      assert.ok(result.frameworks.includes('jest'));
    });
  });

  describe('Vitest testing framework', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'vitest-app',
        packageJson: {
          name: 'vitest-app',
          devDependencies: { vitest: '^1.0.0' },
        },
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should detect Vitest as a framework', async () => {
      const result = await detectTechStack(projectDir);
      assert.ok(result.frameworks.includes('vitest'));
    });
  });

  describe('Mocha testing framework', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'mocha-app',
        packageJson: {
          name: 'mocha-app',
          devDependencies: { mocha: '^10.0.0' },
        },
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should detect Mocha as a framework', async () => {
      const result = await detectTechStack(projectDir);
      assert.ok(result.frameworks.includes('mocha'));
    });
  });

  describe('TypeScript detection', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'ts-stack',
        packageJson: {
          name: 'ts-stack',
          devDependencies: { typescript: '^5.0.0' },
        },
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should detect TypeScript in languages when in dependencies', async () => {
      const result = await detectTechStack(projectDir);
      assert.ok(result.languages.includes('typescript'));
      assert.ok(result.languages.includes('javascript'));
    });
  });

  describe('Python project (no package.json)', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'python-only',
        files: { 'requirements.txt': 'flask>=2.0\n' },
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should detect python language', async () => {
      const result = await detectTechStack(projectDir);
      assert.ok(result.languages.includes('python'));
      assert.equal(result.primary, 'python');
    });
  });

  describe('Python project via pyproject.toml', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'pyproject-only',
        pyprojectToml: true,
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should detect python language via pyproject.toml', async () => {
      const result = await detectTechStack(projectDir);
      assert.ok(result.languages.includes('python'));
    });
  });

  describe('Go project (no package.json)', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'go-only',
        goMod: true,
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should detect go language', async () => {
      const result = await detectTechStack(projectDir);
      assert.ok(result.languages.includes('go'));
      assert.equal(result.primary, 'go');
    });
  });

  describe('Rust project (no package.json)', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'rust-only',
        cargoToml: true,
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should detect rust language', async () => {
      const result = await detectTechStack(projectDir);
      assert.ok(result.languages.includes('rust'));
      assert.equal(result.primary, 'rust');
    });
  });

  describe('Java project via pom.xml', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'java-maven',
        files: { 'pom.xml': '<project />' },
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should detect java language', async () => {
      const result = await detectTechStack(projectDir);
      assert.ok(result.languages.includes('java'));
      assert.equal(result.primary, 'java');
    });
  });

  describe('Java project via build.gradle', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'java-gradle',
        files: { 'build.gradle': 'plugins { id "java" }' },
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should detect java language via build.gradle', async () => {
      const result = await detectTechStack(projectDir);
      assert.ok(result.languages.includes('java'));
    });
  });

  describe('empty project', () => {
    let dir;

    before(() => {
      dir = createTempDir();
    });

    after(() => cleanupTempDir(dir));

    it('should return empty arrays and null primary', async () => {
      const result = await detectTechStack(dir);
      assert.equal(result.primary, null);
      assert.deepEqual(result.frameworks, []);
      assert.deepEqual(result.languages, []);
    });
  });

  describe('full-stack project with multiple languages', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'full-stack',
        packageJson: {
          name: 'full-stack',
          dependencies: { react: '^18.0.0', express: '^4.0.0' },
          devDependencies: { typescript: '^5.0.0', jest: '^29.0.0' },
        },
        goMod: true,
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should detect all frameworks and languages', async () => {
      const result = await detectTechStack(projectDir);
      assert.ok(result.frameworks.includes('react'));
      assert.ok(result.frameworks.includes('express'));
      assert.ok(result.frameworks.includes('jest'));
      assert.ok(result.languages.includes('typescript'));
      assert.ok(result.languages.includes('javascript'));
      assert.ok(result.languages.includes('go'));
    });

    it('should set primary to first language detected (typescript)', async () => {
      const result = await detectTechStack(projectDir);
      // typescript is pushed before javascript in detectTechStack (line 236 before 238),
      // so when typescript is in devDependencies, primary = 'typescript'
      assert.equal(result.primary, 'typescript');
    });
  });

  describe('package.json with no dependencies', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'empty-deps',
        packageJson: { name: 'empty-deps' },
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should still detect javascript language from package.json presence', async () => {
      const result = await detectTechStack(projectDir);
      assert.ok(result.languages.includes('javascript'));
      assert.equal(result.primary, 'javascript');
      assert.deepEqual(result.frameworks, []);
    });
  });

  describe('invalid package.json', () => {
    let projectDir;

    before(() => {
      projectDir = createProjectDir({
        name: 'bad-pkg',
        files: { 'package.json': '{not valid!!!' },
      });
    });

    after(() => cleanupTempDir(join(projectDir, '..')));

    it('should gracefully handle parse errors and return empty result', async () => {
      const result = await detectTechStack(projectDir);
      assert.equal(result.primary, null);
      assert.deepEqual(result.frameworks, []);
      assert.deepEqual(result.languages, []);
    });
  });
});

// ---------------------------------------------------------------------------
// default export
// ---------------------------------------------------------------------------

describe('project-detector default export', () => {
  it('should export an object containing all 4 functions', () => {
    const expectedFunctions = [
      'detectExistingProject',
      'detectProjectName',
      'detectExistingIsdlc',
      'detectTechStack',
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
