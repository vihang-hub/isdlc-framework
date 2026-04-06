# Security Scan Report: REQ-GH-237 — Replace CodeBERT with Jina v2 Base Code

**Date**: 2026-04-06

## Dependency Audit (QL-009)

```
npm audit: found 0 vulnerabilities
```

**Status**: PASS — no known vulnerabilities in dependency tree.

## Dependency Changes

| Action | Package | Version | Risk |
|--------|---------|---------|------|
| REMOVED | onnxruntime-node | (was dependency) | Risk reduction — removed native binary dep |
| ADDED | @huggingface/transformers | ^4 | Low — well-maintained HuggingFace package |

## SAST Review (QL-008)

### New File: lib/embedding/engine/jina-code-adapter.js

| Check | Result |
|-------|--------|
| Hardcoded credentials | None found |
| Dynamic code execution (eval, Function) | None |
| Unsafe deserialization | None |
| User input injection | None — inputs are text arrays for embedding |
| File system access | None — model caching handled by transformers lib |
| Network requests | None directly — handled by transformers lib |
| Error information leakage | Errors include model/library messages only |
| Dependency injection | config._pipelineFactory for testing only |

### Modified File: lib/embedding/engine/index.js

| Check | Result |
|-------|--------|
| New attack surface | None — removed a provider, added fail-safe routing |
| Error messages | Generic removal message, no sensitive info |
| Default provider change | codebert -> jina-code — safe, local-only default |

### Deleted Files

| File | Security Impact |
|------|----------------|
| codebert-adapter.js | Removed — reduces attack surface |
| model-downloader.js | Removed — eliminated manual model download code (network code removed) |

## Overall Security Assessment

**PASS** — The migration reduces attack surface by removing the manual model download pipeline and native ONNX runtime dependency. The new adapter delegates model management to `@huggingface/transformers` which handles caching and verification internally.
