/**
 * Project Knowledge Setup — interactive setup for semantic search embeddings.
 *
 * Orchestrates:
 * 1. Vector store selection (FAISS or SQLite) with optional skip
 * 2. Dependency installation (faiss-node or better-sqlite3)
 * 3. Codebase scanning and embedding generation
 * 4. Additional content sources (external code, documents)
 * 5. Package building (.emb) and harness configuration
 *
 * Called after `isdlc init` or `isdlc update` as a post-setup step.
 * Cross-platform: macOS, Linux, Windows.
 *
 * @module lib/setup-project-knowledge
 */

import { resolve, join, extname, basename } from 'node:path';
import { existsSync, readdirSync, readFileSync, writeFileSync as fsWriteFileSync, mkdirSync as fsMkdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { readSearchConfig, writeSearchConfig } from './search/config.js';

/**
 * @typedef {Object} KnowledgeSetupOptions
 * @property {boolean} [force=false] - Auto-accept defaults
 * @property {boolean} [dryRun=false] - Show what would happen without making changes
 * @property {Object} [deps] - Dependency injection overrides for testing
 */

/**
 * @typedef {Object} KnowledgeSetupResult
 * @property {boolean} success
 * @property {string} vectorStore - 'faiss' | 'sqlite' | 'skipped'
 * @property {string[]} embeddingPackages - Paths to generated .emb files
 * @property {string[]} additionalSources - Paths to additional content indexed
 * @property {boolean} harnessConfigured
 * @property {string[]} warnings
 */

// Supported document extensions for knowledge base embedding
const DOCUMENT_EXTENSIONS = new Set([
  '.md', '.markdown', '.txt', '.html', '.htm', '.rst', '.adoc', '.asciidoc',
]);

// Supported code extensions for codebase embedding
const CODE_EXTENSIONS = new Set([
  '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs', '.c', '.cpp',
  '.h', '.hpp', '.cs', '.rb', '.php', '.swift', '.kt', '.kts', '.scala',
  '.xml', '.yaml', '.yml', '.json', '.toml', '.sql', '.sh', '.bash',
]);

// Directories to skip during scanning
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.svn', '.hg', 'vendor', '__pycache__',
  '.isdlc', '.claude', '.antigravity', 'dist', 'build', 'out',
  '.next', '.nuxt', 'coverage', '.nyc_output', 'target',
]);

/**
 * Run the interactive project knowledge setup.
 *
 * @param {string} projectRoot - Project root directory
 * @param {KnowledgeSetupOptions} [options]
 * @returns {Promise<KnowledgeSetupResult>}
 */
export async function setupProjectKnowledge(projectRoot, options = {}) {
  const { force = false, dryRun = false, deps = {} } = options;

  const logger = deps.logger || (await import('./utils/logger.js')).default;
  const prompts = deps.prompts || (await import('./utils/prompts.js'));
  const confirmFn = deps.confirm || prompts.confirm;
  const selectFn = deps.select || prompts.select;
  const textFn = deps.text || prompts.text;

  const result = {
    success: false,
    vectorStore: 'skipped',
    embeddingPackages: [],
    additionalSources: [],
    harnessConfigured: false,
    warnings: [],
  };

  try {
    logger.newline();
    logger.header('Project Knowledge Setup');
    logger.info('Configure semantic search embeddings for your project.');
    logger.newline();

    // ─── Step 1: Vector store selection ───────────────────────────────
    logger.step('1/5', 'Selecting vector store...');

    const storeChoice = force ? 'faiss' : await selectFn(
      'Which vector store would you like to use?',
      [
        {
          title: 'FAISS (recommended)',
          value: 'faiss',
          description: 'Fast similarity search — best for large codebases',
        },
        {
          title: 'SQLite FTS5',
          value: 'sqlite',
          description: 'Lightweight full-text search — no native bindings required',
        },
        {
          title: 'Skip for now',
          value: 'skip',
          description: 'You can run this later with: isdlc setup-knowledge',
        },
      ],
    );

    if (storeChoice === 'skip') {
      logger.info('Skipping project knowledge setup. Run `isdlc setup-knowledge` later.');
      result.vectorStore = 'skipped';
      result.success = true;
      return result;
    }

    result.vectorStore = storeChoice;

    // ─── Step 2: Install dependencies ─────────────────────────────────
    logger.newline();
    logger.step('2/5', 'Installing dependencies...');

    const installResult = await installVectorStoreDeps(storeChoice, projectRoot, {
      dryRun, force, logger,
    });

    if (!installResult.success) {
      logger.warning(`Could not install ${storeChoice} dependencies: ${installResult.error}`);
      logger.info('You can install manually and re-run: isdlc setup-knowledge');
      result.warnings.push(`${storeChoice} installation failed: ${installResult.error}`);

      // Don't abort — we can still generate embeddings with JSON fallback
      if (!force) {
        const proceed = await confirmFn('Continue without native vector store? (JSON fallback)', true);
        if (!proceed) {
          result.success = true;
          return result;
        }
      }
    } else {
      logger.success(`${storeChoice === 'faiss' ? 'faiss-node' : 'better-sqlite3'} installed`);
    }

    // Also ensure embedding engine deps
    await installEmbeddingDeps(projectRoot, { dryRun, logger });

    // Pre-warm Jina model — trigger download so first real usage is instant
    // FR-005 / AC-005-01, AC-005-02: fail-open (Article X: Fail-Safe Defaults)
    if (dryRun) {
      logger.info('[dry-run] Would pre-warm Jina embedding model (trigger download)');
    } else {
      try {
        const { createJinaCodeAdapter } = await import('./embedding/engine/jina-code-adapter.js');
        const adapter = await createJinaCodeAdapter();
        if (adapter) {
          const health = await adapter.healthCheck();
          if (health.healthy) {
            logger.success('Jina embedding model pre-warmed (downloaded and ready)');
          } else {
            logger.warning(`Jina model pre-warm: model unhealthy — ${health.error || 'unknown reason'}`);
          }
          adapter.dispose();
        } else {
          logger.info('Jina pre-warm skipped — @huggingface/transformers not installed');
        }
      } catch (preWarmErr) {
        logger.warning(`Jina model pre-warm failed (non-blocking): ${preWarmErr.message}`);
        logger.info('The model will be downloaded on first embedding usage instead.');
      }
    }

    // ─── Step 3: Scan codebase and generate embeddings ────────────────
    logger.newline();
    logger.step('3/5', 'Scanning codebase and generating embeddings...');

    const codeEmbResult = await generateCodebaseEmbeddings(projectRoot, {
      dryRun, logger, storeChoice,
    });

    if (codeEmbResult.packagePath) {
      result.embeddingPackages.push(codeEmbResult.packagePath);
      logger.success(
        `Codebase indexed: ${codeEmbResult.fileCount} files, ` +
        `${codeEmbResult.chunkCount} chunks → ${basename(codeEmbResult.packagePath)}`
      );
    } else if (codeEmbResult.error) {
      logger.warning(`Codebase embedding failed: ${codeEmbResult.error}`);
      result.warnings.push(`Codebase embedding: ${codeEmbResult.error}`);
    }

    // ─── Step 4: Additional content sources ───────────────────────────
    logger.newline();
    logger.step('4/5', 'Additional content sources...');

    let addMore = force ? false : await confirmFn(
      'Do you want to add additional codebases or documents to the knowledge base?',
      false,
    );

    while (addMore) {
      const sourceType = await selectFn(
        'What would you like to add?',
        [
          { title: 'External codebase', value: 'code', description: 'Another project or module' },
          { title: 'Documents folder', value: 'docs', description: 'Markdown, HTML, or text files' },
          { title: 'Done adding', value: 'done', description: 'Continue to configuration' },
        ],
      );

      if (sourceType === 'done') break;

      const sourcePath = await textFn(
        `Enter the absolute path to the ${sourceType === 'code' ? 'codebase' : 'documents folder'}:`,
        '',
      );

      if (!sourcePath || !existsSync(sourcePath)) {
        logger.warning(`Path not found: ${sourcePath || '(empty)'}`);
        addMore = await confirmFn('Add another source?', true);
        continue;
      }

      const resolvedPath = resolve(sourcePath);
      logger.info(`Scanning ${resolvedPath}...`);

      if (sourceType === 'code') {
        const extResult = await generateCodebaseEmbeddings(resolvedPath, {
          dryRun, logger, storeChoice,
          moduleId: sanitizeModuleId(resolvedPath),
          outputDir: join(projectRoot, '.isdlc', 'embeddings'),
        });

        if (extResult.packagePath) {
          result.embeddingPackages.push(extResult.packagePath);
          result.additionalSources.push(resolvedPath);
          logger.success(
            `External codebase indexed: ${extResult.fileCount} files, ` +
            `${extResult.chunkCount} chunks`
          );
        } else {
          logger.warning(`Failed to index ${resolvedPath}: ${extResult.error || 'unknown error'}`);
        }
      } else {
        const docResult = await generateDocumentEmbeddings(resolvedPath, {
          dryRun, logger, storeChoice,
          moduleId: `docs-${sanitizeModuleId(resolvedPath)}`,
          outputDir: join(projectRoot, '.isdlc', 'embeddings'),
        });

        if (docResult.packagePath) {
          result.embeddingPackages.push(docResult.packagePath);
          result.additionalSources.push(resolvedPath);
          logger.success(
            `Documents indexed: ${docResult.fileCount} files, ` +
            `${docResult.chunkCount} chunks`
          );
        } else {
          logger.warning(`Failed to index ${resolvedPath}: ${docResult.error || 'unknown error'}`);
        }
      }

      addMore = await confirmFn('Add another source?', true);
    }

    // ─── Step 5: Configure harness ────────────────────────────────────
    logger.newline();
    logger.step('5/5', 'Configuring harness...');

    if (!dryRun) {
      const configured = await configureHarness(projectRoot, {
        vectorStore: storeChoice,
        packages: result.embeddingPackages,
        logger,
      });
      result.harnessConfigured = configured;

      if (configured) {
        logger.success('Harness configured for semantic search');
      } else {
        logger.warning('Harness configuration skipped (no packages generated)');
      }
    } else {
      logger.info('[dry-run] Would configure harness with generated packages');
    }

    // ─── Summary ──────────────────────────────────────────────────────
    logger.newline();
    logger.header('Project Knowledge Setup Complete');
    logger.labeled('Vector store', storeChoice);
    logger.labeled('Packages generated', String(result.embeddingPackages.length));
    logger.labeled('Additional sources', String(result.additionalSources.length));
    logger.labeled('Harness configured', result.harnessConfigured ? 'Yes' : 'No');

    if (result.warnings.length > 0) {
      logger.newline();
      logger.warning('Warnings:');
      for (const w of result.warnings) {
        logger.listItem(w);
      }
    }

    logger.newline();
    logger.info('To rebuild embeddings later: isdlc setup-knowledge');
    logger.info('To add more sources: isdlc setup-knowledge --add-source');

    result.success = true;
    return result;

  } catch (err) {
    logger.warning(`Project knowledge setup encountered an error: ${err.message}`);
    logger.info('You can re-run this later with: isdlc setup-knowledge');
    result.warnings.push(err.message);
    result.success = false;
    return result;
  }
}

/**
 * Install vector store native dependencies.
 *
 * @param {'faiss'|'sqlite'} storeType
 * @param {string} projectRoot
 * @param {Object} options
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function installVectorStoreDeps(storeType, projectRoot, options = {}) {
  const { dryRun, logger } = options;
  const pkg = storeType === 'faiss' ? 'faiss-node' : 'better-sqlite3';

  // Check if already installed
  if (isPackageInstalled(pkg)) {
    logger.success(`${pkg} already installed`);
    return { success: true };
  }

  if (dryRun) {
    logger.info(`[dry-run] Would install ${pkg}`);
    return { success: true };
  }

  // Detect package manager
  const pm = detectPackageManager(projectRoot);
  const installCmd = buildInstallCommand(pm, pkg);

  logger.info(`Installing ${pkg} via ${pm}...`);

  try {
    execSync(installCmd, {
      cwd: projectRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
      timeout: 120000,
    });
    return { success: true };
  } catch (err) {
    const stderr = err.stderr || err.message || '';

    // Platform-specific guidance
    if (stderr.includes('node-gyp') || stderr.includes('gyp ERR')) {
      return {
        success: false,
        error: `Native compilation failed. Install build tools first:\n` +
          `  macOS: xcode-select --install\n` +
          `  Linux: sudo apt-get install build-essential python3\n` +
          `  Windows: npm install -g windows-build-tools`,
      };
    }

    return { success: false, error: stderr.slice(0, 200) || 'Installation failed' };
  }
}

/**
 * Install embedding engine dependencies (tree-sitter, @huggingface/transformers).
 *
 * @param {string} projectRoot
 * @param {Object} options
 */
async function installEmbeddingDeps(projectRoot, options = {}) {
  const { dryRun, logger } = options;
  const deps = [
    { pkg: 'tree-sitter', reason: 'AST-based code chunking' },
    { pkg: 'tree-sitter-javascript', reason: 'JavaScript grammar' },
    { pkg: 'tree-sitter-typescript', reason: 'TypeScript grammar' },
    { pkg: 'tree-sitter-python', reason: 'Python grammar' },
    { pkg: 'tree-sitter-java', reason: 'Java grammar' },
  ];

  const pm = detectPackageManager(projectRoot);

  for (const dep of deps) {
    if (isPackageInstalled(dep.pkg)) {
      continue;
    }

    if (dryRun) {
      logger.info(`[dry-run] Would install ${dep.pkg} (${dep.reason})`);
      continue;
    }

    try {
      const cmd = buildInstallCommand(pm, dep.pkg);
      execSync(cmd, {
        cwd: projectRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 120000,
      });
      logger.success(`Installed ${dep.pkg}`);
    } catch {
      logger.info(`Optional: ${dep.pkg} not installed (${dep.reason}). Line-based chunking will be used as fallback.`);
    }
  }

  // @huggingface/transformers — optional, for local Jina v2 Base Code inference
  if (!isPackageInstalled('@huggingface/transformers')) {
    logger.info('@huggingface/transformers not installed — local Jina embedding inference unavailable.');
    logger.info('Cloud embedding providers (Voyage, OpenAI) still work. Install with:');
    logger.info(`  ${buildInstallCommand(pm, '@huggingface/transformers')}`);
  }
}

/**
 * Generate embeddings for a codebase directory.
 *
 * @param {string} codePath - Path to codebase root
 * @param {Object} options
 * @returns {Promise<{packagePath?: string, fileCount: number, chunkCount: number, error?: string}>}
 */
async function generateCodebaseEmbeddings(codePath, options = {}) {
  const { dryRun, logger, storeChoice, moduleId, outputDir } = options;

  const embOutputDir = outputDir || join(codePath, '.isdlc', 'embeddings');
  const modId = moduleId || 'project-codebase';

  try {
    // Collect source files
    const files = collectFiles(codePath, CODE_EXTENSIONS);
    logger.info(`Found ${files.length} source files`);

    if (files.length === 0) {
      return { fileCount: 0, chunkCount: 0, error: 'No source files found' };
    }

    if (dryRun) {
      logger.info(`[dry-run] Would generate embeddings for ${files.length} files`);
      return { fileCount: files.length, chunkCount: 0 };
    }

    // Dynamic imports — these may fail if deps are not installed
    const { chunkFile, detectLanguage } = await import('./embedding/chunker/index.js');
    const { embed } = await import('./embedding/engine/index.js');
    const { buildPackage } = await import('./embedding/package/builder.js');

    // Chunk all files
    const allChunks = [];
    let processed = 0;

    for (const file of files) {
      const lang = detectLanguage(file);
      if (!lang) continue;

      try {
        const absPath = resolve(codePath, file);
        const chunks = await chunkFile(absPath, lang);
        // Tag chunks with relative path
        for (const chunk of chunks) {
          chunk.filePath = file;
        }
        allChunks.push(...chunks);
      } catch {
        // Skip files that fail to chunk
      }

      processed++;
      if (processed % 100 === 0) {
        logger.info(`  Chunked ${processed}/${files.length} files (${allChunks.length} chunks so far)`);
      }
    }

    logger.info(`Total: ${allChunks.length} chunks from ${files.length} files`);

    if (allChunks.length === 0) {
      return { fileCount: files.length, chunkCount: 0, error: 'No chunks produced' };
    }

    // Generate embeddings
    logger.info('Generating embeddings...');
    const texts = allChunks.map(c => c.content);

    let embResult;
    try {
      embResult = await embed(texts, { provider: 'jina-code' }, {
        onProgress: (done, total) => {
          if (done % 200 === 0 || done === total) {
            logger.info(`  Embedding: ${done}/${total} chunks`);
          }
        },
      });
    } catch (embErr) {
      // CodeBERT not available — try to continue with a note
      logger.warning(`Embedding engine unavailable: ${embErr.message}`);
      logger.info('Install @huggingface/transformers for local embeddings, or configure a cloud provider.');
      return { fileCount: files.length, chunkCount: allChunks.length, error: embErr.message };
    }

    // Build .emb package
    logger.info('Building embedding package...');
    const packagePath = await buildPackage({
      vectors: embResult.vectors,
      chunks: allChunks,
      meta: {
        moduleId: modId,
        version: '1.0.0',
        model: embResult.model,
        dimensions: embResult.dimensions,
      },
      outputDir: embOutputDir,
    });

    return {
      packagePath,
      fileCount: files.length,
      chunkCount: allChunks.length,
    };

  } catch (err) {
    return { fileCount: 0, chunkCount: 0, error: err.message };
  }
}

/**
 * Generate embeddings for a documents directory.
 *
 * @param {string} docsPath - Path to documents directory
 * @param {Object} options
 * @returns {Promise<{packagePath?: string, fileCount: number, chunkCount: number, error?: string}>}
 */
async function generateDocumentEmbeddings(docsPath, options = {}) {
  const { dryRun, logger, storeChoice, moduleId, outputDir } = options;

  const embOutputDir = outputDir || join(docsPath, '.isdlc', 'embeddings');
  const modId = moduleId || 'project-docs';

  try {
    const files = collectFiles(docsPath, DOCUMENT_EXTENSIONS);
    logger.info(`Found ${files.length} document files`);

    if (files.length === 0) {
      return { fileCount: 0, chunkCount: 0, error: 'No document files found' };
    }

    if (dryRun) {
      logger.info(`[dry-run] Would generate embeddings for ${files.length} documents`);
      return { fileCount: files.length, chunkCount: 0 };
    }

    const { createKnowledgePipeline } = await import('./embedding/knowledge/index.js');
    const { embed } = await import('./embedding/engine/index.js');
    const { buildPackage } = await import('./embedding/package/builder.js');

    // Create pipeline with embedding function
    const pipeline = createKnowledgePipeline({
      embedFn: async (texts) => {
        const result = await embed(texts, { provider: 'jina-code' });
        return result.vectors;
      },
      model: 'codebert',
      dimensions: 768,
    });

    // Read and process documents
    const documents = [];
    for (const file of files) {
      try {
        const absPath = resolve(docsPath, file);
        const content = readFileSync(absPath, 'utf-8');
        const ext = extname(file).toLowerCase();
        const format = ext === '.md' || ext === '.markdown' ? 'markdown'
          : ext === '.html' || ext === '.htm' ? 'html'
          : 'text';

        documents.push({ content, filePath: file, format });
      } catch {
        // Skip unreadable files
      }
    }

    logger.info(`Processing ${documents.length} documents...`);

    let pipelineResult;
    try {
      pipelineResult = await pipeline.processDocuments(documents, {
        onProgress: (done, total) => {
          logger.info(`  Processed ${done}/${total} documents`);
        },
      });
    } catch (embErr) {
      logger.warning(`Document embedding failed: ${embErr.message}`);
      return { fileCount: files.length, chunkCount: 0, error: embErr.message };
    }

    // Build package
    logger.info('Building document embedding package...');
    const packagePath = await buildPackage({
      vectors: pipelineResult.vectors,
      chunks: pipelineResult.chunks,
      meta: {
        moduleId: modId,
        version: '1.0.0',
        model: pipelineResult.model,
        dimensions: pipelineResult.dimensions,
      },
      outputDir: embOutputDir,
    });

    return {
      packagePath,
      fileCount: files.length,
      chunkCount: pipelineResult.chunks.length,
    };

  } catch (err) {
    return { fileCount: 0, chunkCount: 0, error: err.message };
  }
}

/**
 * Configure the harness (search-config.json + settings.json) to use generated packages.
 *
 * @param {string} projectRoot
 * @param {Object} options
 * @returns {boolean} Whether configuration was successful
 */
function configureHarness(projectRoot, options = {}) {
  const { vectorStore, packages = [], logger } = options;

  if (packages.length === 0) {
    return false;
  }

  try {
    // Update search-config.json
    const config = readSearchConfig(projectRoot);

    if (!config.activeBackends.includes('semantic-search')) {
      config.activeBackends.push('semantic-search');
    }

    config.backendConfigs = config.backendConfigs || {};
    config.backendConfigs['semantic-search'] = {
      enabled: true,
      vectorStore,
      packages: packages.map(p => resolve(p)),
      model: {
        provider: 'jina-code',
        modelPath: join(projectRoot, '.isdlc', 'models', 'codebert-base', 'model.onnx'),
      },
      chunking: {
        maxTokens: 512,
        overlapTokens: 64,
        preserveSignatures: true,
      },
    };

    writeSearchConfig(projectRoot, config);

    // Update settings.json — add MCP server for semantic search
    const settingsPath = join(projectRoot, '.claude', 'settings.json');
    if (existsSync(settingsPath)) {
      try {
        const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
        if (!settings.mcpServers) settings.mcpServers = {};

        // Only add if not already configured
        if (!settings.mcpServers['isdlc-semantic-search']) {
          settings.mcpServers['isdlc-semantic-search'] = {
            command: 'node',
            args: [
              join(projectRoot, 'node_modules', '.bin', 'isdlc-semantic-server'),
            ],
            env: {
              ISDLC_PROJECT_ROOT: projectRoot,
              ISDLC_EMBEDDING_PACKAGES: packages.join(','),
            },
          };

          fsWriteFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
        }
      } catch (settingsErr) {
        logger.info(`Note: Could not update settings.json MCP config: ${settingsErr.message}`);
        logger.info('Add the semantic search MCP server manually if needed.');
      }
    }

    // Write knowledge manifest for tracking
    const manifestPath = join(projectRoot, '.isdlc', 'knowledge-manifest.json');
    const manifest = {
      version: '1.0.0',
      created: new Date().toISOString(),
      vectorStore,
      packages: packages.map(p => ({
        path: resolve(p),
        relativePath: p.startsWith(projectRoot)
          ? p.slice(projectRoot.length + 1)
          : p,
      })),
    };

    fsMkdirSync(join(projectRoot, '.isdlc'), { recursive: true });
    fsWriteFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

    return true;
  } catch (err) {
    logger.warning(`Harness configuration error: ${err.message}`);
    return false;
  }
}

// ─── Utility functions ────────────────────────────────────────────────

/**
 * Collect files matching given extensions from a directory tree.
 * @param {string} rootDir
 * @param {Set<string>} extensions
 * @returns {string[]} Relative file paths
 */
function collectFiles(rootDir, extensions) {
  const files = [];

  function walk(dir, prefix) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
          walk(join(dir, entry.name), prefix ? `${prefix}/${entry.name}` : entry.name);
        }
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        if (extensions.has(ext)) {
          files.push(prefix ? `${prefix}/${entry.name}` : entry.name);
        }
      }
    }
  }

  walk(rootDir, '');
  return files;
}

/**
 * Check if an npm package is importable from the current process.
 * @param {string} packageName
 * @returns {boolean}
 */
function isPackageInstalled(packageName) {
  try {
    execSync(`node -e "require('${packageName}')"`, {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect the project's package manager.
 * @param {string} projectRoot
 * @returns {'npm'|'yarn'|'pnpm'}
 */
function detectPackageManager(projectRoot) {
  if (existsSync(join(projectRoot, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(projectRoot, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

/**
 * Build an install command for a package using the detected package manager.
 * @param {'npm'|'yarn'|'pnpm'} pm
 * @param {string} pkg
 * @returns {string}
 */
function buildInstallCommand(pm, pkg) {
  switch (pm) {
    case 'pnpm': return `pnpm add ${pkg}`;
    case 'yarn': return `yarn add ${pkg}`;
    default: return `npm install ${pkg}`;
  }
}

/**
 * Create a safe module ID from a filesystem path.
 * @param {string} fsPath
 * @returns {string}
 */
function sanitizeModuleId(fsPath) {
  return basename(fsPath)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) || 'external';
}

export default { setupProjectKnowledge };
