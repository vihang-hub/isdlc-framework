# Coverage Report: REQ-GH-237 — Replace CodeBERT with Jina v2 Base Code

**Date**: 2026-04-06
**Tool**: NOT CONFIGURED (no c8/istanbul/nyc in package.json)

## Summary

No code coverage measurement tool is configured for this project. Coverage thresholds cannot be enforced.

## Test File Coverage (structural)

All implementation files have corresponding test files:

| Implementation File | Test File | Tests | Status |
|--------------------|-----------|-------|--------|
| lib/embedding/engine/jina-code-adapter.js (NEW) | lib/embedding/engine/jina-code-adapter.test.js | 28 | All pass |
| lib/embedding/engine/index.js | lib/embedding/engine/index.test.js | 26 | All pass |
| lib/embedding/installer/semantic-search-setup.js | lib/embedding/installer/index.test.js | 13 | All pass |
| lib/embedding/installer/lifecycle.test.js | (cross-file verification) | 14 | 13 pass, 1 pre-existing fail |
| lib/embedding/discover-integration.test.js | (integration test) | 29 | All pass |
| lib/embedding/package/builder.js | lib/embedding/package/index.test.js | 19 | All pass |
| lib/embedding/package/reader.js | (tested via index.test.js) | — | Covered |
| lib/embedding/package/manifest.js | (tested via index.test.js) | — | Covered |
| lib/embedding/installer/pre-warm.test.js (NEW) | — | 14 | All skip (scaffolds) |

## Recommendation

Configure `c8` or `node:test` built-in coverage for future quality loops:
```json
"scripts": {
  "test:coverage": "c8 node --test lib/**/*.test.js"
}
```
