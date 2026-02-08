---
name: provider
description: Manage LLM provider configuration for iSDLC multi-provider support (currently disabled — framework is Claude Code-specific)
user_invocable: false
---

<!-- NOTE: This command is disabled. The framework is currently Claude Code-specific.
     Multi-provider support may be re-enabled in a future release.
     Set user_invocable back to true when ready. -->

# /provider - LLM Provider Management

Manage which LLM providers (Anthropic, Ollama, OpenRouter, etc.) are used for different SDLC phases.

## Usage

```
/provider                    Show current configuration and status
/provider status             Show provider health status
/provider set <mode>         Set operational mode
/provider test               Test all configured providers
/provider usage [days]       Show usage statistics
/provider init               Initialize providers.yaml
/provider setup-ollama       Install and configure Ollama for local inference
```

## Commands

### /provider (no args)
Shows current provider configuration summary including active mode, default provider, and phase routing overview.

### /provider status
Checks health of all configured providers and displays:
- Connection status (healthy/unhealthy)
- Response latency
- API key configuration status
- Current phase and which provider would be used

### /provider set <mode>
Changes the active operational mode. Available modes:

| Mode | Description | Requirements |
|------|-------------|--------------|
| `free` | Use free-tier cloud providers (Groq, Together, Google) | Free API key only |
| `budget` | Ollama if available, otherwise free cloud | Ollama optional |
| `quality` | Best results - use Anthropic for all phases | Anthropic API key |
| `local` | Privacy/offline - Ollama only, no cloud calls | Ollama + GPU (12GB+ VRAM) |
| `hybrid` | Smart routing based on phase complexity | Any configured provider |

Example: `/provider set free`

### /provider test
Tests connectivity to all enabled providers by making health check requests. Reports latency and any connection issues.

### /provider usage [days]
Shows usage statistics from the usage log:
- Calls per provider
- Calls per phase
- Fallback frequency
- Estimated costs (if available)

Default: Last 7 days. Specify days for different range.

### /provider init
Creates `.isdlc/providers.yaml` from the template with guided setup:
1. Detects available providers (checks for API keys, Ollama)
2. Asks which providers to enable
3. Suggests optimal mode based on setup
4. Creates customized configuration

### /provider setup-ollama
Installs and configures Ollama for local LLM inference:
1. Detects your system (macOS/Linux) and GPU
2. Installs Ollama if not present
3. Recommends the best model for your hardware
4. Downloads and tests the model
5. Configures iSDLC to use Ollama

Options:
- `--model MODEL` - Specify a model (e.g., `qwen2.5-coder:14b`)
- `--check-only` - Just check if Ollama is working
- `--skip-model` - Install Ollama but don't download a model

Example: `/provider setup-ollama --model qwen2.5-coder:14b`

## Quick Start

### Option 1: Free Cloud Providers (No GPU Required!)

Best for users without a powerful GPU or Anthropic API key.

```bash
# 1. Get a FREE API key from one of these providers:
#    - Groq: https://console.groq.com/ (1,000 req/day)
#    - Together AI: https://api.together.xyz/ ($1 free credit)
#    - Google AI Studio: https://aistudio.google.com/ (60 req/min)

# 2. Set environment variable (example for Groq)
export GROQ_API_KEY=your-free-api-key

# 3. Initialize provider config
/provider init

# 4. Set free mode
/provider set free
```

### Option 2: Using Anthropic Only (Default)
No configuration needed. Ensure `ANTHROPIC_API_KEY` is set.

### Option 3: Local Inference with Ollama (Automatic Setup)

For users who want free local inference. The setup script handles everything!

```bash
# Automatic installation and configuration
/provider setup-ollama
```

The script will:
- Detect your OS (macOS/Linux) and GPU/VRAM
- Install Ollama automatically
- Recommend the best model for your hardware
- Download and test the model
- Configure iSDLC to use it

**Manual setup** (if you prefer):

```bash
# 1. Install Ollama
# macOS: brew install ollama
# Linux: curl -fsSL https://ollama.com/install.sh | sh

# 2. Pull a coding model (choose based on your VRAM)
ollama pull qwen2.5-coder:14b    # 12GB VRAM
ollama pull qwen3-coder          # 24GB VRAM

# 3. Start Ollama server
ollama serve

# 4. Initialize iSDLC provider config
/provider init

# 5. Set budget mode (uses Ollama, falls back to free cloud)
/provider set budget
```

### Option 4: Air-Gapped / Offline Environment
```bash
# Requires Ollama with models pre-installed
/provider init
/provider set local
```

## Configuration File

Provider settings are stored in `.isdlc/providers.yaml`. Key sections:

```yaml
# Enable/disable providers
providers:
  anthropic:
    enabled: true
  ollama:
    enabled: true

# Choose operational mode
active_mode: "hybrid"

# Customize phase routing (optional)
phase_routing:
  "02-architecture":
    provider: "anthropic"
    model: "opus"
```

See `src/isdlc/templates/providers.yaml.template` for full options.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key (required for Anthropic provider) |
| `OPENROUTER_API_KEY` | OpenRouter API key (if using OpenRouter) |
| `ISDLC_PROVIDER_OVERRIDE` | Force specific provider for all phases |
| `ISDLC_MODEL_OVERRIDE` | Force specific model for all phases |
| `ISDLC_PROVIDER_DEBUG` | Set to `true` for debug logging |

## Phase Routing (Hybrid Mode)

In hybrid mode, different phases use different providers based on complexity:

| Phase | Default Provider | Rationale |
|-------|-----------------|-----------|
| 00-mapping | Ollama | Pattern-based code search |
| 02-tracing | Ollama | Execution path tracing |
| 01-requirements | Anthropic | Stakeholder reasoning |
| 02-architecture | Anthropic Opus | High-stakes decisions |
| 03-design | Anthropic | Consistency with architecture |
| 04-test-strategy | Ollama | Template generation |
| 05-implementation | Anthropic | Code quality critical |
| 06-testing | Ollama | Mechanical execution |
| 07-code-review | Anthropic | Understanding intent |
| 08-documentation | Ollama | Template-based |
| 09-cicd | Ollama | Config generation |
| 13-security-review | Anthropic Opus | Never local |

## Troubleshooting

### Ollama not connecting
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama if not running
ollama serve
```

### API key issues
```bash
# Verify key is set
echo $ANTHROPIC_API_KEY

# Test directly
curl -H "x-api-key: $ANTHROPIC_API_KEY" https://api.anthropic.com/v1/messages
```

### Force specific provider
```bash
# Override for current session
export ISDLC_PROVIDER_OVERRIDE=anthropic
export ISDLC_MODEL_OVERRIDE=sonnet
```

### Debug provider selection
```bash
export ISDLC_PROVIDER_DEBUG=true
# Run your command - you'll see provider routing decisions
```

## Examples

### Check what provider current phase would use
```
/provider status
```
Output:
```
Provider Status
===============
[OK] anthropic   https://api.anthropic.com     Healthy (245ms)
[OK] ollama      http://localhost:11434        Healthy (12ms)
[--] openrouter  https://openrouter.ai         Disabled

Active Mode: hybrid
Current Phase: 05-implementation
Selected Provider: anthropic:sonnet (phase_routing)
```

### Switch to budget mode for prototyping
```
/provider set budget
```
Output:
```
Mode changed: hybrid -> budget

Provider routing updated:
  Most phases now use: ollama:qwen-coder
  Cloud-only phases: 02-architecture, 13-security-review
```

### View recent usage
```
/provider usage 30
```
Output:
```
Provider Usage (Last 30 Days)
=============================
Total Calls: 156

By Provider:
  anthropic    45 calls  (29%)
  ollama      108 calls  (69%)
  openrouter    3 calls  (2% - fallback)

By Phase:
  05-implementation   42 calls
  06-testing          38 calls
  00-mapping          28 calls
  ...

Fallback Events: 3 (1.9%)
```

---

## Implementation

When `/provider` is invoked, perform the following based on arguments:

### No Arguments (Show Config)
1. Load `.isdlc/providers.yaml` (or show "not configured" message)
2. Display active mode
3. Display enabled providers
4. Display current phase routing summary
5. Suggest `/provider init` if not configured

### status
1. Load provider configuration
2. For each enabled provider, call health check endpoint
3. Measure latency
4. Check if required API keys are set
5. Show table with status
6. Read state.json for current phase
7. Show which provider would be selected for current phase

### set <mode>
1. Validate mode is one of: budget, quality, local, hybrid
2. Update `active_mode` in `.isdlc/providers.yaml`
3. Display confirmation with routing summary

### test
1. For each provider (enabled or not):
   - Attempt health check
   - Report success/failure and latency
2. Summarize results

### usage [days]
1. Read `.isdlc/usage-log.jsonl`
2. Filter to requested time range
3. Aggregate by provider, phase, source
4. Count fallback events
5. Display summary

### init
1. Check if `.isdlc/providers.yaml` already exists
   - If yes, ask to overwrite or exit
2. Detect available providers:
   - Check ANTHROPIC_API_KEY
   - Check OPENROUTER_API_KEY
   - Check GROQ_API_KEY, TOGETHER_API_KEY, GOOGLE_AI_API_KEY
   - Ping localhost:11434 for Ollama
3. Ask user which providers to enable
4. Ask preferred mode (suggest based on detected providers)
5. Copy template to `.isdlc/providers.yaml`
6. Modify based on user choices
7. Display summary and next steps

### setup-ollama
1. Execute the setup script: `.isdlc/scripts/setup-ollama.sh`
2. The script will:
   - Detect OS (macOS/Linux) and architecture
   - Detect GPU and available VRAM
   - Install Ollama if not present
   - Recommend appropriate model based on hardware
   - Download and test the model
   - Configure `.isdlc/providers.yaml` for Ollama
3. Report success/failure and next steps

---

## Ollama Setup Guide

### System Requirements

| VRAM | Recommended Model | Performance |
|------|-------------------|-------------|
| 8GB | qwen2.5-coder:7b | Basic coding tasks |
| 12GB | qwen2.5-coder:14b | Good for most tasks |
| 16GB | deepseek-coder-v2:16b | Excellent code quality |
| 24GB+ | qwen3-coder | Best local performance |

**Apple Silicon Macs**: Use unified memory. M1/M2/M3 with 16GB+ RAM work well.

### Automatic Setup

```bash
/provider setup-ollama
```

This command:
1. Detects your hardware (OS, GPU, VRAM)
2. Installs Ollama (via Homebrew on macOS, official installer on Linux)
3. Recommends the best model for your system
4. Downloads the model (with confirmation)
5. Tests the model is working
6. Configures iSDLC to use it

### Manual Installation

**macOS:**
```bash
# Via Homebrew (recommended)
brew install ollama

# Or direct download
curl -fsSL https://ollama.com/install.sh | sh
```

**Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Windows:**
Download from https://ollama.com/download/windows

### Recommended Models for Coding

| Model | Size | VRAM | Strengths |
|-------|------|------|-----------|
| `qwen2.5-coder:7b` | 4GB | 8GB | Fast, lightweight |
| `qwen2.5-coder:14b` | 8GB | 12GB | Best balance |
| `deepseek-coder-v2:16b` | 9GB | 16GB | Strong reasoning |
| `qwen3-coder` | 18GB | 24GB | Highest quality |

### Pull Models

```bash
# Start Ollama server
ollama serve

# Pull a model (in another terminal)
ollama pull qwen2.5-coder:14b

# List installed models
ollama list

# Test a model
ollama run qwen2.5-coder:14b "Write a hello world in Python"
```

### Verify Setup

```bash
# Check Ollama is running
curl http://localhost:11434/api/tags

# Or use the provider command
/provider setup-ollama --check-only
```
