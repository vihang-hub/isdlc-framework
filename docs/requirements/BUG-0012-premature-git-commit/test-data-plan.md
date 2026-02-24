# Test Data Plan: BUG-0012 -- Premature Git Commit During Implementation

**Bug ID**: BUG-0012
**Phase**: 05-test-strategy
**Created**: 2026-02-13

---

## 1. State Fixture Definitions

All state fixtures are written via the existing `writeState(tmpDir, state)` helper in `branch-guard.test.cjs`.

### 1.1 Standard Fix Workflow State

Used by: T15, T16, T17, T24, T26

```javascript
const STANDARD_FIX_WORKFLOW = {
    active_workflow: {
        type: 'fix',
        current_phase: '06-implementation',  // varies per test
        phases: [
            '01-requirements',
            '02-tracing',
            '05-test-strategy',
            '06-implementation',
            '16-quality-loop',
            '08-code-review'
        ],
        git_branch: {
            name: 'bugfix/BUG-0012-test',
            status: 'active'
        }
    }
};
```

### 1.2 Standard Feature Workflow State

Used by: T15 (feature variant), T17, T18, T25

```javascript
const STANDARD_FEATURE_WORKFLOW = {
    active_workflow: {
        type: 'feature',
        current_phase: '06-implementation',  // varies per test
        phases: [
            '01-requirements',
            '02-tracing',
            '05-test-strategy',
            '06-implementation',
            '16-quality-loop',
            '08-code-review'
        ],
        git_branch: {
            name: 'feature/REQ-test',
            status: 'active'
        }
    }
};
```

### 1.3 Non-Standard Workflow State (Quality-Loop as Last Phase)

Used by: T25

```javascript
const SHORT_WORKFLOW = {
    active_workflow: {
        type: 'feature',
        current_phase: '16-quality-loop',
        phases: [
            '01-requirements',
            '06-implementation',
            '16-quality-loop'
        ],
        git_branch: {
            name: 'feature/REQ-test',
            status: 'active'
        }
    }
};
```

### 1.4 Missing Fields States

Used by: T21, T22

```javascript
// Missing current_phase
const MISSING_CURRENT_PHASE = {
    active_workflow: {
        type: 'fix',
        phases: ['01-requirements', '06-implementation', '08-code-review'],
        git_branch: { name: 'feature/REQ-test', status: 'active' }
    }
};

// Missing phases array
const MISSING_PHASES = {
    active_workflow: {
        type: 'fix',
        current_phase: '06-implementation',
        git_branch: { name: 'feature/REQ-test', status: 'active' }
    }
};
```

### 1.5 Empty / No Workflow State

Used by: T19

```javascript
const NO_WORKFLOW = {};
```

### 1.6 Non-Matching Branch State

Used by: T20

```javascript
const NON_MATCHING_BRANCH = {
    active_workflow: {
        type: 'feature',
        current_phase: '06-implementation',
        phases: ['01-requirements', '06-implementation', '16-quality-loop', '08-code-review'],
        git_branch: {
            name: 'feature/REQ-test',
            status: 'active'
        }
    }
};
// Test will set git repo to branch "hotfix/urgent" (not matching feature/REQ-test)
```

## 2. Git Repo Fixtures

All test repos are created via the existing `setupGitRepo(tmpDir, branchName)` helper.

| Fixture | Branch Name | Used By |
|---------|-------------|---------|
| Feature branch | `feature/REQ-test` | T15, T17, T18, T19, T21, T22, T23, T25 |
| Bugfix branch | `bugfix/BUG-0012-test` | T16, T24 |
| Main branch | `main` | T26 |
| Non-workflow branch | `hotfix/urgent` | T20 |

## 3. Stdin Input Fixtures

All inputs are created via the existing `makeStdin(command)` helper.

| Fixture | Command | Used By |
|---------|---------|---------|
| Standard commit | `git commit -m "msg"` | T15-T22, T24-T26 |
| Chained add+commit | `git add -A && git commit -m "msg"` | (covered by existing T9) |
| Add only | `git add -A` | T23 |

## 4. Agent File Paths

Used by content tests (T27-T31):

| File | Used By |
|------|---------|
| `src/claude/agents/05-software-developer.md` | T27, T28, T29 |
| `src/claude/agents/16-quality-loop-engineer.md` | T30, T31 |

These paths are resolved relative to the test file location using `path.resolve(__dirname, '..', '..', 'agents', '<filename>')`.

## 5. Expected Block Message Patterns

For tests that validate error message content (T24):

| Pattern | Purpose | Test |
|---------|---------|------|
| `/implementation\|06-implementation/i` | Phase name in message | T24 |
| `/stash/i` | git stash suggestion | T24 |
| `/orchestrator/i` | Orchestrator manages commits | T24 |

## 6. Data Generation Notes

- No external data sources needed -- all fixtures are inline JSON
- No database or network dependencies
- Each test creates its own isolated temp directory (standard pattern)
- Temp directories are cleaned up in `afterEach()` hooks
- Git repos use minimal history (1 initial commit) to reduce test latency
