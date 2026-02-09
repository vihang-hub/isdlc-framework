/**
 * iSDLC Cross-Platform Installer
 *
 * Node.js port of install.sh for cross-platform support.
 * Handles project detection, monorepo setup, and file copying.
 */

import path from 'path';
import { execSync } from 'child_process';
import {
  exists,
  ensureDir,
  copyDir,
  copy,
  readFile,
  readJson,
  writeJson,
  writeFile,
  remove,
  readdir,
  getFrameworkDir,
  getPackageRoot,
  deepMerge,
  findFiles,
  convertYamlToJson,
} from './utils/fs-helpers.js';
import logger from './utils/logger.js';
import { confirm, select, text } from './utils/prompts.js';
import { detectExistingProject, detectProjectName, detectExistingIsdlc } from './project-detector.js';
import { detectMonorepo, discoverProjects, generateMonorepoConfig } from './monorepo-handler.js';

/**
 * Main installation function
 * @param {string} projectRoot - Target project directory
 * @param {object} options - Installation options
 */
export async function install(projectRoot, options = {}) {
  const { monorepo: forceMonorepo = false, force = false, dryRun = false } = options;

  logger.header('iSDLC Framework - Project Installation');
  logger.labeled('Project Directory', projectRoot);
  logger.newline();

  // Step 0: Check for existing installation
  const existingInstall = await detectExistingIsdlc(projectRoot);
  if (existingInstall.installed) {
    logger.warning(`iSDLC framework already installed (v${existingInstall.version || 'unknown'})`);

    if (!force) {
      const proceed = await confirm('Reinstall/upgrade the framework?', false);
      if (!proceed) {
        logger.info('Installation cancelled.');
        return;
      }
    }
  }

  // Step 1: Detect project type
  logger.step('1/7', 'Detecting project type...');
  const projectInfo = await detectExistingProject(projectRoot);
  const projectName = await detectProjectName(projectRoot);

  if (projectInfo.isExisting) {
    logger.success(`Existing project detected (${projectInfo.ecosystem || 'unknown'})`);
    logger.info(`Markers found: ${projectInfo.markers.slice(0, 5).join(', ')}`);
  } else {
    logger.success('New project detected');
  }

  // Step 2: Detect monorepo
  logger.newline();
  logger.step('2/7', 'Checking for monorepo...');
  const monorepoInfo = await detectMonorepo(projectRoot);
  let isMonorepo = forceMonorepo || monorepoInfo.isMonorepo;
  let projects = [];

  if (monorepoInfo.isMonorepo) {
    logger.success(`Monorepo detected (${monorepoInfo.type})`);
    projects = await discoverProjects(projectRoot);

    if (projects.length > 0) {
      logger.info(`Found ${projects.length} sub-projects:`);
      for (const proj of projects) {
        logger.listItem(`${proj.name} (${proj.path})`);
      }
    }
  } else if (forceMonorepo) {
    logger.info('Monorepo mode forced via --monorepo flag');
    projects = await discoverProjects(projectRoot);
  } else {
    logger.info('Single-project mode');
  }

  // Confirm monorepo setting
  if (!force) {
    const defaultMonorepo = monorepoInfo.isMonorepo;
    isMonorepo = await confirm('Configure as monorepo?', defaultMonorepo);

    if (isMonorepo && projects.length === 0) {
      logger.warning('No projects detected. Enter project directories manually.');
      const dirsInput = await text('Project directories (comma-separated, e.g., frontend, backend):', '');

      if (dirsInput) {
        const dirs = dirsInput.split(',').map((d) => d.trim());
        for (const dir of dirs) {
          const dirPath = path.join(projectRoot, dir);
          if (await exists(dirPath)) {
            projects.push({ name: path.basename(dir), path: dir, discovered: false });
            logger.success(`Added: ${dir}`);
          } else {
            logger.warning(`Not found: ${dir} (skipping)`);
          }
        }
      }

      if (projects.length === 0) {
        logger.warning('No valid projects found. Falling back to single-project mode.');
        isMonorepo = false;
      }
    }
  }

  // Step 3: Claude Code detection
  logger.newline();
  logger.step('3/7', 'Checking for Claude Code...');

  let claudeCodeFound = false;
  let claudeCodeVersion = '';

  try {
    claudeCodeVersion = execSync('claude --version', { encoding: 'utf-8', timeout: 5000 }).trim();
    claudeCodeFound = true;
    logger.success(`Claude Code detected: ${claudeCodeVersion}`);
  } catch {
    logger.warning('Claude Code CLI not found on PATH');
    logger.newline();
    logger.info('iSDLC is a framework designed for Claude Code.');
    logger.info('It requires the \'claude\' CLI to function.');
    logger.newline();
    logger.info('Install Claude Code:');
    logger.log('  https://docs.anthropic.com/en/docs/claude-code/overview');
    logger.newline();

    if (!force) {
      const continueWithout = await confirm('Continue anyway? Framework files will be ready when you install Claude Code.', false);
      if (!continueWithout) {
        logger.info('Installation cancelled. Install Claude Code first, then re-run.');
        return;
      }
    } else {
      logger.info('Continuing without Claude Code (--force)');
    }
  }

  // Step 4: Confirm installation
  if (!force) {
    logger.newline();
    logger.info('This will install the iSDLC framework:');
    logger.listItem('.claude/        (agents and skills)');
    logger.listItem('.isdlc/         (project state tracking)');
    logger.listItem('docs/           (documentation)');
    logger.newline();

    const proceed = await confirm('Continue with installation?', true);
    if (!proceed) {
      logger.info('Installation cancelled.');
      return;
    }
  }

  // Agent model configuration (sub-agent routing)
  // NOTE: Provider selection is disabled — framework is Claude Code-specific.
  // Multi-provider support may be re-enabled in a future release.
  // ──────────────────────────────────────────────────────────────────────────
  // logger.newline();
  // logger.info('Claude Code is your primary AI assistant.');
  // logger.info('This setting controls which models are used when Claude Code delegates to sub-agents.');
  // logger.newline();
  //
  // let providerMode;
  // if (options.providerMode) {
  //   providerMode = options.providerMode;
  //   logger.info(`Sub-agent routing: ${providerMode} (from --provider-mode flag)`);
  // } else if (force) {
  //   providerMode = 'claude-code';
  //   logger.info('Sub-agent routing: claude-code (default for --force)');
  // } else {
  //   providerMode = await select('Select sub-agent model routing:', [
  //     { title: 'Claude Code — Use Claude Code for everything (Recommended)', value: 'claude-code', description: 'No extra configuration needed' },
  //     { title: 'Quality — Anthropic API everywhere (best results, requires API key)', value: 'quality', description: 'Best quality output' },
  //     { title: 'Free — Free-tier cloud (Groq, Together, Google) — no GPU needed', value: 'free', description: 'Best for getting started' },
  //     { title: 'Budget — Ollama locally if available, free cloud fallback', value: 'budget', description: 'Minimize costs' },
  //     { title: 'Local — Ollama only (offline/air-gapped, requires GPU)', value: 'local', description: 'No cloud calls' },
  //     { title: 'Hybrid — Smart per-phase routing (advanced)', value: 'hybrid', description: 'Route by phase complexity' },
  //   ]);
  // }
  // logger.newline();
  const providerMode = 'claude-code';

  // Step 4: Copy framework files
  logger.newline();
  logger.step('4/7', 'Copying framework files...');

  const frameworkDir = getFrameworkDir();
  const claudeSource = path.join(frameworkDir, 'claude');
  const isdlcSource = path.join(frameworkDir, 'isdlc');

  if (!(await exists(claudeSource))) {
    throw new Error(`Framework not found at ${claudeSource}. Installation may be corrupted.`);
  }

  const installedFiles = [];

  // Copy .claude directory
  const claudeTarget = path.join(projectRoot, '.claude');
  await ensureDir(claudeTarget);

  // Copy agents
  if (await exists(path.join(claudeSource, 'agents'))) {
    if (!dryRun) {
      await copyDir(path.join(claudeSource, 'agents'), path.join(claudeTarget, 'agents'));
    }
    logger.success('Copied agents/');
    installedFiles.push(...(await trackFiles(path.join(claudeTarget, 'agents'), projectRoot)));
  }

  // Copy commands
  if (await exists(path.join(claudeSource, 'commands'))) {
    if (!dryRun) {
      await copyDir(path.join(claudeSource, 'commands'), path.join(claudeTarget, 'commands'));
    }
    logger.success('Copied commands/');
    installedFiles.push(...(await trackFiles(path.join(claudeTarget, 'commands'), projectRoot)));
  }

  // Copy skills
  if (await exists(path.join(claudeSource, 'skills'))) {
    if (!dryRun) {
      await copyDir(path.join(claudeSource, 'skills'), path.join(claudeTarget, 'skills'));
    }
    logger.success('Copied skills/');
    installedFiles.push(...(await trackFiles(path.join(claudeTarget, 'skills'), projectRoot)));
  }

  // Copy hooks
  if (await exists(path.join(claudeSource, 'hooks'))) {
    if (!dryRun) {
      await copyDir(path.join(claudeSource, 'hooks'), path.join(claudeTarget, 'hooks'));
    }
    logger.success('Copied hooks/');
    installedFiles.push(...(await trackFiles(path.join(claudeTarget, 'hooks'), projectRoot)));
  }

  // Copy settings.json (merge if exists)
  const settingsSource = path.join(claudeSource, 'settings.json');
  const settingsTarget = path.join(claudeTarget, 'settings.json');

  if (await exists(settingsSource)) {
    if (!dryRun) {
      if (await exists(settingsTarget)) {
        // Merge settings
        const existing = await readJson(settingsTarget).catch(() => ({}));
        const framework = await readJson(settingsSource);
        const merged = deepMerge(existing, framework);
        await writeJson(settingsTarget, merged);
        logger.success('Merged settings.json');
      } else {
        await copy(settingsSource, settingsTarget);
        logger.success('Copied settings.json');
      }
    }
    installedFiles.push('.claude/settings.json');
  }

  // Copy or merge settings.local.json
  const settingsLocalSource = path.join(claudeSource, 'settings.local.json');
  const settingsLocalTarget = path.join(claudeTarget, 'settings.local.json');

  if (await exists(settingsLocalSource)) {
    if (!dryRun) {
      if (await exists(settingsLocalTarget)) {
        const existingLocal = await readJson(settingsLocalTarget).catch(() => ({}));
        const frameworkLocal = await readJson(settingsLocalSource);
        const mergedLocal = deepMerge(existingLocal, frameworkLocal);
        await writeJson(settingsLocalTarget, mergedLocal);
        logger.success('Merged settings.local.json');
      } else {
        await copy(settingsLocalSource, settingsLocalTarget);
        logger.success('Copied settings.local.json');
      }
    }
    installedFiles.push('.claude/settings.local.json');
  }

  // Warn user to review permissions
  logger.newline();
  logger.warning('Review .claude/settings.local.json permissions — adjust if your security requirements differ');

  // Step 5: Setup .isdlc directory
  logger.newline();
  logger.step('5/7', 'Setting up .isdlc folder...');

  const isdlcTarget = path.join(projectRoot, '.isdlc');
  await ensureDir(isdlcTarget);

  // Create phase directories
  const phases = [
    '01-requirements',
    '02-architecture',
    '03-design',
    '04-test-strategy',
    '05-implementation',
    '06-testing',
    '07-code-review',
    '08-validation',
    '09-cicd',
    '10-local-testing',
    '11-test-deploy',
    '12-production',
    '13-operations',
  ];

  for (const phase of phases) {
    if (!dryRun) {
      await ensureDir(path.join(isdlcTarget, 'phases', phase, 'artifacts'));
    }
  }
  logger.success('Created phase directories');

  // Copy config
  if (await exists(path.join(isdlcSource, 'config'))) {
    if (!dryRun) {
      await copyDir(path.join(isdlcSource, 'config'), path.join(isdlcTarget, 'config'));
    }
    logger.success('Copied config files');
  }

  // Copy checklists
  if (await exists(path.join(isdlcSource, 'checklists'))) {
    if (!dryRun) {
      await copyDir(path.join(isdlcSource, 'checklists'), path.join(isdlcTarget, 'checklists'));
    }
    logger.success('Copied gate checklists');
  }

  // Copy templates
  if (await exists(path.join(isdlcSource, 'templates'))) {
    if (!dryRun) {
      await copyDir(path.join(isdlcSource, 'templates'), path.join(isdlcTarget, 'templates'));
    }
    logger.success('Copied templates');
  }

  // Copy scripts
  if (await exists(path.join(isdlcSource, 'scripts'))) {
    if (!dryRun) {
      await copyDir(path.join(isdlcSource, 'scripts'), path.join(isdlcTarget, 'scripts'));
    }
    logger.success('Copied utility scripts');
  }

  // Copy uninstall and update shell scripts from package root
  const packageRoot = getPackageRoot();
  const scriptsTarget = path.join(isdlcTarget, 'scripts');
  if (!dryRun) {
    await ensureDir(scriptsTarget);
  }
  for (const scriptName of ['uninstall.sh', 'update.sh', 'uninstall.ps1', 'update.ps1']) {
    const scriptSource = path.join(packageRoot, scriptName);
    if (await exists(scriptSource)) {
      if (!dryRun) {
        await copy(scriptSource, path.join(scriptsTarget, scriptName));
      }
      logger.success(`Copied ${scriptName} to .isdlc/scripts/`);
    }
  }

  // Generate providers.yaml from template
  // NOTE: Disabled — framework is Claude Code-specific. No providers.yaml needed.
  // const providersTarget = path.join(isdlcTarget, 'providers.yaml');
  // if (await exists(providersTarget)) {
  //   logger.warning('providers.yaml already exists — skipping (use /provider set to change mode)');
  // } else {
  //   const providersTemplatePath = path.join(isdlcSource, 'templates', 'providers.yaml.template');
  //   if (await exists(providersTemplatePath)) {
  //     if (!dryRun) {
  //       let templateContent = await readFile(providersTemplatePath);
  //       templateContent = templateContent.replace(
  //         /^active_mode:\s*"[^"]*"/m,
  //         `active_mode: "${providerMode}"`
  //       );
  //       await writeFile(providersTarget, templateContent);
  //     }
  //     logger.success(`Generated providers.yaml (mode: ${providerMode})`);
  //   } else {
  //     logger.warning('providers.yaml.template not found — skipping provider config');
  //   }
  // }

  // Copy skills manifest to hooks config
  const skillsManifestSource = path.join(isdlcSource, 'config', 'skills-manifest.yaml');
  const hooksConfigDir = path.join(claudeTarget, 'hooks', 'config');

  if (await exists(skillsManifestSource)) {
    if (!dryRun) {
      await ensureDir(hooksConfigDir);
      await copy(skillsManifestSource, path.join(hooksConfigDir, 'skills-manifest.yaml'));

      // Copy pre-built JSON for runtime hooks (hooks only read JSON)
      const jsonTarget = path.join(hooksConfigDir, 'skills-manifest.json');
      const hooksJsonSource = path.join(claudeSource, 'hooks', 'config', 'skills-manifest.json');
      const isdlcJsonSource = path.join(isdlcSource, 'config', 'skills-manifest.json');
      if (await exists(hooksJsonSource)) {
        await copy(hooksJsonSource, jsonTarget);
      } else if (await exists(isdlcJsonSource)) {
        await copy(isdlcJsonSource, jsonTarget);
      } else if (!convertYamlToJson(skillsManifestSource, jsonTarget)) {
        logger.warning('Could not convert manifest YAML to JSON. Install yq or python3+PyYAML.');
      }
    }
    logger.success('Copied skills manifest');
  }

  // Copy workflows.json
  const workflowsSource = path.join(isdlcSource, 'config', 'workflows.json');
  if (await exists(workflowsSource)) {
    if (!dryRun) {
      await copy(workflowsSource, path.join(isdlcTarget, 'config', 'workflows.json'));
      await copy(workflowsSource, path.join(hooksConfigDir, 'workflows.json'));
    }
    logger.success('Copied workflow definitions');
  }

  // Step 6: Setup docs
  logger.newline();
  logger.step('6/7', 'Setting up docs folder...');

  const docsTarget = path.join(projectRoot, 'docs');
  if (!dryRun) {
    await ensureDir(path.join(docsTarget, 'requirements'));
    await ensureDir(path.join(docsTarget, 'architecture'));
    await ensureDir(path.join(docsTarget, 'design'));
    await ensureDir(path.join(docsTarget, 'isdlc', 'checklists'));
  }
  logger.success('Created docs structure');

  // Copy requirement templates
  const reqTemplatesSource = path.join(isdlcSource, 'templates', 'requirements');
  if (await exists(reqTemplatesSource)) {
    if (!dryRun) {
      await copyDir(reqTemplatesSource, path.join(docsTarget, 'requirements'));
    }
    logger.success('Copied requirement templates');
  }

  // Create docs README
  if (!dryRun) {
    await writeFile(path.join(docsTarget, 'README.md'), generateDocsReadme());
  }
  logger.success('Created docs/README.md');

  // Copy and generate constitution
  const constitutionTarget = path.join(docsTarget, 'isdlc', 'constitution.md');
  if (!dryRun) {
    await writeFile(constitutionTarget, generateConstitution(projectName));
  }
  logger.success('Created project constitution');

  // Step 7: Generate state.json
  logger.newline();
  logger.step('7/7', 'Generating project state...');

  const timestamp = new Date().toISOString();
  const state = generateState(projectName, projectInfo.isExisting, timestamp);

  if (!dryRun) {
    await writeJson(path.join(isdlcTarget, 'state.json'), state);
  }
  logger.success('Created state.json');

  // Handle monorepo setup
  if (isMonorepo && projects.length > 0) {
    logger.newline();
    logger.step('Bonus', 'Setting up monorepo structure...');

    // Ask about docs location
    let docsLocation = 'root';
    if (!force) {
      docsLocation = await select('Where should project documentation live?', [
        { title: 'Root docs folder (docs/{project-id}/)', value: 'root', description: 'Shared-concern monorepos (FE/BE/shared)' },
        { title: 'Inside each project ({project}/docs/)', value: 'project', description: 'Multi-app monorepos' },
      ]);
    }

    // Generate monorepo config
    const monorepoConfig = generateMonorepoConfig(projects, { docsLocation });

    if (!dryRun) {
      await writeJson(path.join(isdlcTarget, 'monorepo.json'), monorepoConfig);
      await ensureDir(path.join(isdlcTarget, 'projects'));
      await ensureDir(path.join(docsTarget, 'isdlc', 'projects'));

      // Create per-project directories and state
      for (const proj of projects) {
        await ensureDir(path.join(isdlcTarget, 'projects', proj.name, 'skills', 'external'));
        await ensureDir(path.join(docsTarget, 'isdlc', 'projects', proj.name));

        // Create per-project state
        const projState = generateProjectState(proj.name, proj.path, timestamp);
        await writeJson(path.join(isdlcTarget, 'projects', proj.name, 'state.json'), projState);

        // Create external skills manifest
        const extManifest = {
          version: '1.0.0',
          project_id: proj.name,
          updated_at: timestamp,
          skills: {},
        };
        await writeJson(path.join(docsTarget, 'isdlc', 'projects', proj.name, 'external-skills-manifest.json'), extManifest);

        // Create project docs directories
        if (docsLocation === 'project') {
          await ensureDir(path.join(projectRoot, proj.path, 'docs', 'requirements'));
          await ensureDir(path.join(projectRoot, proj.path, 'docs', 'architecture'));
          await ensureDir(path.join(projectRoot, proj.path, 'docs', 'design'));
        } else {
          await ensureDir(path.join(docsTarget, proj.name, 'requirements'));
          await ensureDir(path.join(docsTarget, proj.name, 'architecture'));
          await ensureDir(path.join(docsTarget, proj.name, 'design'));
        }

        logger.success(`Created state for: ${proj.name}`);
      }
    }

    logger.success(`Monorepo setup complete (${projects.length} projects)`);
  }

  // Generate installation manifest
  if (!dryRun) {
    const manifest = {
      version: '1.0.0',
      created: timestamp,
      framework_version: '0.1.0-alpha',
      files: installedFiles,
    };
    await writeJson(path.join(isdlcTarget, 'installed-files.json'), manifest);
  }
  logger.success(`Created installation manifest (${installedFiles.length} files tracked)`);

  // Create CLAUDE.md if missing
  const claudeMdPath = path.join(projectRoot, 'CLAUDE.md');
  if (!(await exists(claudeMdPath))) {
    if (!dryRun) {
      await writeFile(claudeMdPath, '');
    }
    logger.warning('CLAUDE.md was missing - created empty one in project root');
  }

  // Done!
  logger.newline();
  logger.header('Installation Complete!');

  logger.section('Project Structure:');
  logger.log('  .claude/           - Agent definitions and skills');
  logger.log('  .isdlc/            - Project state and framework resources');
  logger.log('  docs/              - Documentation');
  logger.newline();

  logger.section('AI Assistant:');
  logger.log(`  Engine:   Claude Code${claudeCodeFound ? ` (${claudeCodeVersion})` : ''}`);
  logger.newline();

  // Optional tour
  if (!force && !dryRun) {
    await runTour();
  }

  logger.section('Next Steps:');
  if (claudeCodeFound) {
    logger.log('  1. Run `claude` to start Claude Code');
    logger.log('  2. Run `/discover` to:');
    logger.log('     - Analyze your project (or describe it if new)');
    logger.log('     - Research best practices for your stack');
    logger.log('     - Create a tailored constitution interactively');
    logger.log('  3. Run `/isdlc start` to begin your workflow');
    logger.log('  4. Run `/tour` anytime to revisit the framework introduction');
  } else {
    logger.log('  1. Install Claude Code:');
    logger.log('     https://docs.anthropic.com/en/docs/claude-code/overview');
    logger.log('  2. Run `claude` to start Claude Code');
    logger.log('  3. Run `/discover` to:');
    logger.log('     - Analyze your project (or describe it if new)');
    logger.log('     - Research best practices for your stack');
    logger.log('     - Create a tailored constitution interactively');
    logger.log('  4. Run `/isdlc start` to begin your workflow');
    logger.log('  5. Run `/tour` anytime to revisit the framework introduction');
  }
  logger.newline();

  if (projectInfo.isExisting) {
    logger.info('Note: Your existing project structure was not modified.');
  }

  if (dryRun) {
    logger.warning('(Dry run - no changes were made)');
  }
}

/**
 * Track files in a directory for the manifest
 * @param {string} dirPath - Directory to track
 * @param {string} projectRoot - Project root for relative paths
 * @returns {Promise<string[]>} Array of relative file paths
 */
async function trackFiles(dirPath, projectRoot) {
  const files = await findFiles(dirPath, () => true);
  return files.map((f) => path.relative(projectRoot, f));
}

/**
 * Tour content sections shared between light and full modes
 */
const tourSections = [
  {
    title: 'What is iSDLC?',
    content: [
      'iSDLC is a framework of 36 AI agents that guide development from',
      'requirements through deployment. Quality gates enforce completion',
      'between phases, and deterministic hooks enforce rules at runtime.',
    ],
  },
  {
    title: 'Core Commands',
    content: [
      '/discover                — Analyze your project or set up a new one',
      '/isdlc feature "desc"    — Develop a feature end-to-end',
      '/isdlc fix "desc"        — Fix a bug with TDD and tracing agents',
      '/isdlc test generate     — Create tests for existing code',
      '/isdlc upgrade "name"    — Upgrade a dependency or runtime',
      '/provider               — Configure LLM model routing',
    ],
  },
];

/**
 * Print a single tour section
 * @param {object} section - Tour section with title and content
 */
function printTourSection(section) {
  logger.newline();
  logger.log(`  ━━━ ${section.title} ━━━`);
  logger.newline();
  for (const line of section.content) {
    logger.log(`  ${line}`);
  }
  logger.newline();
}

/**
 * Run the optional post-install tour
 * @param {Function} selectFn - The select prompt function
 */
async function runTour() {
  const { confirm } = await import('./utils/prompts.js');
  const wantOverview = await confirm('Show a quick overview of the framework?', true);
  if (!wantOverview) {
    logger.info('Skipped. Run /tour in Claude Code for the interactive guide.');
    logger.newline();
    return;
  }
  logger.header('QUICK OVERVIEW');
  for (const section of tourSections) {
    printTourSection(section);
  }
  logger.info('For the full interactive guide, run /tour in Claude Code.');
  logger.newline();
}

/**
 * Generate the docs/README.md content
 * @returns {string} README content
 */
function generateDocsReadme() {
  return `# Project Documentation

This folder contains all project documentation following the iSDLC framework.

## Structure

\`\`\`
docs/
├── isdlc/              # iSDLC-generated documents
│   ├── constitution.md # Project constitution
│   ├── tasks.md        # Task plan
│   └── checklists/     # Gate checklist responses
├── requirements/       # Requirements specifications and user stories
├── architecture/       # Architecture decisions and system design
├── design/            # Detailed design documents
└── README.md          # This file
\`\`\`

## Getting Started

1. Start with requirements in \`requirements/\`
2. Document architecture decisions in \`architecture/\`
3. Add detailed designs in \`design/\`

See \`.isdlc/state.json\` for current project phase and progress.
`;
}

/**
 * Generate starter constitution
 * @param {string} projectName - Project name
 * @returns {string} Constitution content
 */
function generateConstitution(projectName) {
  const date = new Date().toISOString().split('T')[0];

  return `# Project Constitution - ${projectName}

<!-- CONSTITUTION_STATUS: STARTER_TEMPLATE -->
<!-- This marker indicates this constitution needs customization -->
<!-- Run /discover to customize -->

**Created**: ${date}
**Status**: ⚠️ NEEDS CUSTOMIZATION

---

## ⚠️ CUSTOMIZATION REQUIRED

This is a **starter constitution** auto-generated during framework installation.
It contains generic articles that may not match your project's specific needs.

**To customize this constitution:**
Run \`/discover\` to analyze your project and generate tailored articles interactively.

**This constitution will be treated as a TEMPLATE until customized.**

---

## Preamble

This constitution establishes the fundamental principles governing all development activities within the **${projectName}** project. These articles guide all SDLC phases and all agent interactions.

All agents (01-13) and the SDLC Orchestrator (00) will read and enforce these principles throughout the project lifecycle.

---

## Articles (Generic - Customize for Your Project)

### Article I: Specification Primacy

**Principle**: Specifications are the source of truth. Code serves specifications.

**Requirements**:
1. Code MUST implement specifications exactly as defined
2. Any deviation from specifications MUST be documented and justified
3. Specifications MUST be updated before code changes

---

### Article II: Test-First Development

**Principle**: Tests MUST be written before implementation.

**Requirements**:
1. Test cases MUST be designed before implementation
2. Unit tests MUST be written before production code
3. Code without tests CANNOT pass quality gates

**Coverage Thresholds**:
- Unit test coverage: ≥80%
- Integration test coverage: ≥70%

---

### Article III: Security by Design

**Principle**: Security considerations MUST precede implementation decisions.

**Requirements**:
1. No secrets in code - use environment variables
2. All inputs validated, all outputs sanitized
3. Critical/High vulnerabilities MUST be resolved before deployment

---

### Article IV: Simplicity First

**Principle**: Implement the simplest solution that satisfies requirements.

**Requirements**:
1. Avoid over-engineering and premature optimization
2. YAGNI (You Aren't Gonna Need It) - no speculative features
3. Complexity MUST be justified by requirements

---

### Article V: Quality Gate Integrity

**Principle**: Quality gates cannot be skipped. Failures require remediation.

**Requirements**:
1. All quality gates MUST be validated before phase advancement
2. Gate failures MUST be remediated (cannot be waived)
3. Gate fails twice → Escalate to human

---

## Customization Notes

Review and modify these articles based on your project's specific needs:
- Add compliance requirements (HIPAA, GDPR, PCI-DSS)
- Add performance SLAs
- Add accessibility requirements
- Adjust coverage thresholds
- Add domain-specific constraints

---

**Constitution Version**: 1.0.0
**Framework Version**: 0.1.0-alpha
`;
}

/**
 * Generate project state.json
 * @param {string} projectName - Project name
 * @param {boolean} isExistingProject - Whether project has existing code
 * @param {string} timestamp - ISO timestamp
 * @returns {object} State object
 */
function generateState(projectName, isExistingProject, timestamp) {
  return {
    framework_version: '0.1.0-alpha',
    project: {
      name: projectName,
      created: timestamp,
      description: '',
      is_new_project: !isExistingProject,
    },
    complexity_assessment: {
      level: null,
      track: 'auto',
      assessed_at: timestamp,
      assessed_by: 'manual',
      dimensions: {
        architectural: null,
        security: null,
        testing: null,
        deployment: null,
        team: null,
        timeline: null,
      },
    },
    workflow: {
      track: 'auto',
      track_name: 'Orchestrator-managed',
      phases_required: null,
      phases_optional: null,
      phases_skipped: null,
    },
    constitution: {
      enforced: true,
      path: 'docs/isdlc/constitution.md',
      validated_at: null,
    },
    autonomous_iteration: {
      enabled: true,
      max_iterations: 10,
      timeout_per_iteration_minutes: 5,
      circuit_breaker_threshold: 3,
    },
    skill_enforcement: {
      enabled: true,
      mode: 'observe',
      fail_behavior: 'allow',
      manifest_version: '2.0.0',
    },
    cloud_configuration: {
      provider: 'undecided',
      configured_at: null,
      credentials_validated: false,
      aws: null,
      gcp: null,
      azure: null,
      deployment: {
        staging_enabled: false,
        production_enabled: false,
        workflow_endpoint: '10-local-testing',
      },
    },
    iteration_enforcement: {
      enabled: true,
    },
    code_review: {
      enabled: false,
      team_size: 1,
    },
    skill_usage_log: [],
    active_workflow: null,
    workflow_history: [],
    counters: {
      next_req_id: 1,
      next_bug_id: 1,
    },
    current_phase: '01-requirements',
    phases: {
      '01-requirements': { status: 'pending', started: null, completed: null, gate_passed: null, artifacts: [] },
      '02-architecture': { status: 'pending', started: null, completed: null, gate_passed: null, artifacts: [] },
      '03-design': { status: 'pending', started: null, completed: null, gate_passed: null, artifacts: [] },
      '04-test-strategy': { status: 'pending', started: null, completed: null, gate_passed: null, artifacts: [] },
      '05-implementation': { status: 'pending', started: null, completed: null, gate_passed: null, artifacts: [], iteration_tracking: { current: 0, max: null, history: [], final_status: null } },
      '06-testing': { status: 'pending', started: null, completed: null, gate_passed: null, artifacts: [], iteration_tracking: { current: 0, max: null, history: [], final_status: null } },
      '07-code-review': { status: 'pending', started: null, completed: null, gate_passed: null, artifacts: [] },
      '08-validation': { status: 'pending', started: null, completed: null, gate_passed: null, artifacts: [] },
      '09-cicd': { status: 'pending', started: null, completed: null, gate_passed: null, artifacts: [] },
      '10-local-testing': { status: 'pending', started: null, completed: null, gate_passed: null, artifacts: [] },
      '11-test-deploy': { status: 'pending', started: null, completed: null, gate_passed: null, artifacts: [] },
      '12-production': { status: 'pending', started: null, completed: null, gate_passed: null, artifacts: [] },
      '13-operations': { status: 'pending', started: null, completed: null, gate_passed: null, artifacts: [] },
    },
    blockers: [],
    active_agent: null,
    history: [
      {
        timestamp,
        agent: 'npm-installer',
        action: 'Project initialized with iSDLC framework (npm)',
      },
    ],
  };
}

/**
 * Generate per-project state for monorepos
 * @param {string} projectName - Project name
 * @param {string} projectPath - Relative path
 * @param {string} timestamp - ISO timestamp
 * @returns {object} Project state object
 */
function generateProjectState(projectName, projectPath, timestamp) {
  return {
    framework_version: '0.1.0-alpha',
    project: {
      name: projectName,
      path: projectPath,
      created: timestamp,
      description: '',
      is_new_project: true,
    },
    constitution: {
      enforced: true,
      path: 'docs/isdlc/constitution.md',
      override_path: null,
      validated_at: null,
    },
    skill_enforcement: {
      enabled: true,
      mode: 'observe',
      fail_behavior: 'allow',
      manifest_version: '2.0.0',
    },
    cloud_configuration: {
      provider: 'undecided',
      configured_at: null,
      credentials_validated: false,
      deployment: {
        staging_enabled: false,
        production_enabled: false,
        workflow_endpoint: '10-local-testing',
      },
    },
    code_review: {
      enabled: false,
      team_size: 1,
    },
    skill_usage_log: [],
    active_workflow: null,
    workflow_history: [],
    counters: {
      next_req_id: 1,
      next_bug_id: 1,
    },
    current_phase: null,
    phases: {},
    blockers: [],
    active_agent: null,
    history: [
      {
        timestamp,
        agent: 'npm-installer',
        action: 'Project registered in monorepo',
      },
    ],
  };
}

export default { install };
