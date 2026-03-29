# Requirements Specification: REQ-GH-214 — PreToolUse Tool Routing

**Source**: GitHub Issue #214
**Status**: Analyzed

---

## Functional Requirements

### FR-001: Tool Routing Hook
- A new `PreToolUse` hook (`tool-router.cjs`) intercepts tool calls and evaluates them against routing rules
- When a preferred tool exists and is available, the hook blocks or warns based on enforcement level
- **Assumption**: Claude Code fires PreToolUse hooks for Grep, Glob, Read matchers (confirmed — settings.json supports arbitrary matchers)
- AC-001-01: Given a Grep call with a matching `block` rule and the preferred MCP tool available, then the call is blocked and the message names the preferred tool
- AC-001-02: Given a Grep call with a matching `warn` rule, then the call is allowed and a warning is emitted to stderr
- AC-001-03: Given a tool call with no matching rules, then the call is allowed silently (exit 0, no output)

### FR-002: Config-Driven Routing Rules
- A JSON config file (`tool-routing.json`) under `src/claude/hooks/config/` defines routing rules
- Each rule specifies: operation, intercept tool, preferred tool, enforcement level, exemptions
- Users add/modify rules without code changes
- **Assumption**: Config is loaded fresh on each hook invocation (stateless, no hot-reload needed)
- AC-002-01: Given a valid `tool-routing.json` with custom rules, then all rules are available for evaluation
- AC-002-02: Given a user adds a new rule to the config, then the new rule is enforced on the next tool call

### FR-003: Three-Source Rule Resolution
- Rules come from four sources merged at runtime: user-explicit > skill-declared > inferred > framework defaults
- Conflict resolution by operation + intercept_tool pair — higher priority source wins
- **Assumption**: Merge happens in-memory on every invocation (no caching across calls)
- AC-003-01: Given a framework default rule and a user override for the same operation, then the user override wins
- AC-003-02: Given an inferred rule and a skill-declared rule for the same operation, then the skill-declared rule wins

### FR-004: Environment Inference
- The hook auto-detects installed capabilities (MCP servers, embeddings indexed) and generates inferred rules at `warn` level
- Zero user config required for inferred rules
- **Assumption**: MCP availability can be detected via filesystem heuristics (process config files, tool manifests) since CJS hooks cannot make MCP calls directly
- AC-004-01: Given an MCP code-index server is available, then inferred rules are generated for search, find-files, file-summary at `warn` level
- AC-004-02: Given no MCP servers are available, then no inferred rules are generated and all tools pass through

### FR-005: Skill-Declared Tool Preferences
- External skills can declare `tool_preferences` in their manifest bindings
- When installed, skill tool preferences become routing rules at `block` level
- **Assumption**: `external-skills-manifest.json` schema can be extended with a `tool_preferences` array without breaking existing skills
- AC-005-01: Given a skill with `tool_preferences` declaring a preferred search tool, then the preference is included at `block` enforcement

### FR-006: Exemption Mechanism
- Each rule supports pattern-based exemptions (file path regex, parameters) and context-based exemptions (edit prep, targeted read)
- Exemptions bypass the routing rule when matched
- **Assumption**: All exemption signals are available in the `tool_input` object from stdin (no cross-call state)
- AC-006-01: Given a Grep targeting a specific file path with a matching pattern exemption, then the call is exempted
- AC-006-02: Given a Read with `limit: 50` and a context exemption for `edit_prep`, then the call is exempted
- AC-006-03: Given a Read with no limit (full file) and no matching exemptions, then the routing rule applies

### FR-007: Self-Documenting Warnings
- Warning messages include: preferred tool name, rule source (inferred/default/skill), and config file path
- Users learn where to promote warn → block from the warning itself
- AC-007-01: Given a `warn` decision, then the warning includes the preferred tool, source, and path to `tool-routing.json`

### FR-008: Fail-Open Behavior
- If MCP unavailable, hook errors, or config missing/malformed, the original tool call proceeds unblocked (Article X)
- AC-008-01: Given `tool-routing.json` does not exist, then all tool calls are allowed (exit 0)
- AC-008-02: Given the preferred MCP tool is unavailable, then the rule is skipped and the original tool is allowed
- AC-008-03: Given malformed JSON in config, then a warning is logged to stderr and all tools are allowed

### FR-009: MCP Availability Detection
- Before blocking or warning, the hook verifies the preferred MCP tool is available at runtime
- Unavailable → rule silently skipped
- **Assumption**: Availability is checked via filesystem/process heuristics with a 500ms timeout
- AC-009-01: Given a rule for an unavailable MCP tool, then the rule is skipped
- AC-009-02: Given an MCP probe exceeding 500ms, then the probe is treated as unavailable

### FR-010: Constitutional Article
- Add Article XV: Tool Preference Enforcement to `docs/isdlc/constitution.md`
- Principle: "Agents MUST use the highest-fidelity tool available. User-installed and user-configured tools take precedence over built-in defaults."
- AC-010-01: Given the constitution is read by an agent, then Article XV establishes the tool preference obligation

### FR-011: Tool Routing Audit Log
- Every routing decision is logged: timestamp, original tool, preferred tool, enforcement, decision outcome, exemption matched, rule source
- Log appended to `.isdlc/tool-routing-audit.jsonl`
- AC-011-01: Given any routing decision (block, warn, allow, exempt, preferred unavailable), then a JSONL entry is appended
- AC-011-02: Given the audit log file does not exist, then it is created on first write
- AC-011-03: Given audit log write fails, then the routing decision still applies (non-blocking)

---

## Non-Functional Requirements

- **NFR-001: Stateless Hook** — No cross-call memory. All decisions from current tool_input + config + environment probes.
- **NFR-002: Performance** — Hook evaluation <100ms. MCP probes timeout-bounded at 500ms.
- **NFR-003: Fail-Open** — Any error path results in exit 0, no output (Article X).

---

## Out of Scope

| Item | Reason |
|------|--------|
| Cross-call context tracking | Requires stateful hook architecture — future enhancement |
| Runtime config hot-reload | Config loaded per invocation; restart picks up changes |
| UI/dashboard for rule management | CLI-first project — see #130 |
| CLAUDE.md → constitution migration | Separate initiative — see #116 |
| PostToolUse validation | Different enforcement surface — future enhancement |

---

## Prioritization

| FR | Priority | Rationale |
|----|----------|-----------|
| FR-001 | Must Have | Core feature — the hook itself |
| FR-002 | Must Have | Extensibility — config-driven rules |
| FR-003 | Must Have | Multi-source merge — user/skill/inferred/framework |
| FR-004 | Must Have | Zero-config experience for installed tools |
| FR-005 | Must Have | Skill integration for tool preferences |
| FR-006 | Must Have | Prevents false positives on legitimate tool use |
| FR-007 | Must Have | User discoverability — self-documenting warnings |
| FR-008 | Must Have | Article X compliance — fail-open |
| FR-009 | Must Have | Runtime safety — don't block when MCP is down |
| FR-010 | Must Have | Governance principle backing enforcement |
| FR-011 | Must Have | Audit trail for tool routing decisions |
