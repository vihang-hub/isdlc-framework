/**
 * Tests for Semantic Search Installer (FR-015)
 *
 * REQ-0045 / FR-015 / Installer
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { createTempDir, cleanupTempDir } from '../../../lib/utils/test-helpers.js';
import { setupSemanticSearch, getSemanticSearchConfig } from './semantic-search-setup.js';
// model-downloader.js removed — Transformers.js handles model downloads (Jina v2 migration).

describe('FR-015: Semantic Search Installer', () => {
  let tempDir;

  before(() => {
    tempDir = createTempDir();
  });

  after(() => {
    cleanupTempDir(tempDir);
  });

  // ── setupSemanticSearch() ─────────────────────────────────────────
  describe('setupSemanticSearch()', () => {
    it('returns a success result with components', async () => {
      const result = await setupSemanticSearch(tempDir);
      assert.equal(result.success, true);
      assert.ok(result.components);
      assert.ok(Array.isArray(result.warnings));
    });

    it('is idempotent — re-running produces same result', async () => {
      const result1 = await setupSemanticSearch(tempDir);
      const result2 = await setupSemanticSearch(tempDir);
      assert.equal(result1.success, result2.success);
      assert.deepEqual(
        Object.keys(result1.components),
        Object.keys(result2.components)
      );
    });

    it('reports components status', async () => {
      const result = await setupSemanticSearch(tempDir);
      const c = result.components;

      assert.equal(typeof c.treeSitter.installed, 'boolean');
      assert.equal(typeof c.onnxRuntime.installed, 'boolean');
      assert.equal(typeof c.faiss.installed, 'boolean');
      assert.equal(typeof c.docker.installed, 'boolean');
      assert.equal(typeof c.embeddingModel.installed, 'boolean');
    });

    it('skips Docker check when skipDocker is true', async () => {
      const result = await setupSemanticSearch(tempDir, { skipDocker: true });
      assert.equal(result.components.docker.skipped, true);
    });

    it('skips model download when skipModel is true', async () => {
      const result = await setupSemanticSearch(tempDir, { skipModel: true });
      assert.equal(result.components.embeddingModel.skipped, true);
    });

    it('fires onProgress callback', async () => {
      const progressCalls = [];
      await setupSemanticSearch(tempDir, {
        skipDocker: true,
        skipModel: true,
        onProgress: (component, status, detail) => {
          progressCalls.push({ component, status, detail });
        },
      });
      assert.ok(progressCalls.length > 0);
      assert.ok(progressCalls.some(p => p.component === 'tree-sitter'));
    });

    it('warns when tree-sitter not installed', async () => {
      const result = await setupSemanticSearch(tempDir);
      // tree-sitter is likely not installed in test environment
      if (!result.components.treeSitter.installed) {
        assert.ok(result.warnings.some(w => w.includes('tree-sitter')));
      }
    });

    it('marks onnxRuntime as skipped when not directly installed', async () => {
      const result = await setupSemanticSearch(tempDir);
      if (!result.components.onnxRuntime.installed) {
        assert.equal(result.components.onnxRuntime.skipped, true);
      }
    });

    it('accepts custom language list', async () => {
      const result = await setupSemanticSearch(tempDir, {
        languages: ['java', 'go'],
        skipDocker: true,
        skipModel: true,
      });
      assert.ok(result.success);
    });
  });

  // ── getSemanticSearchConfig() ─────────────────────────────────────
  describe('getSemanticSearchConfig()', () => {
    it('returns config object with semantic section', () => {
      const setupResult = {
        success: true,
        components: {
          treeSitter: { installed: false, skipped: true },
          grammars: { installed: false, skipped: true, languages: [] },
          onnxRuntime: { installed: false, skipped: true },
          embeddingModel: { installed: false, skipped: true },
          faiss: { installed: false, skipped: true },
          docker: { installed: false, skipped: true },
        },
        warnings: [],
      };
      const config = getSemanticSearchConfig(setupResult);
      assert.ok(config.semantic);
      assert.equal(config.semantic.enabled, true);
      assert.ok(config.semantic.model);
      assert.ok(config.semantic.chunking);
    });

    it('reflects component availability in config', () => {
      const setupResult = {
        success: true,
        components: {
          treeSitter: { installed: true, skipped: false },
          grammars: { installed: true, skipped: false, languages: ['java'] },
          onnxRuntime: { installed: true, skipped: false },
          embeddingModel: { installed: true, skipped: false },
          faiss: { installed: true, skipped: false },
          docker: { installed: true, skipped: false },
        },
        warnings: [],
      };
      const config = getSemanticSearchConfig(setupResult);
      assert.equal(config.semantic.components.treeSitter, true);
      assert.equal(config.semantic.components.onnxRuntime, true);
      assert.equal(config.semantic.components.faiss, true);
    });

    it('keeps jina-code provider when @huggingface/transformers is available', () => {
      const setupResult = {
        success: true,
        components: {
          treeSitter: { installed: false, skipped: true },
          grammars: { installed: false, skipped: true, languages: [] },
          onnxRuntime: { installed: false, skipped: true },
          embeddingModel: { installed: false, skipped: true },
          faiss: { installed: false, skipped: true },
          docker: { installed: false, skipped: true },
        },
        warnings: [],
      };
      const config = getSemanticSearchConfig(setupResult);
      // @huggingface/transformers is installed, so local inference is available
      assert.equal(config.semantic.model.provider, 'jina-code');
    });

    it('handles null setupResult gracefully', () => {
      const config = getSemanticSearchConfig(null);
      assert.ok(config.semantic);
      assert.equal(config.semantic.enabled, true);
    });
  });

  // downloadModel() and getModelPath() tests removed —
  // model-downloader.js deleted as part of Jina v2 migration (FR-004).
  // Transformers.js handles model downloads automatically on first use.
});
