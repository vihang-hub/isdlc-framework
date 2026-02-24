# Error Taxonomy — REQ-0006: Inception Party

**Feature**: BMAD-inspired role-based party mode for `/discover --new`
**Version**: 1.0.0
**Created**: 2026-02-09

---

## 1. Error Categories

| Category | Severity | Scope | Recovery Path |
|----------|----------|-------|---------------|
| Team Creation Failure | Critical | Party mode blocked | Classic mode fallback |
| Single Agent Failure | Medium | Phase degraded | Retry once, then proceed without |
| All Agents in Phase Failure | High | Phase blocked | Retry phase / classic fallback / cancel |
| Message Delivery Failure | Low | Communication gap | Retry message / proceed |
| Artifact Production Failure | Medium | Missing output | Use partial output / fallback |
| State Write Failure | High | Progress lost | Retry write / manual recovery |
| Flag Conflict | Low | User error | Display error, prompt correction |

---

## 2. Error Definitions

### E-001: TeamCreate Failure

**Trigger**: `TeamCreate("inception-party")` returns error or is unavailable.
**Impact**: Party mode cannot start.
**Detection**: Immediate — TeamCreate is the first party mode operation.
**Recovery**:
```
Team creation failed. Party mode requires Claude Code team features.

[1] Retry team creation
[2] Fall back to classic mode
[3] Cancel discovery

Enter selection (1-3):
```
**State change**: None (party mode not yet started).

### E-002: Single Agent Spawn Failure

**Trigger**: Task tool fails when spawning one agent in a parallel phase.
**Impact**: Phase has 2 agents instead of 3.
**Detection**: Task tool returns error for the specific agent.
**Recovery**:
1. Log failure: `"{PersonaName} could not be launched."`
2. Do NOT retry spawn (spawn is the Task tool invocation itself)
3. Proceed with remaining 2 agents
4. Adjust question collection / debate expectations
5. Report to user: `"Proceeding with {remaining_count} agents in {phase_name}."`
**State change**: `party_phases[N].agents` reflects only active agents.

### E-003: Agent Communication Failure (No Response)

**Trigger**: Agent is spawned but goes idle without sending expected message.
**Impact**: Orchestrator waiting indefinitely for agent output.
**Detection**: Agent goes idle (idle notification received) without expected message type.
**Recovery**:
1. Send retry message to agent: `"Please submit your {expected_output_type}."`
2. Wait for response
3. If second idle without response: treat as agent failure (E-004)
**State change**: None during retry. On failure, see E-004.

### E-004: Agent Task Failure (Error During Execution)

**Trigger**: Agent sends error message or produces invalid output.
**Impact**: One agent's contribution missing from phase.
**Detection**: Error message received via SendMessage or invalid output format.
**Recovery**:
1. Log the error details
2. Send one retry prompt to agent
3. If retry fails:
   - Report: `"{PersonaName} encountered an issue. Proceeding with remaining agents."`
   - Mark agent's contribution as "unavailable"
   - Continue phase with remaining agents
**State change**: Phase proceeds with reduced agent count.

### E-005: All Agents in Phase Failure

**Trigger**: All 3 agents in a parallel phase fail (E-002/E-003/E-004 for all).
**Impact**: Phase cannot produce any output.
**Detection**: All agent slots exhausted after retries.
**Recovery**:
```
All agents in {phase_name} encountered errors.

[1] Retry phase — re-launch all agents
[2] Fall back to classic mode — restart with sequential flow
[3] Cancel — abort discovery

Enter selection (1-3):
```
- [1]: Re-spawn all 3 agents with fresh prompts
- [2]: TeamDelete, then execute classic mode Steps 1-10
- [3]: TeamDelete, report cancellation
**State change**: On [1], reset phase status to pending. On [2], clear party_mode state. On [3], set status to cancelled.

### E-006: Message Limit Exceeded

**Trigger**: Agents in a phase exceed max_messages limit (10 per NFR-002).
**Impact**: Debate truncated.
**Detection**: Orchestrator's message counter reaches threshold.
**Recovery**:
1. Broadcast: `"Message limit reached. Please submit your final position now."`
2. Wait for final positions from each agent
3. Proceed to next step
**State change**: `party_phases[N].messages` stays at max_messages value.

### E-007: Artifact Write Failure

**Trigger**: Agent reports artifact file could not be written (permission error, path issue).
**Impact**: Design artifact missing.
**Detection**: Agent's finalization message reports write error.
**Recovery**:
1. Orchestrator attempts to write the artifact from agent's content
2. If still fails: log error, proceed with in-memory content
3. Report artifact status in phase completion summary
**State change**: Artifact path may be null in collected artifacts.

### E-008: State Write Failure

**Trigger**: Orchestrator cannot write to state.json during party mode.
**Impact**: Progress tracking lost.
**Detection**: File write error when updating state.json.
**Recovery**:
1. Retry write once
2. If retry fails: continue execution (state tracking is observability, not critical path)
3. Report: `"Warning: Could not update state.json progress tracking."`
4. Final state write at completion is critical — if that fails, escalate to user
**State change**: Stale state.json (progress not reflected).

### E-009: Flag Conflict (--party + --classic)

**Trigger**: User passes both `--party` and `--classic` flags.
**Impact**: Ambiguous intent.
**Detection**: Flag parsing in orchestrator mode resolution.
**Recovery**:
```
Error: --party and --classic are mutually exclusive. Use one or the other.
```
**State change**: None (discovery does not start).

### E-010: TeamDelete Failure

**Trigger**: TeamDelete fails during cleanup.
**Impact**: Team resources may not be fully cleaned up.
**Detection**: TeamDelete returns error.
**Recovery**:
1. Log the error
2. Continue with workflow completion (TeamDelete failure is non-blocking)
3. Team will be garbage-collected by Claude Code's team lifecycle management
**State change**: Team may persist until session ends.

---

## 3. Error Flow Diagram

```
Party Mode Entry
     |
     v
TeamCreate ──FAIL──> E-001: Classic fallback menu
     |
     OK
     |
     v
Phase 1-3 (parallel agents)
     |
     +── Agent spawn fails ──> E-002: Proceed with remaining
     |
     +── Agent no response ──> E-003: Retry → E-004 on 2nd fail
     |
     +── Agent error ──> E-004: Retry → Degrade
     |
     +── All agents fail ──> E-005: Retry/Classic/Cancel menu
     |
     +── Message limit ──> E-006: Force final positions
     |
     +── Artifact write fail ──> E-007: Orchestrator writes / in-memory
     |
     v
Phase 4-5 (sequential)
     |
     +── D3/D4 fail ──> Same as classic mode error handling
     |
     v
Finalize
     |
     +── State write fail ──> E-008: Retry / warn
     |
     +── TeamDelete fail ──> E-010: Log / continue
     |
     v
Complete
```

---

## 4. Severity Matrix

| Error | Blocks User | Blocks Phase | Blocks Workflow | Auto-Recoverable |
|-------|------------|-------------|----------------|-------------------|
| E-001 | No (fallback) | Yes | Yes | No (needs menu) |
| E-002 | No | No (degraded) | No | Yes |
| E-003 | No | Temporarily | No | Yes (retry) |
| E-004 | No | No (degraded) | No | Yes |
| E-005 | Yes (needs menu) | Yes | Yes | No (needs menu) |
| E-006 | No | No | No | Yes (auto-cutoff) |
| E-007 | No | No | No | Yes (orchestrator writes) |
| E-008 | No | No | No | Yes (retry/skip) |
| E-009 | Yes (must fix flags) | Yes | Yes | No (user must fix) |
| E-010 | No | No | No | Yes (GC) |
