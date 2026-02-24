# Interface Specification: REQ-0007 Deep Discovery

**Feature**: Unify /discover under --deep flag with debate rounds
**Designer**: System Designer (Phase 04)
**Date**: 2026-02-10
**Status**: Draft

---

## 1. CLI Interface Changes (discover.md)

### 1.1 Options Table (Replacement)

| Option | Description |
|--------|-------------|
| `--new` | Force new project flow (skip detection) |
| `--existing` | Force existing project flow (skip detection) |
| `--deep [standard\|full]` | Set discovery depth level. Default: standard. Standard = 6-8 agents + 3 debate rounds. Full = 8-10 agents + 5 debate rounds + cross-review. |
| `--verbose` | Show full debate transcripts during execution (default: synthesis-only) |
| `--project {id}` | Target a specific project in monorepo mode |
| `--skip-tests` | Skip test infrastructure evaluation |
| `--skip-skills` | Skip skills.sh integration |
| `--atdd-ready` | Prepare AC for ATDD workflow integration |
| `--help` | Show this help message |

### 1.2 Removed Options

| Option | Error Message |
|--------|---------------|
| `--party` | `"Error: The --party flag has been replaced by --deep. Use /discover --deep [standard\|full]"` |
| `--classic` | `"Error: The --classic flag has been removed. /discover now uses deep discovery by default."` |

### 1.3 Examples (Replacement)

```bash
# Run discovery (presents interactive menu)
/discover

# Force new project setup with deep discovery
/discover --new

# Analyze existing project (standard depth, default)
/discover --existing

# Full-depth analysis with all 10 agents + 5 debate rounds
/discover --deep full

# Standard depth with full transcript output
/discover --deep standard --verbose

# Analyze existing project, skip test evaluation
/discover --existing --skip-tests

# Discover a specific project in a monorepo
/discover --project api-service

# Prepare for ATDD workflow
/discover --atdd-ready
```

### 1.4 Flag Resolution Algorithm

```
FUNCTION resolveFlags(args):
  IF args contains "--party":
    DISPLAY ERROR: "The --party flag has been replaced by --deep. Use /discover --deep [standard|full]"
    STOP

  IF args contains "--classic":
    DISPLAY ERROR: "The --classic flag has been removed. /discover now uses deep discovery by default."
    STOP

  depth = "standard"  // default
  IF args contains "--deep":
    arg_after_deep = next_arg_after("--deep")
    IF arg_after_deep == "full":
      depth = "full"
    ELIF arg_after_deep == "standard":
      depth = "standard"
    ELIF arg_after_deep is another flag or absent:
      depth = "standard"  // --deep with no level = standard
    ELSE:
      DISPLAY ERROR: "Unknown depth level: {arg_after_deep}. Valid values: standard, full"
      STOP

  verbose = args contains "--verbose"

  RETURN { depth, verbose, ...other_flags }
```

---

## 2. Discover Orchestrator Interface Changes

### 2.1 Step 0 Mode Selection (REMOVED)

The entire `### Step 0: Mode Selection` section in the NEW PROJECT FLOW is deleted. When the flow enters the new project path, it proceeds directly to deep discovery (formerly party mode).

### 2.2 PARTY MODE FLOW Section Rename

| Before | After |
|--------|-------|
| `## PARTY MODE FLOW` | `## DEEP DISCOVERY FLOW (NEW PROJECTS)` |
| "party mode" (all references) | "deep discovery" |
| "Inception Party" | "Deep Discovery Session" |
| `team_name: "inception-party"` | `team_name: "deep-discovery"` |

### 2.3 Depth Level Handling in New Project Flow

Insert after the renamed section header:

```
### Depth Level Resolution

Read the `depth` value passed from discover.md.

IF depth == "standard":
  Execute Party Phases 1-3 only (Vision Council, Stack Debate, Blueprint Assembly)
  Skip Party Phases 4-5 (Constitution & Scaffold, Walkthrough are run by the
  orchestrator's own Steps 4-7, not as party phases)

IF depth == "full":
  Execute Party Phases 1-5 (all phases including Constitution Alignment
  and Artifact Completeness cross-review)
```

**Note**: Party Phases 4-5 in the party-personas.json (`Constitution & Scaffold`, `Walkthrough`) are sequential non-debate phases that the orchestrator already drives inline. They run regardless of depth level. The "full" 5 phases refer to the original party phases 1-3 plus 2 extra debate-focused rounds, not phases 4-5 from the config.

**Correction per requirements re-read**: For new projects, standard = 3 debate phases (Party Phases 1, 2, 3). Full = 5 debate phases. This means 2 additional phases need to be defined for the new project flow when depth is "full". These map to the same concepts as existing project rounds 4-5:
- New Project Phase 4: Constitution Alignment debate (all personas cross-check against constitution articles)
- New Project Phase 5: Artifact Completeness review (all personas verify combined output covers all aspects)

These new project phases 4-5 happen AFTER Blueprint Assembly and BEFORE the orchestrator's own constitution generation step.

### 2.4 EXISTING PROJECT FLOW: Phase 1 Extension

Modify the Phase 1 parallel launch to be depth-conditional.

**Current** (4 agents):
```
Launch ALL FOUR sub-agents simultaneously using parallel Task tool calls:
  Task 1: architecture-analyzer (D1)
  Task 2: data-model-analyzer (D5)
  Task 3: feature-mapper (D6)
  Task 4: test-evaluator (D2)
```

**New** (6-10 agents, depth-conditional):
```
Read depth from resolved flags.
Read deep-discovery-config.json from src/claude/agents/discover/.

agents_to_launch = config.depth_levels[depth].agents
  // standard: [D1, D2, D5, D6, D16, D17]
  // full:     [D1, D2, D5, D6, D16, D17, D18, D19]

agent_type_map = {
  "D1": "architecture-analyzer",
  "D2": "test-evaluator",
  "D5": "data-model-analyzer",
  "D6": "feature-mapper",
  "D16": "security-auditor",
  "D17": "technical-debt-auditor",
  "D18": "performance-analyst",
  "D19": "ops-readiness-reviewer"
}

Launch ALL agents_to_launch simultaneously using parallel Task tool calls.
Each Task includes the same 1-line summary instruction as existing agents.
```

**Progress display update** (standard, 6 agents):
```
PHASE 1: Project Analysis                            [In Progress]
├─ ◐ Architecture & Tech Stack (D1)                    (running)
├─ ◐ Data Model (D5)                                   (running)
├─ ◐ Functional Features (D6)                          (running)
├─ ◐ Test Coverage (D2)                                (running)
├─ ◐ Security Posture (D16)                            (running)
└─ ◐ Technical Debt (D17)                              (running)
```

**Progress display update** (full, 8 agents):
```
PHASE 1: Project Analysis                            [In Progress]
├─ ◐ Architecture & Tech Stack (D1)                    (running)
├─ ◐ Data Model (D5)                                   (running)
├─ ◐ Functional Features (D6)                          (running)
├─ ◐ Test Coverage (D2)                                (running)
├─ ◐ Security Posture (D16)                            (running)
├─ ◐ Technical Debt (D17)                              (running)
├─ ◐ Performance Analysis (D18)                        (running)
└─ ◐ Ops Readiness (D19)                               (running)
```

### 2.5 EXISTING PROJECT FLOW: Phase 1-DEBATE (NEW SECTION)

Insert after Phase 1 completion and BEFORE Phase 1b (Characterization Tests).

```markdown
### Step 2a-DEBATE: Execute PHASE 1-DEBATE — Cross-Domain Debate Rounds

After all Phase 1 analysis agents complete, execute structured debate rounds
where agents cross-validate each other's findings.

Read `debate_rounds` from `src/claude/agents/discover/deep-discovery-config.json`.
Read `depth` from resolved flags.

**Show progress (standard, 3 rounds):**
```
PHASE 1-DEBATE: Cross-Domain Debate                  [In Progress]
├─ ◐ Round 1: Architecture + Security                  (running)
├─ □ Round 2: Data + Testability + Architecture        (pending)
└─ □ Round 3: Behavior + Security + Coverage           (pending)
```

**Show progress (full, 5 rounds):**
```
PHASE 1-DEBATE: Cross-Domain Debate                  [In Progress]
├─ ◐ Round 1: Architecture + Security + Ops            (running)
├─ □ Round 2: Data + Testability + Architecture        (pending)
├─ □ Round 3: Behavior + Security + Coverage           (pending)
├─ □ Round 4: Constitution Alignment                   (pending)
└─ □ Round 5: Artifact Completeness + Cross-Review     (pending)
```

#### Debate Round Execution Algorithm

```
FOR each round in config.debate_rounds:
  participants_key = "participants_" + depth
  participants = round[participants_key]

  IF participants is null:
    SKIP this round (not applicable at this depth)
    CONTINUE

  IF participants == "all":
    participants = config.depth_levels[depth].agents

  // Collect Phase 1 outputs for these participants
  phase1_outputs = {}
  FOR each agent_id in participants:
    phase1_outputs[agent_id] = read_artifact(config.agents[agent_id].output_artifact)

  // Launch serial Task delegations for cross-review
  critiques = {}
  FOR each reviewer_id in participants:
    others_output = merge_outputs(phase1_outputs, exclude=reviewer_id)
    reviewer_type = config.agents[reviewer_id].agent_type
        // For D1-D6, use existing agent_type (architecture-analyzer, etc.)
        // For D16-D19, use new agent_type from config

    critique = Task(
      subagent_type: reviewer_type,
      prompt: """
        DEBATE ROUND {round.round}: {round.name}

        You are reviewing findings from other discovery agents.
        Focus: {round.focus}

        YOUR Phase 1 findings: {phase1_outputs[reviewer_id]}

        OTHER AGENTS' findings to review:
        {others_output}

        Produce a structured critique with these sections:
        1. AGREEMENTS — What you agree with from other agents' findings
        2. DISAGREEMENTS — What you disagree with, with rationale
        3. RISK FLAGS — Risks identified by cross-referencing findings
        4. RECOMMENDATIONS — Actions based on this cross-review

        Keep critique under 500 words.
      """,
      description: "Debate round {round.round}: {reviewer_type} cross-review"
    )
    critiques[reviewer_id] = critique

  // Orchestrator synthesizes all critiques
  synthesis = synthesize_debate_round(critiques, round)
  write_file("docs/requirements/reverse-engineered/debates/debate-round-{round.round}-synthesis.md", synthesis)
  write_file("docs/requirements/reverse-engineered/debates/debate-round-{round.round}-transcript.md", format_transcript(critiques))

  // Display
  IF verbose:
    display full transcript
  ELSE:
    display synthesis summary:
    "Round {round.round} ({round.name}): {agreements_count} agreements, {disagreements_count} disagreements, {risk_flags_count} risks"

  // Update progress
  Mark round as complete in progress display
END FOR
```

#### Synthesis Template

Each `debate-round-N-synthesis.md` follows this format:

```markdown
# Debate Round {N}: {round.name}

**Depth**: {standard|full}
**Participants**: {list of agent titles}
**Focus**: {round.focus}

## Agreements

| # | Topic | Agents Agreeing | Detail |
|---|-------|-----------------|--------|
| 1 | {topic} | {agents} | {what they agree on} |

## Disagreements

| # | Topic | Position A | Position B | Resolution |
|---|-------|-----------|-----------|------------|
| 1 | {topic} | {agent}: {position} | {agent}: {position} | {resolution or "unresolved"} |

## Risk Flags

| # | Risk | Flagged By | Severity | Recommendation |
|---|------|-----------|----------|----------------|
| 1 | {risk} | {agent} | {high/medium/low} | {action} |

## Consolidated Recommendations

1. {highest-priority recommendation from this round}
2. {second recommendation}
3. {third recommendation}
```

#### Round 4 (Full Only): Constitution Alignment

Special instructions for Round 4:

```
Each agent maps their findings to constitutional articles:

PROMPT ADDITION for Round 4:
"""
Additionally, for each of your Phase 1 findings, identify which constitutional
articles from docs/isdlc/constitution.md are impacted:

CONSTITUTIONAL MAPPING:
| Finding | Article(s) | Impact | Recommendation |
|---------|-----------|--------|----------------|
| {finding} | {Article N} | {how it impacts compliance} | {what to do} |
"""
```

#### Round 5 (Full Only): Artifact Completeness + Cross-Review

Special instructions for Round 5:

```
PROMPT ADDITION for Round 5:
"""
1. COMPLETENESS CHECK: Review the combined output from ALL agents (not just
   your round participants). Identify any discovery dimensions that are NOT
   covered by any agent:
   - Architecture patterns? (D1)
   - Data model? (D5)
   - Feature catalog? (D6)
   - Test coverage? (D2)
   - Security posture? (D16)
   - Technical debt? (D17)
   - Performance? (D18, if present)
   - Ops readiness? (D19, if present)
   List any BLIND SPOTS.

2. CROSS-REVIEW: You are assigned to review {assigned_agent}'s primary artifact
   ({assigned_artifact}). Check for:
   - Accuracy of findings
   - Completeness within their domain
   - Consistency with your own findings
   - Missing actionable recommendations
"""
```

Cross-review assignment is round-robin: D1 reviews D2's artifact, D2 reviews D5's, D5 reviews D6's, D6 reviews D16's, D16 reviews D17's, D17 reviews D1's (wraps around). For full depth with D18/D19, extend the chain.

### 2.6 Discovery Report Extension

In Phase 2 (Discovery Report), the synthesis section gains 3 new subsections:

```markdown
## 7.6 Security Posture
{from D16 security-auditor: risk level, findings, OWASP coverage}

## 7.7 Technical Debt
{from D17 technical-debt-auditor: debt score, hotspots, deprecated APIs}

## 7.8 Performance Analysis
{from D18 performance-analyst: optimization recommendations} (full depth only)

## 7.9 Ops Readiness
{from D19 ops-readiness-reviewer: readiness score, gaps} (full depth only)

## 7.10 Debate Synthesis
{summary of all debate rounds: agreements, disagreements, resolutions}
```

The Discovery Summary dashboard gains:

```
═══════════════════════════════════════════════════════════════
  DEEP DISCOVERY ({depth} depth)
═══════════════════════════════════════════════════════════════

  {existing summary fields...}

  Security Posture    {risk_level} — {findings_count} findings ({critical_count} critical)
  Technical Debt      Score: {debt_score}/100 — {hotspot_count} hotspots
  {if full:}
  Performance         {optimization_count} optimizations identified
  Ops Readiness       {readiness_score}/100 — {gap_count} gaps

  Debate Rounds       {rounds_completed} completed — {agreements} agreed, {disagreements} debated
═══════════════════════════════════════════════════════════════
```

### 2.7 Discovery Context Envelope Write (Phase 5 Extension)

In the finalize step, add new fields to the discovery_context envelope:

```javascript
// After existing envelope fields...
discovery_context.security_posture = {
  risk_level: D16_result.risk_level,       // "low" | "medium" | "high" | "critical"
  findings_count: D16_result.findings_count,
  critical_count: D16_result.critical_count,
  owasp_coverage: D16_result.owasp_coverage  // array of OWASP IDs covered
};

discovery_context.technical_debt = {
  debt_score: D17_result.debt_score,         // 0-100
  hotspot_count: D17_result.hotspot_count,
  deprecated_api_count: D17_result.deprecated_api_count,
  remediation_priority: D17_result.top_5_recommendations  // array of strings
};

discovery_context.debate_summary = {
  depth_level: depth,                        // "standard" | "full"
  rounds_completed: debate_rounds_executed,
  agreements_count: total_agreements,
  disagreements_count: total_disagreements,
  resolutions: resolution_summaries           // array of resolution strings
};

// D18/D19 fields (full depth only)
if (depth === "full") {
  discovery_context.performance_analysis = {
    optimization_count: D18_result.optimization_count,
    top_findings: D18_result.top_3_findings
  };
  discovery_context.ops_readiness = {
    readiness_score: D19_result.readiness_score,
    gap_count: D19_result.gap_count,
    top_gaps: D19_result.top_3_gaps
  };
}
```

### 2.8 First-Time Menu Update

The first-time menu remains structurally identical (3 options: New, Existing, Chat). Remove the reference to mode selection in the [1] option description:

| Before | After |
|--------|-------|
| `[1] New Project Setup — Define your project, select tech stack, and create constitution` | `[1] New Project Setup — Define your project, select tech stack, and create constitution` (unchanged) |

No structural change needed. The mode selection was already INSIDE the new project flow, not in the first-time menu.

---

## 3. Agent Module Designs

### 3.1 D16: Security Auditor (security-auditor.md)

**File**: `src/claude/agents/discover/security-auditor.md`

```yaml
---
name: security-auditor
description: "Use this agent for analyzing security posture of existing codebases. Scans for dependency vulnerabilities, secret exposure, authentication patterns, input validation gaps, and OWASP Top 10 risks."
model: opus
owned_skills:
  - DISC-1601  # dependency-vulnerability-scan
  - DISC-1602  # secret-detection
  - DISC-1603  # auth-pattern-analysis
  - DISC-1604  # input-validation-audit
  - DISC-1605  # owasp-risk-assessment
---
```

**Structure**:

```markdown
# Security Auditor

**Agent ID:** D16
**Phase:** Setup
**Parent:** discover-orchestrator
**Purpose:** Analyze security posture of existing codebases

## Role
Scans existing projects for security vulnerabilities, secret exposure,
authentication weaknesses, input validation gaps, and OWASP Top 10 risks.
Produces severity-rated findings for the discovery report.

## When Invoked
Called by discover-orchestrator during EXISTING PROJECT FLOW Phase 1:
- Standard depth: always
- Full depth: always

## Process

### Step 1: Dependency Vulnerability Scan
- Read package.json / requirements.txt / go.mod / Cargo.toml
- Check for known CVEs in dependencies (npm audit, pip-audit equivalent)
- Flag outdated packages with known vulnerabilities
- Severity: critical (active exploits), high (RCE/escalation), medium, low

### Step 2: Secret Detection
- Scan for hardcoded credentials, API keys, tokens
- Check .env files tracked in git
- Check for secrets in config files (connection strings, passwords)
- Check for insecure defaults (DEBUG=true, admin/admin)

### Step 3: Authentication Pattern Analysis
- Identify auth mechanism (JWT, session, OAuth, API key)
- Check for secure implementation patterns:
  - Password hashing algorithm (bcrypt/argon2 vs MD5/SHA1)
  - Token expiration and refresh logic
  - Session invalidation on logout
  - CORS configuration

### Step 4: Input Validation Audit
- Scan for unvalidated user inputs
- Check for SQL injection vectors (raw queries, string interpolation)
- Check for XSS vectors (unescaped output, innerHTML)
- Check for path traversal (user-controlled file paths)
- Check for command injection (exec, spawn with user input)

### Step 5: OWASP Top 10 Risk Assessment
Map findings to OWASP 2021 Top 10:
- A01: Broken Access Control
- A02: Cryptographic Failures
- A03: Injection
- A04: Insecure Design
- A05: Security Misconfiguration
- A06: Vulnerable Components
- A07: Auth Failures
- A08: Software/Data Integrity
- A09: Logging/Monitoring Failures
- A10: SSRF

### Step 6: Generate Report
Output `security-posture.md`:

| Section | Content |
|---------|---------|
| Executive Summary | risk_level, total findings, critical count |
| Dependency Vulnerabilities | Table: package, CVE, severity, fix available |
| Secrets Detected | Table: file, type, severity (REDACT actual values) |
| Auth Assessment | Pattern identified, strengths, weaknesses |
| Input Validation | Table: file, line, vector type, severity |
| OWASP Coverage | Table: OWASP ID, status (covered/at-risk/not-applicable) |
| Recommendations | Prioritized fix list |

## Output Contract

Return to orchestrator:
- one_line_summary: string (under 60 chars)
- risk_level: "low" | "medium" | "high" | "critical"
- findings_count: number
- critical_count: number
- owasp_coverage: string[] (OWASP IDs where project has adequate protection)
- report_section: string (markdown for discovery report section 7.6)

## Debate Round Participation

When invoked for a debate round, this agent:
- Receives other agents' findings
- Cross-reviews from a security perspective
- Flags security implications of architectural/data/behavioral findings
- Returns structured critique (agreements, disagreements, risk flags, recommendations)
```

### 3.2 D17: Technical Debt Auditor (technical-debt-auditor.md)

**File**: `src/claude/agents/discover/technical-debt-auditor.md`

```yaml
---
name: technical-debt-auditor
description: "Use this agent for analyzing technical debt in existing codebases. Identifies code duplication, complexity hotspots, deprecated APIs, missing error handling, stale dependencies, and anti-patterns."
model: opus
owned_skills:
  - DISC-1701  # duplication-detection
  - DISC-1702  # complexity-analysis
  - DISC-1703  # deprecated-api-scan
  - DISC-1704  # error-handling-audit
  - DISC-1705  # dependency-staleness-check
  - DISC-1706  # anti-pattern-detection
---
```

**Process Steps**:

1. **Code Duplication Detection**: Scan for copy-paste patterns, similar function signatures, duplicated logic blocks across modules
2. **Complexity Hotspot Analysis**: Identify files/functions with high cyclomatic complexity (>10 branches), deep nesting (>4 levels), long functions (>100 lines)
3. **Deprecated API Scan**: Check for usage of deprecated standard library APIs, deprecated framework features, deprecated dependency methods
4. **Error Handling Audit**: Find uncaught exceptions, empty catch blocks, missing error boundaries, unhandled promise rejections
5. **Dependency Staleness Check**: Compare installed versions to latest stable, flag major version gaps (>2 behind), flag unmaintained packages (no release in >1 year)
6. **Anti-Pattern Detection**: Identify god objects/files, circular dependencies, hardcoded values, magic numbers, dead code

**Output Contract**:
- one_line_summary: string
- debt_score: number (0-100, lower is better)
- hotspot_count: number
- deprecated_api_count: number
- remediation_priority: string[] (top 5)
- report_section: string (markdown for discovery report section 7.7)

### 3.3 D18: Performance Analyst (performance-analyst.md)

**File**: `src/claude/agents/discover/performance-analyst.md`

```yaml
---
name: performance-analyst
description: "Use this agent for analyzing performance characteristics of existing codebases. Evaluates response time patterns, memory/CPU profiling, caching strategy, database query patterns, and bundle sizes."
model: opus
owned_skills:
  - DISC-1801  # response-time-analysis
  - DISC-1802  # memory-cpu-profiling
  - DISC-1803  # caching-strategy-review
  - DISC-1804  # query-pattern-analysis
  - DISC-1805  # bundle-size-analysis
---
```

**Depth**: Full only.

**Process Steps**:

1. **Response Time Pattern Analysis**: Identify synchronous blocking calls, long-running computations on main thread, missing async patterns, sequential API calls that could be parallel
2. **Memory/CPU Profiling Hooks**: Check for memory leaks (event listeners not removed, large object retention, cache without eviction), CPU-intensive loops, missing streaming for large data
3. **Caching Strategy Review**: Identify caching layers (Redis, in-memory, HTTP cache headers), check cache invalidation patterns, flag missing cache for expensive operations
4. **Database Query Pattern Analysis**: Detect N+1 queries (ORM lazy loading), missing indexes (queries on unindexed columns), large result sets without pagination, missing connection pooling
5. **Bundle Size Analysis** (frontend): Check for tree-shaking, code splitting, large dependencies, unused imports, missing lazy loading for routes

**Output Contract**:
- one_line_summary: string
- optimization_count: number
- top_3_findings: string[]
- report_section: string

### 3.4 D19: Ops Readiness Reviewer (ops-readiness-reviewer.md)

**File**: `src/claude/agents/discover/ops-readiness-reviewer.md`

```yaml
---
name: ops-readiness-reviewer
description: "Use this agent for evaluating operational readiness of existing codebases. Checks logging adequacy, health check endpoints, graceful shutdown, configuration management, and monitoring hooks."
model: opus
owned_skills:
  - DISC-1901  # logging-audit
  - DISC-1902  # health-check-detection
  - DISC-1903  # graceful-shutdown-check
  - DISC-1904  # config-management-review
  - DISC-1905  # monitoring-hook-detection
---
```

**Depth**: Full only.

**Process Steps**:

1. **Logging Adequacy Audit**: Check for structured logging (JSON format), log levels (debug, info, warn, error), request correlation IDs, PII scrubbing, log rotation
2. **Health Check Detection**: Find health endpoints (/health, /ready, /live), check for dependency health checks (DB, cache, external APIs), verify response format
3. **Graceful Shutdown Check**: Look for SIGTERM/SIGINT handlers, connection draining, in-flight request completion, cleanup hooks
4. **Configuration Management Review**: Check for environment variable handling, config validation at startup, secrets management (vault, KMS vs plaintext), per-environment config separation
5. **Monitoring Hook Detection**: Check for metrics collection (Prometheus, StatsD, CloudWatch), tracing integration (OpenTelemetry, Datadog), error tracking (Sentry, Bugsnag), uptime monitoring

**Output Contract**:
- one_line_summary: string
- readiness_score: number (0-100)
- gap_count: number
- top_3_gaps: string[]
- report_section: string

---

## 4. Configuration File Design

### 4.1 deep-discovery-config.json (Full Schema)

See architecture-overview.md Section 6.1 for the complete JSON schema. No changes from the architecture specification.

**File location**: `src/claude/agents/discover/deep-discovery-config.json`

**Validation rules** (for test design):
- `version` must be semver string
- `depth_levels` must have exactly `standard` and `full` keys
- `depth_levels.standard.agents` must be a subset of `depth_levels.full.agents`
- `depth_levels.*.debate_rounds` must match the count of rounds where `participants_*` is non-null
- Each agent in `agents` must have: `title` (string), `agent_type` (string matching an .md file), `depth_level` (string), `output_artifact` (string ending in .md), `scan_domains` (string[])
- `debate_rounds` must be sorted by `round` ascending
- `debate_rounds[].participants_standard` is either null or a string array of agent IDs
- `debate_rounds[].participants_full` is either "all" or a string array of agent IDs
- All agent IDs referenced in `debate_rounds` must exist in `agents` or in the existing agent set (D1, D2, D5, D6)

---

## 5. Error Taxonomy

| Code | Error | Trigger | Recovery |
|------|-------|---------|----------|
| E-001 | Deprecated flag: --party | User passes --party | Display migration message, stop |
| E-002 | Deprecated flag: --classic | User passes --classic | Display migration message, stop |
| E-003 | Invalid depth level | `--deep {unknown}` | Display valid options, stop |
| E-004 | Config file missing | deep-discovery-config.json not found | Fall back to 4-agent standard (D1, D2, D5, D6), warn |
| E-005 | Agent .md file missing | D16/D17/D18/D19 .md not found | Skip missing agent, log warning, proceed with available agents |
| E-006 | Debate round timeout | Round exceeds timeout_minutes_per_round | Collect partial critiques, synthesize what's available, continue |
| E-007 | Agent critique empty | Agent returns empty critique in debate | Mark as "no input" in synthesis, continue |
| E-008 | Transcript write failure | Cannot write to debates/ directory | Log warning, continue (transcript is non-critical) |

---

## 6. Party Agent Rename Specification

For each of the 7 existing party agent .md files, apply these text replacements:

| File | Find | Replace |
|------|------|---------|
| `domain-researcher.md` | "party mode" | "deep discovery" |
| `technical-scout.md` | "party mode" | "deep discovery" |
| `solution-architect-party.md` | "party mode" | "deep discovery" |
| `security-advisor.md` | "party mode" | "deep discovery" |
| `devops-pragmatist.md` | "party mode" | "deep discovery" |
| `data-model-designer.md` | "party mode" | "deep discovery" |
| `test-strategist.md` | "party mode" | "deep discovery" |

Additional renames in each file:
- "Inception Party" -> "Deep Discovery Session"
- "Party Phase" -> "Deep Discovery Phase"

All 7 files also get: `"New (deep discovery)"` in the `When Used` field instead of `"New (party mode)"`.

---

## 7. Documentation Update Specification

### 7.1 AGENTS.md Changes

**Sub-Agents table**: Add 4 new rows after D15:

```markdown
| `security-auditor` | D16 | Security posture analysis for existing projects | Existing (standard + full) |
| `technical-debt-auditor` | D17 | Technical debt analysis for existing projects | Existing (standard + full) |
| `performance-analyst` | D18 | Performance analysis for existing projects | Existing (full only) |
| `ops-readiness-reviewer` | D19 | Ops readiness review for existing projects | Existing (full only) |
```

**Count updates**:
- Discover agents: 12 -> 16
- Total agents: 36 -> 40

### 7.2 README.md Changes

- Agent count badge: `36 agents` -> `40 agents`
- Discover agents reference: `12` -> `16`

### 7.3 tour.md Changes

Replace any `--party` / `--classic` references with `--deep` references.

### 7.4 CLAUDE.md Changes

Add checklist item under Next Session for deep discovery implementation tracking.

---

## 8. State.json Impact

### 8.1 No Structural Changes

The `state.json` schema does not change. All modifications are to field values:
- `discovery_context` gets new additive keys (Section 2.7)
- No new top-level keys
- No schema version bump needed

### 8.2 project.tech_stack

No changes. D16-D19 do not modify the tech_stack detection (that remains D1's responsibility).

---

## 9. AC Traceability

| AC | Design Section | Implementation File(s) |
|----|---------------|----------------------|
| AC-1 to AC-3 | 1.4 Flag Resolution | discover.md, discover-orchestrator.md |
| AC-4 to AC-5 | 1.2 Removed Options | discover.md |
| AC-6 | 1.4 Flag Resolution | discover.md, discover-orchestrator.md |
| AC-7 to AC-10 | 2.2-2.3, Section 2 | discover-orchestrator.md |
| AC-11 to AC-17 | 2.4 Phase 1 Extension, 3.1-3.2 | discover-orchestrator.md, security-auditor.md, technical-debt-auditor.md |
| AC-18 to AC-24 | 2.4 Phase 1 Extension, 3.3-3.4 | discover-orchestrator.md, performance-analyst.md, ops-readiness-reviewer.md |
| AC-25 to AC-29 | 2.5 Phase 1-DEBATE | discover-orchestrator.md, deep-discovery-config.json |
| AC-30 to AC-33 | 2.5 Rounds 4-5 | discover-orchestrator.md, deep-discovery-config.json |
| AC-34 to AC-37 | 2.2-2.3 Depth Level | discover-orchestrator.md, party-personas.json |
| AC-38 to AC-40 | 3.1-3.4 Agent Designs | D16-D19 agent .md files |
| AC-41 to AC-44 | 2.5 Debate Display | discover-orchestrator.md |
| AC-45 to AC-48 | 2.7 Envelope Write | discover-orchestrator.md |
| AC-49 to AC-53 | 2.1 Step 0 Removal, 6 Renames | discover-orchestrator.md, party agent .md files |
| AC-54 to AC-57 | 2.8 Menu Update | discover-orchestrator.md |
