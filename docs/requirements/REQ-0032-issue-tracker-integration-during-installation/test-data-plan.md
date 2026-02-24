# Test Data Plan: REQ-0032 Issue Tracker Integration During Installation

**Status**: Complete
**Last Updated**: 2026-02-22
**Requirement**: REQ-0032

---

## 1. Test Data Strategy

**Approach**: Inline test data within test files (following existing project convention).

The iSDLC project uses inline constants and helper functions for test data rather than separate fixture files. This is consistent across all existing test files (`lib/installer.test.js`, `lib/updater.test.js`, and all CJS hook tests). We follow this pattern exactly.

---

## 2. Data Categories

### 2.1 Git Remote URLs (for `detectGitHubRemote`)

| ID | Value | Expected Result | Category |
|----|-------|-----------------|----------|
| GR-01 | `git@github.com:user/proj.git` | `{ hasGitHub: true, repo: 'user/proj' }` | Valid (SSH) |
| GR-02 | `https://github.com/user/proj.git` | `{ hasGitHub: true, repo: 'user/proj' }` | Valid (HTTPS) |
| GR-03 | `https://github.com/user/proj` | `{ hasGitHub: true, repo: 'user/proj' }` | Valid (no .git) |
| GR-04 | `https://gitlab.com/user/proj.git` | `{ hasGitHub: false, repo: '' }` | Non-GitHub |
| GR-05 | `https://bitbucket.org/user/proj.git` | `{ hasGitHub: false, repo: '' }` | Non-GitHub |
| GR-06 | (no remotes configured) | `{ hasGitHub: false, repo: '' }` | Empty |
| GR-07 | (git not initialized) | `{ hasGitHub: false, repo: '' }` | Error |

### 2.2 Tracker Selection Values

| ID | Value | Description | Category |
|----|-------|-------------|----------|
| TS-01 | `'github'` | GitHub Issues selected | Valid |
| TS-02 | `'jira'` | Jira selected | Valid |
| TS-03 | `'manual'` | Manual/None selected | Valid |
| TS-04 | `'linear'` | Unknown tracker type | Invalid |
| TS-05 | `''` | Empty string | Invalid |
| TS-06 | `null` | Null value | Invalid |
| TS-07 | `undefined` | Undefined | Invalid |

### 2.3 Jira Project Keys

| ID | Value | Description | Category |
|----|-------|-------------|----------|
| JK-01 | `'PROJ'` | Standard 4-letter key | Valid |
| JK-02 | `'MY'` | Short 2-letter key | Valid |
| JK-03 | `'VERYLONGPROJECT'` | Long key | Valid |
| JK-04 | `''` | Empty string | Invalid |
| JK-05 | `'lowercase'` | Non-uppercase | Edge case |
| JK-06 | `'123'` | Numeric-only | Edge case |
| JK-07 | `'A-B'` | Contains dash | Edge case |

### 2.4 detectSource Input Data

| ID | Input | Options | Expected Source | Category |
|----|-------|---------|----------------|----------|
| DS-01 | `'#42'` | none | github | Explicit GitHub pattern |
| DS-02 | `'#42'` | `{ issueTracker: 'jira' }` | github | Explicit wins |
| DS-03 | `'PROJ-123'` | none | jira | Explicit Jira pattern |
| DS-04 | `'PROJ-123'` | `{ issueTracker: 'github' }` | jira | Explicit wins |
| DS-05 | `'1234'` | none | manual | No options, bare number |
| DS-06 | `'1234'` | `{ issueTracker: 'jira', jiraProjectKey: 'PROJ' }` | jira | Bare number + jira |
| DS-07 | `'42'` | `{ issueTracker: 'github' }` | github | Bare number + github |
| DS-08 | `'42'` | `{ issueTracker: 'manual' }` | manual | Bare number + manual |
| DS-09 | `'1234'` | `{}` | manual | Empty options |
| DS-10 | `'1234'` | `{ issueTracker: 'jira' }` | manual | Missing key |
| DS-11 | `'1234'` | `{ issueTracker: 'jira', jiraProjectKey: '' }` | manual | Empty key |
| DS-12 | `'fix login bug'` | `{ issueTracker: 'jira', jiraProjectKey: 'PROJ' }` | manual | Not a number |
| DS-13 | `null` | `{ issueTracker: 'jira' }` | manual | Null input |
| DS-14 | `undefined` | none | manual | Undefined input |
| DS-15 | `''` | `{ issueTracker: 'github' }` | manual | Empty input |
| DS-16 | `'0'` | `{ issueTracker: 'jira', jiraProjectKey: 'PROJ' }` | jira | Boundary: zero |
| DS-17 | `'999999999'` | `{ issueTracker: 'github' }` | github | Boundary: large number |
| DS-18 | `'00042'` | `{ issueTracker: 'jira', jiraProjectKey: 'PROJ' }` | jira | Leading zeros |
| DS-19 | `'$42'` | `{ issueTracker: 'github' }` | manual | Regex special chars |
| DS-20 | `'42'` | `{ issueTracker: 'linear' }` | manual | Unknown tracker |

### 2.5 CLAUDE.md Section Content (for parsing tests)

| ID | Content | Expected Tracker | Category |
|----|---------|------------------|----------|
| SC-01 | `**Tracker**: github\n**Jira Project Key**:\n**GitHub Repository**: user/proj` | github | Valid GitHub |
| SC-02 | `**Tracker**: jira\n**Jira Project Key**: MYPROJ\n**GitHub Repository**:` | jira | Valid Jira |
| SC-03 | `**Tracker**: manual\n**Jira Project Key**:\n**GitHub Repository**:` | manual | Valid Manual |
| SC-04 | (section missing entirely) | null (fallback) | Missing |
| SC-05 | `**Tracker**: \n**Jira Project Key**:\n**GitHub Repository**:` | null (empty tracker) | Malformed |

---

## 3. Test Environment Setup

### 3.1 ESM Tests (lib/installer.test.js)

Each test creates an isolated temporary directory using `createTempDir()` from `lib/utils/test-helpers.js`. The directory contains:
- `package.json` (minimal: `{ "name": "test", "version": "1.0.0" }`)
- `.git/` (via `git init`)
- Optionally: git remotes (via `git remote add origin <url>`)

Tests run `node bin/isdlc.js init --force` as a subprocess and inspect the resulting filesystem.

### 3.2 CJS Tests (detect-source-options.test.cjs)

Tests directly import `detectSource` from `three-verb-utils.cjs`. No filesystem setup needed -- `detectSource` is a pure function. Test data is provided as inline constants.

### 3.3 Cleanup

All temporary directories are cleaned up in `after()` hooks using `cleanupTempDir()`.

---

## 4. Data Generation Rules

1. **No external data sources**: All test data is hardcoded in test files (deterministic)
2. **No database fixtures**: The project has no database (JSON file state only)
3. **No API mocking libraries**: Subprocess approach tests real code paths
4. **Boundary values**: Include 0, 1, max int, empty strings, null, undefined for all inputs
5. **Cross-platform**: Path separators use `path.join()` (no hardcoded `/` or `\`)
