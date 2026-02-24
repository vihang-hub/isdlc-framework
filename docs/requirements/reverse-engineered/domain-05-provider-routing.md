# Domain 05: Multi-Provider LLM Routing

**Source Files**: `src/claude/hooks/model-provider-router.js`, `src/claude/hooks/lib/provider-utils.js`
**AC Count**: 9
**Priority**: 3 Critical, 4 High, 2 Medium

---

## AC-PR-001: Task-Only Provider Interception [CRITICAL]

**Given** any tool call is made
**When** model-provider-router intercepts it
**Then** it only processes Task tool calls (agent invocations)
**And** passes through all non-Task tools without interference
**And** if no providers.yaml exists, falls back to default Anthropic behavior

**Source**: `src/claude/hooks/model-provider-router.js:47-59`

---

## AC-PR-002: Five-Level Provider Selection [CRITICAL]

**Given** a Task tool call needs provider routing
**When** selectProvider() evaluates the context
**Then** it resolves the provider using 5 priority levels:
  1. CLI overrides (ISDLC_PROVIDER_OVERRIDE, ISDLC_MODEL_OVERRIDE env vars)
  2. Agent-specific overrides (agent_overrides in providers.yaml)
  3. Phase routing rules (phase_routing in providers.yaml)
  4. Mode defaults (modes.{active_mode} in providers.yaml)
  5. Global defaults (defaults.provider, defaults.model)

**Source**: `src/claude/hooks/model-provider-router.js:76-77`, `provider-utils.js`

---

## AC-PR-003: Health Check and Fallback [CRITICAL]

**Given** a provider is selected
**When** selectWithFallback() health-checks it
**Then** it attempts to reach the provider endpoint
**And** if unhealthy, tries the fallback chain defined in providers.yaml
**And** tracks the original provider and reason for fallback
**And** if all providers fail, returns error with troubleshooting steps

**Source**: `src/claude/hooks/model-provider-router.js:79-98`

---

## AC-PR-004: Provider Failure Blocking [HIGH]

**Given** no healthy provider can be found
**When** all fallback attempts fail
**Then** model-provider-router blocks the Task call
**And** outputs detailed troubleshooting: check internet, verify API keys, check Ollama, run /provider status

**Source**: `src/claude/hooks/model-provider-router.js:83-98`

---

## AC-PR-005: Environment Override Injection [HIGH]

**Given** a provider is selected
**When** the hook completes
**Then** it outputs JSON with:
  - continue: true
  - environment_overrides: provider-specific env vars
  - provider_selection: { provider, model, source, phase }
**And** the environment_overrides are applied before spawning the subagent

**Source**: `src/claude/hooks/model-provider-router.js:102-136`

---

## AC-PR-006: Fallback Warning Emission [HIGH]

**Given** the primary provider is unavailable
**When** a fallback provider is used
**Then** model-provider-router emits a stderr warning with:
  - Original provider name and unavailability reason
  - Active fallback provider and model
**And** logs a warning if local provider is used for a complex phase

**Source**: `src/claude/hooks/model-provider-router.js:112-123`

---

## AC-PR-007: Minimal YAML Parser [HIGH]

**Given** providers.yaml needs to be loaded
**When** parseYaml() processes the file
**Then** it handles: objects, arrays, strings, numbers, booleans
**And** correctly parses indentation-based nesting
**And** skips comments and empty lines
**And** does NOT handle: anchors, aliases, multi-line strings, complex types

**Source**: `src/claude/hooks/lib/provider-utils.js:29-100+`

---

## AC-PR-008: Usage Tracking [MEDIUM]

**Given** a provider selection is made
**When** trackUsage() is called
**Then** it records the provider, model, and source in state
**And** this enables reporting on provider usage patterns

**Source**: `src/claude/hooks/model-provider-router.js:105`

---

## AC-PR-009: Provider Router Fail-Open [MEDIUM]

**Given** model-provider-router encounters any error
**When** the error is caught
**Then** it logs the error to stderr
**And** exits with code 0 (fail-open)
**And** the Task call proceeds with default Claude Code behavior

**Source**: `src/claude/hooks/model-provider-router.js:140-149`
