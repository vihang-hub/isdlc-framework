# Interface Specification: REQ-GH-237

## createJinaCodeAdapter(config?)

**Module**: `lib/embedding/engine/jina-code-adapter.js`

**Signature**:
```javascript
export async function createJinaCodeAdapter(config = {})
```

**Parameters**:
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| config | Object | No | `{}` | Configuration options |
| config.cacheDir | string | No | (Transformers.js default: `~/.cache/huggingface/`) | Model cache directory |

**Returns**: `Promise<JinaCodeAdapter | null>`
- Returns adapter object on success
- Returns `null` if `@huggingface/transformers` is not installed (fail-open)

**Errors**: None thrown directly. Load failures return `null`.

---

## JinaCodeAdapter.embed(texts)

**Signature**:
```javascript
async embed(texts: string[]): Promise<Float32Array[]>
```

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| texts | string[] | Yes | Array of text chunks to embed |

**Returns**: `Promise<Float32Array[]>` — Array of 768-dim L2-normalized vectors.

**Errors**:
| Error | Trigger | Recovery |
|-------|---------|----------|
| `Error('Failed to initialize Jina model: ...')` | Model download fails or ONNX runtime error | Caller handles via try/catch |

**Preconditions**: `texts` is a non-empty array of strings.
**Postconditions**: Each returned Float32Array has exactly 768 elements. Vectors are L2-normalized (unit length).

---

## JinaCodeAdapter.healthCheck()

**Signature**:
```javascript
async healthCheck(): Promise<{ healthy: boolean, dimensions: number, error?: string }>
```

**Returns**: Health status object. `healthy: true` if model loads successfully.

---

## JinaCodeAdapter.dispose()

**Signature**:
```javascript
dispose(): void
```

Releases the pipeline reference. Subsequent calls to `embed()` or `healthCheck()` will re-initialize.

---

## resolveAdapter(config) — updated cases

**Module**: `lib/embedding/engine/index.js`

| Provider | Behavior |
|----------|----------|
| `'jina-code'` | Call `createJinaCodeAdapter(config)`, throw if null |
| `'voyage-code-3'` | Unchanged |
| `'openai'` | Unchanged |
| `'codebert'` | Throw `Error('codebert provider has been removed. Use jina-code instead.')` |
| default | Throw `Error('Unsupported embedding provider: ...')` |
