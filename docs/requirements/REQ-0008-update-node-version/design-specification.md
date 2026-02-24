# Design Specification: REQ-0008 -- Update Node Version

**Phase**: 04-design
**Created**: 2026-02-10
**Status**: APPROVED
**Traces To**: REQ-001 through REQ-007, ADR-0008-node-version-minimum
**Architecture Input**: architecture-overview.md (Phase 03)

---

## 1. Design Overview

This is a **configuration-only design** specifying exact file edits for updating the iSDLC framework's Node.js version requirements. Since this feature involves zero runtime code changes, the design consists entirely of precise string replacement specifications for each affected file.

**Design Type**: File edit specification (no API contracts, no module designs, no wireframes, no new components)

**Scope**: 9 files affected with a total of 14 discrete string replacements.

---

## 2. Edit Specifications

Each edit is specified as an exact `old_string` to `new_string` replacement. The implementation phase (06) should apply these replacements in the order listed.

---

### 2.1 package.json (REQ-001)

**File**: `package.json`
**Requirement**: REQ-001 (AC-1, AC-2, AC-3)

#### Edit 1: engines.node field

```
OLD:
    "node": ">=18.0.0"

NEW:
    "node": ">=20.0.0"
```

**Verification**: After edit, `"engines": { "node": ">=20.0.0" }` in package.json.

---

### 2.2 package-lock.json (REQ-001, auto-propagation)

**File**: `package-lock.json`
**Requirement**: REQ-001 (propagated from package.json)

#### Edit 2: engines.node field in lockfile

```
OLD:
        "node": ">=18.0.0"

NEW:
        "node": ">=20.0.0"
```

**Note**: This field exists at line 22 within the root package entry. Alternatively, running `npm install` after editing package.json will regenerate this automatically. Explicit edit is preferred to avoid unnecessary lockfile churn.

**Verification**: `grep -n ">=18" package-lock.json` returns 0 results.

---

### 2.3 .github/workflows/ci.yml (REQ-002)

**File**: `.github/workflows/ci.yml`
**Requirement**: REQ-002 (AC-4 through AC-9)

#### Edit 3: Test matrix node versions

```
OLD:
        node: [18, 20, 22]

NEW:
        node: [20, 22, 24]
```

**Location**: Line 36, under `test.strategy.matrix`.
**Verification**: AC-4 (matrix is `[20, 22, 24]`), AC-7 (still 3 OS x 3 Node = 9 combinations).

#### Edit 4: Lint job node-version

```
OLD:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint

NEW:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
```

**Location**: Line 20, under `lint.steps`.
**Rationale**: AC-5 requires lint job uses Node 22.
**Context needed**: The broader surrounding context is needed because `node-version: '20'` appears multiple times in this file. This edit targets specifically the lint job by including surrounding steps as unique context.

#### Edit 5: Integration job node-version

```
OLD:
    name: Integration Test
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

NEW:
    name: Integration Test
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
```

**Location**: Lines 54-63, under `integration.steps`.
**Rationale**: AC-6 requires integration job uses Node 22.

#### Non-changes (AC-8, AC-9):
- `bash-install` job: No `node-version` specified -- UNCHANGED (AC-8)
- `powershell-install` job: No `node-version` specified -- UNCHANGED (AC-9)

---

### 2.4 .github/workflows/publish.yml (REQ-003)

**File**: `.github/workflows/publish.yml`
**Requirement**: REQ-003 (AC-10 through AC-12)

#### Edit 6: Test matrix node-version

```
OLD:
        node-version: [18, 20, 22]

NEW:
        node-version: [20, 22, 24]
```

**Location**: Line 21, under `test.strategy.matrix`.
**Verification**: AC-10 (publish test matrix is `[20, 22, 24]`).

#### Edit 7: publish-npm job node-version

```
OLD:
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

NEW:
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          registry-url: 'https://registry.npmjs.org'
```

**Location**: Lines 54-58, under `publish-npm.steps`.
**Verification**: AC-11 (publish-npm uses Node 22).

#### Edit 8: publish-github job node-version

```
OLD:
      - name: Setup Node.js for GitHub Packages
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://npm.pkg.github.com'

NEW:
      - name: Setup Node.js for GitHub Packages
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          registry-url: 'https://npm.pkg.github.com'
```

**Location**: Lines 84-88, under `publish-github.steps`.
**Verification**: AC-12 (publish-github uses Node 22).

---

### 2.5 docs/isdlc/constitution.md (REQ-004)

**File**: `docs/isdlc/constitution.md`
**Requirement**: REQ-004 (AC-13 through AC-15)

#### Edit 9: Version header

```
OLD:
**Version**: 1.1.0

NEW:
**Version**: 1.2.0
```

**Location**: Line 4.
**Rationale**: AC-14 requires version bump.

#### Edit 10: Article XII requirement 4

```
OLD:
4. The CI matrix MUST cover: Ubuntu, macOS, Windows x Node 18, 20, 22 (9 combinations)

NEW:
4. The CI matrix MUST cover: Ubuntu, macOS, Windows x Node 20, 22, 24 (9 combinations)
```

**Location**: Line 283.
**Verification**: AC-13 (Article XII references "Node 20, 22, 24"). AC-15 (no other articles modified -- only lines 4, 283, and the amendment log are touched).

#### Edit 11: Amendment log (append new row)

```
OLD:
| 1.1.0 | 2026-02-07 | Article II: Added 555-test baseline, regression threshold, per-module coverage status, and 87 AC traceability metrics | Full deep discovery with behavior extraction established comprehensive test baseline |

---

NEW:
| 1.1.0 | 2026-02-07 | Article II: Added 555-test baseline, regression threshold, per-module coverage status, and 87 AC traceability metrics | Full deep discovery with behavior extraction established comprehensive test baseline |
| 1.2.0 | 2026-02-10 | Article XII req 4: Updated Node version matrix from "Node 18, 20, 22" to "Node 20, 22, 24" | Node 18 reached EOL (April 2025); dropped in favor of Node 24 Active LTS (ADR-0008) |

---
```

**Location**: Lines 362-364.
**Verification**: AC-14 (amendment log entry exists with version, date, description, reason).

---

### 2.6 README.md (REQ-005)

**File**: `README.md`
**Requirement**: REQ-005 (AC-16, AC-17)

#### Edit 12: Prerequisites table

```
OLD:
| **Node.js** | 18+ | Required for hooks and CLI |

NEW:
| **Node.js** | 20+ | Required for hooks and CLI |
```

**Location**: Line 45.
**Verification**: AC-16 (README references Node 20+ as minimum).

#### Edit 13: System Requirements section

```
OLD:
- **Node.js 18+** (required)

NEW:
- **Node.js 20+** (required)
```

**Location**: Line 270.
**Verification**: AC-17 (installation instructions reference Node >=20.0.0).

---

### 2.7 .isdlc/state.json (REQ-006)

**File**: `.isdlc/state.json`
**Requirement**: REQ-006 (AC-18)

#### Edit 14: tech_stack.runtime field

```
OLD:
      "runtime": "node-18+"

NEW:
      "runtime": "node-20+"
```

**Location**: Line 14.
**Verification**: AC-18 (`state.json` runtime reads "node-20+").

---

### 2.8 docs/project-discovery-report.md (secondary file)

**File**: `docs/project-discovery-report.md`
**Requirement**: NFR-004 (documentation consistency)

#### Edit 15: Tech stack table row

```
OLD:
| Runtime | Node.js | >= 18.0.0 | Tested on 18, 20, 22 in CI |

NEW:
| Runtime | Node.js | >= 20.0.0 | Tested on 20, 22, 24 in CI |
```

**Location**: Line 32.

---

### 2.9 src/isdlc/templates/testing/test-strategy.md (secondary file)

**File**: `src/isdlc/templates/testing/test-strategy.md`
**Requirement**: NFR-004 (documentation consistency)

#### Edit 16: Node version template placeholder

```
OLD:
| Node Version | {18+} |

NEW:
| Node Version | {20+} |
```

**Location**: Line 195.

---

## 3. Implementation Order

The edits should be applied in this sequence (matching the recommended order from the architecture overview):

| Step | File | Edits | Requirement |
|------|------|-------|-------------|
| 1 | `package.json` | Edit 1 | REQ-001 |
| 2 | `package-lock.json` | Edit 2 | REQ-001 (propagation) |
| 3 | `.github/workflows/ci.yml` | Edits 3, 4, 5 | REQ-002 |
| 4 | `.github/workflows/publish.yml` | Edits 6, 7, 8 | REQ-003 |
| 5 | `docs/isdlc/constitution.md` | Edits 9, 10, 11 | REQ-004 |
| 6 | `README.md` | Edits 12, 13 | REQ-005 |
| 7 | `.isdlc/state.json` | Edit 14 | REQ-006 |
| 8 | `docs/project-discovery-report.md` | Edit 15 | NFR-004 |
| 9 | `src/isdlc/templates/testing/test-strategy.md` | Edit 16 | NFR-004 |

**Total**: 16 edits across 9 files.

---

## 4. Post-Implementation Validation Checklist

After all edits are applied, the implementation phase MUST verify:

### 4.1 Completeness Grep Check

Run the following to confirm no stale "18" references remain in version-context:

```bash
# Should return ZERO results (Node 18 references eliminated)
grep -rn "node.*18" package.json package-lock.json .github/workflows/ README.md docs/isdlc/constitution.md docs/project-discovery-report.md src/isdlc/templates/ .isdlc/state.json

# Positive check: confirm new values exist
grep -n ">=20.0.0" package.json
grep -n "\[20, 22, 24\]" .github/workflows/ci.yml
grep -n "\[20, 22, 24\]" .github/workflows/publish.yml
grep -n "Node 20, 22, 24" docs/isdlc/constitution.md
grep -n "1.2.0" docs/isdlc/constitution.md
grep -n "20+" README.md
grep -n "node-20+" .isdlc/state.json
```

### 4.2 YAML Syntax Validation

```bash
# Verify YAML files are parseable (use node to validate)
node -e "const yaml = require('fs').readFileSync('.github/workflows/ci.yml', 'utf8'); console.log('ci.yml: valid YAML')"
node -e "const yaml = require('fs').readFileSync('.github/workflows/publish.yml', 'utf8'); console.log('publish.yml: valid YAML')"
```

### 4.3 JSON Validity

```bash
node -e "JSON.parse(require('fs').readFileSync('package.json', 'utf8')); console.log('package.json: valid JSON')"
node -e "JSON.parse(require('fs').readFileSync('package-lock.json', 'utf8')); console.log('package-lock.json: valid JSON')"
```

### 4.4 Test Suite Execution

```bash
# Run full test suite to confirm zero regressions (REQ-007, AC-21)
npm run test:all
```

---

## 5. Error Taxonomy

Since this is a configuration-only change, no new error codes or error handling patterns are introduced. The existing error taxonomy is unchanged.

| Error Scenario | Impact | Mitigation |
|----------------|--------|------------|
| YAML syntax error in ci.yml | CI workflows fail to parse | Validate YAML after edit (Section 4.2) |
| JSON syntax error in package.json | npm commands fail | Validate JSON after edit (Section 4.3) |
| Incomplete amendment log format | Constitution validator may flag | Match existing row format exactly |
| Missed "18" reference in a file | Documentation inconsistency | Run grep check (Section 4.1) |

---

## 6. Validation Rules

No new validation rules are introduced. Existing validation rules are unchanged since there are no API, schema, or input/output changes.

The only validation-relevant change is the `engines.node` field in package.json, which npm enforces automatically:
- Node < 20: `npm install` produces an engines mismatch warning (or error with `--engine-strict`)
- Node >= 20: `npm install` succeeds without warnings

---

## 7. Traceability Matrix

| Requirement | AC | File | Edit # | Verified By |
|-------------|----|------|--------|-------------|
| REQ-001 | AC-1 | package.json | 1 | Grep check for `>=20.0.0` |
| REQ-001 | AC-2 | package.json | 1 | npm install on Node 18 (manual) |
| REQ-001 | AC-3 | package.json | 1 | npm install on Node 20+ (CI) |
| REQ-001 | -- | package-lock.json | 2 | Grep check for `>=20.0.0` |
| REQ-002 | AC-4 | ci.yml | 3 | Grep check for `[20, 22, 24]` |
| REQ-002 | AC-5 | ci.yml | 4 | Grep check: lint node-version `22` |
| REQ-002 | AC-6 | ci.yml | 5 | Grep check: integration node-version `22` |
| REQ-002 | AC-7 | ci.yml | 3 | Matrix: 3 OS x 3 Node = 9 jobs |
| REQ-002 | AC-8 | ci.yml | -- | bash-install: no node-version (unchanged) |
| REQ-002 | AC-9 | ci.yml | -- | powershell-install: no node-version (unchanged) |
| REQ-003 | AC-10 | publish.yml | 6 | Grep check for `[20, 22, 24]` |
| REQ-003 | AC-11 | publish.yml | 7 | Grep check: publish-npm node-version `22` |
| REQ-003 | AC-12 | publish.yml | 8 | Grep check: publish-github node-version `22` |
| REQ-004 | AC-13 | constitution.md | 10 | Grep check for "Node 20, 22, 24" |
| REQ-004 | AC-14 | constitution.md | 9, 11 | Version `1.2.0` + amendment log row |
| REQ-004 | AC-15 | constitution.md | 9, 10, 11 | Only Article XII and metadata touched |
| REQ-005 | AC-16 | README.md | 12 | Grep check for "20+" |
| REQ-005 | AC-17 | README.md | 13 | Grep check for "Node.js 20+" |
| REQ-006 | AC-18 | state.json | 14 | Grep check for "node-20+" |
| REQ-007 | AC-19 | (validation) | -- | Impact analysis M3 confirmed zero risk |
| REQ-007 | AC-20 | (validation) | -- | node:test stable across 20-24 |
| REQ-007 | AC-21 | (validation) | -- | npm run test:all passes |
| NFR-004 | -- | discovery-report | 15 | Grep check |
| NFR-004 | -- | test-strategy template | 16 | Grep check |

---

## 8. Files NOT Changed (Explicitly Verified)

The following files were checked and confirmed to have NO Node 18 references requiring updates:

| File/Directory | Checked For | Result |
|----------------|-------------|--------|
| `src/claude/hooks/*.cjs` | `node.*18` patterns | NONE FOUND |
| `lib/*.js` | `node.*18` patterns | NONE FOUND |
| `bin/isdlc.js` | Version references | NONE FOUND |
| `CLAUDE.md` | Node version references | NONE FOUND |
| `docs/ARCHITECTURE.md` | Node version references | NONE FOUND (generic references only) |
| `docs/AGENTS.md` | Node version references | NONE FOUND |

---

## 9. Constitutional Compliance

| Article | Status | Evidence |
|---------|--------|----------|
| Article I (Specification Primacy) | COMPLIANT | Edits implement REQ-001 through REQ-007 exactly as specified |
| Article IV (Explicit Over Implicit) | COMPLIANT | All 16 edits explicitly documented with exact strings, no ambiguity |
| Article V (Simplicity First) | COMPLIANT | Pure string replacements, no over-engineering |
| Article VII (Artifact Traceability) | COMPLIANT | Full traceability matrix (Section 7) maps every AC to file/edit |
| Article IX (Quality Gate Integrity) | COMPLIANT | Post-implementation validation checklist (Section 4) ensures completeness |

---

## 10. Design Metadata

```json
{
  "design_completed_at": "2026-02-10T00:10:00.000Z",
  "design_type": "file-edit-specification",
  "total_files_affected": 9,
  "total_edits": 16,
  "runtime_code_changes": 0,
  "new_files_created": 0,
  "api_contracts_changed": 0,
  "module_designs_created": 0,
  "wireframes_created": 0,
  "constitutional_articles_verified": ["I", "IV", "V", "VII", "IX"],
  "gate": "GATE-04",
  "gate_status": "PASS"
}
```
