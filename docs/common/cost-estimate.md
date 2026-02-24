# Cost Estimate: Custom Skill Management (REQ-0022)

**Version**: 1.0
**Created**: 2026-02-18
**Phase**: 03-architecture
**Status**: Accepted
**Traces to**: NFR-001, NFR-002

---

## 1. Overview

The custom skill management feature has zero infrastructure cost. It is a local CLI feature with no cloud services, no external APIs, and no runtime hosting. The only costs are in LLM token usage during skill injection and the development effort to implement the feature.

---

## 2. Infrastructure Cost

| Category | Monthly Cost | Notes |
|----------|-------------|-------|
| Cloud compute | $0 | No cloud services |
| Storage | $0 | Local filesystem only |
| Networking | $0 | No network operations |
| Database | $0 | No database |
| CDN | $0 | No CDN |
| Monitoring | $0 | Local logging only |
| **Total Infrastructure** | **$0/month** | |

---

## 3. Token Cost Impact

The primary cost impact of this feature is increased token consumption during workflow execution, as injected skill content adds to the context sent to the LLM.

### 3.1 Per-Skill Token Impact

| Delivery Type | Typical Content Size | Token Estimate | Impact |
|---------------|---------------------|----------------|--------|
| Context | 2,000-5,000 chars | 500-1,250 tokens | Added to input context per matched delegation |
| Instruction | 1,000-3,000 chars | 250-750 tokens | Added to input context per matched delegation |
| Reference | 100-150 chars | 25-35 tokens | Minimal -- just a file path reference |

### 3.2 Per-Workflow Token Impact

Assumptions:
- Typical user has 3 external skills registered
- Average 2 skills match per phase delegation
- Average delivery is "context" (most common)
- Typical workflow has 6 phase delegations
- Average skill content: 3,000 chars (~750 tokens)

```
Per delegation:  2 skills x 750 tokens = 1,500 tokens added
Per workflow:    6 delegations x 1,500 tokens = 9,000 tokens added
```

### 3.3 Cost Projection (Claude API)

| Usage Level | Skills | Workflows/Month | Added Tokens/Month | Estimated Cost* |
|-------------|--------|-----------------|-------------------|----------------|
| Light | 2 | 10 | 60,000 | ~$0.90 |
| Moderate | 5 | 30 | 270,000 | ~$4.05 |
| Heavy | 10 | 60 | 720,000 | ~$10.80 |

*Based on Claude input token pricing of ~$15 per million tokens. Actual costs depend on the specific model and pricing tier.

### 3.4 Token Budget Controls

- **10,000 char truncation**: Skills exceeding this limit are truncated and switched to reference delivery, capping per-skill token impact at ~2,500 tokens
- **Reference delivery**: Large skills use reference delivery (25-35 tokens) instead of full content injection
- **No runtime cap**: There is no hard limit on total injection tokens per delegation. The design relies on the per-skill truncation and the practical limit of ~50 skills (typically 1-3 match per delegation)

---

## 4. Development Cost

### 4.1 Implementation Effort

| Component | Estimated Lines | Effort |
|-----------|----------------|--------|
| common.cjs new functions (6) | 200-300 lines | 2-3 hours |
| isdlc.md action handlers (4) | 150-250 lines | 2-3 hours |
| isdlc.md STEP 3d injection | 50-80 lines | 1-2 hours |
| skill-manager.md agent | 150-200 lines | 1-2 hours |
| CLAUDE.md intent row | 5 lines | < 15 minutes |
| skills-manifest.json entry | 10 lines | < 15 minutes |
| Unit tests | 200-300 lines | 2-3 hours |
| **Total** | **765-1145 lines** | **8-14 hours** |

### 4.2 Test Infrastructure Cost

No additional test infrastructure needed. Tests use existing:
- `node:test` framework (built into Node.js)
- `hook-test-utils.cjs` helpers (existing test utilities)
- Temporary directories (created/cleaned up by tests)

---

## 5. Growth Projections

| Timeframe | Skills per Project | Token Impact | Cost Impact |
|-----------|-------------------|--------------|-------------|
| Month 1 | 1-3 | Minimal | < $1/month |
| Month 6 | 5-10 | Moderate | $2-5/month |
| Month 12 | 10-20 | Moderate | $5-10/month |

Growth is bounded by the 50-skill limit (NFR-002) and the 10,000-char truncation per skill. Even at maximum scale (50 skills, all context delivery), the token impact is ~37,500 tokens per delegation, which is well within typical LLM context windows.

---

## 6. Cost Optimization Recommendations

1. **Use reference delivery for large skills**: Skills over 3,000 chars should use reference delivery to minimize token cost
2. **Be selective with bindings**: Bind skills only to phases where they are relevant (not all phases)
3. **Consolidate related skills**: Combine multiple small skills into one if they apply to the same phases
4. **Monitor usage log**: The `skill_usage_log` in state.json tracks which skills are injected. Review periodically to identify unused skills for removal.
