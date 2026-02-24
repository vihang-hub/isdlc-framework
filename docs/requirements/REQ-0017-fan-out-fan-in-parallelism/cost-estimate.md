# Cost Estimate: Fan-Out/Fan-In Parallelism

**REQ ID**: REQ-0017
**Phase**: 03-architecture
**Created**: 2026-02-15
**Author**: Solution Architect (Agent 03)

---

## 1. Infrastructure Cost

**$0 per month** -- The iSDLC framework is a local development tool. The fan-out feature introduces no cloud resources, servers, databases, or external services.

---

## 2. API Token Cost Impact

The fan-out feature increases Claude API token usage when active (above-threshold workloads).

### Per-Execution Estimates

| Scenario | Agents | Input Tokens | Output Tokens | Total Tokens | Multiplier vs Single-Agent |
|----------|--------|-------------|---------------|-------------|---------------------------|
| Single agent (baseline) | 1 | ~5K | ~3K | ~8K | 1.0x |
| 2 chunk agents | 2 + 1 orchestrator | ~15K | ~9K | ~24K | 3.0x |
| 4 chunk agents | 4 + 1 orchestrator | ~25K | ~15K | ~40K | 5.0x |
| 8 chunk agents | 8 + 1 orchestrator | ~45K | ~27K | ~72K | 9.0x |

Notes:
- Input tokens include the chunk agent prompt (~3K per agent) plus chunk items (~2K per agent for 250 test file paths)
- Output tokens include test results (~2K per agent) plus chunk metadata
- The orchestrator agent adds ~5K input tokens (splitting + merging) and ~3K output tokens (merged result)
- These are rough estimates; actual usage depends on test suite size, file count, and verbosity

### Monthly Projection

Assuming 5 fan-out executions per day (active development), 20 working days per month:

| Scenario | Executions/Month | Tokens/Execution | Monthly Tokens | Est. Monthly Cost |
|----------|-----------------|-----------------|---------------|-------------------|
| 2 agents | 100 | ~24K | ~2.4M | ~$7-12 |
| 4 agents | 100 | ~40K | ~4.0M | ~$12-20 |
| 8 agents | 100 | ~72K | ~7.2M | ~$22-36 |

Cost varies by Claude API pricing tier. These estimates assume standard API pricing.

### Below-Threshold Workloads

Projects with < 250 tests or < 5 changed files: **$0 additional cost**. Fan-out is skipped; single-agent execution is used. No extra token usage.

---

## 3. Development Cost

### Implementation Effort

| Task | Estimated Hours | Complexity |
|------|----------------|-----------|
| Fan-out engine skill file (SKILL.md) | 1.5 | Low |
| Phase 16 agent modification (Track A fan-out) | 3.0 | High |
| Phase 08 agent modification (file review fan-out) | 2.0 | Medium |
| isdlc.md --no-fan-out flag parsing | 0.5 | Low |
| Skills manifest update (QL-012) | 0.25 | Low |
| Characterization tests (pre-modification) | 2.0 | Medium |
| Fan-out unit/integration tests | 2.5 | Medium |
| Gate validation compatibility testing | 1.0 | Low |
| Documentation and review | 1.0 | Low |
| **Total** | **~14 hours** | Medium |

### Ongoing Maintenance Cost

- **Low maintenance burden**: The fan-out engine is a protocol definition, not executable code. Changes to the protocol only require updating markdown files.
- **Future consumer onboarding**: Adding fan-out to a new phase requires ~2 hours (define parameters, add agent section, test).
- **Configuration tuning**: Adjusting thresholds requires editing state.json values (minutes, not hours).

---

## 4. Cost Optimization Recommendations

1. **Start with 2-4 agents**: The default `max_agents: 8` can be reduced to 4 for cost-conscious projects. The throughput benefit of 4 agents over 2 is significant; the benefit of 8 over 4 is modest.

2. **Increase `tests_per_agent` threshold**: Changing from 250 to 500 tests per agent reduces the number of chunk agents for mid-size projects, saving tokens.

3. **Use `--no-fan-out` for small iterations**: When making small changes that only affect a few tests, use the `--no-fan-out` flag to avoid unnecessary parallel agent overhead.

4. **Monitor `fan_out.degraded` events**: If chunk agents frequently timeout or fail, reduce `max_agents` to lower the concurrent load.

---

## 5. ROI Analysis

### Time Savings

For a project with 1000 tests (typical medium project):
- Single agent: ~4 minutes (estimated)
- 4 chunk agents: ~1.5 minutes (estimated 2.7x speedup)
- Time saved per execution: ~2.5 minutes
- Monthly time saved (100 executions): ~250 minutes (~4 hours)

### Cost-Benefit

- Monthly token cost increase: ~$12-20 (4 agents)
- Monthly time savings: ~4 hours of developer waiting time
- Developer time value: $50-150/hour (varies)
- Monthly value of time saved: $200-600
- **ROI**: 10-50x (token cost vs. developer time saved)

Fan-out is clearly cost-effective for projects above the threshold. Below-threshold projects incur zero additional cost.
