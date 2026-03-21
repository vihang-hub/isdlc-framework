# Architecture Overview: Antigravity Viability Assessment

**Item**: REQ-0072 | **GitHub**: #136

---

## 1. Architecture Options

| Option | Summary | Pros | Cons | Verdict |
|--------|---------|------|------|---------|
| A: Antigravity as shared control plane | Scripts become `src/core/` entry points | Simple, scripts already work | Couples core to one provider's CLI model; excludes Claude/Codex patterns | **Eliminated** |
| B: Antigravity as peer provider | Scripts decompose into core logic + adapter wrapper | Clean separation, all providers equal | More extraction work upfront | **Selected** |
| C: Antigravity deprecated | Replace with core-only CLI | Simpler long-term | Loses a working IDE; wastes existing code | **Eliminated** |

## 2. Selected Architecture

### ADR-CODEX-004: Antigravity as Peer Provider

- **Status**: Accepted
- **Context**: The design doc treated Antigravity as a candidate shared control plane. User correction: Antigravity is a standalone IDE, peer to Claude Code and Codex CLI.
- **Decision**: Classify Antigravity as a peer provider. Decompose its scripts into core logic (moves to `src/core/`) and adapter logic (stays in `src/providers/antigravity/`). All three providers consume the same core services.
- **Rationale**: Antigravity's scripts already implement the workflow/state logic that the core needs. Extracting that logic benefits all providers equally. Keeping Antigravity as a peer ensures it doesn't become a privileged path that other providers can't match.
- **Consequences**: Core extraction must consider all three providers' invocation patterns, not just Antigravity's CLI model. Antigravity scripts become thin CLI wrappers post-extraction.

## 3. Provider Comparison

| Characteristic | Claude Code | Codex CLI | Antigravity |
|---------------|-------------|-----------|-------------|
| **Invocation model** | Hook interception (PreToolUse/PostToolUse) | Sub-agent spawning + instruction compliance | Direct CLI invocation (`node script.cjs`) |
| **Governance mechanism** | External hook processes (hard boundary) | AGENTS.md instructions (soft boundary) | Deterministic code (hard boundary) |
| **Session model** | Persistent conversation with context injection | Per-task with instruction projection | Stateless CLI calls with state.json persistence |
| **Sub-agent capability** | Task tool with subagent_type | Named sub-agents (Hooke) with model selection | No sub-agents — single-threaded CLI |
| **Instruction surface** | CLAUDE.md + session cache (system-reminder) | AGENTS.md | CLI flags + state.json |
| **Interactive UX** | Conversational (natural language) | Conversational (natural language) | CLI menus and prompts |
| **Strength** | Richest governance, best context delivery | Native multi-agent, instruction compliance | Simplest model, fully deterministic, easiest to test |
| **Weakness** | Deeply coupled to Claude hook system | No external enforcement guarantee | No sub-agents, no conversational UX |

## 4. Integration Architecture

### Post-Extraction Provider Model

```
                    ┌──────────────┐
                    │   src/core/  │
                    │              │
                    │ WorkflowEngine│
                    │ StateStore    │
                    │ ValidatorEngine│
                    │ BacklogService │
                    │ ...           │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
    ┌─────────▼──┐  ┌──────▼─────┐  ┌──▼──────────┐
    │  Claude     │  │  Codex     │  │ Antigravity  │
    │  Adapter    │  │  Adapter   │  │ Adapter      │
    │             │  │            │  │              │
    │ Hooks →     │  │ AGENTS.md →│  │ CLI args →   │
    │ verify core │  │ instructions│  │ call core   │
    │ outputs     │  │ + sub-agents│  │ directly    │
    └─────────────┘  └────────────┘  └─────────────┘
```

## 5. Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Antigravity disposition | Peer provider | User direction; clean separation |
| Script decomposition | Core logic out, adapter wrapper stays | Benefits all providers |
| Extraction source | Antigravity scripts are the richest source of core logic | They already implement workflow/state patterns |
