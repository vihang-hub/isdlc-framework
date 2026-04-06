# Module Design: REQ-GH-237

## jina-code-adapter.js (NEW)

**Responsibility**: Wrap `@huggingface/transformers` pipeline for Jina v2 Base Code embeddings.

**Public Interface**:
```
export const JINA_CODE_DIMENSIONS = 768;

export async function createJinaCodeAdapter(config?: {
  cacheDir?: string;
}): Promise<JinaCodeAdapter | null>;
```

**Adapter Object**:
```
{
  dimensions: 768,
  embed(texts: string[]): Promise<Float32Array[]>,
  healthCheck(): Promise<{ healthy: boolean, dimensions: number, error?: string }>,
  dispose(): void,
}
```

**Internal State**: Lazy singleton `extractor` (Transformers.js pipeline instance). Initialized on first `embed()` or `healthCheck()` call. Released on `dispose()`.

**Dependencies**: `@huggingface/transformers` (dynamic import for fail-open).

**Estimated Size**: ~60 lines.

## engine/index.js (MODIFY)

**Responsibility**: Route embedding requests to the correct adapter based on `config.provider`.

**Changes**:
- Remove `createCodeBERTAdapter` and `CODEBERT_DIMENSIONS` imports
- Add `createJinaCodeAdapter` and `JINA_CODE_DIMENSIONS` imports
- `resolveAdapter()`: replace `case 'codebert'` with `case 'jina-code'`; add `case 'codebert'` that throws removal notice
- `getDimensionsForProvider()`: replace `'codebert'` → `'jina-code'`
- Update exports

**Dependencies**: `jina-code-adapter.js` (new), `voyage-adapter.js` (unchanged), `openai-adapter.js` (unchanged).

## setup-project-knowledge.js (MODIFY)

**Responsibility**: Interactive setup for project knowledge / semantic search. Add pre-warm for Jina model download.

**Changes**:
- `installEmbeddingDeps()`: replace `onnxruntime-node` reference with `@huggingface/transformers`
- After dep install: add pre-warm step calling `createJinaCodeAdapter()` then `adapter.healthCheck()` to trigger download
- Wrap pre-warm in try/catch (fail-open)

## package/builder.js (MODIFY)

**Responsibility**: Build .emb packages from embeddings.

**Changes**: Write `model_id: 'jina-code-v2-base'` into .emb package metadata.

## package/reader.js (MODIFY)

**Responsibility**: Read and validate .emb packages.

**Changes**: Check `model_id` in metadata. If missing or mismatched, log warning (FR-006).
