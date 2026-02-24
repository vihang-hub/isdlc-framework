# Test Cases: BACKLOG.md Scaffolding

**REQ ID**: REQ-0014
**Phase**: 05-test-strategy
**Created**: 2026-02-14
**Total Test Cases**: 18

---

## Category 1: Content Validation (Unit-Level via Integration)

These tests validate the content produced by `generateBacklogMd()` by examining the BACKLOG.md file created during `isdlc init --force`. Since `generateBacklogMd()` is module-private, we validate its output through the end-to-end install flow.

**Location**: `lib/installer.test.js` -- new describe block `'installer: BACKLOG.md content validation'`

---

### TC-01: BACKLOG.md contains title header

**Traces**: AC-04, NFR-01
**Priority**: P0

**Given**: A fresh project directory with package.json and git init
**When**: `isdlc init --force` is run
**Then**: The created BACKLOG.md contains `# Project Backlog` as the first non-empty line

**Assertions**:
```javascript
const content = readFileSync(join(projectDir, 'BACKLOG.md'), 'utf-8');
assert.ok(content.startsWith('# Project Backlog'), 'should start with title');
```

---

### TC-02: BACKLOG.md contains preamble blockquote

**Traces**: AC-04, NFR-01
**Priority**: P0

**Given**: A fresh project directory with package.json and git init
**When**: `isdlc init --force` is run
**Then**: The created BACKLOG.md contains a blockquote preamble explaining its purpose

**Assertions**:
```javascript
const content = readFileSync(join(projectDir, 'BACKLOG.md'), 'utf-8');
assert.ok(content.includes('> Backlog and completed items are tracked here.'), 'should have preamble');
assert.ok(content.includes('> This file is NOT loaded into every conversation'), 'should have context warning');
```

---

### TC-03: BACKLOG.md contains ## Open section header

**Traces**: AC-02, NFR-01
**Priority**: P0

**Given**: A fresh project directory with package.json and git init
**When**: `isdlc init --force` is run
**Then**: The created BACKLOG.md contains `## Open` as an exact level-2 heading

**Assertions**:
```javascript
const content = readFileSync(join(projectDir, 'BACKLOG.md'), 'utf-8');
assert.ok(content.includes('\n## Open\n'), 'should contain ## Open section');
```

---

### TC-04: BACKLOG.md contains ## Completed section header

**Traces**: AC-03, NFR-01
**Priority**: P0

**Given**: A fresh project directory with package.json and git init
**When**: `isdlc init --force` is run
**Then**: The created BACKLOG.md contains `## Completed` as an exact level-2 heading

**Assertions**:
```javascript
const content = readFileSync(join(projectDir, 'BACKLOG.md'), 'utf-8');
assert.ok(content.includes('\n## Completed\n'), 'should contain ## Completed section');
```

---

### TC-05: BACKLOG.md ends with trailing newline

**Traces**: NFR-01
**Priority**: P1

**Given**: A fresh project directory with package.json and git init
**When**: `isdlc init --force` is run
**Then**: The created BACKLOG.md file ends with exactly one newline character

**Assertions**:
```javascript
const content = readFileSync(join(projectDir, 'BACKLOG.md'), 'utf-8');
assert.ok(content.endsWith('\n'), 'should end with trailing newline');
assert.ok(!content.endsWith('\n\n'), 'should not end with double newline');
```

---

### TC-06: ## Open appears before ## Completed

**Traces**: AC-05, NFR-01
**Priority**: P0

**Given**: A fresh project directory with package.json and git init
**When**: `isdlc init --force` is run
**Then**: The `## Open` heading appears at a lower character index than `## Completed`

**Assertions**:
```javascript
const content = readFileSync(join(projectDir, 'BACKLOG.md'), 'utf-8');
const openIndex = content.indexOf('## Open');
const completedIndex = content.indexOf('## Completed');
assert.ok(openIndex > -1 && completedIndex > -1, 'both sections must exist');
assert.ok(openIndex < completedIndex, '## Open must appear before ## Completed');
```

---

## Category 2: Integration Tests (Install Flow)

These tests validate that BACKLOG.md is correctly created as part of the full install flow.

**Location**: `lib/installer.test.js` -- new describe block `'installer: BACKLOG.md created during init'`

---

### TC-07: BACKLOG.md is created at project root during init

**Traces**: AC-01, FR-01
**Priority**: P0

**Given**: A fresh project directory with package.json and git init, no BACKLOG.md present
**When**: `isdlc init --force` is run
**Then**: `BACKLOG.md` exists at the project root

**Assertions**:
```javascript
assert.ok(existsSync(join(projectDir, 'BACKLOG.md')), 'BACKLOG.md should exist at project root');
```

---

### TC-08: BACKLOG.md is not empty

**Traces**: AC-01, AC-02, AC-03
**Priority**: P1

**Given**: A fresh project directory
**When**: `isdlc init --force` is run
**Then**: The created BACKLOG.md has non-zero length with meaningful content

**Assertions**:
```javascript
const content = readFileSync(join(projectDir, 'BACKLOG.md'), 'utf-8');
assert.ok(content.length > 50, 'BACKLOG.md should have meaningful content');
```

---

### TC-09: BACKLOG.md has no backlog items (empty sections)

**Traces**: NFR-01 (out-of-scope constraint: no items)
**Priority**: P1

**Given**: A fresh project directory
**When**: `isdlc init --force` is run
**Then**: The BACKLOG.md sections contain no list items (no lines starting with `- `)

**Assertions**:
```javascript
const content = readFileSync(join(projectDir, 'BACKLOG.md'), 'utf-8');
const lines = content.split('\n');
const itemLines = lines.filter(line => line.match(/^- /));
assert.equal(itemLines.length, 0, 'BACKLOG.md should have no backlog items');
```

---

### TC-10: BACKLOG.md created alongside other install artifacts

**Traces**: NFR-02 (placement consistency)
**Priority**: P1

**Given**: A fresh project directory
**When**: `isdlc init --force` is run
**Then**: BACKLOG.md, CLAUDE.md, and .isdlc/state.json all exist (BACKLOG.md created in same flow)

**Assertions**:
```javascript
assert.ok(existsSync(join(projectDir, 'BACKLOG.md')), 'BACKLOG.md should exist');
assert.ok(existsSync(join(projectDir, 'CLAUDE.md')), 'CLAUDE.md should exist');
assert.ok(existsSync(join(projectDir, '.isdlc', 'state.json')), 'state.json should exist');
```

---

### TC-11: BACKLOG.md not tracked in installed-files.json manifest

**Traces**: AC-10 (not in removal paths -- manifest is the removal source)
**Priority**: P1

**Given**: A fresh project directory
**When**: `isdlc init --force` is run
**Then**: `installed-files.json` does not contain any entry referencing `BACKLOG.md`

**Assertions**:
```javascript
const manifest = JSON.parse(readFileSync(join(projectDir, '.isdlc', 'installed-files.json'), 'utf-8'));
const backlogEntries = manifest.files.filter(f => f.includes('BACKLOG'));
assert.equal(backlogEntries.length, 0, 'BACKLOG.md should NOT be in the install manifest');
```

---

## Category 3: Guard Tests (Skip + Dry-Run)

**Location**: `lib/installer.test.js` -- new describe blocks

---

### TC-12: Existing BACKLOG.md is not overwritten

**Traces**: AC-06, FR-02
**Priority**: P0

**Given**: A project directory with a pre-existing BACKLOG.md containing custom content (`# My Custom Backlog\n\nUser data here.\n`)
**When**: `isdlc init --force` is run
**Then**: The BACKLOG.md content is unchanged (still contains the custom content)

**Assertions**:
```javascript
const customContent = '# My Custom Backlog\n\nUser data here.\n';
writeFileSync(join(projectDir, 'BACKLOG.md'), customContent, 'utf-8');
runInit(projectDir);
const after = readFileSync(join(projectDir, 'BACKLOG.md'), 'utf-8');
assert.equal(after, customContent, 'BACKLOG.md should be preserved when it already exists');
```

---

### TC-13: Skip message is emitted when BACKLOG.md exists

**Traces**: AC-07
**Priority**: P1

**Given**: A project directory with a pre-existing BACKLOG.md
**When**: `isdlc init --force` is run
**Then**: The installer output contains a skip message (e.g., "already exists" or "skipping")

**Assertions**:
```javascript
const output = runInit(projectDir);
assert.ok(
  output.includes('already exists') || output.includes('skipping'),
  'output should indicate BACKLOG.md creation was skipped'
);
```

---

### TC-14: Dry-run does not create BACKLOG.md

**Traces**: AC-08, FR-03
**Priority**: P0

**Given**: A fresh project directory with no BACKLOG.md
**When**: `isdlc init --force --dry-run` is run
**Then**: BACKLOG.md does NOT exist at the project root

**Assertions**:
```javascript
assert.ok(
  !existsSync(join(projectDir, 'BACKLOG.md')),
  'BACKLOG.md should NOT exist after dry-run'
);
```

---

### TC-15: Dry-run still emits creation log message

**Traces**: AC-09
**Priority**: P1

**Given**: A fresh project directory with no BACKLOG.md
**When**: `isdlc init --force --dry-run` is run
**Then**: The output contains a BACKLOG.md creation message (consistent with other dry-run log behavior)

**Assertions**:
```javascript
const output = runInit(projectDir, '--dry-run');
assert.ok(
  output.includes('BACKLOG') || output.includes('backlog'),
  'dry-run output should mention BACKLOG.md creation'
);
```

---

## Category 4: Uninstaller Preservation

**Location**: `lib/uninstaller.test.js` -- new describe block `'uninstaller: BACKLOG.md is preserved'`

---

### TC-16: BACKLOG.md survives standard uninstall

**Traces**: AC-11, FR-04
**Priority**: P0

**Given**: A project with `isdlc init --force` completed (BACKLOG.md exists)
**When**: `isdlc uninstall --force` is run
**Then**: BACKLOG.md still exists at the project root with unchanged content

**Assertions**:
```javascript
const contentBefore = readFileSync(join(projectDir, 'BACKLOG.md'), 'utf-8');
runUninstall(projectDir);
assert.ok(existsSync(join(projectDir, 'BACKLOG.md')), 'BACKLOG.md should survive uninstall');
const contentAfter = readFileSync(join(projectDir, 'BACKLOG.md'), 'utf-8');
assert.equal(contentAfter, contentBefore, 'BACKLOG.md content should be unchanged');
```

---

### TC-17: BACKLOG.md survives purge-all uninstall

**Traces**: AC-11, FR-04
**Priority**: P0

**Given**: A project with `isdlc init --force` completed (BACKLOG.md exists)
**When**: `isdlc uninstall --force --purge-all` is run
**Then**: BACKLOG.md still exists at the project root

**Assertions**:
```javascript
runUninstall(projectDir, '--purge-all');
assert.ok(existsSync(join(projectDir, 'BACKLOG.md')), 'BACKLOG.md should survive --purge-all');
```

---

### TC-18: Uninstaller source has zero BACKLOG references

**Traces**: AC-10, AC-12
**Priority**: P0

**Given**: The source file `lib/uninstaller.js`
**When**: Its content is searched for the string `BACKLOG` (case-insensitive)
**Then**: Zero matches are found

**Assertions**:
```javascript
const uninstallerSource = readFileSync(join(__dirname, 'uninstaller.js'), 'utf-8');
const matches = uninstallerSource.match(/backlog/gi);
assert.equal(matches, null, 'uninstaller.js should have zero references to BACKLOG');
```

---

## Coverage Validation Summary

### AC-to-Test Mapping

| AC | Description | Test Cases | Count |
|----|------------|-----------|-------|
| AC-01 | BACKLOG.md created at projectRoot | TC-07, TC-08, TC-10 | 3 |
| AC-02 | Contains `## Open` header | TC-03, TC-08 | 2 |
| AC-03 | Contains `## Completed` header | TC-04, TC-08 | 2 |
| AC-04 | Includes preamble | TC-01, TC-02 | 2 |
| AC-05 | `## Open` before `## Completed` | TC-06 | 1 |
| AC-06 | Skip if exists | TC-12 | 1 |
| AC-07 | Log on skip | TC-13 | 1 |
| AC-08 | Dry-run no write | TC-14 | 1 |
| AC-09 | Dry-run log emitted | TC-15 | 1 |
| AC-10 | Not in removal paths | TC-11, TC-18 | 2 |
| AC-11 | Survives uninstall + purge | TC-16, TC-17 | 2 |
| AC-12 | No code reference in uninstaller | TC-18 | 1 |

**Result: 12/12 ACs covered (100%)**

### NFR-to-Test Mapping

| NFR | Description | Test Cases | Count |
|-----|------------|-----------|-------|
| NFR-01 | Format consistency | TC-01, TC-02, TC-03, TC-04, TC-05, TC-06, TC-09 | 7 |
| NFR-02 | Placement consistency | TC-10 | 1 |

**Result: 2/2 NFRs covered (100%)**

### FR-to-Test Mapping

| FR | Description | Test Cases | Count |
|----|------------|-----------|-------|
| FR-01 | Create BACKLOG.md | TC-01-TC-10 | 10 |
| FR-02 | Skip if exists | TC-12, TC-13 | 2 |
| FR-03 | Respect dry-run | TC-14, TC-15 | 2 |
| FR-04 | Uninstaller preservation | TC-16, TC-17, TC-18 | 3 |

**Result: 4/4 FRs covered (100%)**
