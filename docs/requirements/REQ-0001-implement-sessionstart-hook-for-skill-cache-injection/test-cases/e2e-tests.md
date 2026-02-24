# E2E Test Cases: Unified SessionStart Cache (REQ-0001)

**Phase**: 05-test-strategy
**Test Type**: E2E
**Framework**: node:test + node:assert/strict (CJS stream)
**File**: `src/claude/hooks/tests/test-session-cache-e2e.test.cjs`

---

## 1. Full Cache Lifecycle

### TC-E2E-01: Build -> Read -> Modify source -> Rebuild -> Read updated (positive)
**Requirement**: FR-001, FR-002, FR-007, NFR-006
**Priority**: P0
**Given**: A test project with all source files set up (constitution, workflows, skills, personas, topics)
**When**:
1. `rebuildSessionCache({ projectRoot })` is called -- produces cache v1
2. `inject-session-cache.cjs` is run -- confirms cache v1 content
3. Constitution file is modified on disk
4. `rebuildSessionCache({ projectRoot })` is called again -- produces cache v2
5. `inject-session-cache.cjs` is run -- confirms cache v2 content
**Then**:
- v1 and v2 have different hashes
- v2 cache contains the modified constitution content
- Hook output after step 5 contains the v2 content

### TC-E2E-02: Build -> Skill add -> Rebuild includes new skill (positive)
**Requirement**: FR-001, FR-007
**Priority**: P1
**Given**: A test project with initial skill files
**When**:
1. Build cache
2. Add a new SKILL.md file with `skill_id: NEW-001` to the skills directory
3. Add `NEW-001` to the manifest ownership for an agent
4. `_resetCaches()` is called (simulate cache invalidation)
5. Rebuild cache
**Then**:
- Updated SKILL_INDEX section includes `NEW-001`
- Updated cache hash differs from original

### TC-E2E-03: Build -> Remove skill -> Rebuild excludes removed skill (positive)
**Requirement**: FR-001, FR-007
**Priority**: P1
**Given**: A test project with SKILL.md for `DEL-001`
**When**:
1. Build cache (contains DEL-001 in SKILL_INDEX)
2. Delete the SKILL.md file and remove from manifest
3. `_resetCaches()` is called
4. Rebuild cache
**Then**:
- Updated SKILL_INDEX section does NOT include `DEL-001`

---

## 2. Fail-Open Scenarios

### TC-E2E-04: Complete workflow without cache (backwards compatibility) (positive)
**Requirement**: NFR-005, NFR-010
**Priority**: P0
**Given**: A test project with NO `.isdlc/session-cache.md` file
**When**: `inject-session-cache.cjs` is run at "session start"
**Then**:
- Hook exits 0 with empty stdout
- No errors on stderr
- Downstream consumers (simulated) would need to fall back to disk reads

### TC-E2E-05: Cache deleted mid-lifecycle (positive)
**Requirement**: NFR-005
**Priority**: P1
**Given**: A test project with a valid cache
**When**:
1. Verify hook outputs cache content
2. Delete `.isdlc/session-cache.md`
3. Run hook again
**Then**:
- Step 1: Hook outputs content
- Step 3: Hook exits 0 with empty stdout (fail-open)

---

## 3. CLI Round-Trip

### TC-E2E-06: CLI rebuild produces cache that hook can read (positive)
**Requirement**: FR-004, FR-002
**Priority**: P0
**Given**: A test project with all source files but NO existing cache
**When**:
1. Run `node bin/rebuild-cache.js` from the project root
2. Run `inject-session-cache.cjs` hook
**Then**:
- CLI reports success with path and size
- Hook outputs the cache content
- Cache content has valid header and section delimiters

### TC-E2E-07: CLI reports accurate size matching actual file (positive)
**Requirement**: FR-004, AC-004-03
**Priority**: P2
**Given**: A test project with source files
**When**: `node bin/rebuild-cache.js` is run and reports `Size: N`
**Then**:
- `fs.readFileSync('.isdlc/session-cache.md', 'utf8').length === N`
