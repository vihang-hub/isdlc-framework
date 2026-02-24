# Infrastructure Design: REQ-0023 Three-Verb Backlog Model

**Phase**: 03-architecture
**Created**: 2026-02-18
**Author**: Solution Architect (Agent 03)
**Traces**: NFR-004, NFR-005, NFR-006

---

## 1. Overview

The iSDLC framework is a local CLI tool with no cloud infrastructure. The "infrastructure" for this feature consists of the file system layout, the hook dispatch chain, and the testing infrastructure.

---

## 2. File System Layout

### 2.1 New Files Created by `add` Verb

```
docs/
  requirements/
    {slug}/                    <-- New directory per add
      draft.md                 <-- Raw description content
      meta.json                <-- Analysis tracking (v2 schema)
```

### 2.2 Files Modified by `analyze` Verb

```
docs/
  requirements/
    {slug}/
      meta.json                <-- phases_completed updated
      quick-scan.md            <-- Phase 00 artifact
      requirements-spec.md     <-- Phase 01 artifact
      user-stories.json        <-- Phase 01 artifact
      nfr-matrix.md            <-- Phase 01 artifact
      impact-analysis.md       <-- Phase 02 artifact
      architecture-overview.md <-- Phase 03 artifact
      interface-spec.yaml      <-- Phase 04 artifact
      module-designs/          <-- Phase 04 directory
BACKLOG.md                     <-- Marker updated
```

### 2.3 Files Modified by `build` Verb

```
.isdlc/
  state.json                   <-- active_workflow initialized
```

Plus standard feature workflow artifacts (same as current `/isdlc feature`).

---

## 3. Environment Strategy

### 3.1 Development Environment

- **Source of truth**: `src/claude/` directory
- **Runtime copy**: `.claude/` directory (symlinks from src)
- **Testing**: `npm run test:all` (ESM + CJS test streams)
- **Local validation**: Manual execution of add/analyze/build verbs

### 3.2 Testing Environment

- **CI/CD**: GitHub Actions matrix (macOS, Linux, Windows x Node 20, 22, 24)
- **Test streams**:
  - ESM tests: `lib/*.test.js` (no changes needed for this feature)
  - CJS tests: `src/claude/hooks/tests/*.test.cjs` (2 test files updated)
- **Integration testing**: Manual verification of all verb flows

### 3.3 Production Environment

- **Distribution**: npm package (`npx isdlc init`)
- **Runtime**: Claude Code extension loaded from `.claude/` directory
- **No servers, no containers, no cloud services**

---

## 4. Hook Dispatch Chain

The hook dispatch chain for the three-verb model:

### 4.1 `/isdlc add` Flow

```
1. User invokes /isdlc add via Skill tool
2. pre-skill-dispatcher fires:
   - skill-delegation-enforcer.cjs detects /isdlc
   - Parses action: "add"
   - "add" is in EXEMPT_ACTIONS -> exit 0 (no pending_delegation marker)
3. isdlc.md loaded as skill prompt
4. Add handler executes inline (creates draft.md, meta.json, BACKLOG entry)
5. post-task-dispatcher fires:
   - delegation-gate.cjs: no pending_delegation marker -> exit 0
6. Done (no workflow created)
```

### 4.2 `/isdlc analyze` Flow

```
1. User invokes /isdlc analyze via Skill tool
2. pre-skill-dispatcher fires:
   - skill-delegation-enforcer.cjs detects /isdlc
   - Parses action: "analyze"
   - "analyze" is in EXEMPT_ACTIONS -> exit 0 (no pending_delegation marker)
3. isdlc.md loaded as skill prompt
4. Analyze handler executes inline:
   - For each phase (00-04):
     - Delegate to phase agent via Task tool
     - Update meta.json and BACKLOG.md
5. post-task-dispatcher fires:
   - delegation-gate.cjs: no pending_delegation marker -> exit 0
6. Done (no workflow created)
```

### 4.3 `/isdlc build` Flow

```
1. User invokes /isdlc build via Skill tool
2. pre-skill-dispatcher fires:
   - skill-delegation-enforcer.cjs detects /isdlc
   - Parses action: "build"
   - "build" is NOT in EXEMPT_ACTIONS -> writes pending_delegation marker
   - Outputs mandatory delegation context message
3. isdlc.md loaded as skill prompt
4. Build handler delegates to orchestrator via Task tool
5. Orchestrator initializes workflow, creates branch
6. Phase-Loop Controller drives standard feature workflow
7. post-task-dispatcher fires:
   - delegation-gate.cjs: finds pending_delegation marker
   - Verifies delegation to orchestrator occurred (via skill_usage_log)
   - Clears marker
8. Standard feature workflow proceeds
```

---

## 5. Monitoring and Logging

### 5.1 Hook Activity Log

All hook executions are logged to `.isdlc/hook-activity.log`:
- skill-delegation-enforcer: logs exempt action bypass for add/analyze
- delegation-gate: logs auto-clear for exempt actions

### 5.2 Skill Usage Log

Agent delegations during `analyze` are logged to `state.json.skill_usage_log`:
- Each phase agent delegation is recorded
- Note: analyze does not write to state.json, but skill usage is logged by the hook system independently

### 5.3 Error Logging

- All hooks write diagnostic output to stderr (not stdout, which is reserved for JSON protocol)
- debugLog() function used for conditional verbose output

---

## 6. Disaster Recovery

### 6.1 File Corruption

| Scenario | Recovery | RTO |
|----------|----------|-----|
| meta.json corrupted | Delete, re-run `add` + `analyze` | Minutes |
| BACKLOG.md corrupted | Restore from git history | Minutes |
| state.json corrupted | `isdlc init` re-initializes | Minutes |
| draft.md deleted | Re-run `add` | Seconds |

### 6.2 Partial Analysis Failure

If `analyze` fails mid-phase:
- phases_completed reflects the last successfully completed phase
- Re-running `analyze` resumes from the next phase (NFR-003)
- meta.json is updated after each phase, not at the end
- No rollback needed -- partial state is valid

### 6.3 Interrupted `add`

If `add` fails mid-execution:
- Partial draft.md or meta.json may exist
- Re-running `add` detects slug collision, offers overwrite
- BACKLOG.md may or may not have the entry
- Manual cleanup: delete the partial slug directory

---

## 7. Performance Targets (NFR-004)

| Operation | Target | Bottleneck | Notes |
|-----------|--------|-----------|-------|
| `add` verb (end-to-end) | < 5 seconds | Filesystem writes (3 operations) | No AI calls, no network |
| `analyze` phase transition | < 2 seconds | meta.json write + BACKLOG.md update | Between phase agent completions |
| BACKLOG.md marker update | < 100ms | File read + regex + write | O(n) line scan, n ~ 200 |
| meta.json read with migration | < 50ms | JSON parse + field check | Single file, < 500 bytes |
| Item resolution by slug | < 10ms | Directory existence check | path.join + fs.existsSync |
| Item resolution by BACKLOG number | < 100ms | Line scan of BACKLOG.md | O(n), n ~ 200 |

---

## 8. Cross-Platform Considerations (NFR-005)

| Area | Implementation | Article |
|------|---------------|---------|
| File paths | `path.join()` / `path.resolve()` for all path construction | XII |
| Line endings | `content.replace(/\r\n/g, '\n')` before parsing BACKLOG.md | XII |
| File writes | `writeFileSync(path, content, 'utf-8')` | XII |
| Slug generation | No filesystem-unsafe characters (validated by regex) | XII |
| Git operations | `git rev-parse --short HEAD` for codebase_hash (works on all platforms) | XII |
