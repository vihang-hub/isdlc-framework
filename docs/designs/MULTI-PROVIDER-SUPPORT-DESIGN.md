# Multi-Provider LLM Support Design

**Version**: 1.0.0
**Date**: 2026-02-04
**Status**: Draft
**Author**: Claude Opus 4.5

---

## Executive Summary

This design introduces a **Provider Abstraction Layer** that enables the iSDLC framework to work with multiple LLM providers beyond Anthropic, including:

**Free Cloud Providers (No GPU Required):**
- **Groq** (FREE: 1,000 req/day - ultra-fast Llama 3.3 70B)
- **Together AI** ($1 free credit - Qwen Coder, Llama, DeepSeek)
- **Google AI Studio** (FREE: 60 req/min - Gemini 2.0 Flash)
- **OpenRouter** (cloud aggregator: multiple providers via single API)

**Local Inference (Requires GPU):**
- **Ollama** (local models: qwen3-coder, deepseek-coder - needs 12-24GB VRAM)

**Premium:**
- **Anthropic** (Claude Opus, Sonnet - best quality)
- **Mistral AI** (Codestral, Mistral Large)
- **Custom endpoints** (any Anthropic-compatible API)

The key innovation is **phase-aware routing**: different SDLC phases can use different models based on their complexity requirements, with automatic fallback chains for reliability.

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Goals & Non-Goals](#goals--non-goals)
3. [Architecture Overview](#architecture-overview)
4. [Provider Configuration](#provider-configuration)
5. [Phase Routing Strategy](#phase-routing-strategy)
6. [Implementation Details](#implementation-details)
7. [Agent Metadata Evolution](#agent-metadata-evolution)
8. [Hook Implementation](#hook-implementation)
9. [CLI Integration](#cli-integration)
10. [Fallback & Reliability](#fallback--reliability)
11. [Cost & Usage Tracking](#cost--usage-tracking)
12. [Migration Guide](#migration-guide)
13. [Directory Structure](#directory-structure)
14. [Implementation Plan](#implementation-plan)

---

## Problem Statement

### Current Limitations

1. **Single Provider Lock-in**: All agents hardcoded to `model: opus` (Anthropic only)
2. **Cost Barrier**: API costs prevent experimentation, learning, prototyping
3. **Privacy Concerns**: All code sent to cloud (problematic for regulated industries)
4. **Offline Unavailable**: No capability for air-gapped or travel scenarios
5. **No Quality/Cost Tradeoff**: Simple tasks use same expensive model as complex ones

### User Scenarios Blocked

| Scenario | Current Status | Desired |
|----------|---------------|---------|
| Student learning SDLC | ❌ Requires API budget | ✅ Free with Ollama |
| Regulated industry (HIPAA, SOC2) | ❌ Code leaves premises | ✅ Local-only mode |
| Offline development | ❌ Internet required | ✅ Works offline |
| Budget-conscious teams | ❌ All phases = premium | ✅ Smart routing |
| Air-gapped environments | ❌ Impossible | ✅ Fully supported |

---

## Goals & Non-Goals

### Goals

1. **Multi-Provider Support**: Anthropic, Ollama, OpenRouter, OpenAI, Google, custom
2. **Phase-Aware Routing**: Match model capability to phase complexity
3. **Zero Breaking Changes**: Existing workflows continue unchanged
4. **Graceful Degradation**: Automatic fallback when provider fails
5. **Cost Tracking**: Monitor usage per provider per phase
6. **Simple Configuration**: Single YAML file for all provider settings
7. **Local-First Option**: Full framework functionality with Ollama only

### Non-Goals

- Rewriting agent logic for different model capabilities
- Supporting every LLM provider on the market
- Real-time provider cost optimization
- Multi-provider consensus (using multiple models per task)
- Provider-specific prompt optimization (beyond context limits)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         iSDLC Multi-Provider Architecture                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐                                                        │
│  │   User Request   │                                                        │
│  │  /sdlc feature   │                                                        │
│  └────────┬─────────┘                                                        │
│           │                                                                  │
│           ▼                                                                  │
│  ┌──────────────────┐      ┌─────────────────────────────────────────────┐  │
│  │   Orchestrator   │      │          Provider Configuration             │  │
│  │   (Agent 00)     │      │         .isdlc/providers.yaml               │  │
│  └────────┬─────────┘      │  ┌─────────────────────────────────────┐    │  │
│           │                │  │ providers:                          │    │  │
│           │                │  │   anthropic:                        │    │  │
│           │                │  │     base_url: api.anthropic.com     │    │  │
│           │                │  │     models: [opus-4.5, sonnet-4]    │    │  │
│           │                │  │   ollama:                           │    │  │
│           │                │  │     base_url: localhost:11434       │    │  │
│           │                │  │     models: [qwen3-coder]           │    │  │
│           │                │  └─────────────────────────────────────┘    │  │
│           │                └─────────────────────────────────────────────┘  │
│           ▼                                                                  │
│  ┌──────────────────┐                                                        │
│  │   Task Tool      │◄────── PreToolUse Hook                                │
│  │   Invocation     │        ┌─────────────────────────────────────────┐    │
│  └────────┬─────────┘        │     model-provider-router.js            │    │
│           │                  │                                         │    │
│           │                  │  1. Read target agent metadata          │    │
│           │                  │  2. Get phase from state.json           │    │
│           │                  │  3. Load providers.yaml                 │    │
│           │                  │  4. Apply phase_routing rules           │    │
│           │                  │  5. Check provider health               │    │
│           │                  │  6. Inject environment overrides        │    │
│           │                  │  7. Track selection in state            │    │
│           │                  └─────────────────────────────────────────┘    │
│           │                                                                  │
│           ▼                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        Provider Selection                             │   │
│  │                                                                       │   │
│  │   Phase 00 (Exploration)  ──► Ollama (code search, pattern-based)    │   │
│  │   Phase 01-03 (Reqs/Arch) ──► Anthropic (complex reasoning)          │   │
│  │   Phase 04 (Test Design)  ──► Ollama (template generation)           │   │
│  │   Phase 05 (Implementation)──► Anthropic (quality critical)          │   │
│  │   Phase 06 (Testing)      ──► Ollama (execution-based)               │   │
│  │   Phase 07+ (Review)      ──► Configurable                           │   │
│  │                                                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│           │                                                                  │
│           ▼                                                                  │
│  ┌──────────────────┐                                                        │
│  │  Target Agent    │◄────── Receives injected env vars:                    │
│  │  (e.g., 05-dev)  │        ANTHROPIC_BASE_URL, ANTHROPIC_API_KEY          │
│  └──────────────────┘        ANTHROPIC_MODEL (for model override)           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Provider Configuration

### Configuration File: `.isdlc/providers.yaml`

```yaml
# iSDLC Multi-Provider Configuration
# Version: 1.0.0

# ============================================================================
# PROVIDER DEFINITIONS
# ============================================================================

providers:
  # Anthropic (Default - Claude models)
  anthropic:
    enabled: true
    base_url: "https://api.anthropic.com"
    api_key_env: "ANTHROPIC_API_KEY"  # Read from environment
    models:
      - id: "claude-opus-4-5-20251101"
        alias: "opus"
        context_window: 200000
        capabilities: [reasoning, coding, vision, tool_use]
        cost_tier: "premium"
      - id: "claude-sonnet-4-20250514"
        alias: "sonnet"
        context_window: 200000
        capabilities: [reasoning, coding, vision, tool_use]
        cost_tier: "standard"
    health_check:
      endpoint: "/v1/messages"
      timeout_ms: 5000

  # Ollama (Local models)
  ollama:
    enabled: true
    base_url: "http://localhost:11434"
    api_key: "ollama"  # Required but ignored by Ollama
    auth_token: "ollama"
    models:
      - id: "qwen3-coder"
        alias: "qwen-coder"
        context_window: 32768
        capabilities: [coding, tool_use]
        cost_tier: "free"
        min_vram_gb: 24
      - id: "deepseek-coder-v2:16b"
        alias: "deepseek"
        context_window: 65536
        capabilities: [coding, tool_use]
        cost_tier: "free"
        min_vram_gb: 16
      - id: "codellama:34b"
        alias: "codellama"
        context_window: 16384
        capabilities: [coding]
        cost_tier: "free"
        min_vram_gb: 24
    health_check:
      endpoint: "/api/tags"
      timeout_ms: 2000

  # OpenRouter (Cloud aggregator)
  openrouter:
    enabled: false
    base_url: "https://openrouter.ai/api/v1"
    api_key_env: "OPENROUTER_API_KEY"
    models:
      - id: "anthropic/claude-3.5-sonnet"
        alias: "or-sonnet"
        context_window: 200000
        capabilities: [reasoning, coding, vision, tool_use]
        cost_tier: "standard"
      - id: "deepseek/deepseek-coder"
        alias: "or-deepseek"
        context_window: 65536
        capabilities: [coding, tool_use]
        cost_tier: "budget"
    health_check:
      endpoint: "/models"
      timeout_ms: 5000

  # Custom endpoint (for self-hosted or enterprise)
  custom:
    enabled: false
    base_url: "${CUSTOM_LLM_BASE_URL}"
    api_key_env: "CUSTOM_LLM_API_KEY"
    models:
      - id: "${CUSTOM_MODEL_ID}"
        alias: "custom"
        context_window: 32768
        capabilities: [coding, tool_use]
        cost_tier: "custom"

# ============================================================================
# DEFAULT PROVIDER SELECTION
# ============================================================================

defaults:
  # Primary provider when no phase-specific rule matches
  provider: "anthropic"
  model: "sonnet"

  # Fallback chain (tried in order if primary fails)
  fallback_chain:
    - provider: "openrouter"
      model: "or-sonnet"
    - provider: "ollama"
      model: "qwen-coder"

# ============================================================================
# PHASE ROUTING STRATEGY
# ============================================================================

phase_routing:
  # Exploration phases - code search/analysis (local OK)
  "00-mapping":
    provider: "ollama"
    model: "qwen-coder"
    rationale: "Pattern-based code search, no complex reasoning needed"
    fallback: ["anthropic:sonnet"]

  "02-tracing":
    provider: "ollama"
    model: "qwen-coder"
    rationale: "Execution path tracing is pattern-based"
    fallback: ["anthropic:sonnet"]

  # Requirements & Architecture - complex reasoning (cloud recommended)
  "01-requirements":
    provider: "anthropic"
    model: "sonnet"
    rationale: "Stakeholder elicitation requires nuanced reasoning"
    fallback: ["openrouter:or-sonnet", "ollama:qwen-coder"]

  "02-architecture":
    provider: "anthropic"
    model: "opus"
    rationale: "Architectural decisions are high-stakes, need best reasoning"
    fallback: ["anthropic:sonnet", "openrouter:or-sonnet"]

  "03-design":
    provider: "anthropic"
    model: "sonnet"
    rationale: "Design requires consistency with architecture"
    fallback: ["openrouter:or-sonnet", "ollama:qwen-coder"]

  # Test Design - template generation (local OK)
  "04-test-strategy":
    provider: "ollama"
    model: "qwen-coder"
    rationale: "Test case generation is pattern-based from specs"
    fallback: ["anthropic:sonnet"]

  # Implementation - quality critical (cloud recommended)
  "05-implementation":
    provider: "anthropic"
    model: "sonnet"
    rationale: "Code quality directly impacts product"
    fallback: ["openrouter:or-sonnet", "ollama:qwen-coder"]

  # Testing - execution-based (local OK)
  "06-testing":
    provider: "ollama"
    model: "qwen-coder"
    rationale: "Test execution and iteration is mechanical"
    fallback: ["anthropic:sonnet"]

  # Code Review - needs reasoning (cloud recommended)
  "07-code-review":
    provider: "anthropic"
    model: "sonnet"
    rationale: "Review quality requires understanding intent"
    fallback: ["openrouter:or-sonnet"]

  # Documentation - template-based (local OK)
  "08-documentation":
    provider: "ollama"
    model: "qwen-coder"
    rationale: "Doc generation is largely template-based"
    fallback: ["anthropic:sonnet"]

  # CI/CD - infrastructure (mixed)
  "09-cicd":
    provider: "ollama"
    model: "qwen-coder"
    rationale: "Pipeline config is pattern-based"
    fallback: ["anthropic:sonnet"]

  # Local Testing - execution (local OK)
  "10-local-testing":
    provider: "ollama"
    model: "qwen-coder"
    rationale: "Local test execution is mechanical"
    fallback: ["anthropic:sonnet"]

  # Cloud Infrastructure - critical (cloud recommended)
  "11-cloud-infra":
    provider: "anthropic"
    model: "sonnet"
    rationale: "Infrastructure decisions have cost/security implications"
    fallback: ["openrouter:or-sonnet"]

  "12-cloud-deployment":
    provider: "anthropic"
    model: "sonnet"
    rationale: "Deployment configs affect production"
    fallback: ["openrouter:or-sonnet"]

  # Security Review - critical (cloud required)
  "13-security-review":
    provider: "anthropic"
    model: "opus"
    rationale: "Security review requires best reasoning capability"
    fallback: ["anthropic:sonnet"]
    local_override: false  # Never use local for security

  # Upgrade Planning - reasoning needed
  "14-upgrade":
    provider: "anthropic"
    model: "sonnet"
    rationale: "Upgrade planning requires understanding dependencies"
    fallback: ["openrouter:or-sonnet"]

# ============================================================================
# AGENT-SPECIFIC OVERRIDES
# ============================================================================

agent_overrides:
  # Orchestrator always uses premium for routing decisions
  "sdlc-orchestrator":
    provider: "anthropic"
    model: "opus"
    rationale: "Orchestration decisions affect entire workflow"

  # Discover agents can use local (code analysis)
  "architecture-analyzer":
    provider: "ollama"
    model: "qwen-coder"

  "feature-mapper":
    provider: "ollama"
    model: "qwen-coder"

# ============================================================================
# OPERATIONAL MODES
# ============================================================================

modes:
  # Budget mode - minimize costs
  budget:
    description: "Minimize API costs, use local where possible"
    default_provider: "ollama"
    cloud_phases_only:
      - "02-architecture"
      - "13-security-review"

  # Quality mode - best models everywhere
  quality:
    description: "Use best available models for all phases"
    default_provider: "anthropic"
    default_model: "opus"

  # Local-only mode - no cloud calls
  local:
    description: "All processing stays on local machine"
    default_provider: "ollama"
    allow_cloud: false
    warning: "Some phases may have reduced quality"

  # Hybrid mode - smart routing (default)
  hybrid:
    description: "Route based on phase complexity"
    use_phase_routing: true

# Active mode
active_mode: "hybrid"

# ============================================================================
# CONSTRAINTS & LIMITS
# ============================================================================

constraints:
  # Context window minimum for iSDLC operations
  min_context_window: 16384
  recommended_context_window: 32768

  # Maximum retries before fallback
  max_retries_per_provider: 2

  # Timeout for provider health checks
  health_check_timeout_ms: 5000

  # Cost tracking
  track_usage: true
  usage_log_path: ".isdlc/usage-log.jsonl"

  # Budget alerts (if tracking enabled)
  daily_budget_alert_usd: 10.0
  monthly_budget_alert_usd: 100.0

# ============================================================================
# ENVIRONMENT VARIABLE MAPPINGS
# ============================================================================

environment:
  # These env vars are set before invoking the target agent
  anthropic:
    ANTHROPIC_API_KEY: "${api_key}"
    ANTHROPIC_BASE_URL: "${base_url}"

  ollama:
    ANTHROPIC_API_KEY: ""
    ANTHROPIC_AUTH_TOKEN: "ollama"
    ANTHROPIC_BASE_URL: "${base_url}"

  openrouter:
    ANTHROPIC_API_KEY: "${api_key}"
    ANTHROPIC_BASE_URL: "${base_url}"
    HTTP_REFERER: "https://github.com/isdlc-framework"
    X_TITLE: "iSDLC Framework"
```

### Environment Variable Precedence

```
1. Command-line override (--provider, --model)
2. Agent-specific override (agent_overrides in providers.yaml)
3. Phase routing rule (phase_routing in providers.yaml)
4. Active mode default (modes.{active_mode})
5. Global default (defaults.provider, defaults.model)
6. Fallback chain (defaults.fallback_chain)
```

---

## Phase Routing Strategy

### Complexity-Based Routing Matrix

| Phase | Complexity | Reasoning Required | Local Viable | Recommended |
|-------|------------|-------------------|--------------|-------------|
| 00-mapping | Low | Pattern matching | ✅ Yes | Ollama |
| 01-requirements | High | Stakeholder understanding | ⚠️ Degraded | Anthropic |
| 02-tracing | Low | Code traversal | ✅ Yes | Ollama |
| 02-architecture | Critical | System design | ❌ No | Anthropic Opus |
| 03-design | Medium | Consistency | ⚠️ Degraded | Anthropic |
| 04-test-strategy | Low | Template generation | ✅ Yes | Ollama |
| 05-implementation | High | Code quality | ⚠️ Degraded | Anthropic |
| 06-testing | Low | Execution | ✅ Yes | Ollama |
| 07-code-review | High | Intent understanding | ⚠️ Degraded | Anthropic |
| 08-documentation | Low | Template-based | ✅ Yes | Ollama |
| 09-cicd | Low | Config generation | ✅ Yes | Ollama |
| 10-local-testing | Low | Execution | ✅ Yes | Ollama |
| 11-cloud-infra | High | Cost/security | ⚠️ Degraded | Anthropic |
| 12-cloud-deployment | High | Production safety | ⚠️ Degraded | Anthropic |
| 13-security-review | Critical | Vulnerability detection | ❌ No | Anthropic Opus |
| 14-upgrade | Medium | Dependency analysis | ⚠️ Degraded | Anthropic |

### Visual Routing Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Phase Routing Decision Tree                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  START: Agent Invocation                                                     │
│     │                                                                        │
│     ▼                                                                        │
│  ┌──────────────────────────────────────┐                                   │
│  │ Check: --provider CLI flag set?      │                                   │
│  └──────────────────┬───────────────────┘                                   │
│           │                    │                                             │
│         Yes                   No                                             │
│           │                    │                                             │
│           ▼                    ▼                                             │
│  ┌────────────────┐   ┌──────────────────────────────────────┐              │
│  │ Use CLI        │   │ Check: agent_overrides[agent]?       │              │
│  │ specified      │   └──────────────────┬───────────────────┘              │
│  │ provider       │            │                    │                        │
│  └────────────────┘          Yes                   No                        │
│                                │                    │                        │
│                                ▼                    ▼                        │
│                       ┌────────────────┐   ┌──────────────────────────────┐ │
│                       │ Use agent      │   │ Check: phase_routing[phase]? │ │
│                       │ override       │   └──────────────────┬───────────┘ │
│                       └────────────────┘            │                    │   │
│                                                   Yes                   No   │
│                                                     │                    │   │
│                                                     ▼                    ▼   │
│                                            ┌────────────────┐   ┌──────────┐│
│                                            │ Use phase      │   │ Use mode ││
│                                            │ routing rule   │   │ default  ││
│                                            └────────────────┘   └──────────┘│
│                                                     │                    │   │
│                                                     └────────┬───────────┘   │
│                                                              │               │
│                                                              ▼               │
│                                              ┌──────────────────────────────┐│
│                                              │ Health Check: Provider alive?││
│                                              └──────────────────┬───────────┘│
│                                                       │                │     │
│                                                     Yes               No     │
│                                                       │                │     │
│                                                       ▼                ▼     │
│                                              ┌────────────┐   ┌────────────┐ │
│                                              │ USE        │   │ Try next   │ │
│                                              │ PROVIDER   │   │ in fallback│ │
│                                              └────────────┘   │ chain      │ │
│                                                               └────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### New Files to Create

```
src/claude/hooks/
├── model-provider-router.js       # PreToolUse hook for routing
├── provider-health-checker.js     # Health check utility
└── config/
    └── provider-defaults.yaml     # Default provider config template

src/isdlc/
├── providers.yaml.template        # Template for user configuration
└── usage-log.jsonl                # Usage tracking (gitignored)

src/claude/hooks/lib/
└── provider-utils.js              # Provider resolution utilities

src/claude/commands/
└── provider.md                    # /provider command for management
```

### Hook: model-provider-router.js

```javascript
#!/usr/bin/env node

/**
 * model-provider-router.js
 *
 * PreToolUse hook that intercepts Task tool calls and injects
 * the appropriate provider/model configuration based on:
 * 1. CLI overrides
 * 2. Agent-specific overrides
 * 3. Phase routing rules
 * 4. Mode defaults
 * 5. Fallback chains
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');
const http = require('http');
const https = require('https');

// Import common utilities
const {
  getProjectRoot,
  readState,
  writeState,
  readStdin,
  outputBlockResponse
} = require('./lib/common.js');

// ============================================================================
// CONFIGURATION LOADING
// ============================================================================

function loadProvidersConfig() {
  const projectRoot = getProjectRoot();
  const configPath = path.join(projectRoot, '.isdlc', 'providers.yaml');

  // Check for project-specific config
  if (fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, 'utf8');
    return yaml.parse(content);
  }

  // Fall back to framework defaults
  const defaultPath = path.join(__dirname, 'config', 'provider-defaults.yaml');
  if (fs.existsSync(defaultPath)) {
    const content = fs.readFileSync(defaultPath, 'utf8');
    return yaml.parse(content);
  }

  // Minimal fallback - Anthropic only
  return {
    providers: {
      anthropic: {
        enabled: true,
        base_url: 'https://api.anthropic.com',
        api_key_env: 'ANTHROPIC_API_KEY'
      }
    },
    defaults: {
      provider: 'anthropic',
      model: 'sonnet'
    },
    active_mode: 'quality'
  };
}

// ============================================================================
// PROVIDER SELECTION LOGIC
// ============================================================================

function selectProvider(config, state, toolInput) {
  const { subagent_type, prompt } = toolInput;
  const currentPhase = state?.current_phase || 'unknown';
  const activeMode = config.active_mode || 'hybrid';

  // 1. Check CLI override (passed via environment)
  const cliProvider = process.env.ISDLC_PROVIDER_OVERRIDE;
  const cliModel = process.env.ISDLC_MODEL_OVERRIDE;
  if (cliProvider) {
    return {
      provider: cliProvider,
      model: cliModel || getDefaultModel(config, cliProvider),
      source: 'cli_override'
    };
  }

  // 2. Check agent-specific override
  if (config.agent_overrides && config.agent_overrides[subagent_type]) {
    const override = config.agent_overrides[subagent_type];
    return {
      provider: override.provider,
      model: override.model,
      source: 'agent_override',
      rationale: override.rationale
    };
  }

  // 3. Check phase routing (if hybrid mode)
  if (activeMode === 'hybrid' && config.phase_routing && config.phase_routing[currentPhase]) {
    const routing = config.phase_routing[currentPhase];

    // Check if local_override is explicitly false
    if (routing.local_override === false && isLocalProvider(routing.provider)) {
      // Skip to cloud provider in fallback
      const fallback = routing.fallback?.find(f => !isLocalProvider(parseProviderModel(f).provider));
      if (fallback) {
        const { provider, model } = parseProviderModel(fallback);
        return {
          provider,
          model,
          source: 'phase_routing_cloud_required',
          rationale: routing.rationale
        };
      }
    }

    return {
      provider: routing.provider,
      model: routing.model,
      source: 'phase_routing',
      rationale: routing.rationale,
      fallback: routing.fallback
    };
  }

  // 4. Check mode-specific defaults
  if (config.modes && config.modes[activeMode]) {
    const mode = config.modes[activeMode];

    // Local mode - force local provider
    if (activeMode === 'local') {
      return {
        provider: 'ollama',
        model: mode.default_model || 'qwen-coder',
        source: 'mode_local',
        warning: mode.warning
      };
    }

    // Budget mode - check if phase requires cloud
    if (activeMode === 'budget') {
      const requiresCloud = mode.cloud_phases_only?.includes(currentPhase);
      if (!requiresCloud) {
        return {
          provider: 'ollama',
          model: 'qwen-coder',
          source: 'mode_budget'
        };
      }
    }

    // Quality mode - always use best
    if (activeMode === 'quality') {
      return {
        provider: mode.default_provider || 'anthropic',
        model: mode.default_model || 'opus',
        source: 'mode_quality'
      };
    }
  }

  // 5. Global defaults
  return {
    provider: config.defaults?.provider || 'anthropic',
    model: config.defaults?.model || 'sonnet',
    source: 'global_default',
    fallback: config.defaults?.fallback_chain
  };
}

// ============================================================================
// HEALTH CHECKING
// ============================================================================

async function checkProviderHealth(config, providerName) {
  const provider = config.providers?.[providerName];
  if (!provider || !provider.enabled) {
    return { healthy: false, reason: 'Provider not enabled' };
  }

  const healthCheck = provider.health_check;
  if (!healthCheck) {
    // No health check defined, assume healthy
    return { healthy: true, reason: 'No health check defined' };
  }

  const baseUrl = resolveEnvVars(provider.base_url);
  const timeout = healthCheck.timeout_ms || 5000;

  return new Promise((resolve) => {
    const url = new URL(healthCheck.endpoint, baseUrl);
    const protocol = url.protocol === 'https:' ? https : http;

    const req = protocol.get(url.href, { timeout }, (res) => {
      resolve({
        healthy: res.statusCode >= 200 && res.statusCode < 400,
        statusCode: res.statusCode
      });
    });

    req.on('error', (err) => {
      resolve({ healthy: false, reason: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ healthy: false, reason: 'Timeout' });
    });
  });
}

async function selectWithFallback(config, selection) {
  const maxRetries = config.constraints?.max_retries_per_provider || 2;

  // Try primary provider
  const health = await checkProviderHealth(config, selection.provider);
  if (health.healthy) {
    return selection;
  }

  console.error(`[provider-router] Primary provider ${selection.provider} unhealthy: ${health.reason}`);

  // Try fallback chain
  const fallbackChain = selection.fallback || config.defaults?.fallback_chain || [];

  for (const fallback of fallbackChain) {
    const { provider, model } = parseProviderModel(fallback);
    const fallbackHealth = await checkProviderHealth(config, provider);

    if (fallbackHealth.healthy) {
      console.error(`[provider-router] Falling back to ${provider}:${model}`);
      return {
        ...selection,
        provider,
        model,
        source: `fallback_from_${selection.provider}`,
        originalProvider: selection.provider
      };
    }
  }

  // All fallbacks failed
  return {
    ...selection,
    healthy: false,
    error: 'All providers unhealthy'
  };
}

// ============================================================================
// ENVIRONMENT INJECTION
// ============================================================================

function getEnvironmentOverrides(config, selection) {
  const provider = config.providers?.[selection.provider];
  if (!provider) {
    return {};
  }

  const envMapping = config.environment?.[selection.provider] || {};
  const overrides = {};

  // Resolve environment variables
  for (const [key, template] of Object.entries(envMapping)) {
    if (template === '${api_key}') {
      overrides[key] = provider.api_key || process.env[provider.api_key_env] || '';
    } else if (template === '${base_url}') {
      overrides[key] = resolveEnvVars(provider.base_url);
    } else {
      overrides[key] = resolveEnvVars(template);
    }
  }

  // Add model override
  const modelId = resolveModelId(config, selection.provider, selection.model);
  if (modelId) {
    overrides['CLAUDE_MODEL'] = modelId;
  }

  return overrides;
}

// ============================================================================
// USAGE TRACKING
// ============================================================================

function trackUsage(config, state, selection) {
  if (!config.constraints?.track_usage) {
    return;
  }

  const projectRoot = getProjectRoot();
  const logPath = path.join(projectRoot, config.constraints.usage_log_path || '.isdlc/usage-log.jsonl');

  const entry = {
    timestamp: new Date().toISOString(),
    provider: selection.provider,
    model: selection.model,
    phase: state?.current_phase,
    source: selection.source,
    rationale: selection.rationale
  };

  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, JSON.stringify(entry) + '\n');
  } catch (err) {
    console.error(`[provider-router] Failed to log usage: ${err.message}`);
  }

  // Update state with provider selection
  if (state) {
    state.last_provider_selection = {
      provider: selection.provider,
      model: selection.model,
      timestamp: entry.timestamp
    };
    writeState(state);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function parseProviderModel(str) {
  // Parse "provider:model" or just "provider"
  if (typeof str === 'object') {
    return { provider: str.provider, model: str.model };
  }
  const parts = str.split(':');
  return {
    provider: parts[0],
    model: parts[1] || null
  };
}

function isLocalProvider(providerName) {
  return providerName === 'ollama' || providerName === 'custom';
}

function resolveEnvVars(str) {
  if (!str) return str;
  return str.replace(/\$\{([^}]+)\}/g, (_, name) => process.env[name] || '');
}

function resolveModelId(config, providerName, modelAlias) {
  const provider = config.providers?.[providerName];
  if (!provider?.models) return modelAlias;

  const model = provider.models.find(m => m.alias === modelAlias || m.id === modelAlias);
  return model?.id || modelAlias;
}

function getDefaultModel(config, providerName) {
  const provider = config.providers?.[providerName];
  if (!provider?.models?.length) return null;
  return provider.models[0].alias || provider.models[0].id;
}

// ============================================================================
// MAIN HOOK LOGIC
// ============================================================================

async function main() {
  try {
    const input = await readStdin();
    const { tool_name, tool_input } = JSON.parse(input);

    // Only intercept Task tool calls
    if (tool_name !== 'Task') {
      process.exit(0);
      return;
    }

    // Load configuration
    const config = loadProvidersConfig();
    const state = readState();

    // Select provider
    let selection = selectProvider(config, state, tool_input);

    // Health check and fallback
    selection = await selectWithFallback(config, selection);

    if (!selection.healthy && selection.error) {
      outputBlockResponse(`All LLM providers are unavailable: ${selection.error}`);
      process.exit(0);
      return;
    }

    // Get environment overrides
    const envOverrides = getEnvironmentOverrides(config, selection);

    // Track usage
    trackUsage(config, state, selection);

    // Log selection (for debugging)
    if (process.env.ISDLC_PROVIDER_DEBUG) {
      console.error(`[provider-router] Selected: ${selection.provider}:${selection.model} (${selection.source})`);
      console.error(`[provider-router] Env overrides:`, envOverrides);
    }

    // Output environment overrides for the Task tool
    // These will be applied by Claude Code before spawning the subagent
    console.log(JSON.stringify({
      continue: true,
      environment_overrides: envOverrides,
      provider_selection: {
        provider: selection.provider,
        model: selection.model,
        source: selection.source
      }
    }));

    process.exit(0);
  } catch (err) {
    console.error(`[provider-router] Error: ${err.message}`);
    // Don't block on errors - let the default behavior proceed
    process.exit(0);
  }
}

main();
```

### CLI Integration: /provider Command

Create `src/claude/commands/provider.md`:

```markdown
---
name: provider
description: Manage LLM provider configuration for iSDLC
user_invocable: true
---

# /provider - LLM Provider Management

Manage which LLM providers are used for different SDLC phases.

## Usage

```bash
/provider                    # Show current provider configuration
/provider status             # Show provider health status
/provider set <mode>         # Set operational mode (budget|quality|local|hybrid)
/provider test               # Test all configured providers
/provider usage              # Show usage statistics
/provider init               # Initialize providers.yaml from template
```

## Modes

| Mode | Description |
|------|-------------|
| `budget` | Minimize costs, use Ollama where possible |
| `quality` | Use best models (Anthropic Opus) everywhere |
| `local` | All processing on local machine (Ollama only) |
| `hybrid` | Smart routing based on phase complexity (default) |

## Examples

### Check Provider Status

```bash
/provider status
```

Output:
```
Provider Status
===============
✅ anthropic    https://api.anthropic.com     Healthy (245ms)
✅ ollama       http://localhost:11434        Healthy (12ms)
❌ openrouter   https://openrouter.ai         No API key configured

Active Mode: hybrid
Current Phase: 05-implementation → anthropic:sonnet
```

### Switch to Budget Mode

```bash
/provider set budget
```

Output:
```
Mode changed: hybrid → budget

Phase routing updated:
  00-mapping      ollama:qwen-coder (unchanged)
  01-requirements ollama:qwen-coder (was: anthropic:sonnet)
  02-architecture anthropic:opus (cloud required)
  ...
```

### Initialize Configuration

```bash
/provider init
```

Creates `.isdlc/providers.yaml` from template with guided setup.

## Configuration

Provider configuration is stored in `.isdlc/providers.yaml`. See the design document for full schema.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `ISDLC_PROVIDER_OVERRIDE` | Force specific provider |
| `ISDLC_MODEL_OVERRIDE` | Force specific model |
| `ISDLC_PROVIDER_DEBUG` | Enable debug logging |

## Ollama Setup

To use Ollama for local inference:

1. Install Ollama: https://ollama.com/download
2. Pull a coding model: `ollama pull qwen3-coder`
3. Ensure Ollama is running: `ollama serve`
4. Run `/provider init` to configure

Recommended models for coding:
- `qwen3-coder` (30B, needs 24GB VRAM)
- `deepseek-coder-v2:16b` (16B, needs 16GB VRAM)
- `codellama:34b` (34B, needs 24GB VRAM)
```

---

## Agent Metadata Evolution

### Current Format

```yaml
---
name: software-developer
model: opus
owned_skills:
  - DEV-001
  - DEV-002
---
```

### New Format (Backward Compatible)

```yaml
---
name: software-developer
model:
  # Simple format still works (backward compatible)
  # model: opus

  # Extended format for multi-provider
  default: sonnet
  preferred_provider: anthropic

  # Capability requirements (for provider selection)
  requires:
    - coding
    - tool_use
  min_context_window: 32768

  # Override for specific scenarios
  overrides:
    complex_refactoring:
      provider: anthropic
      model: opus
    simple_fixes:
      provider: ollama
      model: qwen-coder

owned_skills:
  - DEV-001
  - DEV-002
---
```

### Migration Path

1. **Phase 1**: Add hook that reads existing `model: opus` format
2. **Phase 2**: Gradually update agents to extended format
3. **Phase 3**: Hook supports both formats indefinitely

---

## Fallback & Reliability

### Fallback Chain Execution

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Fallback Chain Execution                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Primary: anthropic:sonnet                                                   │
│     │                                                                        │
│     ▼                                                                        │
│  ┌──────────────────┐                                                        │
│  │ Health Check     │──── Healthy ────► USE anthropic:sonnet                │
│  └────────┬─────────┘                                                        │
│           │                                                                  │
│         Unhealthy                                                            │
│           │                                                                  │
│           ▼                                                                  │
│  Fallback 1: openrouter:or-sonnet                                           │
│     │                                                                        │
│     ▼                                                                        │
│  ┌──────────────────┐                                                        │
│  │ Health Check     │──── Healthy ────► USE openrouter:or-sonnet            │
│  └────────┬─────────┘                                                        │
│           │                                                                  │
│         Unhealthy                                                            │
│           │                                                                  │
│           ▼                                                                  │
│  Fallback 2: ollama:qwen-coder                                              │
│     │                                                                        │
│     ▼                                                                        │
│  ┌──────────────────┐                                                        │
│  │ Health Check     │──── Healthy ────► USE ollama:qwen-coder               │
│  └────────┬─────────┘                   (with quality warning)              │
│           │                                                                  │
│         Unhealthy                                                            │
│           │                                                                  │
│           ▼                                                                  │
│  ┌──────────────────┐                                                        │
│  │ BLOCK OPERATION  │                                                        │
│  │ "All providers   │                                                        │
│  │  unavailable"    │                                                        │
│  └──────────────────┘                                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Quality Degradation Warnings

When falling back to a lower-capability provider, the system warns:

```
⚠️  Provider Fallback Active
    Primary (anthropic:sonnet) unavailable
    Using fallback (ollama:qwen-coder)

    Quality implications for phase 05-implementation:
    - Reduced reasoning capability
    - Smaller context window (32K vs 200K)
    - May require more iterations

    Consider: /provider status to check provider health
```

---

## Cost & Usage Tracking

### Usage Log Format (.isdlc/usage-log.jsonl)

```jsonl
{"timestamp":"2026-02-04T10:15:00Z","provider":"anthropic","model":"sonnet","phase":"01-requirements","source":"phase_routing","tokens_in":1500,"tokens_out":800}
{"timestamp":"2026-02-04T10:18:00Z","provider":"ollama","model":"qwen-coder","phase":"04-test-strategy","source":"phase_routing","tokens_in":2000,"tokens_out":1200}
{"timestamp":"2026-02-04T10:25:00Z","provider":"anthropic","model":"opus","phase":"02-architecture","source":"phase_routing","tokens_in":5000,"tokens_out":3000}
```

### Usage Summary Command

```bash
/provider usage

Provider Usage Summary (Last 7 Days)
====================================

By Provider:
  anthropic    45 calls    ~$12.50    (65% of spend)
  ollama       120 calls   $0.00      (local)
  openrouter   5 calls     ~$0.80     (fallback)

By Phase:
  05-implementation   anthropic:sonnet   30 calls
  06-testing          ollama:qwen-coder  50 calls
  02-architecture     anthropic:opus     8 calls
  ...

Cost Trend:
  This week: ~$13.30
  Last week: ~$18.50  (-28%)

Budget Status:
  Daily: $2.19 / $10.00 (22%)
  Monthly: $42.50 / $100.00 (43%)
```

---

## Migration Guide

### For Existing Projects

1. **No Action Required**: Existing projects continue working with Anthropic
2. **Optional Enhancement**: Run `/provider init` to enable multi-provider

### Step-by-Step Migration

```bash
# 1. Update framework
git pull origin main

# 2. Initialize provider config
/provider init

# 3. (Optional) Install Ollama for local inference
# macOS: brew install ollama
# Linux: curl -fsSL https://ollama.com/install.sh | sh

# 4. Pull a coding model
ollama pull qwen3-coder

# 5. Test providers
/provider test

# 6. Set preferred mode
/provider set hybrid  # or budget, quality, local
```

### Configuration Examples

#### Budget-Conscious Team

```yaml
active_mode: budget

modes:
  budget:
    description: "Use local Ollama except for critical phases"
    default_provider: ollama
    cloud_phases_only:
      - "02-architecture"
      - "13-security-review"
```

#### Air-Gapped Environment

```yaml
active_mode: local

modes:
  local:
    description: "No external network calls"
    default_provider: ollama
    allow_cloud: false
```

#### Enterprise with Custom Endpoint

```yaml
providers:
  custom:
    enabled: true
    base_url: "https://llm.internal.company.com"
    api_key_env: "INTERNAL_LLM_KEY"
    models:
      - id: "company-coder-v2"
        alias: "internal"
        context_window: 65536

defaults:
  provider: custom
  model: internal
```

---

## Directory Structure

### New Files

```
src/claude/hooks/
├── model-provider-router.js          # NEW: PreToolUse routing hook
├── provider-health-checker.js        # NEW: Health check utility
├── lib/
│   ├── common.js                     # EXISTING
│   └── provider-utils.js             # NEW: Provider utilities
└── config/
    ├── skills-manifest.json          # EXISTING
    ├── iteration-requirements.json   # EXISTING
    └── provider-defaults.yaml        # NEW: Default provider config

src/claude/commands/
├── sdlc.md                           # EXISTING
├── discover.md                       # EXISTING
└── provider.md                       # NEW: /provider command

src/isdlc/
├── templates/
│   └── providers.yaml.template       # NEW: User config template
└── config/
    └── workflows.json                # EXISTING (no changes needed)

.isdlc/                               # Project-specific (gitignored)
├── state.json                        # EXISTING
├── providers.yaml                    # NEW: User provider config
└── usage-log.jsonl                   # NEW: Usage tracking
```

### Hook Registration

Update `src/claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Task",
        "hooks": [
          "node src/claude/hooks/model-provider-router.js",
          "node src/claude/hooks/iteration-corridor.js",
          "node src/claude/hooks/skill-validator.js",
          "node src/claude/hooks/gate-blocker.js",
          "node src/claude/hooks/constitution-validator.js"
        ]
      }
    ]
  }
}
```

**Note**: `model-provider-router.js` runs FIRST so it can inject environment overrides before other hooks process.

---

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1)

| Task | Priority | Effort |
|------|----------|--------|
| Create `model-provider-router.js` hook | P0 | 4h |
| Create `provider-utils.js` library | P0 | 2h |
| Create `provider-defaults.yaml` | P0 | 1h |
| Create `providers.yaml.template` | P0 | 1h |
| Update `settings.json` hook registration | P0 | 0.5h |
| Basic health check implementation | P0 | 2h |

### Phase 2: CLI & Commands (Week 2)

| Task | Priority | Effort |
|------|----------|--------|
| Create `/provider` command | P1 | 3h |
| Implement `provider status` | P1 | 2h |
| Implement `provider set` | P1 | 1h |
| Implement `provider test` | P1 | 2h |
| Implement `provider init` | P1 | 2h |

### Phase 3: Usage Tracking (Week 2)

| Task | Priority | Effort |
|------|----------|--------|
| Implement usage logging | P1 | 2h |
| Implement `provider usage` command | P2 | 2h |
| Budget alert system | P2 | 2h |

### Phase 4: Documentation & Testing (Week 3)

| Task | Priority | Effort |
|------|----------|--------|
| Update framework documentation | P1 | 3h |
| Create Ollama setup guide | P1 | 2h |
| Integration tests | P1 | 4h |
| Update README with provider info | P2 | 1h |

### Phase 5: Agent Metadata Evolution (Week 4)

| Task | Priority | Effort |
|------|----------|--------|
| Design extended agent metadata schema | P2 | 2h |
| Update hook to support extended format | P2 | 2h |
| Migrate key agents to extended format | P3 | 4h |

---

## Summary

This design adds a **Provider Abstraction Layer** to iSDLC that:

1. **Enables multiple LLM providers** (Anthropic, Ollama, OpenRouter, custom)
2. **Routes intelligently by phase** (complex phases → cloud, simple → local)
3. **Provides operational modes** (budget, quality, local, hybrid)
4. **Handles failures gracefully** with fallback chains
5. **Tracks usage and costs** for budget management
6. **Requires zero changes** to existing workflows

The implementation adds 4 new files and modifies 1 existing file, with all changes backward-compatible with existing projects.

---

## Appendix A: Provider Capability Matrix

| Provider | Models | Context | Tool Use | Vision | Cost | Latency |
|----------|--------|---------|----------|--------|------|---------|
| Anthropic | Opus, Sonnet | 200K | ✅ | ✅ | $$$$ | Low |
| Ollama (qwen3-coder) | qwen3-coder | 32K | ✅ | ❌ | Free | Varies |
| Ollama (deepseek) | deepseek-coder | 64K | ✅ | ❌ | Free | Varies |
| OpenRouter | Many | Varies | ✅ | Varies | $-$$$$ | Medium |
| Custom | User-defined | Varies | Varies | Varies | Varies | Varies |

## Appendix B: Ollama Hardware Requirements

| Model | Parameters | Min VRAM | Recommended VRAM | Speed |
|-------|------------|----------|------------------|-------|
| codellama:7b | 7B | 8GB | 12GB | Fast |
| deepseek-coder-v2:16b | 16B | 16GB | 24GB | Medium |
| qwen3-coder | 30B | 24GB | 32GB | Slower |
| codellama:34b | 34B | 24GB | 40GB | Slow |

## Appendix C: Environment Variable Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `ANTHROPIC_API_KEY` | Anthropic API key | For Anthropic |
| `ANTHROPIC_BASE_URL` | API endpoint override | Auto-set by hook |
| `ANTHROPIC_AUTH_TOKEN` | Auth token (for Ollama) | Auto-set by hook |
| `OPENROUTER_API_KEY` | OpenRouter API key | For OpenRouter |
| `ISDLC_PROVIDER_OVERRIDE` | Force provider selection | Optional |
| `ISDLC_MODEL_OVERRIDE` | Force model selection | Optional |
| `ISDLC_PROVIDER_DEBUG` | Enable debug logging | Optional |
