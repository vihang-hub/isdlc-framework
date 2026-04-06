/**
 * Jina Code Adapter — Transformers.js pipeline for local code embeddings.
 *
 * Wraps @huggingface/transformers v4 to run Jina v2 Base Code locally.
 * Returns null from createJinaCodeAdapter() if the transformers package
 * is not available, enabling graceful fallback (Article X: Fail-Safe Defaults).
 *
 * REQ-GH-237 / FR-001 / AC-001-01, AC-001-02, AC-001-03, AC-001-04
 * @module lib/embedding/engine/jina-code-adapter
 */

export const JINA_CODE_DIMENSIONS = 768;

const MODEL_ID = 'jinaai/jina-embeddings-v2-base-code';

/**
 * L2-normalize a vector in place.
 * @param {Float32Array} vec
 */
function normalize(vec) {
  let norm = 0;
  for (let i = 0; i < vec.length; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < vec.length; i++) {
      vec[i] /= norm;
    }
  }
}

/**
 * Create a Jina Code adapter instance.
 * Returns null if @huggingface/transformers is not installed (AC-001-04: fail-open).
 *
 * @param {Object} [config]
 * @param {string} [config.cacheDir] - Optional model cache directory
 * @returns {Promise<{dimensions: number, embed: Function, healthCheck: Function, dispose: Function}|null>}
 */
export async function createJinaCodeAdapter(config = {}) {
  let pipeline;
  try {
    if (config._pipelineFactory) {
      // Dependency injection for testing (avoids 162MB model download)
      pipeline = config._pipelineFactory;
    } else {
      const transformers = await import('@huggingface/transformers');
      pipeline = transformers.pipeline;
    }
  } catch {
    // AC-001-04: Fail-open if @huggingface/transformers is not installed
    return null;
  }

  let extractor = null;

  async function ensureExtractor() {
    if (!extractor) {
      const opts = config.cacheDir ? { cache_dir: config.cacheDir } : {};
      extractor = await pipeline('feature-extraction', MODEL_ID, opts);
    }
    return extractor;
  }

  return {
    dimensions: JINA_CODE_DIMENSIONS,

    /**
     * Generate embeddings for an array of text inputs.
     * @param {string[]} texts
     * @returns {Promise<Float32Array[]>}
     */
    async embed(texts) {
      const ext = await ensureExtractor();
      const results = [];

      for (const text of texts) {
        const output = await ext(text, { pooling: 'mean', normalize: true });
        const nested = output.tolist();
        const raw = nested[0]; // first (only) sequence → array of numbers
        const vec = new Float32Array(raw);
        normalize(vec);
        results.push(vec);
      }

      return results;
    },

    /**
     * Check if the model is loaded and functional.
     * @returns {Promise<{healthy: boolean, dimensions: number, error?: string}>}
     */
    async healthCheck() {
      try {
        await ensureExtractor();
        return { healthy: true, dimensions: JINA_CODE_DIMENSIONS };
      } catch (err) {
        return { healthy: false, dimensions: JINA_CODE_DIMENSIONS, error: err.message };
      }
    },

    /**
     * Release pipeline resources.
     */
    dispose() {
      if (extractor) {
        extractor.dispose?.();
        extractor = null;
      }
    },
  };
}
