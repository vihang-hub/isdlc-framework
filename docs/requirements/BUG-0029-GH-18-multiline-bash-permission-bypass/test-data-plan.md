# Test Data Plan: BUG-0029-GH-18 Multiline Bash Permission Bypass

**Bug ID:** BUG-0029-GH-18
**Phase:** 05-test-strategy
**Date:** 2026-02-20 (updated from 2026-02-19)

---

## Overview

This bug fix modifies static Markdown files. The test data falls into two categories:

1. **Production files** (read directly): The actual `.md` files in `src/claude/agents/` and `src/claude/commands/` that are the target of the fix
2. **Synthetic test strings** (embedded in the test file): Constructed Markdown snippets used to validate the detection algorithm itself

No test fixtures directory is needed. No temp files are created. No database seeding is required.

---

## Production File Test Data

These are the real files read by tests TC-MLB-01 through TC-MLB-18 and TC-MLB-22/23.

| File | Relative Path | Read By |
|------|--------------|---------|
| 05-software-developer.md | `src/claude/agents/05-software-developer.md` | TC-MLB-01 |
| 06-integration-tester.md | `src/claude/agents/06-integration-tester.md` | TC-MLB-02 |
| data-model-analyzer.md | `src/claude/agents/discover/data-model-analyzer.md` | TC-MLB-03 |
| skills-researcher.md | `src/claude/agents/discover/skills-researcher.md` | TC-MLB-04 |
| test-evaluator.md | `src/claude/agents/discover/test-evaluator.md` | TC-MLB-05 |
| provider.md | `src/claude/commands/provider.md` | TC-MLB-06 |
| discover.md | `src/claude/commands/discover.md` | TC-MLB-07 |
| isdlc.md | `src/claude/commands/isdlc.md` | TC-MLB-08 |
| architecture-analyzer.md | `src/claude/agents/discover/architecture-analyzer.md` | TC-MLB-09 |
| quick-scan-agent.md | `src/claude/agents/quick-scan/quick-scan-agent.md` | TC-MLB-10 |
| CLAUDE.md | `CLAUDE.md` (project root) | TC-MLB-11 to TC-MLB-14, TC-MLB-16 |
| CLAUDE.md.template | `src/claude/CLAUDE.md.template` | TC-MLB-15, TC-MLB-16, TC-MLB-17 |

---

## Synthetic Test Data (for algorithm validation)

These test strings are embedded directly in the test file for TC-MLB-19, TC-MLB-20, and TC-MLB-21.

### Boundary Values

| ID | Input | Expected Result | Used By |
|----|-------|-----------------|---------|
| TD-01 | Empty bash fence: `` ```bash\n``` `` | SAFE (0 non-empty lines) | TC-MLB-21 |
| TD-02 | Single-line bash fence: `` ```bash\nnpm test\n``` `` | SAFE (1 non-empty line) | TC-MLB-21 |
| TD-03 | Two-line bash fence: `` ```bash\nnpm test\nnpm run lint\n``` `` | MULTILINE (2 non-empty lines) | TC-MLB-19 |
| TD-04 | Single line with trailing newline: `` ```bash\nnpm test\n\n``` `` | SAFE (1 non-empty line, 1 blank) | TC-MLB-21 |
| TD-05 | Single line with leading blank: `` ```bash\n\nnpm test\n``` `` | SAFE (1 non-empty line, 1 blank) | TC-MLB-21 |

### Invalid Inputs (multiline patterns that must be detected)

| ID | Input | Pattern Type | Used By |
|----|-------|-------------|---------|
| TD-06 | Comments interleaved: `` ```bash\n# Step 1\ngrep foo\n# Step 2\ngrep bar\n``` `` | comments-interleaved | TC-MLB-19 |
| TD-07 | For-loop: `` ```bash\nfor f in *.md; do\n  grep -l foo "$f"\ndone\n``` `` | for-loop | TC-MLB-20 |
| TD-08 | Piped multiline: `` ```bash\nfind . -name '*.md' \\\n  \| xargs grep foo\n``` `` | line-continuation | TC-MLB-20 |
| TD-09 | Multiple commands: `` ```bash\nnpm test\nnpm run lint\nnpm run build\n``` `` | multi-command | TC-MLB-19 |
| TD-10 | Node -e multiline: `` ```bash\nnode -e "\nconst x = 1;\nconsole.log(x);\n"\n``` `` | node-e-inline | TC-MLB-19 |

### Maximum-Size Inputs

| ID | Input | Purpose | Used By |
|----|-------|---------|---------|
| TD-11 | File with 50 single-line bash fences | Verify scanner handles many blocks without false positives | TC-MLB-21 |
| TD-12 | File with mixed fences: 10 bash (single), 10 json, 10 typescript, 5 text | Verify scanner only flags bash/sh, ignores others | TC-MLB-21 |

### Valid single-line patterns (must NOT be flagged)

| ID | Input | Description | Used By |
|----|-------|-------------|---------|
| TD-13 | `` ```bash\nnpm test -- --testNamePattern="AC1"\n``` `` | Single-line with quotes and special chars | TC-MLB-21 |
| TD-14 | `` ```bash\nfind . -name '*.md' -not -path './node_modules/*' \| head -20\n``` `` | Long single-line with pipes | TC-MLB-21 |
| TD-15 | `` ```bash\ncat .isdlc/state.json \| jq '.testing_infrastructure.tools'\n``` `` | Single-line pipe chain | TC-MLB-21 |
| TD-16 | `` ```sh\nnpm run test:hooks\n``` `` | `sh` tag (not just `bash`) | TC-MLB-21 |

### Non-Bash fences (must be ignored by scanner)

| ID | Input | Description | Used By |
|----|-------|-------------|---------|
| TD-17 | `` ```json\n{\n  "key": "value"\n}\n``` `` | JSON block (multiline, but not bash) | TC-MLB-22 |
| TD-18 | `` ```typescript\nconst x: number = 1;\nconst y = x + 1;\n``` `` | TypeScript block | TC-MLB-22 |
| TD-19 | `` ```\nplain text\nmultiple lines\n``` `` | Untagged fence | TC-MLB-22 |
| TD-20 | `` ```text\n# This is not a bash comment\ngrep foo bar\n``` `` | Text-tagged fence (not executable) | TC-MLB-22 |

---

## Data Generation Strategy

No data generation is needed beyond the inline test strings above. The strategy is:

1. **Production files are the source of truth**: Tests read the actual agent/command `.md` files. No mocking, no copying, no transformation.
2. **Synthetic strings validate the algorithm**: Small, focused test strings ensure the detection regex works correctly for all pattern types.
3. **No external dependencies**: All test data is either on disk (production files) or inline (synthetic strings).

---

## Data Refresh Policy

Test data does not need refreshing. The production files are read at test runtime, so any changes to agent files are automatically reflected in test results. The synthetic test strings are static and represent the canonical multiline patterns that must be detected.

---

## Edge Cases Covered

| Edge Case | Test Data | Rationale |
|-----------|-----------|-----------|
| Empty bash fence | TD-01 | Ensure empty fences don't false-positive |
| Single line with surrounding blanks | TD-04, TD-05 | Blank lines should not inflate the count |
| Very long single line | TD-14 | Long commands with pipes are valid single-line |
| `sh` tag vs `bash` tag | TD-16 | Both should be scanned |
| Non-bash multiline blocks | TD-17 to TD-20 | Must be ignored by the scanner |
| 50+ bash fences in one file | TD-11 | Performance and correctness at scale |
| Mixed fence types | TD-12 | Scanner correctly filters by language tag |
